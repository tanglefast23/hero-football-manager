import type { Attrs, PowerId } from '../sim/types';
import { MAX_PLAYER_ATTRIBUTE } from '../sim/attributes';
import type { GameState } from './types';
import { LAUNCH_POWER_IDS } from './power-catalog';
import { compareIds } from './ordering';
import { recordCashTransaction } from './cash-transactions';
import { recordFanGain } from './fan-growth';
import { adjustLoyalty, playerLoyalty } from './loyalty';
import { COACH_BOOST_CAPS, type CoachSpecialty } from './market';
import { FACILITY_BOOST_CAPS, isFacilityOperational } from './facilities';
import { FAME_CEILING } from './pyramid';

const POWER_IDS: ReadonlySet<PowerId> = new Set(LAUNCH_POWER_IDS);

interface CareerEventPlayerEffect {
  playerId: string;
  moraleDelta?: number;
  /** A setback, in weeks. Only ever lengthens the absence — see `applyPlayerEffect`. */
  injuryWeeks?: number;
  /** A heal, in negative weeks. The only way an event can shorten an absence. */
  injuryWeeksDelta?: number;
  attribute?: keyof Attrs;
  /** Already resolved to points — sessions are converted before they get here. */
  attributeDelta?: number;
  loyaltyDelta?: number;
  conditionDelta?: number;
  fameDelta?: number;
}

interface CareerEventOutcomeApplication {
  moneyDelta?: number;
  trainingPointDelta?: number;
  fanDelta?: number;
  flags?: readonly string[];
  playerEffect?: CareerEventPlayerEffect;
}

interface CareerEventResolutionPresentation {
  outcomeIndex: number;
  risky: boolean;
  success: boolean;
  nextEventId?: string;
}

/**
 * Chooses a fitting power from deterministic integer weights. PAC leans toward
 * Speed, DEF/STA toward Strength, and SHO/TEC toward Fire Torch. Every allowed
 * power keeps a non-zero chance so awakenings still retain some surprise.
 */
export function chooseStatWeightedAwakeningPower(
  powerIds: readonly PowerId[],
  attrs: Readonly<Attrs>,
  roll: number,
): PowerId {
  if (powerIds.length === 0) throw new Error('awakening requires at least one power');
  const seen = new Set<PowerId>();
  for (const powerId of powerIds) {
    if (!POWER_IDS.has(powerId)) throw new Error(`unknown awakening power ${String(powerId)}`);
    if (seen.has(powerId)) throw new Error(`duplicate awakening power ${powerId}`);
    seen.add(powerId);
  }
  const weights = powerIds.map(powerId => awakeningPowerWeight(powerId, attrs));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (!Number.isSafeInteger(total) || total <= 0) {
    throw new Error('awakening power weights exceed the supported range');
  }
  if (!Number.isSafeInteger(roll) || roll < 0 || roll >= total) {
    throw new Error(`awakening power roll must be an integer from 0 to ${total - 1}`);
  }
  let cumulative = 0;
  for (let index = 0; index < powerIds.length; index += 1) {
    cumulative += weights[index];
    if (roll < cumulative) return powerIds[index];
  }
  throw new Error('awakening power roll did not resolve');
}

export function awakeningPowerRollSize(
  powerIds: readonly PowerId[],
  attrs: Readonly<Attrs>,
): number {
  // Use the same validation and weight path as selection without consuming a
  // random value. A roll of zero is legal for every non-empty power list.
  chooseStatWeightedAwakeningPower(powerIds, attrs, 0);
  return powerIds.reduce(
    (sum, powerId) => sum + awakeningPowerWeight(powerId, attrs),
    0,
  );
}

