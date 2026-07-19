import { createLaunchCareerSetup } from '../../application/launch';
import { createCareer } from '../career';
import { resolveCareerTrainingWeek } from '../training';

describe('M2 player-specific training growth', () => {
  test('applies the age curve only in full careers', () => {
    const setup = createLaunchCareerSetup(90210);
    const m1 = createCareer(setup);
    const full = createCareer({ ...setup, careerMode: 'full' });
    const playerId = full.players.find(player => player.clubId === full.userClubId)!.id;
    const prepare = (state: typeof full) => ({
      ...state,
      players: state.players.map(player => player.id === playerId
        ? { ...player, age: 20, archetype: 'All-Rounder' as const, attrs: { ...player.attrs, sta: 50 } }
        : player),
    });

    const m1Player = resolveCareerTrainingWeek(prepare(m1)).players.find(player => player.id === playerId)!;
    const fullPlayer = resolveCareerTrainingWeek(prepare(full)).players.find(player => player.id === playerId)!;

    expect(m1Player.attrs.sta).toBe(51);
    expect(fullPlayer.attrs.sta).toBe(52);
  });

  test('uses the matching facility level and diminishing returns', () => {
    const initial = createCareer({ ...createLaunchCareerSetup(90211), careerMode: 'full' });
    const playerId = initial.players.find(player => player.clubId === initial.userClubId)!.id;
    const state = {
      ...initial,
      players: initial.players.map(player => player.id === playerId
        ? { ...player, age: 25, archetype: 'Engine' as const, attrs: { ...player.attrs, sta: 90 } }
        : player),
      facilities: {
        ...initial.facilities,
        grid: {
          ...initial.facilities.grid!,
          nextBuildingId: 2,
          buildings: [{ id: 'facility-1', type: 'gym' as const, level: 3 as const, x: 0, y: 0 }],
        },
      },
    };

    const player = resolveCareerTrainingWeek(state).players.find(candidate => candidate.id === playerId)!;

    // 1 base STA x Engine 1.15 x Lv3 Gym 2.0 x high-stat 0.5 rounds to 1.
    expect(player.attrs.sta).toBe(91);
  });

  test('combines coach and facility percentages before the one final rounding step', () => {
    const initial = createCareer({ ...createLaunchCareerSetup(90212), careerMode: 'full' });
    const playerId = initial.players.find(player => player.clubId === initial.userClubId)!.id;
    const coach = {
      id: 'rounding-coach',
      name: 'Rounding Coach',
      specialties: ['ATTACK', 'DEFENSE'] as const,
      level: 4,
      weeklyWage: 1_000,
      personality: 'PROFESSIONAL' as const,
      requiredDivision: 5,
      requiredFame: 0,
      loyaltyDiscountPercent: 0,
    };
    const state = {
      ...initial,
      players: initial.players.map(player => player.id === playerId
        ? { ...player, age: 25, archetype: 'Anchor' as const, attrs: { ...player.attrs, sho: 50 } }
        : player),
      facilities: {
        ...initial.facilities,
        grid: {
          ...initial.facilities.grid!,
          nextBuildingId: 2,
          buildings: [{
            id: 'facility-1',
            type: 'shooting-range' as const,
            level: 3 as const,
            x: 0,
            y: 0,
          }],
        },
      },
      market: {
        ...initial.market!,
        coachCandidates: [coach],
        headCoach: coach,
      },
      trainingPlan: {
        assignedPlayerIds: [playerId],
        drills: [{ id: 'micro-finishing', moneyCost: 0, tpCost: 0, gains: { sho: 1 } }],
      },
    };

    const player = resolveCareerTrainingWeek(state).players.find(candidate => candidate.id === playerId)!;

    // 1 x Lv4 Attack 1.4 x Lv3 Shooting Range 2.0 = 2.8, rounded once.
    expect(player.attrs.sho).toBe(53);
  });
});
