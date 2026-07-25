import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import { ScrollView, Text, View } from 'react-native';
import type { AssistantGuideFocus } from '../../content';
import { ActionButton, Metric, PaperPanel, SectionLabel, StatusChip, formatCurrency } from '../components/Scorecard';
import { EmptyDocket } from '../components/EmptyDocket';
import { FacilitySprite } from '../components/FacilitySprite';
import type {
  ClubFacilityBuildingViewModel,
  ClubFinancesViewModel,
  FacilityTypeViewModel,
  TrainingGroundDecisionViewModel,
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
import { FacilityPlacementConfirmation, type FacilityPlacement } from '../FacilityPlacementConfirmation';
import {
  firstGuidedFacilityUpgradeId,
  guidedFirstFacilityAllowsBuildType,
  guidedFirstFacilityAllowsPlacement,
  guidedFirstFacilityPhase,
  type GuidedFirstFacilityPhase,
} from '../concierge-targets';
import { SectionFlow, type FlowSection } from '../layout/SectionFlow';
import { useLayoutMode } from '../layout/use-layout-mode';
import { PixelText } from '../components/PixelText';

const FACILITY_GUIDE_TARGET_TOP = 170;
const FACILITY_PLACEMENT_PLUS_SIZE = 16;
const FACILITY_PLACEMENT_PLUS_THICKNESS = 4;

/** Scrolls the ScrollView so the given target (a rendered View) is margin px
 * below the viewport top. Works regardless of column nesting because both
 * measurements are in window coordinates. */
function scrollToTarget(
  scrollRef: RefObject<ScrollView | null>,
  viewportRef: RefObject<View | null>,
  targetRef: RefObject<View | null>,
  latestScrollOffset: number,
  margin = 12,
) {
  const viewport = viewportRef.current;
  const target = targetRef.current;
  if (viewport === null || target === null) return;
  viewport.measureInWindow((vx, vy) => {
    target.measureInWindow((tx, ty) => {
      const y = Math.max(0, latestScrollOffset + (ty - vy) - margin);
      scrollRef.current?.scrollTo({ y, animated: true });
    });
  });
}

export interface ClubFinancesScreenProps {
  viewModel: ClubFinancesViewModel;
  onOpenLedgerLine?: (ledgerLineId: string) => void;
  onBuildTrainingGround: () => void;
  onBuildFacility?: (type: FacilityTypeViewModel, x: number, y: number) => void;
  onUpgradeFacility?: (buildingId: string) => void;
  onRelocateFacility?: (buildingId: string, x: number, y: number) => void;
  onOpenCoachMarket?: () => void;
  onDismissCoach?: (role: 'HEAD' | 'ASSISTANT') => void;
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
  const groundsRef = useRef<View>(null);
  const trainingGroundRef = useRef<View>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const coachingOfficeScrollFrameRef = useRef<number | null>(null);
  const coachingOfficeScrolledRef = useRef(false);
  const coachingOfficeBuildTargetRef = useRef<View>(null);
  const facilityGuideScrollFrameRef = useRef<number | null>(null);
  const facilityGuideScrolledPhaseRef = useRef<GuidedFirstFacilityPhase | null>(null);
  const facilityGuideBuildTargetRef = useRef<View>(null);
  const facilityGuideGridTargetRef = useRef<View>(null);
  const latestScrollOffsetRef = useRef(0);
  const [selectedBuildType, setSelectedBuildType] = useState<FacilityTypeViewModel | null>(null);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [relocatingBuildingId, setRelocatingBuildingId] = useState<string | null>(null);
  const [previewCell, setPreviewCell] = useState<{ x: number; y: number } | null>(null);
  const [pendingPlacement, setPendingPlacement] = useState<FacilityPlacement | null>(null);
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
  const guidedFirstFacility = guideFocus === 'facility-grid';
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
      const catalog = facilities.catalog.find(entry => entry.type === selectedBuildType);
      if (catalog === undefined) return;
      // The tap proposes a spot; money is only committed from the confirmation.
      setPendingPlacement({ catalog, x, y });
      setPreviewCell(null);
    }
  }, [canPlaceAt, facilities.catalog, guidedFirstFacility, onRelocateFacility, relocatingBuildingId, selectedBuildType]);

  const confirmPendingPlacement = useCallback(() => {
    if (pendingPlacement === null) return;
    onBuildFacility?.(pendingPlacement.catalog.type, pendingPlacement.x, pendingPlacement.y);
    setPendingPlacement(null);
    setSelectedBuildType(null);
  }, [onBuildFacility, pendingPlacement]);

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
    if (!guideTrainingGround) return;
    if (scrollFrameRef.current !== null) cancelAnimationFrame(scrollFrameRef.current);
    scrollFrameRef.current = requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      scrollToTarget(scrollRef, scrollViewportRef, trainingGroundRef, latestScrollOffsetRef.current);
    });
  }, [guideTrainingGround]);

  const scrollToCoachingOffice = useCallback(() => {
    if (
      guideFocus !== 'coaching-office'
      || coachingOfficeScrolledRef.current
      || coachingOfficeBuildTargetRef.current === null
    ) return;
    if (coachingOfficeScrollFrameRef.current !== null) {
      cancelAnimationFrame(coachingOfficeScrollFrameRef.current);
    }
    coachingOfficeScrollFrameRef.current = requestAnimationFrame(() => {
      coachingOfficeScrollFrameRef.current = null;
      scrollToTarget(
        scrollRef,
        scrollViewportRef,
        coachingOfficeBuildTargetRef,
        latestScrollOffsetRef.current,
      );
      coachingOfficeScrolledRef.current = true;
    });
  }, [guideFocus]);

  useEffect(() => {
    scrollToTrainingGround();
    return () => {
      if (scrollFrameRef.current !== null) cancelAnimationFrame(scrollFrameRef.current);
    };
  }, [scrollToTrainingGround]);

  useEffect(() => {
    if (guideFocus !== 'coaching-office') {
      coachingOfficeScrolledRef.current = false;
      return;
    }
    scrollToCoachingOffice();
  }, [guideFocus, scrollToCoachingOffice]);

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
    if (coachingOfficeScrollFrameRef.current !== null) {
      cancelAnimationFrame(coachingOfficeScrollFrameRef.current);
    }
  }, []);

  useEffect(() => {
    if (!guideGrounds) return;
    if (guideFocus === 'coaching-office') {
      setSelectedBuildingId(null);
      scrollToCoachingOffice();
      return;
    } else if (guideFocus === 'facility-grid') {
      return;
    } else if (guideFocus === 'facility-upgrade' && facilities.buildings.length > 0) {
      setSelectedBuildingId(firstGuidedFacilityUpgradeId(facilities.buildings) ?? null);
      setSelectedBuildType(null);
    }
    scrollToTarget(scrollRef, scrollViewportRef, groundsRef, latestScrollOffsetRef.current);
  }, [facilities.buildings, guideFocus, guideGrounds, scrollToCoachingOffice]);

  const onTrainingGroundLayout = useCallback(() => {
    scrollToTrainingGround();
  }, [scrollToTrainingGround]);

  const layoutMode = useLayoutMode();

  const sections: FlowSection[] = [
    {
      key: 'cash-position',
      weight: 6,
      node: <CashPositionSection viewModel={viewModel} guideFocus={guideFocus} />,
    },
    {
      key: 'itemized',
      weight: 2 + viewModel.ledger.length,
      node: <ItemizedStatementSection viewModel={viewModel} onOpenLedgerLine={onOpenLedgerLine} />,
    },
    ...(viewModel.recentTransactions.length > 0 ? [{
      key: 'transactions',
      weight: 2 + viewModel.recentTransactions.length,
      node: <RecentTransactionsSection viewModel={viewModel} />,
    }] : []),
    {
      key: 'coaching-staff',
      weight: viewModel.coachingStaff.length === 0 ? 4 : 3 + 4 * viewModel.coachingStaff.length,
      node: (
        <CoachingStaffSection
          viewModel={viewModel}
          onOpenCoachMarket={onOpenCoachMarket}
          onDismissCoach={onDismissCoach}
        />
      ),
    },
    {
      key: 'grounds',
      weight: 10 + viewModel.facilities.height * 2,
      node: (
        <GroundsSection
          viewModel={viewModel}
          groundsRef={groundsRef}
          guideGrounds={guideGrounds}
          guideFocus={guideFocus}
          guidedFirstFacility={guidedFirstFacility}
          guidedFacilityPhase={guidedFacilityPhase}
          selectedBuildType={selectedBuildType}
          setSelectedBuildType={setSelectedBuildType}
          selectedBuildingId={selectedBuildingId}
          setSelectedBuildingId={setSelectedBuildingId}
          relocatingBuildingId={relocatingBuildingId}
          setRelocatingBuildingId={setRelocatingBuildingId}
          previewCell={previewCell}
          setPreviewCell={setPreviewCell}
          facilityGridWidth={facilityGridWidth}
          setFacilityGridWidth={setFacilityGridWidth}
          selectedBuilding={selectedBuilding}
          placementActive={placementActive}
          activeFootprint={activeFootprint}
          activeLabel={activeLabel}
          placementType={placementType}
          placementLevel={placementLevel}
          canPlaceAt={canPlaceAt}
          cellIsOccupied={cellIsOccupied}
          cancelPlacement={cancelPlacement}
          handleGridCell={handleGridCell}
          onUpgradeFacility={onUpgradeFacility}
          facilityGuideGridTargetRef={facilityGuideGridTargetRef}
          facilityGuideBuildTargetRef={facilityGuideBuildTargetRef}
          scrollFacilityGuideTargetIntoView={scrollFacilityGuideTargetIntoView}
          coachingOfficeBuildTargetRef={coachingOfficeBuildTargetRef}
          scrollToCoachingOffice={scrollToCoachingOffice}
        />
      ),
    },
    ...(viewModel.legacyTrainingGroundVisible ? [{
      key: 'training-ground',
      weight: 5,
      node: (
        <LegacyTrainingGroundSection
          facility={facility}
          guideTrainingGround={guideTrainingGround}
          trainingGroundRef={trainingGroundRef}
          onTrainingGroundLayout={onTrainingGroundLayout}
          onBuildTrainingGround={onBuildTrainingGround}
        />
      ),
    }] : []),
  ];

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
      <SectionFlow
        mode={layoutMode}
        header={
      <View className="mb-5 flex-row items-end justify-between">
        <View>
          <PixelText className="text-sm uppercase text-blue-dark">Accounts office</PixelText>
          <PixelText className="mt-1 text-xl uppercase text-ink">Club finances</PixelText>
        </View>
        <StatusChip label={viewModel.periodLabel} />
      </View>
        }
        sections={sections}
      />
    </ScrollView>
    {pendingPlacement === null ? null : (
      <FacilityPlacementConfirmation
        placement={pendingPlacement}
        onConfirm={confirmPendingPlacement}
        onCancel={() => setPendingPlacement(null)}
      />
    )}
    </View>
  );
}

