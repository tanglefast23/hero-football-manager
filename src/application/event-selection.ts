import type { EventCatalog } from '../content';
import {
  deterministicCareerEventRoll,
  currentUserDivision,
  rollWeeklyEvent,
  type GameState,
} from '../game';

export interface EventOfferForWeek {
  readonly eventId?: string;
  readonly eventClock: GameState['eventClock'];
}

const RARITY_WEIGHT = {
  common: 6,
  rare: 3,
  legendary: 1,
} as const;

export interface EventOfferOptions {
  /**
   * Whether the week's desk is otherwise empty. Stories land on quiet weeks
   * only: a week already carrying renewals, an injury and a Bert first has
   * enough to read, and a fourth card there would be the one that gets skipped.
   */
  readonly deskClear: boolean;
}

/**
 * Chooses the story that lands on this week's desk. All random inputs come from
 * persisted career state, so save/reload cannot reroll an offer.
 *
 * A busy week does not advance the drought counter. The count the ramp reads is
 * "quiet weeks that came up empty", so weeks that never rolled cannot inflate
 * the odds of the next one that does.
 *
 * The quiet-week rule applies to the RANDOM deck only. Authored one-shots with a
 * fixed window — the Giant Spider is the one that ships — fire inside it either
 * way: their window falls in the opening season, when Bert's tutorial queue keeps
 * the desk busy nearly every week, so gating them would retire them by accident.
 */
export function eventOfferForWeek(
  state: GameState,
  catalog: EventCatalog,
  options: EventOfferOptions,
): EventOfferForWeek {
  if (state.phase !== 'manage') {
    return { eventClock: { ...state.eventClock } };
  }
  if (state.onboarding !== undefined && state.onboarding.stage !== 'complete') {
    return { eventClock: { ...state.eventClock } };
  }
  const hadStoryLastWeek = state.resolvedEventHistory?.some(entry => (
    entry.season === state.season && entry.week === state.week - 1
  )) ?? false;
  if (hadStoryLastWeek) {
    return {
      eventClock: {
        ...state.eventClock,
        weeksWithoutEvent: state.eventClock.weeksWithoutEvent + 1,
      },
    };
  }

  const spider = catalog.events.find(event => event.id === 'giant-spider-arrives');
  if (spider !== undefined
    && eventIsEligible(state, spider)
    && !state.resolvedEventIds.includes(spider.id)) {
    return {
      eventId: spider.id,
      eventClock: { ...state.eventClock, weeksWithoutEvent: 0 },
    };
  }

  if (!options.deskClear) {
    return { eventClock: { ...state.eventClock } };
  }

  const weeklyRoll = deterministicCareerEventRoll(
    eventRollContext(state),
    '__weekly_event__',
    0,
    100,
  );
  const weekly = rollWeeklyEvent(state.eventClock, weeklyRoll, catalog.tuning);
  if (!weekly.offered) return { eventClock: weekly.state };

  const candidates = catalog.events
    .filter(event => event.id !== 'giant-spider-arrives')
    .filter(event => eventIsEligible(state, event))
    .filter(event => event.trigger.repeatable === true || !state.resolvedEventIds.includes(event.id))
    .sort((left, right) => left.id.localeCompare(right.id));
  if (candidates.length === 0) {
    return {
      eventClock: {
        ...state.eventClock,
        weeksWithoutEvent: state.eventClock.weeksWithoutEvent + 1,
      },
    };
  }

  const weights = candidates.map(event => RARITY_WEIGHT[event.rarity]);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const roll = deterministicCareerEventRoll(
    eventRollContext(state),
    '__event_catalog__',
    1,
    total,
  );
  let cumulative = 0;
  const index = weights.findIndex(weight => {
    cumulative += weight;
    return roll < cumulative;
  });
  const selected = candidates[index];
  if (selected === undefined) throw new Error('event catalog selection did not resolve');

  return {
    eventId: selected.id,
    eventClock: { ...weekly.state, weeksWithoutEvent: 0 },
  };
}

/**
 * Drops a pending story whose event the shipped catalog no longer contains.
 * Content is data, so a later drop can retire or rename an event while a player
 * has it on screen. Without this the story screen throws while rendering, and
 * because the pending event is persisted it would throw again on every relaunch.
 */
export function reconcilePendingStoryEvent(
  state: GameState,
  catalog: EventCatalog,
): GameState {
  const pending = state.pendingEvent;
  if (pending === undefined) return state;
  if (catalog.events.some(event => event.id === pending.eventId)) return state;
  return { ...state, pendingEvent: undefined };
}

export function eventIsEligible(
  state: GameState,
  event: EventCatalog['events'][number],
): boolean {
  const trigger = event.trigger;
  // Authored season is the first eligible season. Unseen one-shot stories stay
  // in the deck in later years instead of silently expiring after Year 1/2.
  const division = state.m2 === undefined ? 5 : currentUserDivision(state.m2);
  return state.season >= trigger.season
    && state.week >= trigger.minWeek
    && state.week <= trigger.maxWeek
    && (trigger.requiredFlag === undefined || state.eventFlags.includes(trigger.requiredFlag))
    && (trigger.minDivision === undefined || division >= trigger.minDivision)
    && (trigger.maxDivision === undefined || division <= trigger.maxDivision)
    && requirementsMet(state, trigger);
}

export function eventChoiceUnavailableReason(
  state: GameState,
  choice: EventCatalog['events'][number]['choices'][number],
): string | undefined {
  const requirements = choice.requires;
  if (requirements === undefined) return undefined;
  return requirementFailure(state, requirements);
}

function requirementsMet(
  state: GameState,
  requirements: {
    minMoney?: number;
    requiredFacility?: string;
    requiredPersonality?: string;
    requiresHero?: boolean;
  },
): boolean {
  return requirementFailure(state, requirements) === undefined;
}

function requirementFailure(
  state: GameState,
  requirements: {
    minMoney?: number;
    requiredFacility?: string;
    requiredPersonality?: string;
    requiresHero?: boolean;
  },
): string | undefined {
  const club = state.clubs.find(candidate => candidate.id === state.userClubId);
  if (requirements.minMoney !== undefined && (club?.cash ?? 0) < requirements.minMoney) {
    return `Requires $${requirements.minMoney.toLocaleString()} cash`;
  }
  if (requirements.requiredFacility !== undefined) {
    const legacyTrainingPitch = requirements.requiredFacility === 'training-pitch' && state.facilities.trainingGroundBuilt;
    const built = legacyTrainingPitch || state.facilities.grid?.buildings.some(building => building.type === requirements.requiredFacility);
    if (!built) return `Requires ${requirements.requiredFacility.replaceAll('-', ' ')}`;
  }
  const roster = state.players.filter(player => player.clubId === state.userClubId);
  if (requirements.requiredPersonality !== undefined
    && !roster.some(player => player.personality === requirements.requiredPersonality)) {
    return `Requires a ${requirements.requiredPersonality} player`;
  }
  if (requirements.requiresHero === true && !roster.some(player => player.power !== undefined)) {
    return 'Requires a hero';
  }
  return undefined;
}

function eventRollContext(state: GameState) {
  return {
    careerSeed: state.careerSeed,
    season: state.season,
    week: state.week,
    riskyChoices: state.eventClock.riskyChoices,
  };
}
