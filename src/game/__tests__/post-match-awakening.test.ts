import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createLaunchCareerSetup } from '../../application/launch';
import { advanceWeek, createCareer } from '../career';
import { applyCareerContractPromise } from '../contract-promises';
import {
  buildCareerMatchTeamDef,
  buildCareerTeamDef,
  repairCareerLineupForInjuries,
  selectCareerLicensedHeroes,
} from '../squad';
import {
  awakeningChancePercent,
  completePostMatchAwakening,
  deterministicPostMatchAwakeningRoll,
  resolvePostMatchAwakening,
} from '../post-match-awakening';
import type { GameState } from '../types';
import { LAUNCH_POWER_IDS } from '../power-catalog';

const POWERS = ['SUPER_SPEED', 'SUPER_STRENGTH', 'FIRE_TORCH'] as const;
const TRIGGERS = [
  'glowing-caterpillar',
  'magic-sponge',
  'runaway-sprinkler',
] as const;
const TUNING = {
  weeklyChanceStepPercent: 5,
  maxPerSeason: 1,
  minimumMatchesBetween: 3,
} as const;

describe('automatic post-match awakenings', () => {
  it('guarantees the created player a random stat-fit power after match one', () => {
    const initial = playedUserFixture(
      createCareer(createLaunchCareerSetup(17)),
    );
    const playerId = userLineup(initial)[9];
    const state: GameState = {
      ...initial,
      onboarding: {
        stage: 'first-match',
        createdPlayerId: playerId,
        firstFixtureId: userFixture(initial).id,
      },
    };

    const result = resolvePostMatchAwakening(
      state,
      userFixture(state).id,
      userLineup(state),
      POWERS,
      TRIGGERS,
      TUNING,
    );

    expect(result.awakened).toBe(true);
    expect(
      result.state.players.find((player) => player.id === playerId),
    ).toMatchObject({
      power: expect.stringMatching(/SUPER_SPEED|SUPER_STRENGTH|FIRE_TORCH/),
      licensed: true,
    });
    expect(result.state.awakening).toMatchObject({
      matchesSinceLastAwakening: 0,
      pending: { playerId, firstHero: true },
    });
    expect(result.state.onboarding).toMatchObject({ stage: 'reveal' });
    expect(completePostMatchAwakening(result.state)).toMatchObject({
      onboarding: { stage: 'complete' },
      awakening: { matchesSinceLastAwakening: 0 },
    });
  });

  it('cannot trigger until the third completed match after the previous awakening', () => {
    let state = playedUserFixture(createCareer(createLaunchCareerSetup(23)));
    const fixtureId = userFixture(state).id;
    const forcedChance = {
      weeklyChanceStepPercent: 100,
      maxPerSeason: 99,
      minimumMatchesBetween: 3,
    } as const;

    const first = resolvePostMatchAwakening(
      state,
      fixtureId,
      userLineup(state),
      POWERS,
      TRIGGERS,
      forcedChance,
    );
    expect(first.awakened).toBe(false);
    expect(first.state.awakening.matchesSinceLastAwakening).toBe(1);

    state = {
      ...first.state,
      awakening: { matchesSinceLastAwakening: 1, usedTriggerIds: [] },
    };
    const second = resolvePostMatchAwakening(
      state,
      fixtureId,
      userLineup(state),
      POWERS,
      TRIGGERS,
      forcedChance,
    );
    expect(second.awakened).toBe(false);
    expect(second.state.awakening.matchesSinceLastAwakening).toBe(2);

    state = {
      ...second.state,
      awakening: { matchesSinceLastAwakening: 2, usedTriggerIds: [] },
    };
    const third = resolvePostMatchAwakening(
      state,
      fixtureId,
      userLineup(state),
      POWERS,
      TRIGGERS,
      forcedChance,
    );
    expect(third.awakened).toBe(true);
  });

  it('uses a free Hero License for a later awakening', () => {
    const initial = playedUserFixture(
      createCareer(createLaunchCareerSetup(20260821)),
    );
    const targetId = userLineup(initial)[2];
    const state: GameState = {
      ...initial,
      awakening: { matchesSinceLastAwakening: 2, usedTriggerIds: [] },
    };

    const promised = applyCareerContractPromise(
      state,
      targetId,
      'GUARANTEED_STARTER',
    );
    const result = resolvePostMatchAwakening(
      promised,
      userFixture(promised).id,
      [targetId],
      POWERS,
      TRIGGERS,
      {
        weeklyChanceStepPercent: 100,
        maxPerSeason: 99,
        minimumMatchesBetween: 3,
      },
    );

    expect(result.awakened).toBe(true);
    expect(
      result.state.players.find((player) => player.id === targetId),
    ).toMatchObject({ power: expect.any(String), licensed: true });
    expect(userLineup(result.state)).toContain(targetId);
    expect(
      result.state.players.find((player) => player.id === targetId)
        ?.returnLineupSlot,
    ).toBeUndefined();
  });

  it('uses one stable roll and always grants a power when it triggers', () => {
    const base = createCareer(createLaunchCareerSetup(1));
    const fixtureId = userFixture(base).id;
    // Round 1 sits on the season's first league week, so the climb is still at
    // a single step there.
    const openingChance = awakeningChancePercent(
      TUNING.weeklyChanceStepPercent,
      userFixture(base).season,
      userFixture(base).week,
    );
    expect(openingChance).toBe(TUNING.weeklyChanceStepPercent);
    const seed = Array.from({ length: 1000 }, (_, index) => index + 1).find(
      (candidate) =>
        deterministicPostMatchAwakeningRoll(candidate, fixtureId, 0, 100) <
        openingChance,
    );
    expect(seed).toBeDefined();
    const state = {
      ...playedUserFixture(createCareer(createLaunchCareerSetup(seed!))),
      awakening: { matchesSinceLastAwakening: 2, usedTriggerIds: [] },
    };

    const first = resolvePostMatchAwakening(
      state,
      fixtureId,
      userLineup(state),
      POWERS,
      TRIGGERS,
      TUNING,
    );
    const second = resolvePostMatchAwakening(
      state,
      fixtureId,
      userLineup(state),
      POWERS,
      TRIGGERS,
      TUNING,
    );

    expect(first).toEqual(second);
    expect(first.awakened).toBe(true);
    const pending = first.state.awakening.pending!;
    expect(POWERS).toContain(pending.power);
    expect(
      first.state.players.find((player) => player.id === pending.playerId)
        ?.power,
    ).toBe(pending.power);
  });

  /**
   * A season produces at most one hero. Season 1 is the exception: its opening
   * hero is a free campaign gift, so that year has room for a second, and that
   * second is a long shot rather than the expected other half of the year.
   * Without the cap a 10% roll every third match handed out two or more heroes
   * in a third of seasons, and a squad turned super inside a couple of years.
   */
  describe('the season cap', () => {
    const forced = {
      weeklyChanceStepPercent: 100,
      maxPerSeason: 1,
      minimumMatchesBetween: 0,
    } as const;

    /** Strips every power so the next roll always has someone to land on. */
    function readyForAnother(state: GameState): GameState {
      return {
        ...state,
        players: state.players.map((player) =>
          player.clubId === state.userClubId
            ? { ...player, power: undefined, licensed: false }
            : player,
        ),
        awakening: {
          ...state.awakening,
          matchesSinceLastAwakening: 0,
          pending: undefined,
        },
      };
    }

    it('refuses a third hero in one season however many matches are played', () => {
      let state = playedUserFixture(createCareer(createLaunchCareerSetup(53)));
      const fixtureId = userFixture(state).id;

      for (const expected of [true, true, false, false]) {
        const result = resolvePostMatchAwakening(
          readyForAnother(state),
          fixtureId,
          userLineup(state),
          POWERS,
          TRIGGERS,
          forced,
        );
        expect(result.awakened).toBe(expected);
        state = result.awakened
          ? completePostMatchAwakening(result.state)
          : result.state;
      }
      expect(state.awakening.seasonTally).toEqual({
        season: state.season,
        count: 2,
      });
    });

    it('refuses a second hero in any season after the first', () => {
      const start = playedUserFixture(
        createCareer(createLaunchCareerSetup(53)),
      );
      let state: GameState = { ...start, season: 2 };
      const fixtureId = userFixture(state).id;

      for (const expected of [true, false, false]) {
        const result = resolvePostMatchAwakening(
          readyForAnother(state),
          fixtureId,
          userLineup(state),
          POWERS,
          TRIGGERS,
          forced,
        );
        expect(result.awakened).toBe(expected);
        state = result.awakened
          ? completePostMatchAwakening(result.state)
          : result.state;
      }
      expect(state.awakening.seasonTally).toEqual({ season: 2, count: 1 });
    });

    it('counts the guaranteed opening hero, so season one has room for one more', () => {
      const initial = playedUserFixture(
        createCareer(createLaunchCareerSetup(59)),
      );
      const playerId = userLineup(initial)[9];
      const opening = resolvePostMatchAwakening(
        {
          ...initial,
          onboarding: {
            stage: 'first-match',
            createdPlayerId: playerId,
            firstFixtureId: userFixture(initial).id,
          },
        },
        userFixture(initial).id,
        userLineup(initial),
        POWERS,
        TRIGGERS,
        forced,
      );

      expect(opening.state.awakening.seasonTally).toEqual({
        season: initial.season,
        count: 1,
      });
    });

    it('starts the next season fresh without anything clearing the tally', () => {
      const state = playedUserFixture(
        createCareer(createLaunchCareerSetup(61)),
      );
      const finished: GameState = {
        ...state,
        awakening: {
          ...state.awakening,
          seasonTally: { season: state.season - 1, count: 2 },
        },
      };

      const result = resolvePostMatchAwakening(
        finished,
        userFixture(finished).id,
        userLineup(finished),
        POWERS,
        TRIGGERS,
        forced,
      );

      expect(result.awakened).toBe(true);
      expect(result.state.awakening.seasonTally).toEqual({
        season: state.season,
        count: 1,
      });
    });

    it('survives the cutscene it was spent on', () => {
      let state = playedUserFixture(createCareer(createLaunchCareerSetup(67)));
      const result = resolvePostMatchAwakening(
        readyForAnother(state),
        userFixture(state).id,
        userLineup(state),
        POWERS,
        TRIGGERS,
        forced,
      );
      state = completePostMatchAwakening(result.state);

      expect(state.awakening.seasonTally).toEqual({
        season: state.season,
        count: 1,
      });
    });

    /**
     * Every path that rebuilds `state.awakening` from its parts has to carry
     * the tally, or the season quietly gets its allowance back. Two in the
     * store did not: the content-drop fallback that retires a cutscene whose
     * power copy this build no longer ships, and the legacy repair that
     * rebuilds a first-hero cutscene for a save written before automatic
     * awakenings. This is the shape test for all of them.
     */
    it('is carried by every rebuild of the awakening state', () => {
      const rebuilds =
        readFileSync(
          join(process.cwd(), 'src/application/store.ts'),
          'utf8',
        ).match(/awakening: \{\n(?:.*\n)*?\s*\},/g) ?? [];
      const fromParts = rebuilds.filter((block) =>
        block.includes('usedTriggerIds'),
      );

      expect(fromParts.length).toBeGreaterThan(0);
      for (const block of fromParts) {
        expect(block).toContain('seasonTally');
      }
    });

    it('gives season 1 second hero the same climbing roll as the first', () => {
      const base = playedUserFixture(createCareer(createLaunchCareerSetup(71)));
      const fixtureId = userFixture(base).id;
      // Bracket this fixture's roll instead of hunting a seed: a step that
      // clears it by one point is the whole chance, and the club already
      // holding a hero must face exactly the same number.
      const roll = deterministicPostMatchAwakeningRoll(
        base.careerSeed,
        fixtureId,
        0,
        100,
      );
      const bracketed = {
        weeklyChanceStepPercent: roll + 1,
        maxPerSeason: 1,
        minimumMatchesBetween: 0,
      } as const;

      const withOne: GameState = {
        ...base,
        awakening: {
          ...base.awakening,
          seasonTally: { season: base.season, count: 1 },
        },
      };
      expect(
        resolvePostMatchAwakening(
          base,
          fixtureId,
          userLineup(base),
          POWERS,
          TRIGGERS,
          bracketed,
        ).awakened,
      ).toBe(true);
      expect(
        resolvePostMatchAwakening(
          withOne,
          fixtureId,
          userLineup(withOne),
          POWERS,
          TRIGGERS,
          bracketed,
        ).awakened,
      ).toBe(true);
    });
  });

  it('climbs five points a week from each season own opening week', () => {
    const step = TUNING.weeklyChanceStepPercent;
    // Season 1 opens two weeks early, so both years start at one step.
    expect(awakeningChancePercent(step, 1, 3)).toBe(5);
    expect(awakeningChancePercent(step, 2, 5)).toBe(5);
    expect(awakeningChancePercent(step, 2, 6)).toBe(10);
    expect(awakeningChancePercent(step, 2, 15)).toBe(55);
    expect(awakeningChancePercent(step, 2, 24)).toBe(100);
    // The climb never overshoots, and the season finale is always certain.
    expect(awakeningChancePercent(step, 2, 30)).toBe(100);
  });

  it('cannot miss once the climb has reached certainty', () => {
    const late = lateSeasonUserFixture(
      createCareer(createLaunchCareerSetup(41)),
    );
    expect(
      awakeningChancePercent(
        TUNING.weeklyChanceStepPercent,
        late.fixture.season,
        late.fixture.week,
      ),
    ).toBe(100);

    const result = resolvePostMatchAwakening(
      late.state,
      late.fixture.id,
      userLineup(late.state),
      POWERS,
      TRIGGERS,
      TUNING,
    );

    expect(result.awakened).toBe(true);
  });

  it('uses every trigger once before allowing randomized repeats', () => {
    let state = playedUserFixture(createCareer(createLaunchCareerSetup(31)));
    const fixtureId = userFixture(state).id;
    const forcedChance = {
      weeklyChanceStepPercent: 100,
      maxPerSeason: 99,
      minimumMatchesBetween: 0,
    } as const;
    const seen: string[] = [];

    for (let index = 0; index < TRIGGERS.length; index += 1) {
      state = {
        ...state,
        players: state.players.map((player) =>
          player.clubId === state.userClubId
            ? { ...player, power: undefined, licensed: false }
            : player,
        ),
        awakening: {
          ...state.awakening,
          matchesSinceLastAwakening: 0,
          pending: undefined,
        },
      };
      const result = resolvePostMatchAwakening(
        state,
        fixtureId,
        userLineup(state),
        POWERS,
        TRIGGERS,
        forcedChance,
      );
      expect(result.awakened).toBe(true);
      seen.push(result.state.awakening.pending!.triggerId);
      state = completePostMatchAwakening(result.state);
    }

    expect(new Set(seen)).toEqual(new Set(TRIGGERS));
    expect(state.awakening.usedTriggerIds).toHaveLength(TRIGGERS.length);
  });

  it('requires the created player to have taken part in the first match', () => {
    const initial = playedUserFixture(
      createCareer(createLaunchCareerSetup(41)),
    );
    const playerId = userLineup(initial)[9];
    const state: GameState = {
      ...initial,
      onboarding: {
        stage: 'collapse',
        createdPlayerId: playerId,
        firstFixtureId: userFixture(initial).id,
      },
    };

    expect(() =>
      resolvePostMatchAwakening(
        state,
        userFixture(state).id,
        userLineup(state).filter((id) => id !== playerId),
        POWERS,
        TRIGGERS,
        TUNING,
      ),
    ).toThrow('must take part');
  });

  it('auto-benches a third unlicensed hero so the next lineup remains valid', () => {
    const initial = playedUserFixture(
      createCareer(createLaunchCareerSetup(53)),
    );
    const lineup = userLineup(initial);
    const targetId = lineup[2];
    const state: GameState = {
      ...initial,
      players: initial.players.map((player) =>
        player.id === lineup[0]
          ? { ...player, power: 'SUPER_SPEED' as const, licensed: true }
          : player.id === lineup[1]
            ? { ...player, power: 'FIRE_TORCH' as const, licensed: true }
            : player,
      ),
      awakening: { matchesSinceLastAwakening: 2, usedTriggerIds: [] },
    };
    const licensedBefore = state.players
      .filter((player) => player.clubId === state.userClubId && player.licensed)
      .map((player) => player.id)
      .sort();

    const result = resolvePostMatchAwakening(
      state,
      userFixture(state).id,
      [targetId],
      POWERS,
      TRIGGERS,
      {
        weeklyChanceStepPercent: 100,
        maxPerSeason: 99,
        minimumMatchesBetween: 3,
      },
    );

    expect(
      result.state.players.find((player) => player.id === targetId),
    ).toMatchObject({
      power: expect.any(String),
      licensed: false,
    });
    expect(userLineup(result.state)).not.toContain(targetId);
    expect(
      result.state.players
        .filter(
          (player) =>
            player.clubId === result.state.userClubId && player.licensed,
        )
        .map((player) => player.id)
        .sort(),
    ).toEqual(licensedBefore);
    expect(() =>
      buildCareerTeamDef(result.state, result.state.userClubId),
    ).not.toThrow();

    const returned = selectCareerLicensedHeroes(result.state, [
      licensedBefore[0]!,
      targetId,
    ]);
    expect(userLineup(returned)[2]).toBe(targetId);
    expect(
      returned.players.find((player) => player.id === targetId)
        ?.returnLineupSlot,
    ).toBeUndefined();
  });

  it('skips a fit promised starter when every Hero License is already in use', () => {
    const initial = playedUserFixture(
      createCareer(createLaunchCareerSetup(54)),
    );
    const lineup = userLineup(initial);
    const promisedId = lineup[2];
    const withFullLicenses: GameState = {
      ...initial,
      players: initial.players.map((player) =>
        player.id === lineup[9]
          ? { ...player, power: 'SUPER_SPEED' as const, licensed: true }
          : player.id === lineup[10]
            ? { ...player, power: 'FIRE_TORCH' as const, licensed: true }
            : player,
      ),
      awakening: { matchesSinceLastAwakening: 2, usedTriggerIds: [] },
    };
    const promised = applyCareerContractPromise(
      withFullLicenses,
      promisedId,
      'GUARANTEED_STARTER',
    );

    const result = resolvePostMatchAwakening(
      promised,
      userFixture(promised).id,
      [promisedId],
      POWERS,
      TRIGGERS,
      {
        weeklyChanceStepPercent: 100,
        maxPerSeason: 99,
        minimumMatchesBetween: 3,
      },
    );

    expect(result.awakened).toBe(false);
    expect(result.state.awakening.pending).toBeUndefined();
    expect(
      result.state.players.find((player) => player.id === promisedId)?.power,
    ).toBeUndefined();
    expect(userLineup(result.state)).toContain(promisedId);
    expect(() =>
      buildCareerTeamDef(result.state, result.state.userClubId),
    ).not.toThrow();
  });

  it('awakens a safe alternative and remains buildable through Cup, injury repair, and settlement', () => {
    const initial = playedUserFixture(
      createCareer(createLaunchCareerSetup(55)),
    );
    const lineup = userLineup(initial);
    const promisedId = lineup[2];
    const safeId = lineup[5];
    const injuredId = lineup[6];
    const withFullLicenses: GameState = {
      ...initial,
      players: initial.players.map((player) =>
        player.id === lineup[9]
          ? { ...player, power: 'SUPER_SPEED' as const, licensed: true }
          : player.id === lineup[10]
            ? { ...player, power: 'FIRE_TORCH' as const, licensed: true }
            : player,
      ),
      awakening: { matchesSinceLastAwakening: 2, usedTriggerIds: [] },
    };
    const promised = applyCareerContractPromise(
      withFullLicenses,
      promisedId,
      'CAPTAINCY',
    );

    const awakening = resolvePostMatchAwakening(
      promised,
      userFixture(promised).id,
      [promisedId, safeId],
      POWERS,
      TRIGGERS,
      {
        weeklyChanceStepPercent: 100,
        maxPerSeason: 99,
        minimumMatchesBetween: 3,
      },
    );

    expect(awakening.awakened).toBe(true);
    expect(awakening.state.awakening.pending?.playerId).toBe(safeId);
    expect(
      awakening.state.players.find((player) => player.id === promisedId)?.power,
    ).toBeUndefined();
    expect(
      awakening.state.players.find((player) => player.id === safeId),
    ).toMatchObject({
      power: expect.any(String),
      licensed: false,
    });

    const revealed = completePostMatchAwakening(awakening.state);
    const cupFixture = revealed.m2!.nationalCups[0].rounds[0].fixtures.find(
      (fixture) =>
        fixture.homeClubId === revealed.userClubId ||
        fixture.awayClubId === revealed.userClubId,
    );
    expect(cupFixture).toBeDefined();
    const cupClubId =
      cupFixture!.homeClubId === revealed.userClubId
        ? cupFixture!.awayClubId
        : cupFixture!.homeClubId;
    expect(() =>
      buildCareerMatchTeamDef(revealed, revealed.userClubId),
    ).not.toThrow();
    expect(() => buildCareerMatchTeamDef(revealed, cupClubId)).not.toThrow();

    const injured: GameState = {
      ...revealed,
      players: revealed.players.map((player) =>
        player.id === injuredId ? { ...player, injuryWeeks: 2 } : player,
      ),
    };
    const repaired = repairCareerLineupForInjuries(injured);
    expect(userLineup(repaired)).toContain(promisedId);
    expect(() =>
      buildCareerTeamDef(repaired, repaired.userClubId),
    ).not.toThrow();

    const settled = advanceWeek({ ...repaired, phase: 'manage' });
    expect(() => buildCareerTeamDef(settled, settled.userClubId)).not.toThrow();
  });

  it('chooses from the role-safe three-power goalkeeper pool', () => {
    const initial = playedUserFixture(
      createCareer(createLaunchCareerSetup(63)),
    );
    const goalkeeperId = userLineup(initial)[0];
    const result = resolvePostMatchAwakening(
      {
        ...initial,
        awakening: { matchesSinceLastAwakening: 2, usedTriggerIds: [] },
      },
      userFixture(initial).id,
      [goalkeeperId],
      LAUNCH_POWER_IDS,
      TRIGGERS,
      {
        weeklyChanceStepPercent: 100,
        maxPerSeason: 99,
        minimumMatchesBetween: 3,
      },
    );

    expect(
      result.state.players.find((player) => player.id === goalkeeperId)?.power,
    ).toBe('ELASTIC_KEEPER');
  });

  it('keeps Rally Cry out of a solo awakening until another hero exists', () => {
    const initial = playedUserFixture(
      createCareer(createLaunchCareerSetup(73)),
    );
    const playerId = userLineup(initial)[9];
    const firstState: GameState = {
      ...initial,
      onboarding: {
        stage: 'first-match',
        createdPlayerId: playerId,
        firstFixtureId: userFixture(initial).id,
      },
    };
    const first = resolvePostMatchAwakening(
      firstState,
      userFixture(firstState).id,
      userLineup(firstState),
      ['RALLY_CRY', 'SUPER_SPEED'],
      TRIGGERS,
      TUNING,
    );
    expect(first.state.awakening.pending?.power).toBe('SUPER_SPEED');

    const secondTarget = userLineup(initial)[10];
    const withTeammate: GameState = {
      ...initial,
      players: initial.players.map((player) =>
        player.id === playerId
          ? {
              ...player,
              power: 'SUPER_SPEED' as const,
              powerTier: 1 as const,
              licensed: true,
            }
          : player,
      ),
      awakening: { matchesSinceLastAwakening: 3, usedTriggerIds: [] },
    };
    const second = resolvePostMatchAwakening(
      withTeammate,
      userFixture(withTeammate).id,
      [secondTarget],
      ['RALLY_CRY'],
      TRIGGERS,
      {
        weeklyChanceStepPercent: 100,
        maxPerSeason: 99,
        minimumMatchesBetween: 3,
      },
    );
    expect(second.state.awakening.pending?.power).toBe('RALLY_CRY');
  });
});

