import {
  assistantTeaches,
  hasAssistantGuideSequenceCompleted,
} from './assistant-guide';
import { currentUserDivision } from './m2-career';
import { midseasonTrainingGainForDivision } from './midseason-training';
import { highestDivisionReached } from './promotion-progression';
import { individualTrainingUsedFlag } from './training';
import type { GameState } from './types';

/**
 * The head coach's motivational speech.
 *
 * Bought on the Staff board with every training point the club holds, banked
 * one at a time, and spent at half time for a flat lift to every attribute in
 * the squad — on the pitch and on the bench — for the second half only. The
 * lift itself lives in the match engine as a recorded input; this module owns
 * who may buy one, what it costs, and how big it is.
 */

/** The week Bert explains it, and so the earliest the button may appear. */
export const COACH_SPEECH_UNLOCK_WEEK = 2;

export type CoachSpeechBlockedReason =
  | 'ALREADY_BANKED'
  | 'NO_HEAD_COACH'
  | 'TRAINING_USED_THIS_WEEK'
  | 'NOT_ENOUGH_TP';

export interface CoachSpeechOffer {
  /** Every training point the club holds — the whole price, by design. */
  readonly trainingPointsCost: number;
  readonly banked: boolean;
  /** What the second half is worth here, so the board can say it out loud. */
  readonly boost: number;
  readonly blockedReason?: CoachSpeechBlockedReason;
}

export function coachSpeechUsedFlag(season: number, week: number): string {
  return `coach-speech:season-${season}:week-${week}:used`;
}

/**
 * Whether the Staff board shows the button at all.
 *
 * Two deliberate choices. The division test is the HIGHEST ever reached, not
 * the current one, so relegation does not repossess a feature the club earned.
 * And the week only gates the FIRST sight of it — Bert delivers the lesson in
 * week 2, and the control must not arrive before its explanation. A bare
 * `week >= 2` would instead hide the button in week 1 of every later season,
 * while the half-time prompt for an already-banked speech still fired.
 */
export function coachSpeechUnlocked(state: GameState): boolean {
  if (highestDivisionReached(state) > 3) return false;
  return state.week >= COACH_SPEECH_UNLOCK_WEEK || coachSpeechIntroduced(state);
}

/**
 * Whether the lesson is behind us. An advisor-mode career never completes a
 * briefing, so it counts as introduced — the alternative locks that career out
 * of week 1 forever.
 */
function coachSpeechIntroduced(state: GameState): boolean {
  return (
    !assistantTeaches(state) ||
    hasAssistantGuideSequenceCompleted(state, 'coach-speech')
  );
}

export function hasHeadCoach(state: GameState): boolean {
  return state.market?.headCoach !== undefined;
}

/**
 * The second-half lift, by the division the club is in RIGHT NOW: twice the
 * Week 19 midseason training gain (`GAIN_BY_DIVISION` — D3 +3, D2 +4, D1 +5),
 * so D3 +6, D2 +8, D1 +10. Owner decision of 2026-08-16.
 *
 * Note this is NOT the paid Green Bull trip's own gain, which is the flat
 * `GREEN_BULL_TRAINING_GAIN = 2`; the two constants are easy to confuse.
 */
export function coachSpeechBoost(state: GameState): number {
  const division = state.m2 === undefined ? 5 : currentUserDivision(state.m2);
  return 2 * midseasonTrainingGainForDivision(division);
}

/**
 * Whether any training point has already been spent this week.
 *
 * The speech has to be the week's first spend, so this covers both spenders:
 * an instant drill and a speech already bought. It deliberately does NOT reuse
 * the drill's own flag as a general marker — that flag's player-facing copy
 * says individual training was used, and the Green Bull desk would then give
 * the manager a false reason for being shut.
 */
function trainingPointsSpentThisWeek(state: GameState): boolean {
  return (
    state.eventFlags.includes(
      individualTrainingUsedFlag(state.season, state.week),
    ) ||
    state.eventFlags.includes(coachSpeechUsedFlag(state.season, state.week))
  );
}

export function coachSpeechOffer(
  state: GameState,
): CoachSpeechOffer | undefined {
  if (!coachSpeechUnlocked(state)) return undefined;
  return {
    trainingPointsCost: state.trainingPoints,
    banked: state.coachSpeechBanked === true,
    boost: coachSpeechBoost(state),
    ...(state.coachSpeechBanked === true
      ? { blockedReason: 'ALREADY_BANKED' as const }
      : !hasHeadCoach(state)
        ? { blockedReason: 'NO_HEAD_COACH' as const }
        : trainingPointsSpentThisWeek(state)
          ? { blockedReason: 'TRAINING_USED_THIS_WEEK' as const }
          : state.trainingPoints <= 0
            ? { blockedReason: 'NOT_ENOUGH_TP' as const }
            : {}),
  };
}

/** Pays every training point held and banks the one speech. Blocked is a no-op. */
export function buyCoachSpeech(state: GameState): GameState {
  const offer = coachSpeechOffer(state);
  if (offer === undefined || offer.blockedReason !== undefined) return state;
  return {
    ...state,
    trainingPoints: 0,
    coachSpeechBanked: true,
    eventFlags: [
      ...state.eventFlags,
      coachSpeechUsedFlag(state.season, state.week),
    ],
  };
}

/**
 * Empties the bank after a match that used it.
 *
 * Called from the settled watched match, off the recorded input log rather
 * than from a live callback, so the bank and the saved replay can never
 * disagree about whether the speech was given.
 */
export function spendCoachSpeech(state: GameState): GameState {
  if (state.coachSpeechBanked !== true) return state;
  return { ...state, coachSpeechBanked: false };
}
