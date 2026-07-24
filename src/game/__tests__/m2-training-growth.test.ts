import { createLaunchCareerSetup } from '../../application/launch';
import { playerAttributeCaps } from '../archetype-caps';
import { createCareer } from '../career';
import { trainingDrillBlockedReason } from '../promotion-progression';
import {
  pendingTrainingInterrupts,
  resolveCareerTrainingWeek,
  setCareerTrainingPlan,
} from '../training';

describe('M2 player-specific training growth', () => {
  test('applies the age curve to deliberate stamina training', () => {
    const initial = createCareer({ ...createLaunchCareerSetup(90210), careerMode: 'full' });
    const playerId = initial.players.find(player => player.clubId === initial.userClubId)!.id;
    const prepare = (age: number) => ({
      ...initial,
      trainingPoints: 100,
      trainingPlan: { slots: [{ playerId, pathId: 'circuit' }] },
      players: initial.players.map(player => player.id === playerId
        ? {
            ...player,
            age,
            archetype: 'All-Rounder' as const,
            potentialCeiling: 99,
            attrs: { ...player.attrs, sta: 50 },
          }
        : player),
    });

    const young = resolveCareerTrainingWeek(prepare(20)).players.find(player => player.id === playerId)!;
    const prime = resolveCareerTrainingWeek(prepare(25)).players.find(player => player.id === playerId)!;

    expect(young.attrs.sta).toBe(55);
    expect(prime.attrs.sta).toBe(53);
  });

  test('uses the matching facility level without a high-stat growth wall', () => {
    const initial = createCareer({ ...createLaunchCareerSetup(90211), careerMode: 'full' });
    const playerId = initial.players.find(player => player.clubId === initial.userClubId)!.id;
    const state = {
      ...initial,
      trainingPoints: 100,
      trainingPlan: { slots: [{ playerId, pathId: 'circuit' }] },
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

    // Circuit I's +3 STA, Engine +15%, and Lv3 Gym x2 still add seven points at 90.
    expect(player.attrs.sta).toBe(97);
  });

  test('banks combined fractional development bonuses after structural multipliers', () => {
    const initial = createCareer({ ...createLaunchCareerSetup(90212), careerMode: 'full' });
    const playerId = initial.players.find(player => player.clubId === initial.userClubId)!.id;
    // Level 1 (not 4): a real tier-I drill's fixed +3 gain, times the Lv3
    // shooting-range x2 multiplier, must stay under a 100-hundredths coach
    // bonus in week one so the fraction genuinely carries into week two.
    const coach = {
      id: 'rounding-coach',
      name: 'Rounding Coach',
      specialties: ['ATTACK', 'DEFENSE'] as const,
      level: 1,
      weeklyWage: 1_000,
      personality: 'PROFESSIONAL' as const,
      requiredDivision: 5,
      requiredFame: 0,
      loyaltyDiscountPercent: 0,
    };
    const state = {
      ...initial,
      trainingPoints: 100,
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
      trainingPlan: { slots: [{ playerId, pathId: 'finishing' }] },
    };

    const firstWeek = resolveCareerTrainingWeek(state);
    const firstPlayer = firstWeek.players.find(candidate => candidate.id === playerId)!;
    const secondWeek = resolveCareerTrainingWeek({ ...state, players: firstWeek.players });
    const secondPlayer = secondWeek.players.find(candidate => candidate.id === playerId)!;

    // Each week has +6 base growth (tier-I +3 x Lv3 facility x2) and a combined
    // 13% coach-plus-potential bonus. The first week banks 78 hundredths; the
    // second releases one extra point and carries 56.
    expect(firstPlayer.attrs.sho).toBe(56);
    expect(firstPlayer.trainingBonusRemainders?.sho).toBe(78);
    expect(secondPlayer.attrs.sho).toBe(63);
    expect(secondPlayer.trainingBonusRemainders?.sho).toBe(56);
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
      // A real tier-I 'finishing' slot gives the same fixed +3 gain the old
      // synthetic drill used, so the coach math is unchanged.
      trainingPlan: { slots: [{ playerId, pathId: 'finishing' }] },
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
    expect(state.players.find(player => player.id === playerId)?.trainingBonusRemainders?.sho)
      .toBe(20);
  });

  test('allows gains through 99 and stops only at the universal 999 ceiling', () => {
    const initial = createCareer({ ...createLaunchCareerSetup(90213), careerMode: 'full' });
    const roster = initial.players.filter(player => player.clubId === initial.userClubId);
    const growingId = roster[0].id;
    const maximumId = roster[1].id;
    const baseAttrs = { pac: 40, sho: 40, pas: 40, def: 40, tec: 40, sta: 40, ref: 40 };
    const profile = {
      ...roster[0],
      role: 'FWD' as const,
      archetype: 'Sniper' as const,
      potential: 2 as const,
      potentialCeiling: 60,
      attrs: baseAttrs,
    };
    const state = {
      ...initial,
      trainingPoints: 100,
      players: initial.players.map(player => {
        if (player.id === growingId) {
          return { ...profile, age: 20, attrs: { ...baseAttrs, sho: 98 } };
        }
        if (player.id === maximumId) {
          return {
            ...profile,
            id: maximumId,
            age: 20,
            attrs: { ...baseAttrs, sho: 998 },
          };
        }
        return player;
      }),
      trainingPlan: {
        slots: [
          { playerId: growingId, pathId: 'finishing' },
          { playerId: maximumId, pathId: 'finishing' },
        ],
      },
    };

    const players = resolveCareerTrainingWeek(state).players;
    const growing = players.find(player => player.id === growingId)!;
    const maximum = players.find(player => player.id === maximumId)!;

    expect(growing.attrs.sho).toBeGreaterThan(99);
    expect(maximum.attrs.sho).toBe(999);
  });

  test('skips only a player already at 999 while charging for the executable slot', () => {
    const initial = createCareer({ ...createLaunchCareerSetup(90215), careerMode: 'full' });
    const roster = initial.players.filter(player => player.clubId === initial.userClubId);
    const capped = roster[0];
    const eligible = roster.find(player => (
      player.id !== capped.id && playerAttributeCaps(player).pac > player.attrs.pac
    ))!;
    const state = {
      ...initial,
      trainingPoints: 100,
      players: initial.players.map(player => player.id === capped.id
        ? { ...player, attrs: { ...player.attrs, pac: playerAttributeCaps(player).pac } }
        : player),
      trainingPlan: {
        slots: [
          { playerId: capped.id, pathId: 'sprints' },
          { playerId: eligible.id, pathId: 'sprints' },
        ],
      },
    };
    const result = resolveCareerTrainingWeek(state);

    expect(result.players.find(player => player.id === capped.id)?.attrs.pac)
      .toBe(playerAttributeCaps(state.players.find(player => player.id === capped.id)!).pac);
    expect(result.players.find(player => player.id === eligible.id)?.attrs.pac)
      .toBeGreaterThan(eligible.attrs.pac);
    // The 999 slot is excluded from the executable set entirely.
    expect(result.trainingPoints).toBe(94);
    expect(result.moneyCost).toBe(0);
    // The rare safety maximum is surfaced before settlement.
    expect(pendingTrainingInterrupts(state, state.trainingPoints).cappedSlots).toContainEqual(
      expect.objectContaining({ playerId: capped.id, pathId: 'sprints', attribute: 'pac' }),
    );
  });

  test('saves a plan at the universal maximum without requiring unusable resources', () => {
    const initial = createCareer({ ...createLaunchCareerSetup(90216), careerMode: 'full' });
    const player = initial.players.find(candidate => candidate.clubId === initial.userClubId)!;
    const state = {
      ...initial,
      trainingPoints: 0,
      clubs: initial.clubs.map(club => club.id === initial.userClubId
        ? { ...club, cash: 0 }
        : club),
      players: initial.players.map(candidate => candidate.id === player.id
        ? { ...candidate, attrs: { ...candidate.attrs, pac: playerAttributeCaps(candidate).pac } }
        : candidate),
    };

    const planned = setCareerTrainingPlan(state, [{ playerId: player.id, pathId: 'sprints' }]);

    expect(planned.trainingPlan?.slots).toEqual([{ playerId: player.id, pathId: 'sprints' }]);
    expect(pendingTrainingInterrupts(planned, 0).cappedSlots).toContainEqual(expect.objectContaining({
      playerId: player.id,
      pathId: 'sprints',
      attribute: 'pac',
    }));
  });

  test('a player can occupy only one training slot', () => {
    const initial = {
      ...createCareer({ ...createLaunchCareerSetup(90217), careerMode: 'full' }),
      trainingPoints: 100,
    };
    const player = initial.players.find(candidate => candidate.clubId === initial.userClubId)!;

    expect(() => setCareerTrainingPlan(initial, [
      { playerId: player.id, pathId: 'sprints' },
      { playerId: player.id, pathId: 'finishing' },
    ])).toThrow('a player can occupy only one training slot');
  });

  test('unlocks drill tiers from the permanent best division reached', () => {
    const initial = {
      ...createCareer({ ...createLaunchCareerSetup(90219), careerMode: 'full' }),
      trainingPoints: 100,
    };

    expect(trainingDrillBlockedReason(initial, 'sprints-ii'))
      .toBe('Tier 2 drills unlock in D4 · County League.');

    // The active pyramid is still Division 5: the stored best division keeps
    // the earned tier unlocked after relegation.
    const reachedDivisionFour = {
      ...initial,
      m2: { ...initial.m2!, highestDivisionReached: 4 as const },
    };
    expect(trainingDrillBlockedReason(reachedDivisionFour, 'sprints-ii')).toBeUndefined();
    expect(trainingDrillBlockedReason(reachedDivisionFour, 'sprints-iii'))
      .toBe('Tier 3 drills unlock in D2 · National Championship.');

    const reachedDivisionTwo = {
      ...initial,
      m2: { ...initial.m2!, highestDivisionReached: 2 as const },
    };
    expect(trainingDrillBlockedReason(reachedDivisionTwo, 'sprints-iii')).toBeUndefined();
  });
});
