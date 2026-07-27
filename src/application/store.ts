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
  completeFirstOnboardingMatch,
  completeAssistantGuideMilestone,
  completeAssistantGuideSequence,
  completeMatchday,
  completePostMatchAwakening,
  completeCareerTransfer,
  completeCareerRenewal,
  createCareer,
  currentUserDivision,
  deterministicCareerEventRoll,
  declineYouthIntakeOffers,
  dismissCareerEvent,
  dismissCareerCoach,
  hireCareerCoach,
  listCareerPlayer,
  acceptCareerTransferBid,
  hasAssistantGuideMilestone,
  isFirstOnboardingFixture,
  offerCareerEvent,
  nextPendingClubLegend,
  quickMatchForFixture,
  protectBoardUltimatumPlayer,
  reconcilePendingClubLegends,
  relocateCareerFacility,
  renewCareerPlayer,
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
  trainPlayerInstantly,
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
  type GameState,
  type FacilityPosition,
  type FacilityType,
  type LeagueFixture,
  type NationalCupRoundLabel,
} from '../game';
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
import { careerMarketScoutOptions } from './market-source-adapter';
import {
  postMatchViewModel,
  reconcileHomeAssistantInbox,
  weeklyReviewViewModel,
} from './view-models';
import {
  eventChoiceUnavailableReason,
  eventOfferForWeek,
  reconcilePendingStoryEvent,
} from './event-selection';
import {
  completeChampionshipCelebration as markChampionshipCelebrationComplete,
  hasPendingChampionshipCelebration,
} from './championship-celebration';

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
 */
let pendingCareerSave: GameState | null = null;

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
  | 'season-end';

export interface WatchedMatch {
  fixture: LeagueFixture;
  home: TeamDef;
  away: TeamDef;
  userIsFixtureHome: boolean;
  controlledTeam: 0 | 1;
  /** Present only for a Global Cup tie; it opens the match on a title card. */
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
  persistenceReady: boolean;
  saving: boolean;
  hasSavedCareer: boolean;
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
  selectedContractTerm: 1 | 2 | 3;
  error: string | null;
  notice: StoreNotice | null;
  initializePersistence: (
    repository: CareerRepository,
    replayRepository?: ReplayRepository,
  ) => Promise<void>;
  discardUnreadableSave: () => Promise<void>;
  restoreBackupSave: () => Promise<void>;
  retrySave: () => void;
  startNewCareer: (seed?: number) => void;
  continueCareer: () => void;
  completePlayerCreation: (draft: CreatedPlayerDraft) => void;
  continueAfterAwakening: () => void;
  setActiveTab: (tab: ManagementTab) => void;
  reconcileAssistantInbox: () => void;
  completeAssistantGuide: (sequenceId: AssistantGuideSequenceId) => void;
  openMatchday: () => void;
  openCupFixture: (fixtureId: string) => void;
  advanceCareer: () => void;
  quickResult: () => void;
  watchMatch: () => void;
  finishWatchedMatch: (result: MatchState) => void;
  continueAfterMatch: () => void;
  dismissPostMatchSummary: () => void;
  continueWeekReview: () => void;
  completeChampionshipCelebration: () => void;
  chooseLegacy: (choice: CareerLegendLegacyChoice) => void;
  selectEventPlayer: () => void;
  chooseEvent: (choiceId: string) => void;
  continueAfterEvent: () => void;
  toggleHeroLicense: (playerId: string) => void;
  swapStartingPlayer: (starterId: string, replacementId: string) => void;
  selectPlayer: (playerId: string) => void;
  trainPlayer: (playerId: string, pathId: string) => void;
  clearDrillResult: () => void;
  buildFacility: () => void;
  buildClubFacility: (type: FacilityType, position: FacilityPosition) => void;
  upgradeClubFacility: (buildingId: string) => void;
  relocateClubFacility: (buildingId: string, position: FacilityPosition) => void;
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
  persistenceReady: false,
  saving: false,
  hasSavedCareer: false,
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
  selectedContractTerm: 1,
  error: null,
  notice: null,

  async initializePersistence(repository, replayRepository) {
    try {
      const loadedCareer = await repository.load();
      const career = loadedCareer === null ? null : reconcileLoadedCareer(loadedCareer);
      set({
        repository,
        replayRepository: replayRepository ?? null,
        persistenceReady: true,
        career,
        hasSavedCareer: career !== null,
        postMatch: null,
        postMatchOverlay: null,
        weekReview: null,
        persistenceLoadError: null,
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
      });
    }
  },

