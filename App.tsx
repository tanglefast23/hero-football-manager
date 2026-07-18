import './global.css';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { openDatabaseAsync } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { loadLaunchContent } from './src/content';
import { createCareerRepository, createReplayRepository } from './src/persistence';
import { MatchScreen } from './src/render/MatchScreen';
import { setMasterVolume } from './src/render/audio';
import { devVolumePercent, nextDevVolume, type DevVolume } from './src/render/dev-volume';
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
  const [devVolume, setDevVolume] = useState<DevVolume>(1);
  const [landingView, setLandingView] = useState<LandingView>('title');

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
      }))
      .then(repositories => active
        ? store.initializePersistence(
          repositories.careerRepository,
          repositories.replayRepository,
        )
        : undefined)
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
  if (bootError !== null) {
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
        volumePercent={devVolumePercent(devVolume)}
        onCycleVolume={() => setDevVolume(current => nextDevVolume(current))}
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
        activeTab={store.activeTab}
        onTabChange={store.setActiveTab}
        onAdvanceWeek={store.advanceCareer}
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
            onOpenFinances={() => store.setActiveTab('club')}
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
        {__DEV__ ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Development volume ${devVolumePercent(devVolume)} percent`}
            accessibilityHint="Cycles through mute, 25, 50, 75, and 100 percent"
            hitSlop={8}
            testID="dev-volume-button"
            style={styles.volumeBtn}
            onPress={() => setDevVolume(current => nextDevVolume(current))}
          >
            <Text style={styles.volumeText}>
              {devVolume === 0 ? '🔇' : devVolume <= 0.5 ? '🔉' : '🔊'} {devVolumePercent(devVolume)}%
            </Text>
          </Pressable>
        ) : null}
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

const styles = StyleSheet.create({
  volumeBtn: {
    position: 'absolute',
    top: 52,
    right: 12,
    minWidth: 74,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e2630',
    borderColor: '#536273',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    zIndex: 1000,
    elevation: 12,
  },
  volumeText: { color: 'white', fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
