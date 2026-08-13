import { PITCH_H, PITCH_W } from '../sim/geometry';
import { tick } from '../sim/match';
import { ZONE_WINDOW_TICKS } from '../sim/powers';
import { ROVERS, UNITED } from '../sim/teams';
import type { MatchEvent, MatchState, PowerId, TeamDef } from '../sim/types';

/** 1.5 seconds of ordinary live play before the real auto policy evaluates. */
export const POWER_MATCH_SHOWCASE_AUTO_FIRE_DELAY_TICKS = 15;

/**
 * How long the frozen pitch is held before the result card slides over it.
 *
 * The clip stops on the success itself, which for the shooting powers is the
 * same tick the goal restarts the kickoff — so the card cannot come with it or
 * the manager never sees what they were shown. This is the beat in between.
 */
export const POWER_MATCH_SHOWCASE_CARD_DELAY_MS = 900;

/**
 * When the result card is due, given the moment the pitch froze and the moment
 * the power's own cut-in began ending (if one was still on screen).
 *
 * Total on purpose. This used to be expressed as "wait until the cut-in has an
 * ending", which is only answerable while the sim is running — and the sim has
 * stopped by definition here, so for the powers still mid-effect on the frozen
 * frame the answer never arrived and the manager was left holding a frozen
 * pitch with no REPLAY and no CONTINUE. A missing cut-in ending now means the
 * card is due off the freeze alone, which is never later than the truth.
 */
export function powerMatchShowcaseCardDueAt(
  frozenAt: number,
  cutInOutroStartedAt: number | undefined,
): number {
  return (
    Math.max(frozenAt, cutInOutroStartedAt ?? 0) +
    POWER_MATCH_SHOWCASE_CARD_DELAY_MS
  );
}

/**
 * A clip must never be able to run forever. If the promise somehow fails to
 * land, freeze anyway rather than leave the manager holding an unclosable
 * modal. `power-match-showcase-success.test.ts` is what keeps this unreachable.
 */
export const POWER_MATCH_SHOWCASE_SAFETY_FREEZE_MS = 14_000;

/**
 * The seed each clip runs on.
 *
 * These are not decoration. The showcase is a real deterministic match, so
 * whether the shot goes in is the engine's answer and not a storyboard's — and
 * on the single seed every power used to share, Thunder Strike's demonstration
 * of "enough force to batter keeper Resolve" ended in a miss. Each seed below
 * is the lowest one whose clip ends in that power's own promise landing, found
 * by exhaustive search and pinned by test. A sim change that moves any of them
 * fails that test rather than quietly shipping a demonstration of failure.
 */
const SHOWCASE_SEEDS: Readonly<Record<PowerId, number>> = {
  SUPER_SPEED: 5,
  BLINK_RUN: 1,
  THUNDER_STRIKE: 1,
  FIRE_TORCH: 2,
  PHASE_RUN: 15,
  PORTAL_PASS: 1,
  DECOY_DOUBLE: 26,
  FUTURE_SIGHT: 3,
  SUPER_STRENGTH: 1,
  WEB_TRAP: 1,
  ELASTIC_KEEPER: 1,
  RALLY_CRY: 1,
  ICE_RINK: 2,
  SHADOW_MARK: 69,
  GRAVITY_WELL: 1,
  GIANT_GK: 1,
  GUST: 2,
};

export function powerMatchShowcaseSeed(power: PowerId): number {
  return SHOWCASE_SEEDS[power];
}

/**
 * The powers whose card ends in a shot, and whose clip therefore has to end in
 * a goal. Anything less is a demonstration of the power not working.
 */
const SCORES: ReadonlySet<PowerId> = new Set<PowerId>([
  'SUPER_SPEED',
  'BLINK_RUN',
  'THUNDER_STRIKE',
  'FIRE_TORCH',
  'PHASE_RUN',
  'PORTAL_PASS',
  'DECOY_DOUBLE',
]);

/**
 * True when this power's success is a goal, which the engine restarts from
 * inside the same tick it is scored.
 *
 * The caller needs to know because the frame that shows the ball at the net is
 * then the one *before* the success tick — by the time the tick has finished,
 * twenty-two players are standing on the halfway line.
 */
export function powerMatchShowcaseSuccessRestartsPlay(power: PowerId): boolean {
  return SCORES.has(power);
}

/**
 * Whether the showcased power has now done what its card says it does.
 *
 * One condition per power, each read straight off the power's own promise
 * rather than off a timer:
 *
 * - the seven that end in a shot have to score;
 * - the two keepers have to make the save;
 * - Super Strength has to win the ball it flattens someone for;
 * - Gust has to complete the redirect *and* the punt that follows it;
 * - Rally Cry has to have banked the Encore on its teammate;
 * - Gravity Well has to see the feed into the lane it emptied;
 * - and the four that land an effect on somebody — Web Trap, Ice Rink, Shadow
 *   Mark, Future Sight — have to land it.
 */
