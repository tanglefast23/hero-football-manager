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

const beat = (id: string, label: string, startMs: number, endMs: number): PowerEffectBeat => ({
  id,
  label,
  startMs,
  endMs,
});

/**
 * One production visual contract for cut-ins, the match overlay, and the
 * developer showcase. `signature` is deliberately unique: a power may share a
 * family colour, but never the same silhouette and action rhythm.
 */
export const POWER_EFFECT_DESCRIPTORS: Record<PowerId, PowerEffectDescriptor> = {
  SUPER_SPEED: {
    name: 'Super Speed', signature: 'speed-afterimages',
    primary: '#5a8fd6', secondary: '#a3c8f0', highlight: '#ffffff', durationMs: 3400,
    accessibilityLabel: 'A runner explodes into space, leaving bright speed afterimages.',
    beats: [beat('coil', 'COIL', 0, 700), beat('burst', 'BURST', 700, 2300), beat('afterimage', 'AFTERIMAGE', 2300, 3400)],
  },
  BLINK_RUN: {
    name: 'Blink Run', signature: 'blink-gates',
    primary: '#9a63d6', secondary: '#a3c8f0', highlight: '#ffffff', durationMs: 3500,
    accessibilityLabel: 'The runner vanishes into a star gate and snaps beyond the last defender.',
    beats: [beat('mark-gap', 'MARK THE GAP', 0, 900), beat('vanish', 'VANISH', 900, 1900), beat('arrive', 'ARRIVE', 1900, 3500)],
  },
  THUNDER_STRIKE: {
    name: 'Thunder Strike', signature: 'lightning-shot',
    primary: '#edb54a', secondary: '#f7d894', highlight: '#ffffff', durationMs: 3600,
    accessibilityLabel: 'Electric charge gathers around the ball before a lightning-powered strike.',
    beats: [beat('charge', 'CHARGE', 0, 1200), beat('strike', 'THUNDER STRIKE', 1200, 2350), beat('shockwave', 'SHOCKWAVE', 2350, 3600)],
  },
  FIRE_TORCH: {
    name: 'Fire Torch', signature: 'tiered-ignition',
    primary: '#d94f52', secondary: '#edb54a', highlight: '#f7d894', durationMs: 3900,
    accessibilityLabel: 'A flaming run ignites one, two, or three goal-side defenders according to power tier.',
    beats: [beat('spark', 'LIGHT IT', 0, 750), beat('blaze', 'BLAZE THROUGH', 750, 2400), beat('ignite', 'DEFENDERS IGNITED', 2400, 3900)],
  },
  PHASE_RUN: {
    name: 'Phase Run', signature: 'ghost-phase',
    primary: '#9a63d6', secondary: '#a3c8f0', highlight: '#f4f1ea', durationMs: 3500,
    accessibilityLabel: 'The carrier turns translucent, ghosts through a challenge, then becomes solid again.',
    beats: [beat('dephase', 'DEPHASE', 0, 950), beat('pass-through', 'PASS THROUGH', 950, 2350), beat('solidify', 'SOLIDIFY', 2350, 3500)],
  },
  PORTAL_PASS: {
    name: 'Portal Pass', signature: 'portal-shield',
    primary: '#5a8fd6', secondary: '#9a63d6', highlight: '#a3c8f0', durationMs: 3800,
    accessibilityLabel: 'The ball crosses linked portals and the receiving forward arrives inside a brief shield.',
    beats: [beat('open', 'OPEN GATES', 0, 900), beat('transfer', 'PORTAL PASS', 900, 2300), beat('shield', 'RECEIVER SHIELDED', 2300, 3800)],
  },
  DECOY_DOUBLE: {
    name: 'Decoy Double', signature: 'hologram-fork',
    primary: '#9a63d6', secondary: '#a3c8f0', highlight: '#c9a6ec', durationMs: 4200,
    accessibilityLabel: 'A scan-line hologram splits from the real forward and attacks a second lane.',
    beats: [beat('project', 'PROJECT DOUBLE', 0, 1000), beat('fork', 'TWO RUNS', 1000, 2850), beat('swap', 'REAL OR DECOY?', 2850, 4200)],
  },
  FUTURE_SIGHT: {
    name: 'Future Sight', signature: 'vision-intercept-outlet',
    primary: '#edb54a', secondary: '#a3c8f0', highlight: '#f7d894', durationMs: 4400,
    accessibilityLabel: 'A prediction line reveals the pass, the hero intercepts it, then releases a controlled forward outlet.',
    beats: [beat('anticipate', 'ANTICIPATE', 0, 1450), beat('intercept', 'INTERCEPT', 1450, 2850), beat('outlet', 'FORWARD OUTLET', 2850, 4400)],
  },
  SUPER_STRENGTH: {
    name: 'Super Strength', signature: 'locked-charge-impact',
    primary: '#edb54a', secondary: '#d94f52', highlight: '#f7d894', durationMs: 3600,
    accessibilityLabel: 'The carrier is locked, a half-second charge builds, and a heavy impact wins the ball.',
    beats: [beat('lock', 'TARGET LOCKED', 0, 1000), beat('charge', '0.5 SEC CHARGE', 1000, 1500), beat('impact', 'IMPACT', 1500, 3600)],
  },
  WEB_TRAP: {
    name: 'Web Trap', signature: 'web-cocoon-root',
    primary: '#f4f1ea', secondary: '#c9c5d0', highlight: '#ffffff', durationMs: 4300,
    accessibilityLabel: 'A web snaps around the carrier, spills the ball, and holds the victim in a cocoon for about two seconds.',
    beats: [beat('cast', 'CAST WEB', 0, 900), beat('cocoon', 'COCOON', 900, 2300), beat('root', 'ROOTED', 2300, 4300)],
  },
  ELASTIC_KEEPER: {
    name: 'Elastic Keeper', signature: 'elastic-save',
    primary: '#5cb85c', secondary: '#8fd98f', highlight: '#ffffff', durationMs: 3500,
    accessibilityLabel: 'The goalkeeper stretches across the goal, catches the shot, and snaps back into shape.',
    beats: [beat('read', 'READ SHOT', 0, 950), beat('stretch', 'STRETCH SAVE', 950, 2350), beat('snap-back', 'SNAP BACK', 2350, 3500)],
  },
  RALLY_CRY: {
    name: 'Rally Cry', signature: 'roar-encore-ticket',
    primary: '#edb54a', secondary: '#d94f52', highlight: '#f7d894', durationMs: 4000,
    accessibilityLabel: 'A comic roar charges nearby heroes and awards one teammate a bright Encore ticket.',
    beats: [beat('roar', 'RALLY!', 0, 1000), beat('charge-team', 'TEAM CHARGED', 1000, 2500), beat('encore', 'ENCORE TICKET', 2500, 4000)],
  },
  ICE_RINK: {
    name: 'Ice Rink', signature: 'ice-backslide',
    primary: '#5a8fd6', secondary: '#a3c8f0', highlight: '#ffffff', durationMs: 4100,
    accessibilityLabel: 'The turf flash-freezes and the carrier skids backward with the ball before regaining control.',
    beats: [beat('freeze', 'FLASH FREEZE', 0, 950), beat('skid', 'BACKWARD SKID', 950, 2850), beat('reset', 'ATTACK RESET', 2850, 4100)],
  },
  SHADOW_MARK: {
    name: 'Shadow Mark', signature: 'burrow-pop-steal',
    primary: '#6b6675', secondary: '#9a63d6', highlight: '#c9c5d0', durationMs: 4600,
    accessibilityLabel: 'The hero burrows underground, stalks the carrier by a moving trail, and pops up for the steal.',
    beats: [beat('burrow', 'BURROW', 0, 1250), beat('hunt', 'HUNTING BELOW', 1250, 3150), beat('pop-steal', 'POP-UP STEAL', 3150, 4600)],
  },
  GRAVITY_WELL: {
    name: 'Gravity Well', signature: 'gravity-pull-lane',
    primary: '#9a63d6', secondary: '#5a8fd6', highlight: '#c9a6ec', durationMs: 4200,
    accessibilityLabel: 'Gravity lines pull defenders inward while a bright passing lane opens for a runner.',
    beats: [beat('singularity', 'SINGULARITY', 0, 1000), beat('pull', 'PULL DEFENDERS', 1000, 2700), beat('lane', 'RUNNER LANE', 2700, 4200)],
  },
  GIANT_GK: {
    name: 'Giant GK', signature: 'giant-goalmouth',
    primary: '#5cb85c', secondary: '#8fd98f', highlight: '#ffffff', durationMs: 3500,
    accessibilityLabel: 'The goalkeeper grows into a giant silhouette that fills the goalmouth.',
    beats: [beat('grow', 'GROW', 0, 1050), beat('fill-goal', 'FILL THE GOAL', 1050, 2500), beat('deny', 'DENIED', 2500, 3500)],
  },
  GUST: {
    name: 'Gust', signature: 'wind-keeper-punt',
    primary: '#5a8fd6', secondary: '#a3c8f0', highlight: '#ffffff', durationMs: 4500,
    accessibilityLabel: 'A huge wind arc bends the pass safely to the goalkeeper, who punts far into attacking space.',
    beats: [beat('bend', 'BEND THE PASS', 0, 1550), beat('keeper', 'SAFE TO KEEPER', 1550, 2850), beat('punt', 'HUGE PUNT', 2850, 4500)],
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

export function powerEffectDescriptor(power: PowerId): PowerEffectDescriptor {
  return POWER_EFFECT_DESCRIPTORS[power];
}

/** Deterministic and platform-free so Jest can verify every animation beat. */
export function powerEffectFrame(
  power: PowerId,
  elapsedMs: number,
  reduceMotion = false,
): PowerEffectFrame {
  const descriptor = powerEffectDescriptor(power);
  const safeElapsed = reduceMotion
    ? Math.min(descriptor.durationMs, Math.max(0, elapsedMs <= 0 ? descriptor.durationMs * 0.76 : elapsedMs))
    : Math.min(descriptor.durationMs, Math.max(0, elapsedMs));
  const index = safeElapsed < descriptor.beats[0].endMs
    ? 0
    : safeElapsed < descriptor.beats[1].endMs ? 1 : 2;
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