function userFixture(state: GameState) {
  return state.fixtures.find(
    (fixture) =>
      fixture.homeClubId === state.userClubId ||
      fixture.awayClubId === state.userClubId,
  )!;
}

function userLineup(state: GameState): string[] {
  return state.lineups.find((lineup) => lineup.clubId === state.userClubId)!
    .playerIds;
}

function playedUserFixture(state: GameState): GameState {
  const fixtureId = userFixture(state).id;
  return {
    ...state,
    phase: 'manage',
    fixtures: state.fixtures.map((fixture) =>
      fixture.id === fixtureId
        ? {
            ...fixture,
            status: 'played' as const,
            score: { homeGoals: 1, awayGoals: 0 },
          }
        : fixture,
    ),
  };
}

/** The user's last league fixture, played, with the cooldown already served. */
function lateSeasonUserFixture(state: GameState): {
  state: GameState;
  fixture: GameState['fixtures'][number];
} {
  const fixture = [...state.fixtures]
    .filter(
      (candidate) =>
        candidate.homeClubId === state.userClubId ||
        candidate.awayClubId === state.userClubId,
    )
    .sort((left, right) => left.week - right.week)
    .at(-1)!;
  return {
    fixture,
    state: {
      ...state,
      phase: 'manage',
      awakening: { matchesSinceLastAwakening: 9, usedTriggerIds: [] },
      fixtures: state.fixtures.map((candidate) =>
        candidate.id === fixture.id
          ? {
              ...candidate,
              status: 'played' as const,
              score: { homeGoals: 1, awayGoals: 0 },
            }
          : candidate,
      ),
    },
  };
}
