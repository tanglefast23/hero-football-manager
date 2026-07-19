import type { GameEvent, LaunchContent, TrainingDrill } from '../content';
import {
  fixturesForCurrentWeek,
  leagueStandings,
  renewalQuote,
  rosterForClub,
  type GameState,
} from '../game';
import type {
  ClubFinancesViewModel,
  FixtureViewModel,
  HomeViewModel,
  LeagueTableViewModel,
  MatchDayViewModel,
  PostMatchViewModel,
  SeasonEndViewModel,
  StoryEventViewModel,
  SquadTrainingViewModel,
} from '../ui';

export function clubFinancesViewModel(state: GameState): ClubFinancesViewModel {
  const club = requireUserClub(state);
  const latest = state.ledgers[state.ledgers.length - 1];
  const projectedLines = latest?.lines ?? [
    { kind: 'wages' as const, label: 'Weekly wages', amount: -club.weeklyWages },
    ...(state.season === 1 ? [{
      kind: 'subsidy' as const,
      label: 'Season 1 wage subsidy',
      amount: Math.floor(club.weeklyWages / 2),
    }] : []),
  ];
  const weeklyNet = projectedLines.reduce((sum, line) => sum + line.amount, 0);
  return {
    periodLabel: latest ? `S${latest.season} · W${latest.week}` : `S${state.season} · W${state.week}`,
    resources: {
      money: club.cash,
      trainingPoints: state.trainingPoints,
      heroEssence: state.heroEssence,
    },
    ledger: projectedLines.map((line, index) => ({
      id: `finance-${state.season}-${state.week}-${index}`,
      label: line.label,
      amount: line.amount,
      kind: line.amount > 0 ? 'income' : line.amount < 0 ? 'expense' : 'neutral',
    })),
    weeklyNet,
    projectedBalance: club.cash + weeklyNet,
    ...(state.season === 1 ? { wageSubsidyLabel: 'Season 1 support covers half of weekly wages' } : {}),
    trainingGround: {
      built: state.facilities.trainingGroundBuilt,
      affordable: club.cash >= 8000,
      cost: 8000,
      weeklyTrainingPoints: 5,
    },
  };
}

export function storyEventViewModel(state: GameState, content: LaunchContent): StoryEventViewModel {
  const pending = state.pendingEvent;
  if (pending === undefined) throw new Error('there is no pending story event');
  const event = content.events.events.find(candidate => candidate.id === pending.eventId);
  if (event === undefined) throw new Error(`unknown story event ${pending.eventId}`);
  const selected = pending.selectedPlayerId === undefined
    ? undefined
    : state.players.find(player => player.id === pending.selectedPlayerId);
  const requiresPlayer = event.choices.some(choice =>
    choice.outcomes.some(outcome =>
      outcome.effects.some(effect => effect.type === 'awakenPower'),
    ),
  );

  return {
    id: event.id,
    weekLabel: `S${state.season} · W${state.week}`,
    categoryLabel: `${event.rarity} ${event.category}`,
    title: event.title,
    body: event.body,
    ...(selected ? {
      selectedPlayer: {
        id: selected.id,
        name: selected.name,
        role: selected.role,
        detail: selected.injuryWeeks > 0
          ? `Injured for ${selected.injuryWeeks} more week${selected.injuryWeeks === 1 ? '' : 's'}`
          : 'No power yet — the perfect risky candidate.',
        ...(selected.power ? {
          powerName: content.powers.powers.find(power => power.id === selected.power)?.name ?? selected.power,
        } : {}),
      },
    } : {}),
    playerSelectionRequired: requiresPlayer,
    choices: event.choices.map(choice => {
      const canAwaken = choice.outcomes.some(outcome =>
        outcome.effects.some(effect => effect.type === 'awakenPower'),
      );
      const guaranteedAwakening = event.id === 'license-pressure-awakening' && canAwaken;
      return {
        id: choice.id,
        label: choice.label,
        detail: guaranteedAwakening
          ? 'Awaken a third hero and force a real two-license squad choice.'
          : canAwaken
            ? 'Risk an injury or setback for the chance to awaken a new hero.'
            : choice.risky
              ? 'Take the unusual path to keep the mystery alive.'
              : 'Take the reliable response without ending the hero chase.',
        consequenceHint: guaranteedAwakening
          ? 'Guaranteed stat-fit awakening'
          : canAwaken
            ? `Awakening chance: ${Math.min(100, 8 + state.eventClock.riskyChoices * 6)}%`
            : describeSafeOutcome(choice.outcomes[0]?.effects ?? []),
        tone: choice.risky ? 'risky' as const : 'safe' as const,
        disabled: pending.resolvedChoiceId !== undefined,
      };
    }),
    ...(pending.resolvedChoiceId ? { resolvedChoiceId: pending.resolvedChoiceId } : {}),
    ...(pending.outcomeText ? { outcomeTitle: 'The choice is made', outcomeText: pending.outcomeText } : {}),
  };
}

