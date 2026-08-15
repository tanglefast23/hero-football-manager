import type { EventCatalog, GameEvent } from '../content';
import {
  compareIds,
  deterministicCareerEventRoll,
  drainPendingMilestone,
  isCareerMilestoneEventId,
  isFacilityOperational,
  careerTransferTarget,
  type CareerPlayer,
  type GameState,
} from '../game';

export type CareerEventCoachRole = 'HEAD' | 'ASSISTANT';
export type CareerEventTargetKind = 'player' | 'coach' | 'facility' | 'none';

export interface CareerEventTargetCandidates {
  readonly playerIds: readonly string[];
  readonly coachRoles: readonly CareerEventCoachRole[];
  readonly facilityIds: readonly string[];
}

/** The real player records behind the event's authored source. */
export function careerEventTargetPlayers(
  state: GameState,
  event: GameEvent,
): CareerPlayer[] {
  if (event.trigger.requiresPlayer !== true) return [];
  const source = event.trigger.requiresPlayerSource;
  const players =
    source === 'YOUTH_OFFERS'
      ? state.youthIntake?.status === 'OPEN'
        ? state.youthIntake.offers.map((offer) => offer.player)
        : []
      : source === 'TRANSFER_TARGETS'
        ? (state.market?.scoutReports ?? []).flatMap((report) => {
            const target = careerTransferTarget(state, report.playerId);
            return target === undefined ? [] : [target.player];
          })
        : state.players.filter((player) => player.clubId === state.userClubId);
  const eligible = players.filter(
    (player) =>
      (event.trigger.requiresPlayerRole === undefined ||
        player.role === event.trigger.requiresPlayerRole) &&
      (event.trigger.requiresPlayerRoles === undefined ||
        event.trigger.requiresPlayerRoles.includes(player.role)) &&
      (event.trigger.minPlayerAge === undefined ||
        (player.age ?? 0) >= event.trigger.minPlayerAge) &&
      (event.trigger.maxPlayerAge === undefined ||
        (player.age ?? Number.MAX_SAFE_INTEGER) <=
          event.trigger.maxPlayerAge) &&
      // A story that stands the hero opposite the chosen player cannot be
      // handed the hero as that player. Only these stories opt in, so every
      // other card still offers the whole squad.
      (event.trigger.excludesHeroes !== true || player.power === undefined),
  );
  if (event.trigger.autoSelectPlayer === undefined) return eligible;
  const rank = (player: CareerPlayer): number => {
    if (event.trigger.autoSelectPlayer === 'FASTEST') return player.attrs.pac;
    if (event.trigger.autoSelectPlayer === 'YOUNGEST')
      return -(player.age ?? Number.MAX_SAFE_INTEGER);
    return player.fame ?? 0;
  };
  const best = Math.max(...eligible.map(rank));
  return eligible.filter((player) => rank(player) === best);
}

/** Picks one objective leader reproducibly when several players share the lead. */
function automaticCareerEventPlayerId(
  state: GameState,
  event: GameEvent,
): string | undefined {
  if (event.trigger.autoSelectPlayer === undefined) return undefined;
  const candidates = careerEventTargetPlayers(state, event).sort(
    (left, right) => compareIds(left.id, right.id),
  );
  if (candidates.length === 0) return undefined;
  const index = deterministicCareerEventRoll(
    {
      careerSeed: state.careerSeed,
      season: state.season,
      week: state.week,
      riskyChoices: state.eventClock.riskyChoices,
    },
    `auto-target:${event.id}`,
    0,
    candidates.length,
  );
  return candidates[index]?.id;
}

/** The one target shape an authored story asks the manager to choose. */
export function careerEventTargetKind(event: GameEvent): CareerEventTargetKind {
  if (event.trigger.requiresPlayer === true) return 'player';
  if (event.trigger.requiresCoach === true) return 'coach';
  if (event.trigger.requiresFacility !== undefined) return 'facility';
  return 'none';
}

/**
 * The single candidate authority for offers, pickers, resolution, saves, and QA.
 * Nothing here consumes randomness or depends on React Native.
 */
