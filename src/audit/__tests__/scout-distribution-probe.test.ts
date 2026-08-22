/**
 * OPT-IN DECISION PROBE:
 *   SCOUT_DISTRIBUTION_PROBE=1 npm run test:probe -- \
 *     src/audit/__tests__/scout-distribution-probe.test.ts
 *
 * Measures production D5 and D4 Immediate Starter reports. Each row records
 * exact current OVR, peak role stat, fee, wage, starter improvement, and
 * whether the club can afford the player after paying for the mission.
 */
import { createLaunchCareerSetup } from '../../application/launch';
import {
  careerBuyingTransferQuote,
  careerTransferTarget,
  buildCareerMatchTeams,
  createCareer,
  currentUserDivision,
  resolveCareerScoutClock,
  roleOverall,
  startCareerScoutMission,
  startNextSeason,
  type CareerPlayer,
  type GameState,
} from '../../game';
import { runMatch } from '../../sim/match';
import type { Attrs, Role, TeamDef } from '../../sim/types';

const describeProbe =
  process.env.SCOUT_DISTRIBUTION_PROBE === '1' ? describe : describe.skip;
const SEEDS_PER_DIVISION = positiveIntegerEnv('SCOUT_DISTRIBUTION_SEEDS', 50);
const IMPACT_SEEDS = positiveIntegerEnv('SCOUT_IMPACT_SEEDS', 20);
const REGIONS = ['LOCAL', 'EUROPE', 'SOUTH_AMERICA', 'AFRICA', 'ASIA'] as const;
const ROLES = ['GK', 'DEF', 'MID', 'FWD'] as const;
const OUT_FIELD_ATTRIBUTES = [
  'pac',
  'sho',
  'pas',
  'def',
  'tec',
  'sta',
] as const satisfies readonly (keyof Attrs)[];
const GOALKEEPER_ATTRIBUTES = [
  'pac',
  'pas',
  'def',
  'tec',
  'sta',
  'ref',
] as const satisfies readonly (keyof Attrs)[];

interface ReportRow {
  readonly division: 4 | 5;
  readonly ovr: number;
  readonly peakRoleStat: number;
  readonly fee: number;
  readonly wage: number;
  readonly starterImprovement: number;
  readonly affordable: boolean;
}

interface MissionSample {
  readonly rows: ReportRow[];
  readonly candidates: readonly {
    readonly state: GameState;
    readonly player: CareerPlayer;
    readonly row: ReportRow;
  }[];
}

interface ImpactResult {
  readonly pointsPerMatch: number;
  readonly goalDifferencePerMatch: number;
  readonly winRate: number;
}

function promotedCareer(seed: number): GameState {
  const state = createCareer(createLaunchCareerSetup(seed));
  const completed: GameState = {
    ...state,
    phase: 'season-end',
    fixtures: state.fixtures.map((fixture) =>
      fixture.season !== state.season
        ? fixture
        : {
            ...fixture,
            status: 'played' as const,
            score:
              fixture.homeClubId === state.userClubId
                ? { homeGoals: 3, awayGoals: 0 }
                : fixture.awayClubId === state.userClubId
                  ? { homeGoals: 0, awayGoals: 3 }
                  : { homeGoals: 0, awayGoals: 0 },
          },
    ),
  };
  const promoted = startNextSeason(completed);
  if (promoted.m2 === undefined || currentUserDivision(promoted.m2) !== 4) {
    throw new Error('scout probe career did not reach D4');
  }
  return promoted;
}

function dueState(state: GameState, dueWeek: number): GameState {
  return {
    ...state,
    season: Math.floor((dueWeek - 1) / 30) + 1,
    week: ((dueWeek - 1) % 30) + 1,
  };
}

function bestStarter(state: GameState, role: Role): number {
  return Math.max(
    ...state.players
      .filter(
        (player) => player.clubId === state.userClubId && player.role === role,
      )
      .map((player) => roleOverall(role, player.attrs)),
  );
}