export function seasonEndViewModel(
  state: GameState,
  content: LaunchContent,
  selectedTerm: 1 | 2 | 3,
): SeasonEndViewModel {
  if (state.phase !== 'season-end' && state.phase !== 'complete') {
    throw new Error('the season has not ended');
  }
  const standings = leagueStandings(state);
  const user = standings.find(row => row.clubId === state.userClubId);
  if (user === undefined) throw new Error('the user club has no final standing');
  const sliceComplete = state.phase === 'complete';
  const expiredHero = sliceComplete ? undefined : rosterForClub(state, state.userClubId)
    .find(player => player.power !== undefined && player.contractSeasonsRemaining === 0);
  const prizeMoney = state.ledgers[state.ledgers.length - 1]?.lines
    .filter(line => line.kind === 'prize')
    .reduce((sum, line) => sum + line.amount, 0) ?? 0;

  return {
    seasonLabel: `Season ${state.season} of 2`,
    outcomeLabel: user.position === 1 ? 'CHAMPIONS' : 'SAFE',
    headline: user.position === 1 ? 'The little club owns the division.' : 'The board signs off on another year.',
    summary: sliceComplete
      ? 'Two seasons are complete. The M1 loop is ready for the full gate playthrough.'
      : 'Before Season 2 begins, the awakened bargain contract finally reaches the agent’s desk.',
    finalPosition: user.position,
    prizeMoney,
    table: standings.map(row => ({
      position: row.position,
      clubId: row.clubId,
      clubName: clubName(state, row.clubId),
      played: row.played,
      goalDifference: row.goalDifference,
      points: row.points,
      isUserClub: row.clubId === state.userClubId,
      promoted: row.position <= 2,
    })),
    ...(expiredHero ? {
      expiredContract: {
        playerId: expiredHero.id,
        playerName: expiredHero.name,
        role: expiredHero.role,
        powerName: content.powers.powers.find(power => power.id === expiredHero.power)?.name,
        currentWeeklyWage: expiredHero.weeklyWage,
        quotedWeeklyWage: renewalQuote(expiredHero, 4),
        isHeroWageCliff: !expiredHero.onHeroWage,
        termOptions: [1, 2, 3] as const,
        selectedTerm,
        decision: 'pending' as const,
      },
    } : {}),
    sliceComplete,
    canContinue: sliceComplete || expiredHero === undefined,
  };
}

