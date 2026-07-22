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
  applyCareerTraining,
  beginStoryOnboarding,
  beginCareerTransferTalks,
  beginCareerRenewalTalks,
  careerHeroLimit,
  highestDivisionReached,
  buildCareerMatchTeams,
  buildCareerFacility,
  buildTrainingGround,
  chargeableCareerTrainingPlan,
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
  startNextSeason,
  startCareerScoutMission,
  submitCareerTransferOffer,
  submitCareerRenewalOffer,
  trainingDrillBlockedReason,
  trainingDrillPathId,
  upgradeCareerFacility,
  withoutPowers,
  type CreatedPlayerDraft,
  type CareerLegendLegacyChoice,
  type AssistantGuideSequenceId,
  type GameState,
  type FacilityPosition,
  type FacilityType,
  type LeagueFixture,
} from '../game';
import type { ContractOffer, PitchCard } from '../game/market';
import type { CareerRepository, ReplayRepository } from '../persistence';
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
}

export type PostMatchOverlay = 'summary' | 'development' | null;

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
  screen: M1Screen;
  activeTab: ManagementTab;
  selectedPlayerId?: string;
  assignedPlayerIds: string[];
  selectedDrillIds: string[];
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
    enableM2?: boolean,
  ) => Promise<void>;
  startNewCareer: (seed?: number, careerMode?: 'm1-slice' | 'full') => void;
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
  dismissPostMatchDevelopment: () => void;
  continueWeekReview: () => void;
  completeChampionshipCelebration: () => void;
  chooseLegacy: (choice: CareerLegendLegacyChoice) => void;
  selectEventPlayer: () => void;
  chooseEvent: (choiceId: string) => void;
  continueAfterEvent: () => void;
  toggleHeroLicense: (playerId: string) => void;
  swapStartingPlayer: (starterId: string, replacementId: string) => void;
  selectPlayer: (playerId: string) => void;
  toggleTrainingPlayer: (playerId: string) => void;
  toggleDrill: (drillId: string) => void;
  applyTraining: () => void;
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
  screen: 'welcome',
  activeTab: 'home',
  assignedPlayerIds: [],
  selectedDrillIds: [],
  watchedMatch: null,
  postMatch: null,
  postMatchOverlay: null,
  weekReview: null,
  selectedContractTerm: 1,
  error: null,
  notice: null,

  async initializePersistence(repository, replayRepository, enableM2 = false) {
    try {
      const loadedCareer = await repository.load();
      const reconciled = loadedCareer === null
        ? null
        : reconcileLaunchRoster(loadedCareer, launchContent, enableM2);
      const career = reconciled === null
        ? null
        : reconcilePendingStoryEvent(
          reconcileLegacyFirstAwakening(reconciled),
          launchContent.events,
        );
      if (career !== null && career !== loadedCareer) await repository.save(career);
      set({
        repository,
        replayRepository: replayRepository ?? null,
        persistenceReady: true,
        career,
        assignedPlayerIds: career?.trainingPlan?.assignedPlayerIds ?? [],
        selectedDrillIds: career?.trainingPlan?.drills.map(drill => drill.id) ?? [],
        hasSavedCareer: career !== null,
        postMatch: null,
        postMatchOverlay: null,
        weekReview: null,
        persistenceLoadError: null,
        error: null,
      });
    } catch (error) {
      set({
        repository,
        replayRepository: replayRepository ?? null,
        persistenceReady: true,
        persistenceLoadError: `Save could not be loaded safely: ${errorMessage(error)}`,
      });
    }
  },

  startNewCareer(seed, careerMode = 'm1-slice') {
    guarded(set, () => {
      if (get().persistenceLoadError !== null) {
        throw new Error('Resolve the save-load error before replacing this career.');
      }
      const replacedCareerId = get().career === null
        ? null
        : `m1-career-${get().career!.careerSeed}`;
      const career = beginStoryOnboarding(createCareer(createLaunchCareerSetup(
        seed ?? generateCareerSeed(),
        undefined,
        launchContent,
        careerMode === 'full' ? 'full' : undefined,
      )));
      set({
        career,
        hasSavedCareer: true,
        screen: 'create-player',
        activeTab: 'home',
        selectedPlayerId: undefined,
        assignedPlayerIds: [],
        selectedDrillIds: [],
        watchedMatch: null,
        postMatch: null,
        postMatchOverlay: null,
        weekReview: null,
        error: null,
      });
      queueNewCareerSave(get, set, career, replacedCareerId);
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
      const returnToPostMatch = !pending.firstHero && get().postMatch !== null;
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
        throw new Error('Finish your first training plan before advancing the week.');
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
        if (!hasAssistantGuideMilestone(career, 'desk-intro-complete')) {
          throw new Error("Finish Bert's briefing before advancing the week.");
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
            userReplayParticipantIds(quickMatch.replay, fixture, before.userClubId),
            awakeningPowerIds,
            awakeningTriggerIds,
            awakeningTuning,
          )
        : { state: completed, awakened: false };
      const next = awakening.state;
      const postMatch = isOnboardingMatch
        ? null
        : postMatchViewModel(before, next, fixture.id, userResult);
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
      const career = requireCareer(get());
      const { fixture, teams } = currentMatchday(career);
      const userIsFixtureHome = fixture.homeClubId === career.userClubId;
      set({
        watchedMatch: {
          fixture,
          home: teams[fixture.homeClubId],
          away: teams[fixture.awayClubId],
          userIsFixtureHome,
          controlledTeam: userIsFixtureHome ? 0 : 1,
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
          minuteLabel: `${Math.max(1, Math.min(90, Math.round((event.t / (HALF_TICKS * 2)) * 90)))}'`,
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
      const postMatch = isOnboardingMatch
        ? null
        : postMatchViewModel(before, next, fixture.id, supplied, highlights);
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
    const postMatch = get().postMatch;
    if (postMatch !== null && hasDevelopmentToShow(postMatch)) {
      set({ postMatchOverlay: 'development', error: null });
      return;
    }
    set({ postMatch: null, postMatchOverlay: null, error: null });
  },

  dismissPostMatchDevelopment() {
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
      const career = requireCareer(get());
      const pending = career.pendingEvent;
      if (pending?.resolvedChoiceId === undefined) throw new Error('resolve the event before continuing');
      const event = launchContent.events.events.find(candidate => candidate.id === pending.eventId);
      const guidedCareer = career.eventFlags.includes('m4:event-guide-seen')
        ? career
        : { ...career, eventFlags: [...career.eventFlags, 'm4:event-guide-seen'] };
      const dismissed = dismissCareerEvent(guidedCareer, event?.trigger.repeatable !== true);
      if (pending.resolvedNextEventId !== undefined) {
        const followUp = launchContent.events.events.find(
          candidate => candidate.id === pending.resolvedNextEventId,
        );
        if (followUp === undefined) throw new Error(`unknown chained event ${pending.resolvedNextEventId}`);
        if (followUp.trigger.repeatable === true || !dismissed.resolvedEventIds.includes(followUp.id)) {
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

  toggleTrainingPlayer(playerId) {
    const assigned = get().assignedPlayerIds;
    set({
      assignedPlayerIds: assigned.includes(playerId)
        ? assigned.filter(id => id !== playerId)
        : [...assigned, playerId],
      error: null,
    });
  },

  toggleDrill(drillId) {
    const selected = get().selectedDrillIds;
    if (selected.includes(drillId)) {
      set({ selectedDrillIds: selected.filter(id => id !== drillId), error: null });
      return;
    }
    if (selected.length >= 3) {
      set({ error: 'A weekly plan can contain at most three focus drills.' });
      return;
    }
    const drillById = new Map(launchContent.training.focusDrills.map(drill => [drill.id, drill]));
    const drill = drillById.get(drillId);
    if (drill === undefined) {
      set({ error: 'That focus drill is not available.' });
      return;
    }
    const selectedSamePath = selected.find(id => (
      trainingDrillPathId(id) === trainingDrillPathId(drillId)
    ));
    if (selectedSamePath !== undefined) {
      const selectedName = drillById.get(selectedSamePath)?.name ?? selectedSamePath;
      set({ error: `Replace ${selectedName} before choosing another level from that drill path.` });
      return;
    }
    const career = requireCareer(get());
    const blockedReason = trainingDrillBlockedReason(career, drillId);
    if (blockedReason !== undefined) {
      set({ error: blockedReason });
      return;
    }
    const prospectiveDrills = [...selected, drillId].map(id => drillById.get(id)!);
    const assignedPlayerIds = get().assignedPlayerIds;
    const requiredTrainingPoints = assignedPlayerIds.length === 0
      ? prospectiveDrills.reduce((total, selectedDrill) => total + selectedDrill.tpCost, 0)
      : chargeableCareerTrainingPlan(
          career,
          assignedPlayerIds,
          prospectiveDrills,
        ).trainingPointCost;
    const availableTrainingPoints = career.trainingPoints;
    if (requiredTrainingPoints > availableTrainingPoints) {
      set({
        error: `${drill.name} would make this plan cost ${requiredTrainingPoints} TP, but you only have ${availableTrainingPoints} TP. Choose a cheaper drill.`,
      });
      return;
    }
    set({ selectedDrillIds: [...selected, drillId], error: null });
  },

  applyTraining() {
    guarded(set, () => {
      const career = requireCareer(get());
      const assigned = get().assignedPlayerIds;
      const selectedIds = get().selectedDrillIds;
      if (assigned.length === 0 || selectedIds.length === 0) {
        throw new Error('Select at least one player and one focus drill.');
      }
      const drillById = new Map(launchContent.training.focusDrills.map(drill => [drill.id, drill]));
      const drills = selectedIds.map(id => {
        const drill = drillById.get(id);
        if (drill === undefined) throw new Error(`unknown training drill ${id}`);
        return drill;
      });
      const next = completeAssistantGuideMilestone(
        applyCareerTraining(career, assigned, drills),
        'first-training-complete',
      );
      set({
        career: next,
        assignedPlayerIds: [...assigned],
        selectedDrillIds: [...selectedIds],
        error: null,
      });
      queueCareerSave(get, set, next);
    });
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
      const next = { ...career, market: { ...market, transferTalks: undefined } };
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
      set({ career: next, error: null });
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
  return { kind: matchday.kind, fixture, fixtures, teams };
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

function hasDevelopmentToShow(postMatch: PostMatchViewModel): boolean {
  return postMatch.development.focusedTrainees.length > 0
    || postMatch.development.conditioning.length > 0
    || postMatch.development.trainingSkippedWarning !== undefined;
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

function userReplayParticipantIds(
  replay: ReplayEnvelope,
  fixture: LeagueFixture,
  userClubId: string,
): string[] {
  const team = fixture.homeClubId === userClubId ? replay.home : replay.away;
  return team.players.map(player => player.id);
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
  enqueueSave(
    set,
    async () => {
      if (get().persistenceLoadError !== null) return;
      await repository.save(career);
    },
    'Save failed',
    () => {
      if (get().career === career) set({ hasSavedCareer: true });
    },
  );
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
  replacedCareerId: string | null,
): void {
  const careerRepository = get().repository;
  const replayRepository = get().replayRepository;
  if (careerRepository === null && replayRepository === null) return;
  const careerId = `m1-career-${career.careerSeed}`;
  enqueueSave(
    set,
    async () => {
      if (replacedCareerId !== null && replacedCareerId !== careerId) {
        await replayRepository?.deleteAllForCareer(replacedCareerId);
      }
      await replayRepository?.deleteAllForCareer(careerId);
      await careerRepository?.save(career);
    },
    'New career save failed',
    () => {
      if (get().career === career) set({ hasSavedCareer: true });
    },
    error => {
      set({
        persistenceLoadError:
          `New career could not safely replace the existing save: ${errorMessage(error)}`,
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