function peakRoleStat(role: Role, attrs: Readonly<Attrs>): number {
  const attributes =
    role === 'GK' ? GOALKEEPER_ATTRIBUTES : OUT_FIELD_ATTRIBUTES;
  return Math.max(...attributes.map((attribute) => attrs[attribute]));
}

function sample(division: 4 | 5, index: number): MissionSample {
  const seed = 8_200_000 + division * 10_000 + index;
  const initial =
    division === 4
      ? promotedCareer(seed)
      : { ...createCareer(createLaunchCareerSetup(seed)), week: 15 };
  const role = ROLES[index % ROLES.length];
  const region = REGIONS[Math.floor(index / ROLES.length) % REGIONS.length];
  const started = startCareerScoutMission(
    initial,
    initial.market!,
    region,
    { kind: 'PROFILE', prospectType: 'IMMEDIATE_STARTER', role },
    division,
    division,
  );
  const due = dueState(
    { ...started.state, market: started.market },
    started.market.activeScoutMission!.dueWeek,
  );
  const market = resolveCareerScoutClock(due, started.market);
  const cash = due.clubs.find((club) => club.id === due.userClubId)!.cash;
  const starter = bestStarter(due, role);

  const candidates: MissionSample['candidates'][number][] = [];
  const rows = market.scoutReports.map((report) => {
    const target = careerTransferTarget(due, report.playerId);
    if (target === undefined)
      throw new Error(`scout probe cannot resolve ${report.playerId}`);
    const current = roleOverall(target.player.role, target.player.attrs);
    const fee = careerBuyingTransferQuote(due, market, report.playerId).fee;
    const row = {
      division,
      ovr: current,
      peakRoleStat: peakRoleStat(target.player.role, target.player.attrs),
      fee,
      wage: target.player.weeklyWage,
      starterImprovement: current - starter,
      affordable: fee <= cash,
    };
    if (row.affordable)
      candidates.push({ state: due, player: target.player, row });
    return row;
  });
  return { rows, candidates };
}

function teamRating(team: TeamDef): number {
  return (
    team.players.reduce(
      (sum, player) => sum + roleOverall(player.role, player.attrs),
      0,
    ) / team.players.length
  );
}

function measureRaceImpact(
  state: GameState,
  candidate: CareerPlayer,
): { readonly base: ImpactResult; readonly signed: ImpactResult } {
  const clubIds = state.clubs.map((club) => club.id);
  const teams = buildCareerMatchTeams(state, clubIds);
  const base = teams[state.userClubId];
  const opponent = clubIds
    .filter((clubId) => clubId !== state.userClubId)
    .map((clubId) => teams[clubId])
    .sort((left, right) => teamRating(right) - teamRating(left))[0];
  const replacement = base.players
    .filter((player) => player.role === candidate.role)
    .sort(
      (left, right) =>
        roleOverall(left.role, left.attrs) -
        roleOverall(right.role, right.attrs),
    )[0];
  if (replacement === undefined)
    throw new Error(`scout probe team has no ${candidate.role} starter`);
  const signed: TeamDef = {
    ...base,
    players: base.players.map((player) =>
      player.id === replacement.id
        ? { ...player, attrs: { ...candidate.attrs } }
        : player,
    ),
  };
  const play = (team: TeamDef): ImpactResult => {
    let points = 0;
    let goalDifference = 0;
    let wins = 0;
    for (let index = 0; index < IMPACT_SEEDS; index += 1) {
      const seed = 9_100_000 + index * 7919;
      const home = runMatch(seed, team, opponent, [], {
        homePolicy: 'FIRE_WHEN_READY',
        awayPolicy: 'FIRE_WHEN_READY',
      });
      const away = runMatch(seed, opponent, team, [], {
        homePolicy: 'FIRE_WHEN_READY',
        awayPolicy: 'FIRE_WHEN_READY',
      });
      for (const [forGoals, againstGoals] of [
        [home.score[0], home.score[1]],
        [away.score[1], away.score[0]],
      ]) {
        goalDifference += forGoals - againstGoals;
        if (forGoals > againstGoals) {
          points += 3;
          wins += 1;
        } else if (forGoals === againstGoals) {
          points += 1;
        }
      }
    }
    const matches = IMPACT_SEEDS * 2;
    return {
      pointsPerMatch: points / matches,
      goalDifferencePerMatch: goalDifference / matches,
      winRate: wins / matches,
    };
  };
  return { base: play(base), signed: play(signed) };
}