export function homeViewModel(state: GameState): HomeViewModel {
  const userClub = requireUserClub(state);
  const nextFixture = state.fixtures
    .filter(fixture =>
      fixture.status === 'scheduled' &&
      fixture.season === state.season &&
      (fixture.homeClubId === state.userClubId || fixture.awayClubId === state.userClubId),
    )
    .sort((left, right) => left.week - right.week || left.round - right.round)[0];
  const expired = rosterForClub(state, state.userClubId)
    .filter(player => player.contractSeasonsRemaining === 0);

  const alerts = [
    ...(!state.facilities.trainingGroundBuilt ? [{
      id: 'training-ground',
      title: 'Training Ground proposal',
      detail: 'Build once for 8,000 and earn +5 TP after every settled week.',
      tone: 'info' as const,
    }] : []),
    ...(expired.length > 0 ? [{
      id: 'renewals',
      title: `${expired.length} contract${expired.length === 1 ? '' : 's'} expired`,
      detail: 'Awakened players now ask for hero wages. Review before Season 2.',
      tone: 'urgent' as const,
    }] : []),
  ];

  const standings = leagueStandings(state).map(row => ({
    position: row.position,
    clubName: clubName(state, row.clubId),
    played: row.played,
    goalDifference: row.goalDifference,
    points: row.points,
  }));
  const userPosition = standings.findIndex(row => row.clubName === userClub.name);
  const tableStart = Math.max(0, Math.min(userPosition - 2, standings.length - 5));

  return {
    clubName: userClub.name,
    managerName: 'Boss',
    seasonLabel: `Season ${state.season} / 2`,
    weekLabel: `Week ${state.week} / 30`,
    nextMatchTimingLabel: nextFixture === undefined
      ? state.phase === 'complete' ? 'Complete' : 'Season end'
      : `In ${nextFixture.week} week${nextFixture.week === 1 ? '' : 's'}`,
    form: recentForm(state),
    resources: {
      money: userClub.cash,
      trainingPoints: state.trainingPoints,
      heroEssence: state.heroEssence,
    },
    nextFixture: nextFixture === undefined
      ? {
          id: 'season-complete',
          weekLabel: state.phase === 'complete' ? 'Complete' : 'Season end',
          competition: 'Division Five',
          homeTeam: userClub.name,
          awayTeam: 'Season review',
          venueLabel: 'Boardroom',
          opponentHeroCount: 0,
          matchdayReady: false,
        }
      : fixtureViewModel(state, nextFixture),
    alerts,
    table: standings.slice(tableStart, tableStart + 5),
  };
}

export function leagueTableViewModel(state: GameState): LeagueTableViewModel {
  const standings = leagueStandings(state);
  const user = standings.find(row => row.clubId === state.userClubId);
  if (user === undefined) throw new Error('the user club has no league standing');
  const seasonFixtures = state.fixtures.filter(fixture => fixture.season === state.season);

  return {
    divisionLabel: 'Division Five',
    seasonLabel: `Season ${state.season} / 2`,
    weekLabel: `Week ${state.week} / 30`,
    matchesPlayed: seasonFixtures.filter(fixture => fixture.status === 'played').length,
    matchesTotal: seasonFixtures.length,
    userPosition: user.position,
    userPoints: user.points,
    leaderPoints: standings[0]?.points ?? 0,
    rows: standings.map(row => ({
      position: row.position,
      clubId: row.clubId,
      clubName: clubName(state, row.clubId),
      played: row.played,
      won: row.won,
      drawn: row.drawn,
      lost: row.lost,
      goalDifference: row.goalDifference,
      points: row.points,
      isUserClub: row.clubId === state.userClubId,
      inPromotionPlaces: row.position <= 2,
    })),
  };
}

export function matchDayViewModel(state: GameState, content: LaunchContent): MatchDayViewModel {
  const fixtures = fixturesForCurrentWeek(state);
  const fixture = fixtures.find(candidate =>
    candidate.homeClubId === state.userClubId || candidate.awayClubId === state.userClubId,
  );
  if (fixture === undefined) throw new Error('the current matchday has no user fixture');

  const lineup = state.lineups.find(candidate => candidate.clubId === state.userClubId);
  if (lineup === undefined) throw new Error('the user club has no lineup');
  const roster = rosterForClub(state, state.userClubId);
  const playerById = new Map(roster.map(player => [player.id, player]));
  const powerNames = new Map(content.powers.powers.map(power => [power.id, power.name]));
  const lineupPlayers = lineup.playerIds.map(playerId => {
    const player = playerById.get(playerId);
    if (player === undefined) throw new Error(`lineup references unknown player ${playerId}`);
    return player;
  });

  return {
    fixture: fixtureViewModel(state, fixture),
    selectedTacticId: 'balanced',
    tactics: [{ id: 'balanced', label: 'Balanced', detail: 'The M1 match engine’s proven default shape.' }],
    lineup: lineupPlayers.map((player, index) => {
      return {
        id: player.id,
        name: player.name,
        role: player.role,
        shirtNumber: index + 1,
        isHero: player.power !== undefined,
      };
    }),
    heroLimit: 2,
    heroes: roster.filter(player => player.power !== undefined).map(player => ({
      playerId: player.id,
      playerName: player.name,
      powerName: powerNames.get(player.power!) ?? player.power!,
      licensed: player.licensed,
    })),
    licenseReady: lineupPlayers.every(player => player.power === undefined || player.licensed)
      && lineupPlayers.filter(player => player.licensed).length <= 2,
  };
}

