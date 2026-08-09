import {
  CUP_SETTLEMENT_WEEKS,
  isDivisionLeadersUnlocked,
} from '../game/career';
import { currentUserDivision, type M2CareerState } from '../game/m2-career';
import type {
  DivisionLevel,
  NationalCup,
  NationalCupFixture,
  NationalCupRound,
} from '../game/pyramid';
import { cupRoundNameWith, divisionTierLabelWith } from '../game/pyramid';
import type {
  CareerPlayer,
  LeagueFixture,
  LeagueStanding,
  PlayerSeasonStatLine,
} from '../game/types';
import type {
  M2CupFixtureViewModel,
  M2CupRoundViewModel,
  M2CupRoundHistoryViewModel,
  M2DivisionSummaryViewModel,
  M2LeagueFixtureViewModel,
  M2LeagueSubTab,
  M2LeagueViewModel,
  M2NationalCupViewModel,
} from '../ui/m2-league-models';
import { MAX_PLAYER_ATTRIBUTE } from '../sim/attributes';
import { divisionLeadersViewModel } from './division-leaders-view-model';
import { copyFor, type CopyFn } from '../i18n';

/**
 * English copy, for every caller that has not threaded a locale through yet.
 *
 * Matches `view-models.ts`: a pure module cannot reach React context, so the
 * dependency is a parameter with a default, built once and reused.
 */
let englishCopyFn: CopyFn | undefined;

function englishCopy(): CopyFn {
  return (englishCopyFn ??= copyFor('en'));
}

/**
 * The bracket stage, as a player reads it.
 *
 * This screen used to own a private copy of the round-key table, which is why
 * it was the only place in the game that ever translated a round: everything
 * else reached for the raw English label. The table now lives beside the labels
 * themselves in `src/game/pyramid`, and this is a name for the shared lookup so
 * the call sites below still read as this file's own vocabulary.
 */
function cupRoundLabel(label: NationalCupRound['label'], t: CopyFn): string {
  return cupRoundNameWith(label, t);
}

export interface M2LeagueViewModelSource {
  readonly career: M2CareerState;
  readonly season: number;
  readonly activeStandings: readonly LeagueStanding[];
  readonly userSquadStrength?: number;
  readonly selectedDivision?: DivisionLevel;
  readonly selectedCupSeason?: number;
  readonly week?: number;
  readonly phase?: 'manage' | 'matchday' | 'season-end' | 'complete';
  /** The full game schedule; the view model selects this club's current-season road. */
  readonly leagueFixtures?: readonly LeagueFixture[];
  /** The live roster, which decides who is still eligible for a leader board. */
  readonly players?: readonly CareerPlayer[];
  readonly statLines?: readonly PlayerSeasonStatLine[];
}

