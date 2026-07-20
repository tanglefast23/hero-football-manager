import './global.css';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Text, View } from 'react-native';
import { openDatabaseAsync } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Silkscreen_400Regular, Silkscreen_700Bold } from '@expo-google-fonts/silkscreen';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  loadLaunchContent,
  type AssistantGuideDestination,
  type AssistantGuideFocus,
  type AssistantGuideSequenceId,
} from './src/content';
import {
  createCareerRepository,
  createPreferencesRepository,
  createReplayRepository,
  DEFAULT_APP_PREFERENCES,
  replaceFormationPreset,
  type AppPreferences,
  type PreferencesRepository,
} from './src/persistence';
import { MatchScreen } from './src/render/MatchScreen';
import { TrainingTransitionOverlay } from './src/render/TrainingTransitionOverlay';
import { setMasterVolume } from './src/render/audio';
import {
  playAwakeningAscension,
  setAwakeningMasterVolume,
  stopAwakeningAscension,
  teardownAwakeningAudio,
} from './src/render/awakening-audio';
import { nextDevVolume, type DevVolume } from './src/render/dev-volume';
import {
  playAdvanceWeekSfx,
  playPlanLockedSfx,
  setMenuMasterVolume,
  setMenuTheme,
  teardownMenuAudio,
  type MenuTheme,
} from './src/render/menu-audio';
import {
  playCoachDepartureSfx,
  playFacilityStartSfx,
  playTransactionConfirmSfx,
  playManagementActionSfx,
  setManagementSfxMasterVolume,
  teardownManagementSfx,
} from './src/render/management-sfx';
import { playManagementHaptic } from './src/render/haptics';
import { assertRuntimeGoldenReplay, runtimeGoldenFingerprint } from './src/sim/runtime-golden';
import type { MatchState } from './src/sim/types';
import {
  ClubFinancesScreen,
  CoachStaffOverlay,
  FacilityProjectNotice,
  PlayerSigningOverlay,
  ClubHomeScreen,
  ClubLegacyScreen,
  AssistantGuideOverlay,
  CharacterCreationScreen,
  AwakeningCutsceneScreen,
  ChampionshipCelebrationScreen,
  FixtureMatchDayScreen,
  LeagueTableScreen,
  M2LeagueScreen,
  ManagementShell,
  MarketScreen,
  NewGameWelcomeScreen,
  PlanLockedConfirmation,
  PostMatchDevelopmentOverlay,
  PostMatchLedgerScreen,
  PostMatchSummaryModal,
  SeasonEndScreen,
  SquadTrainingScreen,
  StoryEventScreen,
  TitleLandingScreen,
  TitleSettingsScreen,
  WeeklyReviewScreen,
  type LockedPlanConfirmation,
  type CoachOverlayCoach,
  type FacilityProjectNoticeModel,
  type PlayerSigningConfirmation,
  formatCurrency,
  shouldShowOpeningBrief,
} from './src/ui';
import {
  careerCoachUnlockedFormationIds,
  clubSquadStrength,
  hasAssistantGuideSequenceCompleted,
  leagueStandings,
} from './src/game';
import type { DivisionLevel } from './src/game/pyramid';
import { SettingsOverlay } from './src/ui/SettingsOverlay';
import type { TutorialAnchorLayout } from './src/ui/tutorial-cue-position';
import { guidedFirstFacilityAllowsPlacement } from './src/ui/concierge-targets';
import { useReducedMotion } from './src/ui/use-reduced-motion';
import { SfxPressable as Pressable } from './src/ui/components/SfxPressable';
import { useM1Store } from './src/application/store';
import {
  trainingTransitionScene,
  type TrainingTransitionScene,
} from './src/application/training-transition';
import {
  currentAssistantObjective,
  pendingAssistantGuideSequence,
} from './src/application/assistant-guide';
import { loadPreferencesFailSoft } from './src/application/preferences';
import {
  awakeningCutsceneViewModel,
  clubLegacyViewModel,
  clubFinancesViewModel,
  homeViewModel,
  leagueTableViewModel,
  matchDayViewModel,
  seasonEndViewModel,
  squadTrainingViewModel,
  storyEventViewModel,
} from './src/application/view-models';
import type { AwakeningCutsceneViewModel } from './src/ui/models';
import { AwakeningArtQaScreen } from './src/ui/screens/AwakeningArtQaScreen';
import { championshipCelebrationViewModel } from './src/application/championship-celebration';
import { m2LeagueViewModel } from './src/application/m2-league-view-model';
import { marketViewModel } from './src/application/market-view-model';
import { careerMarketViewModelSource } from './src/application/market-source-adapter';

const DATABASE_NAME = 'hero-football-manager.db';
type LandingView = 'title' | 'story' | 'settings';

interface PendingConfirmation {
  readonly title: string;
  readonly detail: string;
  readonly confirmLabel: string;
  readonly tone?: 'normal' | 'danger' | 'hero';
  readonly onConfirm: () => void;
}

export default function App() {
  const previewTriggerId = process.env.EXPO_PUBLIC_AWAKENING_PREVIEW_ID;
  if (__DEV__ && process.env.EXPO_PUBLIC_AWAKENING_ART_QA === '1') {
    return <AwakeningArtQaApp triggerId={previewTriggerId ?? 'magic-sponge'} />;
  }
  if (__DEV__ && previewTriggerId) {
    return <AwakeningReviewApp triggerId={previewTriggerId} />;
  }
  return <GameApp />;
}

function AwakeningArtQaApp({ triggerId }: { triggerId: string }) {
  const content = useMemo(loadLaunchContent, []);
  const [selectedTriggerIndex, setSelectedTriggerIndex] = useState(() => {
    const requestedIndex = content.onboarding.triggers.findIndex(candidate => candidate.id === triggerId);
    return requestedIndex >= 0 ? requestedIndex : 0;
  });
  const triggerCount = content.onboarding.triggers.length;
  const triggerIndex = Math.min(selectedTriggerIndex, triggerCount - 1);
  const [fontsLoaded] = useFonts({ Silkscreen_400Regular, Silkscreen_700Bold });
  const trigger = content.onboarding.triggers[triggerIndex];

  if (!fontsLoaded) return <LoadingScreen />;
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AwakeningArtQaScreen
        index={triggerIndex}
        total={triggerCount}
        title={trigger.title}
        callout={trigger.callout}
        visual={trigger.visual}
        onPrevious={() => setSelectedTriggerIndex((
          triggerIndex - 1 + triggerCount
        ) % triggerCount)}
        onNext={() => setSelectedTriggerIndex((triggerIndex + 1) % triggerCount)}
      />
    </SafeAreaProvider>
  );
}

