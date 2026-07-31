import { createLaunchCareerSetup } from '../../application/launch';
import { loadLaunchContent } from '../../content';
import { advanceWeek, completeMatchday, createCareer, fixturesForCurrentWeek } from '../career';
import { buildCareerFacility } from '../management';
import {
  advanceFacilityConstruction,
  BASE_WEEKLY_TRAINING_POINTS,
  TRAINING_PITCH_TP_PER_LEVEL,
} from '../facilities';
import { trainPlayerInstantly } from '../training';
import { resolveTrainingDrillForPath } from '../training-paths';
import type { GameState } from '../types';

/** Taps the drill when the bank affords it, retrying nonces past SUPER rolls. */
function tapIfAffordable(state: GameState, playerId: string, pathId: string): GameState {
  if (resolveTrainingDrillForPath(state, pathId).tpCost > state.trainingPoints) return state;
  for (let nonce = state.totalInstantDrills ?? 0; nonce < 1_000; nonce += 1) {
    const result = trainPlayerInstantly({ ...state, totalInstantDrills: nonce }, playerId, pathId);
    if (!result.isSuper) return result.state;
  }
  throw new Error('no non-SUPER nonce found within 1000 attempts');
}

function userCash(state: ReturnType<typeof createCareer>): number {
  const club = state.clubs.find(candidate => candidate.id === state.userClubId);
  if (club === undefined) throw new Error('missing user club');
  return club.cash;
}