/** Maps the sidecar pyramid and the live ten-club table into player-facing copy. */
export function m2LeagueViewModel(
  source: M2LeagueViewModelSource,
  t: CopyFn = englishCopy(),
): M2LeagueViewModel {
  validateSeason(source.season);
  const userDivision = currentUserDivision(source.career);
  const userSquadStrength =
    source.userSquadStrength ??
    source.career.pyramid.divisions
      .find((division) => division.level === userDivision)!
      .clubs.find((club) => club.id === source.career.userClubId)!
      .squadStrength;
  validateStrength(userSquadStrength, 'user squad strength');
  const selectedDivision = source.selectedDivision ?? userDivision;
  const selectedExists = source.career.pyramid.divisions.some(
    (division) => division.level === selectedDivision,
  );
  if (!selectedExists)
    throw new Error(`unknown selected division ${selectedDivision}`);
  const clubNames = new Map(
    source.career.pyramid.divisions.flatMap((division) =>
      division.clubs.map((club) => [club.id, club.name] as const),
    ),
  );
  const divisions = source.career.pyramid.divisions
    .slice()
    .sort((left, right) => left.level - right.level)
    .map((division) =>
      divisionSummary(
        division.level,
        division.clubs.map((club) => club.squadStrength),
        selectedDivision,
        userDivision,
        userSquadStrength,
        t,
      ),
    );
  const selectedDivisionSummary = divisions.find(
    (division) => division.level === selectedDivision,
  )!;
  const rows = activeTableRows(source, userDivision, clubNames);
  const userRow = rows.find((row) => row.isUserClub);
  if (userRow === undefined)
    throw new Error('the active standings do not contain the user club');

  return {
    title: t('m2League.title'),
    seasonLabel: t('m2League.seasonLabel', { season: source.season }),
    userDivisionBadge: `D${userDivision} · #${userRow.position}`,
    selectedDivision,
    divisions,
    selectedDivisionSummary,
    activeTable: {
      divisionLabel: divisionTierLabelWith(userDivision, t),
      rulesLabel: movementRulesLabel(userDivision, t),
      matchesPlayed: userRow.played,
      rows,
    },
    leagueFixtures: leagueFixtureHistory(source, clubNames, t),
    cup: cupViewModel(source, clubNames, t),
    availableTabs: availableSubTabs(source),
    leaders: divisionLeadersViewModel(
      {
        season: source.season,
        players: source.players ?? [],
        statLines: source.statLines ?? [],
        userClubId: source.career.userClubId,
        clubNames,
      },
      t,
    ),
  };
}

/**
 * Both unlocks are derived from the state that causes them, never persisted —
 * a stored flag is one more thing that can drift out of sync with the thing it
 * describes. The leaders threshold is shared with Bert's briefing, so the
 * inbox can never point at a tab this list has not added yet.
 */
function availableSubTabs(source: M2LeagueViewModelSource): M2LeagueSubTab[] {
  const tabs: M2LeagueSubTab[] = ['league'];
  const cups = source.career.nationalCups;
  if (cups.length === 0) return tabs;
  tabs.push('cup');

  if (isDivisionLeadersUnlocked(cups, source.season, source.week ?? 0))
    tabs.push('leaders');
  return tabs;
}

function divisionSummary(
  level: DivisionLevel,
  strengths: readonly number[],
  selectedDivision: DivisionLevel,
  userDivision: DivisionLevel,
  userSquadStrength: number,
  t: CopyFn,
): M2DivisionSummaryViewModel {
  if (
    strengths.length !== 10 ||
    strengths.some(
      (strength) =>
        !Number.isInteger(strength) ||
        strength < 1 ||
        strength > MAX_PLAYER_ATTRIBUTE,
    )
  ) {
    throw new Error(`Division ${level} must contain ten valid club strengths`);
  }
  const total = strengths.reduce((sum, strength) => sum + strength, 0);
  const minimum = Math.min(...strengths);
  const maximum = Math.max(...strengths);
  const comparison = strengthComparison(userSquadStrength, minimum, maximum, t);
  return {
    level,
    shortLabel: `D${level}`,
    label: divisionTierLabelWith(level, t),
    clubCount: strengths.length,
    averageStrength: Math.round(total / strengths.length),
    strengthRangeLabel: `${minimum}–${maximum}`,
    userSquadStrength,
    comparisonLabel: comparison.label,
    comparisonTone: comparison.tone,
    selected: level === selectedDivision,
    userDivision: level === userDivision,
  };
}

function strengthComparison(
  userSquadStrength: number,
  minimum: number,
  maximum: number,
  t: CopyFn,
): { label: string; tone: M2DivisionSummaryViewModel['comparisonTone'] } {
  if (userSquadStrength < minimum) {
    return {
      label: t('m2League.strengthBelowRange', {
        count: minimum - userSquadStrength,
      }),
      tone: 'below',
    };
  }
  if (userSquadStrength > maximum) {
    return {
      label: t('m2League.strengthAboveRange', {
        count: userSquadStrength - maximum,
      }),
      tone: 'above',
    };
  }
  return { label: t('m2League.strengthWithinRange'), tone: 'competitive' };
}

