import { createLaunchCareerSetup } from '../../application/launch';
import { createCareer } from '../../game/career';
import { parseStoredGameState, serializeGameState } from '../game-state-codec';

/**
 * The half-time speech bank used to be a boolean holding at most one speech.
 * It is now a count, and every save written by the first release has to arrive
 * with its speech intact rather than quietly losing it.
 *
 * These tests go through the raw JSON rather than through `serializeGameState`,
 * because the legacy key is exactly what the current writer no longer emits.
 */
function storedCareer(overrides: Record<string, unknown>): string {
  const state = createCareer(createLaunchCareerSetup(20260816));
  return JSON.stringify({
    ...(JSON.parse(serializeGameState(state)) as Record<string, unknown>),
    ...overrides,
  });
}

describe('coach speech bank codec', () => {
  test('a legacy banked speech becomes a count of one', () => {
    const restored = parseStoredGameState(
      storedCareer({ coachSpeechBanked: true }),
    );
    expect(restored.coachSpeechesBanked).toBe(1);
    // The legacy key is gone, so the next save cannot carry both shapes.
    expect('coachSpeechBanked' in restored).toBe(false);
  });

  test('a legacy empty bank, and no bank at all, both read as none', () => {
    for (const overrides of [{ coachSpeechBanked: false }, {}]) {
      const restored = parseStoredGameState(storedCareer(overrides));
      expect(restored.coachSpeechesBanked).toBeUndefined();
      expect('coachSpeechBanked' in restored).toBe(false);
    }
  });

  test('a save carrying both shapes keeps the count', () => {
    // Only a build straddling the change writes both. The count is the field
    // that was being maintained, so it wins over the stale boolean.
    const restored = parseStoredGameState(
      storedCareer({ coachSpeechBanked: true, coachSpeechesBanked: 3 }),
    );
    expect(restored.coachSpeechesBanked).toBe(3);
    expect('coachSpeechBanked' in restored).toBe(false);
  });

  test('a stacked bank round-trips through a save', () => {
    const state = {
      ...createCareer(createLaunchCareerSetup(20260816)),
      coachSpeechesBanked: 4,
    };
    expect(
      parseStoredGameState(serializeGameState(state)).coachSpeechesBanked,
    ).toBe(4);
  });

  test('a malformed legacy value is rejected, not silently dropped', () => {
    // The normaliser runs BEFORE validation. Deleting a value it does not
    // recognise would hide the corruption the schema exists to catch, so it
    // leaves it for `z.boolean()` to refuse.
    expect(() =>
      parseStoredGameState(storedCareer({ coachSpeechBanked: 'yes' })),
    ).toThrow();
  });
});