function GameApp() {
  const store = useM1Store();
  const content = useMemo(loadLaunchContent, []);
  const [bootError, setBootError] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<AppPreferences>(DEFAULT_APP_PREFERENCES);
  const [landingView, setLandingView] = useState<LandingView>('title');
  const [assistantPageIndex, setAssistantPageIndex] = useState(0);
  const [requestedAssistantSequenceId, setRequestedAssistantSequenceId] = useState<AssistantGuideSequenceId | null>(null);
  const [conciergeFocus, setConciergeFocus] = useState<AssistantGuideFocus | null>(null);
  const [fontsLoaded, fontError] = useFonts({ Silkscreen_400Regular, Silkscreen_700Bold });
  const [globalSettingsOpen, setGlobalSettingsOpen] = useState(false);
  const [globalGlossaryOpen, setGlobalGlossaryOpen] = useState(false);
  const [settingsSaveError, setSettingsSaveError] = useState<string | null>(null);
  const [moneyGuideAnchor, setMoneyGuideAnchor] = useState<TutorialAnchorLayout | null>(null);
  const [navigationGuideAnchor, setNavigationGuideAnchor] = useState<TutorialAnchorLayout | null>(null);
  const [trainingTransition, setTrainingTransition] = useState<TrainingTransitionScene | null>(null);
  const [lockedPlanConfirmation, setLockedPlanConfirmation] = useState<LockedPlanConfirmation | null>(null);
  const [coachOverlay, setCoachOverlay] = useState<{
    mode: 'hired' | 'confirm-dismiss' | 'dismissed';
    coach: CoachOverlayCoach;
  } | null>(null);
  const [facilityProjectNotice, setFacilityProjectNotice] = useState<FacilityProjectNoticeModel | null>(null);
  const [playerSigning, setPlayerSigning] = useState<PlayerSigningConfirmation | null>(null);
  const [awakeningBeat, setAwakeningBeat] = useState<1 | 2 | 3>(1);
  const [selectedLeagueDivision, setSelectedLeagueDivision] = useState<DivisionLevel | undefined>();
  const [selectedCupSeason, setSelectedCupSeason] = useState<number | undefined>();
  const [bootAttempt, setBootAttempt] = useState(0);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);
  const preferencesRepositoryRef = useRef<PreferencesRepository | null>(null);
  const devVolume = preferences.masterVolume as DevVolume;
  const reduceMotion = useReducedMotion(preferences.reduceMotion);

  const savePreferences = useCallback((next: AppPreferences) => {
    setPreferences(next);
    setSettingsSaveError(null);
    void preferencesRepositoryRef.current?.save(next).catch(error => {
      const detail = error instanceof Error ? error.message : String(error);
      setSettingsSaveError(`Settings were not saved. ${detail}`);
    });
  }, []);

  const cycleVolume = useCallback(() => {
    savePreferences({ ...preferences, masterVolume: nextDevVolume(devVolume) });
  }, [devVolume, preferences, savePreferences]);
  const toggleReduceMotion = useCallback(() => {
    savePreferences({ ...preferences, reduceMotion: !preferences.reduceMotion });
  }, [preferences, savePreferences]);
  const toggleHudSide = useCallback(() => {
    savePreferences({ ...preferences, hudSide: preferences.hudSide === 'left' ? 'right' : 'left' });
  }, [preferences, savePreferences]);

  const advanceCareerWithSfx = useCallback(() => {
    if (trainingTransition !== null) return;
    // Zustand updates synchronously here. Only a real week change gets the
    // cue, so tutorial-blocked taps and event redirects stay silent.
    const careerBefore = useM1Store.getState().career;
    const before = careerBefore?.week;
    const boardResolutionBefore = careerBefore?.financialSafety?.latestBoardResolution?.id;
    const transitionScene = careerBefore === null
      ? null
      : trainingTransitionScene(careerBefore, content);
    useM1Store.getState().advanceCareer();
    const after = useM1Store.getState().career?.week;
    const boardResolutionAfter = useM1Store.getState().career?.financialSafety?.latestBoardResolution;
    if (before !== undefined && after !== undefined && after !== before) {
      playAdvanceWeekSfx();
      if (transitionScene !== null) setTrainingTransition(transitionScene);
    }
    if (boardResolutionAfter !== undefined && boardResolutionAfter.id !== boardResolutionBefore) {
      if (boardResolutionAfter.kind === 'TARGET_MET') {
        playManagementActionSfx('success');
        playManagementHaptic('success');
      } else {
        playManagementActionSfx('warning');
        playManagementHaptic('warning');
        setTimeout(() => playManagementActionSfx('success'), 280);
      }
    }
  }, [content, trainingTransition]);

  const showStartedFacilityProject = useCallback(() => {
    const career = useM1Store.getState().career;
    if (career === null) return;
    const activeProject = clubFinancesViewModel(career).facilities.activeProject;
    const building = career.facilities.grid?.buildings.find(candidate => (
      candidate.id === activeProject?.buildingId
    ));
    if (activeProject === undefined || building === undefined) return;
    playFacilityStartSfx();
    playManagementHaptic('success');
    setConciergeFocus(null);
    setFacilityProjectNotice({
      type: building.type,
      name: activeProject.name,
      kind: activeProject.kind,
      targetLevel: activeProject.targetLevel,
      weeks: activeProject.totalWeeks,
    });
  }, []);

  const performManagementAction = useCallback((
    action: () => void,
    sound: Parameters<typeof playManagementActionSfx>[0],
    haptic: Parameters<typeof playManagementHaptic>[0] = 'commit',
  ) => {
    action();
    if (useM1Store.getState().error !== null) return;
    setConciergeFocus(null);
    playManagementActionSfx(sound);
    playManagementHaptic(haptic);
  }, []);

  const requestConfirmation = useCallback((confirmation: PendingConfirmation) => {
    playManagementActionSfx('select');
    playManagementHaptic('select');
    setPendingConfirmation(confirmation);
  }, []);

  const buildTrainingGroundWithSfx = useCallback(() => {
    const before = useM1Store.getState().career?.facilities.grid?.construction;
    useM1Store.getState().buildFacility();
    const after = useM1Store.getState().career?.facilities.grid?.construction;
    if (after !== undefined && after !== before) showStartedFacilityProject();
  }, [showStartedFacilityProject]);

  const buildClubFacilityWithFeedback = useCallback((type: FacilityProjectNoticeModel['type'], x: number, y: number) => {
    if (
      conciergeFocus === 'facility-grid'
      && !guidedFirstFacilityAllowsPlacement(type, x, y)
    ) return;
    const before = useM1Store.getState().career?.facilities.grid?.construction;
    useM1Store.getState().buildClubFacility(type, { x, y });
    const after = useM1Store.getState().career?.facilities.grid?.construction;
    if (after !== undefined && after !== before) {
      setConciergeFocus(null);
      showStartedFacilityProject();
    }
  }, [conciergeFocus, showStartedFacilityProject]);

  const upgradeClubFacilityWithFeedback = useCallback((buildingId: string) => {
    const before = useM1Store.getState().career?.facilities.grid?.construction;
    useM1Store.getState().upgradeClubFacility(buildingId);
    const after = useM1Store.getState().career?.facilities.grid?.construction;
    if (after !== undefined && after !== before) showStartedFacilityProject();
  }, [showStartedFacilityProject]);

  const hireCoachWithFeedback = useCallback((coachId: string, role: 'HEAD' | 'ASSISTANT' = 'HEAD') => {
    const careerBefore = useM1Store.getState().career;
    if (careerBefore === null || careerBefore.market === undefined) return;
    const candidate = marketViewModel(careerMarketViewModelSource(careerBefore)).coaches.find(
      coach => coach.id === coachId,
    );
    if (candidate === undefined) return;
    useM1Store.getState().hireCoach(coachId, role);
    const marketAfter = useM1Store.getState().career?.market;
    const hired = role === 'HEAD' ? marketAfter?.headCoach : marketAfter?.assistantCoach;
    if (hired?.id !== coachId) return;
    playTransactionConfirmSfx();
    playManagementHaptic('success');
    setConciergeFocus(null);
    setCoachOverlay({
      mode: 'hired',
      coach: {
        role,
        portraitId: candidate.portraitId,
        name: candidate.name,
        age: candidate.age,
        level: candidate.level,
        specialtyLabels: candidate.specialtyLabels,
        effectLabels: role === 'HEAD' ? candidate.headEffectLabels : candidate.assistantEffectLabels,
        weeklyWage: candidate.weeklyWage,
      },
    });
  }, []);

  const beginCoachDismissal = useCallback((role: 'HEAD' | 'ASSISTANT' = 'HEAD') => {
    const career = useM1Store.getState().career;
    if (career === null) return;
    const staff = squadTrainingViewModel(career, content, undefined, [], []).coachingStaff;
    const coach = staff.find(candidate => candidate.role === role);
    if (coach === undefined) return;
    setCoachOverlay({
      mode: 'confirm-dismiss',
      coach: {
        role,
        portraitId: coach.portraitId,
        name: coach.name,
        age: coach.age,
        level: coach.level,
        specialtyLabels: coach.specialtyLabels,
        effectLabels: coach.effectLabels,
        weeklyWage: coach.weeklyWage,
        severanceCost: coach.severanceCost,
      },
    });
  }, [content]);

  const confirmCoachDismissal = useCallback(() => {
    if (coachOverlay?.mode !== 'confirm-dismiss') return;
    const dismissedCoach = coachOverlay.coach;
    useM1Store.getState().dismissCoach(dismissedCoach.role);
    const marketAfter = useM1Store.getState().career?.market;
    const roleStillFilled = dismissedCoach.role === 'HEAD'
      ? marketAfter?.headCoach !== undefined
      : marketAfter?.assistantCoach !== undefined;
    if (roleStillFilled) return;
    playCoachDepartureSfx();
    playManagementHaptic('warning');
    setCoachOverlay({ mode: 'dismissed', coach: dismissedCoach });
  }, [coachOverlay]);

  const submitTransferOfferWithFeedback = useCallback((offer: Parameters<typeof store.submitTransferOffer>[0], pitchCard?: Parameters<typeof store.submitTransferOffer>[1]) => {
    const before = useM1Store.getState().career;
    const targetId = before?.market?.transferTalks?.playerId;
    const target = before?.players.find(player => player.id === targetId);
    useM1Store.getState().submitTransferOffer(offer, pitchCard);
    const stateAfter = useM1Store.getState();
    if (stateAfter.error !== null) return;
    const after = useM1Store.getState().career;
    if (targetId !== undefined && after?.players.some(player => (
      player.id === targetId && player.clubId === after.userClubId
    ))) {
      playTransactionConfirmSfx();
      playManagementHaptic('success');
      setConciergeFocus(null);
      if (target !== undefined) {
        useM1Store.getState().clearError();
        setPlayerSigning({
          playerId: target.id,
          playerName: target.name,
          role: target.role,
          lookId: target.lookId,
          source: 'transfer',
        });
      }
    } else {
      playManagementActionSfx('card');
      playManagementHaptic('select');
    }
  }, []);

  const signYouthWithFeedback = useCallback((playerId: string) => {
    const careerBefore = useM1Store.getState().career;
    const offer = careerBefore?.market === undefined
      ? undefined
      : marketViewModel(careerMarketViewModelSource(careerBefore)).youth?.offers.find(candidate => (
        candidate.playerId === playerId
      ));
    useM1Store.getState().signYouth(playerId);
    const after = useM1Store.getState().career;
    if (offer === undefined || after?.players.some(player => (
      player.id === playerId && player.clubId === after.userClubId
    )) !== true) return;
    playTransactionConfirmSfx();
    playManagementHaptic('success');
    setConciergeFocus(null);
    setPlayerSigning({
      playerId,
      playerName: offer.playerName,
      role: offer.role,
      lookId: offer.lookId,
      source: 'academy',
    });
  }, []);

  const dismissTrainingTransition = useCallback(() => {
    setTrainingTransition(null);
  }, []);

  const lockTrainingPlanWithFeedback = useCallback(() => {
    const before = useM1Store.getState();
    const selectedDrillIds = [...before.selectedDrillIds];
    const assignedPlayerIds = [...before.assignedPlayerIds];
    before.applyTraining();

    const after = useM1Store.getState();
    const lockedPlan = after.career?.trainingPlan;
    const planWasLocked = after.error === null
      && lockedPlan !== undefined
      && lockedPlan.drills.length === selectedDrillIds.length
      && lockedPlan.drills.every((drill, index) => drill.id === selectedDrillIds[index])
      && lockedPlan.assignedPlayerIds.length === assignedPlayerIds.length
      && lockedPlan.assignedPlayerIds.every((playerId, index) => playerId === assignedPlayerIds[index]);
    if (!planWasLocked) return;

    const drillNamesById = new Map(content.training.focusDrills.map(drill => [drill.id, drill.name]));
    playPlanLockedSfx();
    setLockedPlanConfirmation({
      drillNames: selectedDrillIds.map(id => drillNamesById.get(id) ?? id),
      playerCount: assignedPlayerIds.length,
    });
  }, [content]);

  const dismissLockedPlanConfirmation = useCallback(() => {
    setLockedPlanConfirmation(null);
  }, []);

  useEffect(() => {
    setMasterVolume(devVolume);
    setMenuMasterVolume(devVolume);
    setManagementSfxMasterVolume(devVolume);
    setAwakeningMasterVolume(devVolume);
  }, [devVolume]);

  const menuTheme: MenuTheme = bootError === null
    && store.persistenceReady
    && store.persistenceLoadError === null
    ? store.screen === 'welcome'
      ? 'opening'
      : store.screen === 'management'
        ? 'management'
        : store.screen === 'event' || store.screen === 'legacy'
          || (store.screen === 'awakening' && awakeningBeat >= 2)
          ? 'event'
          : null
    : null;

  useEffect(() => {
    setMenuTheme(menuTheme);
  }, [menuTheme]);

  useEffect(() => () => {
    teardownMenuAudio();
    teardownManagementSfx();
    teardownAwakeningAudio();
  }, []);

  useEffect(() => {
    if (store.screen === 'awakening' && awakeningBeat === 3) {
      playAwakeningAscension();
      return () => stopAwakeningAscension();
    }
    stopAwakeningAscension();
    return undefined;
  }, [awakeningBeat, store.screen]);

  const pendingAwakeningKey = store.career?.awakening.pending === undefined
    ? null
    : `${store.career.awakening.pending.fixtureId}:${store.career.awakening.pending.playerId}`;
  useEffect(() => {
    setAwakeningBeat(1);
  }, [pendingAwakeningKey]);

  useEffect(() => {
    let active = true;
    setBootError(null);
    try {
      // Expo's native runtime is Hermes. This boot gate executes the same
      // full-payload replay fingerprint as the Node test before opening a save.
      assertRuntimeGoldenReplay();
      console.info(`HERMES_GOLDEN_OK ${runtimeGoldenFingerprint()}`);
    } catch (error) {
      setBootError(error instanceof Error ? error.message : String(error));
      return () => {
        active = false;
      };
    }
    void openDatabaseAsync(DATABASE_NAME)
      .then(async database => ({
        careerRepository: await createCareerRepository(database),
        replayRepository: await createReplayRepository(database),
        preferencesRepository: await createPreferencesRepository(database),
      }))
      .then(async repositories => ({
        ...repositories,
        ...(await loadPreferencesFailSoft(repositories.preferencesRepository)),
      }))
      .then(async repositories => {
        if (!active) return undefined;
        preferencesRepositoryRef.current = repositories.preferencesRepository;
        setPreferences(repositories.preferences);
        await store.initializePersistence(
          repositories.careerRepository,
          repositories.replayRepository,
          true,
        );
        if (active && repositories.warning !== undefined) {
          store.notify(repositories.warning);
        }
        return undefined;
      })
      .catch(error => {
        if (active) setBootError(error instanceof Error ? error.message : String(error));
      });
    return () => {
      active = false;
    };
  }, [bootAttempt, store.initializePersistence]);

  const finishWatchedMatch = useCallback((result: MatchState) => {
    store.finishWatchedMatch(result);
  }, [store.finishWatchedMatch]);

  const startNewCareer = useCallback(() => {
    if (!store.hasSavedCareer) {
      store.startNewCareer(undefined, 'full');
      return;
    }
    requestConfirmation({
      title: 'Replace saved career?',
      detail: 'Starting over permanently erases the current career and its match replays.',
      confirmLabel: 'Erase and start over',
      tone: 'danger',
      onConfirm: () => store.startNewCareer(undefined, 'full'),
    });
  }, [requestConfirmation, store.hasSavedCareer, store.startNewCareer]);

  useEffect(() => {
    if (store.career !== null) store.reconcileAssistantInbox();
  }, [store.career, store.reconcileAssistantInbox]);

  useEffect(() => {
    if (
      store.screen === 'legacy'
      && store.career !== null
      && requestedAssistantSequenceId === null
      && !hasAssistantGuideSequenceCompleted(store.career, 'club-legacy')
    ) {
      setRequestedAssistantSequenceId('club-legacy');
      setConciergeFocus(null);
    }
  }, [requestedAssistantSequenceId, store.career, store.screen]);

  const onboardingAssistantSequenceId = store.screen === 'management' && store.career !== null
    ? pendingAssistantGuideSequence(store.career, store.activeTab)
    : null;
  const assistantSequenceId = onboardingAssistantSequenceId ?? (
    (store.screen === 'management' || store.screen === 'legacy')
      ? requestedAssistantSequenceId
      : null
  );
  const assistantSequence = assistantSequenceId === null
    ? undefined
    : content.assistantGuide.sequences.find(sequence => sequence.id === assistantSequenceId);
  const assistantPage = assistantSequence?.pages[
    Math.min(assistantPageIndex, (assistantSequence?.pages.length ?? 1) - 1)
  ];
  const assistantObjective = store.career === null
    ? null
    : currentAssistantObjective(store.career, store.activeTab);

  useEffect(() => {
    setAssistantPageIndex(0);
  }, [assistantSequenceId]);

  const advanceAssistantGuide = useCallback(() => {
    if (assistantSequenceId === null || assistantSequence === undefined) return;
    if (assistantPageIndex < assistantSequence.pages.length - 1) {
      setAssistantPageIndex(index => index + 1);
      return;
    }
    store.completeAssistantGuide(assistantSequenceId);
    if (assistantSequenceId === requestedAssistantSequenceId) {
      setConciergeFocus(assistantSequence.pages.at(-1)?.focus ?? null);
      setRequestedAssistantSequenceId(null);
    }
  }, [assistantPageIndex, assistantSequence, assistantSequenceId, requestedAssistantSequenceId, store.completeAssistantGuide]);

  const openAssistantGuide = useCallback((
    sequenceId: AssistantGuideSequenceId,
    destination: AssistantGuideDestination,
  ) => {
    setAssistantPageIndex(0);
    setConciergeFocus(null);
    setRequestedAssistantSequenceId(sequenceId);
    const tab = sequenceId === 'board-ultimatum' || sequenceId === 'board-protection'
      ? 'home'
      : destination === 'coach-market'
      || destination === 'market-scouting'
      || destination === 'market-transfers'
      || destination === 'youth-intake'
      ? 'market'
      : destination === 'squad'
        ? 'squad'
        : destination === 'club-facilities' || destination === 'club-finances'
          ? 'club'
          : destination === 'league-cup'
            ? 'league'
            : 'home';
    store.setActiveTab(tab);
    playManagementActionSfx('card');
    playManagementHaptic('select');
  }, [store.setActiveTab]);

  let screen;
  if (!fontsLoaded && !fontError && bootError === null) {
    screen = <LoadingScreen />;
  } else if (bootError !== null) {
    screen = <BootFailure message={bootError} onRetry={() => setBootAttempt(attempt => attempt + 1)} />;
  } else if (!store.persistenceReady) {
    screen = <LoadingScreen />;
  } else if (store.persistenceLoadError !== null) {
    screen = (
      <BootFailure
        message={store.persistenceLoadError}
        onRetry={() => setBootAttempt(attempt => attempt + 1)}
      />
    );
  } else if (store.screen === 'welcome' && landingView === 'title') {
    screen = (
      <TitleLandingScreen
        hasSavedCareer={store.hasSavedCareer}
        onStory={() => setLandingView('story')}
        onSettings={() => setLandingView('settings')}
      />
    );
  } else if (store.screen === 'welcome' && landingView === 'settings') {
    screen = (
      <TitleSettingsScreen
        preferences={preferences}
        glossary={content.glossary}
        onCycleVolume={cycleVolume}
        onCycleFormation={slot => savePreferences(replaceFormationPreset(
          preferences,
          slot,
          store.career?.market === undefined
            ? []
            : careerCoachUnlockedFormationIds(store.career.market),
        ))}
        onToggleReduceMotion={toggleReduceMotion}
        onToggleHudSide={toggleHudSide}
        onBack={() => setLandingView('title')}
      />
    );
  } else if (store.screen === 'welcome') {
    screen = (
      <NewGameWelcomeScreen
        hasSavedCareer={store.hasSavedCareer}
        savedCareerLabel={store.career ? `Season ${store.career.season} · Week ${store.career.week}` : undefined}
        showOpeningBrief={shouldShowOpeningBrief(store.career)}
        onStartNewCareer={startNewCareer}
        onContinueCareer={store.hasSavedCareer ? store.continueCareer : undefined}
        onBackToTitle={() => setLandingView('title')}
        onOpenSettings={() => setGlobalSettingsOpen(true)}
      />
    );
  } else if (store.screen === 'create-player' && store.career !== null) {
    screen = (
      <CharacterCreationScreen
        onComplete={store.completePlayerCreation}
        onOpenSettings={() => setGlobalSettingsOpen(true)}
      />
    );
  } else if (
    store.screen === 'awakening'
    && store.career !== null
    && store.career.awakening.pending !== undefined
  ) {
    screen = (
      <AwakeningCutsceneScreen
        key={pendingAwakeningKey ?? undefined}
        viewModel={awakeningCutsceneViewModel(store.career, content, store.postMatch !== null)}
        reduceMotion={reduceMotion}
        onBeatChange={setAwakeningBeat}
        onContinue={store.continueAfterAwakening}
      />
    );
  } else if (store.career === null) {
    screen = (
      <BootFailure
        message="The saved career could not be loaded."
        onRetry={() => setBootAttempt(attempt => attempt + 1)}
      />
    );
  } else if (store.screen === 'watched' && store.watchedMatch !== null) {
    screen = (
      <MatchScreen
        seed={store.watchedMatch.fixture.matchSeed}
        home={store.watchedMatch.home}
        away={store.watchedMatch.away}
        controlledTeam={store.watchedMatch.controlledTeam}
        formationPresets={preferences.formationPresets}
        reduceMotion={reduceMotion}
        hudSide={preferences.hudSide}
        pausedExternally={globalSettingsOpen}
        onOpenSettings={() => setGlobalSettingsOpen(true)}
        onDone={finishWatchedMatch}
      />
    );
  } else if (store.screen === 'matchday') {
    const matchday = matchDayViewModel(
      store.career,
      content,
      preferences.formationPresets[0].replaceAll('-', '–'),
    );
    screen = (
      <FixtureMatchDayScreen
        viewModel={matchday}
        onBack={() => store.setActiveTab('home')}
        onToggleHeroLicense={playerId => {
          const hero = matchday.heroes.find(candidate => candidate.playerId === playerId);
          const willEnterLineup = hero?.licensed === false
            && !matchday.lineup.some(player => player.id === playerId);
          const toggle = () => performManagementAction(
            () => store.toggleHeroLicense(playerId),
            'hero',
            'hero',
          );
          if (!willEnterLineup) {
            toggle();
            return;
          }
          requestConfirmation({
            title: 'License and change the XI?',
            detail: `${hero?.playerName ?? 'This hero'} is on the bench. Assigning the permit will move them into the Starting XI and bench an unlicensed hero.`,
            confirmLabel: 'License and swap',
            tone: 'hero',
            onConfirm: toggle,
          });
        }}
        onSwapStartingPlayer={(starterId, replacementId) => performManagementAction(
          () => store.swapStartingPlayer(starterId, replacementId),
          'select',
          'select',
        )}
        onWatchMatch={store.watchMatch}
        onQuickResult={store.quickResult}
        onOpenSettings={() => setGlobalSettingsOpen(true)}
      />
    );
  } else if (store.screen === 'postmatch' && store.postMatch !== null) {
    screen = (
      <PostMatchLedgerScreen
        viewModel={store.postMatch}
        reduceMotion={reduceMotion}
        onContinue={store.continueAfterMatch}
        onOpenSettings={() => setGlobalSettingsOpen(true)}
      />
    );
  } else if (store.screen === 'week-review' && store.weekReview !== null) {
    screen = (
      <WeeklyReviewScreen
        viewModel={store.weekReview}
        reduceMotion={reduceMotion}
        onContinue={store.continueWeekReview}
      />
    );
  } else if (store.screen === 'event' && store.career.pendingEvent !== undefined) {
    screen = (
      <StoryEventScreen
        viewModel={storyEventViewModel(store.career, content)}
        onChoose={store.chooseEvent}
        onSelectPlayer={store.selectEventPlayer}
        onContinue={store.continueAfterEvent}
        onOpenSettings={() => setGlobalSettingsOpen(true)}
      />
    );
  } else if (store.screen === 'legacy') {
    screen = (
      <ClubLegacyScreen
        viewModel={clubLegacyViewModel(store.career)}
        onChoose={choice => {
          setConciergeFocus(null);
          store.chooseLegacy(choice);
        }}
        onOpenSettings={() => setGlobalSettingsOpen(true)}
        guided={conciergeFocus === 'club-legacy'}
      />
    );
  } else if (store.screen === 'championship-celebration') {
    screen = (
      <ChampionshipCelebrationScreen
        viewModel={championshipCelebrationViewModel(
          store.career,
          content.assistantGuide.assistant.name,
        )}
        reduceMotion={reduceMotion}
        onComplete={store.completeChampionshipCelebration}
      />
    );
  } else if (store.screen === 'season-end') {
    const season = seasonEndViewModel(store.career, content, store.selectedContractTerm);
    screen = (
      <SeasonEndScreen
        viewModel={season}
        onSelectContractTerm={(_playerId, term) => store.setContractTerm(term)}
        onRenewContract={(playerId, term) => store.renewPlayer(playerId, term)}
        onStartRenewal={store.startRenewal}
        onSubmitRenewalOffer={(offer, card) => {
          store.submitRenewalOffer(offer, card);
          const after = useM1Store.getState();
          if (after.error !== null) return;
          const accepted = after.notice?.tone === 'success';
          playManagementActionSfx(accepted ? 'success' : 'card');
          playManagementHaptic(accepted ? 'success' : 'select');
        }}
        onCloseRenewal={store.closeRenewal}
        onReleaseContract={playerId => requestConfirmation({
          title: 'Let this player leave?',
          detail: `${season.expiredContract?.playerName ?? 'This player'} leaves immediately. This cannot be undone.`,
          confirmLabel: 'Let player leave',
          tone: 'danger',
          onConfirm: () => performManagementAction(
            () => store.releasePlayer(playerId),
            'warning',
            'warning',
          ),
        })}
        onPrimaryAction={() => season.sliceComplete ? store.setActiveTab('home') : store.advanceCareer()}
        onOpenSettings={() => setGlobalSettingsOpen(true)}
      />
    );
  } else {
    const home = homeViewModel(store.career);
    screen = (
      <ManagementShell
        clubName={home.clubName}
        seasonLabel={home.seasonLabel}
        weekLabel={home.weekLabel}
        resources={home.resources}
        activeTab={store.activeTab}
        onTabChange={tab => {
          setConciergeFocus(null);
          store.setActiveTab(tab);
        }}
        onAdvanceWeek={advanceCareerWithSfx}
        onOpenLedger={() => store.setActiveTab('club')}
        onOpenSettings={() => setGlobalSettingsOpen(true)}
        advanceWeekLabel={store.saving ? 'Saving…' : 'Advance Week  ▸'}
        advanceWeekDisabled={store.saving
          || trainingTransition !== null
          || (assistantObjective !== null && assistantObjective.target !== 'advance-week')}
        guideFocus={assistantPage?.focus === 'money' || assistantPage?.focus === 'navigation'
          ? assistantPage.focus
          : undefined}
        guideTarget={assistantObjective?.target}
        onMoneyGuideAnchorChange={setMoneyGuideAnchor}
        onNavigationGuideAnchorChange={setNavigationGuideAnchor}
        onDismissGuidance={conciergeFocus === null ? undefined : () => setConciergeFocus(null)}
      >
        {store.activeTab === 'squad' ? (
          <SquadTrainingScreen
            viewModel={squadTrainingViewModel(
              store.career,
              content,
              store.selectedPlayerId,
              store.assignedPlayerIds,
              store.selectedDrillIds,
            )}
            onSelectPlayer={playerId => {
              store.selectPlayer(playerId);
              if (conciergeFocus === 'injury-lineup' || conciergeFocus === 'transfer-request') {
                setConciergeFocus(null);
              }
            }}
            onTogglePlayerAssignment={store.toggleTrainingPlayer}
            onToggleDrill={store.toggleDrill}
            onApplyTraining={lockTrainingPlanWithFeedback}
            onOpenCoachMarket={() => store.setActiveTab('market')}
            onDismissCoach={beginCoachDismissal}
            guideTraining={assistantObjective?.target === 'training-plan'}
            guideFocus={conciergeFocus ?? undefined}
          />
        ) : store.activeTab === 'club' ? (
          <ClubFinancesScreen
            viewModel={clubFinancesViewModel(store.career)}
            onBuildTrainingGround={buildTrainingGroundWithSfx}
            onBuildFacility={buildClubFacilityWithFeedback}
            onUpgradeFacility={buildingId => {
              const finances = clubFinancesViewModel(useM1Store.getState().career!);
              const building = finances.facilities.buildings.find(candidate => candidate.id === buildingId);
              requestConfirmation({
                title: `Upgrade ${building?.name ?? 'facility'}?`,
                detail: `Spend ${building?.upgradeCost === undefined ? 'the shown cost' : formatCurrency(building.upgradeCost)} now. Weekly upkeep will rise with the new level.`,
                confirmLabel: 'Approve upgrade',
                onConfirm: () => upgradeClubFacilityWithFeedback(buildingId),
              });
            }}
            onRelocateFacility={(buildingId, x, y) => performManagementAction(
              () => store.relocateClubFacility(buildingId, { x, y }),
              'build',
              'commit',
            )}
            onOpenCoachMarket={() => store.setActiveTab('market')}
            onDismissCoach={beginCoachDismissal}
            guideTrainingGround={assistantObjective?.target === 'training-ground-facility'}
            guideFocus={conciergeFocus ?? undefined}
          />
        ) : store.activeTab === 'market' && store.career.market !== undefined ? (
          <MarketScreen
            viewModel={marketViewModel(careerMarketViewModelSource(store.career))}
            onStartScoutMission={optionId => performManagementAction(
              () => store.startScoutMission(optionId),
              'dispatch',
              'commit',
            )}
            onOpenScoutReport={playerId => {
              store.openScoutReport(playerId);
              if (useM1Store.getState().error === null) setConciergeFocus(null);
            }}
            onTransferAction={(playerId, direction, bidId) => {
              if (direction === 'BUY') {
                performManagementAction(() => store.actOnTransfer(playerId, direction), 'card', 'select');
                return;
              }
              const market = marketViewModel(careerMarketViewModelSource(store.career!));
              const listing = market.transfers.find(candidate => (
                candidate.playerId === playerId && candidate.direction === 'SELL'
              ));
              const bid = listing?.bids.find(candidate => candidate.id === bidId);
              const acceptingBid = bid !== undefined;
              requestConfirmation({
                title: acceptingBid
                  ? `Accept ${bid?.buyerName ?? 'this club'} bid?`
                  : `List ${listing?.playerName ?? 'this player'}?`,
                detail: acceptingBid
                  ? `Receive ${bid === undefined ? 'the shown fee' : formatCurrency(bid.fee)} for ${listing?.playerName ?? 'the player'}. The player leaves immediately and will be removed from the Starting XI and training plan.`
                  : 'The transfer office will request up to three club bids. Listing does not sell the player; you will compare every offer first.',
                confirmLabel: acceptingBid ? 'Accept bid' : 'Request bids',
                tone: acceptingBid ? 'danger' : 'normal',
                onConfirm: () => performManagementAction(
                  () => store.actOnTransfer(playerId, direction, bidId),
                  acceptingBid ? 'cash' : 'dispatch',
                  acceptingBid ? 'success' : 'commit',
                ),
              });
            }}
            onHireCoach={(coachId, role) => {
              const career = useM1Store.getState().career!;
              const market = marketViewModel(careerMarketViewModelSource(career));
              const coach = market.coaches.find(candidate => candidate.id === coachId);
              const current = role === 'HEAD' ? career.market?.headCoach : career.market?.assistantCoach;
              const roleLabel = role === 'HEAD' ? 'head coach' : 'assistant coach';
              requestConfirmation({
                title: current ? `Replace ${current.name}?` : `Hire ${coach?.name ?? 'this coach'}?`,
                detail: `${coach?.name ?? 'The coach'} will become ${roleLabel} and costs ${coach === undefined ? 'the shown wage' : formatCurrency(coach.weeklyWage)} each week.${current ? ` The current ${roleLabel} leaves immediately.` : ''}`,
                confirmLabel: current ? 'Replace coach' : 'Hire coach',
                tone: current ? 'danger' : 'normal',
                onConfirm: () => hireCoachWithFeedback(coachId, role),
              });
            }}
            onSignYouth={playerId => requestConfirmation({
              title: 'Sign this youth player?',
              detail: 'The player joins the senior squad immediately and occupies a roster place.',
              confirmLabel: 'Sign player',
              onConfirm: () => signYouthWithFeedback(playerId),
            })}
            onDeclineYouth={() => requestConfirmation({
              title: 'Decline the youth intake?',
              detail: 'Every remaining offer will be removed. This cannot be undone after you leave the desk.',
              confirmLabel: 'Decline all',
              tone: 'danger',
              onConfirm: () => performManagementAction(
                store.declineYouth,
                'warning',
                'warning',
              ),
            })}
            onSubmitContractOffer={submitTransferOfferWithFeedback}
            onCloseNegotiation={store.closeTransferTalks}
            onDismissGuideFocus={() => setConciergeFocus(null)}
            guideFocus={conciergeFocus ?? undefined}
          />
        ) : store.activeTab === 'league' && store.career.m2 !== undefined ? (
          <M2LeagueScreen
            viewModel={m2LeagueViewModel({
              career: store.career.m2,
              season: store.career.season,
              activeStandings: leagueStandings(store.career),
              userSquadStrength: clubSquadStrength(store.career.players.filter(
                player => player.clubId === store.career?.userClubId,
              )),
              selectedDivision: selectedLeagueDivision,
              selectedCupSeason,
              leagueFixtures: store.career.fixtures,
              week: store.career.week,
              phase: store.career.phase,
            })}
            onSelectDivision={setSelectedLeagueDivision}
            onSelectCupSeason={season => {
              setConciergeFocus(null);
              setSelectedCupSeason(season);
            }}
            onOpenCupFixture={fixtureId => {
              setConciergeFocus(null);
              store.openCupFixture(fixtureId);
            }}
            guideNationalCup={conciergeFocus === 'national-cup'}
          />
        ) : store.activeTab === 'league' ? (
          <LeagueTableScreen viewModel={leagueTableViewModel(store.career)} />
        ) : (
          <ClubHomeScreen
            viewModel={home}
            onOpenFixture={store.openMatchday}
            onOpenAlert={alertId => {
              const alert = home.alerts.find(candidate => candidate.id === alertId);
              if (alert?.guideSequenceId !== undefined && alert.destination !== undefined) {
                if (alertId.startsWith('injury-')) {
                  store.selectPlayer(alertId.slice('injury-'.length));
                } else if (alertId.startsWith('transfer-request-')) {
                  store.selectPlayer(alertId.slice('transfer-request-'.length));
                }
                openAssistantGuide(alert.guideSequenceId, alert.destination);
              }
              else if (alertId === 'training-ground') store.setActiveTab('club');
              else if (alertId.startsWith('injury-')) {
                store.selectPlayer(alertId.slice('injury-'.length));
                store.setActiveTab('squad');
              }
              else if (alertId.startsWith('transfer-request-')) {
                store.selectPlayer(alertId.slice('transfer-request-'.length));
                store.setActiveTab('squad');
              }
              else if (alertId === 'renewals') store.setActiveTab('squad');
              else if (alertId === 'financial-warning' || alertId === 'emergency-loan') {
                store.setActiveTab('club');
              }
              else if (alertId === 'board-ultimatum') {
                store.notify('Choose one protected player in the Board intervention panel below.');
              }
              else if (alertId.startsWith('board-resolution')) {
                store.notify('The board intervention result is itemized in the latest club ledger.');
              }
              else if (alertId.startsWith('retirement-announcement-')) {
                store.notify('Final season confirmed. Plan the farewell now; the legacy choice arrives after retirement.');
              }
              else store.notify('This alert is resolved from the season review.');
            }}
            onOpenLeague={() => store.setActiveTab('league')}
            onProtectBoardCandidate={playerId => performManagementAction(
              () => store.protectBoardCandidate(playerId),
              'select',
              'select',
            )}
            guideAlertId={assistantObjective?.target === 'training-ground-alert'
              ? 'training-ground'
              : conciergeFocus === 'retirement'
                ? home.alerts.find(alert => alert.id.startsWith('retirement-announcement-'))?.id
                : undefined}
            guideBoard={conciergeFocus === 'board-ultimatum' || conciergeFocus === 'board-protection'}
          />
        )}
      </ManagementShell>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar
        style={(
          (!fontsLoaded && !fontError && bootError === null)
          || bootError !== null
          || !store.persistenceReady
          || store.persistenceLoadError !== null
          || store.screen === 'watched'
          || store.screen === 'awakening'
        ) ? 'light' : 'dark'}
      />
      <View className="flex-1 bg-ink">
        {screen}
        {store.error ? (
          <FeedbackNotice message={store.error} tone="error" onDismiss={store.clearError} />
        ) : store.notice ? (
          <FeedbackNotice
            message={store.notice.message}
            tone={store.notice.tone}
            onDismiss={store.clearNotice}
          />
        ) : null}
        <ConfirmationSheet
          confirmation={pendingConfirmation}
          onCancel={() => setPendingConfirmation(null)}
          onConfirm={() => {
            const action = pendingConfirmation?.onConfirm;
            setPendingConfirmation(null);
            action?.();
          }}
        />
        <SettingsOverlay
          open={globalSettingsOpen}
          glossary={content.glossary}
          glossaryOpen={globalGlossaryOpen}
          volume={devVolume}
          reduceMotion={preferences.reduceMotion}
          hudSide={preferences.hudSide}
          saveError={settingsSaveError}
          onVolumeChange={volume => savePreferences({ ...preferences, masterVolume: volume })}
          onToggleReduceMotion={toggleReduceMotion}
          onToggleHudSide={toggleHudSide}
          onGlossaryOpenChange={setGlobalGlossaryOpen}
          onOpenChange={open => {
            setGlobalSettingsOpen(open);
            if (!open) {
              setGlobalGlossaryOpen(false);
              setSettingsSaveError(null);
            }
          }}
        />
        {assistantSequenceId !== null ? (
          <AssistantGuideOverlay
            content={content.assistantGuide}
            sequenceId={assistantSequenceId}
            pageIndex={assistantPageIndex}
            moneyAnchor={moneyGuideAnchor}
            navigationAnchor={navigationGuideAnchor}
            onAdvance={advanceAssistantGuide}
          />
        ) : null}
        {trainingTransition !== null ? (
          <TrainingTransitionOverlay
            scene={trainingTransition}
            reduceMotion={reduceMotion}
            onComplete={dismissTrainingTransition}
          />
        ) : null}
        {lockedPlanConfirmation !== null ? (
          <PlanLockedConfirmation
            confirmation={lockedPlanConfirmation}
            reduceMotion={reduceMotion}
            onComplete={dismissLockedPlanConfirmation}
          />
        ) : null}
        {coachOverlay !== null ? (
          <CoachStaffOverlay
            mode={coachOverlay.mode}
            coach={coachOverlay.coach}
            reduceMotion={reduceMotion}
            onConfirm={coachOverlay.mode === 'confirm-dismiss' ? confirmCoachDismissal : undefined}
            onClose={() => setCoachOverlay(null)}
          />
        ) : null}
        {facilityProjectNotice !== null ? (
          <FacilityProjectNotice
            project={facilityProjectNotice}
            reduceMotion={reduceMotion}
            onClose={() => setFacilityProjectNotice(null)}
          />
        ) : null}
        {playerSigning !== null ? (
          <PlayerSigningOverlay
            player={playerSigning}
            reduceMotion={reduceMotion}
            onClose={() => setPlayerSigning(null)}
          />
        ) : null}
        {store.screen === 'management'
          && store.postMatch !== null
          && store.postMatchOverlay === 'summary' ? (
            <PostMatchSummaryModal
              viewModel={store.postMatch}
              reduceMotion={reduceMotion}
              onDismiss={store.dismissPostMatchSummary}
            />
          ) : null}
        {store.screen === 'management'
          && store.postMatch !== null
          && store.postMatchOverlay === 'development' ? (
            <PostMatchDevelopmentOverlay
              development={store.postMatch.development}
              facilityCompletion={store.postMatch.facilityCompletion}
              reduceMotion={reduceMotion}
              onDismiss={store.dismissPostMatchDevelopment}
             />
           ) : null}
      </View>
    </SafeAreaProvider>
  );
}

