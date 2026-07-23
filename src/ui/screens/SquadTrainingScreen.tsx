import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { GestureResponderEvent } from 'react-native';
import type { AssistantGuideFocus } from '../../content';
import { Metric, PaperPanel, SectionLabel, StatusChip, formatCompactNumber, formatCurrency } from '../components/Scorecard';
import { PixelPortrait } from '../components/PixelPortrait';
import type { SquadPlayerViewModel, SquadTrainingViewModel } from '../models';
import { TutorialTapCue } from '../TutorialTapCue';
import { SfxPressable as Pressable } from '../components/SfxPressable';
import {
  TUTORIAL_TAP_CUE_ABOVE_OFFSET,
  TUTORIAL_TAP_CUE_RESERVED_SPACE,
  TUTORIAL_TAP_CUE_WIDTH,
} from '../tutorial-cue-position';
import { TrainingDrillModal } from '../TrainingDrillModal';
import { trainingBadgeAction } from '../training-badge-action';
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

export interface SquadTrainingScreenProps {
  viewModel: SquadTrainingViewModel;
  /** The player currently focused for the profile card and stat picker (mirrors store.selectedPlayerId). */
  selectedPlayerId?: string;
  onSelectPlayer: (playerId: string) => void;
  onTogglePlayerAssignment: (playerId: string) => void;
  onSelectTrainingStat: (playerId: string, pathId: string) => void;
  /** True right after a 4th player is tapped while all 3 slots are full. */
  trainingSlotLimitHit?: boolean;
  onDismissSlotLimit?: () => void;
  guideTraining?: boolean;
  guideFocus?: AssistantGuideFocus;
  reduceMotion?: boolean;
}

