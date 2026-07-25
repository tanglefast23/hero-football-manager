import {
  activeCareerMatchday,
  advanceWeek,
  buildCareerTeamDef,
  completeMatchday,
  createCareer,
  protectBoardUltimatumPlayer,
  renewCareerPlayer,
  startNextSeason,
  willRetireAtSeasonTransition,
  type BoardUltimatumResolution,
  type GameState,
} from '../../game';
import { parseStoredGameState, serializeGameState } from '../../persistence/game-state-codec';
import { createLaunchCareerSetup, reconcileLaunchRoster } from '../launch';

const COMPLETED_SEASONS = 6;

describe('M2 struggling-manager recovery soak', () => {
  it('survives six losing seasons, cold relaunches, and repeated board rescues deterministically', () => {
    const first = runStrugglingManagerCareer(20_260_720);
    const second = runStrugglingManagerCareer(20_260_720);

    expect(JSON.stringify(second.state)).toBe(JSON.stringify(first.state));
    expect(second.resolutions).toEqual(first.resolutions);
    expect(first.state).toMatchObject({ season: COMPLETED_SEASONS, phase: 'season-end' });
    expect(first.minimumRosterSize).toBeGreaterThanOrEqual(16);
    // Keep a rounded guardrail around the accepted six-season rescue path. The
    // important fail-soft invariants below remain roster survival, a playable
    // XI, and deterministic board intervention rather than a magic cash value.
    // This passive headless path never builds the guided Training Pitch.
    expect(first.minimumCash).toBeGreaterThanOrEqual(-360_000);
    expect(first.resolutions.some(resolution => resolution.kind === 'FORCED_SALE')).toBe(true);
    expect(buildCareerTeamDef(first.state, first.state.userClubId).players).toHaveLength(11);
    expect(first.state.players.filter(player => player.clubId === first.state.userClubId)).toHaveLength(16);
  });
});

function runStrugglingManagerCareer(seed: number): {
  state: GameState;
  resolutions: BoardUltimatumResolution[];
  minimumRosterSize: number;
  minimumCash: number;
} {
  let state = coldRelaunch(createCareer(
    createLaunchCareerSetup(seed),
  ));
  let transitions = 0;
  let minimumRosterSize = userRosterSize(state);
  let minimumCash = userCash(state);
  const protectedByUltimatum = new Map<string, string>();
  const resolutionById = new Map<string, BoardUltimatumResolution>();

  while (!(state.phase === 'season-end' && state.season === COMPLETED_SEASONS)) {
    transitions += 1;
    if (transitions > COMPLETED_SEASONS * 70) {
      throw new Error('struggling-manager soak exceeded its transition budget');
    }

    if (state.phase === 'manage') {
      const ultimatum = state.financialSafety?.boardUltimatum;
      if (ultimatum !== undefined && ultimatum.protectedPlayerId === undefined) {
        const hero = ultimatum.candidates.find(candidate => (
          state.players.find(player => player.id === candidate.playerId)?.power !== undefined
        ));
        const protectedPlayerId = (hero ?? ultimatum.candidates[0]).playerId;
        state = protectBoardUltimatumPlayer(state, protectedPlayerId);
        protectedByUltimatum.set(ultimatum.id, protectedPlayerId);
      }
      state = advanceWeek(state);
    } else if (state.phase === 'matchday') {
      const matchday = activeCareerMatchday(state);
      if (matchday === undefined) throw new Error('soak entered matchday without a fixture');
      state = completeMatchday(state, matchday.fixtures.map(fixture => {
        const userIsHome = fixture.homeClubId === state.userClubId;
        const userIsAway = fixture.awayClubId === state.userClubId;
        return {
          fixtureId: fixture.id,
          homeGoals: userIsAway ? 1 : 0,
          awayGoals: userIsHome ? 1 : 0,
        };
      }));
    } else if (state.phase === 'season-end') {
      for (const player of state.players.filter(candidate => (
        candidate.clubId === state.userClubId
        && candidate.contractSeasonsRemaining === 0
        && !willRetireAtSeasonTransition(candidate, state.season)
      ))) {
        state = renewCareerPlayer(state, player.id, 4, 1);
      }
      state = reconcileLaunchRoster(coldRelaunch(startNextSeason(state)));
    } else {
      throw new Error('a full career must not enter the complete phase');
    }

    state = coldRelaunch(state);
    const resolution = state.financialSafety?.latestBoardResolution;
    if (resolution !== undefined) {
      const firstSeen = !resolutionById.has(resolution.id);
      resolutionById.set(resolution.id, resolution);
      if (firstSeen && resolution.kind === 'FORCED_SALE') {
        expect(resolution.playerId).not.toBe(protectedByUltimatum.get(resolution.id));
        expect(state.players.find(player => player.id === resolution.replacementPlayerId)).toMatchObject({
          clubId: state.userClubId,
          age: 17,
        });
      }
    }
    minimumRosterSize = Math.min(minimumRosterSize, userRosterSize(state));
    minimumCash = Math.min(minimumCash, userCash(state));
    expect(userRosterSize(state)).toBeGreaterThanOrEqual(16);
    expect(() => buildCareerTeamDef(state, state.userClubId)).not.toThrow();
  }

  return {
    state,
    resolutions: [...resolutionById.values()],
    minimumRosterSize,
    minimumCash,
  };
}

function coldRelaunch(state: GameState): GameState {
  const loaded = parseStoredGameState(serializeGameState(state));
  expect(loaded).toEqual(state);
  expect(parseStoredGameState(serializeGameState(loaded))).toEqual(loaded);
  return loaded;
}

function userRosterSize(state: GameState): number {
  return state.players.filter(player => player.clubId === state.userClubId).length;
}

function userCash(state: GameState): number {
  const club = state.clubs.find(candidate => candidate.id === state.userClubId);
  if (club === undefined) throw new Error('soak cannot find the user club');
  return club.cash;
}
