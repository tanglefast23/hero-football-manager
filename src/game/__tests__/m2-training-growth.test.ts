import { createLaunchCareerSetup } from '../../application/launch';
import { playerAttributeCaps } from '../archetype-caps';
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
        ? {
            ...player,
            age: 25,
            archetype: 'Engine' as const,
            potentialCeiling: 99,
            attrs: { ...player.attrs, sta: 90 },
          }
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

  test('banks the fractional coach bonus after other growth multipliers', () => {
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
        ? {
            ...player,
            age: 25,
            archetype: 'Anchor' as const,
            potentialCeiling: 99,
            attrs: { ...player.attrs, sho: 50 },
          }
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

    const firstWeek = resolveCareerTrainingWeek(state);
    const firstPlayer = firstWeek.players.find(candidate => candidate.id === playerId)!;
    const secondWeek = resolveCareerTrainingWeek({ ...state, players: firstWeek.players });
    const secondPlayer = secondWeek.players.find(candidate => candidate.id === playerId)!;

    // Each week has +2 base growth and +0.8 from the coach. The fractional
    // coach portion carries, so two weeks award five whole points and retain .6.
    expect(firstPlayer.attrs.sho).toBe(52);
    expect(firstPlayer.coachTrainingBonusRemainders?.sho).toBe(80);
    expect(secondPlayer.attrs.sho).toBe(55);
    expect(secondPlayer.coachTrainingBonusRemainders?.sho).toBe(60);
  });

  test('turns a Level 1 Attack coach into one exact extra point over repeated +3 drills', () => {
    const initial = createCareer({ ...createLaunchCareerSetup(90214), careerMode: 'full' });
    const playerId = initial.players.find(player => player.clubId === initial.userClubId)!.id;
    const coach = {
      id: 'level-one-coach',
      name: 'Level One Coach',
      specialties: ['ATTACK', 'MOTIVATOR'] as const,
      level: 1,
      weeklyWage: 500,
      personality: 'PROFESSIONAL' as const,
      requiredDivision: 5,
      requiredFame: 0,
      loyaltyDiscountPercent: 0,
    };
    let state = {
      ...initial,
      players: initial.players.map(player => player.id === playerId
        ? {
            ...player,
            age: 25,
            archetype: 'Anchor' as const,
            potentialCeiling: 99,
            attrs: { ...player.attrs, sho: 50 },
          }
        : player),
      market: { ...initial.market!, headCoach: coach },
      trainingPlan: {
        assignedPlayerIds: [playerId],
        drills: [{ id: 'finishing-carry', moneyCost: 0, tpCost: 0, gains: { sho: 3 } }],
      },
    };
    const weeklyGains: number[] = [];

    for (let week = 0; week < 4; week += 1) {
      const before = state.players.find(player => player.id === playerId)!.attrs.sho;
      const result = resolveCareerTrainingWeek(state);
      const after = result.players.find(player => player.id === playerId)!.attrs.sho;
      weeklyGains.push(after - before);
      state = { ...state, players: result.players };
    }

    expect(weeklyGains).toEqual([3, 3, 3, 4]);
    expect(state.players.find(player => player.id === playerId)?.coachTrainingBonusRemainders?.sho)
      .toBe(20);
  });

  test('caps gains at each player personal ceiling while preserving an above-cap rating', () => {
    const initial = createCareer({ ...createLaunchCareerSetup(90213), careerMode: 'full' });
    const roster = initial.players.filter(player => player.clubId === initial.userClubId);
    const cappedId = roster[0].id;
    const exceptionalId = roster[1].id;
    const baseAttrs = { pac: 40, sho: 40, pas: 40, def: 40, tec: 40, sta: 40, ref: 40 };
    const profile = {
      ...roster[0],
      role: 'FWD' as const,
      archetype: 'Sniper' as const,
      potential: 2 as const,
      potentialCeiling: 60,
      attrs: baseAttrs,
    };
    const personalShootingCap = playerAttributeCaps(profile).sho;
    const state = {
      ...initial,
      trainingPoints: 100,
      players: initial.players.map(player => {
        if (player.id === cappedId) return { ...profile, age: 20 };
        if (player.id === exceptionalId) {
          return {
            ...profile,
            id: exceptionalId,
            age: 20,
            attrs: { ...baseAttrs, sho: personalShootingCap + 1 },
          };
        }
        return player;
      }),
      trainingPlan: {
        assignedPlayerIds: [cappedId, exceptionalId],
        drills: [
          { id: 'personal-cap-check', moneyCost: 0, tpCost: 0, gains: { sho: 99 } },
        ],
      },
    };

    const players = resolveCareerTrainingWeek(state).players;
    const capped = players.find(player => player.id === cappedId)!;
    const exceptional = players.find(player => player.id === exceptionalId)!;

    expect(personalShootingCap).toBeLessThan(95);
    expect(capped.attrs.sho).toBe(personalShootingCap);
    expect(exceptional.attrs.sho).toBe(personalShootingCap + 1);
  });
});