export function careerEventTargetCandidates(
  state: GameState,
  event: GameEvent,
): CareerEventTargetCandidates {
  const playerIds =
    event.trigger.requiresPlayer === true
      ? careerEventTargetPlayers(state, event).map((player) => player.id)
      : [];

  const market = state.market;
  const bothCoachesPresent =
    market?.headCoach !== undefined && market.assistantCoach !== undefined;
  const specialtyTargets = new Set(
    event.choices.flatMap((choice) =>
      choice.outcomes.flatMap((outcome) =>
        outcome.effects.flatMap((effect) =>
          effect.type === 'coachSpecialty' ? [effect.to] : [],
        ),
      ),
    ),
  );
  const coachRoles =
    event.trigger.requiresCoach !== true ||
    (event.trigger.requiresBothCoaches === true && !bothCoachesPresent)
      ? []
      : (['HEAD', 'ASSISTANT'] as const).filter((role) => {
          if (
            event.trigger.requiresCoachRole !== undefined &&
            role !== event.trigger.requiresCoachRole
          )
            return false;
          const coach =
            role === 'HEAD' ? market?.headCoach : market?.assistantCoach;
          if (coach === undefined) return false;
          return [...specialtyTargets].every(
            (specialty) => !coach.specialties.includes(specialty),
          );
        });

  const requiredFacilityTypes = event.trigger.requiresFacility;
  const grid = state.facilities.grid;
  const facilityIds =
    requiredFacilityTypes === undefined || grid === undefined
      ? []
      : grid.buildings
          .filter((building) =>
            (requiredFacilityTypes as readonly string[]).includes(
              building.type,
            ),
          )
          .filter(
            (building) => grid.construction?.buildingId !== building.id,
          )
          .filter((building) => isFacilityOperational(grid, building.id))
          .map((building) => building.id);

  return { playerIds, coachRoles, facilityIds };
}

export function careerEventHasLegalTarget(
  state: GameState,
  event: GameEvent,
): boolean {
  const candidates = careerEventTargetCandidates(state, event);
  const kind = careerEventTargetKind(event);
  if (kind === 'player') return candidates.playerIds.length > 0;
  if (kind === 'coach') return candidates.coachRoles.length > 0;
  if (kind === 'facility') return candidates.facilityIds.length > 0;
  return true;
}

export function pendingCareerEventTargetIsLegal(
  state: GameState,
  event: GameEvent,
): boolean {
  const pending = state.pendingEvent;
  if (pending === undefined || pending.eventId !== event.id) return false;
  const candidates = careerEventTargetCandidates(state, event);
  const kind = careerEventTargetKind(event);
  if (kind === 'player') {
    return (
      pending.selectedPlayerId !== undefined &&
      candidates.playerIds.includes(pending.selectedPlayerId)
    );
  }
  if (kind === 'coach') {
    return (
      pending.selectedCoachRole !== undefined &&
      candidates.coachRoles.includes(pending.selectedCoachRole)
    );
  }
  if (kind === 'facility') {
    return (
      pending.selectedFacilityId !== undefined &&
      candidates.facilityIds.includes(pending.selectedFacilityId)
    );
  }
  return true;
}

/** Follow-ups are opened only by their parent; the hat-trick arrives from its queue. */
export function carriedOnlyCareerEventIds(
  catalog: EventCatalog,
): ReadonlySet<string> {
  return new Set([
    'milestone-hat-trick',
    ...catalog.events.flatMap((event) =>
      event.choices.flatMap((choice) =>
        choice.outcomes.flatMap((outcome) =>
          outcome.nextEventId === undefined ? [] : [outcome.nextEventId],
        ),
      ),
    ),
  ]);
}

/** Clears a stale or impossible card without applying effects or inventing a target. */
export function skipPendingCareerEventWithoutEffects(
  state: GameState,
): GameState {
  const pending = state.pendingEvent;
  if (pending === undefined) return state;
  const cleared = { ...state, pendingEvent: undefined };
  return isCareerMilestoneEventId(pending.eventId)
    ? drainPendingMilestone(cleared, pending.eventId)
    : cleared;
}

/**
 * Repairs a persisted pending target in a fixed order. Carried and locked cards
 * are never silently re-cast around another person or building.
 */
