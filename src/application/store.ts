import { create } from 'zustand';
import { loadLaunchContent } from '../content';
import {
  advanceWeek,
  FACILITY_CATALOG,
  FACILITY_ADJACENCIES,
  activeCareerMatchday,
  addCreatedPlayer,
  applyCareerNegotiationConsequence,
  applyCareerEventOutcome,
  beginStoryOnboarding,
  beginCareerTransferTalks,
  beginCareerRenewalTalks,
  closeCareerTransferTalks,
  careerHeroLimit,
  highestDivisionReached,
  buildCareerMatchTeams,
  buildCareerFacility,
  buildTrainingGround,
  completeCupGiantKillingCelebration as markCupGiantKillingCelebrationComplete,
  completeFirstOnboardingMatch,
  completeAssistantGuideMilestone,
  type AssistantGuideMilestone,
  completeAssistantGuideSequence,
  assistantTeaches,
  clearAdvisorAssistantInboxSuppressions,
  completeMatchday,
  completePostMatchAwakening,
  completeCareerTransfer,
  completeCareerRenewal,
  createCareer,
  currentUserDivision,
  deterministicCareerEventRoll,
  declineYouthIntakeOffers,
  dismissAssistantInboxProductForCurrentWeek,
  dismissAssistantInboxProductPermanently,
  dismissCareerEvent,
  dismissCareerCoach,
  hireCareerCoach,
  listCareerPlayer,
  acceptCareerTransferBid,
  acceptSponsorOffer as acceptCareerSponsorOffer,
  allocateSponsorPortfolioPayment,
  difficultyRules,
  hasAssistantGuideMilestone,
  isFirstOnboardingFixture,
  offerCareerEvent,
  nextPendingClubLegend,
  productionResultFromMatch,
  quickMatchForFixture,
  protectBoardUltimatumPlayer,
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
  selectCareerLicensedHeroes,
  setCareerLineup,
  swapCareerLineupPlayer,
  resolvePlayerRequest as resolveCareerPlayerRequest,
  trainPlayerInstantly,
  trainingPathLabel,
  startNextSeason,
  startCareerScoutMission,
  submitCareerTransferOffer,
  submitCareerRenewalOffer,
  upgradeCareerFacility,
  withoutPowers,
  type CreatedPlayerDraft,
  type InstantDrillResolution,
  type CareerLegendLegacyChoice,
  type AssistantGuideSequenceId,
  type AssistantInboxGuideSequenceId,
  type AssistantMode,
  type GameState,
  type FacilityPosition,
  type FacilityType,
  type LeagueFixture,
  type ManagerMatchPreferences,
  type NationalCupRoundLabel,
} from '../game';
import type { PlayerRequestResolution } from '../game/types';
import type { ContractOffer, PitchCard } from '../game/market';
import type {
  CareerBackupSummary,
  CareerRepository,
  ReplayRepository,
} from '../persistence';
import { HALF_TICKS } from '../sim/geometry';
import { envelopeFrom } from '../sim/match';
import { mulberry32 } from '../sim/rng';
import type { MatchState, ReplayEnvelope, TeamDef } from '../sim/types';
import type { ManagementTab, PostMatchViewModel, WeeklyReviewViewModel } from '../ui';
import { createLaunchCareerSetup, generateCareerSeed, reconcileLaunchRoster } from './launch';
import { cachedRivalResults, clearRivalResultCache } from './rival-result-cache';
import { careerMarketScoutOptions } from './market-source-adapter';
import {
  postMatchViewModel,
  reconcileHomeAssistantInbox,
  settleWeeklyStory,
  settleWeeklyTip,
  weeklyReviewViewModel,
} from './view-models';
import {
  OPENING_TRAINING_PITCH_REMINDER,
  openingTrainingPitchRequired,
  outstandingInboxDuties,
} from './assistant-guide';
import {
  eventChoiceUnavailableReason,
  eventOfferForWeek,
  reconcilePendingStoryEvent,
} from './event-selection';
import {
  completeChampionshipCelebration as markChampionshipCelebrationComplete,
  hasPendingChampionshipCelebration,
} from './championship-celebration';
import {
  hasPendingAwardsCeremony,
  markAwardsCeremonyComplete,
} from './awards-ceremony';
import {
  endgameSupersedesLeagueTitle,
  markEndgameCelebrationComplete,
  pendingEndgameCelebration,
  TRUE_ENDING_SEEN_FLAG,
} from './endgame-celebration';
import { recordHallOfFame } from './hall-of-fame';

