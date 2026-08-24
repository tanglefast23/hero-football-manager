import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode, RefObject } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import type { GestureResponderEvent, ViewStyle } from 'react-native';
import type { AssistantGuideFocus, ManagerTipDestination } from '../../content';
import {
  ActionButton,
  Metric,
  PaperPanel,
  SectionLabel,
  StatusChip,
  formatCurrency,
} from '../components/Scorecard';
import { PixelPortrait } from '../components/PixelPortrait';
import type {
  DrillResultViewModel,
  PlayerGiftCelebrationViewModel,
  SquadPlayerViewModel,
  SquadTrainingViewModel,
  TrainingSlotStatOption,
  TrainingUpgradeViewModel,
} from '../models';
import {
  LazyPlayerGiftCelebration as PlayerGiftCelebration,
  preloadPlayerGiftCelebration,
} from '../LazyPlayerGiftCelebration';
import { TutorialTapCue } from '../TutorialTapCue';
import { SfxPressable as Pressable } from '../components/SfxPressable';
import {
  TUTORIAL_TAP_CUE_ABOVE_OFFSET,
  TUTORIAL_TAP_CUE_RESERVED_SPACE,
  TUTORIAL_TAP_CUE_WIDTH,
} from '../tutorial-cue-position';
import {
  nextSquadSort,
  sortSquadPlayers,
  type SquadSort,
  type SquadSortKey,
} from '../squad-sort';
import {
  CELL_MAX_FONT_MULTIPLIER,
  HEADER_MAX_FONT_MULTIPLIER,
  REGISTER_COLUMN_WIDTH,
  SORT_ARROW_GAP,
  SORT_ARROW_HEIGHT,
  SORT_ARROW_WIDTH,
  TRAIN_BUTTON_HIT_SLOP,
} from '../squad-register-columns';
import {
  archetypeDevelopmentSummary,
  type ArchetypeDevelopmentSummary,
} from '../archetype-development';
import {
  shouldDismissTutorialForDrag,
  type TutorialTouchPoint,
} from '../tutorial-drag-dismiss';
import { SectionFlow, type FlowSection } from '../layout/SectionFlow';
import { useLayoutMode } from '../layout/use-layout-mode';
import { PixelText } from '../components/PixelText';
import { InfoTip } from '../components/InfoTip';
import { energyBand } from '../../render/match-energy-ui';
import { useDesktopContentStyle } from '../layout/DesktopClamp';
import { useTapGuard } from '../use-tap-guard';
import { useGuideAnchor } from '../use-guide-anchor';
import type { TutorialAnchorLayout } from '../tutorial-cue-position';
import {
  LOYALTY_NO_RENEWAL_THRESHOLD,
  LOYALTY_WARNING_THRESHOLD,
} from '../../game/loyalty';
import { GUIDED_ALERT_GLOW } from '../guidance-glow';
import { SquadRequestsPanel } from './SquadRequestsPanel';
import type { PlayerRequestViewModel } from '../../application/player-request-view-model';
import { useCopy, type CopyFn } from '../../i18n';
import {
  GuidanceDoubleFlash,
  type GuidanceNudgeTarget,
} from '../GuidanceDoubleFlash';
import { copyOrEnglish } from '../../application/copy-fallback';
import {
  LazyTrainingDrillModal as TrainingDrillModal,
  preloadTrainingDrillModal,
} from '../LazyTrainingDrillModal';

/**
 * The roster reads condition on the same three bands as the drill popup and
 * every match energy bar, so 40% cannot look calm in the register and amber one
 * tap deeper. Red is bold as well as coloured: at that level it is a warning,
 * not a reading.
 */
const CONDITION_TONE: Readonly<Record<'green' | 'amber' | 'red', string>> = {
  green: 'text-ink',
  amber: 'text-gold-dark',
  // font-pixel, not font-bold: Silkscreen ships one weight per file, so a bold
  // request on the regular cut is synthetic and smears the bitmap.
  red: 'font-pixel text-stamp',
};

/**
 * What each roster column actually means. The words are short because the
 * heading already names the thing — the tip answers "so what?", not "what?".
 *
 * The maps hold catalog keys rather than the sentences themselves: a module
 * constant is built before any component runs, so it cannot reach `useCopy`.
 * The prose lives in `content/i18n/en.json` under the same key names.
 */
const PERSONALITY_EXPLAINER: Readonly<Record<string, string>> = {
  // Straight off market.ts: LOVED_PITCHES, HATED_PITCHES, and the renewal ask
  // multiplier. Nothing here is flavour — every line names a real effect.
  FIERY: 'squadTraining.personality.fiery',
  LOYAL: 'squadTraining.personality.loyal',
  GREEDY: 'squadTraining.personality.greedy',
  JOKER: 'squadTraining.personality.joker',
  PROFESSIONAL: 'squadTraining.personality.professional',
  TIMID: 'squadTraining.personality.timid',
};

function personalityExplainer(personality: string, t: CopyFn): string {
  return t(
    PERSONALITY_EXPLAINER[personality.toUpperCase().replace('-', '_')] ??
      'squadTraining.personality.default',
  );
}

/**
 * The archetype's strengths and weaknesses as one sentence.
 *
 * The row prints the same two phrases abbreviated to fit the column ("+5% ALL
 * STATS  NO WEAK SPOT"); this is what the tip and the screen reader get.
 */
function archetypeExplainer(
  archetype: ArchetypeDevelopmentSummary | undefined,
  t: CopyFn,
): string {
  if (archetype === undefined) return t('squadTraining.archetype');
  return `${copyOrEnglish(t, archetype.strengthsKey, archetype.strengths)}. ${copyOrEnglish(t, archetype.weaknessesKey, archetype.weaknesses)}.`;
}

const PROMISE_DETAIL: Readonly<
  Record<NonNullable<SquadPlayerViewModel['contractPromisePerk']>, string>
> = {
  GUARANTEED_STARTER: 'market.perkStarterDetail',
  CAPTAINCY: 'market.perkCaptaincyDetail',
  TRAINING_PRIORITY: 'market.perkTrainingDetail',
  JERSEY_10: 'market.perkJerseyDetail',
};

/**
 * Everything the roster row has to clip, written out.
 *
 * The register is a table: every cell in the name column is one line with
 * `numberOfLines={1}`, so a promise, a captaincy and a power name all end in an
 * ellipsis on a narrow column. This is the same content unabbreviated, and it
 * adds the one thing the row could never show — what the promise obliges the
 * club to do.
 */
function rosterRowSummary(player: SquadPlayerViewModel, t: CopyFn): string {
  const promiseDetail =
    player.contractPromisePerk === undefined
      ? undefined
      : t(PROMISE_DETAIL[player.contractPromisePerk]);
  return [
    `${player.name} — ${player.role}`,
    player.injuryWeeks > 0
      ? t('squadTraining.outForWeeks', {
          n: player.injuryWeeks,
          count: player.injuryWeeks,
        })
      : player.isStarter && player.contractPromisePerk !== 'GUARANTEED_STARTER'
        ? t('storyEvent.startingXi')
        : undefined,
    player.isCaptain && player.contractPromisePerk !== 'CAPTAINCY'
      ? t('squadTraining.captain')
      : undefined,
    player.shirtNumber === undefined ? undefined : `#${player.shirtNumber}`,
    player.contractLabel,
    player.contractPromiseLabel === undefined
      ? undefined
      : `${player.contractPromiseLabel}: ${promiseDetail}`,
    player.powerName === undefined ? undefined : `★ ${player.powerName}`,
    player.retirementLabel,
  ]
    .filter(Boolean)
    .join('\n');
}

const COLUMN_EXPLAINER: Readonly<Record<SquadSortKey, string>> = {
  player: 'squadTraining.column.player',
  role: 'squadTraining.column.role',
  overall: 'squadTraining.column.overall',
  // Was "A high grade trains faster and further", which was wrong twice over:
  // the grade contributed nothing to the ordinary gain, and the "further" was a
  // cap that cap-free development retired. It now measures what the column is
  // read for, so the words can finally match it.
  potential: 'squadTraining.column.potential',
  condition: 'squadTraining.column.condition',
};

/**
 * Which drill in the career earns the condition warning. Not the first: the
 * manager has to watch the number fall a couple of times before being told
 * what a low one costs, or the warning is just noise on a full-energy squad.
 */
/**
 * The seven stats, in words. These are the game's core vocabulary and none of
 * them is guessable from three letters — TEC and STA in particular say nothing
 * to a manager who has not been told. Each line says what the stat *does* in a
 * match, not what the letters stand for: knowing SHO is "shooting" is not the
 * question, knowing it decides whether the ball goes in is.
 */
const ATTRIBUTE_EXPLAINER: Readonly<Record<string, string>> = {
  PAC: 'squadTraining.attribute.pac',
  SHO: 'squadTraining.attribute.sho',
  PAS: 'squadTraining.attribute.pas',
  DEF: 'squadTraining.attribute.def',
  TEC: 'squadTraining.attribute.tec',
  STA: 'squadTraining.attribute.sta',
  REF: 'squadTraining.attribute.ref',
};

const CONDITION_WARNING_DRILL = 3;

/** How far below the viewport top an explicitly requested guide target sits. */
const SQUAD_GUIDE_FRAME_TOP = 96;
/**
 * Every fixed register column, header and cells alike, in points. Deriving
 * them lives in squad-register-columns.ts, which explains why they are points
 * and not Tailwind width classes: `w-12` is 42pt on native, not 48, and the
 * role header used to sit 6pt left of the role cells because of it.
 */
type RosterColumnStyles = Record<
  'role' | 'overall' | 'potential' | 'condition',
  ViewStyle