function validateStrength(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 1 || value > MAX_PLAYER_ATTRIBUTE) {
    throw new Error(
      `${label} must be an integer from 1 to ${MAX_PLAYER_ATTRIBUTE}`,
    );
  }
}

function activeTableRows(
  source: M2LeagueViewModelSource,
  userDivision: DivisionLevel,
  clubNames: ReadonlyMap<string, string>,
): M2LeagueViewModel['activeTable']['rows'] {
  const activeClubIds = new Set(
    source.career.pyramid.divisions
      .find((division) => division.level === userDivision)!
      .clubs.map((club) => club.id),
  );
  if (source.activeStandings.length !== 10) {
    throw new Error('the active league table requires exactly ten standings');
  }
  const seenClubIds = new Set<string>();
  const seenPositions = new Set<number>();
  for (const standing of source.activeStandings) {
    if (!activeClubIds.has(standing.clubId)) {
      throw new Error(
        `standing ${standing.clubId} does not belong to the active division`,
      );
    }
    if (seenClubIds.has(standing.clubId))
      throw new Error(`duplicate standing for ${standing.clubId}`);
    if (
      !Number.isInteger(standing.position) ||
      standing.position < 1 ||
      standing.position > 10
    ) {
      throw new Error(`standing ${standing.clubId} has an invalid position`);
    }
    if (seenPositions.has(standing.position))
      throw new Error(`duplicate league position ${standing.position}`);
    seenClubIds.add(standing.clubId);
    seenPositions.add(standing.position);
    validateStandingNumbers(standing);
  }

  return source.activeStandings
    .slice()
    .sort((left, right) => left.position - right.position)
    .map((standing) => ({
      position: standing.position,
      clubId: standing.clubId,
      clubName: requireClubName(clubNames, standing.clubId),
      played: standing.played,
      won: standing.won,
      drawn: standing.drawn,
      lost: standing.lost,
      goalDifference: standing.goalDifference,
      points: standing.points,
      isUserClub: standing.clubId === source.career.userClubId,
      movement:
        standing.position <= 2 && userDivision > 1
          ? ('PROMOTION' as const)
          : standing.position >= 9 && userDivision < 5
            ? ('RELEGATION' as const)
            : ('NONE' as const),
    }));
}

function cupViewModel(
  source: M2LeagueViewModelSource,
  clubNames: ReadonlyMap<string, string>,
  t: CopyFn,
): M2NationalCupViewModel {
  // Only cups that still hold a bracket can be drawn on this tab. Seasons past
  // the retention window keep their champion for the record books but have
  // given up their rounds, and offering one throws on the way to rendering it.
  const cups = source.career.nationalCups
    .filter((cup) => cup.rounds.length > 0)
    .sort((left, right) => left.season - right.season);
  if (cups.length === 0) {
    return {
      available: false,
      seasonOptions: [],
      seasonLabel: t('m2League.seasonLabel', { season: source.season }),
      statusLabel: t('m2League.cupStatusDrawPending'),
      currentRoundLabel: t('m2League.cupNotDrawn'),
      currentRoundFixtures: [],
      rounds: [],
      history: [],
    };
  }
  const selectedCup = selectCup(cups, source.selectedCupSeason);
  const currentRound = selectedCup.rounds[selectedCup.rounds.length - 1];
  if (currentRound === undefined)
    throw new Error(`Season ${selectedCup.season} cup has no rounds`);
  const championName =
    selectedCup.championClubId === undefined
      ? undefined
      : requireClubName(clubNames, selectedCup.championClubId);
  // Must track the engine's settlement calendar, not a parallel literal — the two
  // drifted apart and left every cup tie permanently unplayable from this tab.
  const roundIsPlayable =
    selectedCup.season === source.season &&
    source.week === CUP_SETTLEMENT_WEEKS[currentRound.number - 1] &&
    source.phase === 'matchday';
  const rounds = cupRoadToFinal(
    selectedCup,
    source.career.userClubId,
    clubNames,
    currentRound.number,
    roundIsPlayable,
    t,
  );

  return {
    available: true,
    seasonOptions: cups.map((cup) => ({
      season: cup.season,
      label: `S${cup.season}`,
      selected: cup.season === selectedCup.season,
      complete: cup.championClubId !== undefined,
      ...(cup.championClubId === undefined
        ? {}
        : { championName: requireClubName(clubNames, cup.championClubId) }),
    })),
    seasonLabel: t('m2League.seasonLabel', { season: selectedCup.season }),
    statusLabel:
      championName === undefined
        ? t('m2League.cupStatusLive')
        : t('m2League.cupStatusComplete'),
    currentRoundLabel:
      championName === undefined
        ? cupRoundLabel(currentRound.label, t)
        : t('m2League.cupFinalResult'),
    currentRoundFixtures: currentRound.fixtures.map((fixture) =>
      cupFixture(
        fixture,
        currentRound,
        source.career.userClubId,
        clubNames,
        roundIsPlayable,
        t,
      ),
    ),
    rounds,
    history: rounds
      .filter((round) => round.drawn)
      .map(
        ({
          fixtures: _fixtures,
          byes: _byes,
          active: _active,
          drawn: _drawn,
          ...history
        }) => history,
      ),
    ...(championName === undefined ? {} : { championName }),
  };
}

