import { createCareer, type GameState } from '../../game';
import { createLaunchCareerSetup } from '../launch';
import { celebrationCoaches } from '../celebration-staff';
import sheet from '../../render/sprites/management-sprites.json';

const COACH: Parameters<typeof withStaff>[1] = {
  id: 'candidate-head',
  name: 'Amara Okafor',
  portraitId: 'amara-okafor',
};

describe('the staff who come out for a celebration', () => {
  it('sends nobody when the club runs no staff', () => {
    expect(celebrationCoaches(bareCareer())).toEqual([]);
  });

  it('sends the head coach first, then the assistant', () => {
    const state = withStaff(bareCareer(), COACH, {
      id: 'candidate-assistant',
      name: 'Kenji Sato',
      portraitId: 'kenji-sato',
    });

    expect(celebrationCoaches(state).map((coach) => coach.name)).toEqual([
      'Amara Okafor',
      'Kenji Sato',
    ]);
  });

  it('draws them from the art their portrait is keyed by', () => {
    const [coach] = celebrationCoaches(withStaff(bareCareer(), COACH));

    expect(coach?.spriteKey).toBe('coach:amara-okafor:field-cheer');
  });

  it('names a sprite that the sheet actually ships, for every coach', () => {
    const shipped = new Set(Object.keys(sheet.sprites));
    const portraitIds = Array.from(
      new Set(
        Object.keys(sheet.sprites)
          .filter((key) => key.startsWith('coach:') && key.endsWith(':rest'))
          .map((key) => key.split(':')[1]),
      ),
    );

    expect(portraitIds).toHaveLength(32);
    for (const portraitId of portraitIds) {
      // The two the celebrations ask for by name. A coach who has a bust but no
      // standing figure would fall back to the worksite crate on the pitch.
      expect(shipped.has(`coach:${portraitId}:field`)).toBe(true);
      expect(shipped.has(`coach:${portraitId}:field-cheer`)).toBe(true);
    }
  });

  it('stands a coach taller than the players he is celebrating with', () => {
    // 34 rows against the players' 30. Rendered at one scale, the grown man
    // reads as a grown man rather than another chibi in a coat.
    expect(sheet.sprites['coach:amara-okafor:field']).toHaveLength(34);
    expect(sheet.sprites['coach:amara-okafor:rest']).toHaveLength(29);
  });

  it('falls back to the candidate id on a save written before portrait ids', () => {
    const state = withStaff(bareCareer(), { id: 'legend-p7', name: 'Old Boy' });

    expect(celebrationCoaches(state)[0]?.spriteKey).toBe(
      'coach:legend-p7:field-cheer',
    );
  });
});

function bareCareer(): GameState {
  return createCareer(createLaunchCareerSetup(777));
}

function withStaff(
  state: GameState,
  headCoach: { id: string; name: string; portraitId?: string },
  assistantCoach?: { id: string; name: string; portraitId?: string },
): GameState {
  return {
    ...state,
    market: {
      ...state.market,
      headCoach,
      ...(assistantCoach === undefined ? {} : { assistantCoach }),
    },
  } as GameState;
}
