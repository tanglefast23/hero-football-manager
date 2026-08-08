import { loadLaunchContent, type LaunchContent } from '../../../content';
import {
  CAREER_MILESTONES,
  advanceFacilityConstruction,
  buildCareerFacility,
  careerEventPlayerSaleBlocker,
  deterministicCareerEventRoll,
  hireCareerCoach,
  offerCareerEvent,
  playerLoyalty,
  selectCareerEventCoach,
  selectCareerEventFacility,
  selectCareerEventPlayer,
  type FacilityPosition,
  type FacilityType,
  type GameState,
} from '../../../game';
import {
  continueResolvedCareerEvent,
  resolveCareerEventChoice,
} from '../../../application/career-event-flow';
import {
  careerEventTargetCandidates,
  careerEventTargetKind,
  carriedOnlyCareerEventIds,
  reconcilePendingCareerEvent,
} from '../../../application/career-event-targets';
import { devHarnessCareerAtWeek } from '../career';

export type StoryEvent = LaunchContent['events']['events'][number];
export type RiskSide = 'success' | 'miss';

const CONTENT = loadLaunchContent();
const BASE_SEASON = 1;
const BASE_WEEK = 12;
export const RISK_SEARCH_LIMIT = 512;

let qaCareer: GameState | undefined;

/** A real seeded week augmented through domain helpers for complete target QA. */
export function careerEventsCareer(): GameState {
  if (qaCareer !== undefined) return qaCareer;
  const base = devHarnessCareerAtWeek(BASE_SEASON, BASE_WEEK);
  let state: GameState = {
    ...base,
    pendingEvent: undefined,
    clubs: base.clubs.map((club) =>
      club.id === base.userClubId
        ? { ...club, cash: Math.max(club.cash, 500_000) }
        : club,
    ),
  };

  const facilities: readonly [FacilityType, FacilityPosition][] = [
    ['training-pitch', { x: 0, y: 0 }],
    ['gym', { x: 2, y: 0 }],
    ['dorm', { x: 3, y: 0 }],
    ['fan-shop', { x: 4, y: 0 }],
    ['coaching-office', { x: 5, y: 0 }],
  ];
  for (const [type, position] of facilities) {
    if (
      state.facilities.grid?.buildings.some(
        (building) => building.type === type,
      )
    )
      continue;
    state = completeHarnessFacility(
      buildCareerFacility(state, type, position).state,
    );
  }
  state = hireHarnessCoach(state, 'HEAD');
  state = hireHarnessCoach(state, 'ASSISTANT');
  qaCareer = state;
  return state;
}

function completeHarnessFacility(state: GameState): GameState {
  let grid = state.facilities.grid;
  if (grid === undefined)
    throw new Error('harness facility build produced no grid');
  for (let guard = 0; grid.construction !== undefined; guard += 1) {
    if (guard > 5)
      throw new Error('harness facility construction exceeded five ticks');
    grid = advanceFacilityConstruction(grid).grid;
  }
  return { ...state, facilities: { ...state.facilities, grid } };
}

function hireHarnessCoach(
  state: GameState,
  role: 'HEAD' | 'ASSISTANT',
): GameState {
  const employed =
    role === 'HEAD' ? state.market?.headCoach : state.market?.assistantCoach;
  if (employed !== undefined) return state;
  const market = state.market;
  if (market === undefined)
    throw new Error('harness career has no coach market');
  const candidates = market.coachCandidates
    .slice()
    .sort(
      (left, right) =>
        Number(left.specialties.includes('GOALKEEPING')) -
          Number(right.specialties.includes('GOALKEEPING')) ||
        left.id.localeCompare(right.id),
    );
  for (const candidate of candidates) {
    try {
      return {
        ...state,
        market: hireCareerCoach(state, market, candidate.id, role),
      };
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      if (error.message.includes('not eligible')) continue;
      throw error;
    }
  }
  throw new Error(`harness career has no eligible ${role.toLowerCase()} coach`);
}

