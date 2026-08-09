/**
 * OPT-IN BALANCE PROBE:
 *   LONG_CAREER_DEVELOPMENT_PROBE=1 npm run test:probe -- \
 *     src/audit/__tests__/long-career-development-probe.test.ts
 *
 * Three starting players rotate through their position attributes every week.
 * TP is supplied so this isolates the requested development ceiling and match
 * balance from the separate training-income economy.
 */
import { createLaunchCareerSetup } from '../../application/launch';
import { loadLaunchContent } from '../../content';
import {
  addCreatedPlayer,
  BASE_WEEKLY_TRAINING_POINTS,
  beginStoryOnboarding,
  careerHeroLimit,
  coachWeeklyTrainingPoints,
  createCareer,
  DIVISION_GOALKEEPER_REF_RATINGS,
  DIVISION_SUPPORT_STRENGTHS,
  DIVISION_TYPICAL_PACE,
  divisionStarFocusedAttribute,
  generatedClubHeroCount,
  generatedClubPower,
  MAX_FACILITY_LEVEL,
  playerPotentialGrade,
  potentialTierForDivision,
  POSITION_TRAINING_ATTRIBUTES,
  resolveTrainingDrillForPath,
  roleOverall,
  TRAINING_PITCH_TP_PER_LEVEL,
  trainPlayerInstantly,
  type CareerPlayer,
  type DivisionLevel,
  type GameState,
} from '../../game';
import { runMatch } from '../../sim/match';
import { matchAttribute, paceAdvantagePercent } from '../../sim/attributes';
import type { Attrs, Role, TeamDef } from '../../sim/types';

const describeProbe =
  process.env.LONG_CAREER_DEVELOPMENT_PROBE === '1' ? describe : describe.skip;
const content = loadLaunchContent();
const PATH_BY_ATTRIBUTE: Readonly<Record<keyof Attrs, string>> = {
  pac: 'sprints',
  sho: 'finishing',
  pas: 'rondo',
  def: 'duels',
  tec: 'first-touch',
  sta: 'circuit',
  ref: 'keeper-drills',
};
const OPPONENT_MIDPOINT: Readonly<Record<DivisionLevel, number>> = {
  5: 45,
  4: 96,
  3: 143,
  2: 191,
  1: 236,
};
const FIFTEEN_SEASON_DIVISIONS = [
  5, 5, 4, 4, 3, 3, 2, 2, 1, 1, 1, 1, 1, 1, 1,
] as const satisfies readonly DivisionLevel[];
const MAX_NORMAL_WEEKLY_TP =
  BASE_WEEKLY_TRAINING_POINTS +
  MAX_FACILITY_LEVEL * TRAINING_PITCH_TP_PER_LEVEL +
  coachWeeklyTrainingPoints(5, 'HEAD') +
  coachWeeklyTrainingPoints(5, 'ASSISTANT');