/** Maps a single league fixture to its player-facing row. Shared by the M2 pyramid league
 * builder and the season-1 single-division league builder — both careers use the same
 * `LeagueFixture` shape and the same "your result, at a glance" presentation. */
export function leagueFixtureViewModel(
  fixture: LeagueFixture,
  userClubId: string,
  currentWeek: number | undefined,
  clubName: (clubId: string) => string,
  t: CopyFn = englishCopy(),
): M2LeagueFixtureViewModel {
  const userIsHome = fixture.homeClubId === userClubId;
  const opponentId = userIsHome ? fixture.awayClubId : fixture.homeClubId;
  const score = fixture.score;
  if (fixture.status === 'played' && score === undefined) {
    throw new Error(`played league fixture ${fixture.id} has no score`);
  }
  if (
    score !== undefined &&
    (!Number.isSafeInteger(score.homeGoals) ||
      score.homeGoals < 0 ||
      !Number.isSafeInteger(score.awayGoals) ||
      score.awayGoals < 0)
  )
    throw new Error(`league fixture ${fixture.id} has an invalid score`);

  let result: M2LeagueFixtureViewModel['result'];
  if (score !== undefined) {
    const userGoals = userIsHome ? score.homeGoals : score.awayGoals;
    const opponentGoals = userIsHome ? score.awayGoals : score.homeGoals;
    result =
      userGoals > opponentGoals
        ? 'WIN'
        : userGoals < opponentGoals
          ? 'LOSS'
          : 'DRAW';
  }
  return {
    id: fixture.id,
    week: fixture.week,
    weekLabel: t('m2League.weekLabel', { week: fixture.week }),
    homeClubName: clubName(fixture.homeClubId),
    awayClubName: clubName(fixture.awayClubId),
    opponentName: clubName(opponentId),
    venue: userIsHome ? 'HOME' : 'AWAY',
    scoreLabel:
      score === undefined ? 'VS' : `${score.homeGoals}-${score.awayGoals}`,
    status: fixture.status === 'played' ? 'PLAYED' : 'SCHEDULED',
    ...(result === undefined ? {} : { result }),
    currentWeek: fixture.week === currentWeek,
  };
}

function leagueFixtureHistory(
  source: M2LeagueViewModelSource,
  clubNames: ReadonlyMap<string, string>,
  t: CopyFn,
): M2LeagueFixtureViewModel[] {
  return (source.leagueFixtures ?? [])
    .filter(
      (fixture) =>
        fixture.season === source.season &&
        (fixture.homeClubId === source.career.userClubId ||
          fixture.awayClubId === source.career.userClubId),
    )
    .slice()
    .sort(
      (left, right) =>
        left.week - right.week ||
        left.round - right.round ||
        left.id.localeCompare(right.id),
    )
    .map((fixture) =>
      leagueFixtureViewModel(
        fixture,
        source.career.userClubId,
        source.week,
        (clubId) => requireClubName(clubNames, clubId),
        t,
      ),
    );
}

