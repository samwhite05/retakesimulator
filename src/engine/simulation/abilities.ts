import { UtilityItem, GameEvent, TileCoord, SimAgent, GridMap } from "@/types";
import { getTilesInRadius, getLineTiles, tileKey, posToTile, tileToPos, getTile, isImpassableTerrain } from "./grid";
import { hasLineOfSight } from "./vision";
import { getUtilityRenderSpec, METERS_PER_TILE } from "@/lib/constants";

export interface AbilityContext {
  grid: GridMap;
  smokeTiles: Set<string>;
  wallTiles: Set<string>;
  mollieTiles: Set<string>;
  trapTiles: Map<string, string>;
  agents: SimAgent[];
}

/** Radius in tiles for a given util placement, sourced from its authored render
 *  spec so sim logic stays in sync with what the planner draws on the map. */
function tileRadiusFor(util: UtilityItem): number {
  const spec = getUtilityRenderSpec(util.agentId, util.type);
  if (spec.shape === "circle" && spec.radiusMeters) {
    return Math.max(1, spec.radiusMeters / METERS_PER_TILE / 2);
  }
  if (spec.widthMeters) {
    return Math.max(1, spec.widthMeters / METERS_PER_TILE / 2);
  }
  return 2;
}

/** Half-length in tiles for capsule-shape util (Breach Fault Line / Aftershock / Flashpoint, Omen Paranoia). */
function capsuleGeomFor(util: UtilityItem): { halfLength: number; halfWidth: number } | null {
  const spec = getUtilityRenderSpec(util.agentId, util.type);
  if (spec.shape !== "capsule" || !spec.lengthMeters || !spec.widthMeters) return null;
  return {
    halfLength: Math.max(1, spec.lengthMeters / METERS_PER_TILE / 2),
    halfWidth: Math.max(1, spec.widthMeters / METERS_PER_TILE / 2),
  };
}

/** Returns tiles that fall inside a capsule directed from `start` toward `target`. */
function capsuleTiles(
  grid: GridMap,
  start: TileCoord,
  target: TileCoord | null,
  halfLength: number,
  halfWidth: number
): TileCoord[] {
  const dx = (target?.col ?? start.col + 1) - start.col;
  const dy = (target?.row ?? start.row) - start.row;
  const mag = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux = dx / mag;
  const uy = dy / mag;
  const px = -uy;
  const py = ux;
  const tiles: TileCoord[] = [];
  const reach = Math.ceil(halfLength);
  for (let t = 0; t <= reach * 2; t++) {
    for (let w = -Math.ceil(halfWidth); w <= Math.ceil(halfWidth); w++) {
      const col = Math.round(start.col + ux * t + px * w);
      const row = Math.round(start.row + uy * t + py * w);
      if (col < 0 || row < 0 || col >= grid.cols || row >= grid.rows) continue;
      tiles.push({ col, row });
    }
  }
  return tiles;
}

/** Dot product between a defender's facing (toward their lookAt / site) and a
 *  vector toward the flash position. Positive means the defender is broadly
 *  looking at the flash and therefore vulnerable. */
function defenderFacesPoint(defender: SimAgent, point: TileCoord): number {
  // Defenders are authored to face the spike site; approximate by pointing
  // toward the current attacker push. Since we don't have per-agent facing
  // stored, we assume the defender faces roughly toward the centre of the
  // attacker formation (handled by giving a baseline 0.35 dot).
  const dx = point.col - defender.position.col;
  const dy = point.row - defender.position.row;
  const mag = Math.sqrt(dx * dx + dy * dy) || 1;
  // Bias toward "aware" — defenders tend to see incoming utility most of the
  // time. Tuning this higher makes flashes more punishing.
  return 0.35 + Math.max(0, dx / mag) * 0.5;
}