export function squadTrainingViewModel(
  state: GameState,
  content: LaunchContent,
  selectedPlayerId: string | undefined,
  assignedPlayerIds: readonly string[],
  selectedDrillIds: readonly string[],
): SquadTrainingViewModel {
  const club = requireUserClub(state);
  const selected = new Set(selectedDrillIds);
  const drills = content.training.focusDrills;
  const selectedDrills = drills.filter(drill => selected.has(drill.id));
  const totalMoneyCost = selectedDrills.reduce((sum, drill) => sum + drill.moneyCost, 0);
  const totalTrainingPointCost = selectedDrills.reduce((sum, drill) => sum + drill.tpCost, 0);

  return {
    resources: {
      money: club.cash,
      trainingPoints: state.trainingPoints,
      heroEssence: state.heroEssence,
    },
    players: rosterForClub(state, state.userClubId).map(player => ({
      id: player.id,
      name: player.name,
      role: player.role,
      overall: overall(player.attrs),
      condition: 100,
      weeklyWage: player.weeklyWage,
      contractLabel: player.contractSeasonsRemaining === 0
        ? 'Expired — renewal due'
        : `${player.contractSeasonsRemaining} season${player.contractSeasonsRemaining === 1 ? '' : 's'} left`,
      ...(player.power ? {
        powerName: content.powers.powers.find(power => power.id === player.power)?.name ?? player.power,
      } : {}),
      licensed: player.licensed,
    })),
    selectedPlayerId,
    drills: drills.map(drill => drillViewModel(drill, selected.has(drill.id), state)),
    assignedPlayerIds,
    selectedDrillCount: selectedDrills.length,
    maxDrills: content.training.maxFocusDrillsPerWeek,
    totalMoneyCost,
    totalTrainingPointCost,
    canApply:
      assignedPlayerIds.length > 0 &&
      selectedDrills.length > 0 &&
      totalMoneyCost <= club.cash &&
      totalTrainingPointCost <= state.trainingPoints,
  };
}

export function postMatchViewModel(
  before: GameState,
  after: GameState,
  fixtureId: string,
  score: { homeGoals: number; awayGoals: number },
  highlights: PostMatchViewModel['highlights'] = [],
): PostMatchViewModel {
  const fixture = before.fixtures.find(candidate => candidate.id === fixtureId);
  if (fixture === undefined) throw new Error(`unknown fixture ${fixtureId}`);
  const isHome = fixture.homeClubId === before.userClubId;
  const goalsFor = isHome ? score.homeGoals : score.awayGoals;
  const goalsAgainst = isHome ? score.awayGoals : score.homeGoals;
  const ledger = after.ledgers[after.ledgers.length - 1];
  if (ledger === undefined) throw new Error('completed matchday has no weekly ledger');

  return {
    result: {
      fixtureId,
      competition: 'Division Five',
      homeTeam: clubName(before, fixture.homeClubId),
      awayTeam: clubName(before, fixture.awayClubId),
      homeScore: score.homeGoals,
      awayScore: score.awayGoals,
      outcomeLabel: goalsFor > goalsAgainst ? 'WIN' : goalsFor < goalsAgainst ? 'LOSS' : 'DRAW',
      headline: goalsFor > goalsAgainst
        ? 'The office will be loud tonight.'
        : goalsFor < goalsAgainst
          ? 'Plenty for the training board tomorrow.'
          : 'A point banked. The work continues.',
    },
    ledger: ledger.lines.map((line, index) => ({
      id: `${ledger.season}-${ledger.week}-${index}`,
      label: line.label,
      amount: line.amount,
      kind: line.amount > 0 ? 'income' : line.amount < 0 ? 'expense' : 'neutral',
    })),
    netAmount: ledger.lines.reduce((sum, line) => sum + line.amount, 0),
    trainingPointsGained: after.trainingPoints - before.trainingPoints,
    fanDelta: requireUserClub(after).fans - requireUserClub(before).fans,
    heroEssenceGained: after.heroEssence - before.heroEssence,
    highlights,
  };
}