const CATEGORY_IDS = [
  ...new Set(CONTENT.events.events.map((event) => event.category)),
];
const CATEGORY_BLURBS: Readonly<Record<string, string | undefined>> =
  Object.freeze({
    mystery: 'Spiders, meteors, a haunted scoreboard',
    club: 'Clubhouse business and recognition beats',
    media: 'Papers, pundits, the radio hour',
    sponsor: 'The money offers',
    player: 'Player stories and training gambles',
    medical: 'Flu, physio, a clean bill of health',
    fan: 'The terraces, the mural, the hundredth fan',
  });

export interface CareerEventCaseDefinition {
  readonly id: string;
  readonly label: string;
  readonly note: string;
}

export function careerEventCaseDefinitions(): readonly CareerEventCaseDefinition[] {
  const interactionCases = [
    {
      id: 'all',
      label: 'ALL',
      note: `${CONTENT.events.events.length} stories · complete authored catalog`,
    },
    {
      id: 'target-player',
      label: 'PLAYERS',
      note: `${eventsForCase('target-player').length} player-targeted stories · includes GK-only`,
    },
    {
      id: 'target-coach',
      label: 'COACHES',
      note: `${eventsForCase('target-coach').length} coach-targeted stories · role and specialty rules`,
    },
    {
      id: 'target-facility',
      label: 'FACILITIES',
      note: `${eventsForCase('target-facility').length} facility-targeted stories · every output family`,
    },
    {
      id: 'two-part',
      label: 'TWO-PART',
      note: `${eventsForCase('two-part').length} chain openers · exact-target carry`,
    },
  ];
  const categories = CATEGORY_IDS.map((id) => {
    const count = eventsForCase(id).length;
    const blurb = CATEGORY_BLURBS[id];
    return {
      id,
      label: id.toUpperCase(),
      note: `${count} stor${count === 1 ? 'y' : 'ies'}${blurb === undefined ? '' : ` · ${blurb}`}`,
    };
  });
  return [...interactionCases, ...categories];
}

export function eventsForCase(caseId: string): readonly StoryEvent[] {
  if (caseId === 'all') return CONTENT.events.events;
  if (caseId === 'target-player') {
    return CONTENT.events.events.filter(
      (event) => event.trigger.requiresPlayer === true,
    );
  }
  if (caseId === 'target-coach') {
    return CONTENT.events.events.filter(
      (event) => event.trigger.requiresCoach === true,
    );
  }
  if (caseId === 'target-facility') {
    return CONTENT.events.events.filter(
      (event) => event.trigger.requiresFacility !== undefined,
    );
  }
  if (caseId === 'two-part') {
    return CONTENT.events.events.filter((event) =>
      event.choices.some((choice) =>
        choice.outcomes.some((outcome) => outcome.nextEventId !== undefined),
      ),
    );
  }
  return CONTENT.events.events.filter((event) => event.category === caseId);
}

/** Offers any catalog entry, supplying the inherited target carried-only cards require. */
export function offerStoryEvent(base: GameState, eventId: string): GameState {
  const event = CONTENT.events.events.find(
    (candidate) => candidate.id === eventId,
  );
  if (event === undefined) throw new Error(`unknown story event ${eventId}`);
  const settled = CAREER_MILESTONES.map(
    (milestone) => milestone.eventId,
  ).filter((candidate) => candidate !== eventId);
  const clean: GameState = {
    ...base,
    pendingEvent: undefined,
    resolvedEventIds: [
      ...new Set([...base.resolvedEventIds, ...settled]),
    ].filter((candidate) => candidate !== eventId),
  };
  const candidates = careerEventTargetCandidates(clean, event);
  const carriedOnly = carriedOnlyCareerEventIds(CONTENT.events).has(event.id);
  const kind = careerEventTargetKind(event);
  const carried =
    !carriedOnly || kind === 'none'
      ? undefined
      : kind === 'player'
        ? { playerId: preferredHarnessPlayerId(clean, event, candidates.playerIds) }
        : kind === 'coach'
          ? { coachRole: candidates.coachRoles[0] }
          : { facilityId: candidates.facilityIds[0] };
  return reconcilePendingCareerEvent(
    offerCareerEvent(clean, eventId, carried),
    CONTENT.events,
  );
}