export function resolveUtility(
  util: UtilityItem,
  ctx: AbilityContext
): GameEvent[] {
  const events: GameEvent[] = [];
  const center = posToTile(util.position);
  const target = util.target ? posToTile(util.target) : null;
  const spec = getUtilityRenderSpec(util.agentId, util.type);

  switch (util.type) {
    case "smoke": {
      const radius = tileRadiusFor(util);
      const tiles = getTilesInRadius(center, radius);
      for (const t of tiles) {
        if (!isImpassableTerrain(getTile(ctx.grid, t)?.type ?? "void")) {
          ctx.smokeTiles.add(tileKey(t));
        }
      }
      events.push({
        type: "smoke_expand",
        agentId: util.agentId,
        position: tileToPos(center),
        radius,
      });
      break;
    }

    case "flash": {
      const path = util.path?.map(posToTile) || [center];
      const detonatePos = path[path.length - 1];
      const detonateTile = tileToPos(detonatePos);
      const angle = Math.atan2(detonatePos.row - center.row, detonatePos.col - center.col);

      events.push({
        type: "flash_travel",
        agentId: util.agentId,
        path: path.map(tileToPos),
      });

      events.push({
        type: "flash_detonate",
        agentId: util.agentId,
        position: detonateTile,
        angle,
      });

      // Capsule flashes (Omen Paranoia, Breach Flashpoint) blind every defender
      // the cone passes through so long as there's line-of-sight to the origin.
      const cap = capsuleGeomFor(util);
      if (cap) {
        const capTiles = capsuleTiles(ctx.grid, center, target, cap.halfLength, cap.halfWidth);
        const capKeys = new Set(capTiles.map(tileKey));
        for (const a of ctx.agents) {
          if (!a.alive || a.team !== "defender") continue;
          if (!capKeys.has(tileKey(a.position))) continue;
          if (!hasLineOfSight(ctx.grid, center, a.position, ctx.smokeTiles, ctx.wallTiles)) continue;
          a.blinded = true;
        }
        break;
      }

      // Circle flashes: only blind enemies with LOS to the pop point AND who
      // are facing it. Walls, smokes, and looking away all shield a defender.
      const blindRadius = Math.max(2, Math.ceil((spec.radiusMeters ?? 4) / METERS_PER_TILE));
      const blinded = getTilesInRadius(detonatePos, blindRadius);
      const keys = new Set(blinded.map(tileKey));
      for (const a of ctx.agents) {
        if (!a.alive || a.team !== "defender") continue;
        if (!keys.has(tileKey(a.position))) continue;
        if (!hasLineOfSight(ctx.grid, detonatePos, a.position, ctx.smokeTiles, ctx.wallTiles)) continue;
        if (defenderFacesPoint(a, detonatePos) < 0.35) continue;
        a.blinded = true;
      }
      break;
    }

    case "mollie":
    case "nanoswarm": {
      const radius = tileRadiusFor(util);
      const cap = capsuleGeomFor(util);
      const tiles = cap
        ? capsuleTiles(ctx.grid, center, target, cap.halfLength, cap.halfWidth)
        : getTilesInRadius(center, radius);
      for (const t of tiles) {
        if (!isImpassableTerrain(getTile(ctx.grid, t)?.type ?? "void")) {
          ctx.mollieTiles.add(tileKey(t));
        }
      }
      events.push({
        type: "mollie_erupt",
        agentId: util.agentId,
        position: tileToPos(center),
        radius,
      });

      // Any defender currently standing inside the new AOE takes the initial
      // hit. Pre-planted incendiaries into known hold angles now actually
      // matter instead of only biting attackers who walk through later.
      const keys = new Set(tiles.map(tileKey));
      for (const a of ctx.agents) {
        if (!a.alive || a.team !== "defender") continue;
        if (!keys.has(tileKey(a.position))) continue;
        a.hp -= 40;
        if (a.hp <= 0) {
          a.alive = false;
          events.push({
            type: "kill",
            victim: a.agentId,
            killer: util.agentId,
            position: tileToPos(a.position),
          });
        }
      }
      break;
    }

    case "dart": {
      const path = util.path?.map(posToTile) || [center];
      const end = path[path.length - 1];
      events.push({
        type: "dart_fire",
        agentId: util.agentId,
        path: path.map(tileToPos),
      });

      // Ping every defender inside scan radius with LOS from the dart head.
      const revealRadius = Math.max(3, Math.ceil((spec.radiusMeters ?? 6) / METERS_PER_TILE / 2));
      const tiles = getTilesInRadius(end, revealRadius);
      const scannedKeys = new Set(tiles.map(tileKey));
      for (const a of ctx.agents) {
        if (!a.alive || a.team !== "defender") continue;
        if (!scannedKeys.has(tileKey(a.position))) continue;
        if (!hasLineOfSight(ctx.grid, end, a.position, ctx.smokeTiles, ctx.wallTiles)) continue;
        a.revealed = true;
        events.push({
          type: "reveal",
          agentId: util.agentId,
          position: tileToPos(a.position),
          revealedEnemy: a.agentId,
        });
      }
      break;
    }

    case "wall": {
      // Respect the agent's render spec for length. Default 6 tiles if we don't
      // know the spec, so homemade agents still get a sensible wall.
      const length = Math.max(2, Math.round((spec.lengthMeters ?? 8) / METERS_PER_TILE / 2));
      const end = target
        ? posToTile(util.target!)
        : { col: center.col + length, row: center.row };
      const line = getLineTiles(center, end);
      for (const t of line) {
        if (!isImpassableTerrain(getTile(ctx.grid, t)?.type ?? "void")) {
          ctx.wallTiles.add(tileKey(t));
        }
      }
      events.push({
        type: "wall_raise",
        agentId: util.agentId,
        tiles: line.map(tileToPos),
      });
      break;
    }

    case "heal": {
      const healer = ctx.agents.find((a) => a.agentId === util.agentId);
      if (healer) {
        let nearest: SimAgent | null = null;
        let bestDist = Infinity;
        for (const ally of ctx.agents) {
          if (ally.alive && ally.team === healer.team && ally.agentId !== healer.agentId) {
            const dist = Math.abs(ally.position.col - center.col) + Math.abs(ally.position.row - center.row);
            if (dist <= 2 && dist < bestDist) {
              bestDist = dist;
              nearest = ally;
            }
          }
        }
        if (nearest) {
          const amount = Math.min(50, nearest.maxHp - nearest.hp);
          nearest.hp += amount;
          events.push({
            type: "heal",
            agentId: util.agentId,
            target: nearest.agentId,
            amount,
          });
        }
      }
      break;
    }

    case "trap":
    case "tripwire":
    case "alarm": {
      // Traps can be wire-shaped (Cypher Trapwire); drop a trigger tile at each
      // end so walking into either wire-post fires the trap.
      if (util.type === "tripwire" && util.path && util.path.length >= 2) {
        for (const p of util.path) {
          ctx.trapTiles.set(tileKey(posToTile(p)), util.agentId);
        }
        break;
      }
      ctx.trapTiles.set(tileKey(center), util.agentId);
      break;
    }

    case "concussion": {
      const cap = capsuleGeomFor(util);
      const tiles = cap
        ? capsuleTiles(ctx.grid, center, target, cap.halfLength, cap.halfWidth)
        : getTilesInRadius(center, tileRadiusFor(util));
      const keys = new Set(tiles.map(tileKey));
      for (const a of ctx.agents) {
        if (!a.alive || a.team !== "defender") continue;
        if (!keys.has(tileKey(a.position))) continue;
        if (!hasLineOfSight(ctx.grid, center, a.position, ctx.smokeTiles, ctx.wallTiles)) continue;
        a.stunned = true;
        a.revealed = true;
      }
      break;
    }

    case "gravity_well": {
      // Astra Gravity Well. Suck anyone inside and briefly stun + reveal them.
      const radius = tileRadiusFor(util);
      const tiles = getTilesInRadius(center, radius);
      const keys = new Set(tiles.map(tileKey));
      for (const a of ctx.agents) {
        if (!a.alive) continue;
        if (!keys.has(tileKey(a.position))) continue;
        if (a.team === "defender") {
          a.stunned = true;
          a.revealed = true;
        }
      }
      break;
    }

    case "sensor":
    case "turret": {
      // Sensors ping anyone who walks inside their scan radius. We pre-seed
      // currently-visible defenders at placement time so the cinematic shows
      // an immediate reveal ring (mirroring Killjoy Turret acquiring targets).
      const radius = Math.max(3, Math.ceil((spec.radiusMeters ?? 5) / METERS_PER_TILE / 2));
      const tiles = getTilesInRadius(center, radius);
      const keys = new Set(tiles.map(tileKey));
      for (const a of ctx.agents) {
        if (!a.alive || a.team !== "defender") continue;
        if (!keys.has(tileKey(a.position))) continue;
        if (!hasLineOfSight(ctx.grid, center, a.position, ctx.smokeTiles, ctx.wallTiles)) continue;
        a.revealed = true;
        events.push({
          type: "reveal",
          agentId: util.agentId,
          position: tileToPos(a.position),
          revealedEnemy: a.agentId,
        });
      }
      break;
    }

    case "dash":
    case "updraft":
    case "decoy":
    case "revive":
      // No-op at utility resolve time; handled in movement / combat passes.
      break;
  }

  return events;
}

