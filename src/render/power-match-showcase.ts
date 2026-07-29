import { PITCH_H, PITCH_W } from '../sim/geometry';
import { powerTick, ZONE_WINDOW_TICKS } from '../sim/powers';
import { ROVERS, UNITED } from '../sim/teams';
import type { MatchState, PowerId, TeamDef } from '../sim/types';

/** Brief still frame before the real contextual auto policy evaluates. */
export const POWER_MATCH_SHOWCASE_AUTO_FIRE_DELAY_TICKS = 10;

const HERO_INDEX: Readonly<Record<PowerId, number>> = {
  SUPER_SPEED: 10,
  BLINK_RUN: 10,
  THUNDER_STRIKE: 10,
  FIRE_TORCH: 9,
  PHASE_RUN: 10,
  PORTAL_PASS: 5,
  DECOY_DOUBLE: 5,
  FUTURE_SIGHT: 2,
  SUPER_STRENGTH: 2,
  WEB_TRAP: 2,
  ELASTIC_KEEPER: 0,
  RALLY_CRY: 5,
  ICE_RINK: 2,
  SHADOW_MARK: 2,
  GRAVITY_WELL: 5,
  GIANT_GK: 0,
  GUST: 2,
};

const RALLY_TEAMMATE = 10;

export function powerMatchShowcaseHeroIndex(power: PowerId): number {
  return HERO_INDEX[power];
}

/**
 * A real eleven-player team with one role-compatible showcase hero. Rally Cry
 * also needs a powered teammate because that dependency is part of its actual
 * match behavior.
 */
export function powerMatchShowcaseHome(power: PowerId): TeamDef {
  const heroIndex = powerMatchShowcaseHeroIndex(power);
  return {
    ...ROVERS,
    id: `power-showcase-home-${power.toLowerCase()}`,
    name: 'Power Showcase XI',
    players: ROVERS.players.map((player, index) => ({
      ...player,
      attrs: { ...player.attrs },
      power: index === heroIndex
        ? power
        : power === 'RALLY_CRY' && index === RALLY_TEAMMATE
          ? 'SUPER_SPEED'
          : undefined,
      powerTier: index === heroIndex ? 1 : undefined,
    })),
  };
}