describeProbe('long-career open-ended development', () => {
  it('reports fast and slow promotion growth with maximum user heroes', () => {
    const scenarios = [
      { name: 'fast', divisions: [5, 4, 3, 2, 1, 1] as DivisionLevel[] },
      {
        name: 'slow',
        divisions: [...FIFTEEN_SEASON_DIVISIONS],
      },
    ];
    const lines = [
      '',
      'scenario season div heroes traineeRaw lineupEff bestPAC typicalPAC pace+ oppClub oppFocus W D L points%',
    ];
    let maxStackedPeakAttribute = 0;
    const checkpoints: Array<{
      scenario: string;
      division: DivisionLevel;
      firstSeasonInDivision: boolean;
      pointsPercent: number;
      trainedStarRating: number;
    }> = [];

    for (const scenario of scenarios) {
      let state = probeCareer();
      let lineupIds = state.lineups.find(
        (lineup) => lineup.clubId === state.userClubId,
      )!.playerIds;
      const hero = state.players.find((player) =>
        player.id.endsWith('-created-player'),
      )!;
      const startingPlayers = lineupIds
        .map((id) => state.players.find((player) => player.id === id)!)
        .filter((player) => player.id !== hero.id && player.role !== 'GK');
      const trainees = [
        hero,
        startingPlayers.find((player) => player.role === 'DEF')!,
        startingPlayers.find((player) => player.role === 'MID')!,
      ];
      const traineeIds = trainees.map((player) => player.id);
      const visitedDivisions = new Set<DivisionLevel>();

      for (
        let seasonIndex = 0;
        seasonIndex < scenario.divisions.length;
        seasonIndex += 1
      ) {
        const division = scenario.divisions[seasonIndex];
        state = setHighestDivision(state, division);
        const firstSeasonInDivision = !visitedDivisions.has(division);
        visitedDivisions.add(division);
        const recruitment = addDivisionRecruitment(
          state,
          lineupIds,
          traineeIds,
          division,
          seasonIndex,
        );
        state = recruitment.state;
        lineupIds = recruitment.lineupIds;
        const expectedGradeFamily = (
          { 5: 'E', 4: 'D', 3: 'C', 2: 'B', 1: 'A' } as const
        )[division];
        expect(recruitment.youthGrade.startsWith(expectedGradeFamily)).toBe(
          true,
        );
        expect(
          recruitment.scoutGrade
            .split('/')
            .every((grade) => grade.startsWith(expectedGradeFamily)),
        ).toBe(true);
        lines.push(
          `  hires D${division}: youth ${recruitment.youthGrade} · scout ${recruitment.scoutGrade}`,
        );
        const heroLimit = careerHeroLimit(state);

        for (let week = 0; week < 30; week += 1) {
          state = { ...state, trainingPoints: 1_000_000 };
          for (const playerId of traineeIds) {
            const player = state.players.find(
              (candidate) => candidate.id === playerId,
            )!;
            if (player.injuryWeeks > 0) continue;
            const attributes = POSITION_TRAINING_ATTRIBUTES[player.role];
            const attribute =
              attributes[(seasonIndex * 30 + week) % attributes.length];
            state = trainPlayerInstantly(
              state,
              playerId,
              PATH_BY_ATTRIBUTE[attribute],
            ).state;
          }
          // Weekly recovery keeps the probe's one-drill-per-week cadence from
          // grinding trainees into the injury-gamble zone.
          state = {
            ...state,
            players: state.players.map((player) =>
              player.clubId === state.userClubId
                ? {
                    ...player,
                    condition: Math.min(100, (player.condition ?? 100) + 12),
                  }
                : player,
            ),
          };
        }

        const result = matchSample(
          state,
          division,
          OPPONENT_MIDPOINT[division],
          heroLimit,
          seasonIndex,
          traineeIds,
        );
        const userLineup = lineupIds.map((id) =>
          state.players.find((player) => player.id === id)!,
        );
        const traineeRoleRatings = traineeIds.map((id) => {
          const player = state.players.find(
            (candidate) => candidate.id === id,
          )!;
          return roleOverall(player.role, player.attrs);
        });
        const traineeAverage = Math.round(
          traineeIds.reduce(
            (sum, id) =>
              sum +
              roleOverall(
                state.players.find((player) => player.id === id)!.role,
                state.players.find((player) => player.id === id)!.attrs,
              ),
            0,
          ) / traineeIds.length,
        );
        const trainedStarRating = Math.max(...traineeRoleRatings);
        checkpoints.push({
          scenario: scenario.name,
          division,
          firstSeasonInDivision,
          pointsPercent: result.pointsPercent,
          trainedStarRating,
        });
        const lineupEffectiveAverage = Math.round(
          userLineup.reduce(
            (sum, player) =>
              sum + effectiveRoleOverall(player.role, player.attrs),
            0,
          ) / userLineup.length,
        );
        const bestPace = Math.max(
          ...userLineup.map((player) => player.attrs.pac),
        );
        const typicalPace = DIVISION_TYPICAL_PACE[division];
        const paceAdvantage = paceAdvantagePercent(bestPace, typicalPace);
        lines.push(
          [
            scenario.name.padEnd(9),
            String(seasonIndex + 1).padEnd(7),
            `D${division}`.padEnd(4),
            String(heroLimit).padEnd(10),
            String(traineeAverage).padEnd(11),
            String(lineupEffectiveAverage).padEnd(9),
            String(bestPace).padEnd(7),
            String(typicalPace).padEnd(10),
            `${paceAdvantage}%`.padEnd(5),
            String(OPPONENT_MIDPOINT[division]).padEnd(9),
            String(
              opponentFocusedRating(division, OPPONENT_MIDPOINT[division]),
            ).padEnd(8),
            String(result.win).padEnd(4),
            String(result.draw).padEnd(5),
            String(result.loss).padEnd(4),
            `${result.pointsPercent}%`,
          ].join(' '),
        );

        state = {
          ...state,
          players: state.players.map((player) =>
            player.clubId === state.userClubId
              ? { ...player, age: (player.age ?? 24) + 1 }
              : player,
          ),
        };
      }

      maxStackedPeakAttribute = Math.max(
        maxStackedPeakAttribute,
        ...state.players
          .filter((player) => traineeIds.includes(player.id))
          .flatMap((player) =>
            POSITION_TRAINING_ATTRIBUTES[player.role].map(
              (attribute) => player.attrs[attribute],
            ),
          ),
      );
    }

    const organicPeakAttribute = organicCareerPeakAttribute();
    lines.push(
      `organic  15 seasons, three-tap active manager, max normal TP: peak ${organicPeakAttribute}`,
    );
    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));
    // The supplied-TP policy intentionally drills the same three players every
    // week for fifteen years, so it is the deliberate max-stacking exception
    // in criterion 10. The organic policy uses only production-achievable TP
    // and the established active-manager cadence of three taps per week,
    // spreads those taps across the current XI, and recruits normally.
    expect(maxStackedPeakAttribute).toBe(999);
    expect(organicPeakAttribute).toBeGreaterThan(99);
    expect(organicPeakAttribute).toBeLessThan(999);
    const twoSeasonTrack = checkpoints.filter(
      (checkpoint) => checkpoint.scenario === 'slow',
    );
    expect(twoSeasonTrack).toHaveLength(15);
    for (const division of [5, 4, 3, 2, 1] as const) {
      const finalCheckpoint = twoSeasonTrack
        .filter((checkpoint) => checkpoint.division === division)
        .at(-1);
      expect(finalCheckpoint?.pointsPercent).toBeGreaterThanOrEqual(60);
    }
    const firstD1 = twoSeasonTrack.find(
      (checkpoint) =>
        checkpoint.division === 1 && checkpoint.firstSeasonInDivision,
    );
    expect(firstD1).toBeDefined();
    expect(
      firstD1!.trainedStarRating / divisionStarFocusedAttribute(1, 236),
    ).toBeGreaterThanOrEqual(0.8);
    expect(
      firstD1!.trainedStarRating / divisionStarFocusedAttribute(1, 236),
    ).toBeLessThanOrEqual(1.25);
    expect(
      firstD1!.trainedStarRating / DIVISION_SUPPORT_STRENGTHS[1],
    ).toBeGreaterThanOrEqual(1.7);
  }, 900_000);
});