function AwakeningReviewApp({ triggerId }: { triggerId: string }) {
  const content = useMemo(loadLaunchContent, []);
  const [triggerIndex, setTriggerIndex] = useState(() => {
    const requestedIndex = content.onboarding.triggers.findIndex(candidate => candidate.id === triggerId);
    return requestedIndex >= 0 ? requestedIndex : 0;
  });
  const trigger = content.onboarding.triggers[triggerIndex];
  const [fontsLoaded] = useFonts({ Silkscreen_400Regular, Silkscreen_700Bold });
  const [previewBeat, setPreviewBeat] = useState<1 | 2 | 3>(1);
  const nextTriggerIndex = (triggerIndex + 1) % content.onboarding.triggers.length;

  useEffect(() => {
    return () => {
      teardownMenuAudio();
      teardownAwakeningAudio();
    };
  }, []);

  useEffect(() => {
    setMenuTheme(previewBeat >= 2 ? 'event' : null);
    if (previewBeat === 3) {
      playAwakeningAscension();
      return () => stopAwakeningAscension();
    }
    stopAwakeningAscension();
    return undefined;
  }, [previewBeat]);

  const viewModel: AwakeningCutsceneViewModel = {
    fixtureLabel: `Review ${triggerIndex + 1}/${content.onboarding.triggers.length} · Full time`,
    playerId: 'r10',
    playerName: 'ZIP VELA',
    role: 'FWD',
    powerId: 'SUPER_STRENGTH',
    powerName: 'SUPER STRENGTH',
    limpCopy: content.onboarding.limp.split('{name}').join('ZIP VELA'),
    triggerVisual: trigger.visual,
    triggerKicker: trigger.kicker,
    triggerTitle: trigger.title,
    triggerCallout: trigger.callout,
    triggerDetail: trigger.detail,
    triggerCopy: trigger.copy.split('{name}').join('ZIP VELA'),
    omenCopy: 'The turf dents beneath ZIP VELA’s palm. Everyone in the huddle feels the shock before they hear it.',
    revealCopy: 'KRAK! ZIP VELA floats upright as the ground shudders. ZIP VELA is, quite suddenly, enormous.',
    firstHero: true,
    licenseLabel: 'Hero license active',
    continueLabel: triggerIndex === content.onboarding.triggers.length - 1
      ? 'RESTART SCENE REVIEW'
      : `NEXT SCENE · ${nextTriggerIndex + 1}/${content.onboarding.triggers.length}`,
  };

  if (!fontsLoaded) return <LoadingScreen />;
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AwakeningCutsceneScreen
        key={trigger.id}
        viewModel={viewModel}
        initialBeat={1}
        onBeatChange={setPreviewBeat}
        onContinue={() => {
          setPreviewBeat(1);
          setTriggerIndex(nextTriggerIndex);
        }}
      />
    </SafeAreaProvider>
  );
}

