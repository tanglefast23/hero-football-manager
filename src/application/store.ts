import {
  adjacencyDescription,
  copyOrEnglish,
  facilityName,
} from './copy-fallback';
import { create } from 'zustand';
import { loadLaunchContent } from '../content';
import {
  advanceWeek,
  FACILITY_CATALOG,
  FACILITY_ADJACENCIES,
  activeCareerMatchday,
  addCreatedPlayer,
  applyCareerNegotiationConsequence,
  beginStoryOnboarding,
  beginCareerTransferTalks,
  beginCareerRenewalTalks,
  closeCareerTransferTalks,
  careerHeroLimit,
  highestDivisionReached,
  buildCareerMatchTeams,
  buildCareerFacility,
  buildTrainingGround,
  completeCupMismatchWarning as markCupMismatchWarningComplete,
  completeRivalHeroIntro as markRivalHeroIntroComplete,
  completeCupGiantKillingCelebration as markCupGiantKillingCelebrationComplete,
  completeFirstOnboardingMatch,
  completeAssistantGuideMilestone,
  type AssistantGuideMilestone,
  completeAssistantGuideSequence,
  assistantTeaches,
  clearAdvisorAssistantInboxSuppressions,
  completeMatchday,
  awakeningsThisSeason,
  completePostMatchAwakening,
  completeCareerTransfer,
  completeCareerRenewal,
  ContractPromiseBlockedError,
  signCareerRenewalAtAsk,
  createCareer,
  currentUserDivision,
  buyCoachSpeech as purchaseCoachSpeech,
  spendCoachSpeech,
  acceptGreenBullTraining as applyGreenBullTraining,
  acceptMidseasonTraining as applyMidseasonTraining,
  completeMidseasonTraining as markMidseasonTrainingComplete,
  declineMidseasonTraining as refuseMidseasonTraining,
  midseasonTrainingStatus,
  declineYouthIntakeOffers,
  dismissAssistantInboxProductForCurrentWeek,
  dismissAssistantInboxProductPermanently,
  dismissCareerCoach,
  hireCareerCoach,
  listCareerPlayer,
  acceptCareerTransferBid,
  acceptSponsorOffer as acceptCareerSponsorOffer,
  acceptSponsorWeeklyChallenge as acceptCareerSponsorWeeklyChallenge,
  allocateSponsorPortfolioPayment,
  difficultyRules,
  hasAssistantGuideMilestone,
  isFirstOnboardingFixture,
  nextPendingClubLegend,
  productionResultFromMatch,
  quickMatchForFixture,
  protectBoardUltimatumPlayer,
  pendingRivalHeroIntro,
  purchaseCareerHeroLicense,
  purchaseCareerTrainingUpgrade,
  reconcilePendingClubLegends,
  closeCareerFacility,
  closeStaffedCareerCoachingOffice,
  relocateCareerFacility,
  releaseCareerPlayer,
  closeCareerRenewalTalks,
  signYouthIntakeOffer,
  resolvePostMatchAwakening,
  resolveNextClubLegendLegacy,
  resolveMatchday,
  selectCareerEventPlayer,
  selectCareerEventCoach,
  selectCareerEventFacility,
  selectCareerLicensedHeroes,
  setCareerLineup,
  swapCareerLineupPlayer,
  resolvePlayerRequest as resolveCareerPlayerRequest,
  trainPlayerInstantly,
  trainingPathLabel,
  trainingPathLabelKey,
  startNextSeason,
  startCareerScoutMission,
  startDetailedScoutReport,
  dismissCareerScoutReport,
  dismissStoryCallback,
  submitCareerTransferOffer,
  submitCareerRenewalOffer,
  upgradeCareerFacility,
  withoutPowers,
  reconcileCareerLineupLicenses,
  type CreatedPlayerDraft,
  type InstantDrillResolution,
  type CareerLegendLegacyChoice,
  type AssistantGuideSequenceId,
  type AssistantMode,
  type GameState,
  type FacilityPosition,
  type FacilityType,
  type LeagueFixture,
  type ManagerMatchPreferences,
  type NationalCupRoundLabel,
  type RivalHeroIntroHeroId,
  type SponsorWeeklyChallengeKind,
} from '../game';
import type { PlayerRequestResolution } from '../game/types';
import type { ContractOffer, PitchCard } from '../game/market';
import {
  careerRosterCapacity,
  userCareerRosterCount,
} from '../game/youth-intake';
import {
  isBrowserDatabaseLockError,
  type CareerBackupSummary,
  type CareerRepository,
  type ReplayRepository,
} from '../persistence';
import { HALF_TICKS } from '../sim/geometry';
import { envelopeFrom } from '../sim/match';
import { mulberry32 } from '../sim/rng';
import type { MatchState, ReplayEnvelope, TeamDef } from '../sim/types';
import type {
  ManagementTab,
  MatchDayBannerViewModel,
  PenaltyShootoutViewModel,
  PostMatchViewModel,
  QuickResultFaceOffViewModel,
  WeeklyReviewViewModel,
} from '../ui';
import {
  createLaunchCareerSetup,
  generateCareerSeed,
  reconcileLaunchRoster,
} from './launch';
import {
  cachedRivalResults,
  clearRivalResultCache,
} from './rival-result-cache';
import { quickResultFaceOffViewModel } from './quick-result-faceoff';
import { penaltyShootoutViewModel } from './penalty-shootout';
import { careerMarketScoutOptions } from './market-source-adapter';
import {
  matchDayBannerViewModel,
  postMatchViewModel,
  reconcileHomeAssistantInbox,
  settleWeeklyStory,
  settleWeeklyTip,
  weeklyReviewViewModel,
} from './view-models';
import {
  OPENING_TRAINING_PITCH_REMINDER_KEY,
  type OpeningInboxDutyId,
  openingTrainingPitchRequired,
  outstandingInboxDuties,
} from './assistant-guide';
import { reconcilePendingStoryEvent } from './event-selection';
import {
  continueResolvedCareerEvent,
  InvalidCareerEventTargetError,
  resolveCareerEventChoice,
} from './career-event-flow';
import {
  careerEventTargetCandidates,
  reconcilePendingCareerEvent,
  skipUnavailableCareerEvent,
} from './career-event-targets';
import {
  completeChampionshipCelebration as markChampionshipCelebrationComplete,
  hasPendingChampionshipCelebration,
} from './championship-celebration';
import {
  hasPendingAwardsCeremony,
  markAwardsCeremonyComplete,
} from './awards-ceremony';
import {
  completeSeasonPodium as markSeasonPodiumComplete,
  hasPendingSeasonPodium,
} from './season-podium';
import {
  endgameSupersedesLeagueTitle,
  markEndgameCelebrationComplete,
  pendingEndgameCelebration,
  TRUE_ENDING_SEEN_FLAG,
} from './endgame-celebration';
import { recordHallOfFame } from './hall-of-fame';
import { projectedSeasonEndContractPromiseHeroLimit } from './contract-promise-projection';
import {
  copyFor,
  formatIntegerForCopy,
  formatMoneyForCopy,
  type CopyFn,
  type CopyParams,
} from '../i18n';

/**
 * The store's own `t`.
 *
 * Every message below travels on `notice`, `error`, `saveWarning` or
 * `persistenceLoadError`, all four of which are drawn on screen — so they are
 * copy, and they need a language. A Zustand store cannot reach React context,
 * and its actions have fixed signatures with nowhere to thread one through, so
 * the locale arrives by injection instead: `setStoreCopy` points this at the
 * active language, and until something calls it every message reads English.
 *
 * `App.tsx` is the one caller: it holds the language (`preferences.language`,
 * the same value it feeds `LocaleProvider`) and calls `setStoreCopy` during
 * render, so the very first action of a frame already speaks the right
 * language. Until it runs, English is the default.
 */
let storeCopyFn: CopyFn | undefined;

function t(key: string, params?: CopyParams): string {
  return (storeCopyFn ??= copyFor('en'))(key, params);
}

/** Points the store's notices, errors and warnings at a language. */
export function setStoreCopy(copy: CopyFn): void {
  storeCopyFn = copy;
}

const launchContent = loadLaunchContent();
const awakeningPowerIds = launchContent.powers.powers.map((power) => power.id);
const awakeningTriggerIds = launchContent.onboarding.triggers.map(
  (trigger) => trigger.id,
);
const awakeningTuning = {
  chancePercent: launchContent.powers.awakening.postMatchChancePercent,
  secondInSeasonChancePercent:
    launchContent.powers.awakening.secondInSeasonChancePercent,
  maxPerSeason: launchContent.powers.awakening.maxPerSeason,
  minimumMatchesBetween: launchContent.powers.awakening.minimumMatchesBetween,
};
let saveQueue = Promise.resolve();
let latestSaveTicket = 0;
/**
 * The career state a queued-but-not-yet-running save will write. While a save
 * is waiting its turn, newer states replace this payload instead of enqueuing
 * more work, so a burst of actions (instant-training taps are the worst case)
 * costs one serialize+write of the final state rather than one per action.
 * Intermediate snapshots carry no information the final state lacks.
 *
 * `generation` ties the payload to the one queued task that owns it. A career
 * replacement withdraws the payload without being able to retire the task that
 * was queued for it, so that task still runs — and without the generation it
 * would consume whatever payload a LATER action had queued by then, writing
 * that newer state ahead of the replacement transaction sitting between them
 * in the queue and leaving the disk behind `lastPersistedCareer`.
 *
 * `lineage` records which live-career lineage queued the payload. Bumped via
 * `retireCareerLineage` whenever the live career is replaced wholesale, it is
 * what lets a save task recognise an abandoned career without comparing seeds —
 * a replacement career started with a deliberately repeated seed must not make
 * a stale payload look live.
 */
let pendingCareerSave: {
  generation: number;
  lineage: number;
  state: GameState;
} | null = null;
let careerSaveGeneration = 0;
let careerLineage = 0;

/**
 * How many writes are OUTSTANDING that a queue-jumping career save must not
 * overlap: the ones spanning several statements (a career replacement, a
 * discard, a backup restore). Two single-statement UPSERTs may interleave
 * safely — SQLite serialises statements on the connection — but a sequence that
 * only makes sense as a whole must not have another writer land in the middle,
 * and a replacement in particular would then write its older state *after* the
 * newer one and lose a week.
 *
 * Outstanding, not running: a replacement sitting in the serial queue behind a
 * long write has not started yet, and counting only the running ones let
 * `flushPendingCareerSave` jump ahead of it — the replacement then wrote its
 * own week 1 over the newest state, and `lastPersistedCareer` claimed the
 * newest state was safe. `queueNewCareerSave` therefore counts at enqueue time.
 */
let exclusiveSaveDepth = 0;

async function withExclusiveSave<T>(task: () => Promise<T>): Promise<T> {
  exclusiveSaveDepth += 1;
  try {
    return await task();
  } finally {
    exclusiveSaveDepth -= 1;
  }
}

/**
 * Writes a queued career save immediately, ahead of the save queue, and then
 * waits for the queue to settle.
 *
 * On native and installed web builds, the OS may suspend or kill the app after
 * it leaves the foreground. A career write can be sitting in the serial queue
 * behind something long (a replay write, or rival fixture settlement).
 * Waiting for the queue would not help, because the chain runs at its own pace
 * either way; the only thing that shortens the window is doing the write now.
 * The payload is withdrawn first, so the task already queued for it recognises
 * that its state has been written and does nothing.
 *
 * Best-effort by design: the app can still be killed mid-write, which is what
 * the save-failure warning exists for. The point is that the exposure is one
 * statement rather than a long task plus a statement.
 */
export async function flushPendingCareerSave(): Promise<void> {
  const snapshot = pendingCareerSave;
  const get = () => useM1Store.getState();
  const set = (partial: Partial<M1Store>) => useM1Store.setState(partial);
  const repository = get().repository;
  if (
    snapshot !== null &&
    repository !== null &&
    exclusiveSaveDepth === 0 &&
    snapshot.lineage === careerLineage &&
    get().persistenceLoadError === null
  ) {
    pendingCareerSave = null;
    try {
      await repository.save(snapshot.state);
      clearSaveFailures(set);
      if (get().career === snapshot.state) {
        set({ hasSavedCareer: true, lastPersistedCareer: snapshot.state });
      }
    } catch (error) {
      // Re-queue rather than hand the payload back. The task that owned this
      // generation has already run and returned, so a payload put back on its own
      // would have no owner — and `queueCareerSave` coalesces into an existing
      // payload without enqueueing, so every later action would join a write that
      // never happens. Queueing gives the state a fresh generation and a task,
      // and that task owns the outcome: counting the failure here as well would
      // score one bad write twice and pause the season a failure early.
      if (pendingCareerSave === null && snapshot.lineage === careerLineage) {
        queueCareerSave(get, set, snapshot.state);
      } else {
        recordSaveFailure(get, set, error);
      }
    }
  }
  await saveQueue;
}

/**
 * Marks every career state queued so far as belonging to a replaced lineage.
 * Called wherever the store swaps the live career wholesale (new career,
 * backup/developer restore, boot, discard, and the failed-replacement
 * rollback), so a save queued for the old lineage refuses to write over the
 * new one.
 */
function retireCareerLineage(): void {
  careerLineage += 1;
}

/**
 * How many career saves may fail in a row before the week stops advancing.
 * Unsaved weeks only exist in this store, so past this point every further
 * advance is progress the next crash erases.
 */
export const SAVE_FAILURE_BLOCK_LIMIT = 3;

export type M1Screen =
  | 'welcome'
  | 'create-player'
  | 'management'
  | 'midseason-training'
  | 'awakening'
  | 'event'
  | 'matchday'
  | 'watched'
  // The Quick Result face-off, shown between the settled match and whatever
  // screen the result was going to open. A dedicated screen rather than an
  // overlay so the awakening's beat timers and the ledger's slot animation
  // cannot start underneath a scene the manager is still watching.
  | 'faceoff'
  // A tied Hero Cup result, replayed after settlement without changing it.
  | 'shootout'
  | 'postmatch'
  | 'week-review'
  | 'legacy'
  | 'championship-celebration'
  // The medal ceremony for a season that finished second or third. Mutually
  // exclusive with the parade above, which only a title fires.
  | 'season-podium'
  // The end of the main climb: the first D1 title, the first Cup, and the true
  // ending when both are in. Once per career each, never per season.
  | 'endgame-celebration'
  // Every season passes through the awards, champions or not. The celebration
  // only fires for a title, so the ceremony is the one fixture of the boundary.
  | 'awards-ceremony'
  | 'season-end';

export interface WatchedMatch {
  fixture: LeagueFixture;
  home: TeamDef;
  away: TeamDef;
  userIsFixtureHome: boolean;
  controlledTeam: 0 | 1;
  /** Present only for a Hero Cup tie; it opens the match on a title card. */
  cupRoundLabel?: NationalCupRoundLabel;
}

export type PostMatchOverlay = 'summary' | null;

/** The latest tap's outcome, sequenced so the popup can animate repeats. */
export interface InstantDrillResult extends Omit<
  InstantDrillResolution,
  'state'
> {
  sequence: number;
  /**
   * Which drill this was in the whole career. Carried on the result rather than
   * read off the career, so a cue keyed to "the third drill" fires on the drill
   * itself and cannot re-fire when the screen re-renders.
   */
  totalDrillsRun: number;
}

export type StoreNoticeTone = 'info' | 'success';

export interface StoreNotice {
  readonly message: string;
  readonly tone: StoreNoticeTone;
  /** Character notices use the full speech overlay instead of the toast. */
  readonly speaker?: 'bert';
}

