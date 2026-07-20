import type { GameEvent, LaunchContent, TrainingDrill } from '../content';
import {
  FACILITY_CATALOG,
  activeCareerMatchday,
  activeFacilityAdjacencies,
  careerHeroLimit,
  careerCoachWageLedgerAmount,
  createFacilityGrid,
  currentUserDivision,
  fixturesForCurrentWeek,
  leagueStandings,
  nextPendingClubLegend,
  reconcilePendingClubLegends,
  renewalQuote,
  rosterForClub,
  weeklyFacilityUpkeep,
  type GameState,
} from '../game';
import type {
  AwakeningCutsceneViewModel,
  ClubLegacyViewModel,
  ClubFinancesViewModel,
  FixtureViewModel,
  HomeViewModel,
  LeagueTableViewModel,
  MatchDayViewModel,
  PostMatchViewModel,
  PlayerDevelopmentViewModel,
  SeasonEndViewModel,
  StoryEventViewModel,
  SquadTrainingViewModel,
  WeeklyReviewViewModel,
} from '../ui';
import { marketNegotiationViewModel } from './market-view-model';

const REVIEW_ATTRIBUTES = ['pac', 'sho', 'pas', 'def', 'tec', 'sta', 'ref'] as const;

export function clubLegacyViewModel(state: GameState): ClubLegacyViewModel {
  const reconciled = reconcilePendingClubLegends(state);
  const legend = nextPendingClubLegend(reconciled);
  if (legend === undefined) throw new Error('there is no pending club-legend decision');
  const pendingCount = reconciled.pendingLegacyPlayerIds?.length ?? 0;
  return {
    seasonLabel: `Season ${state.season}`,
    queueLabel: pendingCount === 1 ? 'Final legacy decision' : `${pendingCount} legacy decisions remain`,
    playerName: legend.name,
    role: legend.role,
    archetype: legend.archetype ?? 'All-Rounder',
    personality: legend.personality ?? 'Professional',
    fame: legend.fame ?? 0,
    seasonsAtClub: legend.seasonsAtClub ?? 0,
    choices: [
      {
        id: 'coach-candidate',
        label: 'Join the staff',
        detail: `${legend.name} begins a new career on the touchline, carrying hard-earned club knowledge into every session.`,
        outcome: 'Adds a loyalty-discounted candidate to the coach market.',
      },
      {
        id: 'mentor-youth',
        label: 'Mentor a prospect',
        detail: `${legend.name} personally selects a teenage player and passes on the habits that made a club legend.`,
        outcome: 'Adds one boosted youth player to the first-team squad.',
      },
    ],
  };
}

export function awakeningCutsceneViewModel(
  state: GameState,
  content: LaunchContent,
  hasPostMatchReport = false,
): AwakeningCutsceneViewModel {
  const pending = state.awakening.pending;
  if (pending === undefined) throw new Error('there is no pending awakening cutscene');
  const player = state.players.find(candidate => candidate.id === pending.playerId);
  if (player === undefined || player.clubId !== state.userClubId || player.power !== pending.power) {
    throw new Error('the pending awakening player is invalid');
  }
  const power = content.powers.powers.find(candidate => candidate.id === pending.power);
  const copy = content.onboarding.powers.find(candidate => candidate.powerId === pending.power);
  const trigger = content.onboarding.triggers.find(candidate => candidate.id === pending.triggerId);
  if (power === undefined || copy === undefined || trigger === undefined) {
    throw new Error(`awakening content is missing ${pending.power}`);
  }
  const fixture = state.fixtures.find(candidate => candidate.id === pending.fixtureId);
  if (fixture === undefined) throw new Error('the awakening fixture is missing');
  const fillName = (value: string) => value.split('{name}').join(player.name);

  return {
    fixtureLabel: `S${fixture.season} · W${fixture.week} · Full time`,
    playerName: player.name,
    role: player.role,
    powerId: pending.power,
    powerName: power.name,
    limpCopy: fillName(content.onboarding.limp),
    triggerVisual: trigger.visual,
    triggerKicker: trigger.kicker,
    triggerTitle: trigger.title,
    triggerCallout: trigger.callout,
    triggerDetail: trigger.detail,
    triggerCopy: fillName(trigger.copy),
    omenCopy: fillName(copy.omen),
    revealCopy: fillName(copy.reveal),
    firstHero: pending.firstHero,
    licenseLabel: player.licensed ? 'Hero license active' : 'Awaiting hero license',
    continueLabel: pending.firstHero
      ? 'BEGIN THE HERO ERA  ▸'
      : state.phase === 'season-end' || state.phase === 'complete'
        ? 'CONTINUE TO SEASON REVIEW  ▸'
        : hasPostMatchReport
          ? 'CONTINUE TO MATCH REPORT  ▸'
          : 'RETURN TO THE OFFICE  ▸',
  };
}