interface CashPositionSectionProps {
  viewModel: ClubFinancesViewModel;
  guideFocus?: AssistantGuideFocus;
}

function CashPositionSection({ viewModel, guideFocus }: CashPositionSectionProps) {
  return (
    <View className={guideFocus === 'emergency-loan' ? 'relative mt-20 border-2 border-blue-dark bg-blue-light p-1' : 'relative'}>
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
          <PixelText className="mt-3 text-xs uppercase leading-4 tracking-wide text-ink/45">
            Forward estimate · known weekly commitments and steady merchandise · match, sponsor and prize income excluded
          </PixelText>
          {viewModel.wageSubsidyLabel ? (
            <View className="mt-3 border border-pitch-dark bg-pitch-light px-3 py-2">
              <PixelText className="text-sm uppercase tracking-wide text-ink">
                {viewModel.wageSubsidyLabel}
              </PixelText>
            </View>
          ) : null}
        </PaperPanel>
    </View>
  );
}

interface ItemizedStatementSectionProps {
  viewModel: ClubFinancesViewModel;
  onOpenLedgerLine?: (ledgerLineId: string) => void;
}

function ItemizedStatementSection({ viewModel, onOpenLedgerLine }: ItemizedStatementSectionProps) {
  return (
    <View>
        <SectionLabel eyebrow="Itemized statement" title="Every coin accounted for" />
        {viewModel.ledger.length === 0 ? (
          <EmptyDocket
            title="Statement empty"
            detail="Wages, gate receipts and transfers land here as the week is played."
          />
        ) : (
        <View className="border-2 border-ink bg-white">
          <View className="flex-row border-b border-ink/20 px-3 py-2">
            <PixelText className="flex-1 text-sm uppercase tracking-wide text-ink/50">Entry</PixelText>
            <PixelText className="text-right text-sm uppercase tracking-wide text-ink/50">Amount</PixelText>
          </View>
          {viewModel.ledger.map(line => {
            const amountClass = line.kind === 'income'
              ? 'text-pitch-dark'
              : line.kind === 'expense'
                ? 'text-red-dark'
                : 'text-ink';
            const accessibilityLabel = `${line.label}, ${line.amount > 0 ? 'plus ' : ''}${formatCurrency(line.amount)}`;
            const content = (
              <>
                <Text className="flex-1 text-base text-ink">{line.label}</Text>
                <Text className={`font-mono text-base ${amountClass}`}>
                  {formatCurrency(line.amount, true)}
                </Text>
              </>
            );
            if (onOpenLedgerLine === undefined) {
              return (
                <View
                  key={line.id}
                  accessible
                  accessibilityRole="text"
                  accessibilityLabel={accessibilityLabel}
                  className="min-h-11 flex-row items-center border-b border-ink/10 px-3 py-2"
                >
                  {content}
                </View>
              );
            }
            return (
              <Pressable
                key={line.id}
                accessibilityRole="button"
                accessibilityLabel={accessibilityLabel}
                onPress={() => onOpenLedgerLine(line.id)}
                className="min-h-11 flex-row items-center border-b border-ink/10 px-3 py-2"
                style={({ pressed }) => ({ opacity: pressed ? 0.65 : undefined })}
              >
                {content}
              </Pressable>
            );
          })}
        </View>
        )}
    </View>
  );
}