export function powerMatchShowcaseAway(): TeamDef {
  return {
    ...UNITED,
    id: 'power-showcase-away',
    name: 'Scenario United',
    players: UNITED.players.map(player => ({
      ...player,
      attrs: { ...player.attrs },
      power: undefined,
      powerTier: undefined,
    })),
  };
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

function holdBall(match: MatchState, index: number): void {
  match.ball = { kind: 'held', by: index };
}

/** Arrange the authored useful context once, before the review begins. */
function arrangePowerMatchShowcase(match: MatchState, power: PowerId): number {
  const hero = powerMatchShowcaseHeroIndex(power);
  place(match, hero, PITCH_W / 2, 4_000);
  match.players[hero].firePolicy = 'SAVE_FOR_TAP';

  switch (power) {
    case 'SUPER_SPEED':
      holdBall(match, hero);
      break;
    case 'BLINK_RUN':
      place(match, hero, PITCH_W / 2, 3_800);
      holdBall(match, hero);
      break;
    case 'THUNDER_STRIKE':
      place(match, hero, PITCH_W / 2, 3_000);
      holdBall(match, hero);
      break;
    case 'FIRE_TORCH':
      place(match, hero, PITCH_W / 2, 3_000);
      place(match, 12, PITCH_W / 2, 2_250);
      holdBall(match, hero);
      break;
    case 'PHASE_RUN':
      place(match, hero, PITCH_W / 2, 4_000);
      place(match, 12, PITCH_W / 2, 3_450);
      holdBall(match, hero);
      break;
    case 'PORTAL_PASS':
      place(match, hero, 3_400, 4_300);
      place(match, 6, 1_000, 4_000);
      place(match, 9, 3_400, 3_300);
      place(match, 12, 1_500, 3_900);
      // Keep one visible presser near the carrier while opening a believable
      // staggered back line for the portal exit. No unused player is parked or
      // moved as a group at tap time.
      place(match, 13, 500, 1_850);
      place(match, 14, PITCH_W - 500, 1_850);
      place(match, 15, PITCH_W - 850, 1_050);
      holdBall(match, 6);
      match.players[6].actionLockedUntilTick = match.tick + 20;
      break;
    case 'DECOY_DOUBLE':
      place(match, hero, 3_400, 4_300);
      place(match, 6, 2_600, 4_000);
      place(match, 9, 2_200, 3_100);
      place(match, 10, 3_500, 3_600);
      place(match, 12, 2_700, 3_700);
      holdBall(match, 6);
      match.players[6].actionLockedUntilTick = match.tick + 20;
      break;
    case 'FUTURE_SIGHT':
      place(match, hero, 2_200, 5_000);
      place(match, 11, 2_300, 5_000);
      place(match, 12, 2_500, 4_800);
      holdBall(match, 11);
      match.players[11].actionLockedUntilTick = match.tick + 16;
      break;
    case 'SUPER_STRENGTH':
    case 'ICE_RINK':
      place(match, hero, 2_200, 5_000);
      place(match, 11, 2_300, 5_000);
      holdBall(match, 11);
      break;
    case 'SHADOW_MARK':
      place(match, hero, 2_200, 5_000);
      // Shadow correctly ignores goalkeepers, so stage a nearby outfielder.
      place(match, 12, 2_300, 5_000);
      holdBall(match, 12);
      break;
    case 'WEB_TRAP':
      // Keep caster and victim visually separate while remaining inside the
      // real 1,500-unit trigger. Overlapping bodies made a correctly rooted
      // victim look as if they were still moving with the caster.
      // Keep the demo off the centre-circle paint as well; white pitch lines
      // behind white web bands made a clean root look like stray geometry.
      place(match, hero, 1_700, 6_200);
      place(match, 11, 2_900, 6_200);
      holdBall(match, 11);
      break;
    case 'ELASTIC_KEEPER':
    case 'GIANT_GK':
      place(match, hero, PITCH_W / 2, PITCH_H - 500);
      place(match, 21, PITCH_W / 2, PITCH_H - 2_500);
      match.ball = {
        kind: 'shot',
        pos: { x: PITCH_W / 2, y: PITCH_H - 2_000 },
        // An off-centre on-target shot gives the elastic glove a readable
        // horizontal save. The real ball reaches the same catch point.
        vel: { x: 40, y: 120 },
        by: 21,
        shotStrengthD64: 0,
        power: 55,
        targetX: PITCH_W / 2 + 520,
        z: 0,
        vz: 0,
        trajectory: 'driven',
        keeperChecked: false,
      };
      break;
    case 'RALLY_CRY':
      place(match, hero, 3_400, 5_000);
      place(match, RALLY_TEAMMATE, 3_600, 4_800);
      match.players[RALLY_TEAMMATE].gauge = 50;
      match.players[RALLY_TEAMMATE].zonesOpened = 1;
      match.players[RALLY_TEAMMATE].powerState = { kind: 'idle' };
      match.players[RALLY_TEAMMATE].encoreState = undefined;
      holdBall(match, 6);
      break;
    case 'GRAVITY_WELL':
      place(match, hero, 2_250, 4_400);
      place(match, 6, 1_200, 4_200);
      place(match, 9, 2_000, 3_000);
      place(match, 12, 1_500, 3_400);
      holdBall(match, 6);
      match.players[6].actionLockedUntilTick = match.tick + 20;
      break;
    case 'GUST':
      place(match, hero, 2_200, 5_000);
      place(match, 11, 2_300, 5_000);
      place(match, 12, 2_500, 4_800);
      holdBall(match, 11);
      match.players[11].actionLockedUntilTick = match.tick + 16;
      break;
  }

  return hero;
}

export function initializePowerMatchShowcase(
  match: MatchState,
  power: PowerId,
): number {
  const hero = arrangePowerMatchShowcase(match, power);
  match.players[hero].firePolicy = 'FIRE_WHEN_READY';
  match.players[hero].gauge = 0;
  match.players[hero].zonesOpened = 1;
  match.players[hero].powerState = { kind: 'zone', remainingTicks: ZONE_WINDOW_TICKS };
  match.events.push({ t: match.tick, kind: 'POWER_READY', player: hero });
  return hero;
}

/**
 * Holds the authored match tableau until the real contextual auto policy sees
 * the power's best moment. The banked Zone cannot expire in this review mode:
 * it waits indefinitely, fires at the normal automatic strength, stays held
 * through any wind-up, then ordinary match play resumes once the power is
 * active. Nothing is repositioned at activation time.
 */
export function advancePowerMatchShowcaseReady(match: MatchState, power: PowerId): boolean {
  const hero = powerMatchShowcaseHeroIndex(power);
  const state = match.players[hero].powerState;
  if (state.kind !== 'zone' && state.kind !== 'winding') return false;
  match.tick++;
  if (state.kind === 'zone' && match.tick <= POWER_MATCH_SHOWCASE_AUTO_FIRE_DELAY_TICKS) {
    return true;
  }
  powerTick(match);
  const nextState = match.players[hero].powerState;
  if (nextState.kind === 'zone') {
    // The showcase has no Zone deadline. Only the real authored context may
    // release this banked power.
    nextState.remainingTicks = ZONE_WINDOW_TICKS;
  }
  return true;
}