function awakeningPowerWeight(powerId: PowerId, attrs: Readonly<Attrs>): number {
  const values = Object.values(attrs);
  if (values.some(value => !Number.isSafeInteger(value)
    || value < 1
    || value > MAX_PLAYER_ATTRIBUTE)) {
    throw new Error(`awakening attributes must be integers from 1 to ${MAX_PLAYER_ATTRIBUTE}`);
  }
  if (powerId === 'SUPER_SPEED') return 10 + attrs.pac * 3 + attrs.tec + attrs.pas;
  if (powerId === 'BLINK_RUN') return 10 + attrs.pac * 2 + attrs.tec * 2 + attrs.sho;
  if (powerId === 'THUNDER_STRIKE') return 10 + attrs.sho * 3 + attrs.tec + attrs.sta;
  if (powerId === 'FIRE_TORCH') return 10 + attrs.sho * 3 + attrs.tec + attrs.pas;
  if (powerId === 'PHASE_RUN') return 10 + attrs.tec * 3 + attrs.pac + attrs.def;
  if (powerId === 'PORTAL_PASS') return 10 + attrs.pas * 3 + attrs.tec + attrs.pac;
  if (powerId === 'DECOY_DOUBLE') return 10 + attrs.pas * 2 + attrs.tec * 2 + attrs.pac;
  if (powerId === 'FUTURE_SIGHT') return 10 + attrs.def * 2 + attrs.pas * 2 + attrs.tec;
  if (powerId === 'GUST') return 10 + attrs.def * 2 + attrs.pac + attrs.pas * 2;
  if (powerId === 'SUPER_STRENGTH') return 10 + attrs.def * 2 + attrs.sta * 2 + attrs.pac;
  if (powerId === 'WEB_TRAP') return 10 + attrs.def * 3 + attrs.tec + attrs.sta;
  if (powerId === 'RALLY_CRY') return 10 + attrs.sta * 3 + attrs.pas + attrs.tec;
  if (powerId === 'ICE_RINK') return 10 + attrs.def * 2 + attrs.tec * 2 + attrs.sta;
  if (powerId === 'SHADOW_MARK') return 10 + attrs.def * 2 + attrs.pac * 2 + attrs.tec;
  if (powerId === 'GRAVITY_WELL') return 10 + attrs.tec * 3 + attrs.pas + attrs.sta;
  if (powerId === 'GIANT_GK') return 10 + attrs.ref * 3 + attrs.def + attrs.sta;
  return 10 + attrs.ref * 4 + attrs.sta;
}

/**
 * One thing the club actually did, worth a word from somebody. Every milestone
 * is derived from persisted results, so it consumes no random value and the same
 * career always earns the same set in the same order. `eventId` names the
 * authored recognition story in `content/events.json`; a build that ships
 * without that story just skips the beat.
 */
interface CareerMilestone {
  readonly id: string;
  readonly flag: string;
  readonly eventId: string;
}

/** Flag namespace the engine fills in; no authored outcome produces these. */
const CAREER_MILESTONE_FLAG_PREFIX = 'milestone:';

export const CAREER_MILESTONE_UNBEATEN_RUN = 4;
export const CAREER_MILESTONE_CROWD = 1000;
/** A defeat this size is the most memorable thing that happens to a small club. */
export const CAREER_MILESTONE_HEAVY_DEFEAT_MARGIN = 6;

/**
 * Recognition order when a week earns more than one at once.
 *
 * Four of the original seven were cut (owner, 2026-08-07): winning a game is
 * Saturday, not an achievement, and "first hero goal", "three goals clear" and
 * "eight wins" were the same congratulation three more times. What replaced
 * them are beats a manager would actually retell — a hat-trick, a hammering,
 * and the first time the shop sold out.
 */
export const CAREER_MILESTONES: readonly CareerMilestone[] = [
  { id: 'hat-trick', flag: 'milestone:hat-trick', eventId: 'milestone-hat-trick' },
  { id: 'unbeaten-four', flag: 'milestone:unbeaten-four', eventId: 'milestone-unbeaten-run' },
  { id: 'first-cup-win', flag: 'milestone:first-cup-win', eventId: 'milestone-first-cup-win' },
  { id: 'crowd-thousand', flag: 'milestone:crowd-thousand', eventId: 'milestone-crowd-thousand' },
  { id: 'heavy-defeat', flag: 'milestone:heavy-defeat', eventId: 'milestone-heavy-defeat' },
  { id: 'merch-surge', flag: 'milestone:merch-surge', eventId: 'milestone-merch-surge' },
];

interface UserLeagueResult {
  season: number;
  goalsFor: number;
  goalsAgainst: number;
}

