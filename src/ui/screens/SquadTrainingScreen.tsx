import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, ReactNode, RefObject, SetStateAction } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { GestureResponderEvent } from 'react-native';
import type { AssistantGuideFocus, ManagerTipDestination } from '../../content';
import { Metric, PaperPanel, SectionLabel, StatusChip, formatCurrency } from '../components/Scorecard';
import { PixelPortrait } from '../components/PixelPortrait';
import type {
  DrillResultViewModel,
  SquadPlayerViewModel,
  SquadTrainingViewModel,
  TrainingSlotStatOption,
  TrainingUpgradeViewModel,
} from '../models';
import { TutorialTapCue } from '../TutorialTapCue';
import { SfxPressable as Pressable } from '../components/SfxPressable';
import {
  TUTORIAL_TAP_CUE_ABOVE_OFFSET,
  TUTORIAL_TAP_CUE_RESERVED_SPACE,
  TUTORIAL_TAP_CUE_WIDTH,
} from '../tutorial-cue-position';
import { TrainingDrillModal } from '../TrainingDrillModal';
import {
  nextSquadSort,
  sortSquadPlayers,
  type SquadSort,
  type SquadSortKey,
} from '../squad-sort';
import { archetypeDevelopmentSummary, type ArchetypeDevelopmentSummary } from '../archetype-development';
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
import { LOYALTY_NO_RENEWAL_THRESHOLD, LOYALTY_WARNING_THRESHOLD } from '../../game/loyalty';
import { GUIDED_ALERT_GLOW } from '../guidance-glow';
import { SquadRequestsPanel } from './SquadRequestsPanel';
import type { PlayerRequestViewModel } from '../../application/player-request-view-model';

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
 */
const PERSONALITY_EXPLAINER: Readonly<Record<string, string>> = {
  // Straight off market.ts: LOVED_PITCHES, HATED_PITCHES, and the renewal ask
  // multiplier. Nothing here is flavour — every line names a real effect.
  FIERY: 'Wants trophies and straight talk in negotiations. Hometown sentiment turns them off.',
  LOYAL: 'Moved by hometown ties and flattery, put off by money talk. Renews for about 10% less.',
  GREEDY: 'Money and trophies, in that order. Hometown ties mean nothing, and they renew for about 20% more.',
  JOKER: 'Warms to flattery and hometown ties. Blunt talk falls flat.',
  PROFESSIONAL: 'Responds to straight talk and trophy promises. Flattery gets you nowhere.',
  TIMID: 'Reassured by hometown ties and straight talk. Big trophy promises only spook them.',
};

function personalityExplainer(personality: string): string {
  return PERSONALITY_EXPLAINER[personality.toUpperCase().replace('-', '_')]
    ?? 'Shapes which arguments land in contract talks.';
}

const COLUMN_EXPLAINER: Readonly<Record<SquadSortKey, string>> = {
  player: 'Name, position, and whether they start.',
  role: 'Where they play: keeper, defence, midfield or attack.',
  overall: 'Their ability right now, out of 99. It is what they bring to Saturday.',
  potential: 'How good they could still become. A high grade trains faster and further.',
  condition: 'Fresh legs. Training and matches drain it; low condition risks injury.',
};

/**
 * Which drill in the career earns the condition warning. Not the first: the
 * manager has to watch the number fall a couple of times before being told
 * what a low one costs, or the warning is just noise on a full-energy squad.
 */
const CONDITION_WARNING_DRILL = 3;

/** How far below the viewport top the attribute grid sits once framed. */
const QUICK_TRAIN_FRAME_TOP = 96;
/**
 * Three-letter roles still fit at the app's largest text size. This moves the
 * name start 8pt right; tighter phone metrics and the train gutter pay for it
 * so the flexible name cell keeps useful room.
 */
const ROSTER_ROLE_COLUMN_WIDTH = 48;

export interface SquadTrainingScreenProps {
  viewModel: SquadTrainingViewModel;
  /** The player currently focused for the profile card and drill popup (mirrors store.selectedPlayerId). */
  selectedPlayerId?: string;
  onSelectPlayer: (playerId: string) => void;
  /** Resolves the drill instantly; the popup stays open for chain taps. */
  onTrainDrill: (playerId: string, pathId: string) => void;
  /** Buys the next drill tier for one path. Money, not TP. */
  onBuyDrillUpgrade: (pathId: string) => void;
  /** The latest resolved drill, sequenced so the popup can animate repeats. */
  lastDrillResult: DrillResultViewModel | null;
  trainingPoints: number;
  guideTraining?: boolean;
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
   * The week-6 Quick Train lesson. The screen selects a player, frames the
   * attribute grid and points at it, because the lesson is meaningless without
   * a grid on screen to point at.
   */
  guideQuickTrain?: boolean;
  onQuickTrainShown?: () => void;
  /** Changes after any completed screen tap so floating tips can retire together. */
  dismissTipsToken?: number;
  /** The Requests tab's model. `available: false` hides the tab row entirely. */
  requestViewModel?: PlayerRequestViewModel;
  /** Starts the walk-on; the decision card follows it. */
  onOpenRequest?: () => void;
  /** A Manager's Tip deep-link and its fresh request identity. */
  managerTipGuideRequest?: {
    target: ManagerTipDestination;
    token: number;
  };
}