export function clubFinancesViewModel(state: GameState): ClubFinancesViewModel {
  const club = requireUserClub(state);
  const latest = state.ledgers[state.ledgers.length - 1];
  const facilityUpkeep = state.careerMode !== 'full' || state.facilities.grid === undefined
    ? 0
    : weeklyFacilityUpkeep(state.facilities.grid);
  const coachWage = state.market === undefined ? 0 : careerCoachWageLedgerAmount(state.market);
  const projectedLines = latest?.lines ?? [
    { kind: 'wages' as const, label: 'Weekly wages', amount: -club.weeklyWages },
    ...(coachWage === 0 ? [] : [{
      kind: 'wages' as const,
      label: 'Head coach wage',
      amount: coachWage,
    }]),
    ...(facilityUpkeep === 0 ? [] : [{
      kind: 'facilities' as const,
      label: 'Facility upkeep',
      amount: -facilityUpkeep,
    }]),
    ...(state.season === 1 ? [{
      kind: 'subsidy' as const,
      label: 'Season 1 wage subsidy',
      amount: Math.floor(club.weeklyWages / 2),
    }] : []),
  ];
  const weeklyNet = projectedLines.reduce((sum, line) => sum + line.amount, 0);
  const trainingGroundProject = state.facilities.grid?.construction?.type === 'training-pitch'
    && state.facilities.grid.construction.kind === 'BUILD'
    ? state.facilities.grid.construction
    : undefined;
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
    recentTransactions: [...(state.cashTransactions ?? [])]
      .slice(-8)
      .reverse()
      .map(transaction => ({
        id: transaction.id,
        periodLabel: `S${transaction.season} · W${transaction.week}`,
        label: transaction.label,
        amount: transaction.amount,
        balanceAfter: transaction.balanceAfter,
        kind: transaction.amount > 0 ? 'income' as const : 'expense' as const,
      })),
    weeklyNet,
    projectedBalance: club.cash + weeklyNet,
    ...(state.season === 1 ? { wageSubsidyLabel: 'Season 1 support covers half of weekly wages' } : {}),
    trainingGround: {
      built: state.facilities.trainingGroundBuilt,
      underConstruction: trainingGroundProject !== undefined,
      ...(trainingGroundProject === undefined
        ? {}
        : { weeksRemaining: trainingGroundProject.weeksRemaining }),
      affordable: club.cash >= 8000 && trainingGroundProject === undefined,
      cost: 8000,
      weeklyTrainingPoints: 5,
    },
    legacyTrainingGroundVisible: state.careerMode !== 'full',
    ...(state.market?.headCoach === undefined ? {} : {
      headCoach: {
        id: state.market.headCoach.id,
        portraitId: state.market.headCoach.portraitId ?? state.market.headCoach.id,
        name: state.market.headCoach.name,
        level: state.market.headCoach.level,
        specialtyLabels: state.market.headCoach.specialties.map(readableLabel) as [string, string],
        weeklyWage: state.market.headCoach.weeklyWage,
        seasonsEmployed: state.market.headCoachSeasonsEmployed ?? 0,
        severanceCost: state.market.headCoach.weeklyWage,
      },
    }),
    facilities: facilityGridViewModel(state),
  };
}

