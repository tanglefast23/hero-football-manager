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
 * one PURCHASE a week but stacked without limit, and spent one at a time at
 * half time for a flat lift to every attribute in the squad — on the pitch and
 * on the bench — for the second half only. The lift itself lives in the match
 * engine as a recorded input; this module owns who may buy one, what it costs,
 * and how big it is.
 */

/** The week Bert explains it, and so the earliest the button may appear. */
export const COACH_SPEECH_UNLOCK_WEEK = 2;

export type CoachSpeechBlockedReason =
  | 'NO_HEAD_COACH'
  | 'TRAINING_USED_THIS_WEEK'
  | 'NOT_ENOUGH_TP'
  /** Only a hand-edited save reaches this. See `BANK_CEILING`. */
  | 'BANK_FULL';

export interface CoachSpeechOffer {
  /** Every training point the club holds — the whole price, by design. */
  readonly trainingPointsCost: number;
  /** How many are already banked, for the Staff board's running tally. */
  readonly bankedCount: number;
  /** What the second half is worth here, so the board can say it out loud. */
  readonly boost: number;
  readonly blockedReason?: CoachSpeechBlockedReason;
}

/**
 * The bank is uncapped by owner decision, so this is not a game rule — it is
 * the point past which the count stops being a safe integer, which is also the
 * point `nonnegativeInteger` in the save codec stops accepting it.
 *
 * It refuses the SALE rather than clamping the count. A clamp would take every
 * training point the club holds and hand back nothing, which is a worse failure
 * than the overflow it prevents.
 */
const BANK_CEILING = Number.MAX_SAFE_INTEGER;

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

/** How many speeches the club is holding. Absent and zero are the same thing. */
export function coachSpeechesBanked(state: GameState): number {
  return state.coachSpeechesBanked ?? 0;
}

export function coachSpeechOffer(
  state: GameState,
): CoachSpeechOffer | undefined {
  if (!coachSpeechUnlocked(state)) return undefined;
  const banked = coachSpeechesBanked(state);
  return {
    trainingPointsCost: state.trainingPoints,
    bankedCount: banked,
    boost: coachSpeechBoost(state),
    // Order matters and is unchanged from when ALREADY_BANKED led it: a club
    // with no coach AND no points must still be told about the coach first.
    ...(!hasHeadCoach(state)
      ? { blockedReason: 'NO_HEAD_COACH' as const }
      : trainingPointsSpentThisWeek(state)
        ? { blockedReason: 'TRAINING_USED_THIS_WEEK' as const }
        : state.trainingPoints <= 0
          ? { blockedReason: 'NOT_ENOUGH_TP' as const }
          : banked >= BANK_CEILING
            ? { blockedReason: 'BANK_FULL' as const }
            : {}),
  };
}

/**
 * Pays every training point held and banks one more speech. Blocked is a no-op.
 *
 * The weekly flag is what holds this to one purchase a week; the bank itself
 * has no game-rule limit, so buying in consecutive weeks stacks.
 */
export function buyCoachSpeech(state: GameState): GameState {
  const offer = coachSpeechOffer(state);
  if (offer === undefined || offer.blockedReason !== undefined) return state;
  return {
    ...state,
    trainingPoints: 0,
    coachSpeechesBanked: coachSpeechesBanked(state) + 1,
    eventFlags: [
      ...state.eventFlags,
      coachSpeechUsedFlag(state.season, state.week),
    ],
  };
}

/**
 * Spends ONE speech after a match that used it, leaving the rest banked.
 *
 * Called from the settled watched match, off the recorded input log rather
 * than from a live callback, so the bank and the saved replay can never
 * disagree about whether the speech was given.
 */
export function spendCoachSpeech(state: GameState): GameState {
  const banked = coachSpeechesBanked(state);
  if (banked <= 0) return state;
  return { ...state, coachSpeechesBanked: banked - 1 };
}