function fixtureViewModel(state: GameState, fixture: GameState['fixtures'][number]): FixtureViewModel {
  const isHome = fixture.homeClubId === state.userClubId;
  const opponentId = isHome ? fixture.awayClubId : fixture.homeClubId;
  const isPowerlessOpening = state.onboarding?.stage === 'first-match'
    && state.onboarding.firstFixtureId === fixture.id;
  return {
    id: fixture.id,
    weekLabel: `W${fixture.week}`,
    competition: 'Division Five',
    homeTeam: clubName(state, fixture.homeClubId),
    awayTeam: clubName(state, fixture.awayClubId),
    venueLabel: isHome ? 'Home' : 'Away',
    opponentHeroCount: isPowerlessOpening
      ? 0
      : state.players.filter(
          player => player.clubId === opponentId && player.power !== undefined && player.licensed,
        ).length,
    matchdayReady: state.phase === 'matchday' && fixture.week === state.week,
  };
}

function recentForm(state: GameState): Array<'W' | 'D' | 'L'> {
  return state.fixtures
    .filter(fixture =>
      fixture.status === 'played' && fixture.score !== undefined &&
      (fixture.homeClubId === state.userClubId || fixture.awayClubId === state.userClubId),
    )
    .sort((left, right) => right.season - left.season || right.week - left.week)
    .slice(0, 5)
    .reverse()
    .map(fixture => {
      const isHome = fixture.homeClubId === state.userClubId;
      const goalsFor = isHome ? fixture.score!.homeGoals : fixture.score!.awayGoals;
      const goalsAgainst = isHome ? fixture.score!.awayGoals : fixture.score!.homeGoals;
      return goalsFor > goalsAgainst ? 'W' : goalsFor < goalsAgainst ? 'L' : 'D';
    });
}

function drillViewModel(drill: TrainingDrill, selected: boolean, state: GameState) {
  const gainLabel = Object.entries(drill.gains)
    .map(([attribute, gain]) => `+${gain} ${attribute.toUpperCase()}`)
    .join(' · ');
  return {
    id: drill.id,
    name: drill.name,
    focusLabel: Object.keys(drill.gains).map(value => value.toUpperCase()).join(' / '),
    gainLabel,
    moneyCost: drill.moneyCost,
    trainingPointCost: drill.tpCost,
    selected,
    available: drill.moneyCost <= requireUserClub(state).cash && drill.tpCost <= state.trainingPoints,
  };
}

function describeSafeOutcome(effects: GameEvent['choices'][number]['outcomes'][number]['effects']): string {
  const effect = effects[0];
  if (effect?.type === 'tp') return `${effect.amount >= 0 ? '+' : ''}${effect.amount} TP, guaranteed`;
  if (effect?.type === 'money') return `${effect.amount >= 0 ? '+' : ''}${effect.amount} money, guaranteed`;
  return 'Guaranteed steady outcome';
}

function overall(attrs: GameState['players'][number]['attrs']): number {
  return Math.round((attrs.pac + attrs.sho + attrs.pas + attrs.def + attrs.tec + attrs.sta + attrs.ref) / 7);
}

function clubName(state: GameState, clubId: string): string {
  const club = state.clubs.find(candidate => candidate.id === clubId);
  if (club === undefined) throw new Error(`unknown club ${clubId}`);
  return club.name;
}

function requireUserClub(state: GameState) {
  const club = state.clubs.find(candidate => candidate.id === state.userClubId);
  if (club === undefined) throw new Error(`unknown user club ${state.userClubId}`);
  return club;
}
