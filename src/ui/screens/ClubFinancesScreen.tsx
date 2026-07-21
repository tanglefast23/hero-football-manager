import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View, type LayoutChangeEvent } from 'react-native';
import type { AssistantGuideFocus } from '../../content';
import { ActionButton, Metric, PaperPanel, SectionLabel, StatusChip, formatCurrency } from '../components/Scorecard';
import { FacilitySprite } from '../components/FacilitySprite';
import type {
  ClubFacilityBuildingViewModel,
  ClubFinancesViewModel,
  FacilityTypeViewModel,
} from '../models';
import { TutorialTapCue } from '../TutorialTapCue';
import { TUTORIAL_TAP_CUE_WIDTH } from '../tutorial-cue-position';
import { ManagementSprite } from '../components/ManagementSprite';
import { facilityBenefit } from '../facility-benefit';
import {
  facilityAdjacencyClue,
  facilityAdjacencyLabel,
  facilityAdjacencyPresentation,
} from '../facility-adjacency';
import { SfxPressable as Pressable } from '../components/SfxPressable';
import {
  GUIDED_FIRST_FACILITY_TYPE,
  firstGuidedFacilityUpgradeId,
  guidedFirstFacilityAllowsBuildType,
  guidedFirstFacilityAllowsPlacement,
  guidedFirstFacilityPhase,
  type GuidedFirstFacilityPhase,
} from '../concierge-targets';

const FACILITY_GUIDE_TARGET_TOP = 170;

export interface ClubFinancesScreenProps {
  viewModel: ClubFinancesViewModel;
  onOpenLedgerLine?: (ledgerLineId: string) => void;
  onBuildTrainingGround: () => void;
  onBuildFacility?: (type: FacilityTypeViewModel, x: number, y: number) => void;
  onUpgradeFacility?: (buildingId: string) => void;
  onRelocateFacility?: (buildingId: string, x: number, y: number) => void;
  onOpenCoachMarket?: () => void;
  onDismissCoach?: () => void;
  guideTrainingGround?: boolean;
  guideFocus?: AssistantGuideFocus;
}