/** The milestone flags this career has earned, in recognition order. */
export function earnedCareerMilestoneFlags(state: GameState): string[] {
  const results = userLeagueResults(state);
  const club = state.clubs.find(candidate => candidate.id === state.userClubId);
  let unbeatenRun = 0;
  let longestUnbeatenRun = 0;
  let worstMargin = 0;
  for (const result of results) {
    const margin = result.goalsFor - result.goalsAgainst;
    if (margin < worstMargin) worstMargin = margin;
    unbeatenRun = margin >= 0 ? unbeatenRun + 1 : 0;
    if (unbeatenRun > longestUnbeatenRun) longestUnbeatenRun = unbeatenRun;
  }
  const earned = new Set<string>();
  if (longestUnbeatenRun >= CAREER_MILESTONE_UNBEATEN_RUN) earned.add('unbeaten-four');
  if (hasWonCupTie(state)) earned.add('first-cup-win');
  if ((club?.fans ?? 0) >= CAREER_MILESTONE_CROWD) earned.add('crowd-thousand');
  if (worstMargin <= -CAREER_MILESTONE_HEAVY_DEFEAT_MARGIN) earned.add('heavy-defeat');
  if (hasMerchSurged(state)) earned.add('merch-surge');
  // The hat-trick is banked by settlement, not recomputed: a fixture keeps only
  // its score, so the scorer list is gone by the time this runs.
  if (state.eventFlags.includes('milestone:hat-trick')) earned.add('hat-trick');

  return CAREER_MILESTONES
    .filter(milestone => earned.has(milestone.id))
    .map(milestone => milestone.flag);
}

/**
 * Appends any newly earned milestone flags, and queues the beats they earned.
 *
 * Idempotent and order-stable. The queue is what the weekly offer drains, so a
 * career that earns three milestones in three weeks shows them one a week
 * rather than stacking them behind whatever story happens to resolve next.
 */
export function recordCareerMilestones(state: GameState): GameState {
  const additions = earnedCareerMilestoneFlags(state)
    .filter(flag => !state.eventFlags.includes(flag));
  if (additions.length === 0) return state;
  const eventFlags = [...state.eventFlags, ...additions];
  const queued = state.pendingMilestones ?? [];
  const newBeats = CAREER_MILESTONES
    .filter(milestone => additions.includes(milestone.flag))
    .filter(milestone => !state.resolvedEventIds.includes(milestone.eventId))
    .filter(milestone => !queued.some(entry => entry.eventId === milestone.eventId))
    .map(milestone => ({ eventId: milestone.eventId }));
  return {
    ...state,
    eventFlags,
    ...(newBeats.length === 0 ? {} : { pendingMilestones: [...queued, ...newBeats] }),
  };
}

/**
 * Takes a beat off the queue once its card has been offered.
 *
 * Also drops an entry whose carried player has left the club: the hat-trick
 * card has no picker, so a card pointing at a departed scorer could never be
 * resolved.
 */
export function drainPendingMilestone(state: GameState, eventId: string): GameState {
  const queued = state.pendingMilestones;
  if (queued === undefined || queued.length === 0) return state;
  const remaining = queued.filter(entry => (
    entry.eventId !== eventId
      && (entry.selectedPlayerId === undefined || state.players.some(player => (
        player.id === entry.selectedPlayerId && player.clubId === state.userClubId
      )))
  ));
  return remaining.length === queued.length
    ? state
    : { ...state, pendingMilestones: remaining };
}

/**
 * Seeds the queue once, for a career that banked a milestone flag before the
 * queue existed. Restricted to milestones this build still ships, so a save
 * carrying a retired recognition card cannot resurrect it.
 */
export function seedPendingMilestones(state: GameState): GameState {
  if (state.pendingMilestones !== undefined) return state;
  const owed = CAREER_MILESTONES
    .filter(milestone => state.eventFlags.includes(milestone.flag))
    .filter(milestone => !state.resolvedEventIds.includes(milestone.eventId))
    .map(milestone => ({ eventId: milestone.eventId }));
  return { ...state, pendingMilestones: owed };
}

