import type { Vec } from '../sim/geometry';

export const MATCH_VFX_REVISION = 1 as const;
/**
 * Halved from 334ms: the impact bursts read instantly and then sat on the pitch
 * long after the moment they were marking. The phase count is untouched, so the
 * animation still plays in full — it just plays twice as fast.
 */
export const MATCH_VFX_STEP_MS = 167 as const;
export const MATCH_VFX_PHASE_COUNT = 4 as const;
export const MATCH_VFX_DURATION_MS = MATCH_VFX_STEP_MS * MATCH_VFX_PHASE_COUNT;
export const MATCH_VFX_TICK_MS = 100 as const;
export const MATCH_VFX_EMITTER_CAP = 16 as const;
export const HARD_SHOT_POWER_MIN = 55 as const;

export type MatchVfxKind =
  | 'slide-tackle'
  | 'standing-tackle'
  | 'hard-shot'
  | 'save-impact'
  | 'power-interruption';

export type MatchVfxColorRole = 'ink' | 'cream' | 'grass' | 'blue' | 'gold';

export interface MatchVfxEmitterInput {
  matchSeed: number;
  kind: MatchVfxKind;
  eventTick: number;
  actor: number;
  target?: number;
  anchor: Vec;
  direction: Vec;
  intensity?: number;
}

export interface PreparedMatchVfxEmitter {
  id: string;
  kind: MatchVfxKind;
  startTick: number;
  anchor: Vec;
  direction: Vec;
  intensity: number;
  seed: number;
  phaseOffset: number;
  lateralSign: -1 | 1;
}

export interface MatchVfxMark {
  role: MatchVfxColorRole;
  /** Source-pixel distance along the event direction. */
  along: number;
  /** Source-pixel distance across the event direction. */
  side: number;
  width: number;
  height: number;
}

