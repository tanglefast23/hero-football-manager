import type { Attrs, PowerId } from '../sim/types';
import type { GameState } from './types';

const POWER_IDS: ReadonlySet<PowerId> = new Set([
  'SUPER_SPEED',
  'SUPER_STRENGTH',
  'FIRE_TORCH',
]);

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
  if (values.some(value => !Number.isSafeInteger(value) || value < 1 || value > 99)) {
    throw new Error('awakening attributes must be integers from 1 to 99');
  }
  if (powerId === 'SUPER_SPEED') return 10 + attrs.pac * 3 + attrs.tec + attrs.pas;
  if (powerId === 'SUPER_STRENGTH') return 10 + attrs.def * 2 + attrs.sta * 2 + attrs.pac;
  return 10 + attrs.sho * 3 + attrs.tec + attrs.pas;
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
): GameState {
  if (state.pendingEvent === undefined) throw new Error('there is no pending event');
  if (state.pendingEvent.resolvedChoiceId !== undefined) {
    throw new Error('the event outcome has already resolved');
  }
  if (choiceId.trim().length === 0 || outcomeText.trim().length === 0) {
    throw new Error('resolved event choice and outcome text must be non-empty');
  }

  const moneyDelta = safeDelta(application.moneyDelta ?? 0, 'event money');
  const trainingPointDelta = safeDelta(application.trainingPointDelta ?? 0, 'event TP');
  const fanDelta = safeDelta(application.fanDelta ?? 0, 'event fans');
  const club = state.clubs.find(candidate => candidate.id === state.userClubId);
  if (club === undefined) throw new Error(`unknown user club ${state.userClubId}`);

  const cash = safeAdd(club.cash, moneyDelta, 'event cash balance');
  const trainingPoints = safeAdd(state.trainingPoints, trainingPointDelta, 'event TP balance');
  const fans = safeAdd(club.fans, fanDelta, 'event fan balance');
  if (trainingPoints < 0 || fans < 0) throw new Error('event effects cannot make TP or fans negative');

  const flags = [...state.eventFlags];
  for (const flag of application.flags ?? []) {
    if (typeof flag !== 'string' || flag.trim().length === 0) {
      throw new Error('event flags must be non-empty strings');
    }
    if (!flags.includes(flag)) flags.push(flag);
  }

  return {
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
    },
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
        Math.min(99, safeAdd(attrs[effect.attribute], delta, 'event attribute')),
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
