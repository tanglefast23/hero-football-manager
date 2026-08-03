import type { Attrs, PowerId } from '../sim/types';
import { MAX_PLAYER_ATTRIBUTE } from '../sim/attributes';
import type { GameState } from './types';
import { LAUNCH_POWER_IDS } from './power-catalog';
import { compareIds } from './ordering';
import { recordFanGain } from './fan-growth';

const POWER_IDS: ReadonlySet<PowerId> = new Set(LAUNCH_POWER_IDS);

export interface CareerEventPlayerEffect {
  playerId: string;
  moraleDelta?: number;
  injuryWeeks?: number;
  attribute?: keyof Attrs;
  attributeDelta?: number;
}

export interface CareerEventOutcomeApplication {
  moneyDelta?: number;
  trainingPointDelta?: number;
  fanDelta?: number;
  flags?: readonly string[];
  playerEffect?: CareerEventPlayerEffect;
}

export interface CareerEventResolutionPresentation {
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
export interface CareerMilestone {
  readonly id: string;
  readonly flag: string;
  readonly eventId: string;
}

/** Flag namespace the engine fills in; no authored outcome produces these. */
export const CAREER_MILESTONE_FLAG_PREFIX = 'milestone:';

export const CAREER_MILESTONE_STATEMENT_MARGIN = 3;
export const CAREER_MILESTONE_UNBEATEN_RUN = 4;
export const CAREER_MILESTONE_PUSH_SEASON_WINS = 8;
export const CAREER_MILESTONE_CROWD = 1000;

/** Recognition order when a week earns more than one milestone at once. */
export const CAREER_MILESTONES: readonly CareerMilestone[] = [
  { id: 'first-win', flag: 'milestone:first-win', eventId: 'milestone-first-win' },
  { id: 'first-hero-goal', flag: 'milestone:first-hero-goal', eventId: 'milestone-first-hero-goal' },
  { id: 'statement-win', flag: 'milestone:statement-win', eventId: 'milestone-statement-win' },
  { id: 'unbeaten-four', flag: 'milestone:unbeaten-four', eventId: 'milestone-unbeaten-run' },
  { id: 'first-cup-win', flag: 'milestone:first-cup-win', eventId: 'milestone-first-cup-win' },
  { id: 'crowd-thousand', flag: 'milestone:crowd-thousand', eventId: 'milestone-crowd-thousand' },
  { id: 'promotion-push', flag: 'milestone:promotion-push', eventId: 'milestone-promotion-push' },
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
  const winsBySeason = new Map<number, number>();
  let unbeatenRun = 0;
  let longestUnbeatenRun = 0;
  let bestMargin = 0;
  for (const result of results) {
    const margin = result.goalsFor - result.goalsAgainst;
    if (margin > bestMargin) bestMargin = margin;
    if (margin > 0) winsBySeason.set(result.season, (winsBySeason.get(result.season) ?? 0) + 1);
    unbeatenRun = margin >= 0 ? unbeatenRun + 1 : 0;
    if (unbeatenRun > longestUnbeatenRun) longestUnbeatenRun = unbeatenRun;
  }
  const bestSeasonWins = [...winsBySeason.values()].reduce((best, wins) => Math.max(best, wins), 0);

  const earned = new Set<string>();
  if (bestMargin > 0) earned.add('first-win');
  if (heroHasScored(state)) earned.add('first-hero-goal');
  if (bestMargin >= CAREER_MILESTONE_STATEMENT_MARGIN) earned.add('statement-win');
  if (longestUnbeatenRun >= CAREER_MILESTONE_UNBEATEN_RUN) earned.add('unbeaten-four');
  if (hasWonCupTie(state)) earned.add('first-cup-win');
  if ((club?.fans ?? 0) >= CAREER_MILESTONE_CROWD) earned.add('crowd-thousand');
  if (bestSeasonWins >= CAREER_MILESTONE_PUSH_SEASON_WINS) earned.add('promotion-push');

  return CAREER_MILESTONES
    .filter(milestone => earned.has(milestone.id))
    .map(milestone => milestone.flag);
}

/** Appends any newly earned milestone flags. Idempotent and order-stable. */
export function recordCareerMilestones(state: GameState): GameState {
  const additions = earnedCareerMilestoneFlags(state)
    .filter(flag => !state.eventFlags.includes(flag));
  return additions.length === 0
    ? state
    : { ...state, eventFlags: [...state.eventFlags, ...additions] };
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

export function offerCareerEvent(state: GameState, eventId: string): GameState {
  if (state.phase !== 'manage') throw new Error('events can only interrupt the manage phase');
  if (state.pendingEvent !== undefined) throw new Error('another event is already pending');
  if (typeof eventId !== 'string' || eventId.trim().length === 0) {
    throw new Error('event ID must be a non-empty string');
  }
  if (state.resolvedEventIds.includes(eventId)) {
    throw new Error(`event ${eventId} has already resolved`);
  }
  return { ...state, pendingEvent: { eventId } };
}

export function selectCareerEventPlayer(state: GameState, playerId: string): GameState {
  if (state.pendingEvent === undefined) throw new Error('there is no pending event');
  if (state.pendingEvent.resolvedChoiceId !== undefined) {
    throw new Error('the resolved event can no longer change player');
  }
  const player = state.players.find(
    candidate => candidate.id === playerId && candidate.clubId === state.userClubId,
  );
  if (player === undefined) throw new Error(`unknown user-club player ${playerId}`);
  return { ...state, pendingEvent: { ...state.pendingEvent, selectedPlayerId: playerId } };
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
  return withCareerMilestoneRecognition(recordFanGain(resolved, fans - club.fans), presentation);
}

/**
 * Records what the club has passed and, unless the author already chained this
 * outcome, follows the story with the earned recognition beat. A milestone story
 * never chains into another one, so a catch-up run arrives one beat per week
 * instead of as a stack of cards.
 */
function withCareerMilestoneRecognition(
  state: GameState,
  presentation: CareerEventResolutionPresentation | undefined,
): GameState {
  const recorded = recordCareerMilestones(state);
  const pending = recorded.pendingEvent;
  if (presentation === undefined || pending === undefined) return recorded;
  if (pending.resolvedNextEventId !== undefined) return recorded;
  if (isCareerMilestoneEventId(pending.eventId)) return recorded;
  const milestoneEventId = pendingCareerMilestoneEventId(recorded);
  if (milestoneEventId === undefined) return recorded;
  return {
    ...recorded,
    pendingEvent: { ...pending, resolvedNextEventId: milestoneEventId },
  };
}

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
  const injuryWeeks = safeDelta(effect.injuryWeeks ?? player.injuryWeeks, 'event injury weeks');
  if (injuryWeeks < 0) throw new Error('event injury weeks cannot be negative');

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
    return { ...candidate, attrs, morale, injuryWeeks };
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
