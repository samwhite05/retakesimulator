import {
  DecisionChoice,
  DecisionKindId,
  DecisionPoint,
  Position,
  SimAgent,
  Scenario,
  TileCoord,
} from "@/types";
import type { PendingMutation, SimState } from "../simState";

/**
 * The decision catalog. Each `createDecision*` builds a fully-formed
 * `DecisionPoint` with its choices + rationale at the moment the detector
 * fires. Choices are later applied by `applyChoice` which maps choice id
 * onto a set of `PendingMutation`s consumed by the phase stepper.
 *
 * Keeping effects as declarative mutations (instead of direct SimState
 * mutation) makes the server → client payload and resume logic auditable
 * and deterministic.
 */

export interface DecisionFactoryContext {
  state: SimState;
  scenario: Scenario;
  /** Monotonically increasing counter for unique decision ids. */
  nextId(): string;
  turnIndex: number;
}

function tileCenter(tile: TileCoord | undefined): Position | undefined {
  if (!tile) return undefined;
  return { x: (tile.col + 0.5) / 16, y: (tile.row + 0.5) / 16 };
}

/** Convenience: pick a position near an agent for utility injections. */
function positionNear(state: SimState, agentId: string, fallback: Position): Position {
  const a = state.agents.find((x) => x.agentId === agentId && x.alive);
  if (a) return { x: (a.position.col + 0.5) / 16, y: (a.position.row + 0.5) / 16 };
  return fallback;
}

// ─── first_contact ──────────────────────────────────────────────────────────

export function createFirstContactDecision(
  ctx: DecisionFactoryContext,
  attacker: SimAgent,
  defender: SimAgent
): DecisionPoint {
  const choices: DecisionChoice[] = [
    {
      id: "commit_push",
      label: "Commit · Push",
      rationale: "Step into the angle — duel now with a +15% aim edge.",
    },
    {
      id: "hold_flood",
      label: "Flood the Angle",
      rationale: "Drop a smoke on their sightline and strafe behind it.",
    },
    {
      id: "fall_back",
      label: "Fall Back & Re-info",
      rationale: "Pull back a couple tiles, no peek — reset the take.",
      isDefault: true,
    },
  ];

  return {
    id: ctx.nextId(),
    kind: "first_contact",
    triggeredBy: { turnIndex: ctx.turnIndex, agentId: attacker.agentId, tile: defender.position },
    headline: "First contact",
    subline: `${attacker.agentId} sees ${defender.agentId} — push or hold?`,
    timerMs: 10000,
    choices,
  };
}

// ─── ally_down ──────────────────────────────────────────────────────────────

export function createAllyDownDecision(
  ctx: DecisionFactoryContext,
  victim: SimAgent
): DecisionPoint {
  const choices: DecisionChoice[] = [
    {
      id: "press_advantage",
      label: "Press — Avenge",
      rationale: "Whole squad pushes the kill tile — +10% edge, tempo trade.",
    },
    {
      id: "reset_crossfire",
      label: "Reset Crossfires",
      rationale: "Living squad backs off a step and reholds from cover.",
      isDefault: true,
    },
  ];

  return {
    id: ctx.nextId(),
    kind: "ally_down",
    triggeredBy: { turnIndex: ctx.turnIndex, agentId: victim.agentId },
    headline: `${victim.agentId} is down`,
    subline: "Push the trade or re-setup?",
    timerMs: 10000,
    choices,
  };
}

// ─── recon_info ─────────────────────────────────────────────────────────────

export function createReconInfoDecision(
  ctx: DecisionFactoryContext,
  revealedDefenderId: string,
  revealerAgentId: string | undefined
): DecisionPoint {
  const choices: DecisionChoice[] = [
    {
      id: "collapse_on_ping",
      label: "Collapse on Ping",
      rationale: "Squad flexes onto the reveal — stacked push, +12% edge.",
    },
    {
      id: "bank_info",
      label: "Smoke & Bank Info",
      rationale: "Drop a smoke on their angle, deny info, reset to default.",
      isDefault: true,
    },
  ];

  return {
    id: ctx.nextId(),
    kind: "recon_info",
    triggeredBy: { turnIndex: ctx.turnIndex, agentId: revealerAgentId ?? revealedDefenderId },
    headline: "Enemy spotted",
    subline: `${revealedDefenderId} revealed — collapse or bank?`,
    timerMs: 9000,
    choices,
  };
}

