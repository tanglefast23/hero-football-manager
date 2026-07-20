import './global.css';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { openDatabaseAsync } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Silkscreen_400Regular, Silkscreen_700Bold } from '@expo-google-fonts/silkscreen';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { loadLaunchContent } from './src/content';
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
  setManagementSfxMasterVolume,
  teardownManagementSfx,
} from './src/render/management-sfx';
import { assertRuntimeGoldenReplay, runtimeGoldenFingerprint } from './src/sim/runtime-golden';
import type { MatchState } from './src/sim/types';
import {
  ClubFinancesScreen,
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
  shouldShowOpeningBrief,
} from './src/ui';
import { leagueStandings } from './src/game';
import type { DivisionLevel } from './src/game/pyramid';
import { SettingsOverlay } from './src/ui/SettingsOverlay';
import type { TutorialAnchorLayout } from './src/ui/tutorial-cue-position';
import { useReducedMotion } from './src/ui/use-reduced-motion';
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
  const [fontsLoaded, fontError] = useFonts({ Silkscreen_400Regular, Silkscreen_700Bold });
  const [globalSettingsOpen, setGlobalSettingsOpen] = useState(false);
  const [moneyGuideAnchor, setMoneyGuideAnchor] = useState<TutorialAnchorLayout | null>(null);
  const [navigationGuideAnchor, setNavigationGuideAnchor] = useState<TutorialAnchorLayout | null>(null);
  const [trainingTransition, setTrainingTransition] = useState<TrainingTransitionScene | null>(null);
  const [lockedPlanConfirmation, setLockedPlanConfirmation] = useState<LockedPlanConfirmation | null>(null);
  const [awakeningBeat, setAwakeningBeat] = useState<1 | 2 | 3>(1);
  const [selectedLeagueDivision, setSelectedLeagueDivision] = useState<DivisionLevel | undefined>();
  const [selectedCupSeason, setSelectedCupSeason] = useState<number | undefined>();
  const preferencesRepositoryRef = useRef<PreferencesRepository | null>(null);
  const devVolume = preferences.masterVolume as DevVolume;
  const reduceMotion = useReducedMotion(preferences.reduceMotion);

  const savePreferences = useCallback((next: AppPreferences) => {
    setPreferences(next);
    void preferencesRepositoryRef.current?.save(next).catch(error => {
      Alert.alert('Settings were not saved', error instanceof Error ? error.message : String(error));
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
    const transitionScene = careerBefore === null
      ? null
      : trainingTransitionScene(careerBefore, content);
    useM1Store.getState().advanceCareer();
    const after = useM1Store.getState().career?.week;
    if (before !== undefined && after !== undefined && after !== before) {
      playAdvanceWeekSfx();
      if (transitionScene !== null) setTrainingTransition(transitionScene);
    }
  }, [content, trainingTransition]);

  const buildTrainingGroundWithSfx = useCallback(() => {
    const builtBefore = useM1Store.getState().career?.facilities.trainingGroundBuilt;
    useM1Store.getState().buildFacility();
    const builtAfter = useM1Store.getState().career?.facilities.trainingGroundBuilt;
    if (builtBefore === false && builtAfter === true) {
      playAdvanceWeekSfx();
    }
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
  }, [store.initializePersistence]);

  const finishWatchedMatch = useCallback((result: MatchState) => {
    store.finishWatchedMatch(result);
  }, [store.finishWatchedMatch]);

  const startNewCareer = useCallback(() => {
    if (!store.hasSavedCareer) {
      store.startNewCareer(undefined, 'full');
      return;
    }
    Alert.alert(
      'Replace saved career?',
      'Starting over permanently erases the current career and its match replays.',
      [
        { text: 'Keep saved career', style: 'cancel' },
        {
          text: 'Erase and start over',
          style: 'destructive',
          onPress: () => store.startNewCareer(undefined, 'full'),
        },
      ],
    );
  }, [store.hasSavedCareer, store.startNewCareer]);

  const assistantSequenceId = store.screen === 'management' && store.career !== null
    ? pendingAssistantGuideSequence(store.career, store.activeTab)
    : null;
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
  }, [assistantPageIndex, assistantSequence, assistantSequenceId, store.completeAssistantGuide]);

  let screen;
  if (!fontsLoaded && !fontError && bootError === null) {
    screen = <LoadingScreen />;
  } else if (bootError !== null) {
    screen = <BootFailure message={bootError} />;
  } else if (!store.persistenceReady) {
    screen = <LoadingScreen />;
  } else if (store.persistenceLoadError !== null) {
    screen = <BootFailure message={store.persistenceLoadError} />;
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
        onCycleVolume={cycleVolume}
        onCycleFormation={slot => savePreferences(replaceFormationPreset(preferences, slot))}
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
    screen = <BootFailure message="The saved career could not be loaded." />;
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
    const matchday = matchDayViewModel(store.career, content);
    screen = (
      <FixtureMatchDayScreen
        viewModel={matchday}
        onBack={() => store.setActiveTab('home')}
        onToggleHeroLicense={store.toggleHeroLicense}
        onSwapStartingPlayer={store.swapStartingPlayer}
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
        onChoose={store.chooseLegacy}
        onOpenSettings={() => setGlobalSettingsOpen(true)}
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
        onSubmitRenewalOffer={store.submitRenewalOffer}
        onCloseRenewal={store.closeRenewal}
        onReleaseContract={playerId => Alert.alert(
          'Let this player leave?',
          `${season.expiredContract?.playerName ?? 'This player'} will leave the club immediately. This cannot be undone.`,
          [
            { text: 'Keep player', style: 'cancel' },
            {
              text: 'Let player leave',
              style: 'destructive',
              onPress: () => store.releasePlayer(playerId),
            },
          ],
        )}
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
        onTabChange={store.setActiveTab}
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
            onSelectPlayer={store.selectPlayer}
            onTogglePlayerAssignment={store.toggleTrainingPlayer}
            onToggleDrill={store.toggleDrill}
            onApplyTraining={lockTrainingPlanWithFeedback}
            guideTraining={assistantObjective?.target === 'training-plan'}
          />
        ) : store.activeTab === 'club' ? (
          <ClubFinancesScreen
            viewModel={clubFinancesViewModel(store.career)}
            onBuildTrainingGround={buildTrainingGroundWithSfx}
            onBuildFacility={(type, x, y) => store.buildClubFacility(type, { x, y })}
            onUpgradeFacility={store.upgradeClubFacility}
            onRelocateFacility={(buildingId, x, y) => (
              store.relocateClubFacility(buildingId, { x, y })
            )}
            onOpenCoachMarket={() => store.setActiveTab('market')}
            guideTrainingGround={assistantObjective?.target === 'training-ground-facility'}
          />
        ) : store.activeTab === 'market' && store.career.market !== undefined ? (
          <MarketScreen
            viewModel={marketViewModel(careerMarketViewModelSource(store.career))}
            onStartScoutMission={store.startScoutMission}
            onOpenScoutReport={store.openScoutReport}
            onTransferAction={store.actOnTransfer}
            onHireCoach={store.hireCoach}
            onSignYouth={store.signYouth}
            onDeclineYouth={store.declineYouth}
            onSubmitContractOffer={store.submitTransferOffer}
            onCloseNegotiation={store.closeTransferTalks}
          />
        ) : store.activeTab === 'league' && store.career.m2 !== undefined ? (
          <M2LeagueScreen
            viewModel={m2LeagueViewModel({
              career: store.career.m2,
              season: store.career.season,
              activeStandings: leagueStandings(store.career),
              selectedDivision: selectedLeagueDivision,
              selectedCupSeason,
              week: store.career.week,
              phase: store.career.phase,
            })}
            onSelectDivision={setSelectedLeagueDivision}
            onSelectCupSeason={setSelectedCupSeason}
            onOpenCupFixture={store.openCupFixture}
          />
        ) : store.activeTab === 'league' ? (
          <LeagueTableScreen viewModel={leagueTableViewModel(store.career)} />
        ) : (
          <ClubHomeScreen
            viewModel={home}
            onOpenFixture={store.openMatchday}
            onOpenAlert={alertId => {
              if (alertId === 'training-ground') store.setActiveTab('club');
              else if (alertId.startsWith('injury-')) {
                store.selectPlayer(alertId.slice('injury-'.length));
                store.setActiveTab('squad');
              }
              else store.notify('This alert is resolved from the season review.');
            }}
            onOpenLeague={() => store.setActiveTab('league')}
            guideAlertId={assistantObjective?.target === 'training-ground-alert'
              ? 'training-ground'
              : undefined}
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
        {store.error ? <ErrorNotice message={store.error} onDismiss={store.clearError} /> : null}
        <SettingsOverlay
          open={globalSettingsOpen}
          volume={devVolume}
          reduceMotion={preferences.reduceMotion}
          hudSide={preferences.hudSide}
          onVolumeChange={volume => savePreferences({ ...preferences, masterVolume: volume })}
          onToggleReduceMotion={toggleReduceMotion}
          onToggleHudSide={toggleHudSide}
          onOpenChange={setGlobalSettingsOpen}
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
    revealCopy: 'KRAK! ZIP VELA floats upright as the ground shudders. He is, quite suddenly, enormous.',
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
      <View className="-rotate-2 border-2 border-signal px-5 py-4">
        <Text className="font-mono text-lg font-bold uppercase tracking-widest text-signal">Opening club files…</Text>
      </View>
    </SafeAreaView>
  );
}

function BootFailure({ message }: { message: string }) {
  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-ink px-6">
      <View className="w-full border-2 border-stamp bg-paper p-5">
        <Text className="text-lg font-bold uppercase text-stamp">The club files would not open</Text>
        <Text className="mt-3 text-sm leading-5 text-ink/70">{message}</Text>
      </View>
    </SafeAreaView>
  );
}

function ErrorNotice({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <Pressable
      accessibilityRole="alert"
      accessibilityLabel={`${message}. Tap to dismiss.`}
      onPress={onDismiss}
      className="absolute left-4 right-4 top-16 border-2 border-stamp bg-paper px-4 py-3 shadow-lg shadow-black/40"
    >
      <View className="flex-row items-start gap-3">
        <Text className="font-mono text-base font-bold text-stamp">!</Text>
        <Text className="flex-1 text-sm font-bold text-ink">{message}</Text>
        <Text className="font-mono text-sm text-ink/50">×</Text>
      </View>
    </Pressable>
  );
}