interface M1Store {
  career: GameState | null;
  repository: CareerRepository | null;
  replayRepository: ReplayRepository | null;
  persistenceLoadError: string | null;
  rawExportRequired: boolean;
  rawExportSucceeded: boolean;
  persistenceReady: boolean;
  saving: boolean;
  hasSavedCareer: boolean;
  /** Exact in-memory snapshot most recently confirmed on disk. */
  lastPersistedCareer: GameState | null;
  /** Career saves that have failed in a row; 0 once one succeeds again. */
  consecutiveSaveFailures: number;
  /** Non-dismissible warning while progress is only in memory. */
  saveWarning: string | null;
  /** True once saves have failed enough times to stop the week advancing. */
  saveBlocked: boolean;
  /**
   * Builds a brand-new career repository on a brand-new database connection.
   *
   * Supplied by the app ring, which owns expo-sqlite. It exists for one
   * failure the plain retry cannot clear: on web the career lives in SQLite
   * over OPFS, and a browser that evicts the origin deletes the database file
   * out from under a connection that stays open and keeps accepting writes
   * that go nowhere. Retrying on that connection can never succeed. Opening a
   * new one recreates the file, and the in-memory career is then written into
   * it, so an eviction costs a reconnect instead of the session.
   */
  reopenRepository: (() => Promise<CareerRepository>) | null;
  /** The previous-generation save the player can fall back to, if any. */
  backupSummary: CareerBackupSummary | null;
  screen: M1Screen;
  /**
   * True while the player is back at the title because a career screen threw.
   *
   * `ScreenErrorBoundary` cannot change the career, so Continue's ordinary
   * resume routes straight back into the screen that just crashed — and it
   * crashes again, on this launch and every later one, because the offending
   * state is persisted. This flag is what lets the next Continue land on the
   * desk instead: one lost cutscene rather than a dead save.
   */
  recoveredFromScreenCrash: boolean;
  activeTab: ManagementTab;
  selectedPlayerId?: string;
  lastDrillResult: InstantDrillResult | null;
  watchedMatch: WatchedMatch | null;
  postMatch: PostMatchViewModel | null;
  postMatchOverlay: PostMatchOverlay;
  weekReview: WeeklyReviewViewModel | null;
  /**
   * The desk jobs that refused the last Advance Week, or null when nothing has.
   * App state rather than career state: it is a reaction to a press, not a fact
   * about the club, and it must not survive a reload.
   */
  inboxDutyReminder: readonly OpeningInboxDutyId[] | null;
  /** The opening job Bert is keeping in scope. Never persisted. */
  inboxDutyFocus:
    | null
    | { readonly mode: 'choosing' }
    | { readonly mode: 'focused'; readonly dutyId: OpeningInboxDutyId };
  /**
   * The match-week announcement waiting to land on the desk, or null.
   *
   * App state, not career state, for the same reason as the reminder above: it
   * is a reaction to one press, it is shown once, and a reload must not replay
   * the bugle for a week the manager has already been working in all evening.
   */
  matchDayBanner: MatchDayBannerViewModel | null;
  /**
   * The post-match presentation waiting to be watched, and the screen it is
   * standing in front of.
   *
   * App state, never persisted — the same argument as `inboxDutyReminder` and
   * `matchDayBanner`. The match itself was settled and saved before this was
   * ever set, so losing it to a reload costs a two-second animation and
   * nothing else.
   */
  faceOff: QuickResultFaceOffViewModel | null;
  shootout: PenaltyShootoutViewModel | null;
  pendingPostFaceOffScreen: M1Screen | null;
  selectedContractTerm: 1 | 2 | 3;
  error: string | null;
  notice: StoreNotice | null;
  /**
   * The starter a story just knocked out, and who took the shirt.
   *
   * Deliberately not persisted. The lineup is already valid on disk by the
   * time this is set, so a reload costs the manager one card explaining a swap
   * they can still see and still change on the Squad screen.
   */
  lineupChange: LineupChangeNotice | null;
  initializePersistence: (
    repository: CareerRepository,
    replayRepository?: ReplayRepository,
  ) => Promise<void>;
  /**
   * 'failed' means the repository-level delete could not run (e.g. a malformed
   * file left the connection mid-transaction). The caller may fall back to the
   * file-level resetCareerDatabase escape hatch, but only when no backup is
   * restorable — the failed delete rolled back, so a readable backup may still
   * be on disk and the wipe would destroy it.
   */
  discardUnreadableSave: () => Promise<'deleted' | 'blocked' | 'failed'>;
  exportUnreadableSave: (
    share: (fileName: string, contents: string) => Promise<void>,
  ) => Promise<void>;
  restoreBackupSave: () => Promise<void>;
  /** Debug UI only: replaces the live career with an exact stored snapshot. */
  restoreDeveloperSave: (state: GameState, slotLabel: string) => void;
  retrySave: () => void;
  /** Boot handing the store the reconnect it cannot build for itself. */
  setReopenRepository: (
    reopen: (() => Promise<CareerRepository>) | null,
  ) => void;
  /**
   * Leaves a screen that threw, for the title, remembering that it threw so
   * Continue does not walk straight back into it.
   */
  recoverFromScreenCrash: () => void;
  startNewCareer: (seed?: number, assistantMode?: AssistantMode) => void;
  continueCareer: () => void;
  setAssistantMode: (assistantMode: AssistantMode) => void;
  completePlayerCreation: (draft: CreatedPlayerDraft) => void;
  continueAfterAwakening: () => void;
  setActiveTab: (tab: ManagementTab) => void;
  focusInboxDuty: (dutyId: OpeningInboxDutyId) => void;
  backToInboxDuties: () => void;
  notifyInboxDutyBlocked: (dutyId?: OpeningInboxDutyId) => void;
  reconcileAssistantInbox: () => void;
  /** Opens the story sitting on this week's desk. */
  openDeskStory: () => void;
  completeAssistantGuide: (sequenceId: AssistantGuideSequenceId) => void;
  /** Retires a one-shot Bert lesson for the rest of the career. */
  completeGuideMilestone: (milestone: AssistantGuideMilestone) => void;
  /** Sends Bert away after the current pre-match Cup mismatch warning. */
  completeCupMismatchWarning: () => void;
  /** Finishes the expected rival's first-meeting taunt and saves it once. */
  completeRivalHeroIntro: (heroId: RivalHeroIntroHeroId) => void;
  completeCupGiantKillingCelebration: () => void;
  /** Sends Bert away after he has refused an Advance Week. */
  dismissInboxDutyReminder: () => void;
  dismissMatchDayBanner: () => void;
  completeFaceOff: () => void;
  completeShootout: () => void;
  /** Removes a product card after its current-week conversation is complete. */
  dismissInboxProduct: (
    alertId: string,
    scope?: 'current-week' | 'permanent',
  ) => void;
  acceptMidseasonTraining: () => void;
  bookGreenBullTraining: () => void;
  declineMidseasonTraining: () => void;
  completeMidseasonTraining: () => void;
  openMatchday: () => void;
  openCupFixture: (fixtureId: string) => void;
  advanceCareer: () => void;
  quickResult: (
    preferences?: Pick<ManagerMatchPreferences, 'initialFormation'>,
  ) => void;
  watchMatch: () => void;
  finishWatchedMatch: (result: MatchState) => void;
  continueAfterMatch: () => Promise<void>;
  dismissPostMatchSummary: () => void;
  continueWeekReview: () => void;
  completeChampionshipCelebration: () => void;
  completeSeasonPodium: () => void;
  completeEndgameCelebration: () => void;
  returnToTitleFromEnding: () => void;
  completeAwardsCeremony: () => void;
  chooseLegacy: (choice: CareerLegendLegacyChoice) => void;
  selectEventPlayer: (playerId: string) => void;
  selectEventCoach: (role: 'HEAD' | 'ASSISTANT') => void;
  selectEventFacility: (buildingId: string) => void;
  chooseEvent: (choiceId: string) => void;
  continueAfterEvent: () => void;
  skipUnavailableEvent: () => void;
  toggleHeroLicense: (playerId: string) => void;
  swapStartingPlayer: (starterId: string, replacementId: string) => void;
  resolvePlayerRequest: (resolution: PlayerRequestResolution) => void;
  acceptSponsorOffer: (offerId: string) => void;
  chooseSponsorWeeklyChallenge: (kind: SponsorWeeklyChallengeKind) => void;
  /** Passing undefined clears the selection — sorting the register deselects. */
  selectPlayer: (playerId: string | undefined) => void;
  trainPlayer: (playerId: string, pathId: string) => void;
  /**
   * Runs the rest of a repeat batch at once, for when the manager skips out of
   * the presentation. The drills were paid for and queued; watching them is
   * optional, so leaving early must not cancel them.
   */
  trainPlayerBatch: (playerId: string, pathId: string, runs: number) => void;
  purchaseTrainingUpgrade: (pathId: string) => void;
  /** Buys one Hero License above the cap the club has earned on the pitch. */
  purchaseHeroLicense: () => void;
  clearDrillResult: () => void;
  buildFacility: () => void;
  buildClubFacility: (type: FacilityType, position: FacilityPosition) => void;
  upgradeClubFacility: (buildingId: string) => void;
  relocateClubFacility: (
    buildingId: string,
    position: FacilityPosition,
  ) => void;
  closeClubFacility: (buildingId: string) => void;
  startScoutMission: (optionId: string) => void;
  openScoutReport: (playerId: string) => void;
  dismissScoutReport: (playerId: string) => void;
  buyDetailedScoutReport: (playerId: string) => void;
  completeStoryCallback: (callbackId: string) => void;
  actOnTransfer: (
    playerId: string,
    direction: 'BUY' | 'SELL',
    bidId?: string,
  ) => void;
  hireCoach: (coachId: string, role?: 'HEAD' | 'ASSISTANT') => void;
  dismissCoach: (role?: 'HEAD' | 'ASSISTANT') => void;
  /** Spends every training point held to bank the head coach's half-time speech. */
  buyCoachSpeech: () => void;
  protectBoardCandidate: (playerId: string) => void;
  signYouth: (playerId: string) => void;
  declineYouth: () => void;
  submitTransferOffer: (offer: ContractOffer, pitchCard?: PitchCard) => void;
  closeTransferTalks: () => void;
  setContractTerm: (term: 1 | 2 | 3) => void;
  renewPlayer: (playerId: string, term?: 1 | 2 | 3) => void;
  releasePlayer: (playerId: string) => void;
  startRenewal: (playerId: string) => void;
  submitRenewalOffer: (offer: ContractOffer, pitchCard?: PitchCard) => void;
  closeRenewal: () => void;
  notify: (message: string, tone?: StoreNoticeTone) => void;
  clearError: () => void;
  clearNotice: () => void;
  clearLineupChange: () => void;
}

/** One forced team-sheet swap, ready for the card that explains it. */
export interface LineupChangeNotice {
  readonly outName: string;
  readonly inName: string;
  /** The story's own outcome prose — why the player is unavailable. */
  readonly reason: string;
}

/**
 * Which starter a story replaced, by comparing the eleven either side of it.
 *
 * Reading the diff beats having the pure ring report it: the repair already
 * lives in `src/game`, and threading a report back out would mean a new return
 * shape on a function four other callers share.
 */
export function forcedLineupSwap(
  before: GameState,
  after: GameState,
  reason: string,
): LineupChangeNotice | null {
  const was = before.lineups.find(
    (lineup) => lineup.clubId === before.userClubId,
  )?.playerIds;
  const now = after.lineups.find(
    (lineup) => lineup.clubId === after.userClubId,
  )?.playerIds;
  if (was === undefined || now === undefined) return null;
  const slot = now.findIndex((playerId, index) => playerId !== was[index]);
  if (slot < 0) return null;
  const named = (playerId: string): string | undefined =>
    after.players.find((player) => player.id === playerId)?.name;
  const outName = named(was[slot]);
  const inName = named(now[slot]);
  if (outName === undefined || inName === undefined) return null;
  return { outName, inName, reason };
}

function inboxDutyTargetTab(dutyId: OpeningInboxDutyId): ManagementTab {
  if (dutyId === 'facility-placement' || dutyId === 'coaching-office') {
    return 'club';
  }
  if (dutyId === 'national-cup') return 'league';
  return 'market';
}

/**
 * The job the focus stands for, read against the live duty list.
 *
 * A focused job that has left that list is over — it was completed, or the
 * club can no longer pay for, place or fit it this week — and a job that is
 * over must stop locking the chrome. Trusting the stored focus instead is what
 * let a lapsed job hold the tab bar and Advance Week hostage until the manager
 * found Back to Inbox. `undefined` means the desk owes nothing and no guard
 * applies at all.
 */
function liveInboxDuty(
  focus: M1Store['inboxDutyFocus'],
  duties: readonly OpeningInboxDutyId[],
): OpeningInboxDutyId | undefined {
  if (focus === null || duties.length === 0) return undefined;
  if (focus.mode === 'focused' && duties.includes(focus.dutyId))
    return focus.dutyId;
  // Between jobs: the first outstanding duty is the one Bert speaks for.
  return duties[0];
}

function blockedInboxDutyForAction(
  state: M1Store,
  allowed: boolean,
): OpeningInboxDutyId | undefined {
  if (state.career === null || state.inboxDutyFocus === null) return undefined;
  const dutyId = liveInboxDuty(
    state.inboxDutyFocus,
    outstandingInboxDuties(state.career),
  );
  if (dutyId === undefined) return undefined;
  // Only a focused job can bless the transaction that finishes it. While the
  // manager is still choosing, no board is theirs and nothing is spendable.
  return state.inboxDutyFocus.mode === 'focused' && allowed
    ? undefined
    : dutyId;
}

/**
 * Where a tab press lands while the desk still owes an opening job.
 *
 * The old guard refused the press and left the manager standing on a board
 * that could not do the job Bert then walked on to demand — the one way to
 * move was a Back to Inbox strip they had to spot. Three rules replace it,
 * and none of them can strand anyone:
 *
 * Home always opens. It is the desk, it is where the next job is chosen, and
 * locking the manager away from it is what made the refusal a trap.
 *
 * Every outstanding job's own board opens, not just the focused one. The
 * opening weeks hand out several duties at once and all of them must be done,
 * so refusing the Club board because the coach job happens to be focused was
 * refusing a job the manager was on their way to finish.
 *
 * Anything else lands on the current job's board with the reminder, so Bert
 * says "this first" from the one page where "this" can actually be done.
 */
function inboxDutyNavigationLanding(
  state: M1Store,
  requestedTab: ManagementTab,
): Partial<M1Store> | undefined {
  if (state.career === null || state.inboxDutyFocus === null) return undefined;
  const duties = outstandingInboxDuties(state.career);
  const dutyId = liveInboxDuty(state.inboxDutyFocus, duties);
  if (dutyId === undefined) return undefined;
  if (requestedTab === 'home') {
    return {
      activeTab: 'home',
      screen: 'management',
      inboxDutyFocus: { mode: 'choosing' },
      inboxDutyReminder: null,
      error: null,
    };
  }
  // The current job keeps the board it already shares with the press: Youth
  // and the coach desk are both Market, and re-pressing Market must not hand
  // the manager off the intake they are standing in.
  const dutyOnRequestedTab =
    inboxDutyTargetTab(dutyId) === requestedTab
      ? dutyId
      : duties.find((duty) => inboxDutyTargetTab(duty) === requestedTab);
  if (dutyOnRequestedTab !== undefined) {
    return {
      activeTab: requestedTab,
      screen: 'management',
      inboxDutyFocus: { mode: 'focused', dutyId: dutyOnRequestedTab },
      inboxDutyReminder: null,
      error: null,
    };
  }
  return {
    activeTab: inboxDutyTargetTab(dutyId),
    screen: 'management',
    inboxDutyFocus: { mode: 'focused', dutyId },
    inboxDutyReminder: [dutyId],
    error: null,
  };
}

function inboxDutyProgressPatch(
  state: M1Store,
  nextCareer: GameState,
): Partial<M1Store> {
  const focus = state.inboxDutyFocus;
  if (focus === null) return { inboxDutyReminder: null };
  const remaining = outstandingInboxDuties(nextCareer);
  if (focus.mode === 'focused' && remaining.includes(focus.dutyId)) {
    return { inboxDutyReminder: null };
  }
  if (remaining.length === 0) {
    return { inboxDutyFocus: null, inboxDutyReminder: null };
  }
  return {
    inboxDutyFocus: { mode: 'choosing' },
    inboxDutyReminder: null,
    activeTab: 'home',
    screen: 'management',
  };
}