interface RecentTransactionsSectionProps {
  viewModel: ClubFinancesViewModel;
}

function RecentTransactionsSection({ viewModel }: RecentTransactionsSectionProps) {
  return (
    <View>
          <SectionLabel eyebrow="Cash activity" title="Recent club transactions" />
          {viewModel.recentTransactions.length === 0 ? (
            <EmptyDocket
              title="No cash activity"
              detail="Money in and out of the club shows up here after the first week is played."
            />
          ) : (
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
                <Text className={`font-mono text-base ${transaction.kind === 'income' ? 'text-pitch-dark' : 'text-red-dark'}`}>
                  {formatCurrency(transaction.amount, true)}
                </Text>
              </View>
            ))}
          </View>
          )}
    </View>
  );
}

interface CoachingStaffSectionProps {
  viewModel: ClubFinancesViewModel;
  onOpenCoachMarket?: () => void;
  onDismissCoach?: (role: 'HEAD' | 'ASSISTANT') => void;
}

function CoachingStaffSection({ viewModel, onOpenCoachMarket, onDismissCoach }: CoachingStaffSectionProps) {
  return (
    <View>
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
                <ActionButton
                  label="Open coach market"
                  accessibilityLabel="Open the coach market"
                  onPress={onOpenCoachMarket}
                />
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
                    <Text className="font-pixel text-sm uppercase text-blue-dark">{coach.roleLabel}</Text>
                    <Text className="mt-1 text-lg font-bold text-ink" numberOfLines={1}>{coach.name}</Text>
                    <Text className="mt-1 text-sm text-ink/60">
                      Age {coach.age} · {coach.personalityLabel} · Level {coach.level}
                    </Text>
                    <Text className="mt-1 font-mono text-sm text-ink">
                      {formatCurrency(coach.weeklyWage)} / week
                    </Text>
                  </View>
                </View>
                <View className="mt-3 flex-row gap-2">
                  {coach.specialtyLabels.map(specialty => (
                    <View key={specialty} className="flex-1 border-2 border-ink bg-paper px-2 py-2">
                      <PixelText className="text-center text-sm uppercase text-ink">{specialty}</PixelText>
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
              <ActionButton
                label="Review coach market"
                accessibilityLabel="Review the coach market"
                onPress={onOpenCoachMarket}
              />
            ) : null}
          </View>
        )}
    </View>
  );
}

