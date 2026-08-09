import type { EventCatalog } from '../content';
import { copyFor, formatMoneyForCopy, type CopyFn } from '../i18n';
import { facilityNameFromId, personalityName } from './name-copy';
import {
  careerEventPlayerSaleBlocker,
  deterministicCareerEventRoll,
  currentUserDivision,
  isCareerMilestoneEventId,
  isFacilityOperational,
  rollWeeklyEvent,
  type GameState,
} from '../game';
import {
  careerEventHasLegalTarget,
  carriedOnlyCareerEventIds,
  reconcilePendingCareerEvent,
} from './career-event-targets';

export interface EventOfferForWeek {
  readonly eventId?: string;
  readonly eventClock: GameState['eventClock'];
}

let englishCopyFn: CopyFn | undefined;

function englishCopy(): CopyFn {
  return (englishCopyFn ??= copyFor('en'));
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
 * The quiet-week rule applies to the RANDOM deck only. Achievement stories use
 * the direct lane above it and do not wait for an empty desk.
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
  /**
   * Recognition is the direct consequence of an achievement, so it is the first
   * story lane checked. It does not wait behind the normal week-after-story gap
   * or a busy desk, and it never resets the random deck's drought counter.
   */
  const milestone = (state.pendingMilestones ?? []).find((entry) =>
    catalog.events.some((event) => event.id === entry.eventId),
  );
  if (milestone !== undefined) {
    return { eventId: milestone.eventId, eventClock: { ...state.eventClock } };
  }

  const hadStoryLastWeek =
    state.resolvedEventHistory?.some(
      (entry) => entry.season === state.season && entry.week === state.week - 1,
    ) ?? false;
  if (hadStoryLastWeek) {
    return {
      eventClock: {
        ...state.eventClock,
        weeksWithoutEvent: state.eventClock.weeksWithoutEvent + 1,
      },
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

  const carriedOnly = carriedOnlyCareerEventIds(catalog);
  const candidates = catalog.events
    // Recognition has its own lane above. Milestone cards carry a `requiredFlag`
    // that the club has by definition once earned, so without this they would
    // also sit in the random deck and could be drawn out of queue order.
    .filter((event) => !isCareerMilestoneEventId(event.id))
    // Authored chapters arrive only from their opener. Letting one sit in the
    // random deck would either re-cast its target or show part two first.
    .filter((event) => !carriedOnly.has(event.id))
    .filter((event) => eventIsEligible(state, event))
    .filter(
      (event) =>
        event.trigger.repeatable === true ||
        !state.resolvedEventIds.includes(event.id),
    )
    .sort((left, right) => left.id.localeCompare(right.id));
  if (candidates.length === 0) {
    return {
      eventClock: {
        ...state.eventClock,
        weeksWithoutEvent: state.eventClock.weeksWithoutEvent + 1,
      },
    };
  }

  const weights = candidates.map((event) => RARITY_WEIGHT[event.rarity]);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const roll = deterministicCareerEventRoll(
    eventRollContext(state),
    '__event_catalog__',
    1,
    total,
  );
  let cumulative = 0;
  const index = weights.findIndex((weight) => {
    cumulative += weight;
    return roll < cumulative;
  });
  const selected = candidates[index];
  if (selected === undefined)
    throw new Error('event catalog selection did not resolve');

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
  return reconcilePendingCareerEvent(state, catalog);
}

export function eventIsEligible(
  state: GameState,
  event: EventCatalog['events'][number],
): boolean {
  const trigger = event.trigger;
  // Authored season is the first eligible season. Unseen one-shot stories stay
  // in the deck in later years instead of silently expiring after Year 1/2.
  const division = state.m2 === undefined ? 5 : currentUserDivision(state.m2);
  return (
    state.season >= trigger.season &&
    state.week >= trigger.minWeek &&
    state.week <= trigger.maxWeek &&
    (trigger.requiredFlag === undefined ||
      state.eventFlags.includes(trigger.requiredFlag)) &&
    (trigger.minDivision === undefined || division >= trigger.minDivision) &&
    (trigger.maxDivision === undefined || division <= trigger.maxDivision) &&
    careerEventHasLegalTarget(state, event) &&
    requirementsMet(state, trigger)
  );
}

export function eventChoiceUnavailableReason(
  state: GameState,
  choice: EventCatalog['events'][number]['choices'][number],
  t: CopyFn = englishCopy(),
): string | undefined {
  const requirements = choice.requires;
  const requirementReason =
    requirements === undefined
      ? undefined
      : requirementFailure(state, requirements, t);
  if (requirementReason !== undefined) return requirementReason;

  const sale = choice.outcomes
    .flatMap((outcome) => outcome.effects)
    .find((effect) => effect.type === 'playerSale');
  const playerId = state.pendingEvent?.selectedPlayerId;
  if (sale?.type !== 'playerSale' || playerId === undefined) return undefined;
  const player = state.players.find((candidate) => candidate.id === playerId);
  const blocker = careerEventPlayerSaleBlocker(state, playerId, sale.fee);
  if (blocker === 'squad-cover' && player !== undefined) {
    return t('storyEvent.requiresSaleCover', { player: player.name });
  }
  if (blocker === 'no-buyer') {
    return t('storyEvent.requiresSaleBuyer', {
      amount: formatMoneyForCopy(t, sale.fee),
    });
  }
  if (blocker !== undefined) {
    return t('storyEvent.saleUnavailable');
  }
  return undefined;
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
  t: CopyFn = englishCopy(),
): string | undefined {
  const club = state.clubs.find(
    (candidate) => candidate.id === state.userClubId,
  );
  if (
    requirements.minMoney !== undefined &&
    (club?.cash ?? 0) < requirements.minMoney
  ) {
    return t('storyEvent.requiresCash', {
      amount: formatMoneyForCopy(t, requirements.minMoney),
    });
  }
  if (requirements.requiredFacility !== undefined) {
    const legacyTrainingPitch =
      requirements.requiredFacility === 'training-pitch' &&
      state.facilities.trainingGroundBuilt;
    const grid = state.facilities.grid;
    /**
     * Built means finished, not started.
     *
     * A `BUILD` project's building already exists in the grid at level 1 while
     * the scaffolding is up — it pays no upkeep and grants no benefit until it
     * is operational. Testing only for existence let a story about the pitch
     * fire at a pitch nobody could train on yet.
     */
    const built =
      legacyTrainingPitch ||
      grid?.buildings.some(
        (building) =>
          building.type === requirements.requiredFacility &&
          isFacilityOperational(grid, building.id),
      );
    if (!built) {
      // The raw id used to be dashed-into-words here, so a translated sentence
      // asked a German manager for a "training pitch". The building already has
      // a name in six languages under `facility.name.*`.
      return t('storyEvent.requiresFacility', {
        facility: facilityNameFromId(t, requirements.requiredFacility),
      });
    }
  }
  const roster = state.players.filter(
    (player) => player.clubId === state.userClubId,
  );
  if (
    requirements.requiredPersonality !== undefined &&
    !roster.some(
      (player) => player.personality === requirements.requiredPersonality,
    )
  ) {
    return t('storyEvent.requiresPersonality', {
      personality: personalityName(t, requirements.requiredPersonality),
    });
  }
  if (
    requirements.requiresHero === true &&
    !roster.some((player) => player.power !== undefined)
  ) {
    return t('storyEvent.requiresHero');
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