// ─── spike_threshold ────────────────────────────────────────────────────────

export function createSpikeThresholdDecision(
  ctx: DecisionFactoryContext,
  secondsLeft: number,
  aliveAttackers: number,
  aliveDefenders: number
): DecisionPoint {
  const urgent = secondsLeft <= 15;
  const choices: DecisionChoice[] = [
    {
      id: "tap_defuse",
      label: urgent ? "Half-tap Defuse" : "Commit Defuse",
      rationale: urgent
        ? "Nearest attacker sprints onto spike — half-cycle now."
        : "Nearest attacker walks onto spike and taps full defuse.",
    },
    {
      id: "clear_first",
      label: "Flash & Clear Angles",
      rationale: "Pop a flash on site, squad fans out to clear — +8% edge.",
      isDefault: !urgent,
    },
    {
      id: "fake_defuse",
      label: "Fake Defuse · Bait",
      rationale: "Defuser taps then pulls — refraggers get +8% on the peeker.",
      isDefault: urgent && aliveAttackers >= aliveDefenders,
    },
  ];

  return {
    id: ctx.nextId(),
    kind: "spike_threshold",
    triggeredBy: { turnIndex: ctx.turnIndex },
    headline: urgent ? "Clock is burning" : "Spike neutralize window",
    subline: `${secondsLeft}s left · ${aliveAttackers}v${aliveDefenders}`,
    timerMs: urgent ? 7000 : 10000,
    choices,
  };
}

// ─── low_hp_duel ────────────────────────────────────────────────────────────

export function createLowHpDuelDecision(
  ctx: DecisionFactoryContext,
  attacker: SimAgent,
  defender: SimAgent
): DecisionPoint {
  const choices: DecisionChoice[] = [
    {
      id: "trade_in",
      label: "Trade In",
      rationale: "Teammate creeps up to trade range — +8% edge on the duel.",
    },
    {
      id: "swap_out",
      label: "Swap — Let Teammate Peek",
      rationale: "Low-HP agent pulls back; full-HP teammate takes the angle.",
      isDefault: true,
    },
  ];

  return {
    id: ctx.nextId(),
    kind: "low_hp_duel",
    triggeredBy: { turnIndex: ctx.turnIndex, agentId: attacker.agentId, tile: defender.position },
    headline: "Low HP, hot angle",
    subline: `${attacker.agentId} at ${attacker.hp}HP — peek or swap?`,
    timerMs: 9000,
    choices,
  };
}

// ─── apply a chosen option ──────────────────────────────────────────────────

function livingAttackerIds(state: SimState): string[] {
  return state.agents
    .filter((a) => a.alive && a.team === "attacker")
    .map((a) => a.agentId);
}

function nearestAttackerTo(state: SimState, target: TileCoord): SimAgent | undefined {
  return state.agents
    .filter((a) => a.alive && a.team === "attacker")
    .slice()
    .sort(
      (a, b) =>
        Math.abs(a.position.col - target.col) + Math.abs(a.position.row - target.row) -
        (Math.abs(b.position.col - target.col) + Math.abs(b.position.row - target.row))
    )[0];
}

/**
 * Turn a `(decision, choiceId)` pair into the mutations that the phase
 * stepper will honour on its next tick. Every meaningful choice should
 * emit at least one mutation that yields a *visible* `GameEvent` on
 * application — that way the player can tell which call landed.
 */