interface GroundsSectionProps {
  viewModel: ClubFinancesViewModel;
  groundsRef: RefObject<View | null>;
  guideGrounds: boolean;
  guideFocus?: AssistantGuideFocus;
  guidedFirstFacility: boolean;
  guidedFacilityPhase: GuidedFirstFacilityPhase;
  selectedBuildType: FacilityTypeViewModel | null;
  setSelectedBuildType: Dispatch<SetStateAction<FacilityTypeViewModel | null>>;
  selectedBuildingId: string | null;
  setSelectedBuildingId: Dispatch<SetStateAction<string | null>>;
  relocatingBuildingId: string | null;
  setRelocatingBuildingId: Dispatch<SetStateAction<string | null>>;
  previewCell: { x: number; y: number } | null;
  setPreviewCell: Dispatch<SetStateAction<{ x: number; y: number } | null>>;
  facilityGridWidth: number;
  setFacilityGridWidth: Dispatch<SetStateAction<number>>;
  selectedBuilding?: ClubFacilityBuildingViewModel;
  placementActive: boolean;
  activeFootprint: { width: number; height: number } | null;
  activeLabel: string;
  placementType?: FacilityTypeViewModel;
  placementLevel: number;
  canPlaceAt: (x: number, y: number) => boolean;
  cellIsOccupied: (x: number, y: number) => boolean;
  cancelPlacement: () => void;
  handleGridCell: (x: number, y: number) => void;
  onUpgradeFacility?: (buildingId: string) => void;
  facilityGuideGridTargetRef: RefObject<View | null>;
  facilityGuideBuildTargetRef: RefObject<View | null>;
  scrollFacilityGuideTargetIntoView: (phase: GuidedFirstFacilityPhase) => void;
  coachingOfficeBuildTargetRef: RefObject<View | null>;
  scrollToCoachingOffice: () => void;
}

