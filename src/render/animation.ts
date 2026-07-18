// Pure render-animation decisions. These functions consume visual distance and
// sim events but never write back to the deterministic match state.
import type { Vec } from '../sim/geometry';

export const RUN_PHASE_DISTANCE = 110;
export const KEEPER_READY_DISTANCE = 4_800;
// Default launch + successful recovery presentation. A missed slide can extend
// its own `untilTick`; actual forward travel now comes from sim coordinates.
export const SLIDE_TACKLE_TICKS = 10;
export const TACKLED_RECOVERY_TICKS = 10;
// A knockdown drops in over KNOCKDOWN_DROP_TICKS and stands back up over the
// last KNOCKDOWN_RISE_TICKS before the player's recovery tick; the long flat
// hold in between is however many ticks the sim keeps them out.
export const KNOCKDOWN_DROP_TICKS = 1.6;
export const KNOCKDOWN_RISE_TICKS = 4;

export type PlayerSpriteFrame = 'run0' | 'run1' | 'ready0' | 'ready1';

export type PlayerActionAnimation =
  | {
      kind: 'slide';
      startTick: number;
      direction: Vec;
      rotation: number;
      untilTick: number;
    }
  | {
      kind: 'fall';
      startTick: number;
      anchor: Vec;
      rotation: number;
    }
  | {
      // A knocked-OUT player (Super Strength boom, Fire Torch ignite). Unlike
      // 'fall' (a quick dispossession that recovers in TACKLED_RECOVERY_TICKS),
      // this holds the player prone until their sim recovery tick (`untilTick`,
      // read from outUntilTick when the event fires) and then stands them up.
      kind: 'knockdown';
      startTick: number;
      anchor: Vec;
      rotation: number;
      untilTick: number;
    };

export interface ActionPose {
  active: boolean;
  rotation: number;
  anchorWeight: number;
  forwardOffset: number;
}
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const smoothstep = (value: number) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};

/**
 * Each run pose covers a fixed amount of pitch, so faster players cycle their
 * feet faster instead of skating farther during the same wall-clock interval.
 */
export function runFrameForDistance(distance: number, moved: boolean): PlayerSpriteFrame {
  if (!moved) return 'run0';
  return Math.floor(Math.max(0, distance) / RUN_PHASE_DISTANCE) % 2 === 0 ? 'run0' : 'run1';
}

export function keeperReadyFrame(visualTick: number): PlayerSpriteFrame {
  return Math.floor(Math.max(0, visualTick) / 5) % 2 === 0 ? 'ready0' : 'ready1';
}

export function isKeeperReady(ballDistanceSquared: number): boolean {
  return ballDistanceSquared >= KEEPER_READY_DISTANCE * KEEPER_READY_DISTANCE;
}

/**
 * A tackle attempt drops quickly into a slide, holds low through contact, then
 * rises. Forward travel is intentionally zero here: the deterministic player
 * coordinate now performs the lunge and remains at its landing position.
 */
export function actionPose(action: PlayerActionAnimation | undefined, visualTick: number): ActionPose {
  if (!action) return { active: false, rotation: 0, anchorWeight: 0, forwardOffset: 0 };

  const elapsed = visualTick - action.startTick;
  if (elapsed < 0) return { active: false, rotation: 0, anchorWeight: 0, forwardOffset: 0 };

  if (action.kind === 'knockdown') {
    // Held flat for the whole out window: drop in, hold prone, then rise over
    // the final KNOCKDOWN_RISE_TICKS so the get-up lands exactly on recovery.
    if (visualTick >= action.untilTick) {
      return { active: false, rotation: 0, anchorWeight: 0, forwardOffset: 0 };
    }
    const drop = smoothstep(elapsed / KNOCKDOWN_DROP_TICKS);
    const rise = smoothstep((visualTick - (action.untilTick - KNOCKDOWN_RISE_TICKS)) / KNOCKDOWN_RISE_TICKS);
    const down = drop * (1 - rise);
    return { active: true, rotation: action.rotation * down, anchorWeight: down, forwardOffset: 0 };
  }

  const duration = action.kind === 'slide' ? action.untilTick - action.startTick : TACKLED_RECOVERY_TICKS;
  if (elapsed >= duration) {
    return { active: false, rotation: 0, anchorWeight: 0, forwardOffset: 0 };
  }

  if (action.kind === 'slide') {
    const drop = smoothstep(elapsed / 1.2);
    const rise = smoothstep((visualTick - (action.untilTick - 3)) / 3);
    const low = drop * (1 - rise);
    return {
      active: true,
      rotation: action.rotation * low,
      anchorWeight: 0,
      forwardOffset: 0,
    };
  }

  const fall = smoothstep(elapsed / 1.6);
  const recovery = smoothstep((elapsed - 5) / 5);
  return {
    active: true,
    rotation: action.rotation * fall * (1 - recovery),
    // Hold at the contact point while down, then blend back to the live sim
    // position as the player gets up.
    anchorWeight: 1 - recovery,
    forwardOffset: 0,
  };
}
