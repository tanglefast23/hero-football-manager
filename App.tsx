import './global.css';
import { playerRequestViewModel } from './src/application/player-request-view-model';

import {
  Suspense,
  isValidElement,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  AppState,
  Linking,
  LogBox,
  Platform,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { deleteDatabaseAsync, openDatabaseAsync } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
// The one pixel family, for all seven languages: stock Silkscreen with 102
// Vietnamese letters appended. Built by `npm run build:fonts`; the original
// glyphs are byte-identical to stock, so the six Latin languages are unchanged.
const HFMSilkscreen_400Regular = require('./assets/fonts/HFMSilkscreen_400Regular.ttf');
const HFMSilkscreen_700Bold = require('./assets/fonts/HFMSilkscreen_700Bold.ttf');
import { vars } from 'nativewind';
import {
  useCopy,
  useLocale,
  ENABLED_LOCALES,
  LocaleProvider,
  copyFor,
  ensureCatalog,
  facesFor,
  deviceLocale,
  type CopyFn,
  type Locale,
} from './src/i18n';
import { LanguageOfferCard } from './src/ui/LanguageOfferCard';
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import {
  loadLaunchContent,
  type AssistantGuideDestination,
  type AssistantGuideFocus,
  type AssistantGuideSequenceId,
  type ManagerTipDestination,
} from './src/content';
import {
  createCareerRepository,
  createDeveloperSaveRepository,
  createPreferencesRepository,
  createReplayRepository,
  DEFAULT_APP_PREFERENCES,
  DEVELOPER_MANUAL_SAVE_SLOTS,
  isBrowserDatabaseLockError,
  migrateDatabase,
  reloadBrowserDocument,
  replaceFormationPreset,
  requestPersistentStorage,
  resetCareerDatabase,
  type AppPreferences,
  type DeveloperManualSaveSlot,
  type DeveloperSaveRepository,
  type DeveloperSaveSlot,
  type DeveloperSaveSummary,
  type PreferencesRepository,
} from './src/persistence';
import { LazyMatchScreen as MatchScreen } from './src/render/LazyMatchScreen';
import { isMatchPerformanceLimitActive } from './src/render/match-performance';
import { setMasterVolume } from './src/render/audio';
import {
  playAwakeningAscension,
  playAwakeningLimp,
  setAwakeningMasterVolume,
  stopAwakeningAscension,
  stopAwakeningLimp,
  teardownAwakeningAudio,
} from './src/render/awakening-audio';
import {
  setCelebrationMasterVolume,
  teardownCelebrationAudio,
} from './src/render/celebration-audio';
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
  prewarmManagementSfx,
  setManagementSfxMasterVolume,
  teardownManagementSfx,
} from './src/render/management-sfx';
import {
  setFinancialReportSfxMasterVolume,
  teardownFinancialReportSfx,
} from './src/render/financial-report-sfx';
import {
  setBertVoiceMasterVolume,
  teardownBertVoice,
} from './src/render/bert-voice';
import {
  setRivalHeroVoiceMasterVolume,
  teardownRivalHeroVoice,
} from './src/render/rival-hero-voice';
import { playManagementHaptic, setHapticsEnabled } from './src/render/haptics';
import { assertRuntimeGoldenReplay } from './src/sim/runtime-golden';
import type { MatchState } from './src/sim/types';
import {
  BertBriefingWalkOn,
  bertBriefingBackgroundProps,
} from './src/ui/BertBriefingWalkOn';
import {
  CoachStaffOverlay,
  type CoachOverlayCoach,
} from './src/ui/CoachStaffOverlay';
import {
  FacilityProjectNotice,
  type FacilityProjectNoticeModel,
} from './src/ui/FacilityProjectNotice';
import { ManagementShell } from './src/ui/ManagementShell';
import { MatchdayConditionWarning } from './src/ui/MatchdayConditionWarning';
import { matchdayConditionWarningPlayer } from './src/ui/matchday-condition';
import { PlayerRequestDecisionCard } from './src/ui/PlayerRequestDecisionCard';
import { PlayerRequestWalkOn } from './src/ui/PlayerRequestWalkOn';
import {
  MidseasonTrainingCaptainWalkOn,
  MidseasonTrainingDecisionCard,
} from './src/ui/MidseasonTrainingPrompt';
import {
  PlayerSaleFarewellWalkOn,
  type PlayerSaleFarewellModel,
} from './src/ui/PlayerSaleFarewellWalkOn';
import {
  PlayerSigningOverlay,
  type PlayerSigningConfirmation,
} from './src/ui/PlayerSigningOverlay';
import { PlayerWalkOnWelcome } from './src/ui/PlayerWalkOnWelcome';
import { PostMatchSummaryModal } from './src/ui/PostMatchSummaryModal';
import { TutorialSpotlight } from './src/ui/TutorialSpotlight';
import { TutorialTapCue } from './src/ui/TutorialTapCue';
import { advisorMilestonesToBank } from './src/ui/advisor-milestones';
import { shouldAskAssistantMode } from './src/ui/assistant-mode-choice';
import {
  ConfirmationSheet,
  confirmationBackgroundProps,
  type ConfirmationRequest,
} from './src/ui/components/ConfirmationSheet';
import { InfoTipLayer } from './src/ui/components/InfoTip';
import { ScreenTransition } from './src/ui/components/ScreenTransition';
import { formatCurrency } from './src/ui/components/Scorecard';
import {
  AwakeningCutsceneScreen,
  ChampionshipCelebrationScreen,
  EndgameCelebrationScreen,
  MatchDayBanner,
  MidseasonTrainingCelebrationScreen,
  QuickResultFaceOff,
  RivalHeroIntroScreen,
  StoryEventScreen,
} from './src/ui/DeferredSkiaSurfaces';
import type { GuidanceNudgeTarget } from './src/ui/GuidanceDoubleFlash';
import { forgetLeagueRowPositions } from './src/ui/league-table-motion';
import type { MarketSectionId } from './src/ui/market-models';
import type { ClubOfficeTab } from './src/ui/models';
import { shouldShowOpeningBrief } from './src/ui/opening-brief';
import { AssistantModeChoiceScreen } from './src/ui/screens/AssistantModeChoiceScreen';
import { AwardsCeremonyScreen } from './src/ui/screens/AwardsCeremonyScreen';
import { CharacterCreationScreen } from './src/ui/screens/CharacterCreationScreen';
import { ClubFinancesScreen } from './src/ui/screens/ClubFinancesScreen';
import { ClubHomeScreen } from './src/ui/screens/ClubHomeScreen';
import { ClubLegacyScreen } from './src/ui/screens/ClubLegacyScreen';
import { FixtureMatchDayScreen } from './src/ui/screens/FixtureMatchDayScreen';
import { LeagueTableScreen } from './src/ui/screens/LeagueTableScreen';
import { M2LeagueScreen } from './src/ui/screens/M2LeagueScreen';
import { MarketScreen } from './src/ui/screens/MarketScreen';
import { NewGameWelcomeScreen } from './src/ui/screens/NewGameWelcomeScreen';
import { PostMatchLedgerScreen } from './src/ui/screens/PostMatchLedgerScreen';
import { SeasonEndScreen } from './src/ui/screens/SeasonEndScreen';
import { SeasonPodiumScreen } from './src/ui/screens/SeasonPodiumScreen';
import { SquadTrainingScreen } from './src/ui/screens/SquadTrainingScreen';
import {
  TitleLandingScreen,
  TitleSettingsScreen,
} from './src/ui/screens/TitleLandingScreen';
import { WeeklyReviewScreen } from './src/ui/screens/WeeklyReviewScreen';
import {
  activeCareerMatchday,
  assistantTeaches,
  buildCareerMatchTeams,
  careerCoachUnlockedFormationIds,
  clubSquadStrength,
  cupMismatchWarning as pendingCupMismatchWarning,
  cupUpsetCopyKey,
  hasActiveCareerContractPromise,
  hasAssistantGuideSequenceCompleted,
  hasEverGainedFans,
  inheritedSquad,
  isFirstOnboardingFixture,
  isFullyCappedPlayer,
  isTransferWindowOpen,
  leagueStandings,
  midseasonTrainingStatus,
  shouldShowSquadSortHint,
  userClubName,
  hasAssistantGuideMilestone,
  type AssistantMode,
  staffedCoachingOfficeClosureConfirmation,
} from './src/game';
import type { DivisionLevel } from './src/game/pyramid';
import { SettingsOverlay } from './src/ui/SettingsOverlay';
import {
  tutorialCuePositionAbove,
  type TutorialAnchorLayout,
} from './src/ui/tutorial-cue-position';
import { guidedFirstFacilityAllowsPlacement } from './src/ui/concierge-targets';
import { facilityAdjacencyPresentation } from './src/ui/facility-adjacency';
import { assistantFiction } from './src/ui/assistant-fiction';
import { useReducedMotion } from './src/ui/use-reduced-motion';
import { useRivalPreload } from './src/ui/use-rival-preload';
import { useSuspendFlush } from './src/ui/use-suspend-flush';
import {
  developerModeAvailable as developerModeAvailableForSurface,
  qaRootRoutesEnabled,
} from './src/ui/release-surface';
import { supportEmailUrl, SUPPORT_EMAIL } from './src/release/support';
import { SfxPressable as Pressable } from './src/ui/components/SfxPressable';
import { copyOrEnglish } from './src/application/copy-fallback';
import { setStoreCopy, useM1Store } from './src/application/store';
import { ScreenErrorBoundary } from './src/ui/ScreenErrorBoundary';
import {
  currentAssistantObjective,
  outstandingInboxDuties,
  pendingAssistantGuideSequence,
  type OpeningInboxDutyId,
} from './src/application/assistant-guide';
import {
  loadPreferencesFailSoft,
  markPowerCutInSeen,
  rememberCompletedClimb,
} from './src/application/preferences';
import {
  DESK_STORY_ALERT_ID,
  awakeningCutsceneViewModel,
  boardFacilityConversionBriefing,
  boardFinanceBriefing,
  clubLegacyViewModel,
  clubFinancesViewModel,
  homeViewModel,
  leagueTableViewModel,
  matchDayViewModel,
  seasonEndViewModel,
  squadTrainingViewModel,
  storyEventViewModel,
} from './src/application/view-models';
import type { SquadTrainingViewModel } from './src/ui/models';
import { championshipCelebrationViewModel } from './src/application/championship-celebration';
import { seasonPodiumViewModel } from './src/application/season-podium';
import { endgameCelebrationViewModel } from './src/application/endgame-celebration';
import { hallOfFameViewModel } from './src/application/hall-of-fame';
import {
  awardCeremonyLookIds,
  careerAwardCeremonyViewModel,
} from './src/application/awards-ceremony';
import { m2LeagueViewModel } from './src/application/m2-league-view-model';
import { marketViewModel } from './src/application/market-view-model';
import { careerMarketViewModelSource } from './src/application/market-source-adapter';
import { rivalHeroIntroViewModel } from './src/application/rival-hero-intro';
import { midseasonTrainingViewModel } from './src/application/midseason-training';
import type { QaRootAppProps } from './src/ui/qa/QaRootApp';

const QaRootApp = lazy(async () => {
  if (Platform.OS === 'web') {
    const { LoadSkiaWeb } =
      await import('@shopify/react-native-skia/lib/module/web');
    await LoadSkiaWeb({ locateFile: (file) => `/${file}` });
  }
  const module = await import('./src/ui/SkiaSurfaceImplementations');
  return { default: module.QaRootApp };
});

function inboxDutyCopyStem(dutyId: OpeningInboxDutyId): string {
  if (dutyId === 'facility-placement') return 'inboxDuty.trainingPitch';
  if (dutyId === 'head-coach-market') return 'inboxDuty.headCoach';
  if (dutyId === 'youth-intake') return 'inboxDuty.youth';
  if (dutyId === 'assistant-coach-hire') return 'inboxDuty.assistantCoach';
  if (dutyId === 'national-cup') return 'inboxDuty.nationalCup';
  return 'inboxDuty.coachingOffice';
}

// The Debug build pings the packager port it was compiled with before falling
// back to the active one; the resulting warning toast is pure dev noise.
LogBox.ignoreLogs([/Packager status check returned unexpected result/]);

const DATABASE_NAME = 'hero-football-manager.db';
/**
 * Boot opens the database, migrates, and builds four repositories — seconds at
 * worst on a cold device. Far past that, the open has hung, and without a
 * deadline the player sits on the loading spinner forever with no way to reach
 * the BootFailure screen's Retry / Start Fresh options.
 */
const BOOT_TIMEOUT_MS = 15_000;

/**
 * True while nobody is looking at the app — a backgrounded native app or a hidden
 * browser tab. Both suspend the work a deadline is measuring, so both must be
 * able to postpone it rather than fail it.
 */
function appIsHidden(): boolean {
  if (Platform.OS === 'web') {
    return typeof document !== 'undefined' && document.hidden === true;
  }
  return AppState.currentState !== 'active';
}

type LandingView = 'title' | 'story' | 'settings' | 'assistant-mode';

/**
 * Week 6: late enough that the manager has trained the slow way a few times and
 * felt the friction, early enough to matter for the rest of season one.
 */
const QUICK_TRAIN_LESSON_WEEK = 6;

function requestedQaRoot(
  previewTriggerId: string | undefined,
): QaRootAppProps | null {
  if (!qaRootRoutesEnabled(__DEV__, Platform.OS)) return null;
  if (process.env.EXPO_PUBLIC_DEV_HARNESS === '1')
    return { kind: 'dev-harness' };
  if (process.env.EXPO_PUBLIC_POWER_MATCH_QA === '1')
    return { kind: 'power-match' };
  if (process.env.EXPO_PUBLIC_POWER_CUTIN_QA === '1')
    return { kind: 'power-cutin' };
  if (process.env.EXPO_PUBLIC_POWER_ART_QA === '1')
    return { kind: 'power-art' };
  if (process.env.EXPO_PUBLIC_AWAKENING_ART_QA === '1') {
    return {
      kind: 'awakening-art',
      triggerId: previewTriggerId ?? 'magic-sponge',
    };
  }
  if (process.env.EXPO_PUBLIC_AWARDS_CEREMONY_QA === '1') {
    return { kind: 'awards-ceremony' };
  }
  return previewTriggerId === undefined
    ? null
    : { kind: 'awakening-review', triggerId: previewTriggerId };
}

export default function App() {
  const [qaBypassed, setQaBypassed] = useState(false);
  const previewTriggerId = process.env.EXPO_PUBLIC_AWAKENING_PREVIEW_ID;
  // QA roots are available in development and static web review exports, where
  // __DEV__ is false. Native Release builds always continue to the real game,
  // even if a QA flag is accidentally present in the bundling environment.
  const qaRoot = requestedQaRoot(previewTriggerId);
  if (qaRoot !== null && !qaBypassed) {
    return (
      <SafeAreaProvider>
        <ScreenErrorBoundary onRecover={() => setQaBypassed(true)}>
          <Suspense fallback={<LoadingScreen />}>
            <QaRootApp {...qaRoot} />
          </Suspense>
        </ScreenErrorBoundary>
      </SafeAreaProvider>
    );
  }
  return (
    <SafeAreaProvider>
      <ScreenErrorBoundary
        onRecover={() =>
          useM1Store.setState({
            screen: 'welcome',
            error: null,
            activeTab: 'home',
            // Overlay state that survives the remount must not haunt the title
            // screen: a crash while Bert's desk reminder was up would otherwise
            // recover with his lecture floating over the landing view, and a stale
            // watched match holds live-match props no screen consumes.
            inboxDutyReminder: null,
            inboxDutyFocus: null,
            watchedMatch: null,
          })
        }
      >
        <GameApp />
      </ScreenErrorBoundary>
    </SafeAreaProvider>
  );
}

