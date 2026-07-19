import { create } from 'zustand';
import { loadLaunchContent } from '../content';
import {
  advanceWeek,
  addCreatedPlayer,
  applyCareerEventOutcome,
  applyCareerTraining,
  awakenCreatedPlayer,
  beginStoryOnboarding,
  buildCareerTeams,
  buildTrainingGround,
  completeFirstOnboardingMatch,
  completeAssistantGuideMilestone,
  completeAssistantGuideSequence,
  completeMatchday,
  completeStoryOnboarding,
  createCareer,
  awakeningPowerRollSize,
  chooseStatWeightedAwakeningPower,
  deterministicCareerEventRoll,
  dismissCareerEvent,
  fixturesForCurrentWeek,
  hasAssistantGuideMilestone,
  isFirstOnboardingFixture,
  onboardingAwakeningSeed,
  offerCareerEvent,
  quickMatchForFixture,
  renewCareerPlayer,
  releaseCareerPlayer,
  resolveCareerAwakening,
  resolveMatchday,
  selectCareerEventPlayer,
  selectCareerLicensedHeroes,
  setCareerLineup,
  startNextSeason,
  withoutPowers,
  type CreatedPlayerDraft,
  type AssistantGuideSequenceId,
  type GameState,
  type LeagueFixture,
  type OnboardingOrigin,
} from '../game';
import type { CareerRepository, ReplayRepository } from '../persistence';
import { HALF_TICKS } from '../sim/geometry';
import { envelopeFrom } from '../sim/match';
import { mulberry32 } from '../sim/rng';
import type { MatchState, TeamDef } from '../sim/types';
import type { ManagementTab, PostMatchViewModel, WeeklyReviewViewModel } from '../ui';
import { createLaunchCareerSetup, generateCareerSeed, reconcileLaunchRoster } from './launch';
import { postMatchViewModel, weeklyReviewViewModel } from './view-models';

const launchContent = loadLaunchContent();
let saveQueue = Promise.resolve();
let latestSaveTicket = 0;

export type M1Screen =
  | 'welcome'
  | 'create-player'
  | 'management'
  | 'first-awakening'
  | 'event'
  | 'matchday'
  | 'watched'
  | 'postmatch'
  | 'week-review'
  | 'season-end';

export interface WatchedMatch {
  fixture: LeagueFixture;
  home: TeamDef;
  away: TeamDef;
  userIsFixtureHome: boolean;
  controlledTeam: 0 | 1;
}

