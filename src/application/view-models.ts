import { loadLaunchContent, type GameEvent, type LaunchContent, type TrainingDrill } from '../content';
import {
  FACILITY_ADJACENCIES,
  FACILITY_CATALOG,
  TRAINING_PITCH_TP_PER_LEVEL,
  activeCareerMatchday,
  activeFacilityAdjacencies,
  careerHeroLimit,
  careerCoachWageLedgerAmount,
  chargeableCareerTrainingPlan,
  trainingSelectionMatchesSavedPlan,
  createFacilityGrid,
  currentUserDivision,
  difficultyRules,
  fixturesForCurrentWeek,
  isFacilityOperational,
  isAssistantInboxOneShotProductVisible,
  latestSeasonRecap,
  leagueStandings,
  nextPendingClubLegend,
  playerAttributeCaps,
  potentialGradeForOverall,
  projectedPlayerOverall,
  reconcilePendingClubLegends,
  renewalQuote,
  resolveCareerTrainingWeek,
  rosterForClub,
  roleOverall,
  scheduleAssistantInboxWeek,
  weeklyFacilityUpkeep,
  weeklyAmbientTrainingPoints,
  weeklyMerchandiseIncome,
  willRetireAtSeasonTransition,
  type CareerPlayer,
  type CareerTrainingDrill,
  type CareerTrainingPlan,
  type FacilityLevel,
  type FacilityType,
  type GameState,
  type PlacedFacility,
  type AssistantInboxGuideSequenceId,
} from '../game';
import type {
  AwakeningCutsceneViewModel,
  ClubLegacyViewModel,
  ClubFinancesViewModel,
  ClubAlertViewModel,
  FixtureViewModel,
  HomeViewModel,
  LeagueTableViewModel,
  LockedTrainingProgressViewModel,
  MatchDayViewModel,
  PostMatchViewModel,
  PlayerDevelopmentViewModel,
  SeasonEndViewModel,
  StoryEventViewModel,
  SquadTrainingViewModel,
  WeeklyReviewViewModel,
} from '../ui';
import { divisionTierLabel } from '../game/pyramid';
import {
  facilityUpgradeBlockedReason,
  highestDivisionReached,
  promotionRewardsForDivision,
  trainingDrillBlockedReason,
} from '../game/promotion-progression';
import { marketNegotiationViewModel } from './market-view-model';
import { coachRoleEffectLabels } from './coach-effects';
import {
  dueAssistantInboxGuideSequences,
  reconcileSatisfiedAssistantGuideSequences,
} from './assistant-guide';
import { eventChoiceUnavailableReason } from './event-selection';

const REVIEW_ATTRIBUTES = ['pac', 'sho', 'pas', 'def', 'tec', 'sta', 'ref'] as const;
const LAUNCH_CONTENT = loadLaunchContent();
const ASSISTANT_GUIDE_CONTENT = LAUNCH_CONTENT.assistantGuide;

