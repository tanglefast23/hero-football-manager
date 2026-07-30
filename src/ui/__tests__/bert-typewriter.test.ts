import {
  BERT_FASTEST_TYPEWRITER_STEP_MS,
  BERT_REGULAR_TYPEWRITER_STEP_MS,
  BERT_SHORT_MESSAGE_MAX_CHARS,
  bertTypewriterStepMs,
} from '../bert-typewriter';

describe('Bert typewriter timing', () => {
  it('uses a regular typewriter pace for short messages', () => {
    expect(bertTypewriterStepMs('A quick word.')).toBe(BERT_REGULAR_TYPEWRITER_STEP_MS);
    expect(bertTypewriterStepMs('x'.repeat(BERT_SHORT_MESSAGE_MAX_CHARS)))
      .toBe(BERT_REGULAR_TYPEWRITER_STEP_MS);
  });

  it('progressively types faster as messages get longer', () => {
    const justOverShort = bertTypewriterStepMs('x'.repeat(BERT_SHORT_MESSAGE_MAX_CHARS + 1));
    const medium = bertTypewriterStepMs('x'.repeat(100));
    const long = bertTypewriterStepMs('x'.repeat(150));

    expect(justOverShort).toBeLessThan(BERT_REGULAR_TYPEWRITER_STEP_MS);
    expect(medium).toBeLessThan(justOverShort);
    expect(long).toBeLessThan(medium);
  });

  it('caps very long messages at a readable scheduler floor', () => {
    expect(bertTypewriterStepMs('x'.repeat(1_000))).toBe(BERT_FASTEST_TYPEWRITER_STEP_MS);
  });
});