export function reconcilePendingCareerEvent(
  state: GameState,
  catalog: EventCatalog,
): GameState {
  const original = state.pendingEvent;
  if (original === undefined) return state;
  const event = catalog.events.find(
    (candidate) => candidate.id === original.eventId,
  );
  if (event === undefined) return skipPendingCareerEventWithoutEffects(state);

  const kind = careerEventTargetKind(event);
  const {
    selectedPlayerId,
    playerLocked,
    selectedCoachRole,
    coachLocked,
    selectedFacilityId,
    facilityLocked,
    ...common
  } = original;
  const cleaned =
    kind === 'player'
      ? {
          ...common,
          ...(selectedPlayerId === undefined ? {} : { selectedPlayerId }),
          ...(playerLocked === true ? { playerLocked: true as const } : {}),
        }
      : kind === 'coach'
        ? {
            ...common,
            ...(selectedCoachRole === undefined ? {} : { selectedCoachRole }),
            ...(coachLocked === true ? { coachLocked: true as const } : {}),
          }
        : kind === 'facility'
          ? {
              ...common,
              ...(selectedFacilityId === undefined
                ? {}
                : { selectedFacilityId }),
              ...(facilityLocked === true
                ? { facilityLocked: true as const }
                : {}),
            }
          : common;
  let next: GameState = shallowRecordEqual(original, cleaned)
    ? state
    : { ...state, pendingEvent: cleaned };

  // A resolved result remains viewable. Continuation performs the follow-up's
  // own exact-target legality check against the then-current club.
  if (cleaned.resolvedChoiceId !== undefined) return next;
  if (kind === 'none') return next;

  const automaticPlayerId = automaticCareerEventPlayerId(next, event);
  if (automaticPlayerId !== undefined) {
    return {
      ...next,
      pendingEvent: {
        ...next.pendingEvent!,
        selectedPlayerId: automaticPlayerId,
        playerLocked: true,
      },
    };
  }

  const legal = pendingCareerEventTargetIsLegal(next, event);
  const carriedOnly = carriedOnlyCareerEventIds(catalog).has(event.id);
  if (carriedOnly) {
    if (!legal) return skipPendingCareerEventWithoutEffects(next);
    const alreadyLocked =
      kind === 'player'
        ? playerLocked === true
        : kind === 'coach'
          ? coachLocked === true
          : facilityLocked === true;
    if (alreadyLocked) return next;
    next = {
      ...next,
      pendingEvent:
        kind === 'player'
          ? { ...next.pendingEvent!, playerLocked: true }
          : kind === 'coach'
            ? { ...next.pendingEvent!, coachLocked: true }
            : { ...next.pendingEvent!, facilityLocked: true },
    };
    return next;
  }

  const locked =
    kind === 'player'
      ? playerLocked === true
      : kind === 'coach'
        ? coachLocked === true
        : facilityLocked === true;
  if (locked) return legal ? next : skipPendingCareerEventWithoutEffects(next);

  const candidates = careerEventTargetCandidates(next, event);
  const candidateCount =
    kind === 'player'
      ? candidates.playerIds.length
      : kind === 'coach'
        ? candidates.coachRoles.length
        : candidates.facilityIds.length;
  if (candidateCount === 0) return skipPendingCareerEventWithoutEffects(next);
  if (legal) return next;

  return {
    ...next,
    pendingEvent:
      kind === 'player'
        ? { ...next.pendingEvent!, selectedPlayerId: undefined }
        : kind === 'coach'
          ? { ...next.pendingEvent!, selectedCoachRole: undefined }
          : { ...next.pendingEvent!, selectedFacilityId: undefined },
  };
}

function shallowRecordEqual(left: object, right: object): boolean {
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every((key) => leftRecord[key] === rightRecord[key])
  );
}

/** Guard for the defensive empty state. A valid story can never use it as Skip. */
export function skipUnavailableCareerEvent(
  state: GameState,
  catalog: EventCatalog,
): GameState {
  const pending = state.pendingEvent;
  if (pending === undefined || pending.resolvedChoiceId !== undefined) {
    throw new Error('there is no unresolved story to return from');
  }
  const event = catalog.events.find(
    (candidate) => candidate.id === pending.eventId,
  );
  if (event === undefined) return skipPendingCareerEventWithoutEffects(state);
  if (
    careerEventTargetKind(event) === 'none' ||
    careerEventHasLegalTarget(state, event)
  ) {
    throw new Error('this story still has an eligible target');
  }
  return skipPendingCareerEventWithoutEffects(state);
}
