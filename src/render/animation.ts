// Pure render-animation decisions. These functions consume visual distance and
// sim events but never write back to the deterministic match state.
import type { Vec } from '../sim/geometry';

export const RUN_PHASE_DISTANCE = 110;
export const KEEPER_READY_DISTANCE = 4_800;
export const SLIDE_TACKLE_TICKS = 5;
export const TACKLED_RECOVERY_TICKS = 10;

export type PlayerSpriteFrame = 'run0' | 'run1' | 'ready0' | 'ready1';

export type PlayerActionAnimation =
  | {
      kind: 'slide';
      startTick: number;
      direction: Vec;
      rotation: number;
    }
  | {
      kind: 'fall';
      startTick: number;
      anchor: Vec;
      rotation: number;
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
 * rises. The small forward offset sells momentum without changing sim space.
 */
export function actionPose(action: PlayerActionAnimation | undefined, visualTick: number): ActionPose {
  if (!action) return { active: false, rotation: 0, anchorWeight: 0, forwardOffset: 0 };

  const elapsed = visualTick - action.startTick;
  const duration = action.kind === 'slide' ? SLIDE_TACKLE_TICKS : TACKLED_RECOVERY_TICKS;
  if (elapsed < 0 || elapsed >= duration) {
    return { active: false, rotation: 0, anchorWeight: 0, forwardOffset: 0 };
  }

  if (action.kind === 'slide') {
    const drop = smoothstep(elapsed / 1.2);
    const rise = smoothstep((elapsed - 3.5) / 1.5);
    const low = drop * (1 - rise);
    return {
      active: true,
      rotation: action.rotation * low,
      anchorWeight: 0,
      forwardOffset: Math.sin((elapsed / SLIDE_TACKLE_TICKS) * Math.PI) * 120,
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