export const useM1Store = create<M1Store>((set, get) => ({
  career: null,
  repository: null,
  replayRepository: null,
  persistenceLoadError: null,
  rawExportRequired: false,
  rawExportSucceeded: false,
  persistenceReady: false,
  saving: false,
  hasSavedCareer: false,
  lastPersistedCareer: null,
  consecutiveSaveFailures: 0,
  saveWarning: null,
  saveBlocked: false,
  reopenRepository: null,
  backupSummary: null,
  screen: 'welcome',
  recoveredFromScreenCrash: false,
  activeTab: 'home',
  lastDrillResult: null,
  watchedMatch: null,
  postMatch: null,
  postMatchOverlay: null,
  weekReview: null,
  inboxDutyReminder: null,
  inboxDutyFocus: null,
  matchDayBanner: null,
  faceOff: null,
  shootout: null,
  pendingPostFaceOffScreen: null,
  selectedContractTerm: 1,
  error: null,
  notice: null,
  lineupChange: null,

  async initializePersistence(repository, replayRepository) {
    // Boot replaces whatever career an earlier lifetime of this store held, so
    // any save still queued for it must not write over the loaded one.
    retireCareerLineage();
    try {
      const loadedCareer = await repository.load();
      const career =
        loadedCareer === null ? null : reconcileLoadedCareer(loadedCareer);
      set({
        repository,
        replayRepository: replayRepository ?? null,
        persistenceReady: true,
        career,
        hasSavedCareer: career !== null,
        lastPersistedCareer: career === loadedCareer ? career : null,
        postMatch: null,
        postMatchOverlay: null,
        weekReview: null,
        inboxDutyReminder: null,
        inboxDutyFocus: null,
        matchDayBanner: null,
        faceOff: null,
        shootout: null,
        pendingPostFaceOffScreen: null,
        persistenceLoadError: null,
        rawExportRequired: false,
        rawExportSucceeded: false,
        // Not read on a healthy boot: the summary exists for the
        // unreadable-save screen's Restore button and is rendered nowhere
        // else. Answering it now would decode the whole backup blob (a full
        // parse of ~356 KB) on every launch, for a value nothing draws.
        backupSummary: null,
        error: null,
      });
      // Reconciliation write-back goes through the normal failure-counting
      // queue AFTER the career is installed: a save that fails here (full
      // disk) must warn, not turn a perfectly readable career into the
      // "save could not be loaded" screen whose options include deleting it.
      if (career !== null && career !== loadedCareer)
        queueCareerSave(get, set, career);
    } catch (error) {
      // Whether the file itself is damaged decides which way out is worth
      // offering: restoring the backup, or wiping the database and starting over.
      const damaged = !(await integrityFailSoft(repository));
      set({
        repository,
        replayRepository: replayRepository ?? null,
        persistenceReady: true,
        backupSummary: await backupSummaryFailSoft(repository),
        persistenceLoadError: t('store.saveLoadFailed', {
          reason: rawMessage(error),
          // Glued rather than authored with a leading space: no catalog entry
          // carries edge whitespace, and a translator cannot be asked to keep it.
          damage: damaged ? ` ${t('store.saveDatabaseDamaged')}` : '',
        }),
        rawExportRequired: false,
        rawExportSucceeded: false,
      });
    }
  },

  async exportUnreadableSave(share) {
    const { repository, persistenceLoadError } = get();
    if (repository === null || persistenceLoadError === null) return;
    // A completed export stays valid. A later retry that is dismissed must not
    // revoke the copy the player already saved and lock Start Fresh again.
    set({ rawExportRequired: true });
    try {
      const raw = await repository.loadRaw();
      if (raw === null) throw new Error('the stored career row is missing');
      const fileName = `hero-football-manager-raw-schema-${raw.schemaVersion}.json`;
      await share(fileName, raw.stateJson);
    } catch (error) {
      set({
        persistenceLoadError: t('store.rawExportFailed', {
          reason: rawMessage(error),
        }),
      });
      return;
    }
    set({
      rawExportSucceeded: true,
      notice: { tone: 'info', message: t('store.rawExportSucceeded') },
    });
  },

  async discardUnreadableSave() {
    const {
      repository,
      persistenceLoadError,
      rawExportRequired,
      rawExportSucceeded,
    } = get();
    if (repository === null || persistenceLoadError === null) return 'blocked';
    if (rawExportRequired && !rawExportSucceeded) {
      set({
        persistenceLoadError: t('store.rawExportUnfinished'),
      });
      return 'blocked';
    }
    try {
      // One transaction across both generations, so no queue-jumping save may
      // land inside it.
      await withExclusiveSave(() => repository.delete());
    } catch (error) {
      set({
        persistenceLoadError: t('store.saveDeleteFailed', {
          reason: rawMessage(error),
        }),
      });
      return 'failed';
    }
    // The slot was just wiped; no save queued for the old career may refill it.
    retireCareerLineage();
    set({
      persistenceLoadError: null,
      rawExportRequired: false,
      rawExportSucceeded: false,
      career: null,
      hasSavedCareer: false,
      lastPersistedCareer: null,
      screen: 'welcome',
      activeTab: 'home',
      watchedMatch: null,
      postMatch: null,
      postMatchOverlay: null,
      weekReview: null,
      inboxDutyReminder: null,
      inboxDutyFocus: null,
      matchDayBanner: null,
      faceOff: null,
      shootout: null,
      pendingPostFaceOffScreen: null,
      error: null,
    });
    return 'deleted';
  },

  /**
   * Falls back to the previous-generation save. The unreadable live slot is
   * overwritten by the backup, so the career survives at the cost of the play
   * since that season opened.
   */
  async restoreBackupSave() {
    const repository = get().repository;
    if (repository === null) return;
    let written: GameState;
    let restored: GameState;
    try {
      // Promotes the backup into the live slot in several steps; a save landing
      // between them would be written over by the promotion.
      written = await withExclusiveSave(() => repository.restoreBackup());
      restored = reconcileLoadedCareer(written);
    } catch (error) {
      set({
        persistenceLoadError: t('store.backupRestoreFailed', {
          reason: rawMessage(error),
        }),
      });
      return;
    }
    retireCareerLineage();
    set({
      career: restored,
      hasSavedCareer: true,
      // The repository copied the raw backup bytes into the live slot, so that
      // — not the reconciled shape — is what disk holds until the queued
      // reconciliation save below lands. Same rule as `initializePersistence`.
      lastPersistedCareer: restored === written ? restored : null,
      persistenceLoadError: null,
      screen: 'welcome',
      activeTab: 'home',
      watchedMatch: null,
      postMatch: null,
      postMatchOverlay: null,
      weekReview: null,
      matchDayBanner: null,
      faceOff: null,
      shootout: null,
      pendingPostFaceOffScreen: null,
      error: null,
      notice: { tone: 'info', message: t('store.backupRestored') },
    });
    clearSaveFailures(set);
    // Reconciliation may have changed the restored state; persist that shape.
    queueCareerSave(get, set, restored);
  },

  restoreDeveloperSave(state, slotLabel) {
    guarded(set, () => {
      const restored = reconcileLoadedCareer(state);
      clearRivalResultCache();
      retireCareerLineage();
      set({
        career: restored,
        hasSavedCareer: true,
        lastPersistedCareer: null,
        screen: resumeScreen(restored),
        activeTab: 'home',
        selectedPlayerId: undefined,
        lastDrillResult: null,
        watchedMatch: null,
        postMatch: null,
        postMatchOverlay: null,
        weekReview: null,
        inboxDutyReminder: null,
        inboxDutyFocus: null,
        matchDayBanner: null,
        faceOff: null,
        shootout: null,
        pendingPostFaceOffScreen: null,
        error: null,
        notice: {
          tone: 'info',
          message: t('store.developerSaveLoaded', { slot: slotLabel }),
        },
      });
      clearSaveFailures(set);
      queueCareerSave(get, set, restored);
    });
  },

  setReopenRepository(reopen) {
    set({ reopenRepository: reopen });
  },

  /** Retries the last career state, so a fixed disk can clear a save block. */
  retrySave() {
    const career = get().career;
    if (career === null) return;
    const reopen = get().reopenRepository;
    // Straight through when the app ring supplied no reconnect (native, and
    // every test double): the plain retry is the whole behaviour there.
    if (reopen === null) {
      queueCareerSave(get, set, career);
      return;
    }
    // ponytail: one fresh connection per press, and the dead one is dropped
    // rather than closed — a manual button pressed a handful of times cannot
    // leak enough handles to matter. Pool them if retry ever becomes automatic.
    void reopen().then(
      (repository) => {
        set({ repository });
        queueCareerSave(get, set, career);
      },
      // A reconnect that fails proves nothing about the old connection, so the
      // retry still happens on it — this is the fallback path, not the failure.
      () => queueCareerSave(get, set, career),
    );
  },

  recoverFromScreenCrash() {
    set({
      screen: 'welcome',
      recoveredFromScreenCrash: true,
      error: null,
      activeTab: 'home',
      // Overlay state that survives the remount must not haunt the title
      // screen: a crash while Bert's desk reminder was up would otherwise
      // recover with his lecture floating over the landing view, and a stale
      // watched match holds live-match props no screen consumes.
      inboxDutyReminder: null,
      inboxDutyFocus: null,
      watchedMatch: null,
    });
  },

  startNewCareer(seed, assistantMode) {
    guarded(set, () => {
      if (get().persistenceLoadError !== null) {
        playerError('store.replaceCareerBlocked');
      }
      const replacedCareer = get().career;
      // Requests are attached here rather than inside createLaunchCareerSetup so
      // that every measurement harness — the balance rails and the ~15 audit
      // probes, all of which build their careers from that helper — stays
      // request-free by default. A probe that silently accrued lapse penalties
      // would be measuring a different game than its recorded baseline.
      const created = createCareer({
        ...createLaunchCareerSetup(
          seed ?? generateCareerSeed(),
          undefined,
          launchContent,
        ),
        playerRequestRules: launchContent.playerRequests,
      });
      const career = beginStoryOnboarding(
        assistantMode === undefined ? created : { ...created, assistantMode },
      );
      set({
        career,
        hasSavedCareer: true,
        lastPersistedCareer: null,
        screen: 'create-player',
        recoveredFromScreenCrash: false,
        activeTab: 'home',
        selectedPlayerId: undefined,
        watchedMatch: null,
        postMatch: null,
        postMatchOverlay: null,
        weekReview: null,
        inboxDutyReminder: null,
        inboxDutyFocus: null,
        matchDayBanner: null,
        faceOff: null,
        shootout: null,
        pendingPostFaceOffScreen: null,
        error: null,
      });
      queueNewCareerSave(get, set, career, replacedCareer);
    });
  },

  continueCareer() {
    if (get().career === null) {
      set({ error: t('store.noSavedCareer') });
      return;
    }
    const current = get().career!;
    const career = reconcilePendingCareerEvent(current, launchContent.events);
    // A screen crash sent the player here, and the career it crashed on is
    // unchanged — so resuming where the career says walks straight back into
    // the screen that threw. The desk renders the same career without the
    // cutscene, story card or match presentation that failed, so recovery
    // costs that one moment instead of the save. Consumed on use: if the desk
    // throws too, the boundary sets the flag again and there is nowhere in the
    // career left to route to.
    const recovered = get().recoveredFromScreenCrash;
    set({
      career,
      screen: recovered ? 'management' : resumeScreen(career),
      recoveredFromScreenCrash: false,
      postMatch: null,
      postMatchOverlay: null,
      weekReview: null,
      inboxDutyReminder: null,
      inboxDutyFocus: null,
      matchDayBanner: null,
      faceOff: null,
      shootout: null,
      pendingPostFaceOffScreen: null,
      error: null,
    });
    if (career !== current) queueCareerSave(get, set, career);
  },

  setAssistantMode(assistantMode) {
    const career = get().career;
    if (career === null) return;
    guarded(set, () => {
      const changed = { ...career, assistantMode };
      const next =
        assistantMode === 'teacher'
          ? clearAdvisorAssistantInboxSuppressions(changed)
          : changed;
      set({
        career: next,
        inboxDutyReminder: null,
        inboxDutyFocus: null,
        error: null,
      });
      queueCareerSave(get, set, next);
    });
  },

  completePlayerCreation(draft) {
    guarded(set, () => {
      const next = addCreatedPlayer(requireCareer(get()), draft);
      set({
        career: next,
        screen: 'management',
        activeTab: 'home',
        error: null,
      });
      queueCareerSave(get, set, next);
    });
  },

  continueAfterAwakening() {
    guarded(set, () => {
      const career = requireCareer(get());
      const pending = career.awakening.pending;
      if (pending === undefined)
        throw new Error('there is no awakening cutscene to finish');
      const next = completePostMatchAwakening(career);
      // Every awakening still owes the manager that match's accounts, including
      // the story's first hero — skipping it hid the opening match's whole ledger.
      const returnToPostMatch = get().postMatch !== null;
      const screen: M1Screen = returnToPostMatch
        ? 'postmatch'
        : career.phase === 'season-end' || career.phase === 'complete'
          ? seasonBoundaryScreen(next)
          : career.phase === 'matchday'
            ? 'matchday'
            : 'management';
      set({
        career: next,
        screen,
        activeTab: 'home',
        postMatch: returnToPostMatch ? get().postMatch : null,
        postMatchOverlay: null,
        weekReview: null,
        error: null,
      });
      queueCareerSave(get, set, next);
    });
  },

  setActiveTab(activeTab) {
    const current = get();
    if (
      current.career !== null &&
      midseasonTrainingStatus(current.career) === 'prompt'
    ) {
      set({ activeTab: 'home', screen: 'management', error: null });
      return;
    }
    if (
      current.screen === 'matchday' &&
      current.career !== null &&
      pendingRivalHeroIntro(current.career) !== undefined
    )
      return;
    const dutyLanding = inboxDutyNavigationLanding(current, activeTab);
    if (dutyLanding !== undefined) {
      set(dutyLanding);
      return;
    }
    if (activeTab === 'market') {
      const career = get().career;
      if (career?.market === undefined) {
        set({ error: t('store.marketUnavailable') });
        return;
      }
    }
    set({ activeTab, screen: 'management', error: null });
  },

  focusInboxDuty(dutyId) {
    const career = get().career;
    if (career === null || !outstandingInboxDuties(career).includes(dutyId)) {
      return;
    }
    // Focus and the board it names move together. Leaving the caller to
    // navigate afterwards meant any career change in between — a guide the
    // same press completed, for one — could turn that second step into a
    // refusal, and the manager stayed on the desk staring at a locked tab bar.
    set({
      inboxDutyFocus: { mode: 'focused', dutyId },
      inboxDutyReminder: null,
      activeTab: inboxDutyTargetTab(dutyId),
      screen: 'management',
      error: null,
    });
  },

  backToInboxDuties() {
    const career = get().career;
    const remaining = career === null ? [] : outstandingInboxDuties(career);
    set({
      inboxDutyFocus: remaining.length === 0 ? null : { mode: 'choosing' },
      inboxDutyReminder: null,
      activeTab: 'home',
      screen: 'management',
      error: null,
    });
  },

  notifyInboxDutyBlocked(dutyId) {
    const current = get();
    const resolved =
      dutyId ??
      (current.inboxDutyFocus?.mode === 'focused'
        ? current.inboxDutyFocus.dutyId
        : current.career === null
          ? undefined
          : outstandingInboxDuties(current.career)[0]);
    if (resolved !== undefined) {
      set({ inboxDutyReminder: [resolved], error: null });
    }
  },

  reconcileAssistantInbox() {
    const career = get().career;
    if (career === null) return;
    // Settling the story here (not only on Advance Week) is what gets a card
    // onto the desk of a week the career reached through a match.
    const next = reconcilePendingCareerEvent(
      settleWeeklyTip(settleWeeklyStory(reconcileHomeAssistantInbox(career))),
      launchContent.events,
    );
    if (next === career) return;
    // A week reached through a match has no review to hand the story over, so
    // this is where its opening beat arrives: the desk has just come up and the
    // story settles onto it. Same rule either way — read it entering the week.
    const opensStory =
      career.pendingEvent === undefined &&
      next.pendingEvent !== undefined &&
      get().screen === 'management';
    set({ career: next, ...(opensStory ? { screen: 'event' as const } : {}) });
    queueCareerSave(get, set, next);
  },

  openDeskStory() {
    const career = get().career;
    if (career?.pendingEvent === undefined) return;
    const reconciled = reconcilePendingCareerEvent(
      career,
      launchContent.events,
    );
    set({
      career: reconciled,
      screen:
        reconciled.pendingEvent === undefined
          ? resumeScreen(reconciled)
          : 'event',
      error: null,
    });
    if (reconciled !== career) queueCareerSave(get, set, reconciled);
  },

  completeAssistantGuide(sequenceId) {
    guarded(set, () => {
      const current = get();
      const next = completeAssistantGuideSequence(
        requireCareer(current),
        sequenceId,
      );
      set({
        career: next,
        error: null,
        ...inboxDutyProgressPatch(current, next),
      });
      queueCareerSave(get, set, next);
    });
  },

  completeGuideMilestone(milestone) {
    guarded(set, () => {
      const career = requireCareer(get());
      if (hasAssistantGuideMilestone(career, milestone)) return;
      const next = completeAssistantGuideMilestone(career, milestone);
      set({ career: next, error: null });
      queueCareerSave(get, set, next);
    });
  },

  completeCupMismatchWarning() {
    guarded(set, () => {
      const next = markCupMismatchWarningComplete(requireCareer(get()));
      set({ career: next, error: null });
      queueCareerSave(get, set, next);
    });
  },

  completeRivalHeroIntro(heroId) {
    guarded(set, () => {
      const career = requireCareer(get());
      const next = markRivalHeroIntroComplete(career, heroId);
      if (next === career) return;
      set({ career: next, error: null });
      queueCareerSave(get, set, next);
    });
  },

  completeCupGiantKillingCelebration() {
    guarded(set, () => {
      const next = markCupGiantKillingCelebrationComplete(requireCareer(get()));
      set({ career: next, error: null });
      queueCareerSave(get, set, next);
    });
  },

  dismissInboxDutyReminder() {
    // Nothing to persist: the refusal lives and dies with the press that caused
    // it, and the duties themselves are already recorded on the career.
    set({ inboxDutyReminder: null });
  },

  dismissMatchDayBanner() {
    // Same argument: the card announced the week, the week is on the desk, and
    // nothing about the club changed by showing it.
    set({ matchDayBanner: null });
  },

  /**
   * Hands the manager on to the screen the result was always going to open.
   *
   * Deliberately does NOT save or touch the career: everything durable was
   * settled and queued inside `quickResult` before this screen was ever shown.
   * The guard makes a double-fire harmless — the scene's own timer and a tap
   * can land in the same frame, and two advances would skip a screen.
   */
  completeFaceOff() {
    if (get().screen !== 'faceoff') return;
    set({
      screen: get().pendingPostFaceOffScreen ?? 'postmatch',
      faceOff: null,
      shootout: null,
      pendingPostFaceOffScreen: null,
    });
  },

  completeShootout() {
    if (get().screen !== 'shootout') return;
    set({
      screen: get().pendingPostFaceOffScreen ?? 'postmatch',
      faceOff: null,
      shootout: null,
      pendingPostFaceOffScreen: null,
    });
  },

  dismissInboxProduct(alertId, scope = 'current-week') {
    guarded(set, () => {
      const career = requireCareer(get());
      const next =
        scope === 'permanent'
          ? dismissAssistantInboxProductPermanently(career, alertId)
          : dismissAssistantInboxProductForCurrentWeek(career, alertId);
      set({ career: next, error: null });
      queueCareerSave(get, set, next);
    });
  },

  acceptMidseasonTraining() {
    guarded(set, () => {
      const career = requireCareer(get());
      const next = applyMidseasonTraining(career);
      if (next === career) return;
      set({
        career: next,
        screen: 'midseason-training',
        activeTab: 'home',
        error: null,
      });
      queueCareerSave(get, set, next);
    });
  },

  bookGreenBullTraining() {
    guarded(set, () => {
      const career = requireCareer(get());
      const next = applyGreenBullTraining(career);
      if (next === career) return;
      set({
        career: next,
        screen: 'midseason-training',
        activeTab: 'squad',
        error: null,
      });
      queueCareerSave(get, set, next);
    });
  },

  declineMidseasonTraining() {
    guarded(set, () => {
      const career = requireCareer(get());
      const next = refuseMidseasonTraining(career);
      if (next === career) return;
      set({
        career: next,
        screen: 'management',
        activeTab: 'home',
        error: null,
      });
      queueCareerSave(get, set, next);
    });
  },

  completeMidseasonTraining() {
    guarded(set, () => {
      const career = requireCareer(get());
      const next = markMidseasonTrainingComplete(career);
      if (next === career) return;
      set({
        career: next,
        screen: 'management',
        activeTab: 'home',
        error: null,
      });
      queueCareerSave(get, set, next);
    });
  },

  openMatchday() {
    const career = get().career;
    if (career !== null && midseasonTrainingStatus(career) === 'prompt') return;
    if (career?.phase !== 'matchday') {
      set({ error: t('store.matchDayNotYet') });
      return;
    }
    set({ screen: 'matchday', error: null });
  },

  openCupFixture(fixtureId) {
    const career = get().career;
    if (career === null) {
      set({ error: t('store.startOrLoadCareer') });
      return;
    }
    if (midseasonTrainingStatus(career) === 'prompt') return;
    const matchday = activeCareerMatchday(career);
    if (
      career.phase !== 'matchday' ||
      matchday?.kind !== 'national-cup' ||
      matchday.fixture.id !== fixtureId
    ) {
      set({ error: t('store.leagueMatchFirst') });
      return;
    }
    set({ screen: 'matchday', activeTab: 'league', error: null });
  },

  advanceCareer() {
    guarded(set, () => {
      // Advance is only dispatched from the management shell and the season
      // recap. A double-tap lands the second dispatch after the screen has
      // already moved on (week-review, matchday...) — without this guard it
      // advanced a second week and destroyed the first week's review.
      const screen = get().screen;
      if (screen !== 'management' && screen !== 'season-end') return;
      if (get().saveBlocked) {
        playerError('store.seasonPausedBySaveFailure');
      }
      const career = requireCareer(get());
      if (midseasonTrainingStatus(career) === 'prompt') return;
      if (career.onboarding?.stage === 'create-player') {
        playerError('store.createPlayerFirst');
      }
      if (
        career.awakening.pending !== undefined ||
        career.onboarding?.stage === 'reveal'
      ) {
        set({ screen: 'awakening', error: null });
        return;
      }
      if (
        assistantTeaches(career) &&
        hasAssistantGuideMilestone(career, 'intro-complete') &&
        !hasAssistantGuideMilestone(career, 'first-training-complete')
      ) {
        playerError('store.trainBeforeAdvancing');
      }
      if (career.phase === 'matchday') {
        set({ screen: 'matchday', error: null });
        return;
      }
      // Both boundary presentations gate the recap: the title celebration when
      // the club won the league, and the awards ceremony every season. Asking
      // the boundary router rather than each flag in turn keeps one answer to
      // "what comes before season-end" for every route into it.
      const boundary = seasonBoundaryScreen(career);
      if (boundary !== 'season-end') {
        set({ screen: boundary, error: null });
        return;
      }
      if (career.phase === 'season-end') {
        const guidedCareer = career.eventFlags.includes(
          'm4:season-recap-guide-seen',
        )
          ? career
          : {
              ...career,
              eventFlags: [...career.eventFlags, 'm4:season-recap-guide-seen'],
            };
        const next = reconcilePendingClubLegends(startNextSeason(guidedCareer));
        set({
          career: next,
          screen:
            nextPendingClubLegend(next) === undefined ? 'management' : 'legacy',
          activeTab: 'home',
          weekReview: null,
          matchDayBanner: null,
          error: null,
        });
        queueCareerSave(get, set, next);
        return;
      }
      if (career.phase === 'complete') {
        set({ screen: seasonBoundaryScreen(career), error: null });
        return;
      }

      // A story already on the desk is this week's business. Advancing past an
      // unopened card would lose it, so the last press opens it instead.
      if (career.pendingEvent !== undefined) {
        const reconciled = reconcilePendingCareerEvent(
          career,
          launchContent.events,
        );
        set({
          career: reconciled,
          screen:
            reconciled.pendingEvent === undefined
              ? resumeScreen(reconciled)
              : 'event',
          error: null,
        });
        if (reconciled !== career) queueCareerSave(get, set, reconciled);
        return;
      }

      // The same argument, one step earlier: a job still sitting in the opening
      // weeks' inbox is this week's business too. Bert says so rather than the
      // button simply doing nothing, because a press that produces silence
      // reads as a broken button.
      const outstandingDuties = outstandingInboxDuties(career);
      if (outstandingDuties.length > 0) {
        const focused = get().inboxDutyFocus;
        set({
          inboxDutyReminder:
            focused?.mode === 'focused' &&
            outstandingDuties.includes(focused.dutyId)
              ? [focused.dutyId]
              : outstandingDuties,
          error: null,
        });
        return;
      }

      const advanced = advanceWeek(career);
      const withMilestone =
        advanced.week !== career.week &&
        hasAssistantGuideMilestone(career, 'first-training-complete')
          ? completeAssistantGuideMilestone(advanced, 'first-week-advanced')
          : advanced;
      // Stories belong to the week being entered, not the one being left, so the
      // card is already on the desk when the manager first sees the new week.
      const next = reconcilePendingCareerEvent(
        settleWeeklyTip(settleWeeklyStory(withMilestone)),
        launchContent.events,
      );
      const weekReview =
        next.phase === 'manage' && next.week !== career.week
          ? weeklyReviewViewModel(career, next, t)
          : null;
      // Announced on arrival at a new week that has a fixture, and only then:
      // the week review comes first, so the card is waiting on the desk behind
      // it rather than competing with it. A week that merely CONTAINS the
      // matchday phase (the same week, one press later) is already past its
      // announcement, so the week must actually have changed.
      const matchDayBanner = matchDayBannerOnArrival(
        career,
        next,
        get().matchDayBanner,
      );
      set({
        career: next,
        matchDayBanner,
        screen:
          weekReview !== null
            ? 'week-review'
            : midseasonTrainingStatus(next) === 'prompt'
              ? 'management'
              : next.phase === 'matchday'
                ? 'matchday'
                : next.phase === 'season-end' || next.phase === 'complete'
                  ? seasonBoundaryScreen(next)
                  : 'management',
        weekReview,
        inboxDutyReminder: null,
        inboxDutyFocus: null,
        error: null,
      });
      queueCareerSave(get, set, next);
    });
  },

  quickResult(preferences = { initialFormation: '4-4-2' }) {
    guarded(set, () => {
      // Only the match-day screen offers Quick Result. On a shared league+cup
      // week the first dispatch leaves the cup fixture active, so an unguarded
      // double-tap would silently quick-resolve the cup tie the player never
      // saw. (`finishWatchedMatch` gets the same protection from its
      // watched-fixture identity check.)
      if (get().screen !== 'matchday') return;
      if (get().saveBlocked) {
        playerError('store.seasonPausedBySaveFailure');
      }
      const before = requireCareer(get());
      if (midseasonTrainingStatus(before) === 'prompt') return;
      if (pendingRivalHeroIntro(before) !== undefined) return;
      assertLeagueCupCheckpointPersisted(get(), before);
      const { kind, fixture, fixtures, teams } = currentMatchday(before);
      const quickMatch = quickMatchForFixture(fixture, teams, {
        userClubId: before.userClubId,
        ...preferences,
        // Quick Result owns the touchline. It always replaces tired players;
        // the saved switch belongs only to matches the manager watches.
        autoSubs: true,
      });
      const production = quickMatch.production;
      if (production === undefined)
        throw new Error('Quick Result did not produce user match facts');
      // Whatever the preload finished is handed over as a supplied result, so
      // `resolveMatchday` simulates only what is genuinely missing. A cold or
      // stale cache contributes nothing and it simulates all four, as before.
      const results =
        kind === 'league'
          ? resolveMatchday(fixtures, teams, [
              production.fixtureResult,
              ...cachedRivalResults(
                fixtures.filter((candidate) => candidate.id !== fixture.id),
                teams,
              ),
            ])
          : [production.fixtureResult];
      const userResult = results.find(
        (result) => result.fixtureId === fixture.id,
      );
      if (userResult === undefined)
        throw new Error('the user fixture did not produce a result');
      const after = completeMatchday(before, results, production);
      // The week is settled; nothing may claim these again, and the fingerprints
      // are large enough that a season of them would be worth real memory.
      clearRivalResultCache();
      const isOnboardingMatch = isFirstOnboardingFixture(before, fixture.id);
      const completed = isOnboardingMatch
        ? completeFirstOnboardingMatch(after, fixture.id)
        : after;
      const awakening =
        kind === 'league'
          ? resolvePostMatchAwakening(
              completed,
              fixture.id,
              production.participantPlayerIds,
              awakeningPowerIds,
              awakeningTriggerIds,
              awakeningTuning,
            )
          : { state: completed, awakened: false };
      const next = awakening.state;
      // The onboarding match earns its statement too; the awakening cutscene
      // runs first, so the payoff still lands before any accounting.
      const postMatch = postMatchViewModel(
        before,
        next,
        fixture.id,
        userResult,
        [],
        production.powerFiredPlayerIds,
        t,
      );
      const destination = awakening.awakened
        ? ('awakening' as const)
        : ('postmatch' as const);
      /**
       * The face-off, built from the PRE-SETTLEMENT capture at the top of this
       * call — `teams`, `fixture` and `before.userClubId`.
       *
       * `currentMatchday` must NOT be re-entered here. Two ways that breaks,
       * both silently: on a league-only week the career has left
       * `phase: 'matchday'` and it throws, turning a decorative scene into a
       * crash on a settled match; and on a week where a cup tie shares the
       * calendar the career is STILL on matchday for the cup, so it would hand
       * back the cup's teams and name the wrong two players for this league
       * fixture.
       *
       * The verdict comes from `postMatch.result.outcomeLabel` rather than the
       * goals, because a cup tie level after ninety minutes is settled on
       * penalties — reading the score would call every shoot-out a draw.
       */
      const userIsHome = fixture.homeClubId === before.userClubId;
      const clubTeam =
        teams[userIsHome ? fixture.homeClubId : fixture.awayClubId];
      const opponentTeam =
        teams[userIsHome ? fixture.awayClubId : fixture.homeClubId];
      const tiedCup =
        kind === 'national-cup' &&
        userResult.homeGoals === userResult.awayGoals;
      const shootout =
        !tiedCup || clubTeam === undefined || opponentTeam === undefined
          ? null
          : penaltyShootoutViewModel(
              {
                fixtureId: fixture.id,
                careerSeed: before.careerSeed,
                matchSeed: fixture.matchSeed,
                round: fixture.round,
                clubTeam,
                opponentTeam,
                winner:
                  postMatch.result.outcomeLabel === 'WIN' ? 'club' : 'opponent',
              },
              t,
            );
      const faceOff =
        tiedCup || clubTeam === undefined || opponentTeam === undefined
          ? null
          : quickResultFaceOffViewModel(
              {
                clubTeam,
                opponentTeam,
                outcomeLabel: postMatch.result.outcomeLabel,
              },
              t,
            );
      const presentationScreen =
        shootout !== null
          ? ('shootout' as const)
          : faceOff !== null
            ? ('faceoff' as const)
            : destination;
      set({
        career: next,
        postMatch,
        postMatchOverlay: null,
        weekReview: null,
        // Settling this match rolled the calendar on. If the week it rolled
        // into has its own fixture, that week gets its announcement when the
        // manager reaches the desk, exactly as a quiet week's would.
        matchDayBanner: matchDayBannerOnArrival(
          before,
          next,
          get().matchDayBanner,
        ),
        // A scene that could not be built is simply not shown: the settled
        // result reaches the manager either way.
        screen: presentationScreen,
        faceOff,
        shootout,
        pendingPostFaceOffScreen:
          presentationScreen === destination ? null : destination,
        watchedMatch: null,
        error: null,
      });
      queueReplaySave(get, set, before, fixture, quickMatch.replay);
      queueCareerSave(get, set, next);
    });
  },

  watchMatch() {
    guarded(set, () => {
      if (get().screen !== 'matchday') return;
      // Matches saveBlocked's contract: once saving is broken the season is
      // paused, so no new match progress may start, only be retried/recovered.
      if (get().saveBlocked) {
        playerError('store.seasonPausedBySaveFailure');
      }
      const career = requireCareer(get());
      if (midseasonTrainingStatus(career) === 'prompt') return;
      if (pendingRivalHeroIntro(career) !== undefined) return;
      assertLeagueCupCheckpointPersisted(get(), career);
      const { fixture, teams, cupRoundLabel } = currentMatchday(career);
      const userIsFixtureHome = fixture.homeClubId === career.userClubId;
      set({
        watchedMatch: {
          fixture,
          home: teams[fixture.homeClubId],
          away: teams[fixture.awayClubId],
          userIsFixtureHome,
          controlledTeam: userIsFixtureHome ? 0 : 1,
          // Only a cup matchday carries a round; a league week leaves this
          // undefined and the match opens with no title card.
          ...(cupRoundLabel === undefined ? {} : { cupRoundLabel }),
        },
        screen: 'watched',
        error: null,
      });
    });
  },

  finishWatchedMatch(result) {
    guarded(set, () => {
      const watchedMatch = get().watchedMatch;
      // A second `onDone` for a match already settled is a duplicate delivery,
      // not a fault: the first call cleared the context. Surfacing it threw a
      // developer sentence into the player's error toast on a working game.
      if (watchedMatch === null) return;
      const before = requireCareer(get());
      const { kind, fixture, fixtures, teams } = currentMatchday(before);
      if (watchedMatch.fixture.id !== fixture.id) {
        throw new Error('the watched fixture context is missing');
      }
      const production = productionResultFromMatch(
        fixture,
        result,
        before.userClubId,
      );
      const supplied = production.fixtureResult;
      const results =
        kind === 'league'
          ? resolveMatchday(fixtures, teams, [
              supplied,
              ...cachedRivalResults(
                fixtures.filter((candidate) => candidate.id !== fixture.id),
                teams,
              ),
            ])
          : [supplied];
      const after = completeMatchday(before, results, production);
      // The week is settled; nothing may claim these again, and the fingerprints
      // are large enough that a season of them would be worth real memory.
      clearRivalResultCache();
      const highlights = production.goals.map((goal, index) => ({
        id: `${fixture.id}-goal-${index}`,
        // Same rounding as the live match clock (MatchScreen): a goal's
        // post-match minute must match the minute shown when it went in.
        minuteLabel: `${Math.max(1, Math.min(90, Math.ceil((goal.tick / (HALF_TICKS * 2)) * 90)))}'`,
        description: t('store.goalScored', { player: goal.name }),
        ...(goal.power === undefined ? {} : { power: goal.power }),
      }));
      const isOnboardingMatch = isFirstOnboardingFixture(before, fixture.id);
      const onboarded = isOnboardingMatch
        ? completeFirstOnboardingMatch(after, fixture.id)
        : after;
      // The bank is emptied from the RECORDED input log, never from a live
      // callback during the match. The log is what the replay is built from, so
      // the bank and the replay can never disagree about whether the speech was
      // given — and a match abandoned before the whistle costs the club nothing.
      const completed = result.inputLog.some(
        (input) => input.kind === 'MOTIVATIONAL_SPEECH',
      )
        ? spendCoachSpeech(onboarded)
        : onboarded;
      const awakening =
        kind === 'league'
          ? resolvePostMatchAwakening(
              completed,
              fixture.id,
              production.participantPlayerIds,
              awakeningPowerIds,
              awakeningTriggerIds,
              awakeningTuning,
            )
          : { state: completed, awakened: false };
      const next = awakening.state;
      const postMatch = postMatchViewModel(
        before,
        next,
        fixture.id,
        supplied,
        highlights,
        production.powerFiredPlayerIds,
        t,
      );
      const destination = awakening.awakened
        ? ('awakening' as const)
        : ('postmatch' as const);
      const tiedCup =
        kind === 'national-cup' && supplied.homeGoals === supplied.awayGoals;
      const clubTeam = watchedMatch.userIsFixtureHome
        ? watchedMatch.home
        : watchedMatch.away;
      const opponentTeam = watchedMatch.userIsFixtureHome
        ? watchedMatch.away
        : watchedMatch.home;
      const shootout = tiedCup
        ? penaltyShootoutViewModel(
            {
              fixtureId: fixture.id,
              careerSeed: before.careerSeed,
              matchSeed: fixture.matchSeed,
              round: fixture.round,
              clubTeam,
              opponentTeam,
              winner:
                postMatch.result.outcomeLabel === 'WIN' ? 'club' : 'opponent',
            },
            t,
          )
        : null;
      set({
        career: next,
        postMatch,
        postMatchOverlay: null,
        weekReview: null,
        // See the Quick Result path: a settled match can land the club in
        // another match week, and that week is owed its announcement too.
        matchDayBanner: matchDayBannerOnArrival(
          before,
          next,
          get().matchDayBanner,
        ),
        screen: shootout === null ? destination : 'shootout',
        faceOff: null,
        shootout,
        pendingPostFaceOffScreen: shootout === null ? null : destination,
        watchedMatch: null,
        error: null,
      });
      queueReplaySave(get, set, before, fixture, envelopeFrom(result));
      queueCareerSave(get, set, next);
    });
  },

  async continueAfterMatch() {
    const career = get().career;
    const hasSecondMatch = career?.phase === 'matchday';
    // A league/Cup double-header has two independent production records. The
    // first must exist on disk before the second match can start; otherwise the
    // coalescing save queue could replace the only snapshot containing that
    // league participation and audience impact.
    if (
      hasSecondMatch &&
      career !== null &&
      get().repository !== null &&
      get().lastPersistedCareer !== career
    ) {
      set({ notice: { tone: 'info', message: t('store.savingLeagueResult') } });
      // Re-queue before waiting. A save that has already FAILED leaves nothing
      // in the queue, so waiting alone returns silently on this press and every
      // press after it — the Cup tie is unreachable and the only exit is force
      // quitting, which loses the match. Queueing makes the press itself the
      // retry: the career resumes the instant a write lands, and until then
      // each attempt is counted, so the save warning escalates to its Retry
      // instead of the player pressing a dead button forever.
      queueCareerSave(get, set, career);
      await saveQueue;
      if (get().career !== career || get().lastPersistedCareer !== career)
        return;
    }
    const reachedCareer = get().career;
    // React normally settles the new desk while the report is open. Do it here
    // too when an achievement is waiting, so a very fast Continue press and a
    // headless store caller both get the same report -> interruption order.
    const currentCareer =
      reachedCareer?.phase === 'manage' &&
      reachedCareer.pendingEvent === undefined &&
      (reachedCareer.pendingMilestones?.length ?? 0) > 0
        ? settleWeeklyStory(reachedCareer)
        : reachedCareer;
    const currentSeasonBoundary =
      currentCareer !== null &&
      (currentCareer.phase === 'season-end' ||
        currentCareer.phase === 'complete');
    const currentHasSecondMatch = currentCareer?.phase === 'matchday';
    const currentHasMidseasonPrompt =
      currentCareer !== null &&
      midseasonTrainingStatus(currentCareer) === 'prompt';
    set({
      ...(currentCareer !== reachedCareer ? { career: currentCareer } : {}),
      postMatch:
        currentSeasonBoundary || currentHasSecondMatch ? null : get().postMatch,
      weekReview: null,
      postMatchOverlay:
        currentSeasonBoundary ||
        currentHasSecondMatch ||
        get().postMatch === null
          ? null
          : 'summary',
      screen: currentSeasonBoundary
        ? seasonBoundaryScreen(currentCareer)
        : currentHasSecondMatch && !currentHasMidseasonPrompt
          ? 'matchday'
          : 'management',
      activeTab: 'home',
      error: null,
    });
    if (currentCareer !== null && currentCareer !== reachedCareer) {
      queueCareerSave(get, set, currentCareer);
    }
  },

  dismissPostMatchSummary() {
    const career = get().career;
    set({
      postMatch: null,
      postMatchOverlay: null,
      faceOff: null,
      shootout: null,
      pendingPostFaceOffScreen: null,
      ...(career?.pendingEvent === undefined ? {} : { screen: 'event' }),
      error: null,
    });
  },

  continueWeekReview() {
    guarded(set, () => {
      const career = requireCareer(get());
      const reconciled = reconcilePendingCareerEvent(
        career,
        launchContent.events,
      );
      set({
        career: reconciled,
        weekReview: null,
        screen:
          reconciled.phase === 'season-end' || reconciled.phase === 'complete'
            ? seasonBoundaryScreen(reconciled)
            : // A story is the top of the week it was drawn for, not a toll on the
              // way out of it. The manager reads it on arrival and then has the
              // whole week to act on what it did, rather than meeting it as an
              // ambush on the Advance Week press seven days later.
              reconciled.pendingEvent !== undefined
              ? 'event'
              : 'management',
        activeTab: 'home',
        error: null,
      });
      if (reconciled !== career) queueCareerSave(get, set, reconciled);
    });
  },

  completeChampionshipCelebration() {
    guarded(set, () => {
      const career = requireCareer(get());
      // Deliberately unconditional, for the reason `completeEndgameCelebration`
      // gives: this is the only way off the screen, so it must never refuse and
      // strand a career on a watched cutscene. With nothing pending the marker
      // is a no-op and the boundary router still points somewhere sensible.
      const next = markChampionshipCelebrationComplete(career);
      // The title is celebrated first and the individual boards second, so the
      // ceremony is what the trophy hands off to — never the recap directly.
      set({ career: next, screen: seasonBoundaryScreen(next), error: null });
      queueCareerSave(get, set, next);
    });
  },

  completeSeasonPodium() {
    guarded(set, () => {
      const career = requireCareer(get());
      // Unconditional, for the reason the parade's own exit gives: this is the
      // only way off the screen, so it must never refuse and strand a career on
      // a watched cutscene.
      const next = markSeasonPodiumComplete(career);
      set({ career: next, screen: seasonBoundaryScreen(next), error: null });
      queueCareerSave(get, set, next);
    });
  },

  /**
   * Leaves an endgame celebration for whatever the boundary owes next.
   *
   * Deliberately unconditional, for the reason `completeAwardsCeremony` gives:
   * this is the only way off the screen, so it must never refuse and strand a
   * career on a watched cutscene.
   *
   * The D1 title the summit screen has just presented is flagged as celebrated
   * on the way out. Without that, marking the endgame complete would un-suppress
   * the ordinary league celebration and the manager would be told he had won
   * the league by a second screen, seconds later.
   */
  completeEndgameCelebration() {
    guarded(set, () => {
      const career = requireCareer(get());
      const superseded = endgameSupersedesLeagueTitle(career);
      const celebrated = markEndgameCelebrationComplete(career);
      // The Hall of Fame is banked HERE, before the season transition runs,
      // because this is the last moment the evidence exists: the transition
      // regenerates rival rosters and prunes the season's stat rows, and the
      // record is the club's whole career. `recordHallOfFame` no-ops unless
      // the true ending was just marked, so the two smaller celebrations pass
      // through it untouched.
      const next = recordHallOfFame(
        superseded
          ? markChampionshipCelebrationComplete(celebrated)
          : celebrated,
      );
      set({
        career: next,
        screen:
          next.phase === 'season-end' || next.phase === 'complete'
            ? seasonBoundaryScreen(next)
            : 'management',
        error: null,
      });
      if (next !== career) queueCareerSave(get, set, next);
    });
  },

  /**
   * Leaves the true ending's finale for the title screen.
   *
   * The last tap of the last cutscene lands where the game started rather than
   * on next season's desk. A manager who has just been thanked for playing
   * should not be dropped straight back into a fixture list; that would step on
   * the only ending the game has.
   *
   * The ordinary exit runs FIRST and this only redirects where it lands, so
   * everything that exit is responsible for — the flags that stop the moment
   * replaying, the Hall of Fame record, the save — happens exactly once and
   * cannot drift out of step with a second copy of it here. Nothing is lost by
   * leaving: the career is still there, and continuing it resumes at whatever
   * the season boundary owes next.
   */
  returnToTitleFromEnding() {
    get().completeEndgameCelebration();
    if (get().error !== null) return;
    set({
      screen: 'welcome',
      activeTab: 'home',
      inboxDutyReminder: null,
      inboxDutyFocus: null,
    });
  },

  /**
   * Leaves the awards ceremony for the season recap.
   *
   * Deliberately unconditional. This is the ONLY way off the ceremony screen,
   * so it must not be able to refuse: a career that reached it with the flag
   * already set, or with a phase that no longer matches, still has to be able
   * to reach the recap and start the next season. Nothing is granted here —
   * the transition pays the prize whether the ceremony was watched or skipped.
   */
  completeAwardsCeremony() {
    guarded(set, () => {
      const career = requireCareer(get());
      const next = markAwardsCeremonyComplete(career);
      set({
        career: next,
        screen:
          next.phase === 'season-end' || next.phase === 'complete'
            ? 'season-end'
            : 'management',
        error: null,
      });
      if (next !== career) queueCareerSave(get, set, next);
    });
  },

  chooseLegacy(choice) {
    guarded(set, () => {
      const transaction = resolveNextClubLegendLegacy(
        requireCareer(get()),
        choice,
      );
      const next = reconcilePendingClubLegends(transaction.state);
      set({
        career: next,
        screen:
          nextPendingClubLegend(next) === undefined ? 'management' : 'legacy',
        activeTab: 'home',
        error: null,
      });
      queueCareerSave(get, set, next);
    });
  },

  /**
   * Names the player this story is about.
   *
   * Takes the id outright rather than cycling to the next name. Cycling made
   * the choice a lottery: the manager tapped through the squad one at a time
   * with no way to compare them, and the card only ever described whoever the
   * last tap happened to land on.
   */
  selectEventPlayer(playerId) {
    guarded(set, () => {
      const career = requireCareer(get());
      if (career.pendingEvent === undefined)
        throw new Error('there is no active event');
      const event = launchContent.events.events.find(
        (candidate) => candidate.id === career.pendingEvent?.eventId,
      );
      if (
        event === undefined ||
        !careerEventTargetCandidates(career, event).playerIds.includes(playerId)
      ) {
        playerError('store.storyTargetNotEligible');
      }
      const eligiblePlayerIds = careerEventTargetCandidates(
        career,
        event,
      ).playerIds;
      const next = selectCareerEventPlayer(career, playerId, eligiblePlayerIds);
      set({ career: next, error: null });
      queueCareerSave(get, set, next);
    });
  },

  selectEventCoach(role) {
    guarded(set, () => {
      const career = requireCareer(get());
      if (career.pendingEvent === undefined)
        throw new Error('there is no active event');
      const event = launchContent.events.events.find(
        (candidate) => candidate.id === career.pendingEvent?.eventId,
      );
      if (
        event === undefined ||
        !careerEventTargetCandidates(career, event).coachRoles.includes(role)
      ) {
        playerError('store.storyTargetNotEligible');
      }
      const next = selectCareerEventCoach(career, role);
      set({ career: next, error: null });
      queueCareerSave(get, set, next);
    });
  },

  selectEventFacility(buildingId) {
    guarded(set, () => {
      const career = requireCareer(get());
      if (career.pendingEvent === undefined)
        throw new Error('there is no active event');
      const event = launchContent.events.events.find(
        (candidate) => candidate.id === career.pendingEvent?.eventId,
      );
      if (
        event === undefined ||
        !careerEventTargetCandidates(career, event).facilityIds.includes(
          buildingId,
        )
      ) {
        playerError('store.storyTargetNotEligible');
      }
      const next = selectCareerEventFacility(career, buildingId);
      set({ career: next, error: null });
      queueCareerSave(get, set, next);
    });
  },

  chooseEvent(choiceId) {
    guarded(set, () => {
      const career = requireCareer(get());
      const reconciled = reconcilePendingCareerEvent(
        career,
        launchContent.events,
      );
      if (reconciled.pendingEvent === undefined) {
        set({
          career: reconciled,
          screen: resumeScreen(reconciled),
          error: null,
        });
        if (reconciled !== career) queueCareerSave(get, set, reconciled);
        return;
      }
      if (reconciled.pendingEvent.resolvedChoiceId !== undefined) return;
      // Bert's safe-or-risky card is a one-time explanation, and picking a
      // choice is the proof it was read. Marking it here rather than only on
      // the way out means a career that is closed between the choice and the
      // outcome — or whose last save is coalesced away — never reopens with
      // the lesson still pending, and the manager is never taught the same
      // rule twice.
      const seen = reconciled.eventFlags.includes('m4:event-guide-seen')
        ? reconciled
        : {
            ...reconciled,
            eventFlags: [...reconciled.eventFlags, 'm4:event-guide-seen'],
          };
      try {
        const next = resolveCareerEventChoice(
          seen,
          launchContent.events,
          choiceId,
          t,
        );
        // The story may have knocked a starter out, in which case the engine
        // has already benched them. Say so, in the story's own words, rather
        // than letting the manager find a changed eleven on match day.
        const swap = forcedLineupSwap(
          seen,
          next,
          next.pendingEvent?.outcomeText ?? '',
        );
        set({
          career: next,
          error: null,
          ...(swap === null ? {} : { lineupChange: swap }),
        });
        queueCareerSave(get, set, next);
      } catch (error) {
        if (!(error instanceof InvalidCareerEventTargetError)) throw error;
        const repaired = reconcilePendingCareerEvent(
          reconciled,
          launchContent.events,
        );
        set({
          career: repaired,
          screen:
            repaired.pendingEvent === undefined
              ? resumeScreen(repaired)
              : 'event',
          error:
            repaired.pendingEvent === undefined
              ? null
              : t('storyEvent.chooseTargetFirst'),
        });
        if (repaired !== career) queueCareerSave(get, set, repaired);
      }
    });
  },

  continueAfterEvent() {
    guarded(set, () => {
      // Resolving a story writes the club's money, morale and roster, so it
      // honours the same saveBlocked pause as advanceCareer.
      if (get().saveBlocked) {
        playerError('store.seasonPausedBySaveFailure');
      }
      const career = requireCareer(get());
      const pending = career.pendingEvent;
      if (pending?.resolvedChoiceId === undefined) return;
      const guidedCareer = career.eventFlags.includes('m4:event-guide-seen')
        ? career
        : {
            ...career,
            eventFlags: [...career.eventFlags, 'm4:event-guide-seen'],
          };
      const continuation = continueResolvedCareerEvent(
        guidedCareer,
        launchContent.events,
      );
      const next =
        !continuation.followed &&
        (continuation.state.pendingMilestones?.length ?? 0) > 0
          ? settleWeeklyStory(continuation.state)
          : continuation.state;
      if (continuation.followed || next.pendingEvent !== undefined) {
        set({ career: next, screen: 'event', weekReview: null, error: null });
        queueCareerSave(get, set, next);
        return;
      }
      // Answering a story hands the week back rather than spending it. The
      // story is read entering the week, so "Return to the office" now returns
      // to the office — the manager still has the week to trade, train and
      // build on whatever the story just did to the club.
      set({
        career: next,
        screen:
          next.phase === 'matchday'
            ? 'matchday'
            : next.phase === 'season-end' || next.phase === 'complete'
              ? seasonBoundaryScreen(next)
              : 'management',
        activeTab: 'home',
        weekReview: null,
        error: null,
      });
      queueCareerSave(get, set, next);
    });
  },

  skipUnavailableEvent() {
    guarded(set, () => {
      const career = requireCareer(get());
      const next = skipUnavailableCareerEvent(career, launchContent.events);
      set({
        career: next,
        screen: resumeScreen(next),
        weekReview: null,
        error: null,
      });
      queueCareerSave(get, set, next);
    });
  },

  toggleHeroLicense(playerId) {
    guarded(set, () => {
      const career = requireCareer(get());
      const player = career.players.find(
        (candidate) =>
          candidate.id === playerId && candidate.clubId === career.userClubId,
      );
      if (player?.power === undefined)
        throw new Error('only heroes can receive a license');
      const selected = career.players
        .filter(
          (candidate) =>
            candidate.clubId === career.userClubId && candidate.licensed,
        )
        .map((candidate) => candidate.id)
        .filter((id) => id !== playerId);
      if (!player.licensed) {
        if (selected.length >= careerHeroLimit(career)) {
          playerError('store.unlicenseFirst');
        }
        selected.push(playerId);
      }

      let next = selectCareerLicensedHeroes(career, selected);
      if (!player.licensed) {
        const lineup = next.lineups.find(
          (candidate) => candidate.clubId === next.userClubId,
        );
        if (lineup === undefined)
          throw new Error('the user club has no lineup');
        if (!lineup.playerIds.includes(playerId)) {
          const playerById = new Map(
            next.players.map((candidate) => [candidate.id, candidate]),
          );
          const outgoing =
            lineup.playerIds
              .map((id) => playerById.get(id))
              .find(
                (candidate) =>
                  candidate?.power !== undefined &&
                  !candidate.licensed &&
                  candidate.role === player.role,
              ) ??
            lineup.playerIds
              .map((id) => playerById.get(id))
              .find(
                (candidate) =>
                  candidate?.power !== undefined &&
                  !candidate.licensed &&
                  candidate.role !== 'GK' &&
                  player.role !== 'GK',
              );
          if (outgoing === undefined) {
            throw new Error(
              'bench an unlicensed hero in the same role before making this swap',
            );
          }
          next = setCareerLineup(
            next,
            lineup.playerIds.map((id) => (id === outgoing.id ? playerId : id)),
          );
        }
      }
      set({ career: next, error: null });
      queueCareerSave(get, set, next);
    });
  },

  swapStartingPlayer(starterId, replacementId) {
    guarded(set, () => {
      const next = swapCareerLineupPlayer(
        requireCareer(get()),
        starterId,
        replacementId,
      );
      set({ career: next, error: null });
      queueCareerSave(get, set, next);
    });
  },

  resolvePlayerRequest(resolution: PlayerRequestResolution) {
    guarded(set, () => {
      const career = requireCareer(get());
      const catalog = career.playerRequestRules;
      if (catalog === undefined)
        throw new Error('this career has no player request catalog');
      const next = resolveCareerPlayerRequest(career, catalog, resolution);
      set({ career: next, error: null });
      queueCareerSave(get, set, next);
    });
  },

  acceptSponsorOffer(offerId) {
    guarded(set, () => {
      const career = requireCareer(get());
      const sponsorship = acceptCareerSponsorOffer(
        career.clubBusiness.sponsorship,
        {
          offerId,
          season: career.season,
          week: career.week,
        },
      );
      const next = {
        ...career,
        clubBusiness: { ...career.clubBusiness, sponsorship },
      };
      const signed = sponsorship.activeContracts.find(
        (contract) => contract.contractId === `contract-${offerId}`,
      );
      const actualSigned =
        signed === undefined
          ? undefined
          : allocateSponsorPortfolioPayment(
              sponsorship.activeContracts,
              difficultyRules(career).sponsorIncomePercent,
            ).find((payment) => payment.contractId === signed.contractId)
              ?.actualAmount;
      set({
        career: next,
        error: null,
        notice:
          signed === undefined
            ? null
            : {
                tone: 'success',
                message:
                  actualSigned === undefined ||
                  actualSigned === signed.nominalMonthlyFee
                    ? t('store.sponsorSigned', {
                        sponsor: signed.sponsorName,
                        amount: formatIntegerForCopy(
                          t,
                          signed.nominalMonthlyFee,
                        ),
                      })
                    : t('store.sponsorSignedChairman', {
                        sponsor: signed.sponsorName,
                        nominal: formatIntegerForCopy(
                          t,
                          signed.nominalMonthlyFee,
                        ),
                        actual: formatIntegerForCopy(t, actualSigned),
                      }),
              },
      });
      queueCareerSave(get, set, next);
    });
  },

  chooseSponsorWeeklyChallenge(kind) {
    guarded(set, () => {
      const career = requireCareer(get());
      const sponsorship = acceptCareerSponsorWeeklyChallenge(
        career.clubBusiness.sponsorship,
        career.fixtures,
        career.userClubId,
        career.season,
        career.week,
        kind,
      );
      const next = {
        ...career,
        clubBusiness: { ...career.clubBusiness, sponsorship },
      };
      set({
        career: next,
        error: null,
        notice: {
          tone: 'success',
          message: t('store.sponsorSprintAccepted'),
        },
      });
      queueCareerSave(get, set, next);
    });
  },

  selectPlayer(selectedPlayerId) {
    set({ selectedPlayerId, error: null });
  },

  trainPlayer(playerId, pathId) {
    guarded(set, () => {
      const career = requireCareer(get());
      const resolution = trainPlayerInstantly(career, playerId, pathId);
      const next = hasAssistantGuideMilestone(
        resolution.state,
        'first-training-complete',
      )
        ? resolution.state
        : completeAssistantGuideMilestone(
            resolution.state,
            'first-training-complete',
          );
      const { state: _state, ...result } = resolution;
      set({
        career: next,
        lastDrillResult: {
          ...result,
          sequence: (get().lastDrillResult?.sequence ?? 0) + 1,
          totalDrillsRun: next.totalInstantDrills ?? 0,
        },
        error: null,
      });
      queueCareerSave(get, set, next);
    });
  },

  trainPlayerBatch(playerId, pathId, runs) {
    guarded(set, () => {
      let career = requireCareer(get());
      let sequence = get().lastDrillResult?.sequence ?? 0;
      let last: InstantDrillResult | null = null;
      let injuredAfter: number | undefined;

      for (let run = 0; run < runs; run += 1) {
        const player = career.players.find(
          (candidate) => candidate.id === playerId,
        );
        // An injury ends the batch here exactly as it ends a watched one — the
        // engine would refuse the next drill anyway, and being skipped past is
        // no reason to train a player who has pulled up.
        if (player === undefined || player.injuryWeeks > 0) break;
        const { state, ...result } = trainPlayerInstantly(
          career,
          playerId,
          pathId,
        );
        career = state;
        sequence += 1;
        last = {
          ...result,
          sequence,
          totalDrillsRun: career.totalInstantDrills ?? 0,
        };
        if (result.injury !== undefined) {
          injuredAfter = result.injury.recoveryWeeks;
          break;
        }
      }

      if (last === null) return;
      const next = hasAssistantGuideMilestone(career, 'first-training-complete')
        ? career
        : completeAssistantGuideMilestone(career, 'first-training-complete');
      const injuredPlayer = next.players.find(
        (candidate) => candidate.id === playerId,
      );
      set({
        career: next,
        lastDrillResult: last,
        error: null,
        // The skipped drills reported themselves in silence; an injury among
        // them cannot. It is why the rest of the batch did not run.
        ...(injuredAfter === undefined
          ? {}
          : {
              notice: {
                tone: 'info' as const,
                message: t('store.trainingInjury', {
                  player: injuredPlayer?.name ?? t('store.thePlayer'),
                  n: injuredAfter,
                  count: injuredAfter,
                }),
              },
            }),
      });
      queueCareerSave(get, set, next);
    });
  },

  purchaseTrainingUpgrade(pathId) {
    guarded(set, () => {
      const transaction = purchaseCareerTrainingUpgrade(
        requireCareer(get()),
        pathId,
      );
      set({
        career: transaction.state,
        error: null,
        notice: {
          tone: 'success',
          message: t('store.drillsUpgraded', {
            path: copyOrEnglish(
              t,
              trainingPathLabelKey(pathId),
              trainingPathLabel(pathId),
            ),
            tier: transaction.offer.tier,
          }),
        },
      });
      queueCareerSave(get, set, transaction.state);
    });
  },

  purchaseHeroLicense() {
    guarded(set, () => {
      const transaction = purchaseCareerHeroLicense(requireCareer(get()));
      set({
        career: transaction.state,
        error: null,
        notice: {
          tone: 'success',
          message: t('store.heroLicenseBought', {
            license: transaction.offer.licenseNumber,
          }),
        },
      });
      queueCareerSave(get, set, transaction.state);
    });
  },

  clearDrillResult() {
    set({ lastDrillResult: null });
  },

  buildFacility() {
    guarded(
      set,
      () => {
        const current = get();
        const blocked = blockedInboxDutyForAction(
          current,
          current.inboxDutyFocus?.mode === 'focused' &&
            current.inboxDutyFocus.dutyId === 'facility-placement',
        );
        if (blocked !== undefined) {
          set({ inboxDutyReminder: [blocked], error: null });
          return;
        }
        const next = buildTrainingGround(requireCareer(current));
        set({
          career: next,
          error: null,
          ...inboxDutyProgressPatch(current, next),
        });
        queueCareerSave(get, set, next);
      },
      facilityTransactionErrorCopy,
    );
  },

  buildClubFacility(type, position) {
    guarded(
      set,
      () => {
        const current = get();
        const focus = current.inboxDutyFocus;
        const allowed =
          focus?.mode === 'focused' &&
          ((focus.dutyId === 'facility-placement' &&
            type === 'training-pitch') ||
            (focus.dutyId === 'coaching-office' && type === 'coaching-office'));
        const blocked = blockedInboxDutyForAction(current, allowed);
        if (blocked !== undefined) {
          set({ inboxDutyReminder: [blocked], error: null });
          return;
        }
        const career = requireCareer(current);
        if (
          type !== 'coaching-office' &&
          outstandingInboxDuties(career).includes('coaching-office')
        ) {
          // Keep this guard below the UI as well. A stale confirmation, keyboard
          // action, or direct store call must not spend money on the wrong build
          // while the Coaching Office is this week's required desk job.
          set({
            inboxDutyReminder: ['coaching-office'],
            error: null,
            notice: null,
          });
          return;
        }
        if (type !== 'training-pitch' && openingTrainingPitchRequired(career)) {
          set({
            error: null,
            notice: {
              tone: 'info',
              message: t(OPENING_TRAINING_PITCH_REMINDER_KEY),
            },
          });
          return;
        }
        const transaction = buildCareerFacility(career, type, position);
        const discovery =
          transaction.newlyDiscoveredAdjacencies.length === 0
            ? ''
            : // Glued rather than authored with a leading space: no catalog entry
              // carries edge whitespace, and a translator cannot be asked to keep it.
              ` ${t('store.adjacencyDiscovered', {
                adjacencies: transaction.newlyDiscoveredAdjacencies
                  .map((id) => adjacencyDescription(t, id))
                  .join(', '),
              })}`;
        set({
          career: transaction.state,
          error: null,
          notice: {
            tone: 'success',
            message: t('store.facilityBuildStarted', {
              facility: facilityName(t, type),
              discovery,
            }),
          },
          ...inboxDutyProgressPatch(current, transaction.state),
        });
        queueCareerSave(get, set, transaction.state);
      },
      facilityTransactionErrorCopy,
    );
  },

  upgradeClubFacility(buildingId) {
    guarded(
      set,
      () => {
        const current = get();
        const blocked = blockedInboxDutyForAction(current, false);
        if (blocked !== undefined) {
          set({ inboxDutyReminder: [blocked], error: null });
          return;
        }
        const career = requireCareer(current);
        const building = career.facilities.grid?.buildings.find(
          (candidate) => candidate.id === buildingId,
        );
        if (building === undefined)
          throw new Error(`unknown facility ${buildingId}`);
        const transaction = upgradeCareerFacility(career, buildingId);
        const discovery =
          transaction.newlyDiscoveredAdjacencies.length === 0
            ? ''
            : // Glued rather than authored with a leading space: no catalog entry
              // carries edge whitespace, and a translator cannot be asked to keep it.
              ` ${t('store.adjacencyDiscovered', {
                adjacencies: transaction.newlyDiscoveredAdjacencies
                  .map((id) => adjacencyDescription(t, id))
                  .join(', '),
              })}`;
        set({
          career: transaction.state,
          error: null,
          notice: {
            tone: 'success',
            message: t('store.facilityUpgradeStarted', {
              facility: facilityName(t, building.type),
              discovery,
            }),
          },
        });
        queueCareerSave(get, set, transaction.state);
      },
      facilityTransactionErrorCopy,
    );
  },

  relocateClubFacility(buildingId, position) {
    guarded(
      set,
      () => {
        const blocked = blockedInboxDutyForAction(get(), false);
        if (blocked !== undefined) {
          set({ inboxDutyReminder: [blocked], error: null });
          return;
        }
        const transaction = relocateCareerFacility(
          requireCareer(get()),
          buildingId,
          position,
        );
        const discovery =
          transaction.newlyDiscoveredAdjacencies.length === 0
            ? ''
            : // Glued rather than authored with a leading space: no catalog entry
              // carries edge whitespace, and a translator cannot be asked to keep it.
              ` ${t('store.adjacencyDiscovered', {
                adjacencies: transaction.newlyDiscoveredAdjacencies
                  .map((id) => adjacencyDescription(t, id))
                  .join(', '),
              })}`;
        set({
          career: transaction.state,
          error: null,
          notice: {
            tone: 'success',
            message: t('store.facilityMoved', { discovery }),
          },
        });
        queueCareerSave(get, set, transaction.state);
      },
      facilityTransactionErrorCopy,
    );
  },

  closeClubFacility(buildingId) {
    guarded(
      set,
      () => {
        const current = get();
        const blocked = blockedInboxDutyForAction(current, false);
        if (blocked !== undefined) {
          set({ inboxDutyReminder: [blocked], error: null });
          return;
        }
        const career = requireCareer(current);
        const building = career.facilities.grid?.buildings.find(
          (candidate) => candidate.id === buildingId,
        );
        if (building === undefined)
          throw new Error(`unknown facility ${buildingId}`);
        const staffedOffice =
          building.type === 'coaching-office' &&
          career.market?.assistantCoach !== undefined;
        if (staffedOffice) {
          const transaction = closeStaffedCareerCoachingOffice(
            career,
            buildingId,
          );
          const net = transaction.confirmation.netCashEffect;
          set({
            career: transaction.state,
            error: null,
            notice: {
              tone: 'info',
              message: t('store.coachingOfficeClosed', {
                facility: facilityName(t, building.type),
                amount: formatMoneyForCopy(t, net, true),
              }),
            },
          });
          queueCareerSave(get, set, transaction.state);
          return;
        }
        const transaction = closeCareerFacility(career, buildingId);
        const refund = -transaction.cost;
        set({
          career: transaction.state,
          error: null,
          notice: {
            tone: 'info',
            message:
              refund === 0
                ? t('store.facilityClosed', {
                    facility: facilityName(t, building.type),
                  })
                : t('store.facilityClosedRefund', {
                    facility: facilityName(t, building.type),
                    amount: formatIntegerForCopy(t, refund),
                  }),
          },
        });
        queueCareerSave(get, set, transaction.state);
      },
      facilityTransactionErrorCopy,
    );
  },

  startScoutMission(optionId) {
    guarded(set, () => {
      const career = requireCareer(get());
      const market = requireMarket(career);
      const option = careerMarketScoutOptions(career, t).find(
        (candidate) => candidate.id === optionId,
      );
      if (option === undefined)
        throw new Error(`unknown scouting brief ${optionId}`);
      const transaction = startCareerScoutMission(
        career,
        market,
        option.region,
        option.focus,
        highestDivisionReached(career),
      );
      const next = { ...transaction.state, market: transaction.market };
      set({
        career: next,
        error: null,
        ...(transaction.market.activeScoutMissionFeeWaived === true
          ? {
              notice: {
                tone: 'info' as const,
                speaker: 'bert' as const,
                message: t('store.scoutTripFree'),
              },
            }
          : {}),
      });
      queueCareerSave(get, set, next);
    });
  },

  openScoutReport(playerId) {
    const career = get().career;
    if (
      career?.market?.scoutReports.some(
        (report) => report.playerId === playerId,
      ) !== true
    ) {
      set({ error: t('store.scoutReportUnavailable') });
      return;
    }
    set({ notice: { tone: 'info', message: t('store.scoutReportRanges') } });
  },

  dismissScoutReport(playerId) {
    guarded(set, () => {
      const career = requireCareer(get());
      const market = dismissCareerScoutReport(requireMarket(career), playerId);
      const next = { ...career, market };
      set({ career: next, error: null });
      queueCareerSave(get, set, next);
    });
  },

  buyDetailedScoutReport(playerId) {
    guarded(set, () => {
      const career = requireCareer(get());
      const transaction = startDetailedScoutReport(
        career,
        requireMarket(career),
        playerId,
        currentCareerDivision(career),
      );
      const next = { ...transaction.state, market: transaction.market };
      set({ career: next, error: null });
      queueCareerSave(get, set, next);
    });
  },

  completeStoryCallback(callbackId) {
    const career = requireCareer(get());
    const next = dismissStoryCallback(career, callbackId);
    set({ career: next });
    queueCareerSave(get, set, next);
  },

  actOnTransfer(playerId, direction, bidId) {
    guardedTransfer(set, () => {
      const career = requireCareer(get());
      const market = requireMarket(career);
      if (direction === 'BUY') {
        const nextMarket = beginCareerTransferTalks(
          career,
          market,
          playerId,
          currentCareerDivision(career),
        );
        const cash = career.clubs.find(
          (club) => club.id === career.userClubId,
        )!.cash;
        assertTransferCashAvailable(
          cash,
          nextMarket.transferTalks!.transferQuote.fee,
        );
        const next = { ...career, market: nextMarket };
        set({ career: next, error: null });
        queueCareerSave(get, set, next);
        return;
      }
      const listing = (market.transferListings ?? []).find(
        (candidate) => candidate.playerId === playerId,
      );
      if (listing === undefined) {
        const nextMarket = listCareerPlayer(
          career,
          market,
          playerId,
          currentCareerDivision(career),
        );
        const next = { ...career, market: nextMarket };
        const bidCount =
          nextMarket.transferListings?.find(
            (candidate) => candidate.playerId === playerId,
          )?.bids.length ?? 0;
        set({
          career: next,
          error: null,
          notice: {
            tone: 'info',
            message: t('store.playerListed', { n: bidCount, count: bidCount }),
          },
        });
        queueCareerSave(get, set, next);
        return;
      }
      if (bidId === undefined)
        throw new Error('choose a club bid before accepting the transfer');
      const bid = listing.bids.find((candidate) => candidate.id === bidId);
      if (bid === undefined)
        throw new Error('that transfer bid is no longer available');
      const buyer = career.clubs.find((club) => club.id === bid.buyerClubId);
      const transaction = acceptCareerTransferBid(career, market, bidId);
      const next = { ...transaction.state, market: transaction.market };
      set({
        career: next,
        error: null,
        notice: {
          tone: 'success',
          message: t('store.transferSold', {
            club: buyer?.name ?? t('store.theBuyingClub'),
            fee: formatIntegerForCopy(t, bid.quote.fee),
          }),
        },
      });
      queueCareerSave(get, set, next);
    });
  },

  hireCoach(coachId, role = 'HEAD') {
    guarded(set, () => {
      const current = get();
      const allowed =
        current.inboxDutyFocus?.mode === 'focused' &&
        ((current.inboxDutyFocus.dutyId === 'head-coach-market' &&
          role === 'HEAD') ||
          (current.inboxDutyFocus.dutyId === 'assistant-coach-hire' &&
            role === 'ASSISTANT'));
      const blocked = blockedInboxDutyForAction(current, allowed);
      if (blocked !== undefined) {
        set({ inboxDutyReminder: [blocked], error: null });
        return;
      }
      const career = requireCareer(current);
      const hired = {
        ...career,
        market: hireCareerCoach(career, requireMarket(career), coachId, role),
      };
      const next =
        role === 'ASSISTANT'
          ? completeAssistantGuideSequence(hired, 'assistant-coach-hire')
          : hired;
      set({
        career: next,
        error: null,
        notice: {
          tone: 'success',
          message:
            role === 'HEAD'
              ? t('store.headCoachHired')
              : t('store.assistantCoachHired'),
        },
        ...inboxDutyProgressPatch(current, next),
      });
      queueCareerSave(get, set, next);
    });
  },

  protectBoardCandidate(playerId) {
    guarded(set, () => {
      const next = protectBoardUltimatumPlayer(requireCareer(get()), playerId);
      const player = next.players.find(
        (candidate) => candidate.id === playerId,
      );
      set({
        career: next,
        error: null,
        notice: {
          tone: 'info',
          message: t('store.playerProtected', {
            player: player?.name ?? t('store.playerFallback'),
          }),
        },
      });
      queueCareerSave(get, set, next);
    });
  },

  dismissCoach(role = 'HEAD') {
    guarded(set, () => {
      const current = get();
      const blocked = blockedInboxDutyForAction(current, false);
      if (blocked !== undefined) {
        set({ inboxDutyReminder: [blocked], error: null });
        return;
      }
      const career = requireCareer(current);
      const transaction = dismissCareerCoach(
        career,
        requireMarket(career),
        role,
      );
      const next = { ...transaction.state, market: transaction.market };
      set({ career: next, error: null });
      queueCareerSave(get, set, next);
    });
  },

  buyCoachSpeech() {
    guarded(set, () => {
      const current = get();
      const blocked = blockedInboxDutyForAction(current, false);
      if (blocked !== undefined) {
        set({ inboxDutyReminder: [blocked], error: null });
        return;
      }
      const career = requireCareer(current);
      const next = purchaseCoachSpeech(career);
      // A refused purchase changes nothing, so say nothing: the button is
      // already disabled with the reason on it.
      if (next === career) return;
      set({ career: next, error: null });
      queueCareerSave(get, set, next);
    });
  },

  signYouth(playerId) {
    guarded(set, () => {
      const current = get();
      const allowed =
        current.inboxDutyFocus?.mode === 'focused' &&
        current.inboxDutyFocus.dutyId === 'youth-intake';
      const blocked = blockedInboxDutyForAction(current, allowed);
      if (blocked !== undefined) {
        set({ inboxDutyReminder: [blocked], error: null });
        return;
      }
      const career = requireCareer(current);
      if (career.youthIntake === undefined)
        throw new Error('there is no youth intake available');
      const transaction = signYouthIntakeOffer(
        career,
        career.youthIntake,
        playerId,
      );
      const next = { ...transaction.state, youthIntake: transaction.intake };
      set({
        career: next,
        error: null,
        ...inboxDutyProgressPatch(current, next),
      });
      queueCareerSave(get, set, next);
    });
  },

  declineYouth() {
    guarded(set, () => {
      const current = get();
      const career = requireCareer(current);
      if (outstandingInboxDuties(career).includes('youth-intake')) {
        set({ inboxDutyReminder: ['youth-intake'], error: null });
        return;
      }
      const blocked = blockedInboxDutyForAction(current, false);
      if (blocked !== undefined) {
        set({ inboxDutyReminder: [blocked], error: null });
        return;
      }
      if (career.youthIntake === undefined)
        throw new Error('there is no youth intake available');
      const transaction = declineYouthIntakeOffers(career, career.youthIntake);
      const next = { ...transaction.state, youthIntake: transaction.intake };
      set({ career: next, error: null });
      queueCareerSave(get, set, next);
    });
  },

  submitTransferOffer(offer, pitchCard) {
    guarded(set, () => {
      const career = requireCareer(get());
      const negotiatedMarket = submitCareerTransferOffer(
        career,
        requireMarket(career),
        offer,
        pitchCard,
      );
      if (negotiatedMarket.transferTalks?.negotiation.status === 'ACCEPTED') {
        const transaction = completeCareerTransfer(career, negotiatedMarket);
        const next = { ...transaction.state, market: transaction.market };
        set({
          career: next,
          error: null,
          notice: {
            tone: 'success',
            message:
              userCareerRosterCount(next) >= careerRosterCapacity(next)
                ? t('store.transferCompleteSquadFull')
                : t('playerSigning.transferComplete'),
          },
        });
        queueCareerSave(get, set, next);
        return;
      }
      const consequence = applyCareerNegotiationConsequence(
        career,
        negotiatedMarket,
        'transfer',
      );
      const next = { ...consequence.state, market: consequence.market };
      set({
        career: next,
        error:
          consequence.market !== negotiatedMarket
            ? t('store.agentWalkedAway')
            : null,
      });
      queueCareerSave(get, set, next);
    });
  },

  closeTransferTalks() {
    guarded(set, () => {
      const career = requireCareer(get());
      const market = requireMarket(career);
      const next = {
        ...career,
        market: closeCareerTransferTalks(career, market),
      };
      set({ career: next, error: null });
      queueCareerSave(get, set, next);
    });
  },

  setContractTerm(selectedContractTerm) {
    set({ selectedContractTerm, error: null });
  },

  renewPlayer(playerId, term) {
    guarded(set, () => {
      const career = requireCareer(get());
      const market = requireMarket(career);
      // Signs at the agent's asking price with no promise attached. Priced by
      // the same `careerRenewalWeeklyAsk` the negotiation opens with and gated
      // by the same loyalty and abandoned-agent checks, so this can never be a
      // cheaper renewal — or a way past a player who will not re-sign.
      const transaction = signCareerRenewalAtAsk(
        career,
        market,
        playerId,
        term ?? get().selectedContractTerm,
      );
      const next = { ...transaction.state, market: transaction.market };
      set({
        career: next,
        selectedContractTerm: 1,
        error: null,
        notice: { tone: 'success', message: t('store.contractRenewedAtAsk') },
      });
      queueCareerSave(get, set, next);
    });
  },

  startRenewal(playerId) {
    guarded(set, () => {
      const career = requireCareer(get());
      const next = {
        ...career,
        market: beginCareerRenewalTalks(
          career,
          requireMarket(career),
          playerId,
        ),
      };
      set({ career: next, error: null });
      queueCareerSave(get, set, next);
    });
  },

  submitRenewalOffer(offer, pitchCard) {
    guarded(set, () => {
      const career = requireCareer(get());
      const heroLimit = projectedSeasonEndContractPromiseHeroLimit(career);
      const negotiated = submitCareerRenewalOffer(
        career,
        requireMarket(career),
        offer,
        pitchCard,
        heroLimit,
      );
      if (negotiated.renewalTalks?.negotiation.status === 'ACCEPTED') {
        const transaction = completeCareerRenewal(
          career,
          negotiated,
          heroLimit,
        );
        const next = { ...transaction.state, market: transaction.market };
        set({
          career: next,
          selectedContractTerm: 1,
          error: null,
          notice: { tone: 'success', message: t('store.contractRenewed') },
        });
        queueCareerSave(get, set, next);
        return;
      }
      const consequence = applyCareerNegotiationConsequence(
        career,
        negotiated,
        'renewal',
      );
      const next = { ...consequence.state, market: consequence.market };
      // Outcome-specific, and on the right channel. The insult message used to
      // travel on `error` while describing a penalty, and a genuine three-round
      // walk-away produced no message at all -- it is only surfaced inline in
      // the panel. No penalty is invented for the walk-away: doc 06 assigns
      // morale and fame damage to insulting offers only, and `submitContractOffer`
      // is shared with transfers, so adding one here would reprice those too.
      const status = negotiated.renewalTalks?.negotiation.status;
      const insulted = consequence.market !== negotiated;
      set({
        career: next,
        error: null,
        notice: insulted
          ? {
              // 'info' rather than a new tone: the notice palette is info/success
              // by design, and a bad-news cue belongs to the error banner, which
              // this deliberately no longer uses -- nothing failed, the manager
              // made a choice and it landed badly.
              tone: 'info' as const,
              message: t('store.offerCausedOffence'),
            }
          : status === 'REJECTED'
            ? {
                tone: 'info' as const,
                message: t('store.agentWalkedNoHardFeelings'),
              }
            : null,
      });
      queueCareerSave(get, set, next);
    });
  },

  closeRenewal() {
    guarded(set, () => {
      const career = requireCareer(get());
      const next = {
        ...career,
        market: closeCareerRenewalTalks(career, requireMarket(career)),
      };
      set({ career: next, error: null });
      queueCareerSave(get, set, next);
    });
  },

  releasePlayer(playerId) {
    guarded(set, () => {
      const next = releaseCareerPlayer(requireCareer(get()), playerId);
      set({
        career: next,
        error: null,
      });
      queueCareerSave(get, set, next);
    });
  },

  notify(message, tone = 'info') {
    set({ notice: { message, tone } });
  },

  clearError() {
    set({ error: null });
  },

  clearNotice() {
    set({ notice: null });
  },

  clearLineupChange() {
    set({ lineupChange: null });
  },
}));