export function powerMatchShowcaseSucceeded(
  match: MatchState,
  power: PowerId,
): boolean {
  const hero = powerMatchShowcaseHeroIndex(power);
  const firedAt = match.events.find(
    (event): event is Extract<MatchEvent, { kind: 'POWER_FIRED' }> =>
      event.kind === 'POWER_FIRED' && event.player === hero,
  )?.t;
  if (firedAt === undefined) return false;

  // Rally Cry hands over a state, not a moment: the Encore is the whole of what
  // it promises, and nothing is emitted when it lands.
  if (power === 'RALLY_CRY') {
    return match.players[RALLY_TEAMMATE]?.encoreState !== undefined;
  }

  const since = (predicate: (event: MatchEvent) => boolean): boolean =>
    match.events.some((event) => event.t >= firedAt && predicate(event));

  if (SCORES.has(power))
    return since((event) => event.kind === 'GOAL' && event.team === 0);
  if (power === 'ELASTIC_KEEPER' || power === 'GIANT_GK') {
    return since((event) => event.kind === 'SAVE' && event.by === hero);
  }
  if (power === 'SUPER_STRENGTH') {
    return since(
      (event) => event.kind === 'TACKLE' && event.by === hero && event.won,
    );
  }
  // The redirect is only half of it — the card promises the keeper punts it
  // back into attack, so the clip runs until he has.
  if (power === 'GUST') return since((event) => event.kind === 'GUST_PUNT');
  // The pull is the setup; the pass into the lane it emptied is the point.
  if (power === 'GRAVITY_WELL') {
    return since(
      (event) => event.kind === 'PASS' && event.ok && event.t > firedAt,
    );
  }
  return since(
    (event) => event.kind === 'POWER_IMPACT' && event.player === hero,
  );
}

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
export function powerMatchShowcaseHome(
  power: PowerId,
  heroName?: string,
): TeamDef {
  const heroIndex = powerMatchShowcaseHeroIndex(power);
  return {
    ...ROVERS,
    id: `power-showcase-home-${power.toLowerCase()}`,
    name: 'Power Showcase XI',
    players: ROVERS.players.map((player, index) => ({
      ...player,
      name:
        index === heroIndex && heroName !== undefined ? heroName : player.name,
      attrs: { ...player.attrs },
      power:
        index === heroIndex
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
    players: UNITED.players.map((player) => ({
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
      match.players[6].actionLockedUntilTick =
        POWER_MATCH_SHOWCASE_AUTO_FIRE_DELAY_TICKS;
      break;
    case 'DECOY_DOUBLE':
      place(match, hero, 3_400, 4_300);
      place(match, 6, 2_600, 4_000);
      place(match, 9, 2_200, 3_100);
      place(match, 10, 3_500, 3_600);
      place(match, 12, 2_700, 3_700);
      holdBall(match, 6);
      match.players[6].actionLockedUntilTick =
        POWER_MATCH_SHOWCASE_AUTO_FIRE_DELAY_TICKS;
      break;
    case 'FUTURE_SIGHT':
      place(match, hero, 2_200, 5_000);
      place(match, 11, 2_300, 5_000);
      place(match, 12, 2_500, 4_800);
      holdBall(match, 11);
      match.players[11].actionLockedUntilTick =
        POWER_MATCH_SHOWCASE_AUTO_FIRE_DELAY_TICKS;
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
        shooterId: match.players[21].def.id,
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
      match.players[6].actionLockedUntilTick =
        POWER_MATCH_SHOWCASE_AUTO_FIRE_DELAY_TICKS;
      break;
    case 'GUST':
      place(match, hero, 2_200, 5_000);
      place(match, 11, 2_300, 5_000);
      place(match, 12, 2_500, 4_800);
      holdBall(match, 11);
      match.players[11].actionLockedUntilTick =
        POWER_MATCH_SHOWCASE_AUTO_FIRE_DELAY_TICKS;
      break;
  }

  return hero;
}

export function initializePowerMatchShowcase(
  match: MatchState,
  power: PowerId,
): number {
  const hero = arrangePowerMatchShowcase(match, power);
  match.players[hero].firePolicy = 'SAVE_FOR_TAP';
  match.players[hero].gauge = 0;
  match.players[hero].zonesOpened = 1;
  match.players[hero].powerState = {
    kind: 'zone',
    remainingTicks: ZONE_WINDOW_TICKS,
  };
  match.events.push({ t: match.tick, kind: 'POWER_READY', player: hero });
  return hero;
}

/**
 * Runs the actual match for the whole clip. The hero banks the first 1.5
 * seconds while both teams follow their normal tactics, then switches to the
 * real contextual auto policy. The Zone cannot expire while it waits for that
 * useful moment, and nothing is repositioned at activation time.
 */
export function advancePowerMatchShowcaseReady(
  match: MatchState,
  power: PowerId,
): boolean {
  const hero = powerMatchShowcaseHeroIndex(power);
  const player = match.players[hero];
  const state = player.powerState;
  if (state.kind !== 'zone' && state.kind !== 'winding') return false;
  const leadingIn = match.tick < POWER_MATCH_SHOWCASE_AUTO_FIRE_DELAY_TICKS;
  player.firePolicy = leadingIn ? 'SAVE_FOR_TAP' : 'FIRE_WHEN_READY';
  tick(match);
  if (leadingIn) {
    // The surrounding match keeps simulating, but restore the few authored
    // actors that define this power's useful moment. That keeps the 1.5-second
    // lead-in readable without freezing the other players or teleporting
    // anybody at activation.
    arrangePowerMatchShowcase(match, power);
    player.gauge = 0;
    player.zonesOpened = 1;
    player.powerState = { kind: 'zone', remainingTicks: ZONE_WINDOW_TICKS };
    return true;
  }
  const nextState = player.powerState;
  if (nextState.kind === 'winding') {
    // Keep only the authored carrier/target relationship intact during a
    // visible wind-up. Everyone else keeps running the normal match, and the
    // whole field is released the instant the power becomes active.
    arrangePowerMatchShowcase(match, power);
    player.firePolicy = 'FIRE_WHEN_READY';
  }
  if (nextState.kind === 'zone') {
    // The acquisition clip has no Zone deadline. Only the real authored
    // context may release this banked power after the lead-in.
    nextState.remainingTicks = ZONE_WINDOW_TICKS;
  }
  return true;
}