export function applyChoice(
  decision: DecisionPoint,
  choiceId: string,
  state: SimState,
  scenario: Scenario
): PendingMutation[] {
  const out: PendingMutation[] = [];

  switch (decision.kind) {
    case "first_contact": {
      const attackerId = decision.triggeredBy.agentId;
      if (!attackerId) return out;
      const attacker = state.agents.find((a) => a.agentId === attackerId);
      const defenderTile = decision.triggeredBy.tile;
      const defenderPos =
        defenderTile && tileCenter(defenderTile)
          ? tileCenter(defenderTile)!
          : scenario.spikeSite;

      if (choiceId === "commit_push") {
        // Step ~1 tile toward the defender and take the duel with an edge.
        out.push({
          kind: "path_veer",
          agentId: attackerId,
          toward: defenderPos,
          distance: 1.2,
        });
        out.push({ kind: "stim_advantage", agentId: attackerId, amount: 15 });
      } else if (choiceId === "hold_flood") {
        // Drop the smoke directly on the defender's tile to kill their angle,
        // then strafe the attacker sideways behind cover.
        out.push({
          kind: "inject_smoke",
          position: defenderPos,
          radius: 2.5,
          agentId: attackerId,
        });
        if (attacker) {
          // Pick a lateral veer — perpendicular to the attacker→defender line.
          const from = tileCenter(attacker.position)!;
          const dx = defenderPos.x - from.x;
          const dy = defenderPos.y - from.y;
          const lateral = { x: from.x - dy * 0.5, y: from.y + dx * 0.5 };
          out.push({
            kind: "path_veer",
            agentId: attackerId,
            toward: lateral,
            distance: 0.8,
          });
        }
        out.push({ kind: "stim_advantage", agentId: attackerId, amount: 10 });
      } else if (choiceId === "fall_back") {
        // Pull the attacker ~2 tiles away from the defender, skip their peek.
        if (attacker) {
          const from = tileCenter(attacker.position)!;
          const away = {
            x: from.x - (defenderPos.x - from.x),
            y: from.y - (defenderPos.y - from.y),
          };
          out.push({
            kind: "path_veer",
            agentId: attackerId,
            toward: away,
            distance: 2,
          });
        }
        out.push({ kind: "cancel_next_duel_for", agentId: attackerId });
      }
      return out;
    }

    case "ally_down": {
      const ids = livingAttackerIds(state);
      const victim = decision.triggeredBy.agentId
        ? state.agents.find((a) => a.agentId === decision.triggeredBy.agentId)
        : undefined;

      if (choiceId === "press_advantage") {
        const target = victim ? tileCenter(victim.position)! : scenario.spikeSite;
        out.push({
          kind: "group_push",
          agentIds: ids,
          toward: target,
          distance: 1.2,
          stim: 10,
        });
      } else if (choiceId === "reset_crossfire") {
        // Each attacker takes a half-tile step back toward the midpoint of
        // their original path — they "rehold" a safer cover tile.
        for (const aid of ids) {
          const path = state.plan.movementPaths.find((p) => p.agentId === aid);
          if (!path || path.path.length === 0) continue;
          const mid = path.path[Math.max(0, Math.floor(path.path.length / 2))];
          out.push({
            kind: "path_veer",
            agentId: aid,
            toward: mid,
            distance: 1.2,
          });
        }
        // And the front-most attacker skips a hot peek.
        const first = state.agents.find((a) => a.alive && a.team === "attacker");
        if (first) {
          out.push({ kind: "cancel_next_duel_for", agentId: first.agentId });
        }
      }
      return out;
    }

    case "recon_info": {
      const revealedTile = decision.triggeredBy.tile;
      const revealedAgentId = state.agents.find(
        (a) =>
          a.team === "defender" &&
          a.alive &&
          revealedTile &&
          a.position.col === revealedTile.col &&
          a.position.row === revealedTile.row
      )?.agentId;

      if (choiceId === "collapse_on_ping") {
        if (revealedAgentId) {
          out.push({ kind: "reveal_defender", defenderId: revealedAgentId });
        }
        if (revealedTile) {
          const ids = livingAttackerIds(state);
          out.push({
            kind: "group_push",
            agentIds: ids,
            toward: tileCenter(revealedTile)!,
            distance: 1.4,
            stim: 12,
          });
        }
      } else if (choiceId === "bank_info") {
        if (revealedAgentId) {
          out.push({ kind: "reveal_defender", defenderId: revealedAgentId });
        }
        // Deny the revealed angle by smoking it — everyone resets to defaults.
        if (revealedTile) {
          const anchor = livingAttackerIds(state)[0] ?? "controller";
          out.push({
            kind: "inject_smoke",
            position: tileCenter(revealedTile)!,
            radius: 1.8,
            agentId: anchor,
          });
        }
      }
      return out;
    }

    case "spike_threshold": {
      const ids = livingAttackerIds(state);
      const spikePos = scenario.spikeSite;
      const spikeTile: TileCoord = {
        col: Math.floor(spikePos.x * 16),
        row: Math.floor(spikePos.y * 16),
      };

      if (choiceId === "tap_defuse") {
        const defuser = nearestAttackerTo(state, spikeTile);
        if (defuser) {
          out.push({
            kind: "reposition_agent",
            agentId: defuser.agentId,
            position: spikePos,
          });
        }
        out.push({ kind: "force_defuse_attempt" });
      } else if (choiceId === "clear_first") {
        // Pop a flash on site, scatter attackers to flanks, bump each's edge.
        const anchor = ids[0];
        if (anchor) {
          out.push({
            kind: "inject_flash",
            position: spikePos,
            agentId: anchor,
            angle: 0,
          });
        }
        const offsets: Position[] = [
          { x: spikePos.x - 0.09, y: spikePos.y },
          { x: spikePos.x + 0.09, y: spikePos.y },
          { x: spikePos.x, y: spikePos.y - 0.09 },
          { x: spikePos.x, y: spikePos.y + 0.09 },
        ];
        ids.forEach((aid, i) => {
          const target = offsets[i % offsets.length];
          out.push({
            kind: "path_veer",
            agentId: aid,
            toward: target,
            distance: 1.4,
          });
          out.push({ kind: "stim_advantage", agentId: aid, amount: 8 });
        });
      } else if (choiceId === "fake_defuse") {
        const defuser = nearestAttackerTo(state, spikeTile);
        if (defuser) {
          out.push({
            kind: "reposition_agent",
            agentId: defuser.agentId,
            position: spikePos,
          });
        }
        out.push({ kind: "force_defuse_attempt" });
        for (const aid of ids) {
          out.push({ kind: "stim_advantage", agentId: aid, amount: 8 });
        }
      }
      return out;
    }

    case "low_hp_duel": {
      const attackerId = decision.triggeredBy.agentId;
      if (!attackerId) return out;
      const attacker = state.agents.find((a) => a.agentId === attackerId);
      if (!attacker) return out;

      if (choiceId === "swap_out") {
        // Find a healthy teammate to take the peek; physically swap them.
        const teammate = state.agents.find(
          (a) =>
            a.alive && a.team === "attacker" && a.agentId !== attackerId && a.hp >= 80
        );
        if (teammate) {
          const atkPos = tileToPosExact(attacker.position);
          const tmtPos = tileToPosExact(teammate.position);
          out.push({
            kind: "reposition_agent",
            agentId: attackerId,
            position: tmtPos,
          });
          out.push({
            kind: "reposition_agent",
            agentId: teammate.agentId,
            position: atkPos,
          });
          out.push({ kind: "swap_duel_order", firstAgentId: teammate.agentId });
          out.push({ kind: "stim_advantage", agentId: teammate.agentId, amount: 5 });
        }
        out.push({ kind: "cancel_next_duel_for", agentId: attackerId });
      } else if (choiceId === "trade_in") {
        // Pick the nearest teammate (not the low-HP attacker) and creep them
        // up toward the attacker's tile so the trade window is tight.
        const atkTile = attacker.position;
        const teammate = state.agents
          .filter(
            (a) =>
              a.alive && a.team === "attacker" && a.agentId !== attackerId
          )
          .slice()
          .sort(
            (a, b) =>
              Math.abs(a.position.col - atkTile.col) +
              Math.abs(a.position.row - atkTile.row) -
              (Math.abs(b.position.col - atkTile.col) +
                Math.abs(b.position.row - atkTile.row))
          )[0];
        if (teammate) {
          out.push({
            kind: "path_veer",
            agentId: teammate.agentId,
            toward: tileToPosExact(attacker.position),
            distance: 1.5,
          });
        }
        out.push({ kind: "stim_advantage", agentId: attackerId, amount: 8 });
      }
      return out;
    }

    case "utility_window":
      return out;
  }
  return out;
}

function tileToPosExact(tile: TileCoord): Position {
  return { x: (tile.col + 0.5) / 16, y: (tile.row + 0.5) / 16 };
}

/** Map choice id → a short human verb for the live retrospective ("Flooded the angle"). */
export function describeChoice(decision: DecisionPoint, choiceId: string): string {
  const c = decision.choices.find((x) => x.id === choiceId);
  return c?.label ?? "Stick to plan";
}

/** The default choice for a decision — used when the timer runs out. */
export function defaultChoiceId(decision: DecisionPoint): string {
  const def = decision.choices.find((c) => c.isDefault);
  return def?.id ?? decision.choices[decision.choices.length - 1]?.id ?? decision.choices[0]?.id;
}

/** Exported for type augmentation convenience. */
export type { DecisionKindId };
