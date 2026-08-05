import type { DecoyCloneState, MatchState, SimPlayer } from './types';

export const BASE_PLAYER_COUNT = 22;
const DECOY_CLONE_COUNT = 2;
export const HOME_DECOY_INDEX = 22;
export const AWAY_DECOY_INDEX = 23;
export const RENDER_PLAYER_COUNT = BASE_PLAYER_COUNT + DECOY_CLONE_COUNT;

export function decoyIndexForTeam(team: 0 | 1): 22 | 23 {
  return team === 0 ? HOME_DECOY_INDEX : AWAY_DECOY_INDEX;
}

function decoyTeamForIndex(index: number): 0 | 1 | null {
  if (index === HOME_DECOY_INDEX) return 0;
  if (index === AWAY_DECOY_INDEX) return 1;
  return null;
}

export function decoyCloneAt(state: MatchState, index: number): DecoyCloneState | null {
  const team = decoyTeamForIndex(index);
  return team === null ? null : state.decoyClones[team];
}

export function playerAt(state: MatchState, index: number): SimPlayer | undefined {
  if (index >= 0 && index < BASE_PLAYER_COUNT) return state.players[index];
  return decoyCloneAt(state, index) ?? undefined;
}

export function requirePlayerAt(state: MatchState, index: number): SimPlayer {
  const player = playerAt(state, index);
  if (player === undefined) throw new Error(`missing match player entity ${index}`);
  return player;
}

export function activePlayerIndices(state: MatchState): number[] {
  const indices = Array.from({ length: BASE_PLAYER_COUNT }, (_, index) => index);
  if (state.decoyClones[0] !== null) indices.push(HOME_DECOY_INDEX);
  if (state.decoyClones[1] !== null) indices.push(AWAY_DECOY_INDEX);
  return indices;
}

function activeTeamPlayerIndices(state: MatchState, team: 0 | 1): number[] {
  const first = team === 0 ? 0 : 11;
  const indices = Array.from({ length: 11 }, (_, slot) => first + slot);
  if (state.decoyClones[team] !== null) indices.push(decoyIndexForTeam(team));
  return indices;
}

export function formationSlotForEntity(state: MatchState, index: number): number {
  if (index >= 0 && index < BASE_PLAYER_COUNT) return index % 11;
  return decoyCloneAt(state, index)?.formationSlot ?? 9;
}

/** Match reports credit clone actions to the copied real forward. */
export function attributedPlayerIndex(state: MatchState, index: number): number {
  return decoyCloneAt(state, index)?.sourceIdx ?? index;
}
