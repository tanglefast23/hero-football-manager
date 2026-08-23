import {
  displayedAttributeValue,
  displayedDrillGain,
} from './displayed-attributes';
import {
  loadLaunchContent,
  type FulltimeCoachLinePool,
  type GameEvent,
  type LaunchContent,
} from '../content';
import {
  adjacencyDescription,
  copyOrEnglish,
  facilityName,
  resolveRingCopy,
} from './copy-fallback';
import {
  archetypeName,
  coachSpecialtyName,
  personalityName,
  trainingModifierLabel,
} from './name-copy';
import { managerNotes } from './manager-notes';
import { eventOfferForWeek } from './event-selection';
import {
  careerEventTargetCandidates,
  careerEventTargetPlayers,
  reconcilePendingCareerEvent,
} from './career-event-targets';
import {
  FACILITY_ADJACENCIES,
  FACILITY_CATALOG,
  activeCareerMatchday,
  activeFacilityAdjacencies,
  assistantTeaches,
  boardUltimatumConsequence,
  attributeAffectsPlay,
  buildCareerMatchTeamDef,
  careerHeroLimit,
  careerCoachWageLedgerAmount,
  commercialFacilitySummary,
  GATE_ATTENDANCE_PERCENT,
  currentActualMonthlySponsorIncome,
  CUP_SETTLEMENT_WEEKS,
  contractTermOptions,
  createFacilityGrid,
  coachSpeechOffer,
  currentUserDivision,
  greenBullTrainingOffer,
  difficultyRules,
  isConsideringRetirement,
  isRivalHeroIntroHeroId,
  maxRenewalTermSeasons,
  maxSigningTermSeasons,
  retirementCardCopy,
  shortContractReasonCopy,
  fixturesForCurrentWeek,
  hasActiveCareerContractPromise,
  pendingTrainingPriorityHolder,
  isAssistantInboxOneShotProductVisible,
  isAssistantInboxProductDismissedForCurrentWeek,
  isAssistantInboxProductPermanentlyDismissed,
  isFullyCappedPlayer,
  instantTrainingPreview,
  SUPER_TRAINING_PITY_DRILLS,
  latestSeasonRecap,
  leagueStandings,
  homeGateIncome,
  currentDeskTipId,
  deterministicCareerEventRoll,
  isDeskTipSettled,
  markDeskTipSeen,
  nextPendingClubLegend,
  offerCareerEvent,
  unseenDeskTipIds,
  playerAttributeCaps,
  playerGrowthGrade,
  playerPotentialGrade,
  playerGiftQuote,
  LOW_MORALE_GIFT_TUTORIAL_ALERT_ID,
  lowMoraleGiftTutorialPlayerId,
  overtrainingInjuryChancePercent,
  superTrainingChancePercent,
  facilityEffects,
  facilityBuildLimit,
  nextHeroLicenseOffer,
  nextTrainingUpgradeOffer,
  ownedTrainingTier,
  POSITION_TRAINING_ATTRIBUTES,
  reconcilePendingClubLegends,
  careerRenewalBlockedReasonCopy,
  careerBuyingTransferQuote,
  careerRenewalWeeklyAsk,
  resolveTrainingDrillForPath,
  rosterForClub,
  roleOverall,
  scheduleAssistantInboxWeek,
  SEASON_WEEKS,
  SPONSOR_PAYMENT_WEEKS,
  trainingPathAttribute,
  cappedFacilityBoost,
  cappedCoachBoost,
  coachWeeklyTrainingPointsWithBoosts,
  FACILITY_NAME_KEYS,
  trainingSessionPoints,
  TRAINING_PATHS,
  TRAINING_PITCH_TP_PER_LEVEL,
  BASE_WEEKLY_TRAINING_POINTS,
  coachWeeklyTrainingPoints,
  facilityCloseRefund,
  actualSponsorPortfolioIncome,
  allocateSponsorPortfolioPayment,
  nominalSponsorPortfolioIncome,
  sponsorWeeklyChallengeOptions,
  sponsorObjectiveProgressFromFixtures,
  storyTrainingPointReward,
  storyMoneyDelta,
  DORM_CONDITION_RECOVERY_PER_LEVEL,
  isFacilityOperational,
  weeklyFacilityUpkeep,
  weeklyAmbientTrainingPoints,
  weeklyMerchandiseIncome,
  willRetireAtSeasonTransition,
  type CareerPlayer,
  type FacilityLevel,
  type FacilityType,
  compareIds,
  type GameState,
  type LedgerLine,
  type LedgerLineKind,
  type LedgerLineReveal,
  type PlacedFacility,
  type AssistantInboxGuideSequenceId,
  type SponsorContractSnapshot,
  type SponsorObjectiveSnapshot,
  type SponsorOfferSnapshot,
  type SponsorProfileId,
  type SponsorWeeklyChallengeKind,
  reconcileLowMoraleGiftTutorialTarget,
} from '../game';
import type {
  AwakeningCutsceneViewModel,
  ClubLegacyViewModel,
  ClubFinancesViewModel,
  ClubLoanViewModel,
  ClubVariableIncomeViewModel,
  ClubAlertViewModel,
  CoachSpeechViewModel,
  CoachStaffMemberViewModel,
  FixtureViewModel,
  HomeViewModel,
  LeagueTableViewModel,
  ManagerNoteViewModel,
  IncomeGenerationViewModel,
  LedgerIconViewModel,
  MatchDayBannerViewModel,
  HeroLicenseOfferViewModel,
  MatchDayViewModel,
  FulltimeReactionViewModel,
  RivalMockeryViewModel,
  PostMatchViewModel,
  SeasonEndViewModel,
  StoryEventPlayerAttributeViewModel,
  StoryEventPlayerViewModel,
  StoryEventViewModel,
  StoryEventCoachViewModel,
  StoryEventFacilityViewModel,
  SquadTrainingViewModel,
  TrainingPointIncomeViewModel,
  TrainingSlotStatOption,
  WeeklyReviewViewModel,
} from '../ui';
// Direct, not through the `../ui` barrel: that barrel drags in React Native
// components, and this module is imported by headless harnesses.
import { FORM_STRIP_MAX } from '../ui/form-strip';
import {
  cupRoundNameWith,
  DIVISION_NAME_KEYS,
  divisionTierLabelWith,
} from '../game/pyramid';
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
import { contractWageStep, renewalOpeningOfferWage } from '../game/market';
import {
  copyFor,
  formatIntegerForCopy,
  formatMoneyForCopy,
  powerCopySlug,
  proseSlug,
  type CopyFn,
} from '../i18n';

/**
 * English copy, for every caller that has not threaded a locale through yet.
 *
 * The same shape as the seeded PRNG the sim ring takes: a pure module cannot
 * reach React context, so the dependency is a parameter with a default. Built
 * once and reused — `copyFor` spreads the whole English catalog into a fresh
 * object, and these view models are rebuilt on every screen render.
 */
let englishCopyFn: CopyFn | undefined;

function englishCopy(): CopyFn {
  return (englishCopyFn ??= copyFor('en'));
}

import { marketNegotiationViewModel } from './market-view-model';
import { projectedSeasonEndContractPromiseHeroLimit } from './contract-promise-projection';
import { leagueFixtureViewModel } from './m2-league-view-model';
import { coachRoleEffectLabels } from './coach-effects';
import {
  dueAssistantInboxGuideSequences,
  openingInboxDutyForGuideSequence,
  OPENING_TRAINING_PITCH_BLOCKED_REASON_KEY,
  openingTrainingPitchRequired,
  outstandingInboxDuties,
  reconcileSatisfiedAssistantGuideSequences,
  type OpeningInboxDutyId,
} from './assistant-guide';
import { eventChoiceUnavailableReason } from './event-selection';
import { formationRoleForSlot, type FormationId } from '../sim/tactics';

const LAUNCH_CONTENT = loadLaunchContent();
const ASSISTANT_GUIDE_CONTENT = LAUNCH_CONTENT.assistantGuide;

/**
 * How many former players the legacy panel shows before it stops counting.
 *
 * `retiredPlayers` grows for the life of the career, so a roll that printed all
 * of them would eventually be longer than the decision it sits under.
 */
const CLUB_LEGACY_ROLL_LIMIT = 12;

export function clubLegacyViewModel(
  state: GameState,
  t: CopyFn = englishCopy(),
): ClubLegacyViewModel {
  const reconciled = reconcilePendingClubLegends(state);
  const legend = nextPendingClubLegend(reconciled);
  if (legend === undefined)
    throw new Error('there is no pending club-legend decision');
  const pendingCount = reconciled.pendingLegacyPlayerIds?.length ?? 0;
  // Newest first, and never the legend whose decision is on this screen: he is
  // the panel above, and listing him twice reads as two different men.
  const formerPlayers = (state.retiredPlayers ?? [])
    .filter(
      (player) => player.clubId === state.userClubId && player.id !== legend.id,
    )
    .slice()
    .reverse();
  return {
    seasonLabel: t('clubLegacy.seasonLabel', { season: state.season }),
    queueLabel: t('clubLegacy.queueLabel', {
      n: pendingCount,
      count: pendingCount,
    }),
    playerId: legend.id,
    playerName: legend.name,
    role: legend.role,
    lookId: legend.lookId,
    // The id and the word are separate fields on purpose: the id is persisted
    // and switched on, the label is drawn. See `name-copy.ts`.
    archetype: legend.archetype ?? 'All-Rounder',
    archetypeLabel: archetypeName(t, legend.archetype ?? 'All-Rounder'),
    personality: legend.personality ?? 'Professional',
    personalityLabel: personalityName(t, legend.personality ?? 'Professional'),
    fame: legend.fame ?? 0,
    seasonsAtClub: legend.seasonsAtClub ?? 0,
    isHero: legend.power !== undefined,
    // Two options, and neither is the safe one. The coach spends a wage the
    // club may not have; the farewell spends the only chance to have him.
    choices: [
      {
        id: 'coach-candidate',
        label: t('clubLegacy.joinTheStaff'),
        detail: t('clubLegacy.joinTheStaffDetail', { player: legend.name }),
        outcome: t('clubLegacy.joinTheStaffOutcome'),
      },
      {
        id: 'farewell',
        label: t('clubLegacy.letHimGo'),
        detail: t('clubLegacy.letHimGoDetail', { player: legend.name }),
        outcome: t('clubLegacy.letHimGoOutcome'),
      },
    ],
    formerPlayers: formerPlayers
      .slice(0, CLUB_LEGACY_ROLL_LIMIT)
      .map((player) => ({
        playerId: player.id,
        playerName: player.name,
        role: player.role,
        ...(player.lookId === undefined ? {} : { lookId: player.lookId }),
        isHero: player.power !== undefined,
        detail: t('clubLegacy.formerPlayerDetail', {
          role: player.role,
          seasons: seasonCountLabel(player.seasonsAtClub ?? 0, t),
          fame: player.fame ?? 0,
        }),
      })),
    formerPlayerTotal: formerPlayers.length,
  };
}

function seasonCountLabel(seasons: number, t: CopyFn): string {
  return t('viewModels.seasonCount', { n: seasons, count: seasons });
}

export function awakeningCutsceneViewModel(
  state: GameState,
  content: LaunchContent,
  hasPostMatchReport = false,
  t: CopyFn = englishCopy(),
): AwakeningCutsceneViewModel {
  const pending = state.awakening.pending;
  if (pending === undefined)
    throw new Error('there is no pending awakening cutscene');
  const player = state.players.find(
    (candidate) => candidate.id === pending.playerId,
  );
  if (
    player === undefined ||
    player.clubId !== state.userClubId ||
    player.power !== pending.power
  ) {
    throw new Error('the pending awakening player is invalid');
  }
  const power = content.powers.powers.find(
    (candidate) => candidate.id === pending.power,
  );
  const copy = content.onboarding.powers.find(
    (candidate) => candidate.powerId === pending.power,
  );
  const trigger = content.onboarding.triggers.find(
    (candidate) => candidate.id === pending.triggerId,
  );
  if (power === undefined || copy === undefined || trigger === undefined) {
    throw new Error(`awakening content is missing ${pending.power}`);
  }
  const fixture = state.fixtures.find(
    (candidate) => candidate.id === pending.fixtureId,
  );
  if (fixture === undefined)
    throw new Error('the awakening fixture is missing');
  const fillName = (value: string) => value.split('{name}').join(player.name);
  /**
   * The cutscene's prose, in the reader's language, with the player's name put
   * back in. English lives in `onboarding.json` and is what these keys fall
   * back to, so the untranslated case renders exactly what the content file
   * says — including its `{name}`, which is why the fallback is filled too.
   */
  const named = (key: string, authored: string) =>
    copyOrEnglish(t, key, fillName(authored), { name: player.name });
  const powerSlug = powerCopySlug(power.id);

  return {
    fixtureLabel: t('awakening.fixtureLabel', {
      season: fixture.season,
      week: fixture.week,
    }),
    playerId: player.id,
    playerName: player.name,
    role: player.role,
    lookId: player.lookId,
    powerId: pending.power,
    powerName: copyOrEnglish(t, `powerEffect.${powerSlug}.name`, power.name),
    powerDescription: copyOrEnglish(
      t,
      `powerEffect.${powerSlug}.description`,
      power.description,
    ),
    limpCopy: named('story.awakening.limp', content.onboarding.limp),
    triggerVisual: trigger.visual,
    triggerKicker: copyOrEnglish(
      t,
      `awakening.trigger.${trigger.id}.kicker`,
      trigger.kicker,
    ),
    triggerTitle: copyOrEnglish(
      t,
      `awakening.trigger.${trigger.id}.title`,
      trigger.title,
    ),
    triggerCallout: copyOrEnglish(
      t,
      `awakening.trigger.${trigger.id}.callout`,
      trigger.callout,
    ),
    triggerDetail: copyOrEnglish(
      t,
      `story.awakening.trigger.${trigger.id}.detail`,
      trigger.detail,
    ),
    triggerCopy: named(
      `story.awakening.trigger.${trigger.id}.copy`,
      trigger.copy,
    ),
    omenCopy: named(`story.awakening.power.${copy.powerId}.omen`, copy.omen),
    revealCopy: named(
      `story.awakening.power.${copy.powerId}.reveal`,
      copy.reveal,
    ),
    firstHero: pending.firstHero,
    licenseLabel: player.licensed
      ? t('awakening.licenseActive')
      : t('awakening.licenseAwaiting'),
    continueLabel: pending.firstHero
      ? // Spoken, never drawn: the visible button is `powerAcquiredDemo.continue`
        // and this reaches only the accessibility label. The `▸` went with the
        // English — a screen reader announces U+25B8 as "black right-pointing
        // small triangle", which is decoration read aloud as furniture.
        t('awakening.continue.heroEra')
      : state.phase === 'season-end' || state.phase === 'complete'
        ? t('awakening.continue.seasonReview')
        : hasPostMatchReport
          ? t('awakening.continue.matchReport')
          : t('awakening.continue.office'),
  };
}

/**
 * How many settled weeks the itemized statement keeps on screen.
 *
 * It showed exactly one, which made every recurring line unreadable as a trend
 * and made a home gate — the club's largest income, and only ever a ledger line
 * — vanish the moment the next week settled. Four covers a home/away pair plus
 * the four-weekly sponsor payment, so every recurring rhythm appears at least
 * once.
 *
 * This is purely a display window. It is not the only limit on ledger history,
 * though: `state.ledgers` is trimmed to the last `RETAINED_LEDGER_SEASONS`
 * (20) seasons in `career.ts`, so a reader that walks the whole array is
 * reading twenty seasons, not the whole career. That matters only past season
 * 20, and nothing on this screen reaches back that far.
 */
const STATEMENT_WEEKS = 4;

/** The three ledger kinds no weekly projection can forecast. */
const VARIABLE_INCOME_KINDS: readonly LedgerLineKind[] = [
  'tickets',
  'sponsor',
  'buzz',
  'prize',
];

function ledgerLineKind(amount: number): 'income' | 'expense' | 'neutral' {
  return amount > 0 ? 'income' : amount < 0 ? 'expense' : 'neutral';
}

/**
 * Match, sponsor and prize income banked in the settled week, with a reason
 * attached whenever that total is zero for a knowable cause. An away week earns
 * no gate at all, so a bare `$0` there reads as a broken number rather than as
 * the plain fact that the club played somewhere else.
 */
function variableIncomeViewModel(
  state: GameState,
  t: CopyFn,
): ClubVariableIncomeViewModel {
  const settled = state.ledgers[state.ledgers.length - 1];
  const amount = (settled?.lines ?? [])
    .filter((line) => VARIABLE_INCOME_KINDS.includes(line.kind))
    .reduce((sum, line) => sum + line.amount, 0);
  if (amount !== 0) return { amount };
  if (settled === undefined)
    return { amount, detail: t('clubFinances.variableIncomeNoMatch') };
  // Cup ties live in the M2 sidecar, so `state.fixtures` is the league season
  // alone — exactly the fixture whose venue decides the ordinary gate.
  const fixture = state.fixtures.find(
    (candidate) =>
      candidate.season === settled.season &&
      candidate.week === settled.week &&
      (candidate.homeClubId === state.userClubId ||
        candidate.awayClubId === state.userClubId),
  );
  // The league calendar leaves weeks empty — the season opens with two of them —
  // so "no match" is a distinct fact from "played away", and both beat a bare $0.
  if (fixture === undefined)
    return { amount, detail: t('clubFinances.variableIncomeNoMatch') };
  if (fixture.awayClubId === state.userClubId) {
    return { amount, detail: t('clubFinances.variableIncomeAwayGame') };
  }
  // A home week that banked nothing is not a state the settlement can produce.
  // Saying nothing is honest; inventing a reason would not be.
  return { amount };
}

/**
 * The other half of the accounts office: not what the club spent, but what it
 * owns that pays.
 *
 * Every row is a multiplier or a cadence rather than an amount — see
 * IncomeGenerationViewModel. Unbuilt commercial buildings still get a row so
 * the panel doubles as the answer to "how do I make more money", which is the
 * question a manager reads this screen with.
 */
function incomeGenerationViewModel(
  state: GameState,
  club: ReturnType<typeof requireUserClub>,
  sponsorship: ReturnType<typeof clubSponsorshipViewModel>,
  t: CopyFn,
): IncomeGenerationViewModel {
  const commercial = commercialFacilitySummary(state);
  const homeGateHistory = recentIncomeHistory(state, (lines) =>
    settledIncomeTotal(lines, (line) =>
      line.kind === 'tickets' ? line.amount : undefined,
    ),
  );
  const stadiumStandHistory = recentIncomeHistory(state, (lines) =>
    settledIncomeTotal(lines, (line) => {
      const reveal = line.reveal;
      if (
        line.kind !== 'tickets' ||
        reveal === undefined ||
        reveal.source === 'merch'
      )
        return undefined;
      const bonus = line.amount - reveal.base;
      return bonus > 0 ? bonus : undefined;
    }),
  );
  const fanShopHistory = recentIncomeHistory(state, (lines) =>
    settledIncomeTotal(lines, (line) =>
      line.kind === 'merch' ? line.amount : undefined,
    ),
  );
  const rows: IncomeGenerationViewModel['rows'] = [
    {
      id: 'income-gate',
      label: t('clubFinances.incomeGateLabel'),
      detail: t('clubFinances.incomeGateDetail', {
        percent: GATE_ATTENDANCE_PERCENT,
        fans: club.fans,
      }),
      // The weekly roll, stated as the swing the manager actually sees on the
      // statement — including the surge the Financial Report makes a banner of.
      effect: t('clubFinances.incomeGateEffect'),
      owned: true,
      ...(homeGateHistory.length === 0 ? {} : { history: homeGateHistory }),
    },
    {
      id: 'income-stadium-stand',
      label:
        commercial.standCount === 0
          ? t('clubFinances.incomeStandLabel')
          : commercial.standCount === 1
            ? t('clubFinances.incomeStandLabelLevel', {
                level: commercial.standLevel,
              })
            : t('clubFinances.incomeStandLabelBuilt', {
                count: commercial.standCount,
              }),
      detail:
        commercial.standCount === 0
          ? t('clubFinances.incomeStandDetailUnbuilt')
          : t('clubFinances.incomeStandDetailBuilt', {
              levels: t('viewModels.levelCount', {
                n: commercial.standLevel,
                count: commercial.standLevel,
              }),
              stands: t('viewModels.standCount', {
                n: commercial.standCount,
                count: commercial.standCount,
              }),
            }),
      effect:
        commercial.standCount === 0
          ? t('clubFinances.incomeStandEffectUnbuilt')
          : t('clubFinances.incomeStandEffect', {
              percent: commercial.gateBonusPercent,
            }),
      owned: commercial.standCount > 0,
      ...(stadiumStandHistory.length === 0
        ? {}
        : { history: stadiumStandHistory }),
    },
    {
      id: 'income-fan-shop',
      label:
        commercial.shopCount === 0
          ? t('clubFinances.incomeShopLabel')
          : commercial.shopCount === 1
            ? t('clubFinances.incomeShopLabelLevel', {
                level: commercial.shopLevel,
              })
            : t('clubFinances.incomeShopLabelBuilt', {
                count: commercial.shopCount,
              }),
      detail:
        commercial.shopCount === 0
          ? t('clubFinances.incomeShopDetailUnbuilt')
          : commercial.merchAdjacencyPercent > 0
            ? t('clubFinances.incomeShopDetailAdjacency', {
                percent: commercial.merchAdjacencyPercent,
              })
            : t('clubFinances.incomeShopDetailBuilt'),
      effect:
        commercial.shopCount === 0
          ? t('clubFinances.incomeShopEffectUnbuilt')
          : t('clubFinances.incomeShopEffect', {
              percent: commercial.shopIncomePercent,
            }),
      owned: commercial.shopCount > 0,
      ...(fanShopHistory.length === 0 ? {} : { history: fanShopHistory }),
    },
  ];
  // At D5 this is the one line of commercial income the club has no say over;
  // from D4 the managed desk replaces it with signed sponsors, and the row
  // renames itself rather than the panel gaining a second sponsor block.
  const sponsorIncome = currentActualMonthlySponsorIncome(state, club);
  const managedSponsors = sponsorship?.managed === true;
  const sponsorHistory = recentIncomeHistory(state, (lines) =>
    settledIncomeTotal(lines, (line) => {
      if (line.kind !== 'sponsor') return undefined;
      const localAdvertising =
        line.labelKey === 'ledger.localAdvertisingMonthly' ||
        (line.labelKey === undefined &&
          line.label === 'Local advertising (monthly)');
      if (managedSponsors ? localAdvertising : !localAdvertising)
        return undefined;
      return line.amount;
    }),
  );
  return {
    rows: [
      ...rows,
      ...(sponsorIncome <= 0
        ? []
        : [
            {
              id: 'income-sponsor',
              label: managedSponsors
                ? t('clubFinances.incomeSponsorLabel')
                : t('clubFinances.incomeAdvertisingLabel'),
              detail: managedSponsors
                ? t('clubFinances.incomeSponsorDetail', {
                    payment:
                      sponsorship?.nextPaymentLabel ??
                      t('clubFinances.incomeSponsorPaidMonthly'),
                  })
                : t('clubFinances.incomeAdvertisingDetail'),
              effect: t('clubFinances.incomeSponsorEffect'),
              owned: true,
              ...(sponsorHistory.length === 0
                ? {}
                : { history: sponsorHistory }),
            },
          ]),
    ],
  };
}

const INCOME_HISTORY_LIMIT = 3;

/**
 * The newest Weekly Reviews where one income source actually appears.
 *
 * Ledgers are append-only saved truth. Reading them avoids recalculating an old
 * gate with today's fans, ticket price, facilities, or difficulty rules.
 */
function recentIncomeHistory(
  state: GameState,
  amountForReview: (lines: readonly LedgerLine[]) => number | undefined,
): NonNullable<IncomeGenerationViewModel['rows'][number]['history']> {
  const history: Array<{ week: number; amount: number }> = [];
  for (
    let index = state.ledgers.length - 1;
    index >= 0 && history.length < INCOME_HISTORY_LIMIT;
    index -= 1
  ) {
    const ledger = state.ledgers[index];
    const amount = amountForReview(ledger.lines);
    if (amount === undefined) continue;
    // The week alone. The season was dropped from the row on the owner's call:
    // three entries deep, every one of them is this season or the last, and the
    // "S1 · " prefix cost more width than it ever explained.
    history.push({ week: ledger.week, amount });
  }
  return history;
}