const launchContent = loadLaunchContent();
const awakeningPowerIds = launchContent.powers.powers.map(power => power.id);
const awakeningTriggerIds = launchContent.onboarding.triggers.map(trigger => trigger.id);
const awakeningTuning = {
  chancePercent: launchContent.powers.awakening.postMatchChancePercent,
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
  | 'awakening'
  | 'event'
  | 'matchday'
  | 'watched'
  | 'postmatch'
  | 'week-review'
  | 'legacy'
  | 'championship-celebration'
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
export interface InstantDrillResult extends Omit<InstantDrillResolution, 'state'> {
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
  /** The previous-generation save the player can fall back to, if any. */
  backupSummary: CareerBackupSummary | null;
  screen: M1Screen;
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
  inboxDutyReminder: readonly AssistantInboxGuideSequenceId[] | null;
  selectedContractTerm: 1 | 2 | 3;
  error: string | null;
  notice: StoreNotice | null;
  initializePersistence: (
    repository: CareerRepository,
    replayRepository?: ReplayRepository,
  ) => Promise<void>;
  discardUnreadableSave: () => Promise<void>;
  exportUnreadableSave: (
    share: (fileName: string, contents: string) => Promise<void>,
  ) => Promise<void>;
  restoreBackupSave: () => Promise<void>;
  /** Debug UI only: replaces the live career with an exact stored snapshot. */
  restoreDeveloperSave: (state: GameState, slotLabel: string) => void;
  retrySave: () => void;
  startNewCareer: (seed?: number, assistantMode?: AssistantMode) => void;
  continueCareer: () => void;
  setAssistantMode: (assistantMode: AssistantMode) => void;
  completePlayerCreation: (draft: CreatedPlayerDraft) => void;
  continueAfterAwakening: () => void;
  setActiveTab: (tab: ManagementTab) => void;
  reconcileAssistantInbox: () => void;
  /** Opens the story sitting on this week's desk. */
  openDeskStory: () => void;
  completeAssistantGuide: (sequenceId: AssistantGuideSequenceId) => void;
  /** Retires a one-shot Bert lesson for the rest of the career. */
  completeGuideMilestone: (milestone: AssistantGuideMilestone) => void;
  completeCupGiantKillingCelebration: () => void;
  /** Sends Bert away after he has refused an Advance Week. */
  dismissInboxDutyReminder: () => void;
  /** Removes a product card after its current-week conversation is complete. */
  dismissInboxProduct: (
    alertId: string,
    scope?: 'current-week' | 'permanent',
  ) => void;
  openMatchday: () => void;
  openCupFixture: (fixtureId: string) => void;
  advanceCareer: () => void;
  quickResult: (preferences?: Pick<ManagerMatchPreferences, 'initialFormation'>) => void;
  watchMatch: () => void;
  finishWatchedMatch: (result: MatchState) => void;
  continueAfterMatch: () => Promise<void>;
  dismissPostMatchSummary: () => void;
  continueWeekReview: () => void;
  completeChampionshipCelebration: () => void;
  completeEndgameCelebration: () => void;
  returnToTitleFromEnding: () => void;
  completeAwardsCeremony: () => void;
  chooseLegacy: (choice: CareerLegendLegacyChoice) => void;
  selectEventPlayer: () => void;
  chooseEvent: (choiceId: string) => void;
  continueAfterEvent: () => void;
  toggleHeroLicense: (playerId: string) => void;
  swapStartingPlayer: (starterId: string, replacementId: string) => void;
  resolvePlayerRequest: (resolution: PlayerRequestResolution) => void;
  acceptSponsorOffer: (offerId: string) => void;
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
  clearDrillResult: () => void;
  buildFacility: () => void;
  buildClubFacility: (type: FacilityType, position: FacilityPosition) => void;
  upgradeClubFacility: (buildingId: string) => void;
  relocateClubFacility: (buildingId: string, position: FacilityPosition) => void;
  closeClubFacility: (buildingId: string) => void;
  startScoutMission: (optionId: string) => void;
  openScoutReport: (playerId: string) => void;
  actOnTransfer: (playerId: string, direction: 'BUY' | 'SELL', bidId?: string) => void;
  hireCoach: (coachId: string, role?: 'HEAD' | 'ASSISTANT') => void;
  dismissCoach: (role?: 'HEAD' | 'ASSISTANT') => void;
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
  backupSummary: null,
  screen: 'welcome',
  activeTab: 'home',
  lastDrillResult: null,
  watchedMatch: null,
  postMatch: null,
  postMatchOverlay: null,
  weekReview: null,
  inboxDutyReminder: null,
  selectedContractTerm: 1,
  error: null,
  notice: null,

  async initializePersistence(repository, replayRepository) {
    // Boot replaces whatever career an earlier lifetime of this store held, so
    // any save still queued for it must not write over the loaded one.
    retireCareerLineage();
    try {
      const loadedCareer = await repository.load();
      const career = loadedCareer === null ? null : reconcileLoadedCareer(loadedCareer);
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
        persistenceLoadError: null,
        rawExportRequired: false,
        rawExportSucceeded: false,
        backupSummary: await backupSummaryFailSoft(repository),
        error: null,
      });
      // Reconciliation write-back goes through the normal failure-counting
      // queue AFTER the career is installed: a save that fails here (full
      // disk) must warn, not turn a perfectly readable career into the
      // "save could not be loaded" screen whose options include deleting it.
      if (career !== null && career !== loadedCareer) queueCareerSave(get, set, career);
    } catch (error) {
      // Whether the file itself is damaged decides which way out is worth
      // offering: restoring the backup, or wiping the database and starting over.
      const damaged = !(await integrityFailSoft(repository));
      set({
        repository,
        replayRepository: replayRepository ?? null,
        persistenceReady: true,
        backupSummary: await backupSummaryFailSoft(repository),
        persistenceLoadError: `Save could not be loaded safely: ${errorMessage(error)}${
          damaged ? ' The game database file also reports damage.' : ''
        }`,
        rawExportRequired: false,
        rawExportSucceeded: false,
      });
    }
  },

  async exportUnreadableSave(share) {
    const { repository, persistenceLoadError } = get();
    if (repository === null || persistenceLoadError === null) return;
    set({ rawExportRequired: true, rawExportSucceeded: false });
    try {
      const raw = await repository.loadRaw();
      if (raw === null) throw new Error('the stored career row is missing');
      const fileName = `hero-football-manager-raw-schema-${raw.schemaVersion}.json`;
      await share(fileName, raw.stateJson);
    } catch (error) {
      set({
        persistenceLoadError: `Raw save export failed: ${errorMessage(error)} The save is unchanged; deletion stays blocked until export succeeds or the app is relaunched.`,
      });
      return;
    }
    set({
      rawExportSucceeded: true,
      notice: { tone: 'info', message: 'Raw save exported. You can now start fresh if you choose.' },
    });
  },

  async discardUnreadableSave() {
    const {
      repository,
      persistenceLoadError,
      rawExportRequired,
      rawExportSucceeded,
    } = get();
    if (repository === null || persistenceLoadError === null) return;
    if (rawExportRequired && !rawExportSucceeded) {
      set({
        persistenceLoadError: 'Raw save export was requested but did not finish. The save has not been deleted.',
      });
      return;
    }
    try {
      await repository.delete();
    } catch (error) {
      set({
        persistenceLoadError: `Save could not be deleted: ${errorMessage(error)}`,
      });
      return;
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
      error: null,
    });
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
      written = await repository.restoreBackup();
      restored = reconcileLoadedCareer(written);
    } catch (error) {
      set({ persistenceLoadError: `Backup could not be restored: ${errorMessage(error)}` });
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
      error: null,
      notice: { tone: 'info', message: 'Restored the backup save.' },
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
        error: null,
        notice: { tone: 'info', message: `Loaded developer save ${slotLabel}.` },
      });
      clearSaveFailures(set);
      queueCareerSave(get, set, restored);
    });
  },

  /** Retries the last career state, so a fixed disk can clear a save block. */
  retrySave() {
    const career = get().career;
    if (career === null) return;
    queueCareerSave(get, set, career);
  },

  startNewCareer(seed, assistantMode) {
    guarded(set, () => {
      if (get().persistenceLoadError !== null) {
        throw new Error('Resolve the save-load error before replacing this career.');
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
      const career = beginStoryOnboarding(assistantMode === undefined
        ? created
        : { ...created, assistantMode });
      set({
        career,
        hasSavedCareer: true,
        lastPersistedCareer: null,
        screen: 'create-player',
        activeTab: 'home',
        selectedPlayerId: undefined,
        watchedMatch: null,
        postMatch: null,
        postMatchOverlay: null,
        weekReview: null,
        inboxDutyReminder: null,
        error: null,
      });
      queueNewCareerSave(get, set, career, replacedCareer);
    });
  },

  continueCareer() {
    if (get().career === null) {
      set({ error: 'No saved career is available.' });
      return;
    }
    const career = get().career!;
    set({
      screen: resumeScreen(career),
      postMatch: null,
      postMatchOverlay: null,
      weekReview: null,
      error: null,
    });
  },

  setAssistantMode(assistantMode) {
    const career = get().career;
    if (career === null) return;
    guarded(set, () => {
      const changed = { ...career, assistantMode };
      const next = assistantMode === 'teacher'
        ? clearAdvisorAssistantInboxSuppressions(changed)
        : changed;
      set({ career: next, inboxDutyReminder: null, error: null });
      queueCareerSave(get, set, next);
    });
  },

  completePlayerCreation(draft) {
    guarded(set, () => {
      const next = addCreatedPlayer(requireCareer(get()), draft);
      set({ career: next, screen: 'management', activeTab: 'home', error: null });
      queueCareerSave(get, set, next);
    });
  },

  continueAfterAwakening() {
    guarded(set, () => {
      const career = requireCareer(get());
      const pending = career.awakening.pending;
      if (pending === undefined) throw new Error('there is no awakening cutscene to finish');
      const next = completePostMatchAwakening(career);
      // Every awakening still owes the manager that match's accounts, including
      // the story's first hero — skipping it hid the opening match's whole ledger.
      const returnToPostMatch = get().postMatch !== null;
      const screen: M1Screen = returnToPostMatch
        ? 'postmatch'
        : career.phase === 'season-end' || career.phase === 'complete'
          ? seasonBoundaryScreen(next)
          : career.phase === 'matchday' ? 'matchday' : 'management';
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
    if (activeTab === 'market') {
      const career = get().career;
      if (career?.market === undefined) {
        set({ error: 'The transfer market is unavailable in this career.' });
        return;
      }
    }
    set({ activeTab, screen: 'management', error: null });
  },

  reconcileAssistantInbox() {
    const career = get().career;
    if (career === null) return;
    // Settling the story here (not only on Advance Week) is what gets a card
    // onto the desk of a week the career reached through a match.
    const next = settleWeeklyTip(settleWeeklyStory(reconcileHomeAssistantInbox(career)));
    if (next === career) return;
    // A week reached through a match has no review to hand the story over, so
    // this is where its opening beat arrives: the desk has just come up and the
    // story settles onto it. Same rule either way — read it entering the week.
    const opensStory = career.pendingEvent === undefined
      && next.pendingEvent !== undefined
      && get().screen === 'management';
    set({ career: next, ...(opensStory ? { screen: 'event' as const } : {}) });
    queueCareerSave(get, set, next);
  },

  openDeskStory() {
    const career = get().career;
    if (career?.pendingEvent === undefined) return;
    set({ screen: 'event', error: null });
  },

  completeAssistantGuide(sequenceId) {
    guarded(set, () => {
      const next = completeAssistantGuideSequence(requireCareer(get()), sequenceId);
      set({ career: next, error: null });
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

  dismissInboxProduct(alertId, scope = 'current-week') {
    guarded(set, () => {
      const career = requireCareer(get());
      const next = scope === 'permanent'
        ? dismissAssistantInboxProductPermanently(career, alertId)
        : dismissAssistantInboxProductForCurrentWeek(career, alertId);
      set({ career: next, error: null });
      queueCareerSave(get, set, next);
    });
  },

  openMatchday() {
    const career = get().career;
    if (career?.phase !== 'matchday') {
      set({ error: 'Advance to the fixture week before opening match day.' });
      return;
    }
    set({ screen: 'matchday', error: null });
  },

  openCupFixture(fixtureId) {
    const career = get().career;
    if (career === null) {
      set({ error: 'Start or load a career first.' });
      return;
    }
    const matchday = activeCareerMatchday(career);
    if (
      career.phase !== 'matchday'
      || matchday?.kind !== 'national-cup'
      || matchday.fixture.id !== fixtureId
    ) {
      set({ error: 'Finish this week’s league match first. Then the Cup Match Day will open.' });
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
        throw new Error(
          'The last few weeks could not be saved, so the season is paused. Free up space on your device, then try saving again.',
        );
      }
      const career = requireCareer(get());
      if (career.onboarding?.stage === 'create-player') {
        throw new Error('Create your player before entering the club office.');
      }
      if (career.awakening.pending !== undefined || career.onboarding?.stage === 'reveal') {
        set({ screen: 'awakening', error: null });
        return;
      }
      if (
        assistantTeaches(career)
        && hasAssistantGuideMilestone(career, 'intro-complete')
        && !hasAssistantGuideMilestone(career, 'first-training-complete')
      ) {
        throw new Error('Train a player before advancing the week.');
      }
      const guidedFirstWeek = assistantTeaches(career)
        && hasAssistantGuideMilestone(career, 'intro-complete')
        && hasAssistantGuideMilestone(career, 'first-training-complete')
        && !hasAssistantGuideMilestone(career, 'first-week-advanced');
      if (guidedFirstWeek) {
        const activeTab = get().activeTab;
        if (activeTab !== 'home' && activeTab !== 'club') {
          throw new Error('Return home and check your inbox before advancing the week.');
        }
        const trainingGroundStarted = career.facilities.trainingGroundBuilt
          || (
            career.facilities.grid?.construction?.kind === 'BUILD'
            && career.facilities.grid.construction.type === 'training-pitch'
          );
        const recoveringWrongOpeningProject = openingTrainingPitchRequired(career)
          && career.facilities.grid?.construction !== undefined
          && career.facilities.grid.construction.type !== 'training-pitch';
        if (!trainingGroundStarted && !recoveringWrongOpeningProject) {
          throw new Error('Build the Training Ground from your inbox before advancing the week.');
        }
        if (activeTab !== 'home') {
          throw new Error('Return home before advancing the week.');
        }
        if (
          !recoveringWrongOpeningProject
          && career.market !== undefined
          && career.market.headCoach === undefined
        ) {
          set({
            error: null,
            notice: {
              tone: 'info',
              message: 'You still have 1 inbox item left to deal with first.',
            },
          });
          return;
        }
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
        const guidedCareer = career.eventFlags.includes('m4:season-recap-guide-seen')
          ? career
          : { ...career, eventFlags: [...career.eventFlags, 'm4:season-recap-guide-seen'] };
        const next = reconcilePendingClubLegends(startNextSeason(guidedCareer));
        set({
          career: next,
          screen: nextPendingClubLegend(next) === undefined ? 'management' : 'legacy',
          activeTab: 'home',
          weekReview: null,
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
        set({ screen: 'event', error: null });
        return;
      }

      // The same argument, one step earlier: a job still sitting in the opening
      // weeks' inbox is this week's business too. Bert says so rather than the
      // button simply doing nothing, because a press that produces silence
      // reads as a broken button.
      const outstandingDuties = outstandingInboxDuties(career);
      if (outstandingDuties.length > 0) {
        set({ inboxDutyReminder: outstandingDuties, error: null });
        return;
      }

      const advanced = advanceWeek(career);
      const withMilestone = advanced.week !== career.week
        && hasAssistantGuideMilestone(career, 'first-training-complete')
        ? completeAssistantGuideMilestone(advanced, 'first-week-advanced')
        : advanced;
      // Stories belong to the week being entered, not the one being left, so the
      // card is already on the desk when the manager first sees the new week.
      const next = settleWeeklyTip(settleWeeklyStory(withMilestone));
      const weekReview = next.phase === 'manage' && next.week !== career.week
        ? weeklyReviewViewModel(career, next)
        : null;
      set({
        career: next,
        screen: weekReview !== null
          ? 'week-review'
          : next.phase === 'matchday'
          ? 'matchday'
          : next.phase === 'season-end' || next.phase === 'complete'
            ? seasonBoundaryScreen(next)
            : 'management',
        weekReview,
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
        throw new Error(
          'The last few weeks could not be saved, so the season is paused. Free up space on your device, then try saving again.',
        );
      }
      const before = requireCareer(get());
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
      if (production === undefined) throw new Error('Quick Result did not produce user match facts');
      // Whatever the preload finished is handed over as a supplied result, so
      // `resolveMatchday` simulates only what is genuinely missing. A cold or
      // stale cache contributes nothing and it simulates all four, as before.
      const results = kind === 'league'
        ? resolveMatchday(fixtures, teams, [
            production.fixtureResult,
            ...cachedRivalResults(
              fixtures.filter(candidate => candidate.id !== fixture.id),
              teams,
            ),
          ])
        : [production.fixtureResult];
      const userResult = results.find(result => result.fixtureId === fixture.id);
      if (userResult === undefined) throw new Error('the user fixture did not produce a result');
      const after = completeMatchday(before, results, production);
      // The week is settled; nothing may claim these again, and the fingerprints
      // are large enough that a season of them would be worth real memory.
      clearRivalResultCache();
      const isOnboardingMatch = isFirstOnboardingFixture(before, fixture.id);
      const completed = isOnboardingMatch
        ? completeFirstOnboardingMatch(after, fixture.id)
        : after;
      const awakening = kind === 'league'
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
      );
      set({
        career: next,
        postMatch,
        postMatchOverlay: null,
        weekReview: null,
        screen: awakening.awakened ? 'awakening' : 'postmatch',
        watchedMatch: null,
        error: null,
      });
      queueReplaySave(get, set, before, fixture, quickMatch.replay);
      queueCareerSave(get, set, next);
    });
  },

  watchMatch() {
    guarded(set, () => {
      // Matches saveBlocked's contract: once saving is broken the season is
      // paused, so no new match progress may start, only be retried/recovered.
      if (get().saveBlocked) {
        throw new Error(
          'The last few weeks could not be saved, so the season is paused. Free up space on your device, then try saving again.',
        );
      }
      const career = requireCareer(get());
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
      const before = requireCareer(get());
      const { kind, fixture, fixtures, teams } = currentMatchday(before);
      const watchedMatch = get().watchedMatch;
      // A second `onDone` for a match already settled is a duplicate delivery,
      // not a fault: the first call cleared the context. Surfacing it threw a
      // developer sentence into the player's error toast on a working game.
      if (watchedMatch === null) return;
      if (watchedMatch.fixture.id !== fixture.id) {
        throw new Error('the watched fixture context is missing');
      }
      const production = productionResultFromMatch(fixture, result, before.userClubId);
      const supplied = production.fixtureResult;
      const results = kind === 'league'
        ? resolveMatchday(fixtures, teams, [
            supplied,
            ...cachedRivalResults(
              fixtures.filter(candidate => candidate.id !== fixture.id),
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
        description: `${goal.name} scored`,
      }));
      const isOnboardingMatch = isFirstOnboardingFixture(before, fixture.id);
      const completed = isOnboardingMatch
        ? completeFirstOnboardingMatch(after, fixture.id)
        : after;
      const awakening = kind === 'league'
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
      );
      set({
        career: next,
        postMatch,
        postMatchOverlay: null,
        weekReview: null,
        screen: awakening.awakened ? 'awakening' : 'postmatch',
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
      hasSecondMatch
      && career !== null
      && get().repository !== null
      && get().lastPersistedCareer !== career
    ) {
      set({ notice: { tone: 'info', message: 'Saving the league result before the Cup tie…' } });
      await saveQueue;
      if (get().career !== career || get().lastPersistedCareer !== career) return;
    }
    const currentCareer = get().career;
    const currentSeasonBoundary = currentCareer !== null
      && (currentCareer.phase === 'season-end' || currentCareer.phase === 'complete');
    const currentHasSecondMatch = currentCareer?.phase === 'matchday';
    set({
      postMatch: currentSeasonBoundary || currentHasSecondMatch ? null : get().postMatch,
      weekReview: null,
      postMatchOverlay: currentSeasonBoundary || currentHasSecondMatch || get().postMatch === null ? null : 'summary',
      screen: currentSeasonBoundary
        ? seasonBoundaryScreen(currentCareer)
        : currentHasSecondMatch ? 'matchday' : 'management',
      activeTab: 'home',
      error: null,
    });
  },

  dismissPostMatchSummary() {
    set({ postMatch: null, postMatchOverlay: null, error: null });
  },

  continueWeekReview() {
    guarded(set, () => {
      const career = requireCareer(get());
      set({
        weekReview: null,
        screen: career.phase === 'season-end' || career.phase === 'complete'
          ? seasonBoundaryScreen(career)
          // A story is the top of the week it was drawn for, not a toll on the
          // way out of it. The manager reads it on arrival and then has the
          // whole week to act on what it did, rather than meeting it as an
          // ambush on the Advance Week press seven days later.
          : career.pendingEvent !== undefined
            ? 'event'
            : 'management',
        activeTab: 'home',
        error: null,
      });
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
      const next = recordHallOfFame(superseded
        ? markChampionshipCelebrationComplete(celebrated)
        : celebrated);
      set({
        career: next,
        screen: next.phase === 'season-end' || next.phase === 'complete'
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
    set({ screen: 'welcome', activeTab: 'home' });
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
        screen: next.phase === 'season-end' || next.phase === 'complete'
          ? 'season-end'
          : 'management',
        error: null,
      });
      if (next !== career) queueCareerSave(get, set, next);
    });
  },

  chooseLegacy(choice) {
    guarded(set, () => {
      const transaction = resolveNextClubLegendLegacy(requireCareer(get()), choice);
      const next = reconcilePendingClubLegends(transaction.state);
      set({
        career: next,
        screen: nextPendingClubLegend(next) === undefined ? 'management' : 'legacy',
        activeTab: 'home',
        error: null,
      });
      queueCareerSave(get, set, next);
    });
  },

  selectEventPlayer() {
    guarded(set, () => {
      const career = requireCareer(get());
      if (career.pendingEvent === undefined) throw new Error('there is no active event');
      const lineup = career.lineups.find(candidate => candidate.clubId === career.userClubId);
      if (lineup === undefined) throw new Error('the user club has no lineup');
      const candidates = career.players
        .filter(player =>
          player.clubId === career.userClubId,
        )
        .sort((left, right) => (
          Number(!lineup.playerIds.includes(left.id)) - Number(!lineup.playerIds.includes(right.id))
          || left.name.localeCompare(right.name)
        ));
      if (candidates.length === 0) throw new Error('no eligible user-club player is available');
      const currentIndex = candidates.findIndex(player => player.id === career.pendingEvent?.selectedPlayerId);
      const player = candidates[(currentIndex + 1) % candidates.length];
      const next = selectCareerEventPlayer(career, player.id);
      set({ career: next, error: null });
      queueCareerSave(get, set, next);
    });
  },

  chooseEvent(choiceId) {
    guarded(set, () => {
      const career = requireCareer(get());
      // Bert's safe-or-risky card is a one-time explanation, and picking a
      // choice is the proof it was read. Marking it here rather than only on
      // the way out means a career that is closed between the choice and the
      // outcome — or whose last save is coalesced away — never reopens with
      // the lesson still pending, and the manager is never taught the same
      // rule twice.
      const seen = career.eventFlags.includes('m4:event-guide-seen')
        ? career
        : { ...career, eventFlags: [...career.eventFlags, 'm4:event-guide-seen'] };
      const next = resolveContentEvent(seen, choiceId);
      set({ career: next, error: null });
      queueCareerSave(get, set, next);
    });
  },

  continueAfterEvent() {
    guarded(set, () => {
      // Resolving a story writes the club's money, morale and roster, so it
      // honours the same saveBlocked pause as advanceCareer.
      if (get().saveBlocked) {
        throw new Error(
          'The last few weeks could not be saved, so the season is paused. Free up space on your device, then try saving again.',
        );
      }
      const career = requireCareer(get());
      const pending = career.pendingEvent;
      if (pending?.resolvedChoiceId === undefined) throw new Error('resolve the event before continuing');
      const event = launchContent.events.events.find(candidate => candidate.id === pending.eventId);
      const guidedCareer = career.eventFlags.includes('m4:event-guide-seen')
        ? career
        : { ...career, eventFlags: [...career.eventFlags, 'm4:event-guide-seen'] };
      const dismissed = dismissCareerEvent(guidedCareer, event?.trigger.repeatable !== true);
      if (pending.resolvedNextEventId !== undefined) {
        // A chained event this build no longer ships ends the chain. Throwing
        // here left the player on an event screen whose only button could do
        // nothing but throw again, with the dead chain saved.
        const followUp = launchContent.events.events.find(
          candidate => candidate.id === pending.resolvedNextEventId,
        );
        if (followUp !== undefined
          && (followUp.trigger.repeatable === true
            || !dismissed.resolvedEventIds.includes(followUp.id))) {
          const next = offerCareerEvent(dismissed, followUp.id);
          set({ career: next, screen: 'event', weekReview: null, error: null });
          queueCareerSave(get, set, next);
          return;
        }
      }
      // Answering a story hands the week back rather than spending it. The
      // story is read entering the week, so "Return to the office" now returns
      // to the office — the manager still has the week to trade, train and
      // build on whatever the story just did to the club.
      set({
        career: dismissed,
        screen: dismissed.phase === 'matchday'
          ? 'matchday'
          : dismissed.phase === 'season-end' || dismissed.phase === 'complete'
            ? seasonBoundaryScreen(dismissed)
            : 'management',
        activeTab: 'home',
        weekReview: null,
        error: null,
      });
      queueCareerSave(get, set, dismissed);
    });
  },

  toggleHeroLicense(playerId) {
    guarded(set, () => {
      const career = requireCareer(get());
      const player = career.players.find(candidate =>
        candidate.id === playerId && candidate.clubId === career.userClubId,
      );
      if (player?.power === undefined) throw new Error('only heroes can receive a license');
      const selected = career.players
        .filter(candidate => candidate.clubId === career.userClubId && candidate.licensed)
        .map(candidate => candidate.id)
        .filter(id => id !== playerId);
      if (!player.licensed) {
        if (selected.length >= careerHeroLimit(career)) {
          throw new Error('Unlicense one hero before assigning this permit.');
        }
        selected.push(playerId);
      }

      let next = selectCareerLicensedHeroes(career, selected);
      if (!player.licensed) {
        const lineup = next.lineups.find(candidate => candidate.clubId === next.userClubId);
        if (lineup === undefined) throw new Error('the user club has no lineup');
        if (!lineup.playerIds.includes(playerId)) {
          const playerById = new Map(next.players.map(candidate => [candidate.id, candidate]));
          const outgoing = lineup.playerIds
            .map(id => playerById.get(id))
            .find(candidate =>
              candidate?.power !== undefined
              && !candidate.licensed
              && candidate.role === player.role,
            ) ?? lineup.playerIds
            .map(id => playerById.get(id))
            .find(candidate =>
              candidate?.power !== undefined
              && !candidate.licensed
              && candidate.role !== 'GK'
              && player.role !== 'GK',
            );
          if (outgoing === undefined) {
            throw new Error('bench an unlicensed hero in the same role before making this swap');
          }
          next = setCareerLineup(
            next,
            lineup.playerIds.map(id => id === outgoing.id ? playerId : id),
          );
        }
      }
      set({ career: next, error: null });
      queueCareerSave(get, set, next);
    });
  },

  swapStartingPlayer(starterId, replacementId) {
    guarded(set, () => {
      const next = swapCareerLineupPlayer(requireCareer(get()), starterId, replacementId);
      set({ career: next, error: null });
      queueCareerSave(get, set, next);
    });
  },

  resolvePlayerRequest(resolution: PlayerRequestResolution) {
    guarded(set, () => {
      const career = requireCareer(get());
      const catalog = career.playerRequestRules;
      if (catalog === undefined) throw new Error('this career has no player request catalog');
      const next = resolveCareerPlayerRequest(career, catalog, resolution);
      set({ career: next, error: null });
      queueCareerSave(get, set, next);
    });
  },

  acceptSponsorOffer(offerId) {
    guarded(set, () => {
      const career = requireCareer(get());
      const sponsorship = acceptCareerSponsorOffer(career.clubBusiness.sponsorship, {
        offerId,
        season: career.season,
        week: career.week,
      });
      const next = {
        ...career,
        clubBusiness: { ...career.clubBusiness, sponsorship },
      };
      const signed = sponsorship.activeContracts.find(contract => contract.contractId === `contract-${offerId}`);
      const actualSigned = signed === undefined
        ? undefined
        : allocateSponsorPortfolioPayment(
            sponsorship.activeContracts,
            difficultyRules(career).sponsorIncomePercent,
          ).find(payment => payment.contractId === signed.contractId)?.actualAmount;
      set({
        career: next,
        error: null,
        notice: signed === undefined
          ? null
          : {
              tone: 'success',
              message: actualSigned === undefined || actualSigned === signed.nominalMonthlyFee
                ? `${signed.sponsorName} signed for $${signed.nominalMonthlyFee.toLocaleString()} per month.`
                : `${signed.sponsorName} signed. Contract $${signed.nominalMonthlyFee.toLocaleString()} per month; the club receives $${actualSigned.toLocaleString()} on Chairman.`,
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
      const next = hasAssistantGuideMilestone(resolution.state, 'first-training-complete')
        ? resolution.state
        : completeAssistantGuideMilestone(resolution.state, 'first-training-complete');
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
        const player = career.players.find(candidate => candidate.id === playerId);
        // An injury ends the batch here exactly as it ends a watched one — the
        // engine would refuse the next drill anyway, and being skipped past is
        // no reason to train a player who has pulled up.
        if (player === undefined || player.injuryWeeks > 0) break;
        const { state, ...result } = trainPlayerInstantly(career, playerId, pathId);
        career = state;
        sequence += 1;
        last = { ...result, sequence, totalDrillsRun: career.totalInstantDrills ?? 0 };
        if (result.injury !== undefined) {
          injuredAfter = result.injury.recoveryWeeks;
          break;
        }
      }

      if (last === null) return;
      const next = hasAssistantGuideMilestone(career, 'first-training-complete')
        ? career
        : completeAssistantGuideMilestone(career, 'first-training-complete');
      const injuredPlayer = next.players.find(candidate => candidate.id === playerId);
      set({
        career: next,
        lastDrillResult: last,
        error: null,
        // The skipped drills reported themselves in silence; an injury among
        // them cannot. It is why the rest of the batch did not run.
        ...(injuredAfter === undefined ? {} : {
          notice: {
            tone: 'info' as const,
            message: `${injuredPlayer?.name ?? 'The player'} pulled up in training — out ${injuredAfter} `
              + `${injuredAfter === 1 ? 'week' : 'weeks'}.`,
          },
        }),
      });
      queueCareerSave(get, set, next);
    });
  },

  purchaseTrainingUpgrade(pathId) {
    guarded(set, () => {
      const transaction = purchaseCareerTrainingUpgrade(requireCareer(get()), pathId);
      set({
        career: transaction.state,
        error: null,
        notice: {
          tone: 'success',
          message: `${trainingPathLabel(pathId)} drills upgraded to Tier ${transaction.offer.tier}.`,
        },
      });
      queueCareerSave(get, set, transaction.state);
    });
  },

  clearDrillResult() {
    set({ lastDrillResult: null });
  },

  buildFacility() {
    guarded(set, () => {
      const next = buildTrainingGround(requireCareer(get()));
      set({ career: next, error: null });
      queueCareerSave(get, set, next);
    });
  },

  buildClubFacility(type, position) {
    guarded(set, () => {
      const career = requireCareer(get());
      if (type !== 'training-pitch' && openingTrainingPitchRequired(career)) {
        set({
          error: null,
          notice: { tone: 'info', message: OPENING_TRAINING_PITCH_REMINDER },
        });
        return;
      }
      const transaction = buildCareerFacility(career, type, position);
      const discovery = transaction.newlyDiscoveredAdjacencies.length === 0
        ? ''
        : ` Adjacency discovered: ${transaction.newlyDiscoveredAdjacencies.map(adjacencyDescription).join(', ')}.`;
      set({
        career: transaction.state,
        error: null,
        notice: { tone: 'success', message: `${FACILITY_CATALOG[type].name} construction started.${discovery}` },
      });
      queueCareerSave(get, set, transaction.state);
    });
  },

  upgradeClubFacility(buildingId) {
    guarded(set, () => {
      const career = requireCareer(get());
      const building = career.facilities.grid?.buildings.find(candidate => candidate.id === buildingId);
      if (building === undefined) throw new Error(`unknown facility ${buildingId}`);
      const transaction = upgradeCareerFacility(career, buildingId);
      const discovery = transaction.newlyDiscoveredAdjacencies.length === 0
        ? ''
        : ` Adjacency discovered: ${transaction.newlyDiscoveredAdjacencies.map(adjacencyDescription).join(', ')}.`;
      set({
        career: transaction.state,
        error: null,
        notice: { tone: 'success', message: `${FACILITY_CATALOG[building.type].name} upgrade started.${discovery}` },
      });
      queueCareerSave(get, set, transaction.state);
    });
  },

  relocateClubFacility(buildingId, position) {
    guarded(set, () => {
      const transaction = relocateCareerFacility(
        requireCareer(get()),
        buildingId,
        position,
      );
      const discovery = transaction.newlyDiscoveredAdjacencies.length === 0
        ? ''
        : ` Adjacency discovered: ${transaction.newlyDiscoveredAdjacencies.map(adjacencyDescription).join(', ')}.`;
      set({
        career: transaction.state,
        error: null,
        notice: { tone: 'success', message: `Facility moved.${discovery}` },
      });
      queueCareerSave(get, set, transaction.state);
    });
  },

  closeClubFacility(buildingId) {
    guarded(set, () => {
      const career = requireCareer(get());
      const building = career.facilities.grid?.buildings.find(candidate => candidate.id === buildingId);
      if (building === undefined) throw new Error(`unknown facility ${buildingId}`);
      const staffedOffice = building.type === 'coaching-office'
        && career.market?.assistantCoach !== undefined;
      if (staffedOffice) {
        const transaction = closeStaffedCareerCoachingOffice(career, buildingId);
        const net = transaction.confirmation.netCashEffect;
        set({
          career: transaction.state,
          error: null,
          notice: {
            tone: 'info',
            message: `${FACILITY_CATALOG[building.type].name} closed and the assistant departed. ${
              net < 0 ? '-' : net > 0 ? '+' : ''
            }$${Math.abs(net).toLocaleString()} net cash.`,
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
          message: refund === 0
            ? `${FACILITY_CATALOG[building.type].name} closed.`
            : `${FACILITY_CATALOG[building.type].name} closed. $${refund.toLocaleString()} recovered.`,
        },
      });
      queueCareerSave(get, set, transaction.state);
    });
  },

  startScoutMission(optionId) {
    guarded(set, () => {
      const career = requireCareer(get());
      const market = requireMarket(career);
      const option = careerMarketScoutOptions(career).find(candidate => candidate.id === optionId);
      if (option === undefined) throw new Error(`unknown scouting brief ${optionId}`);
      const transaction = startCareerScoutMission(
        career,
        market,
        option.region,
        option.focus,
        highestDivisionReached(career),
      );
      const next = { ...transaction.state, market: transaction.market };
      set({ career: next, error: null });
      queueCareerSave(get, set, next);
    });
  },

  openScoutReport(playerId) {
    const career = get().career;
    if (career?.market?.scoutReports.some(report => report.playerId === playerId) !== true) {
      set({ error: 'That scouting report is no longer available.' });
      return;
    }
    set({ notice: { tone: 'info', message: 'This scouting report shows the full estimated ranges.' } });
  },

  actOnTransfer(playerId, direction, bidId) {
    guarded(set, () => {
      const career = requireCareer(get());
      const market = requireMarket(career);
      if (direction === 'BUY') {
        const nextMarket = beginCareerTransferTalks(
          career,
          market,
          playerId,
          currentCareerDivision(career),
        );
        const next = { ...career, market: nextMarket };
        set({ career: next, error: null });
        queueCareerSave(get, set, next);
        return;
      }
      const listing = (market.transferListings ?? []).find(candidate => candidate.playerId === playerId);
      if (listing === undefined) {
        const nextMarket = listCareerPlayer(
          career,
          market,
          playerId,
          currentCareerDivision(career),
        );
        const next = { ...career, market: nextMarket };
        const bidCount = nextMarket.transferListings?.find(candidate => candidate.playerId === playerId)
          ?.bids.length ?? 0;
        set({
          career: next,
          error: null,
          notice: {
            tone: 'info',
            message: `Player listed. ${bidCount} bid${bidCount === 1 ? '' : 's'} arrived in Transfers.`,
          },
        });
        queueCareerSave(get, set, next);
        return;
      }
      if (bidId === undefined) throw new Error('choose a club bid before accepting the transfer');
      const bid = listing.bids.find(candidate => candidate.id === bidId);
      if (bid === undefined) throw new Error('that transfer bid is no longer available');
      const buyer = career.clubs.find(club => club.id === bid.buyerClubId);
      const transaction = acceptCareerTransferBid(career, market, bidId);
      const next = { ...transaction.state, market: transaction.market };
      set({
        career: next,
        error: null,
        notice: {
          tone: 'success',
          message: `${buyer?.name ?? 'The buying club'} signed the player for $${bid.quote.fee.toLocaleString()}.`,
        },
      });
      queueCareerSave(get, set, next);
    });
  },

  hireCoach(coachId, role = 'HEAD') {
    guarded(set, () => {
      const career = requireCareer(get());
      const next = { ...career, market: hireCareerCoach(career, requireMarket(career), coachId, role) };
      set({
        career: next,
        error: null,
        notice: { tone: 'success', message: role === 'HEAD' ? 'Head coach hired.' : 'Assistant coach hired.' },
      });
      queueCareerSave(get, set, next);
    });
  },

  protectBoardCandidate(playerId) {
    guarded(set, () => {
      const next = protectBoardUltimatumPlayer(requireCareer(get()), playerId);
      const player = next.players.find(candidate => candidate.id === playerId);
      set({
        career: next,
        error: null,
        notice: { tone: 'info', message: `${player?.name ?? 'Player'} is protected from a board sale.` },
      });
      queueCareerSave(get, set, next);
    });
  },

  dismissCoach(role = 'HEAD') {
    guarded(set, () => {
      const career = requireCareer(get());
      const transaction = dismissCareerCoach(career, requireMarket(career), role);
      const next = { ...transaction.state, market: transaction.market };
      set({ career: next, error: null });
      queueCareerSave(get, set, next);
    });
  },

  signYouth(playerId) {
    guarded(set, () => {
      const career = requireCareer(get());
      if (career.youthIntake === undefined) throw new Error('there is no youth intake available');
      const transaction = signYouthIntakeOffer(career, career.youthIntake, playerId);
      const next = { ...transaction.state, youthIntake: transaction.intake };
      set({ career: next, error: null });
      queueCareerSave(get, set, next);
    });
  },

  declineYouth() {
    guarded(set, () => {
      const career = requireCareer(get());
      if (career.youthIntake === undefined) throw new Error('there is no youth intake available');
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
            message: 'Transfer complete. The squad is now full; make room before the next signing.',
          },
        });
        queueCareerSave(get, set, next);
        return;
      }
      const consequence = applyCareerNegotiationConsequence(career, negotiatedMarket, 'transfer');
      const next = { ...consequence.state, market: consequence.market };
      set({
        career: next,
        error: consequence.market !== negotiatedMarket
          ? 'The agent walked away. Player morale and club reputation fell.'
          : null,
      });
      queueCareerSave(get, set, next);
    });
  },

  closeTransferTalks() {
    guarded(set, () => {
      const career = requireCareer(get());
      const market = requireMarket(career);
      const next = { ...career, market: closeCareerTransferTalks(career, market) };
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
      // The direct renewal is priced by the same machinery as the negotiated
      // one: it opens talks (which is where the loyalty refusal and the
      // growth/fame/hero premium live) and accepts the agent's opening ask
      // sight unseen. Negotiation exists to beat that number; skipping it
      // never beats it. Keeping one code path means this action can never
      // drift into a cheaper renewal than the shipped flow offers.
      const opened = beginCareerRenewalTalks(career, market, playerId);
      const talks = opened.renewalTalks;
      if (talks === undefined) throw new Error('renewal talks did not open');
      // An offer of the full ask with no pitch card is accepted on round one by
      // construction: the effective offer can only exceed the effective ask.
      const accepted = submitCareerRenewalOffer(opened, {
        weeklyWage: talks.negotiation.weeklyAsk,
        termSeasons: term ?? get().selectedContractTerm,
        // The cheapest promise in the deck, and the only one with no squad
        // management consequence — no lineup guarantee, no captaincy change,
        // no training debt.
        perk: 'JERSEY_10',
      });
      const transaction = completeCareerRenewal(career, accepted);
      const next = { ...transaction.state, market: transaction.market };
      set({ career: next, error: null });
      queueCareerSave(get, set, next);
    });
  },

  startRenewal(playerId) {
    guarded(set, () => {
      const career = requireCareer(get());
      const next = {
        ...career,
        market: beginCareerRenewalTalks(career, requireMarket(career), playerId),
      };
      set({ career: next, error: null });
      queueCareerSave(get, set, next);
    });
  },

  submitRenewalOffer(offer, pitchCard) {
    guarded(set, () => {
      const career = requireCareer(get());
      const negotiated = submitCareerRenewalOffer(requireMarket(career), offer, pitchCard);
      if (negotiated.renewalTalks?.negotiation.status === 'ACCEPTED') {
        const transaction = completeCareerRenewal(career, negotiated);
        const next = { ...transaction.state, market: transaction.market };
        set({
          career: next,
          selectedContractTerm: 1,
          error: null,
          notice: { tone: 'success', message: 'Contract renewed.' },
        });
        queueCareerSave(get, set, next);
        return;
      }
      const consequence = applyCareerNegotiationConsequence(career, negotiated, 'renewal');
      const next = { ...consequence.state, market: consequence.market };
      set({
        career: next,
        error: consequence.market !== negotiated
          ? 'The agent walked away. Player morale and club reputation fell.'
          : null,
      });
      queueCareerSave(get, set, next);
    });
  },

  closeRenewal() {
    guarded(set, () => {
      const career = requireCareer(get());
      const next = { ...career, market: closeCareerRenewalTalks(career, requireMarket(career)) };
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
}));

function currentMatchday(state: GameState) {
  if (state.phase !== 'matchday') throw new Error('there is no active matchday');
  const matchday = activeCareerMatchday(state);
  if (matchday === undefined) throw new Error('the matchday has no user fixture');
  const { fixture, fixtures } = matchday;
  const builtTeams = buildCareerMatchTeams(
    state,
    [...new Set(fixtures.flatMap(candidate => [candidate.homeClubId, candidate.awayClubId]))],
  );
  const teams = isFirstOnboardingFixture(state, fixture.id)
    ? {
        ...builtTeams,
        [fixture.homeClubId]: withoutPowers(builtTeams[fixture.homeClubId]),
        [fixture.awayClubId]: withoutPowers(builtTeams[fixture.awayClubId]),
      }
    : builtTeams;
  return { kind: matchday.kind, fixture, fixtures, teams, cupRoundLabel: matchday.cupRoundLabel };
}

function requireMarket(state: GameState): NonNullable<GameState['market']> {
  if (state.market === undefined) throw new Error('the career market is unavailable');
  return state.market;
}

function currentCareerDivision(state: GameState): number {
  return state.m2 === undefined ? 5 : currentUserDivision(state.m2);
}

function resolveContentEvent(state: GameState, choiceId: string): GameState {
  const pending = state.pendingEvent;
  if (pending === undefined) throw new Error('there is no active event');
  const event = launchContent.events.events.find(candidate => candidate.id === pending.eventId);
  if (event === undefined) throw new Error(`unknown event ${pending.eventId}`);
  const choice = event.choices.find(candidate => candidate.id === choiceId);
  if (choice === undefined) throw new Error(`unknown event choice ${choiceId}`);
  if (event.trigger.requiresPlayer === true && pending.selectedPlayerId === undefined) {
    throw new Error('choose a player before resolving this event');
  }
  const unavailableReason = eventChoiceUnavailableReason(state, choice);
  if (unavailableReason !== undefined) throw new Error(unavailableReason);

  const total = choice.outcomes.reduce((sum, candidate) => sum + candidate.weight, 0);
  const outcomeIndex = weightedIndex(
    choice.outcomes.map(candidate => candidate.weight),
    careerEventRoll(state, choiceId, 0, total),
  );
  const outcome = choice.outcomes[outcomeIndex];
  let working = state;
  if (choice.risky) {
    if (working.eventClock.riskyChoices === Number.MAX_SAFE_INTEGER) {
      throw new Error('event risk counter exceeds the safe integer range');
    }
    working = {
      ...working,
      eventClock: { ...working.eventClock, riskyChoices: working.eventClock.riskyChoices + 1 },
    };
  }
  if (outcome === undefined) throw new Error('the event outcome did not resolve');

  const playerId = pending.selectedPlayerId;
  const moneyDelta = sumEffect(outcome.effects, 'money');
  const trainingPointDelta = sumEffect(outcome.effects, 'tp');
  const fanDelta = sumEffect(outcome.effects, 'fans');
  const morale = outcome.effects.find(effect => effect.type === 'morale');
  const injury = outcome.effects.find(effect => effect.type === 'injury');
  const stat = outcome.effects.find(effect => effect.type === 'statDelta');
  const flags = outcome.effects
    .filter(effect => effect.type === 'flag' && effect.value)
    .map(effect => effect.type === 'flag' ? effect.flag : '');
  // Every authored risky branch stores its success first and its comic setback
  // second. Persisting the outcome index makes the cutscene save/reload safe.
  const riskySuccess = choice.risky && outcomeIndex === 0;
  const hasPlayerEffect = playerId !== undefined && (morale || injury || stat);
  let next = applyCareerEventOutcome(working, choice.id, outcome.text, {
    moneyDelta,
    trainingPointDelta,
    fanDelta,
    flags,
    ...(hasPlayerEffect ? {
      playerEffect: {
        playerId,
        ...(morale?.type === 'morale' ? { moraleDelta: morale.amount } : {}),
        ...(injury?.type === 'injury' ? { injuryWeeks: injury.weeks } : {}),
        ...(stat?.type === 'statDelta' ? {
          attribute: stat.attribute,
          attributeDelta: stat.amount,
        } : {}),
      },
    } : {}),
  }, {
    outcomeIndex,
    risky: choice.risky,
    success: riskySuccess,
    ...(outcome.nextEventId === undefined ? {} : { nextEventId: outcome.nextEventId }),
  });
  if (morale?.type === 'morale' && playerId === undefined) {
    next = {
      ...next,
      players: next.players.map(player => player.clubId === next.userClubId
        ? { ...player, morale: Math.max(0, Math.min(100, player.morale + morale.amount)) }
        : player),
    };
  }
  return {
    ...next,
    eventClock: { ...next.eventClock, weeksWithoutEvent: 0 },
  };
}

function sumEffect(
  effects: (typeof launchContent.events.events)[number]['choices'][number]['outcomes'][number]['effects'],
  type: 'money' | 'tp' | 'fans',
): number {
  return effects.reduce((sum, effect) => effect.type === type ? sum + effect.amount : sum, 0);
}

function weightedIndex(weights: readonly number[], roll: number): number {
  let cumulative = 0;
  for (let index = 0; index < weights.length; index += 1) {
    cumulative += weights[index];
    if (roll < cumulative) return index;
  }
  throw new Error('weighted event outcome did not resolve');
}

function careerEventRoll(
  state: GameState,
  choiceId: string,
  stream: number,
  upperExclusive: number,
): number {
  return deterministicCareerEventRoll(
    {
      careerSeed: state.careerSeed,
      season: state.season,
      week: state.week,
      riskyChoices: state.eventClock.riskyChoices,
    },
    choiceId,
    stream,
    upperExclusive,
  );
}

function resumeScreen(career: GameState): M1Screen {
  if (career.onboarding?.stage === 'create-player') return 'create-player';
  if (career.awakening.pending !== undefined || career.onboarding?.stage === 'reveal') return 'awakening';
  // Relaunching with a story open resumes it. Nothing records that the card was
  // opened, so treating the offer itself as "resume here" is what keeps a story
  // from being lost between a kill and the next launch.
  if (career.pendingEvent !== undefined) return 'event';
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
function seasonBoundaryScreen(career: GameState): M1Screen {
  if (hasPendingChampionshipCelebration(career)) return 'championship-celebration';
  // After the ordinary title, never before it. A D1 title that fires an endgame
  // moment suppresses the ordinary screen outright, so the only case where both
  // play is a lesser division's title in the season the Cup completed the pair
  // — and there the smaller news should land first and the summit last.
  if (pendingEndgameCelebration(career) !== undefined) return 'endgame-celebration';
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
      reconcileLegacyFirstAwakening(reconcileLaunchRoster(state, launchContent)),
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
  const hasPowerContent = launchContent.powers.powers.some(power => power.id === pending.power)
    && launchContent.onboarding.powers.some(copy => copy.powerId === pending.power);
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
    },
    // Onboarding waits at `reveal` for this cutscene, and `advanceCareer` sends
    // the player back to it, so the stage has to move on with the drop.
    ...(pending.firstHero && state.onboarding !== undefined && state.onboarding.stage !== 'complete'
      ? { onboarding: { ...state.onboarding, stage: 'complete' as const } }
      : {}),
  };
}

function reconcileLegacyFirstAwakening(state: GameState): GameState {
  if (state.awakening.pending !== undefined) return state;
  const onboarding = state.onboarding;
  if (onboarding?.stage === 'collapse' && onboarding.firstFixtureId !== undefined) {
    const lineup = state.lineups.find(candidate => candidate.clubId === state.userClubId);
    if (lineup === undefined) throw new Error('legacy first awakening is missing the user lineup');
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
    onboarding?.stage === 'reveal'
    && onboarding.firstFixtureId !== undefined
    && onboarding.createdPlayerId !== undefined
    && onboarding.awakenedPower !== undefined
  ) {
    return {
      ...state,
      awakening: {
        matchesSinceLastAwakening: 0,
        usedTriggerIds: [awakeningTriggerIds[0]],
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
  const owesCupAfterLeague = career.phase === 'matchday'
    && career.clubBusiness.pendingUserMatchImpacts.some(impact => impact.competition === 'LEAGUE');
  if (
    owesCupAfterLeague
    && store.repository !== null
    && store.lastPersistedCareer !== career
  ) {
    throw new Error('The league result is still saving. The Cup tie will open when it is safe.');
  }
}

function queueCareerSave(
  get: () => M1Store,
  set: (partial: Partial<M1Store>) => void,
  career: GameState,
): void {
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
      if (pendingCareerSave === null || pendingCareerSave.generation !== generation) return;
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
    'Save failed',
    () => {
      // A task that skipped (payload withdrawn, load error) proved nothing —
      // only an actual write may clear the failure streak.
      if (saved === null) return;
      clearSaveFailures(set);
      if (get().career === saved) set({ hasSavedCareer: true, lastPersistedCareer: saved });
    },
    () => recordSaveFailure(get, set),
  );
}

function recordSaveFailure(
  get: () => M1Store,
  set: (partial: Partial<M1Store>) => void,
): void {
  const consecutiveSaveFailures = get().consecutiveSaveFailures + 1;
  const saveBlocked = consecutiveSaveFailures >= SAVE_FAILURE_BLOCK_LIMIT;
  set({
    consecutiveSaveFailures,
    saveBlocked,
    // `error` is a dismissible toast, so it cannot carry this: the player would
    // wave it away and keep playing a career that exists only in memory.
    saveWarning: saveBlocked
      ? 'Progress is not being saved and the season is paused. Free up space on your device, then try saving again.'
      : 'Progress is not being saved. Anything since the last save is lost if the game closes.',
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
async function integrityFailSoft(repository: CareerRepository): Promise<boolean> {
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
  const sortOrder = (fixture.season - 1) * 100
    + (fixture.id.includes('-cup-') ? 50 + fixture.round : fixture.week);
  enqueueSave(
    set,
    async () => {
      if (get().persistenceLoadError !== null) return;
      await repository.save(careerId, fixture.id, sortOrder, replay);
    },
    'Replay save failed',
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
  const replacedCareerId = replacedCareer === null
    ? null
    : `m1-career-${replacedCareer.careerSeed}`;
  enqueueSave(
    set,
    async () => {
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
            message: `New career saved, but old match replays could not be cleared: ${errorMessage(error)}`,
          },
        });
      }
    },
    'New career could not be saved',
    () => {
      clearSaveFailures(set);
      if (get().career === career) set({ hasSavedCareer: true, lastPersistedCareer: career });
    },
    () => {
      // The write that failed is the one that would have replaced the career on
      // disk, so the live slot still holds it. Roll memory back onto that career
      // rather than leaving the player in one the game has refused to store:
      // treating this as an unreadable save would offer to delete the slot, and
      // the slot is the good career.
      if (replacedCareer === null) {
        // Nothing to lose to a retry — the slot was empty. This is the ordinary
        // "progress is not being saved" warning, with its Retry.
        recordSaveFailure(get, set);
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
      });
      if (replacedCareerPersisted) clearSaveFailures(set);
      else recordSaveFailure(get, set);
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
    .catch(error => {
      onError?.(error);
      if (ticket === latestSaveTicket) set({ saving: false });
      set({ error: `${errorPrefix}: ${errorMessage(error)}` });
    });
}

/** Whether the loaded career has finished the climb at least once. */
export function careerClimbCompleted(
  state: { career: GameState | null },
): boolean {
  return state.career?.eventFlags.includes(TRUE_ENDING_SEEN_FLAG) ?? false;
}

function guarded(set: (partial: Partial<M1Store>) => void, action: () => void): void {
  try {
    action();
  } catch (error) {
    set({ error: errorMessage(error) });
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function adjacencyDescription(value: string): string {
  return FACILITY_ADJACENCIES.find(adjacency => adjacency.id === value)?.description ?? value;
}