function currentMatchday(state: GameState) {
  if (state.phase !== 'matchday')
    throw new Error('there is no active matchday');
  const matchday = activeCareerMatchday(state);
  if (matchday === undefined)
    throw new Error('the matchday has no user fixture');
  const { fixture, fixtures } = matchday;
  const builtTeams = buildCareerMatchTeams(state, [
    ...new Set(
      fixtures.flatMap((candidate) => [
        candidate.homeClubId,
        candidate.awayClubId,
      ]),
    ),
  ]);
  const teams = isFirstOnboardingFixture(state, fixture.id)
    ? {
        ...builtTeams,
        // The new club still earns its first power through the awakening. The
        // division rival keeps his authored power so the teaser is honest and
        // his live red rail meter can charge and fire in this match.
        [state.userClubId]: withoutPowers(builtTeams[state.userClubId]),
      }
    : builtTeams;
  return {
    kind: matchday.kind,
    fixture,
    fixtures,
    teams,
    cupRoundLabel: matchday.cupRoundLabel,
  };
}

function requireMarket(state: GameState): NonNullable<GameState['market']> {
  if (state.market === undefined)
    throw new Error('the career market is unavailable');
  return state.market;
}

function currentCareerDivision(state: GameState): number {
  return state.m2 === undefined ? 5 : currentUserDivision(state.m2);
}

