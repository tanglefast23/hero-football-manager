import {
  RIVAL_HERO_INTRO_HERO_IDS,
  rivalHeroIntroFlag,
  type GameState,
} from '../../game';

/**
 * Older integration fixtures that start behind Match Day's story layer use
 * this explicit opt-out. The production selector stays active everywhere, and
 * dedicated rival-intro tests exercise it without this helper.
 */
export function withRivalHeroIntrosSeen(state: GameState): GameState {
  const flags = new Set(state.eventFlags);
  RIVAL_HERO_INTRO_HERO_IDS.forEach((heroId) =>
    flags.add(rivalHeroIntroFlag(heroId)),
  );
  return { ...state, eventFlags: [...flags] };
}