function GroundsSection({
  viewModel,
  groundsRef,
  guideGrounds,
  guideFocus,
  guidedFirstFacility,
  guidedFacilityPhase,
  selectedBuildType,
  setSelectedBuildType,
  selectedBuildingId,
  setSelectedBuildingId,
  relocatingBuildingId,
  setRelocatingBuildingId,
  previewCell,
  setPreviewCell,
  facilityGridWidth,
  setFacilityGridWidth,
  selectedBuilding,
  placementActive,
  activeFootprint,
  activeLabel,
  placementType,
  placementLevel,
  canPlaceAt,
  cellIsOccupied,
  cancelPlacement,
  handleGridCell,
  onUpgradeFacility,
  facilityGuideGridTargetRef,
  facilityGuideBuildTargetRef,
  scrollFacilityGuideTargetIntoView,
  coachingOfficeBuildTargetRef,
  scrollToCoachingOffice,
}: GroundsSectionProps) {
  const facilities = viewModel.facilities;
  return (
    <View
      ref={groundsRef}
      collapsable={false}
      className={guideGrounds
        ? guideFocus === 'coaching-office'
          ? 'relative border-2 border-blue-dark bg-blue-light p-1'
          : 'relative mt-20 border-2 border-blue-dark bg-blue-light p-1'
        : 'relative'}
    >
      {guideGrounds
        && guideFocus !== 'facility-grid'
        && guideFocus !== 'coaching-office' ? (
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
            Pick a building from the menu below, then tap any + square to drop it. Put useful pairs edge-to-edge to discover bonuses.
          </Text>
          {viewModel.facilities.activeProject ? (
            <View className="mb-3 flex-row items-center gap-3 border-2 border-b-4 border-amber-800 bg-amber-100 p-3">
              <ManagementSprite spriteKey="facility:worksite" width={54} accessibilityLabel="Active construction site" />
              <View className="min-w-0 flex-1">
                <Text className="font-pixel text-sm uppercase text-amber-900">Works crew busy</Text>
                <PixelText className="mt-1 text-base uppercase text-ink">
                  {viewModel.facilities.activeProject.name} · {viewModel.facilities.activeProject.weeksRemaining}W left
                </PixelText>
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
                detail="Tap any + square"
                style={{
                  left: facilityGridWidth / facilities.width / 2,
                  marginLeft: -TUTORIAL_TAP_CUE_WIDTH / 2,
                  bottom: '100%',
                }}
              />
            ) : null}
            <View
              style={{
                position: 'relative',
                flex: 1,
                zIndex: placementActive ? 2 : 0,
              }}
            >
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
                          accessible={placementActive}
                          accessibilityRole={placementActive ? 'button' : 'none'}
                          accessibilityLabel={placementActive
                            ? `${buildable ? 'Build at' : 'Blocked at'} column ${x + 1}, row ${y + 1}`
                            : undefined}
                          disabled={!placementActive || !guideAllowsCell}
                          onPress={() => handleGridCell(x, y)}
                          onPressIn={() => setPreviewCell({ x, y })}
                          onPressOut={() => setPreviewCell(null)}
                          // A mouse has a hover phase, so the fits/blocked footprint
                          // tracks the cursor instead of forcing a click-and-hold on
                          // every square to discover whether the building fits.
                          onHoverIn={() => setPreviewCell({ x, y })}
                          onHoverOut={() => setPreviewCell(null)}
                          tip={placementActive
                            ? (buildable
                              ? `Build here · column ${x + 1}, row ${y + 1}`
                              : 'Blocked — the footprint does not fit here')
                            : undefined}
                          style={{
                            flex: 1,
                            backgroundColor: occupied
                              ? 'transparent'
                              : placementActive
                                ? (buildable ? 'rgba(154, 99, 214, 0.32)' : 'rgba(36, 31, 46, 0.05)')
                                : 'rgba(92, 184, 92, 0.12)',
                          }}
                        />
                        {buildable ? (
                          <View
                            pointerEvents="none"
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              right: 0,
                              bottom: 0,
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <View
                              style={{
                                width: FACILITY_PLACEMENT_PLUS_SIZE,
                                height: FACILITY_PLACEMENT_PLUS_SIZE,
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <View style={{ position: 'absolute', width: FACILITY_PLACEMENT_PLUS_SIZE, height: FACILITY_PLACEMENT_PLUS_THICKNESS, backgroundColor: '#5b3a91' }} />
                              <View style={{ position: 'absolute', width: FACILITY_PLACEMENT_PLUS_THICKNESS, height: FACILITY_PLACEMENT_PLUS_SIZE, backgroundColor: '#5b3a91' }} />
                            </View>
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>

            <View
              pointerEvents={placementActive ? 'none' : 'box-none'}
              accessibilityElementsHidden={placementActive}
              importantForAccessibility={placementActive ? 'no-hide-descendants' : 'auto'}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 3,
              }}
            >
              {facilities.buildings.map(building => {
                const selected = building.id === selectedBuildingId;
                const moving = building.id === relocatingBuildingId;
                const comboActive = building.activeAdjacencyIds.length > 0;
                const cellSize = facilityGridWidth / facilities.width;
                const artWidth = Math.max(24, building.width * cellSize - 10);
                const artHeight = Math.max(24, building.height * cellSize - 10);
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
                        overflow: 'hidden',
                        opacity: moving ? 0.55 : 1,
                      }}
                    >
                      {building.status === 'construction' ? (
                        <ManagementSprite
                          spriteKey="facility:worksite"
                          width={Math.max(24, Math.min(56, Math.min(artWidth, artHeight)))}
                          accessibilityLabel={`${building.name} construction`}
                        />
                      ) : (
                        <FacilitySprite
                          type={building.type}
                          level={building.level}
                          width={artWidth}
                          height={artHeight}
                          showLevel={false}
                        />
                      )}
                      <View
                        style={{
                          position: 'absolute',
                          right: 2,
                          bottom: 2,
                          borderWidth: 1,
                          borderColor: '#241f2e',
                          backgroundColor: '#f4f1eadd',
                          paddingHorizontal: 3,
                          paddingVertical: 1,
                        }}
                      >
                        <PixelText className="text-center text-[9px] uppercase text-ink">
                          {building.status === 'operational'
                            ? `L${building.level}`
                            : `${building.status === 'construction' ? 'BUILD' : 'UP'} · ${building.weeksRemaining}W`}
                        </PixelText>
                      </View>
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
                  zIndex: 4,
                }}
              />
            ) : null}
          </View>

          {placementActive ? (
            <View className="mt-3 flex-row items-start justify-between gap-3 border-2 border-blue-dark bg-blue-light px-3 py-2">
              <View className="flex-1">
                <PixelText className="text-sm uppercase text-blue-dark">
                  {relocatingBuildingId !== null ? `Moving · ${activeLabel}` : `Placing · ${activeLabel}`}
                </PixelText>
                <Text className="mt-1 text-sm text-ink/70">
                  Tap any + square above. A blue outline fits; red is blocked.
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel placement"
                onPress={cancelPlacement}
                className="min-h-11 items-center justify-center border-2 border-blue-dark bg-white px-3"
              >
                <PixelText className="text-sm uppercase text-blue-dark">Cancel</PixelText>
              </Pressable>
            </View>
          ) : (
            <View className="mt-3 border-2 border-dashed border-ink/30 bg-paper px-3 py-2">
              <Text className="text-sm text-ink/70">
                Pick a building from the <Text className="font-bold text-ink">Build menu</Text> below to start — every available starting square shows a +.
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
                <PixelText className="text-sm uppercase text-ink">What it does</PixelText>
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
                  <PixelText className="text-base uppercase text-ink">
                    {selectedBuilding.name} · Level {selectedBuilding.level}
                  </PixelText>
                  <Text className="mt-1 text-sm text-ink/60">
                    {selectedBuilding.status === 'operational'
                      ? `${formatCurrency(selectedBuilding.weeklyUpkeep)}/wk upkeep · ${formatCurrency(selectedBuilding.relocationFee)} to move`
                      : `${selectedBuilding.status === 'construction' ? 'Building' : 'Upgrading'} · ${selectedBuilding.weeksRemaining} week${selectedBuilding.weeksRemaining === 1 ? '' : 's'} remaining`}
                  </Text>
                  <Text className="mt-2 text-sm font-bold leading-4 text-blue-dark">
                    {selectedBuilding.effectLabel}
                  </Text>
                  {selectedBuilding.nextLevelEffectLabel ? (
                    <PixelText className="mt-1 text-xs uppercase leading-4 text-ink/45">
                      Next level · {selectedBuilding.nextLevelEffectLabel}
                    </PixelText>
                  ) : null}
                  {selectedBuilding.activeAdjacencyIds.length > 0 ? (
                    <PixelText className="mt-2 text-xs uppercase text-pitch-dark">
                      Active combo · {selectedBuilding.activeAdjacencyIds.map(facilityAdjacencyLabel).join(' · ')}
                    </PixelText>
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
                  <Text className="font-pixel text-base text-ink">×</Text>
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
                  <PixelText className={selectedBuilding.status === 'operational' && selectedBuilding.canRelocate
                    ? 'text-center text-sm uppercase text-ink'
                    : 'text-center text-sm uppercase text-ink/35'}>
                    {selectedBuilding.status !== 'operational'
                      ? 'Project active'
                      : selectedBuilding.canRelocate
                        ? `Move · ${formatCurrency(selectedBuilding.relocationFee)}`
                        : `Need ${formatCurrency(selectedBuilding.relocationShortfall)}`}
                  </PixelText>
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
                    : 'min-h-12 flex-1 items-center justify-center border-2 border-b-4 border-ink bg-blue px-2'}
                >
                  <PixelText className={!selectedBuilding.canUpgrade
                    || selectedBuilding.status !== 'operational'
                    || viewModel.facilities.activeProject !== undefined
                    ? 'text-center text-sm uppercase text-ink/35'
                    : 'text-center text-sm uppercase text-white'}>
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
                  </PixelText>
                </Pressable>
              </View>
              {selectedBuilding.upgradeBlockedReason ? (
                <Text className="mt-2 text-sm font-bold text-stamp">
                  {selectedBuilding.upgradeBlockedReason}
                </Text>
              ) : null}
            </View>
          ) : null}

          <View
            ref={facilityGuideBuildTargetRef}
            collapsable={false}
            className="relative mt-4"
            onLayout={() => {
              if (guidedFirstFacility && guidedFacilityPhase === 'build-menu') {
                scrollFacilityGuideTargetIntoView('build-menu');
              }
            }}
          >
            <PixelText className="mb-2 text-sm uppercase tracking-wide text-ink/50">Build menu</PixelText>
            <View className={guidedFirstFacility && guidedFacilityPhase === 'build-menu'
              ? 'mt-20 flex-row flex-wrap gap-2'
              : 'flex-row flex-wrap gap-2'}>
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
                const guideAllowsType = !guidedFirstFacility
                  || guidedFirstFacilityAllowsBuildType(entry.type);
                const entryEnabled = entry.available && entry.affordable && guideAllowsType;
                return (
                  <View
                    key={entry.type}
                    ref={entry.type === 'coaching-office' ? coachingOfficeBuildTargetRef : undefined}
                    collapsable={entry.type === 'coaching-office' ? false : undefined}
                    className="relative w-[48%]"
                    onLayout={entry.type === 'coaching-office' ? scrollToCoachingOffice : undefined}
                  >
                    {guidedFirstFacility
                      && guidedFacilityPhase === 'build-menu'
                      && entry.type === 'training-pitch' ? (
                        <TutorialTapCue
                          label="Tap here"
                          detail="Training Pitch"
                          style={{
                            left: '50%',
                            marginLeft: -TUTORIAL_TAP_CUE_WIDTH / 2,
                            top: -82,
                          }}
                        />
                      ) : null}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${entry.name}. ${entry.effectLabel}. ${entry.width} by ${entry.height} footprint. Build time ${entry.buildWeeks} week${entry.buildWeeks === 1 ? '' : 's'}.${adjacencyAccessibility} ${guideAllowsType ? '' : 'Build the Training Pitch first. '}${entry.available
                        ? `Build cost ${formatCurrency(entry.buildCost)}. ${formatCurrency(entry.weeklyUpkeep)} per week upkeep.${entry.blockedReason
                          ? ` ${entry.blockedReason}`
                          : !entry.affordable && entry.affordabilityShortfall > 0
                            ? ` Need ${formatCurrency(entry.affordabilityShortfall)} more.`
                            : ''}`
                        : `Locked.${entry.blockedReason ? ` ${entry.blockedReason}` : ''}`}`}
                      accessibilityState={{ disabled: !entryEnabled, selected }}
                      disabled={!entryEnabled}
                      onPress={() => {
                        if (!guidedFirstFacilityAllowsBuildType(entry.type) && guidedFirstFacility) return;
                        setSelectedBuildType(selected ? null : entry.type);
                        setSelectedBuildingId(null);
                        setRelocatingBuildingId(null);
                      }}
                      className={selected
                        ? 'min-h-36 w-full border-2 border-b-4 border-blue-dark bg-blue-light/30 p-2'
                        : entryEnabled
                          ? 'min-h-36 w-full border-2 border-b-4 border-ink bg-white p-2'
                          : 'min-h-36 w-full border-2 border-ink/20 bg-ink/5 p-2'}
                    >
                      <View className="mb-2 flex-row items-start gap-2">
                        <View style={{ opacity: entryEnabled ? 1 : 0.35 }}>
                          <FacilitySprite type={entry.type} size={32} showLevel={false} />
                        </View>
                        <PixelText className={entryEnabled
                          ? 'flex-1 text-sm uppercase leading-4 text-ink'
                          : 'flex-1 text-sm uppercase leading-4 text-ink/35'}>
                          {entry.name}
                        </PixelText>
                      </View>
                      <Text className={entryEnabled
                        ? 'text-xs font-bold leading-4 text-blue-dark'
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
                          <PixelText className={knownAdjacency === undefined
                            ? 'text-xs uppercase tracking-wide text-blue-dark'
                            : 'text-xs uppercase tracking-wide text-pitch-dark'}>
                            {knownAdjacency === undefined ? 'Neighbour clue' : 'Known combo'}
                          </PixelText>
                          <Text className="mt-1 text-xs leading-4 text-ink/65">
                            {adjacencyGuidance}
                          </Text>
                        </View>
                      ) : null}
                      {entry.blockedReason ? (
                        <Text className="mt-1 text-xs font-bold text-stamp">{entry.blockedReason}</Text>
                      ) : null}
                      {entry.available && !entry.affordable && entry.affordabilityShortfall > 0 ? (
                        <PixelText className="mt-1 text-xs uppercase text-red-dark">
                          Need {formatCurrency(entry.affordabilityShortfall)} more
                        </PixelText>
                      ) : null}
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </View>

          <View className="mt-4 border-t-2 border-ink/20 pt-3">
            <PixelText className="text-sm uppercase tracking-wide text-ink/50">Facility pair bonuses</PixelText>
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
                    <PixelText className="text-sm uppercase text-ink">
                      {presentation?.pairLabel ?? adjacency}
                    </PixelText>
                    {presentation ? (
                      <>
                        <Text className="mt-1 text-sm font-bold text-blue-dark">
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
  );
}

interface LegacyTrainingGroundSectionProps {
  facility: TrainingGroundDecisionViewModel;
  guideTrainingGround: boolean;
  trainingGroundRef: RefObject<View | null>;
  onTrainingGroundLayout: () => void;
  onBuildTrainingGround: () => void;
}

function LegacyTrainingGroundSection({
  facility,
  guideTrainingGround,
  trainingGroundRef,
  onTrainingGroundLayout,
  onBuildTrainingGround,
}: LegacyTrainingGroundSectionProps) {
  return (
    <View ref={trainingGroundRef} collapsable={false} onLayout={onTrainingGroundLayout}>
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
              <PixelText className="text-base uppercase text-ink">Training Ground · Level 1</PixelText>
              <Text className="mt-2 text-sm leading-4 text-ink/60">
                A proper weekly practice base. Small, dependable improvement without adding another management chore.
              </Text>
            </View>
          </View>
          <View className="mt-3 flex-row gap-2">
            <Metric label="Build cost" value={formatCurrency(facility.cost)} tone="negative" />
            <Metric label="Weekly return" value={`+${facility.weeklyTrainingPoints} TP`} tone="positive" />
          </View>
          <PixelText className="mt-3 text-sm uppercase tracking-wide text-ink/50">
            M1 offer: $8,000 cost · +10 TP every week
          </PixelText>
          {!facility.built && !facility.underConstruction ? (
            <View className={guideTrainingGround ? 'relative mt-3 border-2 border-blue-dark bg-blue-light p-1' : 'relative mt-3'}>
              {guideTrainingGround ? (
                <TutorialTapCue
                  detail="Build the facility"
                  style={{ left: '50%', marginLeft: -TUTORIAL_TAP_CUE_WIDTH / 2, top: -72 }}
                />
              ) : null}
              <ActionButton
                label="Approve build · $8,000 · 2 weeks"
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
            <PixelText className="mt-2 text-center text-sm uppercase tracking-wide text-stamp">
              Insufficient balance
            </PixelText>
          ) : null}
        </PaperPanel>
    </View>
  );
}

function facilityColor(building: ClubFacilityBuildingViewModel): string {
  if (building.type === 'training-pitch' || building.type === 'youth-field') return '#86C07A';
  if (building.type === 'medical-bay') return '#F8C7C7';
  if (building.type === 'fan-shop' || building.type === 'stadium-stand') return '#C8DDF0';
  return '#F4E7C5';
}