function resumeScreen(career: GameState): M1Screen {
  if (career.onboarding?.stage === 'create-player') return 'create-player';
  if (
    career.awakening.pending !== undefined ||
    career.onboarding?.stage === 'reveal'
  )
    return 'awakening';
  // Relaunching with a story open resumes it. Nothing records that the card was
  // opened, so treating the offer itself as "resume here" is what keeps a story
  // from being lost between a kill and the next launch.
  if (career.pendingEvent !== undefined) return 'event';
  const midseasonTraining = midseasonTrainingStatus(career);
  if (midseasonTraining === 'celebration') return 'midseason-training';
  if (midseasonTraining === 'prompt') return 'management';
  if (career.phase === 'matchday') return 'matchday';
  if (career.phase === 'season-end' || career.phase === 'complete') {
    return seasonBoundaryScreen(career);
  }
  if (nextPendingClubLegend(career) !== undefined) return 'legacy';
  return 'management';
}

/**
 * What the manager sees on arriving at a season boundary.
 *
 * The one router for every route into the recap — the final whistle, a week
 * review, a relaunch, and the recap's own advance all ask it — so a boundary
 * presentation cannot be skipped by arriving from an unusual direction, and a
 * presentation already seen cannot be re-entered by backing into one.
 */
/**
 * The announcement for the week the club has just arrived in, or the one
 * already waiting when no week turned over.
 *
 * Every route into a new week has to ask this, not just the Advance Week
 * press. A match week settles into the NEXT week inside `completeMatchday`,
 * so the desk the manager returns to after a result can already be another
 * match week — and while the announcement hung off the Advance press alone,
 * every one of those weeks arrived in silence. That is most of a season: on a
 * full fixture list, match weeks are usually reached from other match weeks.
 */