/**
 * The earned milestone whose recognition story has not been seen yet. A resolved
 * story chains straight into it, so an achievement is acknowledged at the next
 * story beat instead of waiting on a weekly draw the player may never win.
 */
export function pendingCareerMilestoneEventId(state: GameState): string | undefined {
  // Banked flags are the durable record: the live recompute forgets a milestone
  // when its evidence leaves the state (season rollover replaces `fixtures`, a
  // negative-fans event can drop a banked crowd back under the bar). The live
  // set still matters for milestones earned mid-week, before the next
  // settlement banks them.
  const earned = new Set(earnedCareerMilestoneFlags(state));
  for (const flag of state.eventFlags) earned.add(flag);
  const pendingId = state.pendingEvent?.eventId;
  return CAREER_MILESTONES.find(milestone => (
    earned.has(milestone.flag)
    && milestone.eventId !== pendingId
    && !state.resolvedEventIds.includes(milestone.eventId)
  ))?.eventId;
}

export function isCareerMilestoneEventId(eventId: string | undefined): boolean {
  return CAREER_MILESTONES.some(milestone => milestone.eventId === eventId);
}

function userLeagueResults(state: GameState): UserLeagueResult[] {
  return state.fixtures
    .filter(fixture => (
      fixture.status === 'played'
      && fixture.score !== undefined
      && (fixture.homeClubId === state.userClubId || fixture.awayClubId === state.userClubId)
    ))
    .slice()
    .sort((left, right) => (
      left.season - right.season
      || left.week - right.week
      || compareIds(left.id, right.id)
    ))
    .flatMap(fixture => {
      const score = fixture.score;
      if (score === undefined) return [];
      const atHome = fixture.homeClubId === state.userClubId;
      return [{
        season: fixture.season,
        goalsFor: atHome ? score.homeGoals : score.awayGoals,
        goalsAgainst: atHome ? score.awayGoals : score.homeGoals,
      }];
    });
}

// KNOWN QUIRK (accepted 2026-07-26): stat lines persist across seasons and hero
// status is tested at recognition time, so a player who scored before awakening
// earns "first hero goal" the week they awaken. Deterministic and harmless —
// fixing it needs a per-row hero bit in the save, which the moment of a
// just-awakened striker's recognition doesn't justify.
/**
 * The first TRENDING MERCHANDISE surge, read back off the banked ledger.
 *
 * The surge is already persisted as part of the Financial Report's reveal, so
 * the milestone is a callback to a banner the manager has just watched rather
 * than a new roll.
 */
function hasMerchSurged(state: GameState): boolean {
  return (state.ledgers ?? []).some(ledger => ledger.lines.some(line => (
    line.reveal?.source === 'merch' && line.reveal.surge === true
  )));
}

function heroHasScored(state: GameState): boolean {
  const heroIds = new Set(state.players
    .filter(player => player.clubId === state.userClubId && player.power !== undefined)
    .map(player => player.id));
  return (state.seasonStatLines ?? []).some(
    line => line.goals > 0 && heroIds.has(line.playerId),
  );
}

function hasWonCupTie(state: GameState): boolean {
  return (state.m2?.nationalCups ?? []).some(cup => cup.rounds.some(round => (
    round.fixtures.some(
      fixture => fixture.status === 'played' && fixture.winnerClubId === state.userClubId,
    )
  )));
}

/**
 * `carriedPlayerId` continues a story about someone. A chapter offered with one
 * opens already pointing at that player and refuses to be re-pointed, so the
 * name the manager answered for in the first half is the name in the second.
 * A player who has since left the club is dropped rather than carried, which
 * leaves the chapter choosing again instead of naming a stranger.
 */
/**
 * What a chapter inherits from the one that opened it.
 *
 * A sequel is about the same target its parent was about — the same player, the
 * same coach, the same building — so the target travels with the offer and is
 * locked. A target that has left the club, been fired or been closed is simply
 * dropped, and the sequel opens unlocked rather than pointing at a ghost.
 */
export interface CarriedEventTarget {
  readonly playerId?: string;
  readonly coachRole?: 'HEAD' | 'ASSISTANT';
  readonly facilityId?: string;
}

