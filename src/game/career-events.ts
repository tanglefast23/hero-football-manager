import type { Attrs, PowerId } from '../sim/types';
import type { GameState } from './types';
import { LAUNCH_POWER_IDS } from './power-catalog';

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
  if (values.some(value => !Number.isSafeInteger(value) || value < 1 || value > 99)) {
    throw new Error('awakening attributes must be integers from 1 to 99');
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