function matchDayBannerOnArrival(
  before: GameState,
  next: GameState,
  waiting: MatchDayBannerViewModel | null,
): MatchDayBannerViewModel | null {
  if (next.week === before.week && next.season === before.season)
    return waiting;
  return matchDayBannerViewModel(next, t);
}

function seasonBoundaryScreen(career: GameState): M1Screen {
  if (hasPendingChampionshipCelebration(career))
    return 'championship-celebration';
  // The same slot as the parade, and never at the same time as it: one fires on
  // first place, the other on second and third.
  if (hasPendingSeasonPodium(career)) return 'season-podium';
  // After the ordinary title, never before it. A D1 title that fires an endgame
  // moment suppresses the ordinary screen outright, so the only case where both
  // play is a lesser division's title in the season the Cup completed the pair
  // — and there the smaller news should land first and the summit last.
  if (pendingEndgameCelebration(career) !== undefined)
    return 'endgame-celebration';
  return hasPendingAwardsCeremony(career) ? 'awards-ceremony' : 'season-end';
}

/**
 * Everything a loaded save needs before the UI touches it: roster reconciliation,
 * the legacy first-awakening repair, and the two content fail-softs that keep a
 * save whose authored content this build no longer ships from bricking.
 */
function reconcileLoadedCareer(state: GameState): GameState {
  return reconcilePendingAwakeningContent(
    reconcilePendingStoryEvent(
      reconcileLegacyFirstAwakening(
        // Licenses first: a save written before license changes benched anyone
        // can hold an unlicensed hero in the eleven, and that only surfaces at
        // Play Match as "Hero <id> must be licensed or benched" -- past every
        // point weekly settlement would have repaired it.
        reconcileCareerLineupLicenses(
          reconcileLaunchRoster(state, launchContent),
        ),
      ),
      launchContent.events,
    ),
  );
}

