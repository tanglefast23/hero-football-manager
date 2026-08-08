import { useM1Store } from '../store';
import {
  activeCareerMatchday,
  buildCareerMatchTeams,
  DEFAULT_CREATION_RATINGS,
  type GameState,
} from '../../game';
import { createPreloadPump } from '../rival-preload';
import { cachedRivalResults, clearRivalResultCache, storeRivalResult } from '../rival-result-cache';
import { withRivalHeroIntrosSeen } from './rival-hero-intro-test-helper';

/**
 * Settling a week must not depend on whether the preload ran. These drive the
 * real store through both paths and compare, because the resolver and pump
 * tests only prove the pieces produce correct results — this is the seam where
 * a divergence would actually reach a player's league table.
 */
function startCareerAtMatchday(seed: number): GameState {
  useM1Store.setState(useM1Store.getInitialState(), true);
  useM1Store.getState().startNewCareer(seed);
  useM1Store.getState().completePlayerCreation({
    name: 'Jo Rook',
    ratings: DEFAULT_CREATION_RATINGS,
  });
  const career = withRivalHeroIntrosSeen(useM1Store.getState().career!);
  const fixture = career.fixtures.find(candidate => (
    candidate.season === 1
    && candidate.status === 'scheduled'
    && (candidate.homeClubId === career.userClubId || candidate.awayClubId === career.userClubId)
  ));
  if (fixture === undefined) throw new Error('expected a scheduled season-1 user fixture');
  useM1Store.setState({
    career: { ...career, week: fixture.week, phase: 'matchday' },
    screen: 'matchday',
  });
  return useM1Store.getState().career!;
}

/** The rival fixtures and squads exactly as the preload would build them. */
function rivalsFor(career: GameState) {
  const matchday = activeCareerMatchday(career);
  if (matchday === undefined) throw new Error('expected an active matchday');
  const rivals = matchday.fixtures.filter(candidate => candidate.id !== matchday.fixture.id);
  const teams = buildCareerMatchTeams(
    career,
    [...new Set(rivals.flatMap(candidate => [candidate.homeClubId, candidate.awayClubId]))],
  );
  return { rivals, teams };
}

function preloadEverything(career: GameState): void {
  const { rivals, teams } = rivalsFor(career);
  const pump = createPreloadPump(rivals, teams);
  let guard = 0;
  while (!pump.done) {
    pump.step(256);
    guard += 1;
    if (guard > 200_000) throw new Error('pump did not finish');
  }
}

describe('preloaded rivals reach settle unchanged', () => {
  beforeEach(() => {
    clearRivalResultCache();
  });

  it('settles a matchday identically warm and cold', () => {
    // Cold: nothing cached, every rival simulated inside settle.
    startCareerAtMatchday(20260727);
    useM1Store.getState().quickResult();
    const cold = useM1Store.getState().career!;

    // Warm: the same matchday, every rival resolved before the tap.
    clearRivalResultCache();
    const career = startCareerAtMatchday(20260727);
    preloadEverything(career);
    useM1Store.getState().quickResult();
    const warm = useM1Store.getState().career!;

    // `clubs` carries cash and every club-level tally, so this covers the
    // league table and the money it pays out, not just the scorelines.
    expect(warm.fixtures).toEqual(cold.fixtures);
    expect(warm.clubs).toEqual(cold.clubs);
    expect(warm.players).toEqual(cold.players);
    expect(warm.trainingPoints).toEqual(cold.trainingPoints);
    expect(warm.week).toEqual(cold.week);
  });

  it('actually consumes the cache rather than re-simulating over it', () => {
    const career = startCareerAtMatchday(20260729);
    const { rivals, teams } = rivalsFor(career);
    const target = rivals[0];
    // A score the engine would never produce, so seeing it in the settled table
    // proves settle took the cached result instead of simulating the fixture.
    storeRivalResult(target, teams, {
      fixtureId: target.id,
      homeGoals: 9,
      awayGoals: 0,
    });

    useM1Store.getState().quickResult();

    const settled = useM1Store.getState().career!.fixtures.find(
      candidate => candidate.id === target.id,
    );
    expect(settled?.score).toEqual({ homeGoals: 9, awayGoals: 0 });
  });

  it('ignores a cached result once the squads it was computed from change', () => {
    const career = startCareerAtMatchday(20260730);
    const { rivals, teams } = rivalsFor(career);
    const target = rivals[0];
    const staleTeams = {
      ...teams,
      [target.homeClubId]: {
        ...teams[target.homeClubId],
        players: teams[target.homeClubId].players.slice(0, 10),
      },
    };
    // Stored against a squad that is not the one settle will use.
    storeRivalResult(target, staleTeams, {
      fixtureId: target.id,
      homeGoals: 9,
      awayGoals: 0,
    });

    useM1Store.getState().quickResult();

    const settled = useM1Store.getState().career!.fixtures.find(
      candidate => candidate.id === target.id,
    );
    expect(settled?.score).not.toEqual({ homeGoals: 9, awayGoals: 0 });
  });

  it('drops the cache once the week is settled', () => {
    const career = startCareerAtMatchday(20260728);
    const { rivals, teams } = rivalsFor(career);
    preloadEverything(career);
    expect(cachedRivalResults(rivals, teams).length).toBeGreaterThan(0);

    useM1Store.getState().quickResult();

    // A late scheduler callback must not be able to publish into the next week.
    expect(cachedRivalResults(rivals, teams)).toEqual([]);
  });
});