>;
const ROSTER_COLUMN_STYLE: {
  phone: RosterColumnStyles;
  wide: RosterColumnStyles;
} = {
  phone: StyleSheet.create({
    role: { width: REGISTER_COLUMN_WIDTH.phone.role, flexShrink: 0 },
    overall: { width: REGISTER_COLUMN_WIDTH.phone.overall, flexShrink: 0 },
    potential: { width: REGISTER_COLUMN_WIDTH.phone.potential, flexShrink: 0 },
    condition: { width: REGISTER_COLUMN_WIDTH.phone.condition, flexShrink: 0 },
  }),
  wide: StyleSheet.create({
    role: { width: REGISTER_COLUMN_WIDTH.wide.role, flexShrink: 0 },
    overall: { width: REGISTER_COLUMN_WIDTH.wide.overall, flexShrink: 0 },
    potential: { width: REGISTER_COLUMN_WIDTH.wide.potential, flexShrink: 0 },
    condition: { width: REGISTER_COLUMN_WIDTH.wide.condition, flexShrink: 0 },
  }),
};
/** The train circle plus its gutter. */
const ROSTER_TRAIN_COLUMN_CLASS = 'w-11';

export interface SquadTrainingScreenProps {
  viewModel: SquadTrainingViewModel;
  /** The player currently focused for the profile card and drill popup (mirrors store.selectedPlayerId). */
  selectedPlayerId?: string;
  /** Passing undefined clears the selection, which sorting the register does. */
  onSelectPlayer: (playerId: string | undefined) => void;
  /** Resolves the drill instantly; the popup stays open for chain taps. */
  onTrainDrill: (playerId: string, pathId: string) => void;
  /** Resolves the drills queued behind the one on screen, without their cards. */
  onTrainDrillBatch: (playerId: string, pathId: string, runs: number) => void;
  /** Buys the next drill tier for one path. Money, not TP. */
  onBuyDrillUpgrade: (pathId: string) => void;
  /** Opens the paid D3-D1 team-trip confirmation. */
  onBookGreenBullTraining?: () => void;
  /** The latest resolved drill, sequenced so the popup can animate repeats. */
  lastDrillResult: DrillResultViewModel | null;
  /** Consumes the result when its popup closes so a later mount cannot replay it. */
  onClearDrillResult?: () => void;
  trainingPoints: number;
  guideTraining?: boolean;
  guidanceNudgeTarget?: GuidanceNudgeTarget;
  guidanceNudgeToken?: number;
  guideFocus?: AssistantGuideFocus;
  reduceMotion?: boolean;
  /** Bumped by the app shell to pop the drill popup for the selected player (inbox deep link). */
  drillPickerRequestToken?: number;
  /** Store save warning, shown inside the drill modal (a Modal covers the app banner). */
  saveWarning?: string | null;
  /** True once Bert has given the condition lesson; it is one per career. */
  conditionWarningSeen?: boolean;
  onConditionWarningShown?: () => void;
  /**
   * The week-6 Quick Train lesson. It first points to a healthy player, then
   * leads the manager down to the attribute boxes without selecting or
   * scrolling for them.
   */
  guideQuickTrain?: boolean;
  onQuickTrainShown?: () => void;
  /** Changes after any completed screen tap so floating tips can retire together. */
  dismissTipsToken?: number;
  /** The Requests tab's model. `available: false` hides the tab row entirely. */
  requestViewModel?: PlayerRequestViewModel;
  /** Starts the walk-on; the decision card follows it. */
  onOpenRequest?: () => void;
  /**
   * Which sub-tab the screen opens on. Drills in the game, because that is what
   * the Squad tab is most weeks; the dev harness opens straight on Requests so
   * an address reaches the panel without a tap. Read once — after that the tab
   * row owns the choice.
   */
  initialSquadTab?: 'drills' | 'requests';
  /** A Manager's Tip deep-link and its fresh request identity. */
  managerTipGuideRequest?: {
    target: ManagerTipDestination;
    token: number;
  };
  /** Week 12 roster lesson. Any completed screen tap dismisses it permanently. */
  showSortHint?: boolean;
  /** The saved roster ordering. Held by the app shell so it survives leaving the tab. */
  squadSort: SquadSort | null;
  onChangeSquadSort: (sort: SquadSort | null) => void;
  /** Opens the lay-off offers for this player. Omitted where sales are locked. */
  onLayOffPlayer?: (playerId: string) => void;
  /** Buys the selected player one weekly morale gift. */
  onGiftPlayer?: (playerId: string) => void;
  guideGiftPlayerId?: string;
  onGiftGuideAnchorChange?: (anchor: TutorialAnchorLayout | null) => void;
  lastPlayerGiftResult?: PlayerGiftCelebrationViewModel | null;
  onClearPlayerGiftResult?: () => void;
  /** Fixed capture offset for deterministic store-media scenes. */
  initialScrollY?: number;
}