function organicCareerPeakAttribute(): number {
  let state = probeCareer();
  const coach = state.market?.coachCandidates[0];
  if (state.market === undefined || coach === undefined) {
    throw new Error('organic headroom probe needs the launch coach market');
  }
  state = {
    ...state,
    market: {
      ...state.market,
      headCoach: {
        ...coach,
        id: 'organic-head-coach',
        level: 5,
        specialties: ['ATTACK', 'FITNESS'],
      },
      assistantCoach: {
        ...coach,
        id: 'organic-assistant-coach',
        level: 5,
        specialties: ['DEFENSE', 'TECHNIQUE'],
      },
    },
  };
  let lineupIds = state.lineups.find(
    (lineup) => lineup.clubId === state.userClubId,
  )!.playerIds;
  let peak = 0;

  for (
    let seasonIndex = 0;
    seasonIndex < FIFTEEN_SEASON_DIVISIONS.length;
    seasonIndex += 1
  ) {
    const division = FIFTEEN_SEASON_DIVISIONS[seasonIndex];
    state = setHighestDivision(state, division);
    const recruitment = addDivisionRecruitment(
      state,
      lineupIds,
      [],
      division,
      seasonIndex,
    );
    state = recruitment.state;
    lineupIds = recruitment.lineupIds;

    for (let week = 0; week < 30; week += 1) {
      state = {
        ...state,
        trainingPoints: state.trainingPoints + MAX_NORMAL_WEEKLY_TP,
      };
      const trainedThisWeek = new Set<string>();
      while (trainedThisWeek.size < 3) {
        const candidate = lineupIds
          .filter((playerId) => !trainedThisWeek.has(playerId))
          .map((playerId) =>
            state.players.find((player) => player.id === playerId)!,
          )
          .filter(
            (player) =>
              player.injuryWeeks === 0 && (player.condition ?? 100) >= 30,
          )
          .flatMap((player) =>
            POSITION_TRAINING_ATTRIBUTES[player.role].map((attribute) => ({
              player,
              attribute,
              pathId: PATH_BY_ATTRIBUTE[attribute],
              rating: player.attrs[attribute],
            })),
          )
          .filter(
            (entry) =>
              resolveTrainingDrillForPath(state, entry.pathId).tpCost <=
              state.trainingPoints,
          )
          .sort(
            (left, right) =>
              left.rating - right.rating ||
              left.player.id.localeCompare(right.player.id) ||
              left.attribute.localeCompare(right.attribute),
          )[0];
        if (candidate === undefined) break;
        state = trainPlayerInstantly(
          state,
          candidate.player.id,
          candidate.pathId,
        ).state;
        trainedThisWeek.add(candidate.player.id);
      }
      state = {
        ...state,
        players: state.players.map((player) =>
          player.clubId === state.userClubId
            ? {
                ...player,
                condition: Math.min(100, (player.condition ?? 100) + 12),
              }
            : player,
        ),
      };
    }

    peak = Math.max(
      peak,
      ...state.players
        .filter((player) => player.clubId === state.userClubId)
        .flatMap((player) =>
          POSITION_TRAINING_ATTRIBUTES[player.role].map(
            (attribute) => player.attrs[attribute],
          ),
        ),
    );
    state = {
      ...state,
      players: state.players.map((player) =>
        player.clubId === state.userClubId
          ? { ...player, age: (player.age ?? 24) + 1 }
          : player,
      ),
    };
  }

  return peak;
}

