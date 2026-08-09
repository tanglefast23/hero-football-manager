/**
 * The game's motion vocabulary.
 *
 * A polish audit of 96f45b1f counted 37 inline `duration:` literals across 26
 * distinct values, plus 31 separately-named `*_MS` constants. Nothing was
 * wrong with any single number; the problem is that 26 of them cannot be a
 * system. Two panels that should feel like siblings open at 380ms and 420ms,
 * and the difference is small enough to be unnameable and large enough to be
 * felt — which is exactly the kind of inconsistency that reads as "unfinished"
 * without a player ever being able to say why.
 *
 * These six steps are that vocabulary. They were chosen by clustering what the
 * app already does rather than by inventing a scale, so adopting one is almost
 * always a rounding of an existing number, not a retune:
 *
 * | step     | ms  | what it is for                                        |
 * |----------|-----|-------------------------------------------------------|
 * | INSTANT  |  90 | state flips the player must not wait on: a press, a tab |
 * | QUICK    | 150 | small reveals — a chip, a tooltip, a row               |
 * | STANDARD | 220 | the default for anything entering or leaving a screen  |
 * | EMPHATIC | 420 | a beat the player is meant to watch land               |
 * | SETTLE   | 620 | a heavy arrival: a card, a takeover, a result          |
 * | STAGE    | 2200| a whole authored scene that plays itself               |
 *
 * ADOPTION IS DELIBERATE, NOT AUTOMATIC. Do not sweep existing timings into
 * these constants — several are load-bearing and tuned against something real
 * (`DRILL_SCENE_MS` is paced against its own count-up and its sound bed;
 * `POWER_JUICE_*` is an authored beat sheet; the match renderer's timings are
 * tick-derived and belong to the sim's clock, not to this table). Use these for
 * NEW motion, and migrate an old value only when it is genuinely arbitrary and
 * you have looked at what it sits next to.
 */
export const MOTION_MS = {
  INSTANT: 90,
  QUICK: 150,
  STANDARD: 220,
  EMPHATIC: 420,
  SETTLE: 620,
  STAGE: 2_200,
} as const;

export type MotionStep = keyof typeof MOTION_MS;

/**
 * Per-row delay for a list that arrives in sequence rather than all at once.
 *
 * Fast enough that a ten-row table finishes inside a third of a second, slow
 * enough that the eye reads it as an order being dealt.
 */
export const LIST_STAGGER_MS = 40;

/**
 * The stagger delay for row `index`, capped so long lists do not tail off.
 *
 * Without the cap a twenty-row squad list would still be arriving 800ms in,
 * long after the player has started reading the top of it.
 */
export function listStaggerDelay(index: number, maxRows = 8): number {
  return Math.min(index, maxRows) * LIST_STAGGER_MS;
}

/**
 * Motion honours the reader's Reduce Motion setting by collapsing, not by
 * jumping: a duration of 0 keeps every call site's shape (still a timing, still
 * an onComplete) while removing the travel.
 */
export function motionDuration(
  step: MotionStep,
  reduceMotion: boolean,
): number {
  return reduceMotion ? 0 : MOTION_MS[step];
}