export function SquadTrainingScreen({
  viewModel,
  selectedPlayerId,
  onSelectPlayer,
  onTrainDrill,
  onTrainDrillBatch,
  onBuyDrillUpgrade,
  onBookGreenBullTraining,
  lastDrillResult,
  onClearDrillResult,
  trainingPoints,
  guideTraining = false,
  guidanceNudgeTarget,
  guidanceNudgeToken,
  guideFocus,
  reduceMotion = false,
  drillPickerRequestToken,
  saveWarning = null,
  conditionWarningSeen = false,
  onConditionWarningShown,
  guideQuickTrain = false,
  onQuickTrainShown,
  dismissTipsToken = 0,
  requestViewModel,
  onOpenRequest,
  initialSquadTab = 'drills',
  managerTipGuideRequest,
  showSortHint = false,
  squadSort,
  onChangeSquadSort,
  onLayOffPlayer,
  onGiftPlayer,
  guideGiftPlayerId,
  onGiftGuideAnchorChange,
  lastPlayerGiftResult = null,
  onClearPlayerGiftResult,
  initialScrollY,
}: SquadTrainingScreenProps) {
  const t = useCopy();
  const desktopContent = useDesktopContentStyle();
  const { width } = useWindowDimensions();
  const wideColumns = width >= 600;
  // Wide columns spell their headers out in full ("SCORE", "POTENTIAL",
  // "CONDITION"), so each one has to be wide enough to hold the word plus its
  // sort arrow — a clipped header reads as a bug, not as an abbreviation.
  //
  // Both sets of widths are derived in squad-register-columns.ts: each holds
  // its own label at the largest text size a header may reach, plus the arrow,
  // plus a gutter to the column beside it. The name is the only flexible cell,
  // so the name pays. Header and row share one style, so they cannot drift.
  const columns = wideColumns
    ? ROSTER_COLUMN_STYLE.wide
    : ROSTER_COLUMN_STYLE.phone;
  // Desktop browsers have room for the 13px caption token. Native wide layouts
  // stay at text-xs because Dynamic Type can still grow them by another 25%.
  const headerLabelSize =
    wideColumns && Platform.OS === 'web'
      ? 'text-[13px]'
      : wideColumns
        ? 'text-xs'
        : 'text-[10px]';
  const selectedPlayer = viewModel.players.find(
    (player) => player.id === selectedPlayerId,
  );
  const guideGift = selectedPlayer?.id === guideGiftPlayerId;
  const {
    anchorRef: giftGuideRef,
    scheduleMeasurement: scheduleGiftGuideMeasurement,
  } = useGuideAnchor(guideGift, onGiftGuideAnchorChange);
  const selectedArchetype =
    selectedPlayer === undefined
      ? undefined
      : archetypeDevelopmentSummary(selectedPlayer.archetype);
  const playerGuideTouchStartRef = useRef<TutorialTouchPoint | null>(null);
  const [squadTab, setSquadTab] = useState<'drills' | 'requests'>(
    initialSquadTab,
  );
  useEffect(() => {
    if (
      guideFocus === 'squad-requests' &&
      requestViewModel?.pending !== undefined
    ) {
      setSquadTab('requests');
    }
  }, [guideFocus, requestViewModel?.pending]);
  const [drillPickerOpen, setDrillPickerOpen] = useState(false);
  const [playerGuideDismissed, setPlayerGuideDismissed] = useState(false);
  /**
   * The Train glow outlives the tap cue on purpose: scrolling dismisses the
   * floating "Tap here" arrow, but the button keeps glowing until it is actually
   * pressed, so the one thing the manager still owes the guide stays lit.
   */
  const [trainingCueUsed, setTrainingCueUsed] = useState(false);
  /**
   * The player whose condition the warning is pointing at, set by the third
   * drill of the career and cleared by the next thing the manager does. It
   * waits for the drill popup to close, because the popup covers the roster.
   */
  const [conditionCuePlayerId, setConditionCuePlayerId] = useState<
    string | null
  >(null);
  const lastDismissTipsTokenRef = useRef(dismissTipsToken);
  const [managerTipGuideTarget, setManagerTipGuideTarget] =
    useState<ManagerTipDestination | null>(null);
  /** The stat the manager tapped in the player file, aimed at its drill. */
  const [quickTrainPathId, setQuickTrainPathId] = useState<string | undefined>(
    undefined,
  );
  const scrollRef = useRef<ScrollView>(null);
  const scrollViewportRef = useRef<View>(null);
  const latestScrollOffsetRef = useRef(0);
  const initialScrollAppliedRef = useRef(false);
  const drillShopRef = useRef<View>(null);
  const attributesRef = useRef<View>(null);
  /**
   * Scrolls the list so `target` sits just below the viewport's top edge.
   *
   * `scrollTo` takes a CONTENT offset; `measureInWindow` reports a WINDOW
   * position. Handing one straight to the other only lands when the list is
   * already at the top, so a guide fired after any scrolling undershot by the
   * offset already scrolled. Both measurements are in window coordinates here,
   * which cancels the column nesting, and the tracked offset converts the
   * result back into content space. Same rule the Club Finances screen uses.
   */
  const scrollGuideTargetIntoView = useCallback(
    (target: RefObject<View | null>, margin = SQUAD_GUIDE_FRAME_TOP) => {
      const viewport = scrollViewportRef.current;
      const node = target.current;
      if (viewport === null || node === null) return;
      viewport.measureInWindow((_vx, viewportY) => {
        node.measureInWindow((_tx, targetY) => {
          scrollRef.current?.scrollTo({
            y: Math.max(
              0,
              latestScrollOffsetRef.current + (targetY - viewportY) - margin,
            ),
            animated: true,
          });
        });
      });
    },
    [],
  );
  const setSquadSort = useCallback(
    (key: SquadSortKey) => {
      // A sort is a statement about the whole register, so it drops the current
      // selection. Keeping it left the open player file reading as a row pinned
      // above the order it was supposed to obey.
      onSelectPlayer(undefined);
      onChangeSquadSort(nextSquadSort(squadSort, key));
    },
    [onChangeSquadSort, onSelectPlayer, squadSort],
  );
  const sortedPlayers = useMemo(
    () => sortSquadPlayers(viewModel.players, squadSort),
    [squadSort, viewModel.players],
  );
  const guidePlayers = guideTraining;

  const dismissPlayerGuide = useCallback(() => {
    if (guidePlayers) setPlayerGuideDismissed(true);
  }, [guidePlayers]);

  const rememberPlayerGuideTouch = useCallback(
    (event: GestureResponderEvent) => {
      if (!guidePlayers || playerGuideDismissed) return;
      playerGuideTouchStartRef.current = {
        x: event.nativeEvent.pageX,
        y: event.nativeEvent.pageY,
      };
    },
    [guidePlayers, playerGuideDismissed],
  );

  const dismissPlayerGuideAfterDrag = useCallback(
    (event: GestureResponderEvent) => {
      const start = playerGuideTouchStartRef.current;
      if (!guidePlayers || playerGuideDismissed || start === null) return;
      if (
        shouldDismissTutorialForDrag(start, {
          x: event.nativeEvent.pageX,
          y: event.nativeEvent.pageY,
        })
      ) {
        dismissPlayerGuide();
        playerGuideTouchStartRef.current = null;
      }
    },
    [dismissPlayerGuide, guidePlayers, playerGuideDismissed],
  );

  const forgetPlayerGuideTouch = useCallback(() => {
    playerGuideTouchStartRef.current = null;
  }, []);

  const handleTrainingBadgePress = useCallback(
    (playerId: string) => {
      setTrainingCueUsed(true);
      setQuickTrainPathId(undefined);
      onSelectPlayer(playerId);
      setDrillPickerOpen(true);
    },
    [onSelectPlayer],
  );

  // Stable so the popup's consume effect does not re-run on every render.
  const forgetQuickTrainRequest = useCallback(() => {
    setQuickTrainPathId(undefined);
  }, []);

  /** Quick Train: the attribute IS the drill picker. */
  const handleTrainAttribute = useCallback(
    (pathId: string) => {
      setTrainingCueUsed(true);
      setQuickTrainPathId(pathId);
      setDrillPickerOpen(true);
      // Doing the thing retires the lesson; there is nothing left to teach.
      onQuickTrainShown?.();
    },
    [onQuickTrainShown],
  );

  useEffect(() => {
    if (drillPickerRequestToken === undefined) return;
    setDrillPickerOpen(true);
  }, [drillPickerRequestToken]);

  // Fetch the drill popup's bundle while the roster is being read, so pressing
  // + opens it instead of starting the download.
  useEffect(() => {
    void preloadTrainingDrillModal();
  }, []);

  // The result is consumed when the drill popup closes, so a later Squad mount
  // cannot rebuild this one-time cue from stale store state.
  useEffect(() => {
    if (lastDrillResult?.totalDrillsRun !== CONDITION_WARNING_DRILL) return;
    setConditionCuePlayerId(lastDrillResult.playerId);
  }, [lastDrillResult]);

  const dismissConditionCue = useCallback(
    () => setConditionCuePlayerId(null),
    [],
  );

  useEffect(() => {
    if (lastDismissTipsTokenRef.current === dismissTipsToken) return;
    lastDismissTipsTokenRef.current = dismissTipsToken;
    dismissPlayerGuide();
    dismissConditionCue();
    setManagerTipGuideTarget(null);
  }, [dismissConditionCue, dismissPlayerGuide, dismissTipsToken]);

  useEffect(() => {
    if (managerTipGuideRequest === undefined) return;
    const { target } = managerTipGuideRequest;
    setManagerTipGuideTarget(target);

    // Let the guide's reserved space lay out before measuring. The second frame
    // puts the target under the persistent HUD rather than under the tooltip.
    let secondFrame: number | null = null;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        if (target === 'drill-shop') scrollGuideTargetIntoView(drillShopRef);
      });
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      if (secondFrame !== null) cancelAnimationFrame(secondFrame);
    };
  }, [managerTipGuideRequest, scrollGuideTargetIntoView]);

  // Quick Train lesson, second beat: the manager has tapped a healthy player
  // and the cue now points at the attribute grid, which sits below the fold on
  // a phone. Telling him to scroll and then not scrolling is the lesson failing
  // at its own instruction, so the screen goes there for him. Same two-frame
  // measure as the drill-shop tip above: the guide's reserved space has to lay
  // out before the panel's window position means anything.
  const quickTrainScrollTargetId =
    guideQuickTrain && selectedPlayer?.injuryWeeks === 0
      ? selectedPlayer.id
      : null;
  useEffect(() => {
    if (quickTrainScrollTargetId === null) return;
    let secondFrame: number | null = null;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        scrollGuideTargetIntoView(attributesRef);
      });
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      if (secondFrame !== null) cancelAnimationFrame(secondFrame);
    };
  }, [quickTrainScrollTargetId, scrollGuideTargetIntoView]);

  useEffect(() => {
    if (!guideGift) return;
    let secondFrame: number | null = null;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        scrollGuideTargetIntoView(giftGuideRef);
        scheduleGiftGuideMeasurement();
      });
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      if (secondFrame !== null) cancelAnimationFrame(secondFrame);
    };
  }, [
    giftGuideRef,
    guideGift,
    scheduleGiftGuideMeasurement,
    scrollGuideTargetIntoView,
  ]);

  const layoutMode = useLayoutMode();

  const sections: FlowSection[] = [
    ...(viewModel.greenBullTraining === undefined ||
    onBookGreenBullTraining === undefined
      ? []
      : [
          {
            key: 'green-bull-training',
            weight: 3,
            node: (
              <GreenBullTrainingSection
                offer={viewModel.greenBullTraining}
                onBook={onBookGreenBullTraining}
              />
            ),
          },
        ]),
    {
      key: 'roster',
      weight: 3 + viewModel.players.length,
      node: (
        <RosterSection
          viewModel={viewModel}
          guidePlayers={guidePlayers}
          playerGuideDismissed={playerGuideDismissed}
          trainingCueUsed={trainingCueUsed}
          conditionCuePlayerId={drillPickerOpen ? null : conditionCuePlayerId}
          wideColumns={wideColumns}
          columns={columns}
          headerLabelSize={headerLabelSize}
          squadSort={squadSort}
          setSquadSort={setSquadSort}
          sortedPlayers={sortedPlayers}
          trainingPoints={trainingPoints}
          selectedPlayerId={selectedPlayerId}
          guideQuickTrain={guideQuickTrain}
          guidanceNudgeTarget={guidanceNudgeTarget}
          guidanceNudgeToken={guidanceNudgeToken}
          reduceMotion={reduceMotion}
          guideFocus={guideFocus}
          showSortHint={showSortHint}
          onSelectPlayer={onSelectPlayer}
          onPressTrainingBadge={handleTrainingBadgePress}
        />
      ),
    },
    ...(selectedPlayer
      ? [
          {
            key: 'player-file',
            weight: 9,
            node: (
              <PlayerFileSection
                selectedPlayer={selectedPlayer}
                selectedArchetype={selectedArchetype}
                statOptions={viewModel.selectedPlayerStatOptions}
                onTrainAttribute={handleTrainAttribute}
                guideQuickTrain={
                  guideQuickTrain && selectedPlayer.injuryWeeks === 0
                }
                attributesRef={attributesRef}
                onLayOff={onLayOffPlayer}
                gift={viewModel.selectedPlayerGift}
                onGift={onGiftPlayer}
                giftGuideRef={giftGuideRef}
                onGiftGuideLayout={scheduleGiftGuideMeasurement}
              />
            ),
          },
        ]
      : []),
    {
      key: 'drill-shop',
      weight: 3 + viewModel.drillUpgrades.length,
      node: (
        <View
          ref={drillShopRef}
          collapsable={false}
          className={
            managerTipGuideTarget === 'drill-shop'
              ? 'relative mt-20 border-2 border-blue-dark bg-blue-light/20 p-1'
              : 'relative'
          }
        >
          {managerTipGuideTarget === 'drill-shop' ? (
            <TutorialTapCue
              label={t('squadTraining.drillTiers')}
              detail={t('squadTraining.drillsUnlockAsYou')}
              style={{
                left: '50%',
                marginLeft: -TUTORIAL_TAP_CUE_WIDTH / 2,
                top: -TUTORIAL_TAP_CUE_ABOVE_OFFSET,
              }}
            />
          ) : null}
          <DrillShopSection
            upgrades={viewModel.drillUpgrades}
            money={viewModel.resources.money}
            onBuy={onBuyDrillUpgrade}
          />
        </View>
      ),
    },
  ];

  return (
    <View ref={scrollViewportRef} collapsable={false} className="flex-1">
      <ScrollView
        ref={scrollRef}
        className="flex-1"
        contentContainerStyle={[
          { padding: 16, paddingBottom: 28 },
          desktopContent,
        ]}
        scrollEventThrottle={16}
        onContentSizeChange={() => {
          if (initialScrollY === undefined || initialScrollAppliedRef.current)
            return;
          initialScrollAppliedRef.current = true;
          scrollRef.current?.scrollTo({ y: initialScrollY, animated: false });
        }}
        onScroll={(event) => {
          latestScrollOffsetRef.current = event.nativeEvent.contentOffset.y;
          if (guideGift) scheduleGiftGuideMeasurement();
        }}
        onScrollBeginDrag={() => {
          dismissPlayerGuide();
          dismissConditionCue();
        }}
        onTouchStart={rememberPlayerGuideTouch}
        onTouchMove={dismissPlayerGuideAfterDrag}
        onTouchEnd={forgetPlayerGuideTouch}
        onTouchCancel={forgetPlayerGuideTouch}
      >
        <View className="mb-6">
          <PixelText className="text-sm uppercase tracking-[2px] text-blue-dark">
            {t('squadTraining.squadRoom')}
          </PixelText>
          <PixelText className="mt-1 text-xl uppercase text-ink">
            {t('squadTraining.rosterTraining')}
          </PixelText>
        </View>

        {/* Drawn like the league's division selector so the two read as one
            vocabulary. Absent entirely before season 2 week 5 — the row
            appearing is part of what makes Bert's briefing feel like it
            unlocked something. */}
        {requestViewModel?.available ? (
          <View className="mb-5 flex-row gap-1">
            {(['drills', 'requests'] as const).map((tab) => {
              const selected = tab === squadTab;
              const glowing =
                tab === 'requests' && requestViewModel.glowing && !selected;
              const label =
                tab === 'drills'
                  ? t('squadTraining.tab.drills')
                  : t('squadTraining.tab.requests');
              return (
                <Pressable
                  key={tab}
                  accessibilityRole="tab"
                  accessibilityLabel={
                    glowing
                      ? t('squadTraining.a11y.tabOneWaiting', { tab: label })
                      : t('squadTraining.a11y.tab', { tab: label })
                  }
                  accessibilityState={{ selected }}
                  onPress={() => setSquadTab(tab)}
                  className={
                    selected
                      ? 'min-h-14 flex-1 items-center justify-center border-2 border-b-4 border-blue-dark bg-blue-light px-1 py-2'
                      : 'min-h-14 flex-1 items-center justify-center border-2 border-b-4 border-ink/40 bg-white px-1 py-2'
                  }
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.82 : 1,
                    transform: [{ translateY: pressed ? 2 : 0 }],
                    ...(glowing ? GUIDED_ALERT_GLOW : {}),
                  })}
                >
                  <Text className="font-pixel text-sm uppercase text-ink">
                    {label}
                    {glowing ? '  \u25CF' : ''}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {requestViewModel?.available && squadTab === 'requests' ? (
          <SquadRequestsPanel
            viewModel={requestViewModel}
            onOpenRequest={() => onOpenRequest?.()}
            reduceMotion={reduceMotion}
          />
        ) : (
          <SectionFlow mode={layoutMode} sections={sections} />
        )}
      </ScrollView>
      {drillPickerOpen &&
      selectedPlayer &&
      viewModel.selectedPlayerStatOptions ? (
        <Suspense fallback={null}>
          <TrainingDrillModal
            playerId={selectedPlayer.id}
            playerName={selectedPlayer.name}
            playerRole={selectedPlayer.role}
            playerLookId={selectedPlayer.lookId}
            options={viewModel.selectedPlayerStatOptions}
            superChancePercent={selectedPlayer.superChancePercent}
            drillsUntilGuaranteedSuper={
              selectedPlayer.drillsUntilGuaranteedSuper
            }
            injuryRiskPercent={selectedPlayer.injuryRiskPercent}
            condition={selectedPlayer.condition}
            injuryWeeks={selectedPlayer.injuryWeeks}
            trainingPoints={trainingPoints}
            lastDrillResult={lastDrillResult}
            promiseGate={viewModel.trainingPromiseGate}
            onSwitchToPromised={onSelectPlayer}
            onTrainDrill={onTrainDrill}
            onTrainDrillBatch={onTrainDrillBatch}
            onDismiss={() => {
              setDrillPickerOpen(false);
              onClearDrillResult?.();
            }}
            reduceMotion={reduceMotion}
            saveWarning={saveWarning}
            quickTrainPathId={quickTrainPathId}
            onQuickTrainConsumed={forgetQuickTrainRequest}
            conditionWarningSeen={conditionWarningSeen}
            onConditionWarningShown={onConditionWarningShown}
          />
        </Suspense>
      ) : null}
      {lastPlayerGiftResult === null ||
      onClearPlayerGiftResult === undefined ? null : (
        <Suspense fallback={null}>
          <PlayerGiftCelebration
            result={lastPlayerGiftResult}
            reduceMotion={reduceMotion}
            onDone={onClearPlayerGiftResult}
          />
        </Suspense>
      )}
    </View>
  );
}

function GreenBullTrainingSection({
  offer,
  onBook,
}: {
  offer: NonNullable<SquadTrainingViewModel['greenBullTraining']>;
  onBook: () => void;
}) {
  const t = useCopy();
  const blockedLabel =
    offer.blockedReason === 'USED_THIS_WEEK'
      ? t('greenBullTraining.usedThisWeek')
      : offer.blockedReason === 'INDIVIDUAL_TRAINING_USED'
        ? t('greenBullTraining.individualTrainingUsed')
        : offer.blockedReason === 'NOT_ENOUGH_TP'
          ? t('greenBullTraining.needTrainingPoints', {
              tp: offer.trainingPointsRequired,
            })
          : offer.blockedReason === 'NOT_ENOUGH_CASH'
            ? t('greenBullTraining.needCash', {
                cost: formatCurrency(t, offer.cost),
              })
            : undefined;
  return (
    <PaperPanel
      kicker={t('greenBullTraining.kicker')}
      title={t('midseasonTraining.centerName')}
      className="bg-pitch-light"
    >
      <Text className="text-sm leading-5 text-ink/70">
        {t('greenBullTraining.detail', {
          cost: formatCurrency(t, offer.cost),
          gain: offer.statGain,
          condition: offer.conditionCost,
        })}
      </Text>
      <Text className="mt-2 text-sm leading-5 text-ink/60">
        {t('greenBullTraining.requirement', {
          tp: offer.trainingPointsRequired,
        })}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={blockedLabel ?? t('greenBullTraining.bookTraining')}
        accessibilityState={{ disabled: blockedLabel !== undefined }}
        disabled={blockedLabel !== undefined}
        onPress={onBook}
        className={
          blockedLabel === undefined
            ? 'mt-4 min-h-12 items-center justify-center border-2 border-b-4 border-pitch-ink bg-pitch px-3 py-2'
            : 'mt-4 min-h-12 items-center justify-center border-2 border-ink/30 bg-paper-dark px-3 py-2 opacity-60'
        }
      >
        <PixelText className="text-center text-sm uppercase text-ink">
          {blockedLabel ?? t('greenBullTraining.bookTraining')}
        </PixelText>
      </Pressable>
    </PaperPanel>
  );
}

interface RosterSectionProps {
  viewModel: SquadTrainingViewModel;
  guidePlayers: boolean;
  playerGuideDismissed: boolean;
  trainingCueUsed: boolean;
  /** Set while the condition warning is pointing at this player's row. */
  conditionCuePlayerId: string | null;
  wideColumns: boolean;
  /** One width per fixed column, shared by the header and the cells below it. */
  columns: RosterColumnStyles;
  headerLabelSize: string;
  squadSort: SquadSort | null;
  setSquadSort: (key: SquadSortKey) => void;
  sortedPlayers: readonly SquadPlayerViewModel[];
  trainingPoints: number;
  selectedPlayerId?: string;
  guideQuickTrain: boolean;
  guidanceNudgeTarget?: GuidanceNudgeTarget;
  guidanceNudgeToken?: number;
  reduceMotion: boolean;
  guideFocus?: AssistantGuideFocus;
  showSortHint: boolean;
  onSelectPlayer: (playerId: string) => void;
  onPressTrainingBadge: (playerId: string) => void;
}

function RosterSection({
  viewModel,
  guidePlayers,
  playerGuideDismissed,
  trainingCueUsed,
  conditionCuePlayerId,
  wideColumns,
  columns,
  headerLabelSize,
  squadSort,
  setSquadSort,
  sortedPlayers,
  trainingPoints,
  selectedPlayerId,
  guideQuickTrain,
  guidanceNudgeTarget,
  guidanceNudgeToken,
  reduceMotion,
  guideFocus,
  showSortHint,
  onSelectPlayer,
  onPressTrainingBadge,
}: RosterSectionProps) {
  const t = useCopy();
  // The lesson is about the column, so it only needs to know that some player
  // triggered it — not which row they are on.
  const conditionCueShowing = conditionCuePlayerId !== null && !showSortHint;
  const selectedQuickTrainPlayer = sortedPlayers.find(
    (player) => player.id === selectedPlayerId,
  );
  const quickTrainTargetPlayerId =
    selectedQuickTrainPlayer?.injuryWeeks === 0
      ? selectedQuickTrainPlayer.id
      : sortedPlayers.find((player) => player.injuryWeeks === 0)?.id;
  const quickTrainNeedsPlayer = selectedQuickTrainPlayer?.injuryWeeks !== 0;
  return (
    <View>
      <SectionLabel
        eyebrow={t('squadTraining.teamRegister')}
        title={t('squadTraining.playerCount', {
          n: viewModel.players.length,
          count: viewModel.players.length,
        })}
        right={
          <StatusChip
            label={t('squadTraining.trainingPoints', { count: trainingPoints })}
          />
        }
      />
      <View
        className={
          conditionCueShowing || showSortHint
            ? 'relative mt-20 border-2 border-ink bg-white'
            : guidePlayers
              ? 'relative border-4 border-blue-dark bg-blue-light p-1'
              : 'border-2 border-ink bg-white'
        }
      >
        {/* Raised above the rows beneath it. A column tip is an absolutely
            positioned bubble hanging out of this row, and z-index only ranks
            an element against its own siblings — the anchor's own z-index
            cannot outrank a later sibling of its PARENT, which is what every
            roster row is. Lifting the whole header settles it once for all
            five columns. */}
        <View
          className="flex-row items-center border-b border-ink/20 px-2"
          style={styles.sortHeaderBar}
        >
          <SquadSortHeader
            label={t('col.squad.role')}
            sortKey="role"
            sort={squadSort}
            columnStyle={columns.role}
            labelSize={headerLabelSize}
            onSort={setSquadSort}
          />
          <SquadSortHeader
            label={t(wideColumns ? 'col.squad.player' : 'col.squad.name')}
            sortKey="player"
            sort={squadSort}
            widthClass="flex-1"
            labelSize={headerLabelSize}
            onSort={setSquadSort}
          />
          <SquadSortHeader
            label={t(wideColumns ? 'col.squad.score' : 'col.squad.overall')}
            sortKey="overall"
            sort={squadSort}
            columnStyle={columns.overall}
            labelSize={headerLabelSize}
            align="right"
            onSort={setSquadSort}
            tutorialCue={
              showSortHint ? (
                <TutorialTapCue
                  label={t('squadTraining.tapHere')}
                  detail={t('squadTraining.sortColumn')}
                  style={{
                    left: '50%',
                    marginLeft: -TUTORIAL_TAP_CUE_WIDTH / 2,
                    top: -TUTORIAL_TAP_CUE_ABOVE_OFFSET,
                  }}
                />
              ) : null
            }
          />
          <SquadSortHeader
            label={t(
              wideColumns ? 'col.squad.potentialLong' : 'col.squad.potential',
            )}
            sortKey="potential"
            sort={squadSort}
            columnStyle={columns.potential}
            labelSize={headerLabelSize}
            align="right"
            onSort={setSquadSort}
          />
          <SquadSortHeader
            label={t(
              wideColumns ? 'col.squad.conditionLong' : 'col.squad.condition',
            )}
            sortKey="condition"
            sort={squadSort}
            columnStyle={columns.condition}
            labelSize={headerLabelSize}
            align="right"
            onSort={setSquadSort}
            tutorialCue={
              conditionCueShowing ? (
                <TutorialTapCue
                  label={t('col.squad.conditionLong')}
                  detail={t('squadTraining.tooLowAndThey')}
                  // `bottom`, not the fixed `top: -ABOVE_OFFSET` the one-line cues
                  // use: this detail wraps to four lines on a narrow column, and a
                  // fixed offset let the taller bubble sit ON the header it is
                  // naming, with its arrow pointing past it into the first roster
                  // row. Anchoring the bubble's bottom to the header's top keeps
                  // the arrow on the header at every wrap.
                  style={{
                    left: '50%',
                    marginLeft: -TUTORIAL_TAP_CUE_WIDTH / 2,
                    bottom: '100%',
                  }}
                />
              ) : null
            }
          />
          {/* The train column needs its width to keep the + buttons aligned, but
              not a label: the + is self-explanatory and the word was clipping. */}
          <View className={ROSTER_TRAIN_COLUMN_CLASS} />
        </View>
        {sortedPlayers.length === 0 ? (
          <View className="items-center px-4 py-8">
            <PixelText className="text-base uppercase text-ink">
              {t('squadTraining.noPlayersRegistered')}
            </PixelText>
            <Text className="mt-2 text-center text-sm leading-5 text-ink/55">
              {t('squadTraining.signAPlayerFrom')}
            </Text>
          </View>
        ) : (
          sortedPlayers.map((player) => {
            const selected = player.id === selectedPlayerId;
            const glowAssignmentButton =
              guidePlayers &&
              !trainingCueUsed &&
              player.id === viewModel.createdPlayerId &&
              player.injuryWeeks === 0;
            const guideConciergePlayer =
              player.id === selectedPlayerId &&
              ((guideFocus === 'injury-lineup' && player.injuryWeeks > 0) ||
                guideFocus === 'transfer-request');
            const guideQuickTrainPlayer =
              guideQuickTrain &&
              !guidePlayers &&
              guideFocus === undefined &&
              !showSortHint &&
              !conditionCueShowing &&
              (quickTrainNeedsPlayer || !wideColumns) &&
              player.id === quickTrainTargetPlayerId;
            return (
              <View
                key={player.id}
                className={
                  guideQuickTrainPlayer
                    ? 'relative flex-row items-center border-2 border-blue-dark bg-blue-light px-2 py-2'
                    : selected
                      ? 'flex-row items-center border-b border-ink/20 bg-paper-dark px-2 py-2'
                      : player.injuryWeeks > 0
                        ? 'flex-row items-center border-b border-red-dark/30 bg-red-light px-2 py-2'
                        : 'flex-row items-center border-b border-ink/10 px-2 py-2'
                }
                style={
                  guideConciergePlayer ||
                  guideQuickTrainPlayer ||
                  (glowAssignmentButton && !playerGuideDismissed)
                    ? { marginTop: TUTORIAL_TAP_CUE_RESERVED_SPACE }
                    : undefined
                }
              >
                {guideConciergePlayer ? (
                  <TutorialTapCue
                    label={t('squadTraining.bertSays')}
                    detail={
                      guideFocus === 'injury-lineup'
                        ? t('squadTraining.reviewInjuryAndReplacement')
                        : t('squadTraining.reviewThisPlayer')
                    }
                    style={{
                      left: '50%',
                      marginLeft: -TUTORIAL_TAP_CUE_WIDTH / 2,
                      top: -TUTORIAL_TAP_CUE_ABOVE_OFFSET,
                    }}
                  />
                ) : null}
                {guideQuickTrainPlayer ? (
                  <TutorialTapCue
                    label={t('squadTraining.quickTrain')}
                    detail={
                      quickTrainNeedsPlayer
                        ? t('squadTraining.tapAPlayerTo')
                        : t('squadTraining.scrollDownToAttributes')
                    }
                    style={{
                      left: '50%',
                      marginLeft: -TUTORIAL_TAP_CUE_WIDTH / 2,
                      top: -TUTORIAL_TAP_CUE_ABOVE_OFFSET,
                    }}
                  />
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('squadTraining.a11y.openSummaryFor', {
                    player: player.name,
                  })}
                  onPress={() => onSelectPlayer(player.id)}
                  className="min-h-11 flex-1 flex-row items-center"
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.65 : undefined,
                  })}
                >
                  <Text
                    style={columns.role}
                    className={
                      selected
                        ? 'font-pixel text-sm text-ink'
                        : 'font-pixel text-sm text-blue-dark'
                    }
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                    numberOfLines={1}
                  >
                    {player.role}
                  </Text>
                  <View className="flex-1 pr-2">
                    {/* The name carries the row's hover card: every other cell
                        in this column is clipped to one line, and the card is
                        the only place the promise is spelled out. */}
                    <InfoTip
                      text={rosterRowSummary(player, t)}
                      accessibilityLabel={rosterRowSummary(player, t)}
                      onPress={() => onSelectPlayer(player.id)}
                    >
                      <Text
                        className="text-base font-bold text-ink"
                        numberOfLines={1}
                      >
                        {player.name}
                      </Text>
                    </InfoTip>
                    {player.injuryWeeks > 0 ? (
                      <Text
                        className="mt-0.5 font-pixel text-sm uppercase text-red-dark"
                        numberOfLines={1}
                      >
                        {t('squadTraining.outForWeeks', {
                          n: player.injuryWeeks,
                          count: player.injuryWeeks,
                        })}
                      </Text>
                    ) : player.isStarter &&
                      player.contractPromisePerk !== 'GUARANTEED_STARTER' ? (
                      // One word, because the name column is the row's only
                      // flexible cell: "Starting XI" clipped to "STARTI…" on a
                      // phone, which reads as a bug rather than an abbreviation.
                      <Text
                        className="mt-0.5 font-pixel text-sm uppercase text-pitch-ink"
                        numberOfLines={1}
                      >
                        {t('squadTraining.start')}
                      </Text>
                    ) : null}
                    {player.isCaptain || player.contractPromiseLabel ? (
                      <Text
                        className="mt-0.5 font-pixel text-sm uppercase text-blue-dark"
                        numberOfLines={1}
                      >
                        {[
                          player.isCaptain &&
                          player.contractPromisePerk !== 'CAPTAINCY'
                            ? t('squadTraining.captain')
                            : undefined,
                          player.shirtNumber
                            ? `#${player.shirtNumber}`
                            : undefined,
                          player.contractPromiseLabel,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    ) : null}
                    <Text
                      className="mt-1 text-sm text-ink/60"
                      numberOfLines={1}
                    >
                      {player.contractLabel}
                    </Text>
                    {player.powerName ? (
                      <View className="mt-0.5 flex-row items-center gap-1">
                        {/* Glyph-only node: ★ is in neither Silkscreen weight, so it
                          stands alone and falls back to the system face on purpose. */}
                        <Text className="text-sm text-gold-dark">★</Text>
                        <PixelText
                          className="text-sm uppercase text-gold-dark"
                          numberOfLines={1}
                        >
                          {player.powerName}
                        </PixelText>
                      </View>
                    ) : null}
                  </View>
                  <Text
                    style={columns.overall}
                    className="text-right font-mono text-base text-ink"
                    maxFontSizeMultiplier={CELL_MAX_FONT_MULTIPLIER}
                    numberOfLines={1}
                  >
                    {player.overall}
                  </Text>
                  <Text
                    style={columns.potential}
                    className="pr-1 text-right font-mono text-base text-gold-dark"
                    maxFontSizeMultiplier={CELL_MAX_FONT_MULTIPLIER}
                    numberOfLines={1}
                  >
                    {player.potentialGrade}
                  </Text>
                  <Text
                    style={columns.condition}
                    className={`text-right font-mono text-sm ${CONDITION_TONE[energyBand(player.condition)]}`}
                    maxFontSizeMultiplier={CELL_MAX_FONT_MULTIPLIER}
                    numberOfLines={1}
                  >
                    {player.condition}%
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    player.injuryWeeks > 0
                      ? t('squadTraining.a11y.playerInjuredCannotTrain', {
                          player: player.name,
                        })
                      : player.awayWeeks > 0
                        ? t('squadTraining.a11y.playerAwayCannotTrain', {
                            player: player.name,
                          })
                        : player.priorityDrillsRemaining !== undefined
                          ? t('squadTraining.a11y.trainNowPromisedDrills', {
                              player: player.name,
                              count: player.priorityDrillsRemaining,
                            })
                          : t('squadTraining.a11y.trainNow', {
                              player: player.name,
                            })
                  }
                  accessibilityState={{ disabled: !player.canTrain }}
                  disabled={!player.canTrain}
                  onPress={() => onPressTrainingBadge(player.id)}
                  // The circle is 35pt — `w-10` is 2.5rem, and a rem is 14pt here
                  // — so hitSlop is what carries the tap target over the 44pt
                  // minimum, at 45. It costs no layout, so the columns keep every
                  // point. The slop overlaps the row's own tap area by a point or
                  // two; the button is the later sibling and wins there, which is
                  // the right way round for the more consequential target.
                  hitSlop={TRAIN_BUTTON_HIT_SLOP}
                  className={
                    !player.canTrain
                      ? 'relative ml-1 h-10 w-10 items-center justify-center rounded-full border border-ink/20 bg-paper-dark'
                      : player.priorityDrillsRemaining !== undefined
                        ? 'relative ml-1 h-10 w-10 items-center justify-center rounded-full border-2 border-blue-dark bg-blue-light'
                        : glowAssignmentButton
                          ? 'relative ml-1 h-10 w-10 items-center justify-center rounded-full border-2 border-gold-dark bg-gold-light'
                          : 'relative ml-1 h-10 w-10 items-center justify-center rounded-full border border-ink/30 hover:bg-blue-light'
                  }
                  style={({ pressed }) => [
                    {
                      opacity:
                        pressed && player.injuryWeeks === 0 ? 0.65 : undefined,
                    },
                    glowAssignmentButton ? styles.assignmentButtonGlow : null,
                  ]}
                >
                  {glowAssignmentButton && !playerGuideDismissed ? (
                    <TutorialTapCue
                      label={t('squadTraining.tapHere')}
                      detail={t('squadTraining.trainAPlayer')}
                      style={{
                        left: '50%',
                        marginLeft: -TUTORIAL_TAP_CUE_WIDTH / 2,
                        top: -TUTORIAL_TAP_CUE_ABOVE_OFFSET,
                      }}
                    />
                  ) : null}
                  <GuidanceDoubleFlash
                    trigger={
                      guidanceNudgeTarget === 'training-plan' &&
                      player.id === viewModel.createdPlayerId
                        ? guidanceNudgeToken
                        : undefined
                    }
                    reduceMotion={reduceMotion}
                    className="rounded-full"
                  />
                  <Text
                    className={
                      player.injuryWeeks > 0
                        ? 'font-mono text-base text-ink/30'
                        : player.priorityDrillsRemaining !== undefined
                          ? 'font-mono text-base text-blue-dark'
                          : glowAssignmentButton
                            ? 'font-mono text-base text-ink'
                            : 'font-mono text-base text-ink/40'
                    }
                  >
                    {player.priorityDrillsRemaining ?? '+'}
                  </Text>
                </Pressable>
              </View>
            );
          })
        )}
      </View>
    </View>
  );
}

interface DrillShopSectionProps {
  upgrades: readonly TrainingUpgradeViewModel[];
  money: number;
  onBuy: (pathId: string) => void;
}

/**
 * The drill shop. Reaching a division only puts the next tier on the shelf, so
 * a row shows what the club trains with today, and then either what the
 * upgrade would give or the one reason it cannot be bought.
 */
function DrillShopSection({ upgrades, money, onBuy }: DrillShopSectionProps) {
  const t = useCopy();
  return (
    <View>
      <SectionLabel
        eyebrow={t('squadTraining.drillShop')}
        title={t('squadTraining.upgradeAPath')}
        right={<StatusChip label={formatCurrency(t, money)} />}
      />
      <View className="border-2 border-ink bg-white">
        {upgrades.map((upgrade) => {
          const owned = t('squadTraining.ownedDrillLine', {
            drill: upgrade.drillName,
            gain: upgrade.ownedGain,
            cost: upgrade.ownedTpCost,
          });
          const maxed = upgrade.nextTier === undefined;
          const buyable = !maxed && upgrade.blockedReason === undefined;
          return (
            <View
              key={upgrade.pathId}
              className="flex-row items-center gap-3 border-b border-ink/10 px-3 py-2"
            >
              <View className="min-w-0 flex-1">
                <PixelText
                  className="text-sm uppercase tracking-wide text-blue-dark"
                  numberOfLines={1}
                >
                  {upgrade.label}
                </PixelText>
                <Text className="mt-0.5 text-sm text-ink" numberOfLines={1}>
                  {owned}
                </Text>
                {/* One line, not two: the upgrade's pitch while it can be
                    bought, the reason it cannot once it cannot. Both at once
                    repeated the tier number and painted the whole column. */}
                <Text className="mt-0.5 text-sm text-ink/70" numberOfLines={2}>
                  {maxed
                    ? t('squadTraining.bestDrillOwned')
                    : (upgrade.blockedReason ??
                      t('squadTraining.nextTierLine', {
                        tier: upgrade.nextTier ?? '',
                        gain: upgrade.nextGain ?? '',
                        cost: upgrade.nextTpCost ?? '',
                      }))}
                </Text>
              </View>
              {maxed ? (
                <View className="h-11 w-24 items-center justify-center border border-ink/20 bg-paper-dark">
                  <PixelText className="text-sm uppercase text-ink/40">
                    {t('squadTraining.tier5')}
                  </PixelText>
                </View>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    buyable
                      ? t('squadTraining.a11y.buyDrill', {
                          path: upgrade.label,
                          tier: upgrade.nextTier ?? '',
                          price: formatCurrency(t, upgrade.cost ?? 0),
                        })
                      : t('squadTraining.a11y.drillUnavailable', {
                          path: upgrade.label,
                          tier: upgrade.nextTier ?? '',
                          reason: upgrade.blockedReason ?? '',
                        })
                  }
                  accessibilityState={{ disabled: !buyable }}
                  disabled={!buyable}
                  onPress={() => onBuy(upgrade.pathId)}
                  className={
                    buyable
                      ? 'h-11 w-24 items-center justify-center border-2 border-b-4 border-ink bg-gold-light'
                      : 'h-11 w-24 items-center justify-center border border-ink/20 bg-paper-dark'
                  }
                >
                  <Text
                    className={
                      buyable
                        ? 'font-mono text-sm text-ink'
                        : 'font-mono text-sm text-ink/40'
                    }
                  >
                    {formatCurrency(t, upgrade.cost ?? 0)}
                  </Text>
                </Pressable>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

interface PlayerFileSectionProps {
  selectedPlayer: SquadPlayerViewModel;
  selectedArchetype?: ArchetypeDevelopmentSummary;
  /** Best unlocked drill per stat, so an attribute box can name its own drill. */
  statOptions?: readonly TrainingSlotStatOption[];
  onTrainAttribute?: (pathId: string) => void;
  /** Week-6 lesson: point at the grid and explain that the boxes are buttons. */
  guideQuickTrain?: boolean;
  /** Lets the screen scroll the attribute grid into view for that lesson. */
  attributesRef?: RefObject<View | null>;
  /** Opens the lay-off offers. Absent while player sales are still locked. */
  onLayOff?: (playerId: string) => void;
  gift?: NonNullable<SquadTrainingViewModel['selectedPlayerGift']>;
  onGift?: (playerId: string) => void;
  giftGuideRef?: RefObject<View | null>;
  onGiftGuideLayout?: () => void;
}

function PlayerFileSection({
  selectedPlayer,
  selectedArchetype,
  statOptions,
  onTrainAttribute,
  guideQuickTrain = false,
  attributesRef,
  onLayOff,
  gift,
  onGift,
  giftGuideRef,
  onGiftGuideLayout,
}: PlayerFileSectionProps) {
  const t = useCopy();
  const guardGiftTap = useTapGuard();
  return (
    <PaperPanel
      kicker={t('squadTraining.playerFile')}
      title={selectedPlayer.name}
      stamp={
        selectedPlayer.injuryWeeks > 0
          ? t('squadTraining.out')
          : selectedPlayer.licensed
            ? t('squadTraining.licensed')
            : selectedPlayer.role
      }
    >
      <View className="mb-4 flex-row items-center gap-4">
        <View className="border-2 border-b-4 border-ink bg-blue-light p-2">
          <PixelPortrait
            playerId={selectedPlayer.id}
            role={selectedPlayer.role}
            lookId={selectedPlayer.lookId}
          />
        </View>
        <View className="flex-1">
          <PixelText className="text-sm uppercase tracking-wide text-ink/50">
            {t('squadTraining.playerIdentity')}
          </PixelText>
          <PixelText className="mt-1 text-lg uppercase text-ink">
            {selectedPlayer.role} · {selectedPlayer.archetypeLabel}
          </PixelText>
          <Text className="mt-1 text-sm text-ink/60">
            {t('squadTraining.personalityAndFame', {
              personality: selectedPlayer.personalityLabel,
              fame: selectedPlayer.fame,
            })}
          </Text>
          {onLayOff === undefined ? null : (
            <View className="mt-2">
              <ActionButton
                label={t('layOff.action')}
                accessibilityLabel={t('layOff.a11y.open', {
                  player: selectedPlayer.name,
                })}
                variant="danger"
                onPress={() => onLayOff(selectedPlayer.id)}
              />
            </View>
          )}
        </View>
      </View>
      {selectedPlayer.injuryWeeks > 0 ? (
        <View className="mb-3 border-2 border-b-4 border-red-dark bg-red-light p-3">
          <Text className="font-pixel text-base uppercase text-red-dark">
            {t('squadTraining.outForWeeks', {
              n: selectedPlayer.injuryWeeks,
              count: selectedPlayer.injuryWeeks,
            })}
          </Text>
          <Text className="mt-1 text-sm text-ink/70">
            {t('squadTraining.unavailableForMatchSelection')}
          </Text>
        </View>
      ) : selectedPlayer.awayWeeks > 0 ? (
        // Gold, not red: leave is a consequence the manager chose, and keeping
        // red for injury alone means the two read apart at a glance.
        <View className="mb-3 border-2 border-b-4 border-gold-dark bg-gold-light p-3">
          <Text className="font-pixel text-base uppercase text-gold-dark">
            {t('squadTraining.onLeaveForWeeks', {
              n: selectedPlayer.awayWeeks,
              count: selectedPlayer.awayWeeks,
            })}
          </Text>
          <Text className="mt-1 text-sm text-ink/70">
            {t('squadTraining.awayOnAGranted')}
          </Text>
        </View>
      ) : null}
      <View className="flex-row gap-2">
        <Metric
          label={t('squadTraining.currentRating')}
          value={String(selectedPlayer.overall)}
        />
        {/* The four numbers a manager acts on but the card cannot define — and
            potential's line is wider than its box, so its tip is also the only
            place the full "{grade} · {percent}% SUPER" is readable. */}
        <InfoTip
          className="min-w-0 flex-1"
          text={t('squadTraining.column.condition')}
          accessibilityLabel={t('squadTraining.a11y.condition', {
            condition: selectedPlayer.condition,
          })}
        >
          <Metric
            label={t('col.squad.conditionLong')}
            value={`${selectedPlayer.condition}%`}
            tone={
              energyBand(selectedPlayer.condition) === 'red'
                ? 'negative'
                : 'positive'
            }
          />
        </InfoTip>
        <Metric
          label={t('squadTraining.wagePerWeek')}
          value={formatCurrency(t, selectedPlayer.weeklyWage)}
        />
      </View>
      <View className="mt-2 flex-row gap-2">
        <Metric
          label={t('squadTraining.age')}
          value={String(selectedPlayer.age)}
        />
        <InfoTip
          className="min-w-0 flex-1"
          text={t('squadTraining.potentialTip', {
            grade: selectedPlayer.potentialGrade,
            percent: selectedPlayer.superChancePercent,
          })}
          accessibilityLabel={t('squadTraining.a11y.potential', {
            grade: selectedPlayer.potentialGrade,
            percent: selectedPlayer.superChancePercent,
          })}
        >
          <Metric
            label={t('col.squad.potentialLong')}
            value={t('squadTraining.potentialAndSuper', {
              grade: selectedPlayer.potentialGrade,
              percent: selectedPlayer.superChancePercent,
            })}
            tone="positive"
          />
        </InfoTip>
        <InfoTip
          align="right"
          className="min-w-0 flex-1"
          text={t('squadTraining.fameTip')}
          accessibilityLabel={t('squadTraining.a11y.fame', {
            fame: selectedPlayer.fame,
          })}
        >
          <Metric
            label={t('squadTraining.fame')}
            value={String(selectedPlayer.fame)}
          />
        </InfoTip>
      </View>
      {/* Morale and loyalty sit together because they are the same kind of
          number on two different clocks: morale swings on results and recovers
          on wins, loyalty only moves when the manager decides something and
          never recovers on its own. */}
      <View className="mt-2 flex-row items-center gap-2">
        <InfoTip
          className="min-w-0 flex-1"
          text={t('squadTraining.moraleTip')}
          accessibilityLabel={t('squadTraining.a11y.morale', {
            morale: selectedPlayer.morale,
          })}
        >
          <Metric
            label={t('squadTraining.morale')}
            value={`${selectedPlayer.morale}%`}
          />
        </InfoTip>
        <InfoTip
          align="right"
          className="min-w-0 flex-1"
          text={t('squadTraining.loyaltyTip', {
            floor: LOYALTY_NO_RENEWAL_THRESHOLD,
          })}
          accessibilityLabel={t('squadTraining.a11y.loyalty', {
            loyalty: selectedPlayer.loyalty,
            floor: LOYALTY_NO_RENEWAL_THRESHOLD,
          })}
        >
          <Metric
            label={t('squadTraining.loyalty')}
            value={String(selectedPlayer.loyalty)}
            tone={
              selectedPlayer.loyalty <= LOYALTY_WARNING_THRESHOLD
                ? 'negative'
                : 'normal'
            }
          />
        </InfoTip>
      </View>
      {gift === undefined || onGift === undefined ? null : (
        <View className="mt-3 border-2 border-b-4 border-ink bg-gold-light p-3">
          <View className="flex-row items-center justify-between gap-3">
            <View className="min-w-0 flex-1">
              <PixelText className="text-sm uppercase text-ink">
                {t('playerGift.action')}
              </PixelText>
              <Text className="mt-1 font-mono text-base text-stamp">
                {formatCurrency(t, gift.cost)}
              </Text>
              <Text className="font-pixel text-sm uppercase text-pitch-ink">
                {t('playerGift.moraleResult', { gain: gift.moraleGain })}
              </Text>
              <Text className="mt-1 text-xs text-ink/60">
                {t('playerGift.remaining', {
                  n: gift.clubGiftsRemaining,
                  count: gift.clubGiftsRemaining,
                })}
              </Text>
              {gift.blockedReason === undefined ? null : (
                <Text className="mt-1 text-xs font-bold text-stamp">
                  {gift.blockedReason}
                </Text>
              )}
            </View>
            <View
              ref={giftGuideRef}
              collapsable={false}
              className="min-w-[132px]"
              onLayout={onGiftGuideLayout}
            >
              <ActionButton
                label={t('playerGift.action')}
                accessibilityLabel={t('playerGift.a11y.giftAction', {
                  n: gift.clubGiftsRemaining,
                  player: selectedPlayer.name,
                  cost: formatCurrency(t, gift.cost),
                  gain: gift.moraleGain,
                  remaining: gift.clubGiftsRemaining,
                  status: gift.blockedReason ?? '',
                })}
                disabled={gift.blockedReason !== undefined}
                pressSfx="click"
                onPress={() =>
                  guardGiftTap(() => {
                    void preloadPlayerGiftCelebration();
                    onGift(selectedPlayer.id);
                  })
                }
              />
            </View>
          </View>
        </View>
      )}
      <View className="mt-3 flex-row items-center justify-between gap-3 border-t border-ink/20 pt-3">
        <View className="flex-1">
          <PixelText className="text-sm uppercase tracking-wide text-ink/50">
            {t('squadTraining.contract')}
          </PixelText>
          <Text className="mt-1 text-base font-bold text-ink">
            {selectedPlayer.contractLabel}
          </Text>
          {selectedPlayer.retirementLabel === undefined ? null : (
            <Text className="mt-1 text-sm text-ink/60">
              {selectedPlayer.retirementLabel}
            </Text>
          )}
        </View>
        {selectedPlayer.powerName ? (
          <StatusChip label={selectedPlayer.powerName} tone="hero" />
        ) : null}
      </View>
      {selectedPlayer.contractPromiseLabel ||
      selectedPlayer.isCaptain ||
      selectedPlayer.shirtNumber ? (
        <View className="mt-3 flex-row flex-wrap gap-2">
          {selectedPlayer.isCaptain &&
          selectedPlayer.contractPromisePerk !== 'CAPTAINCY' ? (
            <StatusChip label={t('squadTraining.captain')} selected />
          ) : null}
          {selectedPlayer.shirtNumber ? (
            <StatusChip
              label={t('squadTraining.shirtNumber', {
                number: selectedPlayer.shirtNumber,
              })}
            />
          ) : null}
          {selectedPlayer.contractPromiseLabel ? (
            <StatusChip label={selectedPlayer.contractPromiseLabel} selected />
          ) : null}
        </View>
      ) : null}
      <View className="mt-3 border border-ink/20 bg-paper-dark/40 px-3 py-3">
        <View className="flex-row items-center justify-between gap-3">
          <PixelText className="text-sm uppercase tracking-wide text-ink/50">
            {t('squadTraining.archetype')}
          </PixelText>
          <View className="min-w-0 flex-1 items-end">
            {/* Same treatment as Personality below: the strengths and
                weaknesses under the name are abbreviated to fit the column, so
                the full sentences live in the tip. */}
            <InfoTip
              align="right"
              text={archetypeExplainer(selectedArchetype, t)}
              accessibilityLabel={t('squadTraining.a11y.archetype', {
                archetype: selectedPlayer.archetypeLabel,
                explainer: archetypeExplainer(selectedArchetype, t),
              })}
            >
              <Text className="text-base font-bold text-ink">
                {selectedPlayer.archetypeLabel}
              </Text>
            </InfoTip>
            <View className="mt-1 flex-row flex-wrap justify-end gap-x-2">
              <Text className="font-pixel text-sm text-pitch-ink">
                {selectedArchetype === undefined
                  ? null
                  : copyOrEnglish(
                      t,
                      selectedArchetype.strengthsKey,
                      selectedArchetype.strengths,
                    )}
              </Text>
              <Text className="font-pixel text-sm text-ink/50">
                {selectedArchetype === undefined
                  ? null
                  : copyOrEnglish(
                      t,
                      selectedArchetype.weaknessesKey,
                      selectedArchetype.weaknesses,
                    )}
              </Text>
            </View>
          </View>
        </View>
        <View className="mt-2 flex-row items-center justify-between gap-3">
          <PixelText className="text-sm uppercase tracking-wide text-ink/50">
            {t('squadTraining.position')}
          </PixelText>
          <Text className="font-pixel text-sm text-blue-dark">
            {selectedPlayer.positionTrainingLabel}
          </Text>
        </View>
        <View className="mt-2 flex-row items-center justify-between gap-3">
          <PixelText className="text-sm uppercase tracking-wide text-ink/50">
            {t('squadTraining.personality')}
          </PixelText>
          <InfoTip
            align="right"
            text={personalityExplainer(selectedPlayer.personality, t)}
            accessibilityLabel={t('squadTraining.a11y.personality', {
              personality: selectedPlayer.personalityLabel,
              explainer: personalityExplainer(selectedPlayer.personality, t),
            })}
          >
            <Text className="text-base font-bold text-ink">
              {selectedPlayer.personalityLabel}
            </Text>
          </InfoTip>
        </View>
        <View className="mt-2 flex-row items-center justify-between gap-3">
          <PixelText className="text-sm uppercase tracking-wide text-ink/50">
            {t('squadTraining.fame')}
          </PixelText>
          <Text className="font-mono text-base text-ink">
            {selectedPlayer.fame}
          </Text>
        </View>
      </View>
      <View
        ref={attributesRef}
        collapsable={false}
        className={
          guideQuickTrain
            ? 'relative mt-20 border-2 border-blue-dark bg-blue-light/20 p-3'
            : 'mt-3 border-2 border-ink bg-white p-3'
        }
      >
        {guideQuickTrain ? (
          <TutorialTapCue
            label={t('squadTraining.tapAnAttribute')}
            detail={t('squadTraining.chooseTheStatYou')}
            style={{
              left: '50%',
              marginLeft: -TUTORIAL_TAP_CUE_WIDTH / 2,
              top: -TUTORIAL_TAP_CUE_ABOVE_OFFSET,
            }}
          />
        ) : null}
        <PixelText className="mb-2 text-sm uppercase tracking-wide text-ink/50">
          {t('squadTraining.attributes')}
        </PixelText>
        <Text className="mb-3 text-xs leading-4 text-ink/55">
          {t('squadTraining.pacPaceShoShooting')}
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {selectedPlayer.attributes
            .filter((attribute) =>
              selectedPlayer.role === 'GK'
                ? attribute.label !== 'SHO'
                : attribute.label !== 'REF',
            )
            .map((attribute) => {
              // Quick Train: the attribute IS the button. Tapping it opens the
              // confirmation for whichever drill trains that stat.
              const option = statOptions?.find(
                (candidate) => candidate.shortCode === attribute.label,
              );
              const trainable =
                option !== undefined && onTrainAttribute !== undefined;
              return (
                // Tap trains, hold explains. InfoTip's 500ms delay is chosen so
                // an unhurried tap still counts as a tap, which is what lets one
                // control carry both without the abbreviation needing its own
                // affordance — SHO and TEC are not guessable, and a manager
                // should not have to spend TP to find out what they bought.
                <InfoTip
                  key={attribute.label}
                  text={t(ATTRIBUTE_EXPLAINER[attribute.label])}
                  accessibilityLabel={
                    trainable
                      ? t('squadTraining.a11y.trainAttribute', {
                          stat: attribute.label,
                          value: attribute.value,
                          drill: option.drillName,
                          cost: option.tpCost,
                          gain: option.gain,
                          explainer: t(ATTRIBUTE_EXPLAINER[attribute.label]),
                        })
                      : t('squadTraining.a11y.attributeValue', {
                          stat: attribute.label,
                          value: attribute.value,
                          explainer: t(ATTRIBUTE_EXPLAINER[attribute.label]),
                        })
                  }
                  className={
                    trainable
                      ? 'min-w-[29%] flex-1 border-2 border-b-4 border-ink/40 bg-paper px-2 py-2'
                      : 'min-w-[29%] flex-1 border border-ink/20 bg-paper px-2 py-2'
                  }
                  disabled={!trainable}
                  onPress={
                    trainable
                      ? () => onTrainAttribute(option.pathId)
                      : undefined
                  }
                >
                  <PixelText className="text-sm uppercase text-ink/50">
                    {attribute.label}
                  </PixelText>
                  <Text className="mt-1 font-mono text-base text-ink">
                    {attribute.value}
                  </Text>
                  {trainable ? (
                    <Text
                      className="mt-0.5 font-mono text-xs text-blue-dark"
                      numberOfLines={1}
                    >
                      {t('squadTraining.gainAndCost', {
                        gain: option.gain,
                        cost: option.tpCost,
                      })}
                    </Text>
                  ) : null}
                </InfoTip>
              );
            })}
        </View>
      </View>
    </PaperPanel>
  );
}

/**
 * The sort arrow, drawn rather than typed.
 *
 * Silkscreen has no glyph for ▼ or ▲, so a typed one is served by whatever
 * face iOS falls back to, at an advance this side of the screen cannot know —
 * and because the header clips to its column, the arrow was the first thing
 * cut off. Measured on a phone at the xxLarge text size: OVR showed 1pt of its
 * arrow, POT 4pt. A drawn triangle is the same width at every text size, which
 * is what lets squad-register-columns.ts prove the widths hold.
 *
 * Two stacked borders with transparent sides, the way the speech bubble draws
 * its tail — the same trick, and the only way to fill a triangle without an
 * image or a canvas.
 */
function SquadSortArrow({
  direction,
}: {
  direction: 'ascending' | 'descending';
}) {
  return (
    <View
      style={
        direction === 'descending' ? styles.sortArrowDown : styles.sortArrowUp
      }
    />
  );
}

function SquadSortHeader({
  label,
  sortKey,
  sort,
  widthClass,
  columnStyle,
  labelSize,
  align = 'left',
  onSort,
  tutorialCue,
}: {
  label: string;
  sortKey: SquadSortKey;
  sort: SquadSort | null;
  /** For the one flexible column; every fixed column passes columnStyle. */
  widthClass?: string;
  columnStyle?: ViewStyle;
  /** Font-size utility for the label; phones step down so four fit in a row. */
  labelSize: string;
  align?: 'left' | 'right';
  onSort: (key: SquadSortKey) => void;
  tutorialCue?: ReactNode;
}) {
  const t = useCopy();
  const direction = sort?.key === sortKey ? sort.direction : null;
  const directionWord =
    direction === 'descending'
      ? t('squadTraining.sortDescending')
      : direction === 'ascending'
        ? t('squadTraining.sortAscending')
        : t('squadTraining.sortDefaultOrder');
  const nextDirection =
    direction === null
      ? t('squadTraining.sortDescending')
      : direction === 'descending'
        ? t('squadTraining.sortAscending')
        : t('squadTraining.sortDefaultOrder');
  const explainer = t(COLUMN_EXPLAINER[sortKey]);
  return (
    <InfoTip
      text={explainer}
      align={align}
      className={widthClass}
      style={columnStyle}
      accessibilityLabel={t('squadTraining.a11y.sortBy', {
        column: label,
        direction: directionWord,
        next: nextDirection,
        explainer,
      })}
      onPress={() => onSort(sortKey)}
    >
      <View
        className={`relative min-h-11 w-full flex-row items-center ${align === 'right' ? 'justify-end' : 'justify-start'}`}
        // The gap the column widths are sized around, in points rather than in a
        // utility class: `gap-1` is 3.5pt on native, not 4.
        style={styles.sortHeaderRow}
      >
        {tutorialCue}
        <PixelText
          // A step down from the row values so the spelled-out words fit their
          // column with the sort arrow — headers label the data, they aren't it.
          className={
            direction === null
              ? `${labelSize} uppercase text-ink/70`
              : `${labelSize} uppercase text-blue-dark`
          }
          // Capped, because the column under it cannot grow with the reader's
          // text size and a header that outgrows its column paints over the one
          // beside it. The full sentence is on the accessibility label.
          maxFontSizeMultiplier={HEADER_MAX_FONT_MULTIPLIER}
          // Shrinks before the arrow does, so at a text size beyond anything
          // measured here the label gives up a letter rather than the arrow
          // disappearing — losing which way a column is sorted is worse.
          style={styles.sortHeaderLabel}
          numberOfLines={1}
          ellipsizeMode="clip"
        >
          {label}
        </PixelText>
        {direction === null ? null : <SquadSortArrow direction={direction} />}
      </View>
    </InfoTip>
  );
}

/** blue-dark, the colour the sorted label already uses. */
const SORT_ARROW_COLOUR = '#3f6fb5';

const styles = StyleSheet.create({
  sortHeaderBar: { zIndex: 40 },
  sortHeaderRow: { gap: SORT_ARROW_GAP },
  sortHeaderLabel: { flexShrink: 1 },
  sortArrowDown: {
    width: 0,
    height: 0,
    flexShrink: 0,
    borderLeftWidth: SORT_ARROW_WIDTH / 2,
    borderRightWidth: SORT_ARROW_WIDTH / 2,
    borderTopWidth: SORT_ARROW_HEIGHT,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: SORT_ARROW_COLOUR,
  },
  sortArrowUp: {
    width: 0,
    height: 0,
    flexShrink: 0,
    borderLeftWidth: SORT_ARROW_WIDTH / 2,
    borderRightWidth: SORT_ARROW_WIDTH / 2,
    borderBottomWidth: SORT_ARROW_HEIGHT,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: SORT_ARROW_COLOUR,
  },
  assignmentButtonGlow: {
    boxShadow: '0 0 12px 4px rgba(237, 181, 74, 0.9)',
    shadowColor: '#edb54a',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 9,
    elevation: 10,
  },
});
