import { MAX_SUBSTITUTIONS } from '../sim/substitutions';
import type { MatchState } from '../sim/types';

export const FIRST_MATCH_RED_ENERGY_THRESHOLD = 30;
export const FIRST_MATCH_COMEBACK_GOAL_MARGIN = 3;

export type FirstMatchCoachingPrompt = 'tired-player' | 'three-goal-deficit';

export interface FirstMatchCoachingPromptsSeen {
  readonly tiredPlayer: boolean;
  readonly threeGoalDeficit: boolean;
}

function firstTiredControlledPlayer(
  state: MatchState,
  controlledTeam: 0 | 1,
): number | null {
  if (
    state.phase === 'fulltime'
    || state.substitutionsUsed[controlledTeam] >= MAX_SUBSTITUTIONS
    || state.bench[controlledTeam].length === 0
  ) {
    return null;
  }

  const first = controlledTeam * 11;
  const last = first + 11;
  const candidate = state.players
    .map((player, index) => ({ player, index }))
    .filter(({ player, index }) => (
      index >= first
      && index < last
      && player.outReason !== 'redcard'
      && player.condition <= FIRST_MATCH_RED_ENERGY_THRESHOLD
      && state.bench[controlledTeam].some(replacement => (
        (player.def.role === 'GK') === (replacement.role === 'GK')
      ))
    ))
    .sort((left, right) => (
      left.player.condition - right.player.condition
      || left.index - right.index
    ))[0];

  return candidate?.index ?? null;
}

export function nextFirstMatchCoachingPrompt(
  state: MatchState,
  controlledTeam: 0 | 1,
  seen: FirstMatchCoachingPromptsSeen,
): FirstMatchCoachingPrompt | null {
  if (state.phase === 'fulltime') return null;

  if (!seen.tiredPlayer && firstTiredControlledPlayer(state, controlledTeam) !== null) {
    return 'tired-player';
  }

  const opponent = controlledTeam === 0 ? 1 : 0;
  if (
    !seen.threeGoalDeficit
    && state.score[opponent] - state.score[controlledTeam] >= FIRST_MATCH_COMEBACK_GOAL_MARGIN
  ) {
    return 'three-goal-deficit';
  }

  return null;
}
