import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { AssistantGuideFocus } from '../../content';
import { ActionButton, Metric, PaperPanel, SectionLabel, StatusChip, formatCompactNumber, formatCurrency } from '../components/Scorecard';
import { PixelPortrait } from '../components/PixelPortrait';
import { ManagementSprite } from '../components/ManagementSprite';
import type { FocusDrillViewModel, SquadTrainingViewModel } from '../models';
import { TutorialTapCue } from '../TutorialTapCue';
import { SfxPressable as Pressable } from '../components/SfxPressable';
import {
  isTutorialTargetVisible,
  TUTORIAL_TAP_CUE_WIDTH,
} from '../tutorial-cue-position';
import {
  nextSquadSort,
  sortSquadPlayers,
  type SquadSort,
  type SquadSortKey,
} from '../squad-sort';
import { archetypeDevelopmentSummary } from '../archetype-development';

export interface SquadTrainingScreenProps {
  viewModel: SquadTrainingViewModel;
  onSelectPlayer: (playerId: string) => void;
  onTogglePlayerAssignment: (playerId: string) => void;
  onToggleDrill: (drillId: string) => void;
  onApplyTraining: () => void;
  onOpenCoachMarket?: () => void;
  onDismissCoach?: (role: 'HEAD' | 'ASSISTANT') => void;
  guideTraining?: boolean;
  guideFocus?: AssistantGuideFocus;
}

function drillSelectionClass(drill: FocusDrillViewModel): string {
  if (!drill.available) return 'border-ink/20 bg-white opacity-40';
  if (drill.selected) return 'border-violet-dark bg-violet-light';
  return 'border-ink/30 bg-white';
}

