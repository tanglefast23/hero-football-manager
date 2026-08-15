import type { EventCatalog } from '../content';
import { copyFor, type CopyFn } from '../i18n';
import {
  applyCareerEventOutcome,
  applyCareerFacilityFire,
  applyCareerTransferFeeAdjustment,
  attributeAffectsPlay,
  applyCoachEventEffect,
  applyFacilityEventEffect,
  completeCareerEventPlayerSale,
  deterministicCareerEventRoll,
  dismissCareerEvent,
  drainPendingMilestone,
  isCareerMilestoneEventId,
  offerCareerEvent,
  sessionAttributeDelta,
  careerEventCashLoss,
  type GameState,
} from '../game';
import { eventChoiceUnavailableReason } from './event-selection';
import {
  careerEventTargetCandidates,
  careerEventTargetKind,
  pendingCareerEventTargetIsLegal,
  reconcilePendingCareerEvent,
  type CareerEventCoachRole,
} from './career-event-targets';

let englishCopyFn: CopyFn | undefined;
function englishCopy(): CopyFn {
  return (englishCopyFn ??= copyFor('en'));
}

export class InvalidCareerEventTargetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidCareerEventTargetError';
  }
}

/** The production outcome path shared by the store and both QA harnesses. */
export function resolveCareerEventChoice(
  state: GameState,
  catalog: EventCatalog,
  choiceId: string,
  t: CopyFn = englishCopy(),
): GameState {
  const pending = state.pendingEvent;
  if (pending === undefined) throw new Error('there is no active event');
  const event = catalog.events.find(
    (candidate) => candidate.id === pending.eventId,
  );
  if (event === undefined) throw new Error(`unknown event ${pending.eventId}`);
  const choice = event.choices.find((candidate) => candidate.id === choiceId);
  if (choice === undefined) throw new Error(`unknown event choice ${choiceId}`);
  if (!pendingCareerEventTargetIsLegal(state, event)) {
    const kind = careerEventTargetKind(event);
    throw new InvalidCareerEventTargetError(
      kind === 'none'
        ? 'the event target is invalid'
        : `choose an eligible ${kind} before resolving this event`,
    );
  }
  const unavailableReason = eventChoiceUnavailableReason(state, choice, t);
  if (unavailableReason !== undefined) throw new Error(unavailableReason);

  const total = choice.outcomes.reduce(
    (sum, candidate) => sum + candidate.weight,
    0,
  );
  const outcomeIndex = weightedIndex(
    choice.outcomes.map((candidate) => candidate.weight),
    careerEventRoll(state, choiceId, 0, total),
  );
  const outcome = choice.outcomes[outcomeIndex];
  if (outcome === undefined)
    throw new Error('the event outcome did not resolve');

  let working = state;
  if (choice.risky) {
    if (working.eventClock.riskyChoices === Number.MAX_SAFE_INTEGER) {
      throw new Error('event risk counter exceeds the safe integer range');
    }
    working = {
      ...working,
      eventClock: {
        ...working.eventClock,
        riskyChoices: working.eventClock.riskyChoices + 1,
      },
    };
  }

  const playerId = pending.selectedPlayerId;
  const morale = outcome.effects.find((effect) => effect.type === 'morale');
  const squadMorale = outcome.effects.find(
    (effect) => effect.type === 'squadMorale',
  );
  const injury = outcome.effects.find((effect) => effect.type === 'injury');
  const absence = outcome.effects.find((effect) => effect.type === 'absence');
  const injuryHeal = outcome.effects.find(
    (effect) => effect.type === 'injuryDelta',
  );
  const stat = outcome.effects.find((effect) => effect.type === 'statDelta');
  const statSessions = outcome.effects.filter(
    (effect) => effect.type === 'statDeltaSessions',
  );
  const loyalty = outcome.effects.find((effect) => effect.type === 'loyalty');
  const condition = outcome.effects.find(
    (effect) => effect.type === 'condition',
  );
  const fame = outcome.effects.find((effect) => effect.type === 'fame');
  const playerSale = outcome.effects.find(
    (effect) => effect.type === 'playerSale',
  );
  const facilityFire = outcome.effects.find(
    (effect) => effect.type === 'facilityFire',
  );
  const transferFee = outcome.effects.find(
    (effect) => effect.type === 'transferFeePercent',
  );
  const coachBoosts = outcome.effects.filter(
    (effect) => effect.type === 'coachBoost',
  );
  const coachSpecialty = outcome.effects.find(
    (effect) => effect.type === 'coachSpecialty',
  );
  const coachRole = pending.selectedCoachRole;
  const facilityId = pending.selectedFacilityId;
  const flags = outcome.effects.flatMap((effect) =>
    effect.type === 'flag' && effect.value ? [effect.flag] : [],
  );
  const hasPlayerEffect =
    playerId !== undefined &&
    Boolean(
      morale ||
      injury ||
      absence ||
      injuryHeal ||
      stat ||
      statSessions.length > 0 ||
      loyalty ||
      condition ||
      fame,
    );
  const selectedPlayer = working.players.find(
    (candidate) => candidate.id === playerId,
  );
  const attributeDeltas = statSessions.reduce<
    Partial<Record<keyof NonNullable<typeof selectedPlayer>['attrs'], number>>
  >((deltas, effect) => {
    if (selectedPlayer === undefined) return deltas;
    deltas[effect.attribute] =
      (deltas[effect.attribute] ?? 0) +
      sessionAttributeDelta(
        working,
        selectedPlayer,
        effect.attribute,
        effect.sessions,
      );
    return deltas;
  }, {});
  if (stat?.type === 'statDelta') {
    attributeDeltas[stat.attribute] =
      (attributeDeltas[stat.attribute] ?? 0) + stat.amount;
  }
  const returnTraining = (() => {
    if (
      absence?.type !== 'absence' ||
      absence.returnTraining === undefined ||
      selectedPlayer === undefined
    )
      return undefined;
    const attribute =
      absence.returnTraining.attribute === 'WEAKEST'
        ? (
            Object.keys(
              selectedPlayer.attrs,
            ) as (keyof typeof selectedPlayer.attrs)[]
          )
            .filter((candidate) =>
              attributeAffectsPlay(selectedPlayer.role, candidate),
            )
            .sort(
              (left, right) =>
                selectedPlayer.attrs[left] - selectedPlayer.attrs[right] ||
                (left < right ? -1 : left > right ? 1 : 0),
            )[0]
        : absence.returnTraining.attribute;
    if (attribute === undefined) return undefined;
    return {
      attribute,
      points: sessionAttributeDelta(
        working,
        selectedPlayer,
        attribute,
        absence.returnTraining.sessions,
      ),
    };
  })();

  let next = applyCareerEventOutcome(
    working,
    choice.id,
    outcome.text,
    {
      moneyDelta:
        sumEffect(outcome.effects, 'money') -
        outcome.effects.reduce(
          (sum, effect) =>
            effect.type === 'cashLossPercent'
              ? sum + careerEventCashLoss(working, effect.percent)
              : sum,
          0,
        ),
      trainingPointDelta: sumEffect(outcome.effects, 'tp'),
      fanDelta: sumEffect(outcome.effects, 'fans'),
      flags,
      ...(hasPlayerEffect
        ? {
            playerEffect: {
              playerId: playerId!,
              ...(morale?.type === 'morale'
                ? { moraleDelta: morale.amount }
                : {}),
              ...(injury?.type === 'injury'
                ? { injuryWeeks: injury.weeks }
                : {}),
              ...(absence?.type === 'absence'
                ? {
                    awayWeeks: absence.weeks,
                    ...(returnTraining === undefined ? {} : { returnTraining }),
                  }
                : {}),
              ...(injuryHeal?.type === 'injuryDelta'
                ? { injuryWeeksDelta: injuryHeal.weeks }
                : {}),
              ...(Object.keys(attributeDeltas).length === 0
                ? {}
                : { attributeDeltas }),
              ...(loyalty?.type === 'loyalty'
                ? { loyaltyDelta: loyalty.amount }
                : {}),
              ...(condition?.type === 'condition'
                ? { conditionDelta: condition.amount }
                : {}),
              ...(fame?.type === 'fame' ? { fameDelta: fame.amount } : {}),
            },
          }
        : {}),
    },
    {
      outcomeIndex,
      risky: choice.risky,
      success: choice.risky && outcomeIndex === 0,
      ...(outcome.nextEventId === undefined
        ? {}
        : { nextEventId: outcome.nextEventId }),
    },
  );

  if (facilityId !== undefined) {
    const facets = {
      facilityTpBonus: 'tpBonusPercent',
      facilityTrainingBonus: 'trainingBonusPercent',
      facilityRecoveryBonus: 'recoveryBonus',
      facilityIncomeBonus: 'incomeBonusPercent',
    } as const;
    for (const effect of outcome.effects) {
      const facet = facets[effect.type as keyof typeof facets];
      if (facet === undefined) continue;
      const amount =
        'percent' in effect
          ? effect.percent
          : 'amount' in effect
            ? effect.amount
            : 0;
      next = applyFacilityEventEffect(next, facilityId, facet, amount);
    }
  }
  if (coachRole !== undefined) {
    for (const boost of coachBoosts) {
      next = applyCoachEventEffect(next, coachRole, {
        facet: boost.facet,
        amount: boost.amount,
      });
    }
    if (coachSpecialty?.type === 'coachSpecialty') {
      next = applyCoachEventEffect(next, coachRole, {
        specialtyTo: coachSpecialty.to,
      });
    }
  }
  if (squadMorale?.type === 'squadMorale') {
    next = {
      ...next,
      players: next.players.map((player) =>
        player.clubId === next.userClubId
          ? {
              ...player,
              morale: Math.max(
                0,
                Math.min(100, player.morale + squadMorale.amount),
              ),
            }
          : player,
      ),
    };
  }
  if (playerSale?.type === 'playerSale') {
    next = completeCareerEventPlayerSale(next, playerId!, playerSale.fee);
  }
  if (transferFee?.type === 'transferFeePercent') {
    next = applyCareerTransferFeeAdjustment(
      next,
      playerId!,
      transferFee.percent,
    );
  }
  if (facilityFire?.type === 'facilityFire') {
    next = applyCareerFacilityFire(next, facilityFire.mode);
  }

  const milestone = isCareerMilestoneEventId(pending.eventId);
  const drained = milestone
    ? drainPendingMilestone(next, pending.eventId)
    : next;
  return milestone
    ? drained
    : {
        ...drained,
        eventClock: { ...drained.eventClock, weeksWithoutEvent: 0 },
      };
}