function facilityGridViewModel(state: GameState): ClubFinancesViewModel['facilities'] {
  const grid = state.facilities.grid ?? createFacilityGrid();
  const club = requireUserClub(state);
  return {
    width: grid.width,
    height: grid.height,
    buildings: grid.buildings.map(building => {
      const definition = FACILITY_CATALOG[building.type];
      const project = grid.construction?.buildingId === building.id
        ? grid.construction
        : undefined;
      return {
        id: building.id,
        type: building.type,
        name: definition.name,
        level: building.level,
        x: building.x,
        y: building.y,
        width: definition.footprint.width,
        height: definition.footprint.height,
        weeklyUpkeep: project?.kind === 'BUILD' ? 0 : definition.weeklyUpkeep[building.level - 1],
        ...(building.level < 3
          ? { upgradeCost: definition.upgradeCosts[building.level - 1] }
          : {}),
        relocationFee: definition.relocationFee,
        status: project?.kind === 'BUILD'
          ? 'construction' as const
          : project?.kind === 'UPGRADE'
            ? 'upgrading' as const
            : 'operational' as const,
        ...(project === undefined ? {} : {
          weeksRemaining: project.weeksRemaining,
          targetLevel: project.targetLevel,
        }),
      };
    }),
    catalog: Object.values(FACILITY_CATALOG).map(definition => ({
      type: definition.type,
      name: definition.name,
      buildCost: definition.buildCost,
      width: definition.footprint.width,
      height: definition.footprint.height,
      available: definition.available,
      affordable: definition.available
        && grid.construction === undefined
        && club.cash >= definition.buildCost,
      buildWeeks: definition.buildWeeks,
      ...(!definition.available
        ? { blockedReason: 'Locked.' }
        : grid.construction !== undefined
          ? { blockedReason: 'Construction crew is already assigned.' }
          : club.cash < definition.buildCost
            ? { blockedReason: 'Insufficient balance.' }
            : {}),
    })),
    weeklyUpkeep: weeklyFacilityUpkeep(grid),
    activeAdjacencies: activeFacilityAdjacencies(grid),
    discoveredAdjacencies: [...grid.discoveredAdjacencies],
    ...(grid.construction === undefined ? {} : {
      activeProject: {
        buildingId: grid.construction.buildingId,
        name: FACILITY_CATALOG[grid.construction.type].name,
        kind: grid.construction.kind,
        weeksRemaining: grid.construction.weeksRemaining,
        totalWeeks: grid.construction.totalWeeks,
        targetLevel: grid.construction.targetLevel,
      },
    }),
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
  const requiresPlayer = false;

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
      return {
        id: choice.id,
        label: choice.label,
        detail: choice.risky
          ? 'Take the unusual club-culture response.'
          : 'Take the sensible groundskeeping response.',
        consequenceHint: describeSafeOutcome(choice.outcomes[0]?.effects ?? []),
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
  const division = careerDivision(state);
  const outcomeLabel = state.careerMode === 'full'
    ? user.position === 1 && division === 1
      ? 'CHAMPIONS' as const
      : user.position <= 2 && division > 1
        ? 'PROMOTED' as const
        : user.position >= 9 && division < 5
          ? 'RELEGATED' as const
          : 'SAFE' as const
    : user.position === 1 ? 'CHAMPIONS' as const : 'SAFE' as const;
  const expiredPlayers = sliceComplete ? [] : rosterForClub(state, state.userClubId)
    .filter(player => player.contractSeasonsRemaining === 0)
    .sort((left, right) => left.id.localeCompare(right.id));
  const expiredPlayer = state.careerMode === 'full'
    ? expiredPlayers[0]
    : expiredPlayers.find(player => player.power !== undefined);
  const renewalTalks = state.careerMode === 'full' ? state.market?.renewalTalks : undefined;
  const prizeMoney = state.ledgers[state.ledgers.length - 1]?.lines
    .filter(line => line.kind === 'prize')
    .reduce((sum, line) => sum + line.amount, 0) ?? 0;

  return {
    seasonLabel: state.careerMode === 'full'
      ? `Season ${state.season} · Division ${division}`
      : `Season ${state.season} of 2`,
    outcomeLabel,
    headline: outcomeLabel === 'CHAMPIONS'
      ? 'The club owns the country.'
      : outcomeLabel === 'PROMOTED'
        ? 'The climb continues.'
        : outcomeLabel === 'RELEGATED'
          ? 'A hard landing. The rebuild starts now.'
          : 'The board signs off on another year.',
    summary: state.careerMode === 'full'
      ? outcomeLabel === 'PROMOTED'
        ? `A place in Division ${division - 1} is secured. Contracts and retirements resolve before the new fixtures arrive.`
        : outcomeLabel === 'RELEGATED'
          ? `The club drops to Division ${division + 1}, but the endless career continues.`
          : 'Contracts, player aging, retirement announcements, and the next national campaign now resolve.'
      : sliceComplete
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
      promoted: row.position <= 2 && (state.careerMode !== 'full' || division > 1),
    })),
    ...(expiredPlayer ? {
      expiredContract: {
        playerId: expiredPlayer.id,
        playerName: expiredPlayer.name,
        role: expiredPlayer.role,
        powerName: content.powers.powers.find(power => power.id === expiredPlayer.power)?.name,
        currentWeeklyWage: expiredPlayer.weeklyWage,
        quotedWeeklyWage: renewalTalks?.playerId === expiredPlayer.id
          ? renewalTalks.negotiation.weeklyAsk
          : renewalQuote(expiredPlayer, 4),
        isHeroWageCliff: expiredPlayer.power !== undefined && !expiredPlayer.onHeroWage,
        termOptions: [1, 2, 3] as const,
        selectedTerm,
        decision: 'pending' as const,
        requiresNegotiation: state.careerMode === 'full',
        remainingExpiredCount: expiredPlayers.length,
      },
    } : {}),
    ...(renewalTalks === undefined || expiredPlayer === undefined
      ? {}
      : {
          renewalNegotiation: marketNegotiationViewModel({
            state: renewalTalks.negotiation,
            playerName: expiredPlayer.name,
            openingWeeklyWage: expiredPlayer.weeklyWage,
            wageStep: 50,
          }),
        }),
    sliceComplete,
    canContinue: sliceComplete || expiredPlayer === undefined,
  };
}

