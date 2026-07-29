import './global.css';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LogBox, Modal, Text, View } from 'react-native';
import { deleteDatabaseAsync, openDatabaseAsync } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Silkscreen_400Regular, Silkscreen_700Bold } from '@expo-google-fonts/silkscreen';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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
  migrateDatabase,
  replaceFormationPreset,
  resetCareerDatabase,
  type AppPreferences,
  type PreferencesRepository,
} from './src/persistence';
import { MatchScreen, type PowerCutInQaEntry } from './src/render/MatchScreen';
import { PowerEffectPreview } from './src/render/PowerEffectPreview';
import {
  powerMatchShowcaseAway,
  powerMatchShowcaseHome,
} from './src/render/power-match-showcase';
import { setMasterVolume } from './src/render/audio';
import {
  playAwakeningAscension,
  setAwakeningMasterVolume,
  stopAwakeningAscension,
  teardownAwakeningAudio,
} from './src/render/awakening-audio';
import { nextDevVolume, type DevVolume } from './src/render/dev-volume';
import {
  menuThemeForScreen,
  playAdvanceWeekSfx,
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
import { setBertVoiceMasterVolume, teardownBertVoice } from './src/render/bert-voice';
import { playManagementHaptic, setHapticsEnabled } from './src/render/haptics';
import { assertRuntimeGoldenReplay, runtimeGoldenFingerprint } from './src/sim/runtime-golden';
import type { MatchState } from './src/sim/types';
import {
  ClubFinancesScreen,
  CoachStaffOverlay,
  FacilityProjectNotice,
  PlayerSigningOverlay,
  PlayerWalkOnWelcome,
  ClubHomeScreen,
  ClubLegacyScreen,
  BertBriefingWalkOn,
  MatchdayConditionWarning,
  matchdayConditionWarningPlayer,
  CharacterCreationScreen,
  AwakeningCutsceneScreen,
  ChampionshipCelebrationScreen,
  FixtureMatchDayScreen,
  LeagueTableScreen,
  M2LeagueScreen,
  ManagementShell,
  MarketScreen,
  NewGameWelcomeScreen,
  PostMatchLedgerScreen,
  PostMatchSummaryModal,
  SeasonEndScreen,
  SquadTrainingScreen,
  StoryEventScreen,
  TitleLandingScreen,
  TitleSettingsScreen,
  WeeklyReviewScreen,
  type CoachOverlayCoach,
  type FacilityProjectNoticeModel,
  type PlayerSigningConfirmation,
  type MarketSectionId,
  formatCurrency,
  shouldShowOpeningBrief,
} from './src/ui';
import {
  activeCareerMatchday,
  buildCareerMatchTeams,
  careerCoachUnlockedFormationIds,
  clubSquadStrength,
  hasActiveCareerContractPromise,
  hasAssistantGuideSequenceCompleted,
  isFirstOnboardingFixture,
  isFullyCappedPlayer,
  leagueStandings,
  hasAssistantGuideMilestone,
} from './src/game';
import type { DivisionLevel } from './src/game/pyramid';
import { SettingsOverlay } from './src/ui/SettingsOverlay';
import type { TutorialAnchorLayout } from './src/ui/tutorial-cue-position';
import { guidedFirstFacilityAllowsPlacement } from './src/ui/concierge-targets';
import { useReducedMotion } from './src/ui/use-reduced-motion';
import { useRivalPreload } from './src/ui/use-rival-preload';
import { SfxPressable as Pressable } from './src/ui/components/SfxPressable';
import { useM1Store } from './src/application/store';
import { ScreenErrorBoundary } from './src/ui/ScreenErrorBoundary';
import {
  currentAssistantObjective,
  pendingAssistantGuideSequence,
} from './src/application/assistant-guide';
import { loadPreferencesFailSoft, markPowerCutInSeen } from './src/application/preferences';
import {
  DESK_STORY_ALERT_ID,
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
import type { AwakeningCutsceneViewModel, SquadTrainingViewModel } from './src/ui/models';
import { AwakeningArtQaScreen } from './src/ui/screens/AwakeningArtQaScreen';
import { PowerArtQaScreen } from './src/ui/screens/PowerArtQaScreen';
import { championshipCelebrationViewModel } from './src/application/championship-celebration';
import { m2LeagueViewModel } from './src/application/m2-league-view-model';
import { marketViewModel } from './src/application/market-view-model';
import { careerMarketViewModelSource } from './src/application/market-source-adapter';

// Dynamic Type still grows every player-facing label, but the simulator's
// largest accessibility category is more than 3x and makes the fixed-width
// management cards collapse into single letters. Keep a generous global cap;
// individual compact chrome controls use a tighter cap in ManagementShell.
const APP_MAX_FONT_SIZE_MULTIPLIER = 1.6;
const appText = Text as typeof Text & {
  defaultProps?: { maxFontSizeMultiplier?: number };
};
appText.defaultProps = {
  ...appText.defaultProps,
  maxFontSizeMultiplier: APP_MAX_FONT_SIZE_MULTIPLIER,
};

// The Debug build pings the packager port it was compiled with before falling
// back to the active one; the resulting warning toast is pure dev noise.
LogBox.ignoreLogs([/Packager status check returned unexpected result/]);

const DATABASE_NAME = 'hero-football-manager.db';
type LandingView = 'title' | 'story' | 'settings';

interface PendingConfirmation {
  readonly title: string;
  readonly detail: string;
  readonly confirmLabel: string;
  readonly tone?: 'normal' | 'danger' | 'hero';
  readonly onConfirm: () => void;
}

/**
 * Week 6: late enough that the manager has trained the slow way a few times and
 * felt the friction, early enough to matter for the rest of season one.
 */
const QUICK_TRAIN_LESSON_WEEK = 6;

export default function App() {
  const previewTriggerId = process.env.EXPO_PUBLIC_AWAKENING_PREVIEW_ID;
  if (process.env.EXPO_PUBLIC_POWER_MATCH_QA === '1') {
    return <PowerMatchQaApp />;
  }
  if (__DEV__ && process.env.EXPO_PUBLIC_POWER_CUTIN_QA === '1') {
    return <PowerCutInQaApp />;
  }
  // The explicit build flag also supports a static web export, so art review
  // never depends on opening a saved career or matching its replay baseline.
  if (process.env.EXPO_PUBLIC_POWER_ART_QA === '1') {
    return <PowerArtQaApp />;
  }
  if (__DEV__ && process.env.EXPO_PUBLIC_AWAKENING_ART_QA === '1') {
    return <AwakeningArtQaApp triggerId={previewTriggerId ?? 'magic-sponge'} />;
  }
  if (__DEV__ && previewTriggerId) {
    return <AwakeningReviewApp triggerId={previewTriggerId} />;
  }
  return (
    <ScreenErrorBoundary
      onRecover={() => useM1Store.setState({ screen: 'welcome', error: null, activeTab: 'home' })}
    >
      <GameApp />
    </ScreenErrorBoundary>
  );
}

const POWER_CUT_IN_QA_ENTRIES: readonly PowerCutInQaEntry[] = [
  { id: 'qa-fire', power: 'FIRE_TORCH', playerName: 'Dario Flint', skippable: false },
  { id: 'qa-speed', power: 'SUPER_SPEED', playerName: 'Zip Vela', skippable: false },
  { id: 'qa-gravity', power: 'GRAVITY_WELL', playerName: 'Leo Quick', skippable: false },
  { id: 'qa-elastic', power: 'ELASTIC_KEEPER', playerName: 'Sam Mitts', skippable: false },
];

function PowerMatchQaApp() {
  const content = useMemo(loadLaunchContent, []);
  const powers = content.powers.powers;
  const [selectedPowerIndex, setSelectedPowerIndex] = useState(0);
  const [replayKey, setReplayKey] = useState(0);
  const powerCount = powers.length;
  const powerIndex = selectedPowerIndex % powerCount;
  const power = powers[powerIndex];
  const home = useMemo(() => powerMatchShowcaseHome(power.id), [power.id]);
  const away = useMemo(powerMatchShowcaseAway, []);
  const powerMatchQa = useMemo(() => ({
    power: power.id,
  }), [power.id]);
  const [fontsLoaded] = useFonts({ Silkscreen_400Regular, Silkscreen_700Bold });

  return (
    <SafeAreaProvider>
      {!fontsLoaded ? <LoadingScreen /> : <>
        <StatusBar style="light" />
        <SafeAreaView className="flex-1 bg-ink">
        <View className="border-b-2 border-ink bg-blue-dark px-2 py-2">
          <View className="flex-row items-center gap-2">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Show previous power in a live match"
              className="min-h-11 items-center justify-center border-2 border-b-4 border-ink bg-paper px-3"
              onPress={() => {
                setSelectedPowerIndex((powerIndex - 1 + powerCount) % powerCount);
                setReplayKey(key => key + 1);
              }}
            >
              <Text className="font-pixel text-xs uppercase text-ink">‹ Prev</Text>
            </Pressable>
            <View className="flex-1 items-center">
              <Text className="font-pixel text-[10px] uppercase tracking-widest text-gold">
                Live match · {String(powerIndex + 1).padStart(2, '0')} / {String(powerCount).padStart(2, '0')}
              </Text>
              <Text numberOfLines={1} className="font-pixel text-base uppercase text-paper">{power.name}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Restart ${power.name} live match scenario`}
              className="min-h-11 items-center justify-center border-2 border-b-4 border-ink bg-gold px-3"
              onPress={() => setReplayKey(key => key + 1)}
            >
              <Text className="font-pixel text-xs uppercase text-ink">↻</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Show next power in a live match"
              className="min-h-11 items-center justify-center border-2 border-b-4 border-ink bg-paper px-3"
              onPress={() => {
                setSelectedPowerIndex((powerIndex + 1) % powerCount);
                setReplayKey(key => key + 1);
              }}
            >
              <Text className="font-pixel text-xs uppercase text-ink">Next ›</Text>
            </Pressable>
          </View>
          <Text className="mt-1 text-center font-pixel text-[10px] leading-4 text-paper/80">
            {power.description}
          </Text>
        </View>
        <View className="flex-1">
          <MatchScreen
            key={`${power.id}:${replayKey}`}
            seed={42}
            home={home}
            away={away}
            controlledTeam={0}
            reduceMotion={false}
            cutInMode="full"
            powerMatchQa={powerMatchQa}
            onOpenSettings={() => undefined}
            onDone={() => undefined}
          />
        </View>
        </SafeAreaView>
      </>}
    </SafeAreaProvider>
  );
}

function PowerCutInQaApp() {
  const [fontsLoaded] = useFonts({ Silkscreen_400Regular, Silkscreen_700Bold });
  if (!fontsLoaded) return <LoadingScreen />;
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <SafeAreaView style={{ flex: 1, backgroundColor: '#16121f' }}>
        <MatchScreen
          seed={42}
          reduceMotion={false}
          cutInMode="full"
          powerCutInQaEntries={POWER_CUT_IN_QA_ENTRIES}
          onOpenSettings={() => undefined}
          onDone={() => undefined}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function PowerArtQaApp() {
  const content = useMemo(loadLaunchContent, []);
  const powers = content.powers.powers;
  const [selectedPowerIndex, setSelectedPowerIndex] = useState(0);
  const [replayKey, setReplayKey] = useState(0);
  const powerCount = powers.length;
  const powerIndex = selectedPowerIndex % powerCount;
  const power = powers[powerIndex];
  const [fontsLoaded] = useFonts({ Silkscreen_400Regular, Silkscreen_700Bold });

  return (
    <SafeAreaProvider>
      {!fontsLoaded ? <LoadingScreen /> : (
        <>
          <StatusBar style="light" />
          <PowerArtQaScreen
            index={powerIndex}
            total={powerCount}
            name={power.name}
            description={power.description}
            category={power.category}
            tier={power.tier === 'starter' ? 'starter' : 'standard'}
            preview={<PowerEffectPreview power={power.id} replayKey={replayKey} />}
            onPrevious={() => setSelectedPowerIndex((
              powerIndex - 1 + powerCount
            ) % powerCount)}
            onReplay={() => setReplayKey(key => key + 1)}
            onNext={() => setSelectedPowerIndex((powerIndex + 1) % powerCount)}
          />
        </>
      )}
    </SafeAreaProvider>
  );
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
  /**
   * The focus of the briefing beat Bert is currently speaking.
   *
   * The walk-on owns which line is showing, but the anchors it wants lit are
   * measured by screens far above it — measurement is gated on `guideFocus`.
   * So the live focus is reported back up here rather than derived from a page
   * index, which is what the framed window used before it stepped page by page.
   */
  const [activeGuideFocus, setActiveGuideFocus] = useState<AssistantGuideFocus | undefined>(undefined);
  const [requestedAssistantSequenceId, setRequestedAssistantSequenceId] = useState<AssistantGuideSequenceId | null>(null);
  const [conciergeFocus, setConciergeFocus] = useState<AssistantGuideFocus | null>(null);
  // A screen-wide tap retires floating coach marks without completing the job
  // they describe. The objective remains authoritative; only its cue is hidden.
  const [dismissedAssistantObjectiveKey, setDismissedAssistantObjectiveKey] = useState<string | null>(null);
  const [tipDismissSequence, setTipDismissSequence] = useState(0);
  const [marketSectionRequest, setMarketSectionRequest] = useState<{
    section: MarketSectionId;
    token: number;
  } | null>(null);
  // Bumped when an inbox training-cap letter deep-links into the drill picker.
  const [drillFocusToken, setDrillFocusToken] = useState<number | null>(null);
  const [fontsLoaded, fontError] = useFonts({ Silkscreen_400Regular, Silkscreen_700Bold });
  const [globalSettingsOpen, setGlobalSettingsOpen] = useState(false);
  const [globalGlossaryOpen, setGlobalGlossaryOpen] = useState(false);
  const [settingsSaveError, setSettingsSaveError] = useState<string | null>(null);
  const [moneyGuideAnchor, setMoneyGuideAnchor] = useState<TutorialAnchorLayout | null>(null);
  const [navigationGuideAnchor, setNavigationGuideAnchor] = useState<TutorialAnchorLayout | null>(null);
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
  const preferencesSaveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const preferencesRef = useRef(preferences);
  preferencesRef.current = preferences;
  const lastSeasonReviewCueRef = useRef<string | null>(null);
  const devVolume = preferences.masterVolume as DevVolume;
  const reduceMotion = useReducedMotion(preferences.reduceMotion);

  const savePreferences = useCallback((next: AppPreferences) => {
    // Ahead of the render, so two changes made before React re-renders — a
    // toggle and a volume drag, or a cut-in first-view landing mid-tap — both
    // compose from this and the second no longer persists a snapshot taken
    // before the first.
    preferencesRef.current = next;
    setPreferences(next);
    setSettingsSaveError(null);
    const repository = preferencesRepositoryRef.current;
    if (repository === null) return;
    preferencesSaveQueueRef.current = preferencesSaveQueueRef.current
      .then(async () => {
        await repository.save(next);
        setSettingsSaveError(null);
      })
      .catch(error => {
        const detail = error instanceof Error ? error.message : String(error);
        setSettingsSaveError(`Settings were not saved. ${detail}`);
      });
  }, []);

  // Every one of these composes from `preferencesRef`, never from the rendered
  // `preferences`: a settings screen is a column of controls the player can hit
  // faster than React re-renders, and a stale spread reverts the change before
  // it on disk while the UI still shows both as set.
  const cycleVolume = useCallback(() => {
    const current = preferencesRef.current;
    savePreferences({
      ...current,
      masterVolume: nextDevVolume(current.masterVolume as DevVolume),
    });
  }, [savePreferences]);
  const setVolume = useCallback((masterVolume: DevVolume) => {
    savePreferences({ ...preferencesRef.current, masterVolume });
  }, [savePreferences]);
  const toggleReduceMotion = useCallback(() => {
    const current = preferencesRef.current;
    savePreferences({ ...current, reduceMotion: !current.reduceMotion });
  }, [savePreferences]);
  const toggleHudSide = useCallback(() => {
    const current = preferencesRef.current;
    savePreferences({ ...current, hudSide: current.hudSide === 'left' ? 'right' : 'left' });
  }, [savePreferences]);
  const toggleHaptics = useCallback(() => {
    const current = preferencesRef.current;
    savePreferences({ ...current, hapticsEnabled: !current.hapticsEnabled });
  }, [savePreferences]);
  const cycleTextScale = useCallback(() => {
    const current = preferencesRef.current;
    const textScale = current.textScale === 1 ? 1.15 : current.textScale === 1.15 ? 1.3 : 1;
    savePreferences({ ...current, textScale });
  }, [savePreferences]);
  const toggleHighContrast = useCallback(() => {
    const current = preferencesRef.current;
    savePreferences({ ...current, highContrast: !current.highContrast });
  }, [savePreferences]);
  const toggleColorSafeKits = useCallback(() => {
    const current = preferencesRef.current;
    savePreferences({ ...current, colorSafeKits: !current.colorSafeKits });
  }, [savePreferences]);
  const toggleCutInMode = useCallback(() => {
    const current = preferencesRef.current;
    savePreferences({ ...current, cutInMode: current.cutInMode === 'full' ? 'banner' : 'full' });
  }, [savePreferences]);
  const cycleFormationPreset = useCallback((slot: number) => {
    const market = useM1Store.getState().career?.market;
    savePreferences(replaceFormationPreset(
      preferencesRef.current,
      slot,
      market === undefined ? [] : careerCoachUnlockedFormationIds(market),
    ));
  }, [savePreferences]);
  const recordSeenPowerCutIn = useCallback((power: AppPreferences['seenPowerCutIns'][number]) => {
    const current = preferencesRef.current;
    const next = markPowerCutInSeen(current, power);
    if (next === current) return;
    savePreferences(next);
  }, [savePreferences]);

  const advanceCareerWithSfx = useCallback(() => {
    // Zustand updates synchronously here. Only a real week change gets the
    // cue, so tutorial-blocked taps and event redirects stay silent.
    const careerBefore = useM1Store.getState().career;
    const before = careerBefore?.week;
    const boardResolutionBefore = careerBefore?.financialSafety?.latestBoardResolution?.id;
    useM1Store.getState().advanceCareer();
    const after = useM1Store.getState().career?.week;
    const boardResolutionAfter = useM1Store.getState().career?.financialSafety?.latestBoardResolution;
    if (before !== undefined && after !== undefined && after !== before) {
      playAdvanceWeekSfx();
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
  }, []);

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
      benefitLabel: activeProject.benefitLabel,
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
    // A refused action used to return in silence while a merely blocked drill
    // tap buzzed, so the one case that needs attention was the quiet one.
    if (useM1Store.getState().error !== null) {
      playManagementActionSfx('warning');
      playManagementHaptic('warning');
      return;
    }
    setConciergeFocus(null);
    playManagementActionSfx(sound);
    playManagementHaptic(haptic);
  }, []);

  // No cue of its own: every control that opens a confirmation already played
  // one, and the two landing together read as a stutter.
  const requestConfirmation = useCallback((confirmation: PendingConfirmation) => {
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
    const staff = clubFinancesViewModel(career).coachingStaff;
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
  }, []);

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
    if (stateAfter.error !== null) {
      playManagementActionSfx('warning');
      playManagementHaptic('warning');
      return;
    }
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

  const completeRookieCreation = useCallback((draft: Parameters<typeof store.completePlayerCreation>[0]) => {
    useM1Store.getState().completePlayerCreation(draft);
    const career = useM1Store.getState().career;
    const rookie = career?.players.find(player => player.createdAppearance !== undefined);
    if (rookie === undefined) return;
    setPlayerSigning({
      playerId: rookie.id,
      playerName: rookie.name,
      role: rookie.role,
      lookId: rookie.lookId,
      source: 'rookie',
    });
  }, []);

  useEffect(() => {
    setMasterVolume(devVolume);
    setMenuMasterVolume(devVolume);
    setManagementSfxMasterVolume(devVolume);
    setBertVoiceMasterVolume(devVolume);
    setAwakeningMasterVolume(devVolume);
  }, [devVolume]);

  useEffect(() => {
    setHapticsEnabled(preferences.hapticsEnabled);
  }, [preferences.hapticsEnabled]);

  useEffect(() => {
    if (store.screen !== 'season-end' || store.career === null) return;
    const cueKey = `${store.career.careerSeed}:${store.career.season}:${store.career.phase}`;
    if (lastSeasonReviewCueRef.current === cueKey) return;
    lastSeasonReviewCueRef.current = cueKey;
    playManagementActionSfx('success');
    playManagementHaptic('success');
  }, [store.career, store.screen]);

  const menuTheme: MenuTheme = bootError === null
    && store.persistenceReady
    && store.persistenceLoadError === null
    ? menuThemeForScreen(store.screen, awakeningBeat)
    : null;

  useEffect(() => {
    setMenuTheme(menuTheme);
  }, [menuTheme]);

  useEffect(() => () => {
    teardownMenuAudio();
    teardownManagementSfx();
    teardownBertVoice();
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
    // Expo's native runtime is Hermes. This gate executes the same full-payload
    // replay fingerprint as the Node test to catch engine drift — but it runs two
    // complete 2,000-tick matches synchronously, so it is development-only. In a
    // shipped build it would add ~1s to cold start, and a runtime float shift
    // would send every installed copy to an error screen instead of their save.
    if (__DEV__) {
      try {
        assertRuntimeGoldenReplay();
        console.info(`HERMES_GOLDEN_OK ${runtimeGoldenFingerprint()}`);
      } catch (error) {
        setBootError(error instanceof Error ? error.message : String(error));
        return () => {
          active = false;
        };
      }
    }
    void openDatabaseAsync(DATABASE_NAME)
      .then(async database => {
        // Migrate once up front. Each repository migrates defensively on its
        // own, and three of those racing on a fresh database would all read the
        // pre-migration version and then each try to apply migration 5 — an
        // ALTER TABLE ADD COLUMN, which is not idempotent. With the schema
        // already current their internal calls read the version and do nothing,
        // so the three builds are free to overlap.
        await migrateDatabase(database);
        const [careerRepository, replayRepository, preferencesRepository] = await Promise.all([
          createCareerRepository(database),
          createReplayRepository(database),
          createPreferencesRepository(database),
        ]);
        return { careerRepository, replayRepository, preferencesRepository };
      })
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
      store.startNewCareer();
      return;
    }
    requestConfirmation({
      title: 'Replace saved career?',
      detail: 'Starting over permanently erases the current career and its match replays.',
      confirmLabel: 'Erase and start over',
      tone: 'danger',
      onConfirm: () => store.startNewCareer(),
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
  /**
   * Whether Bert's guide is covering the screen.
   *
   * Declared once and used both to render the overlay and to suspend keyboard
   * shortcuts. The guide is an absolutely-positioned View rather than an RN
   * Modal, so react-native-web never renders `aria-modal` for it and the
   * shortcut hook's own modal check cannot see it — without this, 1-5 switched
   * tabs underneath a full-screen briefing that was blocking mouse clicks on
   * that same rail. Sharing the expression keeps the two from drifting apart.
   */
  const guideOverlayVisible = assistantSequenceId !== null
    && playerSigning?.source !== 'rookie';
  const assistantObjective = store.career === null
    ? null
    : currentAssistantObjective(store.career, store.activeTab);
  const assistantObjectiveKey = assistantObjective === null
    ? null
    : `${assistantObjective.target}:${assistantObjective.text}`;
  const previousAssistantObjectiveKeyRef = useRef(assistantObjectiveKey);
  useEffect(() => {
    if (previousAssistantObjectiveKeyRef.current === assistantObjectiveKey) return;
    previousAssistantObjectiveKeyRef.current = assistantObjectiveKey;
    setDismissedAssistantObjectiveKey(null);
  }, [assistantObjectiveKey]);
  const visibleAssistantObjectiveTarget = assistantObjectiveKey !== null
    && assistantObjectiveKey === dismissedAssistantObjectiveKey
    ? undefined
    : assistantObjective?.target;
  const assistantObjectiveTargetTab = assistantObjective?.target === 'home-tab'
    ? 'home'
    : assistantObjective?.target === 'squad-tab'
      ? 'squad'
      : undefined;
  const dismissVisibleTips = useCallback(() => {
    setConciergeFocus(null);
    if (assistantObjectiveKey !== null) {
      setDismissedAssistantObjectiveKey(assistantObjectiveKey);
    }
    setTipDismissSequence(sequence => sequence + 1);
  }, [assistantObjectiveKey]);
  const hideCoachHiringCues = store.activeTab === 'market'
    && (
      conciergeFocus === 'coach-market'
      || conciergeFocus === 'coach-hire'
      || conciergeFocus === 'assistant-coach-hire'
    );

  // Memoized so unrelated re-renders of the squad tab (scroll cues, selection
  // changes) don't redo conditioning, growth-modifier, and facility effects
  // across the whole roster.
  const squadTrainingVm = useMemo(
    () => (store.career === null
      ? null
      : squadTrainingViewModel(
          store.career,
          content,
          store.selectedPlayerId,
        )),
    [store.career, content, store.selectedPlayerId],
  );

  // Rival squads are settled the moment the week advances, so the preload can
  // start while the player is still on the home screen rather than waiting for
  // the team sheet — a player who taps straight through would otherwise pay the
  // whole freeze anyway. Keyed by the matchday itself: every lineup edit
  // replaces the career object, and keying on that restarted the work.
  const matchdayPreloadKey = store.career !== null && store.career.phase === 'matchday'
    ? `${store.career.season}:${store.career.week}`
    : null;

  const matchdayPreload = useMemo(() => {
    if (matchdayPreloadKey === null) return null;
    const career = useM1Store.getState().career;
    if (career === null) return null;
    const matchday = activeCareerMatchday(career);
    if (matchday === undefined || matchday.kind !== 'league') return null;
    const rivals = matchday.fixtures.filter(candidate => candidate.id !== matchday.fixture.id);
    if (rivals.length === 0) return null;
    return {
      rivals,
      // Only the rival clubs: the user's own team is not an input to any of
      // these fixtures, and rebuilding it here would churn on every swap.
      teams: buildCareerMatchTeams(
        career,
        [...new Set(rivals.flatMap(candidate => [candidate.homeClubId, candidate.awayClubId]))],
      ),
    };
  }, [matchdayPreloadKey]);

  useRivalPreload(
    matchdayPreloadKey,
    matchdayPreload?.rivals ?? [],
    matchdayPreload?.teams ?? null,
    store.screen === 'watched',
  );

  const handleAdvanceWeek = advanceCareerWithSfx;


  useEffect(() => {
    setActiveGuideFocus(undefined);
  }, [assistantSequenceId]);

  /**
   * The end of a whole briefing, not of a page.
   *
   * The walk-on says every page's copy in one visit and reports back once, on
   * its way off screen, so this runs only what the old per-page advance did on
   * its last page. Completing per page here would finish the three-page opening
   * on its first bubble.
   */
  const completeAssistantGuideSequence = useCallback(() => {
    if (assistantSequenceId === null || assistantSequence === undefined) return;
    store.completeAssistantGuide(assistantSequenceId);
    if (assistantSequenceId === requestedAssistantSequenceId) {
      setConciergeFocus(assistantSequence.pages.at(-1)?.focus ?? null);
      setRequestedAssistantSequenceId(null);
    }
  }, [assistantSequence, assistantSequenceId, requestedAssistantSequenceId, store.completeAssistantGuide]);

  const openAssistantGuide = useCallback((
    sequenceId: AssistantGuideSequenceId,
    destination: AssistantGuideDestination,
  ) => {
    setActiveGuideFocus(undefined);
    setConciergeFocus(null);
    setRequestedAssistantSequenceId(sequenceId);
    const requestedMarketSection: MarketSectionId | undefined = destination === 'youth-intake'
      ? 'YOUTH'
      : destination === 'market-scouting'
        ? 'SCOUT'
        : destination === 'market-transfers'
          ? 'TRANSFERS'
          : destination === 'coach-market'
            ? 'COACHES'
            : undefined;
    if (requestedMarketSection !== undefined) {
      setMarketSectionRequest(current => ({
        section: requestedMarketSection,
        token: (current?.token ?? 0) + 1,
      }));
    }
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
  let lowConditionMatchdayStarter: ReturnType<typeof matchdayConditionWarningPlayer> = null;
  if (!fontsLoaded && !fontError && bootError === null) {
    screen = <LoadingScreen />;
  } else if (bootError !== null) {
    // A boot failure means the repository itself never opened, so
    // discardUnreadableSave (which needs a working repository) cannot run. Without
    // a database-level reset this branch was Retry-forever on a downgrade or a
    // corrupt file.
    screen = (
      <BootFailure
        message={bootError}
        onRetry={() => setBootAttempt(attempt => attempt + 1)}
        onStartFresh={() => {
          void resetCareerDatabase({
            openDatabase: () => openDatabaseAsync(DATABASE_NAME),
            deleteDatabaseFile: () => deleteDatabaseAsync(DATABASE_NAME),
          })
            .then(() => setBootAttempt(attempt => attempt + 1))
            // This is the last way out of an unopenable database. If the reset
            // itself fails there is nothing behind it, so say so — an unhandled
            // rejection here reads as a button that does nothing, forever.
            .catch(error => setBootError(
              `The save could not be deleted. ${error instanceof Error ? error.message : String(error)}`,
            ));
        }}
      />
    );
  } else if (!store.persistenceReady) {
    screen = <LoadingScreen />;
  } else if (store.persistenceLoadError !== null) {
    screen = (
      <BootFailure
        message={store.persistenceLoadError}
        onRetry={() => setBootAttempt(attempt => attempt + 1)}
        onStartFresh={() => { void store.discardUnreadableSave(); }}
        onRestoreBackup={store.backupSummary === null
          ? undefined
          : { season: store.backupSummary.season, week: store.backupSummary.week, onRestore: () => { void store.restoreBackupSave(); } }}
      />
    );
  } else if (store.screen === 'welcome' && landingView === 'title') {
    screen = (
      <TitleLandingScreen
        hasSavedCareer={store.hasSavedCareer}
        reduceMotion={reduceMotion}
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
        onCycleFormation={cycleFormationPreset}
        onToggleReduceMotion={toggleReduceMotion}
        onToggleHudSide={toggleHudSide}
        onToggleHaptics={toggleHaptics}
        onCycleTextScale={cycleTextScale}
        onToggleHighContrast={toggleHighContrast}
        onToggleColorSafeKits={toggleColorSafeKits}
        onToggleCutInMode={toggleCutInMode}
        accessibilityCopy={content.assistantGuide.m4Fiction.accessibility}
        difficultyLabel={store.career?.difficulty ?? (store.career ? 'COZY' : undefined)}
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
        initialDifficulty={store.career.difficulty ?? 'COZY'}
        onComplete={completeRookieCreation}
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
        cutInMode={preferences.cutInMode}
        seenPowerCutIns={preferences.seenPowerCutIns}
        onPowerCutInSeen={recordSeenPowerCutIn}
        highContrast={preferences.highContrast}
        colorSafeKits={preferences.colorSafeKits}
        pausedExternally={globalSettingsOpen}
        firstMatchTutorial={isFirstOnboardingFixture(
          store.career,
          store.watchedMatch.fixture.id,
        )}
        cupRoundLabel={store.watchedMatch.cupRoundLabel}
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
    if (!hasAssistantGuideMilestone(store.career, 'match-condition-warning-seen')) {
      lowConditionMatchdayStarter = matchdayConditionWarningPlayer(matchday.lineup);
    }
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
        textScale={preferences.textScale}
        onContinue={store.continueAfterMatch}
        onOpenSettings={() => setGlobalSettingsOpen(true)}
      />
    );
  } else if (store.screen === 'week-review' && store.weekReview !== null) {
    screen = (
      <WeeklyReviewScreen
        viewModel={store.weekReview}
        animationsReady
        reduceMotion={reduceMotion}
        textScale={preferences.textScale}
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
        reduceMotion={reduceMotion}
        guideCopy={store.career.eventFlags.includes('m4:event-guide-seen')
          ? undefined
          : content.assistantGuide.m4Fiction.events}
        textScale={preferences.textScale}
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
        onDismissGuidance={dismissVisibleTips}
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
        guideCopy={store.career.eventFlags.includes('m4:season-recap-guide-seen')
          ? undefined
          : content.assistantGuide.m4Fiction.seasonRecap}
        textScale={preferences.textScale}
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
          setMarketSectionRequest(null);
          setDrillFocusToken(null);
          store.setActiveTab(tab);
        }}
        onAdvanceWeek={handleAdvanceWeek}
        keyboardShortcutsEnabled={!guideOverlayVisible}
        onOpenLedger={() => store.setActiveTab('club')}
        onOpenSettings={() => setGlobalSettingsOpen(true)}
        advanceWeekLabel={store.saving ? 'Saving…' : 'Advance Week  ▸'}
        // `saveBlocked` already refuses the advance in the store; the button has
        // to say so too, or the only feedback for a paused season is a toast
        // repeating what the warning banner above it already says.
        advanceWeekDisabled={store.saving
          || store.saveBlocked
          || (assistantObjective !== null && assistantObjective.target !== 'advance-week')}
        guideFocus={activeGuideFocus === 'money' || activeGuideFocus === 'navigation'
          ? activeGuideFocus
          : undefined}
        // The helper sentence is the durable first-week flow. Only the
        // floating arrow retires after a general screen tap; losing the text
        // left a glowing control and a blocked Advance Week with no explanation.
        guideObjective={assistantObjective?.text}
        onGuideObjectivePress={assistantObjectiveTargetTab !== undefined
          && assistantObjectiveTargetTab !== store.activeTab
          ? () => store.setActiveTab(assistantObjectiveTargetTab)
          : undefined}
        guideTarget={hideCoachHiringCues ? undefined : visibleAssistantObjectiveTarget}
        onMoneyGuideAnchorChange={setMoneyGuideAnchor}
        onNavigationGuideAnchorChange={setNavigationGuideAnchor}
        onDismissGuidance={dismissVisibleTips}
      >
        {store.activeTab === 'squad' ? (
          <SquadTrainingScreen
            viewModel={squadTrainingVm!}
            selectedPlayerId={store.selectedPlayerId}
            onSelectPlayer={playerId => {
              store.selectPlayer(playerId);
              if (conciergeFocus === 'injury-lineup' || conciergeFocus === 'transfer-request') {
                setConciergeFocus(null);
              }
            }}
            onTrainDrill={(playerId, pathId) => store.trainPlayer(playerId, pathId)}
            onBuyDrillUpgrade={pathId => {
              const upgrade = squadTrainingVm!.drillUpgrades.find(row => row.pathId === pathId);
              requestConfirmation({
                title: `Buy ${upgrade?.label ?? 'drill'} Tier ${upgrade?.nextTier ?? ''}?`,
                detail: `Spend ${upgrade === undefined ? 'the shown cost' : formatCurrency(upgrade.cost ?? 0)} once. Every ${upgrade?.label ?? ''} drill from now on gives +${upgrade?.nextGain ?? 0} for ${upgrade?.nextTpCost ?? 0} TP.`,
                confirmLabel: 'Buy upgrade',
                onConfirm: () => store.purchaseTrainingUpgrade(pathId),
              });
            }}
            lastDrillResult={store.lastDrillResult}
            trainingPoints={store.career?.trainingPoints ?? 0}
            guideTraining={visibleAssistantObjectiveTarget === 'training-plan'}
            guideFocus={conciergeFocus ?? undefined}
            dismissTipsToken={tipDismissSequence}
            reduceMotion={reduceMotion}
            drillPickerRequestToken={drillFocusToken ?? undefined}
            saveWarning={store.saveWarning}
            conditionWarningSeen={store.career !== null
              && hasAssistantGuideMilestone(store.career, 'condition-warning-seen')}
            onConditionWarningShown={() => store.completeGuideMilestone('condition-warning-seen')}
            guideQuickTrain={store.career !== null
              && store.career.season === 1
              && store.career.week >= QUICK_TRAIN_LESSON_WEEK
              && !hasAssistantGuideMilestone(store.career, 'quick-train-seen')}
            onQuickTrainShown={() => store.completeGuideMilestone('quick-train-seen')}
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
            guideTrainingGround={visibleAssistantObjectiveTarget === 'training-ground-facility'}
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
            requestedSection={marketSectionRequest?.section}
            requestedSectionToken={marketSectionRequest?.token}
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
            textScale={preferences.textScale}
            onOpenFixture={store.openMatchday}
            onOpenAlert={alertId => {
              if (
                assistantObjective?.target === 'training-ground-alert'
                && alertId !== 'training-ground'
              ) return;
              const alert = home.alerts.find(candidate => candidate.id === alertId);
              if (alert?.guideSequenceId !== undefined && alert.destination !== undefined) {
                if (alertId.startsWith('injury-')) {
                  store.selectPlayer(alertId.slice('injury-'.length));
                } else if (alertId.startsWith('transfer-request-')) {
                  store.selectPlayer(alertId.slice('transfer-request-'.length));
                }
                openAssistantGuide(alert.guideSequenceId, alert.destination);
              }
              else if (alertId === DESK_STORY_ALERT_ID) store.openDeskStory();
              else if (alertId.startsWith('training-upgrade:')) store.setActiveTab('squad');
              else if (alertId === 'training-ground' || alertId === 'build-reminder') {
                store.setActiveTab('club');
              }
              else if (alertId.startsWith('injury-')) {
                store.selectPlayer(alertId.slice('injury-'.length));
                store.setActiveTab('squad');
              }
              else if (alertId.startsWith('transfer-request-')) {
                store.selectPlayer(alertId.slice('transfer-request-'.length));
                store.setActiveTab('squad');
              }
              else if (alertId.startsWith('training-cap:')) {
                if (alert?.playerId !== undefined) {
                  store.selectPlayer(alert.playerId);
                  setDrillFocusToken(current => (current ?? 0) + 1);
                }
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
            guideAlertId={visibleAssistantObjectiveTarget === 'training-ground-alert'
              ? 'training-ground'
              : conciergeFocus === 'retirement'
                ? home.alerts.find(alert => alert.id.startsWith('retirement-announcement-'))?.id
                : undefined}
            lockOtherAlerts={assistantObjective?.target === 'training-ground-alert'}
            // Only once he is off screen: while he is still talking the row is
            // under a dimmed pane anyway, and a third highlight would compete
            // with the spotlight he is standing in.
            glowGuidedAlert={!guideOverlayVisible}
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
        {/* Not a FeedbackNotice: that one is dismissible and auto-hides. An
            unsaved career must keep saying so until a save actually succeeds. */}
        {store.saveWarning !== null && (
          <SaveWarningBanner
            message={store.saveWarning}
            blocked={store.saveBlocked}
            onRetry={store.retrySave}
          />
        )}
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
          hapticsEnabled={preferences.hapticsEnabled}
          textScale={preferences.textScale}
          highContrast={preferences.highContrast}
          colorSafeKits={preferences.colorSafeKits}
          cutInMode={preferences.cutInMode}
          accessibilityCopy={content.assistantGuide.m4Fiction.accessibility}
          difficultyLabel={store.career?.onboarding?.stage === 'create-player'
            ? undefined
            : store.career?.difficulty ?? (store.career ? 'COZY' : undefined)}
          saveError={settingsSaveError}
          onVolumeChange={setVolume}
          onToggleReduceMotion={toggleReduceMotion}
          onToggleHudSide={toggleHudSide}
          onToggleHaptics={toggleHaptics}
          onCycleTextScale={cycleTextScale}
          onToggleHighContrast={toggleHighContrast}
          onToggleColorSafeKits={toggleColorSafeKits}
          onToggleCutInMode={toggleCutInMode}
          onGlossaryOpenChange={setGlobalGlossaryOpen}
          onOpenChange={open => {
            setGlobalSettingsOpen(open);
            if (!open) {
              setGlobalGlossaryOpen(false);
              setSettingsSaveError(null);
            }
          }}
        />
        {guideOverlayVisible && assistantSequenceId !== null ? (
          <BertBriefingWalkOn
            content={content.assistantGuide}
            sequenceId={assistantSequenceId}
            moneyAnchor={moneyGuideAnchor}
            navigationAnchor={navigationGuideAnchor}
            reduceMotion={reduceMotion}
            onFocusChange={setActiveGuideFocus}
            onDone={completeAssistantGuideSequence}
          />
        ) : null}
        {!guideOverlayVisible && lowConditionMatchdayStarter !== null ? (
          <MatchdayConditionWarning
            key={lowConditionMatchdayStarter.id}
            playerName={lowConditionMatchdayStarter.name}
            reduceMotion={reduceMotion}
            onDone={() => store.completeGuideMilestone('match-condition-warning-seen')}
          />
        ) : null}
        {coachOverlay !== null ? (
          <CoachStaffOverlay
            mode={coachOverlay.mode}
            coach={coachOverlay.coach}
            reduceMotion={reduceMotion}
            onConfirm={coachOverlay.mode === 'confirm-dismiss' ? confirmCoachDismissal : undefined}
            onClose={() => {
              const returnsHome = coachOverlay.mode !== 'confirm-dismiss';
              setCoachOverlay(null);
              if (returnsHome) useM1Store.getState().setActiveTab('home');
            }}
          />
        ) : null}
        {facilityProjectNotice !== null ? (
          <FacilityProjectNotice
            project={facilityProjectNotice}
            reduceMotion={reduceMotion}
            onClose={() => setFacilityProjectNotice(null)}
          />
        ) : null}
        {/* The rookie is the one signing the player has a relationship with, so
            they get the walk-on. A squad transfer stays a receipt — a character
            beat on every incoming player would wear out by the second window. */}
        {playerSigning !== null && playerSigning.source === 'rookie' ? (
          <PlayerWalkOnWelcome
            player={playerSigning}
            navigationAnchor={navigationGuideAnchor}
            reduceMotion={reduceMotion}
            onDone={() => setPlayerSigning(null)}
          />
        ) : null}
        {playerSigning !== null && playerSigning.source !== 'rookie' ? (
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
        <Text className="font-pixel text-lg uppercase tracking-widest text-signal">Opening club files…</Text>
      </View>
    </SafeAreaView>
  );
}

/**
 * Every button here uses a local `pressed` state with a plain-array `style`.
 * A function-form `style` on a Pressable renders zero-height and untappable on
 * iOS only — and this is the one screen where a dead button means a dead game.
 */
function BootFailureButton({
  label,
  accessibilityLabel,
  onPress,
  tone,
}: {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
  tone: 'primary' | 'paper';
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      className={tone === 'primary'
        ? 'mt-5 min-h-12 items-center justify-center border-2 border-b-4 border-ink bg-blue px-4'
        : 'mt-3 min-h-12 items-center justify-center border-2 border-b-4 border-stamp bg-paper px-4'}
      style={[{ transform: [{ translateY: pressed ? 2 : 0 }] }]}
    >
      <Text className={tone === 'primary'
        ? 'font-pixel text-sm uppercase text-paper'
        : 'font-pixel text-sm uppercase text-stamp'}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function BootFailure({
  message,
  onRetry,
  onStartFresh,
  onRestoreBackup,
}: {
  message: string;
  onRetry: () => void;
  onStartFresh?: () => void;
  onRestoreBackup?: { season: number; week: number; onRestore: () => void };
}) {
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  // Armed is a dangerous state to leave lying around: the save is one tap from
  // deletion, and the arming tap may have been a misfire. It expires on its own.
  useEffect(() => {
    if (!confirmingDiscard) return undefined;
    const timer = setTimeout(() => setConfirmingDiscard(false), 5_000);
    return () => clearTimeout(timer);
  }, [confirmingDiscard]);
  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-ink px-6">
      <View className="w-full border-2 border-stamp bg-paper p-5">
        <Text className="font-pixel text-lg uppercase text-stamp">We could not open your club</Text>
        <Text className="mt-3 text-sm leading-5 text-ink/70">Your saved career has not been changed. Try again.</Text>
        <Text className="mt-2 text-xs leading-4 text-ink/50">Technical detail: {message}</Text>
        <BootFailureButton
          tone="primary"
          label="Retry"
          accessibilityLabel="Retry opening club files"
          onPress={() => {
            setConfirmingDiscard(false);
            onRetry();
          }}
        />
        {onRestoreBackup !== undefined && (
          <BootFailureButton
            tone="paper"
            label={`Restore season ${onRestoreBackup.season} · week ${onRestoreBackup.week}`}
            accessibilityLabel={`Restore the backup saved at season ${onRestoreBackup.season}, week ${onRestoreBackup.week}`}
            onPress={onRestoreBackup.onRestore}
          />
        )}
        {onStartFresh !== undefined && (
          <BootFailureButton
            tone="paper"
            label={confirmingDiscard ? 'Tap again to delete' : 'Delete save · start fresh'}
            accessibilityLabel={confirmingDiscard
              ? 'Confirm: delete the saved career and start fresh'
              : 'Delete the saved career and start fresh'}
            onPress={() => (confirmingDiscard ? onStartFresh() : setConfirmingDiscard(true))}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

/**
 * Persistent, non-dismissible: a career that is not reaching disk must keep
 * saying so. `blocked` means week advancement is paused, so the retry is the
 * designed way out rather than an optional extra.
 */
function SaveWarningBanner({
  message,
  blocked,
  onRetry,
}: {
  message: string;
  blocked: boolean;
  onRetry: () => void;
}) {
  // top-0 sat the alert text under the notch/Dynamic Island; pad by the real
  // inset so the first line is always readable.
  const insets = useSafeAreaInsets();
  return (
    <View
      accessible
      accessibilityRole="alert"
      accessibilityLabel={`Save problem: ${message}`}
      className="absolute inset-x-0 top-0 border-b-4 border-stamp bg-red-light px-4 py-3"
      style={{ paddingTop: insets.top + 12 }}
    >
      <Text className="font-pixel text-sm uppercase text-stamp">Your club is not saving</Text>
      <Text className="mt-1 text-xs leading-4 text-ink/70">{message}</Text>
      {blocked && (
        <BootFailureButton
          tone="primary"
          label="Try saving again"
          accessibilityLabel="Try saving your career again"
          onPress={onRetry}
        />
      )}
    </View>
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
  useEffect(() => {
    if (tone === 'error') return undefined;
    const timer = setTimeout(onDismiss, 4_000);
    return () => clearTimeout(timer);
  }, [message, onDismiss, tone]);

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
      accessibilityLabel={feedbackNoticeAccessibilityLabel(message)}
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

function feedbackNoticeAccessibilityLabel(message: string): string {
  const trimmed = message.trim();
  const sentence = /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
  return `${sentence} Tap to dismiss.`;
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
      {/* edges=['bottom'] matches every sibling bottom sheet: pb-8 alone sat
          the Cancel/Confirm row on the home indicator (34pt inset). */}
      <SafeAreaView edges={['bottom']} className="flex-1 justify-end bg-ink/70 px-4 pb-8">
        <View
          accessibilityViewIsModal
          className="w-full max-w-[1180px] self-center border-2 border-b-4 border-ink bg-paper p-5"
        >
          <Text className="font-pixel text-sm uppercase text-stamp">Confirm club decision</Text>
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
                    : 'bg-blue'
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
      </SafeAreaView>
    </Modal>
  );
}
