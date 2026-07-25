// Pure render-animation decisions. These functions consume visual distance and
// sim events but never write back to the deterministic match state.
import type { Vec } from '../sim/geometry';
import { slideTackleSpriteFrame, type SlideTackleSpriteFrame } from './sprites/slide-tackle';
import type { PlayerSpriteFrame } from './sprites/slot-key';

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

// A LOST duel: the beaten challenger is knocked off the contact point and leans,
// then settles. ~100 of these fire per match (see duel-scuff.ts), so the whole
// beat is three ticks — 300ms at TICK_MS = 100.
export const STAGGER_TICKS = 3;
/**
 * Fraction of the beat spent being shoved. The knock peaks early and eases back
 * over the remaining three quarters, so it reads as an impact rather than a
 * symmetric wobble.
 */
const STAGGER_ATTACK_FRACTION = 0.25;
/**
 * Peak recoil, in sprite SOURCE pixels along `direction` — the same unit the
 * scuff flecks use, and comparable to the 90-150 pitch-unit presser standoff
 * once magnified, so the shove visibly opens the gap between the two sprites.
 */
export const STAGGER_RECOIL_PIXELS = 5;
/** Peak body tilt in radians (~13°), toward the direction of the shove. */
export const STAGGER_LEAN = 0.22;

export type PlayerActionAnimation =
  | {
      kind: 'slide';
      startTick: number;
      origin: Vec;
      direction: Vec;
      rotation: number;
      untilTick: number;
    }
  | {
      // A beaten challenge (TACKLE won:false, contact:true). Render-only: the
      // sim keeps the loser exactly where it put him, and this offsets the
      // sprite off that coordinate for STAGGER_TICKS before returning to it.
      kind: 'stagger';
      startTick: number;
      /** Unit vector pointing AWAY from the winner. */
      direction: Vec;
      /** Contact point (the two players' midpoint), where the scuff is drawn. */
      contact: Vec;
      rotation: number;
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
  /**
   * Render-only displacement along the action's `direction`, in sprite SOURCE
   * pixels (multiply by the snapped player draw scale to reach pitch units).
   * Only 'stagger' uses it: a slide's travel is real sim movement, and a
   * fall/knockdown blends toward its anchor via `anchorWeight` instead.
   */
  forwardOffset: number;
}

/**
 * Shove envelope: a fast attack to 1, then an eased release back to 0. Zero at
 * both ends, so the sprite leaves and returns to its sim coordinate smoothly
 * instead of snapping when the beat expires.
 *
 * Marked 'worklet' because the Atlas transform worklet calls it directly, which
 * is also why the smoothstep polynomial is written out twice below instead of
 * calling the `smoothstep` arrow const further down this file — that one is not
 * workletised, and folding it in here would break the UI-thread call.
 */
export function staggerPush(elapsedTicks: number): number {
  'worklet';
  const t = elapsedTicks / STAGGER_TICKS;
  if (t <= 0 || t >= 1) return 0;
  if (t < STAGGER_ATTACK_FRACTION) {
    const attack = t / STAGGER_ATTACK_FRACTION;
    return attack * attack * (3 - 2 * attack);
  }
  const release = (t - STAGGER_ATTACK_FRACTION) / (1 - STAGGER_ATTACK_FRACTION);
  return 1 - release * release * (3 - 2 * release);
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
export function runFrameForDistance(distance: number, moved: boolean): 'run0' | 'run1' {
  if (!moved) return 'run0';
  return Math.floor(Math.max(0, distance) / RUN_PHASE_DISTANCE) % 2 === 0 ? 'run0' : 'run1';
}

export function keeperReadyFrame(visualTick: number): 'ready0' | 'ready1' {
  return Math.floor(Math.max(0, visualTick) / 5) % 2 === 0 ? 'ready0' : 'ready1';
}

export function isKeeperReady(ballDistanceSquared: number): boolean {
  return ballDistanceSquared >= KEEPER_READY_DISTANCE * KEEPER_READY_DISTANCE;
}

/**
 * Maps a variable sim slide/recovery window onto the ten authored key poses.
 * Longer missed-tackle recoveries hold the low slide frames longer while the
 * plant, crouch, tuck, knee, rise, and stand beats keep their timing.
 */
export function slideTackleFrameIndex(elapsed: number, duration: number): number {
  const safeDuration = Math.max(SLIDE_TACKLE_TICKS, duration);
  const t = Math.max(0, elapsed);
  if (t < 1) return 0; // plant
  if (t < 2) return 1; // crouch
  if (t >= safeDuration - 1) return 9; // upright
  if (t >= safeDuration - 2) return 8; // rise
  if (t >= safeDuration - 3) return 7; // knee plant
  if (t >= safeDuration - 4) return 6; // tuck

  const slideWindow = Math.max(1, safeDuration - 6);
  const progress = Math.max(0, Math.min(0.999, (t - 2) / slideWindow));
  return 2 + Math.floor(progress * 4); // +26°, +50°, +72°, +78°
}

export function slideTackleSpriteFrameForAction(
  action: Extract<PlayerActionAnimation, { kind: 'slide' }>,
  visualTick: number,
): SlideTackleSpriteFrame {
  return slideTackleSpriteFrame(slideTackleFrameIndex(
    visualTick - action.startTick,
    action.untilTick - action.startTick,
  ));
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

  if (action.kind === 'stagger') {
    const push = staggerPush(elapsed);
    if (push <= 0) return { active: false, rotation: 0, anchorWeight: 0, forwardOffset: 0 };
    return {
      active: true,
      rotation: action.rotation * push,
      anchorWeight: 0,
      forwardOffset: STAGGER_RECOIL_PIXELS * push,
    };
  }

  const duration = action.kind === 'slide' ? action.untilTick - action.startTick : TACKLED_RECOVERY_TICKS;
  if (elapsed >= duration) {
    return { active: false, rotation: 0, anchorWeight: 0, forwardOffset: 0 };
  }

  if (action.kind === 'slide') {
    const frameIndex = slideTackleFrameIndex(elapsed, duration);
    // The dedicated source art is upright for plant/crouch/recovery and
    // horizontal for slide/tuck. Only the horizontal frames rotate into the
    // actual travel direction; the head angle is already baked into the art.
    const followsDirection = frameIndex >= 2 && frameIndex <= 6;
    return {
      active: true,
      rotation: followsDirection ? action.rotation : 0,
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