export interface MatchVfxGeometry {
  emitterId: string;
  kind: MatchVfxKind;
  ageStep: number;
  marks: readonly MatchVfxMark[];
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * How opaque a burst is at a given age step, so it leaves rather than vanishes.
 *
 * Quantised to the step it already animates on, not to the millisecond: the
 * renderer batches every mark of one colour into a single path, and a
 * continuous per-emitter alpha would need a node per emitter. One bucket per
 * step keeps the batching and still reads as a fade.
 */
export function matchVfxFadeOpacity(ageStep: number): number {
  return clamp01((MATCH_VFX_PHASE_COUNT - ageStep) / MATCH_VFX_PHASE_COUNT);
}

function stableHash(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function normalizedDirection(direction: Vec): Vec {
  const magnitude = Math.hypot(direction.x, direction.y);
  if (!Number.isFinite(magnitude) || magnitude === 0) return { x: 1, y: 0 };
  return { x: direction.x / magnitude, y: direction.y / magnitude };
}

export function prepareMatchVfxEmitter(
  input: MatchVfxEmitterInput,
): PreparedMatchVfxEmitter {
  if (!Number.isInteger(input.eventTick) || input.eventTick < 0)
    throw new Error('Match VFX event tick must be a non-negative integer.');
  if (!Number.isFinite(input.anchor.x) || !Number.isFinite(input.anchor.y))
    throw new Error('Match VFX anchor must be finite.');
  const roundedAnchor = {
    x: Math.round(input.anchor.x),
    y: Math.round(input.anchor.y),
  };
  const seed = stableHash(
    [
      MATCH_VFX_REVISION,
      input.matchSeed,
      input.kind,
      input.eventTick,
      input.actor,
      input.target ?? -1,
      roundedAnchor.x,
      roundedAnchor.y,
    ].join(':'),
  );
  return Object.freeze({
    id: `${input.eventTick}:${input.kind}:${input.actor}:${input.target ?? -1}`,
    kind: input.kind,
    startTick: input.eventTick,
    anchor: Object.freeze(roundedAnchor),
    direction: Object.freeze(normalizedDirection(input.direction)),
    intensity: clamp01(input.intensity ?? 1),
    seed,
    phaseOffset: seed % MATCH_VFX_PHASE_COUNT,
    lateralSign: (seed & 1) === 0 ? -1 : 1,
  });
}

export function appendMatchVfxEmitter(
  current: readonly PreparedMatchVfxEmitter[],
  emitter: PreparedMatchVfxEmitter,
): PreparedMatchVfxEmitter[] {
  return [...current, emitter].slice(-MATCH_VFX_EMITTER_CAP);
}

export function matchVfxAgeMs(
  visualTick: number,
  emitter: Pick<PreparedMatchVfxEmitter, 'startTick'>,
): number {
  return Math.max(0, visualTick - emitter.startTick) * MATCH_VFX_TICK_MS;
}

export function activeMatchVfxEmitters(
  emitters: readonly PreparedMatchVfxEmitter[],
  visualTick: number,
): PreparedMatchVfxEmitter[] {
  return emitters.filter((emitter) => {
    const age = matchVfxAgeMs(visualTick, emitter);
    return visualTick >= emitter.startTick && age < MATCH_VFX_DURATION_MS;
  });
}

export function isHardShotPower(power: number): boolean {
  return Number.isFinite(power) && power >= HARD_SHOT_POWER_MIN;
}

function mark(
  role: MatchVfxColorRole,
  along: number,
  side: number,
  width: number,
  height: number,
): MatchVfxMark {
  return Object.freeze({ role, along, side, width, height });
}

function contactMarks(
  phase: number,
  lateralSign: -1 | 1,
  secondary: boolean,
): MatchVfxMark[] {
  const marks = [mark('ink', 0, 0, 5, 5), mark('cream', 0, 0, 3, 3)];
  if (secondary) {
    marks.push(
      mark('grass', 1 + phase, lateralSign * (3 + phase), 2, 1),
      mark('grass', -1 - phase, -lateralSign * (2 + phase), 1, 2),
      mark('grass', 3 + phase, lateralSign * 1, 2, 2),
    );
  }
  return marks;
}

function standingMarks(
  emitter: PreparedMatchVfxEmitter,
  phase: number,
  secondary: boolean,
): MatchVfxMark[] {
  const arm = 2 + (phase % 2);
  const marks = [
    mark('ink', 0, 0, arm * 2 + 3, 3),
    mark('ink', 0, 0, 3, arm * 2 + 3),
    mark('cream', 0, 0, arm * 2 + 1, 1),
    mark('cream', 0, 0, 1, arm * 2 + 1),
  ];
  if (secondary) {
    const travel = 4 + phase;
    marks.push(
      mark('gold', travel, emitter.lateralSign * travel, 2, 2),
      mark('gold', -travel, -emitter.lateralSign * travel, 2, 2),
    );
  }
  return marks;
}

function hardShotMarks(
  emitter: PreparedMatchVfxEmitter,
  phase: number,
  secondary: boolean,
): MatchVfxMark[] {
  const reach = 5 + phase * (1 + emitter.intensity);
  const marks = [mark('gold', -3, 0, 6, 3), mark('cream', -4, 0, 2, 2)];
  if (secondary) {
    marks.push(
      mark('gold', -reach, emitter.lateralSign * 2, 3, 1),
      mark('cream', -reach - 2, -emitter.lateralSign * 2, 2, 1),
      mark('grass', -3 - phase, emitter.lateralSign * 4, 1, 2),
    );
  }
  return marks;
}

function saveMarks(
  emitter: PreparedMatchVfxEmitter,
  phase: number,
  secondary: boolean,
): MatchVfxMark[] {
  const arm = 2 + (phase % 2);
  const marks = [
    mark('ink', 0, 0, arm * 2 + 3, 3),
    mark('ink', 0, 0, 3, arm * 2 + 3),
    mark('blue', 0, 0, arm * 2 + 1, 1),
    mark('blue', 0, 0, 1, arm * 2 + 1),
    mark('cream', 0, 0, 1, 1),
  ];
  if (secondary) {
    marks.push(
      mark('grass', -2 - phase, emitter.lateralSign * (3 + phase), 2, 1),
      mark('blue', 3 + phase, -emitter.lateralSign * 2, 2, 1),
    );
  }
  return marks;
}

function interruptionMarks(
  emitter: PreparedMatchVfxEmitter,
  phase: number,
  secondary: boolean,
): MatchVfxMark[] {
  const marks = [
    mark('ink', 0, 0, 9, 3),
    mark('ink', 0, 0, 3, 9),
    mark('cream', 0, 0, 7, 1),
    mark('cream', 0, 0, 1, 7),
    mark('cream', 0, 0, 2, 2),
  ];
  if (secondary) {
    const travel = 3 + phase * 2;
    marks.push(
      mark('gold', travel, emitter.lateralSign * travel, 2, 2),
      mark('gold', -travel, -emitter.lateralSign * travel, 2, 2),
      mark('gold', travel, -emitter.lateralSign * travel, 1, 3),
      mark('gold', -travel, emitter.lateralSign * travel, 3, 1),
    );
  }
  return marks;
}

export function sampleMatchVfxGeometry(
  emitter: PreparedMatchVfxEmitter,
  ageMs: number,
  reduceMotion: boolean,
  reducedEffects = false,
): MatchVfxGeometry {
  if (!Number.isFinite(ageMs) || ageMs < 0)
    throw new Error('Match VFX age must be finite and non-negative.');
  const ageStep = Math.floor(ageMs / MATCH_VFX_STEP_MS);
  const phase = reduceMotion
    ? emitter.phaseOffset
    : (ageStep + emitter.phaseOffset) % MATCH_VFX_PHASE_COUNT;
  const secondary = !reduceMotion && !reducedEffects;
  let marks: MatchVfxMark[];
  switch (emitter.kind) {
    case 'slide-tackle':
      marks = contactMarks(phase, emitter.lateralSign, secondary);
      break;
    case 'standing-tackle':
      marks = standingMarks(emitter, phase, secondary);
      break;
    case 'hard-shot':
      marks = hardShotMarks(emitter, phase, secondary);
      break;
    case 'save-impact':
      marks = saveMarks(emitter, phase, secondary);
      break;
    case 'power-interruption':
      marks = interruptionMarks(emitter, phase, secondary);
      break;
  }
  return Object.freeze({
    emitterId: emitter.id,
    kind: emitter.kind,
    ageStep,
    marks: Object.freeze(marks),
  });
}