  async discardUnreadableSave() {
    const { repository, persistenceLoadError } = get();
    if (repository === null || persistenceLoadError === null) return;
    try {
      await repository.delete();
    } catch (error) {
      set({
        persistenceLoadError: `Save could not be deleted: ${errorMessage(error)}`,
      });
      return;
    }
    set({
      persistenceLoadError: null,
      career: null,
      hasSavedCareer: false,
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
    let restored: GameState;
    try {
      restored = reconcileLoadedCareer(await repository.restoreBackup());
    } catch (error) {
      set({ persistenceLoadError: `Backup could not be restored: ${errorMessage(error)}` });
      return;
    }
    set({
      career: restored,
      hasSavedCareer: true,
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

  /** Retries the last career state, so a fixed disk can clear a save block. */
  retrySave() {
    const career = get().career;
    if (career === null) return;
    queueCareerSave(get, set, career);
  },

  startNewCareer(seed) {
    guarded(set, () => {
      if (get().persistenceLoadError !== null) {
        throw new Error('Resolve the save-load error before replacing this career.');
      }
      const replacedCareer = get().career;
      const career = beginStoryOnboarding(createCareer(createLaunchCareerSetup(
        seed ?? generateCareerSeed(),
        undefined,
        launchContent,
      )));
      set({
        career,
        hasSavedCareer: true,
        screen: 'create-player',
        activeTab: 'home',
        selectedPlayerId: undefined,
        watchedMatch: null,
        postMatch: null,
        postMatchOverlay: null,
        weekReview: null,
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
    const next = reconcileHomeAssistantInbox(career);
    if (next === career) return;
    set({ career: next });
    queueCareerSave(get, set, next);
  },

  completeAssistantGuide(sequenceId) {
    guarded(set, () => {
      const next = completeAssistantGuideSequence(requireCareer(get()), sequenceId);
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
        hasAssistantGuideMilestone(career, 'intro-complete')
        && !hasAssistantGuideMilestone(career, 'first-training-complete')
      ) {
        throw new Error('Train a player before advancing the week.');
      }
      const guidedFirstWeek = hasAssistantGuideMilestone(career, 'intro-complete')
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
        if (!trainingGroundStarted) {
          throw new Error('Build the Training Ground from your inbox before advancing the week.');
        }
        if (activeTab !== 'home') {
          throw new Error('Return home before advancing the week.');
        }
        if (career.market !== undefined && career.market.headCoach === undefined) {
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
      if (hasPendingChampionshipCelebration(career)) {
        set({ screen: 'championship-celebration', error: null });
        return;
      }
      if (career.phase === 'season-end') {
        const guidedCareer = career.eventFlags.includes('m4:season-recap-guide-seen')
          ? career
          : { ...career, eventFlags: [...career.eventFlags, 'm4:season-recap-guide-seen'] };
        // TODO: startNextSeason bypasses advanceWeek's interrupt guard, but
        // resolveCareerTrainingWeek still skips at-cap slots and the next real
        // advance re-blocks, so this is low impact (see Finding 4).
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

      if (career.pendingEvent !== undefined) {
        set({ screen: 'event', error: null });
        return;
      }
      const eventOffer = eventOfferForWeek(career, launchContent.events);
      if (eventOffer.eventId !== undefined) {
        const next = offerCareerEvent(
          { ...career, eventClock: eventOffer.eventClock },
          eventOffer.eventId,
        );
        set({ career: next, screen: 'event', error: null });
        queueCareerSave(get, set, next);
        return;
      }

      const careerForAdvance = { ...career, eventClock: eventOffer.eventClock };
      const advanced = advanceWeek(careerForAdvance);
      const next = advanced.week !== career.week
        && hasAssistantGuideMilestone(career, 'first-training-complete')
        ? completeAssistantGuideMilestone(advanced, 'first-week-advanced')
        : advanced;
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

  quickResult() {
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
      const { kind, fixture, fixtures, teams } = currentMatchday(before);
      const quickMatch = quickMatchForFixture(fixture, teams);
      const results = kind === 'league'
        ? resolveMatchday(fixtures, teams, [quickMatch.result])
        : [quickMatch.result];
      const userResult = results.find(result => result.fixtureId === fixture.id);
      if (userResult === undefined) throw new Error('the user fixture did not produce a result');
      const after = completeMatchday(before, results);
      const isOnboardingMatch = isFirstOnboardingFixture(before, fixture.id);
      const completed = isOnboardingMatch
        ? completeFirstOnboardingMatch(after, fixture.id)
        : after;
      const awakening = kind === 'league'
        ? resolvePostMatchAwakening(
            completed,
            fixture.id,
            userMatchParticipantIds(quickMatch.match, fixture, before.userClubId),
            awakeningPowerIds,
            awakeningTriggerIds,
            awakeningTuning,
          )
        : { state: completed, awakened: false };
      const next = awakening.state;
      // The onboarding match earns its statement too; the awakening cutscene
      // runs first, so the payoff still lands before any accounting.
      const postMatch = postMatchViewModel(before, next, fixture.id, userResult);
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
      if (watchedMatch === null || watchedMatch.fixture.id !== fixture.id) {
        throw new Error('the watched fixture context is missing');
      }
      const scorerPlayerIds = result.events
        .filter(event => event.kind === 'GOAL')
        .map(event => result.players[event.by]?.def.id)
        .filter((playerId): playerId is string => playerId !== undefined);
      const supplied = {
        fixtureId: fixture.id,
        homeGoals: result.score[0],
        awayGoals: result.score[1],
        ...(scorerPlayerIds.length === result.score[0] + result.score[1]
          ? { scorerPlayerIds }
          : {}),
      };
      const results = kind === 'league'
        ? resolveMatchday(fixtures, teams, [supplied])
        : [supplied];
      const after = completeMatchday(before, results);
      const highlights = result.events
        .filter(event => event.kind === 'GOAL')
        .map((event, index) => ({
          id: `${fixture.id}-goal-${index}`,
          // Same rounding as the live match clock (MatchScreen): a goal's
          // post-match minute must match the minute shown when it went in.
          minuteLabel: `${Math.max(1, Math.min(90, Math.ceil((event.t / (HALF_TICKS * 2)) * 90)))}'`,
          description: event.by >= 0 && event.by < result.players.length
            ? `${result.players[event.by].def.name} scored`
            : 'Goal',
        }));
      const isOnboardingMatch = isFirstOnboardingFixture(before, fixture.id);
      const completed = isOnboardingMatch
        ? completeFirstOnboardingMatch(after, fixture.id)
        : after;
      const awakening = kind === 'league'
        ? resolvePostMatchAwakening(
            completed,
            fixture.id,
            userMatchParticipantIds(result, fixture, before.userClubId),
            awakeningPowerIds,
            awakeningTriggerIds,
            awakeningTuning,
          )
        : { state: completed, awakened: false };
      const next = awakening.state;
      const postMatch = postMatchViewModel(before, next, fixture.id, supplied, highlights);
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

  continueAfterMatch() {
    const career = get().career;
    const atSeasonBoundary = career !== null
      && (career.phase === 'season-end' || career.phase === 'complete');
    const hasSecondMatch = career?.phase === 'matchday';
    set({
      postMatch: atSeasonBoundary || hasSecondMatch ? null : get().postMatch,
      weekReview: null,
      postMatchOverlay: atSeasonBoundary || hasSecondMatch || get().postMatch === null ? null : 'summary',
      screen: atSeasonBoundary
        ? seasonBoundaryScreen(career)
        : hasSecondMatch ? 'matchday' : 'management',
      activeTab: 'home',
      error: null,
    });
  },

  dismissPostMatchSummary() {
    set({ postMatch: null, postMatchOverlay: null, error: null });
  },

  continueWeekReview() {
    const career = requireCareer(get());
    set({
      weekReview: null,
      screen: career.phase === 'season-end' || career.phase === 'complete'
        ? seasonBoundaryScreen(career)
        : 'management',
      activeTab: 'home',
      error: null,
    });
  },

  completeChampionshipCelebration() {
    guarded(set, () => {
      const career = requireCareer(get());
      if (!hasPendingChampionshipCelebration(career)) {
        throw new Error('there is no league championship celebration to complete');
      }
      const next = markChampionshipCelebrationComplete(career);
      set({ career: next, screen: 'season-end', error: null });
      queueCareerSave(get, set, next);
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
      const next = resolveContentEvent(career, choiceId);
      set({ career: next, error: null });
      queueCareerSave(get, set, next);
    });
  },

  continueAfterEvent() {
    guarded(set, () => {
      // This action advances the week on its own, so it honours the same
      // saveBlocked pause as advanceCareer.
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
      const next = advanceWeek(dismissed);
      const weekReview = next.phase === 'manage' && next.week !== dismissed.week
        ? weeklyReviewViewModel(dismissed, next)
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
      const transaction = buildCareerFacility(requireCareer(get()), type, position);
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
            message: 'Transfer complete. The squad is now full; Bert has left a note about future signings.',
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
      const next = renewCareerPlayer(
        requireCareer(get()),
        playerId,
        4,
        term ?? get().selectedContractTerm,
      );
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
      const next = { ...career, market: closeCareerRenewalTalks(requireMarket(career)) };
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
  if (career.pendingEvent !== undefined) return 'event';
  if (career.phase === 'matchday') return 'matchday';
  if (career.phase === 'season-end' || career.phase === 'complete') {
    return seasonBoundaryScreen(career);
  }
  if (nextPendingClubLegend(career) !== undefined) return 'legacy';
  return 'management';
}

function seasonBoundaryScreen(career: GameState): M1Screen {
  return hasPendingChampionshipCelebration(career)
    ? 'championship-celebration'
    : 'season-end';
}

function userMatchParticipantIds(
  result: MatchState,
  fixture: LeagueFixture,
  userClubId: string,
): string[] {
  const userTeam = fixture.homeClubId === userClubId ? 0 : 1;
  const finalPlayers = result.players
    .filter(player => player.team === userTeam)
    .map(player => player.def.id);
  const substitutedPlayers = result.events.flatMap(event =>
    event.kind === 'SUBSTITUTION' && event.team === userTeam
      ? [event.outPlayerId]
      : [],
  );
  return [...new Set([...finalPlayers, ...substitutedPlayers])];
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

function queueCareerSave(
  get: () => M1Store,
  set: (partial: Partial<M1Store>) => void,
  career: GameState,
): void {
  const repository = get().repository;
  if (repository === null) return;
  if (pendingCareerSave !== null) {
    pendingCareerSave = career;
    return;
  }
  pendingCareerSave = career;
  let saved: GameState | null = null;
  enqueueSave(
    set,
    async () => {
      // Coalesced: while this task waited its turn, newer states replaced the
      // payload, so a burst of actions costs one write of the final state.
      const state = pendingCareerSave;
      pendingCareerSave = null;
      if (state === null || get().persistenceLoadError !== null) return;
      // Every career save is queued for the career the store had just moved to,
      // so a different one being live by the time this runs means this career
      // was abandoned — a replacement whose own save failed and rolled back onto
      // the career still in the live slot. Writing it now would undo that.
      const live = get().career;
      if (live !== null && live.careerSeed !== state.careerSeed) return;
      await repository.save(state);
      saved = state;
    },
    'Save failed',
    () => {
      // A task that skipped (payload withdrawn, load error) proved nothing —
      // only an actual write may clear the failure streak.
      if (saved === null) return;
      clearSaveFailures(set);
      if (get().career === saved) set({ hasSavedCareer: true });
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
  pendingCareerSave = null;
  const replacedCareerId = replacedCareer === null
    ? null
    : `m1-career-${replacedCareer.careerSeed}`;
  enqueueSave(
    set,
    async () => {
      if (replacedCareerId !== null && replacedCareerId !== careerId) {
        await replayRepository?.deleteAllForCareer(replacedCareerId);
      }
      await replayRepository?.deleteAllForCareer(careerId);
      await careerRepository?.save(career);
    },
    'New career could not be saved',
    () => {
      clearSaveFailures(set);
      if (get().career === career) set({ hasSavedCareer: true });
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
      set({
        career: replacedCareer,
        hasSavedCareer: true,
        screen: resumeScreen(replacedCareer),
        activeTab: 'home',
        selectedPlayerId: undefined,
        watchedMatch: null,
        postMatch: null,
        postMatchOverlay: null,
        weekReview: null,
      });
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