export function SquadTrainingScreen({
  viewModel,
  selectedPlayerId,
  onSelectPlayer,
  onTogglePlayerAssignment,
  onSelectTrainingStat,
  trainingSlotLimitHit = false,
  onDismissSlotLimit,
  guideTraining = false,
  guideFocus,
  reduceMotion = false,
}: SquadTrainingScreenProps) {
  const { width } = useWindowDimensions();
  const wideColumns = width >= 600;
  const currentColumnWidth = wideColumns ? 'w-20' : 'w-10';
  const potentialColumnWidth = wideColumns ? 'w-24' : 'w-14';
  const selectedPlayer = viewModel.players.find(player => player.id === selectedPlayerId);
  const selectedArchetype = selectedPlayer === undefined
    ? undefined
    : archetypeDevelopmentSummary(selectedPlayer.archetype);
  const playerGuideTouchStartRef = useRef<TutorialTouchPoint | null>(null);
  const [drillPickerOpen, setDrillPickerOpen] = useState(false);
  const [playerGuideDismissed, setPlayerGuideDismissed] = useState(false);
  const [slotLimitToastVisible, setSlotLimitToastVisible] = useState(false);
  const [squadSort, setSquadSort] = useState<SquadSort | null>(null);
  const sortedPlayers = useMemo(
    () => sortSquadPlayers(viewModel.players, squadSort),
    [squadSort, viewModel.players],
  );
  const assignedCount = viewModel.players.filter(player => player.slotNumber !== undefined).length;
  const guidePlayers = guideTraining && assignedCount === 0;
  const guideStat = guideTraining && assignedCount > 0 && viewModel.slots.length < assignedCount;

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
    const player = viewModel.players.find(candidate => candidate.id === playerId);
    if (player === undefined) return;
    const action = trainingBadgeAction(player.slotNumber !== undefined, assignedCount, viewModel.maxSlots);
    if (action === 'manage') onSelectPlayer(playerId);
    else onTogglePlayerAssignment(playerId);
    if (action !== 'reject-full') setDrillPickerOpen(true);
  }, [viewModel.players, viewModel.maxSlots, assignedCount, onSelectPlayer, onTogglePlayerAssignment]);

  useEffect(() => {
    if (!trainingSlotLimitHit) return undefined;
    setSlotLimitToastVisible(true);
    const timer = setTimeout(() => {
      setSlotLimitToastVisible(false);
      onDismissSlotLimit?.();
    }, 2400);
    return () => clearTimeout(timer);
  }, [trainingSlotLimitHit, onDismissSlotLimit]);

  const drillCuePlayerId = guideStat && !drillPickerOpen
    ? sortedPlayers.find(player => player.slotNumber !== undefined
        && !viewModel.slots.some(slot => slot.playerId === player.id))?.id
    : undefined;

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
          wideColumns={wideColumns}
          currentColumnWidth={currentColumnWidth}
          potentialColumnWidth={potentialColumnWidth}
          squadSort={squadSort}
          setSquadSort={setSquadSort}
          sortedPlayers={sortedPlayers}
          assignedCount={assignedCount}
          selectedPlayerId={selectedPlayerId}
          guideFocus={guideFocus}
          drillCuePlayerId={drillCuePlayerId}
          onSelectPlayer={onSelectPlayer}
          onPressTrainingBadge={handleTrainingBadgePress}
        />
      ),
    },
    ...(selectedPlayer ? [{
      key: 'player-file',
      weight: 9,
      node: (
        <PlayerFileSection selectedPlayer={selectedPlayer} selectedArchetype={selectedArchetype} />
      ),
    }] : []),
    {
      key: 'training-set',
      weight: 3 + viewModel.slots.length,
      node: (
        <TrainingSetSection viewModel={viewModel} />
      ),
    },
  ];

  return (
    <View className="flex-1">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
        onScrollBeginDrag={dismissPlayerGuide}
        onTouchStart={rememberPlayerGuideTouch}
        onTouchMove={dismissPlayerGuideAfterDrag}
        onTouchEnd={forgetPlayerGuideTouch}
        onTouchCancel={forgetPlayerGuideTouch}
      >
        <SectionFlow
          mode={layoutMode}
          header={
            <View className="mb-6">
              <Text className="text-sm font-bold uppercase tracking-[2px] text-blue-dark">Squad room</Text>
              <Text className="mt-1 text-xl font-bold uppercase text-ink">Roster & training</Text>
            </View>
          }
          sections={sections}
        />
      </ScrollView>
      {slotLimitToastVisible ? (
        <View
          pointerEvents="none"
          className="absolute inset-x-4 top-4 border-2 border-stamp bg-red-light px-4 py-3 shadow-lg shadow-black/40"
        >
          <Text className="text-center text-sm font-bold text-ink">Only 3 players — remove one first.</Text>
        </View>
      ) : null}
      {drillPickerOpen && selectedPlayer && selectedPlayer.slotNumber !== undefined && viewModel.selectedPlayerStatOptions ? (
        <TrainingDrillModal
          playerId={selectedPlayer.id}
          playerName={selectedPlayer.name}
          options={viewModel.selectedPlayerStatOptions}
          currentPathId={viewModel.slots.find(slot => slot.playerId === selectedPlayer.id)?.pathId}
          onPickDrill={(playerId, pathId) => {
            onSelectTrainingStat(playerId, pathId);
            setDrillPickerOpen(false);
          }}
          onRemoveFromTraining={playerId => {
            onTogglePlayerAssignment(playerId);
            setDrillPickerOpen(false);
          }}
          onDismiss={() => setDrillPickerOpen(false)}
          reduceMotion={reduceMotion}
        />
      ) : null}
    </View>
  );
}

interface RosterSectionProps {
  viewModel: SquadTrainingViewModel;
  guidePlayers: boolean;
  playerGuideDismissed: boolean;
  wideColumns: boolean;
  currentColumnWidth: string;
  potentialColumnWidth: string;
  squadSort: SquadSort | null;
  setSquadSort: Dispatch<SetStateAction<SquadSort | null>>;
  sortedPlayers: readonly SquadPlayerViewModel[];
  assignedCount: number;
  selectedPlayerId?: string;
  guideFocus?: AssistantGuideFocus;
  drillCuePlayerId?: string;
  onSelectPlayer: (playerId: string) => void;
  onPressTrainingBadge: (playerId: string) => void;
}

