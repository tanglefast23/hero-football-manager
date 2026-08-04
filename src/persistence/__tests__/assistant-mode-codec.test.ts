import { createLaunchCareerSetup } from '../../application/launch';
import { createCareer } from '../../game/career';
import { assistantTeaches } from '../../game/assistant-guide';
import { parseStoredGameState, serializeGameState } from '../game-state-codec';

describe('assistant mode codec', () => {
  test('defaults a save that never chose to being taught', () => {
    const state = createCareer(createLaunchCareerSetup(20260804));
    expect(state.assistantMode).toBeUndefined();

    const restored = parseStoredGameState(serializeGameState(state));
    expect(restored.assistantMode).toBeUndefined();
    expect(assistantTeaches(restored)).toBe(true);
  });

  test('round-trips an advised career', () => {
    const state = {
      ...createCareer(createLaunchCareerSetup(20260804)),
      assistantMode: 'advisor' as const,
    };

    const restored = parseStoredGameState(serializeGameState(state));
    expect(restored.assistantMode).toBe('advisor');
    expect(assistantTeaches(restored)).toBe(false);
  });
});