function percentile(values: readonly number[], fraction: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor((sorted.length - 1) * fraction)];
}

function range(values: readonly number[]): string {
  return (
    `${Math.min(...values)} / ${percentile(values, 0.5)} / ` +
    `${percentile(values, 0.9)} / ${Math.max(...values)}`
  );
}

describeProbe('scout distribution', () => {
  it('reports D5 and D4 strength, price, wage, and starter improvement', () => {
    const samplesByDivision = new Map<4 | 5, MissionSample[]>();
    for (const division of [5, 4] as const) {
      samplesByDivision.set(
        division,
        Array.from({ length: SEEDS_PER_DIVISION }, (_, index) =>
          sample(division, index),
        ),
      );
    }

    const lines = [
      '',
      `=== SCOUT DISTRIBUTION (${SEEDS_PER_DIVISION} missions per division) ===`,
      'ranges are min / median / p90 / max',
    ];
    for (const division of [5, 4] as const) {
      const samples = samplesByDivision.get(division)!;
      const rows = samples.flatMap((sample) => sample.rows);
      const affordable = rows.filter((row) => row.affordable);
      const upgrades = affordable.filter((row) => row.starterImprovement > 0);
      const missionsWithAffordableUpgrade = samples.filter((sample) =>
        sample.rows.some((row) => row.affordable && row.starterImprovement > 0),
      ).length;
      const strongestAffordable = samples
        .flatMap((sample) => sample.candidates)
        .sort(
          (left, right) =>
            right.row.starterImprovement - left.row.starterImprovement,
        )[0];
      if (strongestAffordable === undefined)
        throw new Error(`D${division} scout probe found no affordable player`);
      const impact = measureRaceImpact(
        strongestAffordable.state,
        strongestAffordable.player,
      );
      lines.push(
        `D${division} reports=${rows.length}`,
        `  OVR ${range(rows.map((row) => row.ovr))}`,
        `  peak role stat ${range(rows.map((row) => row.peakRoleStat))}`,
        `  fee ${range(rows.map((row) => row.fee))}`,
        `  wage ${range(rows.map((row) => row.wage))}`,
        `  starter improvement ${range(rows.map((row) => row.starterImprovement))}`,
        `  affordable reports ${affordable.length}/${rows.length}`,
        `  affordable upgrades ${upgrades.length}/${rows.length}`,
        `  missions with affordable upgrade ${missionsWithAffordableUpgrade}/${samples.length}`,
        `  strongest affordable vs strongest rival (${IMPACT_SEEDS * 2} matches):` +
          ` base ${impact.base.pointsPerMatch.toFixed(2)} PPG / ${impact.base.goalDifferencePerMatch.toFixed(2)} GD / ${(impact.base.winRate * 100).toFixed(1)}% wins;` +
          ` signed ${impact.signed.pointsPerMatch.toFixed(2)} PPG / ${impact.signed.goalDifferencePerMatch.toFixed(2)} GD / ${(impact.signed.winRate * 100).toFixed(1)}% wins`,
      );
      expect(rows.length).toBeGreaterThanOrEqual(SEEDS_PER_DIVISION * 2);
    }
    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));
  }, 1_200_000);
});

function positiveIntegerEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  if (!/^[1-9]\d*$/.test(raw))
    throw new Error(`${name} must be a positive integer`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value))
    throw new Error(`${name} must be a safe positive integer`);
  return value;
}
