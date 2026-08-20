import { createLaunchCareerSetup } from '../../application/launch';
import { createCareer } from '../../game/career';
import type { GameState } from '../../game/types';
import { parseStoredGameState, serializeGameState } from '../game-state-codec';

const career = (): GameState => createCareer(createLaunchCareerSetup(20260820));

describe('the club kit survives a save', () => {
  it('comes back exactly as it was chosen', () => {
    const kit = { base: 'FOREST', pattern: 'STRIPES', patternColor: 'STONE' };
    const restored = parseStoredGameState(
      serializeGameState({ ...career(), clubKit: kit }),
    );
    expect(restored.clubKit).toEqual(kit);
  });

  /**
   * The field is optional so a save written before clubs could pick a kit still
   * loads. It shows the stock strip, which is what it always showed.
   */
  it('loads a save written before kits existed', () => {
    const restored = parseStoredGameState(serializeGameState(career()));
    expect(restored.clubKit).toBeUndefined();
  });

  /**
   * Ids are validated as strings, not as an enum, on purpose. A save naming a
   * swatch this build does not ship must still open — `clubKitPlan` falls back
   * to the stock strip. A save that will not load is worse than a shirt in the
   * wrong colour.
   */
  it('opens a save naming a swatch this build has never heard of', () => {
    const restored = parseStoredGameState(
      serializeGameState({
        ...career(),
        clubKit: { base: 'TEAL', pattern: 'TARTAN', patternColor: 'TEAL' },
      }),
    );
    expect(restored.clubKit?.base).toBe('TEAL');
  });
});
