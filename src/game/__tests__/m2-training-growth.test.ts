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
  test('applies the age curve only in full careers', () => {
    const setup = createLaunchCareerSetup(90210);
    const m1 = createCareer(setup);
    const full = createCareer({ ...setup, careerMode: 'full' });
    const playerId = full.players.find(player => player.clubId === full.userClubId)!.id;
    const prepare = (state: typeof full) => ({
      ...state,
      players: state.players.map(player => player.id === playerId
        ? {
            ...player,
            age: 20,
            archetype: 'All-Rounder' as const,
            potentialCeiling: 99,
            attrs: { ...player.attrs, sta: 50 },
          }
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

    // Each week has +6 base growth (tier-I +3 x Lv3 facility x2) and a 10%
    // coach bonus (60 hundredths). The fractional coach portion carries, so
    // the first week banks it and the second week releases the extra point.
    expect(firstPlayer.attrs.sho).toBe(56);
    expect(firstPlayer.coachTrainingBonusRemainders?.sho).toBe(60);
    expect(secondPlayer.attrs.sho).toBe(63);
    expect(secondPlayer.coachTrainingBonusRemainders?.sho).toBe(20);
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
        // Starts one point short of the cap so any real drill gain (minimum
        // +1) reaches it in a single settlement, without needing a
        // synthetic +99 gain the new catalog can't produce.
        if (player.id === cappedId) {
          return { ...profile, age: 20, attrs: { ...baseAttrs, sho: personalShootingCap - 1 } };
        }
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
        slots: [
          { playerId: cappedId, pathId: 'finishing' },
          { playerId: exceptionalId, pathId: 'finishing' },
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

  test('skips only the capped player while charging TP for both slots', () => {
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
    // TP is charged per slot now (6 for the one eligible tier-I slot); the
    // capped slot is excluded from the executable set entirely.
    expect(result.trainingPoints).toBe(94);
    expect(result.moneyCost).toBe(0);
    // Skipped-cap notices are gone; capping is surfaced via the pre-settlement
    // interrupt check instead.
    expect(pendingTrainingInterrupts(state, state.trainingPoints).cappedSlots).toContainEqual(
      expect.objectContaining({ playerId: capped.id, pathId: 'sprints', attribute: 'pac' }),
    );
  });

  test('saves a fully capped plan without requiring resources that cannot be charged', () => {
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