/** One Weekly Review can contain both a league gate and a Cup gate. */
function settledIncomeTotal(
  lines: readonly LedgerLine[],
  amountForLine: (line: LedgerLine) => number | undefined,
): number | undefined {
  let found = false;
  let total = 0;
  for (const line of lines) {
    const amount = amountForLine(line);
    if (amount === undefined) continue;
    found = true;
    total += amount;
  }
  return found ? total : undefined;
}

export function clubFinancesViewModel(
  state: GameState,
  t: CopyFn = englishCopy(),
): ClubFinancesViewModel {
  const club = requireUserClub(state);
  const sponsorship = clubSponsorshipViewModel(state, club, t);
  const coachSpeech = coachSpeechViewModel(state, t);
  const wageSubsidyPercent = difficultyRules(state).seasonOneWageSubsidyPercent;
  const facilityUpkeep =
    state.facilities.grid === undefined
      ? 0
      : weeklyFacilityUpkeep(state.facilities.grid);
  const coachWage =
    state.market === undefined ? 0 : careerCoachWageLedgerAmount(state.market);
  const merchandiseIncome = weeklyMerchandiseIncome(state, club);
  const recurringProjectionLines = [
    ...(merchandiseIncome === 0
      ? []
      : [
          {
            kind: 'merch' as const,
            label: t('ledger.fanShopMerchandise'),
            amount: merchandiseIncome,
          },
        ]),
    {
      kind: 'wages' as const,
      label: t('ledger.weeklyWages'),
      amount: -club.weeklyWages,
    },
    ...(coachWage === 0
      ? []
      : [
          {
            kind: 'wages' as const,
            label: t('ledger.coachingStaffWages'),
            amount: coachWage,
          },
        ]),
    ...(facilityUpkeep === 0
      ? []
      : [
          {
            kind: 'facilities' as const,
            label: t('ledger.facilityUpkeep'),
            amount: -facilityUpkeep,
          },
        ]),
    ...(state.season === 1 && wageSubsidyPercent > 0
      ? [
          {
            kind: 'subsidy' as const,
            label: t('ledger.seasonOneWageSubsidy'),
            amount: Math.floor(
              ((club.weeklyWages + Math.abs(coachWage)) * wageSubsidyPercent) /
                100,
            ),
          },
        ]
      : []),
  ];
  const weeklyNet = recurringProjectionLines.reduce(
    (sum, line) => sum + line.amount,
    0,
  );
  const operatingOutlook = fourWeekOperatingOutlook(
    state,
    club,
    recurringProjectionLines,
    t,
  );
  // Newest week first: the statement is read top-down like a bank statement,
  // and the week just settled is the one the manager came here to check.
  const settledStatements = state.ledgers.slice(-STATEMENT_WEEKS).reverse();
  const statement =
    settledStatements.length === 0
      ? recurringProjectionLines.map((line, index) => ({
          id: `finance-projection-${index}`,
          periodLabel: `S${state.season} · W${state.week}`,
          // Already translated: the projection lines are built right here with `t`.
          label: line.label,
          amount: line.amount,
          kind: ledgerLineKind(line.amount),
        }))
      : // `labelKey` is written onto every persisted ledger line and translated in
        // all six catalogs, but this read used the raw English — so the projection
        // rows above rendered in the player's language and then flipped to English
        // the moment the first week settled. Same screen, two languages, on the
        // strength of one word.
        settledStatements.flatMap((entry) =>
          entry.lines.map((line, index) => ({
            id: `finance-${entry.season}-${entry.week}-${index}`,
            periodLabel: `S${entry.season} · W${entry.week}`,
            label: copyOrEnglish(
              t,
              line.labelKey,
              line.label,
              line.labelParams,
            ),
            amount: line.amount,
            kind: ledgerLineKind(line.amount),
          })),
        );
  const trainingGroundProject =
    state.facilities.grid?.construction?.type === 'training-pitch' &&
    state.facilities.grid.construction.kind === 'BUILD'
      ? state.facilities.grid.construction
      : undefined;
  const loan = outstandingLoanViewModel(state, t);
  return {
    periodLabel: `S${state.season} · W${state.week}`,
    resources: {
      money: club.cash,
      trainingPoints: state.trainingPoints,
      fans: club.fans,
    },
    ...(loan === undefined ? {} : { loan }),
    ledger: statement,
    recentTransactions: [...(state.cashTransactions ?? [])]
      .slice(-8)
      .reverse()
      .map((transaction) => ({
        id: transaction.id,
        periodLabel: `S${transaction.season} · W${transaction.week}`,
        // The English `label` is what the save holds; the key beside it is what
        // the club reads. Old transactions carry no key and keep their English.
        label: copyOrEnglish(
          t,
          transaction.labelKey,
          transaction.label,
          transaction.labelParams,
        ),
        amount: transaction.amount,
        balanceAfter: transaction.balanceAfter,
        kind: ledgerLineKind(transaction.amount),
      })),
    fans: club.fans,
    variableIncome: variableIncomeViewModel(state, t),
    incomeGeneration: incomeGenerationViewModel(state, club, sponsorship, t),
    operatingOutlook,
    weeklyNet,
    projectedBalance: club.cash + weeklyNet,
    ...(state.season === 1 && wageSubsidyPercent > 0
      ? {
          wageSubsidyLabel: t('clubFinances.wageSubsidyLabel', {
            percent: wageSubsidyPercent,
          }),
        }
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
    clubName: club.name,
    coachingStaff: coachingStaffViewModels(state, t),
    ...(coachSpeech === undefined ? {} : { coachSpeech }),
    facilities: facilityGridViewModel(state, t),
    trainingPointIncome: trainingPointIncomeViewModel(state, t),
    ...(sponsorship === undefined ? {} : { sponsorship }),
  };
}

function fourWeekOperatingOutlook(
  state: GameState,
  club: GameState['clubs'][number],
  recurringLines: readonly {
    readonly label: string;
    readonly amount: number;
  }[],
  t: CopyFn,
): ClubFinancesViewModel['operatingOutlook'] {
  if (state.phase === 'season-end' || state.phase === 'complete') {
    return { weeks: [], net: 0, projectedBalance: club.cash };
  }
  const recurringNet = recurringLines.reduce(
    (sum, line) => sum + line.amount,
    0,
  );
  const sponsorIncome = currentActualMonthlySponsorIncome(state, club);
  // A D5 club has no sponsors to name. Managed contracts, not the division, are
  // what makes "sponsor" the true word — a club relegated from D4 keeps both.
  const managed = state.clubBusiness.sponsorship.activeContracts.length > 0;
  const gateIncome = homeGateIncome(state, club, 'projected home gate');
  const cup = state.m2?.nationalCups.find(
    (candidate) => candidate.season === state.season,
  );
  let runningBalance = club.cash;
  const weeks = Array.from(
    { length: Math.min(4, SEASON_WEEKS - state.week + 1) },
    (_unused, index) => state.week + index,
  ).map((week) => {
    let net = recurringNet;
    const facts: string[] = [];
    const leagueFixture = state.fixtures.find(
      (fixture) =>
        fixture.season === state.season &&
        fixture.week === week &&
        (fixture.homeClubId === state.userClubId ||
          fixture.awayClubId === state.userClubId),
    );
    if (leagueFixture?.homeClubId === state.userClubId) {
      net += gateIncome;
      facts.push(t('clubFinances.outlookHomeLeagueGate'));
    } else if (leagueFixture?.awayClubId === state.userClubId) {
      facts.push(t('clubFinances.outlookAwayLeagueGame'));
    }

    const cupRound = cup?.rounds.find(
      (round) => CUP_SETTLEMENT_WEEKS[round.number - 1] === week,
    );
    const cupFixture = cupRound?.fixtures.find(
      (fixture) =>
        fixture.homeClubId === state.userClubId ||
        fixture.awayClubId === state.userClubId,
    );
    if (cupFixture?.homeClubId === state.userClubId) {
      net += gateIncome;
      facts.push(t('clubFinances.outlookHomeCupGate'));
    } else if (cupFixture?.awayClubId === state.userClubId) {
      facts.push(t('clubFinances.outlookAwayCupTie'));
    }

    if (
      SPONSOR_PAYMENT_WEEKS.includes(
        week as (typeof SPONSOR_PAYMENT_WEEKS)[number],
      )
    ) {
      net += sponsorIncome;
      facts.push(
        managed
          ? t('clubFinances.outlookSponsorPayment')
          : t('clubFinances.outlookAdvertisingPayment'),
      );
    }
    if (facts.length === 0) {
      facts.push(
        managed
          ? t('clubFinances.outlookNoSponsorPayment')
          : t('clubFinances.outlookNoAdvertisingPayment'),
      );
    }
    runningBalance += net;
    return {
      periodLabel: `S${state.season} · W${week}`,
      detail: facts.join(' · '),
      net,
      projectedBalance: runningBalance,
    };
  });
  return {
    weeks,
    net: weeks.reduce((sum, week) => sum + week.net, 0),
    projectedBalance: runningBalance,
  };
}

/**
 * The content id the continuity placeholder carries.
 *
 * It matches no row in `sponsors.json` on purpose — "the deal you already have"
 * is not a brand — so every lookup here has to fall through to chrome rather
 * than assume a brand exists. Missing that is what would leave an old save
 * reading English forever, since the persisted words are a perfectly readable
 * fallback and nothing would look broken.
 */
const CONTINUITY_SPONSOR_ID = 'continuity';

const SPONSOR_PROFILE_LABEL_KEYS: Readonly<Record<SponsorProfileId, string>> = {
  STEADY: 'clubFinances.sponsorProfileSteady',
  BALANCED: 'clubFinances.sponsorProfileBalanced',
  BOLD: 'clubFinances.sponsorProfileBold',
};

/**
 * A sponsor's name. English by product decision — a fictional sponsor is the
 * same class of invented proper noun as `Bramble Rovers`, and translating twelve
 * of them would buy no clarity — EXCEPT the continuity placeholder, which is UI
 * chrome wearing a sponsor's slot.
 */
function sponsorNameCopy(
  t: CopyFn,
  contract: Pick<
    SponsorContractSnapshot,
    'sponsorContentId' | 'sponsorName' | 'slot'
  >,
  portfolioSlots: number,
): string {
  if (contract.sponsorContentId !== CONTINUITY_SPONSOR_ID)
    return contract.sponsorName;
  return portfolioSlots <= 1
    ? t('clubFinances.sponsorContinuityName')
    : t('clubFinances.sponsorContinuityNameNumbered', {
        number: contract.slot + 1,
      });
}

/**
 * The line under the name, resolved from the content id both the contract and
 * the offer snapshot have carried since they were written.
 *
 * The persisted English stays the fallback, so a save signed before this existed
 * still reads — and so does one whose brand an app update has removed.
 */
function sponsorOfferLineCopy(
  t: CopyFn,
  contract: Pick<SponsorContractSnapshot, 'sponsorContentId' | 'offerLine'>,
): string {
  return contract.sponsorContentId === CONTINUITY_SPONSOR_ID
    ? t('clubFinances.sponsorContinuityTerms')
    : copyOrEnglish(
        t,
        `sponsor.brand.${contract.sponsorContentId}.offerLine`,
        contract.offerLine,
      );
}

/** The season target, from the key the producer now writes beside the English. */
function sponsorObjectiveCopy(
  t: CopyFn,
  objective: SponsorObjectiveSnapshot,
): string {
  return copyOrEnglish(
    t,
    objective.labelKey,
    objective.label,
    objective.labelParams,
  );
}

function sponsorWeeklyChallengeTargetCopy(
  t: CopyFn,
  kind: SponsorWeeklyChallengeKind,
): string {
  return t(
    kind === 'SCORE_THREE'
      ? 'clubFinances.sponsorSprintScoreThree'
      : 'clubFinances.sponsorSprintCleanSheet',
  );
}

function clubSponsorshipViewModel(
  state: GameState,
  club: GameState['clubs'][number],
  t: CopyFn,
): ClubFinancesViewModel['sponsorship'] {
  const sponsorship = state.clubBusiness.sponsorship;
  const managed = sponsorship.activeContracts.length > 0;
  if (!managed && state.season < 3) return undefined;

  const sponsorPercent = difficultyRules(state).sponsorIncomePercent;
  const actualAllocations = managed
    ? allocateSponsorPortfolioPayment(
        sponsorship.activeContracts,
        sponsorPercent,
      )
    : [];
  const actualByContract = new Map(
    actualAllocations.map((allocation) => [
      allocation.contractId,
      allocation.actualAmount,
    ]),
  );
  const nominalMonthlyIncome = managed
    ? nominalSponsorPortfolioIncome(sponsorship.activeContracts)
    : club.sponsorMonthlyFee;
  const actualMonthlyIncome = managed
    ? actualSponsorPortfolioIncome(sponsorship.activeContracts, sponsorPercent)
    : Math.floor((club.sponsorMonthlyFee * sponsorPercent) / 100);
  const bonusByContract = actualObjectiveBonuses(
    sponsorship.activeContracts,
    sponsorPercent,
  );
  const nextSponsorPaymentWeek = SPONSOR_PAYMENT_WEEKS.find(
    (week) => week >= state.week,
  );
  const weeklyChallengeOptions = sponsorWeeklyChallengeOptions(
    sponsorship,
    state.fixtures,
    state.userClubId,
    state.season,
    state.week,
  );
  const acceptedChallenge = sponsorship.weeklyChallenge;
  const weeklyChallenge =
    weeklyChallengeOptions.length > 0
      ? {
          status: 'OFFER' as const,
          sponsorName: weeklyChallengeOptions[0].sponsorName,
          fixtureWeek: weeklyChallengeOptions[0].fixtureWeek,
          actualBonus: Math.round(
            (weeklyChallengeOptions[0].nominalBonus * sponsorPercent) / 100,
          ),
          options: weeklyChallengeOptions.map((option) => ({
            kind: option.kind,
            targetLabel: sponsorWeeklyChallengeTargetCopy(t, option.kind),
          })),
        }
      : acceptedChallenge === undefined
        ? undefined
        : {
            status:
              acceptedChallenge.outcome === undefined
                ? ('ACTIVE' as const)
                : acceptedChallenge.outcome.met
                  ? ('MET' as const)
                  : ('FAILED' as const),
            sponsorName: acceptedChallenge.sponsorName,
            fixtureWeek: acceptedChallenge.fixtureWeek,
            actualBonus:
              acceptedChallenge.outcome?.actualBonus ??
              Math.round(
                (acceptedChallenge.nominalBonus * sponsorPercent) / 100,
              ),
            targetLabel: sponsorWeeklyChallengeTargetCopy(
              t,
              acceptedChallenge.kind,
            ),
          };

  const slots = sponsorship.activeContracts.map((contract) => {
    // "Current Sponsor" only loses its number when the club has a single slot,
    // which is what the producer decided from `capacity` when it wrote the
    // English. A portfolio is one season's worth of contracts, so counting them
    // recovers the same answer without parsing the persisted words back.
    const portfolioSlots = sponsorship.activeContracts.filter(
      (candidate) => candidate.season === contract.season,
    ).length;
    const progress =
      contract.objective === undefined
        ? undefined
        : sponsorObjectiveProgressFromFixtures(
            contract.objective,
            state.fixtures,
            state.userClubId,
            state.season,
          );
    const objectiveStatus =
      contract.objectiveOutcome === undefined
        ? ('IN_PROGRESS' as const)
        : contract.objectiveOutcome.met
          ? ('MET' as const)
          : ('FAILED' as const);
    return {
      slot: contract.slot,
      slotLabel: t('clubFinances.sponsorSlotLabel', {
        number: contract.slot + 1,
      }),
      sponsorName: sponsorNameCopy(t, contract, portfolioSlots),
      offerLine: sponsorOfferLineCopy(t, contract),
      provisional: contract.provisional,
      nominalMonthlyFee: contract.nominalMonthlyFee,
      actualMonthlyFee: actualByContract.get(contract.contractId) ?? 0,
      ...(contract.objective === undefined
        ? {}
        : {
            objectiveLabel: sponsorObjectiveCopy(t, contract.objective),
            objectiveProgressLabel:
              progress === undefined
                ? undefined
                : contract.objective.kind === 'LEAGUE_FINISH'
                  ? t('clubFinances.sponsorObjectiveLeaguePlace', {
                      place: progress.value,
                      target: progress.target,
                    })
                  : `${progress.value} / ${progress.target}`,
            objectiveStatus,
            nominalBonus: contract.objective.nominalBonus,
            actualBonus:
              contract.objectiveOutcome?.actualBonus ??
              bonusByContract.get(contract.contractId) ??
              0,
          }),
      offers: sponsorship.offers
        .filter((offer) => offer.slot === contract.slot)
        .map((offer) =>
          sponsorOfferViewModel(
            offer,
            sponsorship.activeContracts,
            sponsorPercent,
            t,
          ),
        ),
    };
  });
  return {
    managed,
    offerWindowOpen:
      managed && state.week <= 4 && sponsorship.offers.length > 0,
    actualMonthlyIncome,
    nominalMonthlyIncome,
    nextPaymentLabel:
      nextSponsorPaymentWeek === undefined
        ? t('clubFinances.sponsorNextPaymentPreSeason')
        : t('clubFinances.sponsorNextPaymentWeek', {
            week: nextSponsorPaymentWeek,
          }),
    ...(sponsorPercent === 100 ? {} : { chairmanPercent: sponsorPercent }),
    slots,
    ...(weeklyChallenge === undefined ? {} : { weeklyChallenge }),
  };
}

function sponsorOfferViewModel(
  offer: SponsorOfferSnapshot,
  contracts: readonly SponsorContractSnapshot[],
  sponsorPercent: number,
  t: CopyFn,
) {
  const hypothetical: SponsorContractSnapshot[] = contracts.map((contract) =>
    contract.slot === offer.slot
      ? {
          contractId: `preview-${offer.offerId}`,
          sponsorContentId: offer.sponsorContentId,
          sponsorName: offer.sponsorName,
          offerLine: offer.offerLine,
          season: offer.season,
          slot: offer.slot,
          nominalMonthlyFee: offer.nominalMonthlyFee,
          profile: offer.profile,
          objective: offer.objective,
          provisional: false,
        }
      : contract,
  );
  const previewId = `preview-${offer.offerId}`;
  const actualMonthlyFee =
    allocateSponsorPortfolioPayment(hypothetical, sponsorPercent).find(
      (allocation) => allocation.contractId === previewId,
    )?.actualAmount ?? 0;
  const actualBonus =
    actualObjectiveBonuses(hypothetical, sponsorPercent).get(previewId) ?? 0;
  return {
    offerId: offer.offerId,
    sponsorName: offer.sponsorName,
    offerLine: sponsorOfferLineCopy(t, offer),
    profile: offer.profile,
    profileLabel: t(SPONSOR_PROFILE_LABEL_KEYS[offer.profile]),
    nominalMonthlyFee: offer.nominalMonthlyFee,
    actualMonthlyFee,
    objectiveLabel: sponsorObjectiveCopy(t, offer.objective),
    nominalBonus: offer.objective.nominalBonus,
    actualBonus,
  };
}

function actualObjectiveBonuses(
  contracts: readonly SponsorContractSnapshot[],
  sponsorPercent: number,
): Map<string, number> {
  const bonusContracts = contracts.map((contract) => ({
    ...contract,
    nominalMonthlyFee: contract.objective?.nominalBonus ?? 0,
  }));
  return new Map(
    allocateSponsorPortfolioPayment(bonusContracts, sponsorPercent).map(
      (allocation) => [allocation.contractId, allocation.actualAmount],
    ),
  );
}

/**
 * The weekly training-point total, itemized.
 *
 * Deliberately assembled from the same three terms `weeklyAmbientTrainingPoints`
 * adds up, in the same order, so the rows can never sum to a different number
 * than the engine credits. The total is asserted against it below rather than
 * re-derived, because two additions of the same figures is exactly how a
 * breakdown screen drifts from the thing it explains.
 */
function trainingPointIncomeViewModel(
  state: GameState,
  t: CopyFn,
): TrainingPointIncomeViewModel {
  const grid = state.facilities.grid;
  const bestPitch = grid?.buildings
    .filter(
      (building) =>
        building.type === 'training-pitch' &&
        isFacilityOperational(grid, building.id),
    )
    .reduce<PlacedFacility | undefined>(
      (best, building) =>
        best === undefined || building.level > best.level ? building : best,
      undefined,
    );
  const pitchLevel =
    grid === undefined
      ? state.facilities.trainingGroundBuilt
        ? 1
        : 0
      : (bestPitch?.level ?? 0);
  const rawPitchPoints = pitchLevel * TRAINING_PITCH_TP_PER_LEVEL;
  const pitchPoints = Math.max(
    0,
    Math.round(
      (rawPitchPoints *
        (100 + cappedFacilityBoost(bestPitch?.boosts, 'tpBonusPercent'))) /
        100,
    ),
  );
  const head = state.market?.headCoach;
  const assistant = state.market?.assistantCoach;
  const rows = [
    {
      id: 'training-points-baseline',
      label: t('clubFinances.tpBaselineLabel'),
      detail: t('clubFinances.tpBaselineDetail'),
      points: BASE_WEEKLY_TRAINING_POINTS,
    },
    ...(pitchLevel === 0
      ? []
      : [
          {
            id: 'training-points-pitch',
            label: t('clubFinances.tpPitchLabel', { level: pitchLevel }),
            detail: t('clubFinances.tpPitchDetail', {
              points: TRAINING_PITCH_TP_PER_LEVEL,
            }),
            points: pitchPoints,
          },
        ]),
    ...(head === undefined
      ? []
      : [
          {
            id: 'training-points-head-coach',
            label: head.name,
            detail: t('clubFinances.tpHeadCoachDetail', { level: head.level }),
            points: coachWeeklyTrainingPointsWithBoosts(head, 'HEAD'),
          },
        ]),
    ...(assistant === undefined
      ? []
      : [
          {
            id: 'training-points-assistant-coach',
            label: assistant.name,
            detail: t('clubFinances.tpAssistantCoachDetail', {
              level: assistant.level,
            }),
            points: coachWeeklyTrainingPointsWithBoosts(assistant, 'ASSISTANT'),
          },
        ]),
  ];
  const total = weeklyAmbientTrainingPoints(state);
  const listed = rows.reduce((sum, row) => sum + row.points, 0);
  if (listed !== total) {
    throw new Error(
      `training point breakdown lists ${listed} but the week credits ${total}`,
    );
  }
  return { rows, total };
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
function outstandingLoanViewModel(
  state: GameState,
  t: CopyFn,
): ClubLoanViewModel | undefined {
  const loan = state.financialSafety?.loan;
  if (loan === undefined || loan.remainingBalance <= 0) return undefined;
  const repaying = state.season >= loan.repaymentStartsSeason;
  return {
    originalAmount: loan.originalAmount,
    remainingBalance: loan.remainingBalance,
    scheduleLabel: repaying
      ? t('clubFinances.loanWeeksLeft')
      : t('clubFinances.loanRepaymentsBegin'),
    scheduleValue: repaying
      ? `${loan.remainingWeeks}`
      : t('clubFinances.loanRepaymentSeason', {
          season: loan.repaymentStartsSeason,
        }),
    detail: repaying
      ? t('clubFinances.loanDetailRepaying')
      : t('clubFinances.loanDetailPending', {
          season: loan.repaymentStartsSeason,
        }),
  };
}

/**
 * `roleLabel` is deliberately still English. `CoachStaffMemberViewModel` types it
 * as the literal union `'Head coach' | 'Assistant coach'`, so a catalog lookup
 * cannot satisfy it without either widening that type in `src/ui/models.ts` or
 * casting a translated string back to a literal it will not equal. Widening the
 * field is the fix; it belongs with the pass that threads the live `t` in.
 */
/**
 * The head coach's speech desk, or nothing at all before the club reaches D3.
 *
 * The blocked reason is turned into a sentence here rather than in the screen:
 * the board's job is to render what it is handed, and every other refusal on
 * this screen (the Green Bull desk, the coach market) resolves its copy in this
 * layer too.
 */
function coachSpeechViewModel(
  state: GameState,
  t: CopyFn,
): CoachSpeechViewModel | undefined {
  const offer = coachSpeechOffer(state);
  if (offer === undefined) return undefined;
  const blockedLabel =
    offer.blockedReason === undefined
      ? undefined
      : t(`coachSpeech.blocked.${offer.blockedReason}`);
  return {
    trainingPointsCost: offer.trainingPointsCost,
    bankedCount: offer.bankedCount,
    boost: offer.boost,
    label: t('coachSpeech.trainCoach'),
    // Nothing at zero: "Banked · 0" reads as a fault rather than as an
    // empty shelf. The count-neutral form buys us out of six plural systems.
    ...(offer.bankedCount > 0
      ? {
          bankedLabel: t('coachSpeech.bankedTally', {
            count: offer.bankedCount,
          }),
        }
      : {}),
    ...(blockedLabel === undefined ? {} : { blockedLabel }),
  };
}

function coachingStaffViewModels(
  state: GameState,
  t: CopyFn,
): readonly CoachStaffMemberViewModel[] {
  return [
    ...(state.market?.headCoach === undefined
      ? []
      : [
          {
            id: state.market.headCoach.id,
            role: 'HEAD' as const,
            roleLabel: t('coachStaff.headCoach'),
            portraitId:
              state.market.headCoach.portraitId ?? state.market.headCoach.id,
            name: state.market.headCoach.name,
            age: state.market.headCoach.age ?? 45,
            personalityLabel: personalityName(
              t,
              state.market.headCoach.personality,
            ),
            level: state.market.headCoach.level,
            specialtyLabels: state.market.headCoach.specialties.map(
              (specialty) => coachSpecialtyName(t, specialty),
            ) as [string, string],
            effectLabels: coachRoleEffectLabels(
              state.market.headCoach,
              'HEAD',
              t,
            ),
            weeklyWage: state.market.headCoach.weeklyWage,
            seasonsEmployed: state.market.headCoachSeasonsEmployed ?? 0,
            severanceCost: state.market.headCoach.weeklyWage,
          },
        ]),
    ...(state.market?.assistantCoach === undefined
      ? []
      : [
          {
            id: state.market.assistantCoach.id,
            role: 'ASSISTANT' as const,
            roleLabel: t('coachStaff.assistantCoach'),
            portraitId:
              state.market.assistantCoach.portraitId ??
              state.market.assistantCoach.id,
            name: state.market.assistantCoach.name,
            age: state.market.assistantCoach.age ?? 45,
            personalityLabel: personalityName(
              t,
              state.market.assistantCoach.personality,
            ),
            level: state.market.assistantCoach.level,
            specialtyLabels: state.market.assistantCoach.specialties.map(
              (specialty) => coachSpecialtyName(t, specialty),
            ) as [string, string],
            effectLabels: coachRoleEffectLabels(
              state.market.assistantCoach,
              'ASSISTANT',
              t,
            ),
            weeklyWage: state.market.assistantCoach.weeklyWage,
            seasonsEmployed: state.market.assistantCoachSeasonsEmployed ?? 0,
            severanceCost: state.market.assistantCoach.weeklyWage,
          },
        ]),
  ];
}

function facilityGridViewModel(
  state: GameState,
  t: CopyFn,
): ClubFinancesViewModel['facilities'] {
  const grid = state.facilities.grid ?? createFacilityGrid();
  const club = requireUserClub(state);
  const activeAdjacencies = activeFacilityAdjacencies(grid);
  const pitchMustBeFirst = openingTrainingPitchRequired(state);
  return {
    width: grid.width,
    height: grid.height,
    buildings: grid.buildings.map((building) => {
      const definition = FACILITY_CATALOG[building.type];
      const project =
        grid.construction?.buildingId === building.id
          ? grid.construction
          : undefined;
      const closedWeeks = building.closedWeeks ?? 0;
      const upgradeCost =
        building.level < 3
          ? definition.upgradeCosts[building.level - 1]
          : undefined;
      const nextLevelEffectLabel =
        building.level < 3
          ? facilityNextLevelEffectLabel(
              building.type,
              (building.level + 1) as FacilityLevel,
              t,
            )
          : undefined;
      const blocked =
        building.level < 3
          ? facilityUpgradeBlockedReason(
              state,
              (building.level + 1) as FacilityLevel,
            )
          : undefined;
      const upgradeBlockedReason =
        blocked === undefined ? undefined : resolveRingCopy(t, blocked);
      // The rung as data. The screen used to read it back out of the sentence
      // with `/D[1-5]/`, which only worked while every translation kept an
      // English-authored token.
      const upgradeBlockedDivision =
        typeof blocked?.textParams?.divisionLevel === 'number'
          ? blocked.textParams.divisionLevel
          : undefined;
      return {
        id: building.id,
        type: building.type,
        name: facilityName(t, building.type),
        level: building.level,
        x: building.x,
        y: building.y,
        width: definition.footprint.width,
        height: definition.footprint.height,
        weeklyUpkeep:
          project?.kind === 'BUILD' || closedWeeks > 0
            ? 0
            : definition.weeklyUpkeep[building.level - 1],
        effectLabel: facilityEffectLabel(building.type, building.level, t),
        ...(upgradeCost === undefined ? {} : { upgradeCost }),
        ...(nextLevelEffectLabel === undefined ? {} : { nextLevelEffectLabel }),
        ...(upgradeBlockedReason === undefined ? {} : { upgradeBlockedReason }),
        ...(upgradeBlockedDivision === undefined
          ? {}
          : { upgradeBlockedDivision }),
        canUpgrade:
          grid.construction === undefined &&
          closedWeeks === 0 &&
          upgradeCost !== undefined &&
          upgradeBlockedReason === undefined &&
          club.cash >= upgradeCost,
        upgradeShortfall:
          upgradeCost === undefined ? 0 : Math.max(0, upgradeCost - club.cash),
        relocationFee: definition.relocationFee,
        canRelocate:
          grid.construction === undefined &&
          closedWeeks === 0 &&
          club.cash >= definition.relocationFee,
        relocationShortfall: Math.max(0, definition.relocationFee - club.cash),
        closeRefund: facilityCloseRefund(building),
        canClose: grid.construction?.buildingId !== building.id,
        activeAdjacencyIds: activeAdjacencyIdsForBuilding(
          grid.buildings,
          building,
          activeAdjacencies,
        ),
        status:
          closedWeeks > 0
            ? ('closed' as const)
            : project?.kind === 'BUILD'
              ? ('construction' as const)
              : project?.kind === 'UPGRADE'
                ? ('upgrading' as const)
                : ('operational' as const),
        ...(closedWeeks > 0
          ? { weeksRemaining: closedWeeks }
          : project === undefined
            ? {}
            : {
                weeksRemaining: project.weeksRemaining,
                targetLevel: project.targetLevel,
              }),
      };
    }),
    catalog: FACILITY_BUILD_MENU_ORDER.map((type) => FACILITY_CATALOG[type])
      .filter((definition) => definition.available)
      .map((definition) => {
        const placedCount = grid.buildings.filter(
          (building) => building.type === definition.type,
        ).length;
        const builtCount = grid.buildings.filter(
          (building) =>
            building.type === definition.type &&
            isFacilityOperational(grid, building.id),
        ).length;
        const buildLimit = facilityBuildLimit(definition.type);
        const buildLimitReached = placedCount >= buildLimit;
        const blockedByOpeningTrainingPitch =
          pitchMustBeFirst && definition.type !== 'training-pitch';
        return {
          type: definition.type,
          name: facilityName(t, definition.type),
          builtCount,
          buildLimit,
          buildCost: definition.buildCost,
          width: definition.footprint.width,
          height: definition.footprint.height,
          weeklyUpkeep: definition.weeklyUpkeep[0],
          effectLabel: facilityEffectLabel(definition.type, 1, t),
          available: definition.available,
          affordable:
            definition.available &&
            !buildLimitReached &&
            !blockedByOpeningTrainingPitch &&
            grid.construction === undefined &&
            club.cash >= definition.buildCost,
          blockedByOpeningTrainingPitch,
          affordabilityShortfall:
            definition.available && !buildLimitReached
              ? Math.max(0, definition.buildCost - club.cash)
              : 0,
          buildWeeks: definition.buildWeeks,
          ...(!definition.available
            ? { blockedReason: t('clubFinances.facilityLocked') }
            : grid.construction !== undefined
              ? { blockedReason: t('clubFinances.facilityCrewAssigned') }
              : buildLimitReached
                ? {
                    blockedReason:
                      buildLimit === 1
                        ? t('clubFinances.facilityAlreadyBuilt')
                        : t('clubFinances.facilityBuildLimitReached', {
                            built: builtCount,
                            limit: buildLimit,
                          }),
                  }
                : blockedByOpeningTrainingPitch
                  ? {
                      blockedReason: t(
                        OPENING_TRAINING_PITCH_BLOCKED_REASON_KEY,
                      ),
                    }
                  : club.cash < definition.buildCost
                    ? {
                        blockedReason: t(
                          'clubFinances.facilityInsufficientBalance',
                        ),
                      }
                    : {}),
        };
      }),
    weeklyUpkeep: weeklyFacilityUpkeep(grid),
    activeAdjacencies,
    discoveredAdjacencies: [...grid.discoveredAdjacencies],
    ...(grid.construction === undefined
      ? {}
      : {
          activeProject: {
            buildingId: grid.construction.buildingId,
            name: facilityName(t, grid.construction.type),
            benefitLabel: facilityEffectLabel(
              grid.construction.type,
              grid.construction.targetLevel,
              t,
            ),
            kind: grid.construction.kind,
            weeksRemaining: grid.construction.weeksRemaining,
            totalWeeks: grid.construction.totalWeeks,
            targetLevel: grid.construction.targetLevel,
          },
        }),
  };
}

/** Card order is a presentation choice; the simulation catalog keeps its own stable order. */
const FACILITY_BUILD_MENU_ORDER = [
  'training-pitch',
  'coaching-office',
  'fan-shop',
  'stadium-stand',
  'keeper-court',
  'medical-bay',
  'dorm',
  'scout-office',
  'gym',
  'youth-field',
  'tech-center',
  'shooting-range',
] as const satisfies readonly FacilityType[];

/** Every line states a real effect site in src/game — no facility says "nothing". */
function facilityEffectLabel(
  type: FacilityType,
  level: FacilityLevel,
  t: CopyFn,
): string {
  const trainingEffect = (attributes: string): string =>
    t('clubFinances.facilityTrainingEffect', {
      percent: TRAINING_BONUS_PERCENT[level],
      attributes,
    });
  if (type === 'training-pitch') {
    return t('clubFinances.facilityPitchEffect', {
      points: TRAINING_PITCH_TP_PER_LEVEL,
      percent: TRAINING_BONUS_PERCENT[level],
    });
  }
  if (type === 'gym') return trainingEffect('PAC + STA');
  if (type === 'tech-center') return trainingEffect('PAS + TEC');
  if (type === 'shooting-range') return trainingEffect('SHO');
  if (type === 'keeper-court') return trainingEffect('REF');
  if (type === 'medical-bay') {
    return t('clubFinances.facilityMedicalEffect', { n: level, count: level });
  }
  if (type === 'dorm') {
    return t('clubFinances.facilityDormEffect', {
      amount: level * DORM_CONDITION_RECOVERY_PER_LEVEL,
    });
  }
  if (type === 'scout-office') {
    const names = t('clubFinances.facilityScoutNames', { count: 2 + level });
    return level === 1
      ? t('clubFinances.facilityScoutBroad', { names })
      : level === 2
        ? t('clubFinances.facilityScoutTighter', { names })
        : t('clubFinances.facilityScoutPowers', { names });
  }
  if (type === 'coaching-office')
    return level === 1
      ? t('clubFinances.facilityCoachingOfficeEffect')
      : level === 2
        ? t('clubFinances.facilityCoachingOfficeHires')
        : t('clubFinances.facilityCoachingOfficeFast');
  if (type === 'youth-field') {
    return t('clubFinances.facilityYouthEffect', { amount: level * 5 });
  }
  if (type === 'fan-shop') return t('clubFinances.facilityShopEffect');
  if (type === 'stadium-stand')
    return t('clubFinances.facilityStandEffect', {
      percent: 100 + (level - 1) * 50,
    });
  throw new Error(`missing facility effect copy for ${type}`);
}

/** Mirrors FACILITY_TRAINING_MULTIPLIER in src/game/training.ts, as a percentage. */
const TRAINING_BONUS_PERCENT: Readonly<Record<FacilityLevel, number>> = {
  1: 10,
  2: 15,
  3: 20,
};

function facilityNextLevelEffectLabel(
  type: FacilityType,
  nextLevel: FacilityLevel,
  t: CopyFn,
): string | undefined {
  return facilityEffectLabel(type, nextLevel, t);
}

function activeAdjacencyIdsForBuilding(
  buildings: readonly PlacedFacility[],
  building: PlacedFacility,
  activeAdjacencies: readonly string[],
): string[] {
  const active = new Set(activeAdjacencies);
  return FACILITY_ADJACENCIES.filter(
    (adjacency) =>
      active.has(adjacency.id) &&
      (building.type === adjacency.first ||
        building.type === adjacency.second) &&
      buildings.some(
        (other) =>
          other.id !== building.id &&
          other.type ===
            (building.type === adjacency.first
              ? adjacency.second
              : adjacency.first) &&
          facilitiesShareEdge(building, other),
      ),
  ).map((adjacency) => adjacency.id);
}

function facilitiesShareEdge(
  first: PlacedFacility,
  second: PlacedFacility,
): boolean {
  const firstFootprint = FACILITY_CATALOG[first.type].footprint;
  const secondFootprint = FACILITY_CATALOG[second.type].footprint;
  const horizontalContact =
    first.x + firstFootprint.width === second.x ||
    second.x + secondFootprint.width === first.x;
  const verticalContact =
    first.y + firstFootprint.height === second.y ||
    second.y + secondFootprint.height === first.y;
  const verticalOverlap =
    first.y < second.y + secondFootprint.height &&
    second.y < first.y + firstFootprint.height;
  const horizontalOverlap =
    first.x < second.x + secondFootprint.width &&
    second.x < first.x + firstFootprint.width;
  return (
    (horizontalContact && verticalOverlap) ||
    (verticalContact && horizontalOverlap)
  );
}

/**
 * The card's stat block. Display values, matching the register: a keeper's
 * Reflexes reads ahead of the stored number so the halved Keeper Drills ladder
 * looks like the outfield one, and a story card that disagreed with the squad
 * screen would read as two different players.
 */
function storyPlayerAttributes(
  player: GameState['players'][number],
): readonly StoryEventPlayerAttributeViewModel[] {
  return (Object.keys(player.attrs) as Array<keyof typeof player.attrs>).map(
    (attribute) => ({
      label: attribute.toUpperCase(),
      value: displayedAttributeValue(player, attribute),
    }),
  );
}

export function storyEventViewModel(
  state: GameState,
  content: LaunchContent,
  t: CopyFn = englishCopy(),
): StoryEventViewModel {
  const pending = state.pendingEvent;
  if (pending === undefined) throw new Error('there is no pending story event');
  const event = content.events.events.find(
    (candidate) => candidate.id === pending.eventId,
  );
  if (event === undefined)
    throw new Error(`unknown story event ${pending.eventId}`);
  const targetPlayers = careerEventTargetPlayers(state, event);
  const selected = targetPlayers.find(
    (player) => player.id === pending.selectedPlayerId,
  );
  const starterIds =
    state.lineups.find((lineup) => lineup.clubId === state.userClubId)
      ?.playerIds ?? [];
  const requiresPlayer = event.trigger.requiresPlayer === true;
  const requiresCoach = event.trigger.requiresCoach === true;
  const requiresFacility = event.trigger.requiresFacility ?? [];
  const targetCandidates = careerEventTargetCandidates(state, event);

  /**
   * A coach card carries what the coach actually provides.
   *
   * The manager is being asked to gamble with a coach's output, and the screens
   * that show it are two taps away — so the numbers come to the card rather
   * than the manager going to find them.
   */
  const coachOption = (
    role: 'HEAD' | 'ASSISTANT',
  ): StoryEventCoachViewModel | undefined => {
    const coach =
      role === 'HEAD' ? state.market?.headCoach : state.market?.assistantCoach;
    if (coach === undefined) return undefined;
    // The same keys the staff screen uses, so the card cannot drift into
    // describing a coach differently from the screen that hired him.
    // `readableLabel` was the second prettifier — it answered in English
    // whatever the locale — and this card arrived after it was removed.
    const specialties = coach.specialties.map((specialty) =>
      coachSpecialtyName(t, specialty),
    );
    const trainingSpecialties = coach.specialties
      .filter((specialty) => specialty !== 'MOTIVATOR')
      .map((specialty) => coachSpecialtyName(t, specialty));
    const roleEffects = coachRoleEffectLabels(coach, role, t);
    const trainingBoost = cappedCoachBoost(coach.boosts, 'trainingPercent');
    const tpBoost = cappedCoachBoost(coach.boosts, 'weeklyTp');
    const earned = [
      trainingBoost === 0
        ? undefined
        : t('coachStaff.effectTraining', {
            stats: trainingSpecialties.join(', '),
            percent: `${trainingBoost > 0 ? '+' : ''}${trainingBoost}%`,
          }),
      tpBoost === 0
        ? undefined
        : t('coachStaff.effectTpWeekly', {
            points: `${tpBoost > 0 ? '+' : ''}${tpBoost}`,
          }),
      cappedCoachBoost(coach.boosts, 'motivatorHalfLevels') === 0
        ? undefined
        : t('storyEvent.rewardCoachMotivator', {
            amount: `${cappedCoachBoost(coach.boosts, 'motivatorHalfLevels') > 0 ? '+' : ''}${cappedCoachBoost(coach.boosts, 'motivatorHalfLevels')}`,
          }),
    ].filter((line): line is string => line !== undefined);
    return {
      role,
      roleLabel: t(
        role === 'HEAD' ? 'coachStaff.headCoach' : 'coachStaff.assistantCoach',
      ),
      name: coach.name,
      levelLabel: t('facilityCompletionCard.level', { level: coach.level }),
      specialtyLabels: specialties,
      trainingLine: roleEffects.slice(0, -1).join(' · '),
      trainingPointsLine: roleEffects[roleEffects.length - 1]!,
      ...(earned.length === 0 ? {} : { earnedLine: earned.join(' · ') }),
    };
  };
  const coachOptions = targetCandidates.coachRoles
    .map(coachOption)
    .filter(
      (option): option is StoryEventCoachViewModel => option !== undefined,
    );
  const selectedCoach =
    pending.selectedCoachRole === undefined
      ? undefined
      : coachOptions.find(
          (option) => option.role === pending.selectedCoachRole,
        );

  const grid = state.facilities.grid;
  const facilityOptions: StoryEventFacilityViewModel[] = (grid?.buildings ?? [])
    .filter((building) => targetCandidates.facilityIds.includes(building.id))
    .map((building) => ({
      buildingId: building.id,
      name: t(FACILITY_NAME_KEYS[building.type]),
      levelLabel: t('facilityCompletionCard.level', { level: building.level }),
      effectLabel: facilityEffectLabel(building.type, building.level, t),
      operationalStatus: t('storyEvent.facilityOperational'),
      ...(() => {
        const boosts = building.boosts;
        const earned = [
          boosts?.tpBonusPercent
            ? t('storyEvent.rewardFacilityTp', {
                amount: signedAmount(t, boosts.tpBonusPercent),
              })
            : undefined,
          boosts?.trainingBonusPercent
            ? t('storyEvent.rewardFacilityTraining', {
                amount: signedAmount(t, boosts.trainingBonusPercent),
              })
            : undefined,
          boosts?.recoveryBonus
            ? t('storyEvent.rewardFacilityRecovery', {
                amount: signedAmount(t, boosts.recoveryBonus),
              })
            : undefined,
          boosts?.incomeBonusPercent
            ? t('storyEvent.rewardFacilityIncome', {
                amount: signedAmount(t, boosts.incomeBonusPercent),
              })
            : undefined,
        ].filter((line): line is string => line !== undefined);
        return earned.length === 0 ? {} : { earnedLine: earned.join(' · ') };
      })(),
    }));
  const selectedFacility =
    pending.selectedFacilityId === undefined
      ? undefined
      : facilityOptions.find(
          (option) => option.buildingId === pending.selectedFacilityId,
        );
  // Starters first, then by rating: the manager is usually deciding about
  // someone who plays, and within that the number is what the choice turns on.
  const playerOptions = targetPlayers
    .filter((player) => targetCandidates.playerIds.includes(player.id))
    .slice()
    .sort(
      (left, right) =>
        Number(!starterIds.includes(left.id)) -
          Number(!starterIds.includes(right.id)) ||
        overall(right.role, right.attrs) - overall(left.role, left.attrs) ||
        compareIds(left.id, right.id),
    );
  const storyPlayer = (
    player: GameState['players'][number],
    withAttributes: boolean,
  ): StoryEventPlayerViewModel => ({
    id: player.id,
    name: player.name,
    role: player.role,
    overall: overall(player.role, player.attrs),
    detail:
      event.trigger.requiresPlayerSource === 'YOUTH_OFFERS'
        ? t('storyEvent.youthOffer')
        : event.trigger.requiresPlayerSource === 'TRANSFER_TARGETS' &&
            state.market !== undefined
          ? t('storyEvent.transferTarget', {
              amount: formatMoneyForCopy(
                t,
                careerBuyingTransferQuote(state, state.market, player.id).fee,
              ),
            })
          : player.injuryWeeks > 0
            ? t('storyEvent.playerInjured', {
                n: player.injuryWeeks,
                count: player.injuryWeeks,
              })
            : player.power !== undefined && player.licensed
              ? t('storyEvent.licensedHero', {
                  status: starterIds.includes(player.id)
                    ? t('storyEvent.startingXi')
                    : t('storyEvent.squadPlayer'),
                })
              : starterIds.includes(player.id)
                ? t('storyEvent.startingXi')
                : t('storyEvent.squadPlayer'),
    ...(player.power
      ? {
          powerName: powerDisplayName(content, player.power, t) ?? player.power,
        }
      : {}),
    ...(withAttributes ? { attributes: storyPlayerAttributes(player) } : {}),
  });
  const resolvedChoice =
    pending.resolvedChoiceId === undefined
      ? undefined
      : event.choices.find((choice) => choice.id === pending.resolvedChoiceId);
  const resolvedOutcome =
    pending.resolvedOutcomeIndex === undefined
      ? undefined
      : resolvedChoice?.outcomes[pending.resolvedOutcomeIndex];

  // The outcome's own key, which needs both ids. Undefined before a choice is
  // resolved, and `copyOrEnglish` falls back to the saved English then.
  const outcomeKey =
    resolvedChoice === undefined || resolvedOutcome === undefined
      ? undefined
      : `event.${event.id}.${resolvedChoice.id}.${resolvedOutcome.id}`;

  return {
    id: event.id,
    artKey: event.art,
    category: event.category,
    weekLabel: `S${state.season} · W${state.week}`,
    // Two independent tags, not an adjective phrase. Composed from keys rather
    // than from the content enums, which were rendered raw as "RARE MYSTERY" in
    // all six languages — invisible to every gate, because it had no key AND was
    // built from data values rather than a string literal.
    //
    // The separator is what makes ten words enough instead of twenty-one pairs:
    // "SELTEN · VEREIN" needs no agreement, where "seltener Verein" does. It is
    // also already the house separator (`D5 · District League`).
    categoryLabel: `${t(`storyEvent.rarity.${event.rarity}`)} · ${t(`storyEvent.category.${event.category}`)}`,
    title: copyOrEnglish(t, `event.${event.id}.title`, event.title),
    body: copyOrEnglish(t, `event.${event.id}.body`, event.body),
    ...(selected ? { selectedPlayer: storyPlayer(selected, true) } : {}),
    playerSelectionRequired: requiresPlayer,
    ...(pending.playerLocked === true ? { playerLocked: true as const } : {}),
    // Offered even when a player is already named: the manager may still change
    // their mind, and an unlocked card that cannot be re-opened is a dead end.
    playerChoices:
      requiresPlayer && pending.playerLocked !== true
        ? playerOptions.map((player) => storyPlayer(player, false))
        : [],
    ...(selectedCoach === undefined ? {} : { selectedCoach }),
    coachSelectionRequired: requiresCoach,
    ...(pending.coachLocked === true ? { coachLocked: true as const } : {}),
    coachChoices:
      requiresCoach && pending.coachLocked !== true ? coachOptions : [],
    ...(selectedFacility === undefined ? {} : { selectedFacility }),
    facilitySelectionRequired: requiresFacility.length > 0,
    ...(pending.facilityLocked === true
      ? { facilityLocked: true as const }
      : {}),
    facilityChoices:
      requiresFacility.length > 0 && pending.facilityLocked !== true
        ? facilityOptions
        : [],
    targetUnavailable:
      (requiresPlayer && targetCandidates.playerIds.length === 0) ||
      (requiresCoach && targetCandidates.coachRoles.length === 0) ||
      (requiresFacility.length > 0 &&
        targetCandidates.facilityIds.length === 0),
    choices: event.choices.map((choice) => {
      const disabledReason = eventChoiceUnavailableReason(state, choice, t);
      return {
        id: choice.id,
        label: copyOrEnglish(
          t,
          `event.${event.id}.${choice.id}.label`,
          choice.label,
        ),
        // The RISKY/SAFE stamp beside the label already names the tone, so this
        // line only has to say what each one pays.
        detail: choice.risky
          ? t('storyEvent.choiceRiskyDetail')
          : t('storyEvent.choiceSafeDetail'),
        consequenceHint: describeEventChoiceOutcome(choice, t, state),
        tone: choice.risky ? ('risky' as const) : ('safe' as const),
        disabled:
          pending.resolvedChoiceId !== undefined ||
          disabledReason !== undefined,
        ...(disabledReason === undefined ? {} : { disabledReason }),
      };
    }),
    ...(pending.resolvedChoiceId
      ? { resolvedChoiceId: pending.resolvedChoiceId }
      : {}),
    ...(pending.outcomeText
      ? {
          resolvedRisky: pending.resolvedRisky === true,
          resolvedSuccess: pending.resolvedSuccess === true,
          outcomeTitle:
            pending.resolvedRisky === true
              ? pending.resolvedSuccess === true
                ? resolvedOutcome?.successHeadline === undefined
                  ? t('storyEvent.outcomeRiskPaidOff')
                  : copyOrEnglish(
                      t,
                      `${outcomeKey}.headline`,
                      resolvedOutcome.successHeadline,
                    )
                : t('storyEvent.outcomeGambleMissed')
              : t('storyEvent.outcomeDecisionComplete'),
          // Written into the save in English by the pure ring; the key recovers the
          // player's language without the save having to hold seven copies.
          outcomeText: copyOrEnglish(
            t,
            outcomeKey === undefined ? undefined : `${outcomeKey}.text`,
            pending.outcomeText,
          ),
          outcomeRewards:
            resolvedOutcome === undefined
              ? []
              : eventRewardItems(
                  resolvedOutcome.effects,
                  t,
                  state,
                  pending.resolvedMoneyDelta,
                ),
          ...(pending.resolvedNextEventId === undefined
            ? {}
            : { outcomeHasFollowUp: true as const }),
        }
      : {}),
    ...(pending.resolvedRisky === true &&
    pending.resolvedSuccess === true &&
    resolvedOutcome !== undefined
      ? {
          successCutscene: {
            artKey: `${event.art}-success`,
            headline:
              resolvedOutcome.successHeadline === undefined
                ? copyOrEnglish(
                    t,
                    `event.${event.id}.title`,
                    event.title,
                  ).replace(/[!?]+$/, '')
                : copyOrEnglish(
                    t,
                    `${outcomeKey}.headline`,
                    resolvedOutcome.successHeadline,
                  ),
            rewards: eventRewardLabels(resolvedOutcome.effects, t, state),
            ...(pending.resolvedNextEventId === undefined
              ? {}
              : { hasFollowUp: true as const }),
          },
        }
      : {}),
  };
}

export function seasonEndViewModel(
  state: GameState,
  content: LaunchContent,
  selectedTerm: 1 | 2 | 3,
  t: CopyFn = englishCopy(),
): SeasonEndViewModel {
  if (state.phase !== 'season-end' && state.phase !== 'complete') {
    throw new Error('the season has not ended');
  }
  const standings = leagueStandings(state);
  const user = standings.find((row) => row.clubId === state.userClubId);
  if (user === undefined)
    throw new Error('the user club has no final standing');
  const sliceComplete = state.phase === 'complete';
  const division = careerDivision(state);
  const outcomeLabel = (
    user.position === 1 && division === 1
      ? ('CHAMPIONS' as const)
      : user.position <= 2 && division > 1
        ? ('PROMOTED' as const)
        : ('SAFE' as const)
  ) as SeasonEndViewModel['outcomeLabel'];
  const expiredPlayers = sliceComplete
    ? []
    : rosterForClub(state, state.userClubId)
        .filter(
          (player) =>
            player.contractSeasonsRemaining === 0 &&
            !willRetireAtSeasonTransition(player, state.season),
        )
        .sort((left, right) => left.id.localeCompare(right.id));
  const renewalTalks = state.market?.renewalTalks;
  const projectedHeroLimit = projectedSeasonEndContractPromiseHeroLimit(state);
  // Open renewal talks pin their own player; otherwise the queue presents its
  // id-ordered head. Pinning `expiredPlayers[0]` unconditionally could park the
  // negotiation panel under the wrong name and locked the queue behind a player
  // whose talks had collapsed for the season.
  const expiredPlayer =
    expiredPlayers.find((player) => player.id === renewalTalks?.playerId) ??
    expiredPlayers[0];
  // Zero would mean an announced player, and `expiredPlayers` already filters
  // those out through `willRetireAtSeasonTransition`.
  const renewalTermCap =
    expiredPlayer === undefined
      ? 3
      : maxRenewalTermSeasons(expiredPlayer, state.careerSeed);
  const renewalBlocked =
    expiredPlayer === undefined || state.market === undefined
      ? undefined
      : careerRenewalBlockedReasonCopy(state, state.market, expiredPlayer.id);
  const renewalBlockedReason =
    renewalBlocked === undefined
      ? undefined
      : resolveRingCopy(t, renewalBlocked);
  const prizeMoney =
    state.ledgers[state.ledgers.length - 1]?.lines
      .filter((line) => line.kind === 'prize')
      .reduce((sum, line) => sum + line.amount, 0) ?? 0;
  const promotedDivision =
    outcomeLabel === 'PROMOTED' ? ((division - 1) as 1 | 2 | 3 | 4) : undefined;
  const newlyUnlockedRewards =
    promotedDivision !== undefined &&
    promotedDivision < highestDivisionReached(state)
      ? promotionRewardsForDivision(
          promotedDivision,
          state.purchasedHeroLicenseCap ?? 0,
        )
      : [];
  const recap = latestSeasonRecap(state);
  // `topScorer` is deliberately absent. It is a club-only award that counts cup
  // goals, while the awards ceremony the manager has just watched crowns a
  // division-wide, league-only, forwards-only Golden Boot — so the two can name
  // different players truthfully. Showing both put a second Golden Boot on the
  // screen one tap after the ceremony handed out the first.
  const recapAwards =
    recap === undefined
      ? []
      : [recap.playerOfSeason, recap.youngPlayer, recap.heroOfSeason]
          .filter(
            (award): award is NonNullable<typeof award> => award !== undefined,
          )
          .flatMap((award) => {
            const player = state.players.find(
              (candidate) => candidate.id === award.playerId,
            );
            if (player === undefined) return [];
            const labelParams =
              award.labelKey === 'recap.award.heroOfSeason' && player.power
                ? {
                    ...award.labelParams,
                    power:
                      powerDisplayName(content, player.power, t) ??
                      player.power,
                  }
                : award.labelParams;
            return [
              {
                ...award,
                // The save keeps the English — `hall-of-fame.ts` parses a legacy
                // recap's `detail` for its goal count — so the screen translates it
                // here instead. `detail` has no key of its own; it is always the
                // label's key plus `.detail`.
                label: copyOrEnglish(
                  t,
                  award.labelKey,
                  award.label,
                  labelParams,
                ),
                detail: copyOrEnglish(
                  t,
                  award.labelKey === undefined
                    ? undefined
                    : `${award.labelKey}.detail`,
                  award.detail,
                  labelParams,
                ),
                role: player.role,
                ...(player.lookId === undefined
                  ? {}
                  : { lookId: player.lookId }),
              },
            ];
          });
  const memorableEvent =
    recap?.memorableEventId === undefined
      ? undefined
      : content.events.events.find(
          (event) => event.id === recap.memorableEventId,
        );
  const memorableEventTitle =
    memorableEvent === undefined
      ? recap !== undefined &&
        recap.won > 0 &&
        recap.drawn === 0 &&
        recap.lost === 0
        ? t('seasonEnd.perfectLeagueSeason')
        : recap?.finalPosition === 1
          ? t('seasonEnd.leagueTitle')
          : undefined
      : copyOrEnglish(
          t,
          `event.${memorableEvent.id}.title`,
          memorableEvent.title,
        );
  const objectiveResults = state.clubBusiness.sponsorship.activeContracts
    .filter(
      (contract) =>
        contract.season === state.season &&
        contract.objective !== undefined &&
        contract.objectiveOutcome?.settledSeason === state.season,
    )
    .sort(
      (left, right) =>
        left.slot - right.slot ||
        left.contractId.localeCompare(right.contractId),
    )
    .map((contract) => ({
      contractId: contract.contractId,
      // The brand stays English by decision; the target beside it does not.
      sponsorName: contract.sponsorName,
      objectiveLabel: sponsorObjectiveCopy(t, contract.objective!),
      met: contract.objectiveOutcome!.met,
      // This is deliberately the persisted settlement value. Recomputing from
      // nominal terms here could lie by a dollar after Chairman allocation.
      actualBonus: contract.objectiveOutcome!.actualBonus,
    }));
  const objectiveBonusTotal = objectiveResults.reduce(
    (sum, result) => sum + result.actualBonus,
    0,
  );
  const clubBusinessSettlement =
    objectiveResults.length === 0
      ? undefined
      : {
          objectiveResults,
          objectiveBonusTotal,
          actualPayoutTotal: objectiveBonusTotal,
        };

  return {
    seasonLabel: t('seasonEnd.seasonLabel', {
      season: state.season,
      division: divisionTierLabelWith(division, t),
    }),
    outcomeLabel,
    headline:
      outcomeLabel === 'CHAMPIONS'
        ? t('seasonEnd.headlineChampions')
        : outcomeLabel === 'PROMOTED'
          ? t('seasonEnd.headlinePromoted')
          : outcomeLabel === 'RELEGATED'
            ? t('seasonEnd.headlineRelegated')
            : t('seasonEnd.headlineSafe'),
    summary:
      outcomeLabel === 'PROMOTED'
        ? t('seasonEnd.summaryPromoted', {
            division: divisionTierLabelWith((division - 1) as 1 | 2 | 3 | 4, t),
          })
        : outcomeLabel === 'RELEGATED'
          ? t('seasonEnd.summaryRelegated', {
              division: divisionTierLabelWith(
                (division + 1) as 2 | 3 | 4 | 5,
                t,
              ),
            })
          : t('seasonEnd.summarySafe'),
    finalPosition: user.position,
    prizeMoney,
    difficultyLabel: state.difficulty ?? 'COZY',
    ...(recap === undefined
      ? {}
      : {
          recap: {
            // W/D/L are engine enum letters. The league table already carries
            // each locale's own — German reads S/U/N, not W/D/L.
            record: `${recap.won}${t('col.league.won')} · ${recap.drawn}${t(
              'col.league.drawn',
            )} · ${recap.lost}${t('col.league.lost')}`,
            goals: t('seasonEnd.recapGoals', {
              scored: recap.goalsFor,
              conceded: recap.goalsAgainst,
            }),
            cashChange: recap.cashChange,
            closingCash: recap.closingCash,
            trainingCapsReached: recap.trainingCapsReached,
            cupResult: copyOrEnglish(t, recap.cupResultKey, recap.cupResult),
            ...(memorableEventTitle === undefined
              ? {}
              : { memorableEventTitle }),
            awards: recapAwards,
          },
        }),
    table: standings.map((row) => ({
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
            divisionLabel: divisionTierLabelWith(promotedDivision, t),
            // The ring writes `titleKey`/`detailKey` beside the English and all
            // 24 `promotion.*` entries are translated in every locale — but
            // nothing resolved them, so the panel that celebrates a promotion
            // was English in all seven languages.
            //
            // Money is formatted here rather than passed raw: the templates read
            // "· {cost} each" with no currency symbol, so they expect a finished
            // amount, and `src/game` may not know what a dollar looks like.
            items: newlyUnlockedRewards.map((reward) => {
              const params =
                reward.params === undefined
                  ? undefined
                  : Object.fromEntries(
                      Object.entries(reward.params).map(([name, value]) => [
                        name,
                        (name === 'cost' || name === 'amount') &&
                        typeof value === 'number'
                          ? formatMoneyForCopy(t, value)
                          : value,
                      ]),
                    );
              return {
                ...reward,
                title: copyOrEnglish(t, reward.titleKey, reward.title, params),
                detail: copyOrEnglish(
                  t,
                  reward.detailKey,
                  reward.detail,
                  params,
                ),
              };
            }),
          },
        }),
    ...(clubBusinessSettlement === undefined ? {} : { clubBusinessSettlement }),
    ...(expiredPlayer
      ? {
          expiredContract: {
            playerId: expiredPlayer.id,
            playerName: expiredPlayer.name,
            role: expiredPlayer.role,
            lookId: expiredPlayer.lookId,
            powerName: powerDisplayName(content, expiredPlayer.power, t),
            currentWeeklyWage: expiredPlayer.weeklyWage,
            // The agent's real opening ask, not `renewalQuote`'s wage-times-four.
            // The old quote ignored growth, fame, loyalty and personality, so the
            // headline number the manager used to decide renew-versus-release
            // measured 13-24% low on ordinary squads and 61% low on a grown hero —
            // and then changed the instant they tapped "Meet the agent".
            quotedWeeklyWage:
              renewalTalks?.playerId === expiredPlayer.id
                ? renewalTalks.negotiation.weeklyAsk
                : careerRenewalWeeklyAsk(state, expiredPlayer),
            isHeroWageCliff:
              expiredPlayer.power !== undefined && !expiredPlayer.onHeroWage,
            // The card used to show a wage and nothing else, so the manager was
            // asked to renew a man without being told what he is. Same grid the
            // story-event card uses.
            overall: overall(expiredPlayer.role, expiredPlayer.attrs),
            age: expiredPlayer.age ?? 24,
            attributes: storyPlayerAttributes(expiredPlayer),
            termOptions: contractTermOptions(renewalTermCap),
            // Clamped rather than trusted: the term is held in the store across
            // players, so a 3 dialled in for one man must not survive onto the
            // veteran queued behind him.
            selectedTerm: Math.min(
              selectedTerm,
              Math.max(1, renewalTermCap),
            ) as 1 | 2 | 3,
            ...(renewalTermCap >= 3
              ? {}
              : {
                  shortTermReason: resolveRingCopy(
                    t,
                    shortContractReasonCopy(
                      expiredPlayer.age ?? 24,
                      renewalTermCap,
                    ),
                  ),
                }),
            // Replaces a hardcoded `decision: 'pending'` and
            // `requiresNegotiation: true`, which made the whole quick-renew branch
            // of the screen unreachable while leaving a permanently red PENDING chip
            // over it. Both renew actions now disable together with a reason, rather
            // than rendering enabled over an engine call that always throws.
            ...(renewalBlockedReason === undefined
              ? {}
              : { renewalBlockedReason }),
            remainingExpiredCount: expiredPlayers.length,
          },
        }
      : {}),
    ...(renewalTalks === undefined ||
    expiredPlayer === undefined ||
    renewalTalks.playerId !== expiredPlayer.id
      ? {}
      : {
          renewalNegotiation: marketNegotiationViewModel(
            {
              state: renewalTalks.negotiation,
              playerName: expiredPlayer.name,
              playerRole: expiredPlayer.role,
              lookId: expiredPlayer.lookId,
              openingWeeklyWage: renewalOpeningOfferWage(
                renewalTalks.negotiation.weeklyAsk,
                contractWageStep(renewalTalks.negotiation.weeklyAsk),
              ),
              maxTermSeasons: Math.max(1, renewalTermCap) as 1 | 2 | 3,
              playerAge: expiredPlayer.age ?? 24,
              contractPromiseContext: {
                state,
                player: expiredPlayer,
                heroLimit: projectedHeroLimit,
              },
            },
            t,
          ),
        }),
    sliceComplete,
    canContinue: sliceComplete || expiredPlayer === undefined,
  };
}

/** The one career week when an empty desk is worth one building reminder. */
const BUILD_REMINDER_WEEK = 7;

/**
 * The one-week "keep building" nudge. Its Week 7 gate is its read state: after
 * that week it retires whether or not the manager opened it.
 */
function buildReminderAlert(t: CopyFn): ClubAlertViewModel {
  return {
    id: 'build-reminder',
    title: t('clubHome.buildReminderTitle'),
    detail: t('clubHome.buildReminderDetail'),
    tone: 'info',
  };
}

/** Tapping this card opens the story screen; Advance Week opens it regardless. */
export const DESK_STORY_ALERT_ID = 'story-event';

/**
 * The week's story, waiting on the desk instead of ambushing the manager on
 * their way out of the week. Only quiet weeks are offered one, so this never
 * arrives on top of a full inbox.
 */
function deskStoryAlert(
  state: GameState,
  t: CopyFn = englishCopy(),
): ClubAlertViewModel | undefined {
  const pending = state.pendingEvent;
  if (pending === undefined || pending.resolvedChoiceId !== undefined)
    return undefined;
  const event = LAUNCH_CONTENT.events.events.find(
    (candidate) => candidate.id === pending.eventId,
  );
  if (event === undefined) return undefined;
  // Same rule as `deskTipNote`: the catalog owns the sentence, `events.json`
  // owns the English behind it.
  return {
    id: DESK_STORY_ALERT_ID,
    title: copyOrEnglish(t, `event.${event.id}.title`, event.title),
    detail: copyOrEnglish(t, `event.${event.id}.body`, event.body),
    tone: 'event',
    isStory: true,
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
function drillShopAlert(
  state: GameState,
  t: CopyFn,
): ClubAlertViewModel | undefined {
  // The copy promises a promotion opened the shop, so only say it once one has.
  // Pre-M2 saves have no division record at all and never see this.
  if ((state.m2?.highestDivisionReached ?? 5) >= 5) return undefined;
  if (TRAINING_PATHS.some((path) => ownedTrainingTier(state, path.pathId) > 1))
    return undefined;
  const affordable = TRAINING_PATHS.map((path) =>
    nextTrainingUpgradeOffer(state, path.pathId),
  ).filter((offer) => offer !== undefined && offer.blockedReason === undefined);
  const offer = affordable[0];
  if (offer === undefined) return undefined;
  return {
    id: `training-upgrade:tier-${offer.tier}`,
    title: t('clubHome.drillShopTitle', { tier: offer.tier }),
    detail: t('clubHome.drillShopDetail', {
      cost: formatMoneyForCopy(t, offer.cost),
      tier: offer.tier,
    }),
    tone: 'info',
  };
}

/**
 * A clear desk after the opening weeks reads as "nothing left to do", which is
 * exactly when a manager stops expanding the grid. The nudge only fires when
 * the works crew is free — asking for a build the player cannot start would be
 * an instruction that goes nowhere — and never crowds out a real inbox item.
 */
function isBuildReminderDue(
  state: GameState,
  alerts: readonly ClubAlertViewModel[],
): boolean {
  return (
    alerts.length === 0 &&
    state.season === 1 &&
    state.week === BUILD_REMINDER_WEEK &&
    state.facilities.grid?.construction === undefined
  );
}

/** Weeks of a season in which a squad's imminent retirements are called out. */
const RETIREMENT_FINAL_WEEKS = 3;

/** Live, uncapped product alerts before Bert's weekly desk scheduler. */
export function homeProductAlerts(
  state: GameState,
  t: CopyFn = englishCopy(),
): ClubAlertViewModel[] {
  const roster = rosterForClub(state, state.userClubId);
  const lowMoraleGiftPlayerId = lowMoraleGiftTutorialPlayerId(state);
  const lowMoraleGiftPlayer = roster.find(
    (player) => player.id === lowMoraleGiftPlayerId,
  );
  const expired = roster.filter(
    (player) => player.contractSeasonsRemaining === 0,
  );
  const injured = roster
    .filter((player) => player.injuryWeeks > 0)
    .sort(
      (left, right) =>
        right.injuryWeeks - left.injuryWeeks ||
        left.name.localeCompare(right.name),
    );
  const transferRequests = roster.filter(
    (player) => player.transferRequested === true,
  );
  const negativeCashWeeks =
    state.financialSafety?.consecutiveNegativeWeeks ?? 0;
  const emergencyLoanUsed = state.financialSafety?.emergencyLoanUsed === true;
  const loan = state.financialSafety?.loan;
  const financialWarningDismissed =
    isAssistantInboxProductDismissedForCurrentWeek(state, 'financial-warning');
  const emergencyLoanDismissed =
    isAssistantInboxProductDismissedForCurrentWeek(state, 'emergency-loan') ||
    isAssistantInboxProductPermanentlyDismissed(state, 'emergency-loan');
  const boardUltimatum = state.financialSafety?.boardUltimatum;
  const latestBoardResolution = state.financialSafety?.latestBoardResolution;
  const boardResolutionAlertId =
    latestBoardResolution === undefined
      ? undefined
      : `board-resolution:${latestBoardResolution.id}`;
  const showBoardResolution =
    boardResolutionAlertId !== undefined &&
    isAssistantInboxOneShotProductVisible(state, boardResolutionAlertId);
  const trainingGroundUnderConstruction =
    state.facilities.grid?.construction?.kind === 'BUILD' &&
    state.facilities.grid.construction.type === 'training-pitch';
  const waitingRequest = state.playerRequests?.pending;
  const sponsorChallengeOptions = sponsorWeeklyChallengeOptions(
    state.clubBusiness.sponsorship,
    state.fixtures,
    state.userClubId,
    state.season,
    state.week,
  );
  const sponsorChallenge = state.clubBusiness.sponsorship.weeklyChallenge;
  const heroIds = new Set(
    roster
      .filter((player) => player.power !== undefined)
      .map((player) => player.id),
  );
  const rosterIds = new Set(roster.map((player) => player.id));
  const retirementAnnouncements = (state.retirementAnnouncements ?? [])
    .filter(
      (announcement) =>
        announcement.announcedInSeason === state.season - 1 &&
        rosterIds.has(announcement.playerId),
    )
    .sort((left, right) => left.playerName.localeCompare(right.playerName));
  // The last-chance notice. The announcement is a whole season old by the time
  // the final matches arrive, so without this a farewell is something a manager
  // reads about afterwards rather than something he can turn up for.
  const finalWeeks =
    state.week > SEASON_WEEKS - RETIREMENT_FINAL_WEEKS
      ? roster
          .filter((player) =>
            willRetireAtSeasonTransition(player, state.season),
          )
          .sort((left, right) => left.name.localeCompare(right.name))
      : [];
  // Retired at the last transition, and nowhere else on the desk until now: a
  // player announced in season S plays S+1 and is gone by S+2, so the season
  // that has just started is the one that owes him a goodbye.
  const justRetired = (state.retiredPlayers ?? [])
    .filter(
      (player) =>
        player.clubId === state.userClubId &&
        player.retirementAnnouncementSeason === state.season - 2,
    )
    .sort((left, right) => left.name.localeCompare(right.name));
  const academyPromotions = roster
    .filter((player) => player.id.includes(`-academy-s${state.season}-`))
    .sort((left, right) => left.name.localeCompare(right.name));
  const academyPromotionAlertId = `academy-promotion:s${state.season}`;
  const showAcademyPromotions =
    academyPromotions.length > 0 &&
    isAssistantInboxOneShotProductVisible(state, academyPromotionAlertId);
  const retirementFarewellAlertId = `retirement-farewell:s${state.season}`;
  const showRetirementFarewell =
    justRetired.length > 0 &&
    isAssistantInboxOneShotProductVisible(state, retirementFarewellAlertId);
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
    ...(!emergencyLoanUsed &&
    negativeCashWeeks > 0 &&
    !financialWarningDismissed
      ? [
          {
            id: 'financial-warning',
            title: t('clubHome.financialWarningTitle'),
            detail: t('clubHome.financialWarningDetail', {
              n: negativeCashWeeks,
              count: negativeCashWeeks,
            }),
            tone: 'urgent' as const,
          },
        ]
      : []),
    // Kept even next to the warning above: the two carry different facts, what
    // is locked and what is owed. It is the one board row that does NOT hold an
    // urgent slot (see `assistantProductPriority`) — the accounts office now
    // carries the outstanding balance permanently, so this row announces the
    // debt rather than being the only place to read it.
    ...(loan !== undefined &&
    loan.remainingBalance > 0 &&
    !emergencyLoanDismissed
      ? [
          {
            id: 'emergency-loan',
            title: t('clubHome.emergencyLoanTitle'),
            detail:
              state.season >= loan.repaymentStartsSeason
                ? t('clubHome.emergencyLoanDetailRepaying', {
                    n: loan.remainingWeeks,
                    count: loan.remainingWeeks,
                    amount: formatMoneyForCopy(t, loan.remainingBalance),
                  })
                : t('clubHome.emergencyLoanDetailPending', {
                    amount: formatMoneyForCopy(t, loan.remainingBalance),
                    season: loan.repaymentStartsSeason,
                  }),
            tone: 'info' as const,
          },
        ]
      : []),
    ...(boardUltimatum === undefined
      ? []
      : [
          {
            id: 'board-ultimatum',
            title: t('clubHome.boardDeadlineTitle', {
              n: boardUltimatum.weeksRemaining,
              count: boardUltimatum.weeksRemaining,
            }),
            detail: t(
              boardUltimatumConsequence(boardUltimatum) ===
                'FACILITY_CONVERSION'
                ? 'clubHome.boardFacilityDeadlineDetail'
                : 'clubHome.boardDeadlineDetail',
              { target: boardTargetLabel(boardUltimatum.targetCash, t) },
            ),
            tone: 'urgent' as const,
          },
        ]),
    ...(!showBoardResolution || latestBoardResolution === undefined
      ? []
      : [
          {
            id: boardResolutionAlertId!,
            title:
              latestBoardResolution.kind === 'TARGET_MET'
                ? t('clubHome.boardTargetMetTitle')
                : latestBoardResolution.kind === 'FACILITY_CONVERSION'
                  ? t(
                      latestBoardResolution.addedFacilities.length === 0
                        ? 'clubHome.facilityPlanBlocked'
                        : 'clubHome.facilityPlanComplete',
                    )
                  : t('clubHome.boardSaleCompletedTitle'),
            detail:
              latestBoardResolution.kind === 'TARGET_MET'
                ? t('clubHome.boardTargetMetDetail')
                : latestBoardResolution.kind === 'FACILITY_CONVERSION'
                  ? boardFacilityConversionSummary(latestBoardResolution, t)
                  : t('clubHome.boardSaleCompletedDetail', {
                      player:
                        state.players.find(
                          (player) =>
                            player.id === latestBoardResolution.playerId,
                        )?.name ?? t('clubHome.aPlayer'),
                      club: clubName(state, latestBoardResolution.buyerClubId),
                      fee: formatMoneyForCopy(t, latestBoardResolution.fee),
                    }),
            tone:
              latestBoardResolution.kind === 'TARGET_MET'
                ? ('info' as const)
                : ('urgent' as const),
          },
        ]),
    ...(lowMoraleGiftPlayer === undefined
      ? []
      : [
          {
            id: LOW_MORALE_GIFT_TUTORIAL_ALERT_ID,
            title: t('playerGift.lowMoraleTutorial.inbox.title'),
            detail: t('playerGift.lowMoraleTutorial.inbox.detail', {
              player: lowMoraleGiftPlayer.name,
            }),
            tone: 'urgent' as const,
            destination: 'squad' as const,
            playerId: lowMoraleGiftPlayer.id,
          },
        ]),
    ...(sponsorChallengeOptions.length === 0
      ? []
      : [
          {
            id: `sponsor-sprint-offer-s${state.season}`,
            title: t('clubHome.sponsorSprintOfferTitle'),
            detail: t('clubHome.sponsorSprintOfferDetail', {
              week: sponsorChallengeOptions[0].fixtureWeek,
              amount: formatMoneyForCopy(
                t,
                Math.round(
                  (sponsorChallengeOptions[0].nominalBonus *
                    difficultyRules(state).sponsorIncomePercent) /
                    100,
                ),
              ),
            }),
            tone: 'event' as const,
            destination: 'club-finances' as const,
          },
        ]),
    ...(sponsorChallenge === undefined || sponsorChallenge.outcome !== undefined
      ? []
      : [
          {
            id: `sponsor-sprint-active-s${state.season}`,
            title: t('clubHome.sponsorSprintActiveTitle'),
            detail: t('clubHome.sponsorSprintActiveDetail', {
              target: sponsorWeeklyChallengeTargetCopy(
                t,
                sponsorChallenge.kind,
              ),
              week: sponsorChallenge.fixtureWeek,
            }),
            tone: 'event' as const,
            destination: 'club-finances' as const,
          },
        ]),
    // Stated in full, on purpose. A lapse charges exactly what a refusal
    // charges, so the manager has to have been told the number — otherwise
    // ignoring the tab is cheaper than deciding, which is the wrong lesson.
    ...(waitingRequest === undefined || state.playerRequestRules === undefined
      ? []
      : [
          {
            id: 'player-request-waiting',
            title: t('clubHome.stillWaitingTitle'),
            detail: (() => {
              const asker = roster.find(
                (player) => player.id === waitingRequest.playerId,
              );
              const cost = resolutionDeltas(
                'REFUSED',
                requestTarget(
                  requestDefinition(
                    state.playerRequestRules!,
                    waitingRequest.requestId,
                  ).cost,
                ),
                careerDifficulty(state),
              ).asker;
              return t('clubHome.stillWaitingDetail', {
                player: asker?.name ?? t('clubHome.aPlayer'),
                loyalty: Math.abs(cost.loyalty),
                morale: Math.abs(cost.morale),
              });
            })(),
            tone: 'urgent' as const,
            destination: 'squad' as const,
            ...(waitingRequest.playerId === undefined
              ? {}
              : { playerId: waitingRequest.playerId }),
          },
        ]),
    ...(!state.facilities.trainingGroundBuilt &&
    !trainingGroundUnderConstruction
      ? [
          {
            id: 'training-ground',
            title: t('clubHome.trainingPitchTitle'),
            detail: t('clubHome.trainingPitchDetail'),
            tone: 'info' as const,
          },
        ]
      : []),
    ...(!showAcademyPromotions
      ? []
      : [
          {
            id: academyPromotionAlertId,
            title: t('clubHome.newYouth'),
            detail: t('clubHome.academyPromotionDetail', {
              names: namesWithOverflow(
                academyPromotions.map((player) => player.name),
                t,
              ),
              n: academyPromotions.length,
              count: academyPromotions.length,
            }),
            tone: 'info' as const,
            readOnly: true as const,
          },
        ]),
    ...(expired.length > 0
      ? [
          {
            id: 'renewals',
            title: t('clubHome.contractsExpiredTitle', {
              n: expired.length,
              count: expired.length,
            }),
            detail: t('clubHome.contractsExpiredDetail'),
            tone: 'urgent' as const,
          },
        ]
      : []),
    // Retirement, in one row per beat rather than one row per player. Seven can
    // arrive in the same week, the desk shows three, and `retirementAnnouncements`
    // is overwritten at the next transition — so a row each meant four farewells
    // were lost for good, with nothing to say they had ever been made.
    ...(!showRetirementFarewell
      ? []
      : [
          {
            id: retirementFarewellAlertId,
            title:
              justRetired.length === 1
                ? t('clubHome.retiredOneTitle', { player: justRetired[0].name })
                : t('clubHome.retiredManyTitle', { count: justRetired.length }),
            detail:
              justRetired.length === 1
                ? t('clubHome.retiredOneDetail', {
                    names: namesWithOverflow(
                      justRetired.map((player) => player.name),
                      t,
                    ),
                    season: state.season - 1,
                  })
                : t('clubHome.retiredManyDetail', {
                    names: namesWithOverflow(
                      justRetired.map((player) => player.name),
                      t,
                    ),
                    season: state.season - 1,
                  }),
            tone: 'info' as const,
            readOnly: true as const,
            ...(justRetired.some((player) => player.power !== undefined)
              ? { isHero: true }
              : {}),
          },
        ]),
    ...(finalWeeks.length === 0
      ? []
      : [
          {
            id: `retirement-final-weeks-${state.season}`,
            title:
              finalWeeks.length === 1
                ? t('clubHome.finalMatchesOneTitle', {
                    player: finalWeeks[0].name,
                  })
                : t('clubHome.finalMatchesManyTitle', {
                    count: finalWeeks.length,
                  }),
            detail:
              finalWeeks.length === 1
                ? t('clubHome.finalMatchesOneDetail', {
                    names: namesWithOverflow(
                      finalWeeks.map((player) => player.name),
                      t,
                    ),
                    weeks: lowercaseWeekCountLabel(
                      SEASON_WEEKS - state.week + 1,
                      t,
                    ),
                  })
                : t('clubHome.finalMatchesManyDetail', {
                    names: namesWithOverflow(
                      finalWeeks.map((player) => player.name),
                      t,
                    ),
                    weeks: lowercaseWeekCountLabel(
                      SEASON_WEEKS - state.week + 1,
                      t,
                    ),
                  }),
            tone: 'info' as const,
            readOnly: true as const,
            ...(finalWeeks.some((player) => player.power !== undefined)
              ? { isHero: true }
              : {}),
          },
        ]),
    ...(retirementAnnouncements.length === 0
      ? []
      : [
          {
            id: `retirement-announcement-${state.season - 1}`,
            title:
              retirementAnnouncements.length === 1
                ? t('clubHome.retirementAnnouncedOneTitle', {
                    player: retirementAnnouncements[0].playerName,
                  })
                : t('clubHome.retirementAnnouncedManyTitle', {
                    count: retirementAnnouncements.length,
                  }),
            detail:
              retirementAnnouncements.length === 1
                ? t('clubHome.retirementAnnouncedOneDetail', {
                    age: retirementAnnouncements[0].retirementAge,
                    season: state.season,
                  })
                : t('clubHome.retirementAnnouncedManyDetail', {
                    names: namesWithOverflow(
                      retirementAnnouncements.map(
                        (announcement) => announcement.playerName,
                      ),
                      t,
                    ),
                    season: state.season,
                  }),
            tone: 'info' as const,
            ...(retirementAnnouncements.some((announcement) =>
              heroIds.has(announcement.playerId),
            )
              ? { isHero: true }
              : {}),
          },
        ]),
    // The earliest retirement signal there is: a full season ahead of the
    // announcement above, which itself lands on the final season. One-shot, so
    // it appears the week it is discovered and then leaves the three desk slots
    // to injuries and board deadlines; the player card carries it from then on.
    ...roster
      .filter((player) => isConsideringRetirement(player, state.careerSeed))
      .map((player) => ({
        id: `retirement-considering-${state.season}-${player.id}`,
        title: t('clubHome.consideringRetirementTitle', {
          player: player.name,
        }),
        detail: t('clubHome.consideringRetirementDetail', {
          age: player.age ?? 24,
        }),
        tone: 'info' as const,
        readOnly: true as const,
      })),
    ...injured.map((player) => ({
      id: `injury-${player.id}`,
      title: `${player.name} · OUT`,
      detail: t('clubHome.injuredDetail', {
        weeks: weekCountLabel(player.injuryWeeks, t),
      }),
      tone: 'urgent' as const,
    })),
    ...transferRequests.map((player) => ({
      id: `transfer-request-${player.id}`,
      title: t('clubHome.wantsToLeaveTitle', { player: player.name }),
      detail: t('clubHome.wantsToLeaveDetail'),
      tone: 'urgent' as const,
    })),
  ];
}

export interface BoardFinanceBriefingViewModel {
  readonly title: string;
  /** One speech bubble per entry, read by tapping through them in order. */
  readonly body: readonly string[];
}

/**
 * The board's money message, said in full.
 *
 * The desk row clips its detail to two lines, so the warning above and the loan
 * notice were both readable only as far as the ellipsis — the manager was being
 * told his club was in danger and could not find out what that meant. This is
 * the same message with room to finish its sentences, delivered on the finances
 * screen the row already opens.
 *
 * It is deliberately rebuilt on every tap rather than shown once per career:
 * both rows return every week the money stays bad, and the numbers they quote
 * change underneath them. Kept beside `homeProductAlerts` because the row and
 * the briefing are one message in two lengths, and a week count that disagreed
 * between them would read as a second problem.
 */
export function boardFinanceBriefing(
  state: GameState,
  alertId: string,
  t: CopyFn = englishCopy(),
): BoardFinanceBriefingViewModel | undefined {
  const safety = state.financialSafety;
  if (alertId === 'financial-warning') {
    const weeks = safety?.consecutiveNegativeWeeks ?? 0;
    if (weeks === 0) return undefined;
    const cash = requireUserClub(state).cash;
    // What the board actually does next, which is not the same thing twice: the
    // rescue fires once, and the club that has spent it gets an ultimatum and a
    // sale instead. Promising the wrong one is worse than promising nothing.
    const graceWeeks =
      difficultyRules(state).negativeWeeksBeforeIntervention - weeks;
    const consequence =
      safety?.emergencyLoanUsed === true
        ? safety.facilityConversionUsed === true
          ? t('clubHome.briefingConsequenceSells')
          : t('clubHome.briefingConsequenceConverts')
        : t('clubHome.briefingConsequenceLoan');
    return {
      title: t('clubHome.financialWarningTitle'),
      body: [
        t('clubHome.briefingWeeksInTheRed', {
          n: weeks,
          count: weeks,
          amount: formatMoneyForCopy(t, cash),
        }),
        safety?.emergencyLoanUsed !== true
          ? t('clubHome.briefingLoanNextWeek')
          : graceWeeks > 0
            ? t('clubHome.briefingLockedWithGrace', {
                n: graceWeeks,
                count: graceWeeks,
                consequence,
              })
            : t('clubHome.briefingLockedOutOfPatience'),
        t('clubHome.briefingBuildAdvice'),
      ],
    };
  }
  if (alertId === 'emergency-loan') {
    const loan = safety?.loan;
    if (loan === undefined || loan.remainingBalance <= 0) return undefined;
    const repaying = state.season >= loan.repaymentStartsSeason;
    const activeProject = state.facilities.grid?.construction;
    const commercialAction =
      activeProject === undefined
        ? t('clubHome.briefingBuildAnother')
        : t('clubHome.briefingCrewBusy', {
            facility: facilityName(t, activeProject.type),
          });
    return {
      title: t('clubHome.emergencyLoanTitle'),
      body: [
        t('clubHome.briefingLoanLanded', {
          amount: formatMoneyForCopy(t, loan.remainingBalance),
        }),
        repaying
          ? t('clubHome.briefingLoanRepaying', {
              n: loan.remainingWeeks,
              count: loan.remainingWeeks,
            })
          : t('clubHome.briefingLoanPending', {
              season: loan.repaymentStartsSeason,
            }),
        t('clubHome.briefingCommercialAdvice', { action: commercialAction }),
      ],
    };
  }
  return undefined;
}

export interface BoardFacilityConversionBriefingViewModel {
  readonly title: string;
  readonly body: readonly string[];
}

/**
 * Bert's handoff from the one facility round to the final player-sale round.
 * The first line is exact saved truth; the second explains why four home-match
 * weeks remain before the board touches the squad.
 */
export function boardFacilityConversionBriefing(
  state: GameState,
  t: CopyFn = englishCopy(),
): BoardFacilityConversionBriefingViewModel | undefined {
  const resolution = state.financialSafety?.latestBoardResolution;
  const ultimatum = state.financialSafety?.boardUltimatum;
  if (
    resolution?.kind !== 'FACILITY_CONVERSION' ||
    ultimatum === undefined ||
    boardUltimatumConsequence(ultimatum) !== 'FORCED_SALE'
  ) {
    return undefined;
  }
  return {
    title:
      resolution.addedFacilities.length === 0
        ? t('clubHome.facilityPlanBlocked')
        : t('clubHome.facilityPlanComplete'),
    body: [
      boardFacilityConversionSummary(resolution, t),
      t('clubHome.facilityPlanPlayerSaleNext', {
        n: ultimatum.weeksRemaining,
        count: ultimatum.weeksRemaining,
      }),
    ],
  };
}

function boardFacilityConversionSummary(
  resolution: Extract<
    NonNullable<GameState['financialSafety']>['latestBoardResolution'],
    { kind: 'FACILITY_CONVERSION' }
  >,
  t: CopyFn,
): string {
  if (resolution.addedFacilities.length === 0) {
    if (resolution.failureReason === 'COMMERCIAL_LIMITS_REACHED') {
      return t('clubHome.facilityPlanLimitsReached');
    }
    if (resolution.failureReason === 'NO_REPLACEABLE_BUILDING') {
      return t('clubHome.facilityPlanNoReplaceableBuilding');
    }
    return t('clubHome.facilityPlanNoSpace');
  }
  const first = resolution.addedFacilities[0];
  const added =
    first.type === 'stadium-stand'
      ? t('clubHome.boardAddedStadiumStand')
      : t('clubHome.boardAddedFanShops', {
          n: resolution.addedFacilities.length,
          count: resolution.addedFacilities.length,
        });
  return resolution.removedFacilityType === undefined
    ? t('clubHome.facilityPlanAdded', { added })
    : t('clubHome.facilityPlanReplaced', {
        removed: facilityName(t, resolution.removedFacilityType),
        added,
      });
}

/**
 * A name list that fits one desk row, with the remainder counted rather than
 * dropped. Alert details render on two lines, so seven names do not fit.
 */
function namesWithOverflow(
  names: readonly string[],
  t: CopyFn,
  shown = 3,
): string {
  if (names.length <= shown) {
    return names.length <= 1
      ? (names[0] ?? '')
      : t('viewModels.namesAnd', {
          names: names.slice(0, -1).join(', '),
          last: names[names.length - 1],
        });
  }
  return t('viewModels.namesAndMore', {
    names: names.slice(0, shown).join(', '),
    count: names.length - shown,
  });
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
function boardTargetLabel(targetCash: number, t: CopyFn): string {
  return targetCash <= 0
    ? t('clubHome.boardTargetPositiveBalance')
    : t('clubHome.boardTargetCash', {
        amount: formatMoneyForCopy(t, targetCash),
      });
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
  return (
    plan.productAlertIds.length === 0 && plan.guideSequenceIds.length === 0
  );
}

/**
 * Settles whether this management week gets a story, once.
 *
 * This runs when the career arrives at a manage week rather than when the player
 * leaves one, because a match week reaches its desk through the match rather
 * than through Advance Week — deciding on the way out would skip every week with
 * a fixture, which is most of them. The week stamp makes repeat calls free unless
 * an achievement was earned after that desk was settled.
 */
export function settleWeeklyStory(state: GameState): GameState {
  if (state.phase !== 'manage' || state.pendingEvent !== undefined)
    return state;
  if (state.onboarding !== undefined && state.onboarding.stage !== 'complete')
    return state;
  const hasQueuedAchievement = (state.pendingMilestones ?? []).some((entry) =>
    LAUNCH_CONTENT.events.events.some((event) => event.id === entry.eventId),
  );
  if (
    state.eventClock.storySettledSeason === state.season &&
    state.eventClock.storySettledWeek === state.week &&
    !hasQueuedAchievement
  ) {
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
  if (offer.eventId === undefined) return settled;
  /**
   * A recognition beat about a person names that person.
   *
   * The hat-trick card carries the actual scorer, banked at settlement, and it
   * has no picker — so the id has to travel with the offer. Without it the card
   * would be a `requiresPlayer` story with an empty target, and the manager
   * could point it at somebody who did not score.
   */
  const queued = (settled.pendingMilestones ?? []).find(
    (entry) => entry.eventId === offer.eventId,
  );
  return reconcilePendingCareerEvent(
    offerCareerEvent(
      settled,
      offer.eventId,
      queued?.selectedPlayerId === undefined
        ? undefined
        : { playerId: queued.selectedPlayerId },
    ),
    LAUNCH_CONTENT.events,
  );
}

/** Roughly a third of eligible weeks, so the unscheduled tips stay finds rather than lectures. */
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
  if (state.onboarding !== undefined && state.onboarding.stage !== 'complete')
    return state;
  if (state.pendingEvent !== undefined || !isHomeDeskClear(state)) return state;

  const blank: GameState = {
    ...state,
    deskTip: { season: state.season, week: state.week },
  };
  const unseen = unseenDeskTipIds(
    state,
    LAUNCH_CONTENT.tips.tips
      .filter((tip) => isDeskTipEligible(state, tip.id))
      .map((tip) => tip.id),
  );
  if (unseen.length === 0) return blank;
  if (deskTipRoll(state, '__desk_tip_chance__', 100) >= DESK_TIP_CHANCE_PERCENT)
    return blank;

  const tipId = unseen[deskTipRoll(state, '__desk_tip_pick__', unseen.length)];
  return markDeskTipSeen(
    { ...state, deskTip: { season: state.season, week: state.week, tipId } },
    tipId,
  );
}

function deskTipRoll(
  state: GameState,
  nonce: string,
  upperExclusive: number,
): number {
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
function deskTipNote(
  state: GameState,
  t: CopyFn = englishCopy(),
): ManagerNoteViewModel | undefined {
  const tipId = currentDeskTipId(state);
  if (tipId === undefined) return undefined;
  // Old saves can already hold a tip selected before eligibility was added.
  // Do not keep presenting advice for a shop the club cannot use yet.
  if (!isDeskTipEligible(state, tipId)) return undefined;
  const tip = LAUNCH_CONTENT.tips.tips.find(
    (candidate) => candidate.id === tipId,
  );
  if (tip === undefined) return undefined;
  // `contentStrings` flattens every tip into `tip.<id>.title` / `.body`, so the
  // English in `tips.json` is the fallback rather than the value.
  return {
    id: `tip:${tip.id}`,
    kind: 'tip',
    title: copyOrEnglish(t, `tip.${tip.id}.title`, tip.title),
    detail: copyOrEnglish(t, `tip.${tip.id}.body`, tip.body),
    ...(tip.destination === undefined ? {} : { destination: tip.destination }),
  };
}

/** A rule should enter the random tip pool only when it can help right now. */
function isDeskTipEligible(state: GameState, tipId: string): boolean {
  if (tipId === 'drill-tiers-are-permanent') {
    return highestDivisionReached(state) <= 4;
  }
  return true;
}

function homeAssistantInboxPlan(state: GameState) {
  state = reconcileLowMoraleGiftTutorialTarget(
    reconcileSatisfiedAssistantGuideSequences(state),
  );
  const productAlerts = homeProductAlerts(state);
  const dueGuides = dueAssistantInboxGuideSequences(state);
  return scheduleAssistantInboxWeek(state, {
    dueGuideSequenceIds: standaloneInboxGuides(dueGuides, productAlerts),
    heldGuideSequenceIds: quietDeskInboxGuides(state, productAlerts),
    productAlerts: productAlerts.map((alert) => ({
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
  if (
    state.facilities.grid?.construction === undefined &&
    productAlerts.length === 0
  )
    return [];
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
  if (
    dueGuides.includes('retirement') &&
    alert.id.startsWith('retirement-announcement-')
  ) {
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
  return (
    alertId === 'financial-warning' ||
    alertId === 'board-ultimatum' ||
    alertId.startsWith('board-resolution:')
  );
}

/** Exported for `retirement-visibility.test.ts`; nothing else outside reads it. */
export function isOneShotProductAlert(alertId: string): boolean {
  return (
    alertId.startsWith('board-resolution:') ||
    alertId.startsWith('training-cap:') ||
    alertId.startsWith('academy-promotion:') ||
    alertId.startsWith('retirement-farewell:') ||
    // A heads-up, not a standing fact: once seen, the player card carries it.
    alertId.startsWith('retirement-considering-')
  );
}

function standaloneInboxGuides(
  dueGuides: readonly AssistantInboxGuideSequenceId[],
  productAlerts: readonly ClubAlertViewModel[],
): AssistantInboxGuideSequenceId[] {
  const trainingGroundCarriesFacilityGuide =
    productAlerts.some((alert) => alert.id === 'training-ground') &&
    dueGuides.includes('facility-placement');
  return dueGuides.filter(
    (sequenceId) =>
      sequenceId !== 'board-ultimatum' &&
      sequenceId !== 'board-protection' &&
      sequenceId !== 'retirement' &&
      sequenceId !== 'first-injury' &&
      sequenceId !== 'first-emergency-loan' &&
      sequenceId !== 'first-transfer-request' &&
      (!trainingGroundCarriesFacilityGuide ||
        sequenceId !== 'facility-placement'),
  );
}

/**
 * The rows this week cannot end without.
 *
 * A blue job holds Advance Week shut until its own row is opened, so the desk
 * must always be able to present one. Named per row rather than per job,
 * because the opening build job rides the Training Pitch product card while
 * every other job carries a guide of its own.
 */
function requiredInboxRowIds(
  dueGuides: readonly AssistantInboxGuideSequenceId[],
  productAlerts: readonly ClubAlertViewModel[],
  mustDoDuties: ReadonlySet<OpeningInboxDutyId>,
): string[] {
  const required = dueGuides.filter((sequenceId) => {
    const duty = openingInboxDutyForGuideSequence(sequenceId);
    return duty !== undefined && mustDoDuties.has(duty);
  }) as string[];
  if (
    mustDoDuties.has('facility-placement') &&
    productAlerts.some((alert) => alert.id === 'training-ground')
  ) {
    required.push('training-ground');
  }
  return required;
}

export function homeViewModel(
  state: GameState,
  t: CopyFn = englishCopy(),
): HomeViewModel {
  const userClub = requireUserClub(state);
  const roster = rosterForClub(state, state.userClubId);
  // The engine owns the definition of a playable game week, including Global
  // Cup ties and league-first double headers. Do not infer it from the oldest
  // scheduled league fixture: migrated saves can retain an overdue fixture,
  // which used to make every later desk claim "This week."
  const currentMatchday = activeCareerMatchday(state);
  const nextLeagueFixture = state.fixtures
    .filter(
      (fixture) =>
        fixture.status === 'scheduled' &&
        fixture.season === state.season &&
        fixture.week >= state.week &&
        (fixture.homeClubId === state.userClubId ||
          fixture.awayClubId === state.userClubId),
    )
    .sort(
      (left, right) => left.week - right.week || left.round - right.round,
    )[0];
  const nextFixture = currentMatchday?.fixture ?? nextLeagueFixture;
  const nextFixtureCompetition =
    currentMatchday?.kind === 'national-cup'
      ? t('clubHome.heroCupRound', {
          round:
            currentMatchday.cupRoundLabel === undefined
              ? t('clubHome.knockoutTie')
              : cupRoundNameWith(currentMatchday.cupRoundLabel, t),
        })
      : undefined;
  const isCurrentGameWeek = currentMatchday !== undefined;
  const isSeasonFinale =
    currentMatchday !== undefined &&
    isSeasonFinaleLeagueWeek(state, currentMatchday.kind);
  const boardUltimatum = state.financialSafety?.boardUltimatum;
  const rosterById = new Map(roster.map((player) => [player.id, player]));
  const latestBoardResolution = state.financialSafety?.latestBoardResolution;
  const showBoardResolution =
    latestBoardResolution !== undefined &&
    isAssistantInboxOneShotProductVisible(
      state,
      `board-resolution:${latestBoardResolution.id}`,
    );
  const assistantState = reconcileLowMoraleGiftTutorialTarget(
    reconcileSatisfiedAssistantGuideSequences(state),
  );
  const careerTeaches = assistantTeaches(assistantState);
  const productAlerts = homeProductAlerts(assistantState, t);
  const dueGuides = dueAssistantInboxGuideSequences(assistantState);
  const mustDoDuties = new Set(outstandingInboxDuties(assistantState));
  const inboxPlan = scheduleAssistantInboxWeek(assistantState, {
    dueGuideSequenceIds: standaloneInboxGuides(dueGuides, productAlerts),
    heldGuideSequenceIds: quietDeskInboxGuides(assistantState, productAlerts),
    productAlerts: productAlerts.map((alert) => ({
      id: alert.id,
      priority: assistantProductPriority(alert, dueGuides),
      oneShot: isOneShotProductAlert(alert.id),
    })),
    requiredIds: requiredInboxRowIds(dueGuides, productAlerts, mustDoDuties),
  });
  const selectedProductIds = new Set(inboxPlan.productAlertIds);
  const boardGuide = dueGuides.find(
    (sequenceId) =>
      sequenceId === 'board-ultimatum' || sequenceId === 'board-protection',
  );
  let retirementGuideAssigned = false;
  let injuryGuideAssigned = false;
  let loanGuideAssigned = false;
  let transferRequestGuideAssigned = false;
  let facilityGuideAssigned = false;
  const selectedProducts = productAlerts
    .filter((alert) => selectedProductIds.has(alert.id))
    .map((alert) => {
      // Product news survives Advisor mode; only Bert's route attached to it
      // disappears. This also prevents a stale queued guide opening silently.
      if (!careerTeaches) return alert;
      const guideSequenceId =
        alert.id === 'board-ultimatum'
          ? boardGuide
          : !facilityGuideAssigned &&
              dueGuides.includes('facility-placement') &&
              alert.id === 'training-ground'
            ? ('facility-placement' as const)
            : !injuryGuideAssigned &&
                dueGuides.includes('first-injury') &&
                alert.id.startsWith('injury-')
              ? ('first-injury' as const)
              : !loanGuideAssigned &&
                  dueGuides.includes('first-emergency-loan') &&
                  alert.id === 'emergency-loan'
                ? ('first-emergency-loan' as const)
                : !transferRequestGuideAssigned &&
                    dueGuides.includes('first-transfer-request') &&
                    alert.id.startsWith('transfer-request-')
                  ? ('first-transfer-request' as const)
                  : !retirementGuideAssigned &&
                      dueGuides.includes('retirement') &&
                      alert.id.startsWith('retirement-announcement-')
                    ? ('retirement' as const)
                    : undefined;
      if (guideSequenceId === undefined) return alert;
      if (guideSequenceId === 'retirement') retirementGuideAssigned = true;
      if (guideSequenceId === 'first-injury') injuryGuideAssigned = true;
      if (guideSequenceId === 'first-emergency-loan') loanGuideAssigned = true;
      if (guideSequenceId === 'first-transfer-request')
        transferRequestGuideAssigned = true;
      if (guideSequenceId === 'facility-placement')
        facilityGuideAssigned = true;
      const sequence = ASSISTANT_GUIDE_CONTENT.sequences.find(
        (candidate) => candidate.id === guideSequenceId,
      );
      if (sequence?.destination === undefined)
        throw new Error(
          `assistant guide ${guideSequenceId} is missing routing`,
        );
      return {
        ...alert,
        guideSequenceId,
        destination: sequence.destination,
        ...(alert.id === 'training-ground' &&
        mustDoDuties.has('facility-placement')
          ? { mustDoDutyId: 'facility-placement' as const }
          : {}),
      };
    });
  const guideAlerts: ClubAlertViewModel[] = (
    careerTeaches ? inboxPlan.guideSequenceIds : []
  ).map((sequenceId) => {
    const sequence = ASSISTANT_GUIDE_CONTENT.sequences.find(
      (candidate) => candidate.id === sequenceId,
    );
    if (sequence?.inbox === undefined || sequence.destination === undefined) {
      throw new Error(`assistant guide ${sequenceId} is missing inbox routing`);
    }
    const mustDoDutyId = openingInboxDutyForGuideSequence(sequenceId);
    return {
      id: `assistant-guide:${sequenceId}`,
      // Resolved here rather than in the row, because a PRODUCT alert also
      // carries a `guideSequenceId` while keeping its own title — a screen that
      // keyed off the id alone would relabel those rows with Bert's inbox copy.
      title: copyOrEnglish(
        t,
        `bert.guide.${sequenceId}.inbox.title`,
        sequence.inbox.title,
      ),
      detail: copyOrEnglish(
        t,
        `bert.guide.${sequenceId}.inbox.detail`,
        sequence.inbox.detail,
      ),
      tone:
        sequenceId === 'board-ultimatum' || sequenceId === 'board-protection'
          ? 'urgent'
          : 'event',
      guideSequenceId: sequenceId,
      destination: sequence.destination,
      ...(mustDoDutyId !== undefined && mustDoDuties.has(mustDoDutyId)
        ? { mustDoDutyId }
        : {}),
    };
  });
  // Ordered by the priority that bought each row its slot, not by how the row
  // looks — the distinction `assistantProductPriority` exists to make. Sorting
  // on `tone` put the Training Pitch second for the whole opening week: the row
  // holds an urgent slot but is deliberately written calmly, so the one row the
  // tutorial cue points at ranked below Bert's coach explainer, with the cue
  // itself sitting over the explainer's card.
  const productPriority = (alert: ClubAlertViewModel) =>
    assistantProductPriority(alert, dueGuides);
  const scheduledCandidates = [
    ...selectedProducts.filter((alert) => productPriority(alert) === 'urgent'),
    ...guideAlerts,
    ...selectedProducts.filter((alert) => productPriority(alert) !== 'urgent'),
  ];
  // Blue jobs first, and the cap stretches to hold all of them: the scheduler
  // has already reserved each one a place, and trimming one back off here would
  // put the week's only way forward behind a row that is merely news.
  const scheduledMustDo = scheduledCandidates.filter(
    (alert) => alert.mustDoDutyId !== undefined,
  );
  const scheduledAlerts = [
    ...scheduledMustDo,
    ...scheduledCandidates.filter((alert) => alert.mustDoDutyId === undefined),
  ].slice(0, Math.max(3, scheduledMustDo.length));
  // A quiet week's own contents, in the order they earn attention: the story
  // that landed this week, the shop the club has not found yet, and only if
  // neither applies, the one-week build nudge.
  const tipNote = deskTipNote(state, t);
  const homeNotes =
    tipNote === undefined
      ? managerNotes(state, t)
      : [...managerNotes(state, t), tipNote];
  const storyAlert = deskStoryAlert(state, t);
  const quietWeekAlerts =
    scheduledAlerts.length > 0
      ? []
      : [storyAlert, drillShopAlert(state, t)].filter(
          (alert): alert is ClubAlertViewModel => alert !== undefined,
        );
  const alerts =
    quietWeekAlerts.length > 0
      ? quietWeekAlerts
      : storyAlert !== undefined
        ? [storyAlert, ...scheduledAlerts]
        : isBuildReminderDue(state, scheduledAlerts)
          ? [buildReminderAlert(t)]
          : scheduledAlerts;

  const standings = leagueStandings(state).map((row) => ({
    position: row.position,
    clubName: clubName(state, row.clubId),
    played: row.played,
    goalDifference: row.goalDifference,
    points: row.points,
  }));
  const userPosition = standings.findIndex(
    (row) => row.clubName === userClub.name,
  );
  const tableStart = Math.max(
    0,
    Math.min(userPosition - 2, standings.length - 5),
  );

  return {
    clubName: userClub.name,
    managerName: t('clubHome.managerTitle'),
    seasonLabel: t('clubHome.seasonLabel', {
      season: state.season,
      division: divisionTierLabelWith(careerDivision(state), t),
    }),
    divisionLabel: divisionTierLabelWith(careerDivision(state), t),
    weekLabel: t('clubHome.weekLabel', { week: state.week }),
    nextMatchTimingLabel:
      nextFixture === undefined
        ? state.phase === 'complete'
          ? t('clubHome.complete')
          : t('clubHome.seasonEnd')
        : isCurrentGameWeek
          ? isSeasonFinale
            ? t('clubHome.finalGame')
            : t('clubHome.thisWeek')
          : t('clubHome.nextMatchInWeeks', {
              n: nextFixture.week - state.week,
              count: nextFixture.week - state.week,
            }),
    isCurrentGameWeek,
    form: recentForm(state),
    resources: {
      money: userClub.cash,
      trainingPoints: state.trainingPoints,
      fans: userClub.fans,
    },
    nextFixture:
      nextFixture === undefined
        ? {
            id: 'season-complete',
            weekLabel:
              state.phase === 'complete'
                ? t('clubHome.complete')
                : t('clubHome.seasonEnd'),
            competition: careerDivisionLabel(state, t),
            homeTeam: userClub.name,
            awayTeam: t('seasonEnd.seasonReview'),
            venueLabel: t('clubHome.venueBoardroom'),
            opponentHeroCount: 0,
            opponentHeroes: [],
            matchdayReady: false,
          }
        : fixtureViewModel(state, nextFixture, t, nextFixtureCompetition),
    alerts,
    notes: homeNotes,
    ...(boardUltimatum === undefined
      ? {}
      : {
          boardUltimatum: {
            id: boardUltimatum.id,
            consequence: boardUltimatumConsequence(boardUltimatum),
            weeksRemaining: boardUltimatum.weeksRemaining,
            targetCash: boardUltimatum.targetCash,
            targetLabel: boardTargetLabel(boardUltimatum.targetCash, t),
            cashNeeded: Math.max(0, boardUltimatum.targetCash - userClub.cash),
            ...(boardUltimatum.protectedPlayerId === undefined ||
            !rosterById.has(boardUltimatum.protectedPlayerId)
              ? {}
              : { protectedPlayerId: boardUltimatum.protectedPlayerId }),
            candidates: boardUltimatum.candidates.flatMap((candidate) => {
              const player = rosterById.get(candidate.playerId);
              if (player === undefined) return [];
              return [
                {
                  playerId: player.id,
                  playerName: player.name,
                  role: player.role,
                  lookId: player.lookId,
                  weeklyWage: player.weeklyWage,
                  marketValue: candidate.marketValue,
                  forcedSaleFee: candidate.forcedSaleFee,
                  discountPercent: candidate.discountPercent,
                  isHero: player.power !== undefined,
                },
              ];
            }),
          },
        }),
    ...(!showBoardResolution || latestBoardResolution === undefined
      ? {}
      : {
          boardResolution:
            latestBoardResolution.kind === 'TARGET_MET'
              ? {
                  kind: 'TARGET_MET' as const,
                  headline: t('clubHome.cashTargetMetHeadline'),
                  detail: t('clubHome.cashTargetMetDetail'),
                }
              : latestBoardResolution.kind === 'FACILITY_CONVERSION'
                ? {
                    kind: 'FACILITY_CONVERSION' as const,
                    headline: t(
                      latestBoardResolution.addedFacilities.length === 0
                        ? 'clubHome.facilityPlanBlocked'
                        : 'clubHome.facilityPlanComplete',
                    ),
                    detail:
                      boardFacilityConversionBriefing(state, t)?.body.join(
                        ' ',
                      ) ??
                      boardFacilityConversionSummary(latestBoardResolution, t),
                  }
                : (() => {
                    const sold = state.players.find(
                      (player) => player.id === latestBoardResolution.playerId,
                    );
                    const replacement = state.players.find(
                      (player) =>
                        player.id === latestBoardResolution.replacementPlayerId,
                    );
                    const buyerName = clubName(
                      state,
                      latestBoardResolution.buyerClubId,
                    );
                    // A Week-30 sale is first delivered on the next season's Home
                    // screen. By then the opponent roster has been regenerated, so the
                    // sold player can legitimately be absent even though the saved
                    // verdict is valid. Keep the durable money/outcome facts visible
                    // and enrich only the player sides that still exist.
                    const saleDetail =
                      sold === undefined
                        ? t('clubHome.forcedSaleUnknownPlayer', {
                            club: buyerName,
                            fee: formatMoneyForCopy(
                              t,
                              latestBoardResolution.fee,
                            ),
                          })
                        : t('clubHome.forcedSalePlayer', {
                            player: sold.name,
                            club: buyerName,
                          });
                    const replacementDetail =
                      replacement === undefined
                        ? t('clubHome.forcedSaleVacancyFilled')
                        : t('clubHome.forcedSaleAcademyPromoted', {
                            player: replacement.name,
                          });
                    return {
                      kind: 'FORCED_SALE' as const,
                      headline: t('clubHome.forcedSaleHeadline'),
                      detail: t('clubHome.forcedSaleDetail', {
                        sale: saleDetail,
                        replacement: replacementDetail,
                      }),
                      ...(sold === undefined
                        ? {}
                        : {
                            soldPlayer: {
                              id: sold.id,
                              name: sold.name,
                              role: sold.role,
                              lookId: sold.lookId,
                              buyerName,
                              fee: latestBoardResolution.fee,
                            },
                          }),
                      ...(replacement === undefined
                        ? {}
                        : {
                            replacementPlayer: {
                              id: replacement.id,
                              name: replacement.name,
                              role: replacement.role,
                              lookId: replacement.lookId,
                              age: replacement.age ?? 17,
                              weeklyWage: replacement.weeklyWage,
                            },
                          }),
                      fansLost: latestBoardResolution.fansLost,
                      moraleDelta: latestBoardResolution.moraleDelta,
                    };
                  })(),
        }),
    table: standings.slice(tableStart, tableStart + 5),
  };
}

export function leagueTableViewModel(
  state: GameState,
  t: CopyFn = englishCopy(),
): LeagueTableViewModel {
  const standings = leagueStandings(state);
  const user = standings.find((row) => row.clubId === state.userClubId);
  if (user === undefined)
    throw new Error('the user club has no league standing');
  const seasonFixtures = state.fixtures.filter(
    (fixture) => fixture.season === state.season,
  );
  const topDivision =
    state.m2 !== undefined && currentUserDivision(state.m2) === 1;
  const userFixtures = seasonFixtures
    .filter(
      (fixture) =>
        fixture.homeClubId === state.userClubId ||
        fixture.awayClubId === state.userClubId,
    )
    .slice()
    .sort(
      (left, right) =>
        left.week - right.week ||
        left.round - right.round ||
        left.id.localeCompare(right.id),
    );

  return {
    divisionLabel: careerDivisionLabel(state, t),
    topDivision,
    seasonLabel: t('leagueTable.seasonLabel', { season: state.season }),
    weekLabel: t('leagueTable.weekLabel', { week: state.week }),
    matchesPlayed: seasonFixtures.filter(
      (fixture) => fixture.status === 'played',
    ).length,
    matchesTotal: seasonFixtures.length,
    userPosition: user.position,
    userPoints: user.points,
    leaderPoints: standings[0]?.points ?? 0,
    rows: standings.map((row) => ({
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
      inPromotionPlaces: topDivision ? row.position === 1 : row.position <= 2,
    })),
    leagueFixtures: userFixtures.map((fixture) =>
      leagueFixtureViewModel(
        fixture,
        state.userClubId,
        state.week,
        (clubId) => clubName(state, clubId),
        t,
      ),
    ),
  };
}

export function matchDayViewModel(
  state: GameState,
  content: LaunchContent,
  formation: FormationId = '4-4-2',
  t: CopyFn = englishCopy(),
): MatchDayViewModel {
  const matchday = activeCareerMatchday(state);
  if (matchday === undefined)
    throw new Error('the current matchday has no user fixture');
  const fixture = matchday.fixture;
  const sponsorChallenge = state.clubBusiness.sponsorship.weeklyChallenge;

  const lineup = state.lineups.find(
    (candidate) => candidate.clubId === state.userClubId,
  );
  if (lineup === undefined) throw new Error('the user club has no lineup');
  const roster = rosterForClub(state, state.userClubId);
  const playerById = new Map(roster.map((player) => [player.id, player]));
  const powerNames = new Map(
    content.powers.powers.map((power) => [
      power.id,
      powerDisplayName(content, power.id, t) ?? power.name,
    ]),
  );
  const lineupPlayers = lineup.playerIds.map((playerId) => {
    const player = playerById.get(playerId);
    if (player === undefined)
      throw new Error(`lineup references unknown player ${playerId}`);
    return player;
  });
  const lineupIds = new Set(lineup.playerIds);

  return {
    fixture: fixtureViewModel(
      state,
      fixture,
      t,
      matchday.kind === 'national-cup'
        ? t('fixtureMatchDay.heroCupRound', {
            round:
              matchday.cupRoundLabel === undefined
                ? t('fixtureMatchDay.knockoutTie')
                : cupRoundNameWith(matchday.cupRoundLabel, t),
          })
        : undefined,
    ),
    formation,
    formationLabel: formation.replaceAll('-', '–'),
    selectedTacticId: 'balanced',
    tactics: [
      {
        id: 'balanced',
        label: t('fixtureMatchDay.balancedTacticLabel'),
        detail: t('fixtureMatchDay.balancedTacticDetail'),
      },
    ],
    lineup: lineupPlayers.map((player, index) => {
      return {
        id: player.id,
        name: player.name,
        role: player.role,
        formationRole: formationRoleForSlot(formation, index),
        lookId: player.lookId,
        shirtNumber: player.shirtNumber ?? index + 1,
        isHero: player.power !== undefined,
        overall: overall(player.role, player.attrs),
        condition: player.condition ?? 100,
        potentialGrade: playerGrowthGrade(player),
        attributes: {
          PAC: displayedAttributeValue(player, 'pac'),
          SHO: displayedAttributeValue(player, 'sho'),
          PAS: displayedAttributeValue(player, 'pas'),
          DEF: displayedAttributeValue(player, 'def'),
          TEC: displayedAttributeValue(player, 'tec'),
          STA: displayedAttributeValue(player, 'sta'),
          REF: displayedAttributeValue(player, 'ref'),
        },
      };
    }),
    bench: roster
      .filter((player) => !lineupIds.has(player.id))
      .map((player) => {
        const unlicensedHero = player.power !== undefined && !player.licensed;
        return {
          id: player.id,
          name: player.name,
          role: player.role,
          lookId: player.lookId,
          shirtNumber:
            player.shirtNumber ??
            roster.findIndex((candidate) => candidate.id === player.id) + 1,
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
            ? {
                unavailableLabel: t('squadTraining.outForWeeks', {
                  n: player.injuryWeeks,
                  count: player.injuryWeeks,
                }),
              }
            : (player.awayWeeks ?? 0) > 0
              ? {
                  unavailableLabel: t('squadTraining.onLeaveForWeeks', {
                    n: player.awayWeeks!,
                    count: player.awayWeeks!,
                  }),
                }
              : unlicensedHero
                ? { unavailableLabel: t('fixtureMatchDay.heroLicenseRequired') }
                : {}),
        };
      }),
    heroLimit: careerHeroLimit(state),
    heroes: roster
      .filter((player) => player.power !== undefined)
      .map((player) => ({
        playerId: player.id,
        playerName: player.name,
        powerName: powerNames.get(player.power!) ?? player.power!,
        licensed: player.licensed,
      })),
    licenseReady:
      lineupPlayers.every(
        (player) => player.power === undefined || player.licensed,
      ) &&
      lineupPlayers.filter((player) => player.licensed).length <=
        careerHeroLimit(state),
    heroLicenseOffer: heroLicenseOfferViewModel(state, t),
    ...(sponsorChallenge !== undefined &&
    sponsorChallenge.outcome === undefined &&
    sponsorChallenge.season === state.season &&
    sponsorChallenge.fixtureId === fixture.id
      ? {
          sponsorChallenge: {
            targetLabel: sponsorWeeklyChallengeTargetCopy(
              t,
              sponsorChallenge.kind,
            ),
            actualBonus: Math.round(
              (sponsorChallenge.nominalBonus *
                difficultyRules(state).sponsorIncomePercent) /
                100,
            ),
          },
        }
      : {}),
  };
}

function heroLicenseOfferViewModel(
  state: GameState,
  t: CopyFn,
): HeroLicenseOfferViewModel {
  const offer = nextHeroLicenseOffer(state);
  return {
    licenseNumber: offer.licenseNumber,
    cost: offer.cost,
    ...(offer.blockedReason === undefined
      ? {}
      : { blockedReason: resolveRingCopy(t, offer.blockedReason) }),
  };
}

export function squadTrainingViewModel(
  state: GameState,
  content: LaunchContent,
  selectedPlayerId: string | undefined,
  t: CopyFn = englishCopy(),
): SquadTrainingViewModel {
  const club = requireUserClub(state);
  const lineup = state.lineups.find(
    (candidate) => candidate.clubId === state.userClubId,
  );
  if (lineup === undefined)
    throw new Error('the user club has no starting lineup');
  const starterIds = new Set(lineup.playerIds);
  const roster = rosterForClub(state, state.userClubId);
  const createdPlayerId = state.onboarding?.createdPlayerId;
  // Keep the first-training cue and its created-player target above the fold.
  const createdPlayer =
    createdPlayerId === undefined
      ? undefined
      : roster.find((player) => player.id === createdPlayerId);
  const orderedRoster =
    createdPlayer === undefined
      ? roster
      : [
          createdPlayer,
          ...roster.filter((player) => player.id !== createdPlayerId),
        ];
  const playerById = new Map(roster.map((player) => [player.id, player]));
  const injuryRiskReductionPercent =
    state.facilities.grid === undefined
      ? 0
      : facilityEffects(state.facilities.grid).injuryRiskReductionPercent;
  const greenBullOffer = greenBullTrainingOffer(state);

  // The drill's name is content, not save data: `trainingRules.focusDrills`
  // bakes the id, costs and gains into the career and never the label, so a
  // language change relabels every drill a save already owns.
  const drillName = (drillId: string): string => {
    const authored = content.training.focusDrills.find(
      (candidate) => candidate.id === drillId,
    )?.name;
    return authored === undefined
      ? drillId
      : copyOrEnglish(t, `drill.${drillId}.name`, authored);
  };

  const selectedPlayer =
    selectedPlayerId === undefined
      ? undefined
      : playerById.get(selectedPlayerId);
  const selectedPlayerGift =
    selectedPlayer === undefined
      ? undefined
      : playerGiftQuote(state, selectedPlayer.id);

  const giftBlockedReason =
    selectedPlayerGift?.blockedReason === undefined
      ? undefined
      : t(
          {
            ALREADY_GIFTED: 'playerGift.blocked.alreadyGifted',
            CLUB_LIMIT_REACHED: 'playerGift.blocked.clubLimit',
            MORALE_FULL: 'playerGift.blocked.moraleFull',
            NOT_ENOUGH_CASH: 'playerGift.blocked.notEnoughCash',
            PLAYER_NOT_AT_CLUB: 'playerGift.blocked.playerNotAtClub',
          }[selectedPlayerGift.blockedReason],
        );

  return {
    resources: {
      money: club.cash,
      trainingPoints: state.trainingPoints,
      fans: club.fans,
    },
    ...(greenBullOffer === undefined
      ? {}
      : { greenBullTraining: greenBullOffer }),
    ...(createdPlayer === undefined
      ? {}
      : { createdPlayerId: createdPlayer.id }),
    players: orderedRoster.map((player) => {
      // The column reports how fast this player still improves, not the raw
      // talent they were generated with — that grade flattered a thirty-year-old
      // who could no longer reach it.
      const potentialGrade = playerGrowthGrade(player);
      // The SUPER chance stays on the raw grade, because that is what the engine
      // actually rolls against (`trainPlayerInstantly`). Deriving it from the
      // growth grade would print odds the drill does not use.
      const personalCaps = playerAttributeCaps(player);
      const positionAttributes = POSITION_TRAINING_ATTRIBUTES[player.role]
        .map((attribute) => attribute.toUpperCase())
        .join(', ');
      return {
        id: player.id,
        name: player.name,
        role: player.role,
        lookId: player.lookId,
        overall: overall(player.role, player.attrs),
        potentialGrade,
        superChancePercent: superTrainingChancePercent(
          playerPotentialGrade(player),
        ),
        drillsUntilGuaranteedSuper: Math.max(
          1,
          SUPER_TRAINING_PITY_DRILLS - (player.drillsSinceSuper ?? 0),
        ),
        ...((player.priorityDrillsRemaining ?? 0) > 0 &&
        hasActiveCareerContractPromise(player, 'TRAINING_PRIORITY')
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
        // The player file draws `archetypeLabel`, but `archetype` is what
        // `archetypeDevelopmentSummary` looks its training bonus up by — a
        // translated id lands every player on the "+ BALANCED" fallback.
        archetype: player.archetype ?? 'All-Rounder',
        archetypeLabel: archetypeName(t, player.archetype ?? 'All-Rounder'),
        personality: player.personality ?? 'Professional',
        personalityLabel: personalityName(
          t,
          player.personality ?? 'Professional',
        ),
        morale: player.morale,
        loyalty: playerLoyalty(player, state.careerSeed),
        fame: player.fame ?? 0,
        weeklyWage: player.weeklyWage,
        contractLabel:
          player.contractSeasonsRemaining === 0
            ? t('squadTraining.contractExpiredRenewalDue')
            : t('squadTraining.contractSeasonsLeft', {
                n: player.contractSeasonsRemaining,
                count: player.contractSeasonsRemaining,
              }),
        ...(player.contractPromise === undefined
          ? {}
          : {
              contractPromiseLabel: contractPromiseLabel(
                player.contractPromise.perk,
                t,
              ),
              // The id as well as the label: the roster's hover card explains
              // what the promise obliges the club to do, and the sentence for
              // that already exists per perk in the negotiating table's copy.
              contractPromisePerk: player.contractPromise.perk,
            }),
        // Absent while retirement is more than a season away. The squad list
        // deliberately knows less than the negotiating table does.
        ...retirementLabelField(player, state.careerSeed, t),
        ...(player.shirtNumber === undefined
          ? {}
          : { shirtNumber: player.shirtNumber }),
        isCaptain: player.isCaptain === true,
        ...(player.power
          ? {
              powerName: t('squadTraining.powerAndTier', {
                power:
                  powerDisplayName(content, player.power, t) ?? player.power,
                tier: player.powerTier ?? 1,
              }),
            }
          : {}),
        licensed: player.licensed,
        attributes: (
          Object.entries(player.attrs) as Array<
            [keyof typeof player.attrs, number]
          >
        ).map(([attribute]) => ({
          label: attribute.toUpperCase() as
            'PAC' | 'SHO' | 'PAS' | 'DEF' | 'TEC' | 'STA' | 'REF',
          // Display only — a keeper's Reflexes runs ahead of the stored stat
          // so the halved Keeper Drills ladder reads like the outfield one.
          value: displayedAttributeValue(player, attribute),
          cap: personalCaps[attribute],
        })),
      };
    }),
    ...(selectedPlayerGift === undefined
      ? {}
      : {
          selectedPlayerGift: {
            cost: selectedPlayerGift.cost,
            moraleGain: selectedPlayerGift.moraleGain,
            clubGiftsRemaining: selectedPlayerGift.clubGiftsRemaining,
            ...(giftBlockedReason === undefined
              ? {}
              : { blockedReason: giftBlockedReason }),
          },
        }),
    ...(selectedPlayer === undefined
      ? {}
      : {
          selectedPlayerStatOptions: TRAINING_PATHS.filter((path) =>
            attributeAffectsPlay(selectedPlayer.role, path.attribute),
          ).map((path) => {
            const drill = resolveTrainingDrillForPath(state, path.pathId);
            const gain = displayedDrillGain(
              state,
              drill.id,
              drill.gains[path.attribute] ?? 0,
            );
            const currentValue = displayedAttributeValue(
              selectedPlayer,
              path.attribute,
            );
            const preview = instantTrainingPreview(
              state,
              selectedPlayer.id,
              path.pathId,
            );
            return {
              pathId: path.pathId,
              label: copyOrEnglish(t, path.labelKey, path.label),
              shortCode:
                path.attribute.toUpperCase() as TrainingSlotStatOption['shortCode'],
              drillName: drillName(drill.id),
              tpCost: drill.tpCost,
              gain,
              currentValue,
              baseValueAfter: preview.baseAfter,
              trainingAdjustment: preview.adjustment,
              trainingModifiers: preview.modifiers.map((modifier) => ({
                label: trainingModifierLabel(t, modifier),
                helps: modifier.helps,
              })),
              fractionalBonusBanks: preview.fractionalBonusBanks.map(
                (bank) => ({
                  label:
                    bank.kind === 'STAMINA'
                      ? t('trainingDrill.staminaBonusBank')
                      : t('trainingDrill.trainingBonusBank'),
                  hundredths: bank.hundredths,
                }),
              ),
              // The stored value, never the displayed one: a keeper whose card
              // has stalled at 999 may still have real room to train.
              atSafetyCeiling: selectedPlayer.attrs[path.attribute] >= 999,
              affordable: drill.tpCost <= state.trainingPoints,
            };
          }),
        }),
    drillUpgrades: TRAINING_PATHS.map((path) => {
      const owned = resolveTrainingDrillForPath(state, path.pathId);
      const offer = nextTrainingUpgradeOffer(state, path.pathId);
      const next =
        offer === undefined
          ? undefined
          : content.training.focusDrills.find(
              (candidate) => candidate.id === offer.drillId,
            );
      return {
        pathId: path.pathId,
        label: copyOrEnglish(t, path.labelKey, path.label),
        drillName: drillName(owned.id),
        ownedTier: trainingDrillTier(owned.id),
        // The upgrade panel sits on the same screen as the drill rows, so it
        // has to quote the same ladder they do or the defect just moves down.
        ownedGain: displayedDrillGain(
          state,
          owned.id,
          owned.gains[path.attribute] ?? 0,
        ),
        ownedTpCost: owned.tpCost,
        ...(offer === undefined || next === undefined
          ? {}
          : {
              nextTier: offer.tier,
              nextGain: displayedDrillGain(
                state,
                next.id,
                next.gains[path.attribute] ?? 0,
              ),
              nextTpCost: next.tpCost,
              cost: offer.cost,
              ...(offer.blockedReason === undefined
                ? {}
                : { blockedReason: resolveRingCopy(t, offer.blockedReason) }),
            }),
      };
    }),
    ...(() => {
      const holder = pendingTrainingPriorityHolder(state);
      return holder === undefined ? {} : { trainingPromiseGate: holder };
    })(),
  };
}

/** Spread rather than returned, so an absent status writes no key at all. */
function retirementLabelField(
  player: CareerPlayer,
  careerSeed: number,
  t: CopyFn,
): { retirementLabel?: string } {
  const copy = retirementCardCopy(player, careerSeed);
  return copy === undefined
    ? {}
    : { retirementLabel: resolveRingCopy(t, copy) };
}

function contractPromiseLabel(
  perk: 'GUARANTEED_STARTER' | 'CAPTAINCY' | 'TRAINING_PRIORITY' | 'JERSEY_10',
  t: CopyFn,
): string {
  if (perk === 'GUARANTEED_STARTER')
    return t('squadTraining.promiseStartingXi');
  if (perk === 'CAPTAINCY') return t('squadTraining.promiseCaptaincy');
  if (perk === 'TRAINING_PRIORITY')
    return t('squadTraining.promiseTrainingPriority');
  return t('squadTraining.promiseShirt10');
}

/**
 * The pictures beside a statement row: what the club actually paid for.
 *
 * Read from the settled state rather than persisted onto the ledger line,
 * because both statements render the week they just settled — the one case
 * where live state and saved truth agree. The exception is merchandise, which
 * already carries `reveal.facilityCount` from settlement and is preferred when
 * present, so a shop closed before the report opens cannot change history.
 *
 * Identical things collapse to one icon plus a count; things that differ get
 * one icon each. That is why the upkeep row lists every building while the
 * wage row is one player and a `×17` — seventeen identical heads would be a
 * texture, not a fact.
 */
function ledgerLineIcons(
  state: GameState,
  line: { kind: LedgerLineKind; labelKey?: string; reveal?: LedgerLineReveal },
): readonly LedgerIconViewModel[] | undefined {
  if (line.kind === 'merch') {
    const count =
      line.reveal?.source === 'merch'
        ? line.reveal.facilityCount
        : commercialFacilitySummary(state).shopCount;
    if (count < 1) return undefined;
    return [{ id: 'shops', kind: 'facility', facility: 'fan-shop', count }];
  }

  if (line.kind === 'tickets') {
    const count =
      line.reveal?.source === 'merch'
        ? 0
        : (line.reveal?.facilityCount ??
          commercialFacilitySummary(state).standCount);
    if (count < 1) return undefined;
    return [
      { id: 'stands', kind: 'facility', facility: 'stadium-stand', count },
    ];
  }

  if (line.kind === 'facilities') {
    const grid = state.facilities.grid;
    if (grid === undefined) return undefined;
    const icons = grid.buildings
      .filter((building) => isFacilityOperational(grid, building.id))
      .map((building) => ({
        id: building.id,
        kind: 'facility' as const,
        facility: building.type,
        level: building.level,
      }));
    return icons.length === 0 ? undefined : icons;
  }

  if (line.labelKey === 'ledger.weeklyWages') {
    const count = rosterForClub(state, state.userClubId).length;
    return count === 0 ? undefined : [{ id: 'squad', kind: 'player', count }];
  }

  if (line.labelKey === 'ledger.coachingStaffWages') {
    const icons = [
      { role: 'head', coach: state.market?.headCoach },
      { role: 'assistant', coach: state.market?.assistantCoach },
    ].flatMap(({ role, coach }) =>
      coach === undefined
        ? []
        : [
            {
              id: role,
              kind: 'coach' as const,
              portraitId: coach.portraitId ?? coach.id,
            },
          ],
    );
    return icons.length === 0 ? undefined : icons;
  }

  return undefined;
}

export function weeklyReviewViewModel(
  before: GameState,
  after: GameState,
  t: CopyFn = englishCopy(),
): WeeklyReviewViewModel {
  const clubBefore = requireUserClub(before);
  const clubAfter = requireUserClub(after);
  const ledger = after.ledgers[after.ledgers.length - 1];
  if (
    ledger === undefined ||
    ledger.season !== before.season ||
    ledger.week !== before.week
  ) {
    throw new Error('weekly review requires a newly settled weekly ledger');
  }

  const nextFixture = after.fixtures.filter(
    (fixture) =>
      fixture.status === 'scheduled' &&
      fixture.season === after.season &&
      fixture.week === after.week &&
      (fixture.homeClubId === after.userClubId ||
        fixture.awayClubId === after.userClubId),
  )[0];
  const completedFacility = facilityCompletion(before, after, t);

  return {
    completedWeekLabel: t('weeklyReview.completedWeekLabel', {
      week: before.week,
    }),
    nextWeekLabel:
      after.phase === 'season-end' || after.phase === 'complete'
        ? t('seasonEnd.seasonReview')
        : t('weeklyReview.nextWeekLabel', { week: after.week }),
    clubName: clubAfter.name,
    cashBefore: clubBefore.cash,
    cashAfter: clubAfter.cash,
    netAmount: clubAfter.cash - clubBefore.cash,
    trainingPointsBefore: before.trainingPoints,
    trainingPointsAfter: after.trainingPoints,
    netTrainingPoints: after.trainingPoints - before.trainingPoints,
    ledger: ledger.lines.map((line, index) => {
      const icons = ledgerLineIcons(after, line);
      return {
        id: `weekly-review-${ledger.season}-${ledger.week}-${index}`,
        label: copyOrEnglish(t, line.labelKey, line.label, line.labelParams),
        amount: line.amount,
        kind:
          line.amount > 0 ? 'income' : line.amount < 0 ? 'expense' : 'neutral',
        ...(icons === undefined ? {} : { icons }),
      };
    }),
    updates: weekUpdates(before, after, t),
    ...(completedFacility === undefined
      ? {}
      : { facilityCompletion: completedFacility }),
    ...(nextFixture === undefined
      ? {}
      : { nextFixture: fixtureViewModel(after, nextFixture, t) }),
  };
}

export function postMatchViewModel(
  before: GameState,
  after: GameState,
  fixtureId: string,
  score: { homeGoals: number; awayGoals: number },
  highlights: PostMatchViewModel['highlights'] = [],
  t: CopyFn = englishCopy(),
): PostMatchViewModel {
  const leagueFixture = before.fixtures.find(
    (candidate) => candidate.id === fixtureId,
  );
  const cupRound = before.m2?.nationalCups
    .flatMap((cup) => cup.rounds)
    .find((round) =>
      round.fixtures.some((fixture) => fixture.id === fixtureId),
    );
  const cupFixture = cupRound?.fixtures.find(
    (candidate) => candidate.id === fixtureId,
  );
  const fixture = leagueFixture ?? cupFixture;
  if (fixture === undefined) throw new Error(`unknown fixture ${fixtureId}`);
  const isHome = fixture.homeClubId === before.userClubId;
  const goalsFor = isHome ? score.homeGoals : score.awayGoals;
  const goalsAgainst = isHome ? score.awayGoals : score.homeGoals;
  const latestLedger = after.ledgers[after.ledgers.length - 1];
  const ledger =
    latestLedger?.season === before.season && latestLedger.week === before.week
      ? latestLedger
      : undefined;
  const cupWinnerClubId =
    cupRound === undefined
      ? undefined
      : after.m2?.nationalCups
          .flatMap((cup) => cup.rounds)
          .flatMap((round) => round.fixtures)
          .find((candidate) => candidate.id === fixtureId)?.winnerClubId;
  const outcomeLabel =
    cupWinnerClubId === undefined
      ? goalsFor > goalsAgainst
        ? 'WIN'
        : goalsFor < goalsAgainst
          ? 'LOSS'
          : 'DRAW'
      : cupWinnerClubId === before.userClubId
        ? 'WIN'
        : 'LOSS';
  const completedFacility = facilityCompletion(before, after, t);
  const opponentClubId = isHome ? fixture.awayClubId : fixture.homeClubId;
  const pool = coachLinePool(before, {
    outcomeLabel,
    margin: Math.abs(goalsFor - goalsAgainst),
    // The season travels with the tie: the seeding map has to be read off the
    // cup this fixture belongs to, not off whichever retained cup happens to
    // mention the opponent first.
    ...(cupFixture === undefined
      ? {}
      : { cupTie: { opponentClubId, season: cupFixture.season } }),
  });
  const reaction = fulltimeReaction(
    after,
    fixtureId,
    score,
    outcomeLabel,
    pool,
    t,
  );
  const rivalMockery = rivalVictoryMockery(
    before,
    fixtureId,
    opponentClubId,
    isHome ? 'away' : 'home',
    score,
    outcomeLabel,
    t,
  );
  return {
    result: {
      fixtureId,
      competition:
        cupRound === undefined
          ? careerDivisionLabel(before, t)
          : t('postMatchSummary.heroCupRound', {
              round: cupRoundNameWith(cupRound.label, t),
            }),
      homeTeam: clubName(before, fixture.homeClubId),
      awayTeam: clubName(before, fixture.awayClubId),
      homeScore: score.homeGoals,
      awayScore: score.awayGoals,
      outcomeLabel,
      winner:
        cupWinnerClubId === fixture.homeClubId
          ? 'home'
          : cupWinnerClubId === fixture.awayClubId
            ? 'away'
            : score.homeGoals > score.awayGoals
              ? 'home'
              : score.awayGoals > score.homeGoals
                ? 'away'
                : null,
      cupExit: cupRound !== undefined && outcomeLabel === 'LOSS',
    },
    ledger: (ledger?.lines ?? []).map((line, index) => {
      const icons = ledgerLineIcons(after, line);
      return {
        id: `${before.season}-${before.week}-${index}`,
        label: copyOrEnglish(t, line.labelKey, line.label, line.labelParams),
        amount: line.amount,
        kind:
          line.amount > 0 ? 'income' : line.amount < 0 ? 'expense' : 'neutral',
        ...(line.reveal === undefined ? {} : { reveal: line.reveal }),
        ...(icons === undefined ? {} : { icons }),
      };
    }),
    settlementSeason: before.season,
    settlementWeek: before.week,
    netAmount: (ledger?.lines ?? []).reduce(
      (sum, line) => sum + line.amount,
      0,
    ),
    trainingPointsGained: after.trainingPoints - before.trainingPoints,
    fanDelta: requireUserClub(after).fans - requireUserClub(before).fans,
    highlights,
    updates: weekUpdates(before, after, t),
    ...(completedFacility === undefined
      ? {}
      : { facilityCompletion: completedFacility }),
    ...(reaction === undefined ? {} : { reaction }),
    ...(rivalMockery === undefined ? {} : { rivalMockery }),
  };
}

/**
 * Three goals is a hiding; one or two is a Saturday.
 *
 * Every competition bands a three-goal result as a hiding. Close Cup ties then
 * use the opponent's seeded division to tell the upset story.
 */
const BLOWOUT_MARGIN = 3;

/**
 * Which of the gaffer's pools this afternoon draws from.
 *
 * Close Cup ties band on the division gap frozen into the draw. A blowout uses
 * the score first, because "coin toss" copy after 8-0 is plainly false. The
 * seeded divisions are the same numbers `cupGiantKillingCelebration`
 * already reads, so the gaffer and Bert cannot disagree about how big the upset
 * was. Cups drawn before the seed map existed fall through as a level tie,
 * which is the reading that claims least.
 */
function coachLinePool(
  state: GameState,
  result: {
    outcomeLabel: 'WIN' | 'DRAW' | 'LOSS';
    margin: number;
    cupTie?: { opponentClubId: string; season: number };
  },
): FulltimeCoachLinePool {
  const { outcomeLabel, margin, cupTie } = result;
  // A cup tie is settled on the day, so a DRAW here means the round has not
  // been resolved yet. The league's level-game lines are the honest answer.
  if (cupTie === undefined || outcomeLabel === 'DRAW') {
    if (outcomeLabel === 'DRAW') return 'leagueDraw';
    const heavy = margin >= BLOWOUT_MARGIN;
    if (outcomeLabel === 'WIN')
      return heavy ? 'leagueWinBig' : 'leagueWinClose';
    return heavy ? 'leagueLossBig' : 'leagueLossClose';
  }
  const tiersAbove = cupOpponentTiersAbove(state, cupTie);
  if (margin >= BLOWOUT_MARGIN && tiersAbove <= 0)
    return outcomeLabel === 'WIN' ? 'leagueWinBig' : 'leagueLossBig';
  if (outcomeLabel === 'WIN') {
    if (tiersAbove >= 2) return 'cupWinGiant';
    if (tiersAbove === 1) return 'cupWinBetter';
    if (tiersAbove >= -1) return 'cupWinSlight';
    return 'cupWinRoutine';
  }
  if (tiersAbove >= 1) return 'cupLossStrong';
  if (tiersAbove === 0) return 'cupLossEven';
  return 'cupLossWeak';
}

/**
 * How many divisions above us the cup opponent was when this tie was drawn.
 *
 * Positive means they are the bigger club. `DivisionLevel` counts downward — D1
 * is the top — so the subtraction reads the same way round as
 * `cupGiantKillingCelebration`'s `divisionGap`, deliberately.
 *
 * The cup is found by season, the same lookup Bert's celebration uses, because
 * both surfaces describe the size of the same upset and must not contradict
 * each other over it. Completed cups keep their seeding map for ten seasons
 * (`RETAINED_CUP_BRACKET_SEASONS`), so from season two there are several maps on
 * the state and a promoted club sits at a different tier in each. Matching on
 * the club alone would date the tie to whichever cup mentioned it first, and
 * since the manager's own division moves too, both sides of the subtraction
 * would go stale together.
 */
function cupOpponentTiersAbove(
  state: GameState,
  cupTie: { opponentClubId: string; season: number },
): number {
  const divisions = state.m2?.nationalCups.find(
    (cup) => cup.season === cupTie.season,
  )?.seedDivisionByClubId;
  const userDivision = divisions?.[state.userClubId];
  const opponentDivision = divisions?.[cupTie.opponentClubId];
  if (userDivision === undefined || opponentDivision === undefined) return 0;
  return userDivision - opponentDivision;
}

/**
 * The touchline's answer to the result.
 *
 * Rolled off the fixture id rather than a random number so the same match always
 * produces the same reaction: the report can be reopened, re-rendered, or
 * replayed from a save without the gaffer changing his story. One loss in three
 * turns into a blaming, and only when there is an assistant in the building to
 * blame — pointing at an empty touchline is worse than crying.
 */
const BLAME_ROLL_IN = 3;

function rivalVictoryMockery(
  state: GameState,
  fixtureId: string,
  opponentClubId: string,
  matchSide: 'home' | 'away',
  score: { homeGoals: number; awayGoals: number },
  outcomeLabel: 'WIN' | 'DRAW' | 'LOSS',
  t: CopyFn,
): RivalMockeryViewModel | undefined {
  if (outcomeLabel !== 'LOSS') return undefined;
  const hero = state.players.find(
    (player) =>
      player.clubId === opponentClubId && isRivalHeroIntroHeroId(player.id),
  );
  if (hero === undefined || !isRivalHeroIntroHeroId(hero.id)) return undefined;
  const authored = LAUNCH_CONTENT.rivalHeroIntros.intros.find(
    (intro) => intro.heroId === hero.id,
  );
  if (authored === undefined || authored.victoryLines.length === 0)
    return undefined;
  const draw = `${state.careerSeed}:${fixtureId}:${score.homeGoals}-${score.awayGoals}:${hero.id}`;
  const line =
    authored.victoryLines[
      hashString(`rival-victory-line:${draw}`) % authored.victoryLines.length
    ]!;
  return {
    heroId: hero.id,
    heroName: hero.name,
    role: hero.role,
    ...(hero.lookId === undefined ? {} : { lookId: hero.lookId }),
    matchSide,
    line: copyOrEnglish(
      t,
      `rivalHeroVictory.${hero.id}.${proseSlug(line)}`,
      line,
    ),
  };
}

function fulltimeReaction(
  state: GameState,
  fixtureId: string,
  score: { homeGoals: number; awayGoals: number },
  outcomeLabel: 'WIN' | 'DRAW' | 'LOSS',
  pool: FulltimeCoachLinePool,
  t: CopyFn,
): FulltimeReactionViewModel | undefined {
  const headCoach = state.market?.headCoach;
  if (headCoach === undefined) return undefined;
  const coach = {
    coachPortraitId: headCoach.portraitId ?? headCoach.id,
    coachName: headCoach.name,
  };
  // Fixture ids are structural — every career's opener is `s1-r1-m1` — so a roll
  // keyed on the id alone would blame the assistant in the same weeks of every
  // save on earth. The scoreline and the man in the job are what make this
  // club's season its own, and both are fixed once the match is over.
  const draw = `${fixtureId}:${state.season}:${score.homeGoals}-${score.awayGoals}:${headCoach.id}`;

  const assistant = state.market?.assistantCoach;
  if (
    outcomeLabel === 'LOSS' &&
    assistant !== undefined &&
    hashString(`blame:${draw}`) % BLAME_ROLL_IN === 0
  ) {
    const blamePool = LAUNCH_CONTENT.fulltimeBlameLines.lines;
    return {
      pose: 'point',
      ...coach,
      assistantPortraitId: assistant.portraitId ?? assistant.id,
      assistantName: assistant.name,
      // A second, independent draw: the roll decides whether he speaks, the line
      // decides what he says, and one must not narrow the other.
      line: spokenLine(
        'coach.blame',
        blamePool[hashString(`blame-line:${draw}`) % blamePool.length]!,
        t,
      ),
    };
  }

  const lines = LAUNCH_CONTENT.fulltimeCoachLines[pool];
  return {
    pose:
      outcomeLabel === 'WIN' ? 'joy' : outcomeLabel === 'DRAW' ? 'rest' : 'cry',
    ...coach,
    // Keyed apart from the blame draw so the two pools cannot shadow each other:
    // the same match must be free to pick line 3 of either.
    line: spokenLine(
      `coach.fulltime.${pool}`,
      lines[hashString(`coach-line:${pool}:${draw}`) % lines.length]!,
      t,
    ),
  };
}

/**
 * A line drawn from an anonymous pool, in the reader's language.
 *
 * The pools are bare arrays of sentences with no ids, so the key is derived
 * from the English itself — rewriting a line produces a new, untranslated key
 * rather than silently leaving the old translation attached to it.
 */
function spokenLine(namespace: string, line: string, t: CopyFn): string {
  return copyOrEnglish(t, `${namespace}.${proseSlug(line)}`, line);
}

/**
 * A power's name in the reader's language.
 *
 * `powerEffect.<slug>.name` is the catalog's own entry — the match overlay
 * needs power names without loading the content catalog, so they were keyed
 * into `en.json` rather than flattened out of `powers.json`. This joins the two
 * so a screen reading the content catalog gets the same translated name the
 * overlay draws, and falls back to the authored English if the id is unknown.
 */
function powerDisplayName(
  content: LaunchContent,
  powerId: string | undefined,
  t: CopyFn,
): string | undefined {
  if (powerId === undefined) return undefined;
  const authored = content.powers.powers.find(
    (power) => power.id === powerId,
  )?.name;
  if (authored === undefined) return undefined;
  return copyOrEnglish(
    t,
    `powerEffect.${powerCopySlug(powerId)}.name`,
    authored,
  );
}

/** FNV-1a, the same shape the game ring uses to turn an id into a stable draw. */
function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function weekUpdates(
  before: GameState,
  after: GameState,
  t: CopyFn,
): WeeklyReviewViewModel['updates'] {
  const afterPlayers = new Map(
    after.players.map((player) => [player.id, player]),
  );
  const beforeLineup = before.lineups.find(
    (lineup) => lineup.clubId === before.userClubId,
  );
  const afterLineup = after.lineups.find(
    (lineup) => lineup.clubId === after.userClubId,
  );
  const updates: WeeklyReviewViewModel['updates'][number][] = [];
  const completedFacility = facilityCompletion(before, after, t);
  if (completedFacility !== undefined) {
    updates.push({
      id: `facility-complete-${completedFacility.type}-${completedFacility.level}`,
      title: t('weeklyReview.facilityCompleteTitle', {
        facility: completedFacility.name,
      }),
      detail:
        completedFacility.kind === 'BUILD'
          ? t('weeklyReview.facilityBuiltDetail', {
              level: completedFacility.level,
            })
          : t('weeklyReview.facilityUpgradedDetail', {
              level: completedFacility.level,
            }),
      tone: 'positive',
    });
  }
  for (const playerBefore of before.players.filter(
    (player) => player.clubId === before.userClubId,
  )) {
    const playerAfter = afterPlayers.get(playerBefore.id);
    if (playerAfter === undefined) continue;
    if (playerBefore.injuryWeeks === 0 && playerAfter.injuryWeeks > 0) {
      const starterSlot =
        beforeLineup?.playerIds.indexOf(playerBefore.id) ?? -1;
      const replacementId =
        starterSlot >= 0 ? afterLineup?.playerIds[starterSlot] : undefined;
      const replacement =
        replacementId === undefined || replacementId === playerBefore.id
          ? undefined
          : afterPlayers.get(replacementId);
      updates.push({
        id: `injury-${playerBefore.id}`,
        title: t('weeklyReview.ruledOutTitle', { player: playerBefore.name }),
        detail:
          replacement === undefined
            ? t('weeklyReview.ruledOutDetail', {
                weeks: weekCountLabel(playerAfter.injuryWeeks, t),
              })
            : t('weeklyReview.ruledOutDetailWithReplacement', {
                weeks: weekCountLabel(playerAfter.injuryWeeks, t),
                player: replacement.name,
              }),
        tone: 'warning',
      });
    } else if (playerBefore.injuryWeeks > playerAfter.injuryWeeks) {
      updates.push({
        id: `injury-${playerBefore.id}`,
        title:
          playerAfter.injuryWeeks === 0
            ? t('weeklyReview.clearedToPlayTitle', {
                player: playerBefore.name,
              })
            : t('weeklyReview.recoveringTitle', { player: playerBefore.name }),
        detail:
          playerAfter.injuryWeeks === 0
            ? t('weeklyReview.clearedToPlayDetail')
            : t('weeklyReview.recoveringDetail', {
                n: playerAfter.injuryWeeks,
                count: playerAfter.injuryWeeks,
              }),
        tone: 'positive',
      });
    }
    if (
      playerBefore.contractSeasonsRemaining >
      playerAfter.contractSeasonsRemaining
    ) {
      updates.push({
        id: `contract-${playerBefore.id}`,
        title:
          playerAfter.contractSeasonsRemaining === 0
            ? t('weeklyReview.contractExpiredTitle', {
                player: playerBefore.name,
              })
            : t('weeklyReview.finalSeasonTitle', { player: playerBefore.name }),
        detail:
          playerAfter.contractSeasonsRemaining === 0
            ? t('weeklyReview.contractExpiredDetail')
            : t('weeklyReview.finalSeasonDetail'),
        tone: 'warning',
      });
    }
  }
  if (
    after.pendingEvent !== undefined &&
    after.pendingEvent.eventId !== before.pendingEvent?.eventId
  ) {
    updates.push({
      id: `event-${after.pendingEvent.eventId}`,
      title: t('weeklyReview.newClubEventTitle'),
      detail: t('weeklyReview.newClubEventDetail'),
      tone: 'info',
    });
  }
  return updates;
}

function facilityCompletion(
  before: GameState,
  after: GameState,
  t: CopyFn,
): WeeklyReviewViewModel['facilityCompletion'] {
  const project = before.facilities.grid?.construction;
  if (project === undefined || project.weeksRemaining !== 1) return undefined;
  const afterProject = after.facilities.grid?.construction;
  if (afterProject?.buildingId === project.buildingId) return undefined;
  const building = after.facilities.grid?.buildings.find(
    (candidate) => candidate.id === project.buildingId,
  );
  if (building === undefined) return undefined;
  return {
    type: building.type,
    name: facilityName(t, building.type),
    level: building.level,
    kind: project.kind,
  };
}

/**
 * "3 WEEKS", in the shouty register the availability chips use.
 *
 * The lowercase form is a sibling key rather than `.toLowerCase()` on this one:
 * casing is not a transformation every language can apply to its own words, and
 * German nouns in particular do not survive the round trip.
 */
function weekCountLabel(weeks: number, t: CopyFn): string {
  return t('viewModels.weekCountUpper', { n: weeks, count: weeks });
}

function lowercaseWeekCountLabel(weeks: number, t: CopyFn): string {
  return t('viewModels.weekCountLower', { n: weeks, count: weeks });
}

function fixtureViewModel(
  state: GameState,
  fixture: GameState['fixtures'][number],
  t: CopyFn = englishCopy(),
  // Ahead of `competition` in the list because the default below reads it: a
  // default parameter can only see the parameters declared before it.
  competition = careerDivisionLabel(state, t),
): FixtureViewModel {
  const isHome = fixture.homeClubId === state.userClubId;
  const opponentId = isHome ? fixture.awayClubId : fixture.homeClubId;
  // A rival hero is a named character, not only a warning count. Carry the
  // same identity and fixed look used by the intro and match sprite so the
  // team sheet can show who the manager is about to face.
  const opponentHeroes = buildCareerMatchTeamDef(state, opponentId)
    .players.filter((player) => player.power !== undefined)
    .map((player) => ({
      id: player.id,
      name: player.name,
      role: player.role,
      lookId: player.lookId,
    }));
  return {
    id: fixture.id,
    weekLabel: `W${fixture.week}`,
    competition,
    homeTeam: clubName(state, fixture.homeClubId),
    awayTeam: clubName(state, fixture.awayClubId),
    venueLabel: t(isHome ? 'm2League.venueHome' : 'm2League.venueAway'),
    // The tutorial suppresses powers in the match, but Barry is still at the
    // opponent club. Report the character who is there so this team sheet
    // agrees with the rival introduction that just played.
    opponentHeroCount: opponentHeroes.length,
    opponentHeroes,
    matchdayReady: state.phase === 'matchday' && fixture.week === state.week,
  };
}

function careerDivision(state: GameState): 1 | 2 | 3 | 4 | 5 {
  return state.m2 === undefined ? 5 : currentUserDivision(state.m2);
}

/**
 * Whether this week's match is the one that closes the season.
 *
 * The final league round is pinned to the season's last week, so "last league
 * round" and "last week of the season" are the same week and one check covers
 * both. A cup tie landing on it would still not be the league finale, which is
 * why the competition is part of the test.
 */
function isSeasonFinaleLeagueWeek(
  state: GameState,
  kind: 'league' | 'national-cup',
): boolean {
  return kind === 'league' && state.week === SEASON_WEEKS;
}

/**
 * The match-week announcement, or null on a quiet week.
 *
 * `activeCareerMatchday` is the whole test — it is the same call the desk uses
 * for "This week", so the banner can never claim a fixture the club does not
 * actually have. The competition is named the way every other screen names it:
 * the division's own name (never "Division 5"), and the cup's single display
 * name, so a rename can never leave this card behind. The season's last week
 * announces itself as the final game rather than another match day.
 */
export function matchDayBannerViewModel(
  state: GameState,
  t: CopyFn = englishCopy(),
): MatchDayBannerViewModel | null {
  const matchday = activeCareerMatchday(state);
  if (matchday === undefined) return null;
  const isCup = matchday.kind === 'national-cup';
  const competitionLabel = isCup
    ? // `m2League.heroCup` is the catalog's only standalone name for the cup;
      // every other key bakes it into a longer sentence.
      t('m2League.heroCup')
    : t(DIVISION_NAME_KEYS[careerDivision(state)]);
  const isFinale = isSeasonFinaleLeagueWeek(state, matchday.kind);
  return {
    id: `match-day-banner-${state.season}-${state.week}`,
    competitionLabel,
    // The two flags are independent: the season's last week can itself be a
    // cup tie, and it should read as the final game AND draw the cabinet.
    isCup,
    headline: t(
      isFinale ? 'matchDayBanner.finalGame' : 'matchDayBanner.headline',
      {
        competition: competitionLabel,
      },
    ),
    accessibilityLabel: t(
      isFinale
        ? 'matchDayBanner.a11y.finalGame'
        : 'matchDayBanner.a11y.matchDay',
      { competition: competitionLabel },
    ),
  };
}

function careerDivisionLabel(
  state: GameState,
  t: CopyFn = englishCopy(),
): string {
  return divisionTierLabelWith(careerDivision(state), t);
}

function recentForm(
  state: GameState,
): Array<{ result: 'W' | 'D' | 'L'; week: number }> {
  return (
    state.fixtures
      .filter(
        (fixture) =>
          fixture.status === 'played' &&
          fixture.score !== undefined &&
          (fixture.homeClubId === state.userClubId ||
            fixture.awayClubId === state.userClubId),
      )
      .sort(
        (left, right) => right.season - left.season || right.week - left.week,
      )
      // A season's worth, because the strip fills whatever row it is given: a
      // phone shows nine or ten of these and a desktop shows the lot.
      .slice(0, FORM_STRIP_MAX)
      .reverse()
      .map((fixture) => {
        const isHome = fixture.homeClubId === state.userClubId;
        const goalsFor = isHome
          ? fixture.score!.homeGoals
          : fixture.score!.awayGoals;
        const goalsAgainst = isHome
          ? fixture.score!.awayGoals
          : fixture.score!.homeGoals;
        return {
          result:
            goalsFor > goalsAgainst ? 'W' : goalsFor < goalsAgainst ? 'L' : 'D',
          week: fixture.week,
        };
      })
  );
}

function describeEventChoiceOutcome(
  choice: GameEvent['choices'][number],
  t: CopyFn,
  state: GameState,
): string {
  if (!choice.risky)
    return describeSafeOutcome(choice.outcomes[0]?.effects ?? [], t, state);
  const success = choice.outcomes.find((outcome) =>
    outcome.effects.some((effect) => effect.type !== 'flag'),
  );
  if (success === undefined) return t('storyEvent.noGuaranteedReward');
  const reward = describeEventEffects(success.effects, t, state);
  const hasEmptyFailure = choice.outcomes.some(
    (outcome) => outcome.effects.length === 0,
  );
  const failure = choice.outcomes.find(
    (outcome) => outcome !== success && outcome.effects.length > 0,
  );
  return hasEmptyFailure
    ? t('storyEvent.riskyChanceOrNothing', { percent: success.weight, reward })
    : failure !== undefined
      ? t('storyEvent.riskyChanceWithFailure', {
          percent: success.weight,
          reward,
          failure: describeEventEffects(failure.effects, t, state),
        })
      : t('storyEvent.riskyChance', { percent: success.weight, reward });
}

function describeSafeOutcome(
  effects: GameEvent['choices'][number]['outcomes'][number]['effects'],
  t: CopyFn,
  state: GameState,
): string {
  const reward = describeEventEffects(effects, t, state);
  return t('storyEvent.guaranteedEffect', { reward });
}

function describeEventEffects(
  effects: GameEvent['choices'][number]['outcomes'][number]['effects'],
  t: CopyFn,
  state: GameState,
): string {
  // The joiner is copy, not punctuation. Hardcoded `' and '` shipped English
  // inside an otherwise translated consequence hint on 38 risky outcomes, in all
  // six languages — invisible to both instruments, because it is composed from
  // already-resolved values and never appears as a literal beside a key.
  return (
    eventRewardLabels(effects, t, state).join(t('storyEvent.rewardJoiner')) ||
    t('storyEvent.unknownReward')
  );
}

function eventRewardLabels(
  effects: GameEvent['choices'][number]['outcomes'][number]['effects'],
  t: CopyFn,
  state: GameState,
): string[] {
  return eventRewardItems(effects, t, state).map((reward) => reward.label);
}

/**
 * `state` is only here so a session-denominated attribute change can be shown
 * as the points it is actually worth. "+3 sessions" is the authoring unit; the
 * manager needs "+66 SHO", which depends on the drill tier this club owns.
 */
function eventRewardItems(
  effects: GameEvent['choices'][number]['outcomes'][number]['effects'],
  t: CopyFn,
  state: GameState,
  resolvedMoneyDelta?: number,
): NonNullable<StoryEventViewModel['outcomeRewards']> {
  const rewards: NonNullable<StoryEventViewModel['outcomeRewards']>[number][] =
    [];
  const money =
    resolvedMoneyDelta ??
    storyMoneyDelta(
      state,
      effects.reduce(
        (sum, effect) => (effect.type === 'money' ? sum + effect.amount : sum),
        0,
      ),
      effects.reduce(
        (sum, effect) =>
          effect.type === 'cashLossPercent' ? sum + effect.percent : sum,
        0,
      ),
    );
  const playerMorale = effects.reduce(
    (sum, effect) => (effect.type === 'morale' ? sum + effect.amount : sum),
    0,
  );
  const squadMorale = effects.reduce(
    (sum, effect) =>
      effect.type === 'squadMorale' ? sum + effect.amount : sum,
    0,
  );
  const fans = effects.reduce(
    (sum, effect) => (effect.type === 'fans' ? sum + effect.amount : sum),
    0,
  );
  // Scaled exactly as the resolution will pay it, or the card promises a D5
  // number to a D1 club.
  const trainingPoints = storyTrainingPointReward(
    state,
    effects.reduce(
      (sum, effect) => (effect.type === 'tp' ? sum + effect.amount : sum),
      0,
    ),
  );
  if (money !== 0)
    rewards.push({
      label: formatMoneyForCopy(t, money, true),
      kind: 'money',
      positive: money > 0,
    });
  const playerSale = effects.find((effect) => effect.type === 'playerSale');
  if (playerSale?.type === 'playerSale') {
    const playerName = state.players.find(
      (player) => player.id === state.pendingEvent?.selectedPlayerId,
    )?.name;
    rewards.push({
      label: formatMoneyForCopy(t, playerSale.fee, true),
      kind: 'money',
      positive: true,
    });
    rewards.push({
      label:
        playerName === undefined
          ? t('storyEvent.rewardLoseSelectedPlayer')
          : t('storyEvent.rewardLosePlayer', { player: playerName }),
      kind: 'stat',
      positive: false,
    });
  }
  if (playerMorale !== 0)
    rewards.push({
      label: t('storyEvent.rewardPlayerMorale', {
        amount: signedAmount(t, playerMorale),
      }),
      kind: 'morale',
      positive: playerMorale > 0,
    });
  if (squadMorale !== 0)
    rewards.push({
      label: t('storyEvent.rewardSquadMorale', {
        amount: signedAmount(t, squadMorale),
      }),
      kind: 'morale',
      positive: squadMorale > 0,
    });
  if (fans !== 0)
    rewards.push({
      label: t('storyEvent.rewardFans', {
        amount: formatIntegerForCopy(t, fans, true),
      }),
      kind: 'fans',
      positive: fans > 0,
    });
  if (trainingPoints !== 0)
    rewards.push({
      label: `${formatIntegerForCopy(t, trainingPoints, true)} TP`,
      kind: 'training-points',
      positive: trainingPoints > 0,
    });
  for (const effect of effects) {
    if (effect.type === 'statDelta' && effect.amount !== 0) {
      rewards.push({
        label: `${formatIntegerForCopy(t, effect.amount, true)} ${effect.attribute.toUpperCase()}`,
        kind: 'stat',
        positive: effect.amount > 0,
      });
    }
    if (effect.type === 'statDeltaSessions' && effect.sessions !== 0) {
      const points = trainingSessionPoints(
        state,
        effect.attribute,
        effect.sessions,
      );
      if (points !== 0) {
        rewards.push({
          label: `${formatIntegerForCopy(t, points, true)} ${effect.attribute.toUpperCase()}`,
          kind: 'stat',
          positive: points > 0,
        });
      }
    }
    if (effect.type === 'loyalty' && effect.amount !== 0) {
      rewards.push({
        label: t('storyEvent.rewardLoyalty', {
          amount: formatIntegerForCopy(t, effect.amount, true),
        }),
        kind: 'stat',
        positive: effect.amount > 0,
      });
    }
    if (effect.type === 'condition' && effect.amount !== 0) {
      rewards.push({
        label: t('storyEvent.rewardCondition', {
          amount: formatIntegerForCopy(t, effect.amount, true),
        }),
        kind: 'stat',
        positive: effect.amount > 0,
      });
    }
    if (effect.type === 'fame' && effect.amount !== 0) {
      rewards.push({
        label: t('storyEvent.rewardFame', {
          amount: formatIntegerForCopy(t, effect.amount, true),
        }),
        kind: 'stat',
        positive: effect.amount > 0,
      });
    }
    if (effect.type === 'injury') {
      rewards.push({
        label: t('storyEvent.rewardWeeksInjured', {
          n: effect.weeks,
          count: effect.weeks,
        }),
        kind: 'injury',
        positive: false,
      });
    }
    if (effect.type === 'absence') {
      rewards.push({
        label: t('storyEvent.rewardWeeksAway', {
          n: effect.weeks,
          count: effect.weeks,
        }),
        kind: 'injury',
        positive: false,
      });
      if (effect.returnTraining !== undefined) {
        rewards.push({
          label: t('storyEvent.rewardReturnTraining', {
            n: effect.returnTraining.sessions,
            count: effect.returnTraining.sessions,
            attribute:
              effect.returnTraining.attribute === 'WEAKEST'
                ? t('storyEvent.weakestUsefulAttribute')
                : effect.returnTraining.attribute.toUpperCase(),
          }),
          kind: 'stat',
          positive: true,
        });
      }
    }
    if (effect.type === 'facilityFire') {
      rewards.push({
        label:
          effect.mode === 'TWO_SMALL'
            ? t('storyEvent.rewardLoseSmallFacilities', { n: 2, count: 2 })
            : t('storyEvent.rewardRiskPrimaryFacility'),
        kind: 'story',
        positive: false,
      });
    }
    if (effect.type === 'trainingModifier') {
      rewards.push({
        label: t('storyEvent.rewardTrainingModifier', {
          percent: effect.multiplierPercent,
          n: effect.weeks,
          count: effect.weeks,
        }),
        kind: 'training-points',
        positive: effect.multiplierPercent >= 100,
      });
    }
    if (effect.type === 'facilityClosure') {
      rewards.push({
        label: t('storyEvent.rewardFacilityClosed', {
          n: effect.weeks,
          count: effect.weeks,
        }),
        kind: 'story',
        positive: false,
      });
    }
    // A heal is the same row read the other way: weeks off the absence, not on.
    if (effect.type === 'injuryDelta') {
      const weeks = Math.abs(effect.weeks);
      rewards.push({
        label: t('storyEvent.rewardWeeksRecovered', { n: weeks, count: weeks }),
        kind: 'injury',
        positive: true,
      });
    }
    if (effect.type === 'coachBoost' && effect.amount !== 0) {
      const key =
        effect.facet === 'training'
          ? 'storyEvent.rewardCoachTraining'
          : effect.facet === 'tp'
            ? 'storyEvent.rewardCoachTp'
            : 'storyEvent.rewardCoachMotivator';
      rewards.push({
        label: t(key, { amount: signedAmount(t, effect.amount) }),
        kind: 'stat',
        positive: effect.amount > 0,
      });
    }
    if (effect.type === 'coachSpecialty') {
      rewards.push({
        label: t('storyEvent.rewardCoachSpecialty', {
          specialty: coachSpecialtyName(t, effect.to),
        }),
        kind: 'stat',
        positive: true,
      });
    }
    if (effect.type === 'facilityTpBonus' && effect.percent !== 0) {
      rewards.push({
        label: t('storyEvent.rewardFacilityTp', {
          amount: signedAmount(t, effect.percent),
        }),
        kind: 'stat',
        positive: effect.percent > 0,
      });
    }
    if (effect.type === 'facilityTrainingBonus' && effect.percent !== 0) {
      rewards.push({
        label: t('storyEvent.rewardFacilityTraining', {
          amount: signedAmount(t, effect.percent),
        }),
        kind: 'stat',
        positive: effect.percent > 0,
      });
    }
    if (effect.type === 'facilityRecoveryBonus' && effect.amount !== 0) {
      rewards.push({
        label: t('storyEvent.rewardFacilityRecovery', {
          amount: signedAmount(t, effect.amount),
        }),
        kind: 'stat',
        positive: effect.amount > 0,
      });
    }
    if (effect.type === 'facilityIncomeBonus' && effect.percent !== 0) {
      rewards.push({
        label: t('storyEvent.rewardFacilityIncome', {
          amount: signedAmount(t, effect.percent),
        }),
        kind: 'stat',
        positive: effect.percent > 0,
      });
    }
    if (effect.type === 'transferFeePercent' && effect.percent !== 0) {
      rewards.push({
        label: t('storyEvent.rewardTransferFee', {
          amount: signedAmount(t, effect.percent),
        }),
        kind: 'money',
        positive: effect.percent < 0,
      });
    }
  }
  if (
    rewards.length === 0 &&
    effects.some((effect) => effect.type === 'flag' && effect.value)
  ) {
    rewards.push({
      label: t('storyEvent.rewardClubStorySecured'),
      kind: 'story',
      positive: true,
    });
  }
  return rewards;
}

function overall(
  role: GameState['players'][number]['role'],
  attrs: GameState['players'][number]['attrs'],
): number {
  return roleOverall(role, attrs);
}

function signedAmount(t: CopyFn, value: number): string {
  return formatIntegerForCopy(t, value, true);
}

function clubName(state: GameState, clubId: string): string {
  const club = state.clubs.find((candidate) => candidate.id === clubId);
  if (club !== undefined) return club.name;
  const pyramidClub = state.m2?.pyramid.divisions
    .flatMap((division) => division.clubs)
    .find((candidate) => candidate.id === clubId);
  if (pyramidClub === undefined) throw new Error(`unknown club ${clubId}`);
  return pyramidClub.name;
}

function requireUserClub(state: GameState) {
  const club = state.clubs.find(
    (candidate) => candidate.id === state.userClubId,
  );
  if (club === undefined)
    throw new Error(`unknown user club ${state.userClubId}`);
  return club;
}