function selectCup(
  cups: readonly NationalCup[],
  selectedCupSeason?: number,
): NationalCup {
  if (selectedCupSeason !== undefined) {
    const selected = cups.find((cup) => cup.season === selectedCupSeason);
    if (selected === undefined)
      throw new Error(`Season ${selectedCupSeason} has no Hero Cup`);
    return selected;
  }
  return (
    cups.find((cup) => cup.championClubId === undefined) ??
    cups[cups.length - 1]
  );
}

function cupFixture(
  fixture: NationalCupFixture,
  round: NationalCupRound,
  userClubId: string,
  clubNames: ReadonlyMap<string, string>,
  roundIsPlayable: boolean,
  t: CopyFn,
): M2CupFixtureViewModel {
  const winnerName =
    fixture.winnerClubId === undefined
      ? undefined
      : requireClubName(clubNames, fixture.winnerClubId);
  const drawn =
    fixture.score !== undefined &&
    fixture.score.homeGoals === fixture.score.awayGoals;
  return {
    id: fixture.id,
    roundLabel: cupRoundLabel(round.label, t),
    homeClubName: requireClubName(clubNames, fixture.homeClubId),
    awayClubName: requireClubName(clubNames, fixture.awayClubId),
    scoreLabel:
      fixture.score === undefined
        ? 'VS'
        : `${fixture.score.homeGoals}-${fixture.score.awayGoals}${drawn ? ' P' : ''}`,
    status: fixture.status === 'played' ? 'PLAYED' : 'SCHEDULED',
    ...(winnerName === undefined ? {} : { winnerName }),
    involvesUserClub:
      fixture.homeClubId === userClubId || fixture.awayClubId === userClubId,
    ...(fixture.homeClubId === userClubId
      ? { userSide: 'home' as const }
      : fixture.awayClubId === userClubId
        ? { userSide: 'away' as const }
        : {}),
    userWon: fixture.winnerClubId === userClubId,
    playableNow:
      roundIsPlayable &&
      fixture.status === 'scheduled' &&
      (fixture.homeClubId === userClubId || fixture.awayClubId === userClubId),
  };
}

/**
 * `userOutcome` is copy; `userOutcomeKind` is the fact behind it.
 *
 * The screen used to pick the chip's tone by comparing the English string, so
 * the string could not be translated without silently painting every knockout
 * chip the same colour in five languages. The discriminator carries the meaning
 * and the label carries the words.
 */
function cupRoundHistory(
  round: NationalCupRound,
  cup: NationalCup,
  userClubId: string,
  t: CopyFn,
): M2CupRoundHistoryViewModel {
  const completedCount = round.fixtures.filter(
    (fixture) => fixture.status === 'played',
  ).length;
  const userFixture = round.fixtures.find(
    (fixture) =>
      fixture.homeClubId === userClubId || fixture.awayClubId === userClubId,
  );
  let userOutcomeKind: M2CupRoundHistoryViewModel['userOutcomeKind'];
  if (round.byeClubIds.includes(userClubId)) {
    userOutcomeKind = 'bye';
  } else if (userFixture?.status === 'scheduled') {
    userOutcomeKind = 'waiting';
  } else if (userFixture?.winnerClubId === userClubId) {
    userOutcomeKind =
      cup.championClubId === userClubId && round.label === 'Final'
        ? 'champion'
        : 'advanced';
  } else if (userFixture?.winnerClubId !== undefined) {
    userOutcomeKind = 'eliminated';
  }
  const userOutcome =
    userOutcomeKind === undefined
      ? undefined
      : t(`m2League.outcome.${userOutcomeKind}`);
  return {
    round: round.number,
    label: cupRoundLabel(round.label, t),
    matchCount: round.fixtures.length,
    ...(userOutcomeKind === undefined ? {} : { userOutcomeKind }),
    completedCount,
    statusLabel:
      completedCount === round.fixtures.length
        ? t('m2League.roundStatusComplete')
        : t('m2League.roundStatusLive'),
    ...(userOutcome === undefined ? {} : { userOutcome }),
  };
}