export function SquadTrainingScreen({
  viewModel,
  onSelectPlayer,
  onTogglePlayerAssignment,
  onToggleDrill,
  onApplyTraining,
  onOpenCoachMarket,
  onDismissCoach,
  guideTraining = false,
  guideFocus,
}: SquadTrainingScreenProps) {
  const selectedPlayer = viewModel.players.find(player => player.id === viewModel.selectedPlayerId);
  const selectedArchetype = selectedPlayer === undefined
    ? undefined
    : archetypeDevelopmentSummary(selectedPlayer.archetype);
  const assigned = new Set(viewModel.assignedPlayerIds);
  const scrollViewportRef = useRef<View>(null);
  const lockPlanRef = useRef<View>(null);
  const visibilityFrameRef = useRef<number | null>(null);
  const [lockPlanVisible, setLockPlanVisible] = useState(false);
  const [squadSort, setSquadSort] = useState<SquadSort | null>(null);
  const sortedPlayers = useMemo(
    () => sortSquadPlayers(viewModel.players, squadSort),
    [squadSort, viewModel.players],
  );
  const guideLockPlan = guideTraining
    && viewModel.assignedPlayerIds.length > 0
    && viewModel.selectedDrillCount > 0;
  const guidePlayers = guideTraining && viewModel.assignedPlayerIds.length === 0;
  const guideDrills = guideTraining
    && viewModel.assignedPlayerIds.length > 0
    && viewModel.selectedDrillCount === 0;

  const measureLockPlanVisibility = useCallback(() => {
    scrollViewportRef.current?.measureInWindow((viewportX, viewportY, viewportWidth, viewportHeight) => {
      lockPlanRef.current?.measureInWindow((targetX, targetY, targetWidth, targetHeight) => {
        const visible = isTutorialTargetVisible(
          { x: targetX, y: targetY, width: targetWidth, height: targetHeight },
          { x: viewportX, y: viewportY, width: viewportWidth, height: viewportHeight },
        );
        setLockPlanVisible(current => current === visible ? current : visible);
      });
    });
  }, []);

  const scheduleLockPlanVisibility = useCallback(() => {
    if (!guideLockPlan) return;
    if (visibilityFrameRef.current !== null) cancelAnimationFrame(visibilityFrameRef.current);
    visibilityFrameRef.current = requestAnimationFrame(() => {
      visibilityFrameRef.current = null;
      measureLockPlanVisibility();
    });
  }, [guideLockPlan, measureLockPlanVisibility]);

  useEffect(() => {
    if (!guideLockPlan) {
      setLockPlanVisible(false);
      return;
    }
    scheduleLockPlanVisibility();
    return () => {
      if (visibilityFrameRef.current !== null) {
        cancelAnimationFrame(visibilityFrameRef.current);
        visibilityFrameRef.current = null;
      }
    };
  }, [guideLockPlan, scheduleLockPlanVisibility]);

  const showScrollCue = guideTraining
    && viewModel.assignedPlayerIds.length > 0
    && (viewModel.selectedDrillCount === 0 || !lockPlanVisible);

  return (
    <View
      ref={scrollViewportRef}
      collapsable={false}
      className="flex-1"
      onLayout={scheduleLockPlanVisibility}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
        onLayout={scheduleLockPlanVisibility}
        onScroll={scheduleLockPlanVisibility}
        scrollEventThrottle={16}
      >
      <View>
        <Text className="text-sm font-bold uppercase tracking-[2px] text-blue-dark">Squad room</Text>
        <Text className="mt-1 text-xl font-bold uppercase text-ink">Roster & training</Text>
      </View>

      <View className="mt-6">
        <SectionLabel
          eyebrow="Backroom staff"
          title="Coaching staff"
          right={<StatusChip label={`${viewModel.coachingStaff.length} / 2`} selected={viewModel.coachingStaff.length > 0} />}
        />
        {viewModel.coachingStaff.length === 0 ? (
          <PaperPanel kicker="Vacancy" title="The touchline needs a voice" stamp="OPEN">
            <Text className="text-sm leading-5 text-ink/60">
              Hire a head coach to improve specialist training and guide Hero Gauge growth.
            </Text>
            {onOpenCoachMarket ? (
              <View className="mt-3">
                <ActionButton label="Open coach market" accessibilityLabel="Open the coach market" onPress={onOpenCoachMarket} />
              </View>
            ) : null}
          </PaperPanel>
        ) : (
          <View className="gap-3">
            {viewModel.coachingStaff.map(coach => (
              <View key={coach.id} className="border-2 border-b-4 border-ink bg-white p-3">
                <View className="flex-row items-start gap-3">
                  <View className="border-2 border-b-4 border-ink bg-blue-light px-2 pt-2">
                    <ManagementSprite
                      spriteKey={`coach:${coach.portraitId}:rest`}
                      width={72}
                      accessibilityLabel={`${coach.name} coach portrait`}
                    />
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text className="font-mono text-sm font-bold uppercase text-blue-dark">{coach.roleLabel}</Text>
                    <Text className="mt-1 text-lg font-bold text-ink" numberOfLines={1}>{coach.name}</Text>
                    <Text className="mt-1 text-sm text-ink/60">
                      Age {coach.age} · {coach.personalityLabel} · Level {coach.level}
                    </Text>
                    <Text className="mt-1 font-mono text-sm font-bold text-ink">
                      {formatCurrency(coach.weeklyWage)} / week
                    </Text>
                  </View>
                </View>
                <View className="mt-3 flex-row gap-2">
                  {coach.specialtyLabels.map(specialty => (
                    <View key={specialty} className="flex-1 border-2 border-ink bg-paper px-2 py-2">
                      <Text className="text-center text-sm font-bold uppercase text-ink">{specialty}</Text>
                    </View>
                  ))}
                </View>
                <View className="mt-3 border-2 border-blue-dark bg-blue-light px-3 py-2">
                  {coach.effectLabels.map(effect => (
                    <Text key={effect} className="text-sm font-bold text-ink">{effect}</Text>
                  ))}
                </View>
                <Text className="mt-2 text-sm text-ink/55">
                  Employed {coach.seasonsEmployed} season{coach.seasonsEmployed === 1 ? '' : 's'} · Dismissal costs one weekly wage.
                </Text>
                {onDismissCoach ? (
                  <View className="mt-3">
                    <ActionButton
                      label={`Dismiss · ${formatCurrency(coach.severanceCost)} severance`}
                      accessibilityLabel={`Dismiss ${coach.name} with one week severance`}
                      variant="danger"
                      onPress={() => onDismissCoach(coach.role)}
                    />
                  </View>
                ) : null}
              </View>
            ))}
            {onOpenCoachMarket ? (
              <ActionButton label="Review coach market" accessibilityLabel="Review the coach market" onPress={onOpenCoachMarket} />
            ) : null}
          </View>
        )}
      </View>

      <View className="mt-6">
        <SectionLabel
          eyebrow="Team register"
          title={`${viewModel.players.length} players`}
          right={<StatusChip label={`${viewModel.assignedPlayerIds.length} assigned`} />}
        />
        <View className={guidePlayers
          ? 'relative border-4 border-blue-dark bg-blue-light p-1'
          : 'border-2 border-ink bg-white'}>
          {guidePlayers ? (
            <TutorialTapCue
              label="Tap in here"
              detail="Add up to 3 players."
              style={{ left: '50%', marginLeft: -TUTORIAL_TAP_CUE_WIDTH / 2, top: -72 }}
            />
          ) : null}
          <View className="flex-row items-center border-b border-ink/20 px-3">
            <SquadSortHeader label="Role" sortKey="role" sort={squadSort} widthClass="w-10" onSort={key => setSquadSort(current => nextSquadSort(current, key))} />
            <SquadSortHeader label="Player" sortKey="player" sort={squadSort} widthClass="flex-1" onSort={key => setSquadSort(current => nextSquadSort(current, key))} />
            <SquadSortHeader label="★" sortKey="overall" sort={squadSort} widthClass="w-8" align="right" onSort={key => setSquadSort(current => nextSquadSort(current, key))} />
            <SquadSortHeader label="Pot" sortKey="potential" sort={squadSort} widthClass="w-14" align="right" onSort={key => setSquadSort(current => nextSquadSort(current, key))} />
            <SquadSortHeader label="Cond" sortKey="condition" sort={squadSort} widthClass="w-12" align="right" onSort={key => setSquadSort(current => nextSquadSort(current, key))} />
            <Text className="w-12 text-right text-sm font-bold uppercase text-ink/50" numberOfLines={1}>Train</Text>
          </View>
          {sortedPlayers.map((player) => {
            const selected = player.id === viewModel.selectedPlayerId;
            const isAssigned = assigned.has(player.id);
            const glowAssignmentButton = guidePlayers && !isAssigned;
            const guideConciergePlayer = player.id === viewModel.selectedPlayerId && (
              (guideFocus === 'injury-lineup' && player.injuryWeeks > 0)
              || guideFocus === 'transfer-request'
            );
            return (
              <View
                key={player.id}
                className={selected
                  ? 'flex-row items-center border-b border-ink/20 bg-paper-dark px-3 py-2'
                  : player.injuryWeeks > 0
                    ? 'flex-row items-center border-b border-red-dark/30 bg-red-light px-3 py-2'
                    : 'flex-row items-center border-b border-ink/10 px-3 py-2'}
              >
                {guideConciergePlayer ? (
                  <TutorialTapCue
                    label="Bert says"
                    detail={guideFocus === 'injury-lineup' ? 'Review injury and replacement' : 'Review this player'}
                    style={{ left: '50%', marginLeft: -TUTORIAL_TAP_CUE_WIDTH / 2, top: -72 }}
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
                  <Text className="w-8 text-right font-mono text-base font-bold text-ink" numberOfLines={1}>{player.overall}</Text>
                  <Text className="w-14 pr-1 text-right font-mono text-sm font-bold text-gold-dark" numberOfLines={1}>+{player.remainingPotential}</Text>
                  <Text className={player.condition < 30 ? 'w-12 text-right font-mono text-sm font-bold text-stamp' : 'w-12 text-right font-mono text-sm text-ink'} numberOfLines={1}>{player.condition}%</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityLabel={`Assign ${player.name} to selected focus drills`}
                  accessibilityState={{ checked: isAssigned }}
                  onPress={() => onTogglePlayerAssignment(player.id)}
                  className={isAssigned
                    ? 'ml-1 h-11 w-11 items-center justify-center border-2 border-violet-dark bg-violet-light'
                    : glowAssignmentButton
                      ? 'ml-1 h-11 w-11 items-center justify-center border-2 border-gold-dark bg-gold-light'
                      : 'ml-1 h-11 w-11 items-center justify-center border border-ink/30'}
                  style={({ pressed }) => [
                    { opacity: pressed ? 0.65 : undefined },
                    glowAssignmentButton ? styles.assignmentButtonGlow : null,
                  ]}
                >
                  <Text className={isAssigned || glowAssignmentButton
                    ? 'font-mono text-base font-bold text-ink'
                    : 'font-mono text-base text-ink/40'}>
                    {isAssigned ? '✓' : '+'}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      </View>

      {selectedPlayer ? (
        <PaperPanel
          kicker="Player file"
          title={selectedPlayer.name}
          stamp={selectedPlayer.injuryWeeks > 0 ? 'OUT' : selectedPlayer.licensed ? 'Licensed' : selectedPlayer.role}
          className="mt-5"
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
            <Metric label="Rating" value={String(selectedPlayer.overall)} />
            <Metric
              label="Condition"
              value={`${selectedPlayer.condition}%`}
              tone={selectedPlayer.condition < 30 ? 'negative' : 'positive'}
            />
            <Metric label="Wage / wk" value={formatCurrency(selectedPlayer.weeklyWage)} />
          </View>
          <View className="mt-2 flex-row gap-2">
            <Metric label="Age" value={String(selectedPlayer.age)} />
            <Metric label="Potential" value={`+${selectedPlayer.remainingPotential} pts`} tone="positive" />
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
      ) : null}

      <View className="mt-6">
        <SectionLabel
          eyebrow="Weekly plan"
          title="Focus drills"
          right={<StatusChip label={`${viewModel.selectedDrillCount} / ${viewModel.maxDrills}`} selected={viewModel.selectedDrillCount > 0} />}
        />
        <Text className="mb-3 text-sm leading-5 text-ink/60">
          Pick up to {viewModel.maxDrills}. Each selected drill is charged once per week and trains every assigned player. The plan repeats weekly until changed.
        </Text>
        <View className={guideDrills
          ? 'relative gap-2 border-4 border-blue-dark bg-blue-light p-1'
          : 'gap-2'}>
          {guideDrills ? (
            <TutorialTapCue
              label="Tap in here"
              detail="Add up to 3 drills."
              style={{ left: '50%', marginLeft: -TUTORIAL_TAP_CUE_WIDTH / 2, top: -72 }}
            />
          ) : null}
          {viewModel.drills.map((drill) => {
            return (
            <Pressable
              key={drill.id}
              accessibilityRole="checkbox"
              accessibilityLabel={`${drill.name}. ${drill.gainLabel}. Costs ${formatCurrency(drill.moneyCost)} and ${drill.trainingPointCost} training points.`}
              accessibilityState={{ checked: drill.selected, disabled: !drill.available }}
              disabled={!drill.available}
              onPress={() => onToggleDrill(drill.id)}
              className={`relative min-h-16 flex-row items-center border-2 p-3 ${drillSelectionClass(drill)}`}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : undefined })}
            >
              <View className={drill.selected ? 'mr-3 h-9 w-9 items-center justify-center border-2 border-ink bg-paper' : 'mr-3 h-9 w-9 items-center justify-center border border-ink/30'}>
                <Text className={drill.selected ? 'font-mono text-base font-bold text-ink' : 'font-mono text-base text-ink/40'}>{drill.selected ? '✓' : '+'}</Text>
              </View>
              <View className="flex-1 pr-3">
                <Text className="text-base font-bold uppercase text-ink">{drill.name}</Text>
                <Text className={drill.selected ? 'mt-1 text-sm text-ink/70' : 'mt-1 text-sm text-ink/60'}>{drill.gainLabel}</Text>
              </View>
              <View className="items-end">
                <Text className="font-mono text-sm font-bold text-ink" numberOfLines={1}>{formatCurrency(drill.moneyCost)}</Text>
                <Text className={drill.selected ? 'mt-1 font-mono text-sm font-bold text-ink' : 'mt-1 font-mono text-sm text-blue-dark'} numberOfLines={1}>{drill.trainingPointCost} TP</Text>
              </View>
            </Pressable>
            );
          })}
        </View>
      </View>

      {viewModel.lockedPlan === undefined ? (
        <PaperPanel kicker="Plan total" title="Ready for the whistle?" className="mt-5">
          <View className="flex-row gap-2">
            <Metric label="Players" value={String(viewModel.assignedPlayerIds.length)} />
            <Metric label="Money cost" value={formatCurrency(viewModel.totalMoneyCost)} tone="negative" />
            <Metric label="TP cost" value={formatCompactNumber(viewModel.totalTrainingPointCost)} tone="negative" />
          </View>
          <View
            ref={lockPlanRef}
            collapsable={false}
            onLayout={scheduleLockPlanVisibility}
            className={guideTraining && viewModel.selectedDrillCount > 0 ? 'relative mt-3 border-2 border-blue-dark bg-blue-light p-1' : 'relative mt-3'}
          >
            {guideTraining && viewModel.selectedDrillCount > 0 ? (
              <TutorialTapCue detail="Save the plan" style={{ left: 4, top: -74 }} />
            ) : null}
            <ActionButton
              label="Save weekly plan"
              accessibilityLabel="Save the repeating weekly training plan"
              onPress={onApplyTraining}
              disabled={!viewModel.canApply}
            />
          </View>
        </PaperPanel>
      ) : (
        <PaperPanel kicker="The weekly plan" title="Locked in" stamp="SAVED" className="mt-5">
          <View className="gap-3">
            <View className="border-2 border-ink bg-white p-3">
              <Text className="font-mono text-sm font-bold uppercase text-blue-dark">Players</Text>
              <View className="mt-2 gap-1">
                {viewModel.lockedPlan.playerNames.map((playerName, index) => (
                  <Text key={`${playerName}-${index}`} className="text-base font-bold text-ink">✓ {playerName}</Text>
                ))}
              </View>
            </View>
            <View className="border-2 border-ink bg-white p-3">
              <Text className="font-mono text-sm font-bold uppercase text-violet-dark">Training exercises</Text>
              <View className="mt-2 gap-1">
                {viewModel.lockedPlan.drillNames.map(drillName => (
                  <Text key={drillName} className="text-base font-bold text-ink">✓ {drillName}</Text>
                ))}
              </View>
            </View>
          </View>
          <View className="mt-3 flex-row gap-2">
            <Metric label="Money cost" value={formatCurrency(viewModel.lockedPlan.moneyCost)} tone="negative" />
            <Metric label="TP cost" value={formatCompactNumber(viewModel.lockedPlan.trainingPointCost)} tone="negative" />
          </View>
        </PaperPanel>
      )}
      </ScrollView>
      {showScrollCue ? (
        <TutorialTapCue
          label="Scroll down"
          detail={viewModel.selectedDrillCount === 0 ? 'Add up to 3 drills.' : 'Save the plan'}
          style={{ bottom: 10, right: 10 }}
        />
      ) : null}
    </View>
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
        className={label === '★'
          ? 'text-base font-bold text-gold-dark'
          : direction === null
            ? 'text-sm font-bold uppercase text-ink/50'
            : 'text-sm font-bold uppercase text-blue-dark'}
        numberOfLines={1}
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