/** Selects the first legal target only when a card opens unlocked. */
export function readyStoryEvent(
  state: GameState,
  event: StoryEvent,
): GameState {
  const pending = state.pendingEvent;
  if (pending === undefined)
    throw new Error(`event ${event.id} was not offered`);
  const candidates = careerEventTargetCandidates(state, event);
  if (
    event.trigger.requiresPlayer === true &&
    pending.selectedPlayerId === undefined
  ) {
    const id = preferredHarnessPlayerId(state, event, candidates.playerIds);
    if (id === undefined)
      throw new Error(`event ${event.id} has no eligible player`);
    return selectCareerEventPlayer(state, id);
  }
  if (
    event.trigger.requiresCoach === true &&
    pending.selectedCoachRole === undefined
  ) {
    const role = candidates.coachRoles[0];
    if (role === undefined)
      throw new Error(`event ${event.id} has no eligible coach`);
    return selectCareerEventCoach(state, role);
  }
  if (
    event.trigger.requiresFacility !== undefined &&
    pending.selectedFacilityId === undefined
  ) {
    const id = candidates.facilityIds[0];
    if (id === undefined)
      throw new Error(`event ${event.id} has no eligible facility`);
    return selectCareerEventFacility(state, id);
  }
  return state;
}

/** Prefer a target that can exercise every authored choice in standalone QA. */
function preferredHarnessPlayerId(
  state: GameState,
  event: StoryEvent,
  playerIds: readonly string[],
): string | undefined {
  const sale = event.choices.flatMap(choice => choice.outcomes)
    .flatMap(outcome => outcome.effects)
    .find(effect => effect.type === 'playerSale');
  if (sale?.type !== 'playerSale') return playerIds[0];
  return playerIds.find(playerId => (
    careerEventPlayerSaleBlocker(state, playerId, sale.fee) === undefined
  )) ?? playerIds[0];
}

export interface StoryEventResolution {
  readonly state: GameState;
  readonly note: string;
}

/** Steers only the persisted risky-call counter, then invokes production resolution. */
export function resolveStoryEventChoice(
  state: GameState,
  event: StoryEvent,
  choiceId: string,
  side: RiskSide,
): StoryEventResolution {
  const choice = event.choices.find((candidate) => candidate.id === choiceId);
  if (choice === undefined) throw new Error(`unknown event choice ${choiceId}`);
  if (!choice.risky) {
    return {
      state: resolveCareerEventChoice(state, CONTENT.events, choiceId),
      note: 'Guaranteed outcome · no roll to steer',
    };
  }

  const wantedIndex = side === 'miss' ? 1 : 0;
  if ((choice.outcomes[wantedIndex]?.weight ?? 0) <= 0) {
    throw new Error(`${choiceId} has no authored ${side} outcome`);
  }
  const weights = choice.outcomes.map((outcome) => outcome.weight);
  const riskyChoices = riskyChoicesForOutcome(
    state,
    choiceId,
    weights,
    wantedIndex,
  );
  if (riskyChoices === undefined) {
    throw new Error(
      `${choiceId} ${side} is unreachable under the current RNG contract in counters 0…${RISK_SEARCH_LIMIT}`,
    );
  }
  const rolled = {
    ...state,
    eventClock: { ...state.eventClock, riskyChoices },
  };
  const resolved = resolveCareerEventChoice(rolled, CONTENT.events, choiceId);
  if (resolved.pendingEvent?.resolvedOutcomeIndex !== wantedIndex) {
    throw new Error(
      `${choiceId} did not resolve to the searched ${side} outcome`,
    );
  }
  const weight = choice.outcomes[wantedIndex]!.weight;
  return {
    state: resolved,
    note: `${side === 'miss' ? 'MISS' : 'SUCCESS'} at ${weight}% · real roll, from a manager who had made ${riskyChoices} risky calls`,
  };
}

