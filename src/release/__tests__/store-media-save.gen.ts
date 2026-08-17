/**
 * Generates App Store media save states, headlessly.
 *
 * INCOMPLETE — it runs the career forward correctly but cannot yet serialize
 * the result. `serializeGameState` rejects it with
 * `onboarding.firstFixtureId first fixture does not exist`, because the codec
 * requires that fixture to still be in `state.fixtures` unless
 * `onboarding.stage === 'complete'`, and reaching `complete` needs the real
 * `resolvePostMatchAwakening` → `completePostMatchAwakening` path with content
 * tuning, which this loop does not drive. Finish that before relying on it.
 *
 * Not a test — it is named `.gen.ts` so `testMatch` (`*.test.ts`) never
 * collects it in CI. Run it deliberately:
 *
 *   npx jest --testMatch '**\/store-media-save.gen.ts' \
 *     --runTestsByPath src/release/__tests__/store-media-save.gen.ts
 *
 * Why generate rather than play: a store screenshot of a developed club is
 * dozens of seasons of tapping away. The season clock is pure TypeScript, so
 * the same career the shipped app would produce can be run here in seconds and
 * written straight into the app's SQLite save. The captured screens are then
 * the real Release UI reading a real save — no dev harness in frame.
 */
import { writeFileSync } from 'node:fs';

import { createLaunchCareerSetup } from '../../application/launch';
import {
  activeCareerMatchday,
  advanceWeek,
  completeMatchday,
  createCareer,
  startNextSeason,
} from '../../game/career';
import { willRetireAtSeasonTransition } from '../../game/m2-career';
import {
  addCreatedPlayer,
  beginStoryOnboarding,
} from '../../game/onboarding/story-onboarding';
import { renewCareerPlayer } from '../../game/squad';
import { serializeGameState } from '../../persistence/game-state-codec';
import { mulberry32 } from '../../sim/rng';
import type { GameState } from '../../game/types';

/** Fixed, so a recapture reproduces the exact same club. */
const SEED = 20260801;
const OUT_DIR = process.env.STORE_SAVE_OUT ?? '/tmp';

/** The career as the shipped app opens it: onboarded, with a created hero. */
function openedCareer(): GameState {
  return addCreatedPlayer(
    beginStoryOnboarding(createCareer(createLaunchCareerSetup(SEED))),
    {
      name: 'Remy Okafor',
      // Base 50 each plus the full 15-point creation pool, spent forward.
      ratings: { pac: 56, sho: 55, pas: 52, def: 50, tec: 52, sta: 50 },
    },
  );
}

/** One turn of the season clock, played the way an idle manager would play it. */
function nextState(state: GameState): GameState {
  if (state.phase === 'manage') return advanceWeek(state);

  if (state.phase === 'matchday') {
    const matchday = activeCareerMatchday(state);
    if (matchday === undefined) {
      throw new Error('matchday phase with no active fixture');
    }
    return completeMatchday(
      state,
      matchday.fixtures.map(deterministicFixtureScore),
    );
  }

  if (state.phase === 'season-end') {
    let renewed = state;
    for (const player of state.players.filter(
      (candidate) =>
        candidate.clubId === state.userClubId &&
        candidate.contractSeasonsRemaining === 0 &&
        !willRetireAtSeasonTransition(candidate, state.season),
    )) {
      renewed = renewCareerPlayer(renewed, player.id, 4, 1);
    }
    return startNextSeason(renewed);
  }

  return state;
}

function deterministicFixtureScore(fixture: GameState['fixtures'][number]) {
  const random = mulberry32(fixture.matchSeed);
  const homeGoals = deterministicGoalRoll(random()) + (random() < 0.12 ? 1 : 0);
  const awayGoals = deterministicGoalRoll(random());
  return { fixtureId: fixture.id, homeGoals, awayGoals };
}

function deterministicGoalRoll(roll: number): number {
  if (roll < 0.34) return 0;
  if (roll < 0.68) return 1;
  if (roll < 0.88) return 2;
  if (roll < 0.97) return 3;
  return 4;
}

/** Runs the clock until `stopAt` says the screen we want is reachable. */
function careerAt(
  label: string,
  stopAt: (state: GameState) => boolean,
  seasonBudget: number,
): GameState {
  let state = openedCareer();
  const budget = seasonBudget * 80;
  for (let step = 0; step <= budget; step += 1) {
    if (stopAt(state)) return state;
    state = nextState(state);
  }
  throw new Error(`"${label}" never reached its stopping point`);
}

function emit(label: string, state: GameState): void {
  const path = `${OUT_DIR}/${label}.json`;
  writeFileSync(path, serializeGameState(state), 'utf8');
  const club = state.clubs.find(
    (candidate) => candidate.id === state.userClubId,
  );
  // eslint-disable-next-line no-console
  console.log(
    `${label}: season ${state.season} week ${state.week} phase ${state.phase} ` +
      `cash ${club?.cash} squad ${state.players.filter((p) => p.clubId === state.userClubId).length} ` +
      `tp ${state.trainingPoints} -> ${path}`,
  );
}

it('writes store media saves', () => {
  emit(
    'save-opening',
    careerAt(
      'opening',
      (state) => state.phase === 'manage' && state.week >= 2,
      1,
    ),
  );

  emit(
    'save-matchday',
    careerAt(
      'matchday',
      (state) => state.phase === 'matchday' && state.season === 3,
      4,
    ),
  );

  emit(
    'save-developed',
    careerAt(
      'developed',
      (state) =>
        state.phase === 'manage' && state.season === 4 && state.week >= 12,
      5,
    ),
  );

  emit(
    'save-season-end',
    careerAt(
      'season-end',
      (state) => state.phase === 'season-end' && state.season === 3,
      4,
    ),
  );
});