/**
 * Keeps a persisted awakening cutscene renderable when its authored content is
 * gone. Content ships as data, so a later drop can retire the trigger or power
 * copy a saved cutscene points at; the cutscene view model throws on the missing
 * id, and because the pending awakening is persisted it throws again on every
 * relaunch. The trigger is only the visual cause, so it is re-pointed at the
 * campaign's first one; a power with no copy left costs the cutscene, never the
 * power itself, which was already granted to the player before this ran.
 */
function reconcilePendingAwakeningContent(state: GameState): GameState {
  const pending = state.awakening.pending;
  if (pending === undefined) return state;
  const triggerId = awakeningTriggerIds.includes(pending.triggerId)
    ? pending.triggerId
    : awakeningTriggerIds[0];
  const hasPowerContent =
    launchContent.powers.powers.some((power) => power.id === pending.power) &&
    launchContent.onboarding.powers.some(
      (copy) => copy.powerId === pending.power,
    );
  if (triggerId !== undefined && hasPowerContent) {
    if (triggerId === pending.triggerId) return state;
    return {
      ...state,
      awakening: { ...state.awakening, pending: { ...pending, triggerId } },
    };
  }

  return {
    ...state,
    awakening: {
      matchesSinceLastAwakening: state.awakening.matchesSinceLastAwakening,
      usedTriggerIds: [...state.awakening.usedTriggerIds],
      // The hero was granted before this ran, so the season has still spent
      // one. Dropping the cutscene must not hand the allowance back.
      ...(state.awakening.seasonTally === undefined
        ? {}
        : { seasonTally: { ...state.awakening.seasonTally } }),
    },
    // Onboarding waits at `reveal` for this cutscene, and `advanceCareer` sends
    // the player back to it, so the stage has to move on with the drop.
    ...(pending.firstHero &&
    state.onboarding !== undefined &&
    state.onboarding.stage !== 'complete'
      ? { onboarding: { ...state.onboarding, stage: 'complete' as const } }
      : {}),
  };
}

function reconcileLegacyFirstAwakening(state: GameState): GameState {
  if (state.awakening.pending !== undefined) return state;
  const onboarding = state.onboarding;
  if (
    onboarding?.stage === 'collapse' &&
    onboarding.firstFixtureId !== undefined
  ) {
    const lineup = state.lineups.find(
      (candidate) => candidate.clubId === state.userClubId,
    );
    if (lineup === undefined)
      throw new Error('legacy first awakening is missing the user lineup');
    return resolvePostMatchAwakening(
      state,
      onboarding.firstFixtureId,
      lineup.playerIds,
      awakeningPowerIds,
      awakeningTriggerIds,
      awakeningTuning,
    ).state;
  }
  if (
    onboarding?.stage === 'reveal' &&
    onboarding.firstFixtureId !== undefined &&
    onboarding.createdPlayerId !== undefined &&
    onboarding.awakenedPower !== undefined
  ) {
    return {
      ...state,
      awakening: {
        matchesSinceLastAwakening: 0,
        usedTriggerIds: [awakeningTriggerIds[0]],
        // The repaired save already has its opening hero, and that hero counts
        // against the season cap like any other. Without this the rebuilt
        // career would think season 1 had spent nothing.
        seasonTally: {
          season: state.season,
          count: Math.max(1, awakeningsThisSeason(state)),
        },
        pending: {
          fixtureId: onboarding.firstFixtureId,
          playerId: onboarding.createdPlayerId,
          power: onboarding.awakenedPower,
          triggerId: awakeningTriggerIds[0],
          firstHero: true,
        },
      },
    };
  }
  return state;
}

function requireCareer(state: Pick<M1Store, 'career'>): GameState {
  if (state.career === null) throw new Error('start or load a career first');
  return state.career;
}

