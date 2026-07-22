import { createLaunchCareerSetup } from '../../application/launch';
import { loadLaunchContent } from '../../content';
import { advanceWeek, createCareer } from '../career';
import { buildCareerFacility } from '../management';
import { advanceFacilityConstruction, createFacilityGrid } from '../facilities';
import { setCareerTrainingPlan } from '../training';
import type { GameState } from '../types';

function userCash(state: ReturnType<typeof createCareer>): number {
  const club = state.clubs.find(candidate => candidate.id === state.userClubId);
  if (club === undefined) throw new Error('missing user club');
  return club.cash;
}

describe('facility weekly integration', () => {
  test('starts a full career with an open Level 1 pitch and bridges four basic training weeks', () => {
    const content = loadLaunchContent();
    const fresh = createCareer(createLaunchCareerSetup(20260718, undefined, content, 'full'));
    const players = fresh.players
      .filter(candidate => candidate.clubId === fresh.userClubId)
      .slice(0, 2);
    expect(players).toHaveLength(2);
    const sprint = content.training.focusDrills.find(drill => drill.id === 'sprints')!;
    let state = setCareerTrainingPlan({
      ...fresh,
      players: fresh.players.map(candidate => players.some(player => player.id === candidate.id)
        ? {
            ...candidate,
            age: 25,
            archetype: 'Speedster' as const,
            potential: 5 as const,
            potentialCeiling: 99,
            attrs: { ...candidate.attrs, pac: 20 },
          }
        : candidate),
    }, players.map(player => player.id), [sprint]);

    expect(state.trainingPoints).toBe(30);
    expect(state.facilities).toMatchObject({
      trainingGroundBuilt: true,
      grid: {
        buildings: [{ type: 'training-pitch', level: 1 }],
      },
    });
    expect(state.facilities.grid?.construction).toBeUndefined();

    const balances = [state.trainingPoints];
    for (let week = 0; week < 4; week += 1) {
      state = advanceWeek(state);
      balances.push(state.trainingPoints);
    }

    // Sprints I costs 10 TP once, then the open pitch restores all 10 TP.
    expect(balances).toEqual([30, 30, 30, 30, 30]);
    // TP is charged once for the selected drill; Money remains per eligible trainee.
    expect(state.ledgers.map(ledger => ledger.lines.find(line => line.kind === 'training')?.amount))
      .toEqual([-800, -800, -800, -800]);
  });

  test('starts without benefits, then activates upkeep and ambient TP after completion', () => {
    const initial = withoutStartingPitch(
      createCareer(createLaunchCareerSetup(20260719, undefined, undefined, 'full')),
    );
    const built = buildCareerFacility(initial, 'training-pitch', { x: 0, y: 0 }).state;
    const cashBeforeSettlement = userCash(built);

    const completionWeek = advanceWeek(built);
    expect(completionWeek.trainingPoints).toBe(built.trainingPoints);
    expect(completionWeek.ledgers[0].lines.some(line => line.kind === 'facilities')).toBe(false);
    expect(completionWeek.facilities.grid?.construction).toBeUndefined();

    const settled = advanceWeek(completionWeek);

    expect(settled.trainingPoints).toBe(built.trainingPoints + 10);
    expect(settled.ledgers[1].lines).toContainEqual({
      kind: 'facilities',
      label: 'Facility upkeep',
      amount: -100,
    });
    const completionNet = completionWeek.ledgers[0].lines.reduce((total, line) => total + line.amount, 0);
    const activeNet = settled.ledgers[1].lines.reduce((total, line) => total + line.amount, 0);
    expect(userCash(settled)).toBe(cashBeforeSettlement + completionNet + activeNet);
  });

  test('scales Training Pitch TP with the completed facility level', () => {
    const initial = withoutStartingPitch(
      createCareer(createLaunchCareerSetup(20260720, undefined, undefined, 'full')),
    );
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

    expect(advanceWeek(levelThree).trainingPoints).toBe(levelThree.trainingPoints + 30);
  });

  test('carries the Gym + Dorm ten-percent bonus until small real gains earn +1 STA', () => {
    const initial = withoutStartingPitch(
      createCareer(createLaunchCareerSetup(77, undefined, undefined, 'full')),
    );
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
      m2: withAdjacency.m2 === undefined
        ? undefined
        : { ...withAdjacency.m2, nationalCups: [] },
      // Neutralize the other M2 growth multipliers so this assertion isolates
      // the adjacency's exact percentage carry.
      players: withAdjacency.players.map(player => player.id === playerId
        ? { ...player, age: 25, archetype: 'Sniper', potentialCeiling: 99 }
        : player),
    };
    const startingSta = withoutMatches.players.find(player => player.id === playerId)?.attrs.sta;
    if (startingSta === undefined) throw new Error('missing user player STA');

    let state = withoutMatches;
    for (let week = 0; week < 9; week += 1) state = advanceWeek(state);
    const afterNine = state.players.find(player => player.id === playerId);
    expect(afterNine?.attrs.sta).toBe(startingSta + 9);
    expect(afterNine?.facilityStaBonusRemainder).toBe(90);

    state = advanceWeek(state);
    const afterTen = state.players.find(player => player.id === playerId);
    expect(afterTen?.attrs.sta).toBe(startingSta + 11);
    expect(afterTen?.facilityStaBonusRemainder).toBe(0);
  });

  test('keeps M1 ambient TP behavior and charges no upkeep when the grid is absent', () => {
    const initial = createCareer(createLaunchCareerSetup(88));
    const legacy = {
      ...initial,
      facilities: { trainingGroundBuilt: true },
    };

    const settled = advanceWeek(legacy);

    expect(settled.trainingPoints).toBe(legacy.trainingPoints + 10);
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

function withoutStartingPitch(state: GameState): GameState {
  return {
    ...state,
    facilities: {
      trainingGroundBuilt: false,
      grid: createFacilityGrid(),
    },
  };
}
