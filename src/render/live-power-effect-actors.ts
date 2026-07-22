import type { PowerId } from '../sim/types';
import { powerEffectFrame } from './power-effect-descriptors';

export interface LivePowerEffectPoint {
  readonly x: number;
  readonly y: number;
}

export interface LivePowerEffectActor {
  readonly id: string;
  readonly player: number;
  readonly at: LivePowerEffectPoint;
  readonly opacity: number;
  /** Multiplier over the ordinary on-pitch player draw scale. */
  readonly scale: number;
}

export interface LivePowerEffectActorInput {
  readonly id: string;
  readonly power: PowerId;
  readonly player: number;
  readonly elapsedMs: number;
  readonly width: number;
  readonly height: number;
  readonly origin: LivePowerEffectPoint;
  readonly targets: readonly LivePowerEffectPoint[];
  readonly direction: -1 | 1;
  readonly reduceMotion?: boolean;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function mix(from: number, to: number, progress: number): number {
  return from + (to - from) * clamp01(progress);
}

function pointAlong(
  from: LivePowerEffectPoint,
  to: LivePowerEffectPoint,
  progress: number,
): LivePowerEffectPoint {
  return { x: mix(from.x, to.x, progress), y: mix(from.y, to.y, progress) };
}

function segment(progress: number, start: number, end: number): number {
  return clamp01((progress - start) / Math.max(0.001, end - start));
}

function easeOut(progress: number): number {
  const p = clamp01(progress);
  return 1 - (1 - p) * (1 - p);
}

function easeInOut(progress: number): number {
  const p = clamp01(progress);
  return p < 0.5 ? 2 * p * p : 1 - ((-2 * p + 2) ** 2) / 2;
}

/**
 * Body-shaped power art for watched matches. Every entry points at an actual
 * match player; MatchScreen resolves that player's current atlas cell and
 * batches all copies into one Atlas draw call. Powers whose real player is
 * already moving in the main Atlas deliberately return no duplicate body.
 */
export function livePowerEffectActors(input: LivePowerEffectActorInput): LivePowerEffectActor[] {
  const frame = powerEffectFrame(input.power, input.elapsedMs, input.reduceMotion);
  const p = frame.progress;
  const unit = Math.max(5, Math.min(input.width, input.height) / 18);
  const target = input.targets[0] ?? {
    x: input.origin.x + input.width * 0.08,
    y: input.origin.y + input.direction * input.height * 0.38,
  };
  const secondary = input.targets[1] ?? target;

  if (input.power === 'PHASE_RUN') {
    const phased = pointAlong(input.origin, target, easeInOut(segment(p, 0.18, 0.78)));
    return [0, 1, 2].map(index => ({
      id: `${input.id}:phase:${index}`,
      player: input.player,
      at: {
        x: phased.x - unit * (index + 1) * 0.7,
        y: phased.y + unit * index * 0.25,
      },
      opacity: 0.16 + index * 0.12,
      scale: 1,
    }));
  }

  if (input.power === 'DECOY_DOUBLE') {
    const project = segment(p, 0.08, 0.28);
    const run = easeInOut(segment(p, 0.26, 0.78));
    return [{
      id: `${input.id}:clone`,
      player: input.player,
      at: pointAlong(input.origin, secondary, run),
      opacity: (0.42 + 0.35 * 0.88) * project,
      scale: 1,
    }];
  }

  if (input.power === 'SHADOW_MARK') {
    const pop = easeOut(segment(p, 0.7, 0.88));
    if (pop <= 0) return [];
    return [{
      id: `${input.id}:pop`,
      player: input.player,
      at: { x: target.x, y: target.y + unit * (2.2 - pop * 2.2) },
      opacity: pop,
      scale: 1,
    }];
  }

  if (input.power === 'GIANT_GK') {
    const grow = easeOut(segment(p, 0.05, 0.5));
    return [{
      id: `${input.id}:giant`,
      player: input.player,
      at: input.origin,
      opacity: 0.95,
      scale: 1 + grow * 1.05,
    }];
  }

  return [];
}

export function superSpeedAfterimageActors(
  player: number,
  trail: readonly LivePowerEffectPoint[],
): LivePowerEffectActor[] {
  return trail.slice(1, 7).map((at, index) => ({
    id: `super-speed:${player}:${index}`,
    player,
    at,
    opacity: Math.max(0.12, 0.58 * (1 - index / 6)),
    scale: 1,
  }));
}
