import { copyFor, powerCopySlug, type CopyFn } from '../i18n';
import type { PowerId } from '../sim/types';

export interface PowerEffectBeat {
  id: string;
  label: string;
  startMs: number;
  endMs: number;
}

export interface PowerEffectDescriptor {
  name: string;
  signature: string;
  primary: string;
  secondary: string;
  highlight: string;
  durationMs: number;
  accessibilityLabel: string;
  beats: readonly [PowerEffectBeat, PowerEffectBeat, PowerEffectBeat];
}

/**
 * The drawn half of a descriptor: colours, timings and beats.
 *
 * The two spoken halves — the power's name and its screen-reader sentence — are
 * copy, so they live in the catalog and are joined on in `powerEffectDescriptor`
 * rather than being written into the table below.
 */
export type PowerEffectVisual = Omit<
  PowerEffectDescriptor,
  'name' | 'accessibilityLabel'
>;

const beat = (
  id: string,
  label: string,
  startMs: number,
  endMs: number,
): PowerEffectBeat => ({
  id,
  label,
  startMs,
  endMs,
});

/**
 * One production visual contract for cut-ins, the match overlay, and the
 * developer showcase. `signature` is deliberately unique: a power may share a
 * family colour, but never the same silhouette and action rhythm.
 *
 * Beat labels stay here rather than in the catalog: they are drawn only by
 * `PowerEffectPreview`, which the shipped game never mounts — it belongs to the
 * power-art QA app in `App.tsx`.
 */