export function ClubFinancesScreen({
  viewModel,
  onOpenLedgerLine,
  onBuildTrainingGround,
  onBuildFacility,
  onUpgradeFacility,
  onRelocateFacility,
  onOpenCoachMarket,
  onDismissCoach,
  guideTrainingGround = false,
  guideFocus,
}: ClubFinancesScreenProps) {
  const facility = viewModel.trainingGround;
  const facilities = viewModel.facilities;
  const scrollViewportRef = useRef<View>(null);
  const scrollRef = useRef<ScrollView>(null);
  const facilityYRef = useRef<number | null>(null);
  const groundsYRef = useRef<number | null>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const facilityGuideScrollFrameRef = useRef<number | null>(null);
  const facilityGuideScrolledPhaseRef = useRef<GuidedFirstFacilityPhase | null>(null);
  const facilityGuideBuildTargetRef = useRef<View>(null);
  const facilityGuideGridTargetRef = useRef<View>(null);
  const latestScrollOffsetRef = useRef(0);
  const [selectedBuildType, setSelectedBuildType] = useState<FacilityTypeViewModel | null>(null);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [relocatingBuildingId, setRelocatingBuildingId] = useState<string | null>(null);
  const [previewCell, setPreviewCell] = useState<{ x: number; y: number } | null>(null);
  const [facilityGridWidth, setFacilityGridWidth] = useState(0);
  const selectedBuilding = facilities.buildings.find(
    building => building.id === selectedBuildingId,
  );
  const relocatingBuilding = facilities.buildings.find(
    building => building.id === relocatingBuildingId,
  );
  const selectedBuildEntry = selectedBuildType === null
    ? undefined
    : facilities.catalog.find(entry => entry.type === selectedBuildType);

  const placementActive = selectedBuildType !== null || relocatingBuildingId !== null;
  const guideGrounds = guideFocus === 'coaching-office'
    || guideFocus === 'facility-grid'
    || guideFocus === 'facility-upgrade'
    || guideFocus === 'facility-adjacency';
  const guidedFirstFacility = guideFocus === 'facility-grid' && facilities.buildings.length === 0;
  const guidedFacilityPhase = guidedFirstFacilityPhase(selectedBuildType);
  const activeFootprint = relocatingBuilding
    ? { width: relocatingBuilding.width, height: relocatingBuilding.height }
    : selectedBuildEntry
      ? { width: selectedBuildEntry.width, height: selectedBuildEntry.height }
      : null;
  const activeLabel = relocatingBuilding?.name ?? selectedBuildEntry?.name ?? '';
  const placementType = relocatingBuilding?.type ?? selectedBuildEntry?.type;
  const placementLevel = relocatingBuilding?.level ?? 1;

  const canPlaceAt = useCallback((x: number, y: number): boolean => {
    if (activeFootprint === null) return false;
    if (x + activeFootprint.width > facilities.width) return false;
    if (y + activeFootprint.height > facilities.height) return false;
    return !facilities.buildings.some(building => {
      if (building.id === relocatingBuildingId) return false;
      return x < building.x + building.width
        && building.x < x + activeFootprint.width
        && y < building.y + building.height
        && building.y < y + activeFootprint.height;
    });
  }, [activeFootprint, facilities.buildings, facilities.height, facilities.width, relocatingBuildingId]);

  const cellIsOccupied = useCallback((x: number, y: number): boolean => (
    facilities.buildings.some(building => (
      x >= building.x
      && x < building.x + building.width
      && y >= building.y
      && y < building.y + building.height
    ))
  ), [facilities.buildings]);

  const cancelPlacement = useCallback(() => {
    setSelectedBuildType(null);
    setRelocatingBuildingId(null);
    setPreviewCell(null);
  }, []);

  const handleGridCell = useCallback((x: number, y: number) => {
    if (
      guidedFirstFacility
      && !guidedFirstFacilityAllowsPlacement(selectedBuildType, x, y)
    ) return;
    if (!canPlaceAt(x, y)) return;
    if (relocatingBuildingId !== null) {
      onRelocateFacility?.(relocatingBuildingId, x, y);
      setRelocatingBuildingId(null);
      setPreviewCell(null);
      return;
    }
    if (selectedBuildType !== null) {
      onBuildFacility?.(selectedBuildType, x, y);
      setSelectedBuildType(null);
      setPreviewCell(null);
    }
  }, [canPlaceAt, guidedFirstFacility, onBuildFacility, onRelocateFacility, relocatingBuildingId, selectedBuildType]);

  const scrollFacilityGuideTargetIntoView = useCallback((phase: GuidedFirstFacilityPhase) => {
    if (!guidedFirstFacility || facilityGuideScrolledPhaseRef.current === phase) return;
    const viewport = scrollViewportRef.current;
    const target = phase === 'build-menu'
      ? facilityGuideBuildTargetRef.current
      : facilityGuideGridTargetRef.current;
    if (viewport === null || target === null) return;
    if (facilityGuideScrollFrameRef.current !== null) {
      cancelAnimationFrame(facilityGuideScrollFrameRef.current);
    }
    facilityGuideScrollFrameRef.current = requestAnimationFrame(() => {
      facilityGuideScrollFrameRef.current = null;
      viewport.measureInWindow((_viewportX, viewportY) => {
        target.measureInWindow((_targetX, measuredTargetY) => {
          const targetY = Math.max(
            0,
            latestScrollOffsetRef.current + measuredTargetY - viewportY - FACILITY_GUIDE_TARGET_TOP,
          );
          scrollRef.current?.scrollTo({ y: targetY, animated: true });
          facilityGuideScrolledPhaseRef.current = phase;
        });
      });
    });
  }, [guidedFirstFacility]);

  const scrollToTrainingGround = useCallback(() => {
    if (!guideTrainingGround || facilityYRef.current === null) return;
    if (scrollFrameRef.current !== null) cancelAnimationFrame(scrollFrameRef.current);
    scrollFrameRef.current = requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      scrollRef.current?.scrollTo({ y: Math.max(0, facilityYRef.current! - 12), animated: true });
    });
  }, [guideTrainingGround]);

  useEffect(() => {
    scrollToTrainingGround();
    return () => {
      if (scrollFrameRef.current !== null) cancelAnimationFrame(scrollFrameRef.current);
    };
  }, [scrollToTrainingGround]);

  useEffect(() => {
    if (guideFocus !== 'facility-grid') return;
    setSelectedBuildType(null);
    setSelectedBuildingId(null);
    setRelocatingBuildingId(null);
    setPreviewCell(null);
    facilityGuideScrolledPhaseRef.current = null;
  }, [guideFocus]);

  useEffect(() => {
    if (!guidedFirstFacility) {
      facilityGuideScrolledPhaseRef.current = null;
      return;
    }
    scrollFacilityGuideTargetIntoView(guidedFacilityPhase);
  }, [guidedFacilityPhase, guidedFirstFacility, scrollFacilityGuideTargetIntoView]);

  useEffect(() => () => {
    if (facilityGuideScrollFrameRef.current !== null) {
      cancelAnimationFrame(facilityGuideScrollFrameRef.current);
    }
  }, []);

  useEffect(() => {
    if (!guideGrounds) return;
    if (guideFocus === 'coaching-office') {
      setSelectedBuildType('coaching-office');
      setSelectedBuildingId(null);
    } else if (guideFocus === 'facility-grid') {
      return;
    } else if (guideFocus === 'facility-upgrade' && facilities.buildings.length > 0) {
      setSelectedBuildingId(firstGuidedFacilityUpgradeId(facilities.buildings) ?? null);
      setSelectedBuildType(null);
    }
    if (groundsYRef.current !== null) {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ y: Math.max(0, groundsYRef.current! - 12), animated: true });
      });
    }
  }, [facilities.buildings, guideFocus, guideGrounds]);

  const onTrainingGroundLayout = useCallback((event: LayoutChangeEvent) => {
    facilityYRef.current = event.nativeEvent.layout.y;
    scrollToTrainingGround();
  }, [scrollToTrainingGround]);

  return (
    <View ref={scrollViewportRef} collapsable={false} className="flex-1">
    <ScrollView
      ref={scrollRef}
      className="flex-1"
      contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
      onScroll={event => {
        latestScrollOffsetRef.current = event.nativeEvent.contentOffset.y;
      }}
      scrollEventThrottle={16}
    >
      <View className="flex-row items-end justify-between">
        <View>
          <Text className="text-sm font-bold uppercase text-blue-dark">Accounts office</Text>
          <Text className="mt-1 text-xl font-bold uppercase text-ink">Club finances</Text>
        </View>
        <StatusChip label={viewModel.periodLabel} />
      </View>

      <View className={guideFocus === 'emergency-loan' ? 'relative mt-5 border-2 border-blue-dark bg-blue-light p-1' : 'relative mt-5'}>
        {guideFocus === 'emergency-loan' ? (
          <TutorialTapCue
            label="Bert says"
            detail="Review the loan and recurring costs"
            style={{ left: '50%', marginLeft: -TUTORIAL_TAP_CUE_WIDTH / 2, top: -72 }}
          />
        ) : null}
        <PaperPanel kicker="Cash position" title="The board’s bottom line" stamp="Current">
          <View className="flex-row gap-2">
            <Metric label="Balance" value={formatCurrency(viewModel.resources.money)} />
            <Metric
              label="Expected weekly change"
              value={formatCurrency(viewModel.weeklyNet, true)}
              tone={viewModel.weeklyNet < 0 ? 'negative' : 'positive'}
            />
            <Metric label="Projected balance" value={formatCurrency(viewModel.projectedBalance)} />
          </View>
          <Text className="mt-3 text-xs font-bold uppercase leading-4 tracking-wide text-ink/45">
            Forward estimate · known weekly commitments and steady merchandise · match, sponsor and prize income excluded
          </Text>
          {viewModel.wageSubsidyLabel ? (
            <View className="mt-3 border border-pitch-dark bg-pitch-light px-3 py-2">
              <Text className="text-sm font-bold uppercase tracking-wide text-ink">
                {viewModel.wageSubsidyLabel}
              </Text>
            </View>
          ) : null}
        </PaperPanel>
      </View>

      <View className="mt-6">
        <SectionLabel eyebrow="Itemized statement" title="Every coin accounted for" />
        <View className="border-2 border-ink bg-white">
          <View className="flex-row border-b border-ink/20 px-3 py-2">
            <Text className="flex-1 text-sm font-bold uppercase tracking-wide text-ink/50">Entry</Text>
            <Text className="text-right text-sm font-bold uppercase tracking-wide text-ink/50">Amount</Text>
          </View>
          {viewModel.ledger.map(line => {
            const amountClass = line.kind === 'income'
              ? 'text-pitch-dark'
              : line.kind === 'expense'
                ? 'text-red-dark'
                : 'text-ink';
            return (
              <Pressable
                key={line.id}
                accessibilityRole={onOpenLedgerLine ? 'button' : 'text'}
                accessibilityLabel={`${line.label}, ${line.amount > 0 ? 'plus ' : ''}${formatCurrency(line.amount)}`}
                disabled={!onOpenLedgerLine}
                onPress={() => onOpenLedgerLine?.(line.id)}
                className="min-h-11 flex-row items-center border-b border-ink/10 px-3 py-2"
                style={({ pressed }) => ({ opacity: pressed ? 0.65 : undefined })}
              >
                <Text className="flex-1 text-base text-ink">{line.label}</Text>
                <Text className={`font-mono text-base font-bold ${amountClass}`}>
                  {formatCurrency(line.amount, true)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {viewModel.recentTransactions.length > 0 ? (
        <View className="mt-6">
          <SectionLabel eyebrow="Cash activity" title="Recent club transactions" />
          <View className="border-2 border-ink bg-white">
            {viewModel.recentTransactions.map(transaction => (
              <View
                key={transaction.id}
                className="min-h-12 flex-row items-center border-b border-ink/10 px-3 py-2"
              >
                <View className="flex-1 pr-3">
                  <Text className="text-base font-bold text-ink">{transaction.label}</Text>
                  <Text className="font-mono text-xs uppercase text-ink/50">
                    {transaction.periodLabel} · Balance {formatCurrency(transaction.balanceAfter)}
                  </Text>
                </View>
                <Text className={`font-mono text-base font-bold ${transaction.kind === 'income' ? 'text-pitch-dark' : 'text-red-dark'}`}>
                  {formatCurrency(transaction.amount, true)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <View className="mt-6">
        <SectionLabel eyebrow="Backroom staff" title="Head coach" />
        <PaperPanel
          kicker={viewModel.headCoach ? `Employed ${viewModel.headCoach.seasonsEmployed} season${viewModel.headCoach.seasonsEmployed === 1 ? '' : 's'}` : 'Vacancy'}
          title={viewModel.headCoach?.name ?? 'The touchline needs a voice'}
          stamp={viewModel.headCoach ? `LV${viewModel.headCoach.level}` : 'OPEN'}
        >
          {viewModel.headCoach ? (
            <>
              <View className="flex-row items-center gap-3 border-y-2 border-ink bg-blue-light p-3">
                <View className="border-2 border-b-4 border-ink bg-white px-2 pt-2">
                  <ManagementSprite
                    spriteKey={`coach:${viewModel.headCoach.portraitId}:rest`}
                    width={72}
                    accessibilityLabel={`${viewModel.headCoach.name} coach portrait`}
                  />
                </View>
                <View className="min-w-0 flex-1 gap-2">
                  <Metric label="Age · level" value={`${viewModel.headCoach.age} · ${viewModel.headCoach.level}`} />
                  <Metric label="Wage / wk" value={formatCurrency(viewModel.headCoach.weeklyWage)} />
                </View>
              </View>
              <View className="mt-3 flex-row gap-2">
                {viewModel.headCoach.specialtyLabels.map(specialty => (
                  <View key={specialty} className="flex-1 border-2 border-ink bg-blue-light px-2 py-2">
                    <Text className="text-center text-sm font-bold uppercase text-ink">{specialty}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <Text className="text-sm leading-5 text-ink/60">
              Coaches improve their specialist drills and charge a separate weekly wage.
            </Text>
          )}
          {viewModel.assistantCoach ? (
            <View className="mt-3 border-2 border-violet-dark bg-violet-light p-3">
              <View className="flex-row items-center justify-between gap-3">
                <View className="flex-1">
                  <Text className="font-mono text-sm font-bold uppercase text-violet-dark">Assistant coach</Text>
                  <Text className="mt-1 text-base font-bold text-ink">{viewModel.assistantCoach.name} · Lv{viewModel.assistantCoach.level}</Text>
                </View>
                <Text className="font-mono text-sm font-bold text-ink">{formatCurrency(viewModel.assistantCoach.weeklyWage)}/wk</Text>
              </View>
              <Text className="mt-2 text-sm text-ink/65">
                {viewModel.assistantCoach.specialtyLabels.join(' · ')} · {viewModel.assistantCoach.seasonsEmployed} season{viewModel.assistantCoach.seasonsEmployed === 1 ? '' : 's'} employed
              </Text>
            </View>
          ) : null}
          {onOpenCoachMarket ? (
            <View className="mt-3 gap-2">
              <ActionButton
                label={viewModel.headCoach ? 'Review coach market' : 'Hire a head coach'}
                accessibilityLabel={viewModel.headCoach ? 'Review coach market' : 'Hire a head coach'}
                onPress={onOpenCoachMarket}
              />
              {viewModel.headCoach && onDismissCoach ? (
                <ActionButton
                  label={`Dismiss · ${formatCurrency(viewModel.headCoach.severanceCost)} severance`}
                  accessibilityLabel={`Dismiss ${viewModel.headCoach.name} with one week severance`}
                  variant="danger"
                  onPress={onDismissCoach}
                />
              ) : null}
            </View>
          ) : null}
        </PaperPanel>
      </View>

      <View
        className={guideGrounds ? 'relative mt-6 border-2 border-blue-dark bg-blue-light p-1' : 'relative mt-6'}
        onLayout={event => {
          // React Native may release the synthetic event before the next frame.
          // Snapshot the primitive now so the guided scroll never reads a pooled event.
          const groundsY = event.nativeEvent.layout.y;
          groundsYRef.current = groundsY;
          if (guideGrounds && guideFocus !== 'facility-grid') {
            requestAnimationFrame(() => scrollRef.current?.scrollTo({
              y: Math.max(0, groundsY - 12),
              animated: true,
            }));
          }
        }}
      >
        {guideGrounds && guideFocus !== 'facility-grid' ? (
          <TutorialTapCue
            label="Bert says"
            detail={guideFocus === 'facility-upgrade' ? 'Review the upgrade' : 'Use the club grounds'}
            style={{ left: '50%', marginLeft: -TUTORIAL_TAP_CUE_WIDTH / 2, top: -72 }}
          />
        ) : null}
        <SectionLabel
          eyebrow="Club grounds"
          title="Build the place around the team"
          right={<StatusChip label={`${viewModel.facilities.buildings.filter(building => building.status === 'operational').length} open`} />}
        />
        <PaperPanel
          kicker="8 x 6 grounds"
          title="Facilities grid"
          stamp={`${formatCurrency(viewModel.facilities.weeklyUpkeep)}/wk`}
        >
          <Text className="mb-3 text-sm leading-4 text-ink/60">
            Pick a building from the menu below, then tap a glowing square to drop it. Put useful pairs edge-to-edge to discover bonuses.
          </Text>
          {viewModel.facilities.activeProject ? (
            <View className="mb-3 flex-row items-center gap-3 border-2 border-b-4 border-amber-800 bg-amber-100 p-3">
              <ManagementSprite spriteKey="facility:worksite" width={54} accessibilityLabel="Active construction site" />
              <View className="min-w-0 flex-1">
                <Text className="font-mono text-sm font-bold uppercase text-amber-900">Works crew busy</Text>
                <Text className="mt-1 text-base font-bold uppercase text-ink">
                  {viewModel.facilities.activeProject.name} · {viewModel.facilities.activeProject.weeksRemaining}W left
                </Text>
                <Text className="mt-1 text-sm text-ink/60">Only one construction or upgrade project can run at a time.</Text>
              </View>
            </View>
          ) : null}
          {facilities.activeAdjacencies.length > 0 ? (
            <View className="mb-3 border-2 border-pitch-dark bg-pitch-light px-3 py-2">
              <Text className="font-pixel text-sm uppercase text-ink">Pair bonus active!</Text>
              <Text className="mt-1 text-sm leading-4 text-ink/70">
                {facilities.activeAdjacencies.map(facilityAdjacencyLabel).join(' · ')}
              </Text>
            </View>
          ) : null}
          <View
            ref={facilityGuideGridTargetRef}
            collapsable={false}
            className={guidedFirstFacility && guidedFacilityPhase === 'grid'
              ? 'relative overflow-visible border-2 border-ink bg-pitch-light'
              : 'relative overflow-hidden border-2 border-ink bg-pitch-light'}
            style={{ aspectRatio: facilities.width / facilities.height }}
            onLayout={event => {
              setFacilityGridWidth(event.nativeEvent.layout.width);
              if (guidedFacilityPhase === 'grid') scrollFacilityGuideTargetIntoView('grid');
            }}
          >
            {guidedFirstFacility && guidedFacilityPhase === 'grid' && facilityGridWidth > 0 ? (
              <TutorialTapCue
                label="Bert says"
                detail="Tap where you’d like to build the Training Grounds"
                style={{
                  left: '50%',
                  marginLeft: -TUTORIAL_TAP_CUE_WIDTH / 2,
                  top: -72,
                }}
              />
            ) : null}
            <View style={{ flex: 1 }}>
              {Array.from({ length: facilities.height }, (_, y) => (
                <View key={`facility-row-${y}`} style={{ flex: 1, flexDirection: 'row' }}>
                  {Array.from({ length: facilities.width }, (_, x) => {
                    const occupied = cellIsOccupied(x, y);
                    const guideAllowsCell = !guidedFirstFacility
                      || guidedFirstFacilityAllowsPlacement(selectedBuildType, x, y);
                    const buildable = placementActive && guideAllowsCell && !occupied && canPlaceAt(x, y);
                    return (
                      <View
                        key={`facility-cell-${x}-${y}`}
                        style={{
                          flex: 1,
                          borderRightWidth: x === facilities.width - 1 ? 0 : 1,
                          borderBottomWidth: y === facilities.height - 1 ? 0 : 1,
                          borderColor: 'rgba(36, 31, 46, 0.28)',
                        }}
                      >
                        <Pressable
                          accessibilityRole={placementActive ? 'button' : 'none'}
                          accessibilityLabel={placementActive
                            ? `${buildable ? 'Build at' : 'Blocked at'} column ${x + 1}, row ${y + 1}`
                            : undefined}
                          disabled={!placementActive || !guideAllowsCell}
                          onPress={() => handleGridCell(x, y)}
                          onPressIn={() => setPreviewCell({ x, y })}
                          onPressOut={() => setPreviewCell(null)}
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: occupied
                              ? undefined
                              : placementActive
                                ? (buildable ? 'rgba(154, 99, 214, 0.32)' : 'rgba(36, 31, 46, 0.05)')
                                : 'rgba(92, 184, 92, 0.12)',
                          }}
                        >
                          {buildable ? (
                            <Text className="font-mono text-xs font-bold text-violet-dark">+</Text>
                          ) : null}
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>

            <View
              pointerEvents={placementActive ? 'none' : 'box-none'}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            >
              {facilities.buildings.map(building => {
                const selected = building.id === selectedBuildingId;
                const moving = building.id === relocatingBuildingId;
                const comboActive = building.activeAdjacencyIds.length > 0;
                return (
                  <Pressable
                    key={building.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${building.name}, level ${building.level}. ${building.effectLabel}${comboActive ? '. Active adjacency bonus' : ''}`}
                    disabled={placementActive}
                    onPress={() => {
                      setSelectedBuildingId(building.id);
                      setSelectedBuildType(null);
                    }}
                    style={{
                      position: 'absolute',
                      left: `${building.x * 100 / facilities.width}%`,
                      top: `${building.y * 100 / facilities.height}%`,
                      width: `${building.width * 100 / facilities.width}%`,
                      height: `${building.height * 100 / facilities.height}%`,
                      padding: 2,
                      backgroundColor: comboActive ? '#8fd98f' : undefined,
                      shadowColor: comboActive ? '#3f8a4a' : undefined,
                      shadowOpacity: comboActive ? 0.9 : 0,
                      shadowRadius: comboActive ? 5 : 0,
                    }}
                  >
                    <View
                      style={{
                        flex: 1,
                        borderWidth: selected || comboActive ? 3 : 2,
                        borderColor: selected ? '#5b3a91' : comboActive ? '#3f8a4a' : '#241f2e',
                        backgroundColor: moving ? '#c9a6ec' : facilityColor(building),
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: moving ? 0.55 : 1,
                      }}
                    >
                      <ManagementSprite
                        spriteKey={building.status === 'construction'
                          ? 'facility:worksite'
                          : `facility:${building.type}:l${building.level}`}
                        width={Math.min(42, building.width * 30)}
                        accessibilityLabel={`${building.name} ${building.status}`}
                      />
                      <Text className="mt-0.5 text-center text-xs font-bold uppercase text-ink">
                        {building.status === 'operational'
                          ? `L${building.level}`
                          : `${building.status === 'construction' ? 'BUILD' : 'UP'} · ${building.weeksRemaining}W`}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {placementActive && previewCell && activeFootprint ? (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: `${previewCell.x * 100 / facilities.width}%`,
                  top: `${previewCell.y * 100 / facilities.height}%`,
                  width: `${activeFootprint.width * 100 / facilities.width}%`,
                  height: `${activeFootprint.height * 100 / facilities.height}%`,
                  borderWidth: 3,
                  borderColor: canPlaceAt(previewCell.x, previewCell.y) ? '#5b3a91' : '#a83440',
                  backgroundColor: canPlaceAt(previewCell.x, previewCell.y)
                    ? 'rgba(154, 99, 214, 0.45)'
                    : 'rgba(217, 79, 82, 0.40)',
                }}
              />
            ) : null}
          </View>

          {placementActive ? (
            <View className="mt-3 flex-row items-start justify-between gap-3 border-2 border-violet-dark bg-violet-light px-3 py-2">
              <View className="flex-1">
                <Text className="text-sm font-bold uppercase text-violet-dark">
                  {relocatingBuildingId !== null ? `Moving · ${activeLabel}` : `Placing · ${activeLabel}`}
                </Text>
                <Text className="mt-1 text-sm text-ink/70">
                  Tap a glowing square above. A violet outline fits; red is blocked.
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel placement"
                onPress={cancelPlacement}
                className="min-h-11 items-center justify-center border-2 border-violet-dark bg-white px-3"
              >
                <Text className="text-sm font-bold uppercase text-violet-dark">Cancel</Text>
              </Pressable>
            </View>
          ) : (
            <View className="mt-3 border-2 border-dashed border-ink/30 bg-paper px-3 py-2">
              <Text className="text-sm text-ink/70">
                Pick a building from the <Text className="font-bold text-ink">Build menu</Text> below to start — every open square will glow so you can see where it drops.
              </Text>
            </View>
          )}

          {placementActive && placementType ? (
            <View className="mt-2 flex-row items-center gap-3 border-2 border-ink bg-white p-3">
              <View className="border-2 border-ink/20 bg-paper p-1">
                <ManagementSprite
                  spriteKey={`facility:${placementType}:l${placementLevel}`}
                  width={48}
                  accessibilityLabel={activeLabel}
                />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold uppercase text-ink">What it does</Text>
                <Text className="mt-1 text-sm text-ink/80">{facilityBenefit(placementType)}</Text>
              </View>
            </View>
          ) : null}

          {selectedBuilding ? (
            <View className="mt-3 border-2 border-ink bg-white p-3">
              <View className="flex-row items-start justify-between gap-3">
                <View className="border-2 border-ink bg-paper p-1">
                  <FacilitySprite type={selectedBuilding.type} level={selectedBuilding.level} size={48} />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-bold uppercase text-ink">
                    {selectedBuilding.name} · Level {selectedBuilding.level}
                  </Text>
                  <Text className="mt-1 text-sm text-ink/60">
                    {selectedBuilding.status === 'operational'
                      ? `${formatCurrency(selectedBuilding.weeklyUpkeep)}/wk upkeep · ${formatCurrency(selectedBuilding.relocationFee)} to move`
                      : `${selectedBuilding.status === 'construction' ? 'Building' : 'Upgrading'} · ${selectedBuilding.weeksRemaining} week${selectedBuilding.weeksRemaining === 1 ? '' : 's'} remaining`}
                  </Text>
                  <Text className="mt-2 text-sm font-bold leading-4 text-violet-dark">
                    {selectedBuilding.effectLabel}
                  </Text>
                  {selectedBuilding.nextLevelEffectLabel ? (
                    <Text className="mt-1 text-xs font-bold uppercase leading-4 text-ink/45">
                      Next level · {selectedBuilding.nextLevelEffectLabel}
                    </Text>
                  ) : null}
                  {selectedBuilding.activeAdjacencyIds.length > 0 ? (
                    <Text className="mt-2 text-xs font-bold uppercase text-pitch-dark">
                      Active combo · {selectedBuilding.activeAdjacencyIds.map(facilityAdjacencyLabel).join(' · ')}
                    </Text>
                  ) : null}
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close selected facility"
                  onPress={() => {
                    setSelectedBuildingId(null);
                    setRelocatingBuildingId(null);
                  }}
                  className="h-11 w-11 items-center justify-center border-2 border-ink bg-paper"
                >
                  <Text className="font-mono text-base font-bold text-ink">×</Text>
                </Pressable>
              </View>
              <View className="mt-3 flex-row gap-2">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={selectedBuilding.status !== 'operational'
                    ? `Cannot move ${selectedBuilding.name} while its project is active`
                    : selectedBuilding.canRelocate
                      ? `Move ${selectedBuilding.name} for ${formatCurrency(selectedBuilding.relocationFee)}`
                      : `Cannot move ${selectedBuilding.name}. Need ${formatCurrency(selectedBuilding.relocationShortfall)} more`}
                  accessibilityState={{ disabled: selectedBuilding.status !== 'operational' || !selectedBuilding.canRelocate }}
                  disabled={selectedBuilding.status !== 'operational' || !selectedBuilding.canRelocate}
                  onPress={() => setRelocatingBuildingId(selectedBuilding.id)}
                  className={selectedBuilding.status === 'operational' && selectedBuilding.canRelocate
                    ? 'min-h-12 flex-1 items-center justify-center border-2 border-b-4 border-ink bg-blue-light px-2'
                    : 'min-h-12 flex-1 items-center justify-center border-2 border-ink/30 bg-ink/5 px-2'}
                >
                  <Text className={selectedBuilding.status === 'operational' && selectedBuilding.canRelocate
                    ? 'text-center text-sm font-bold uppercase text-ink'
                    : 'text-center text-sm font-bold uppercase text-ink/35'}>
                    {selectedBuilding.status !== 'operational'
                      ? 'Project active'
                      : selectedBuilding.canRelocate
                        ? `Move · ${formatCurrency(selectedBuilding.relocationFee)}`
                        : `Need ${formatCurrency(selectedBuilding.relocationShortfall)}`}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={selectedBuilding.upgradeCost === undefined
                    ? `${selectedBuilding.name} is at maximum level`
                    : selectedBuilding.status !== 'operational'
                      ? `Cannot upgrade ${selectedBuilding.name} while its project is active`
                      : viewModel.facilities.activeProject !== undefined
                        ? `Cannot upgrade ${selectedBuilding.name} while the construction crew is busy`
                        : selectedBuilding.upgradeBlockedReason !== undefined
                          ? selectedBuilding.upgradeBlockedReason
                        : selectedBuilding.canUpgrade
                          ? `Upgrade ${selectedBuilding.name} for ${formatCurrency(selectedBuilding.upgradeCost)}`
                          : `Cannot upgrade ${selectedBuilding.name}. Need ${formatCurrency(selectedBuilding.upgradeShortfall)} more`}
                  accessibilityState={{
                    disabled: !selectedBuilding.canUpgrade
                      || selectedBuilding.status !== 'operational'
                      || viewModel.facilities.activeProject !== undefined,
                  }}
                  disabled={!selectedBuilding.canUpgrade
                    || selectedBuilding.status !== 'operational'
                    || viewModel.facilities.activeProject !== undefined}
                  onPress={() => onUpgradeFacility?.(selectedBuilding.id)}
                  className={!selectedBuilding.canUpgrade
                    || selectedBuilding.status !== 'operational'
                    || viewModel.facilities.activeProject !== undefined
                    ? 'min-h-12 flex-1 items-center justify-center border-2 border-ink/30 bg-ink/5 px-2'
                    : 'min-h-12 flex-1 items-center justify-center border-2 border-b-4 border-ink bg-violet px-2'}
                >
                  <Text className={!selectedBuilding.canUpgrade
                    || selectedBuilding.status !== 'operational'
                    || viewModel.facilities.activeProject !== undefined
                    ? 'text-center text-sm font-bold uppercase text-ink/35'
                    : 'text-center text-sm font-bold uppercase text-white'}>
                    {selectedBuilding.status !== 'operational'
                      ? 'Project active'
                      : viewModel.facilities.activeProject !== undefined
                        ? 'Crew busy'
                        : selectedBuilding.upgradeBlockedReason !== undefined
                          ? `Locked · ${selectedBuilding.upgradeBlockedReason.match(/D[1-5]/)?.[0] ?? 'promotion'}`
                        : selectedBuilding.upgradeCost === undefined
                          ? 'Max level'
                          : selectedBuilding.canUpgrade
                            ? `Upgrade · ${formatCurrency(selectedBuilding.upgradeCost)}`
                            : `Need ${formatCurrency(selectedBuilding.upgradeShortfall)}`}
                  </Text>
                </Pressable>
              </View>
              {selectedBuilding.upgradeBlockedReason ? (
                <Text className="mt-2 text-sm font-bold text-stamp">
                  {selectedBuilding.upgradeBlockedReason}
                </Text>
              ) : null}
            </View>
          ) : null}

          <View className="mt-4">
            <Text className="mb-2 text-sm font-bold uppercase tracking-wide text-ink/50">Build menu</Text>
            <View className="flex-row flex-wrap gap-2">
              {viewModel.facilities.catalog.map(entry => {
                const selected = selectedBuildType === entry.type;
                const adjacencyClue = facilityAdjacencyClue(entry.type);
                const knownAdjacency = adjacencyClue !== undefined
                  && viewModel.facilities.discoveredAdjacencies.includes(adjacencyClue.adjacencyId)
                  ? facilityAdjacencyPresentation(adjacencyClue.adjacencyId)
                  : undefined;
                const adjacencyGuidance = knownAdjacency === undefined
                  ? adjacencyClue?.text
                  : `${knownAdjacency.pairLabel} · ${knownAdjacency.effectLabel}`;
                const adjacencyAccessibility = adjacencyGuidance === undefined
                  ? ''
                  : ` ${knownAdjacency === undefined ? 'Neighbour clue' : 'Known combo'}: ${adjacencyGuidance}${adjacencyGuidance.endsWith('.') ? '' : '.'}`;
                const guideTarget = guidedFirstFacility
                  && entry.type === GUIDED_FIRST_FACILITY_TYPE;
                const guideBlocked = guidedFirstFacility
                  && !guidedFirstFacilityAllowsBuildType(entry.type);
                const entryEnabled = entry.available && entry.affordable && !guideBlocked;
                return (
                  <View
                    key={entry.type}
                    ref={entry.type === GUIDED_FIRST_FACILITY_TYPE
                      ? facilityGuideBuildTargetRef
                      : undefined}
                    collapsable={false}
                    className="relative w-[48%]"
                    onLayout={() => {
                      if (guideTarget && guidedFacilityPhase === 'build-menu') {
                        scrollFacilityGuideTargetIntoView('build-menu');
                      }
                    }}
                  >
                    {guideTarget && guidedFacilityPhase === 'build-menu' ? (
                      <TutorialTapCue
                        label="Bert says"
                        detail="Build Training Grounds"
                        style={{ left: '50%', marginLeft: -TUTORIAL_TAP_CUE_WIDTH / 2, top: -72 }}
                      />
                    ) : null}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={guideBlocked
                        ? `${entry.name}. Build Training Grounds first.`
                        : `${entry.name}. ${entry.effectLabel}.${adjacencyAccessibility} ${entry.available
                          ? `Build cost ${formatCurrency(entry.buildCost)}. ${formatCurrency(entry.weeklyUpkeep)} per week upkeep${entry.affordable ? '' : `. Need ${formatCurrency(entry.affordabilityShortfall)} more`}`
                          : 'Locked'}`}
                      accessibilityState={{ disabled: !entryEnabled, selected }}
                      disabled={!entryEnabled}
                      onPress={() => {
                        setSelectedBuildType(guidedFirstFacility
                          ? GUIDED_FIRST_FACILITY_TYPE
                          : selected ? null : entry.type);
                        setSelectedBuildingId(null);
                        setRelocatingBuildingId(null);
                      }}
                      className={selected
                        ? 'min-h-36 w-full border-2 border-b-4 border-violet-dark bg-violet-light/30 p-2'
                        : entryEnabled
                          ? 'min-h-36 w-full border-2 border-b-4 border-ink bg-white p-2'
                          : 'min-h-36 w-full border-2 border-ink/20 bg-ink/5 p-2'}
                    >
                      <View className="mb-2 flex-row items-start gap-2">
                        <View style={{ opacity: entryEnabled ? 1 : 0.35 }}>
                          <FacilitySprite type={entry.type} size={32} showLevel={false} />
                        </View>
                        <Text className={entryEnabled
                          ? 'flex-1 text-sm font-bold uppercase leading-4 text-ink'
                          : 'flex-1 text-sm font-bold uppercase leading-4 text-ink/35'}>
                          {entry.name}
                        </Text>
                      </View>
                      <Text className={entryEnabled
                        ? 'text-xs font-bold leading-4 text-violet-dark'
                        : 'text-xs font-bold leading-4 text-ink/35'}>
                        {entry.effectLabel}
                      </Text>
                      <Text className={entryEnabled
                        ? 'mt-1 font-mono text-sm text-ink/60'
                        : 'mt-1 font-mono text-sm text-ink/30'}>
                        {entry.available
                          ? `${entry.width}x${entry.height} · ${formatCurrency(entry.buildCost)} · ${entry.buildWeeks}W · ${formatCurrency(entry.weeklyUpkeep)}/wk`
                          : 'Locked'}
                      </Text>
                      {adjacencyGuidance !== undefined && entry.available ? (
                        <View className={knownAdjacency === undefined
                          ? 'mt-2 border-t border-blue-dark/25 pt-2'
                          : 'mt-2 border-t border-pitch-dark/25 pt-2'}>
                          <Text className={knownAdjacency === undefined
                            ? 'text-xs font-bold uppercase tracking-wide text-blue-dark'
                            : 'text-xs font-bold uppercase tracking-wide text-pitch-dark'}>
                            {knownAdjacency === undefined ? 'Neighbour clue' : 'Known combo'}
                          </Text>
                          <Text className="mt-1 text-xs leading-4 text-ink/65">
                            {adjacencyGuidance}
                          </Text>
                        </View>
                      ) : null}
                      {guideBlocked ? (
                        <Text className="mt-1 text-xs font-bold text-stamp">Build Training Grounds first.</Text>
                      ) : entry.blockedReason ? (
                        <Text className="mt-1 text-xs font-bold text-stamp">{entry.blockedReason}</Text>
                      ) : null}
                      {entry.available && !entry.affordable && entry.affordabilityShortfall > 0 ? (
                        <Text className="mt-1 text-xs font-bold uppercase text-red-dark">
                          Need {formatCurrency(entry.affordabilityShortfall)} more
                        </Text>
                      ) : null}
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </View>

          <View className="mt-4 border-t-2 border-ink/20 pt-3">
            <Text className="text-sm font-bold uppercase tracking-wide text-ink/50">Facility pair bonuses</Text>
            {viewModel.facilities.discoveredAdjacencies.length === 0 ? (
              <Text className="mt-2 text-sm leading-4 text-ink/55">
                No pairings discovered yet. Six buildings carry neighbour clues in the build menu. Place the right two edge-to-edge — corners do not count.
              </Text>
            ) : viewModel.facilities.discoveredAdjacencies.map(adjacency => {
              const presentation = facilityAdjacencyPresentation(adjacency);
              const active = viewModel.facilities.activeAdjacencies.includes(adjacency);
              return (
                <View key={adjacency} className="mt-2 flex-row items-start gap-3 border border-ink/20 bg-white px-3 py-3">
                  <View className="min-w-0 flex-1">
                    <Text className="text-sm font-bold uppercase text-ink">
                      {presentation?.pairLabel ?? adjacency}
                    </Text>
                    {presentation ? (
                      <>
                        <Text className="mt-1 text-sm font-bold text-violet-dark">
                          {presentation.effectLabel}
                        </Text>
                        <Text className="mt-1 text-sm leading-4 text-ink/60">
                          Why it works: {presentation.rationale}
                        </Text>
                      </>
                    ) : null}
                  </View>
                  <StatusChip
                    label={active ? 'Active' : 'Known'}
                    tone={active ? 'success' : 'normal'}
                  />
                </View>
              );
            })}
          </View>
        </PaperPanel>
      </View>

      {viewModel.legacyTrainingGroundVisible ? (
      <View className="mt-6" onLayout={onTrainingGroundLayout}>
        <SectionLabel eyebrow="One big call" title="Training Ground" right={<StatusChip label="Facility 01" />} />
        <PaperPanel
          kicker="Works order"
          title="Turn mud into momentum"
          stamp={facility.built ? 'Built' : facility.underConstruction ? `${facility.weeksRemaining}W LEFT` : 'Decision'}
        >
          <View className="flex-row items-center gap-4 border-y-2 border-ink py-4">
            <View className="items-center justify-center border-2 border-emerald-900 bg-pitch p-2">
              <ManagementSprite
                spriteKey={facility.underConstruction ? 'facility:worksite' : 'facility:training-pitch:l1'}
                width={58}
                accessibilityLabel={facility.underConstruction ? 'Training Ground construction site' : 'Training Ground'}
              />
            </View>
            <View className="flex-1">
              <Text className="text-base font-bold uppercase text-ink">Training Ground · Level 1</Text>
              <Text className="mt-2 text-sm leading-4 text-ink/60">
                A proper weekly practice base. Small, dependable improvement without adding another management chore.
              </Text>
            </View>
          </View>
          <View className="mt-3 flex-row gap-2">
            <Metric label="Build cost" value={formatCurrency(facility.cost)} tone="negative" />
            <Metric label="Weekly return" value={`+${facility.weeklyTrainingPoints} TP`} tone="positive" />
          </View>
          <Text className="mt-3 text-sm font-bold uppercase tracking-wide text-ink/50">
            M1 offer: $8,000 cost · +5 TP every week
          </Text>
          {!facility.built && !facility.underConstruction ? (
            <View className={guideTrainingGround ? 'relative mt-3 border-2 border-blue-dark bg-blue-light p-1' : 'relative mt-3'}>
              {guideTrainingGround ? (
                <TutorialTapCue
                  detail="Build the facility"
                  style={{ left: '50%', marginLeft: -TUTORIAL_TAP_CUE_WIDTH / 2, top: -72 }}
                />
              ) : null}
              <ActionButton
                label="Approve build · $8,000 · 1 week"
                accessibilityLabel="Build the Training Ground for $8,000"
                onPress={onBuildTrainingGround}
                disabled={!facility.affordable}
              />
            </View>
          ) : null}
          {facility.underConstruction ? (
            <View className="mt-3 border-2 border-b-4 border-amber-800 bg-amber-100 p-3">
              <Text className="text-center font-pixel text-base uppercase text-amber-900">Sports facility in construction!</Text>
              <Text className="mt-2 text-center text-sm text-ink/65">Benefits start when the next weekly settlement completes the work.</Text>
            </View>
          ) : null}
          {!facility.built && !facility.underConstruction && !facility.affordable ? (
            <Text className="mt-2 text-center text-sm font-bold uppercase tracking-wide text-stamp">
              Insufficient balance
            </Text>
          ) : null}
        </PaperPanel>
      </View>
      ) : null}
    </ScrollView>
    </View>
  );
}

function facilityColor(building: ClubFacilityBuildingViewModel): string {
  if (building.type === 'training-pitch' || building.type === 'youth-field') return '#86C07A';
  if (building.type === 'medical-bay') return '#F8C7C7';
  if (building.type === 'fan-shop' || building.type === 'stadium-stand') return '#C8DDF0';
  return '#F4E7C5';
}