export function offerCareerEvent(
  state: GameState,
  eventId: string,
  carried?: string | CarriedEventTarget,
): GameState {
  if (state.phase !== 'manage') throw new Error('events can only interrupt the manage phase');
  if (state.pendingEvent !== undefined) throw new Error('another event is already pending');
  if (typeof eventId !== 'string' || eventId.trim().length === 0) {
    throw new Error('event ID must be a non-empty string');
  }
  if (state.resolvedEventIds.includes(eventId)) {
    throw new Error(`event ${eventId} has already resolved`);
  }
  const target: CarriedEventTarget = typeof carried === 'string'
    ? { playerId: carried }
    : carried ?? {};

  const player = target.playerId === undefined
    ? undefined
    : state.players.find(
      candidate => candidate.id === target.playerId && candidate.clubId === state.userClubId,
    );
  const coach = target.coachRole === undefined
    ? undefined
    : (target.coachRole === 'HEAD' ? state.market?.headCoach : state.market?.assistantCoach);
  const grid = state.facilities.grid;
  const facility = target.facilityId === undefined || grid === undefined
    ? undefined
    : grid.buildings.find(building => (
      building.id === target.facilityId && isFacilityOperational(grid, building.id)
    ));

  return {
    ...state,
    pendingEvent: {
      eventId,
      ...(player === undefined ? {} : { selectedPlayerId: player.id, playerLocked: true as const }),
      ...(coach === undefined ? {} : { selectedCoachRole: target.coachRole, coachLocked: true as const }),
      ...(facility === undefined ? {} : { selectedFacilityId: facility.id, facilityLocked: true as const }),
    },
  };
}

export function selectCareerEventPlayer(state: GameState, playerId: string): GameState {
  if (state.pendingEvent === undefined) throw new Error('there is no pending event');
  if (state.pendingEvent.resolvedChoiceId !== undefined) {
    throw new Error('the resolved event can no longer change player');
  }
  if (state.pendingEvent.playerLocked === true) {
    throw new Error('this chapter is already about a player chosen earlier in the story');
  }
  const player = state.players.find(
    candidate => candidate.id === playerId && candidate.clubId === state.userClubId,
  );
  if (player === undefined) throw new Error(`unknown user-club player ${playerId}`);
  return { ...state, pendingEvent: { ...state.pendingEvent, selectedPlayerId: playerId } };
}

/**
 * Points the pending story at one of the two staff slots.
 *
 * The same rules as the player picker: not after the outcome has resolved, and
 * not when the chapter inherited its coach from the story that opened it.
 */
export function selectCareerEventCoach(
  state: GameState,
  role: 'HEAD' | 'ASSISTANT',
): GameState {
  if (state.pendingEvent === undefined) throw new Error('there is no pending event');
  if (state.pendingEvent.resolvedChoiceId !== undefined) {
    throw new Error('the resolved event can no longer change coach');
  }
  if (state.pendingEvent.coachLocked === true) {
    throw new Error('this chapter is already about a coach chosen earlier in the story');
  }
  const coach = role === 'HEAD' ? state.market?.headCoach : state.market?.assistantCoach;
  if (coach === undefined) {
    throw new Error(`the club employs no ${role === 'HEAD' ? 'head' : 'assistant'} coach`);
  }
  return { ...state, pendingEvent: { ...state.pendingEvent, selectedCoachRole: role } };
}

/**
 * Points the pending story at one building.
 *
 * Refuses a building that is still going up: it pays no upkeep and grants no
 * benefit until it is operational, so a story about the floodlights cannot be
 * told about scaffolding.
 */
export function selectCareerEventFacility(state: GameState, buildingId: string): GameState {
  if (state.pendingEvent === undefined) throw new Error('there is no pending event');
  if (state.pendingEvent.resolvedChoiceId !== undefined) {
    throw new Error('the resolved event can no longer change facility');
  }
  if (state.pendingEvent.facilityLocked === true) {
    throw new Error('this chapter is already about a building chosen earlier in the story');
  }
  const grid = state.facilities.grid;
  const building = grid?.buildings.find(candidate => candidate.id === buildingId);
  if (grid === undefined || building === undefined) {
    throw new Error(`unknown facility ${buildingId}`);
  }
  if (!isFacilityOperational(grid, buildingId)) {
    throw new Error('that building is still under construction');
  }
  return { ...state, pendingEvent: { ...state.pendingEvent, selectedFacilityId: buildingId } };
}

