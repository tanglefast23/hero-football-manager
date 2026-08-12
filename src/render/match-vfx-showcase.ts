import { attemptShot, shotFlightTick, tackleTick } from '../sim/engine';
import { PITCH_H, PITCH_W } from '../sim/geometry';
import type { MatchEvent, MatchState } from '../sim/types';
import { isHardShotPower, type MatchVfxKind } from './match-vfx';

export interface MatchVfxQaConfig {
  readonly kind: MatchVfxKind;
}

export const MATCH_VFX_SHOWCASE_LEAD_TICKS = 6;
export const MATCH_VFX_SHOWCASE_FREEZE_TICKS = 4;
export const MATCH_VFX_SHOWCASE_SAFETY_TICK = 60;

const DEFENDER = 2;
const KEEPER = 0;
const SHOOTER = 21;

const SHOWCASE_SEEDS: Readonly<Record<MatchVfxKind, number>> = {
  'slide-tackle': 1,
  'standing-tackle': 1,
  'hard-shot': 1,
  'save-impact': 1,
  'power-interruption': 1,
};

export function matchVfxShowcaseSeed(kind: MatchVfxKind): number {
  return SHOWCASE_SEEDS[kind];
}

function makeAvailable(match: MatchState, index: number): void {
  const player = match.players[index];
  player.outUntilTick = 0;
  player.outReason = undefined;
  player.slideTackle = undefined;
  player.tackleRecoveryUntil = 0;
  player.tackleCooldownUntil = 0;
  player.actionLockedUntilTick = undefined;
  player.actionLockSourceIdx = undefined;
  player.webbedUntilTick = undefined;
  player.forcedMovement = undefined;
}

function place(match: MatchState, index: number, x: number, y: number): void {
  makeAvailable(match, index);
  match.players[index].pos = { x, y };
}

function parkUnused(match: MatchState, used: ReadonlySet<number>): void {
  for (let index = 0; index < match.players.length; index += 1) {
    if (used.has(index)) continue;
    const player = match.players[index];
    player.pos = {
      x: index % 2 === 0 ? 350 : PITCH_W - 350,
      y: 600 + (index % 8) * 1_150,
    };
    player.tackleCooldownUntil = match.tick + 100;
    player.actionLockedUntilTick = match.tick + 100;
  }
}

function arrangeTackle(
  match: MatchState,
  kind: 'slide-tackle' | 'standing-tackle' | 'power-interruption',
): void {
  parkUnused(match, new Set([DEFENDER, SHOOTER]));
  const carrierY =
    kind === 'power-interruption' ? PITCH_H - 2_800 : PITCH_H / 2;
  const distance = kind === 'slide-tackle' ? 900 : 150;
  place(match, DEFENDER, PITCH_W / 2, carrierY + distance);
  place(match, SHOOTER, PITCH_W / 2, carrierY);
  const defender = match.players[DEFENDER];
  const carrier = match.players[SHOOTER];
  defender.condition = 100;
  defender.def = {
    ...defender.def,
    attrs: { ...defender.def.attrs, def: 999 },
  };
  carrier.def = {
    ...carrier.def,
    attrs: { ...carrier.def.attrs, tec: 1 },
    ...(kind === 'power-interruption'
      ? { power: 'THUNDER_STRIKE' as const, powerTier: 1 as const }
      : {}),
  };
  carrier.powerState =
    kind === 'power-interruption'
      ? { kind: 'winding', untilTick: match.tick + 20, strength: 0.85 }
      : { kind: 'idle' };
  match.ball = { kind: 'held', by: SHOOTER };
}

function arrangeHardShot(match: MatchState): void {
  parkUnused(match, new Set([SHOOTER]));
  place(match, SHOOTER, PITCH_W / 2, PITCH_H - 1_200);
  const shooter = match.players[SHOOTER];
  shooter.def = {
    ...shooter.def,
    attrs: { ...shooter.def.attrs, sho: 99 },
  };
  match.ball = { kind: 'held', by: SHOOTER };
}

function arrangeSave(match: MatchState): void {
  parkUnused(match, new Set([KEEPER, SHOOTER]));
  place(match, KEEPER, PITCH_W / 2, PITCH_H - 500);
  place(match, SHOOTER, PITCH_W / 2 + 500, PITCH_H - 2_000);
  const keeper = match.players[KEEPER];
  keeper.def = {
    ...keeper.def,
    attrs: { ...keeper.def.attrs, ref: 999 },
  };
  match.ball = {
    kind: 'shot',
    pos: { x: PITCH_W / 2 + 500, y: PITCH_H - 650 },
    vel: { x: 0, y: 180 },
    by: SHOOTER,
    shooterId: match.players[SHOOTER].def.id,
    shotStrengthD64: -64_000,
    power: 55,
    targetX: PITCH_W / 2 + 500,
    z: 0,
    vz: 0,
    trajectory: 'driven',
    keeperChecked: false,
  };
}

function arrange(match: MatchState, kind: MatchVfxKind): void {
  if (
    kind === 'slide-tackle' ||
    kind === 'standing-tackle' ||
    kind === 'power-interruption'
  ) {
    arrangeTackle(match, kind);
  } else if (kind === 'hard-shot') {
    arrangeHardShot(match);
  } else {
    arrangeSave(match);
  }
}

export function matchVfxShowcaseEvent(
  match: MatchState,
  kind: MatchVfxKind,
): MatchEvent | undefined {
  return match.events.find((event) => {
    if (kind === 'slide-tackle') return event.kind === 'SLIDE_STARTED';
    if (kind === 'standing-tackle')
      return (
        event.kind === 'TACKLE' && event.style === 'standing' && event.contact
      );
    if (kind === 'hard-shot')
      return event.kind === 'SHOT' && isHardShotPower(event.power);
    if (kind === 'save-impact') return event.kind === 'SAVE';
    return event.kind === 'POWER_INTERRUPTED';
  });
}

export function initializeMatchVfxShowcase(
  match: MatchState,
  kind: MatchVfxKind,
): void {
  arrange(match, kind);
}

/**
 * The harness advances a short static lead-in, then calls the production event
 * function for the arranged state. After that event exists, MatchScreen returns
 * to ordinary ticks so slides and ball flight keep using their shipped paths.
 */
export function advanceMatchVfxShowcase(
  match: MatchState,
  kind: MatchVfxKind,
): boolean {
  if (matchVfxShowcaseEvent(match, kind) !== undefined) return false;
  match.tick += 1;
  arrange(match, kind);
  if (match.tick < MATCH_VFX_SHOWCASE_LEAD_TICKS) return true;
  if (
    kind === 'slide-tackle' ||
    kind === 'standing-tackle' ||
    kind === 'power-interruption'
  ) {
    tackleTick(match);
  } else if (kind === 'hard-shot') {
    attemptShot(match, SHOOTER, 1_200);
  } else {
    shotFlightTick(match);
  }
  return true;
}