function cupRoundViewModel(
  round: NationalCupRound,
  cup: NationalCup,
  userClubId: string,
  clubNames: ReadonlyMap<string, string>,
  roundIsPlayable: boolean,
  t: CopyFn,
): M2CupRoundViewModel {
  return {
    ...cupRoundHistory(round, cup, userClubId, t),
    drawn: true,
    active: round.fixtures.some((fixture) => fixture.status === 'scheduled'),
    fixtures: round.fixtures.map((fixture) =>
      cupFixture(fixture, round, userClubId, clubNames, roundIsPlayable, t),
    ),
    byes: round.byeClubIds.map((clubId) => ({
      clubName: requireClubName(clubNames, clubId),
      involvesUserClub: clubId === userClubId,
    })),
  };
}

/**
 * The bracket's shape. `label` is the lookup into `CUP_ROUND_COPY_KEYS` rather
 * than anything drawn — nothing here reaches a screen without `cupRoundLabel`.
 */
/** @i18n-fallback Persisted cup-round enum values; consumers resolve their keys. */
const CUP_ROAD: readonly {
  number: number;
  label: NationalCupRound['label'];
  matchCount: number;
}[] = [
  { number: 1, label: 'Play-in', matchCount: 18 },
  { number: 2, label: 'Round of 32', matchCount: 16 },
  { number: 3, label: 'Round of 16', matchCount: 8 },
  { number: 4, label: 'Quarter-final', matchCount: 4 },
  { number: 5, label: 'Semi-final', matchCount: 2 },
  { number: 6, label: 'Final', matchCount: 1 },
];

function cupRoadToFinal(
  cup: NationalCup,
  userClubId: string,
  clubNames: ReadonlyMap<string, string>,
  currentRoundNumber: number,
  roundIsPlayable: boolean,
  t: CopyFn,
): M2CupRoundViewModel[] {
  return CUP_ROAD.map((stage) => {
    const round = cup.rounds.find(
      (candidate) => candidate.number === stage.number,
    );
    if (round !== undefined) {
      return cupRoundViewModel(
        round,
        cup,
        userClubId,
        clubNames,
        round.number === currentRoundNumber && roundIsPlayable,
        t,
      );
    }
    return {
      round: stage.number,
      label: cupRoundLabel(stage.label, t),
      matchCount: stage.matchCount,
      completedCount: 0,
      statusLabel: t('m2League.roundStatusAwaitingDraw'),
      drawn: false,
      active: false,
      fixtures: [],
      byes: [],
    };
  });
}

function movementRulesLabel(division: DivisionLevel, t: CopyFn): string {
  if (division === 1) return t('m2League.rulesBottomTwoRelegated');
  if (division === 5) return t('m2League.rulesTopTwoPromoted');
  return t('m2League.rulesTopTwoUpBottomTwoDown');
}

function validateStandingNumbers(standing: LeagueStanding): void {
  const nonnegative = [
    standing.played,
    standing.won,
    standing.drawn,
    standing.lost,
    standing.goalsFor,
    standing.goalsAgainst,
    standing.points,
  ];
  if (
    nonnegative.some((value) => !Number.isSafeInteger(value) || value < 0) ||
    !Number.isSafeInteger(standing.goalDifference)
  ) {
    throw new Error(`standing ${standing.clubId} contains invalid totals`);
  }
}

function requireClubName(
  names: ReadonlyMap<string, string>,
  clubId: string,
): string {
  const name = names.get(clubId);
  if (name === undefined) throw new Error(`unknown pyramid club ${clubId}`);
  return name;
}

function validateSeason(season: number): void {
  if (!Number.isSafeInteger(season) || season < 1) {
    throw new Error('season must be a positive safe integer');
  }
}