export const POWER_EFFECT_DESCRIPTORS: Record<PowerId, PowerEffectVisual> = {
  SUPER_SPEED: {
    signature: 'speed-afterimages',
    primary: '#5a8fd6',
    secondary: '#a3c8f0',
    highlight: '#ffffff',
    durationMs: 3400,
    beats: [
      beat('coil', 'COIL', 0, 700),
      beat('burst', 'BURST', 700, 2300),
      beat('afterimage', 'AFTERIMAGE', 2300, 3400),
    ],
  },
  BLINK_RUN: {
    signature: 'blink-gates',
    primary: '#9a63d6',
    secondary: '#a3c8f0',
    highlight: '#ffffff',
    durationMs: 3500,
    beats: [
      beat('mark-gap', 'MARK THE GAP', 0, 900),
      beat('vanish', 'VANISH', 900, 1900),
      beat('arrive', 'ARRIVE', 1900, 3500),
    ],
  },
  THUNDER_STRIKE: {
    signature: 'lightning-shot',
    primary: '#edb54a',
    secondary: '#f7d894',
    highlight: '#ffffff',
    durationMs: 3600,
    beats: [
      beat('charge', 'CHARGE', 0, 1200),
      beat('strike', 'THUNDER STRIKE', 1200, 2350),
      beat('shockwave', 'SHOCKWAVE', 2350, 3600),
    ],
  },
  FIRE_TORCH: {
    signature: 'tiered-ignition',
    primary: '#d94f52',
    secondary: '#edb54a',
    highlight: '#f7d894',
    durationMs: 3900,
    beats: [
      beat('spark', 'LIGHT IT', 0, 750),
      beat('blaze', 'BLAZE THROUGH', 750, 2400),
      beat('ignite', 'DEFENDERS IGNITED', 2400, 3900),
    ],
  },
  PHASE_RUN: {
    signature: 'ghost-phase',
    primary: '#9a63d6',
    secondary: '#a3c8f0',
    highlight: '#f4f1ea',
    durationMs: 3500,
    beats: [
      beat('dephase', 'DEPHASE', 0, 950),
      beat('pass-through', 'PASS THROUGH', 950, 2350),
      beat('solidify', 'SOLIDIFY', 2350, 3500),
    ],
  },
  PORTAL_PASS: {
    signature: 'portal-shield',
    primary: '#5a8fd6',
    secondary: '#9a63d6',
    highlight: '#a3c8f0',
    durationMs: 3800,
    beats: [
      beat('open', 'OPEN GATES', 0, 900),
      beat('transfer', 'PORTAL PASS', 900, 2300),
      beat('shield', 'RECEIVER SHIELDED', 2300, 3800),
    ],
  },
  DECOY_DOUBLE: {
    signature: 'hologram-fork',
    primary: '#9a63d6',
    secondary: '#a3c8f0',
    highlight: '#c9a6ec',
    durationMs: 4200,
    beats: [
      beat('project', 'PROJECT DOUBLE', 0, 1000),
      beat('fork', 'TWO RUNS', 1000, 2850),
      beat('swap', 'REAL OR DECOY?', 2850, 4200),
    ],
  },
  FUTURE_SIGHT: {
    signature: 'vision-intercept-outlet',
    primary: '#edb54a',
    secondary: '#a3c8f0',
    highlight: '#f7d894',
    durationMs: 4400,
    beats: [
      beat('anticipate', 'ANTICIPATE', 0, 1450),
      beat('intercept', 'INTERCEPT', 1450, 2850),
      beat('outlet', 'FORWARD OUTLET', 2850, 4400),
    ],
  },
  SUPER_STRENGTH: {
    signature: 'locked-charge-impact',
    primary: '#edb54a',
    secondary: '#d94f52',
    highlight: '#f7d894',
    durationMs: 3600,
    beats: [
      beat('lock', 'TARGET LOCKED', 0, 1000),
      beat('charge', '0.5 SEC CHARGE', 1000, 1500),
      beat('impact', 'IMPACT', 1500, 3600),
    ],
  },
  WEB_TRAP: {
    signature: 'web-cocoon-root',
    primary: '#f4f1ea',
    secondary: '#c9c5d0',
    highlight: '#ffffff',
    durationMs: 4300,
    beats: [
      beat('cast', 'CAST WEB', 0, 900),
      beat('cocoon', 'COCOON', 900, 2300),
      beat('root', 'ROOTED', 2300, 4300),
    ],
  },
  ELASTIC_KEEPER: {
    signature: 'elastic-save',
    primary: '#5cb85c',
    secondary: '#8fd98f',
    highlight: '#ffffff',
    durationMs: 3500,
    beats: [
      beat('read', 'READ SHOT', 0, 950),
      beat('stretch', 'STRETCH SAVE', 950, 2350),
      beat('snap-back', 'SNAP BACK', 2350, 3500),
    ],
  },
  RALLY_CRY: {
    signature: 'roar-encore-ticket',
    primary: '#edb54a',
    secondary: '#d94f52',
    highlight: '#f7d894',
    durationMs: 4000,
    beats: [
      beat('roar', 'RALLY!', 0, 1000),
      beat('charge-team', 'TEAM CHARGED', 1000, 2500),
      beat('encore', 'ENCORE TICKET', 2500, 4000),
    ],
  },
  ICE_RINK: {
    signature: 'ice-backslide',
    primary: '#5a8fd6',
    secondary: '#a3c8f0',
    highlight: '#ffffff',
    durationMs: 4100,
    beats: [
      beat('freeze', 'FLASH FREEZE', 0, 950),
      beat('skid', 'BACKWARD SKID', 950, 2850),
      beat('reset', 'ATTACK RESET', 2850, 4100),
    ],
  },
  SHADOW_MARK: {
    signature: 'burrow-pop-steal',
    primary: '#6b6675',
    secondary: '#9a63d6',
    highlight: '#c9c5d0',
    durationMs: 4600,
    beats: [
      beat('burrow', 'BURROW', 0, 1250),
      beat('hunt', 'HUNTING BELOW', 1250, 3150),
      beat('pop-steal', 'POP-UP STEAL', 3150, 4600),
    ],
  },
  GRAVITY_WELL: {
    signature: 'gravity-pull-lane',
    primary: '#9a63d6',
    secondary: '#5a8fd6',
    highlight: '#c9a6ec',
    durationMs: 4200,
    beats: [
      beat('singularity', 'SINGULARITY', 0, 1000),
      beat('pull', 'PULL DEFENDERS', 1000, 2700),
      beat('lane', 'RUNNER LANE', 2700, 4200),
    ],
  },
  GIANT_GK: {
    signature: 'giant-goalmouth',
    primary: '#5cb85c',
    secondary: '#8fd98f',
    highlight: '#ffffff',
    durationMs: 3500,
    beats: [
      beat('grow', 'GROW', 0, 1050),
      beat('fill-goal', 'FILL THE GOAL', 1050, 2500),
      beat('deny', 'DENIED', 2500, 3500),
    ],
  },
  GUST: {
    signature: 'wind-keeper-punt',
    primary: '#5a8fd6',
    secondary: '#a3c8f0',
    highlight: '#ffffff',
    durationMs: 4500,
    beats: [
      beat('bend', 'BEND THE PASS', 0, 1550),
      beat('keeper', 'SAFE TO KEEPER', 1550, 2850),
      beat('punt', 'HUGE PUNT', 2850, 4500),
    ],
  },
};