function riskyChoicesForOutcome(
  state: GameState,
  choiceId: string,
  weights: readonly number[],
  wantedIndex: number,
): number | undefined {
  const upperExclusive = weights.reduce((sum, weight) => sum + weight, 0);
  for (
    let riskyChoices = 0;
    riskyChoices <= RISK_SEARCH_LIMIT;
    riskyChoices += 1
  ) {
    const roll = deterministicCareerEventRoll(
      {
        careerSeed: state.careerSeed,
        season: state.season,
        week: state.week,
        riskyChoices,
      },
      choiceId,
      0,
      upperExclusive,
    );
    if (weightedIndex(weights, roll) === wantedIndex) return riskyChoices;
  }
  return undefined;
}

function weightedIndex(weights: readonly number[], roll: number): number {
  let cumulative = 0;
  for (let index = 0; index < weights.length; index += 1) {
    cumulative += weights[index];
    if (roll < cumulative) return index;
  }
  throw new Error('weighted event outcome did not resolve');
}

export function continueStoryEvent(state: GameState): GameState {
  return continueResolvedCareerEvent(state, CONTENT.events).state;
}

/** Everything that durably landed, derived from before/after state rather than content. */
export function careerEventChanges(
  before: GameState,
  after: GameState,
): string[] {
  const lines: string[] = [];
  const wasClub = before.clubs.find((club) => club.id === before.userClubId);
  const isClub = after.clubs.find((club) => club.id === after.userClubId);
  if (wasClub !== undefined && isClub !== undefined) {
    if (wasClub.cash !== isClub.cash) {
      lines.push(
        `cash ${money(wasClub.cash)} → ${money(isClub.cash)} (${signed(isClub.cash - wasClub.cash)})`,
      );
    }
    if (wasClub.fans !== isClub.fans) {
      lines.push(
        `fans ${wasClub.fans} → ${isClub.fans} (${signed(isClub.fans - wasClub.fans)})`,
      );
    }
  }
  if (before.trainingPoints !== after.trainingPoints) {
    lines.push(
      `TP ${before.trainingPoints} → ${after.trainingPoints} (${signed(after.trainingPoints - before.trainingPoints)})`,
    );
  }
  lines.push(...playerChangeLines(before, after));
  lines.push(...coachChangeLines(before, after));
  lines.push(...facilityChangeLines(before, after));

  const gainedFlags = after.eventFlags.filter(
    (flag) => !before.eventFlags.includes(flag),
  );
  if (gainedFlags.length > 0) lines.push(`flags +${gainedFlags.join(' +')}`);
  const chained = after.pendingEvent?.resolvedNextEventId;
  if (chained !== undefined) lines.push(`chains into ${chained}`);
  return lines.length === 0 ? ['nothing changed'] : lines;
}

