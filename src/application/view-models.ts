import { loadLaunchContent, type GameEvent, type LaunchContent } from '../content';
import { managerNotes } from './manager-notes';
import { eventOfferForWeek } from './event-selection';
import {
  FACILITY_ADJACENCIES,
  FACILITY_CATALOG,
  activeCareerMatchday,
  activeFacilityAdjacencies,
  attributeAffectsPlay,
  careerHeroLimit,
  careerCoachWageLedgerAmount,
  contractTermOptions,
  createFacilityGrid,
  currentUserDivision,
  difficultyRules,
  isConsideringRetirement,
  maxRenewalTermSeasons,
  maxSigningTermSeasons,
  retirementCardLabel,
  shortContractReason,
  fixturesForCurrentWeek,
  hasActiveCareerContractPromise,
  pendingTrainingPriorityHolder,
  isAssistantInboxOneShotProductVisible,
  isFullyCappedPlayer,
  instantTrainingPreview,
  latestSeasonRecap,
  leagueStandings,
  currentDeskTipId,
  deterministicCareerEventRoll,
  isDeskTipSettled,
  markDeskTipSeen,
  nextPendingClubLegend,
  offerCareerEvent,
  unseenDeskTipIds,
  playerAttributeCaps,
  playerPotentialGrade,
  overtrainingInjuryChancePercent,
  superTrainingChancePercent,
  facilityEffects,
  nextTrainingUpgradeOffer,
  ownedTrainingTier,
  POSITION_TRAINING_ATTRIBUTES,
  reconcilePendingClubLegends,
  renewalQuote,
  resolveTrainingDrillForPath,
  rosterForClub,
  roleOverall,
  scheduleAssistantInboxWeek,
  SEASON_WEEKS,
  trainingPathAttribute,
  TRAINING_PATHS,
  TRAINING_PITCH_TP_PER_LEVEL,
  weeklyFacilityUpkeep,
  weeklyAmbientTrainingPoints,
  weeklyMerchandiseIncome,
  willRetireAtSeasonTransition,
  type CareerPlayer,
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
  ClubLoanViewModel,
  ClubAlertViewModel,
  CoachStaffMemberViewModel,
  FixtureViewModel,
  HomeViewModel,
  LeagueTableViewModel,
  ManagerNoteViewModel,
  MatchDayViewModel,
  PostMatchViewModel,
  SeasonEndViewModel,
  StoryEventViewModel,
  SquadTrainingViewModel,
  TrainingSlotStatOption,
  WeeklyReviewViewModel,
} from '../ui';
import { divisionTierLabel } from '../game/pyramid';
import { careerDifficulty } from '../game/difficulty';
import { isAvailableForSelection } from '../game/lineup';
import { playerLoyalty } from '../game/loyalty';
import {
  requestDefinition,
  requestTarget,
  resolutionDeltas,
} from '../game/player-requests';
import {
  facilityUpgradeBlockedReason,
  highestDivisionReached,
  promotionRewardsForDivision,
  trainingDrillTier,
} from '../game/promotion-progression';
import { marketNegotiationViewModel } from './market-view-model';
import { leagueFixtureViewModel } from './m2-league-view-model';
import { coachRoleEffectLabels } from './coach-effects';
import {
  dueAssistantInboxGuideSequences,
  reconcileSatisfiedAssistantGuideSequences,
} from './assistant-guide';
import { eventChoiceUnavailableReason } from './event-selection';

const LAUNCH_CONTENT = loadLaunchContent();
const ASSISTANT_GUIDE_CONTENT = LAUNCH_CONTENT.assistantGuide;

/**
 * How many former players the legacy panel shows before it stops counting.
 *
 * `retiredPlayers` grows for the life of the career, so a roll that printed all
 * of them would eventually be longer than the decision it sits under.
 */
const CLUB_LEGACY_ROLL_LIMIT = 12;

export function clubLegacyViewModel(state: GameState): ClubLegacyViewModel {
  const reconciled = reconcilePendingClubLegends(state);
  const legend = nextPendingClubLegend(reconciled);
  if (legend === undefined) throw new Error('there is no pending club-legend decision');
  const pendingCount = reconciled.pendingLegacyPlayerIds?.length ?? 0;
  // Newest first, and never the legend whose decision is on this screen: he is
  // the panel above, and listing him twice reads as two different men.
  const formerPlayers = (state.retiredPlayers ?? [])
    .filter(player => player.clubId === state.userClubId && player.id !== legend.id)
    .slice()
    .reverse();
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
    isHero: legend.power !== undefined,
    // Two options, and neither is the safe one. The coach spends a wage the
    // club may not have; the farewell spends the only chance to have him.
    choices: [
      {
        id: 'coach-candidate',
        label: 'Join the staff',
        detail: `${legend.name} begins a new career on the touchline, carrying hard-earned club knowledge into every session.`,
        outcome: 'Adds a loyalty-discounted candidate to the coach market.',
      },
      {
        id: 'farewell',
        label: 'Let him go',
        detail: `${legend.name} takes the applause, shakes every hand in the building and walks out of it. Some players are not coaches, and the club has no wage spare to find out.`,
        outcome: 'No coach, no cost. The offer is not made twice.',
      },
    ],
    formerPlayers: formerPlayers.slice(0, CLUB_LEGACY_ROLL_LIMIT).map(player => ({
      playerId: player.id,
      playerName: player.name,
      role: player.role,
      ...(player.lookId === undefined ? {} : { lookId: player.lookId }),
      isHero: player.power !== undefined,
      detail: `${player.role} · ${seasonCountLabel(player.seasonsAtClub ?? 0)} · ${player.fame ?? 0} fame`,
    })),
    formerPlayerTotal: formerPlayers.length,
  };
}

