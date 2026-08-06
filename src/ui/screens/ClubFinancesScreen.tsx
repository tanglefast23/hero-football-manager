import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import { AccessibilityInfo, findNodeHandle, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { AssistantGuideFocus } from '../../content';
import { ActionButton, Metric, PaperPanel, SectionLabel, StatusChip, formatCompactNumber, formatCurrency } from '../components/Scorecard';
import { EmptyDocket } from '../components/EmptyDocket';
import { FacilitySprite } from '../components/FacilitySprite';
import type {
  ClubFacilityBuildingViewModel,
  ClubFacilityGridViewModel,
  ClubFinancesViewModel,
  ClubLoanViewModel,
  ClubOfficeTab,
  ClubSponsorshipViewModel,
  FacilityTypeViewModel,
  SponsorOfferViewModel,
  SponsorSlotViewModel,
  TrainingGroundDecisionViewModel,
  TrainingPointIncomeViewModel,
} from '../models';
import { TutorialTapCue } from '../TutorialTapCue';
import { TUTORIAL_TAP_CUE_WIDTH } from '../tutorial-cue-position';
import { ManagementSprite } from '../components/ManagementSprite';
import { facilityBenefit } from '../facility-benefit';
import {
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
  isIncomeFacilityType,
  type GuidedFirstFacilityPhase,
} from '../concierge-targets';
import { SectionFlow, type FlowSection } from '../layout/SectionFlow';
import { ScreenTabs, type ScreenTab } from '../components/ScreenTabs';
import { useLayoutMode } from '../layout/use-layout-mode';
import { PixelText } from '../components/PixelText';
import { useCopy } from '../../i18n';

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
  animated = true,
) {
  const viewport = viewportRef.current;
  const target = targetRef.current;
  if (viewport === null || target === null) return;
  viewport.measureInWindow((vx, vy) => {
    target.measureInWindow((tx, ty) => {
      const y = Math.max(0, latestScrollOffset + (ty - vy) - margin);
      scrollRef.current?.scrollTo({ y, animated });
    });
  });
}

/** Moves both the viewport and assistive-technology focus to a revealed desk. */
function focusGuideTarget(target: View | null): void {
  if (target === null) return;
  // React Native Web exposes the host node's focus method. Native needs the
  // accessibility handle instead; each branch is optional so tests and older
  // runtimes fail soft rather than trapping the briefing on screen.
  (target as unknown as { focus?: () => void }).focus?.();
  const handle = findNodeHandle(target);
  if (handle !== null) AccessibilityInfo.setAccessibilityFocus(handle);
}

/** Which board each section belongs to. Facility first — it is the one the desk sends you to. */
const CLUB_OFFICE_TABS: readonly ScreenTab<ClubOfficeTab>[] = [
  { id: 'facility', label: 'Facility', accessibilityLabel: 'Facility board' },
  { id: 'staff', label: 'Staff', accessibilityLabel: 'Staff board' },
  { id: 'finances', label: 'Finances', accessibilityLabel: 'Finances board' },
];

export interface ClubFinancesScreenProps {
  viewModel: ClubFinancesViewModel;
  /** The board on show. Owned above so the inbox and Bert can both open one. */
  activeTab: ClubOfficeTab;
  onSelectTab: (tab: ClubOfficeTab) => void;
  onOpenLedgerLine?: (ledgerLineId: string) => void;
  onBuildTrainingGround: () => void;
  onBuildFacility?: (type: FacilityTypeViewModel, x: number, y: number) => void;
  onUpgradeFacility?: (buildingId: string) => void;
  onRelocateFacility?: (buildingId: string, x: number, y: number) => void;
  onCloseFacility?: (buildingId: string) => void;
  onOpenCoachMarket?: () => void;
  onDismissCoach?: (role: 'HEAD' | 'ASSISTANT') => void;
  onReviewSponsorOffer?: (
    offer: SponsorOfferViewModel,
    slot: SponsorSlotViewModel,
  ) => void;
  guideTrainingGround?: boolean;
  guideFocus?: AssistantGuideFocus;
  reduceMotion?: boolean;
  /** Bumped after the signing modal is gone so the replacement desk receives focus. */
  focusSponsorSummaryToken?: number;
}