function playerChangeLines(before: GameState, after: GameState): string[] {
  const priorById = new Map(
    before.players.map((player) => [player.id, player]),
  );
  const changed = after.players.flatMap((player) => {
    const prior = priorById.get(player.id);
    if (prior === undefined) return [];
    const details: string[] = [];
    if (
      prior.clubId === before.userClubId &&
      player.clubId !== after.userClubId
    ) {
      const newClub = after.clubs.find((club) => club.id === player.clubId);
      details.push(`sold to ${newClub?.name ?? player.clubId}`);
    }
    if (player.morale !== prior.morale)
      details.push(`morale ${signed(player.morale - prior.morale)}`);
    if (player.injuryWeeks !== prior.injuryWeeks)
      details.push(`out ${prior.injuryWeeks} → ${player.injuryWeeks}w`);
    for (const key of Object.keys(
      player.attrs,
    ) as (keyof typeof player.attrs)[]) {
      if (player.attrs[key] !== prior.attrs[key])
        details.push(
          `${key.toUpperCase()} ${prior.attrs[key]} → ${player.attrs[key]}`,
        );
    }
    const loyaltyBefore = playerLoyalty(prior, before.careerSeed);
    const loyaltyAfter = playerLoyalty(player, after.careerSeed);
    if (loyaltyAfter !== loyaltyBefore)
      details.push(`loyalty ${loyaltyBefore} → ${loyaltyAfter}`);
    if ((player.condition ?? 100) !== (prior.condition ?? 100)) {
      details.push(
        `condition ${prior.condition ?? 100} → ${player.condition ?? 100}`,
      );
    }
    if ((player.fame ?? 0) !== (prior.fame ?? 0))
      details.push(`fame ${prior.fame ?? 0} → ${player.fame ?? 0}`);
    return details.length === 0 ? [] : [`${player.name} ${details.join(' ')}`];
  });
  return changed;
}

function coachChangeLines(before: GameState, after: GameState): string[] {
  const lines: string[] = [];
  for (const role of ['HEAD', 'ASSISTANT'] as const) {
    const prior =
      role === 'HEAD'
        ? before.market?.headCoach
        : before.market?.assistantCoach;
    const next =
      role === 'HEAD' ? after.market?.headCoach : after.market?.assistantCoach;
    if (prior === undefined || next === undefined) continue;
    const details: string[] = [];
    if (prior.specialties.join('|') !== next.specialties.join('|')) {
      details.push(
        `specialties ${prior.specialties.join('/')} → ${next.specialties.join('/')}`,
      );
    }
    for (const key of [
      'trainingPercent',
      'weeklyTp',
      'motivatorHalfLevels',
    ] as const) {
      const was = prior.boosts?.[key] ?? 0;
      const is = next.boosts?.[key] ?? 0;
      if (was !== is) details.push(`${key} ${was} → ${is}`);
    }
    if (details.length > 0)
      lines.push(
        `${role.toLowerCase()} coach ${next.name}: ${details.join(' · ')}`,
      );
  }
  return lines;
}

function facilityChangeLines(before: GameState, after: GameState): string[] {
  const prior = new Map(
    (before.facilities.grid?.buildings ?? []).map((building) => [
      building.id,
      building,
    ]),
  );
  return (after.facilities.grid?.buildings ?? []).flatMap((building) => {
    const was = prior.get(building.id);
    if (was === undefined) return [];
    const details: string[] = [];
    for (const key of [
      'tpBonusPercent',
      'trainingBonusPercent',
      'recoveryBonus',
      'incomeBonusPercent',
    ] as const) {
      const oldValue = was.boosts?.[key] ?? 0;
      const newValue = building.boosts?.[key] ?? 0;
      if (oldValue !== newValue)
        details.push(`${key} ${oldValue} → ${newValue}`);
    }
    return details.length === 0
      ? []
      : [`${building.type} ${building.id}: ${details.join(' · ')}`];
  });
}

export function riskSideHint(event: StoryEvent, side: RiskSide): string {
  const risky = event.choices.find((choice) => choice.risky);
  const weight = risky?.outcomes[side === 'miss' ? 1 : 0]?.weight;
  if (weight === undefined) return 'This story has no risky choice to steer';
  return `The risky choice will land on its ${side === 'miss' ? 'setback' : 'success'} (${weight}%); the safe one is unaffected`;
}

function signed(value: number): string {
  return `${value > 0 ? '+' : ''}${value}`;
}

function money(value: number): string {
  return `${value < 0 ? '-' : ''}$${Math.abs(value).toLocaleString('en-US')}`;
}