function seasonCountLabel(seasons: number): string {
  return `${seasons} season${seasons === 1 ? '' : 's'}`;
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
    powerDescription: power.description,
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
  const facilityUpkeep = state.facilities.grid === undefined
    ? 0
    : weeklyFacilityUpkeep(state.facilities.grid);
  const coachWage = state.market === undefined ? 0 : careerCoachWageLedgerAmount(state.market);
  const merchandiseIncome = weeklyMerchandiseIncome(state, club);
  const recurringProjectionLines = [
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
  const loan = outstandingLoanViewModel(state);
  return {
    periodLabel: latest ? `S${latest.season} · W${latest.week}` : `S${state.season} · W${state.week}`,
    resources: {
      money: club.cash,
      trainingPoints: state.trainingPoints,
    },
    ...(loan === undefined ? {} : { loan }),
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
      weeklyTrainingPoints: TRAINING_PITCH_TP_PER_LEVEL,
    },
    // Was `careerMode !== 'full'`, so already always false in a shipped career.
    // The flag and its dead branch in ClubFinancesScreen can go with the next
    // src/ui pass.
    legacyTrainingGroundVisible: false,
    coachingStaff: coachingStaffViewModels(state),
    facilities: facilityGridViewModel(state),
  };
}

/**
 * The outstanding emergency loan, on the same "is there a balance" rule the
 * `emergency-loan` inbox row uses, so the desk and the accounts office can never
 * disagree about whether the club is in debt.
 *
 * The weekly repayment itself is deliberately not restated here. The engine
 * charges `ceil(balance / weeks)` and posts it to the ledger as its own line, so
 * the exact figure is already on this screen the week it is taken — copying the
 * formula into a view model would be a second place for it to drift.
 */
function outstandingLoanViewModel(state: GameState): ClubLoanViewModel | undefined {
  const loan = state.financialSafety?.loan;
  if (loan === undefined || loan.remainingBalance <= 0) return undefined;
  const repaying = state.season >= loan.repaymentStartsSeason;
  return {
    originalAmount: loan.originalAmount,
    remainingBalance: loan.remainingBalance,
    scheduleLabel: repaying ? 'Weeks left' : 'Repayments begin',
    scheduleValue: repaying ? `${loan.remainingWeeks}` : `Season ${loan.repaymentStartsSeason}`,
    detail: repaying
      ? 'A repayment leaves the balance every week until the debt clears. The board writes one loan per career, and this was it.'
      : `Nothing is taken until Season ${loan.repaymentStartsSeason}. From then a repayment leaves the balance every week until the debt clears.`,
  };
}

function coachingStaffViewModels(state: GameState): readonly CoachStaffMemberViewModel[] {
  return [
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
  ];
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

/** Every line states a real effect site in src/game — no facility says "nothing". */
function facilityEffectLabel(type: FacilityType, level: FacilityLevel): string {
  const trainingEffect = (attributes: string): string => (
    `+${TRAINING_BONUS_PERCENT[level]}% ${attributes} training`
  );
  if (type === 'training-pitch') {
    return `+${level * 10} TP weekly · +${TRAINING_BONUS_PERCENT[level]}% DEF training`;
  }
  if (type === 'gym') return trainingEffect('PAC + STA');
  if (type === 'tech-center') return trainingEffect('PAS + TEC');
  if (type === 'shooting-range') return trainingEffect('SHO');
  if (type === 'keeper-court') return trainingEffect('REF');
  if (type === 'medical-bay') {
    return `Recovery -${level} week${level === 1 ? '' : 's'} · adjacency bonus available`;
  }
  if (type === 'dorm') {
    return `+${level * 4} condition recovery weekly · adjacency bonus available`;
  }
  if (type === 'scout-office') {
    const names = `${2 + level} names per mission`;
    return level === 1
      ? `${names} · broad stat ranges`
      : level === 2
        ? `${names} · tighter stat ranges`
        : `${names} · powers confirmed`;
  }
  if (type === 'coaching-office') return 'Unlocks the assistant coach position';
  if (type === 'youth-field') {
    return `Youth starting strength +${level * 5}`;
  }
  if (type === 'fan-shop') return `Weekly merchandise scales with fans · x${level}`;
  if (type === 'stadium-stand') return `+${level * 25}% home gate income`;
  throw new Error(`missing facility effect copy for ${type}`);
}

/** Mirrors FACILITY_TRAINING_MULTIPLIER in src/game/training.ts, as a percentage. */
const TRAINING_BONUS_PERCENT: Readonly<Record<FacilityLevel, number>> = { 1: 25, 2: 50, 3: 100 };

function facilityNextLevelEffectLabel(
  type: FacilityType,
  nextLevel: FacilityLevel,
): string | undefined {
  // The Coaching Office is a one-off unlock: its upgrades change nothing, so it
  // is the only facility with no next-level promise to show.
  if (type === 'coaching-office') return undefined;
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
    ...(pending.outcomeText ? {
      resolvedRisky: pending.resolvedRisky === true,
      resolvedSuccess: pending.resolvedSuccess === true,
      outcomeTitle: pending.resolvedRisky === true
        ? pending.resolvedSuccess === true
          ? resolvedOutcome?.successHeadline ?? 'The risk paid off'
          : 'The gamble missed'
        : 'Decision complete',
      outcomeText: pending.outcomeText,
      outcomeRewards: resolvedOutcome === undefined ? [] : eventRewardItems(resolvedOutcome.effects),
      ...(pending.resolvedNextEventId === undefined ? {} : { outcomeHasFollowUp: true as const }),
    } : {}),
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
  const outcomeLabel = user.position === 1 && division === 1
    ? 'CHAMPIONS' as const
    : user.position <= 2 && division > 1
      ? 'PROMOTED' as const
      : user.position >= 9 && division < 5
        ? 'RELEGATED' as const
        : 'SAFE' as const;
  const expiredPlayers = sliceComplete ? [] : rosterForClub(state, state.userClubId)
    .filter(player => player.contractSeasonsRemaining === 0
      && !willRetireAtSeasonTransition(player, state.season))
    .sort((left, right) => left.id.localeCompare(right.id));
  const expiredPlayer = expiredPlayers[0];
  // Zero would mean an announced player, and `expiredPlayers` already filters
  // those out through `willRetireAtSeasonTransition`.
  const renewalTermCap = expiredPlayer === undefined
    ? 3
    : maxRenewalTermSeasons(expiredPlayer, state.careerSeed);
  const renewalTalks = state.market?.renewalTalks;
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
  // `topScorer` is deliberately absent. It is a club-only award that counts cup
  // goals, while the awards ceremony the manager has just watched crowns a
  // division-wide, league-only, forwards-only Golden Boot — so the two can name
  // different players truthfully. Showing both put a second Golden Boot on the
  // screen one tap after the ceremony handed out the first.
  const recapAwards = recap === undefined
    ? []
    : [recap.playerOfSeason, recap.youngPlayer, recap.heroOfSeason]
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
    seasonLabel: `Season ${state.season} · ${divisionTierLabel(division)}`,
    outcomeLabel,
    headline: outcomeLabel === 'CHAMPIONS'
      ? 'The club owns the country.'
      : outcomeLabel === 'PROMOTED'
        ? 'The climb continues.'
        : outcomeLabel === 'RELEGATED'
          ? 'A hard landing. The rebuild starts now.'
          : 'The board signs off on another year.',
    summary: outcomeLabel === 'PROMOTED'
      ? `A place in ${divisionTierLabel((division - 1) as 1 | 2 | 3 | 4)} is secured. Contracts and retirements resolve before the new fixtures arrive.`
      : outcomeLabel === 'RELEGATED'
        ? `The club drops to ${divisionTierLabel((division + 1) as 2 | 3 | 4 | 5)}, but the endless career continues.`
        : 'Contracts, player aging, retirement announcements, and the next national campaign now resolve.',
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
      promoted: row.position <= 2 && division > 1,
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
        termOptions: contractTermOptions(renewalTermCap),
        // Clamped rather than trusted: the term is held in the store across
        // players, so a 3 dialled in for one man must not survive onto the
        // veteran queued behind him.
        selectedTerm: Math.min(selectedTerm, Math.max(1, renewalTermCap)) as 1 | 2 | 3,
        ...(renewalTermCap >= 3 ? {} : {
          shortTermReason: shortContractReason(expiredPlayer.age ?? 24, renewalTermCap),
        }),
        decision: 'pending' as const,
        requiresNegotiation: true,
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
            maxTermSeasons: Math.max(1, renewalTermCap) as 1 | 2 | 3,
            playerAge: expiredPlayer.age ?? 24,
          }),
        }),
    sliceComplete,
    canContinue: sliceComplete || expiredPlayer === undefined,
  };
}