describe('facility weekly integration', () => {
  test('funds and completes the player-placed first pitch while bridging four basic training weeks', () => {
    const content = loadLaunchContent();
    const fresh = createCareer(createLaunchCareerSetup(20260718, undefined, content));
    expect(userCash(fresh)).toBe(53_000);
    expect(fresh.facilities.grid?.buildings).toHaveLength(0);
    const started = buildCareerFacility(fresh, 'training-pitch', { x: 3, y: 2 }).state;
    expect(userCash(started)).toBe(45_000);
    const players = fresh.players
      .filter(candidate => candidate.clubId === fresh.userClubId)
      .slice(0, 2);
    expect(players).toHaveLength(2);
    let state: GameState = {
      ...started,
      fixtures: [],
      m2: started.m2 === undefined
        ? undefined
        : { ...started.m2, nationalCups: [] },
      players: started.players.map(candidate => players.some(player => player.id === candidate.id)
        ? {
            ...candidate,
            age: 25,
            archetype: 'Speedster' as const,
            potential: 5 as const,
            potentialCeiling: 99,
            attrs: { ...candidate.attrs, pac: 20 },
          }
        : candidate),
    };

    expect(state.trainingPoints).toBe(30);
    expect(state.facilities).toMatchObject({
      trainingGroundBuilt: false,
      grid: {
        buildings: [{ type: 'training-pitch', level: 1, x: 3, y: 2 }],
        construction: { type: 'training-pitch', weeksRemaining: 2 },
      },
    });

    const balances = [state.trainingPoints];
    for (let week = 0; week < 4; week += 1) {
      for (const player of players) state = tapIfAffordable(state, player.id, 'sprints');
      state = advanceWeek(state);
      if (state.phase === 'matchday') {
        state = completeMatchday(state, fixturesForCurrentWeek(state).map(fixture => ({
          fixtureId: fixture.id,
          homeGoals: 0,
          awayGoals: 0,
        })));
      }
      balances.push(state.trainingPoints);
    }

    // Sprints 2 is the best tier open in D5 and costs 10 TP per tap, so two
    // trainees cost 20 a week. The club banks BASE_WEEKLY_TRAINING_POINTS every
    // week whether or not a pitch exists, and the pitch adds its own
    // TRAINING_PITCH_TP_PER_LEVEL once the two build weeks finish — weeks three
    // and four here. The bank therefore climbs by 4 a week during construction
    // and by 14 a week after it, which is the point of the baseline: a club with
    // no pitch can still train, and the pitch makes it comfortable rather than
    // being the only source of TP.
    const spendPerWeek = 20;
    const base = BASE_WEEKLY_TRAINING_POINTS - spendPerWeek;
    const withPitch = base + TRAINING_PITCH_TP_PER_LEVEL;
    // The opening balance is the career's launch grant. Taken from the first
    // recorded balance rather than retyped, so retuning the grant retunes this
    // expectation with it — the shape of the climb is what this test owns.
    const launch = balances[0];
    expect(balances).toEqual([
      launch,
      launch + base,
      launch + base * 2,
      launch + base * 2 + withPitch,
      launch + base * 2 + withPitch * 2,
    ]);
    // Training is TP-only now; no money is ever charged, so no ledger line
    // of kind 'training' is ever recorded.
    expect(state.ledgers.map(ledger => ledger.lines.find(line => line.kind === 'training')?.amount))
      .toEqual([undefined, undefined, undefined, undefined]);
  });

  test('pays no TP during the build weeks, then activates upkeep and weekly TP', () => {
    const initial = createCareer(createLaunchCareerSetup(20260719));
    const project = buildCareerFacility(initial, 'training-pitch', { x: 0, y: 0 }).state;
    // Strip fixtures so every settlement goes through the direct weekly path.
    const built: GameState = {
      ...project,
      fixtures: [],
      m2: project.m2 === undefined ? undefined : { ...project.m2, nationalCups: [] },
    };
    const cashBeforeSettlement = userCash(built);

    // A half-built pitch contributes nothing of its own. The club still banks
    // its unconditional baseline every week, so "pays no TP" means the pitch
    // adds no TP, not that the week produces none.
    const midBuildWeek = advanceWeek(built);
    expect(midBuildWeek.trainingPoints).toBe(built.trainingPoints + BASE_WEEKLY_TRAINING_POINTS);
    expect(midBuildWeek.ledgers[0].lines.some(line => line.kind === 'facilities')).toBe(false);
    expect(midBuildWeek.facilities.grid?.construction).toMatchObject({ weeksRemaining: 1 });

    const completionWeek = advanceWeek(midBuildWeek);
    expect(completionWeek.trainingPoints).toBe(built.trainingPoints + BASE_WEEKLY_TRAINING_POINTS * 2);
    expect(completionWeek.ledgers[1].lines.some(line => line.kind === 'facilities')).toBe(false);
    expect(completionWeek.facilities.grid?.construction).toBeUndefined();

    const settled = advanceWeek(completionWeek);

    expect(settled.trainingPoints).toBe(
      built.trainingPoints + BASE_WEEKLY_TRAINING_POINTS * 3 + TRAINING_PITCH_TP_PER_LEVEL,
    );
    expect(settled.ledgers[2].lines).toContainEqual({
      kind: 'facilities',
      label: 'Facility upkeep',
      amount: -100,
    });
    const weeklyNets = settled.ledgers.slice(0, 3).map(ledger => (
      ledger.lines.reduce((total, line) => total + line.amount, 0)
    ));
    expect(userCash(settled)).toBe(cashBeforeSettlement + weeklyNets[0] + weeklyNets[1] + weeklyNets[2]);
  });

  test('scales Training Pitch TP with the completed facility level', () => {
    const initial = createCareer(createLaunchCareerSetup(20260720));
    const built = completeConstruction(
      buildCareerFacility(initial, 'training-pitch', { x: 0, y: 0 }).state,
    );
    const levelThree: GameState = {
      ...built,
      facilities: {
        ...built.facilities,
        grid: {
          ...built.facilities.grid!,
          buildings: built.facilities.grid!.buildings.map(building => (
            building.type === 'training-pitch' ? { ...building, level: 3 as const } : building
          )),
        },
      },
    };

    expect(advanceWeek(levelThree).trainingPoints).toBe(
      levelThree.trainingPoints + BASE_WEEKLY_TRAINING_POINTS + TRAINING_PITCH_TP_PER_LEVEL * 3,
    );
  });

  test('carries the Gym + Dorm ten-percent bonus until small real gains earn +1 STA', () => {
    const initial = createCareer(createLaunchCareerSetup(77));
    const gymProject = buildCareerFacility(initial, 'gym', { x: 0, y: 0 }).state;
    const gym = completeConstruction(gymProject);
    const dormProject = buildCareerFacility(gym, 'dorm', { x: 1, y: 0 }).state;
    const withAdjacency = completeConstruction(dormProject);
    const playerId = withAdjacency.lineups
      .find(lineup => lineup.clubId === withAdjacency.userClubId)?.playerIds[0];
    if (playerId === undefined) throw new Error('missing user player');
    const withoutMatches: GameState = {
      ...withAdjacency,
      fixtures: [],
      trainingPoints: 1_000,
      m2: withAdjacency.m2 === undefined
        ? undefined
        : { ...withAdjacency.m2, nationalCups: [] },
      // Neutralize the other M2 growth multipliers so this assertion isolates
      // the adjacency's exact percentage carry.
      players: withAdjacency.players.map(player => player.id === playerId
        ? {
            ...player,
            age: 25,
            archetype: 'Sniper',
            potentialCeiling: 99,
            attrs: { ...player.attrs, sta: 40 },
          }
        : player),
    };
    const startingSta = withoutMatches.players.find(player => player.id === playerId)?.attrs.sta;
    if (startingSta === undefined) throw new Error('missing user player STA');

    let state = withoutMatches;
    for (let week = 0; week < 9; week += 1) {
      state = tapIfAffordable(state, playerId, 'circuit');
      state = advanceWeek(state);
    }
    // A Level 1 Gym is now x1.25, and Circuit 2 (+5) is the open tier, so each
    // tap lands 6 real STA and banks 60 percentage points of the adjacency's
    // 10% — enough to release a whole extra point on roughly every other tap.
    const afterNine = state.players.find(player => player.id === playerId);
    expect(afterNine?.attrs.sta).toBe(startingSta + 61);
    expect(afterNine?.facilityStaBonusRemainder).toBe(60);

    state = tapIfAffordable(state, playerId, 'circuit');
    state = advanceWeek(state);
    const afterTen = state.players.find(player => player.id === playerId);
    expect(afterTen?.attrs.sta).toBe(startingSta + 69);
    expect(afterTen?.facilityStaBonusRemainder).toBe(30);
  });

  test('raises the home gate by 25% per Stadium Stand level, best level only', () => {
    const initial = createCareer(createLaunchCareerSetup(20260725));
    const homeFixture = initial.fixtures.find(fixture => (
      fixture.season === 1 && fixture.homeClubId === initial.userClubId
    ));
    if (homeFixture === undefined) throw new Error('missing a home fixture');
    const playedHomeWeek: GameState = {
      ...initial,
      week: homeFixture.week,
      fixtures: [{ ...homeFixture, status: 'played', score: { homeGoals: 1, awayGoals: 0 } }],
      m2: initial.m2 === undefined ? undefined : { ...initial.m2, nationalCups: [] },
    };
    const gateOf = (state: GameState): number | undefined => advanceWeek(state)
      .ledgers.at(-1)?.lines.find(line => line.kind === 'tickets')?.amount;
    const withStands = (...levels: readonly (1 | 2 | 3)[]): GameState => ({
      ...playedHomeWeek,
      facilities: {
        ...playedHomeWeek.facilities,
        grid: {
          ...playedHomeWeek.facilities.grid!,
          nextBuildingId: levels.length + 1,
          buildings: levels.map((level, index) => ({
            id: `facility-${index + 1}`,
            type: 'stadium-stand' as const,
            level,
            x: index * 2,
            y: 0,
          })),
        },
      },
    });

    // 500 fans at 60% attendance x $4 tickets is the $1,200 D5 baseline.
    expect(gateOf(playedHomeWeek)).toBe(1_200);
    expect(gateOf(withStands(1))).toBe(1_500);
    expect(gateOf(withStands(2))).toBe(1_800);
    expect(gateOf(withStands(3))).toBe(2_100);
    // Two stands are not two bonuses, and the better one wins whichever
    // order they were built in.
    expect(gateOf(withStands(1, 3))).toBe(2_100);
    expect(gateOf(withStands(3, 1))).toBe(2_100);
  });

  test('makes a level-1 training facility worth x1.25, not x1.0', () => {
    const initial = createCareer(createLaunchCareerSetup(20260726));
    const playerId = initial.players.find(player => player.clubId === initial.userClubId)!.id;
    const atGymLevel = (level: 0 | 1 | 2 | 3): number => {
      const state: GameState = {
        ...initial,
        trainingPoints: 100,
        players: initial.players.map(player => player.id === playerId
          ? {
              ...player,
              age: 25,
              archetype: 'All-Rounder' as const,
              potentialCeiling: 999,
              attrs: { ...player.attrs, pac: 50 },
            }
          : player),
        facilities: {
          ...initial.facilities,
          grid: {
            ...initial.facilities.grid!,
            nextBuildingId: 2,
            buildings: level === 0
              ? []
              : [{ id: 'facility-1', type: 'gym' as const, level, x: 0, y: 0 }],
          },
        },
      };
      const trained = tapIfAffordable(state, playerId, 'sprints');
      return trained.players.find(player => player.id === playerId)!.attrs.pac - 50;
    };

    // Sprints 2 gives +5 PAC at age 25. The old formula made level 1 x1.0, so
    // the first Gym a club ever built changed nothing at all.
    expect(atGymLevel(0)).toBe(5);
    expect(atGymLevel(1)).toBe(6); // round(5 x 1.25)
    expect(atGymLevel(2)).toBe(8); // round(5 x 1.5)
    expect(atGymLevel(3)).toBe(10);
  });

  test('keeps M1 ambient TP behavior and charges no upkeep when the grid is absent', () => {
    const initial = createCareer(createLaunchCareerSetup(88));
    const legacy = {
      ...initial,
      facilities: { trainingGroundBuilt: true },
    };

    const settled = advanceWeek(legacy);

    expect(settled.trainingPoints).toBe(
      legacy.trainingPoints + BASE_WEEKLY_TRAINING_POINTS + TRAINING_PITCH_TP_PER_LEVEL,
    );
    expect(settled.ledgers[0].lines.some(line => line.kind === 'facilities')).toBe(false);
  });
});

function completeConstruction(state: GameState): GameState {
  const grid = state.facilities.grid;
  if (grid === undefined) throw new Error('missing facility grid');
  let next = grid;
  while (next.construction !== undefined) next = advanceFacilityConstruction(next).grid;
  return {
    ...state,
    facilities: { ...state.facilities, grid: next },
  };
}
