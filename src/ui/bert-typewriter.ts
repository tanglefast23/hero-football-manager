/** Short Bert lines use a familiar, readable typewriter rhythm. */
export const BERT_REGULAR_TYPEWRITER_STEP_MS = 30;
/** Messages at or below this length keep the regular rhythm. */
export const BERT_SHORT_MESSAGE_MAX_CHARS = 45;
/** Faster than this produces no useful extra visual steps on the target UI. */
export const BERT_FASTEST_TYPEWRITER_STEP_MS = 10;

/** Each character beyond the short-message band trims this much from the delay. */
const ACCELERATION_MS_PER_EXTRA_CHARACTER = 0.15;

/**
 * Delay between visible characters in one of Bert's speech bubbles.
 *
 * Short remarks keep the ordinary cadence. Longer explanations progressively
 * accelerate so the player still sees Bert talking without waiting through a
 * paragraph at one fixed speed.
 */
export function bertTypewriterStepMs(message: string): number {
  const characterCount = Array.from(message).length;
  const extraCharacters = Math.max(0, characterCount - BERT_SHORT_MESSAGE_MAX_CHARS);
  return Math.max(
    BERT_FASTEST_TYPEWRITER_STEP_MS,
    BERT_REGULAR_TYPEWRITER_STEP_MS
      - extraCharacters * ACCELERATION_MS_PER_EXTRA_CHARACTER,
  );
}