export function SquadTrainingScreen({
  viewModel,
  selectedPlayerId,
  onSelectPlayer,
  onTrainDrill,
  onBuyDrillUpgrade,
  lastDrillResult,
  trainingPoints,
  guideTraining = false,
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
  managerTipGuideRequest,
}: SquadTrainingScreenProps) {
  const desktopContent = useDesktopContentStyle();
  const { width } = useWindowDimensions();
  const wideColumns = width >= 600;
  // Wide columns spell their headers out in full ("SCORE", "POTENTIAL",
  // "CONDITION"), so each one has to be wide enough to hold the word plus its
  // sort arrow — a clipped header reads as a bug, not as an abbreviation.
  const currentColumnWidth = wideColumns ? 'w-16' : 'w-9';
  const potentialColumnWidth = wideColumns ? 'w-28' : 'w-12';
  const conditionColumnWidth = wideColumns ? 'w-28' : 'w-14';
  const selectedPlayer = viewModel.players.find(player => player.id === selectedPlayerId);
  const selectedArchetype = selectedPlayer === undefined
    ? undefined
    : archetypeDevelopmentSummary(selectedPlayer.archetype);
  const playerGuideTouchStartRef = useRef<TutorialTouchPoint | null>(null);
  const [squadTab, setSquadTab] = useState<'drills' | 'requests'>('drills');
  const [drillPickerOpen, setDrillPickerOpen] = useState(false);
  const [playerGuideDismissed, setPlayerGuideDismissed] = useState(false);
  /**
   * The Train glow outlives the tap cue on purpose: scrolling dismisses the
   * floating "Tap +" arrow, but the button keeps glowing until it is actually
   * pressed, so the one thing the manager still owes the guide stays lit.
   */
  const [trainingCueUsed, setTrainingCueUsed] = useState(false);
  /**
   * The player whose condition the warning is pointing at, set by the third
   * drill of the career and cleared by the next thing the manager does. It
   * waits for the drill popup to close, because the popup covers the roster.
   */
  const [conditionCuePlayerId, setConditionCuePlayerId] = useState<string | null>(null);
  const lastDismissTipsTokenRef = useRef(dismissTipsToken);
  const guideQuickTrainRef = useRef(guideQuickTrain);
  const [quickTrainCueDismissed, setQuickTrainCueDismissed] = useState(false);
  const [managerTipGuideTarget, setManagerTipGuideTarget] = useState<ManagerTipDestination | null>(null);
  /** The stat the manager tapped in the player file, aimed at its drill. */
  const [quickTrainPathId, setQuickTrainPathId] = useState<string | undefined>(undefined);
  const scrollRef = useRef<ScrollView>(null);
  const attributesRef = useRef<View>(null);
  const drillShopRef = useRef<View>(null);
  const attributesScrolledRef = useRef(false);
  const [squadSort, setSquadSort] = useState<SquadSort | null>(null);
  const sortedPlayers = useMemo(
    () => sortSquadPlayers(viewModel.players, squadSort),
    [squadSort, viewModel.players],
  );
  const guidePlayers = guideTraining;

  const dismissPlayerGuide = useCallback(() => {
    if (guidePlayers) setPlayerGuideDismissed(true);
  }, [guidePlayers]);

  const rememberPlayerGuideTouch = useCallback((event: GestureResponderEvent) => {
    if (!guidePlayers || playerGuideDismissed) return;
    playerGuideTouchStartRef.current = {
      x: event.nativeEvent.pageX,
      y: event.nativeEvent.pageY,
    };
  }, [guidePlayers, playerGuideDismissed]);

  const dismissPlayerGuideAfterDrag = useCallback((event: GestureResponderEvent) => {
    const start = playerGuideTouchStartRef.current;
    if (!guidePlayers || playerGuideDismissed || start === null) return;
    if (shouldDismissTutorialForDrag(start, {
      x: event.nativeEvent.pageX,
      y: event.nativeEvent.pageY,
    })) {
      dismissPlayerGuide();
      playerGuideTouchStartRef.current = null;
    }
  }, [dismissPlayerGuide, guidePlayers, playerGuideDismissed]);

  const forgetPlayerGuideTouch = useCallback(() => {
    playerGuideTouchStartRef.current = null;
  }, []);

  const handleTrainingBadgePress = useCallback((playerId: string) => {
    setTrainingCueUsed(true);
    setQuickTrainPathId(undefined);
    onSelectPlayer(playerId);
    setDrillPickerOpen(true);
  }, [onSelectPlayer]);

  // Stable so the popup's consume effect does not re-run on every render.
  const forgetQuickTrainRequest = useCallback(() => {
    setQuickTrainPathId(undefined);
  }, []);

  /** Quick Train: the attribute IS the drill picker. */
  const handleTrainAttribute = useCallback((pathId: string) => {
    setTrainingCueUsed(true);
    setQuickTrainPathId(pathId);
    setDrillPickerOpen(true);
    // Doing the thing retires the lesson; there is nothing left to teach.
    onQuickTrainShown?.();
  }, [onQuickTrainShown]);

  useEffect(() => {
    if (drillPickerRequestToken === undefined) return;
    setDrillPickerOpen(true);
  }, [drillPickerRequestToken]);

  // Keyed to the drill, not the career total, so it fires once and never again
  // on a re-render or a reload.
  useEffect(() => {
    if (lastDrillResult?.totalDrillsRun !== CONDITION_WARNING_DRILL) return;
    setConditionCuePlayerId(lastDrillResult.playerId);
  }, [lastDrillResult]);

  const dismissConditionCue = useCallback(() => setConditionCuePlayerId(null), []);

  useEffect(() => {
    if (lastDismissTipsTokenRef.current === dismissTipsToken) return;
    lastDismissTipsTokenRef.current = dismissTipsToken;
    dismissPlayerGuide();
    dismissConditionCue();
    setManagerTipGuideTarget(null);
    // Only retire the lesson if it was already on screen when this tap began.
    // The Advance Week tap can unlock Quick Train; that new lesson must not be
    // dismissed by the same tap that caused it to appear.
    if (guideQuickTrainRef.current) setQuickTrainCueDismissed(true);
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
        if (target === 'overall-sort') {
          scrollRef.current?.scrollTo({ y: 0, animated: true });
          return;
        }
        if (target === 'drill-shop') {
          drillShopRef.current?.measureInWindow((_x, y) => {
            scrollRef.current?.scrollTo({
              y: Math.max(0, y - QUICK_TRAIN_FRAME_TOP),
              animated: true,
            });
          });
        }
      });
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      if (secondFrame !== null) cancelAnimationFrame(secondFrame);
    };
  }, [managerTipGuideRequest]);

  useEffect(() => {
    guideQuickTrainRef.current = guideQuickTrain;
    if (!guideQuickTrain) setQuickTrainCueDismissed(false);
  }, [guideQuickTrain]);

  /**
   * Pick someone if nobody is selected, or there is no attribute grid for the
   * lesson to point at. The created player sorts first, so they are the pick.
   */
  useEffect(() => {
    if (!guideQuickTrain || selectedPlayerId !== undefined) return;
    const first = sortedPlayers[0];
    if (first !== undefined) onSelectPlayer(first.id);
  }, [guideQuickTrain, onSelectPlayer, selectedPlayerId, sortedPlayers]);

  /** Frame the grid once, on the frame after it has laid out. */
  const frameAttributes = useCallback(() => {
    if (!guideQuickTrain || attributesScrolledRef.current) return;
    const target = attributesRef.current;
    const scroller = scrollRef.current;
    if (target === null || scroller === null) return;
    attributesScrolledRef.current = true;
    requestAnimationFrame(() => {
      target.measureInWindow((_x, y) => {
        scroller.scrollTo({ y: Math.max(0, y - QUICK_TRAIN_FRAME_TOP), animated: true });
      });
    });
  }, [guideQuickTrain]);

  useEffect(() => {
    if (!guideQuickTrain) attributesScrolledRef.current = false;
  }, [guideQuickTrain]);

  const layoutMode = useLayoutMode();

  const sections: FlowSection[] = [
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
          currentColumnWidth={currentColumnWidth}
          potentialColumnWidth={potentialColumnWidth}
          conditionColumnWidth={conditionColumnWidth}
          squadSort={squadSort}
          setSquadSort={setSquadSort}
          sortedPlayers={sortedPlayers}
          trainingPoints={trainingPoints}
          selectedPlayerId={selectedPlayerId}
          guideFocus={guideFocus}
          guideOverallSort={managerTipGuideTarget === 'overall-sort'}
          onSelectPlayer={onSelectPlayer}
          onPressTrainingBadge={handleTrainingBadgePress}
        />
      ),
    },
    ...(selectedPlayer ? [{
      key: 'player-file',
      weight: 9,
      node: (
        <PlayerFileSection
          selectedPlayer={selectedPlayer}
          selectedArchetype={selectedArchetype}
          statOptions={viewModel.selectedPlayerStatOptions}
          onTrainAttribute={handleTrainAttribute}
          guideQuickTrain={guideQuickTrain && !quickTrainCueDismissed}
          attributesRef={attributesRef}
          onAttributesLayout={frameAttributes}
        />
      ),
    }] : []),
    {
      key: 'drill-shop',
      weight: 3 + viewModel.drillUpgrades.length,
      node: (
        <View
          ref={drillShopRef}
          collapsable={false}
          className={managerTipGuideTarget === 'drill-shop'
            ? 'relative mt-20 border-2 border-blue-dark bg-blue-light/20 p-1'
            : 'relative'}
        >
          {managerTipGuideTarget === 'drill-shop' ? (
            <TutorialTapCue
              label="Drill tiers"
              detail="Drills unlock as you climb divisions"
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
    <View className="flex-1">
      <ScrollView
        ref={scrollRef}
        className="flex-1"
        contentContainerStyle={[{ padding: 16, paddingBottom: 28 }, desktopContent]}
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
          <PixelText className="text-sm uppercase tracking-[2px] text-blue-dark">Squad room</PixelText>
          <PixelText className="mt-1 text-xl uppercase text-ink">Roster & training</PixelText>
        </View>

        {/* Drawn like the league's division selector so the two read as one
            vocabulary. Absent entirely before season 2 week 5 — the row
            appearing is part of what makes Bert's briefing feel like it
            unlocked something. */}
        {requestViewModel?.available ? (
          <View className="mb-5 flex-row gap-1">
            {(['drills', 'requests'] as const).map(tab => {
              const selected = tab === squadTab;
              const glowing = tab === 'requests' && requestViewModel.glowing && !selected;
              const label = tab === 'drills' ? 'Drills' : 'Requests';
              return (
                <Pressable
                  key={tab}
                  accessibilityRole="tab"
                  accessibilityLabel={glowing ? `${label} tab, one waiting` : `${label} tab`}
                  accessibilityState={{ selected }}
                  onPress={() => setSquadTab(tab)}
                  className={selected
                    ? 'min-h-14 flex-1 items-center justify-center border-2 border-b-4 border-blue-dark bg-blue-light px-1 py-2'
                    : 'min-h-14 flex-1 items-center justify-center border-2 border-b-4 border-ink/40 bg-white px-1 py-2'}
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.82 : 1,
                    transform: [{ translateY: pressed ? 2 : 0 }],
                    ...(glowing ? GUIDED_ALERT_GLOW : {}),
                  })}
                >
                  <Text className="font-pixel text-sm uppercase text-ink">
                    {label}{glowing ? '  \u25CF' : ''}
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
      {drillPickerOpen && selectedPlayer && viewModel.selectedPlayerStatOptions ? (
        <TrainingDrillModal
          playerId={selectedPlayer.id}
          playerName={selectedPlayer.name}
          playerRole={selectedPlayer.role}
          playerLookId={selectedPlayer.lookId}
          options={viewModel.selectedPlayerStatOptions}
          superChancePercent={selectedPlayer.superChancePercent}
          injuryRiskPercent={selectedPlayer.injuryRiskPercent}
          condition={selectedPlayer.condition}
          injuryWeeks={selectedPlayer.injuryWeeks}
          trainingPoints={trainingPoints}
          lastDrillResult={lastDrillResult}
          promiseGate={viewModel.trainingPromiseGate}
          onSwitchToPromised={onSelectPlayer}
          onTrainDrill={onTrainDrill}
          onDismiss={() => setDrillPickerOpen(false)}
          reduceMotion={reduceMotion}
          saveWarning={saveWarning}
          quickTrainPathId={quickTrainPathId}
          onQuickTrainConsumed={forgetQuickTrainRequest}
          conditionWarningSeen={conditionWarningSeen}
          onConditionWarningShown={onConditionWarningShown}
        />
      ) : null}
    </View>
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
  currentColumnWidth: string;
  potentialColumnWidth: string;
  conditionColumnWidth: string;
  squadSort: SquadSort | null;
  setSquadSort: Dispatch<SetStateAction<SquadSort | null>>;
  sortedPlayers: readonly SquadPlayerViewModel[];
  trainingPoints: number;
  selectedPlayerId?: string;
  guideFocus?: AssistantGuideFocus;
  guideOverallSort: boolean;
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
  currentColumnWidth,
  potentialColumnWidth,
  conditionColumnWidth,
  squadSort,
  setSquadSort,
  sortedPlayers,
  trainingPoints,
  selectedPlayerId,
  guideFocus,
  guideOverallSort,
  onSelectPlayer,
  onPressTrainingBadge,
}: RosterSectionProps) {
  // The lesson is about the column, so it only needs to know that some player
  // triggered it — not which row they are on.
  const conditionCueShowing = conditionCuePlayerId !== null;
  return (
    <View>
      <SectionLabel
        eyebrow="Team register"
        title={`${viewModel.players.length} players`}
        right={<StatusChip label={`${trainingPoints} TP`} />}
      />
      <View className={guidePlayers
        ? 'relative mt-20 border-4 border-blue-dark bg-blue-light p-1'
        : conditionCueShowing || guideOverallSort
          ? 'relative mt-20 border-2 border-ink bg-white'
          : 'border-2 border-ink bg-white'}>
        {guidePlayers && !playerGuideDismissed ? (
          <TutorialTapCue
            label="Tap +"
            detail="Train a player"
            style={{ left: '50%', marginLeft: -TUTORIAL_TAP_CUE_WIDTH / 2, top: -72 }}
          />
        ) : null}
        <View className="flex-row items-center border-b border-ink/20 px-2">
          <View style={styles.roleColumn} />
          <SquadSortHeader label={wideColumns ? 'Player' : 'Name'} sortKey="player" sort={squadSort} widthClass="flex-1" onSort={key => setSquadSort(current => nextSquadSort(current, key))} />
          <SquadSortHeader
            label={wideColumns ? 'Score' : 'OVR'}
            sortKey="overall"
            sort={squadSort}
            widthClass={currentColumnWidth}
            align="right"
            onSort={key => setSquadSort(current => nextSquadSort(current, key))}
            tutorialCue={guideOverallSort ? (
              <TutorialTapCue
                label="Tap here"
                detail="To sort"
                style={{
                  left: '50%',
                  marginLeft: -TUTORIAL_TAP_CUE_WIDTH / 2,
                  top: -TUTORIAL_TAP_CUE_ABOVE_OFFSET,
                }}
              />
            ) : null}
          />
          <SquadSortHeader label={wideColumns ? 'Potential' : 'POT'} sortKey="potential" sort={squadSort} widthClass={potentialColumnWidth} align="right" onSort={key => setSquadSort(current => nextSquadSort(current, key))} />
          <SquadSortHeader
            label={wideColumns ? 'Condition' : 'Cond'}
            sortKey="condition"
            sort={squadSort}
            widthClass={conditionColumnWidth}
            align="right"
            onSort={key => setSquadSort(current => nextSquadSort(current, key))}
            tutorialCue={conditionCueShowing ? (
              <TutorialTapCue
                label="Condition"
                detail="Too low and they risk injury. You're okay for now."
                style={{
                  left: '50%',
                  marginLeft: -TUTORIAL_TAP_CUE_WIDTH / 2,
                  top: -TUTORIAL_TAP_CUE_ABOVE_OFFSET,
                }}
              />
            ) : null}
          />
          {/* The train column needs its width to keep the + buttons aligned, but
              not a label: the + is self-explanatory and the word was clipping. */}
          <View className="w-12" />
        </View>
        {sortedPlayers.length === 0 ? (
          <View className="items-center px-4 py-8">
            <PixelText className="text-base uppercase text-ink">No players registered</PixelText>
            <Text className="mt-2 text-center text-sm leading-5 text-ink/55">
              Sign a player from the market to start training.
            </Text>
          </View>
        ) : sortedPlayers.map((player) => {
          const selected = player.id === selectedPlayerId;
          const glowAssignmentButton = guidePlayers
            && !trainingCueUsed
            && player.id === viewModel.createdPlayerId
            && player.injuryWeeks === 0;
          const guideConciergePlayer = player.id === selectedPlayerId && (
            (guideFocus === 'injury-lineup' && player.injuryWeeks > 0)
            || guideFocus === 'transfer-request'
          );
          return (
            <View
              key={player.id}
              className={selected
                ? 'flex-row items-center border-b border-ink/20 bg-paper-dark px-2 py-2'
                : player.injuryWeeks > 0
                  ? 'flex-row items-center border-b border-red-dark/30 bg-red-light px-2 py-2'
                  : 'flex-row items-center border-b border-ink/10 px-2 py-2'}
              style={guideConciergePlayer
                ? { marginTop: TUTORIAL_TAP_CUE_RESERVED_SPACE }
                : undefined}
            >
              {guideConciergePlayer ? (
                <TutorialTapCue
                  label="Bert says"
                  detail={guideFocus === 'injury-lineup' ? 'Review injury and replacement' : 'Review this player'}
                  style={{
                    left: '50%',
                    marginLeft: -TUTORIAL_TAP_CUE_WIDTH / 2,
                    top: -TUTORIAL_TAP_CUE_ABOVE_OFFSET,
                  }}
                />
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open summary for ${player.name}`}
                onPress={() => onSelectPlayer(player.id)}
                className="min-h-11 flex-1 flex-row items-center"
                style={({ pressed }) => ({ opacity: pressed ? 0.65 : undefined })}
              >
                <Text
                  style={styles.roleColumn}
                  className={selected ? 'font-pixel text-sm text-ink' : 'font-pixel text-sm text-blue-dark'}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                  numberOfLines={1}
                >{player.role}</Text>
                <View className="flex-1 pr-2">
                  <Text className="text-base font-bold text-ink" numberOfLines={1}>{player.name}</Text>
                  {player.injuryWeeks > 0 ? (
                    <Text className="mt-0.5 font-pixel text-sm uppercase text-red-dark" numberOfLines={1}>
                      OUT · {player.injuryWeeks} {player.injuryWeeks === 1 ? 'WEEK' : 'WEEKS'}
                    </Text>
                  ) : player.isStarter ? (
                    // One word, because the name column is the row's only
                    // flexible cell: "Starting XI" clipped to "STARTI…" on a
                    // phone, which reads as a bug rather than an abbreviation.
                    <Text className="mt-0.5 font-pixel text-sm uppercase text-pitch-dark" numberOfLines={1}>
                      Start
                    </Text>
                  ) : null}
                  {player.isCaptain || player.contractPromiseLabel ? (
                    <Text className="mt-0.5 font-pixel text-sm uppercase text-blue-dark" numberOfLines={1}>
                      {[player.isCaptain ? 'Captain' : undefined, player.shirtNumber ? `#${player.shirtNumber}` : undefined, player.contractPromiseLabel].filter(Boolean).join(' · ')}
                    </Text>
                  ) : null}
                  <Text className="mt-1 text-sm text-ink/60" numberOfLines={1}>{player.contractLabel}</Text>
                  {player.powerName ? (
                    <PixelText className="mt-0.5 text-sm uppercase text-gold-dark" numberOfLines={1}>★ {player.powerName}</PixelText>
                  ) : null}
                </View>
                <Text className={`${currentColumnWidth} text-right font-mono text-base text-ink`} numberOfLines={1}>{player.overall}</Text>
                <Text className={`${potentialColumnWidth} pr-1 text-right font-mono text-base text-gold-dark`} numberOfLines={1}>{player.potentialGrade}</Text>
                <Text
                  className={`${conditionColumnWidth} text-right font-mono text-sm ${CONDITION_TONE[energyBand(player.condition)]}`}
                  numberOfLines={1}
                >
                  {player.condition}%
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={player.injuryWeeks > 0
                  ? `${player.name} is injured and cannot train`
                  : player.priorityDrillsRemaining !== undefined
                    ? `Train ${player.name} now, ${player.priorityDrillsRemaining} promised drills owed`
                    : `Train ${player.name} now`}
                accessibilityState={{ disabled: player.injuryWeeks > 0 }}
                disabled={player.injuryWeeks > 0}
                onPress={() => onPressTrainingBadge(player.id)}
                className={player.injuryWeeks > 0
                  ? 'ml-1 h-11 w-11 items-center justify-center border border-ink/20 bg-paper-dark'
                  : player.priorityDrillsRemaining !== undefined
                    ? 'ml-1 h-11 w-11 items-center justify-center border-2 border-blue-dark bg-blue-light'
                    : glowAssignmentButton
                      ? 'ml-1 h-11 w-11 items-center justify-center border-2 border-gold-dark bg-gold-light'
                      : 'ml-1 h-11 w-11 items-center justify-center border border-ink/30'}
                style={({ pressed }) => [
                  { opacity: pressed && player.injuryWeeks === 0 ? 0.65 : undefined },
                  glowAssignmentButton ? styles.assignmentButtonGlow : null,
                ]}
              >
                <Text className={player.injuryWeeks > 0
                  ? 'font-mono text-base text-ink/30'
                  : player.priorityDrillsRemaining !== undefined
                    ? 'font-mono text-base text-blue-dark'
                    : glowAssignmentButton
                      ? 'font-mono text-base text-ink'
                      : 'font-mono text-base text-ink/40'}>
                  {player.priorityDrillsRemaining ?? '+'}
                </Text>
              </Pressable>
            </View>
          );
        })}
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
  return (
    <View>
      <SectionLabel
        eyebrow="Drill shop"
        title="Upgrade a path"
        right={<StatusChip label={formatCurrency(money)} />}
      />
      <View className="border-2 border-ink bg-white">
        {upgrades.map(upgrade => {
          const owned = `${upgrade.drillName} · +${upgrade.ownedGain} for ${upgrade.ownedTpCost} TP`;
          const maxed = upgrade.nextTier === undefined;
          const buyable = !maxed && upgrade.blockedReason === undefined;
          return (
            <View
              key={upgrade.pathId}
              className="flex-row items-center gap-3 border-b border-ink/10 px-3 py-2"
            >
              <View className="min-w-0 flex-1">
                <PixelText className="text-sm uppercase tracking-wide text-blue-dark" numberOfLines={1}>
                  {upgrade.label}
                </PixelText>
                <Text className="mt-0.5 text-sm text-ink" numberOfLines={1}>{owned}</Text>
                {/* One line, not two: the upgrade's pitch while it can be
                    bought, the reason it cannot once it cannot. Both at once
                    repeated the tier number and painted the whole column. */}
                <Text className="mt-0.5 text-xs text-ink/55" numberOfLines={2}>
                  {maxed
                    ? 'Best drill owned.'
                    : upgrade.blockedReason
                      ?? `Tier ${upgrade.nextTier} · +${upgrade.nextGain} for ${upgrade.nextTpCost} TP`}
                </Text>
              </View>
              {maxed ? (
                <View className="h-11 w-24 items-center justify-center border border-ink/20 bg-paper-dark">
                  <PixelText className="text-sm uppercase text-ink/40">Tier 5</PixelText>
                </View>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={buyable
                    ? `Buy ${upgrade.label} Tier ${upgrade.nextTier} drill for ${formatCurrency(upgrade.cost ?? 0)}`
                    : `${upgrade.label} Tier ${upgrade.nextTier} drill unavailable. ${upgrade.blockedReason ?? ''}`}
                  accessibilityState={{ disabled: !buyable }}
                  disabled={!buyable}
                  onPress={() => onBuy(upgrade.pathId)}
                  className={buyable
                    ? 'h-11 w-24 items-center justify-center border-2 border-b-4 border-ink bg-gold-light'
                    : 'h-11 w-24 items-center justify-center border border-ink/20 bg-paper-dark'}
                >
                  <Text className={buyable ? 'font-mono text-sm text-ink' : 'font-mono text-sm text-ink/40'}>
                    {formatCurrency(upgrade.cost ?? 0)}
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
  attributesRef?: RefObject<View | null>;
  onAttributesLayout?: () => void;
}

function PlayerFileSection({
  selectedPlayer,
  selectedArchetype,
  statOptions,
  onTrainAttribute,
  guideQuickTrain = false,
  attributesRef,
  onAttributesLayout,
}: PlayerFileSectionProps) {
  return (
    <PaperPanel
      kicker="Player file"
      title={selectedPlayer.name}
      stamp={selectedPlayer.injuryWeeks > 0 ? 'OUT' : selectedPlayer.licensed ? 'Licensed' : selectedPlayer.role}
    >
      <View className="mb-4 flex-row items-center gap-4">
        <View className="border-2 border-b-4 border-ink bg-blue-light p-2">
          <PixelPortrait playerId={selectedPlayer.id} role={selectedPlayer.role} lookId={selectedPlayer.lookId} />
        </View>
        <View className="flex-1">
          <PixelText className="text-sm uppercase tracking-wide text-ink/50">Player identity</PixelText>
          <PixelText className="mt-1 text-lg uppercase text-ink">{selectedPlayer.role} · {selectedPlayer.archetype}</PixelText>
          <Text className="mt-1 text-sm text-ink/60">{selectedPlayer.personality} · Fame {selectedPlayer.fame}</Text>
        </View>
      </View>
      {selectedPlayer.injuryWeeks > 0 ? (
        <View className="mb-3 border-2 border-b-4 border-red-dark bg-red-light p-3">
          <Text className="font-pixel text-base uppercase text-red-dark">
            OUT · {selectedPlayer.injuryWeeks} {selectedPlayer.injuryWeeks === 1 ? 'WEEK' : 'WEEKS'}
          </Text>
          <Text className="mt-1 text-sm text-ink/70">Unavailable for match selection while recovering.</Text>
        </View>
      ) : selectedPlayer.awayWeeks > 0 ? (
        // Gold, not red: leave is a consequence the manager chose, and keeping
        // red for injury alone means the two read apart at a glance.
        <View className="mb-3 border-2 border-b-4 border-gold-dark bg-gold-light p-3">
          <Text className="font-pixel text-base uppercase text-gold-dark">
            ON LEAVE · {selectedPlayer.awayWeeks} {selectedPlayer.awayWeeks === 1 ? 'WEEK' : 'WEEKS'}
          </Text>
          <Text className="mt-1 text-sm text-ink/70">
            Away on a granted request. Cannot be selected or trained.
          </Text>
        </View>
      ) : null}
      <View className="flex-row gap-2">
        <Metric label="Current rating" value={String(selectedPlayer.overall)} />
        <Metric
          label="Condition"
          value={`${selectedPlayer.condition}%`}
          tone={energyBand(selectedPlayer.condition) === 'red' ? 'negative' : 'positive'}
        />
        <Metric label="Wage / wk" value={formatCurrency(selectedPlayer.weeklyWage)} />
      </View>
      <View className="mt-2 flex-row gap-2">
        <Metric label="Age" value={String(selectedPlayer.age)} />
        <Metric
          label="Potential"
          value={`${selectedPlayer.potentialGrade} · ${selectedPlayer.superChancePercent}% SUPER`}
          tone="positive"
        />
        <Metric label="Fame" value={String(selectedPlayer.fame)} />
      </View>
      {/* Morale and loyalty sit together because they are the same kind of
          number on two different clocks: morale swings on results and recovers
          on wins, loyalty only moves when the manager decides something and
          never recovers on its own. */}
      <View className="mt-2 flex-row items-center gap-2">
        <Metric label="Morale" value={`${selectedPlayer.morale}%`} />
        <InfoTip
          align="right"
          className="min-w-0 flex-1"
          text={`How much they want to stay. It sets the price of their next contract, and below ${LOYALTY_NO_RENEWAL_THRESHOLD} they will not re-sign at all.`}
          accessibilityLabel={`Loyalty ${selectedPlayer.loyalty} out of 100. It sets the price of their next contract, and below ${LOYALTY_NO_RENEWAL_THRESHOLD} they will not re-sign at all.`}
        >
          <Metric
            label="Loyalty"
            value={String(selectedPlayer.loyalty)}
            tone={selectedPlayer.loyalty <= LOYALTY_WARNING_THRESHOLD ? 'negative' : 'normal'}
          />
        </InfoTip>
      </View>
      <View className="mt-3 flex-row items-center justify-between gap-3 border-t border-ink/20 pt-3">
        <View className="flex-1">
          <PixelText className="text-sm uppercase tracking-wide text-ink/50">Contract</PixelText>
          <Text className="mt-1 text-base font-bold text-ink">{selectedPlayer.contractLabel}</Text>
        </View>
        {selectedPlayer.powerName ? <StatusChip label={selectedPlayer.powerName} tone="hero" /> : null}
      </View>
      {selectedPlayer.contractPromiseLabel || selectedPlayer.isCaptain || selectedPlayer.shirtNumber ? (
        <View className="mt-3 flex-row flex-wrap gap-2">
          {selectedPlayer.isCaptain ? <StatusChip label="Captain" selected /> : null}
          {selectedPlayer.shirtNumber ? <StatusChip label={`Shirt #${selectedPlayer.shirtNumber}`} /> : null}
          {selectedPlayer.contractPromiseLabel ? <StatusChip label={selectedPlayer.contractPromiseLabel} selected /> : null}
        </View>
      ) : null}
      <View className="mt-3 border border-ink/20 bg-paper-dark/40 px-3 py-3">
        <View className="flex-row items-center justify-between gap-3">
          <PixelText className="text-sm uppercase tracking-wide text-ink/50">Archetype</PixelText>
          <View className="min-w-0 flex-1 items-end">
            <Text className="text-base font-bold text-ink">{selectedPlayer.archetype}</Text>
            <View className="mt-1 flex-row flex-wrap justify-end gap-x-2">
              <Text className="font-pixel text-sm text-pitch-dark">{selectedArchetype?.strengths}</Text>
              <Text className="font-pixel text-sm text-ink/50">{selectedArchetype?.weaknesses}</Text>
            </View>
          </View>
        </View>
        <View className="mt-2 flex-row items-center justify-between gap-3">
          <PixelText className="text-sm uppercase tracking-wide text-ink/50">Position</PixelText>
          <Text className="font-pixel text-sm text-blue-dark">{selectedPlayer.positionTrainingLabel}</Text>
        </View>
        <View className="mt-2 flex-row items-center justify-between gap-3">
          <PixelText className="text-sm uppercase tracking-wide text-ink/50">Personality</PixelText>
          <InfoTip
            align="right"
            text={personalityExplainer(selectedPlayer.personality)}
            accessibilityLabel={`Personality: ${selectedPlayer.personality}. ${personalityExplainer(selectedPlayer.personality)}`}
          >
            <Text className="text-base font-bold text-ink">{selectedPlayer.personality}</Text>
          </InfoTip>
        </View>
        <View className="mt-2 flex-row items-center justify-between gap-3">
          <PixelText className="text-sm uppercase tracking-wide text-ink/50">Fame</PixelText>
          <Text className="font-mono text-base text-ink">{selectedPlayer.fame}</Text>
        </View>
      </View>
      <View
        ref={attributesRef}
        collapsable={false}
        onLayout={onAttributesLayout}
        className={guideQuickTrain
          ? 'relative mt-20 border-2 border-blue-dark bg-blue-light/20 p-3'
          : 'mt-3 border-2 border-ink bg-white p-3'}
      >
        {guideQuickTrain ? (
          <TutorialTapCue
            label="Quick Train"
            detail="Select a player and tap the attribute you want to train."
            style={{
              left: '50%',
              marginLeft: -TUTORIAL_TAP_CUE_WIDTH / 2,
              top: -TUTORIAL_TAP_CUE_ABOVE_OFFSET,
            }}
          />
        ) : null}
        <PixelText className="mb-2 text-sm uppercase tracking-wide text-ink/50">Attributes</PixelText>
        <Text className="mb-3 text-xs leading-4 text-ink/55">
          PAC pace · SHO shooting · PAS passing · DEF defense · TEC technique · STA stamina · REF goalkeeping
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {selectedPlayer.attributes
            .filter(attribute => selectedPlayer.role === 'GK'
              ? attribute.label !== 'SHO'
              : attribute.label !== 'REF')
            .map(attribute => {
              // Quick Train: the attribute IS the button. Tapping it opens the
              // confirmation for whichever drill trains that stat.
              const option = statOptions?.find(candidate => candidate.shortCode === attribute.label);
              const trainable = option !== undefined && onTrainAttribute !== undefined;
              return (
                <Pressable
                  key={attribute.label}
                  accessibilityRole={trainable ? 'button' : 'text'}
                  accessibilityLabel={trainable
                    ? `Train ${attribute.label}, currently ${attribute.value}. ${option.drillName} for ${option.tpCost} training points, plus ${option.gain}.`
                    : `${attribute.label} ${attribute.value}`}
                  disabled={!trainable}
                  onPress={trainable ? () => onTrainAttribute(option.pathId) : undefined}
                  className={trainable
                    ? 'min-w-[29%] flex-1 border-2 border-b-4 border-ink/40 bg-paper px-2 py-2'
                    : 'min-w-[29%] flex-1 border border-ink/20 bg-paper px-2 py-2'}
                  style={({ pressed }) => ({ opacity: pressed && trainable ? 0.65 : undefined })}
                >
                  <PixelText className="text-sm uppercase text-ink/50">{attribute.label}</PixelText>
                  <Text className="mt-1 font-mono text-base text-ink">
                    {attribute.value}
                  </Text>
                  {trainable ? (
                    <Text className="mt-0.5 font-mono text-xs text-blue-dark" numberOfLines={1}>
                      +{option.gain} · {option.tpCost} TP
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
        </View>
      </View>
    </PaperPanel>
  );
}

function SquadSortHeader({
  label,
  sortKey,
  sort,
  widthClass,
  align = 'left',
  onSort,
  tutorialCue,
}: {
  label: string;
  sortKey: SquadSortKey;
  sort: SquadSort | null;
  widthClass: string;
  align?: 'left' | 'right';
  onSort: (key: SquadSortKey) => void;
  tutorialCue?: ReactNode;
}) {
  const direction = sort?.key === sortKey ? sort.direction : null;
  const nextDirection = direction === null
    ? 'descending'
    : direction === 'descending'
      ? 'ascending'
      : 'default order';
  return (
    <InfoTip
      text={COLUMN_EXPLAINER[sortKey]}
      align={align}
      className={widthClass}
      accessibilityLabel={`Sort by ${label}, ${direction ?? 'default order'}. Next: ${nextDirection}. ${COLUMN_EXPLAINER[sortKey]}`}
      onPress={() => onSort(sortKey)}
    >
    <View
      className={`relative min-h-11 w-full flex-row items-center gap-1 ${align === 'right' ? 'justify-end' : 'justify-start'}`}
    >
      {tutorialCue}
      <PixelText
        // A step down from the row values so the spelled-out words fit their
        // column with the sort arrow — headers label the data, they aren't it.
        className={direction === null
          ? 'text-xs uppercase text-ink/50'
          : 'text-xs uppercase text-blue-dark'}
        numberOfLines={1}
        ellipsizeMode="clip"
      >
        {label}{direction === 'descending' ? ' ▼' : direction === 'ascending' ? ' ▲' : ''}
      </PixelText>
    </View>
    </InfoTip>
  );
}

const styles = StyleSheet.create({
  roleColumn: { width: ROSTER_ROLE_COLUMN_WIDTH, flexShrink: 0 },
  assignmentButtonGlow: {
    boxShadow: '0 0 12px 4px rgba(237, 181, 74, 0.9)',
    shadowColor: '#edb54a',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 9,
    elevation: 10,
  },
});