function probeCareer(): GameState {
  return addCreatedPlayer(
    beginStoryOnboarding(
      createCareer(
        createLaunchCareerSetup(4_000_000, undefined, content, 'COZY'),
      ),
    ),
    {
      name: 'Probe Rookie',
      ratings: { pac: 55, sho: 60, pas: 50, def: 50, tec: 50, sta: 50 },
    },
  );
}

function setHighestDivision(
  state: GameState,
  division: DivisionLevel,
): GameState {
  if (state.m2 === undefined)
    throw new Error('probe career needs the league pyramid');
  return {
    ...state,
    m2: { ...state.m2, highestDivisionReached: division },
  };
}

function addDivisionRecruitment(
  state: GameState,
  lineupIds: readonly string[],
  traineeIds: readonly string[],
  division: DivisionLevel,
  seasonIndex: number,
): {
  state: GameState;
  lineupIds: string[];
  youthGrade: string;
  scoutGrade: string;
} {
  const supportStarters = lineupIds
    .filter((id) => !traineeIds.includes(id))
    .map((id) => state.players.find((player) => player.id === id)!)
    .filter((player) => player.role !== 'GK')
    .sort(
      (left, right) =>
        roleOverall(left.role, left.attrs) -
        roleOverall(right.role, right.attrs),
    );
  const goalkeeper = lineupIds
    .map((id) => state.players.find((player) => player.id === id)!)
    .find((player) => player.role === 'GK');
  const scoutReplacements = supportStarters.slice(0, 2);
  const youthReplacement = supportStarters[2];
  if (
    goalkeeper === undefined ||
    scoutReplacements.length !== 2 ||
    youthReplacement === undefined
  ) {
    throw new Error(
      'probe recruitment needs a keeper and three non-trainee outfield starters',
    );
  }
  const youthPotential = potentialTierForDivision(division, 20);
  const scouts = scoutReplacements.map((replacement, index): CareerPlayer => ({
    ...replacement,
    id: `probe-scout-s${seasonIndex + 1}-d${division}-${index + 1}`,
    name: `D${division} Scout Hire ${index + 1}`,
    attrs: focusedRoleAttrs(
      DIVISION_SUPPORT_STRENGTHS[division],
      divisionStarFocusedAttribute(division, OPPONENT_MIDPOINT[division]),
      replacement.role,
      DIVISION_TYPICAL_PACE[division],
    ),
    age: 22 + index,
    potential: potentialTierForDivision(division, index === 0 ? 50 : 20),
    archetype: replacement.role === 'FWD' ? 'Speedster' : 'All-Rounder',
  }));
  const youthFieldLevel = Math.min(3, 5 - division);
  const youthBase = 35 + youthFieldLevel * 5;
  const youth: CareerPlayer = {
    ...youthReplacement,
    id: `probe-youth-s${seasonIndex + 1}-d${division}`,
    name: `D${division} Youth Hire`,
    attrs: roleAttrs(
      youthBase,
      youthReplacement.role,
      division === 5
        ? 60
        : DIVISION_TYPICAL_PACE[(division + 1) as DivisionLevel],
    ),
    age: 17,
    potential: youthPotential,
    archetype: 'All-Rounder',
  };
  const keeper: CareerPlayer = {
    ...goalkeeper,
    id: `probe-keeper-s${seasonIndex + 1}-d${division}`,
    name: `D${division} Keeper Hire`,
    attrs: goalkeeperAttrs(division),
    age: 24,
    potential: potentialTierForDivision(division, 35),
    archetype: 'Wall',
  };
  const recruits = [...scouts, keeper, youth];
  const replacements = [...scoutReplacements, goalkeeper, youthReplacement];
  const nextLineupIds = [...lineupIds];
  recruits.forEach((recruit, index) => {
    const outgoing = replacements[index];
    if (
      roleOverall(recruit.role, recruit.attrs) >
      roleOverall(outgoing.role, outgoing.attrs)
    ) {
      const slot = nextLineupIds.indexOf(outgoing.id);
      nextLineupIds[slot] = recruit.id;
    }
  });
  const nextState: GameState = {
    ...state,
    season: seasonIndex + 1,
    week: 1,
    players: [...state.players, ...scouts, keeper, youth],
    lineups: state.lineups.map((lineup) =>
      lineup.clubId === state.userClubId
        ? { ...lineup, playerIds: nextLineupIds }
        : lineup,
    ),
  };
  return {
    state: nextState,
    lineupIds: nextLineupIds,
    youthGrade: playerPotentialGrade(youth),
    scoutGrade: [...scouts, keeper].map(playerPotentialGrade).join('/'),
  };
}