export function homeViewModel(state: GameState): HomeViewModel {
  const userClub = requireUserClub(state);
  const roster = rosterForClub(state, state.userClubId);
  const nextFixture = state.fixtures
    .filter(fixture =>
      fixture.status === 'scheduled' &&
      fixture.season === state.season &&
      (fixture.homeClubId === state.userClubId || fixture.awayClubId === state.userClubId),
    )
    .sort((left, right) => left.week - right.week || left.round - right.round)[0];
  const expired = roster
    .filter(player => player.contractSeasonsRemaining === 0);
  const injured = roster
    .filter(player => player.injuryWeeks > 0)
    .sort((left, right) => right.injuryWeeks - left.injuryWeeks || left.name.localeCompare(right.name));

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
    ...injured.map(player => ({
      id: `injury-${player.id}`,
      title: `${player.name} · OUT`,
      detail: `OUT · ${weekCountLabel(player.injuryWeeks)} — unavailable for selection.`,
      tone: 'urgent' as const,
    })),
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
    seasonLabel: state.careerMode === 'full'
      ? `Season ${state.season} · Division ${careerDivision(state)}`
      : `Season ${state.season} / 2`,
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
          competition: careerDivisionLabel(state),
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
    divisionLabel: careerDivisionLabel(state),
    seasonLabel: state.careerMode === 'full'
      ? `Season ${state.season}`
      : `Season ${state.season} / 2`,
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
  const matchday = activeCareerMatchday(state);
  if (matchday === undefined) throw new Error('the current matchday has no user fixture');
  const fixture = matchday.fixture;

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
  const lineupIds = new Set(lineup.playerIds);

  return {
    fixture: fixtureViewModel(
      state,
      fixture,
      matchday.kind === 'national-cup'
        ? `National Cup · ${matchday.cupRoundLabel ?? 'Knockout tie'}`
        : undefined,
    ),
    selectedTacticId: 'balanced',
    tactics: [{ id: 'balanced', label: 'Balanced', detail: 'The M1 match engine’s proven default shape.' }],
    lineup: lineupPlayers.map((player, index) => {
      return {
        id: player.id,
        name: player.name,
        role: player.role,
        shirtNumber: index + 1,
        isHero: player.power !== undefined,
        overall: overall(player.attrs),
        condition: player.condition ?? 100,
      };
    }),
    bench: roster.filter(player => !lineupIds.has(player.id)).map(player => {
      const unlicensedHero = player.power !== undefined && !player.licensed;
      return {
        id: player.id,
        name: player.name,
        role: player.role,
        shirtNumber: roster.findIndex(candidate => candidate.id === player.id) + 1,
        isHero: player.power !== undefined,
        overall: overall(player.attrs),
        condition: player.condition ?? 100,
        injuryWeeks: player.injuryWeeks,
        licensed: player.licensed,
        canStart: player.injuryWeeks === 0 && !unlicensedHero,
        ...(player.injuryWeeks > 0
          ? { unavailableLabel: `OUT · ${weekCountLabel(player.injuryWeeks)}` }
          : unlicensedHero
            ? { unavailableLabel: 'Hero License required' }
            : {}),
      };
    }),
    heroLimit: careerHeroLimit(state),
    heroes: roster.filter(player => player.power !== undefined).map(player => ({
      playerId: player.id,
      playerName: player.name,
      powerName: powerNames.get(player.power!) ?? player.power!,
      licensed: player.licensed,
    })),
    licenseReady: lineupPlayers.every(player => player.power === undefined || player.licensed)
      && lineupPlayers.filter(player => player.licensed).length <= careerHeroLimit(state),
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
  const lineup = state.lineups.find(candidate => candidate.clubId === state.userClubId);
  if (lineup === undefined) throw new Error('the user club has no starting lineup');
  const starterIds = new Set(lineup.playerIds);

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
      condition: player.condition ?? 100,
      injuryWeeks: player.injuryWeeks,
      isStarter: starterIds.has(player.id),
      age: player.age ?? 24,
      archetype: player.archetype ?? 'All-Rounder',
      potential: player.potential ?? 3,
      personality: player.personality ?? 'Professional',
      morale: player.morale,
      fame: player.fame ?? 0,
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

export function weeklyReviewViewModel(
  before: GameState,
  after: GameState,
): WeeklyReviewViewModel {
  const clubBefore = requireUserClub(before);
  const clubAfter = requireUserClub(after);
  const ledger = after.ledgers[after.ledgers.length - 1];
  if (
    ledger === undefined
    || ledger.season !== before.season
    || ledger.week !== before.week
  ) {
    throw new Error('weekly review requires a newly settled weekly ledger');
  }

  const nextFixture = after.fixtures
    .filter(fixture =>
      fixture.status === 'scheduled'
      && fixture.season === after.season
      && fixture.week === after.week
      && (fixture.homeClubId === after.userClubId || fixture.awayClubId === after.userClubId),
    )[0];
  const completedFacility = facilityCompletion(before, after);

  return {
    completedWeekLabel: `Week ${before.week} complete`,
    nextWeekLabel: after.phase === 'season-end' || after.phase === 'complete'
      ? 'Season review'
      : `Week ${after.week}`,
    clubName: clubAfter.name,
    cashBefore: clubBefore.cash,
    cashAfter: clubAfter.cash,
    netAmount: clubAfter.cash - clubBefore.cash,
    trainingPointsBefore: before.trainingPoints,
    trainingPointsAfter: after.trainingPoints,
    netTrainingPoints: after.trainingPoints - before.trainingPoints,
    ledger: ledger.lines.map((line, index) => ({
      id: `weekly-review-${ledger.season}-${ledger.week}-${index}`,
      label: line.label,
      amount: line.amount,
      kind: line.amount > 0 ? 'income' : line.amount < 0 ? 'expense' : 'neutral',
    })),
    development: playerDevelopmentViewModel(before, after),
    updates: weekUpdates(before, after),
    ...(completedFacility === undefined ? {} : { facilityCompletion: completedFacility }),
    ...(nextFixture === undefined ? {} : { nextFixture: fixtureViewModel(after, nextFixture) }),
  };
}

export function postMatchViewModel(
  before: GameState,
  after: GameState,
  fixtureId: string,
  score: { homeGoals: number; awayGoals: number },
  highlights: PostMatchViewModel['highlights'] = [],
): PostMatchViewModel {
  const leagueFixture = before.fixtures.find(candidate => candidate.id === fixtureId);
  const cupRound = before.m2?.nationalCups
    .flatMap(cup => cup.rounds)
    .find(round => round.fixtures.some(fixture => fixture.id === fixtureId));
  const fixture = leagueFixture ?? cupRound?.fixtures.find(candidate => candidate.id === fixtureId);
  if (fixture === undefined) throw new Error(`unknown fixture ${fixtureId}`);
  const isHome = fixture.homeClubId === before.userClubId;
  const goalsFor = isHome ? score.homeGoals : score.awayGoals;
  const goalsAgainst = isHome ? score.awayGoals : score.homeGoals;
  const latestLedger = after.ledgers[after.ledgers.length - 1];
  const ledger = latestLedger?.season === before.season && latestLedger.week === before.week
    ? latestLedger
    : undefined;
  const cupWinnerClubId = cupRound === undefined
    ? undefined
    : after.m2?.nationalCups
      .flatMap(cup => cup.rounds)
      .flatMap(round => round.fixtures)
      .find(candidate => candidate.id === fixtureId)?.winnerClubId;
  const outcomeLabel = cupWinnerClubId === undefined
    ? goalsFor > goalsAgainst ? 'WIN' : goalsFor < goalsAgainst ? 'LOSS' : 'DRAW'
    : cupWinnerClubId === before.userClubId ? 'WIN' : 'LOSS';
  const completedFacility = facilityCompletion(before, after);

  return {
    result: {
      fixtureId,
      competition: cupRound === undefined
        ? careerDivisionLabel(before)
        : `National Cup · ${cupRound.label}`,
      homeTeam: clubName(before, fixture.homeClubId),
      awayTeam: clubName(before, fixture.awayClubId),
      homeScore: score.homeGoals,
      awayScore: score.awayGoals,
      outcomeLabel,
      headline: cupRound !== undefined
        ? outcomeLabel === 'WIN'
          ? 'Cup dream alive. You are through.'
          : 'The cup run ends here. The league keeps moving.'
        : goalsFor > goalsAgainst
        ? 'The office will be loud tonight.'
        : goalsFor < goalsAgainst
          ? 'Plenty for the training board tomorrow.'
          : 'A point banked. The work continues.',
    },
    ledger: (ledger?.lines ?? []).map((line, index) => ({
      id: `${before.season}-${before.week}-${index}`,
      label: line.label,
      amount: line.amount,
      kind: line.amount > 0 ? 'income' : line.amount < 0 ? 'expense' : 'neutral',
    })),
    netAmount: (ledger?.lines ?? []).reduce((sum, line) => sum + line.amount, 0),
    trainingPointsGained: after.trainingPoints - before.trainingPoints,
    fanDelta: requireUserClub(after).fans - requireUserClub(before).fans,
    heroEssenceGained: after.heroEssence - before.heroEssence,
    highlights,
    development: playerDevelopmentViewModel(before, after),
    updates: weekUpdates(before, after),
    ...(completedFacility === undefined ? {} : { facilityCompletion: completedFacility }),
  };
}

function playerDevelopmentViewModel(
  before: GameState,
  after: GameState,
): PlayerDevelopmentViewModel {
  const ledger = after.ledgers[after.ledgers.length - 1];
  const plan = before.trainingPlan;
  const focusApplied = plan !== undefined
    && ledger?.season === before.season
    && ledger.week === before.week
    && ledger.lines.some(line => line.kind === 'training');
  const afterPlayers = new Map(after.players.map(player => [player.id, player]));

  const focusedTrainees = focusApplied && plan !== undefined
    ? plan.assignedPlayerIds.flatMap(playerId => {
        const playerBefore = before.players.find(player => player.id === playerId);
        const playerAfter = afterPlayers.get(playerId);
        if (playerBefore === undefined || playerAfter === undefined) return [];
        return [{
          id: playerBefore.id,
          name: playerBefore.name,
          role: playerBefore.role,
          gains: REVIEW_ATTRIBUTES.flatMap(attribute => {
            const delta = playerAfter.attrs[attribute] - playerBefore.attrs[attribute];
            return delta <= 0 ? [] : [{
              id: `${playerBefore.id}-${attribute}`,
              label: attribute.toUpperCase(),
              before: playerBefore.attrs[attribute],
              after: playerAfter.attrs[attribute],
              delta,
            }];
          }),
        }];
      })
    : [];

  const userPlayers = before.players.filter(player => player.clubId === before.userClubId);
  const conditioning = before.trainingRules === undefined
    ? []
    : REVIEW_ATTRIBUTES.flatMap(attribute => {
        const plannedGain = before.trainingRules?.baseConditioning.gains[attribute];
        if (plannedGain === undefined || plannedGain <= 0) return [];
        const affected = userPlayers.filter(player => player.attrs[attribute] < 99);
        if (affected.length === 0) return [];
        return [{
          id: `conditioning-${attribute}`,
          attributeLabel: attribute.toUpperCase(),
          gain: plannedGain,
          playerCount: affected.length,
        }];
      });

  return {
    focusedTrainees,
    conditioning,
    ...(plan !== undefined && !focusApplied ? {
      trainingSkippedWarning: skippedTrainingWarning(before, after),
    } : {}),
  };
}

function skippedTrainingWarning(before: GameState, after: GameState): string {
  const plan = before.trainingPlan;
  if (plan === undefined) return 'Focused training was skipped.';
  const moneyCost = plan.drills.reduce((sum, drill) => sum + drill.moneyCost, 0);
  const trainingPointCost = plan.drills.reduce((sum, drill) => sum + drill.tpCost, 0);
  const ambientTrainingPoints = before.facilities.trainingGroundBuilt ? 5 : 0;
  const availableTrainingPoints = Math.max(before.trainingPoints, after.trainingPoints - ambientTrainingPoints);
  const lacksMoney = moneyCost > requireUserClub(before).cash;
  const lacksTrainingPoints = trainingPointCost > availableTrainingPoints;
  const reason = lacksMoney && lacksTrainingPoints
    ? 'not enough money or TP'
    : lacksMoney
      ? 'not enough money'
      : lacksTrainingPoints
        ? 'not enough TP'
        : 'the weekly plan could not be funded';
  return `Focused training skipped — ${reason}.`;
}

function weekUpdates(before: GameState, after: GameState): WeeklyReviewViewModel['updates'] {
  const afterPlayers = new Map(after.players.map(player => [player.id, player]));
  const beforeLineup = before.lineups.find(lineup => lineup.clubId === before.userClubId);
  const afterLineup = after.lineups.find(lineup => lineup.clubId === after.userClubId);
  const updates: WeeklyReviewViewModel['updates'][number][] = [];
  const completedFacility = facilityCompletion(before, after);
  if (completedFacility !== undefined) {
    updates.push({
      id: `facility-complete-${completedFacility.type}-${completedFacility.level}`,
      title: `${completedFacility.name} complete!`,
      detail: completedFacility.kind === 'BUILD'
        ? `The Level ${completedFacility.level} facility is now open.`
        : `The Level ${completedFacility.level} upgrade is now active.`,
      tone: 'positive',
    });
  }
  for (const playerBefore of before.players.filter(player => player.clubId === before.userClubId)) {
    const playerAfter = afterPlayers.get(playerBefore.id);
    if (playerAfter === undefined) continue;
    if (playerBefore.injuryWeeks === 0 && playerAfter.injuryWeeks > 0) {
      const starterSlot = beforeLineup?.playerIds.indexOf(playerBefore.id) ?? -1;
      const replacementId = starterSlot >= 0 ? afterLineup?.playerIds[starterSlot] : undefined;
      const replacement = replacementId === undefined || replacementId === playerBefore.id
        ? undefined
        : afterPlayers.get(replacementId);
      updates.push({
        id: `injury-${playerBefore.id}`,
        title: `${playerBefore.name} ruled out`,
        detail: `OUT · ${weekCountLabel(playerAfter.injuryWeeks)}.${replacement === undefined
          ? ''
          : ` ${replacement.name} has moved into the Starting XI.`}`,
        tone: 'warning',
      });
    } else if (playerBefore.injuryWeeks > playerAfter.injuryWeeks) {
      updates.push({
        id: `injury-${playerBefore.id}`,
        title: playerAfter.injuryWeeks === 0 ? `${playerBefore.name} cleared to play` : `${playerBefore.name} recovering`,
        detail: playerAfter.injuryWeeks === 0
          ? 'The medical team has cleared the player for selection.'
          : `${playerAfter.injuryWeeks} week${playerAfter.injuryWeeks === 1 ? '' : 's'} remaining.`,
        tone: 'positive',
      });
    }
    if (playerBefore.contractSeasonsRemaining > playerAfter.contractSeasonsRemaining) {
      updates.push({
        id: `contract-${playerBefore.id}`,
        title: playerAfter.contractSeasonsRemaining === 0
          ? `${playerBefore.name} contract expired`
          : `${playerBefore.name} entering final season`,
        detail: playerAfter.contractSeasonsRemaining === 0
          ? 'A renewal decision is required before the next season.'
          : 'Renewal terms will matter at the next season review.',
        tone: 'warning',
      });
    }
  }
  if (
    after.pendingEvent !== undefined
    && after.pendingEvent.eventId !== before.pendingEvent?.eventId
  ) {
    updates.push({
      id: `event-${after.pendingEvent.eventId}`,
      title: 'New club event',
      detail: 'Something at the club needs your decision.',
      tone: 'info',
    });
  }
  return updates;
}

function facilityCompletion(
  before: GameState,
  after: GameState,
): WeeklyReviewViewModel['facilityCompletion'] {
  const project = before.facilities.grid?.construction;
  if (project === undefined || project.weeksRemaining !== 1) return undefined;
  const afterProject = after.facilities.grid?.construction;
  if (afterProject?.buildingId === project.buildingId) return undefined;
  const building = after.facilities.grid?.buildings.find(candidate => candidate.id === project.buildingId);
  if (building === undefined) return undefined;
  return {
    type: building.type,
    name: FACILITY_CATALOG[building.type].name,
    level: building.level,
    kind: project.kind,
  };
}

function weekCountLabel(weeks: number): string {
  return `${weeks} ${weeks === 1 ? 'WEEK' : 'WEEKS'}`;
}

function fixtureViewModel(
  state: GameState,
  fixture: GameState['fixtures'][number],
  competition = careerDivisionLabel(state),
): FixtureViewModel {
  const isHome = fixture.homeClubId === state.userClubId;
  const opponentId = isHome ? fixture.awayClubId : fixture.homeClubId;
  const isPowerlessOpening = state.onboarding?.stage === 'first-match'
    && state.onboarding.firstFixtureId === fixture.id;
  return {
    id: fixture.id,
    weekLabel: `W${fixture.week}`,
    competition,
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

function careerDivision(state: GameState): 1 | 2 | 3 | 4 | 5 {
  return state.m2 === undefined ? 5 : currentUserDivision(state.m2);
}

function careerDivisionLabel(state: GameState): string {
  return `Division ${careerDivision(state)}`;
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
  if (club !== undefined) return club.name;
  const pyramidClub = state.m2?.pyramid.divisions
    .flatMap(division => division.clubs)
    .find(candidate => candidate.id === clubId);
  if (pyramidClub === undefined) throw new Error(`unknown club ${clubId}`);
  return pyramidClub.name;
}

function requireUserClub(state: GameState) {
  const club = state.clubs.find(candidate => candidate.id === state.userClubId);
  if (club === undefined) throw new Error(`unknown user club ${state.userClubId}`);
  return club;
}

function readableLabel(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}