/** First week the empty desk is a habit worth nudging rather than a tutorial gap. */
const BUILD_REMINDER_WEEK = 7;

/**
 * The standing "keep building" nudge. It lives outside the weekly inbox
 * scheduler on purpose: it carries no persisted read state, so it simply
 * reappears on any week the desk is genuinely empty.
 */
const BUILD_REMINDER_ALERT: ClubAlertViewModel = {
  id: 'build-reminder',
  title: 'Keep building',
  detail: 'Remember to construct new buildings every week if you have the finances to do so.',
  tone: 'info',
};

/** Tapping this card opens the story screen; Advance Week opens it regardless. */
export const DESK_STORY_ALERT_ID = 'story-event';

/**
 * The week's story, waiting on the desk instead of ambushing the manager on
 * their way out of the week. Only quiet weeks are offered one, so this never
 * arrives on top of a full inbox.
 */
function deskStoryAlert(state: GameState): ClubAlertViewModel | undefined {
  const pending = state.pendingEvent;
  if (pending === undefined || pending.resolvedChoiceId !== undefined) return undefined;
  const event = LAUNCH_CONTENT.events.events.find(candidate => candidate.id === pending.eventId);
  if (event === undefined) return undefined;
  return {
    id: DESK_STORY_ALERT_ID,
    title: event.title,
    detail: event.body,
    tone: 'event',
  };
}

/**
 * The drill shop, pointed out on a quiet week.
 *
 * Promotion already names the new tier on the season review, but that screen is
 * a wall of rewards read once in a hurry, and the shop is the one reward that
 * costs money and so gets postponed. This puts it back on the desk on a week
 * with nothing else to read, and disappears for good the moment the club buys
 * any upgrade — the point is to teach that the shop exists, not to nag.
 */
function drillShopAlert(state: GameState): ClubAlertViewModel | undefined {
  // The copy promises a promotion opened the shop, so only say it once one has.
  // Pre-M2 saves have no division record at all and never see this.
  if ((state.m2?.highestDivisionReached ?? 5) >= 5) return undefined;
  if (TRAINING_PATHS.some(path => ownedTrainingTier(state, path.pathId) > 1)) return undefined;
  const affordable = TRAINING_PATHS
    .map(path => nextTrainingUpgradeOffer(state, path.pathId))
    .filter(offer => offer !== undefined && offer.blockedReason === undefined);
  const offer = affordable[0];
  if (offer === undefined) return undefined;
  return {
    id: `training-upgrade:tier-${offer.tier}`,
    title: `Tier ${offer.tier} drills on sale`,
    detail: `Promotion opened a stronger drill for every training path — ${formatMoney(offer.cost)} each, bought once and kept for the rest of the career. Every session on a tier ${offer.tier} drill adds more than the one you are running now. The shop is on the Squad screen.`,
    tone: 'info',
  };
}

/**
 * A clear desk after the opening weeks reads as "nothing left to do", which is
 * exactly when a manager stops expanding the grid. The nudge only fires when
 * the works crew is free — asking for a build the player cannot start would be
 * an instruction that goes nowhere — and never crowds out a real inbox item.
 */