export interface CareerEventContinuation {
  readonly state: GameState;
  readonly followed: boolean;
}

/** Dismisses a result and, when valid, opens its authored next chapter. */
export function continueResolvedCareerEvent(
  state: GameState,
  catalog: EventCatalog,
): CareerEventContinuation {
  const pending = state.pendingEvent;
  if (pending?.resolvedChoiceId === undefined)
    throw new Error('resolve the event before continuing');
  const event = catalog.events.find(
    (candidate) => candidate.id === pending.eventId,
  );
  const dismissed = dismissCareerEvent(
    state,
    event?.trigger.repeatable !== true,
  );
  if (pending.resolvedNextEventId === undefined)
    return { state: dismissed, followed: false };
  const followUp = catalog.events.find(
    (candidate) => candidate.id === pending.resolvedNextEventId,
  );
  if (
    followUp === undefined ||
    (followUp.trigger.repeatable !== true &&
      dismissed.resolvedEventIds.includes(followUp.id))
  ) {
    return { state: dismissed, followed: false };
  }

  const kind = careerEventTargetKind(followUp);
  const candidates = careerEventTargetCandidates(dismissed, followUp);
  let carried:
    | {
        playerId?: string;
        coachRole?: CareerEventCoachRole;
        facilityId?: string;
      }
    | undefined;
  if (kind === 'player') {
    if (
      pending.selectedPlayerId === undefined ||
      !candidates.playerIds.includes(pending.selectedPlayerId)
    )
      return { state: dismissed, followed: false };
    carried = { playerId: pending.selectedPlayerId };
  } else if (kind === 'coach') {
    if (
      pending.selectedCoachRole === undefined ||
      !candidates.coachRoles.includes(pending.selectedCoachRole)
    )
      return { state: dismissed, followed: false };
    carried = { coachRole: pending.selectedCoachRole };
  } else if (kind === 'facility') {
    if (
      pending.selectedFacilityId === undefined ||
      !candidates.facilityIds.includes(pending.selectedFacilityId)
    )
      return { state: dismissed, followed: false };
    carried = { facilityId: pending.selectedFacilityId };
  }

  const offered = offerCareerEvent(dismissed, followUp.id, carried);
  const reconciled = reconcilePendingCareerEvent(offered, catalog);
  return {
    state: reconciled,
    followed: reconciled.pendingEvent?.eventId === followUp.id,
  };
}

function sumEffect(
  effects: EventCatalog['events'][number]['choices'][number]['outcomes'][number]['effects'],
  type: 'money' | 'tp' | 'fans',
): number {
  return effects.reduce(
    (sum, effect) => (effect.type === type ? sum + effect.amount : sum),
    0,
  );
}

function weightedIndex(weights: readonly number[], roll: number): number {
  let cumulative = 0;
  for (let index = 0; index < weights.length; index += 1) {
    cumulative += weights[index];
    if (roll < cumulative) return index;
  }
  throw new Error('weighted event outcome did not resolve');
}

function careerEventRoll(
  state: GameState,
  choiceId: string,
  stream: number,
  upperExclusive: number,
): number {
  return deterministicCareerEventRoll(
    {
      careerSeed: state.careerSeed,
      season: state.season,
      week: state.week,
      riskyChoices: state.eventClock.riskyChoices,
    },
    choiceId,
    stream,
    upperExclusive,
  );
}