function matchSample(
  state: GameState,
  division: DivisionLevel,
  opponentStrength: number,
  heroLimit: number,
  seasonIndex: number,
  priorityHeroIds: readonly string[],
): { win: number; draw: number; loss: number; pointsPercent: number } {
  const home = userTeam(state, heroLimit, division, priorityHeroIds);
  const away = opponentTeam(division, opponentStrength);
  let win = 0;
  let draw = 0;
  let loss = 0;
  for (let sample = 0; sample < 30; sample += 1) {
    const userAtHome = sample % 2 === 0;
    const score = runMatch(
      80_000 + seasonIndex * 100 + sample,
      userAtHome ? home : away,
      userAtHome ? away : home,
      [],
      { homePolicy: 'FIRE_WHEN_READY', awayPolicy: 'FIRE_WHEN_READY' },
    ).score;
    const userGoals = userAtHome ? score[0] : score[1];
    const opponentGoals = userAtHome ? score[1] : score[0];
    if (userGoals > opponentGoals) win += 1;
    else if (userGoals === opponentGoals) draw += 1;
    else loss += 1;
  }
  return {
    win,
    draw,
    loss,
    pointsPercent: Math.round(((win * 3 + draw) / 90) * 100),
  };
}

function userTeam(
  state: GameState,
  heroLimit: number,
  division: DivisionLevel,
  priorityHeroIds: readonly string[],
): TeamDef {
  const lineup = state.lineups.find(
    (candidate) => candidate.clubId === state.userClubId,
  )!;
  const players = lineup.playerIds.map((id) =>
    state.players.find((player) => player.id === id)!,
  );
  return {
    id: 'probe-user',
    name: 'Probe Rovers',
    players: withHeroes(
      players,
      heroLimit,
      division,
      'probe-user',
      priorityHeroIds,
    ),
  };
}