function GameApp() {
  const store = useM1Store();
  const developerModeAvailable = developerModeAvailableForSurface(
    __DEV__,
    Platform.OS,
  );
  const { width: viewportWidth, height: viewportHeight } =
    useWindowDimensions();
  const content = useMemo(loadLaunchContent, []);
  const [bootError, setBootError] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<AppPreferences>(
    DEFAULT_APP_PREFERENCES,
  );
  /**
   * The active language, read from state rather than through `useCopy()`.
   *
   * This component RENDERS the `LocaleProvider` at the bottom of its own return,
   * and React context only ever reaches descendants — a component never reads
   * the provider it returns. So `useCopy()` and `useLocale()` here resolved the
   * context DEFAULT, `'en'`, on every render and in every language.
   *
   * That is not a subtle degradation: `setStoreCopy(t)` fed the store an English
   * translator, and every view model built in this body — home, finances,
   * market, league, training, season end, Hall of Fame — rendered English in all
   * seven languages. It is exactly the bug this workstream set out to fix, and
   * no test could see it, because Jest cannot render components.
   *
   * `facesFor(preferences.language)` further down always read state directly and
   * was always correct. This is the same source; now it is the only one.
   *
   * `copyFor` also caches one pure function per locale. The memo keeps this
   * component's dependency explicit and avoids a lookup on unrelated renders.
   */
  const locale = preferences.language;
  const t = useMemo(() => copyFor(locale), [locale]);
  const [landingView, setLandingView] = useState<LandingView>('title');
  /**
   * The focus of the briefing beat Bert is currently speaking.
   *
   * The walk-on owns which line is showing, but the anchors it wants lit are
   * measured by screens far above it — measurement is gated on `guideFocus`.
   * So the live focus is reported back up here rather than derived from a page
   * index, which is what the framed window used before it stepped page by page.
   */
  const [activeGuideFocus, setActiveGuideFocus] = useState<
    AssistantGuideFocus | undefined
  >(undefined);
  // Where the League sub-tab Bert is pointing at sits, so his scrim can leave a
  // hole over it. Measured by the screen that draws it; owned here because the
  // briefing overlay is a sibling of that screen, not a child.
  const [leagueSubTabGuideAnchor, setLeagueSubTabGuideAnchor] =
    useState<TutorialAnchorLayout | null>(null);
  const [marketDealsGuideAnchor, setMarketDealsGuideAnchor] =
    useState<TutorialAnchorLayout | null>(null);
  const [requestedAssistantSequenceId, setRequestedAssistantSequenceId] =
    useState<AssistantGuideSequenceId | null>(null);
  const [conciergeFocus, setConciergeFocus] =
    useState<AssistantGuideFocus | null>(null);
  const [firstCupRoundOf32Spoken, setFirstCupRoundOf32Spoken] = useState(false);
  /**
   * Which board money row the manager has just opened, if any.
   *
   * Held here rather than on the career because the briefing is a reply to a
   * press: the rows themselves recur every week the money stays bad, and a
   * warning the manager could only ever read once would be worse than the
   * clipped desk row it replaces.
   */
  const [openedBoardFinanceAlertId, setOpenedBoardFinanceAlertId] = useState<
    string | null
  >(null);
  /** The first loan lesson already says the debt and repayment facts. */
  const [boardFinanceMessageStartIndex, setBoardFinanceMessageStartIndex] =
    useState(0);
  /**
   * Whether the season review has scrolled far enough to show the renewal queue.
   *
   * Screen state rather than career state: the milestone underneath it is what
   * makes the lesson once-per-career, and this only says the manager is looking
   * at the section right now. It resets on its own when the screen unmounts.
   */
  const [expiredContractReached, setExpiredContractReached] = useState(false);
  // Stable, so the screen's own scroll handler is not rebuilt on every render
  // of the review — and idempotent, because the section reports itself on both
  // a layout and a scroll.
  const markExpiredContractReached = useCallback(
    () => setExpiredContractReached(true),
    [],
  );
  // Re-arms the scroll gate on the way out. Without this, a review left before
  // Bert finished would bank nothing and the NEXT season's review would open
  // already flagged as reached — the lesson arriving over the league table,
  // which is the one thing the scroll gate exists to prevent.
  useEffect(() => {
    if (store.screen !== 'season-end') setExpiredContractReached(false);
  }, [store.screen]);
  const careerTeaches = store.career === null || assistantTeaches(store.career);
  const squadSortHintVisible =
    careerTeaches &&
    store.career !== null &&
    shouldShowSquadSortHint(store.career);
  const visibleConciergeFocus = careerTeaches ? conciergeFocus : null;
  // A screen-wide tap retires floating coach marks without completing the job
  // they describe. The objective remains authoritative; only its cue is hidden.
  const [dismissedAssistantObjectiveKey, setDismissedAssistantObjectiveKey] =
    useState<string | null>(null);
  const [guidanceNudgeToken, setGuidanceNudgeToken] = useState(0);
  const [incomeFacilitiesFlashToken, setIncomeFacilitiesFlashToken] =
    useState(0);
  const [tipDismissSequence, setTipDismissSequence] = useState(0);
  const [marketSectionRequest, setMarketSectionRequest] = useState<{
    section: MarketSectionId;
    token: number;
  } | null>(null);
  /**
   * The Club office board on show. Owned here rather than inside the screen
   * because three things outside it choose the board: the inbox's build job
   * opens Facility, the ledger warnings open Finances, and Bert's fans lesson
   * has to know Finances is showing before he walks out onto it.
   */
  const [clubOfficeTab, setClubOfficeTab] = useState<ClubOfficeTab>('facility');
  const [sponsorSummaryFocusToken, setSponsorSummaryFocusToken] = useState<
    number | undefined
  >();
  // Bumped when an inbox training-cap letter deep-links into the drill picker.
  const [drillFocusToken, setDrillFocusToken] = useState<number | null>(null);
  const [managerTipGuideRequest, setManagerTipGuideRequest] = useState<{
    target: ManagerTipDestination;
    token: number;
  } | null>(null);
  const visibleManagerTipGuideRequest = careerTeaches
    ? managerTipGuideRequest
    : null;
  // The navigation press creates the new cue; its own pointer-up must not also
  // count as the "next tap" that dismisses it.
  const skipNextGuidanceDismissRef = useRef(false);
  const [fontsLoaded, fontError] = useFonts({
    HFMSilkscreen_400Regular,
    HFMSilkscreen_700Bold,
  });
  const [globalSettingsOpen, setGlobalSettingsOpen] = useState(false);
  const [globalGlossaryOpen, setGlobalGlossaryOpen] = useState(false);
  const [globalPrivacySupportOpen, setGlobalPrivacySupportOpen] =
    useState(false);
  const [globalHallOfFameOpen, setGlobalHallOfFameOpen] = useState(false);
  const [settingsSaveError, setSettingsSaveError] = useState<string | null>(
    null,
  );
  const [moneyGuideAnchor, setMoneyGuideAnchor] =
    useState<TutorialAnchorLayout | null>(null);
  const [loanGuideAnchor, setLoanGuideAnchor] =
    useState<TutorialAnchorLayout | null>(null);
  const [facilityAdjacencyGuideAnchor, setFacilityAdjacencyGuideAnchor] =
    useState<TutorialAnchorLayout | null>(null);
  const [navigationGuideAnchor, setNavigationGuideAnchor] =
    useState<TutorialAnchorLayout | null>(null);
  const [coachOverlay, setCoachOverlay] = useState<{
    mode: 'hired' | 'confirm-dismiss' | 'dismissed';
    coach: CoachOverlayCoach;
  } | null>(null);
  const [facilityProjectNotice, setFacilityProjectNotice] =
    useState<FacilityProjectNoticeModel | null>(null);
  const [playerSigning, setPlayerSigning] =
    useState<PlayerSigningConfirmation | null>(null);
  const [playerSaleFarewell, setPlayerSaleFarewell] =
    useState<PlayerSaleFarewellModel | null>(null);
  const [awakeningBeat, setAwakeningBeat] = useState<1 | 2 | 3>(1);
  const [selectedLeagueDivision, setSelectedLeagueDivision] = useState<
    DivisionLevel | undefined
  >();
  const [selectedCupSeason, setSelectedCupSeason] = useState<
    number | undefined
  >();
  const [bootAttempt, setBootAttempt] = useState(0);
  const [pendingConfirmation, setPendingConfirmation] =
    useState<ConfirmationRequest | null>(null);
  const [midseasonTrainingStage, setMidseasonTrainingStage] = useState<
    'walk-on' | 'card' | null
  >(null);
  const [developerSaveSummaries, setDeveloperSaveSummaries] = useState<
    DeveloperSaveSummary[]
  >([]);
  const [developerManualSaveSelecting, setDeveloperManualSaveSelecting] =
    useState(false);
  const [developerSaveError, setDeveloperSaveError] = useState<string | null>(
    null,
  );
  const preferencesRepositoryRef = useRef<PreferencesRepository | null>(null);
  const developerSaveRepositoryRef = useRef<DeveloperSaveRepository | null>(
    null,
  );
  const developerSaveQueueRef = useRef<Promise<void>>(Promise.resolve());
  /** `seed:season:week` of the career position the autosave rotation is at. */
  const developerSavedPositionRef = useRef<string | null>(null);
  const preferencesSaveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const preferencesRef = useRef(preferences);
  preferencesRef.current = preferences;
  // `useCopy` returns a fresh closure every render, so the deps-free callbacks
  // below read the catalog through a ref. Taking `t` as a dependency would
  // rebuild every memoised handler on each render just to look a string up.
  const copyRef = useRef(t);
  copyRef.current = t;
  /**
   * The language the device asked for, held until the player answers.
   *
   * Not persisted: it is a question, and `languageOffered` records that the
   * question was asked. A crash before answering simply asks again, which is
   * the harmless direction to fail in.
   */
  const [languageOffer, setLanguageOffer] = useState<Locale | null>(null);
  // The store is a Zustand module with no React context, so it cannot read the
  // locale the way a component does — it takes the catalog by injection. This
  // is the one call site, and without it every `store.notify` and every guarded
  // refusal reads English no matter which language is selected.
  //
  // Assigned during render rather than in an effect: the store can emit a
  // notice from the very first action of a frame, and an effect would leave
  // that first message English.
  setStoreCopy(t);
  // Read inside savePreferences (a deps-free callback), so a ref rather than
  // the state value: it must see whether the sheet is open at failure time.
  const globalSettingsOpenRef = useRef(globalSettingsOpen);
  globalSettingsOpenRef.current = globalSettingsOpen;
  const languageRequestIdRef = useRef(0);
  const lastSeasonReviewCueRef = useRef<string | null>(null);
  const devVolume = preferences.masterVolume as DevVolume;
  const reduceMotion = useReducedMotion(preferences.reduceMotion);
  const performanceLimitActive = isMatchPerformanceLimitActive(
    preferences.performanceLimit,
  );

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
      .catch((error) => {
        const detail = error instanceof Error ? error.message : String(error);
        const failure = copyRef.current('app.settingsWereNotSaved', { detail });
        setSettingsSaveError(failure);
        // Preference writes also land outside the settings sheet — a cut-in
        // first view mid-match, the climb-completed stamp on a career change.
        // The inline error label only renders inside SettingsOverlay, so when
        // the sheet is closed surface the failure as a dismissible notice
        // instead of losing it silently.
        if (!globalSettingsOpenRef.current) {
          useM1Store.getState().notify(failure);
        }
      });
  }, []);

  useEffect(() => {
    if (
      preferences.performanceLimit !== null &&
      preferences.performanceLimit !== undefined &&
      !performanceLimitActive
    ) {
      savePreferences({
        ...preferencesRef.current,
        performanceLimit: null,
      });
    }
  }, [performanceLimitActive, preferences.performanceLimit, savePreferences]);

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
  const setVolume = useCallback(
    (masterVolume: DevVolume) => {
      savePreferences({ ...preferencesRef.current, masterVolume });
    },
    [savePreferences],
  );
  const activateLanguage = useCallback(
    (language: Locale, languageOffered?: true) => {
      const requestId = ++languageRequestIdRef.current;
      void ensureCatalog(language)
        .then(() => {
          if (requestId !== languageRequestIdRef.current) return;
          const current = preferencesRef.current;
          savePreferences({
            ...current,
            language,
            ...(languageOffered === true ? { languageOffered: true } : {}),
          });
          if (languageOffered === true) setLanguageOffer(null);
        })
        .catch((error) => {
          if (requestId !== languageRequestIdRef.current) return;
          const detail = error instanceof Error ? error.message : String(error);
          const failure = copyRef.current('app.settingsWereNotSaved', {
            detail,
          });
          setSettingsSaveError(failure);
          useM1Store.getState().notify(failure);
        });
    },
    [savePreferences],
  );
  const answerLanguageOffer = useCallback(
    (language: Locale) => {
      activateLanguage(language, true);
    },
    [activateLanguage],
  );
  const setLanguage = useCallback(
    (language: Locale) => {
      activateLanguage(language);
    },
    [activateLanguage],
  );
  // Settings has room for one row, not seven, so it steps through the shipped
  // languages rather than opening a second picker.
  const cycleLanguage = useCallback(() => {
    const current = preferencesRef.current;
    const at = ENABLED_LOCALES.indexOf(current.language);
    // A save can hold a language that is no longer enabled — `vi` is withdrawn
    // while its face is unresolved, and `isLocale`/the preferences schema both
    // still accept it, so such a save loads and renders. Without this branch
    // `indexOf` returns -1, `(-1 + 1) % n` is 0, and the tap silently lands on
    // whatever happens to be first. Stepping to the first enabled language is
    // the right outcome — there is nothing else to offer — but it should be a
    // decision, not arithmetic.
    //
    // It IS a one-way door: once stepped off, a withdrawn language cannot be
    // reached again from this control until it is re-enabled. Acceptable while
    // the game is in development; revisit before the save-compatibility promise
    // at TestFlight.
    const next =
      at === -1
        ? (ENABLED_LOCALES[0] ?? 'en')
        : (ENABLED_LOCALES[(at + 1) % ENABLED_LOCALES.length] ?? 'en');
    activateLanguage(next);
  }, [activateLanguage]);
  const toggleReduceMotion = useCallback(() => {
    const current = preferencesRef.current;
    savePreferences({ ...current, reduceMotion: !current.reduceMotion });
  }, [savePreferences]);
  const toggleHudSide = useCallback(() => {
    const current = preferencesRef.current;
    savePreferences({
      ...current,
      hudSide: current.hudSide === 'left' ? 'right' : 'left',
    });
  }, [savePreferences]);
  const toggleHaptics = useCallback(() => {
    const current = preferencesRef.current;
    savePreferences({ ...current, hapticsEnabled: !current.hapticsEnabled });
  }, [savePreferences]);
  const cycleTextScale = useCallback(() => {
    const current = preferencesRef.current;
    const textScale =
      current.textScale === 1 ? 1.15 : current.textScale === 1.15 ? 1.3 : 1;
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
    savePreferences({
      ...current,
      cutInMode: current.cutInMode === 'full' ? 'banner' : 'full',
    });
  }, [savePreferences]);
  const toggleDeveloperMode = useCallback(() => {
    if (!developerModeAvailable) return;
    const current = preferencesRef.current;
    const developerMode = !current.developerMode;
    if (!developerMode) setDeveloperManualSaveSelecting(false);
    savePreferences({ ...current, developerMode });
  }, [savePreferences]);
  const emailSupport = useCallback(() => {
    setSettingsSaveError(null);
    void Linking.openURL(supportEmailUrl()).catch(() => {
      setSettingsSaveError(
        copyRef.current('app.mailCouldNotOpen', { email: SUPPORT_EMAIL }),
      );
    });
  }, []);
  const saveAutoSubs = useCallback(
    (autoSubs: boolean) => {
      savePreferences({ ...preferencesRef.current, autoSubs });
    },
    [savePreferences],
  );
  const saveMatchPerformanceLimit = useCallback(
    (performanceLimit: AppPreferences['performanceLimit']) => {
      savePreferences({ ...preferencesRef.current, performanceLimit });
    },
    [savePreferences],
  );
  const retryThreeTimesSpeed = useCallback(() => {
    savePreferences({ ...preferencesRef.current, performanceLimit: null });
  }, [savePreferences]);
  const saveSquadSort = useCallback(
    (squadSort: AppPreferences['squadSort']) => {
      savePreferences({ ...preferencesRef.current, squadSort });
    },
    [savePreferences],
  );
  const cycleFormationPreset = useCallback(
    (slot: number) => {
      const market = useM1Store.getState().career?.market;
      savePreferences(
        replaceFormationPreset(
          preferencesRef.current,
          slot,
          market === undefined ? [] : careerCoachUnlockedFormationIds(market),
        ),
      );
    },
    [savePreferences],
  );
  const recordSeenPowerCutIn = useCallback(
    (power: AppPreferences['seenPowerCutIns'][number]) => {
      const current = preferencesRef.current;
      const next = markPowerCutInSeen(current, power);
      if (next === current) return;
      savePreferences(next);
    },
    [savePreferences],
  );

  const queueDeveloperSaveTask = useCallback((task: () => Promise<void>) => {
    developerSaveQueueRef.current = developerSaveQueueRef.current
      .then(task)
      .catch((error) => {
        const detail = error instanceof Error ? error.message : String(error);
        setDeveloperSaveError(
          copyRef.current('app.dev.saveFailed', { detail }),
        );
      });
  }, []);

  const advanceCareerWithSfx = useCallback(() => {
    // Zustand updates synchronously here. Only a real week change gets the
    // cue, so tutorial-blocked taps and event redirects stay silent.
    const careerBefore = useM1Store.getState().career;
    const before = careerBefore?.week;
    const boardResolutionBefore =
      careerBefore?.financialSafety?.latestBoardResolution?.id;
    useM1Store.getState().advanceCareer();
    const after = useM1Store.getState().career?.week;
    const boardResolutionAfter =
      useM1Store.getState().career?.financialSafety?.latestBoardResolution;
    // The developer autosave is NOT taken here. A match week leaves this
    // callback with the week unchanged — advanceCareer routes to the matchday
    // screen and the week turns over later, when the result settles — so a save
    // hung off this press skipped every week the club played in, which is most
    // of them. It watches the career's own week instead; see the effect below.
    if (before !== undefined && after !== undefined && after !== before) {
      playAdvanceWeekSfx();
    }
    if (
      boardResolutionAfter !== undefined &&
      boardResolutionAfter.id !== boardResolutionBefore
    ) {
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

  const showStartedFacilityProject = useCallback((showNotice = true) => {
    const career = useM1Store.getState().career;
    if (career === null) return;
    const activeProject = clubFinancesViewModel(career, copyRef.current)
      .facilities.activeProject;
    const building = career.facilities.grid?.buildings.find(
      (candidate) => candidate.id === activeProject?.buildingId,
    );
    if (activeProject === undefined || building === undefined) return;
    playFacilityStartSfx();
    playManagementHaptic('success');
    setConciergeFocus(null);
    // A new build already had its cost confirmation. Construction begins now;
    // do not stop it behind a second "Let them build" acknowledgement.
    if (!showNotice) return;
    setFacilityProjectNotice({
      type: building.type,
      name: activeProject.name,
      benefitLabel: activeProject.benefitLabel,
      kind: activeProject.kind,
      targetLevel: activeProject.targetLevel,
      weeks: activeProject.totalWeeks,
    });
  }, []);

  const performManagementAction = useCallback(
    (
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
    },
    [],
  );

  // No cue of its own: every control that opens a confirmation already played
  // one, and the two landing together read as a stutter.
  const requestConfirmation = useCallback(
    (confirmation: ConfirmationRequest) => {
      setPendingConfirmation(confirmation);
    },
    [],
  );

  const saveDeveloperManualSlot = useCallback(
    (slot: DeveloperManualSaveSlot) => {
      const repository = developerSaveRepositoryRef.current;
      const career = useM1Store.getState().career;
      setDeveloperManualSaveSelecting(false);
      if (
        !developerModeAvailable ||
        !preferencesRef.current.developerMode ||
        repository === null ||
        career === null
      )
        return;
      // Capture the object now, before the queued write starts: manual means this
      // exact moment, even if another ordinary save lands while SQLite is busy.
      const snapshot = career;
      queueDeveloperSaveTask(async () => {
        setDeveloperSaveSummaries(await repository.saveManual(slot, snapshot));
        setDeveloperSaveError(null);
        useM1Store
          .getState()
          .notify(copyRef.current('app.dev.savedToSlot', { slot }), 'success');
      });
    },
    [queueDeveloperSaveTask],
  );

  const loadDeveloperSlot = useCallback(
    (slot: DeveloperSaveSlot) => {
      const repository = developerSaveRepositoryRef.current;
      const careerSeed = useM1Store.getState().career?.careerSeed;
      if (
        !developerModeAvailable ||
        repository === null ||
        careerSeed === undefined
      )
        return;
      queueDeveloperSaveTask(async () => {
        const snapshot = await repository.load(slot, careerSeed);
        if (snapshot === null)
          throw new Error(`Developer save ${slot} is empty.`);
        useM1Store.getState().restoreDeveloperSave(snapshot, slot);
        // Arriving at a loaded week is not playing through one: claim the
        // position so the autosave watcher does not spend a slot on it.
        developerSavedPositionRef.current = `${snapshot.careerSeed}:${snapshot.season}:${snapshot.week}`;
        setDeveloperSaveError(null);
      });
    },
    [queueDeveloperSaveTask],
  );

  const pressDeveloperSaveSlot = useCallback(
    (slot: DeveloperSaveSlot) => {
      const manual = (
        DEVELOPER_MANUAL_SAVE_SLOTS as readonly string[]
      ).includes(slot);
      if (developerManualSaveSelecting) {
        if (manual) saveDeveloperManualSlot(slot as DeveloperManualSaveSlot);
        return;
      }
      const summary = developerSaveSummaries.find(
        (candidate) => candidate.slot === slot,
      );
      if (summary === undefined) return;
      requestConfirmation({
        title: copyRef.current('app.dev.loadSaveTitle', { slot }),
        detail: copyRef.current('app.dev.loadSaveDetail', {
          season: summary.season,
          week: summary.week,
        }),
        confirmLabel: copyRef.current('app.dev.loadSaveConfirm'),
        tone: 'danger',
        onConfirm: () => loadDeveloperSlot(slot),
      });
    },
    [
      developerManualSaveSelecting,
      developerSaveSummaries,
      loadDeveloperSlot,
      requestConfirmation,
      saveDeveloperManualSlot,
    ],
  );

  const buildTrainingGroundWithSfx = useCallback(() => {
    const before = useM1Store.getState().career?.facilities.grid?.construction;
    useM1Store.getState().buildFacility();
    const after = useM1Store.getState().career?.facilities.grid?.construction;
    if (after !== undefined && after !== before)
      showStartedFacilityProject(false);
  }, [showStartedFacilityProject]);

  const buildClubFacilityWithFeedback = useCallback(
    (type: FacilityProjectNoticeModel['type'], x: number, y: number) => {
      if (
        visibleConciergeFocus === 'facility-grid' &&
        !guidedFirstFacilityAllowsPlacement(type, x, y)
      )
        return;
      const before =
        useM1Store.getState().career?.facilities.grid?.construction;
      useM1Store.getState().buildClubFacility(type, { x, y });
      const after = useM1Store.getState().career?.facilities.grid?.construction;
      if (after !== undefined && after !== before) {
        setConciergeFocus(null);
        showStartedFacilityProject(false);
      }
    },
    [showStartedFacilityProject, visibleConciergeFocus],
  );

  const upgradeClubFacilityWithFeedback = useCallback(
    (buildingId: string) => {
      const before =
        useM1Store.getState().career?.facilities.grid?.construction;
      useM1Store.getState().upgradeClubFacility(buildingId);
      const after = useM1Store.getState().career?.facilities.grid?.construction;
      if (after !== undefined && after !== before) showStartedFacilityProject();
    },
    [showStartedFacilityProject],
  );

  const hireCoachWithFeedback = useCallback(
    (coachId: string, role: 'HEAD' | 'ASSISTANT' = 'HEAD') => {
      const careerBefore = useM1Store.getState().career;
      if (careerBefore === null || careerBefore.market === undefined) return;
      const candidate = marketViewModel(
        careerMarketViewModelSource(careerBefore, undefined, copyRef.current),
        copyRef.current,
      ).coaches.find((coach) => coach.id === coachId);
      if (candidate === undefined) return;
      useM1Store.getState().hireCoach(coachId, role);
      const marketAfter = useM1Store.getState().career?.market;
      const hired =
        role === 'HEAD' ? marketAfter?.headCoach : marketAfter?.assistantCoach;
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
          effectLabels:
            role === 'HEAD'
              ? candidate.headEffectLabels
              : candidate.assistantEffectLabels,
          weeklyWage: candidate.weeklyWage,
        },
      });
    },
    [],
  );

  const beginCoachDismissal = useCallback(
    (role: 'HEAD' | 'ASSISTANT' = 'HEAD') => {
      const career = useM1Store.getState().career;
      if (career === null) return;
      const staff = clubFinancesViewModel(
        career,
        copyRef.current,
      ).coachingStaff;
      const coach = staff.find((candidate) => candidate.role === role);
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
    },
    [],
  );

  const confirmCoachDismissal = useCallback(() => {
    if (coachOverlay?.mode !== 'confirm-dismiss') return;
    const dismissedCoach = coachOverlay.coach;
    useM1Store.getState().dismissCoach(dismissedCoach.role);
    const marketAfter = useM1Store.getState().career?.market;
    const roleStillFilled =
      dismissedCoach.role === 'HEAD'
        ? marketAfter?.headCoach !== undefined
        : marketAfter?.assistantCoach !== undefined;
    if (roleStillFilled) return;
    playCoachDepartureSfx();
    playManagementHaptic('warning');
    setCoachOverlay({ mode: 'dismissed', coach: dismissedCoach });
  }, [coachOverlay]);

  const submitTransferOfferWithFeedback = useCallback(
    (
      offer: Parameters<typeof store.submitTransferOffer>[0],
      pitchCard?: Parameters<typeof store.submitTransferOffer>[1],
    ) => {
      const before = useM1Store.getState().career;
      const targetId = before?.market?.transferTalks?.playerId;
      const target = before?.players.find((player) => player.id === targetId);
      useM1Store.getState().submitTransferOffer(offer, pitchCard);
      const stateAfter = useM1Store.getState();
      if (stateAfter.error !== null) {
        playManagementActionSfx('warning');
        playManagementHaptic('warning');
        return;
      }
      const after = useM1Store.getState().career;
      if (
        targetId !== undefined &&
        after?.players.some(
          (player) =>
            player.id === targetId && player.clubId === after.userClubId,
        )
      ) {
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
    },
    [],
  );

  const signYouthWithFeedback = useCallback((playerId: string) => {
    const careerBefore = useM1Store.getState().career;
    const offer =
      careerBefore?.market === undefined
        ? undefined
        : marketViewModel(
            careerMarketViewModelSource(
              careerBefore,
              undefined,
              copyRef.current,
            ),
            copyRef.current,
          ).youth?.offers.find((candidate) => candidate.playerId === playerId);
    useM1Store.getState().signYouth(playerId);
    const after = useM1Store.getState().career;
    if (
      offer === undefined ||
      after?.players.some(
        (player) =>
          player.id === playerId && player.clubId === after.userClubId,
      ) !== true
    )
      return;
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

  const completeRookieCreation = useCallback(
    (draft: Parameters<typeof store.completePlayerCreation>[0]) => {
      useM1Store.getState().completePlayerCreation(draft);
      const career = useM1Store.getState().career;
      const rookie = career?.players.find(
        (player) => player.createdAppearance !== undefined,
      );
      if (rookie === undefined) return;
      setPlayerSigning({
        playerId: rookie.id,
        playerName: rookie.name,
        role: rookie.role,
        lookId: rookie.lookId,
        source: 'rookie',
      });
    },
    [],
  );

  useEffect(() => {
    setMasterVolume(devVolume);
    setMenuMasterVolume(devVolume);
    setManagementSfxMasterVolume(devVolume);
    setFinancialReportSfxMasterVolume(devVolume);
    setBertVoiceMasterVolume(devVolume);
    setRivalHeroVoiceMasterVolume(devVolume);
    setAwakeningMasterVolume(devVolume);
    setCelebrationMasterVolume(devVolume);
  }, [devVolume]);

  useEffect(() => {
    setHapticsEnabled(preferences.hapticsEnabled);
  }, [preferences.hapticsEnabled]);

  useEffect(() => {
    if (
      Platform.OS === 'web' ||
      bootError !== null ||
      !store.persistenceReady ||
      store.persistenceLoadError !== null ||
      store.screen !== 'welcome' ||
      landingView !== 'title'
    )
      return undefined;

    let warmTimer: ReturnType<typeof setTimeout> | undefined;
    const titleFrame = requestAnimationFrame(() => {
      // Effects run after the title commit. Crossing its next frame and then
      // yielding once more keeps 33 player allocations out of the title paint.
      warmTimer = setTimeout(prewarmManagementSfx, 0);
    });

    return () => {
      cancelAnimationFrame(titleFrame);
      if (warmTimer !== undefined) clearTimeout(warmTimer);
    };
  }, [
    bootError,
    landingView,
    store.persistenceLoadError,
    store.persistenceReady,
    store.screen,
  ]);

  /**
   * The face-off is decoration, and decoration must never be able to strand a
   * settled match. `quickResult` only ever sets this screen in the same `set()`
   * that supplies the scene, so the pair below is unreachable by construction —
   * this is a self-heal for a state that should not exist, not a flow. It hands
   * straight on to the screen the result was going to open (`completeFaceOff`
   * falls back to the post-match ledger when even that was lost).
   */
  useEffect(() => {
    if (store.screen === 'faceoff' && store.faceOff === null)
      store.completeFaceOff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.screen, store.faceOff]);

  useEffect(() => {
    if (store.screen !== 'season-end' || store.career === null) return;
    const cueKey = `${store.career.careerSeed}:${store.career.season}:${store.career.phase}`;
    if (lastSeasonReviewCueRef.current === cueKey) return;
    lastSeasonReviewCueRef.current = cueKey;
    playManagementActionSfx('success');
    playManagementHaptic('success');
  }, [store.career, store.screen]);

  const menuTheme: MenuTheme =
    bootError === null &&
    store.persistenceReady &&
    store.persistenceLoadError === null
      ? menuThemeForScreen(store.screen, awakeningBeat)
      : null;

  useEffect(() => {
    setMenuTheme(menuTheme);
  }, [menuTheme]);

  useEffect(
    () => () => {
      teardownMenuAudio();
      teardownManagementSfx();
      teardownFinancialReportSfx();
      teardownBertVoice();
      teardownRivalHeroVoice();
      teardownAwakeningAudio();
      teardownCelebrationAudio();
    },
    [],
  );

  useEffect(() => {
    if (store.screen === 'awakening' && awakeningBeat === 1) {
      playAwakeningLimp();
      stopAwakeningAscension();
      return undefined;
    }
    if (store.screen === 'awakening' && awakeningBeat === 3) {
      stopAwakeningLimp();
      playAwakeningAscension();
      return () => stopAwakeningAscension();
    }
    if (store.screen !== 'awakening') stopAwakeningLimp();
    stopAwakeningAscension();
    return undefined;
  }, [awakeningBeat, store.screen]);

  const pendingAwakeningKey =
    store.career?.awakening.pending === undefined
      ? null
      : `${store.career.awakening.pending.fixtureId}:${store.career.awakening.pending.playerId}`;
  useEffect(() => {
    setAwakeningBeat(1);
  }, [pendingAwakeningKey]);

  useEffect(() => {
    let active = true;
    setBootError(null);
    // Expo's native runtime is Hermes. This gate executes the same full-payload
    // replay fingerprints as the Node test to catch engine drift — but it runs
    // two complete 2,000-tick matches synchronously (a goalless one and a
    // scoring one), so it is development-only. In a shipped build it would add
    // ~1s to cold start, and a runtime float shift would send every installed
    // copy to an error screen instead of their save. The assert returns what it
    // verified so logging it costs no extra match.
    if (__DEV__) {
      try {
        console.info(`HERMES_GOLDEN_OK ${assertRuntimeGoldenReplay()}`);
      } catch (error) {
        setBootError(error instanceof Error ? error.message : String(error));
        return () => {
          active = false;
        };
      }
    }
    // Deadline for the whole boot chain. Firing does not abort the native
    // work — nothing can — it just routes to BootFailure so the player gets
    // Retry / Start Fresh instead of an eternal spinner. Retry reuses the
    // cached native connection (expo-sqlite's default useNewConnection:false),
    // so a fired timeout never leaks connections.
    // A hidden app is not a stuck app: iOS suspends a backgrounded web app (and
    // throttles its timers) mid-boot, so a deadline that fired while the tablet
    // was elsewhere would greet the player with BootFailure over a healthy save.
    // Give it another full deadline once they are actually looking at it.
    let bootTimeout: ReturnType<typeof setTimeout>;
    const armBootTimeout = () => {
      bootTimeout = setTimeout(() => {
        if (!active) return;
        if (appIsHidden()) {
          armBootTimeout();
          return;
        }
        setBootError(copyRef.current('app.bootTimeout'));
      }, BOOT_TIMEOUT_MS);
    };
    armBootTimeout();
    // Ask the browser to keep the save before anything is written to it. Not
    // awaited: the answer changes nothing about how the game boots, it only makes
    // an eviction risk knowable instead of mysterious.
    void requestPersistentStorage();
    void openDatabaseAsync(DATABASE_NAME)
      .then(async (database) => {
        // Migrate once up front. Each repository migrates defensively on its
        // own, and three of those racing on a fresh database would all read the
        // pre-migration version and then each try to apply migration 5 — an
        // ALTER TABLE ADD COLUMN, which is not idempotent. With the schema
        // already current their internal calls read the version and do nothing,
        // so the three builds are free to overlap.
        await migrateDatabase(database);
        const [
          careerRepository,
          replayRepository,
          preferencesRepository,
          developerSaveRepository,
        ] = await Promise.all([
          createCareerRepository(database),
          createReplayRepository(database),
          createPreferencesRepository(database),
          developerModeAvailable
            ? createDeveloperSaveRepository(database)
            : Promise.resolve(null),
        ]);
        return {
          careerRepository,
          replayRepository,
          preferencesRepository,
          developerSaveRepository,
        };
      })
      .then(async (repositories) => ({
        ...repositories,
        ...(await loadPreferencesFailSoft(
          repositories.preferencesRepository,
          copyRef.current,
        )),
      }))
      .then(async (repositories) => {
        if (!active) return undefined;
        preferencesRepositoryRef.current = repositories.preferencesRepository;
        developerSaveRepositoryRef.current =
          repositories.developerSaveRepository;
        // Open in the device's language, once ever, before anything is drawn.
        //
        // Done here rather than in an effect so the very first frame is already
        // correct: an effect would paint English, then swap, and the swap is
        // more jarring than the language.
        //
        // Gated on BOTH flags. `languageOffered` stops a player who chose
        // English from being asked again every launch; `language === 'en'`
        // protects anyone who already picked something — an existing install
        // that deliberately chose German must not be re-routed by its phone.
        const stored = repositories.preferences;
        const autoLanguage =
          stored.languageOffered || stored.language !== 'en'
            ? undefined
            : deviceLocale();
        // English is deliberately in `AUTO_LOCALES` — it is what stops an
        // English-first bilingual phone from falling through to its second
        // language. But that also means `deviceLocale()` answers `'en'` for most
        // players, and switching English to English is a no-op. Left unfiltered
        // it showed nearly every fresh install a card announcing the game was
        // "now in English", offering two buttons that did the same thing.
        let detected = autoLanguage === 'en' ? undefined : autoLanguage;
        let nextPreferences =
          detected === undefined ? stored : { ...stored, language: detected };
        let languageWarning: string | undefined;
        try {
          await ensureCatalog(nextPreferences.language);
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          nextPreferences = { ...stored, language: 'en' };
          detected = undefined;
          languageWarning = copyRef.current('app.languageCouldNotLoad', {
            detail,
          });
        }
        if (!active) return undefined;
        preferencesRef.current = nextPreferences;
        setPreferences(nextPreferences);
        if (detected !== undefined) setLanguageOffer(detected);
        await store.initializePersistence(
          repositories.careerRepository,
          repositories.replayRepository,
        );
        if (active && repositories.warning !== undefined) {
          store.notify(repositories.warning);
        }
        if (active && languageWarning !== undefined) {
          store.notify(languageWarning);
        }
        // A boot that outlived its deadline but then finished is a success:
        // clear the timeout's failure message so the player lands in the game
        // instead of a stale BootFailure over a fully loaded save.
        if (active) setBootError(null);
        return undefined;
      })
      .catch((error) => {
        if (active)
          setBootError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => clearTimeout(bootTimeout));
    return () => {
      active = false;
      clearTimeout(bootTimeout);
    };
  }, [bootAttempt, store.initializePersistence]);

  useEffect(() => {
    if (!developerModeAvailable) return;
    const repository = developerSaveRepositoryRef.current;
    const careerSeed = store.career?.careerSeed;
    setDeveloperManualSaveSelecting(false);
    if (repository === null || careerSeed === undefined) {
      setDeveloperSaveSummaries([]);
      return;
    }
    let active = true;
    void repository
      .list(careerSeed)
      .then((summaries) => {
        if (!active) return;
        setDeveloperSaveSummaries(summaries);
        setDeveloperSaveError(null);
      })
      .catch((error) => {
        if (!active) return;
        const detail = error instanceof Error ? error.message : String(error);
        setDeveloperSaveSummaries([]);
        setDeveloperSaveError(
          copyRef.current('app.dev.savesCouldNotBeRead', { detail }),
        );
      });
    return () => {
      active = false;
    };
  }, [store.career?.careerSeed]);

  /**
   * One developer autosave per week the career actually turns over, wherever
   * that turn happens — the Advance Week press on a quiet week, the settled
   * result on a match week, the roll into a new season. Hanging it off the
   * Advance Week press missed every match week, which is why a season eleven
   * weeks deep had only filled three of the five rotating slots.
   *
   * The first position seen for a career is never written: that is a boot, a
   * loaded slot, or developer mode being switched on mid-career — the manager
   * is already there, so it is not a week they played through, and saving it
   * would spend a rotation slot on the slot they just loaded.
   */
  useEffect(() => {
    if (!developerModeAvailable) return;
    const career = store.career;
    const repository = developerSaveRepositoryRef.current;
    if (!preferences.developerMode || career === null || repository === null) {
      developerSavedPositionRef.current = null;
      return;
    }
    const position = `${career.careerSeed}:${career.season}:${career.week}`;
    if (developerSavedPositionRef.current === position) return;
    const first = developerSavedPositionRef.current === null;
    developerSavedPositionRef.current = position;
    if (first) return;
    queueDeveloperSaveTask(async () => {
      setDeveloperSaveSummaries(await repository.saveNextWeek(career));
      setDeveloperSaveError(null);
    });
  }, [store.career, preferences.developerMode, queueDeveloperSaveTask]);

  const finishWatchedMatch = useCallback(
    (result: MatchState) => {
      store.finishWatchedMatch(result);
    },
    [store.finishWatchedMatch],
  );

  const handleSetAssistantMode = useCallback(
    (assistantMode: AssistantMode) => {
      if (assistantMode === 'advisor') {
        setRequestedAssistantSequenceId(null);
        setConciergeFocus(null);
        setManagerTipGuideRequest(null);
        setActiveGuideFocus(undefined);
        setDismissedAssistantObjectiveKey(null);
        setMarketSectionRequest(null);
        setOpenedBoardFinanceAlertId(null);
        setBoardFinanceMessageStartIndex(0);
      }
      store.setAssistantMode(assistantMode);
    },
    [store.setAssistantMode],
  );

  const beginNewCareer = useCallback(
    (assistantMode?: AssistantMode) => {
      const begin = () => {
        setLandingView('title');
        // A new club inherits none of the old one's standings. Without this, the
        // first league table of a fresh career would slide rows against whatever
        // the previous career's table looked like — motion describing a match
        // this club never played.
        forgetLeagueRowPositions();
        store.startNewCareer(undefined, assistantMode);
      };
      if (!store.hasSavedCareer) {
        begin();
        return;
      }
      requestConfirmation({
        title: copyRef.current('app.replaceSavedCareerTitle'),
        detail: copyRef.current('app.replaceSavedCareerDetail'),
        confirmLabel: copyRef.current('app.replaceSavedCareerConfirm'),
        tone: 'danger',
        onConfirm: begin,
      });
    },
    [requestConfirmation, store.hasSavedCareer, store.startNewCareer],
  );

  const startNewCareer = useCallback(() => {
    if (shouldAskAssistantMode(preferencesRef.current.climbCompleted)) {
      setLandingView('assistant-mode');
      return;
    }
    beginNewCareer();
  }, [beginNewCareer]);

  useEffect(() => {
    const current = preferencesRef.current;
    const remembered = rememberCompletedClimb(current, store.career);
    if (remembered !== current) savePreferences(remembered);
  }, [savePreferences, store.career]);

  useEffect(() => {
    const career = store.career;
    if (career === null || careerTeaches) return;
    const lowConditionMatchday =
      store.screen === 'matchday' &&
      matchdayConditionWarningPlayer(
        matchDayViewModel(
          career,
          content,
          preferences.formationPresets[0],
          copyRef.current,
        ).lineup,
      ) !== null;
    const milestones = advisorMilestonesToBank(career, {
      enteredManagement: store.screen === 'management',
      viewingSquad:
        store.screen === 'management' && store.activeTab === 'squad',
      viewingHome: store.screen === 'management' && store.activeTab === 'home',
      viewingFinances:
        store.screen === 'management' &&
        store.activeTab === 'club' &&
        clubOfficeTab === 'finances',
      viewingShutMarket:
        store.screen === 'management' &&
        store.activeTab === 'market' &&
        (career.market?.scoutReports.length ?? 0) > 0 &&
        !isTransferWindowOpen(career.week),
      lowConditionMatchday,
      viewingExpiredContract:
        store.screen === 'season-end' && expiredContractReached,
    });
    for (const milestone of milestones) store.completeGuideMilestone(milestone);
  }, [
    careerTeaches,
    clubOfficeTab,
    content,
    expiredContractReached,
    preferences.formationPresets,
    store.activeTab,
    store.career,
    store.completeGuideMilestone,
    store.postMatch,
    store.screen,
  ]);

  // Reconciliation can replace the career object. Remember the reconciled
  // object so that replacement does not trigger an infinite startup loop.
  const reconciledAssistantInboxCareerRef = useRef(store.career);
  useEffect(() => {
    const career = store.career;
    if (
      career === null ||
      reconciledAssistantInboxCareerRef.current === career
    ) {
      return;
    }
    store.reconcileAssistantInbox();
    reconciledAssistantInboxCareerRef.current = useM1Store.getState().career;
  }, [store.career, store.reconcileAssistantInbox]);

  useEffect(() => {
    if (
      store.screen === 'legacy' &&
      careerTeaches &&
      store.career !== null &&
      requestedAssistantSequenceId === null &&
      !hasAssistantGuideSequenceCompleted(store.career, 'club-legacy')
    ) {
      setRequestedAssistantSequenceId('club-legacy');
      setConciergeFocus(null);
    }
  }, [careerTeaches, requestedAssistantSequenceId, store.career, store.screen]);

  const onboardingAssistantSequenceId =
    store.screen === 'management' && store.career !== null
      ? pendingAssistantGuideSequence(store.career, store.activeTab)
      : null;
  const assistantSequenceId = !careerTeaches
    ? null
    : (onboardingAssistantSequenceId ??
      (store.screen === 'management' || store.screen === 'legacy'
        ? requestedAssistantSequenceId
        : null));
  const assistantSequence =
    assistantSequenceId === null
      ? undefined
      : content.assistantGuide.sequences.find(
          (sequence) => sequence.id === assistantSequenceId,
        );
  /**
   * The board Bert is talking about, from the moment he starts talking.
   * `conciergeFocus` only lands when the whole briefing ends, so waiting for it
   * left him pointing at the Leaders tab while League was still the selected
   * one behind him. The briefing's own last page names the same focus.
   */
  const leagueGuideFocus =
    visibleConciergeFocus ?? assistantSequence?.pages.at(-1)?.focus;
  const leagueGuideSubTab =
    leagueGuideFocus === 'national-cup'
      ? ('cup' as const)
      : leagueGuideFocus === 'division-leaders'
        ? ('leaders' as const)
        : undefined;
  const savedCupGiantKilling =
    store.career?.pendingCupGiantKillingCelebrations?.[0];
  const rivalHeroIntro = useMemo(
    () =>
      store.screen === 'matchday' && store.career !== null
        ? rivalHeroIntroViewModel(store.career, content, t)
        : undefined,
    [store.screen, store.career, content, locale],
  );
  // The celebration is persisted whole, in the English the game ring wrote. Its
  // saved `divisionGap` names which of the four speeches it is, so the catalog
  // key is recovered from the save rather than stored beside it.
  const cupGiantKillingCelebration = useMemo(
    () =>
      savedCupGiantKilling === undefined
        ? undefined
        : {
            ...savedCupGiantKilling,
            title: copyOrEnglish(
              t,
              cupUpsetCopyKey(savedCupGiantKilling.divisionGap, 'title'),
              savedCupGiantKilling.title,
            ),
            body: copyOrEnglish(
              t,
              cupUpsetCopyKey(savedCupGiantKilling.divisionGap, 'body'),
              savedCupGiantKilling.body,
            ),
          },
    [savedCupGiantKilling, locale],
  );
  // Built in the pure game ring, which cannot know the language: every line
  // arrives with its catalog key and raw params beside the English, and they are
  // resolved here. Memoised because `BertBriefingWalkOn` keys his beats — and
  // the voice tick that plays them — on this object's identity.
  const cupMismatchWarning = useMemo(() => {
    const warning =
      rivalHeroIntro === undefined &&
      store.screen === 'matchday' &&
      store.career !== null
        ? pendingCupMismatchWarning(store.career)
        : undefined;
    return warning === undefined
      ? undefined
      : {
          ...warning,
          title: copyOrEnglish(t, warning.titleKey, warning.title),
          body: warning.bodyLines.map((line) =>
            copyOrEnglish(t, line.textKey, line.text, line.textParams),
          ),
        };
  }, [rivalHeroIntro, store.screen, store.career, locale]);
  const facilityComboReveal =
    !careerTeaches || store.screen !== 'management' || store.career === null
      ? undefined
      : store.career.facilities.grid?.discoveredAdjacencies
          .map((id) => facilityAdjacencyPresentation(id, t))
          .find(
            (presentation) =>
              presentation !== undefined &&
              !hasAssistantGuideMilestone(
                store.career!,
                presentation.milestone,
              ),
          );
  const facilityComboRevealVisible =
    facilityComboReveal !== undefined &&
    store.activeTab === 'club' &&
    clubOfficeTab === 'facility';
  useEffect(() => {
    if (facilityComboReveal === undefined) return;
    setClubOfficeTab('facility');
    if (store.activeTab !== 'club') store.setActiveTab('club');
  }, [facilityComboReveal?.id, store.activeTab, store.setActiveTab]);
  /**
   * Bert's one consolation for going out of the Cup.
   *
   * Read off the report rather than queued by the career ring: a knockout
   * defeat is the exit, the report already knows it is one, and hanging it
   * here keeps the save shape alone. He appears on the full-time screen
   * because that is where the manager is standing when the run ends — held
   * back to the office, the sympathy would arrive after they had already
   * clicked past the defeat and started on next week.
   */
  const cupExitConsolationVisible =
    store.screen === 'postmatch' &&
    store.postMatch?.result.cupExit === true &&
    store.career !== null &&
    !hasAssistantGuideMilestone(store.career, 'first-cup-exit-seen');
  /**
   * Bert's one lesson on the crowd, in two beats on two screens.
   *
   * The congratulations belong on the desk, because that is where the manager
   * lands after the week that won the fans. The ledger tour belongs on the
   * ledger. Each beat is gated on its own milestone rather than one shared
   * flag, so a career closed between them opens on the half it still owes
   * instead of losing the second half or repeating the first.
   */
  const fansLessonVisible =
    careerTeaches &&
    store.screen === 'management' &&
    store.activeTab === 'home' &&
    store.career !== null &&
    hasEverGainedFans(store.career) &&
    !hasAssistantGuideMilestone(store.career, 'first-fans-seen');
  const fansLedgerTourVisible =
    careerTeaches &&
    store.screen === 'management' &&
    store.activeTab === 'club' &&
    clubOfficeTab === 'finances' &&
    store.career !== null &&
    hasAssistantGuideMilestone(store.career, 'first-fans-seen') &&
    !hasAssistantGuideMilestone(store.career, 'first-fans-ledger-seen');
  /**
   * The renewal queue, explained the first time a season review reaches one.
   *
   * Gated on the section being on screen rather than on the review opening: it
   * is the last block on a long page, under the settlement, the recap, the
   * promotion rewards and the full league table. Raised on arrival he would be
   * talking about a card several screens below the fold.
   *
   * `expiredContract` is checked as well as the scroll flag because the queue
   * empties as the manager works through it — renewing the last player must not
   * leave Bert mid-lesson about a card that is no longer there.
   */
  const expiredContractLessonVisible =
    careerTeaches &&
    store.screen === 'season-end' &&
    expiredContractReached &&
    store.career !== null &&
    !hasAssistantGuideMilestone(store.career, 'expired-contract-seen');
  /**
   * Why a scouted player is still not signable.
   *
   * The scouting report reads like a purchase order — it is the only thing that
   * puts a player on the Deals tab — so holding one while the desk says SHUT
   * looks like the report failed rather than like the calendar. He explains the
   * two windows once, on the screen that is refusing.
   *
   * Declared below the Cup beats on purpose: those are mode-independent, and
   * two tests read the slice between them to prove no `careerTeaches` gate has
   * crept in there.
   */
  const transferWindowLessonVisible =
    careerTeaches &&
    store.screen === 'management' &&
    store.activeTab === 'market' &&
    store.career !== null &&
    (store.career.market?.scoutReports.length ?? 0) > 0 &&
    // Finish the report lesson's action first. Otherwise this second lesson
    // lays its scrim over the lit Deals tab before the manager can press it.
    visibleConciergeFocus !== 'scout-report' &&
    !isTransferWindowOpen(store.career.week) &&
    !hasAssistantGuideMilestone(store.career, 'transfer-window-seen');
  /**
   * The signing that is walking onto the screen, if one is.
   *
   * The rookie and the academy graduates are players the manager picked one at
   * a time, so they walk on and say their piece. A transfer stays a receipt — a
   * character beat on every incoming player would wear out by the second
   * window. Narrowed once here because three places need it: the two overlays,
   * and Bert, who must not talk over them.
   */
  const signingWalkOn =
    playerSigning !== null && playerSigning.source !== 'transfer'
      ? playerSigning
      : null;
  /**
   * The board's money message in full, for the row the manager just opened.
   *
   * Rebuilt from the live career on every render rather than captured at the
   * press: the row that opened it quotes numbers, and reading a stale copy of
   * them would be the same defect as the clipped desk row in a new place.
   */
  const boardFinanceMessage =
    !careerTeaches ||
    openedBoardFinanceAlertId === null ||
    store.career === null
      ? undefined
      : boardFinanceBriefing(store.career, openedBoardFinanceAlertId, t);
  const displayedBoardFinanceMessage =
    boardFinanceMessage === undefined
      ? undefined
      : {
          ...boardFinanceMessage,
          body: boardFinanceMessage.body.slice(boardFinanceMessageStartIndex),
        };
  const boardConversionBriefing =
    store.career === null
      ? undefined
      : boardFacilityConversionBriefing(store.career, t);
  const facilityErrorBertVisible =
    careerTeaches &&
    store.screen === 'management' &&
    store.activeTab === 'club' &&
    clubOfficeTab === 'facility' &&
    store.error !== null;
  const bertNotice =
    store.notice?.speaker === 'bert' ? store.notice : undefined;
  /**
   * Whether the Financial Report modal is up. Named once because two places
   * need it: the modal itself, and everything that must not start behind it.
   */
  const postMatchSummaryVisible =
    store.screen === 'management' &&
    store.postMatch !== null &&
    store.postMatchOverlay === 'summary';
  const firstCupRoundOf32GuideOwed =
    careerTeaches &&
    store.screen === 'management' &&
    store.career !== null &&
    store.career.eventFlags.includes('milestone:first-cup-win') &&
    !hasAssistantGuideMilestone(store.career, 'first-cup-round-of-32-seen');
  useEffect(() => {
    if (
      !firstCupRoundOf32GuideOwed ||
      postMatchSummaryVisible ||
      firstCupRoundOf32Spoken ||
      requestedAssistantSequenceId !== null ||
      store.activeTab === 'league'
    ) {
      return;
    }
    setConciergeFocus(null);
    store.setActiveTab('league');
  }, [
    firstCupRoundOf32GuideOwed,
    firstCupRoundOf32Spoken,
    postMatchSummaryVisible,
    requestedAssistantSequenceId,
    store.activeTab,
    store.setActiveTab,
  ]);
  const firstCupRoundOf32BriefingVisible =
    firstCupRoundOf32GuideOwed &&
    !postMatchSummaryVisible &&
    !firstCupRoundOf32Spoken &&
    requestedAssistantSequenceId === null &&
    store.activeTab === 'league';
  const firstCupRoundOf32HelperVisible =
    firstCupRoundOf32GuideOwed &&
    firstCupRoundOf32Spoken &&
    visibleConciergeFocus === 'national-cup';
  useEffect(() => {
    if (
      !firstCupRoundOf32GuideOwed ||
      !firstCupRoundOf32Spoken ||
      conciergeFocus !== null
    ) {
      return;
    }
    store.completeGuideMilestone('first-cup-round-of-32-seen');
    setFirstCupRoundOf32Spoken(false);
  }, [
    conciergeFocus,
    firstCupRoundOf32GuideOwed,
    firstCupRoundOf32Spoken,
    store.completeGuideMilestone,
  ]);
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
  const guideOverlayVisible =
    (assistantSequenceId !== null ||
      cupMismatchWarning !== undefined ||
      cupGiantKillingCelebration !== undefined ||
      cupExitConsolationVisible ||
      firstCupRoundOf32BriefingVisible ||
      facilityErrorBertVisible ||
      facilityComboRevealVisible ||
      transferWindowLessonVisible ||
      fansLessonVisible ||
      fansLedgerTourVisible ||
      expiredContractLessonVisible ||
      boardFinanceMessage !== undefined ||
      bertNotice !== undefined) &&
    signingWalkOn === null &&
    playerSaleFarewell === null &&
    midseasonTrainingStage === null &&
    rivalHeroIntro === undefined &&
    // The Financial Report owns the screen while it is up. Bert used to walk on
    // and start talking underneath it, so a lesson the manager was meant to
    // read played out dimmed behind the modal and was over by the time they
    // tapped Continue. Every briefing waits for the report to be dismissed.
    !postMatchSummaryVisible;
  const bertBriefingVisible =
    guideOverlayVisible || store.inboxDutyReminder !== null;
  const scoutDealsGuideVisible =
    assistantSequenceId === null &&
    visibleConciergeFocus === 'scout-report' &&
    store.screen === 'management' &&
    store.activeTab === 'market' &&
    marketDealsGuideAnchor !== null;
  const assistantObjective =
    store.career === null
      ? null
      : currentAssistantObjective(store.career, store.activeTab);
  const outstandingDuties =
    store.career === null ? [] : outstandingInboxDuties(store.career);
  // Read against the live duty list: a focused job the club has since finished
  // — or can no longer pay for, place or fit this week — is over, and must stop
  // greying out Advance Week and holding the strip open on a job nobody owes.
  const focusedInboxDutyId =
    store.inboxDutyFocus?.mode === 'focused' &&
    outstandingDuties.includes(store.inboxDutyFocus.dutyId)
      ? store.inboxDutyFocus.dutyId
      : undefined;
  const focusedInboxDutyObjective =
    focusedInboxDutyId === undefined
      ? undefined
      : t(`${inboxDutyCopyStem(focusedInboxDutyId)}.objective`);
  const blockingInboxDuty = focusedInboxDutyId ?? outstandingDuties[0];
  const assistantBlocksAdvance =
    assistantObjective !== null && assistantObjective.target !== 'advance-week';
  const advanceWeekGuidanceBlocked =
    assistantBlocksAdvance || blockingInboxDuty !== undefined;
  const dutyNudgeTarget: GuidanceNudgeTarget | undefined =
    blockingInboxDuty === 'facility-placement'
      ? 'training-ground-facility'
      : blockingInboxDuty === 'head-coach-market' ||
          blockingInboxDuty === 'coaching-office' ||
          blockingInboxDuty === 'youth-intake'
        ? blockingInboxDuty
        : undefined;
  const guidanceNudgeTarget: GuidanceNudgeTarget | undefined =
    dutyNudgeTarget ??
    (assistantBlocksAdvance ? assistantObjective.target : undefined);
  const blockingDutyObjective =
    blockingInboxDuty === undefined
      ? undefined
      : t(`${inboxDutyCopyStem(blockingInboxDuty)}.objective`);
  // Keep the strip sentence aligned with the thing a blocked press will flash.
  // A required inbox duty owns both the sentence and the control flash. The
  // assistant objective is used only when no mapped duty is blocking the week.
  const displayedGuideObjective =
    dutyNudgeTarget !== undefined
      ? blockingDutyObjective
      : (assistantObjective?.text ?? blockingDutyObjective);
  const requiredFacilityBuildType = outstandingDuties.includes(
    'coaching-office',
  )
    ? ('coaching-office' as const)
    : undefined;
  const assistantObjectiveKey =
    assistantObjective === null
      ? null
      : `${assistantObjective.target}:${assistantObjective.text}`;
  const previousAssistantObjectiveKeyRef = useRef(assistantObjectiveKey);
  useEffect(() => {
    if (previousAssistantObjectiveKeyRef.current === assistantObjectiveKey)
      return;
    previousAssistantObjectiveKeyRef.current = assistantObjectiveKey;
    setDismissedAssistantObjectiveKey(null);
  }, [assistantObjectiveKey]);
  /**
   * The opening's build job is on the Facility board. The inbox already opens
   * that board, but the manager can reach the Club office from the nav rail
   * too, and the objective would then be pointing at a page that is not up.
   */
  useEffect(() => {
    if (assistantObjective?.target === 'training-ground-facility')
      setClubOfficeTab('facility');
  }, [assistantObjective?.target]);
  /**
   * Same argument, one ring out, for the blue desk jobs.
   *
   * A tab press the duty guard redirects lands on the job's tab, but a tab is
   * not a page: the Club office opens on whichever board was last up, and
   * landing on the ledger while Bert asks for a build is the wrong page the
   * guard exists to prevent. Market needs no twin of this — a locked section
   * already pulls that screen to the job on its own.
   */
  useEffect(() => {
    if (
      focusedInboxDutyId === 'facility-placement' ||
      focusedInboxDutyId === 'coaching-office'
    ) {
      setClubOfficeTab('facility');
    }
  }, [focusedInboxDutyId]);
  const visibleAssistantObjectiveTarget =
    assistantObjectiveKey !== null &&
    assistantObjectiveKey === dismissedAssistantObjectiveKey
      ? undefined
      : assistantObjective?.target;
  const assistantObjectiveTargetTab =
    assistantObjective?.target === 'home-tab'
      ? 'home'
      : assistantObjective?.target === 'squad-tab'
        ? 'squad'
        : undefined;
  const openManagerTipDestination = useCallback(
    (target: ManagerTipDestination) => {
      skipNextGuidanceDismissRef.current = true;
      // A pointer activation bubbles into the shell's tap-to-dismiss handler in
      // this frame. Keyboard activation does not, so release the one-shot guard
      // on the next frame rather than swallowing the user's first later tap.
      requestAnimationFrame(() => {
        skipNextGuidanceDismissRef.current = false;
      });
      setManagerTipGuideRequest((current) => ({
        target,
        token: (current?.token ?? 0) + 1,
      }));
      store.setActiveTab('squad');
    },
    [store.setActiveTab],
  );
  const dismissVisibleTips = useCallback(() => {
    // The match-day card does not eat the press. Let the control under it finish,
    // then remove the card with the same delayed shell-tap path as helper cues.
    if (store.matchDayBanner !== null) store.dismissMatchDayBanner();
    if (skipNextGuidanceDismissRef.current) {
      skipNextGuidanceDismissRef.current = false;
      return;
    }
    setConciergeFocus(null);
    setManagerTipGuideRequest(null);
    if (store.activeTab === 'squad' && squadSortHintVisible) {
      store.completeGuideMilestone('squad-sort-seen');
    }
    if (assistantObjectiveKey !== null) {
      setDismissedAssistantObjectiveKey(assistantObjectiveKey);
    }
    setTipDismissSequence((sequence) => sequence + 1);
  }, [
    assistantObjectiveKey,
    squadSortHintVisible,
    store.activeTab,
    store.completeGuideMilestone,
    store.dismissMatchDayBanner,
    store.matchDayBanner,
  ]);
  const hideCoachHiringCues =
    store.activeTab === 'market' &&
    (focusedInboxDutyId === 'head-coach-market' ||
      focusedInboxDutyId === 'assistant-coach-hire' ||
      visibleConciergeFocus === 'coach-market' ||
      visibleConciergeFocus === 'coach-hire' ||
      visibleConciergeFocus === 'assistant-coach-hire');

  // Memoized so unrelated re-renders of the squad tab (scroll cues, selection
  // changes) don't redo conditioning, growth-modifier, and facility effects
  // across the whole roster.
  const squadTrainingVm = useMemo(
    () =>
      store.career === null
        ? null
        : squadTrainingViewModel(
            store.career,
            content,
            store.selectedPlayerId,
            t,
          ),
    // `locale`, not `t`: `useCopy` hands back a fresh closure every render, so
    // depending on it would redo the whole roster pass on each one.
    [store.career, content, store.selectedPlayerId, locale],
  );

  const playerRequestVm = useMemo(
    () =>
      store.career === null
        ? undefined
        : playerRequestViewModel(store.career, t),
    [store.career, locale],
  );
  const [requestStage, setRequestStage] = useState<'walk-on' | 'card' | null>(
    null,
  );
  // A resolved or cancelled request must take its overlay with it. Without this
  // a granted card would keep rendering against a pending that no longer exists
  // — and after a save reload, against one the manager never opened.
  useEffect(() => {
    if (playerRequestVm?.pending === undefined) setRequestStage(null);
  }, [playerRequestVm?.pending?.requestId, playerRequestVm?.pending]);

  const midseasonTrainingVm = useMemo(
    () =>
      store.career === null
        ? undefined
        : midseasonTrainingViewModel(store.career, t),
    [store.career, locale],
  );
  const midseasonStatus =
    store.career === null ? undefined : midseasonTrainingStatus(store.career);
  useEffect(() => {
    if (midseasonStatus !== 'prompt') {
      setMidseasonTrainingStage(null);
      return;
    }
    if (
      midseasonTrainingStage !== null ||
      store.screen !== 'management' ||
      store.activeTab !== 'home' ||
      store.matchDayBanner !== null ||
      guideOverlayVisible ||
      store.inboxDutyReminder !== null ||
      postMatchSummaryVisible ||
      playerSigning !== null ||
      playerSaleFarewell !== null ||
      requestStage !== null ||
      coachOverlay !== null ||
      facilityProjectNotice !== null ||
      pendingConfirmation !== null ||
      globalSettingsOpen ||
      languageOffer !== null
    ) {
      return;
    }
    setMidseasonTrainingStage('walk-on');
  }, [
    coachOverlay,
    facilityProjectNotice,
    globalSettingsOpen,
    guideOverlayVisible,
    languageOffer,
    midseasonStatus,
    midseasonTrainingStage,
    pendingConfirmation,
    playerSaleFarewell,
    playerSigning,
    postMatchSummaryVisible,
    requestStage,
    store.activeTab,
    store.inboxDutyReminder,
    store.matchDayBanner,
    store.screen,
  ]);

  // Rival squads are settled the moment the week advances, so the preload can
  // start while the player is still on the home screen rather than waiting for
  // the team sheet — a player who taps straight through would otherwise pay the
  // whole freeze anyway. Keyed by the matchday itself: every lineup edit
  // replaces the career object, and keying on that restarted the work.
  const matchdayPreloadKey =
    store.career !== null && store.career.phase === 'matchday'
      ? `${store.career.season}:${store.career.week}`
      : null;

  const matchdayPreload = useMemo(() => {
    if (matchdayPreloadKey === null) return null;
    const career = useM1Store.getState().career;
    if (career === null) return null;
    const matchday = activeCareerMatchday(career);
    if (matchday === undefined || matchday.kind !== 'league') return null;
    const rivals = matchday.fixtures.filter(
      (candidate) => candidate.id !== matchday.fixture.id,
    );
    if (rivals.length === 0) return null;
    return {
      rivals,
      // Only the rival clubs: the user's own team is not an input to any of
      // these fixtures, and rebuilding it here would churn on every swap.
      teams: buildCareerMatchTeams(career, [
        ...new Set(
          rivals.flatMap((candidate) => [
            candidate.homeClubId,
            candidate.awayClubId,
          ]),
        ),
      ]),
    };
  }, [matchdayPreloadKey]);

  useRivalPreload(
    matchdayPreloadKey,
    matchdayPreload?.rivals ?? [],
    matchdayPreload?.teams ?? null,
    store.screen === 'watched',
  );

  // A hidden web app can be killed without warning, so a queued career write
  // goes out the moment the tablet or tab leaves the screen.
  useSuspendFlush();

  const handleAdvanceWeek = useCallback(() => {
    if (advanceWeekGuidanceBlocked) {
      setGuidanceNudgeToken((token) => token + 1);
      // Bert refuses the week over a job that is usually on another board, and
      // saying so from wherever the manager happens to be standing left them
      // hunting for it. The refused press is also the press that takes them
      // there — focusing the job carries the tab and its sub-board with it.
      if (blockingInboxDuty !== undefined) {
        store.focusInboxDuty(blockingInboxDuty);
      }
      return;
    }
    advanceCareerWithSfx();
  }, [
    advanceCareerWithSfx,
    advanceWeekGuidanceBlocked,
    blockingInboxDuty,
    store.focusInboxDuty,
  ]);

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
      if (assistantSequenceId === 'first-emergency-loan') {
        // Continue the same conversation at the only new loan beat. The first
        // lesson has already covered the rescue and repayment schedule.
        setActiveGuideFocus(undefined);
        setConciergeFocus('emergency-loan');
        setRequestedAssistantSequenceId(null);
        setBoardFinanceMessageStartIndex(2);
        setOpenedBoardFinanceAlertId('emergency-loan');
        return;
      }
      setConciergeFocus(assistantSequence.pages.at(-1)?.focus ?? null);
      setRequestedAssistantSequenceId(null);
    }
  }, [
    assistantSequence,
    assistantSequenceId,
    requestedAssistantSequenceId,
    store.completeAssistantGuide,
  ]);

  const openAssistantGuide = useCallback(
    (
      sequenceId: AssistantGuideSequenceId,
      destination: AssistantGuideDestination,
    ) => {
      setActiveGuideFocus(undefined);
      setConciergeFocus(null);
      setRequestedAssistantSequenceId(sequenceId);
      const requestedMarketSection: MarketSectionId | undefined =
        destination === 'youth-intake'
          ? 'YOUTH'
          : destination === 'market-scouting'
            ? 'SCOUT'
            : destination === 'market-transfers'
              ? 'TRANSFERS'
              : destination === 'coach-market'
                ? 'COACHES'
                : undefined;
      if (requestedMarketSection !== undefined) {
        setMarketSectionRequest((current) => ({
          section: requestedMarketSection,
          token: (current?.token ?? 0) + 1,
        }));
      }
      // The grounds and the ledger are two different boards now, so a Club
      // destination has to name which one it means.
      if (destination === 'club-facilities') setClubOfficeTab('facility');
      else if (destination === 'club-finances') setClubOfficeTab('finances');
      const tab =
        sequenceId === 'board-ultimatum' || sequenceId === 'board-protection'
          ? 'home'
          : destination === 'coach-market' ||
              destination === 'market-scouting' ||
              destination === 'market-transfers' ||
              destination === 'youth-intake'
            ? 'market'
            : destination === 'squad'
              ? 'squad'
              : destination === 'club-facilities' ||
                  destination === 'club-finances'
                ? 'club'
                : destination === 'league-cup' ||
                    destination === 'league-leaders'
                  ? 'league'
                  : 'home';
      store.setActiveTab(tab);
      playManagementActionSfx('card');
      playManagementHaptic('select');
    },
    [store.setActiveTab],
  );

  const browserDatabaseLock =
    bootError !== null &&
    Platform.OS === 'web' &&
    isBrowserDatabaseLockError(bootError);

  let screen;
  let lowConditionMatchdayStarter: ReturnType<
    typeof matchdayConditionWarningPlayer
  > = null;
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
        guidance={
          browserDatabaseLock ? t('app.browserDatabaseInUse') : undefined
        }
        onRetry={() => {
          // Expo SQLite caches the failed browser VFS. Re-running this effect
          // cannot repair it; only a fresh document can create a new handle.
          if (browserDatabaseLock && reloadBrowserDocument()) return;
          setBootAttempt((attempt) => attempt + 1);
        }}
        onStartFresh={
          browserDatabaseLock
            ? undefined
            : () => {
                void resetCareerDatabase({
                  openDatabase: () => openDatabaseAsync(DATABASE_NAME),
                  deleteDatabaseFile: () => deleteDatabaseAsync(DATABASE_NAME),
                })
                  .then(() => setBootAttempt((attempt) => attempt + 1))
                  // This is the last way out of an unopenable database. If the reset
                  // itself fails there is nothing behind it, so say so — an unhandled
                  // rejection here reads as a button that does nothing, forever.
                  .catch((error) =>
                    setBootError(
                      `The save could not be deleted. ${error instanceof Error ? error.message : String(error)}`,
                    ),
                  );
              }
        }
      />
    );
  } else if (!store.persistenceReady) {
    screen = <LoadingScreen />;
  } else if (store.persistenceLoadError !== null) {
    screen = (
      <BootFailure
        message={store.persistenceLoadError}
        onRetry={() => setBootAttempt((attempt) => attempt + 1)}
        onStartFresh={() => {
          void store.discardUnreadableSave();
        }}
        onExportRaw={() => {
          void store.exportUnreadableSave(async (fileName, contents) => {
            const result = await Share.share({
              title: fileName,
              message: contents,
            });
            if (result.action !== Share.sharedAction) {
              throw new Error('the share sheet was dismissed');
            }
          });
        }}
        onRestoreBackup={
          store.backupSummary === null
            ? undefined
            : {
                season: store.backupSummary.season,
                week: store.backupSummary.week,
                onRestore: () => {
                  void store.restoreBackupSave();
                },
              }
        }
      />
    );
  } else if (store.screen === 'welcome' && landingView === 'title') {
    screen = (
      <TitleLandingScreen
        hasSavedCareer={store.hasSavedCareer}
        language={preferences.language}
        onLanguageChange={setLanguage}
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
        onEmailSupport={emailSupport}
        supportError={settingsSaveError}
        accessibilityCopy={assistantFiction(
          content.assistantGuide,
          'accessibility',
          t,
        )}
        difficultyLabel={
          store.career?.difficulty ?? (store.career ? 'COZY' : undefined)
        }
        onBack={() => setLandingView('title')}
      />
    );
  } else if (store.screen === 'welcome' && landingView === 'assistant-mode') {
    screen = (
      <AssistantModeChoiceScreen
        onChoose={beginNewCareer}
        onBack={() => setLandingView('story')}
      />
    );
  } else if (store.screen === 'welcome') {
    screen = (
      <NewGameWelcomeScreen
        hasSavedCareer={store.hasSavedCareer}
        savedCareerLabel={
          store.career
            ? `Season ${store.career.season} · Week ${store.career.week}`
            : undefined
        }
        showOpeningBrief={shouldShowOpeningBrief(store.career)}
        onStartNewCareer={startNewCareer}
        onContinueCareer={
          store.hasSavedCareer ? store.continueCareer : undefined
        }
        onBackToTitle={() => setLandingView('title')}
        onOpenSettings={() => setGlobalSettingsOpen(true)}
      />
    );
  } else if (store.screen === 'create-player' && store.career !== null) {
    screen = (
      <CharacterCreationScreen
        initialDifficulty={store.career.difficulty ?? 'CHAIRMAN'}
        defaultClubName={userClubName(store.career)}
        roster={inheritedSquad(store.career)}
        reduceMotion={reduceMotion}
        onComplete={completeRookieCreation}
      />
    );
  } else if (
    store.screen === 'awakening' &&
    store.career !== null &&
    store.career.awakening.pending !== undefined
  ) {
    screen = (
      <AwakeningCutsceneScreen
        key={pendingAwakeningKey ?? undefined}
        viewModel={awakeningCutsceneViewModel(
          store.career,
          content,
          store.postMatch !== null,
          t,
        )}
        reduceMotion={reduceMotion}
        onBeatChange={setAwakeningBeat}
        onContinue={store.continueAfterAwakening}
      />
    );
  } else if (store.career === null) {
    screen = (
      <BootFailure
        message={t('app.savedCareerCouldNotBeLoaded')}
        onRetry={() => setBootAttempt((attempt) => attempt + 1)}
      />
    );
  } else if (
    store.screen === 'midseason-training' &&
    midseasonTrainingVm !== undefined
  ) {
    screen = (
      <MidseasonTrainingCelebrationScreen
        viewModel={midseasonTrainingVm}
        reduceMotion={reduceMotion}
        onContinue={store.completeMidseasonTraining}
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
        autoSubs={preferences.autoSubs}
        onAutoSubsChange={saveAutoSubs}
        performanceLimit={preferences.performanceLimit}
        onPerformanceLimitChange={saveMatchPerformanceLimit}
        pausedExternally={globalSettingsOpen}
        firstMatchTutorial={
          careerTeaches &&
          isFirstOnboardingFixture(store.career, store.watchedMatch.fixture.id)
        }
        cupRoundLabel={store.watchedMatch.cupRoundLabel}
        onOpenSettings={() => setGlobalSettingsOpen(true)}
        onDone={finishWatchedMatch}
      />
    );
  } else if (store.screen === 'matchday') {
    if (rivalHeroIntro !== undefined) {
      screen = (
        <RivalHeroIntroScreen
          key={rivalHeroIntro.heroId}
          viewModel={rivalHeroIntro}
          reduceMotion={reduceMotion}
          onComplete={store.completeRivalHeroIntro}
        />
      );
    } else {
      const matchday = matchDayViewModel(
        store.career,
        content,
        preferences.formationPresets[0],
        t,
      );
      if (
        careerTeaches &&
        !hasAssistantGuideMilestone(
          store.career,
          'match-condition-warning-seen',
        )
      ) {
        lowConditionMatchdayStarter = matchdayConditionWarningPlayer(
          matchday.lineup,
        );
      }
      screen = (
        <FixtureMatchDayScreen
          viewModel={matchday}
          onBack={() => store.setActiveTab('home')}
          onToggleHeroLicense={(playerId) => {
            const hero = matchday.heroes.find(
              (candidate) => candidate.playerId === playerId,
            );
            const willEnterLineup =
              hero?.licensed === false &&
              !matchday.lineup.some((player) => player.id === playerId);
            const toggle = () =>
              performManagementAction(
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
          onSwapStartingPlayer={(starterId, replacementId) =>
            performManagementAction(
              () => store.swapStartingPlayer(starterId, replacementId),
              'select',
              'select',
            )
          }
          onWatchMatch={store.watchMatch}
          onQuickResult={() =>
            store.quickResult({
              initialFormation: preferences.formationPresets[0],
            })
          }
          onOpenSettings={() => setGlobalSettingsOpen(true)}
        />
      );
    }
  } else if (store.screen === 'faceoff' && store.faceOff !== null) {
    screen = (
      <QuickResultFaceOff
        faceOff={store.faceOff}
        reduceMotion={reduceMotion}
        onDone={store.completeFaceOff}
      />
    );
  } else if (store.screen === 'postmatch' && store.postMatch !== null) {
    screen = (
      <PostMatchLedgerScreen
        viewModel={store.postMatch}
        textScale={preferences.textScale}
        reduceMotion={reduceMotion}
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
  } else if (
    store.screen === 'event' &&
    store.career.pendingEvent !== undefined
  ) {
    screen = (
      <StoryEventScreen
        viewModel={storyEventViewModel(store.career, content, t)}
        onChoose={store.chooseEvent}
        onSelectPlayer={store.selectEventPlayer}
        onSelectCoach={store.selectEventCoach}
        onSelectFacility={store.selectEventFacility}
        onContinue={store.continueAfterEvent}
        onSkipUnavailable={store.skipUnavailableEvent}
        onOpenSettings={() => setGlobalSettingsOpen(true)}
        reduceMotion={reduceMotion}
        guideCopy={
          !careerTeaches ||
          store.career.eventFlags.includes('m4:event-guide-seen')
            ? undefined
            : assistantFiction(content.assistantGuide, 'events', t)
        }
        textScale={preferences.textScale}
      />
    );
  } else if (store.screen === 'legacy') {
    screen = (
      <ClubLegacyScreen
        viewModel={clubLegacyViewModel(store.career, t)}
        onChoose={(choice) => {
          setConciergeFocus(null);
          store.chooseLegacy(choice);
        }}
        onOpenSettings={() => setGlobalSettingsOpen(true)}
        guided={visibleConciergeFocus === 'club-legacy'}
        onDismissGuidance={dismissVisibleTips}
      />
    );
  } else if (store.screen === 'championship-celebration') {
    screen = (
      <ChampionshipCelebrationScreen
        viewModel={championshipCelebrationViewModel(
          store.career,
          content.assistantGuide.assistant.name,
          t,
        )}
        reduceMotion={reduceMotion}
        onComplete={store.completeChampionshipCelebration}
      />
    );
  } else if (store.screen === 'season-podium') {
    screen = (
      <SeasonPodiumScreen
        viewModel={seasonPodiumViewModel(store.career, t)}
        reduceMotion={reduceMotion}
        onComplete={store.completeSeasonPodium}
      />
    );
  } else if (store.screen === 'endgame-celebration') {
    screen = (
      <EndgameCelebrationScreen
        viewModel={endgameCelebrationViewModel(
          store.career,
          content.assistantGuide.assistant.name,
          // The default: the pending celebration this career actually earned.
          undefined,
          t,
        )}
        reduceMotion={reduceMotion}
        onComplete={store.completeEndgameCelebration}
        // The true ending's finale ends on the title screen it started from.
        onReturnToTitle={store.returnToTitleFromEnding}
      />
    );
  } else if (store.screen === 'awards-ceremony') {
    screen = (
      <AwardsCeremonyScreen
        viewModel={careerAwardCeremonyViewModel(store.career, t)}
        lookIds={awardCeremonyLookIds(store.career)}
        reduceMotion={reduceMotion}
        onComplete={store.completeAwardsCeremony}
      />
    );
  } else if (store.screen === 'season-end') {
    const season = seasonEndViewModel(
      store.career,
      content,
      store.selectedContractTerm,
      t,
    );
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
        onReleaseContract={(playerId) =>
          requestConfirmation({
            title: 'Let this player leave?',
            detail: `${season.expiredContract?.playerName ?? 'This player'} leaves immediately. This cannot be undone.`,
            confirmLabel: 'Let player leave',
            tone: 'danger',
            onConfirm: () =>
              performManagementAction(
                () => store.releasePlayer(playerId),
                'warning',
                'warning',
              ),
          })
        }
        onPrimaryAction={() =>
          season.sliceComplete
            ? store.setActiveTab('home')
            : store.advanceCareer()
        }
        onOpenSettings={() => setGlobalSettingsOpen(true)}
        onExpiredContractVisible={markExpiredContractReached}
        guideCopy={
          !careerTeaches ||
          store.career.eventFlags.includes('m4:season-recap-guide-seen')
            ? undefined
            : assistantFiction(content.assistantGuide, 'seasonRecap', t)
        }
        textScale={preferences.textScale}
      />
    );
  } else {
    const home = homeViewModel(store.career, t);
    /**
     * One route for both copies of the current job: the inbox row and Bert's
     * durable bottom strip. Keeping the alert id as the handoff means the strip
     * cannot drift to a shallower tab-only shortcut later.
     */
    const openHomeAlert = (alertId: string): void => {
      // Every row opens from the desk. A blue row becomes the one focused job
      // before its destination opens, so no intermediate render can change
      // boards without passing the same guard as a later tap.
      const alert = home.alerts.find((candidate) => candidate.id === alertId);
      // Opening the Cup board IS the Cup job, so this one row is never focused.
      // Focusing it and then completing it in the same press dropped the whole
      // focus back to "choose a job", which then refused the League navigation
      // the press existed to perform: the manager stayed on the desk, Bert
      // named a different duty, and the Cup row was gone for good.
      const completedByThisPress = alert?.guideSequenceId === 'national-cup';
      if (alert?.mustDoDutyId !== undefined && !completedByThisPress) {
        store.focusInboxDuty(alert.mustDoDutyId);
      }
      if (
        alert?.guideSequenceId !== undefined &&
        alert.destination !== undefined
      ) {
        // Opening the Cup button is the whole Must Do objective. Bert can still
        // explain the bracket, but the manager is no longer blocked once the
        // button has taken them to League.
        if (alert.guideSequenceId === 'national-cup') {
          store.completeAssistantGuide('national-cup');
        }
        if (alertId.startsWith('injury-')) {
          store.selectPlayer(alertId.slice('injury-'.length));
        } else if (alertId.startsWith('transfer-request-')) {
          store.selectPlayer(alertId.slice('transfer-request-'.length));
        }
        openAssistantGuide(alert.guideSequenceId, alert.destination);
      } else if (alertId === DESK_STORY_ALERT_ID) store.openDeskStory();
      else if (alertId.startsWith('training-upgrade:'))
        store.setActiveTab('squad');
      else if (alertId === 'training-ground' || alertId === 'build-reminder') {
        setClubOfficeTab('facility');
        store.setActiveTab('club');
      } else if (alertId.startsWith('injury-')) {
        store.selectPlayer(alertId.slice('injury-'.length));
        store.setActiveTab('squad');
      } else if (alertId.startsWith('transfer-request-')) {
        store.selectPlayer(alertId.slice('transfer-request-'.length));
        store.setActiveTab('squad');
      } else if (alertId.startsWith('training-cap:')) {
        if (alert?.playerId !== undefined) {
          store.selectPlayer(alert.playerId);
          setDrillFocusToken((current) => (current ?? 0) + 1);
        }
        store.setActiveTab('squad');
      } else if (alertId === 'renewals') store.setActiveTab('squad');
      else if (
        alertId === 'financial-warning' ||
        alertId === 'emergency-loan'
      ) {
        setClubOfficeTab('finances');
        store.setActiveTab('club');
        // The ledger alone never said what the row said. Bert repeats the whole
        // warning here, one bubble per tap, because the desk clips it at two
        // lines and nothing else in the game finishes the sentence.
        setBoardFinanceMessageStartIndex(0);
        setOpenedBoardFinanceAlertId(careerTeaches ? alertId : null);
      } else if (alertId === 'board-ultimatum') {
        store.notify(
          t(
            home.boardUltimatum?.consequence === 'FACILITY_CONVERSION'
              ? 'app.boardUltimatumFacilityPlan'
              : 'app.boardUltimatumProtectPlayer',
          ),
        );
      } else if (alertId.startsWith('board-resolution')) {
        store.notify(t('app.boardInterventionResult'));
      } else if (alertId.startsWith('retirement-announcement-')) {
        store.notify(t('app.retirementAnnouncementGuidance'));
      } else store.notify(t('app.seasonReviewAlertResolved'));
    };
    const guideObjectiveAlert =
      blockingInboxDuty === undefined
        ? undefined
        : home.alerts.find((alert) => alert.mustDoDutyId === blockingInboxDuty);
    screen = (
      <ManagementShell
        clubName={home.clubName}
        seasonLabel={home.seasonLabel}
        weekLabel={home.weekLabel}
        resources={home.resources}
        reduceMotion={reduceMotion}
        activeTab={store.activeTab}
        onTabChange={(tab) => {
          if (assistantObjectiveTargetTab === tab) {
            // The shell dismisses floating guidance after the pointer release.
            // Keep the next step alive when this tap is the guided navigation
            // itself, so opening Squad reveals the arrow on the exact + button.
            skipNextGuidanceDismissRef.current = true;
            requestAnimationFrame(() => {
              skipNextGuidanceDismissRef.current = false;
            });
          }
          store.setActiveTab(tab);
          if (useM1Store.getState().activeTab !== tab) return;
          setConciergeFocus(null);
          setMarketSectionRequest(null);
          setDrillFocusToken(null);
          setManagerTipGuideRequest(null);
        }}
        onAdvanceWeek={handleAdvanceWeek}
        keyboardShortcutsEnabled={
          !guideOverlayVisible && midseasonTrainingStage === null
        }
        onOpenLedger={() => store.setActiveTab('club')}
        onOpenSettings={() => setGlobalSettingsOpen(true)}
        developerSaveSummaries={
          developerModeAvailable && preferences.developerMode
            ? developerSaveSummaries
            : undefined
        }
        developerManualSaveSelecting={developerManualSaveSelecting}
        onPressDeveloperSaveSlot={pressDeveloperSaveSlot}
        onToggleDeveloperManualSave={() => {
          setDeveloperManualSaveSelecting((selecting) => !selecting);
        }}
        advanceWeekLabel={
          store.saving ? t('app.saving') : t('managementShell.advanceWeek')
        }
        // Save failures are hard-disabled. Bert's unfinished job keeps the same
        // grey face but remains pressable so that press can nudge the job twice.
        advanceWeekDisabled={store.saving || store.saveBlocked}
        advanceWeekGuidanceBlocked={advanceWeekGuidanceBlocked}
        guidanceNudgeTarget={guidanceNudgeTarget}
        guidanceNudgeToken={guidanceNudgeToken}
        guideFocus={
          careerTeaches &&
          (activeGuideFocus === 'money' || activeGuideFocus === 'navigation')
            ? activeGuideFocus
            : undefined
        }
        // The helper sentence is the durable first-week flow. Only the
        // floating arrow retires after a general screen tap; losing the text
        // left a glowing control and a blocked Advance Week with no explanation.
        guideObjective={
          focusedInboxDutyId === undefined ? displayedGuideObjective : undefined
        }
        onGuideObjectivePress={
          guideObjectiveAlert !== undefined
            ? () => openHomeAlert(guideObjectiveAlert.id)
            : assistantObjectiveTargetTab !== undefined &&
                assistantObjectiveTargetTab !== store.activeTab
              ? () => store.setActiveTab(assistantObjectiveTargetTab)
              : undefined
        }
        guideTarget={
          hideCoachHiringCues ? undefined : visibleAssistantObjectiveTarget
        }
        onMoneyGuideAnchorChange={setMoneyGuideAnchor}
        onNavigationGuideAnchorChange={setNavigationGuideAnchor}
        onDismissGuidance={dismissVisibleTips}
        mustDoObjective={focusedInboxDutyObjective}
        onBackToInboxDuties={
          focusedInboxDutyId === undefined
            ? undefined
            : () => {
                setRequestedAssistantSequenceId(null);
                setConciergeFocus(null);
                setMarketSectionRequest(null);
                store.backToInboxDuties();
              }
        }
      >
        {store.activeTab === 'squad' ? (
          <SquadTrainingScreen
            requestViewModel={playerRequestVm}
            onOpenRequest={() => setRequestStage('walk-on')}
            squadSort={preferences.squadSort}
            onChangeSquadSort={saveSquadSort}
            viewModel={squadTrainingVm!}
            selectedPlayerId={store.selectedPlayerId}
            onSelectPlayer={(playerId) => {
              store.selectPlayer(playerId);
              if (
                visibleConciergeFocus === 'injury-lineup' ||
                visibleConciergeFocus === 'transfer-request'
              ) {
                setConciergeFocus(null);
              }
            }}
            onTrainDrill={(playerId, pathId) =>
              store.trainPlayer(playerId, pathId)
            }
            onTrainDrillBatch={(playerId, pathId, runs) =>
              store.trainPlayerBatch(playerId, pathId, runs)
            }
            onBuyDrillUpgrade={(pathId) => {
              const upgrade = squadTrainingVm!.drillUpgrades.find(
                (row) => row.pathId === pathId,
              );
              requestConfirmation({
                title: `Buy ${upgrade?.label ?? 'drill'} Tier ${upgrade?.nextTier ?? ''}?`,
                detail: `Spend ${upgrade === undefined ? 'the shown cost' : formatCurrency(t, upgrade.cost ?? 0)} once. Every ${upgrade?.label ?? ''} drill from now on gives +${upgrade?.nextGain ?? 0} for ${upgrade?.nextTpCost ?? 0} TP.`,
                confirmLabel: 'Buy upgrade',
                onConfirm: () => store.purchaseTrainingUpgrade(pathId),
              });
            }}
            lastDrillResult={store.lastDrillResult}
            trainingPoints={store.career?.trainingPoints ?? 0}
            guideTraining={visibleAssistantObjectiveTarget === 'training-plan'}
            guidanceNudgeTarget={guidanceNudgeTarget}
            guidanceNudgeToken={guidanceNudgeToken}
            guideFocus={
              activeGuideFocus ??
              assistantSequence?.pages[0]?.focus ??
              visibleConciergeFocus ??
              undefined
            }
            dismissTipsToken={tipDismissSequence}
            managerTipGuideRequest={visibleManagerTipGuideRequest ?? undefined}
            showSortHint={squadSortHintVisible}
            reduceMotion={reduceMotion}
            drillPickerRequestToken={drillFocusToken ?? undefined}
            saveWarning={store.saveWarning}
            conditionWarningSeen={
              !careerTeaches ||
              (store.career !== null &&
                hasAssistantGuideMilestone(
                  store.career,
                  'condition-warning-seen',
                ))
            }
            onConditionWarningShown={() =>
              store.completeGuideMilestone('condition-warning-seen')
            }
            guideQuickTrain={
              careerTeaches &&
              store.career !== null &&
              store.career.season === 1 &&
              store.career.week >= QUICK_TRAIN_LESSON_WEEK &&
              !hasAssistantGuideMilestone(store.career, 'quick-train-seen')
            }
            onQuickTrainShown={() =>
              store.completeGuideMilestone('quick-train-seen')
            }
          />
        ) : store.activeTab === 'club' ? (
          <ClubFinancesScreen
            viewModel={clubFinancesViewModel(store.career, t)}
            activeTab={clubOfficeTab}
            onSelectTab={(tab) => {
              if (focusedInboxDutyId !== undefined && tab !== 'facility') {
                store.notifyInboxDutyBlocked(focusedInboxDutyId);
                return;
              }
              setClubOfficeTab(tab);
            }}
            onBuildTrainingGround={buildTrainingGroundWithSfx}
            onBuildFacility={buildClubFacilityWithFeedback}
            requiredBuildType={requiredFacilityBuildType}
            guidanceNudgeTarget={guidanceNudgeTarget}
            guidanceNudgeToken={guidanceNudgeToken}
            incomeFacilitiesFlashToken={incomeFacilitiesFlashToken}
            onRequiredBuildTypeBlocked={() =>
              store.notifyInboxDutyBlocked('coaching-office')
            }
            onUpgradeFacility={(buildingId) => {
              const finances = clubFinancesViewModel(
                useM1Store.getState().career!,
                t,
              );
              const building = finances.facilities.buildings.find(
                (candidate) => candidate.id === buildingId,
              );
              requestConfirmation({
                title: `Upgrade ${building?.name ?? 'facility'}?`,
                detail: `Spend ${building?.upgradeCost === undefined ? 'the shown cost' : formatCurrency(t, building.upgradeCost)} now. Weekly upkeep will rise with the new level.`,
                confirmLabel: 'Approve upgrade',
                onConfirm: () => upgradeClubFacilityWithFeedback(buildingId),
              });
            }}
            onRelocateFacility={(buildingId, x, y) =>
              performManagementAction(
                () => store.relocateClubFacility(buildingId, { x, y }),
                'build',
                'commit',
              )
            }
            onCloseFacility={(buildingId) => {
              const career = useM1Store.getState().career!;
              const finances = clubFinancesViewModel(career, t);
              const building = finances.facilities.buildings.find(
                (candidate) => candidate.id === buildingId,
              );
              const staffedOffice =
                building?.type === 'coaching-office' &&
                career.market?.assistantCoach !== undefined
                  ? staffedCoachingOfficeClosureConfirmation(career, buildingId)
                  : undefined;
              requestConfirmation({
                title: `Close ${building?.name ?? 'facility'}?`,
                detail:
                  staffedOffice === undefined
                    ? building?.closeRefund === 0
                      ? 'The club never paid to put this up, so nothing comes back. Its bonus and its square go straight away.'
                      : `You will only get half your investment back${
                          building === undefined
                            ? ''
                            : `, ${formatCurrency(t, building.closeRefund)}`
                        }. Are you sure?`
                    : `This also dismisses ${staffedOffice.assistantName}. The facility returns ${formatCurrency(t, staffedOffice.facilityRefund)} and severance costs ${formatCurrency(t, staffedOffice.severanceCost)}. ${
                        staffedOffice.canConfirm
                          ? `Net cash change ${formatCurrency(t, staffedOffice.netCashEffect, true)}; balance after ${formatCurrency(t, staffedOffice.cashAfter)}.`
                          : `The club needs ${formatCurrency(t, staffedOffice.shortage)} more after the refund, so this cannot be completed.`
                      }`,
                confirmLabel: 'Close it',
                tone: 'danger',
                ...(staffedOffice !== undefined && !staffedOffice.canConfirm
                  ? { confirmDisabled: true }
                  : {}),
                onConfirm: () =>
                  performManagementAction(
                    () => store.closeClubFacility(buildingId),
                    'build',
                    'commit',
                  ),
              });
            }}
            onOpenCoachMarket={() => {
              // The Staff board's own button, so it lands on the Coaches desk
              // rather than whichever docket the market happened to open on.
              setMarketSectionRequest((current) => ({
                section: 'COACHES',
                token: (current?.token ?? 0) + 1,
              }));
              store.setActiveTab('market');
            }}
            onDismissCoach={beginCoachDismissal}
            onReviewSponsorOffer={(offer, slot) =>
              requestConfirmation({
                title: `Sign ${offer.sponsorName}?`,
                detail: `${slot.slotLabel}. Contract ${formatCurrency(t, offer.nominalMonthlyFee)} per month.${
                  offer.actualMonthlyFee === offer.nominalMonthlyFee
                    ? ''
                    : ` On Chairman, the club receives ${formatCurrency(t, offer.actualMonthlyFee)} per month.`
                } Objective: ${offer.objectiveLabel}. Target bonus ${formatCurrency(t, offer.nominalBonus)}.${
                  offer.actualBonus === offer.nominalBonus
                    ? ''
                    : ` The club receives ${formatCurrency(t, offer.actualBonus)} on Chairman.`
                }`,
                confirmLabel: 'Sign deal',
                returnFocusId: `sponsor-slots-panel-${slot.slot}`,
                onAfterConfirmDismiss: () => {
                  if (Platform.OS !== 'web') {
                    setSponsorSummaryFocusToken((token) => (token ?? 0) + 1);
                  }
                },
                onConfirm: () => {
                  store.acceptSponsorOffer(offer.offerId);
                  setConciergeFocus(null);
                },
              })
            }
            guideTrainingGround={
              visibleAssistantObjectiveTarget === 'training-ground-facility'
            }
            guideFocus={activeGuideFocus ?? visibleConciergeFocus ?? undefined}
            onLoanGuideAnchorChange={setLoanGuideAnchor}
            onFacilityAdjacencyGuideAnchorChange={
              setFacilityAdjacencyGuideAnchor
            }
            reduceMotion={reduceMotion}
            focusSponsorSummaryToken={sponsorSummaryFocusToken}
          />
        ) : store.activeTab === 'market' &&
          store.career.market !== undefined ? (
          <MarketScreen
            viewModel={marketViewModel(
              careerMarketViewModelSource(store.career, undefined, t),
              t,
            )}
            guidanceNudgeTarget={guidanceNudgeTarget}
            guidanceNudgeToken={guidanceNudgeToken}
            reduceMotion={reduceMotion}
            onStartScoutMission={(optionId) =>
              performManagementAction(
                () => store.startScoutMission(optionId),
                'dispatch',
                'commit',
              )
            }
            onOpenScoutReport={(playerId) => {
              store.openScoutReport(playerId);
              if (useM1Store.getState().error === null) setConciergeFocus(null);
            }}
            onTransferAction={(playerId, direction, bidId) => {
              if (direction === 'BUY') {
                performManagementAction(
                  () => store.actOnTransfer(playerId, direction),
                  'card',
                  'select',
                );
                return;
              }
              const market = marketViewModel(
                careerMarketViewModelSource(store.career!, undefined, t),
                t,
              );
              const listing = market.transfers.find(
                (candidate) =>
                  candidate.playerId === playerId &&
                  candidate.direction === 'SELL',
              );
              const bid = listing?.bids.find(
                (candidate) => candidate.id === bidId,
              );
              const acceptingBid = bid !== undefined;
              const careerBeforeSale = store.career;
              const farewellPlayer: PlayerSaleFarewellModel | undefined =
                acceptingBid &&
                listing !== undefined &&
                careerBeforeSale !== null
                  ? {
                      playerId: listing.playerId,
                      playerName: listing.playerName,
                      role: listing.role,
                      lookId: listing.lookId,
                      selectionKey: `${careerBeforeSale.careerSeed}:${careerBeforeSale.season}:${careerBeforeSale.week}:${listing.playerId}`,
                    }
                  : undefined;
              requestConfirmation({
                title: acceptingBid
                  ? `Accept ${bid?.buyerName ?? 'this club'} bid?`
                  : `List ${listing?.playerName ?? 'this player'}?`,
                detail: acceptingBid
                  ? `Receive ${bid === undefined ? 'the shown fee' : formatCurrency(t, bid.fee)} for ${listing?.playerName ?? 'the player'}. The player leaves immediately and will be removed from the Starting XI and training plan.`
                  : 'The transfer office will request up to three club bids. Listing does not sell the player; you will compare every offer first.',
                confirmLabel: acceptingBid ? 'Accept bid' : 'Request bids',
                tone: acceptingBid ? 'danger' : 'normal',
                onConfirm: () => {
                  performManagementAction(
                    () => store.actOnTransfer(playerId, direction, bidId),
                    acceptingBid ? 'cash' : 'dispatch',
                    acceptingBid ? 'success' : 'commit',
                  );
                  const after = useM1Store.getState();
                  if (
                    farewellPlayer !== undefined &&
                    after.error === null &&
                    after.career?.players.some(
                      (player) =>
                        player.id === farewellPlayer.playerId &&
                        player.clubId === after.career?.userClubId,
                    ) !== true
                  ) {
                    setPlayerSaleFarewell(farewellPlayer);
                  }
                },
              });
            }}
            onHireCoach={(coachId, role) => {
              if (
                focusedInboxDutyId === 'head-coach-market' &&
                role !== 'HEAD'
              ) {
                store.notifyInboxDutyBlocked(focusedInboxDutyId);
                return;
              }
              const career = useM1Store.getState().career!;
              const market = marketViewModel(
                careerMarketViewModelSource(career, undefined, t),
                t,
              );
              const coach = market.coaches.find(
                (candidate) => candidate.id === coachId,
              );
              const current =
                role === 'HEAD'
                  ? career.market?.headCoach
                  : career.market?.assistantCoach;
              const roleLabel =
                role === 'HEAD' ? 'head coach' : 'assistant coach';
              requestConfirmation({
                title: current
                  ? `Replace ${current.name}?`
                  : `Hire ${coach?.name ?? 'this coach'}?`,
                detail: `${coach?.name ?? 'The coach'} will become ${roleLabel} and costs ${coach === undefined ? 'the shown wage' : formatCurrency(t, coach.weeklyWage)} each week.${current ? ` The current ${roleLabel} leaves immediately.` : ''}`,
                confirmLabel: current ? 'Replace coach' : 'Hire coach',
                tone: current ? 'danger' : 'normal',
                onConfirm: () => hireCoachWithFeedback(coachId, role),
              });
            }}
            onSignYouth={(playerId) =>
              requestConfirmation({
                title: 'Sign this youth player?',
                detail:
                  'The player joins the senior squad immediately and occupies a roster place.',
                confirmLabel: 'Sign player',
                onConfirm: () => signYouthWithFeedback(playerId),
              })
            }
            onDeclineYouth={() => {
              if (focusedInboxDutyId === 'youth-intake') {
                store.notifyInboxDutyBlocked(focusedInboxDutyId);
                return;
              }
              requestConfirmation({
                title: 'Decline the youth intake?',
                detail:
                  'Every remaining offer will be removed. This cannot be undone after you leave the desk.',
                confirmLabel: 'Decline all',
                tone: 'danger',
                onConfirm: () =>
                  performManagementAction(
                    store.declineYouth,
                    'warning',
                    'warning',
                  ),
              });
            }}
            onSubmitContractOffer={submitTransferOfferWithFeedback}
            onCloseNegotiation={store.closeTransferTalks}
            onDismissGuideFocus={() => setConciergeFocus(null)}
            onDealsGuideAnchorChange={setMarketDealsGuideAnchor}
            guideFocus={
              activeGuideFocus ??
              assistantSequence?.pages[0]?.focus ??
              visibleConciergeFocus ??
              undefined
            }
            requestedSection={marketSectionRequest?.section}
            requestedSectionToken={marketSectionRequest?.token}
            lockedSection={
              focusedInboxDutyId === 'head-coach-market' ||
              focusedInboxDutyId === 'assistant-coach-hire'
                ? 'COACHES'
                : focusedInboxDutyId === 'youth-intake'
                  ? 'YOUTH'
                  : undefined
            }
            onBlockedSectionChange={() =>
              store.notifyInboxDutyBlocked(focusedInboxDutyId)
            }
          />
        ) : store.activeTab === 'league' && store.career.m2 !== undefined ? (
          <M2LeagueScreen
            viewModel={m2LeagueViewModel(
              {
                career: store.career.m2,
                season: store.career.season,
                activeStandings: leagueStandings(store.career),
                userSquadStrength: clubSquadStrength(
                  store.career.players.filter(
                    (player) => player.clubId === store.career?.userClubId,
                  ),
                ),
                selectedDivision: selectedLeagueDivision,
                selectedCupSeason,
                leagueFixtures: store.career.fixtures,
                players: store.career.players,
                statLines: store.career.seasonStatLines ?? [],
                week: store.career.week,
                phase: store.career.phase,
              },
              t,
            )}
            onSelectDivision={setSelectedLeagueDivision}
            onSelectCupSeason={(season) => {
              setConciergeFocus(null);
              setSelectedCupSeason(season);
            }}
            onOpenCupFixture={(fixtureId) => {
              setConciergeFocus(null);
              store.openCupFixture(fixtureId);
            }}
            guideSubTab={
              // The Cup job's own board, not whichever league board was last
              // open. Bert's briefing brings its own focus; a manager sent here
              // by the duty guard has none, and used to arrive at the table.
              firstCupRoundOf32GuideOwed ||
              focusedInboxDutyId === 'national-cup'
                ? 'cup'
                : leagueGuideSubTab
            }
            onGuideSubTabAnchorChange={setLeagueSubTabGuideAnchor}
            guideRoundOf32={firstCupRoundOf32HelperVisible}
            onDismissRoundOf32Guide={() => setConciergeFocus(null)}
          />
        ) : store.activeTab === 'league' ? (
          <LeagueTableScreen
            viewModel={leagueTableViewModel(store.career, t)}
            reduceMotion={reduceMotion}
          />
        ) : (
          <ClubHomeScreen
            viewModel={home}
            textScale={preferences.textScale}
            reduceMotion={reduceMotion}
            onOpenFixture={store.openMatchday}
            onOpenManagerTipDestination={openManagerTipDestination}
            showManagerTips={careerTeaches}
            onOpenAlert={openHomeAlert}
            onOpenLeague={() => store.setActiveTab('league')}
            onProtectBoardCandidate={(playerId) =>
              performManagementAction(
                () => store.protectBoardCandidate(playerId),
                'select',
                'select',
              )
            }
            guideAlertId={
              visibleAssistantObjectiveTarget === 'training-ground-alert'
                ? 'training-ground'
                : visibleConciergeFocus === 'retirement'
                  ? home.alerts.find((alert) =>
                      alert.id.startsWith('retirement-announcement-'),
                    )?.id
                  : undefined
            }
            guidanceNudgeTarget={guidanceNudgeTarget}
            guidanceNudgeToken={guidanceNudgeToken}
            focusGuidedAlert={
              assistantObjective?.target === 'training-ground-alert'
            }
            // Only once he is off screen: while he is still talking the row is
            // under a dimmed pane anyway, and a third highlight would compete
            // with the spotlight he is standing in.
            glowGuidedAlert={!guideOverlayVisible}
            guideBoard={
              visibleConciergeFocus === 'board-ultimatum' ||
              visibleConciergeFocus === 'board-protection'
            }
          />
        )}
      </ManagementShell>
    );
  }

  // Every language draws from the same pixel family now, so this binding no
  // longer switches faces — it stays because `font-pixel` / `font-mono` read
  // these variables, and because the voice split (display vs data) is real.
  const faces = facesFor(preferences.language);

  // The chain above picks exactly one component per branch, so the component it
  // picked IS that screen's identity. Deriving a parallel key from `store.screen`
  // would be a second routing table to keep in step with the first, and would
  // miss what this gets for free: the two loading branches are one screen to the
  // eye, and the four welcome views are four.
  const screenKey: unknown = isValidElement(screen) ? screen.type : screen;
  // Frame-loop screens must stop drawing at handover, and the rival intro must
  // give the lineup a clean reveal after its final speech tap. Those three cut
  // directly instead of remaining mounted through the ordinary dissolve.
  const screenRequiresHardCut =
    screenKey === MatchScreen ||
    screenKey === QuickResultFaceOff ||
    screenKey === RivalHeroIntroScreen ||
    screenKey === MidseasonTrainingCelebrationScreen;
  // Confirmations have first claim on focus. Otherwise, a save warning that
  // has paused the career becomes the only interactive surface until Retry.
  const blockingSaveWarningVisible =
    pendingConfirmation === null &&
    store.saveWarning !== null &&
    store.saveBlocked;
  const backgroundInteractionBlocked =
    pendingConfirmation !== null ||
    blockingSaveWarningVisible ||
    postMatchSummaryVisible;

  return (
    <LocaleProvider value={preferences.language}>
      <SafeAreaProvider>
        <StatusBar
          style={
            (!fontsLoaded && !fontError && bootError === null) ||
            bootError !== null ||
            !store.persistenceReady ||
            store.persistenceLoadError !== null ||
            store.screen === 'watched' ||
            store.screen === 'faceoff' ||
            store.screen === 'awakening' ||
            store.screen === 'midseason-training' ||
            rivalHeroIntro !== undefined
              ? 'light'
              : 'dark'
          }
        />
        <View
          className="flex-1 bg-ink"
          style={vars({
            '--font-display': faces.display,
            '--font-data': faces.data,
          })}
        >
          {/* Inside the provider on purpose: the card announces the language it
            just switched to, so it has to render in it. */}
          <LanguageOfferCard
            offered={languageOffer}
            onKeep={() => answerLanguageOffer(languageOffer ?? 'en')}
            onUseEnglish={() => answerLanguageOffer('en')}
          />
          <View
            className="flex-1"
            pointerEvents={backgroundInteractionBlocked ? 'none' : 'auto'}
            accessibilityElementsHidden={backgroundInteractionBlocked}
            importantForAccessibility={
              backgroundInteractionBlocked ? 'no-hide-descendants' : 'auto'
            }
            {...confirmationBackgroundProps(backgroundInteractionBlocked)}
          >
            <View
              className="flex-1"
              {...bertBriefingBackgroundProps(
                bertBriefingVisible || scoutDealsGuideVisible,
              )}
            >
              <ScreenTransition
                screenKey={screenKey}
                reduceMotion={reduceMotion}
                animated={!screenRequiresHardCut}
              >
                <Suspense fallback={<LoadingScreen />}>{screen}</Suspense>
              </ScreenTransition>
              {/* The match week announces itself the moment the desk appears, the
            same way the Financial Report announces a surge. Held back until
            the manager is actually ON the desk: the week review runs first,
            and a bugle over it would be two announcements at once.

            The Financial Report counts as "not on the desk yet". It renders
            over the management screen rather than replacing it, so the screen
            check alone let the bugle play behind the statement — the report
            was still being read while the match week announced itself. The
            banner is not dismissed meanwhile, just not mounted, so it lands
            the moment Continue closes the report. */}
              {store.screen === 'management' &&
              !postMatchSummaryVisible &&
              midseasonTrainingStage === null &&
              store.matchDayBanner !== null ? (
                <MatchDayBanner
                  key={store.matchDayBanner.id}
                  headline={store.matchDayBanner.headline}
                  accessibilityLabel={store.matchDayBanner.accessibilityLabel}
                  isCup={store.matchDayBanner.isCup}
                  reduceMotion={reduceMotion}
                  onShown={store.dismissMatchDayBanner}
                />
              ) : null}
              {/* Not a FeedbackNotice: that one is dismissible and auto-hides. An
            unsaved career must keep saying so until a save actually succeeds. */}
              {store.saveWarning !== null && !blockingSaveWarningVisible && (
                <SaveWarningBanner
                  message={store.saveWarning}
                  blocked={store.saveBlocked}
                  onRetry={store.retrySave}
                />
              )}
              {rivalHeroIntro === undefined &&
                (developerSaveError ? (
                  <FeedbackNotice
                    message={developerSaveError}
                    tone="error"
                    onDismiss={() => setDeveloperSaveError(null)}
                  />
                ) : store.error && !facilityErrorBertVisible ? (
                  <FeedbackNotice
                    message={store.error}
                    tone="error"
                    onDismiss={store.clearError}
                  />
                ) : store.notice && store.notice.speaker !== 'bert' ? (
                  <FeedbackNotice
                    message={store.notice.message}
                    tone={store.notice.tone}
                    onDismiss={store.clearNotice}
                  />
                ) : null)}
              <SettingsOverlay
                open={globalSettingsOpen}
                glossary={content.glossary}
                glossaryOpen={globalGlossaryOpen}
                privacySupportOpen={globalPrivacySupportOpen}
                volume={devVolume}
                reduceMotion={preferences.reduceMotion}
                hudSide={preferences.hudSide}
                hapticsEnabled={preferences.hapticsEnabled}
                textScale={preferences.textScale}
                language={preferences.language}
                onCycleLanguage={cycleLanguage}
                highContrast={preferences.highContrast}
                colorSafeKits={preferences.colorSafeKits}
                cutInMode={preferences.cutInMode}
                performanceLimited={performanceLimitActive}
                developerMode={
                  developerModeAvailable ? preferences.developerMode : undefined
                }
                assistantMode={
                  store.career === null
                    ? undefined
                    : (store.career.assistantMode ?? 'teacher')
                }
                accessibilityCopy={assistantFiction(
                  content.assistantGuide,
                  'accessibility',
                  t,
                )}
                // No career, no record to open — not even a locked one.
                hallOfFame={
                  store.career === null
                    ? undefined
                    : hallOfFameViewModel(store.career, t)
                }
                hallOfFameOpen={globalHallOfFameOpen}
                onHallOfFameOpenChange={setGlobalHallOfFameOpen}
                difficultyLabel={
                  store.career?.onboarding?.stage === 'create-player'
                    ? undefined
                    : (store.career?.difficulty ??
                      (store.career ? 'COZY' : undefined))
                }
                saveError={settingsSaveError}
                onVolumeChange={setVolume}
                onToggleReduceMotion={toggleReduceMotion}
                onToggleHudSide={toggleHudSide}
                onToggleHaptics={toggleHaptics}
                onCycleTextScale={cycleTextScale}
                onToggleHighContrast={toggleHighContrast}
                onToggleColorSafeKits={toggleColorSafeKits}
                onToggleCutInMode={toggleCutInMode}
                onRetry3x={retryThreeTimesSpeed}
                onEmailSupport={emailSupport}
                onToggleDeveloperMode={
                  developerModeAvailable ? toggleDeveloperMode : undefined
                }
                onSetAssistantMode={
                  store.career === null ? undefined : handleSetAssistantMode
                }
                onGlossaryOpenChange={setGlobalGlossaryOpen}
                onPrivacySupportOpenChange={setGlobalPrivacySupportOpen}
                onOpenChange={(open) => {
                  setGlobalSettingsOpen(open);
                  if (!open) {
                    setGlobalGlossaryOpen(false);
                    setGlobalPrivacySupportOpen(false);
                    setGlobalHallOfFameOpen(false);
                    setSettingsSaveError(null);
                  }
                }}
              />
            </View>
            {scoutDealsGuideVisible && marketDealsGuideAnchor !== null ? (
              <View
                accessibilityViewIsModal
                accessibilityLabel={t('market.openDealsGuide')}
                style={StyleSheet.absoluteFill}
              >
                <TutorialSpotlight
                  anchor={marketDealsGuideAnchor}
                  viewportWidth={viewportWidth}
                  viewportHeight={viewportHeight}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('market.a11y.dealsDesk')}
                  onPress={() => {
                    setMarketSectionRequest((current) => ({
                      section: 'TRANSFERS',
                      token: (current?.token ?? 0) + 1,
                    }));
                    setConciergeFocus(null);
                  }}
                  style={{
                    position: 'absolute',
                    left: marketDealsGuideAnchor.x,
                    top: marketDealsGuideAnchor.y,
                    width: marketDealsGuideAnchor.width,
                    height: marketDealsGuideAnchor.height,
                  }}
                />
                <TutorialTapCue
                  label={t('market.tapMe')}
                  detail={t('market.tab.deals')}
                  direction="down"
                  reduceMotion={reduceMotion}
                  style={tutorialCuePositionAbove(
                    marketDealsGuideAnchor,
                    viewportWidth,
                    viewportHeight,
                  )}
                />
              </View>
            ) : null}
            {guideOverlayVisible && cupMismatchWarning !== undefined ? (
              <BertBriefingWalkOn
                key={cupMismatchWarning.fixtureId}
                content={content.assistantGuide}
                customMessage={cupMismatchWarning}
                navigationAnchor={navigationGuideAnchor}
                reduceMotion={reduceMotion}
                onDone={store.completeCupMismatchWarning}
              />
            ) : guideOverlayVisible &&
              cupGiantKillingCelebration !== undefined ? (
              <BertBriefingWalkOn
                key={cupGiantKillingCelebration.fixtureId}
                content={content.assistantGuide}
                customMessage={cupGiantKillingCelebration}
                navigationAnchor={navigationGuideAnchor}
                reduceMotion={reduceMotion}
                onDone={store.completeCupGiantKillingCelebration}
              />
            ) : guideOverlayVisible && cupExitConsolationVisible ? (
              <BertBriefingWalkOn
                key="first-cup-exit"
                content={content.assistantGuide}
                // Authored beats rather than a briefing sequence, the same as the
                // giant-killing above it: this is a reaction to one result, not a
                // lesson the career queued. `sequenceId` still names the run of
                // looks in bert-beat-moments so the promise is not delivered by
                // the face that just winced at the scoreline.
                sequenceId="first-cup-exit"
                customMessage={{
                  title: t('firstCupExit.title'),
                  body: [t('firstCupExit.body1'), t('firstCupExit.body2')],
                }}
                navigationAnchor={navigationGuideAnchor}
                reduceMotion={reduceMotion}
                onDone={() =>
                  store.completeGuideMilestone('first-cup-exit-seen')
                }
              />
            ) : guideOverlayVisible && firstCupRoundOf32BriefingVisible ? (
              <BertBriefingWalkOn
                key="first-cup-round-of-32"
                content={content.assistantGuide}
                sequenceId="first-cup-round-of-32"
                customMessage={{
                  title: t('firstCupWin.roundOf32Title'),
                  body: [
                    t('firstCupWin.roundOf32Body1'),
                    t('firstCupWin.roundOf32Body2'),
                  ],
                }}
                navigationAnchor={navigationGuideAnchor}
                reduceMotion={preferences.reduceMotion}
                onDone={() => {
                  setFirstCupRoundOf32Spoken(true);
                  setConciergeFocus('national-cup');
                }}
              />
            ) : guideOverlayVisible && facilityErrorBertVisible ? (
              <BertBriefingWalkOn
                key={`facility-error:${store.error}`}
                content={content.assistantGuide}
                sequenceId="facility-error"
                customMessage={{ body: store.error! }}
                navigationAnchor={navigationGuideAnchor}
                reduceMotion={preferences.reduceMotion}
                onDone={store.clearError}
              />
            ) : guideOverlayVisible && bertNotice !== undefined ? (
              <BertBriefingWalkOn
                key="first-scout-favor"
                content={content.assistantGuide}
                sequenceId="first-scout-favor"
                customMessage={{ body: bertNotice.message }}
                navigationAnchor={navigationGuideAnchor}
                reduceMotion={reduceMotion}
                onDone={store.clearNotice}
              />
            ) : guideOverlayVisible && assistantSequenceId !== null ? (
              <BertBriefingWalkOn
                content={content.assistantGuide}
                sequenceId={assistantSequenceId}
                customMessage={
                  assistantSequenceId === 'board-protection' &&
                  boardConversionBriefing !== undefined
                    ? {
                        ...boardConversionBriefing,
                        focus: 'board-protection',
                      }
                    : undefined
                }
                moneyAnchor={moneyGuideAnchor}
                loanAnchor={loanGuideAnchor}
                navigationAnchor={navigationGuideAnchor}
                subTabAnchor={leagueSubTabGuideAnchor}
                reduceMotion={reduceMotion}
                onFocusChange={setActiveGuideFocus}
                onDone={completeAssistantGuideSequence}
              />
            ) : guideOverlayVisible &&
              facilityComboRevealVisible &&
              facilityComboReveal !== undefined ? (
              <BertBriefingWalkOn
                key={facilityComboReveal.id}
                content={content.assistantGuide}
                sequenceId="facility-adjacency"
                customMessage={{
                  title: t('clubFinances.secretCombo', {
                    pair: facilityComboReveal.pairLabel,
                  }),
                  body: facilityComboReveal.discoveryCopy,
                  focus: 'facility-adjacency',
                }}
                facilityAdjacencyAnchor={facilityAdjacencyGuideAnchor}
                navigationAnchor={navigationGuideAnchor}
                reduceMotion={reduceMotion}
                onFocusChange={setActiveGuideFocus}
                onDone={() => {
                  setActiveGuideFocus(undefined);
                  store.completeGuideMilestone(facilityComboReveal.milestone);
                }}
              />
            ) : guideOverlayVisible && transferWindowLessonVisible ? (
              <BertBriefingWalkOn
                key="transfer-window"
                content={content.assistantGuide}
                customMessage={{
                  title: t('market.transferWindowLessonTitle'),
                  body: [
                    t('bert.custom.transferWindow.body1'),
                    t('bert.custom.transferWindow.body2'),
                  ],
                }}
                navigationAnchor={navigationGuideAnchor}
                reduceMotion={reduceMotion}
                onDone={() =>
                  store.completeGuideMilestone('transfer-window-seen')
                }
              />
            ) : guideOverlayVisible && fansLessonVisible ? (
              <BertBriefingWalkOn
                key="first-fans"
                content={content.assistantGuide}
                // Authored beats rather than a briefing sequence: nothing queued
                // this, the turnstiles did. `sequenceId` still names the run of
                // looks in bert-beat-moments so the good news is not delivered
                // deadpan.
                sequenceId="first-fans"
                customMessage={{
                  title: 'New faces on the terraces',
                  body: [
                    'Fans! You pick them up by winning, going deep in the cup, and climbing a division.',
                    'They pay at the gate every home game, and they buy shirts once you build a shop. Come see where the money lands.',
                  ],
                }}
                navigationAnchor={navigationGuideAnchor}
                reduceMotion={reduceMotion}
                onDone={() => {
                  store.completeGuideMilestone('first-fans-seen');
                  // He said he would show you; the second beat is waiting there.
                  setClubOfficeTab('finances');
                  store.setActiveTab('club');
                }}
              />
            ) : guideOverlayVisible && fansLedgerTourVisible ? (
              <BertBriefingWalkOn
                key="first-fans-ledger"
                content={content.assistantGuide}
                sequenceId="first-fans-ledger"
                customMessage={{
                  body: [
                    'No one loves to look at the finances, except smart guys.',
                    'You’re a smart guy so look at it and make sure you have income streams.',
                    'Build facilities that help with fans or income if you’re short on cash.',
                  ],
                }}
                navigationAnchor={navigationGuideAnchor}
                reduceMotion={reduceMotion}
                onDone={() =>
                  store.completeGuideMilestone('first-fans-ledger-seen')
                }
              />
            ) : guideOverlayVisible && expiredContractLessonVisible ? (
              <BertBriefingWalkOn
                key="expired-contract"
                content={content.assistantGuide}
                sequenceId="expired-contract"
                reduceMotion={reduceMotion}
                onDone={() =>
                  store.completeGuideMilestone('expired-contract-seen')
                }
              />
            ) : null}
            {displayedBoardFinanceMessage !== undefined &&
            openedBoardFinanceAlertId !== null ? (
              <BertBriefingWalkOn
                key={`board-finance-${openedBoardFinanceAlertId}`}
                content={content.assistantGuide}
                // Authored beats rather than a briefing sequence: the sequences are
                // one-shot firsts, and these two rows come back every week the
                // money stays bad. `sequenceId` still names the run of looks in
                // bert-beat-moments so a warning is not delivered cheerfully.
                sequenceId={
                  openedBoardFinanceAlertId === 'emergency-loan'
                    ? 'board-emergency-loan'
                    : 'board-financial-warning'
                }
                customMessage={displayedBoardFinanceMessage}
                navigationAnchor={navigationGuideAnchor}
                reduceMotion={reduceMotion}
                onDone={() => {
                  const completedAlertId = openedBoardFinanceAlertId;
                  const wasLoan = completedAlertId === 'emergency-loan';
                  setOpenedBoardFinanceAlertId(null);
                  setBoardFinanceMessageStartIndex(0);
                  store.dismissInboxProduct(
                    completedAlertId,
                    wasLoan ? 'permanent' : 'current-week',
                  );
                  // He has just told a bailed-out club to build something that
                  // earns. Saying so and leaving the manager on the ledger would
                  // make it advice; opening the board and lighting the two
                  // money-making buildings makes it a next move.
                  if (wasLoan) {
                    setClubOfficeTab('facility');
                    setConciergeFocus('income-facilities');
                    setIncomeFacilitiesFlashToken((token) => token + 1);
                  }
                }}
              />
            ) : null}
            {careerTeaches && store.inboxDutyReminder !== null ? (
              <BertBriefingWalkOn
                key="inbox-duty-reminder"
                content={content.assistantGuide}
                // Authored beats rather than a briefing sequence: this is a reply to
                // a press, not a lesson the career has queued, so it owns its copy
                // here. `sequenceId` still names the run of looks in
                // bert-beat-moments so the joke is not delivered by the face that
                // just refused the manager.
                sequenceId="inbox-duty-reminder"
                customMessage={{
                  title: t(
                    `${inboxDutyCopyStem(store.inboxDutyReminder[0])}.title`,
                  ),
                  body: [
                    t(`${inboxDutyCopyStem(store.inboxDutyReminder[0])}.body`),
                  ],
                }}
                navigationAnchor={navigationGuideAnchor}
                reduceMotion={reduceMotion}
                onDone={store.dismissInboxDutyReminder}
              />
            ) : null}
            {!guideOverlayVisible &&
            rivalHeroIntro === undefined &&
            lowConditionMatchdayStarter !== null ? (
              <MatchdayConditionWarning
                key={lowConditionMatchdayStarter.id}
                playerName={lowConditionMatchdayStarter.name}
                reduceMotion={reduceMotion}
                onDone={() =>
                  store.completeGuideMilestone('match-condition-warning-seen')
                }
              />
            ) : null}
            {coachOverlay !== null ? (
              <CoachStaffOverlay
                mode={coachOverlay.mode}
                coach={coachOverlay.coach}
                reduceMotion={reduceMotion}
                onConfirm={
                  coachOverlay.mode === 'confirm-dismiss'
                    ? confirmCoachDismissal
                    : undefined
                }
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
            {signingWalkOn !== null ? (
              <PlayerWalkOnWelcome
                player={signingWalkOn}
                navigationAnchor={navigationGuideAnchor}
                reduceMotion={reduceMotion}
                onDone={() => setPlayerSigning(null)}
              />
            ) : null}
            {playerSigning !== null && playerSigning.source === 'transfer' ? (
              <PlayerSigningOverlay
                player={playerSigning}
                reduceMotion={reduceMotion}
                onClose={() => setPlayerSigning(null)}
              />
            ) : null}
            {playerSaleFarewell !== null ? (
              <PlayerSaleFarewellWalkOn
                player={playerSaleFarewell}
                navigationAnchor={navigationGuideAnchor}
                reduceMotion={reduceMotion}
                onDone={() => setPlayerSaleFarewell(null)}
              />
            ) : null}
            {midseasonTrainingStage === 'walk-on' &&
            midseasonTrainingVm !== undefined ? (
              <MidseasonTrainingCaptainWalkOn
                viewModel={midseasonTrainingVm}
                navigationAnchor={navigationGuideAnchor}
                reduceMotion={reduceMotion}
                onDone={() => setMidseasonTrainingStage('card')}
              />
            ) : null}
            {midseasonTrainingStage === 'card' &&
            midseasonTrainingVm !== undefined ? (
              <MidseasonTrainingDecisionCard
                viewModel={midseasonTrainingVm}
                reduceMotion={reduceMotion}
                onYes={() => {
                  store.acceptMidseasonTraining();
                  setMidseasonTrainingStage(null);
                }}
                onNo={() => {
                  store.declineMidseasonTraining();
                  setMidseasonTrainingStage(null);
                }}
              />
            ) : null}
            {/* Two stages: the player walks on and says their line, then the card
            asks for a decision. Split so the manager meets the person before
            being asked to price them. */}
            {requestStage === 'walk-on' && playerRequestVm?.pending ? (
              <PlayerRequestWalkOn
                request={playerRequestVm.pending}
                navigationAnchor={navigationGuideAnchor}
                reduceMotion={reduceMotion}
                onDone={() => setRequestStage('card')}
              />
            ) : null}
            {requestStage === 'card' && playerRequestVm?.pending ? (
              <PlayerRequestDecisionCard
                request={playerRequestVm.pending}
                reduceMotion={reduceMotion}
                onGrant={() => {
                  store.resolvePlayerRequest('GRANTED');
                  setRequestStage(null);
                }}
                onRefuse={() => {
                  store.resolvePlayerRequest('REFUSED');
                  setRequestStage(null);
                }}
              />
            ) : null}
          </View>
          {postMatchSummaryVisible && store.postMatch !== null ? (
            <PostMatchSummaryModal
              viewModel={store.postMatch}
              reduceMotion={reduceMotion}
              onDismiss={store.dismissPostMatchSummary}
            />
          ) : null}
          {blockingSaveWarningVisible && store.saveWarning !== null && (
            <SaveWarningBanner
              message={store.saveWarning}
              blocked
              onRetry={store.retrySave}
            />
          )}
          <ConfirmationSheet
            confirmation={pendingConfirmation}
            reduceMotion={reduceMotion}
            onCancel={() => setPendingConfirmation(null)}
            onConfirm={() => {
              if (pendingConfirmation?.confirmDisabled) return;
              const action = pendingConfirmation?.onConfirm;
              setPendingConfirmation(null);
              action?.();
            }}
          />
          {/* Last child on purpose. Stat tips are drawn here, after every card
              and panel, so nothing can paint through them. */}
          <InfoTipLayer />
        </View>
      </SafeAreaProvider>
    </LocaleProvider>
  );
}

function LoadingScreen() {
  const t = useCopy();
  const reduceMotion = useReducedMotion(false);
  const [showIndicator, setShowIndicator] = useState(false);
  const ballTravel = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const revealTimer = setTimeout(
      () => setShowIndicator(true),
      LOADING_INDICATOR_DELAY_MS,
    );
    return () => clearTimeout(revealTimer);
  }, []);

  useEffect(() => {
    if (!showIndicator || reduceMotion) return undefined;
    ballTravel.setValue(0);
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(ballTravel, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(ballTravel, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [ballTravel, reduceMotion, showIndicator]);

  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-ink">
      {showIndicator ? (
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={t('app.a11y.openingClubFiles')}
          className="items-center"
        >
          <View className="relative h-[72px] w-[120px] overflow-hidden border-4 border-paper bg-pitch-dark">
            <View className="absolute left-[56px] top-0 h-full w-1 bg-paper" />
            <View className="absolute left-[42px] top-[18px] h-7 w-7 rounded-full border-[3px] border-paper" />
            <Animated.View
              className="absolute left-3 top-[26px] h-4 w-4 items-center justify-center rounded-full border-2 border-ink bg-paper"
              style={{
                transform: [
                  {
                    translateX: reduceMotion
                      ? 40
                      : ballTravel.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, 80],
                        }),
                  },
                ],
              }}
            >
              <View className="h-1.5 w-1.5 bg-ink" />
            </Animated.View>
          </View>
          <Text className="mt-5 font-pixel text-lg uppercase tracking-widest text-signal">
            {t('app.openingClubFiles')}
          </Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

/** Short work stays visually instant. Only a genuine wait earns a loader. */
const LOADING_INDICATOR_DELAY_MS = 500;

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
      className={
        tone === 'primary'
          ? 'mt-5 min-h-12 items-center justify-center border-2 border-b-4 border-ink bg-blue px-4'
          : 'mt-3 min-h-12 items-center justify-center border-2 border-b-4 border-stamp bg-paper px-4'
      }
      style={[{ transform: [{ translateY: pressed ? 2 : 0 }] }]}
    >
      <Text
        className={
          tone === 'primary'
            ? 'font-pixel text-sm uppercase text-paper'
            : 'font-pixel text-sm uppercase text-stamp'
        }
      >
        {label}
      </Text>
    </Pressable>
  );
}

function BootFailure({
  message,
  guidance,
  onRetry,
  onStartFresh,
  onExportRaw,
  onRestoreBackup,
}: {
  message: string;
  guidance?: string;
  onRetry: () => void;
  onStartFresh?: () => void;
  onExportRaw?: () => void;
  onRestoreBackup?: { season: number; week: number; onRestore: () => void };
}) {
  const t = useCopy();
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
        <Text className="font-pixel text-lg uppercase text-stamp">
          {t('app.weCouldNotOpen')}
        </Text>
        <Text className="mt-3 text-sm leading-5 text-ink/70">
          {t('app.yourSavedCareerHas')}
        </Text>
        {guidance !== undefined && (
          <Text className="mt-3 text-sm leading-5 text-ink">{guidance}</Text>
        )}
        <Text className="mt-2 text-xs leading-4 text-ink/50">
          {t('app.technicalDetail', { detail: message })}
        </Text>
        <BootFailureButton
          tone="primary"
          label={t('app.retry')}
          accessibilityLabel={t('app.a11y.retryOpeningClubFiles')}
          onPress={() => {
            setConfirmingDiscard(false);
            onRetry();
          }}
        />
        {onRestoreBackup !== undefined && (
          <BootFailureButton
            tone="paper"
            label={t('app.restoreSeasonWeek', {
              season: onRestoreBackup.season,
              week: onRestoreBackup.week,
            })}
            accessibilityLabel={t('app.a11y.restoreTheBackup', {
              season: onRestoreBackup.season,
              week: onRestoreBackup.week,
            })}
            onPress={onRestoreBackup.onRestore}
          />
        )}
        {onExportRaw !== undefined && (
          <BootFailureButton
            tone="paper"
            label={t('app.exportRawSave')}
            accessibilityLabel={t('app.a11y.exportTheUnchangedRawSavedCareer')}
            onPress={onExportRaw}
          />
        )}
        {onStartFresh !== undefined && (
          <BootFailureButton
            tone="paper"
            label={
              confirmingDiscard
                ? t('app.tapAgainToDelete')
                : t('app.deleteSaveStartFresh')
            }
            accessibilityLabel={
              confirmingDiscard
                ? t('app.a11y.confirmDeleteSavedCareer')
                : t('app.a11y.deleteSavedCareer')
            }
            onPress={() =>
              confirmingDiscard ? onStartFresh() : setConfirmingDiscard(true)
            }
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
  const t = useCopy();
  // top-0 sat the alert text under the notch/Dynamic Island; pad by the real
  // inset so the first line is always readable.
  const insets = useSafeAreaInsets();
  return (
    <View
      accessibilityViewIsModal={blocked}
      className="absolute inset-x-0 top-0 border-b-4 border-stamp bg-red-light px-4 py-3"
      style={{ paddingTop: insets.top + 12 }}
    >
      <View
        accessible
        accessibilityRole="alert"
        accessibilityLabel={t('app.a11y.saveProblem', { message })}
      >
        <Text className="font-pixel text-sm uppercase text-stamp">
          {t('trainingDrill.yourClubIsNotSaving')}
        </Text>
        <Text className="mt-1 text-xs leading-4 text-ink/70">{message}</Text>
      </View>
      {blocked && (
        <BootFailureButton
          tone="primary"
          label={t('app.trySavingAgain')}
          accessibilityLabel={t('app.a11y.trySavingYourCareerAgain')}
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
  const t = useCopy();
  useEffect(() => {
    if (tone === 'error') return undefined;
    const timer = setTimeout(onDismiss, 4_000);
    return () => clearTimeout(timer);
  }, [message, onDismiss, tone]);

  const palette =
    tone === 'success'
      ? 'border-pitch-dark bg-pitch-light'
      : tone === 'info'
        ? 'border-blue-dark bg-blue-light'
        : 'border-stamp bg-red-light';
  const symbol = tone === 'success' ? '✓' : tone === 'info' ? 'i' : '!';
  return (
    <Pressable
      accessibilityRole={tone === 'error' ? 'alert' : 'button'}
      accessibilityLiveRegion={tone === 'error' ? 'assertive' : 'polite'}
      accessibilityLabel={feedbackNoticeAccessibilityLabel(message, t)}
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

function feedbackNoticeAccessibilityLabel(message: string, t: CopyFn): string {
  const trimmed = message.trim();
  const sentence = /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
  return t('app.a11y.tapToDismiss', { sentence });
}