export function ClubFinancesScreen({
  viewModel,
  activeTab,
  onSelectTab,
  onOpenLedgerLine,
  onBuildTrainingGround,
  onBuildFacility,
  onUpgradeFacility,
  onRelocateFacility,
  onCloseFacility,
  onOpenCoachMarket,
  onDismissCoach,
  onReviewSponsorOffer,
  guideTrainingGround = false,
  guideFocus,
  reduceMotion = false,
  focusSponsorSummaryToken,
}: ClubFinancesScreenProps) {
  const t = useCopy();
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
  const incomeFacilityScrollFrameRef = useRef<number | null>(null);
  const incomeFacilityScrolledRef = useRef(false);
  const incomeFacilityBuildTargetRef = useRef<View>(null);
  const sponsorDeskTargetRef = useRef<View>(null);
  const sponsorBuzzTargetRef = useRef<View>(null);
  const sponsorBuzzAccessibilityRef = useRef<View>(null);
  const handledSponsorFocusTokenRef = useRef<number | undefined>(undefined);
  const sponsorGuideHandledRef = useRef<string | null>(null);
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
  /** Why the last tapped square could not take the building; null while nothing has been refused. */
  const [placementRejection, setPlacementRejection] = useState<string | null>(null);
  const [buildMenuReminder, setBuildMenuReminder] = useState<string | null>(null);
  const [facilityGridWidth, setFacilityGridWidth] = useState(0);
  const [coachingOfficeScrollCueDismissed, setCoachingOfficeScrollCueDismissed] = useState(false);
  const [selectedSponsorSlot, setSelectedSponsorSlot] = useState(0);
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
  const guideIncomeFacilities = guideFocus === 'income-facilities';
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
    setPlacementRejection(null);
    setBuildMenuReminder(null);
  }, []);

  const handleGridCell = useCallback((x: number, y: number) => {
    if (
      guidedFirstFacility
      && !guidedFirstFacilityAllowsPlacement(selectedBuildType, x, y)
    ) return;
    // A square that cannot take the building says so. It stays tappable rather
    // than disabled so the footprint preview still works, which means the tap
    // has to answer — docs/08: nothing refuses silently.
    if (!canPlaceAt(x, y)) {
      setPlacementRejection(cellIsOccupied(x, y)
        ? 'That square is taken. Pick an empty one.'
        : 'It does not fit here. Try a square with more room.');
      return;
    }
    setPlacementRejection(null);
    // Either order spends money the moment it is approved, so the tap only ever
    // proposes the square — the confirmation is where the club is committed.
    if (relocatingBuilding !== undefined) {
      setPendingPlacement({ kind: 'move', building: relocatingBuilding, x, y });
      setPreviewCell(null);
      return;
    }
    if (selectedBuildType !== null) {
      const catalog = facilities.catalog.find(entry => entry.type === selectedBuildType);
      if (catalog === undefined) return;
      setPendingPlacement({ kind: 'build', catalog, x, y });
      setPreviewCell(null);
    }
  }, [canPlaceAt, cellIsOccupied, facilities.catalog, guidedFirstFacility, relocatingBuilding, selectedBuildType]);

  const confirmPendingPlacement = useCallback(() => {
    if (pendingPlacement === null) return;
    if (pendingPlacement.kind === 'move') {
      onRelocateFacility?.(pendingPlacement.building.id, pendingPlacement.x, pendingPlacement.y);
      setPendingPlacement(null);
      setRelocatingBuildingId(null);
      return;
    }
    onBuildFacility?.(pendingPlacement.catalog.type, pendingPlacement.x, pendingPlacement.y);
    setPendingPlacement(null);
    setSelectedBuildType(null);
  }, [onBuildFacility, onRelocateFacility, pendingPlacement]);

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

  /**
   * The bail-out follow-up: the loan briefing ends by naming a shop and a
   * stand, and this is what puts them in front of the manager. They are the
   * last two cards of a twelve-card menu, so arriving on the Facility board
   * without this leaves him looking at eight training buildings he cannot
   * afford and has just been told not to buy.
   */
  const scrollToIncomeFacilities = useCallback(() => {
    if (
      !guideIncomeFacilities
      || incomeFacilityScrolledRef.current
      || incomeFacilityBuildTargetRef.current === null
    ) return;
    if (incomeFacilityScrollFrameRef.current !== null) {
      cancelAnimationFrame(incomeFacilityScrollFrameRef.current);
    }
    incomeFacilityScrollFrameRef.current = requestAnimationFrame(() => {
      incomeFacilityScrollFrameRef.current = null;
      scrollToTarget(
        scrollRef,
        scrollViewportRef,
        incomeFacilityBuildTargetRef,
        latestScrollOffsetRef.current,
      );
      incomeFacilityScrolledRef.current = true;
    });
  }, [guideIncomeFacilities]);

  useEffect(() => {
    if (!guideIncomeFacilities) {
      incomeFacilityScrolledRef.current = false;
      return;
    }
    scrollToIncomeFacilities();
  }, [guideIncomeFacilities, scrollToIncomeFacilities]);

  useEffect(() => {
    scrollToTrainingGround();
    return () => {
      if (scrollFrameRef.current !== null) cancelAnimationFrame(scrollFrameRef.current);
    };
  }, [scrollToTrainingGround]);

  useEffect(() => {
    if (guideFocus !== 'coaching-office') {
      coachingOfficeScrolledRef.current = false;
      setCoachingOfficeScrollCueDismissed(false);
      return;
    }
    scrollToCoachingOffice();
  }, [guideFocus, scrollToCoachingOffice]);

  const dismissCoachingOfficeScrollCue = useCallback(() => {
    setCoachingOfficeScrollCueDismissed(true);
  }, []);

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
    if (incomeFacilityScrollFrameRef.current !== null) {
      cancelAnimationFrame(incomeFacilityScrollFrameRef.current);
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

  useEffect(() => {
    const slots = viewModel.sponsorship?.slots ?? [];
    if (slots.length === 0) {
      setSelectedSponsorSlot(0);
      return;
    }
    if (!slots.some(slot => slot.slot === selectedSponsorSlot)) {
      setSelectedSponsorSlot(slots[0].slot);
    }
  }, [selectedSponsorSlot, viewModel.sponsorship?.slots]);

  const revealSponsorGuideTarget = useCallback(() => {
    if (
      activeTab !== 'finances'
      || (guideFocus !== 'sponsor-desk'
        && guideFocus !== 'sponsor-summary'
        && guideFocus !== 'sponsor-buzz')
      || sponsorGuideHandledRef.current === guideFocus
    ) return;
    const scrollTarget = guideFocus === 'sponsor-buzz'
      ? sponsorBuzzTargetRef.current
      : sponsorDeskTargetRef.current;
    const focusTarget = guideFocus === 'sponsor-buzz'
      ? sponsorBuzzAccessibilityRef.current ?? sponsorBuzzTargetRef.current
      : sponsorDeskTargetRef.current;
    if (scrollTarget === null || focusTarget === null) return;
    sponsorGuideHandledRef.current = guideFocus;
    requestAnimationFrame(() => {
      scrollToTarget(
        scrollRef,
        scrollViewportRef,
        guideFocus === 'sponsor-buzz' ? sponsorBuzzTargetRef : sponsorDeskTargetRef,
        latestScrollOffsetRef.current,
        12,
        !reduceMotion,
      );
      focusGuideTarget(focusTarget);
    });
  }, [activeTab, guideFocus, reduceMotion]);

  useEffect(() => {
    if (
      guideFocus !== 'sponsor-desk'
      && guideFocus !== 'sponsor-summary'
      && guideFocus !== 'sponsor-buzz'
    ) {
      sponsorGuideHandledRef.current = null;
      return;
    }
    revealSponsorGuideTarget();
  }, [guideFocus, revealSponsorGuideTarget]);

  useEffect(() => {
    if (
      focusSponsorSummaryToken === undefined
      || handledSponsorFocusTokenRef.current === focusSponsorSummaryToken
      || activeTab !== 'finances'
      || sponsorDeskTargetRef.current === null
    ) return;
    handledSponsorFocusTokenRef.current = focusSponsorSummaryToken;
    const frame = requestAnimationFrame(() => {
      scrollToTarget(
        scrollRef,
        scrollViewportRef,
        sponsorDeskTargetRef,
        latestScrollOffsetRef.current,
        12,
        !reduceMotion,
      );
      focusGuideTarget(sponsorDeskTargetRef.current);
    });
    return () => cancelAnimationFrame(frame);
  }, [activeTab, focusSponsorSummaryToken, reduceMotion, viewModel.sponsorship]);

  const onTrainingGroundLayout = useCallback(() => {
    scrollToTrainingGround();
  }, [scrollToTrainingGround]);

  const layoutMode = useLayoutMode();

  const financeSections: FlowSection[] = [
    {
      key: 'cash-position',
      weight: 6,
      node: <CashPositionSection viewModel={viewModel} guideFocus={guideFocus} />,
    },
    // Directly under the balance, because it is the balance with a claim on it.
    ...(viewModel.loan === undefined ? [] : [{
      key: 'loan',
      weight: 5,
      node: <EmergencyLoanSection loan={viewModel.loan} />,
    }]),
    ...(viewModel.sponsorship === undefined ? [] : [{
      key: 'sponsorship',
      weight: viewModel.sponsorship.managed
        ? 8 + viewModel.sponsorship.slots.reduce((sum, slot) => sum + slot.offers.length * 4, 0)
        : 5,
      node: (
        <SponsorBusinessSection
          sponsorship={viewModel.sponsorship}
          selectedSlot={selectedSponsorSlot}
          onSelectSlot={setSelectedSponsorSlot}
          onReviewOffer={onReviewSponsorOffer}
          guideFocus={guideFocus}
          sponsorDeskTargetRef={sponsorDeskTargetRef}
          sponsorBuzzTargetRef={sponsorBuzzTargetRef}
          sponsorBuzzAccessibilityRef={sponsorBuzzAccessibilityRef}
          onGuideTargetLayout={revealSponsorGuideTarget}
        />
      ),
    }]),
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
      key: 'training-points',
      weight: 3 + viewModel.trainingPointIncome.rows.length,
      node: <TrainingPointIncomeSection income={viewModel.trainingPointIncome} />,
    },
  ];

  const staffSections: FlowSection[] = [
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
  ];

  const facilitySections: FlowSection[] = [
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
          placementRejection={placementRejection}
          buildMenuReminder={buildMenuReminder}
          setBuildMenuReminder={setBuildMenuReminder}
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
          onCloseFacility={onCloseFacility}
          facilityGuideGridTargetRef={facilityGuideGridTargetRef}
          facilityGuideBuildTargetRef={facilityGuideBuildTargetRef}
          scrollFacilityGuideTargetIntoView={scrollFacilityGuideTargetIntoView}
          coachingOfficeBuildTargetRef={coachingOfficeBuildTargetRef}
          scrollToCoachingOffice={scrollToCoachingOffice}
          showCoachingOfficeScrollCue={guideFocus === 'coaching-office' && !coachingOfficeScrollCueDismissed}
          dismissCoachingOfficeScrollCue={dismissCoachingOfficeScrollCue}
          guideIncomeFacilities={guideIncomeFacilities}
          incomeFacilityBuildTargetRef={incomeFacilityBuildTargetRef}
          scrollToIncomeFacilities={scrollToIncomeFacilities}
        />
      ),
    },
    ...(viewModel.facilities.buildings.length === 0 ? [] : [{
      key: 'facility-register',
      weight: 3 + 2 * viewModel.facilities.buildings.length,
      node: <FacilityRegisterSection facilities={viewModel.facilities} />,
    }]),
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

  const sections = activeTab === 'facility'
    ? facilitySections
    : activeTab === 'staff'
      ? staffSections
      : financeSections;

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
      {/*
        The office is named once. Which of its three boards is open is the tab
        strip's job, and each board's own section label says what it holds — a
        per-board page title put "Coaching staff" directly above a section
        heading reading "Coaching staff".
      */}
      <SectionFlow
        mode={layoutMode}
        header={
      <View className="mb-5">
        <View className="flex-row items-start justify-between gap-3">
          <View className="min-w-0 flex-1">
            <PixelText className="text-sm uppercase text-blue-dark">{t('clubFinances.clubOffice')}</PixelText>
            <PixelText className="mt-1 text-xl uppercase leading-7 text-ink" numberOfLines={2}>
              {viewModel.clubName}
            </PixelText>
          </View>
          <StatusChip label={viewModel.periodLabel} />
        </View>
        <ScreenTabs tabs={CLUB_OFFICE_TABS} activeId={activeTab} onSelect={onSelectTab} />
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
              label="Next four weeks · typical"
              value={formatCurrency(viewModel.operatingOutlook.net, true)}
              tone={viewModel.operatingOutlook.net < 0 ? 'negative' : 'positive'}
            />
          </View>
          <View className="mt-2 flex-row gap-2">
            <Metric label="Four-week balance · typical" value={formatCurrency(viewModel.operatingOutlook.projectedBalance)} />
            <Metric label="Fans" value={formatCompactNumber(viewModel.fans)} />
          </View>
          <View className="mt-2 flex-row">
            <Metric
              label="Match, deals & prize"
              value={viewModel.variableIncome.detail === undefined
                ? formatCurrency(viewModel.variableIncome.amount, true)
                : `${formatCurrency(viewModel.variableIncome.amount)} (${viewModel.variableIncome.detail})`}
              tone={viewModel.variableIncome.amount > 0 ? 'positive' : 'normal'}
            />
          </View>
          {viewModel.operatingOutlook.weeks.length > 0 ? (
            <View className="mt-3 border-2 border-ink bg-white">
              {viewModel.operatingOutlook.weeks.map(week => (
                <View key={week.periodLabel} className="border-b border-ink/20 px-3 py-2 last:border-b-0">
                  <View className="flex-row items-center justify-between gap-2">
                    <PixelText className="text-xs uppercase text-ink">{week.periodLabel}</PixelText>
                    <Text className={week.net < 0 ? 'font-mono text-sm text-red-dark' : 'font-mono text-sm text-pitch-dark'}>
                      {formatCurrency(week.net, true)}
                    </Text>
                  </View>
                  <Text className="mt-1 text-xs text-ink/65">{week.detail}</Text>
                </View>
              ))}
            </View>
          ) : null}
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

/**
 * What the club still owes the board.
 *
 * Until this panel existed the outstanding balance was visible in exactly one
 * place — a single inbox row that had to hold an urgent desk slot for the whole
 * life of the loan to stay reachable. A debt is a fact you look up, so it lives
 * with the accounts.
 */
function EmergencyLoanSection({ loan }: { readonly loan: ClubLoanViewModel }) {
  return (
    <View>
      <PaperPanel kicker="Board loan" title="Emergency loan" stamp="Owed">
        <View className="flex-row gap-2">
          <Metric label="Borrowed" value={formatCurrency(loan.originalAmount)} />
          <Metric label="Still owed" value={formatCurrency(loan.remainingBalance)} tone="negative" />
        </View>
        <View className="mt-2 flex-row">
          <Metric label={loan.scheduleLabel} value={loan.scheduleValue} />
        </View>
        <PixelText className="mt-3 text-xs uppercase leading-4 tracking-wide text-ink/70">
          {loan.detail}
        </PixelText>
      </PaperPanel>
    </View>
  );
}

interface SponsorBusinessSectionProps {
  sponsorship: ClubSponsorshipViewModel;
  selectedSlot: number;
  onSelectSlot: (slot: number) => void;
  onReviewOffer?: (offer: SponsorOfferViewModel, slot: SponsorSlotViewModel) => void;
  guideFocus?: AssistantGuideFocus;
  sponsorDeskTargetRef: RefObject<View | null>;
  sponsorBuzzTargetRef: RefObject<View | null>;
  sponsorBuzzAccessibilityRef: RefObject<View | null>;
  onGuideTargetLayout: () => void;
}

/** One honest sponsor desk: signed terms, one slot at a time, then its offers. */
function SponsorBusinessSection({
  sponsorship,
  selectedSlot,
  onSelectSlot,
  onReviewOffer,
  guideFocus,
  sponsorDeskTargetRef,
  sponsorBuzzTargetRef,
  sponsorBuzzAccessibilityRef,
  onGuideTargetLayout,
}: SponsorBusinessSectionProps) {
  const t = useCopy();
  const selected = sponsorship.slots.find(slot => slot.slot === selectedSlot)
    ?? sponsorship.slots[0];
  const guidedDesk = guideFocus === 'sponsor-desk' || guideFocus === 'sponsor-summary';

  if (!sponsorship.managed) {
    return (
      <View className={guideFocus === 'sponsor-buzz'
        ? 'border-2 border-blue-dark bg-blue-light p-1'
        : undefined}
      >
        <SponsorHeading
          title="Club Buzz"
          eyebrow="Social following"
          stamp="Season 3"
          targetRef={sponsorBuzzTargetRef}
          onLayout={onGuideTargetLayout}
        />
        <PaperPanel kicker="Local advertising" title="The crowd is talking" stamp="LIVE">
          <Text className="text-sm leading-5 text-ink/70">
            Your pitchside boards pay {formatCurrency(sponsorship.actualMonthlyIncome)} each month.
            Wins, goals and hero moments now make them worth more twice a season.
          </Text>
          {sponsorship.buzz === undefined ? null : (
            <BuzzCard buzz={sponsorship.buzz} focusTargetRef={sponsorBuzzAccessibilityRef} />
          )}
        </PaperPanel>
      </View>
    );
  }

  return (
    <View className={guidedDesk ? 'border-2 border-blue-dark bg-blue-light p-1' : undefined}>
      <SponsorHeading
        title="Sponsor Desk"
        eyebrow="Club business"
        stamp={`${sponsorship.slots.length} slot${sponsorship.slots.length === 1 ? '' : 's'}`}
        targetRef={sponsorDeskTargetRef}
        onLayout={onGuideTargetLayout}
      />
      <View className="mb-3 border-2 border-ink bg-white p-3">
        <View className="flex-row flex-wrap items-start justify-between gap-2">
          <View className="min-w-0 flex-1">
            <PixelText className="text-sm uppercase text-ink">{t('clubFinances.portfolioPayment')}</PixelText>
            <Text className="mt-1 font-mono text-xl text-ink">
              {formatCurrency(sponsorship.actualMonthlyIncome)} / month
            </Text>
          </View>
          <StatusChip label={`Next · ${sponsorship.nextPaymentLabel}`} tone="info" />
        </View>
        {sponsorship.chairmanPercent === undefined ? null : (
          <Text className="mt-2 text-sm leading-5 text-ink/70">
            Contract total {formatCurrency(sponsorship.nominalMonthlyIncome)}. On Chairman, the club receives {sponsorship.chairmanPercent}%.
          </Text>
        )}
      </View>

      <ScreenTabs
        tabs={sponsorship.slots.map(slot => ({
          id: String(slot.slot),
          label: slot.slotLabel,
          accessibilityLabel: `${slot.slotLabel}, ${slot.provisional ? 'needs a sponsor choice' : 'signed'}`,
        }))}
        activeId={String(selected?.slot ?? selectedSlot)}
        onSelect={id => onSelectSlot(Number(id))}
        idPrefix="sponsor-slots"
        linkPanels
        showSingleTab
        className="mb-3 flex-row gap-1"
      />

      {selected === undefined ? null : (
        <View
          nativeID={`sponsor-slots-panel-${selected.slot}`}
          {...webSponsorPanelProps(`sponsor-slots-tab-${selected.slot}`)}
        >
          <ActiveSponsorCard slot={selected} chairmanPercent={sponsorship.chairmanPercent} />
          {!sponsorship.offerWindowOpen || selected.offers.length === 0 ? (
            selected.provisional ? (
              <View className="mt-3 border-2 border-dashed border-ink/30 bg-paper p-3">
                <PixelText className="text-sm uppercase text-ink">{t('clubFinances.incomeProtected')}</PixelText>
                <Text className="mt-1 text-sm leading-5 text-ink/70">
                  {t('clubFinances.yourCurrentSponsorIncome')}</Text>
              </View>
            ) : null
          ) : (
            <View className="mt-4 gap-3">
              <SectionLabel eyebrow="Offers" title={`Choose for ${selected.slotLabel}`} />
              {selected.offers.map(offer => (
                <SponsorOfferCard
                  key={offer.offerId}
                  offer={offer}
                  slot={selected}
                  chairmanPercent={sponsorship.chairmanPercent}
                  onReview={onReviewOffer}
                />
              ))}
            </View>
          )}
        </View>
      )}

      {sponsorship.buzz === undefined ? null : (
        <View
          ref={sponsorBuzzTargetRef}
          collapsable={false}
          onLayout={onGuideTargetLayout}
          className={guideFocus === 'sponsor-buzz'
            ? 'mt-4 border-2 border-blue-dark bg-blue-light p-1'
            : 'mt-4'}
        >
          <BuzzCard buzz={sponsorship.buzz} focusTargetRef={sponsorBuzzAccessibilityRef} />
        </View>
      )}
    </View>
  );
}

function SponsorHeading({ title, eyebrow, stamp, targetRef, onLayout }: {
  readonly title: string;
  readonly eyebrow: string;
  readonly stamp: string;
  readonly targetRef: RefObject<View | null>;
  readonly onLayout: () => void;
}) {
  return (
    <View
      ref={targetRef}
      collapsable={false}
      onLayout={onLayout}
      className="mb-3 flex-row flex-wrap items-end justify-between gap-2"
      accessibilityRole="header"
      accessibilityLabel={`${title}. ${stamp}.`}
      {...guideHeadingProps()}
    >
      <View className="min-w-0 flex-1">
        <PixelText className="text-sm uppercase text-ink">{eyebrow}</PixelText>
        <PixelText className="mt-1 text-xl uppercase text-ink">{title}</PixelText>
      </View>
      <StatusChip label={stamp} selected />
    </View>
  );
}

function ActiveSponsorCard({ slot, chairmanPercent }: {
  readonly slot: SponsorSlotViewModel;
  readonly chairmanPercent?: number;
}) {
  const statusLabel = slot.provisional
    ? 'CONTINUITY'
    : slot.objectiveStatus === 'MET'
      ? 'TARGET MET'
      : slot.objectiveStatus === 'FAILED' ? 'TARGET MISSED' : 'ACTIVE';
  const statusTone = slot.objectiveStatus === 'MET'
    ? 'success' as const
    : slot.objectiveStatus === 'FAILED' ? 'danger' as const : 'normal' as const;
  const accessibilityLabel = [
    `${slot.sponsorName}. ${slot.provisional ? 'Continuity sponsor' : 'Active sponsor'}.`,
    `Contract value ${formatCurrency(slot.nominalMonthlyFee)} per month.`,
    chairmanPercent === undefined
      ? undefined
      : `On Chairman, the club receives ${formatCurrency(slot.actualMonthlyFee)} per month.`,
    slot.objectiveLabel === undefined ? undefined : `Objective: ${slot.objectiveLabel}.`,
    slot.objectiveProgressLabel === undefined ? undefined : `${slot.objectiveProgressLabel}.`,
    slot.nominalBonus === undefined ? undefined : `Contract bonus: ${formatCurrency(slot.nominalBonus)}.`,
    chairmanPercent === undefined || slot.actualBonus === undefined
      ? undefined
      : `Club receives ${formatCurrency(slot.actualBonus)}.`,
  ].filter(Boolean).join(' ');
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel}
      className="border-2 border-b-4 border-ink bg-white p-4"
    >
      <View className="flex-row flex-wrap items-start justify-between gap-2">
        <View className="min-w-0 flex-1">
          <PixelText className="text-base uppercase leading-6 text-ink">{slot.sponsorName}</PixelText>
          <Text className="mt-1 text-sm leading-5 text-ink/70">{slot.offerLine}</Text>
        </View>
        <StatusChip label={statusLabel} tone={statusTone} />
      </View>
      <View className="mt-3 border-t border-ink/20 pt-3">
        <Text className="font-mono text-base text-ink">
          Contract {formatCurrency(slot.nominalMonthlyFee)} / month
        </Text>
        {chairmanPercent === undefined ? null : (
          <Text className="mt-1 text-sm font-bold text-blue-dark">
            Club receives {formatCurrency(slot.actualMonthlyFee)} / month · {chairmanPercent}%
          </Text>
        )}
      </View>
      {slot.objectiveLabel === undefined ? null : (
        <View className="mt-3 border-2 border-ink/20 bg-paper p-3">
          <Text className="text-sm font-bold leading-5 text-ink">{slot.objectiveLabel}</Text>
          {slot.objectiveProgressLabel === undefined ? null : (
            <Text className="mt-1 font-mono text-sm text-ink/70">{slot.objectiveProgressLabel}</Text>
          )}
          <Text className="mt-2 font-mono text-sm text-ink">
            Target bonus {formatCurrency(slot.nominalBonus ?? 0)}
          </Text>
          {chairmanPercent === undefined ? null : (
            <Text className="mt-1 text-sm text-blue-dark">
              Club receives {formatCurrency(slot.actualBonus ?? 0)}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

function SponsorOfferCard({ offer, slot, chairmanPercent, onReview }: {
  readonly offer: SponsorOfferViewModel;
  readonly slot: SponsorSlotViewModel;
  readonly chairmanPercent?: number;
  readonly onReview?: (offer: SponsorOfferViewModel, slot: SponsorSlotViewModel) => void;
}) {
  const accessibilityLabel = [
    `Review ${offer.sponsorName} for ${slot.slotLabel}.`,
    `${offer.profileLabel} offer.`,
    `Contract value ${formatCurrency(offer.nominalMonthlyFee)} per month.`,
    chairmanPercent === undefined
      ? undefined
      : `On Chairman, the club receives ${formatCurrency(offer.actualMonthlyFee)} per month.`,
    `Objective: ${offer.objectiveLabel}.`,
    `Contract bonus ${formatCurrency(offer.nominalBonus)}.`,
    chairmanPercent === undefined
      ? undefined
      : `Club receives ${formatCurrency(offer.actualBonus)}.`,
  ].filter(Boolean).join(' ');
  return (
    <View className="border-2 border-b-4 border-ink bg-white p-4">
      <View className="flex-row flex-wrap items-start justify-between gap-2">
        <View className="min-w-0 flex-1">
          <PixelText className="text-base uppercase leading-6 text-ink">{offer.sponsorName}</PixelText>
          <Text className="mt-1 text-sm leading-5 text-ink/70">{offer.offerLine}</Text>
        </View>
        <StatusChip label={offer.profileLabel} tone={offer.profile === 'BOLD' ? 'hero' : 'normal'} />
      </View>
      <View className="mt-3 gap-1 border-t border-ink/20 pt-3">
        <Text className="font-mono text-base text-ink">
          Contract {formatCurrency(offer.nominalMonthlyFee)} / month
        </Text>
        {chairmanPercent === undefined ? null : (
          <Text className="text-sm font-bold text-blue-dark">
            Club receives {formatCurrency(offer.actualMonthlyFee)} / month · {chairmanPercent}%
          </Text>
        )}
        <Text className="mt-2 text-sm font-bold leading-5 text-ink">{offer.objectiveLabel}</Text>
        <Text className="font-mono text-sm text-ink">
          Target bonus {formatCurrency(offer.nominalBonus)}
        </Text>
        {chairmanPercent === undefined ? null : (
          <Text className="text-sm text-blue-dark">
            Club receives {formatCurrency(offer.actualBonus)}
          </Text>
        )}
      </View>
      {onReview === undefined ? null : (
        <View className="mt-4">
          <ActionButton
            label="Review offer"
            accessibilityLabel={accessibilityLabel}
            onPress={() => onReview(offer, slot)}
          />
        </View>
      )}
    </View>
  );
}

function BuzzCard({ buzz, focusTargetRef }: {
  readonly buzz: NonNullable<ClubSponsorshipViewModel['buzz']>;
  readonly focusTargetRef: RefObject<View | null>;
}) {
  const t = useCopy();
  return (
    <View
      className="mt-3 border-2 border-b-4 border-ink bg-gold-light p-4"
    >
      <View className="flex-row flex-wrap items-start justify-between gap-2">
        <View className="min-w-0 flex-1">
          <PixelText className="text-base uppercase text-ink">{t('clubFinances.clubBuzz')}</PixelText>
          <Text className="mt-1 text-sm text-ink/70">Next payout · {buzz.nextPayoutLabel}</Text>
        </View>
        <StatusChip label={`${buzz.value} / 100`} tone="hero" />
      </View>
      <View
        ref={focusTargetRef}
        collapsable={false}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={t('clubFinances.a11y.clubBuzzProgress')}
        accessibilityValue={{ min: 0, max: 100, now: buzz.value, text: `${buzz.value} of 100` }}
        className="mt-3 h-6 overflow-hidden border-2 border-ink bg-white"
      >
        <View className="h-full bg-gold" style={{ width: `${buzz.value}%` }} />
      </View>
      <Text className="mt-3 font-mono text-base text-ink">
        At today's rate · {formatCurrency(buzz.pendingPayout)}
      </Text>
      {buzz.lastSettlementLabel === undefined ? null : (
        <Text className="mt-2 text-sm leading-5 text-ink/70">Last payout · {buzz.lastSettlementLabel}</Text>
      )}
    </View>
  );
}

function webSponsorPanelProps(labelledBy: string): object {
  if (Platform.OS !== 'web') return {};
  return { role: 'tabpanel', 'aria-labelledby': labelledBy, tabIndex: -1 };
}

function guideHeadingProps(): object {
  if (Platform.OS !== 'web') return { focusable: true };
  return { tabIndex: -1 };
}

interface ItemizedStatementSectionProps {
  viewModel: ClubFinancesViewModel;
  onOpenLedgerLine?: (ledgerLineId: string) => void;
}

function ItemizedStatementSection({ viewModel, onOpenLedgerLine }: ItemizedStatementSectionProps) {
  return (
    <View>
        <SectionLabel eyebrow="Weekly" title="Expenses and income" />
        {viewModel.ledger.length === 0 ? (
          <EmptyDocket
            title="Nothing yet"
            detail="Wages, gate receipts, upkeep and every payment land here as each week is played."
          />
        ) : (
        <View className="border-2 border-ink bg-white">
          <View className="flex-row border-b border-ink/20 px-3 py-2">
            <PixelText className="flex-1 text-sm uppercase tracking-wide text-ink/70">Entry</PixelText>
            <PixelText className="text-right text-sm uppercase tracking-wide text-ink/70">Amount</PixelText>
          </View>
          {viewModel.ledger.map(line => {
            const amountClass = line.kind === 'income'
              ? 'text-pitch-ink'
              : line.kind === 'expense'
                ? 'text-red-dark'
                : 'text-ink';
            const accessibilityLabel = `${line.periodLabel}, ${line.label}, ${line.amount > 0 ? 'plus ' : ''}${formatCurrency(line.amount)}`;
            const content = (
              <>
                <View className="flex-1 pr-3">
                  <Text className="text-base text-ink">{line.label}</Text>
                  <Text className="font-mono text-xs uppercase text-ink/70">{line.periodLabel}</Text>
                </View>
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
          <SectionLabel eyebrow="One offs" title="Signings and purchases" />
          {viewModel.recentTransactions.length === 0 ? (
            <EmptyDocket
              title="Nothing signed or built"
              detail="Transfers, youth signings, coach hires and facility work land here. Wages, gate money, sponsor and prizes stay in the weekly list above."
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
                  <Text className="font-mono text-xs uppercase text-ink/70">
                    {transaction.periodLabel} · Balance {formatCurrency(transaction.balanceAfter)}
                  </Text>
                </View>
                <Text className={`font-mono text-base ${transaction.kind === 'income' ? 'text-pitch-ink' : 'text-red-dark'}`}>
                  {formatCurrency(transaction.amount, true)}
                </Text>
              </View>
            ))}
          </View>
          )}
    </View>
  );
}

/**
 * Where the week's training points come from, row by row.
 *
 * The HUD number went up when a Training Pitch finished and again when a coach
 * signed, and nothing on any screen said which of them was worth more. Same
 * shape as the statement above it so the two read as one habit.
 */
function TrainingPointIncomeSection({ income }: { readonly income: TrainingPointIncomeViewModel }) {
  const t = useCopy();
  return (
    <View>
      <SectionLabel eyebrow="Training points" title="What earns them" />
      <View className="border-2 border-ink bg-white">
        {income.rows.map(row => (
          <View
            key={row.id}
            accessible
            accessibilityRole="text"
            accessibilityLabel={`${row.label}, ${row.points} training points a week`}
            className="min-h-11 flex-row items-center border-b border-ink/10 px-3 py-2"
          >
            <View className="flex-1 pr-3">
              <Text className="text-base text-ink">{row.label}</Text>
              {row.detail === undefined ? null : (
                <Text className="font-mono text-xs uppercase text-ink/70">{row.detail}</Text>
              )}
            </View>
            <Text className="font-mono text-base text-blue-dark">+{row.points}</Text>
          </View>
        ))}
        <View
          accessible
          accessibilityRole="text"
          accessibilityLabel={`Total, ${income.total} training points a week`}
          className="min-h-11 flex-row items-center bg-paper px-3 py-2"
        >
          <PixelText className="flex-1 pr-3 text-sm uppercase text-ink">{t('clubFinances.perWeek')}</PixelText>
          <Text className="font-mono text-lg text-ink">{income.total}</Text>
        </View>
      </View>
    </View>
  );
}

/**
 * Everything the club owns, what each one buys it, and what the lot costs to
 * run. The grid above shows where they are; this says what they are for.
 */
function FacilityRegisterSection({ facilities }: { readonly facilities: ClubFacilityGridViewModel }) {
  const t = useCopy();
  return (
    // No margin of its own: SectionFlow already spaces every section by gap-6.
    <View>
      <SectionLabel
        eyebrow="On the books"
        title="What the club owns"
        right={<StatusChip label={`${facilities.buildings.length} built`} />}
      />
      <View className="border-2 border-ink bg-white">
        {facilities.buildings.map(building => (
          <View
            key={building.id}
            accessible
            accessibilityRole="text"
            accessibilityLabel={`${building.name}, Level ${building.level}. ${building.effectLabel}. ${formatCurrency(building.weeklyUpkeep)} a week.`}
            className="flex-row items-start border-b border-ink/10 px-3 py-2"
          >
            <View className="flex-1 pr-3">
              <Text className="text-base font-bold text-ink">
                {building.name} · Level {building.level}
              </Text>
              <Text className="mt-1 text-sm leading-5 text-ink/70">
                {building.status === 'operational'
                  ? building.effectLabel
                  : `${building.status === 'construction' ? 'Building' : 'Upgrading'} · ${building.weeksRemaining} week${building.weeksRemaining === 1 ? '' : 's'} remaining`}
              </Text>
            </View>
            <Text className="font-mono text-base text-red-dark">
              {building.weeklyUpkeep === 0 ? formatCurrency(0) : formatCurrency(-building.weeklyUpkeep)}
            </Text>
          </View>
        ))}
        <View
          accessible
          accessibilityRole="text"
          accessibilityLabel={`Total upkeep, ${formatCurrency(facilities.weeklyUpkeep)} a week`}
          className="min-h-11 flex-row items-center bg-paper px-3 py-2"
        >
          <PixelText className="flex-1 pr-3 text-sm uppercase text-ink">{t('clubFinances.runningCost')}</PixelText>
          <Text className="font-mono text-lg text-red-dark">
            {formatCurrency(-facilities.weeklyUpkeep)}/wk
          </Text>
        </View>
      </View>
    </View>
  );
}

interface CoachingStaffSectionProps {
  viewModel: ClubFinancesViewModel;
  onOpenCoachMarket?: () => void;
  onDismissCoach?: (role: 'HEAD' | 'ASSISTANT') => void;
}

function CoachingStaffSection({ viewModel, onOpenCoachMarket, onDismissCoach }: CoachingStaffSectionProps) {
  const t = useCopy();
  return (
    <View>
        <SectionLabel
          eyebrow="Backroom staff"
          title="Coaching staff"
          right={<StatusChip label={`${viewModel.coachingStaff.length} / 2`} selected={viewModel.coachingStaff.length > 0} />}
        />
        {viewModel.coachingStaff.length === 0 ? (
          <PaperPanel kicker="Vacancy" title="The touchline needs a voice" stamp="OPEN">
            <Text className="text-sm leading-5 text-ink/70">
              {t('clubFinances.hireAHeadCoach')}</Text>
            {onOpenCoachMarket ? (
              <View className="mt-3">
                <ActionButton
                  label="Open coach market"
                  accessibilityLabel={t('clubFinances.a11y.openTheCoachMarket')}
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
                    <Text className="mt-1 text-sm text-ink/70">
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
                <Text className="mt-2 text-sm text-ink/70">
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
                accessibilityLabel={t('clubFinances.a11y.reviewTheCoachMarket')}
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
  /** Why the last tapped square was refused, shown in place of the placement hint. */
  placementRejection: string | null;
  buildMenuReminder: string | null;
  setBuildMenuReminder: Dispatch<SetStateAction<string | null>>;
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
  onCloseFacility?: (buildingId: string) => void;
  facilityGuideGridTargetRef: RefObject<View | null>;
  facilityGuideBuildTargetRef: RefObject<View | null>;
  scrollFacilityGuideTargetIntoView: (phase: GuidedFirstFacilityPhase) => void;
  coachingOfficeBuildTargetRef: RefObject<View | null>;
  scrollToCoachingOffice: () => void;
  showCoachingOfficeScrollCue: boolean;
  dismissCoachingOfficeScrollCue: () => void;
  /** Lights the Fan Shop and Stadium Stand after the board's loan lands. */
  guideIncomeFacilities: boolean;
  incomeFacilityBuildTargetRef: RefObject<View | null>;
  scrollToIncomeFacilities: () => void;
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
  placementRejection,
  buildMenuReminder,
  setBuildMenuReminder,
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
  onCloseFacility,
  facilityGuideGridTargetRef,
  facilityGuideBuildTargetRef,
  scrollFacilityGuideTargetIntoView,
  coachingOfficeBuildTargetRef,
  scrollToCoachingOffice,
  showCoachingOfficeScrollCue,
  dismissCoachingOfficeScrollCue,
  guideIncomeFacilities,
  incomeFacilityBuildTargetRef,
  scrollToIncomeFacilities,
}: GroundsSectionProps) {
  const t = useCopy();
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
          <Text className="mb-3 text-sm leading-4 text-ink/70">
            {t('clubFinances.pickABuildingFrom')}</Text>
          {viewModel.facilities.activeProject ? (
            <View className="mb-3 flex-row items-center gap-3 border-2 border-b-4 border-amber-800 bg-amber-100 p-3">
              <ManagementSprite spriteKey="facility:worksite" width={54} accessibilityLabel={t('clubFinances.a11y.activeConstructionSite')} />
              <View className="min-w-0 flex-1">
                <Text className="font-pixel text-sm uppercase text-amber-900">{t('clubFinances.worksCrewBusy')}</Text>
                <PixelText className="mt-1 text-base uppercase text-ink">
                  {viewModel.facilities.activeProject.name} · {viewModel.facilities.activeProject.weeksRemaining}W left
                </PixelText>
                <Text className="mt-1 text-sm text-ink/70">{t('clubFinances.onlyOneConstructionOr')}</Text>
              </View>
            </View>
          ) : null}
          {facilities.activeAdjacencies.length > 0 ? (
            <View className="mb-3 border-2 border-pitch-dark bg-pitch-light px-3 py-2">
              <Text className="font-pixel text-sm uppercase text-ink">{t('clubFinances.pairBonusActive')}</Text>
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
                // Do not make the cell layer its own stacking context. The
                // shared hover-tip host raises only the active cell; trapping
                // it under a layer below the facility art made buildings paint
                // through the placement message.
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
                          // A blocked square answers with the refusal cue, not
                          // the click that means the tap landed.
                          pressSfx={buildable ? 'click' : 'warning'}
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
                              : 'Blocked, the footprint does not fit here')
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
                          // Grid cells can measure narrower than the 32px art;
                          // the cell cannot grow (it is a % of the plot), so a
                          // sub-32 width accepts ManagementSprite's explicit
                          // sub-1x downscale rather than overflowing the cell.
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
                <Text className={placementRejection === null
                  ? 'mt-1 text-sm text-ink/70'
                  : 'mt-1 text-sm font-bold text-red-dark'}
                >
                  {placementRejection ?? 'Tap any + square above. A blue outline fits; red is blocked.'}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('clubFinances.a11y.cancelPlacement')}
                onPress={cancelPlacement}
                className="min-h-11 items-center justify-center border-2 border-blue-dark bg-white px-3"
              >
                <PixelText className="text-sm uppercase text-blue-dark">Cancel</PixelText>
              </Pressable>
            </View>
          ) : (
            <View className="mt-3 border-2 border-dashed border-ink/30 bg-paper px-3 py-2">
              <Text className="text-sm text-ink/70">
                {/* One sentence, one key. Splitting it into three JSX pieces
                    would force every language into English word order — and the
                    emphasised menu name does not sit in the same place in all
                    of them. */}
                {t('clubFinances.buildHint', { menu: t('clubFinances.buildMenu') })}
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
                <PixelText className="text-sm uppercase text-ink">{t('clubFinances.whatItDoes')}</PixelText>
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
                  <Text className="mt-1 text-sm text-ink/70">
                    {selectedBuilding.status === 'operational'
                      ? `${formatCurrency(selectedBuilding.weeklyUpkeep)}/wk upkeep · ${formatCurrency(selectedBuilding.relocationFee)} to move`
                      : `${selectedBuilding.status === 'construction' ? 'Building' : 'Upgrading'} · ${selectedBuilding.weeksRemaining} week${selectedBuilding.weeksRemaining === 1 ? '' : 's'} remaining`}
                  </Text>
                  <Text className="mt-2 text-sm font-bold leading-4 text-blue-dark">
                    {selectedBuilding.effectLabel}
                  </Text>
                  {selectedBuilding.nextLevelEffectLabel ? (
                    <PixelText className="mt-1 text-xs uppercase leading-4 text-ink/70">
                      Next level · {selectedBuilding.nextLevelEffectLabel}
                    </PixelText>
                  ) : null}
                  {selectedBuilding.activeAdjacencyIds.length > 0 ? (
                    <PixelText className="mt-2 text-xs uppercase text-pitch-ink">
                      Active combo · {selectedBuilding.activeAdjacencyIds.map(facilityAdjacencyLabel).join(' · ')}
                    </PixelText>
                  ) : null}
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('clubFinances.a11y.closeSelectedFacility')}
                  onPress={() => {
                    setSelectedBuildingId(null);
                    setRelocatingBuildingId(null);
                  }}
                  className="h-11 w-11 items-center justify-center border-2 border-ink bg-paper"
                  // Explicit points: h-11 is 38.5pt on native, under the 44pt
                  // touch-target contract — see ActionButton's minHeight.
                  style={{ minWidth: 44, minHeight: 44 }}
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
                <Text className="mt-2 text-sm font-bold text-red-dark">
                  {selectedBuilding.upgradeBlockedReason}
                </Text>
              ) : null}
              {/* Its own row, and outlined rather than filled: demolishing is
                  never the thing the manager came to this panel to do, and a
                  third solid button beside Move and Upgrade would read as one. */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={selectedBuilding.canClose
                  ? `Close ${selectedBuilding.name} and recover ${formatCurrency(selectedBuilding.closeRefund)}`
                  : `Cannot close ${selectedBuilding.name} while its project is active`}
                accessibilityState={{ disabled: !selectedBuilding.canClose }}
                disabled={!selectedBuilding.canClose}
                onPress={() => onCloseFacility?.(selectedBuilding.id)}
                className={selectedBuilding.canClose
                  ? 'mt-2 min-h-12 items-center justify-center border-2 border-b-4 border-red-dark bg-white px-2'
                  : 'mt-2 min-h-12 items-center justify-center border-2 border-ink/30 bg-ink/5 px-2'}
              >
                <PixelText className={selectedBuilding.canClose
                  ? 'text-center text-sm uppercase text-red-dark'
                  : 'text-center text-sm uppercase text-ink/35'}>
                  {selectedBuilding.canClose
                    ? `Close · ${formatCurrency(selectedBuilding.closeRefund)} back`
                    : 'Project active'}
                </PixelText>
              </Pressable>
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
            <PixelText className="mb-2 text-sm uppercase tracking-wide text-ink/70">{t('clubFinances.buildMenu')}</PixelText>
            {buildMenuReminder !== null ? (
              <Text
                accessibilityLiveRegion="polite"
                className="mb-3 border-2 border-gold-dark bg-gold-light px-3 py-3 text-sm font-bold leading-5 text-ink"
              >
                {buildMenuReminder}
              </Text>
            ) : null}
            <View className={guidedFirstFacility && guidedFacilityPhase === 'build-menu'
              ? 'mt-20 flex-row flex-wrap gap-2'
              : 'flex-row flex-wrap gap-2'}>
              {viewModel.facilities.catalog.map(entry => {
                const selected = selectedBuildType === entry.type;
                const knownAdjacency = viewModel.facilities.discoveredAdjacencies
                  .map(facilityAdjacencyPresentation)
                  .find(presentation => presentation?.facilityTypes.includes(entry.type));
                const adjacencyGuidance = knownAdjacency === undefined
                  ? undefined
                  : `${knownAdjacency.pairLabel} · ${knownAdjacency.effectLabel}`;
                const adjacencyAccessibility = adjacencyGuidance === undefined
                  ? ''
                  : ` Known combo: ${adjacencyGuidance}.`;
                const guideAllowsType = !guidedFirstFacility
                  || guidedFirstFacilityAllowsBuildType(entry.type);
                const entryEnabled = entry.available && entry.affordable && guideAllowsType;
                const openingPitchChoiceBlocked = entry.blockedByOpeningTrainingPitch
                  || !guideAllowsType;
                const guidedIncome = guideIncomeFacilities && isIncomeFacilityType(entry.type);
                return (
                  <Fragment key={entry.type}>
                    {/* The banner rides the same wrapping row as the cards it
                        introduces rather than sitting at the top of the menu:
                        these two are the last of twelve, so a heading up there
                        would scroll off before the buildings it names arrive. */}
                    {guidedIncome && entry.type === 'fan-shop' ? (
                      <View
                        ref={incomeFacilityBuildTargetRef}
                        collapsable={false}
                        onLayout={scrollToIncomeFacilities}
                        className="w-full border-2 border-b-4 border-gold-dark bg-gold-light px-3 py-3"
                      >
                        <PixelText className="text-sm uppercase tracking-wide text-ink">
                          {t('clubFinances.bertSays')}</PixelText>
                        <Text className="mt-1 text-sm leading-5 text-ink">
                          {viewModel.facilities.activeProject === undefined
                            ? 'Fan Shops earn every week and Stadium Stands boost home-match income. You can build up to 3 of each; every other facility is limited to 1.'
                            : `The works crew is busy with ${viewModel.facilities.activeProject.name}. Wait until construction finishes, then build another Fan Shop or Stadium Stand. You can build up to 3 of each; every other facility is limited to 1.`}
                        </Text>
                      </View>
                    ) : null}
                  <View
                    ref={entry.type === 'coaching-office' ? coachingOfficeBuildTargetRef : undefined}
                    collapsable={entry.type === 'coaching-office' ? false : undefined}
                    className={guideFocus === 'coaching-office' && entry.type === 'coaching-office'
                      ? 'relative mt-20 w-[48%]'
                      : 'relative w-[48%]'}
                    onLayout={entry.type === 'coaching-office' ? scrollToCoachingOffice : undefined}
                  >
                    {/* The inbox sends you here to build a Coaching Office, and the
                        viewport already lands on it — but nothing said which of
                        the eight cards to press. It wears the same gold tutorial
                        glow as the Train button and the same arrow. */}
                    {guideFocus === 'coaching-office' && entry.type === 'coaching-office' && !selected ? (
                      <TutorialTapCue
                        label="Tap here"
                        detail="Coaching Office"
                        style={{
                          left: '50%',
                          marginLeft: -TUTORIAL_TAP_CUE_WIDTH / 2,
                          top: -82,
                        }}
                      />
                    ) : null}
                    {/* Selecting the card arms the build, but the grid it drops
                        onto is off the top of the screen — the tap looked like
                        it did nothing. Points back up at the grid, and gets out
                        of the way on a tap for anyone who already knows. */}
                    {showCoachingOfficeScrollCue && entry.type === 'coaching-office' && selected ? (
                      <TutorialTapCue
                        label="Scroll up"
                        detail="Then tap a + square"
                        direction="up"
                        style={{
                          left: '50%',
                          marginLeft: -TUTORIAL_TAP_CUE_WIDTH / 2,
                          top: -92,
                        }}
                        onDismiss={dismissCoachingOfficeScrollCue}
                      />
                    ) : null}
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
                      accessibilityLabel={`${entry.name}. ${entry.builtCount} of ${entry.buildLimit} built. ${entry.effectLabel}. ${entry.width} by ${entry.height} footprint. Build time ${entry.buildWeeks} week${entry.buildWeeks === 1 ? '' : 's'}.${adjacencyAccessibility} ${guideAllowsType ? '' : 'Build the Training Pitch first. '}${entry.available
                        ? `Build cost ${formatCurrency(entry.buildCost)}. ${formatCurrency(entry.weeklyUpkeep)} per week upkeep.${entry.blockedReason
                          ? ` ${entry.blockedReason}`
                          : !entry.affordable && entry.affordabilityShortfall > 0
                            ? ` Need ${formatCurrency(entry.affordabilityShortfall)} more.`
                            : ''}`
                        : `Locked.${entry.blockedReason ? ` ${entry.blockedReason}` : ''}`}`}
                      accessibilityState={{ disabled: !entryEnabled, selected }}
                      disabled={!entryEnabled && !openingPitchChoiceBlocked}
                      onPress={() => {
                        if (openingPitchChoiceBlocked) {
                          setBuildMenuReminder("Let's build the Training Pitch first. Once it is underway, the other facilities will be available.");
                          return;
                        }
                        setBuildMenuReminder(null);
                        setSelectedBuildType(selected ? null : entry.type);
                        setSelectedBuildingId(null);
                        setRelocatingBuildingId(null);
                      }}
                      className={selected
                        ? 'min-h-36 w-full border-2 border-b-4 border-blue-dark bg-blue-light/30 p-2'
                        : (guideFocus === 'coaching-office' && entry.type === 'coaching-office')
                          || guidedIncome
                          ? 'min-h-36 w-full border-2 border-b-4 border-gold-dark bg-gold-light/25 p-2'
                          : entryEnabled
                            ? 'min-h-36 w-full border-2 border-b-4 border-ink bg-white p-2'
                            : 'min-h-36 w-full border-2 border-ink/20 bg-ink/5 p-2'}
                      // Lit even when the club cannot afford it yet: the point
                      // of the highlight is which buildings earn, and a shop
                      // the manager has to save up for is still the answer.
                      style={(guideFocus === 'coaching-office' && entry.type === 'coaching-office')
                        || guidedIncome
                        ? styles.guidedFacilityGlow
                        : undefined}
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
                        ? 'mt-1 font-mono text-sm text-ink/70'
                        : 'mt-1 font-mono text-sm text-ink/30'}>
                        {entry.available
                          ? `${entry.builtCount}/${entry.buildLimit} built · ${entry.width}x${entry.height} · ${formatCurrency(entry.buildCost)} · ${entry.buildWeeks}W · ${formatCurrency(entry.weeklyUpkeep)}/wk`
                          : 'Locked'}
                      </Text>
                      {adjacencyGuidance !== undefined && entry.available ? (
                        <View className="mt-2 border-t border-pitch-dark/25 pt-2">
                          <PixelText className="text-xs uppercase tracking-wide text-pitch-ink">
                            {t('clubFinances.knownCombo')}</PixelText>
                          <Text className="mt-1 text-xs leading-4 text-ink/65">
                            {adjacencyGuidance}
                          </Text>
                        </View>
                      ) : null}
                      {entry.blockedReason ? (
                        <Text className="mt-1 text-xs font-bold text-red-dark">{entry.blockedReason}</Text>
                      ) : null}
                      {entry.available && !entry.affordable && entry.affordabilityShortfall > 0 ? (
                        <PixelText className="mt-1 text-xs uppercase text-red-dark">
                          Need {formatCurrency(entry.affordabilityShortfall)} more
                        </PixelText>
                      ) : null}
                    </Pressable>
                  </View>
                  </Fragment>
                );
              })}
            </View>
          </View>

          <View className="mt-4 border-t-2 border-ink/20 pt-3">
            <PixelText className="text-sm uppercase tracking-wide text-ink/70">{t('clubFinances.facilityPairBonuses')}</PixelText>
            {viewModel.facilities.discoveredAdjacencies.length === 0 ? (
              <Text className="mt-2 text-sm leading-4 text-ink/70">
                {t('clubFinances.noPairingsDiscoveredYet')}</Text>
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
                        <Text className="mt-1 text-sm leading-4 text-ink/70">
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
  const t = useCopy();
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
              <PixelText className="text-base uppercase text-ink">{t('clubFinances.trainingGroundLevel1')}</PixelText>
              <Text className="mt-2 text-sm leading-4 text-ink/70">
                {t('clubFinances.aProperWeeklyPractice')}</Text>
            </View>
          </View>
          <View className="mt-3 flex-row gap-2">
            <Metric label="Build cost" value={formatCurrency(facility.cost)} tone="negative" />
            <Metric label="Weekly return" value={`+${facility.weeklyTrainingPoints} TP`} tone="positive" />
          </View>
          <PixelText className="mt-3 text-sm uppercase tracking-wide text-ink/70">
            M1 offer: {formatCurrency(facility.cost)} cost · +{facility.weeklyTrainingPoints} TP every week
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
                accessibilityLabel={t('clubFinances.a11y.buildTheTrainingGroundFor8000')}
                onPress={onBuildTrainingGround}
                disabled={!facility.affordable}
              />
            </View>
          ) : null}
          {facility.underConstruction ? (
            <View className="mt-3 border-2 border-b-4 border-amber-800 bg-amber-100 p-3">
              <Text className="text-center font-pixel text-base uppercase text-amber-900">{t('clubFinances.sportsFacilityInConstruction')}</Text>
              <Text className="mt-2 text-center text-sm text-ink/65">{t('clubFinances.benefitsStartWhenThe')}</Text>
            </View>
          ) : null}
          {!facility.built && !facility.underConstruction && !facility.affordable ? (
            <PixelText className="mt-2 text-center text-sm uppercase tracking-wide text-red-dark">
              {t('clubFinances.insufficientBalance')}</PixelText>
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

/**
 * The same gold the Train button wears during the first-training guide. Gold is
 * the tutorial voice here, not a hero accent — it is only ever on screen while
 * Bert is asking for a specific tap.
 */
const styles = StyleSheet.create({
  guidedFacilityGlow: {
    boxShadow: '0 0 12px 4px rgba(237, 181, 74, 0.9)',
    shadowColor: '#edb54a',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 9,
    elevation: 10,
  },
});