function opponentTeam(division: DivisionLevel, target: number): TeamDef {
  const roles: Role[] = [
    'GK',
    'DEF',
    'DEF',
    'DEF',
    'DEF',
    'MID',
    'MID',
    'MID',
    'MID',
    'FWD',
    'FWD',
  ];
  const starSlots = new Set([1, 5, 9]);
  const support = DIVISION_SUPPORT_STRENGTHS[division];
  const typicalPace = DIVISION_TYPICAL_PACE[division];
  const starFocus = opponentFocusedRating(division, target);
  const players = roles.map(
    (role, index) =>
      ({
        id: `probe-opponent-${index}`,
        clubId: 'probe-opponent',
        name: `Opponent ${index}`,
        role,
        attrs:
          role === 'GK'
            ? goalkeeperAttrs(division)
            : starSlots.has(index)
              ? focusedRoleAttrs(support, starFocus, role, typicalPace)
              : roleAttrs(support, role, typicalPace),
        licensed: false,
        weeklyWage: 0,
        onHeroWage: false,
        contractSeasonsRemaining: 1,
        morale: 50,
        injuryWeeks: 0,
      }) satisfies CareerPlayer,
  );
  return {
    id: 'probe-opponent',
    name: 'Probe United',
    players: withHeroes(
      players,
      generatedClubHeroCount('probe-opponent', division),
      division,
      'probe-opponent',
    ),
  };
}

function opponentFocusedRating(
  division: DivisionLevel,
  targetClubStrength: number,
): number {
  return divisionStarFocusedAttribute(division, targetClubStrength);
}

function withHeroes(
  players: readonly CareerPlayer[],
  count: number,
  division: DivisionLevel,
  clubId: string,
  priorityHeroIds: readonly string[] = [],
): TeamDef['players'] {
  const priority = new Map(priorityHeroIds.map((id, index) => [id, index]));
  const heroIds = players
    .slice()
    .sort(
      (left, right) =>
        (priority.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
        (priority.get(right.id) ?? Number.MAX_SAFE_INTEGER),
    )
    .filter(
      (player) => generatedClubPower(clubId, 0, player.role) !== undefined,
    )
    .slice(0, count)
    .map((player) => player.id);
  const selected = new Set(heroIds);
  let heroes = 0;
  return players.map((player) => {
    const power = selected.has(player.id)
      ? generatedClubPower(clubId, heroes, player.role)
      : undefined;
    if (power !== undefined) heroes += 1;
    return {
      id: player.id,
      name: player.name,
      role: player.role,
      attrs: { ...player.attrs },
      ...(power === undefined
        ? {}
        : {
            power,
            powerTier: (division === 1 ? 3 : division <= 3 ? 2 : 1) as
              1 | 2 | 3,
          }),
    };
  });
}

function roleAttrs(target: number, role: Role, paceTarget = target): Attrs {
  const nudge: Readonly<Record<Role, Attrs>> = {
    GK: { pac: -5, sho: -8, pas: 0, def: 3, tec: 0, sta: 0, ref: 10 },
    DEF: { pac: 0, sho: -4, pas: 0, def: 7, tec: -1, sta: 3, ref: -5 },
    MID: { pac: 0, sho: 0, pas: 6, def: 0, tec: 6, sta: 3, ref: -5 },
    FWD: { pac: 4, sho: 7, pas: 0, def: -5, tec: 3, sta: 0, ref: -5 },
  };
  const value = (offset: number) => Math.max(1, Math.min(999, target + offset));
  return {
    pac: Math.max(1, Math.min(999, paceTarget + nudge[role].pac)),
    sho: value(nudge[role].sho),
    pas: value(nudge[role].pas),
    def: value(nudge[role].def),
    tec: value(nudge[role].tec),
    sta: value(nudge[role].sta),
    ref: value(nudge[role].ref),
  };
}

function goalkeeperAttrs(division: DivisionLevel): Attrs {
  return {
    ...roleAttrs(
      DIVISION_SUPPORT_STRENGTHS[division],
      'GK',
      DIVISION_TYPICAL_PACE[division],
    ),
    ref: DIVISION_GOALKEEPER_REF_RATINGS[division],
  };
}

function focusedRoleAttrs(
  support: number,
  focused: number,
  role: Role,
  paceTarget: number,
): Attrs {
  const attrs = roleAttrs(support, role, paceTarget);
  for (const attribute of POSITION_TRAINING_ATTRIBUTES[role]) {
    attrs[attribute] = focused;
  }
  return attrs;
}

function effectiveRoleOverall(role: Role, attrs: Readonly<Attrs>): number {
  const relevant =
    role === 'GK'
      ? (['pac', 'pas', 'def', 'tec', 'sta', 'ref'] as const)
      : (['pac', 'sho', 'pas', 'def', 'tec', 'sta'] as const);
  return Math.round(
    relevant.reduce(
      (sum, attribute) => sum + matchAttribute(attrs[attribute]),
      0,
    ) / relevant.length,
  );
}