function assertLeagueCupCheckpointPersisted(
  store: Pick<M1Store, 'repository' | 'lastPersistedCareer'>,
  career: GameState,
): void {
  const owesCupAfterLeague =
    career.phase === 'matchday' &&
    career.clubBusiness.pendingUserMatchImpacts.some(
      (impact) => impact.competition === 'LEAGUE',
    );
  if (
    owesCupAfterLeague &&
    store.repository !== null &&
    store.lastPersistedCareer !== career
  ) {
    playerError('store.leagueResultStillSaving');
  }
}

function queueCareerSave(
  get: () => M1Store,
  set: (partial: Partial<M1Store>) => void,
  career: GameState,
): void {
  // Every career mutation routes through here, which makes it the one place a
  // selection can be reconciled against the roster it points into. A sale or a
  // release leaves `selectedPlayerId` naming someone who is no longer at the
  // club — a sale does not even remove them from `players`, it moves them to
  // the buying club — and the store then answers taps on that stale selection
  // with raw refusals naming the internal id ("player bramble-rovers-p11 is
  // not on the user club"). Cleared before the save so no consumer sees the
  // gap; the squad view model resolves this id against the user roster alone.
  const selectedPlayerId = get().selectedPlayerId;
  if (
    selectedPlayerId !== undefined &&
    !career.players.some(
      (player) =>
        player.id === selectedPlayerId && player.clubId === career.userClubId,
    )
  ) {
    set({ selectedPlayerId: undefined });
  }
  const repository = get().repository;
  if (repository === null) return;
  if (pendingCareerSave !== null) {
    // Coalesce into the already-queued task: same owner, newest state. The
    // lineage is refreshed too — the payload now describes the career that is
    // live at THIS moment, not whichever one queued the task.
    pendingCareerSave = {
      generation: pendingCareerSave.generation,
      lineage: careerLineage,
      state: career,
    };
    return;
  }
  const generation = ++careerSaveGeneration;
  pendingCareerSave = { generation, lineage: careerLineage, state: career };
  let saved: GameState | null = null;
  enqueueSave(
    set,
    async () => {
      // Coalesced: while this task waited its turn, newer states replaced the
      // payload, so a burst of actions costs one write of the final state. A
      // generation mismatch means this task's payload was withdrawn by a career
      // replacement and the one sitting here belongs to a later task — stealing
      // it would write that newer state ahead of the replacement transaction.
      if (
        pendingCareerSave === null ||
        pendingCareerSave.generation !== generation
      )
        return;
      const { lineage, state } = pendingCareerSave;
      pendingCareerSave = null;
      if (get().persistenceLoadError !== null) return;
      // Every career save is queued for the career the store had just moved to,
      // so a retired lineage by the time this runs means this career was
      // abandoned — a replacement whose own save failed and rolled back onto
      // the career still in the live slot. Writing it now would undo that.
      if (lineage !== careerLineage) return;
      await repository.save(state);
      saved = state;
    },
    t('store.saveFailed'),
    () => {
      // A task that skipped (payload withdrawn, load error) proved nothing —
      // only an actual write may clear the failure streak.
      if (saved === null) return;
      clearSaveFailures(set);
      if (get().career === saved)
        set({ hasSavedCareer: true, lastPersistedCareer: saved });
    },
    (error) => recordSaveFailure(get, set, error),
  );
}

function recordSaveFailure(
  get: () => M1Store,
  set: (partial: Partial<M1Store>) => void,
  error?: unknown,
): void {
  const consecutiveSaveFailures = get().consecutiveSaveFailures + 1;
  const saveBlocked = consecutiveSaveFailures >= SAVE_FAILURE_BLOCK_LIMIT;
  set({
    consecutiveSaveFailures,
    saveBlocked,
    // `error` is a dismissible toast, so it cannot carry this: the player would
    // wave it away and keep playing a career that exists only in memory.
    saveWarning: isBrowserDatabaseLockError(error)
      ? t(
          saveBlocked
            ? 'store.saveWarningDatabaseInUseBlocked'
            : 'store.saveWarningDatabaseInUse',
        )
      : saveBlocked
        ? t('store.saveWarningBlocked')
        : t('store.saveWarning'),
  });
}

function clearSaveFailures(set: (partial: Partial<M1Store>) => void): void {
  set({ consecutiveSaveFailures: 0, saveBlocked: false, saveWarning: null });
}

/** A missing summary only costs the UI a recovery option, so it never throws. */
async function backupSummaryFailSoft(
  repository: CareerRepository,
): Promise<CareerBackupSummary | null> {
  try {
    return await repository.backupSummary();
  } catch {
    return null;
  }
}

/** Treats an unanswerable integrity check as "no damage reported". */
async function integrityFailSoft(
  repository: CareerRepository,
): Promise<boolean> {
  try {
    return await repository.checkIntegrity();
  } catch {
    return true;
  }
}

function queueReplaySave(
  get: () => M1Store,
  set: (partial: Partial<M1Store>) => void,
  career: GameState,
  fixture: LeagueFixture,
  replay: ReturnType<typeof envelopeFrom>,
): void {
  const repository = get().replayRepository;
  if (repository === null) return;
  const careerId = `m1-career-${career.careerSeed}`;
  const sortOrder =
    (fixture.season - 1) * 100 +
    (fixture.id.includes('-cup-') ? 50 + fixture.round : fixture.week);
  enqueueSave(
    set,
    async () => {
      if (get().persistenceLoadError !== null) return;
      await repository.save(careerId, fixture.id, sortOrder, replay);
    },
    t('store.replaySaveFailed'),
  );
}

function queueNewCareerSave(
  get: () => M1Store,
  set: (partial: Partial<M1Store>) => void,
  career: GameState,
  replacedCareer: GameState | null,
): void {
  const careerRepository = get().repository;
  const replayRepository = get().replayRepository;
  if (careerRepository === null && replayRepository === null) return;
  const careerId = `m1-career-${career.careerSeed}`;
  // Withdraw any coalesced old-career payload: its task runs before this one
  // and must not write the abandoned career's state ahead of the replacement.
  // Retiring the lineage covers what the withdrawal alone cannot: saves queued
  // before this moment can never mistake the replacement for their own career,
  // even when both careers were started from the same seed.
  pendingCareerSave = null;
  retireCareerLineage();
  let replacedCareerPersisted = false;
  const replacedCareerId =
    replacedCareer === null ? null : `m1-career-${replacedCareer.careerSeed}`;
  // Exclusive from THIS moment, not from the moment the task starts running:
  // the checkpoint, the replacement write and the replay cleanup only mean
  // anything as one sequence, and a flush that jumped the queue while this sat
  // waiting behind a long write would be overwritten by the replacement write
  // that follows it.
  exclusiveSaveDepth += 1;
  enqueueSave(
    set,
    async () => {
      try {
        // A replacement may be requested in the same turn as an ordinary save.
        // That older task no longer owns its coalesced payload once we withdraw
        // it above, so first checkpoint the exact career the player is replacing.
        // If the new write then fails, both memory and disk can return to this
        // same snapshot instead of quietly losing the latest lineup/week change.
        if (replacedCareer !== null && careerRepository !== null) {
          await careerRepository.save(replacedCareer);
          replacedCareerPersisted = true;
        }
        // The career is the irreplaceable asset. Persist it before cleaning any
        // replay namespace so a failed replacement never erases match history.
        await careerRepository?.save(career);
        try {
          if (replacedCareerId !== null && replacedCareerId !== careerId) {
            await replayRepository?.deleteAllForCareer(replacedCareerId);
          }
          await replayRepository?.deleteAllForCareer(careerId);
        } catch (error) {
          // Replay cleanup is recoverable and must never make memory roll back to
          // a career the disk has already replaced.
          set({
            notice: {
              tone: 'info',
              message: t('store.replayCleanupFailed', {
                reason: rawMessage(error),
              }),
            },
          });
        }
      } finally {
        exclusiveSaveDepth -= 1;
      }
    },
    t('store.newCareerSaveFailed'),
    () => {
      clearSaveFailures(set);
      if (get().career === career)
        set({ hasSavedCareer: true, lastPersistedCareer: career });
    },
    (error) => {
      // The write that failed is the one that would have replaced the career on
      // disk, so the live slot still holds it. Roll memory back onto that career
      // rather than leaving the player in one the game has refused to store:
      // treating this as an unreadable save would offer to delete the slot, and
      // the slot is the good career.
      if (replacedCareer === null) {
        // Nothing to lose to a retry — the slot was empty. This is the ordinary
        // "progress is not being saved" warning, with its Retry.
        recordSaveFailure(get, set, error);
        return;
      }
      // The rollback is itself a wholesale career swap: anything queued for the
      // failed replacement (its player creation, say) must not land on the slot
      // this failure just preserved.
      retireCareerLineage();
      set({
        career: replacedCareer,
        hasSavedCareer: true,
        lastPersistedCareer: replacedCareerPersisted ? replacedCareer : null,
        screen: resumeScreen(replacedCareer),
        activeTab: 'home',
        selectedPlayerId: undefined,
        watchedMatch: null,
        postMatch: null,
        postMatchOverlay: null,
        weekReview: null,
        matchDayBanner: null,
        faceOff: null,
        shootout: null,
        pendingPostFaceOffScreen: null,
      });
      if (replacedCareerPersisted) clearSaveFailures(set);
      else recordSaveFailure(get, set, error);
    },
  );
}

function enqueueSave(
  set: (partial: Partial<M1Store>) => void,
  task: () => Promise<void>,
  errorPrefix: string,
  onSuccess?: () => void,
  onError?: (error: unknown) => void,
): void {
  const ticket = ++latestSaveTicket;
  set({ saving: true });
  saveQueue = saveQueue
    .then(task)
    .then(() => {
      onSuccess?.();
      if (ticket === latestSaveTicket) set({ saving: false });
    })
    .catch((error) => {
      onError?.(error);
      if (ticket === latestSaveTicket) set({ saving: false });
      set({ error: `${errorPrefix}: ${rawMessage(error)}` });
    });
}

/** Whether the loaded career has finished the climb at least once. */
export function careerClimbCompleted(state: {
  career: GameState | null;
}): boolean {
  return state.career?.eventFlags.includes(TRUE_ENDING_SEEN_FLAG) ?? false;
}

function guarded(
  set: (partial: Partial<M1Store>) => void,
  action: () => void,
  copyError: (error: unknown) => string = errorMessage,
): void {
  try {
    action();
  } catch (error) {
    set({ error: copyError(error) });
  }
}

/** Turns every player-reachable facility refusal into Bert-ready copy. */
export function facilityTransactionErrorCopy(error: unknown): string {
  const raw = rawMessage(error);
  if (/ is not unlocked$/.test(raw)) return t('facilityError.locked');
  if (/ is already built;| limit reached;/.test(raw)) {
    return t('facilityError.buildLimit');
  }
  if (
    raw === 'only one facility construction project may be active at a time'
  ) {
    return t('facilityError.constructionBusy');
  }
  if (
    raw === 'facility transaction is not affordable' ||
    raw === 'available cash must be a non-negative safe integer'
  ) {
    return t('facilityError.notEnoughCash');
  }
  if (/ is outside the facility grid$/.test(raw)) {
    return t('facilityError.outsideGrid');
  }
  if (/ overlaps /.test(raw)) return t('facilityError.overlap');
  if (/^Coaching Office upgrades are disabled/.test(raw)) {
    return t('facilityError.coachingOfficeUpgrade');
  }
  if (/ is already at level /.test(raw)) return t('facilityError.maxLevel');
  if (/ cannot move while construction is active$/.test(raw)) {
    return t('facilityError.moveDuringConstruction');
  }
  if (/ is already at that position$/.test(raw)) {
    return t('facilityError.samePosition');
  }
  if (/ cannot close while construction is active$/.test(raw)) {
    return t('facilityError.closeDuringConstruction');
  }
  if (/^a staffed Coaching Office must dismiss/.test(raw)) {
    return t('facilityError.staffedOffice');
  }
  if (/^Level \d facilities unlock in /.test(raw)) {
    return t('facilityError.upgradeLocked');
  }
  const severance = raw.match(
    /needs \$([\d,]+) more to cover assistant severance/,
  );
  if (severance !== null) {
    return t('facilityError.severanceShort', { amount: severance[1] });
  }
  return t('facilityError.unavailable');
}

/** Turns the pressable-but-unaffordable transfer refusal into player copy. */
export function transferTransactionErrorCopy(error: unknown): string {
  const raw = rawMessage(error);
  return raw === 'transfer fee exceeds current cash'
    ? t('market.notEnoughCash')
    : t('store.actionUnavailable');
}

export function assertTransferCashAvailable(cash: number, fee: number): void {
  if (cash < fee) throw new Error('transfer fee exceeds current cash');
}

function guardedTransfer(
  set: (partial: Partial<M1Store>) => void,
  action: () => void,
): void {
  guarded(set, action, transferTransactionErrorCopy);
}

/** The developer text a throw carries, for matching. Never shown to a player. */
function rawMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * A refusal whose message is already the player's sentence, already resolved in
 * the player's language.
 *
 * Most `throw`s in the rings carry developer English written for a stack trace,
 * and `errorMessage` replaces those with one catalogued line. A handful of store
 * refusals are the opposite: their text comes straight out of the catalog and is
 * exactly what the player should read. Marking them by type keeps that
 * distinction explicit — a plain `throw new Error('...')` is developer text by
 * default, which is the safe way round.
 */
class PlayerFacingError extends Error {}

/** Throws catalogued copy the error banner should show verbatim. */
function playerError(
  key: string,
  params?: Readonly<Record<string, string | number>>,
): never {
  throw new PlayerFacingError(t(key, params));
}

/**
 * The refusals a player reaches by tapping a control the screen offered.
 *
 * Matched on the raw English because that is all a `throw` carries. Keep the
 * list short: a refusal that needs an entry here is usually a screen that
 * should have disabled the control instead.
 */
type RefusalRule = readonly [
  RegExp,
  string,
  ((match: RegExpMatchArray) => Readonly<Record<string, string | number>>)?,
];

const PLAYER_REACHABLE_REFUSALS: readonly RefusalRule[] = [
  [/^unknown coach candidate /, 'store.coachUnavailable'],
  [/^choose a club bid before accepting the transfer$/, 'store.chooseBidFirst'],
  [/^Scouting unlocks in Week /, 'store.scoutingLocked'],
  [
    /^expired players can only leave at season end$/,
    'store.releaseAtSeasonEnd',
  ],
  [
    /^renewal talks require the season-end phase$/,
    'store.renewalSeasonEndOnly',
  ],
  [/ is not on the user club$/, 'store.playerNotOnClub'],
  [
    /^Both lineup players must belong to your club\.$/,
    'store.lineupOwnPlayersOnly',
  ],
  [/^only heroes can receive a license$/, 'store.heroesOnlyLicense'],
  [
    / uses characters the game cannot display$/,
    'store.nameHasUnsupportedCharacters',
  ],
  // These two carry numbers and a name the player needs. Dropping them into the
  // generic line would answer "why can't I?" with "you can't", so the capture
  // groups are forwarded as params rather than thrown away.
  [
    /^training needs (\d+) TP but only (\d+) are available$/,
    'store.trainingNeedsMoreTp',
    (m) => ({ cost: m[1], available: m[2] }),
  ],
  [
    /^(.+) is not eligible for this club$/,
    'store.playerNotEligible',
    (m) => ({ player: m[1] }),
  ],
  [/^this story still has an eligible target$/, 'store.storyHasEligibleTarget'],
  // The refusals the squad/training hardening added in this same pass. A guard
  // that stops a crash but answers the player in developer English has only
  // moved the defect, so each new throw lands here with its own sentence.
  [
    /^(.+) cannot be spared: no eligible replacement is available$/,
    'store.playerCannotBeSpared',
    (m) => ({ player: m[1] }),
  ],
  [/^training can only run before a match$/, 'store.trainingBeforeMatchOnly'],
  [
    /^(.+) does nothing for a (GK|DEF|MID|FWD)$/,
    'store.drillDoesNothingForRole',
    (m) => ({ drill: m[1], role: m[2] }),
  ],
  [/ is already at the maximum$/, 'store.attributeAlreadyMaxed'],
  [
    /^(.+) is (?:injured|away) and cannot train$/,
    'store.playerCannotTrain',
    (m) => ({ player: m[1] }),
  ],
  [/^the club cannot afford this request$/, 'store.requestNotAffordable'],
];

/**
 * The player-facing sentence for a refusal a pure ring raised.
 *
 * The rings may not import `src/i18n`, so a `throw` carries no key and its
 * English is written for whoever is reading a stack trace. Showing it verbatim
 * put "unknown coach candidate coach-s1-mateo-silva" in the error banner, in
 * all seven languages. Anything not recognised here is a state the UI should
 * not have offered, so it gets one catalogued line rather than a developer
 * sentence a player cannot act on.
 */
function errorMessage(error: unknown): string {
  if (error instanceof ContractPromiseBlockedError) {
    return copyOrEnglish(t, error.key, error.message, error.params);
  }
  // Already the player's sentence, in the player's language — show it as it is.
  if (error instanceof PlayerFacingError) return error.message;
  const raw = rawMessage(error);
  for (const [pattern, key, params] of PLAYER_REACHABLE_REFUSALS) {
    const match = raw.match(pattern);
    if (match !== null) return t(key, params?.(match));
  }
  return t('store.actionUnavailable');
}
