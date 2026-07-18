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
import { setMasterVolume } from './src/render/audio';
import { nextDevVolume, type DevVolume } from './src/render/dev-volume';
import {
  setMenuMasterVolume,
  setMenuTheme,
  teardownMenuAudio,
  type MenuTheme,
} from './src/render/menu-audio';
import { assertRuntimeGoldenReplay, runtimeGoldenFingerprint } from './src/sim/runtime-golden';
import type { MatchState } from './src/sim/types';
import {
  ClubFinancesScreen,
  ClubHomeScreen,
  CharacterCreationScreen,
  FirstAwakeningScreen,
  FixtureMatchDayScreen,
  LeagueTableScreen,
  ManagementShell,
  NewGameWelcomeScreen,
  PostMatchLedgerScreen,
  SeasonEndScreen,
  SquadTrainingScreen,
  StoryEventScreen,
  TitleLandingScreen,
  TitleSettingsScreen,
} from './src/ui';
import { SettingsOverlay } from './src/ui/SettingsOverlay';
import { useM1Store } from './src/application/store';
import {
  clubFinancesViewModel,
  homeViewModel,
  leagueTableViewModel,
  matchDayViewModel,
  seasonEndViewModel,
  squadTrainingViewModel,
  storyEventViewModel,
} from './src/application/view-models';

const DATABASE_NAME = 'hero-football-manager.db';
type LandingView = 'title' | 'story' | 'settings';