export function clubLegacyViewModel(state: GameState): ClubLegacyViewModel {
  const reconciled = reconcilePendingClubLegends(state);
  const legend = nextPendingClubLegend(reconciled);
  if (legend === undefined) throw new Error('there is no pending club-legend decision');
  const pendingCount = reconciled.pendingLegacyPlayerIds?.length ?? 0;
  return {
    seasonLabel: `Season ${state.season}`,
    queueLabel: pendingCount === 1 ? 'Final legacy decision' : `${pendingCount} legacy decisions remain`,
    playerId: legend.id,
    playerName: legend.name,
    role: legend.role,
    lookId: legend.lookId,
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
    playerId: player.id,
    playerName: player.name,
    role: player.role,
    lookId: player.lookId,
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
  const wageSubsidyPercent = difficultyRules(state).seasonOneWageSubsidyPercent;
  const latest = state.ledgers[state.ledgers.length - 1];
  const facilityUpkeep = state.careerMode !== 'full' || state.facilities.grid === undefined
    ? 0
    : weeklyFacilityUpkeep(state.facilities.grid);
  const coachWage = state.market === undefined ? 0 : careerCoachWageLedgerAmount(state.market);
  const trainingMoneyCost = state.trainingPlan?.drills.reduce(
    (sum, drill) => sum + drill.moneyCost,
    0,
  ) ?? 0;
  const merchandiseIncome = weeklyMerchandiseIncome(state, club);
  const recurringProjectionLines = [
    ...(trainingMoneyCost === 0 ? [] : [{
      kind: 'training' as const,
      label: 'Planned focus training',
      amount: -trainingMoneyCost,
    }]),
    ...(merchandiseIncome === 0 ? [] : [{
      kind: 'merch' as const,
      label: 'Fan Shop merchandise',
      amount: merchandiseIncome,
    }]),
    { kind: 'wages' as const, label: 'Weekly wages', amount: -club.weeklyWages },
    ...(coachWage === 0 ? [] : [{
      kind: 'wages' as const,
      label: 'Coaching staff wages',
      amount: coachWage,
    }]),
    ...(facilityUpkeep === 0 ? [] : [{
      kind: 'facilities' as const,
      label: 'Facility upkeep',
      amount: -facilityUpkeep,
    }]),
    ...(state.season === 1 && wageSubsidyPercent > 0 ? [{
      kind: 'subsidy' as const,
      label: 'Season 1 wage subsidy',
      amount: Math.floor(
        (club.weeklyWages + Math.abs(coachWage)) * wageSubsidyPercent / 100,
      ),
    }] : []),
  ];
  const weeklyNet = recurringProjectionLines.reduce((sum, line) => sum + line.amount, 0);
  const displayLines = latest?.lines ?? recurringProjectionLines;
  const trainingGroundProject = state.facilities.grid?.construction?.type === 'training-pitch'
    && state.facilities.grid.construction.kind === 'BUILD'
    ? state.facilities.grid.construction
    : undefined;
  return {
    periodLabel: latest ? `S${latest.season} · W${latest.week}` : `S${state.season} · W${state.week}`,
    resources: {
      money: club.cash,
      trainingPoints: state.trainingPoints,
    },
    ledger: displayLines.map((line, index) => ({
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
    ...(state.season === 1 && wageSubsidyPercent > 0
      ? { wageSubsidyLabel: `Season 1 support covers ${wageSubsidyPercent}% of weekly wages` }
      : {}),
    trainingGround: {
      built: state.facilities.trainingGroundBuilt,
      underConstruction: trainingGroundProject !== undefined,
      ...(trainingGroundProject === undefined
        ? {}
        : { weeksRemaining: trainingGroundProject.weeksRemaining }),
      affordable: club.cash >= 8000 && trainingGroundProject === undefined,
      cost: 8000,
      weeklyTrainingPoints: 10,
    },
    legacyTrainingGroundVisible: state.careerMode !== 'full',
    ...(state.market?.headCoach === undefined ? {} : {
      headCoach: {
        id: state.market.headCoach.id,
        portraitId: state.market.headCoach.portraitId ?? state.market.headCoach.id,
        name: state.market.headCoach.name,
        age: state.market.headCoach.age ?? 45,
        level: state.market.headCoach.level,
        specialtyLabels: state.market.headCoach.specialties.map(readableLabel) as [string, string],
        weeklyWage: state.market.headCoach.weeklyWage,
        seasonsEmployed: state.market.headCoachSeasonsEmployed ?? 0,
        severanceCost: state.market.headCoach.weeklyWage,
      },
    }),
    ...(state.market?.assistantCoach === undefined ? {} : {
      assistantCoach: {
        id: state.market.assistantCoach.id,
        name: state.market.assistantCoach.name,
        level: state.market.assistantCoach.level,
        specialtyLabels: state.market.assistantCoach.specialties.map(readableLabel) as [string, string],
        weeklyWage: state.market.assistantCoach.weeklyWage,
        seasonsEmployed: state.market.assistantCoachSeasonsEmployed ?? 0,
      },
    }),
    facilities: facilityGridViewModel(state),
  };
}

function facilityGridViewModel(state: GameState): ClubFinancesViewModel['facilities'] {
  const grid = state.facilities.grid ?? createFacilityGrid();
  const club = requireUserClub(state);
  const activeAdjacencies = activeFacilityAdjacencies(grid);
  return {
    width: grid.width,
    height: grid.height,
    buildings: grid.buildings.map(building => {
      const definition = FACILITY_CATALOG[building.type];
      const project = grid.construction?.buildingId === building.id
        ? grid.construction
        : undefined;
      const upgradeCost = building.level < 3
        ? definition.upgradeCosts[building.level - 1]
        : undefined;
      const nextLevelEffectLabel = building.level < 3
        ? facilityNextLevelEffectLabel(building.type, (building.level + 1) as FacilityLevel)
        : undefined;
      const upgradeBlockedReason = building.level < 3
        ? facilityUpgradeBlockedReason(state, (building.level + 1) as FacilityLevel)
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
        effectLabel: facilityEffectLabel(building.type, building.level),
        ...(upgradeCost === undefined ? {} : { upgradeCost }),
        ...(nextLevelEffectLabel === undefined ? {} : { nextLevelEffectLabel }),
        ...(upgradeBlockedReason === undefined ? {} : { upgradeBlockedReason }),
        canUpgrade: grid.construction === undefined
          && upgradeCost !== undefined
          && upgradeBlockedReason === undefined
          && club.cash >= upgradeCost,
        upgradeShortfall: upgradeCost === undefined ? 0 : Math.max(0, upgradeCost - club.cash),
        relocationFee: definition.relocationFee,
        canRelocate: grid.construction === undefined && club.cash >= definition.relocationFee,
        relocationShortfall: Math.max(0, definition.relocationFee - club.cash),
        activeAdjacencyIds: activeAdjacencyIdsForBuilding(grid.buildings, building, activeAdjacencies),
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
    catalog: Object.values(FACILITY_CATALOG).filter(definition => definition.available).map(definition => ({
      type: definition.type,
      name: definition.name,
      buildCost: definition.buildCost,
      width: definition.footprint.width,
      height: definition.footprint.height,
      weeklyUpkeep: definition.weeklyUpkeep[0],
      effectLabel: facilityEffectLabel(definition.type, 1),
      available: definition.available,
      affordable: definition.available
        && grid.construction === undefined
        && club.cash >= definition.buildCost,
      affordabilityShortfall: definition.available
        ? Math.max(0, definition.buildCost - club.cash)
        : 0,
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
    activeAdjacencies,
    discoveredAdjacencies: [...grid.discoveredAdjacencies],
    ...(grid.construction === undefined ? {} : {
      activeProject: {
        buildingId: grid.construction.buildingId,
        name: FACILITY_CATALOG[grid.construction.type].name,
        benefitLabel: facilityEffectLabel(
          grid.construction.type,
          grid.construction.targetLevel,
        ),
        kind: grid.construction.kind,
        weeksRemaining: grid.construction.weeksRemaining,
        totalWeeks: grid.construction.totalWeeks,
        targetLevel: grid.construction.targetLevel,
      },
    }),
  };
}

function facilityEffectLabel(type: FacilityType, level: FacilityLevel): string {
  const trainingEffect = (attributes: string): string => level === 1
    ? `Level 1: no ${attributes} bonus · upgrades add +50%/+100%`
    : `${level === 2 ? '+50%' : '+100%'} ${attributes} training`;
  if (type === 'training-pitch') {
    return level === 1
      ? '+10 TP weekly · upgrades boost DEF training'
      : `+${level * 10} TP weekly · ${level === 2 ? '+50%' : '+100%'} DEF training`;
  }
  if (type === 'gym') return trainingEffect('PAC + STA');
  if (type === 'tech-center') return trainingEffect('PAS + TEC');
  if (type === 'shooting-range') return trainingEffect('SHO');
  if (type === 'keeper-court') return trainingEffect('REF');
  if (type === 'medical-bay') {
    return `Recovery -${level} week${level === 1 ? '' : 's'} · adjacency bonus available`;
  }
  if (type === 'dorm') return 'Rest quarters · adjacency bonus only';
  if (type === 'scout-office') {
    return level === 1
      ? 'Scout intel desk · upgrades narrow stat ranges'
      : level === 2
        ? 'Scout reports show tighter stat ranges'
        : 'Precise reports reveal confirmed powers';
  }
  if (type === 'coaching-office') return 'Unlocks the assistant coach position';
  if (type === 'youth-field') {
    return `Youth starting strength +${level * 5}`;
  }
  if (type === 'fan-shop') return `Weekly merchandise scales with fans · x${level}`;
  if (type === 'stadium-stand') return 'Matchday crowd route · adjacency bonus only';
  throw new Error(`missing facility effect copy for ${type}`);
}

function facilityNextLevelEffectLabel(
  type: FacilityType,
  nextLevel: FacilityLevel,
): string | undefined {
  if (type === 'dorm'
    || type === 'coaching-office'
    || type === 'stadium-stand') {
    return undefined;
  }
  return facilityEffectLabel(type, nextLevel);
}

function activeAdjacencyIdsForBuilding(
  buildings: readonly PlacedFacility[],
  building: PlacedFacility,
  activeAdjacencies: readonly string[],
): string[] {
  const active = new Set(activeAdjacencies);
  return FACILITY_ADJACENCIES.filter(adjacency => (
    active.has(adjacency.id)
    && (building.type === adjacency.first || building.type === adjacency.second)
    && buildings.some(other => (
      other.id !== building.id
      && other.type === (building.type === adjacency.first ? adjacency.second : adjacency.first)
      && facilitiesShareEdge(building, other)
    ))
  )).map(adjacency => adjacency.id);
}

function facilitiesShareEdge(first: PlacedFacility, second: PlacedFacility): boolean {
  const firstFootprint = FACILITY_CATALOG[first.type].footprint;
  const secondFootprint = FACILITY_CATALOG[second.type].footprint;
  const horizontalContact = first.x + firstFootprint.width === second.x
    || second.x + secondFootprint.width === first.x;
  const verticalContact = first.y + firstFootprint.height === second.y
    || second.y + secondFootprint.height === first.y;
  const verticalOverlap = first.y < second.y + secondFootprint.height
    && second.y < first.y + firstFootprint.height;
  const horizontalOverlap = first.x < second.x + secondFootprint.width
    && second.x < first.x + firstFootprint.width;
  return (horizontalContact && verticalOverlap) || (verticalContact && horizontalOverlap);
}

export function storyEventViewModel(state: GameState, content: LaunchContent): StoryEventViewModel {
  const pending = state.pendingEvent;
  if (pending === undefined) throw new Error('there is no pending story event');
  const event = content.events.events.find(candidate => candidate.id === pending.eventId);
  if (event === undefined) throw new Error(`unknown story event ${pending.eventId}`);
  const selected = pending.selectedPlayerId === undefined
    ? undefined
    : state.players.find(player => player.id === pending.selectedPlayerId);
  const selectedIsStarter = selected === undefined ? false : state.lineups
    .find(lineup => lineup.clubId === state.userClubId)?.playerIds.includes(selected.id) === true;
  const requiresPlayer = event.trigger.requiresPlayer === true;
  const resolvedChoice = pending.resolvedChoiceId === undefined
    ? undefined
    : event.choices.find(choice => choice.id === pending.resolvedChoiceId);
  const resolvedOutcome = pending.resolvedOutcomeIndex === undefined
    ? undefined
    : resolvedChoice?.outcomes[pending.resolvedOutcomeIndex];

  return {
    id: event.id,
    artKey: event.art,
    category: event.category,
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
          : selected.power !== undefined
            ? `Licensed hero · ${selectedIsStarter ? 'Starting XI' : 'Squad player'}`
            : selectedIsStarter ? 'Starting XI' : 'Squad player',
        ...(selected.power ? {
          powerName: content.powers.powers.find(power => power.id === selected.power)?.name ?? selected.power,
        } : {}),
      },
    } : {}),
    playerSelectionRequired: requiresPlayer,
    choices: event.choices.map(choice => {
      const disabledReason = eventChoiceUnavailableReason(state, choice);
      return {
        id: choice.id,
        label: choice.label,
        detail: choice.risky
          ? 'An unusual choice with a bigger upside and a real chance of disappointment.'
          : 'The steadier option with a guaranteed outcome.',
        consequenceHint: describeEventChoiceOutcome(choice),
        tone: choice.risky ? 'risky' as const : 'safe' as const,
        disabled: pending.resolvedChoiceId !== undefined || disabledReason !== undefined,
        ...(disabledReason === undefined ? {} : { disabledReason }),
      };
    }),
    ...(pending.resolvedChoiceId ? { resolvedChoiceId: pending.resolvedChoiceId } : {}),
    ...(pending.outcomeText ? { outcomeTitle: 'The choice is made', outcomeText: pending.outcomeText } : {}),
    ...(pending.resolvedRisky === true && pending.resolvedSuccess === true && resolvedOutcome !== undefined
      ? {
          successCutscene: {
            artKey: `${event.art}-success`,
            headline: resolvedOutcome.successHeadline ?? event.title.replace(/[!?]+$/, ''),
            rewards: eventRewardLabels(resolvedOutcome.effects),
            ...(pending.resolvedNextEventId === undefined ? {} : { hasFollowUp: true as const }),
          },
        }
      : {}),
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
    .filter(player => player.contractSeasonsRemaining === 0
      && !willRetireAtSeasonTransition(player, state.season))
    .sort((left, right) => left.id.localeCompare(right.id));
  const expiredPlayer = state.careerMode === 'full'
    ? expiredPlayers[0]
    : expiredPlayers.find(player => player.power !== undefined);
  const renewalTalks = state.careerMode === 'full' ? state.market?.renewalTalks : undefined;
  const prizeMoney = state.ledgers[state.ledgers.length - 1]?.lines
    .filter(line => line.kind === 'prize')
    .reduce((sum, line) => sum + line.amount, 0) ?? 0;
  const promotedDivision = outcomeLabel === 'PROMOTED'
    ? (division - 1) as 1 | 2 | 3 | 4
    : undefined;
  const newlyUnlockedRewards = promotedDivision !== undefined
    && promotedDivision < highestDivisionReached(state)
    ? promotionRewardsForDivision(promotedDivision)
    : [];
  const recap = latestSeasonRecap(state);
  const recapAwards = recap === undefined
    ? []
    : [recap.playerOfSeason, recap.topScorer, recap.youngPlayer, recap.heroOfSeason]
      .filter((award): award is NonNullable<typeof award> => award !== undefined)
      .flatMap(award => {
        const player = state.players.find(candidate => candidate.id === award.playerId);
        return player === undefined ? [] : [{
          ...award,
          role: player.role,
          ...(player.lookId === undefined ? {} : { lookId: player.lookId }),
        }];
      });
  const memorableEventTitle = recap?.memorableEventId === undefined
    ? undefined
    : content.events.events.find(event => event.id === recap.memorableEventId)?.title;

  return {
    seasonLabel: state.careerMode === 'full'
      ? `Season ${state.season} · ${divisionTierLabel(division)}`
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
        ? `A place in ${divisionTierLabel((division - 1) as 1 | 2 | 3 | 4)} is secured. Contracts and retirements resolve before the new fixtures arrive.`
        : outcomeLabel === 'RELEGATED'
          ? `The club drops to ${divisionTierLabel((division + 1) as 2 | 3 | 4 | 5)}, but the endless career continues.`
          : 'Contracts, player aging, retirement announcements, and the next national campaign now resolve.'
      : sliceComplete
        ? 'Two seasons are complete. Your club is ready for the full career.'
        : 'Before Season 2 begins, the awakened bargain contract finally reaches the agent’s desk.',
    finalPosition: user.position,
    prizeMoney,
    difficultyLabel: state.difficulty ?? 'COZY',
    ...(recap === undefined ? {} : {
      recap: {
        record: `${recap.won}W · ${recap.drawn}D · ${recap.lost}L`,
        goals: `${recap.goalsFor} for · ${recap.goalsAgainst} against`,
        cashChange: recap.cashChange,
        closingCash: recap.closingCash,
        trainingCapsReached: recap.trainingCapsReached,
        cupResult: recap.cupResult,
        ...(memorableEventTitle === undefined ? {} : { memorableEventTitle }),
        awards: recapAwards,
      },
    }),
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
    ...(promotedDivision === undefined || newlyUnlockedRewards.length === 0
      ? {}
      : {
          promotionRewards: {
            divisionLabel: divisionTierLabel(promotedDivision),
            items: newlyUnlockedRewards.map(reward => ({ ...reward })),
          },
        }),
    ...(expiredPlayer ? {
      expiredContract: {
        playerId: expiredPlayer.id,
        playerName: expiredPlayer.name,
        role: expiredPlayer.role,
        lookId: expiredPlayer.lookId,
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
            playerRole: expiredPlayer.role,
            lookId: expiredPlayer.lookId,
            openingWeeklyWage: expiredPlayer.weeklyWage,
            wageStep: 50,
          }),
        }),
    sliceComplete,
    canContinue: sliceComplete || expiredPlayer === undefined,
  };
}

/** Live, uncapped product alerts before Bert's weekly desk scheduler. */
export function homeProductAlerts(state: GameState): ClubAlertViewModel[] {
  const roster = rosterForClub(state, state.userClubId);
  const expired = roster.filter(player => player.contractSeasonsRemaining === 0);
  const injured = roster
    .filter(player => player.injuryWeeks > 0)
    .sort((left, right) => right.injuryWeeks - left.injuryWeeks || left.name.localeCompare(right.name));
  const transferRequests = roster.filter(player => player.transferRequested === true);
  const retirementAnnouncements = (state.retirementAnnouncements ?? [])
    .filter(announcement => announcement.announcedInSeason === state.season - 1)
    .sort((left, right) => left.playerName.localeCompare(right.playerName));
  const negativeCashWeeks = state.financialSafety?.consecutiveNegativeWeeks ?? 0;
  const loan = state.financialSafety?.loan;
  const boardUltimatum = state.financialSafety?.boardUltimatum;
  const latestBoardResolution = state.financialSafety?.latestBoardResolution;
  const boardResolutionAlertId = latestBoardResolution === undefined
    ? undefined
    : `board-resolution:${latestBoardResolution.id}`;
  const showBoardResolution = boardResolutionAlertId !== undefined
    && isAssistantInboxOneShotProductVisible(state, boardResolutionAlertId);
  const trainingGroundUnderConstruction = state.facilities.grid?.construction?.kind === 'BUILD'
    && state.facilities.grid.construction.type === 'training-pitch';
  const trainingCapAlerts = (state.trainingCapNotices ?? [])
    .filter(notice => isAssistantInboxOneShotProductVisible(state, notice.id))
    .map(notice => {
      const drillName = LAUNCH_CONTENT.training.focusDrills
        .find(drill => drill.id === notice.drillId)?.name
        ?? notice.drillId.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
      const attribute = notice.attribute.toUpperCase();
      if (notice.kind === 'skipped') {
        return {
          id: notice.id,
          title: `${notice.playerName} skipped ${drillName}`,
          detail: `${notice.playerName} is already at their ${attribute} maximum of ${notice.cap}. Pick another player or drill for next week.`,
          tone: 'info' as const,
        };
      }
      return {
        id: notice.id,
        title: `${notice.playerName} reached their ${attribute} maximum`,
        detail: `${drillName} took ${attribute} to its personal maximum of ${notice.cap}. Pick another player for this drill next week.`,
        tone: 'info' as const,
      };
    });

  return [
    ...trainingCapAlerts,
    ...(!state.facilities.trainingGroundBuilt && !trainingGroundUnderConstruction ? [{
      id: 'training-ground',
      title: 'Build your Training Pitch',
      detail: 'Your starting budget includes its $8,000 cost. Choose where it goes.',
      tone: 'info' as const,
    }] : []),
    ...(expired.length > 0 ? [{
      id: 'renewals',
      title: `${expired.length} contract${expired.length === 1 ? '' : 's'} expired`,
      detail: 'Resolve these contracts before the next season can begin.',
      tone: 'urgent' as const,
    }] : []),
    ...injured.map(player => ({
      id: `injury-${player.id}`,
      title: `${player.name} · OUT`,
      detail: `OUT · ${weekCountLabel(player.injuryWeeks)} — unavailable for selection.`,
      tone: 'urgent' as const,
    })),
    ...transferRequests.map(player => ({
      id: `transfer-request-${player.id}`,
      title: `${player.name} wants to leave`,
      detail: 'Low morale has become a transfer request. Review the player and decide whether to sell.',
      tone: 'urgent' as const,
    })),
    ...retirementAnnouncements.map(announcement => ({
      id: `retirement-announcement-${announcement.announcedInSeason}-${announcement.playerId}`,
      title: `${announcement.playerName} announces final season`,
      detail: `Age ${announcement.retirementAge} · retires after Season ${state.season}.`,
      tone: 'info' as const,
    })),
    ...(negativeCashWeeks > 0 ? [{
      id: 'financial-warning',
      title: 'Board financial warning',
      detail: `Cash has stayed negative for ${negativeCashWeeks} week${negativeCashWeeks === 1 ? '' : 's'}. Transfers and building are locked until the balance recovers.`,
      tone: 'urgent' as const,
    }] : []),
    ...(loan !== undefined && loan.remainingBalance > 0 ? [{
      id: 'emergency-loan',
      title: 'Emergency loan active',
      detail: `${formatMoney(loan.remainingBalance)} remains. Repayments begin in Season ${loan.repaymentStartsSeason}.`,
      tone: 'info' as const,
    }] : []),
    ...(boardUltimatum === undefined ? [] : [{
      id: 'board-ultimatum',
      title: `Board deadline · ${boardUltimatum.weeksRemaining} week${boardUltimatum.weeksRemaining === 1 ? '' : 's'}`,
      detail: `Reach ${formatMoney(boardUltimatum.targetCash)} cash or the board will sell one visible, unprotected candidate.`,
      tone: 'urgent' as const,
    }]),
    ...(!showBoardResolution || latestBoardResolution === undefined ? [] : [{
      id: boardResolutionAlertId!,
      title: latestBoardResolution.kind === 'TARGET_MET'
        ? 'Board cash target met'
        : 'Board sale completed',
      detail: latestBoardResolution.kind === 'TARGET_MET'
        ? 'The intervention is closed. No player was sold.'
        : `${state.players.find(player => player.id === latestBoardResolution.playerId)?.name ?? 'A player'} joined ${clubName(state, latestBoardResolution.buyerClubId)} for ${formatMoney(latestBoardResolution.fee)}.`,
      tone: latestBoardResolution.kind === 'TARGET_MET' ? 'info' as const : 'urgent' as const,
    }]),
  ];
}

export function reconcileHomeAssistantInbox(state: GameState): GameState {
  return homeAssistantInboxPlan(state).state;
}

function homeAssistantInboxPlan(state: GameState) {
  state = reconcileSatisfiedAssistantGuideSequences(state);
  const productAlerts = homeProductAlerts(state);
  const dueGuides = dueAssistantInboxGuideSequences(state);
  return scheduleAssistantInboxWeek(state, {
    dueGuideSequenceIds: standaloneInboxGuides(dueGuides, productAlerts),
    productAlerts: productAlerts.map(alert => ({
      id: alert.id,
      priority: assistantProductPriority(alert, dueGuides),
      oneShot: isOneShotProductAlert(alert.id),
    })),
  });
}

function assistantProductPriority(
  alert: ClubAlertViewModel,
  dueGuides: readonly AssistantInboxGuideSequenceId[],
): 'urgent' | 'normal' {
  // The guided first week cannot advance until this project starts, so reserve
  // it a slot without presenting the calm proposal as a red emergency card.
  if (alert.id === 'training-ground') return 'urgent';
  if (alert.tone === 'urgent') return 'urgent';
  if (dueGuides.includes('retirement') && alert.id.startsWith('retirement-announcement-')) {
    return 'urgent';
  }
  return 'normal';
}

function isOneShotProductAlert(alertId: string): boolean {
  return alertId.startsWith('board-resolution:') || alertId.startsWith('training-cap:');
}

function standaloneInboxGuides(
  dueGuides: readonly AssistantInboxGuideSequenceId[],
  productAlerts: readonly ClubAlertViewModel[],
): AssistantInboxGuideSequenceId[] {
  const trainingGroundCarriesFacilityGuide = productAlerts.some(alert => alert.id === 'training-ground')
    && dueGuides.includes('facility-placement');
  return dueGuides.filter(sequenceId => (
    sequenceId !== 'board-ultimatum'
    && sequenceId !== 'board-protection'
    && sequenceId !== 'retirement'
    && sequenceId !== 'first-injury'
    && sequenceId !== 'first-emergency-loan'
    && sequenceId !== 'first-transfer-request'
    && (!trainingGroundCarriesFacilityGuide || sequenceId !== 'facility-placement')
  ));
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
  const boardUltimatum = state.financialSafety?.boardUltimatum;
  const rosterById = new Map(roster.map(player => [player.id, player]));
  const latestBoardResolution = state.financialSafety?.latestBoardResolution;
  const showBoardResolution = latestBoardResolution !== undefined
    && isAssistantInboxOneShotProductVisible(
      state,
      `board-resolution:${latestBoardResolution.id}`,
    );
  const assistantState = reconcileSatisfiedAssistantGuideSequences(state);
  const productAlerts = homeProductAlerts(assistantState);
  const dueGuides = dueAssistantInboxGuideSequences(assistantState);
  const inboxPlan = scheduleAssistantInboxWeek(assistantState, {
    dueGuideSequenceIds: standaloneInboxGuides(dueGuides, productAlerts),
    productAlerts: productAlerts.map(alert => ({
      id: alert.id,
      priority: assistantProductPriority(alert, dueGuides),
      oneShot: isOneShotProductAlert(alert.id),
    })),
  });
  const selectedProductIds = new Set(inboxPlan.productAlertIds);
  const boardGuide = dueGuides.find(sequenceId => (
    sequenceId === 'board-ultimatum' || sequenceId === 'board-protection'
  ));
  let retirementGuideAssigned = false;
  let injuryGuideAssigned = false;
  let loanGuideAssigned = false;
  let transferRequestGuideAssigned = false;
  let facilityGuideAssigned = false;
  const selectedProducts = productAlerts
    .filter(alert => selectedProductIds.has(alert.id))
    .map(alert => {
      const guideSequenceId = alert.id === 'board-ultimatum'
        ? boardGuide
        : !facilityGuideAssigned
          && dueGuides.includes('facility-placement')
          && alert.id === 'training-ground'
          ? 'facility-placement' as const
        : !injuryGuideAssigned
          && dueGuides.includes('first-injury')
          && alert.id.startsWith('injury-')
          ? 'first-injury' as const
          : !loanGuideAssigned
            && dueGuides.includes('first-emergency-loan')
            && alert.id === 'emergency-loan'
            ? 'first-emergency-loan' as const
            : !transferRequestGuideAssigned
              && dueGuides.includes('first-transfer-request')
              && alert.id.startsWith('transfer-request-')
              ? 'first-transfer-request' as const
        : !retirementGuideAssigned
          && dueGuides.includes('retirement')
          && alert.id.startsWith('retirement-announcement-')
          ? 'retirement' as const
          : undefined;
      if (guideSequenceId === undefined) return alert;
      if (guideSequenceId === 'retirement') retirementGuideAssigned = true;
      if (guideSequenceId === 'first-injury') injuryGuideAssigned = true;
      if (guideSequenceId === 'first-emergency-loan') loanGuideAssigned = true;
      if (guideSequenceId === 'first-transfer-request') transferRequestGuideAssigned = true;
      if (guideSequenceId === 'facility-placement') facilityGuideAssigned = true;
      const sequence = ASSISTANT_GUIDE_CONTENT.sequences.find(candidate => candidate.id === guideSequenceId);
      if (sequence?.destination === undefined) throw new Error(`assistant guide ${guideSequenceId} is missing routing`);
      return {
        ...alert,
        guideSequenceId,
        destination: sequence.destination,
      };
    });
  const guideAlerts: ClubAlertViewModel[] = inboxPlan.guideSequenceIds.map(sequenceId => {
    const sequence = ASSISTANT_GUIDE_CONTENT.sequences.find(candidate => candidate.id === sequenceId);
    if (sequence?.inbox === undefined || sequence.destination === undefined) {
      throw new Error(`assistant guide ${sequenceId} is missing inbox routing`);
    }
    return {
      id: `assistant-guide:${sequenceId}`,
      title: sequence.inbox.title,
      detail: sequence.inbox.detail,
      tone: sequenceId === 'board-ultimatum' || sequenceId === 'board-protection'
        ? 'urgent'
        : 'event',
      guideSequenceId: sequenceId,
      destination: sequence.destination,
    };
  });
  const alerts = [
    ...selectedProducts.filter(alert => alert.tone === 'urgent'),
    ...guideAlerts,
    ...selectedProducts.filter(alert => alert.tone !== 'urgent'),
  ].slice(0, 3);

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
      ? `Season ${state.season} · ${divisionTierLabel(careerDivision(state))}`
      : `Season ${state.season} / 2`,
    divisionLabel: state.careerMode === 'full'
      ? divisionTierLabel(careerDivision(state))
      : divisionTierLabel(5),
    weekLabel: `Week ${state.week} / 30`,
    nextMatchTimingLabel: nextFixture === undefined
      ? state.phase === 'complete' ? 'Complete' : 'Season end'
      : nextFixture.week <= state.week
        ? 'This week'
        : `In ${weekCountLabel(nextFixture.week - state.week).toLowerCase()}`,
    form: recentForm(state),
    resources: {
      money: userClub.cash,
      trainingPoints: state.trainingPoints,
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
    ...(boardUltimatum === undefined ? {} : {
      boardUltimatum: {
        id: boardUltimatum.id,
        weeksRemaining: boardUltimatum.weeksRemaining,
        targetCash: boardUltimatum.targetCash,
        cashNeeded: Math.max(0, boardUltimatum.targetCash - userClub.cash),
        ...(boardUltimatum.protectedPlayerId === undefined
          || !rosterById.has(boardUltimatum.protectedPlayerId)
          ? {}
          : { protectedPlayerId: boardUltimatum.protectedPlayerId }),
        candidates: boardUltimatum.candidates.flatMap(candidate => {
          const player = rosterById.get(candidate.playerId);
          if (player === undefined) return [];
          return [{
            playerId: player.id,
            playerName: player.name,
            role: player.role,
            lookId: player.lookId,
            weeklyWage: player.weeklyWage,
            marketValue: candidate.marketValue,
            forcedSaleFee: candidate.forcedSaleFee,
            discountPercent: candidate.discountPercent,
            isHero: player.power !== undefined,
          }];
        }),
      },
    }),
    ...(!showBoardResolution || latestBoardResolution === undefined ? {} : {
      boardResolution: latestBoardResolution.kind === 'TARGET_MET'
        ? {
            kind: 'TARGET_MET' as const,
            headline: 'Cash target met',
            detail: 'The board closes the intervention. The squad stays together.',
          }
        : (() => {
            const sold = state.players.find(player => player.id === latestBoardResolution.playerId);
            const replacement = state.players.find(player => player.id === latestBoardResolution.replacementPlayerId);
            if (sold === undefined || replacement === undefined) {
              throw new Error('board resolution references missing players');
            }
            return {
              kind: 'FORCED_SALE' as const,
              headline: 'A hard sale—and a new chance',
              detail: `${sold.name} joined ${clubName(state, latestBoardResolution.buyerClubId)}. The academy promoted ${replacement.name} to keep a complete 16-player squad.`,
              soldPlayer: {
                id: sold.id,
                name: sold.name,
                role: sold.role,
                lookId: sold.lookId,
                buyerName: clubName(state, latestBoardResolution.buyerClubId),
                fee: latestBoardResolution.fee,
              },
              replacementPlayer: {
                id: replacement.id,
                name: replacement.name,
                role: replacement.role,
                lookId: replacement.lookId,
                age: replacement.age ?? 17,
                weeklyWage: replacement.weeklyWage,
              },
              fansLost: latestBoardResolution.fansLost,
              moraleDelta: latestBoardResolution.moraleDelta,
            };
          })(),
    }),
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

export function matchDayViewModel(
  state: GameState,
  content: LaunchContent,
  formationLabel = '4–4–2',
): MatchDayViewModel {
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
    formationLabel,
    selectedTacticId: 'balanced',
    tactics: [{ id: 'balanced', label: 'Balanced', detail: 'A steady shape with equal attacking and defensive intent.' }],
    lineup: lineupPlayers.map((player, index) => {
      return {
        id: player.id,
        name: player.name,
        role: player.role,
        lookId: player.lookId,
        shirtNumber: player.shirtNumber ?? index + 1,
        isHero: player.power !== undefined,
        overall: overall(player.role, player.attrs),
        condition: player.condition ?? 100,
      };
    }),
    bench: roster.filter(player => !lineupIds.has(player.id)).map(player => {
      const unlicensedHero = player.power !== undefined && !player.licensed;
      return {
        id: player.id,
        name: player.name,
        role: player.role,
        lookId: player.lookId,
        shirtNumber: player.shirtNumber ?? roster.findIndex(candidate => candidate.id === player.id) + 1,
        isHero: player.power !== undefined,
        overall: overall(player.role, player.attrs),
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
  const chargeablePlan = assignedPlayerIds.length === 0
    ? undefined
    : chargeableCareerTrainingPlan(state, assignedPlayerIds, selectedDrills);
  const totalMoneyCost = chargeablePlan?.moneyCost
    ?? 0;
  const totalTrainingPointCost = chargeablePlan?.trainingPointCost
    ?? selectedDrills.reduce((sum, drill) => sum + drill.tpCost, 0);
  const savedPlan = state.trainingPlan;
  const selectionMatchesSavedPlan = trainingSelectionMatchesSavedPlan(
    savedPlan,
    assignedPlayerIds,
    selectedDrillIds,
  );
  const hasUnsavedChanges = savedPlan !== undefined && !selectionMatchesSavedPlan;
  const lineup = state.lineups.find(candidate => candidate.clubId === state.userClubId);
  if (lineup === undefined) throw new Error('the user club has no starting lineup');
  const starterIds = new Set(lineup.playerIds);
  const roster = rosterForClub(state, state.userClubId);
  const createdPlayerId = state.onboarding?.createdPlayerId;
  // Keep the first-training cue and its created-player target above the fold.
  const createdPlayer = createdPlayerId === undefined
    ? undefined
    : roster.find(player => player.id === createdPlayerId);
  const orderedRoster = createdPlayer === undefined
    ? roster
    : [createdPlayer, ...roster.filter(player => player.id !== createdPlayerId)];
  const playerById = new Map(roster.map(player => [player.id, player]));

  return {
    resources: {
      money: club.cash,
      trainingPoints: state.trainingPoints,
    },
    players: orderedRoster.map(player => {
      const projectedOverall = projectedPlayerOverall(player);
      const personalCaps = playerAttributeCaps(player);
      return {
        id: player.id,
        name: player.name,
        role: player.role,
        lookId: player.lookId,
        overall: overall(player.role, player.attrs),
        projectedOverall,
        potentialGrade: potentialGradeForOverall(projectedOverall),
        condition: player.condition ?? 100,
        injuryWeeks: player.injuryWeeks,
        isStarter: starterIds.has(player.id),
        age: player.age ?? 24,
        archetype: player.archetype ?? 'All-Rounder',
        personality: player.personality ?? 'Professional',
        morale: player.morale,
        fame: player.fame ?? 0,
        weeklyWage: player.weeklyWage,
        contractLabel: player.contractSeasonsRemaining === 0
          ? 'Expired — renewal due'
          : `${player.contractSeasonsRemaining} season${player.contractSeasonsRemaining === 1 ? '' : 's'} left`,
        ...(player.contractPromise === undefined ? {} : {
          contractPromiseLabel: contractPromiseLabel(player.contractPromise.perk),
        }),
        ...(player.shirtNumber === undefined ? {} : { shirtNumber: player.shirtNumber }),
        isCaptain: player.isCaptain === true,
        ...(player.power ? {
          powerName: `${content.powers.powers.find(power => power.id === player.power)?.name ?? player.power} · Tier ${player.powerTier ?? 1}`,
        } : {}),
        licensed: player.licensed,
        attributes: (Object.entries(player.attrs) as Array<[keyof typeof player.attrs, number]>).map(
          ([attribute, value]) => ({
            label: attribute.toUpperCase() as 'PAC' | 'SHO' | 'PAS' | 'DEF' | 'TEC' | 'STA' | 'REF',
            value,
            cap: personalCaps[attribute],
          }),
        ),
      };
    }),
    coachingStaff: [
      ...(state.market?.headCoach === undefined ? [] : [{
        id: state.market.headCoach.id,
        role: 'HEAD' as const,
        roleLabel: 'Head coach' as const,
        portraitId: state.market.headCoach.portraitId ?? state.market.headCoach.id,
        name: state.market.headCoach.name,
        age: state.market.headCoach.age ?? 45,
        personalityLabel: readableLabel(state.market.headCoach.personality),
        level: state.market.headCoach.level,
        specialtyLabels: state.market.headCoach.specialties.map(readableLabel) as [string, string],
        effectLabels: coachRoleEffectLabels(state.market.headCoach, 'HEAD'),
        weeklyWage: state.market.headCoach.weeklyWage,
        seasonsEmployed: state.market.headCoachSeasonsEmployed ?? 0,
        severanceCost: state.market.headCoach.weeklyWage,
      }]),
      ...(state.market?.assistantCoach === undefined ? [] : [{
        id: state.market.assistantCoach.id,
        role: 'ASSISTANT' as const,
        roleLabel: 'Assistant coach' as const,
        portraitId: state.market.assistantCoach.portraitId ?? state.market.assistantCoach.id,
        name: state.market.assistantCoach.name,
        age: state.market.assistantCoach.age ?? 45,
        personalityLabel: readableLabel(state.market.assistantCoach.personality),
        level: state.market.assistantCoach.level,
        specialtyLabels: state.market.assistantCoach.specialties.map(readableLabel) as [string, string],
        effectLabels: coachRoleEffectLabels(state.market.assistantCoach, 'ASSISTANT'),
        weeklyWage: state.market.assistantCoach.weeklyWage,
        seasonsEmployed: state.market.assistantCoachSeasonsEmployed ?? 0,
        severanceCost: state.market.assistantCoach.weeklyWage,
      }]),
    ],
    selectedPlayerId,
    createdPlayerId,
    // Division-locked tiers stay hidden until the club can actually reach them.
    // Drills the club merely cannot afford this week stay visible on purpose.
    drills: drills
      .map(drill => drillViewModel(
        drill,
        selected.has(drill.id),
        state,
        assignedPlayerIds,
      ))
      .filter(drill => drill.lockedReason === undefined),
    assignedPlayerIds,
    selectedDrillCount: selectedDrills.length,
    maxDrills: content.training.maxFocusDrillsPerWeek,
    totalMoneyCost,
    totalTrainingPointCost,
    canApply:
      assignedPlayerIds.length > 0 &&
      selectedDrills.length > 0 &&
      selectedDrills.every(drill => trainingDrillBlockedReason(state, drill.id) === undefined) &&
      totalMoneyCost <= club.cash &&
      totalTrainingPointCost <= state.trainingPoints,
    hasUnsavedChanges,
    ...(selectionMatchesSavedPlan && savedPlan !== undefined ? {
      lockedPlan: lockedPlanViewModel(state, savedPlan, playerById, drills),
    } : {}),
  };
}

/**
 * Builds the locked-plan summary, resolving the real training-week outcome
 * once for the whole panel (not once per player) so the shown gains are
 * exactly what settlement will deliver. Only reached once a plan is saved and
 * the editor selection still matches it — locked is the common state (the
 * tutorial pushes a saved plan in Week 1, and it repeats weekly), so this
 * resolution runs on most renders; the caller memoizes it.
 */
function lockedPlanViewModel(
  state: GameState,
  savedPlan: CareerTrainingPlan,
  playerById: Map<string, CareerPlayer>,
  drills: readonly TrainingDrill[],
) {
  const resolvedRoster = resolveCareerTrainingWeek(state).players;
  return {
    players: savedPlan.assignedPlayerIds.flatMap(playerId => {
      const player = playerById.get(playerId);
      return player === undefined ? [] : [{
        id: player.id,
        name: player.name,
        role: player.role,
        ...(player.lookId === undefined ? {} : { lookId: player.lookId }),
        trainingProgress: lockedTrainingProgress(resolvedRoster, player, savedPlan.drills),
      }];
    }),
    drills: savedPlan.drills.map(savedDrill => ({
      id: savedDrill.id,
      name: drills.find(drill => drill.id === savedDrill.id)?.name ?? savedDrill.id,
      gainLabel: Object.entries(savedDrill.gains)
        .map(([attribute, gain]) => `+${gain} ${attribute.toUpperCase()}`)
        .join(' · '),
    })),
    moneyCost: chargeableCareerTrainingPlan(
      state,
      savedPlan.assignedPlayerIds,
      savedPlan.drills,
    ).moneyCost,
    trainingPointCost: chargeableCareerTrainingPlan(
      state,
      savedPlan.assignedPlayerIds,
      savedPlan.drills,
    ).trainingPointCost,
  };
}

function contractPromiseLabel(perk: 'GUARANTEED_STARTER' | 'CAPTAINCY' | 'TRAINING_PRIORITY' | 'JERSEY_10'): string {
  if (perk === 'GUARANTEED_STARTER') return 'Promise · Starting XI';
  if (perk === 'CAPTAINCY') return 'Promise · Captaincy';
  if (perk === 'TRAINING_PRIORITY') return 'Promise · Training priority';
  return 'Promise · Shirt #10';
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
          lookId: playerBefore.lookId,
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
  const chargeable = chargeableCareerTrainingPlan(
    before,
    plan.assignedPlayerIds,
    plan.drills,
  );
  if (chargeable.drills.length === 0 && chargeable.capConflicts.length > 0) {
    const conflict = chargeable.capConflicts[0];
    const attribute = conflict.attributes[0];
    const player = before.players.find(candidate => candidate.id === conflict.playerId);
    const cap = player === undefined ? undefined : playerAttributeCaps(player)[attribute];
    const drillName = LAUNCH_CONTENT.training.focusDrills
      .find(drill => drill.id === conflict.drillId)?.name
      ?? conflict.drillName;
    return cap === undefined
      ? `${conflict.playerName} skipped ${drillName} — already at their ${attribute.toUpperCase()} maximum.`
      : `${conflict.playerName} skipped ${drillName} — already at their ${attribute.toUpperCase()} maximum of ${cap}.`;
  }
  const moneyCost = chargeable.moneyCost;
  const trainingPointCost = chargeable.trainingPointCost;
  const ambientTrainingPoints = weeklyAmbientTrainingPoints(before);
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
    ...(project.kind === 'BUILD'
      && building.type === 'training-pitch'
      && !before.facilities.grid?.buildings.some(candidate => (
        candidate.type === 'training-pitch'
        && isFacilityOperational(before.facilities.grid!, candidate.id)
      ))
      ? { trainingPointReward: TRAINING_PITCH_TP_PER_LEVEL }
      : {}),
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
  return divisionTierLabel(careerDivision(state));
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

/**
 * Projects next week's training by diffing the real resolver's output, so the
 * number shown is exactly the number weekly settlement will deliver. Copying
 * the growth formula here would silently drift from src/game/training.ts,
 * where age, archetype, facility, diminishing-returns and coach-bonus
 * multipliers all reshape a drill's nominal gain.
 *
 * Takes the already-resolved roster so the caller resolves once per locked
 * plan, not once per player.
 */
function lockedTrainingProgress(
  resolvedRoster: readonly CareerPlayer[],
  player: CareerPlayer,
  drills: readonly CareerTrainingDrill[],
): LockedTrainingProgressViewModel[] {
  const trainedAttributes = new Set(
    drills.flatMap(drill => Object.keys(drill.gains)),
  ) as Set<keyof CareerPlayer['attrs']>;
  if (trainedAttributes.size === 0) return [];

  const resolvedPlayer = resolvedRoster.find(candidate => candidate.id === player.id);
  const caps = playerAttributeCaps(player);

  return [...trainedAttributes].map(attribute => {
    const value = player.attrs[attribute];
    const weeklyGain = resolvedPlayer === undefined
      ? 0
      : Math.max(0, resolvedPlayer.attrs[attribute] - value);
    return {
      label: attribute.toUpperCase() as LockedTrainingProgressViewModel['label'],
      value,
      cap: caps[attribute],
      weeklyGain,
      atCap: value >= caps[attribute],
    };
  });
}

function drillViewModel(
  drill: TrainingDrill,
  selected: boolean,
  state: GameState,
  assignedPlayerIds: readonly string[],
) {
  const gainLabel = Object.entries(drill.gains)
    .map(([attribute, gain]) => `+${gain} ${attribute.toUpperCase()}`)
    .join(' · ');
  const lockedReason = trainingDrillBlockedReason(state, drill.id);
  const chargeable = assignedPlayerIds.length === 0
    ? { moneyCost: 0, trainingPointCost: drill.tpCost }
    : chargeableCareerTrainingPlan(state, assignedPlayerIds, [drill]);
  return {
    id: drill.id,
    name: drill.name,
    focusLabel: Object.keys(drill.gains).map(value => value.toUpperCase()).join(' / '),
    gainLabel,
    moneyCost: drill.moneyCost,
    trainingPointCost: drill.tpCost,
    selected,
    available: lockedReason === undefined
      && chargeable.moneyCost <= requireUserClub(state).cash
      && chargeable.trainingPointCost <= state.trainingPoints,
    ...(lockedReason === undefined ? {} : { lockedReason }),
  };
}

function describeEventChoiceOutcome(choice: GameEvent['choices'][number]): string {
  if (!choice.risky) return describeSafeOutcome(choice.outcomes[0]?.effects ?? []);
  const success = choice.outcomes.find(outcome => outcome.effects.some(effect => effect.type !== 'flag'));
  if (success === undefined) return 'Risky choice with no guaranteed reward';
  const reward = describeEventEffects(success.effects);
  const hasEmptyFailure = choice.outcomes.some(outcome => outcome.effects.length === 0);
  return `${success.weight}% chance: ${reward}.${hasEmptyFailure ? ' Failure gives no reward.' : ''}`;
}

function describeSafeOutcome(effects: GameEvent['choices'][number]['outcomes'][number]['effects']): string {
  const effect = effects[0];
  if (effect?.type === 'tp') return `Guaranteed: ${effect.amount >= 0 ? '+' : ''}${effect.amount} TP`;
  if (effect?.type === 'money') return `Guaranteed: ${formatMoney(effect.amount, true)}`;
  return 'Guaranteed reward';
}

function describeEventEffects(
  effects: GameEvent['choices'][number]['outcomes'][number]['effects'],
): string {
  return eventRewardLabels(effects).join(' and ') || 'an unknown reward';
}

function eventRewardLabels(
  effects: GameEvent['choices'][number]['outcomes'][number]['effects'],
): string[] {
  const rewards: string[] = [];
  const money = effects.reduce((sum, effect) => effect.type === 'money' ? sum + effect.amount : sum, 0);
  const morale = effects.reduce((sum, effect) => effect.type === 'morale' ? sum + effect.amount : sum, 0);
  const fans = effects.reduce((sum, effect) => effect.type === 'fans' ? sum + effect.amount : sum, 0);
  const trainingPoints = effects.reduce((sum, effect) => effect.type === 'tp' ? sum + effect.amount : sum, 0);
  if (money !== 0) rewards.push(formatMoney(money, true));
  if (morale !== 0) rewards.push(`${morale > 0 ? '+' : ''}${morale} squad morale`);
  if (fans !== 0) rewards.push(`${fans > 0 ? '+' : ''}${fans} fans`);
  if (trainingPoints !== 0) rewards.push(`${trainingPoints > 0 ? '+' : ''}${trainingPoints} TP`);
  for (const effect of effects) {
    if (effect.type === 'statDelta' && effect.amount !== 0) {
      rewards.push(`${effect.amount > 0 ? '+' : ''}${effect.amount} ${effect.attribute.toUpperCase()}`);
    }
    if (effect.type === 'injury') {
      rewards.push(`${effect.weeks} week${effect.weeks === 1 ? '' : 's'} out injured`);
    }
  }
  return rewards;
}

function overall(
  role: GameState['players'][number]['role'],
  attrs: GameState['players'][number]['attrs'],
): number {
  return roleOverall(role, attrs);
}

function formatMoney(value: number, signed = false): string {
  const sign = value < 0 ? '−' : signed && value > 0 ? '+' : '';
  return `${sign}$${Math.abs(Math.trunc(value)).toLocaleString('en-US')}`;
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
