import { createLaunchCareerSetup, reconcileLaunchRoster } from '../../application/launch';
import {
  parseStoredGameState,
  serializeGameState,
} from '../../persistence/game-state-codec';
import { mulberry32 } from '../../sim/rng';
import {
  activeCareerMatchday,
  advanceWeek,
  completeMatchday,
  createCareer,
} from '../career';
import type { GameState } from '../types';

function scoreFixture(fixture: { id: string; matchSeed: number }) {
  const random = mulberry32(fixture.matchSeed);
  const roll = (r: number) =>
    r < 0.34 ? 0 : r < 0.68 ? 1 : r < 0.88 ? 2 : r < 0.97 ? 3 : 4;
  return {
    fixtureId: fixture.id,
    homeGoals: roll(random()),
    awayGoals: roll(random()),
  };
}

function playToSeasonOneMatchday(seed: number): GameState {
  let state = createCareer(createLaunchCareerSetup(seed));
  let guard = 0;
  while (!(state.week <= 4 && state.phase === 'matchday')) {
    guard += 1;
    if (guard > 50) throw new Error('never reached a week<=4 matchday');
    if (state.phase === 'manage') state = advanceWeek(state);
    else if (state.phase === 'matchday') {
      const matchday = activeCareerMatchday(state);
      if (matchday === undefined) throw new Error('expected an active fixture');
      state = completeMatchday(state, matchday.fixtures.map(scoreFixture));
    } else throw new Error(`unexpected phase ${state.phase}`);
  }
  return state;
}

const reload = (state: GameState): GameState =>
  reconcileLaunchRoster(
    parseStoredGameState(serializeGameState(state, { validate: true })),
  );

// Quitting mid-matchday persists phase 'matchday'. The youth-intake reconcile
// used to misread that as "pre-season window over": the first reload deleted
// the open offers, and the second reload hit createPreseasonYouthIntake's
// manage-phase assert, throwing on every load thereafter — a bricked save.
test('reloading twice during a season-1 week 3-4 matchday keeps the save loadable', () => {
  const state = playToSeasonOneMatchday(20260718);
  const before = state.youthIntake;
  expect(before?.status).toBe('OPEN');

  const onceReloaded = reload(state);
  expect(onceReloaded.youthIntake?.status).toBe(before?.status);
  expect(onceReloaded.youthIntake?.offers.length).toBe(before?.offers.length);

  const twiceReloaded = reload(onceReloaded);
  expect(twiceReloaded.youthIntake?.status).toBe(before?.status);
  expect(twiceReloaded.youthIntake?.offers.length).toBe(before?.offers.length);
});

// The exact state old saves were bricked in: intake already emptied-CLOSED by
// the pre-fix reconcile, persisted mid-matchday at week <=4. Loading must
// neither throw (createPreseasonYouthIntake asserts the manage phase) nor
// recreate offers outside the manage phase.
test('a save already holding an emptied intake still loads mid-matchday', () => {
  const state = playToSeasonOneMatchday(20260718);
  if (state.youthIntake === undefined) throw new Error('expected an intake');
  const bricked: GameState = {
    ...state,
    youthIntake: {
      ...state.youthIntake,
      status: 'CLOSED',
      offers: [],
      signedPlayerIds: [],
      declined: false,
    },
  };

  const reloaded = reload(bricked);

  expect(reloaded.youthIntake?.status).toBe('CLOSED');
  expect(reloaded.youthIntake?.offers.length).toBe(0);
});
