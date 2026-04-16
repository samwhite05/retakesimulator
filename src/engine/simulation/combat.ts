import { SimAgent, GameEvent } from "@/types";
import { GridMap, TileType } from "@/types";
import { getTile, tileKey } from "./grid";
import { canSeeAgent } from "./vision";
import { WEAPON_DAMAGE, GRID_COLS, GRID_ROWS } from "@/lib/constants";

export interface CombatContext {
  grid: GridMap;
  smokeTiles: Set<string>;
  wallTiles: Set<string>;
}

export function resolveCombat(
  attacker: SimAgent,
  defender: SimAgent,
  ctx: CombatContext
): { winner: SimAgent; loser: SimAgent; damage: number; events: GameEvent[] } {
  const advantage = computeAdvantage(attacker, defender, ctx);
  const winChance = Math.max(0.1, Math.min(0.9, 0.5 + advantage / 100));
  const roll = Math.random();

  const attackerWins = roll < winChance;
  const winner = attackerWins ? attacker : defender;
  const loser = attackerWins ? defender : attacker;

  const weapon = WEAPON_DAMAGE[winner.weapon] || WEAPON_DAMAGE.vandal;
  const damage = Math.floor(weapon.min + Math.random() * (weapon.max - weapon.min));

  const events: GameEvent[] = [
    {
      type: "duel",
      attacker: attacker.agentId,
      defender: defender.agentId,
      winner: winner.agentId,
      damage,
    },
  ];

  loser.hp -= damage;
  if (loser.hp <= 0) {
    loser.alive = false;
    events.push({
      type: "kill",
      victim: loser.agentId,
      killer: winner.agentId,
      position: { x: (loser.position.col + 0.5) / GRID_COLS, y: (loser.position.row + 0.5) / GRID_ROWS },
    });
  }

  // Reset temporary statuses after combat
  attacker.blinded = false;
  attacker.stunned = false;
  defender.blinded = false;
  defender.stunned = false;

  return { winner, loser, damage, events };
}

function computeAdvantage(attacker: SimAgent, defender: SimAgent, ctx: CombatContext): number {
  let advantage = 0;

  const attackerTile = getTile(ctx.grid, attacker.position);
  const defenderTile = getTile(ctx.grid, defender.position);

  // Attacker saw defender first
  if (defender.revealed || canSeeAgent(ctx.grid, attacker, defender, ctx.smokeTiles, ctx.wallTiles)) {
    advantage += 20;
  }

  // Attacker from cover
  if (attackerTile?.type === "cover") {
    advantage += 15;
  }

  // Defender blinded
  if (defender.blinded) {
    advantage += 15;
  }

  // Defender stunned
  if (defender.stunned) {
    advantage += 10;
  }

  // Defender in hidden/off-angle
  if (defender.offAngle) {
    advantage -= 20;
  }

  // Attacker moving through exposed
  if (attackerTile?.type === "exposed") {
    advantage -= 15;
  }

  // Defender on high ground
  if (defenderTile?.type === "high_ground" || (defenderTile?.elevation || 0) > (attackerTile?.elevation || 0)) {
    advantage -= 10;
  }

  // Attacker has HP advantage
  const hpDiff = attacker.hp - defender.hp;
  if (hpDiff > 30) advantage += 5;
  if (hpDiff < -30) advantage -= 5;

  return advantage;
}
