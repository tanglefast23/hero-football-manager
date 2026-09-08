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
  return p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
}

/**
 * Body-shaped power art for watched matches. Every entry points at an actual
 * match player; MatchScreen resolves that player's current atlas cell and
 * batches all copies into one Atlas draw call. Powers whose real player is
 * already moving in the main Atlas deliberately return no duplicate body.
 */
export function livePowerEffectActors(
  input: LivePowerEffectActorInput,
): LivePowerEffectActor[] {
  const frame = powerEffectFrame(
    input.power,
    input.elapsedMs,
    input.reduceMotion,
  );
  const p = frame.progress;
  const unit = Math.max(5, Math.min(input.width, input.height) / 18);
  const target = input.targets[0] ?? {
    x: input.origin.x + input.width * 0.08,
    y: input.origin.y + input.direction * input.height * 0.38,
  };
  if (input.power === 'PHASE_RUN') {
    const phased = pointAlong(
      input.origin,
      target,
      easeInOut(segment(p, 0.18, 0.78)),
    );
    return [0, 1, 2].map((index) => ({
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

  if (input.power === 'SHADOW_MARK') {
    const pop = easeOut(segment(p, 0.7, 0.88));
    if (pop <= 0) return [];
    return [
      {
        id: `${input.id}:pop`,
        player: input.player,
        at: { x: target.x, y: target.y + unit * (2.2 - pop * 2.2) },
        opacity: pop,
        scale: 1,
      },
    ];
  }

  if (input.power === 'GIANT_GK') {
    const grow = easeOut(segment(p, 0.05, 0.5));
    return [
      {
        id: `${input.id}:giant`,
        player: input.player,
        at: input.origin,
        opacity: 0.95,
        scale: 1 + grow * 1.05,
      },
    ];
  }

  return [];
}

/**
 * How many afterimage ghosts an entity draws this frame.
 *
 * 6 for a live Super Speed hero, 3 for a pass-combo member at x5 or above, 0
 * for everyone else. 3x can disable combo trails while keeping Super Speed.
 * An entity that is both takes 6 and gets ONE trail — the
 * power outranks the combo because it is the bigger effect.
 *
 * The combo gate reads the TIER, not the live bonus and not the chain count.
 * The bonus being non-zero would light the trail on x2; the count would kill it
 * the instant the chain broke, while the member is still visibly fast. A tier
 * of 1500 or 2000 can only have come from x5 or above, and it survives until
 * the countdown reaches zero.
 */
const COMBO_TRAIL_MIN_TIER_D = 1500;
export function trailGhostsFor(
  entity: {
    def: { power?: string };
    powerState: { kind: string };
    comboTierD: number;
    comboTicks: number;
  },
  allowComboTrails = true,
): number {
  if (entity.def.power === 'SUPER_SPEED' && entity.powerState.kind === 'active')
    return 6;
  if (
    allowComboTrails &&
    entity.comboTierD >= COMBO_TRAIL_MIN_TIER_D &&
    entity.comboTicks > 0
  )
    return 3;
  return 0;
}

/**
 * Ghost sprites behind a moving player. `ghosts` defaults to 6, the Super Speed
 * power's own length; a pass-combo member at x5 gets 3.
 *
 * `trail` needs `ghosts + 1` stored points: index 0 is the live body position
 * and only the tail becomes ghosts. Storing exactly as many points as ghosts
 * would quietly emit one fewer than asked for.
 */
export function superSpeedAfterimageActors(
  player: number,
  trail: readonly LivePowerEffectPoint[],
  ghosts = 6,
): LivePowerEffectActor[] {
  return trail.slice(1, 1 + ghosts).map((at, index) => ({
    id: `super-speed:${player}:${index}`,
    player,
    at,
    opacity: Math.max(0.12, 0.58 * (1 - index / ghosts)),
    scale: 1,
  }));
}
