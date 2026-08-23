import { createLaunchCareerSetup } from '../../application/launch';
import { loadLaunchContent } from '../../content';
import {
  advanceWeek,
  completeMatchday,
  createCareer,
  fixturesForCurrentWeek,
} from '../career';
import { matchdayVarianceRoll } from '../finance-variance';
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
function tapIfAffordable(
  state: GameState,
  playerId: string,
  pathId: string,
): GameState {
  if (resolveTrainingDrillForPath(state, pathId).tpCost > state.trainingPoints)
    return state;
  for (let nonce = state.totalInstantDrills ?? 0; nonce < 1_000; nonce += 1) {
    const result = trainPlayerInstantly(
      { ...state, totalInstantDrills: nonce },
      playerId,
      pathId,
    );
    if (!result.isSuper) return result.state;
  }
  throw new Error('no non-SUPER nonce found within 1000 attempts');
}

function userCash(state: ReturnType<typeof createCareer>): number {
  const club = state.clubs.find(
    (candidate) => candidate.id === state.userClubId,
  );
  if (club === undefined) throw new Error('missing user club');
  return club.cash;
}

describe('facility weekly integration', () => {
  test('funds and completes the player-placed first pitch while bridging four basic training weeks', () => {
    const content = loadLaunchContent();
    const fresh = createCareer(
      createLaunchCareerSetup(20260718, undefined, content),
    );
    expect(userCash(fresh)).toBe(53_000);
    expect(fresh.facilities.grid?.buildings).toHaveLength(0);
    const started = buildCareerFacility(fresh, 'training-pitch', {
      x: 3,
      y: 2,
    }).state;
    expect(userCash(started)).toBe(45_000);
    const players = fresh.players
      .filter((candidate) => candidate.clubId === fresh.userClubId)
      .slice(0, 2);
    expect(players).toHaveLength(2);
    let state: GameState = {
      ...started,
      fixtures: [],
      m2:
        started.m2 === undefined
          ? undefined
          : { ...started.m2, nationalCups: [] },
      players: started.players.map((candidate) =>
        players.some((player) => player.id === candidate.id)
          ? {
              ...candidate,
              age: 25,
              archetype: 'Speedster' as const,
              potential: 5 as const,
              potentialCeiling: 99,
              attrs: { ...candidate.attrs, pac: 20 },
            }
          : candidate,
      ),
    };

    expect(state.trainingPoints).toBe(12);
    expect(state.facilities).toMatchObject({
      trainingGroundBuilt: false,
      grid: {
        buildings: [{ type: 'training-pitch', level: 1, x: 3, y: 2 }],
        construction: { type: 'training-pitch', weeksRemaining: 2 },
      },
    });

    const balances = [state.trainingPoints];
    for (let week = 0; week < 4; week += 1) {
      for (const player of players)
        state = tapIfAffordable(state, player.id, 'sprints');
      state = advanceWeek(state);
      if (state.phase === 'matchday') {
        state = completeMatchday(
          state,
          fixturesForCurrentWeek(state).map((fixture) => ({
            fixtureId: fixture.id,
            homeGoals: 0,
            awayGoals: 0,
          })),
        );
      }
      balances.push(state.trainingPoints);
    }

    // The 40% scale funds one 7-TP tap in the first build week, then two in the
    // second. Once the Pitch opens, the larger income funds both players.
    const tierOneCost = resolveTrainingDrillForPath(state, 'sprints').tpCost;
    const firstBuildWeekNet = BASE_WEEKLY_TRAINING_POINTS - tierOneCost;
    const secondBuildWeekNet = BASE_WEEKLY_TRAINING_POINTS - tierOneCost * 2;
    const firstPitchWeekNet =
      BASE_WEEKLY_TRAINING_POINTS + TRAINING_PITCH_TP_PER_LEVEL - tierOneCost;
    const fullPitchWeekNet =
      BASE_WEEKLY_TRAINING_POINTS +
      TRAINING_PITCH_TP_PER_LEVEL -
      tierOneCost * 2;
    // The opening balance is the career's launch grant. Taken from the first
    // recorded balance rather than retyped, so retuning the grant retunes this
    // expectation with it — the shape of the climb is what this test owns.
    const launch = balances[0];
    expect(balances).toEqual([
      launch,
      launch + firstBuildWeekNet,
      launch + firstBuildWeekNet + secondBuildWeekNet,
      launch + firstBuildWeekNet + secondBuildWeekNet + firstPitchWeekNet,
      launch +
        firstBuildWeekNet +
        secondBuildWeekNet +
        firstPitchWeekNet +
        fullPitchWeekNet,
    ]);
    // Training is TP-only now; no money is ever charged, so no ledger line
    // of kind 'training' is ever recorded.
    expect(
      state.ledgers.map(
        (ledger) =>
          ledger.lines.find((line) => line.kind === 'training')?.amount,
      ),
    ).toEqual([undefined, undefined, undefined, undefined]);
  });

  test('pays no TP during the build weeks, then activates upkeep and weekly TP', () => {
    const initial = createCareer(createLaunchCareerSetup(20260719));
    const project = buildCareerFacility(initial, 'training-pitch', {
      x: 0,
      y: 0,
    }).state;
    // Strip fixtures so every settlement goes through the direct weekly path.
    const built: GameState = {
      ...project,
      fixtures: [],
      m2:
        project.m2 === undefined
          ? undefined
          : { ...project.m2, nationalCups: [] },
    };
    const cashBeforeSettlement = userCash(built);

    // A half-built pitch contributes nothing of its own. The club still banks
    // its unconditional baseline every week, so "pays no TP" means the pitch
    // adds no TP, not that the week produces none.
    const midBuildWeek = advanceWeek(built);
    expect(midBuildWeek.trainingPoints).toBe(
      built.trainingPoints + BASE_WEEKLY_TRAINING_POINTS,
    );
    expect(
      midBuildWeek.ledgers[0].lines.some((line) => line.kind === 'facilities'),
    ).toBe(false);
    expect(midBuildWeek.facilities.grid?.construction).toMatchObject({
      weeksRemaining: 1,
    });

    const completionWeek = advanceWeek(midBuildWeek);
    expect(completionWeek.trainingPoints).toBe(
      built.trainingPoints + BASE_WEEKLY_TRAINING_POINTS * 2,
    );
    expect(
      completionWeek.ledgers[1].lines.some(
        (line) => line.kind === 'facilities',
      ),
    ).toBe(false);
    expect(completionWeek.facilities.grid?.construction).toBeUndefined();

    const settled = advanceWeek(completionWeek);

    expect(settled.trainingPoints).toBe(
      built.trainingPoints +
        BASE_WEEKLY_TRAINING_POINTS * 3 +
        TRAINING_PITCH_TP_PER_LEVEL,
    );
    expect(settled.ledgers[2].lines).toContainEqual(
      expect.objectContaining({
        kind: 'facilities',
        label: 'Facility upkeep',
        amount: -100,
      }),
    );
    const weeklyNets = settled.ledgers
      .slice(0, 3)
      .map((ledger) =>
        ledger.lines.reduce((total, line) => total + line.amount, 0),
      );
    expect(userCash(settled)).toBe(
      cashBeforeSettlement + weeklyNets[0] + weeklyNets[1] + weeklyNets[2],
    );
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
          buildings: built.facilities.grid!.buildings.map((building) =>
            building.type === 'training-pitch'
              ? { ...building, level: 3 as const, capitalInvested: 36_000 }
              : building,
          ),
        },
      },
    };

    expect(advanceWeek(levelThree).trainingPoints).toBe(
      levelThree.trainingPoints +
        BASE_WEEKLY_TRAINING_POINTS +
        TRAINING_PITCH_TP_PER_LEVEL * 3,
    );
  });

  test('carries the Gym + Dorm ten-percent bonus until small real gains earn +1 STA', () => {
    const initial = createCareer(createLaunchCareerSetup(77));
    const gymProject = buildCareerFacility(initial, 'gym', {
      x: 0,
      y: 0,
    }).state;
    const gym = completeConstruction(gymProject);
    const dormProject = buildCareerFacility(gym, 'dorm', { x: 1, y: 0 }).state;
    const withAdjacency = completeConstruction(dormProject);
    const playerId = withAdjacency.lineups.find(
      (lineup) => lineup.clubId === withAdjacency.userClubId,
    )?.playerIds[0];
    if (playerId === undefined) throw new Error('missing user player');
    const withoutMatches: GameState = {
      ...withAdjacency,
      fixtures: [],
      trainingPoints: 1_000,
      m2:
        withAdjacency.m2 === undefined
          ? undefined
          : { ...withAdjacency.m2, nationalCups: [] },
      // Neutralize the other M2 growth multipliers so this assertion isolates
      // the adjacency's exact percentage carry.
      players: withAdjacency.players.map((player) =>
        player.id === playerId
          ? {
              ...player,
              age: 25,
              archetype: 'Sniper',
              potentialCeiling: 99,
              attrs: { ...player.attrs, sta: 40 },
            }
          : player,
      ),
    };
    const startingSta = withoutMatches.players.find(
      (player) => player.id === playerId,
    )?.attrs.sta;
    if (startingSta === undefined) throw new Error('missing user player STA');

    let state = withoutMatches;
    for (let week = 0; week < 9; week += 1) {
      state = tapIfAffordable(state, playerId, 'circuit');
      state = advanceWeek(state);
    }
    // A Level 1 Gym is x1.10 and Circuit 1 gives +3. The adjacency's 10%
    // continues to bank across taps.
    const afterNine = state.players.find((player) => player.id === playerId);
    expect(afterNine?.attrs.sta).toBe(startingSta + 30);
    expect(afterNine?.facilityStaBonusRemainder).toBe(80);

    // The tenth tap releases the adjacency remainder, so it pays four points.
    state = tapIfAffordable(state, playerId, 'circuit');
    state = advanceWeek(state);
    const afterTen = state.players.find((player) => player.id === playerId);
    expect(afterTen?.attrs.sta).toBe(startingSta + 34);
    expect(afterTen?.facilityStaBonusRemainder).toBe(10);
  });

  test('gives each Stadium Stand a full first level and half-strength upgrades', () => {
    const initial = createCareer(createLaunchCareerSetup(20260725));
    const homeFixture = initial.fixtures.find(
      (fixture) =>
        fixture.season === 1 && fixture.homeClubId === initial.userClubId,
    );
    if (homeFixture === undefined) throw new Error('missing a home fixture');
    // Pin the weekly gate roll to 0% so the stand multiplier is measured on
    // the clean $1,200 baseline; the roll itself is covered by finance tests.
    let zeroRollSeed = 0;
    while (
      matchdayVarianceRoll(zeroRollSeed, 1, homeFixture.week, 'league-gate')
        .percent !== 0
    ) {
      zeroRollSeed += 1;
    }
    const playedHomeWeek: GameState = {
      ...initial,
      careerSeed: zeroRollSeed,
      week: homeFixture.week,
      fixtures: [
        {
          ...homeFixture,
          status: 'played',
          score: { homeGoals: 1, awayGoals: 0 },
        },
      ],
      m2:
        initial.m2 === undefined
          ? undefined
          : { ...initial.m2, nationalCups: [] },
    };
    const gateOf = (state: GameState): number | undefined =>
      advanceWeek(state)
        .ledgers.at(-1)
        ?.lines.find((line) => line.kind === 'tickets')?.amount;
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
            capitalInvested:
              level === 1 ? 10_000 : level === 2 ? 29_000 : 63_000,
            x: index * 2,
            y: 0,
          })),
        },
      },
    });

    // 500 fans at 60% attendance x $4 tickets is the $1,200 D5 baseline, plus
    // the 5% home-gate uplift every gate now carries: $1,260.
    expect(gateOf(playedHomeWeek)).toBe(1_260);
    expect(gateOf(withStands(1))).toBe(2_520);
    expect(gateOf(withStands(2))).toBe(3_150);
    expect(gateOf(withStands(3))).toBe(3_780);
    // Every placed stand contributes, regardless of build order.
    expect(gateOf(withStands(1, 3))).toBe(5_040);
    expect(gateOf(withStands(3, 1))).toBe(5_040);
    expect(gateOf(withStands(1, 1, 1))).toBe(5_040);
  });

  test('uses the x1.10/x1.15/x1.20 facility ladder', () => {
    const initial = createCareer(createLaunchCareerSetup(20260726));
    const playerId = initial.players.find(
      (player) => player.clubId === initial.userClubId,
    )!.id;
    const atGymLevel = (level: 0 | 1 | 2 | 3): number => {
      const state: GameState = {
        ...initial,
        trainingPoints: 100,
        players: initial.players.map((player) =>
          player.id === playerId
            ? {
                ...player,
                age: 25,
                archetype: 'All-Rounder' as const,
                potentialCeiling: 999,
                attrs: { ...player.attrs, pac: 50 },
              }
            : player,
        ),
        facilities: {
          ...initial.facilities,
          grid: {
            ...initial.facilities.grid!,
            nextBuildingId: 2,
            buildings:
              level === 0
                ? []
                : [
                    {
                      id: 'facility-1',
                      type: 'gym' as const,
                      level,
                      capitalInvested:
                        level === 1 ? 7_000 : level === 2 ? 16_000 : 32_000,
                      x: 0,
                      y: 0,
                    },
                  ],
          },
        },
      };
      const trained = tapIfAffordable(state, playerId, 'sprints');
      return (
        trained.players.find((player) => player.id === playerId)!.attrs.pac - 50
      );
    };

    // Sprints 1 gives +3 PAC at age 25. Levels 1 and 2 still round to +3;
    // Level 3 rounds to +4.
    expect(atGymLevel(0)).toBe(3);
    expect(atGymLevel(1)).toBe(3);
    expect(atGymLevel(2)).toBe(3);
    expect(atGymLevel(3)).toBe(4);
  });

  test('keeps M1 ambient TP behavior and charges no upkeep when the grid is absent', () => {
    const initial = createCareer(createLaunchCareerSetup(88));
    const legacy = {
      ...initial,
      facilities: { trainingGroundBuilt: true },
    };

    const settled = advanceWeek(legacy);

    expect(settled.trainingPoints).toBe(
      legacy.trainingPoints +
        BASE_WEEKLY_TRAINING_POINTS +
        TRAINING_PITCH_TP_PER_LEVEL,
    );
    expect(
      settled.ledgers[0].lines.some((line) => line.kind === 'facilities'),
    ).toBe(false);
  });
});

function completeConstruction(state: GameState): GameState {
  const grid = state.facilities.grid;
  if (grid === undefined) throw new Error('missing facility grid');
  let next = grid;
  while (next.construction !== undefined)
    next = advanceFacilityConstruction(next).grid;
  return {
    ...state,
    facilities: { ...state.facilities, grid: next },
  };
}