function isBuildReminderDue(state: GameState, alerts: readonly ClubAlertViewModel[]): boolean {
  return alerts.length === 0
    && state.week >= BUILD_REMINDER_WEEK
    && state.facilities.grid?.construction === undefined;
}

/** Weeks of a season in which a squad's imminent retirements are called out. */
const RETIREMENT_FINAL_WEEKS = 3;

/** Live, uncapped product alerts before Bert's weekly desk scheduler. */
export function homeProductAlerts(state: GameState): ClubAlertViewModel[] {
  const roster = rosterForClub(state, state.userClubId);
  const expired = roster.filter(player => player.contractSeasonsRemaining === 0);
  const injured = roster
    .filter(player => player.injuryWeeks > 0)
    .sort((left, right) => right.injuryWeeks - left.injuryWeeks || left.name.localeCompare(right.name));
  const transferRequests = roster.filter(player => player.transferRequested === true);
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
  const waitingRequest = state.playerRequests?.pending?.warned === true
    ? state.playerRequests.pending
    : undefined;
  const heroIds = new Set(roster
    .filter(player => player.power !== undefined)
    .map(player => player.id));
  const retirementAnnouncements = (state.retirementAnnouncements ?? [])
    .filter(announcement => announcement.announcedInSeason === state.season - 1)
    .sort((left, right) => left.playerName.localeCompare(right.playerName));
  // The last-chance notice. The announcement is a whole season old by the time
  // the final matches arrive, so without this a farewell is something a manager
  // reads about afterwards rather than something he can turn up for.
  const finalWeeks = state.week > SEASON_WEEKS - RETIREMENT_FINAL_WEEKS
    ? roster
        .filter(player => willRetireAtSeasonTransition(player, state.season))
        .sort((left, right) => left.name.localeCompare(right.name))
    : [];
  // Retired at the last transition, and nowhere else on the desk until now: a
  // player announced in season S plays S+1 and is gone by S+2, so the season
  // that has just started is the one that owes him a goodbye.
  const justRetired = (state.retiredPlayers ?? [])
    .filter(player => player.clubId === state.userClubId
      && player.retirementAnnouncementSeason === state.season - 2)
    .sort((left, right) => left.name.localeCompare(right.name));
  const retirementFarewellAlertId = `retirement-farewell:s${state.season}`;
  const showRetirementFarewell = justRetired.length > 0
    && isAssistantInboxOneShotProductVisible(state, retirementFarewellAlertId);
  return [
    // The board speaks first.
    //
    // The desk carries three rows a week, and inside one priority rank this
    // array's order is the tie-break (see `scheduleAssistantInboxWeek`). These
    // four rows used to be built last, so an injury or a transfer request took
    // every slot and the board was never heard — measured across all five
    // escalation states, not one board row reached a desk that had anything
    // else on it. Money trouble outranks a squad grumble: nothing else in this
    // list can end the club.
    ...(negativeCashWeeks > 0 ? [{
      id: 'financial-warning',
      title: 'Board financial warning',
      detail: `Cash has stayed negative for ${negativeCashWeeks} week${negativeCashWeeks === 1 ? '' : 's'}. Transfers and building are locked until the balance recovers.`,
      tone: 'urgent' as const,
    }] : []),
    // Kept even next to the warning above: the two carry different facts, what
    // is locked and what is owed. It is the one board row that does NOT hold an
    // urgent slot (see `assistantProductPriority`) — the accounts office now
    // carries the outstanding balance permanently, so this row announces the
    // debt rather than being the only place to read it.
    ...(loan !== undefined && loan.remainingBalance > 0 ? [{
      id: 'emergency-loan',
      title: 'Emergency loan active',
      detail: `${formatMoney(loan.remainingBalance)} remains.`
        + (state.season >= loan.repaymentStartsSeason
          ? ` ${loan.remainingWeeks} week${loan.remainingWeeks === 1 ? '' : 's'} of repayments left.`
          : ` Repayments begin in Season ${loan.repaymentStartsSeason}.`)
        + ' The balance is on the finances screen.',
      tone: 'info' as const,
    }] : []),
    ...(boardUltimatum === undefined ? [] : [{
      id: 'board-ultimatum',
      title: `Board deadline · ${boardUltimatum.weeksRemaining} week${boardUltimatum.weeksRemaining === 1 ? '' : 's'}`,
      detail: `Reach ${boardTargetLabel(boardUltimatum.targetCash)} or the board will sell one visible, unprotected candidate.`,
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
    // Stated in full, on purpose. A lapse charges exactly what a refusal
    // charges, so the manager has to have been told the number — otherwise
    // ignoring the tab is cheaper than deciding, which is the wrong lesson.
    ...(waitingRequest === undefined || state.playerRequestRules === undefined ? [] : [{
      id: 'player-request-waiting',
      title: 'Still waiting',
      detail: (() => {
        const asker = roster.find(player => player.id === waitingRequest.playerId);
        const cost = resolutionDeltas(
          'REFUSED',
          requestTarget(requestDefinition(state.playerRequestRules!, waitingRequest.requestId).cost),
          careerDifficulty(state),
        ).asker;
        return `${asker?.name ?? 'A player'} is still waiting on an answer.`
          + ` Leave it and you lose ${Math.abs(cost.loyalty)} loyalty`
          + ` and ${Math.abs(cost.morale)} morale.`;
      })(),
      tone: 'urgent' as const,
      destination: 'squad' as const,
      ...(waitingRequest.playerId === undefined ? {} : { playerId: waitingRequest.playerId }),
    }]),
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
    // Retirement, in one row per beat rather than one row per player. Seven can
    // arrive in the same week, the desk shows three, and `retirementAnnouncements`
    // is overwritten at the next transition — so a row each meant four farewells
    // were lost for good, with nothing to say they had ever been made.
    ...(!showRetirementFarewell ? [] : [{
      id: retirementFarewellAlertId,
      title: justRetired.length === 1
        ? `${justRetired[0].name} has retired`
        : `${justRetired.length} players have retired`,
      detail: `${namesWithOverflow(justRetired.map(player => player.name))}`
        + ` ${justRetired.length === 1 ? 'played his' : 'played their'} last match for the club`
        + ` in Season ${state.season - 1}.`,
      tone: 'info' as const,
      ...(justRetired.some(player => player.power !== undefined) ? { isHero: true } : {}),
    }]),
    ...(finalWeeks.length === 0 ? [] : [{
      id: `retirement-final-weeks-${state.season}`,
      title: finalWeeks.length === 1
        ? `${finalWeeks[0].name}'s last matches`
        : `${finalWeeks.length} players play their last matches`,
      detail: `${namesWithOverflow(finalWeeks.map(player => player.name))}`
        + ` ${finalWeeks.length === 1 ? 'retires' : 'retire'} when the season ends`
        + ` — ${weekCountLabel(SEASON_WEEKS - state.week + 1).toLowerCase()} left.`,
      tone: 'info' as const,
      ...(finalWeeks.some(player => player.power !== undefined) ? { isHero: true } : {}),
    }]),
    ...(retirementAnnouncements.length === 0 ? [] : [{
      id: `retirement-announcement-${state.season - 1}`,
      title: retirementAnnouncements.length === 1
        ? `${retirementAnnouncements[0].playerName} announces final season`
        : `${retirementAnnouncements.length} players announce final seasons`,
      detail: retirementAnnouncements.length === 1
        ? `Age ${retirementAnnouncements[0].retirementAge} · retires after Season ${state.season}.`
        : `${namesWithOverflow(retirementAnnouncements.map(announcement => announcement.playerName))}`
          + ` retire after Season ${state.season}.`,
      tone: 'info' as const,
      ...(retirementAnnouncements.some(announcement => heroIds.has(announcement.playerId))
        ? { isHero: true }
        : {}),
    }]),
    // The earliest retirement signal there is: a full season ahead of the
    // announcement above, which itself lands on the final season. One-shot, so
    // it appears the week it is discovered and then leaves the three desk slots
    // to injuries and board deadlines; the player card carries it from then on.
    ...roster
      .filter(player => isConsideringRetirement(player, state.careerSeed))
      .map(player => ({
        id: `retirement-considering-${state.season}-${player.id}`,
        title: `${player.name} is thinking about retirement`,
        detail: `Age ${player.age ?? 24} · one more season after this one. Plan the succession now.`,
        tone: 'info' as const,
      })),
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
  ];
}

/**
 * A name list that fits one desk row, with the remainder counted rather than
 * dropped. Alert details render on two lines, so seven names do not fit.
 */
function namesWithOverflow(names: readonly string[], shown = 3): string {
  if (names.length <= shown) {
    return names.length <= 1
      ? names[0] ?? ''
      : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  }
  return `${names.slice(0, shown).join(', ')} and ${names.length - shown} more`;
}

/**
 * What the board is asking for, in words.
 *
 * The target is always zero: the board wants the overdraft cleared, not a
 * balance built. Printing that through the money formatter produced "Reach $0
 * cash", which reads like copy nobody finished. The number is left alone —
 * raising it would change how hard the fail-soft economy bites — and only the
 * sentence is fixed. A future non-zero target still reads correctly.
 */
function boardTargetLabel(targetCash: number): string {
  return targetCash <= 0 ? 'a positive balance' : `${formatMoney(targetCash)} cash`;
}

export function reconcileHomeAssistantInbox(state: GameState): GameState {
  return homeAssistantInboxPlan(state).state;
}

/**
 * True when this week's desk would show nothing to act on. Manager's Notes and
 * the keep-building nudge do not count: neither is a decision, and both exist
 * precisely because the week is quiet.
 */
export function isHomeDeskClear(state: GameState): boolean {
  if (state.phase !== 'manage') return false;
  const plan = homeAssistantInboxPlan(state);
  return plan.productAlertIds.length === 0 && plan.guideSequenceIds.length === 0;
}

/**
 * Settles whether this management week gets a story, once.
 *
 * This runs when the career arrives at a manage week rather than when the player
 * leaves one, because a match week reaches its desk through the match rather
 * than through Advance Week — deciding on the way out would skip every week with
 * a fixture, which is most of them. The week stamp makes repeat calls free.
 */
export function settleWeeklyStory(state: GameState): GameState {
  if (state.phase !== 'manage' || state.pendingEvent !== undefined) return state;
  if (state.onboarding !== undefined && state.onboarding.stage !== 'complete') return state;
  if (state.eventClock.storySettledSeason === state.season
    && state.eventClock.storySettledWeek === state.week) {
    return state;
  }
  const offer = eventOfferForWeek(state, LAUNCH_CONTENT.events, {
    deskClear: isHomeDeskClear(state),
  });
  const settled: GameState = {
    ...state,
    eventClock: {
      ...offer.eventClock,
      storySettledSeason: state.season,
      storySettledWeek: state.week,
    },
  };
  return offer.eventId === undefined ? settled : offerCareerEvent(settled, offer.eventId);
}

/** Roughly a third of eligible weeks, so a tip stays a find rather than a lecture. */
const DESK_TIP_CHANCE_PERCENT = 35;

/**
 * Settles whether this quiet week carries a manager's tip, once.
 *
 * Runs after the story: a week that already produced one has something to read,
 * and stacking a tip under it turns the reward for a quiet week into homework.
 * The record is written even when the roll fails, so the week cannot re-roll.
 */
export function settleWeeklyTip(state: GameState): GameState {
  if (state.phase !== 'manage' || isDeskTipSettled(state)) return state;
  if (state.onboarding !== undefined && state.onboarding.stage !== 'complete') return state;
  if (state.pendingEvent !== undefined || !isHomeDeskClear(state)) return state;

  const blank: GameState = { ...state, deskTip: { season: state.season, week: state.week } };
  const unseen = unseenDeskTipIds(state, LAUNCH_CONTENT.tips.tips.map(tip => tip.id));
  if (unseen.length === 0) return blank;
  if (deskTipRoll(state, '__desk_tip_chance__', 100) >= DESK_TIP_CHANCE_PERCENT) return blank;

  const tipId = unseen[deskTipRoll(state, '__desk_tip_pick__', unseen.length)];
  return markDeskTipSeen(
    { ...state, deskTip: { season: state.season, week: state.week, tipId } },
    tipId,
  );
}

function deskTipRoll(state: GameState, nonce: string, upperExclusive: number): number {
  return deterministicCareerEventRoll(
    {
      careerSeed: state.careerSeed,
      season: state.season,
      week: state.week,
      riskyChoices: state.eventClock.riskyChoices,
    },
    nonce,
    0,
    upperExclusive,
  );
}

/** The tip on this week's desk, written out in full like a Manager's Note. */
function deskTipNote(state: GameState): ManagerNoteViewModel | undefined {
  const tipId = currentDeskTipId(state);
  if (tipId === undefined) return undefined;
  const tip = LAUNCH_CONTENT.tips.tips.find(candidate => candidate.id === tipId);
  if (tip === undefined) return undefined;
  return {
    id: `tip:${tip.id}`,
    kind: 'tip',
    title: tip.title,
    detail: tip.body,
    ...(tip.destination === undefined ? {} : { destination: tip.destination }),
  };
}

function homeAssistantInboxPlan(state: GameState) {
  state = reconcileSatisfiedAssistantGuideSequences(state);
  const productAlerts = homeProductAlerts(state);
  const dueGuides = dueAssistantInboxGuideSequences(state);
  return scheduleAssistantInboxWeek(state, {
    dueGuideSequenceIds: standaloneInboxGuides(dueGuides, productAlerts),
    heldGuideSequenceIds: quietDeskInboxGuides(state, productAlerts),
    productAlerts: productAlerts.map(alert => ({
      id: alert.id,
      priority: assistantProductPriority(alert, dueGuides),
      oneShot: isOneShotProductAlert(alert.id),
    })),
  });
}

/**
 * Beats that only belong on an empty desk. Only one project runs at a time, so
 * an upgrade card that arrives mid-build is an instruction the player cannot
 * follow, and one that arrives next to an injury or a board deadline is a chore
 * competing with real work. Held rather than dropped, so it lands on the first
 * week with a free crew and nothing else on the desk.
 */
function quietDeskInboxGuides(
  state: GameState,
  productAlerts: readonly ClubAlertViewModel[],
): AssistantInboxGuideSequenceId[] {
  if (state.facilities.grid?.construction === undefined && productAlerts.length === 0) return [];
  return ['facility-upgrade'];
}

/**
 * Which rows are guaranteed one of the week's three slots.
 *
 * Priority is what buys the place — urgent rows outrank Bert's guides and
 * ordinary rows queue behind them — while `tone` only decides how a row looks.
 * Treating the two as the same field is how the board's own notices became
 * unreachable: an emergency loan reads calmly, so it scheduled as an ordinary
 * row and never landed on a desk that had anything else on it.
 */
function assistantProductPriority(
  alert: ClubAlertViewModel,
  dueGuides: readonly AssistantInboxGuideSequenceId[],
): 'urgent' | 'normal' {
  // The guided first week cannot advance until this project starts, so reserve
  // it a slot without presenting the calm proposal as a red emergency card.
  if (alert.id === 'training-ground') return 'urgent';
  // Calm in tone, unmissable in fact: each of these is a deadline the club
  // cannot look up later. `emergency-loan` is deliberately not among them —
  // see the note on `isBoardNoticeAlertId`.
  if (isBoardNoticeAlertId(alert.id)) return 'urgent';
  // A three-week window, and then the player is gone.
  if (alert.id.startsWith('retirement-final-weeks-')) return 'urgent';
  if (alert.tone === 'urgent') return 'urgent';
  if (dueGuides.includes('retirement') && alert.id.startsWith('retirement-announcement-')) {
    return 'urgent';
  }
  return 'normal';
}

/**
 * The board notices that are time-critical: the warning, the deadline and the
 * verdict. Each states something the manager can only act on this week, and
 * none of them is written down anywhere else.
 *
 * `emergency-loan` used to be the fourth. It held an urgent slot because the
 * outstanding balance appeared on no other screen, which meant a club repaying
 * a loan gave up one of three desk rows every week for as long as it owed
 * anything — two of three while it sat on the cash floor, and all three at an
 * ultimatum deadline. The balance now lives on the finances screen, so the row
 * queues like any other standing fact.
 */
function isBoardNoticeAlertId(alertId: string): boolean {
  return alertId === 'financial-warning'
    || alertId === 'board-ultimatum'
    || alertId.startsWith('board-resolution:');
}

/** Exported for `retirement-visibility.test.ts`; nothing else outside reads it. */
export function isOneShotProductAlert(alertId: string): boolean {
  return alertId.startsWith('board-resolution:')
    || alertId.startsWith('training-cap:')
    || alertId.startsWith('retirement-farewell:')
    // A heads-up, not a standing fact: once seen, the player card carries it.
    || alertId.startsWith('retirement-considering-');
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
  // The engine owns the definition of a playable game week, including Global
  // Cup ties and league-first double headers. Do not infer it from the oldest
  // scheduled league fixture: migrated saves can retain an overdue fixture,
  // which used to make every later desk claim "This week."
  const currentMatchday = activeCareerMatchday(state);
  const nextLeagueFixture = state.fixtures
    .filter(fixture =>
      fixture.status === 'scheduled' &&
      fixture.season === state.season &&
      fixture.week >= state.week &&
      (fixture.homeClubId === state.userClubId || fixture.awayClubId === state.userClubId),
    )
    .sort((left, right) => left.week - right.week || left.round - right.round)[0];
  const nextFixture = currentMatchday?.fixture ?? nextLeagueFixture;
  const nextFixtureCompetition = currentMatchday?.kind === 'national-cup'
    ? `Global Cup · ${currentMatchday.cupRoundLabel ?? 'Knockout tie'}`
    : undefined;
  const isCurrentGameWeek = currentMatchday !== undefined;
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
    heldGuideSequenceIds: quietDeskInboxGuides(assistantState, productAlerts),
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
  const scheduledAlerts = [
    ...selectedProducts.filter(alert => alert.tone === 'urgent'),
    ...guideAlerts,
    ...selectedProducts.filter(alert => alert.tone !== 'urgent'),
  ].slice(0, 3);
  // A quiet week's own contents, in the order they earn attention: the story
  // that landed this week, the shop the club has not found yet, and only if
  // neither applies, the standing build nudge.
  const tipNote = deskTipNote(state);
  const homeNotes = tipNote === undefined ? managerNotes(state) : [...managerNotes(state), tipNote];
  const storyAlert = deskStoryAlert(state);
  const quietWeekAlerts = scheduledAlerts.length > 0
    ? []
    : [storyAlert, drillShopAlert(state)].filter(
        (alert): alert is ClubAlertViewModel => alert !== undefined,
      );
  const alerts = quietWeekAlerts.length > 0
    ? quietWeekAlerts
    : storyAlert !== undefined
      ? [storyAlert, ...scheduledAlerts]
      : isBuildReminderDue(state, scheduledAlerts)
        ? [BUILD_REMINDER_ALERT]
        : scheduledAlerts;

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
    seasonLabel: `Season ${state.season} · ${divisionTierLabel(careerDivision(state))}`,
    divisionLabel: divisionTierLabel(careerDivision(state)),
    weekLabel: `Week ${state.week} / 30`,
    nextMatchTimingLabel: nextFixture === undefined
      ? state.phase === 'complete' ? 'Complete' : 'Season end'
      : isCurrentGameWeek
        ? 'This week'
        : `In ${weekCountLabel(nextFixture.week - state.week).toLowerCase()}`,
    isCurrentGameWeek,
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
      : fixtureViewModel(state, nextFixture, nextFixtureCompetition),
    alerts,
    notes: homeNotes,
    ...(boardUltimatum === undefined ? {} : {
      boardUltimatum: {
        id: boardUltimatum.id,
        weeksRemaining: boardUltimatum.weeksRemaining,
        targetCash: boardUltimatum.targetCash,
        targetLabel: boardTargetLabel(boardUltimatum.targetCash),
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
  const userFixtures = seasonFixtures
    .filter(fixture => fixture.homeClubId === state.userClubId || fixture.awayClubId === state.userClubId)
    .slice()
    .sort((left, right) => left.week - right.week || left.round - right.round || left.id.localeCompare(right.id));

  return {
    divisionLabel: careerDivisionLabel(state),
    seasonLabel: `Season ${state.season}`,
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
    leagueFixtures: userFixtures.map(fixture => leagueFixtureViewModel(
      fixture,
      state.userClubId,
      state.week,
      clubId => clubName(state, clubId),
    )),
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
        ? `Global Cup · ${matchday.cupRoundLabel ?? 'Knockout tie'}`
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
        awayWeeks: player.awayWeeks ?? 0,
        licensed: player.licensed,
        canStart: isAvailableForSelection(player) && !unlicensedHero,
        // Injury outranks leave for the label: a manager can act on an injury —
        // the Medical Bay shortens it — and can only wait out a granted holiday.
        ...(player.injuryWeeks > 0
          ? { unavailableLabel: `OUT · ${weekCountLabel(player.injuryWeeks)}` }
          : (player.awayWeeks ?? 0) > 0
            ? { unavailableLabel: `ON LEAVE · ${weekCountLabel(player.awayWeeks!)}` }
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
): SquadTrainingViewModel {
  const club = requireUserClub(state);
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
  const injuryRiskReductionPercent = state.facilities.grid === undefined
    ? 0
    : facilityEffects(state.facilities.grid).injuryRiskReductionPercent;

  const drillName = (drillId: string): string =>
    content.training.focusDrills.find(candidate => candidate.id === drillId)?.name ?? drillId;

  const selectedPlayer = selectedPlayerId === undefined
    ? undefined
    : playerById.get(selectedPlayerId);

  return {
    resources: {
      money: club.cash,
      trainingPoints: state.trainingPoints,
    },
    ...(createdPlayer === undefined ? {} : { createdPlayerId: createdPlayer.id }),
    players: orderedRoster.map(player => {
      const potentialGrade = playerPotentialGrade(player);
      const personalCaps = playerAttributeCaps(player);
      const positionAttributes = POSITION_TRAINING_ATTRIBUTES[player.role]
        .map(attribute => attribute.toUpperCase())
        .join(', ');
      return {
        id: player.id,
        name: player.name,
        role: player.role,
        lookId: player.lookId,
        overall: overall(player.role, player.attrs),
        potentialGrade,
        superChancePercent: superTrainingChancePercent(potentialGrade),
        ...((player.priorityDrillsRemaining ?? 0) > 0
          && hasActiveCareerContractPromise(player, 'TRAINING_PRIORITY')
          ? { priorityDrillsRemaining: player.priorityDrillsRemaining }
          : {}),
        injuryRiskPercent: overtrainingInjuryChancePercent(
          player.condition ?? 100,
          injuryRiskReductionPercent,
        ),
        positionTrainingLabel: `+5% ${positionAttributes}`,
        condition: player.condition ?? 100,
        injuryWeeks: player.injuryWeeks,
        awayWeeks: player.awayWeeks ?? 0,
        canTrain: isAvailableForSelection(player),
        isStarter: starterIds.has(player.id),
        age: player.age ?? 24,
        archetype: player.archetype ?? 'All-Rounder',
        personality: player.personality ?? 'Professional',
        morale: player.morale,
        loyalty: playerLoyalty(player, state.careerSeed),
        fame: player.fame ?? 0,
        weeklyWage: player.weeklyWage,
        contractLabel: player.contractSeasonsRemaining === 0
          ? 'Expired — renewal due'
          : `${player.contractSeasonsRemaining} season${player.contractSeasonsRemaining === 1 ? '' : 's'} left`,
        ...(player.contractPromise === undefined ? {} : {
          contractPromiseLabel: contractPromiseLabel(player.contractPromise.perk),
        }),
        // Absent while retirement is more than a season away. The squad list
        // deliberately knows less than the negotiating table does.
        ...(retirementCardLabel(player, state.careerSeed) === undefined ? {} : {
          retirementLabel: retirementCardLabel(player, state.careerSeed),
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
    ...(selectedPlayer === undefined ? {} : {
      selectedPlayerStatOptions: TRAINING_PATHS
        .filter(path => attributeAffectsPlay(selectedPlayer.role, path.attribute))
        .map(path => {
          const drill = resolveTrainingDrillForPath(state, path.pathId);
          const gain = drill.gains[path.attribute] ?? 0;
          const currentValue = selectedPlayer.attrs[path.attribute];
          const preview = instantTrainingPreview(state, selectedPlayer.id, path.pathId);
          return {
            pathId: path.pathId,
            label: path.label,
            shortCode: path.attribute.toUpperCase() as TrainingSlotStatOption['shortCode'],
            drillName: drillName(drill.id),
            tpCost: drill.tpCost,
            gain,
            currentValue,
            baseValueAfter: preview.baseAfter,
            trainingAdjustment: preview.adjustment,
            trainingModifierLabels: preview.modifierLabels,
            atSafetyCeiling: currentValue >= 999,
            affordable: drill.tpCost <= state.trainingPoints,
          };
        }),
    }),
    drillUpgrades: TRAINING_PATHS.map(path => {
      const owned = resolveTrainingDrillForPath(state, path.pathId);
      const offer = nextTrainingUpgradeOffer(state, path.pathId);
      const next = offer === undefined
        ? undefined
        : content.training.focusDrills.find(candidate => candidate.id === offer.drillId);
      return {
        pathId: path.pathId,
        label: path.label,
        drillName: drillName(owned.id),
        ownedTier: trainingDrillTier(owned.id),
        ownedGain: owned.gains[path.attribute] ?? 0,
        ownedTpCost: owned.tpCost,
        ...(offer === undefined || next === undefined ? {} : {
          nextTier: offer.tier,
          nextGain: next.gains[path.attribute] ?? 0,
          nextTpCost: next.tpCost,
          cost: offer.cost,
          ...(offer.blockedReason === undefined ? {} : { blockedReason: offer.blockedReason }),
        }),
      };
    }),
    ...(() => {
      const holder = pendingTrainingPriorityHolder(state);
      return holder === undefined ? {} : { trainingPromiseGate: holder };
    })(),
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
        : `Global Cup · ${cupRound.label}`,
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
    updates: weekUpdates(before, after),
    ...(completedFacility === undefined ? {} : { facilityCompletion: completedFacility }),
  };
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
  return eventRewardItems(effects).map(reward => reward.label);
}

function eventRewardItems(
  effects: GameEvent['choices'][number]['outcomes'][number]['effects'],
): NonNullable<StoryEventViewModel['outcomeRewards']> {
  const rewards: NonNullable<StoryEventViewModel['outcomeRewards']>[number][] = [];
  const money = effects.reduce((sum, effect) => effect.type === 'money' ? sum + effect.amount : sum, 0);
  const morale = effects.reduce((sum, effect) => effect.type === 'morale' ? sum + effect.amount : sum, 0);
  const fans = effects.reduce((sum, effect) => effect.type === 'fans' ? sum + effect.amount : sum, 0);
  const trainingPoints = effects.reduce((sum, effect) => effect.type === 'tp' ? sum + effect.amount : sum, 0);
  if (money !== 0) rewards.push({ label: formatMoney(money, true), kind: 'money', positive: money > 0 });
  if (morale !== 0) rewards.push({
    label: `${morale > 0 ? '+' : ''}${morale} squad morale`,
    kind: 'morale',
    positive: morale > 0,
  });
  if (fans !== 0) rewards.push({
    label: `${fans > 0 ? '+' : ''}${fans} fans`,
    kind: 'fans',
    positive: fans > 0,
  });
  if (trainingPoints !== 0) rewards.push({
    label: `${trainingPoints > 0 ? '+' : ''}${trainingPoints} TP`,
    kind: 'training-points',
    positive: trainingPoints > 0,
  });
  for (const effect of effects) {
    if (effect.type === 'statDelta' && effect.amount !== 0) {
      rewards.push({
        label: `${effect.amount > 0 ? '+' : ''}${effect.amount} ${effect.attribute.toUpperCase()}`,
        kind: 'stat',
        positive: effect.amount > 0,
      });
    }
    if (effect.type === 'injury') {
      rewards.push({
        label: `${effect.weeks} week${effect.weeks === 1 ? '' : 's'} out injured`,
        kind: 'injury',
        positive: false,
      });
    }
  }
  if (
    rewards.length === 0
    && effects.some(effect => effect.type === 'flag' && effect.value)
  ) {
    rewards.push({ label: 'Club story secured', kind: 'story', positive: true });
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
  // ASCII hyphen, matching Scorecard's formatCurrency: Silkscreen has no
  // U+2212 glyph, and money strings render in the pixel face.
  const sign = value < 0 ? '-' : signed && value > 0 ? '+' : '';
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
