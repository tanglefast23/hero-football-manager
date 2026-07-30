import { MAX_SUBSTITUTIONS } from '../sim/substitutions';
import type { MatchState } from '../sim/types';

export const FIRST_MATCH_RED_ENERGY_THRESHOLD = 30;

export interface FirstMatchCoachingPrompt {
  readonly kind: 'tired-player';
  /** Exact on-pitch slot named by the coaching card and guided on the board. */
  readonly player: number;
}

export interface FirstMatchCoachingPromptsSeen {
  readonly tiredPlayer: boolean;
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

  const tiredPlayer = firstTiredControlledPlayer(state, controlledTeam);
  if (!seen.tiredPlayer && tiredPlayer !== null) {
    return { kind: 'tired-player', player: tiredPlayer };
  }

  return null;
}