/**
 * Applies a story's permanent change to one building.
 *
 * Accumulates on the building's own record and clamps at the cap, so a run of
 * good weeks cannot compound past the ceiling and a run of bad ones cannot
 * make a building worse than not having it — the aggregators floor there.
 */
export function applyFacilityEventEffect(
  state: GameState,
  buildingId: string,
  facet: keyof typeof FACILITY_BOOST_CAPS,
  amount: number,
): GameState {
  const grid = state.facilities.grid;
  if (grid === undefined) throw new Error('the career has no facility grid');
  const target = grid.buildings.find(building => building.id === buildingId);
  if (target === undefined) throw new Error(`unknown facility ${buildingId}`);
  if (!isFacilityOperational(grid, buildingId)) {
    throw new Error('a story cannot change a building that is still being built');
  }
  const cap = FACILITY_BOOST_CAPS[facet];
  const current = target.boosts?.[facet] ?? 0;
  const next = Math.max(-cap, Math.min(cap, current + amount));
  return {
    ...state,
    facilities: {
      ...state.facilities,
      grid: {
        ...grid,
        buildings: grid.buildings.map(building => (
          building.id === buildingId
            ? { ...building, boosts: { ...building.boosts, [facet]: next } }
            : building
        )),
      },
    },
  };
}

/**
 * Applies a story's permanent change to one coach.
 *
 * Boosts accumulate on the coach record and are clamped where they are read
 * (`cappedCoachBoost`), so content cannot author its way past a cap and a
 * clamped total can never reach the training validator out of range.
 */
export function applyCoachEventEffect(
  state: GameState,
  role: 'HEAD' | 'ASSISTANT',
  effect: { readonly facet?: 'training' | 'tp' | 'motivator'; readonly amount?: number; readonly specialtyTo?: CoachSpecialty },
): GameState {
  const market = state.market;
  if (market === undefined) throw new Error('the career has no coach market');
  const coach = role === 'HEAD' ? market.headCoach : market.assistantCoach;
  if (coach === undefined) throw new Error(`no ${role} coach to change`);

  let next = coach;
  if (effect.facet !== undefined && effect.amount !== undefined) {
    const key = effect.facet === 'training'
      ? 'trainingPercent'
      : effect.facet === 'tp' ? 'weeklyTp' : 'motivatorHalfLevels';
    const cap = COACH_BOOST_CAPS[key];
    const current = coach.boosts?.[key] ?? 0;
    next = {
      ...next,
      boosts: { ...next.boosts, [key]: Math.max(-cap, Math.min(cap, current + effect.amount)) },
    };
  }
  if (effect.specialtyTo !== undefined) {
    // Retraining replaces the SECOND specialty. Swapping to one he already
    // holds would leave him with a duplicate pair, which `validateCoach`
    // rejects — so the picker refuses that coach and this is a belt-and-braces.
    if (next.specialties.includes(effect.specialtyTo)) {
      throw new Error('a coach cannot retrain into a specialty he already holds');
    }
    next = { ...next, specialties: [next.specialties[0], effect.specialtyTo] };
  }

  return {
    ...state,
    market: {
      ...market,
      ...(role === 'HEAD' ? { headCoach: next } : { assistantCoach: next }),
    },
  };
}