function LoadingScreen() {
  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-ink">
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel="Opening club files"
        className="-rotate-2 border-2 border-signal px-5 py-4"
      >
        <Text className="font-mono text-lg font-bold uppercase tracking-widest text-signal">Opening club files…</Text>
      </View>
    </SafeAreaView>
  );
}

function BootFailure({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-ink px-6">
      <View className="w-full border-2 border-stamp bg-paper p-5">
        <Text className="text-lg font-bold uppercase text-stamp">We could not open your club</Text>
        <Text className="mt-3 text-sm leading-5 text-ink/70">Your saved career has not been changed. Try again.</Text>
        <Text className="mt-2 text-xs leading-4 text-ink/50">Technical detail: {message}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retry opening club files"
          onPress={onRetry}
          className="mt-5 min-h-12 items-center justify-center border-2 border-b-4 border-ink bg-violet px-4"
          style={({ pressed }) => ({ transform: [{ translateY: pressed ? 2 : 0 }] })}
        >
          <Text className="font-pixel text-sm uppercase text-paper">Retry</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function FeedbackNotice({
  message,
  tone,
  onDismiss,
}: {
  message: string;
  tone: 'error' | 'info' | 'success';
  onDismiss: () => void;
}) {
  const palette = tone === 'success'
    ? 'border-pitch-dark bg-pitch-light'
    : tone === 'info'
      ? 'border-blue-dark bg-blue-light'
      : 'border-stamp bg-red-light';
  const symbol = tone === 'success' ? '✓' : tone === 'info' ? 'i' : '!';
  return (
    <Pressable
      accessibilityRole={tone === 'error' ? 'alert' : 'button'}
      accessibilityLiveRegion={tone === 'error' ? 'assertive' : 'polite'}
      accessibilityLabel={`${message}. Tap to dismiss.`}
      onPress={onDismiss}
      className={`absolute left-4 right-4 top-16 border-2 px-4 py-3 shadow-lg shadow-black/40 ${palette}`}
    >
      <View className="flex-row items-start gap-3">
        <Text className="font-mono text-base font-bold text-ink">{symbol}</Text>
        <Text className="flex-1 text-sm font-bold text-ink">{message}</Text>
        <Text className="font-mono text-sm text-ink/50">×</Text>
      </View>
    </Pressable>
  );
}

function ConfirmationSheet({
  confirmation,
  onCancel,
  onConfirm,
}: {
  confirmation: PendingConfirmation | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      transparent
      animationType="fade"
      visible={confirmation !== null}
      onRequestClose={onCancel}
    >
      <View className="flex-1 justify-end bg-ink/70 px-4 pb-8">
        <View
          accessibilityViewIsModal
          className="border-2 border-b-4 border-ink bg-paper p-5"
        >
          <Text className="font-mono text-sm font-bold uppercase text-stamp">Confirm club decision</Text>
          <Text className="mt-2 font-pixel text-xl uppercase text-ink">{confirmation?.title}</Text>
          <Text className="mt-3 text-base leading-6 text-ink/70">{confirmation?.detail}</Text>
          <View className="mt-5 flex-row gap-3">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel decision"
              onPress={onCancel}
              className="min-h-12 flex-1 items-center justify-center border-2 border-b-4 border-ink bg-white px-3"
              style={({ pressed }) => ({ transform: [{ translateY: pressed ? 2 : 0 }] })}
            >
              <Text className="font-pixel text-sm uppercase text-ink">Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={confirmation?.confirmLabel ?? 'Confirm decision'}
              onPress={onConfirm}
              className={`min-h-12 flex-1 items-center justify-center border-2 border-b-4 border-ink px-3 ${
                confirmation?.tone === 'danger'
                  ? 'bg-red'
                  : confirmation?.tone === 'hero'
                    ? 'bg-gold'
                    : 'bg-violet'
              }`}
              style={({ pressed }) => ({ transform: [{ translateY: pressed ? 2 : 0 }] })}
            >
              <Text className={`font-pixel text-sm uppercase ${
                confirmation?.tone === 'hero' ? 'text-ink' : 'text-paper'
              }`}>
                {confirmation?.confirmLabel}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