export default function App() {
  const store = useM1Store();
  const content = useMemo(loadLaunchContent, []);
  const [bootError, setBootError] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<AppPreferences>(DEFAULT_APP_PREFERENCES);
  const [landingView, setLandingView] = useState<LandingView>('title');
  const [fontsLoaded, fontError] = useFonts({ Silkscreen_400Regular, Silkscreen_700Bold });
  const [managementSettingsOpen, setManagementSettingsOpen] = useState(false);
  const preferencesRepositoryRef = useRef<PreferencesRepository | null>(null);
  const devVolume = preferences.masterVolume as DevVolume;

  const savePreferences = useCallback((next: AppPreferences) => {
    setPreferences(next);
    void preferencesRepositoryRef.current?.save(next).catch(error => {
      Alert.alert('Settings were not saved', error instanceof Error ? error.message : String(error));
    });
  }, []);

  const cycleVolume = useCallback(() => {
    savePreferences({ ...preferences, masterVolume: nextDevVolume(devVolume) });
  }, [devVolume, preferences, savePreferences]);

  useEffect(() => {
    setMasterVolume(devVolume);
    setMenuMasterVolume(devVolume);
  }, [devVolume]);

  const menuTheme: MenuTheme = bootError === null
    && store.persistenceReady
    && store.persistenceLoadError === null
    ? store.screen === 'welcome'
      ? 'opening'
      : store.screen === 'management'
        ? 'management'
        : null
    : null;

  useEffect(() => {
    setMenuTheme(menuTheme);
  }, [menuTheme]);

  useEffect(() => () => teardownMenuAudio(), []);

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
        preferences: await repositories.preferencesRepository.load(),
      }))
      .then(repositories => {
        if (!active) return undefined;
        preferencesRepositoryRef.current = repositories.preferencesRepository;
        setPreferences(repositories.preferences);
        return store.initializePersistence(
          repositories.careerRepository,
          repositories.replayRepository,
        );
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
      store.startNewCareer();
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
          onPress: () => store.startNewCareer(),
        },
      ],
    );
  }, [store.hasSavedCareer, store.startNewCareer]);

  const onboardingPlayer = store.career?.onboarding?.createdPlayerId === undefined
    ? undefined
    : store.career.players.find(
        player => player.id === store.career?.onboarding?.createdPlayerId,
      );
  const onboardingPowerId = store.career?.onboarding?.awakenedPower;
  const onboardingPowerName = onboardingPowerId === undefined
    ? undefined
    : content.powers.powers.find(
        power => power.id === onboardingPowerId,
      )?.name ?? onboardingPowerId;

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
        onToggleAutoPowers={() => savePreferences({ ...preferences, autoPowers: !preferences.autoPowers })}
        onBack={() => setLandingView('title')}
      />
    );
  } else if (store.screen === 'welcome') {
    screen = (
      <NewGameWelcomeScreen
        hasSavedCareer={store.hasSavedCareer}
        savedCareerLabel={store.career ? `Season ${store.career.season} · Week ${store.career.week}` : undefined}
        onStartNewCareer={startNewCareer}
        onContinueCareer={store.hasSavedCareer ? store.continueCareer : undefined}
        onBackToTitle={() => setLandingView('title')}
      />
    );
  } else if (store.screen === 'create-player' && store.career !== null) {
    screen = <CharacterCreationScreen onComplete={store.completePlayerCreation} />;
  } else if (
    store.screen === 'first-awakening'
    && store.career !== null
    && onboardingPlayer !== undefined
  ) {
    screen = (
      <FirstAwakeningScreen
        playerName={onboardingPlayer.name}
        content={content.onboarding}
        selectedOrigin={store.career.onboarding?.selectedOrigin}
        powerName={onboardingPowerName}
        onChoose={store.chooseFirstAwakening}
        onContinue={store.continueFirstAwakening}
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
        autoPowers={preferences.autoPowers}
        onDone={finishWatchedMatch}
      />
    );
  } else if (store.screen === 'matchday') {
    screen = (
      <FixtureMatchDayScreen
        viewModel={matchDayViewModel(store.career, content)}
        onBack={() => store.setActiveTab('home')}
        onToggleHeroLicense={store.toggleHeroLicense}
        onWatchMatch={store.watchMatch}
        onQuickResult={store.quickResult}
      />
    );
  } else if (store.screen === 'management' && managementSettingsOpen) {
    screen = (
      <TitleSettingsScreen
        preferences={preferences}
        onCycleVolume={cycleVolume}
        onCycleFormation={slot => savePreferences(replaceFormationPreset(preferences, slot))}
        onToggleAutoPowers={() => savePreferences({ ...preferences, autoPowers: !preferences.autoPowers })}
        onBack={() => setManagementSettingsOpen(false)}
        backLabel="Back to club"
      />
    );
  } else if (store.screen === 'postmatch' && store.postMatch !== null) {
    screen = (
      <PostMatchLedgerScreen
        viewModel={store.postMatch}
        onContinue={store.continueAfterMatch}
      />
    );
  } else if (store.screen === 'event' && store.career.pendingEvent !== undefined) {
    screen = (
      <StoryEventScreen
        viewModel={storyEventViewModel(store.career, content)}
        onChoose={store.chooseEvent}
        onSelectPlayer={store.selectEventPlayer}
        onContinue={store.continueAfterEvent}
      />
    );
  } else if (store.screen === 'season-end') {
    const season = seasonEndViewModel(store.career, content, store.selectedContractTerm);
    screen = (
      <SeasonEndScreen
        viewModel={season}
        onSelectContractTerm={(_playerId, term) => store.setContractTerm(term)}
        onRenewContract={(playerId, term) => store.renewPlayer(playerId, term)}
        onPrimaryAction={() => season.sliceComplete ? store.setActiveTab('home') : store.advanceCareer()}
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
        onAdvanceWeek={store.advanceCareer}
        onOpenLedger={() => store.setActiveTab('club')}
        onOpenSettings={() => setManagementSettingsOpen(true)}
        advanceWeekLabel={store.saving ? 'Saving…' : 'Advance Week  ▸'}
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
            onApplyTraining={store.applyTraining}
          />
        ) : store.activeTab === 'club' ? (
          <ClubFinancesScreen
            viewModel={clubFinancesViewModel(store.career)}
            onBuildTrainingGround={store.buildFacility}
          />
        ) : store.activeTab === 'league' ? (
          <LeagueTableScreen viewModel={leagueTableViewModel(store.career)} />
        ) : (
          <ClubHomeScreen
            viewModel={home}
            onOpenFixture={store.openMatchday}
            onOpenAlert={alertId => {
              if (alertId === 'training-ground') store.setActiveTab('club');
              else store.notify('This alert is resolved from the season review.');
            }}
            onOpenLeague={() => store.setActiveTab('league')}
          />
        )}
      </ManagementShell>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <View className="flex-1 bg-ink">
        {screen}
        {store.error ? <ErrorNotice message={store.error} onDismiss={store.clearError} /> : null}
        <SettingsOverlay
          volume={devVolume}
          onVolumeChange={volume => savePreferences({ ...preferences, masterVolume: volume })}
        />
      </View>
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
