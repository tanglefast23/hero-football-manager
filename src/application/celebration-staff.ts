import type { GameState } from '../game/types';
import type { CelebrationCoachViewModel } from '../ui/models';

/**
 * The staff who come out onto the grass with the squad.
 *
 * A coach has only ever existed as a portrait in a staff list. These are the
 * same men and women drawn as standing figures (`coach:<id>:field-cheer`), so
 * the people the manager actually hired are visible in the moments the club
 * earned — not just the players who happened to be on the pitch.
 *
 * Head coach first, then the assistant: the celebrations line them up from the
 * inside out, and the senior man should be the one nearest the squad. A club
 * running no staff at all simply sends nobody, and the scenes are built to
 * stage an empty list without a gap.
 */
export function celebrationCoaches(state: GameState): readonly CelebrationCoachViewModel[] {
  return [state.market?.headCoach, state.market?.assistantCoach]
    .flatMap(coach => (coach === undefined ? [] : [{
      id: coach.id,
      name: coach.name,
      // `portraitId` is what the art is keyed by; an older save that predates it
      // falls back to the candidate id, exactly as the staff list does.
      spriteKey: `coach:${coach.portraitId ?? coach.id}:field-cheer`,
    }]));
}