export interface PowerEffectFrame {
  descriptor: PowerEffectDescriptor;
  elapsedMs: number;
  progress: number;
  beat: PowerEffectBeat;
  beatIndex: 0 | 1 | 2;
  beatProgress: number;
  complete: boolean;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * English copy, for every caller that has not threaded a locale through yet.
 *
 * Built once and reused, the way `application/view-models.ts` does it: `copyFor`
 * spreads the whole English catalog into a fresh object, and a cut-in asks for
 * its descriptor on every frame of a match.
 */
let englishCopyFn: CopyFn | undefined;

function englishCopy(): CopyFn {
  return (englishCopyFn ??= copyFor('en'));
}

/**
 * Resolved descriptors, per copy function.
 *
 * A descriptor is read inside render loops, so the same power under the same
 * language must hand back the same object rather than a fresh one each frame.
 * Weak on the copy function so a locale switch cannot pin the old language's
 * strings in memory.
 */
const resolved = new WeakMap<CopyFn, Map<PowerId, PowerEffectDescriptor>>();

export function powerEffectDescriptor(
  power: PowerId,
  t: CopyFn = englishCopy(),
): PowerEffectDescriptor {
  let byPower = resolved.get(t);
  if (byPower === undefined) {
    byPower = new Map();
    resolved.set(t, byPower);
  }
  const cached = byPower.get(power);
  if (cached !== undefined) return cached;
  const slug = powerCopySlug(power);
  const descriptor: PowerEffectDescriptor = {
    ...POWER_EFFECT_DESCRIPTORS[power],
    name: t(`powerEffect.${slug}.name`),
    accessibilityLabel: t(`powerEffect.a11y.${slug}`),
  };
  byPower.set(power, descriptor);
  return descriptor;
}

/** Deterministic and platform-free so Jest can verify every animation beat. */
export function powerEffectFrame(
  power: PowerId,
  elapsedMs: number,
  reduceMotion = false,
  t: CopyFn = englishCopy(),
): PowerEffectFrame {
  const descriptor = powerEffectDescriptor(power, t);
  const safeElapsed = reduceMotion
    ? Math.min(
        descriptor.durationMs,
        Math.max(0, elapsedMs <= 0 ? descriptor.durationMs * 0.76 : elapsedMs),
      )
    : Math.min(descriptor.durationMs, Math.max(0, elapsedMs));
  const index =
    safeElapsed < descriptor.beats[0].endMs
      ? 0
      : safeElapsed < descriptor.beats[1].endMs
        ? 1
        : 2;
  const beat = descriptor.beats[index];
  const span = Math.max(1, beat.endMs - beat.startMs);
  return {
    descriptor,
    elapsedMs: safeElapsed,
    progress: clamp01(safeElapsed / descriptor.durationMs),
    beat,
    beatIndex: index,
    beatProgress: clamp01((safeElapsed - beat.startMs) / span),
    complete: elapsedMs >= descriptor.durationMs,
  };
}