function RosterSection({
  viewModel,
  guidePlayers,
  playerGuideDismissed,
  wideColumns,
  currentColumnWidth,
  potentialColumnWidth,
  squadSort,
  setSquadSort,
  sortedPlayers,
  assignedCount,
  selectedPlayerId,
  guideFocus,
  drillCuePlayerId,
  onSelectPlayer,
  onPressTrainingBadge,
}: RosterSectionProps) {
  return (
    <View>
      <SectionLabel
        eyebrow="Team register"
        title={`${viewModel.players.length} players`}
        right={<StatusChip label={`${assignedCount} / ${viewModel.maxSlots} training`} />}
      />
      <View className={guidePlayers
        ? 'relative mt-20 border-4 border-blue-dark bg-blue-light p-1'
        : 'border-2 border-ink bg-white'}>
        {guidePlayers && !playerGuideDismissed ? (
          <TutorialTapCue
            label="Tap in here"
            detail="Add up to 3 players."
            style={{ left: '50%', marginLeft: -TUTORIAL_TAP_CUE_WIDTH / 2, top: -72 }}
          />
        ) : null}
        <View className="flex-row items-center border-b border-ink/20 px-3">
          <View className="w-10" />
          <SquadSortHeader label={wideColumns ? 'Player' : 'Name'} sortKey="player" sort={squadSort} widthClass="flex-1" onSort={key => setSquadSort(current => nextSquadSort(current, key))} />
          <SquadSortHeader label={wideColumns ? 'Current' : 'OVR'} sortKey="overall" sort={squadSort} widthClass={currentColumnWidth} align="right" onSort={key => setSquadSort(current => nextSquadSort(current, key))} />
          <SquadSortHeader label={wideColumns ? 'Potential' : 'POT'} sortKey="potential" sort={squadSort} widthClass={potentialColumnWidth} align="right" onSort={key => setSquadSort(current => nextSquadSort(current, key))} />
          <SquadSortHeader label="Cond" sortKey="condition" sort={squadSort} widthClass="w-16" align="right" onSort={key => setSquadSort(current => nextSquadSort(current, key))} />
          <Text className="w-14 text-right text-sm font-bold uppercase text-ink/50" numberOfLines={1} ellipsizeMode="clip">Train</Text>
        </View>
        {sortedPlayers.map((player) => {
          const selected = player.id === selectedPlayerId;
          const isAssigned = player.slotNumber !== undefined;
          const glowAssignmentButton = guidePlayers && !isAssigned;
          const guideConciergePlayer = player.id === selectedPlayerId && (
            (guideFocus === 'injury-lineup' && player.injuryWeeks > 0)
            || guideFocus === 'transfer-request'
          );
          const guideDrillPlayer = player.id === drillCuePlayerId;
          return (
            <View
              key={player.id}
              className={selected
                ? 'flex-row items-center border-b border-ink/20 bg-paper-dark px-3 py-2'
                : player.injuryWeeks > 0
                  ? 'flex-row items-center border-b border-red-dark/30 bg-red-light px-3 py-2'
                  : 'flex-row items-center border-b border-ink/10 px-3 py-2'}
              style={guideConciergePlayer || guideDrillPlayer ? { marginTop: TUTORIAL_TAP_CUE_RESERVED_SPACE } : undefined}
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
              {guideDrillPlayer ? (
                <TutorialTapCue
                  label="Tap the number"
                  detail="Pick a drill"
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
                <Text className={selected ? 'w-10 font-mono text-sm font-bold text-ink' : 'w-10 font-mono text-sm font-bold text-blue-dark'} numberOfLines={1}>{player.role}</Text>
                <View className="flex-1 pr-2">
                  <Text className="text-base font-bold text-ink" numberOfLines={1}>{player.name}</Text>
                  {player.injuryWeeks > 0 ? (
                    <Text className="mt-0.5 font-mono text-sm font-bold uppercase text-red-dark" numberOfLines={1}>
                      OUT · {player.injuryWeeks} {player.injuryWeeks === 1 ? 'WEEK' : 'WEEKS'}
                    </Text>
                  ) : player.isStarter ? (
                    <Text className="mt-0.5 font-mono text-sm font-bold uppercase text-pitch-dark" numberOfLines={1}>
                      Starting XI
                    </Text>
                  ) : null}
                  {player.isCaptain || player.contractPromiseLabel ? (
                    <Text className="mt-0.5 font-mono text-sm font-bold uppercase text-violet-dark" numberOfLines={1}>
                      {[player.isCaptain ? 'Captain' : undefined, player.shirtNumber ? `#${player.shirtNumber}` : undefined, player.contractPromiseLabel].filter(Boolean).join(' · ')}
                    </Text>
                  ) : null}
                  <Text className="mt-1 text-sm text-ink/60" numberOfLines={1}>{player.contractLabel}</Text>
                  {player.powerName ? (
                    <Text className="mt-0.5 text-sm font-bold uppercase text-gold-dark" numberOfLines={1}>★ {player.powerName}</Text>
                  ) : null}
                </View>
                <Text className={`${currentColumnWidth} text-right font-mono text-base font-bold text-ink`} numberOfLines={1}>{player.overall}</Text>
                <Text className={`${potentialColumnWidth} pr-1 text-right font-mono text-base font-bold text-gold-dark`} numberOfLines={1}>{player.potentialGrade}</Text>
                <Text className={player.condition < 30 ? 'w-16 text-right font-mono text-sm font-bold text-stamp' : 'w-16 text-right font-mono text-sm text-ink'} numberOfLines={1}>{player.condition}%</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={player.trainingLocked
                  ? `${player.name} is locked into training by a contract promise`
                  : isAssigned
                    ? `Change or remove ${player.name}'s training drill`
                    : `Add ${player.name} to this week's training slots`}
                accessibilityState={{ disabled: player.trainingLocked === true }}
                disabled={player.trainingLocked === true}
                onPress={() => onPressTrainingBadge(player.id)}
                className={player.trainingLocked
                  ? 'ml-2 h-11 w-12 items-center justify-center border border-ink/20 bg-paper-dark'
                  : isAssigned
                    ? 'ml-2 h-11 w-12 items-center justify-center border-2 border-violet-dark bg-violet-light'
                    : glowAssignmentButton
                      ? 'ml-2 h-11 w-12 items-center justify-center border-2 border-gold-dark bg-gold-light'
                      : 'ml-2 h-11 w-12 items-center justify-center border border-ink/30'}
                style={({ pressed }) => [
                  { opacity: pressed && !player.trainingLocked ? 0.65 : undefined },
                  glowAssignmentButton ? styles.assignmentButtonGlow : null,
                ]}
              >
                <Text className={player.trainingLocked
                  ? 'font-mono text-base font-bold text-ink/30'
                  : isAssigned || glowAssignmentButton
                    ? 'font-mono text-base font-bold text-ink'
                    : 'font-mono text-base text-ink/40'}>
                  {player.trainingLocked ? '🔒' : player.slotNumber ?? '+'}
                </Text>
              </Pressable>
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
}

function PlayerFileSection({ selectedPlayer, selectedArchetype }: PlayerFileSectionProps) {
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
          <Text className="text-sm font-bold uppercase tracking-wide text-ink/50">Player identity</Text>
          <Text className="mt-1 text-lg font-bold uppercase text-ink">{selectedPlayer.role} · {selectedPlayer.archetype}</Text>
          <Text className="mt-1 text-sm text-ink/60">{selectedPlayer.personality} · Fame {selectedPlayer.fame}</Text>
        </View>
      </View>
      {selectedPlayer.injuryWeeks > 0 ? (
        <View className="mb-3 border-2 border-b-4 border-red-dark bg-red-light p-3">
          <Text className="font-mono text-base font-bold uppercase text-red-dark">
            OUT · {selectedPlayer.injuryWeeks} {selectedPlayer.injuryWeeks === 1 ? 'WEEK' : 'WEEKS'}
          </Text>
          <Text className="mt-1 text-sm text-ink/70">Unavailable for match selection while recovering.</Text>
        </View>
      ) : null}
      <View className="flex-row gap-2">
        <Metric label="Current rating" value={String(selectedPlayer.overall)} />
        <Metric
          label="Condition"
          value={`${selectedPlayer.condition}%`}
          tone={selectedPlayer.condition < 30 ? 'negative' : 'positive'}
        />
        <Metric label="Wage / wk" value={formatCurrency(selectedPlayer.weeklyWage)} />
      </View>
      <View className="mt-2 flex-row gap-2">
        <Metric label="Age" value={String(selectedPlayer.age)} />
        <Metric label="Potential" value={`${selectedPlayer.potentialGrade} · Projected max ${selectedPlayer.projectedOverall}`} tone="positive" />
        <Metric label="Morale" value={`${selectedPlayer.morale}%`} />
      </View>
      <View className="mt-3 flex-row items-center justify-between gap-3 border-t border-ink/20 pt-3">
        <View className="flex-1">
          <Text className="text-sm font-bold uppercase tracking-wide text-ink/50">Contract</Text>
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
          <Text className="text-sm font-bold uppercase tracking-wide text-ink/50">Archetype</Text>
          <View className="min-w-0 flex-1 items-end">
            <Text className="text-base font-bold text-ink">{selectedPlayer.archetype}</Text>
            <View className="mt-1 flex-row flex-wrap justify-end gap-x-2">
              <Text className="font-mono text-sm font-bold text-pitch-dark">{selectedArchetype?.strengths}</Text>
              <Text className="font-mono text-sm font-bold text-red-dark">{selectedArchetype?.weaknesses}</Text>
            </View>
          </View>
        </View>
        <View className="mt-2 flex-row items-center justify-between gap-3">
          <Text className="text-sm font-bold uppercase tracking-wide text-ink/50">Personality</Text>
          <Text className="text-base font-bold text-ink">{selectedPlayer.personality}</Text>
        </View>
        <View className="mt-2 flex-row items-center justify-between gap-3">
          <Text className="text-sm font-bold uppercase tracking-wide text-ink/50">Fame</Text>
          <Text className="font-mono text-base font-bold text-ink">{selectedPlayer.fame}</Text>
        </View>
      </View>
      <View className="mt-3 border-2 border-ink bg-white p-3">
        <Text className="mb-2 text-sm font-bold uppercase tracking-wide text-ink/50">Attributes · current / cap</Text>
        <Text className="mb-3 text-xs leading-4 text-ink/55">
          PAC pace · SHO shooting · PAS passing · DEF defense · TEC technique · STA stamina · REF goalkeeping
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {selectedPlayer.attributes
            .filter(attribute => selectedPlayer.role === 'GK'
              ? attribute.label !== 'SHO'
              : attribute.label !== 'REF')
            .map(attribute => (
              <View key={attribute.label} className="min-w-[29%] flex-1 border border-ink/20 bg-paper px-2 py-2">
                <Text className="text-sm font-bold uppercase text-ink/50">{attribute.label}</Text>
                <Text className="mt-1 font-mono text-base font-bold text-ink">
                  {attribute.value} / {attribute.cap}
                </Text>
              </View>
            ))}
        </View>
      </View>
    </PaperPanel>
  );
}

interface TrainingSetSectionProps {
  viewModel: SquadTrainingViewModel;
}

function TrainingSetSection({ viewModel }: TrainingSetSectionProps) {
  return (
    <PaperPanel kicker="This week" title="Training set">
      {viewModel.slots.length === 0 ? (
        <Text className="text-sm text-ink/60">No players in training this week.</Text>
      ) : (
        <View className="gap-2">
          {viewModel.slots.map(slot => (
            <View
              key={slot.playerId}
              className="flex-row items-center justify-between border border-ink/20 bg-paper px-3 py-2"
            >
              <View className="min-w-0 flex-1 pr-2">
                <Text className="text-base font-bold text-ink" numberOfLines={1}>{slot.playerName}</Text>
                <Text className="mt-0.5 text-sm text-ink/60" numberOfLines={1}>{slot.drillName}</Text>
              </View>
              <Text className="font-mono text-sm font-bold text-pitch-dark" numberOfLines={1}>{slot.gainLabel}</Text>
            </View>
          ))}
        </View>
      )}
      <View className="mt-3 flex-row gap-2">
        <Metric label="Players training" value={String(viewModel.slots.length)} />
        <Metric label="TP cost / wk" value={formatCompactNumber(viewModel.weeklyTrainingPointCost)} tone="negative" />
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
}: {
  label: string;
  sortKey: SquadSortKey;
  sort: SquadSort | null;
  widthClass: string;
  align?: 'left' | 'right';
  onSort: (key: SquadSortKey) => void;
}) {
  const direction = sort?.key === sortKey ? sort.direction : null;
  const nextDirection = direction === null
    ? 'descending'
    : direction === 'descending'
      ? 'ascending'
      : 'default order';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Sort by ${label}, ${direction ?? 'default order'}. Next: ${nextDirection}.`}
      onPress={() => onSort(sortKey)}
      className={`min-h-11 flex-row items-center gap-1 ${align === 'right' ? 'justify-end' : 'justify-start'} ${widthClass}`}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : undefined })}
    >
      <Text
        className={direction === null
          ? 'text-sm font-bold uppercase text-ink/50'
          : 'text-sm font-bold uppercase text-blue-dark'}
        numberOfLines={1}
        ellipsizeMode="clip"
      >
        {label}{direction === 'descending' ? ' ▼' : direction === 'ascending' ? ' ▲' : ''}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  assignmentButtonGlow: {
    boxShadow: '0 0 12px 4px rgba(237, 181, 74, 0.9)',
    shadowColor: '#edb54a',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 9,
    elevation: 10,
  },
});