export type PostMatchOverlay = 'summary' | 'development' | null;

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
  initializePersistence: (
    repository: CareerRepository,
    replayRepository?: ReplayRepository,
  ) => Promise<void>;
  startNewCareer: (seed?: number) => void;
  continueCareer: () => void;
  completePlayerCreation: (draft: CreatedPlayerDraft) => void;
  chooseFirstAwakening: (origin: OnboardingOrigin) => void;
  continueFirstAwakening: () => void;
  setActiveTab: (tab: ManagementTab) => void;
  completeAssistantGuide: (sequenceId: AssistantGuideSequenceId) => void;
  openMatchday: () => void;
  advanceCareer: () => void;
  quickResult: () => void;
  watchMatch: () => void;
  finishWatchedMatch: (result: MatchState) => void;
  continueAfterMatch: () => void;
  dismissPostMatchSummary: () => void;
  dismissPostMatchDevelopment: () => void;
  continueWeekReview: () => void;
  selectEventPlayer: () => void;
  chooseEvent: (choiceId: string) => void;
  continueAfterEvent: () => void;
  toggleHeroLicense: (playerId: string) => void;
  selectPlayer: (playerId: string) => void;
  toggleTrainingPlayer: (playerId: string) => void;
  toggleDrill: (drillId: string) => void;
  applyTraining: () => void;
  buildFacility: () => void;
  setContractTerm: (term: 1 | 2 | 3) => void;
  renewPlayer: (playerId: string, term?: 1 | 2 | 3) => void;
  releasePlayer: (playerId: string) => void;
  notify: (message: string) => void;
  clearError: () => void;
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

  async initializePersistence(repository, replayRepository) {
    try {
      const loadedCareer = await repository.load();
      const career = loadedCareer === null ? null : reconcileLaunchRoster(loadedCareer, launchContent);
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

  startNewCareer(seed) {
    guarded(set, () => {
      if (get().persistenceLoadError !== null) {
        throw new Error('Resolve the save-load error before replacing this career.');
      }
      const career = beginStoryOnboarding(createCareer(createLaunchCareerSetup(
        seed ?? generateCareerSeed(),
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
      queueNewCareerSave(get, set, career);
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

  chooseFirstAwakening(origin) {
    guarded(set, () => {
      const career = requireCareer(get());
      const next = awakenCreatedPlayer(
        career,
        origin,
        mulberry32(onboardingAwakeningSeed(career)),
      );
      set({ career: next, screen: 'first-awakening', error: null });
      queueCareerSave(get, set, next);
    });
  },

  continueFirstAwakening() {
    guarded(set, () => {
      const next = completeStoryOnboarding(requireCareer(get()));
      set({
        career: next,
        screen: 'management',
        activeTab: 'home',
        postMatch: null,
        postMatchOverlay: null,
        weekReview: null,
        error: null,
      });
      queueCareerSave(get, set, next);
    });
  },

  setActiveTab(activeTab) {
    if (activeTab === 'market') {
      set({ error: 'The transfer market arrives in M2.' });
      return;
    }
    set({ activeTab, screen: 'management', error: null });
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

  advanceCareer() {
    guarded(set, () => {
      const career = requireCareer(get());
      if (career.onboarding?.stage === 'create-player') {
        throw new Error('Create your player before entering the club office.');
      }
      if (career.onboarding?.stage === 'collapse' || career.onboarding?.stage === 'reveal') {
        set({ screen: 'first-awakening', error: null });
        return;
      }
      if (career.phase === 'matchday') {
        set({ screen: 'matchday', error: null });
        return;
      }
      if (career.phase === 'season-end') {
        const next = startNextSeason(career);
        set({ career: next, screen: 'management', activeTab: 'home', weekReview: null, error: null });
        queueCareerSave(get, set, next);
        return;
      }
      if (career.phase === 'complete') {
        set({ screen: 'season-end', error: null });
        return;
      }

      if (career.pendingEvent !== undefined) {
        set({ screen: 'event', error: null });
        return;
      }
      const eventId = scheduledEventId(career);
      if (eventId !== undefined) {
        const next = offerCareerEvent(career, eventId);
        set({ career: next, screen: 'event', error: null });
        queueCareerSave(get, set, next);
        return;
      }

      const advanced = advanceWeek(career);
      const next = advanced.week !== career.week
        && hasAssistantGuideMilestone(career, 'desk-intro-complete')
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
            ? 'season-end'
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
      const { fixture, fixtures, teams } = currentMatchday(before);
      const quickMatch = quickMatchForFixture(fixture, teams);
      const results = resolveMatchday(fixtures, teams, [quickMatch.result]);
      const userResult = results.find(result => result.fixtureId === fixture.id);
      if (userResult === undefined) throw new Error('the user fixture did not produce a result');
      const after = completeMatchday(before, results);
      const isOnboardingMatch = isFirstOnboardingFixture(before, fixture.id);
      const next = isOnboardingMatch
        ? completeFirstOnboardingMatch(after, fixture.id)
        : after;
      const postMatch = isOnboardingMatch
        ? null
        : postMatchViewModel(before, next, fixture.id, userResult);
      set({
        career: next,
        postMatch,
        postMatchOverlay: null,
        weekReview: null,
        screen: isOnboardingMatch ? 'first-awakening' : 'postmatch',
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
      const { fixture, fixtures, teams } = currentMatchday(before);
      const watchedMatch = get().watchedMatch;
      if (watchedMatch === null || watchedMatch.fixture.id !== fixture.id) {
        throw new Error('the watched fixture context is missing');
      }
      const supplied = {
        fixtureId: fixture.id,
        homeGoals: result.score[0],
        awayGoals: result.score[1],
      };
      const results = resolveMatchday(fixtures, teams, [supplied]);
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
      const next = isOnboardingMatch
        ? completeFirstOnboardingMatch(after, fixture.id)
        : after;
      const postMatch = isOnboardingMatch
        ? null
        : postMatchViewModel(before, next, fixture.id, supplied, highlights);
      set({
        career: next,
        postMatch,
        postMatchOverlay: null,
        weekReview: null,
        screen: isOnboardingMatch ? 'first-awakening' : 'postmatch',
        watchedMatch: null,
        error: null,
      });
      queueReplaySave(get, set, before, fixture, envelopeFrom(result));
      queueCareerSave(get, set, next);
    });
  },

  continueAfterMatch() {
    set({
      weekReview: null,
      postMatchOverlay: get().postMatch === null ? null : 'summary',
      screen: 'management',
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
    set({ weekReview: null, screen: 'management', activeTab: 'home', error: null });
  },

  selectEventPlayer() {
    guarded(set, () => {
      const career = requireCareer(get());
      if (career.pendingEvent === undefined) throw new Error('there is no active event');
      const lineup = career.lineups.find(candidate => candidate.clubId === career.userClubId);
      if (lineup === undefined) throw new Error('the user club has no lineup');
      const candidates = career.players
        .filter(player =>
          player.clubId === career.userClubId &&
          player.power === undefined &&
          !lineup.playerIds.includes(player.id),
        )
        .sort((left, right) => (left.role === 'FWD' ? -1 : 1) - (right.role === 'FWD' ? -1 : 1));
      if (candidates.length === 0) throw new Error('no eligible unpowered bench player is available');
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
      const selectedPlayer = pending.selectedPlayerId === undefined
        ? undefined
        : career.players.find(player => player.id === pending.selectedPlayerId);
      const shouldRepeat = pending.eventId === 'spider-training-day'
        && !career.eventFlags.includes('second-hero-awakened')
        && selectedPlayer?.power === undefined;
      const dismissed = dismissCareerEvent(career, !shouldRepeat);
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
            ? 'season-end'
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
        if (selected.length >= 2) {
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
    set({
      selectedDrillIds: selected.includes(drillId)
        ? selected.filter(id => id !== drillId)
        : selected.length >= 3 ? selected : [...selected, drillId],
      error: selected.length >= 3 && !selected.includes(drillId)
        ? 'A weekly plan can contain at most three focus drills.'
        : null,
    });
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

  releasePlayer(playerId) {
    guarded(set, () => {
      const next = releaseCareerPlayer(requireCareer(get()), playerId);
      set({ career: next, error: null });
      queueCareerSave(get, set, next);
    });
  },

  notify(message) {
    set({ error: message });
  },

  clearError() {
    set({ error: null });
  },
}));

function currentMatchday(state: GameState) {
  if (state.phase !== 'matchday') throw new Error('there is no active matchday');
  const fixtures = fixturesForCurrentWeek(state);
  const fixture = fixtures.find(candidate =>
    candidate.homeClubId === state.userClubId || candidate.awayClubId === state.userClubId,
  );
  if (fixture === undefined) throw new Error('the matchday has no user fixture');
  const builtTeams = buildCareerTeams(state);
  const teams = isFirstOnboardingFixture(state, fixture.id)
    ? {
        ...builtTeams,
        [fixture.homeClubId]: withoutPowers(builtTeams[fixture.homeClubId]),
        [fixture.awayClubId]: withoutPowers(builtTeams[fixture.awayClubId]),
      }
    : builtTeams;
  return { fixture, fixtures, teams };
}

function scheduledEventId(state: GameState): string | undefined {
  if (
    state.season === 1 &&
    state.week >= 7 &&
    state.week <= 12 &&
    !state.resolvedEventIds.includes('giant-spider-arrives')
  ) {
    return 'giant-spider-arrives';
  }
  if (
    state.season === 1 &&
    state.week >= 9 &&
    state.week <= 24 &&
    state.eventFlags.includes('spider-chase') &&
    !state.resolvedEventIds.includes('spider-training-day')
  ) {
    return 'spider-training-day';
  }
  if (
    state.season === 1
    && state.week >= 10
    && state.week <= 29
    && state.eventFlags.includes('second-hero-awakened')
    && !state.resolvedEventIds.includes('license-pressure-awakening')
  ) {
    return 'license-pressure-awakening';
  }
  return undefined;
}

function resolveContentEvent(state: GameState, choiceId: string): GameState {
  const pending = state.pendingEvent;
  if (pending === undefined) throw new Error('there is no active event');
  const event = launchContent.events.events.find(candidate => candidate.id === pending.eventId);
  if (event === undefined) throw new Error(`unknown event ${pending.eventId}`);
  const choice = event.choices.find(candidate => candidate.id === choiceId);
  if (choice === undefined) throw new Error(`unknown event choice ${choiceId}`);

  let working = state;
  let outcome;
  const awakeningOutcome = choice.outcomes.find(candidate =>
    candidate.effects.some(effect => effect.type === 'awakenPower'),
  );
  if (awakeningOutcome !== undefined) {
    const playerId = pending.selectedPlayerId;
    if (playerId === undefined) throw new Error('choose a player before resolving the awakening');
    const player = working.players.find(candidate =>
      candidate.id === playerId && candidate.clubId === working.userClubId,
    );
    if (player === undefined) throw new Error(`unknown awakening player ${playerId}`);
    const awakeningEffect = awakeningOutcome?.effects.find(
      effect => effect.type === 'awakenPower',
    );
    if (awakeningEffect?.type !== 'awakenPower') {
      throw new Error('the awakening content is missing its power outcome');
    }
    const guaranteed = event.id === 'license-pressure-awakening';
    const awakeningRoll = guaranteed ? 0 : careerEventRoll(working, choiceId, 0, 100);
    const powerRollSize = awakeningPowerRollSize(awakeningEffect.powerIds, player.attrs);
    const powerRoll = careerEventRoll(
      working,
      choiceId,
      2,
      powerRollSize,
    );
    const awakening = resolveCareerAwakening(
      working,
      playerId,
      awakeningRoll,
      chooseStatWeightedAwakeningPower(awakeningEffect.powerIds, player.attrs, powerRoll),
    );
    working = awakening.state;
    if (awakening.awakened) {
      if (!guaranteed) {
        working = licenseSecondHero(working, playerId);
        working = addEventFlag(working, 'second-hero-awakened');
      }
      outcome = awakeningOutcome;
    } else {
      const ordinary = choice.outcomes.filter(candidate =>
        !candidate.effects.some(effect => effect.type === 'awakenPower'),
      );
      const total = ordinary.reduce((sum, candidate) => sum + candidate.weight, 0);
      outcome = ordinary[weightedIndex(
        ordinary.map(candidate => candidate.weight),
        careerEventRoll(working, choiceId, 1, total),
      )];
    }
  } else {
    const total = choice.outcomes.reduce((sum, candidate) => sum + candidate.weight, 0);
    outcome = choice.outcomes[
      weightedIndex(
        choice.outcomes.map(candidate => candidate.weight),
        careerEventRoll(working, choiceId, 0, total),
      )
    ];
    if (choice.risky) {
      if (working.eventClock.riskyChoices === Number.MAX_SAFE_INTEGER) {
        throw new Error('awakening pity counter exceeds the safe integer range');
      }
      working = {
        ...working,
        eventClock: { ...working.eventClock, riskyChoices: working.eventClock.riskyChoices + 1 },
      };
    }
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

function addEventFlag(state: GameState, flag: string): GameState {
  return state.eventFlags.includes(flag)
    ? state
    : { ...state, eventFlags: [...state.eventFlags, flag] };
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
  if (career.onboarding?.stage === 'collapse' || career.onboarding?.stage === 'reveal') {
    return 'first-awakening';
  }
  if (career.pendingEvent !== undefined) return 'event';
  if (career.phase === 'matchday') return 'matchday';
  if (career.phase === 'season-end' || career.phase === 'complete') return 'season-end';
  return 'management';
}

function hasDevelopmentToShow(postMatch: PostMatchViewModel): boolean {
  return postMatch.development.focusedTrainees.length > 0
    || postMatch.development.conditioning.length > 0
    || postMatch.development.trainingSkippedWarning !== undefined;
}

function licenseSecondHero(state: GameState, playerId: string): GameState {
  const player = state.players.find(candidate =>
    candidate.id === playerId && candidate.clubId === state.userClubId,
  );
  if (player?.power === undefined) throw new Error('the awakened player is not a user-club hero');
  const licensedIds = state.players
    .filter(candidate => candidate.clubId === state.userClubId && candidate.licensed)
    .map(candidate => candidate.id);
  if (licensedIds.includes(playerId)) return state;
  if (licensedIds.length >= 2) return state;

  let next = selectCareerLicensedHeroes(state, [...licensedIds, playerId]);
  const lineup = next.lineups.find(candidate => candidate.clubId === next.userClubId);
  if (lineup === undefined) throw new Error('the user club has no lineup');
  if (lineup.playerIds.includes(playerId)) return next;

  const playerById = new Map(next.players.map(candidate => [candidate.id, candidate]));
  const outgoing = lineup.playerIds
    .map(id => playerById.get(id))
    .find(candidate =>
      candidate?.role === player.role
      && candidate.power === undefined
      && candidate.injuryWeeks === 0,
    ) ?? lineup.playerIds
    .map(id => playerById.get(id))
    .find(candidate =>
      candidate?.role !== 'GK'
      && candidate?.power === undefined
      && candidate?.injuryWeeks === 0,
    );
  if (outgoing === undefined) {
    throw new Error('there is no regular outfield starter available for the second hero');
  }
  next = setCareerLineup(
    next,
    lineup.playerIds.map(id => id === outgoing.id ? playerId : id),
  );
  return next;
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
  const sortOrder = (fixture.season - 1) * 100 + fixture.week;
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
): void {
  const careerRepository = get().repository;
  const replayRepository = get().replayRepository;
  if (careerRepository === null && replayRepository === null) return;
  const careerId = `m1-career-${career.careerSeed}`;
  enqueueSave(
    set,
    async () => {
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