export function applyCareerEventOutcome(
  state: GameState,
  choiceId: string,
  outcomeText: string,
  application: CareerEventOutcomeApplication,
  presentation?: CareerEventResolutionPresentation,
): GameState {
  if (state.pendingEvent === undefined) throw new Error('there is no pending event');
  if (state.pendingEvent.resolvedChoiceId !== undefined) {
    throw new Error('the event outcome has already resolved');
  }
  if (choiceId.trim().length === 0 || outcomeText.trim().length === 0) {
    throw new Error('resolved event choice and outcome text must be non-empty');
  }
  if (presentation !== undefined
    && (!Number.isSafeInteger(presentation.outcomeIndex) || presentation.outcomeIndex < 0)) {
    throw new Error('resolved event outcome index must be a nonnegative safe integer');
  }

  const moneyDelta = safeDelta(application.moneyDelta ?? 0, 'event money');
  const trainingPointDelta = safeDelta(application.trainingPointDelta ?? 0, 'event TP');
  const fanDelta = safeDelta(application.fanDelta ?? 0, 'event fans');
  const club = state.clubs.find(candidate => candidate.id === state.userClubId);
  if (club === undefined) throw new Error(`unknown user club ${state.userClubId}`);

  const cash = safeAdd(club.cash, moneyDelta, 'event cash balance');
  const trainingPoints = safeAdd(state.trainingPoints, trainingPointDelta, 'event TP balance');
  if (trainingPoints < 0) throw new Error('event effects cannot make TP negative');
  // A fan setback floors at zero the same way a board forced sale does. A club
  // the league has nearly abandoned must still be able to resolve its story.
  const fans = Math.max(0, safeAdd(club.fans, fanDelta, 'event fan balance'));

  const flags = [...state.eventFlags];
  for (const flag of application.flags ?? []) {
    if (typeof flag !== 'string' || flag.trim().length === 0) {
      throw new Error('event flags must be non-empty strings');
    }
    if (!flags.includes(flag)) flags.push(flag);
  }

  const resolved: GameState = {
    ...state,
    clubs: state.clubs.map(candidate =>
      candidate.id === state.userClubId ? { ...candidate, cash, fans } : candidate,
    ),
    trainingPoints,
    eventFlags: flags,
    players: applyPlayerEffect(state, application.playerEffect),
    pendingEvent: {
      ...state.pendingEvent,
      resolvedChoiceId: choiceId,
      outcomeText,
      ...(presentation === undefined ? {} : {
        resolvedOutcomeIndex: presentation.outcomeIndex,
        resolvedRisky: presentation.risky,
        resolvedSuccess: presentation.success,
        ...(presentation.nextEventId === undefined
          ? {}
          : { resolvedNextEventId: presentation.nextEventId }),
      }),
    },
  };
  // Event money used to move the balance silently: invisible in the money
  // history and missing from the pre-M4 recap fallback, which reconstructs a
  // season's opening cash from ledgers plus these transactions. Recorded after
  // the balance moves, like every other one-off spend, so `balanceAfter` is
  // stamped from the settled figure. The store gates choices via `minMoney`
  // and the weekly cash floor bounds any authored setback, so no extra clamp
  // belongs here — a forced outcome must always be able to resolve.
  const recorded = moneyDelta === 0
    ? resolved
    : recordCashTransaction(resolved, {
        kind: 'event',
        label: 'Story event',
        labelKey: 'ledger.storyEvent',
        amount: moneyDelta,
        referenceId: state.pendingEvent.eventId,
      });
  return recordCareerMilestones(recordFanGain(recorded, fans - club.fans));
}

/**
 * Records what the club has passed and, unless the author already chained this
 * outcome, follows the story with the earned recognition beat. A milestone story
 * never chains into another one, so a catch-up run arrives one beat per week
 * instead of as a stack of cards.
 */
/**
 * Milestones are no longer stapled to whatever story resolved last.
 *
 * The old `withCareerMilestoneRecognition` wrote an earned milestone into the
 * just-resolved event's `resolvedNextEventId`, so the game appended an
 * unrelated recognition card to any story — and the button, which can only ask
 * "is there another card?", promised "Continue the story" and then delivered a
 * different one, often straight off a failure screen.
 *
 * `resolvedNextEventId` is now authored-only, which makes that button true by
 * construction. Recognition gets its own lane instead: `pendingMilestones` is
 * drained by the weekly offer, one beat at a time, without rolling the weekly
 * chance and without resetting the drought counter the random deck reads.
 */