export function checkMollieDamage(agent: SimAgent, ctx: AbilityContext): GameEvent[] {
  const events: GameEvent[] = [];
  const key = tileKey(agent.position);
  if (ctx.mollieTiles.has(key) && agent.alive) {
    agent.hp -= 50;
    if (agent.hp <= 0) {
      agent.alive = false;
      events.push({
        type: "kill",
        victim: agent.agentId,
        killer: "mollie",
        position: tileToPos(agent.position),
      });
    }
  }
  return events;
}

export function checkTraps(agent: SimAgent, ctx: AbilityContext): GameEvent[] {
  const events: GameEvent[] = [];
  const key = tileKey(agent.position);
  if (ctx.trapTiles.has(key) && agent.alive && agent.team === "defender") {
    const trapOwner = ctx.trapTiles.get(key)!;
    agent.hp -= 80;
    agent.revealed = true;
    events.push({
      type: "trap_trigger",
      agentId: trapOwner,
      victim: agent.agentId,
      position: tileToPos(agent.position),
    });
    if (agent.hp <= 0) {
      agent.alive = false;
      events.push({
        type: "kill",
        victim: agent.agentId,
        killer: trapOwner,
        position: tileToPos(agent.position),
      });
    }
    ctx.trapTiles.delete(key);
  }
  return events;
}

/** Used by `canSeeAgent` callers to check if smokes clear before the combat
 *  phase actually rolls. Not currently consumed; exported for future hooks. */
export function smokeKeys(ctx: AbilityContext): Set<string> {
  return ctx.smokeTiles;
}