export function dismissCareerEvent(state: GameState, markResolved = true): GameState {
  const pending = state.pendingEvent;
  if (pending?.resolvedChoiceId === undefined || pending.outcomeText === undefined) {
    throw new Error('an event must resolve before it can be dismissed');
  }
  return {
    ...state,
    pendingEvent: undefined,
    resolvedEventHistory: [
      ...(state.resolvedEventHistory ?? []),
      { eventId: pending.eventId, season: state.season, week: state.week },
    ],
    resolvedEventIds: !markResolved || state.resolvedEventIds.includes(pending.eventId)
      ? state.resolvedEventIds
      : [...state.resolvedEventIds, pending.eventId],
  };
}

function applyPlayerEffect(
  state: GameState,
  effect: CareerEventPlayerEffect | undefined,
): GameState['players'] {
  if (effect === undefined) return state.players;
  const player = state.players.find(
    candidate => candidate.id === effect.playerId && candidate.clubId === state.userClubId,
  );
  if (player === undefined) throw new Error(`unknown event player ${effect.playerId}`);
  const moraleDelta = safeDelta(effect.moraleDelta ?? 0, 'event morale');
  /**
   * A setback can only ever make an absence longer.
   *
   * This used to assign the authored weeks outright, so a story that knocked a
   * player out for one week *shortened* a four-week injury he was already
   * carrying — a setback that healed him. Healing has its own effect
   * (`injuryWeeksDelta`) precisely because `max` cannot express it.
   */
  const injurySetback = safeDelta(effect.injuryWeeks ?? 0, 'event injury weeks');
  if (injurySetback < 0) throw new Error('event injury weeks cannot be negative');
  const injuryHeal = safeDelta(effect.injuryWeeksDelta ?? 0, 'event injury heal');
  if (injuryHeal > 0) throw new Error('event injury heal must be negative or zero');
  const injuryWeeks = Math.max(
    0,
    safeAdd(Math.max(player.injuryWeeks, injurySetback), injuryHeal, 'event injury weeks'),
  );

  const loyaltyDelta = safeDelta(effect.loyaltyDelta ?? 0, 'event loyalty');
  const conditionDelta = safeDelta(effect.conditionDelta ?? 0, 'event condition');
  const fameDelta = safeDelta(effect.fameDelta ?? 0, 'event fame');

  return state.players.map(candidate => {
    if (candidate.id !== effect.playerId) return candidate;
    const morale = Math.max(0, Math.min(100, safeAdd(candidate.morale, moraleDelta, 'event morale')));
    const attrs = { ...candidate.attrs };
    if (effect.attribute !== undefined) {
      const delta = safeDelta(effect.attributeDelta ?? 0, 'event attribute');
      attrs[effect.attribute] = Math.max(
        1,
        Math.min(
          MAX_PLAYER_ATTRIBUTE,
          safeAdd(attrs[effect.attribute], delta, 'event attribute'),
        ),
      );
    } else if (effect.attributeDelta !== undefined) {
      throw new Error('an event attribute delta requires an attribute');
    }
    return {
      ...candidate,
      attrs,
      morale,
      injuryWeeks,
      // Loyalty is absent until something moves it, and absent means "the value
      // derived from the career seed" rather than zero. `playerLoyalty` is the
      // only honest way to read it; a raw `?? 0` would silently demote every
      // player the first time a story touched him.
      ...(loyaltyDelta === 0
        ? {}
        : { loyalty: adjustLoyalty(playerLoyalty(candidate, state.careerSeed), loyaltyDelta) }),
      ...(conditionDelta === 0
        ? {}
        : {
            condition: Math.max(0, Math.min(100, safeAdd(
              candidate.condition ?? 100,
              conditionDelta,
              'event condition',
            ))),
          }),
      ...(fameDelta === 0
        ? {}
        : {
            fame: Math.max(0, Math.min(FAME_CEILING, safeAdd(
              candidate.fame ?? 0,
              fameDelta,
              'event fame',
            ))),
          }),
    };
  });
}

function safeDelta(value: number, label: string): number {
  if (!Number.isSafeInteger(value)) throw new Error(`${label} must be a safe integer`);
  return value;
}

function safeAdd(left: number, right: number, label: string): number {
  if (!Number.isSafeInteger(left) || !Number.isSafeInteger(right) || !Number.isSafeInteger(left + right)) {
    throw new Error(`${label} exceeds the safe integer range`);
  }
  return left + right;
}
