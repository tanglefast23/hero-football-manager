import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import {
  AccessibilityInfo,
  findNodeHandle,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { AssistantGuideFocus } from '../../content';
import {
  ActionButton,
  Metric,
  PaperPanel,
  SectionLabel,
  StatusChip,
  formatCompactNumber,
  formatCurrency,
} from '../components/Scorecard';
import { EmptyDocket } from '../components/EmptyDocket';
import { FacilitySprite } from '../components/FacilitySprite';
import { ClubCrest } from '../components/ClubCrest';
import type {
  ClubFacilityBuildingViewModel,
  CoachSpeechViewModel,
  CoachStaffMemberViewModel,
  ClubFacilityGridViewModel,
  ClubFinancesViewModel,
  ClubLoanViewModel,
  ClubOfficeTab,
  ClubSponsorshipViewModel,
  FacilityTypeViewModel,
  SponsorOfferViewModel,
  SponsorSlotViewModel,
  SponsorWeeklyChallengeKindViewModel,
  TrainingGroundDecisionViewModel,
  IncomeGenerationViewModel,
  TrainingPointIncomeViewModel,
} from '../models';
import { TutorialTapCue } from '../TutorialTapCue';
import {
  TUTORIAL_TAP_CUE_WIDTH,
  type TutorialAnchorLayout,
} from '../tutorial-cue-position';
import { useGuideAnchor } from '../use-guide-anchor';
import { ManagementSprite } from '../components/ManagementSprite';
import { facilityBenefit } from '../facility-benefit';
import {
  facilityAdjacencyLabel,
  facilityAdjacencyPresentation,
} from '../facility-adjacency';
import { SfxPressable as Pressable } from '../components/SfxPressable';
import {
  FacilityPlacementConfirmation,
  type FacilityPlacement,
} from '../FacilityPlacementConfirmation';
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
import {
  GuidanceDoubleFlash,
  type GuidanceNudgeTarget,
} from '../GuidanceDoubleFlash';
import { useLayoutMode } from '../layout/use-layout-mode';
import { PixelText } from '../components/PixelText';
import { formatThousandsForCopy, useCopy, type CopyFn } from '../../i18n';

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
  // Keep browser focus from racing the measured ScrollView reveal. Native
  // needs the accessibility handle instead; each branch fails soft when its
  // host capability is absent.
  if (Platform.OS === 'web') {
    (
      target as unknown as {
        focus?: (options?: { preventScroll?: boolean }) => void;
      }
    ).focus?.({ preventScroll: true });
    return;
  }
  const handle = findNodeHandle(target);
  if (handle !== null) AccessibilityInfo.setAccessibilityFocus(handle);
}

/**
 * "Building · 2 weeks remaining" for a facility that is not open yet.
 *
 * One helper because the register and the selected-facility card print the same
 * sentence, and the singular is a plural form in the catalog rather than a
 * ternary in the source — English is the only language where dropping an "s"
 * is the whole rule.
 */
function projectWeeksRemaining(
  t: CopyFn,
  status: ClubFacilityBuildingViewModel['status'],
  // Optional on the view model, but only ever absent while the building is
  // operational — which is the branch that never reaches here.
  weeksRemaining: number | undefined,
): string {
  const weeks = weeksRemaining ?? 0;
  return t(
    status === 'construction'
      ? 'clubFinances.buildingWeeksRemaining'
      : status === 'closed'
        ? 'clubFinances.closedWeeksRemaining'
        : 'clubFinances.upgradingWeeksRemaining',
    { n: weeks, count: weeks },
  );
}

/** Which board each section belongs to. Facility first — it is the one the desk sends you to. */
const CLUB_OFFICE_TABS = (t: CopyFn): readonly ScreenTab<ClubOfficeTab>[] => [
  {
    id: 'facility',
    label: t('clubFinances.tabFacility'),
    accessibilityLabel: t('clubFinances.a11y.facilityBoard'),
  },
  {
    id: 'staff',
    label: t('clubFinances.tabStaff'),
    accessibilityLabel: t('clubFinances.a11y.staffBoard'),
  },
  {
    id: 'finances',
    label: t('clubFinances.tabFinances'),
    accessibilityLabel: t('clubFinances.a11y.financesBoard'),
  },
];

export interface ClubFinancesScreenProps {
  viewModel: ClubFinancesViewModel;
  /** The board on show. Owned above so the inbox and Bert can both open one. */
  activeTab: ClubOfficeTab;
  onSelectTab: (tab: ClubOfficeTab) => void;
  onOpenLedgerLine?: (ledgerLineId: string) => void;
  onBuildTrainingGround: () => void;
  onBuildFacility?: (type: FacilityTypeViewModel, x: number, y: number) => void;
  /** The only new facility this week's required desk job permits. */
  requiredBuildType?: FacilityTypeViewModel;
  guidanceNudgeTarget?: GuidanceNudgeTarget;
  guidanceNudgeToken?: number;
  /** Starts the two-card income flash after Bert finishes the loan advice. */
  incomeFacilitiesFlashToken?: number;
  /** Explains a refused catalog choice through Bert instead of a silent disabled card. */
  onRequiredBuildTypeBlocked?: (required: FacilityTypeViewModel) => void;
  onUpgradeFacility?: (buildingId: string) => void;
  onRelocateFacility?: (buildingId: string, x: number, y: number) => void;
  onCloseFacility?: (buildingId: string) => void;
  onOpenCoachMarket?: () => void;
  onDismissCoach?: (role: 'HEAD' | 'ASSISTANT') => void;
  /** Buys the head coach's half-time speech with every training point held. */
  onTrainCoachSpeech?: () => void;
  onReviewSponsorOffer?: (
    offer: SponsorOfferViewModel,
    slot: SponsorSlotViewModel,
  ) => void;
  onChooseSponsorWeeklyChallenge?: (
    kind: SponsorWeeklyChallengeKindViewModel,
  ) => void;
  guideTrainingGround?: boolean;
  guideFocus?: AssistantGuideFocus;
  onLoanGuideAnchorChange?: (anchor: TutorialAnchorLayout | null) => void;
  onFacilityAdjacencyGuideAnchorChange?: (
    anchor: TutorialAnchorLayout | null,
  ) => void;
  /** The Train Coach button, lit while Bert explains the half-time speech. */
  onCoachSpeechGuideAnchorChange?: (
    anchor: TutorialAnchorLayout | null,
  ) => void;
  reduceMotion?: boolean;
  /** Bumped after the signing modal is gone so the replacement desk receives focus. */
  focusSponsorSummaryToken?: number;
  /** Fixed capture offset for deterministic store-media scenes. */
  initialScrollY?: number;
}

export function ClubFinancesScreen({
  viewModel,
  activeTab,
  onSelectTab,
  onOpenLedgerLine,
  onBuildTrainingGround,
  onBuildFacility,
  requiredBuildType,
  guidanceNudgeTarget,
  guidanceNudgeToken,
  incomeFacilitiesFlashToken,
  onRequiredBuildTypeBlocked,
  onUpgradeFacility,
  onRelocateFacility,
  onCloseFacility,
  onOpenCoachMarket,
  onDismissCoach,
  onTrainCoachSpeech,
  onReviewSponsorOffer,
  onChooseSponsorWeeklyChallenge,
  guideTrainingGround = false,
  guideFocus,
  onLoanGuideAnchorChange,
  onFacilityAdjacencyGuideAnchorChange,
  onCoachSpeechGuideAnchorChange,
  reduceMotion = false,
  focusSponsorSummaryToken,
  initialScrollY,
}: ClubFinancesScreenProps) {
  const t = useCopy();
  const facility = viewModel.trainingGround;
  const facilities = viewModel.facilities;
  const scrollViewportRef = useRef<View>(null);
  const scrollRef = useRef<ScrollView>(null);
  const groundsRef = useRef<View>(null);
  const trainingGroundRef = useRef<View>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const sponsorDeskTargetRef = useRef<View>(null);
  const handledSponsorFocusTokenRef = useRef<number | undefined>(undefined);
  const sponsorGuideHandledRef = useRef<string | null>(null);
  const {
    anchorRef: loanGuideAnchorRef,
    scheduleMeasurement: scheduleLoanGuideAnchorMeasurement,
  } = useGuideAnchor(guideFocus === 'emergency-loan', onLoanGuideAnchorChange);
  const {
    anchorRef: facilityAdjacencyGuideAnchorRef,
    scheduleMeasurement: scheduleFacilityAdjacencyGuideAnchorMeasurement,
  } = useGuideAnchor(
    guideFocus === 'facility-adjacency',
    onFacilityAdjacencyGuideAnchorChange,
  );
  const {
    anchorRef: coachSpeechGuideAnchorRef,
    scheduleMeasurement: scheduleCoachSpeechGuideAnchorMeasurement,
  } = useGuideAnchor(
    guideFocus === 'coach-speech',
    onCoachSpeechGuideAnchorChange,
  );
  const facilityGuideScrollFrameRef = useRef<number | null>(null);
  const facilityGuideScrolledPhaseRef = useRef<GuidedFirstFacilityPhase | null>(
    null,
  );
  const facilityGuideBuildTargetRef = useRef<View>(null);
  const facilityGuideGridTargetRef = useRef<View>(null);
  const facilityPlacementTargetRef = useRef<View>(null);
  const facilityPlacementFocusRef = useRef<View>(null);
  const facilityPlacementScrollFrameRef = useRef<number | null>(null);
  const facilityDetailRef = useRef<View>(null);
  const facilityDetailScrollFrameRef = useRef<number | null>(null);
  const latestScrollOffsetRef = useRef(0);
  const initialScrollAppliedRef = useRef(false);
  const [selectedBuildType, setSelectedBuildType] =
    useState<FacilityTypeViewModel | null>(null);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(
    null,
  );
  const [relocatingBuildingId, setRelocatingBuildingId] = useState<
    string | null
  >(null);
  const [previewCell, setPreviewCell] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [pendingPlacement, setPendingPlacement] =
    useState<FacilityPlacement | null>(null);
  /** Why the last tapped square could not take the building; null while nothing has been refused. */
  const [placementRejection, setPlacementRejection] = useState<string | null>(
    null,
  );
  const [buildMenuReminder, setBuildMenuReminder] = useState<string | null>(
    null,
  );
  const [facilityGridWidth, setFacilityGridWidth] = useState(0);
  const [facilityPlacementHelperVisible, setFacilityPlacementHelperVisible] =
    useState(false);
  const [selectedSponsorSlot, setSelectedSponsorSlot] = useState(0);
  const selectedBuilding = facilities.buildings.find(
    (building) => building.id === selectedBuildingId,
  );
  const relocatingBuilding = facilities.buildings.find(
    (building) => building.id === relocatingBuildingId,
  );
  const selectedBuildEntry =
    selectedBuildType === null
      ? undefined
      : facilities.catalog.find((entry) => entry.type === selectedBuildType);

  const placementActive =
    selectedBuildType !== null || relocatingBuildingId !== null;
  const guideIncomeFacilities = guideFocus === 'income-facilities';
  const guideGrounds =
    guideFocus === 'coaching-office' ||
    guideFocus === 'facility-grid' ||
    guideFocus === 'facility-upgrade';
  const guidedFirstFacility = guideFocus === 'facility-grid';
  const guidedFacilityPhase = guidedFirstFacilityPhase(selectedBuildType);
  const activeFootprint = relocatingBuilding
    ? { width: relocatingBuilding.width, height: relocatingBuilding.height }
    : selectedBuildEntry
      ? { width: selectedBuildEntry.width, height: selectedBuildEntry.height }
      : null;
  const activeLabel =
    relocatingBuilding?.name ?? selectedBuildEntry?.name ?? '';
  const placementType = relocatingBuilding?.type ?? selectedBuildEntry?.type;
  const placementLevel = relocatingBuilding?.level ?? 1;

  const canPlaceAt = useCallback(
    (x: number, y: number): boolean => {
      if (activeFootprint === null) return false;
      if (x + activeFootprint.width > facilities.width) return false;
      if (y + activeFootprint.height > facilities.height) return false;
      return !facilities.buildings.some((building) => {
        if (building.id === relocatingBuildingId) return false;
        return (
          x < building.x + building.width &&
          building.x < x + activeFootprint.width &&
          y < building.y + building.height &&
          building.y < y + activeFootprint.height
        );
      });
    },
    [
      activeFootprint,
      facilities.buildings,
      facilities.height,
      facilities.width,
      relocatingBuildingId,
    ],
  );

  const cellIsOccupied = useCallback(
    (x: number, y: number): boolean =>
      facilities.buildings.some(
        (building) =>
          x >= building.x &&
          x < building.x + building.width &&
          y >= building.y &&
          y < building.y + building.height,
      ),
    [facilities.buildings],
  );

  const cancelPlacement = useCallback(() => {
    setSelectedBuildType(null);
    setRelocatingBuildingId(null);
    setPreviewCell(null);
    setPlacementRejection(null);
    setBuildMenuReminder(null);
    setFacilityPlacementHelperVisible(false);
  }, []);

  const dismissFacilityPlacementHelper = useCallback(() => {
    setFacilityPlacementHelperVisible(false);
  }, []);

  const handleGridCell = useCallback(
    (x: number, y: number) => {
      if (
        guidedFirstFacility &&
        !guidedFirstFacilityAllowsPlacement(selectedBuildType, x, y)
      )
        return;
      // A square that cannot take the building says so. It stays tappable rather
      // than disabled so the footprint preview still works, which means the tap
      // has to answer — docs/08: nothing refuses silently.
      if (!canPlaceAt(x, y)) {
        setPlacementRejection(
          cellIsOccupied(x, y)
            ? t('clubFinances.squareTaken')
            : t('clubFinances.squareDoesNotFit'),
        );
        return;
      }
      setPlacementRejection(null);
      // Either order spends money the moment it is approved, so the tap only ever
      // proposes the square — the confirmation is where the club is committed.
      if (relocatingBuilding !== undefined) {
        setPendingPlacement({
          kind: 'move',
          building: relocatingBuilding,
          x,
          y,
        });
        setPreviewCell(null);
        return;
      }
      if (selectedBuildType !== null) {
        const catalog = facilities.catalog.find(
          (entry) => entry.type === selectedBuildType,
        );
        if (catalog === undefined) return;
        setPendingPlacement({ kind: 'build', catalog, x, y });
        setPreviewCell(null);
      }
    },
    [
      canPlaceAt,
      cellIsOccupied,
      facilities.catalog,
      guidedFirstFacility,
      relocatingBuilding,
      selectedBuildType,
      t,
    ],
  );

  const confirmPendingPlacement = useCallback(() => {
    if (pendingPlacement === null) return;
    if (pendingPlacement.kind === 'move') {
      onRelocateFacility?.(
        pendingPlacement.building.id,
        pendingPlacement.x,
        pendingPlacement.y,
      );
      setPendingPlacement(null);
      setRelocatingBuildingId(null);
      return;
    }
    onBuildFacility?.(
      pendingPlacement.catalog.type,
      pendingPlacement.x,
      pendingPlacement.y,
    );
    setPendingPlacement(null);
    setSelectedBuildType(null);
    setFacilityPlacementHelperVisible(false);
  }, [onBuildFacility, onRelocateFacility, pendingPlacement]);

  const scrollFacilityGuideTargetIntoView = useCallback(
    (phase: GuidedFirstFacilityPhase) => {
      if (
        !guidedFirstFacility ||
        facilityGuideScrolledPhaseRef.current === phase
      )
        return;
      const viewport = scrollViewportRef.current;
      const target =
        phase === 'build-menu'
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
              latestScrollOffsetRef.current +
                measuredTargetY -
                viewportY -
                FACILITY_GUIDE_TARGET_TOP,
            );
            scrollRef.current?.scrollTo({
              y: targetY,
              animated: !reduceMotion,
            });
            facilityGuideScrolledPhaseRef.current = phase;
          });
        });
      });
    },
    [guidedFirstFacility, reduceMotion],
  );

  const scrollToTrainingGround = useCallback(() => {
    if (!guideTrainingGround) return;
    if (scrollFrameRef.current !== null)
      cancelAnimationFrame(scrollFrameRef.current);
    scrollFrameRef.current = requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      scrollToTarget(
        scrollRef,
        scrollViewportRef,
        trainingGroundRef,
        latestScrollOffsetRef.current,
      );
    });
  }, [guideTrainingGround]);

  useEffect(() => {
    scrollToTrainingGround();
    return () => {
      if (scrollFrameRef.current !== null)
        cancelAnimationFrame(scrollFrameRef.current);
    };
  }, [scrollToTrainingGround]);

  useEffect(() => {
    if (guideFocus !== 'facility-grid') return;
    setSelectedBuildType(null);
    setSelectedBuildingId(null);
    setRelocatingBuildingId(null);
    setPreviewCell(null);
    setFacilityPlacementHelperVisible(false);
    facilityGuideScrolledPhaseRef.current = null;
  }, [guideFocus]);

  useEffect(() => {
    if (!guidedFirstFacility) {
      facilityGuideScrolledPhaseRef.current = null;
      return;
    }
    scrollFacilityGuideTargetIntoView(guidedFacilityPhase);
  }, [
    guidedFacilityPhase,
    guidedFirstFacility,
    scrollFacilityGuideTargetIntoView,
  ]);

  useEffect(
    () => () => {
      if (facilityGuideScrollFrameRef.current !== null) {
        cancelAnimationFrame(facilityGuideScrollFrameRef.current);
      }
      if (facilityPlacementScrollFrameRef.current !== null) {
        cancelAnimationFrame(facilityPlacementScrollFrameRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (guideFocus !== 'facility-adjacency') return;
    setSelectedBuildingId(null);
    setSelectedBuildType(null);
    if (facilityGuideScrollFrameRef.current !== null) {
      cancelAnimationFrame(facilityGuideScrollFrameRef.current);
    }
    facilityGuideScrollFrameRef.current = requestAnimationFrame(() => {
      facilityGuideScrollFrameRef.current = null;
      scrollToTarget(
        scrollRef,
        scrollViewportRef,
        facilityAdjacencyGuideAnchorRef,
        latestScrollOffsetRef.current,
        12,
        !reduceMotion,
      );
      focusGuideTarget(facilityAdjacencyGuideAnchorRef.current);
    });
  }, [guideFocus, reduceMotion]);

  useEffect(() => {
    if (!guideGrounds) return;
    if (guideFocus === 'coaching-office') {
      setSelectedBuildingId(null);
      return;
    } else if (guideFocus === 'facility-grid') {
      return;
    } else if (
      guideFocus === 'facility-upgrade' &&
      facilities.buildings.length > 0
    ) {
      setSelectedBuildingId(
        firstGuidedFacilityUpgradeId(facilities.buildings) ?? null,
      );
      setSelectedBuildType(null);
    }
    scrollToTarget(
      scrollRef,
      scrollViewportRef,
      groundsRef,
      latestScrollOffsetRef.current,
    );
  }, [facilities.buildings, guideFocus, guideGrounds, reduceMotion]);

  useEffect(() => {
    const slots = viewModel.sponsorship?.slots ?? [];
    if (slots.length === 0) {
      setSelectedSponsorSlot(0);
      return;
    }
    if (!slots.some((slot) => slot.slot === selectedSponsorSlot)) {
      setSelectedSponsorSlot(slots[0].slot);
    }
  }, [selectedSponsorSlot, viewModel.sponsorship?.slots]);

  const revealSponsorGuideTarget = useCallback(() => {
    if (
      activeTab !== 'finances' ||
      (guideFocus !== 'sponsor-desk' && guideFocus !== 'sponsor-summary') ||
      sponsorGuideHandledRef.current === guideFocus
    )
      return;
    const scrollTarget = sponsorDeskTargetRef.current;
    const focusTarget = sponsorDeskTargetRef.current;
    if (scrollTarget === null || focusTarget === null) return;
    sponsorGuideHandledRef.current = guideFocus;
    requestAnimationFrame(() => {
      scrollToTarget(
        scrollRef,
        scrollViewportRef,
        sponsorDeskTargetRef,
        latestScrollOffsetRef.current,
        12,
        !reduceMotion,
      );
      focusGuideTarget(focusTarget);
    });
  }, [activeTab, guideFocus, reduceMotion]);

  useEffect(() => {
    if (guideFocus !== 'sponsor-desk' && guideFocus !== 'sponsor-summary') {
      sponsorGuideHandledRef.current = null;
      return;
    }
    revealSponsorGuideTarget();
  }, [guideFocus, revealSponsorGuideTarget]);

  useEffect(() => {
    if (
      focusSponsorSummaryToken === undefined ||
      handledSponsorFocusTokenRef.current === focusSponsorSummaryToken ||
      activeTab !== 'finances' ||
      sponsorDeskTargetRef.current === null
    )
      return;
    handledSponsorFocusTokenRef.current = focusSponsorSummaryToken;
    const nextSlot = viewModel.sponsorship?.slots.find(
      (slot) => slot.provisional && slot.offers.length > 0,
    );
    if (nextSlot !== undefined) setSelectedSponsorSlot(nextSlot.slot);
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
  }, [
    activeTab,
    focusSponsorSummaryToken,
    reduceMotion,
    viewModel.sponsorship,
  ]);

  const onTrainingGroundLayout = useCallback(() => {
    scrollToTrainingGround();
  }, [scrollToTrainingGround]);

  const layoutMode = useLayoutMode();

  /**
   * Every build choice briefly marks the grid and moves the viewport to it.
   * This stays consistent across phone, tablet, and desktop layouts: even when
   * part of the grid is already visible, the chosen placement surface becomes
   * the one clear next action.
   */
  const revealFacilityPlacement = useCallback(() => {
    setFacilityPlacementHelperVisible(true);
    // The opening lesson already owns the viewport and accessibility focus.
    // Placement mode still lights legal + squares, so it needs no extra scroll.
    if (guidedFirstFacility) return;
    if (facilityPlacementTargetRef.current === null) return;
    if (facilityPlacementScrollFrameRef.current !== null) {
      cancelAnimationFrame(facilityPlacementScrollFrameRef.current);
    }
    facilityPlacementScrollFrameRef.current = requestAnimationFrame(() => {
      facilityPlacementScrollFrameRef.current = null;
      scrollToTarget(
        scrollRef,
        scrollViewportRef,
        facilityPlacementTargetRef,
        latestScrollOffsetRef.current,
        12,
        !reduceMotion,
      );
      focusGuideTarget(facilityPlacementFocusRef.current);
    });
  }, [guidedFirstFacility, reduceMotion]);

  /**
   * Tapping a placed building opens its card below the grid — on a phone that
   * card lands off-screen, so the tap looked like it did nothing. Two frames,
   * not one: the card only mounts on the render that the tap causes, so its ref
   * is still null when the first frame runs.
   */
  const revealFacilityDetail = useCallback(() => {
    // The opening lesson drives the viewport itself; do not fight it.
    if (guidedFirstFacility) return;
    if (facilityDetailScrollFrameRef.current !== null) {
      cancelAnimationFrame(facilityDetailScrollFrameRef.current);
    }
    facilityDetailScrollFrameRef.current = requestAnimationFrame(() => {
      facilityDetailScrollFrameRef.current = requestAnimationFrame(() => {
        facilityDetailScrollFrameRef.current = null;
        scrollToTarget(
          scrollRef,
          scrollViewportRef,
          facilityDetailRef,
          latestScrollOffsetRef.current,
          12,
          !reduceMotion,
        );
      });
    });
  }, [guidedFirstFacility, reduceMotion]);

  useEffect(
    () => () => {
      if (facilityDetailScrollFrameRef.current !== null) {
        cancelAnimationFrame(facilityDetailScrollFrameRef.current);
      }
    },
    [],
  );

  const loanSection: FlowSection[] =
    viewModel.loan === undefined
      ? []
      : [
          {
            key: 'loan',
            weight: 5,
            node: (
              <EmergencyLoanSection
                loan={viewModel.loan}
                guided={guideFocus === 'emergency-loan'}
                guideAnchorRef={loanGuideAnchorRef}
                onGuideAnchorLayout={scheduleLoanGuideAnchorMeasurement}
              />
            ),
          },
        ];
  const guideLoanFirst = guideFocus === 'emergency-loan';
  const financeSections: FlowSection[] = [
    // Keep the card visible for the joined loan talk. Its usual position remains
    // directly below Cash Position whenever Bert is not explaining this loan.
    ...(guideLoanFirst ? loanSection : []),
    {
      key: 'cash-position',
      weight: 6,
      node: <CashPositionSection viewModel={viewModel} />,
    },
    ...(!guideLoanFirst ? loanSection : []),
    ...(viewModel.sponsorship === undefined
      ? []
      : [
          {
            key: 'sponsorship',
            weight: viewModel.sponsorship.managed
              ? 8 +
                viewModel.sponsorship.slots.reduce(
                  (sum, slot) => sum + slot.offers.length * 4,
                  0,
                )
              : 5,
            node: (
              <SponsorBusinessSection
                sponsorship={viewModel.sponsorship}
                selectedSlot={selectedSponsorSlot}
                onSelectSlot={setSelectedSponsorSlot}
                onReviewOffer={onReviewSponsorOffer}
                onChooseWeeklyChallenge={onChooseSponsorWeeklyChallenge}
                guideFocus={guideFocus}
                sponsorDeskTargetRef={sponsorDeskTargetRef}
                onGuideTargetLayout={revealSponsorGuideTarget}
              />
            ),
          },
        ]),
    {
      key: 'itemized',
      weight: 2 + viewModel.ledger.length,
      node: (
        <ItemizedStatementSection
          viewModel={viewModel}
          onOpenLedgerLine={onOpenLedgerLine}
        />
      ),
    },
    ...(viewModel.recentTransactions.length > 0
      ? [
          {
            key: 'transactions',
            weight: 2 + viewModel.recentTransactions.length,
            node: <RecentTransactionsSection viewModel={viewModel} />,
          },
        ]
      : []),
    // Opens the second column on a wide screen: the statement on the left is
    // the week that just happened, and the manager reads across to where next
    // week's money and TP will come from. The break is asked for rather than
    // estimated so a long ledger cannot push this section down the page.
    {
      key: 'income-generation',
      weight: 3 + viewModel.incomeGeneration.rows.length,
      startsColumn: true,
      node: (
        <IncomeGenerationSection
          income={viewModel.incomeGeneration}
          compact={layoutMode !== 'twoColumn'}
        />
      ),
    },
    // The mirror of the section above it: that one is where next week's money
    // comes from, this is where next week's TP comes from.
    {
      key: 'training-points',
      weight: 3 + viewModel.trainingPointIncome.rows.length,
      node: (
        <TrainingPointIncomeSection income={viewModel.trainingPointIncome} />
      ),
    },
  ];

  // One section per coach, so a wide window puts the head coach and the
  // assistant side by side — the pair is a comparison, and a single 1180pt-wide
  // card was the whole board. The board label rides in the header instead of
  // the first card, or the right column would start 44pt lower than the left.
  const staffSections: FlowSection[] =
    viewModel.coachingStaff.length === 0
      ? [
          {
            key: 'coaching-staff',
            weight: 4,
            node: (
              <CoachingVacancySection onOpenCoachMarket={onOpenCoachMarket} />
            ),
          },
        ]
      : [
          ...viewModel.coachingStaff.map((coach) => ({
            key: `coach-${coach.role}`,
            weight: 12,
            node: (
              <CoachCardSection
                coach={coach}
                coachSpeech={
                  coach.role === 'HEAD' ? viewModel.coachSpeech : undefined
                }
                onDismissCoach={onDismissCoach}
                onTrainCoachSpeech={onTrainCoachSpeech}
                trainCoachRef={
                  coach.role === 'HEAD' ? coachSpeechGuideAnchorRef : undefined
                }
              />
            ),
          })),
          ...(onOpenCoachMarket === undefined
            ? []
            : [
                {
                  key: 'coach-market',
                  weight: 2,
                  node: (
                    <ActionButton
                      label={t('clubFinances.reviewCoachMarket')}
                      accessibilityLabel={t(
                        'clubFinances.a11y.reviewTheCoachMarket',
                      )}
                      onPress={onOpenCoachMarket}
                    />
                  ),
                },
              ]),
        ];

  const facilitySections: FlowSection[] = [
    {
      key: 'build-menu',
      weight: 4 + viewModel.facilities.catalog.length,
      node: (
        <BuildMenuSection
          viewModel={viewModel}
          guideFocus={guideFocus}
          guidedFirstFacility={guidedFirstFacility}
          guidedFacilityPhase={guidedFacilityPhase}
          selectedBuildType={selectedBuildType}
          setSelectedBuildType={setSelectedBuildType}
          setSelectedBuildingId={setSelectedBuildingId}
          setRelocatingBuildingId={setRelocatingBuildingId}
          buildMenuReminder={buildMenuReminder}
          setBuildMenuReminder={setBuildMenuReminder}
          requiredBuildType={requiredBuildType}
          guidanceNudgeTarget={guidanceNudgeTarget}
          guidanceNudgeToken={guidanceNudgeToken}
          incomeFacilitiesFlashToken={incomeFacilitiesFlashToken}
          reduceMotion={reduceMotion}
          onRequiredBuildTypeBlocked={onRequiredBuildTypeBlocked}
          facilityGuideBuildTargetRef={facilityGuideBuildTargetRef}
          scrollFacilityGuideTargetIntoView={scrollFacilityGuideTargetIntoView}
          revealFacilityPlacement={revealFacilityPlacement}
          guideIncomeFacilities={guideIncomeFacilities}
        />
      ),
    },
    // Opens the second column on a wide screen. The build menu comes first on
    // a phone and owns the left column on desktop; the grounds follow below or
    // beside it. Asked for rather than estimated so their order cannot drift.
    {
      key: 'grounds',
      weight: 10 + viewModel.facilities.height * 2,
      startsColumn: true,
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
          facilityDetailRef={facilityDetailRef}
          revealFacilityDetail={revealFacilityDetail}
          relocatingBuildingId={relocatingBuildingId}
          setRelocatingBuildingId={setRelocatingBuildingId}
          previewCell={previewCell}
          setPreviewCell={setPreviewCell}
          placementRejection={placementRejection}
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
          facilityPlacementTargetRef={facilityPlacementTargetRef}
          facilityPlacementFocusRef={facilityPlacementFocusRef}
          showBuildPlacementHelper={
            selectedBuildType !== null && facilityPlacementHelperVisible
          }
          dismissFacilityPlacementHelper={dismissFacilityPlacementHelper}
          scrollFacilityGuideTargetIntoView={scrollFacilityGuideTargetIntoView}
        />
      ),
    },
    {
      key: 'facility-pair-bonuses',
      weight: 3 + 3 * viewModel.facilities.discoveredAdjacencies.length,
      node: (
        <FacilityPairBonusesSection
          facilities={viewModel.facilities}
          guideAnchorRef={facilityAdjacencyGuideAnchorRef}
          onGuideAnchorLayout={scheduleFacilityAdjacencyGuideAnchorMeasurement}
        />
      ),
    },
    ...(viewModel.facilities.buildings.length === 0
      ? []
      : [
          {
            key: 'facility-register',
            weight: 3 + 2 * viewModel.facilities.buildings.length,
            node: <FacilityRegisterSection facilities={viewModel.facilities} />,
          },
        ]),
    ...(viewModel.legacyTrainingGroundVisible
      ? [
          {
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
          },
        ]
      : []),
  ];

  const sections =
    activeTab === 'facility'
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
        onContentSizeChange={() => {
          if (initialScrollY === undefined || initialScrollAppliedRef.current)
            return;
          initialScrollAppliedRef.current = true;
          scrollRef.current?.scrollTo({ y: initialScrollY, animated: false });
        }}
        onScroll={(event) => {
          latestScrollOffsetRef.current = event.nativeEvent.contentOffset.y;
          if (guideFocus === 'emergency-loan') {
            scheduleLoanGuideAnchorMeasurement();
          }
          if (guideFocus === 'facility-adjacency') {
            scheduleFacilityAdjacencyGuideAnchorMeasurement();
          }
          if (guideFocus === 'coach-speech') {
            scheduleCoachSpeechGuideAnchorMeasurement();
          }
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
                  <PixelText className="text-sm uppercase text-blue-dark">
                    {t('clubFinances.clubOffice')}
                  </PixelText>
                  <View className="mt-1 flex-row items-center gap-2">
                    <ClubCrest clubName={viewModel.clubName} size={24} />
                    <PixelText
                      className="min-w-0 flex-1 text-xl uppercase leading-7 text-ink"
                      numberOfLines={2}
                    >
                      {viewModel.clubName}
                    </PixelText>
                  </View>
                </View>
                <StatusChip label={viewModel.periodLabel} />
              </View>
              <ScreenTabs
                tabs={CLUB_OFFICE_TABS(t)}
                activeId={activeTab}
                onSelect={onSelectTab}
                flashTabId={
                  (guidanceNudgeTarget === 'coaching-office' ||
                    guidanceNudgeTarget === 'training-ground-facility') &&
                  activeTab !== 'facility'
                    ? 'facility'
                    : undefined
                }
                flashToken={guidanceNudgeToken}
                reduceMotion={reduceMotion}
              />
              {/* The Staff board is a row of peer coach cards — one per column on a
            wide window — so its label belongs to the board, not to the card
            that happens to come first. */}
              {activeTab === 'staff' ? (
                <View className="mt-4">
                  <SectionLabel
                    eyebrow={t('clubFinances.backroomStaff')}
                    title={t('clubFinances.coachingStaff')}
                    right={
                      <StatusChip
                        label={`${viewModel.coachingStaff.length} / 2`}
                        selected={viewModel.coachingStaff.length > 0}
                      />
                    }
                  />
                </View>
              ) : null}
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
}

function CashPositionSection({ viewModel }: CashPositionSectionProps) {
  const t = useCopy();
  return (
    <View className="relative">
      <PaperPanel
        kicker={t('clubFinances.cashPosition')}
        title={t('clubFinances.boardsBottomLine')}
        stamp={t('clubFinances.stampCurrent')}
      >
        <View className="flex-row gap-2">
          <Metric
            label={t('clubFinances.balance')}
            value={formatCurrency(t, viewModel.resources.money)}
          />
          <Metric
            label={t('clubFinances.nextFourWeeksTypical')}
            value={formatCurrency(t, viewModel.operatingOutlook.net, true)}
            tone={viewModel.operatingOutlook.net < 0 ? 'negative' : 'positive'}
          />
        </View>
        <View className="mt-2 flex-row gap-2">
          <Metric
            label={t('clubFinances.fourWeekBalanceTypical')}
            value={formatCurrency(
              t,
              viewModel.operatingOutlook.projectedBalance,
            )}
          />
          <Metric
            label={t('clubFinances.fans')}
            value={formatCompactNumber(t, viewModel.fans)}
          />
        </View>
        <View className="mt-2 flex-row">
          <Metric
            label={t('clubFinances.matchDealsPrize')}
            value={
              viewModel.variableIncome.detail === undefined
                ? formatCurrency(t, viewModel.variableIncome.amount, true)
                : `${formatCurrency(t, viewModel.variableIncome.amount)} (${viewModel.variableIncome.detail})`
            }
            tone={viewModel.variableIncome.amount > 0 ? 'positive' : 'normal'}
          />
        </View>
        {viewModel.operatingOutlook.weeks.length > 0 ? (
          <View className="mt-3 border-2 border-ink bg-white">
            {viewModel.operatingOutlook.weeks.map((week) => (
              <View
                key={week.periodLabel}
                className="border-b border-ink/20 px-3 py-2 last:border-b-0"
              >
                <View className="flex-row items-center justify-between gap-2">
                  <PixelText className="text-xs uppercase text-ink">
                    {week.periodLabel}
                  </PixelText>
                  <Text
                    className={
                      week.net < 0
                        ? 'font-mono text-sm text-red-dark'
                        : 'font-mono text-sm text-pitch-dark'
                    }
                  >
                    {formatCurrency(t, week.net, true)}
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
function EmergencyLoanSection({
  loan,
  guided,
  guideAnchorRef,
  onGuideAnchorLayout,
}: {
  readonly loan: ClubLoanViewModel;
  readonly guided: boolean;
  readonly guideAnchorRef: RefObject<View | null>;
  readonly onGuideAnchorLayout: () => void;
}) {
  const t = useCopy();
  return (
    <View
      ref={guideAnchorRef}
      collapsable={false}
      onLayout={onGuideAnchorLayout}
      className={
        guided
          ? 'relative border-2 border-blue-dark bg-blue-light p-1'
          : 'relative'
      }
    >
      <PaperPanel
        kicker={t('clubFinances.boardLoan')}
        title={t('clubFinances.emergencyLoan')}
        stamp={t('clubFinances.stampOwed')}
      >
        <View className="flex-row gap-2">
          <Metric
            label={t('clubFinances.borrowed')}
            value={formatCurrency(t, loan.originalAmount)}
          />
          <Metric
            label={t('clubFinances.stillOwed')}
            value={formatCurrency(t, loan.remainingBalance)}
            tone="negative"
          />
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
  onReviewOffer?: (
    offer: SponsorOfferViewModel,
    slot: SponsorSlotViewModel,
  ) => void;
  onChooseWeeklyChallenge?: (kind: SponsorWeeklyChallengeKindViewModel) => void;
  guideFocus?: AssistantGuideFocus;
  sponsorDeskTargetRef: RefObject<View | null>;
  onGuideTargetLayout: () => void;
}

/** One honest sponsor desk: signed terms, one slot at a time, then its offers. */
function SponsorBusinessSection({
  sponsorship,
  selectedSlot,
  onSelectSlot,
  onReviewOffer,
  onChooseWeeklyChallenge,
  guideFocus,
  sponsorDeskTargetRef,
  onGuideTargetLayout,
}: SponsorBusinessSectionProps) {
  const t = useCopy();
  const selected =
    sponsorship.slots.find((slot) => slot.slot === selectedSlot) ??
    sponsorship.slots[0];
  const guidedDesk =
    guideFocus === 'sponsor-desk' || guideFocus === 'sponsor-summary';

  if (!sponsorship.managed) {
    return (
      <View>
        <SponsorHeading
          title={t('clubFinances.localAdvertising')}
          eyebrow={t('clubFinances.clubBusiness')}
          stamp={t('clubFinances.stampLive')}
          targetRef={sponsorDeskTargetRef}
          onLayout={onGuideTargetLayout}
        />
        <PaperPanel
          kicker={t('clubFinances.localAdvertising')}
          title={t('clubFinances.theCrowdIsTalking')}
          stamp={t('clubFinances.stampLive')}
        >
          <Text className="text-sm leading-5 text-ink/70">
            {t('clubFinances.boardsPayBody', {
              amount: formatCurrency(t, sponsorship.actualMonthlyIncome),
            })}
          </Text>
        </PaperPanel>
      </View>
    );
  }

  return (
    <View
      className={
        guidedDesk ? 'border-2 border-blue-dark bg-blue-light p-1' : undefined
      }
    >
      <SponsorHeading
        title={t('clubFinances.sponsorDesk')}
        eyebrow={t('clubFinances.clubBusiness')}
        stamp={t('clubFinances.slotCount', {
          n: sponsorship.slots.length,
          count: sponsorship.slots.length,
        })}
        targetRef={sponsorDeskTargetRef}
        onLayout={onGuideTargetLayout}
      />
      <View className="mb-3 border-2 border-ink bg-white p-3">
        <View className="flex-row flex-wrap items-start justify-between gap-2">
          <View className="min-w-0 flex-1">
            <PixelText className="text-sm uppercase text-ink">
              {t('clubFinances.portfolioPayment')}
            </PixelText>
            <Text className="mt-1 font-mono text-xl text-ink">
              {t('clubFinances.perMonth', {
                amount: formatCurrency(t, sponsorship.actualMonthlyIncome),
              })}
            </Text>
          </View>
          <StatusChip
            label={t('clubFinances.nextPaymentChip', {
              when: sponsorship.nextPaymentLabel,
            })}
            tone="info"
          />
        </View>
        {/* One number, and it is the club's. The contract total and the
            Chairman percentage used to sit here, which told the manager the
            difficulty was taking a cut of every sponsor — a penalty shown as a
            penalty. The payment above is what arrives; nothing else is theirs
            to act on. */}
      </View>

      {sponsorship.weeklyChallenge === undefined ? null : (
        <PaperPanel
          kicker={t('clubFinances.sponsorDesk')}
          title={t('clubFinances.sponsorSprintTitle')}
          stamp={
            sponsorship.weeklyChallenge.status === 'OFFER'
              ? t('clubFinances.statusChoose')
              : sponsorship.weeklyChallenge.status === 'MET'
                ? t('clubFinances.statusTargetMet')
                : sponsorship.weeklyChallenge.status === 'FAILED'
                  ? t('clubFinances.statusTargetMissed')
                  : t('clubFinances.statusActive')
          }
        >
          <Text className="text-sm leading-5 text-ink/70">
            {sponsorship.weeklyChallenge.status === 'OFFER'
              ? t('clubFinances.sponsorSprintOfferDetail', {
                  week: sponsorship.weeklyChallenge.fixtureWeek,
                })
              : t('clubFinances.sponsorSprintTargetDetail', {
                  target: sponsorship.weeklyChallenge.targetLabel ?? '',
                  week: sponsorship.weeklyChallenge.fixtureWeek,
                })}
          </Text>
          <Text className="mt-2 font-mono text-sm text-ink">
            {t('clubFinances.sponsorSprintBonus', {
              amount: formatCurrency(
                t,
                sponsorship.weeklyChallenge.actualBonus,
              ),
            })}
          </Text>
          {sponsorship.weeklyChallenge.options === undefined ||
          onChooseWeeklyChallenge === undefined ? null : (
            <View className="mt-3 gap-2">
              {sponsorship.weeklyChallenge.options.map((option) => (
                <ActionButton
                  key={option.kind}
                  label={option.targetLabel}
                  accessibilityLabel={option.targetLabel}
                  onPress={() => onChooseWeeklyChallenge(option.kind)}
                />
              ))}
            </View>
          )}
        </PaperPanel>
      )}

      <ScreenTabs
        tabs={sponsorship.slots.map((slot) => ({
          id: String(slot.slot),
          label: slot.slotLabel,
          accessibilityLabel: slot.provisional
            ? t('clubFinances.a11y.slotNeedsChoice', { slot: slot.slotLabel })
            : t('clubFinances.a11y.slotSigned', { slot: slot.slotLabel }),
        }))}
        activeId={String(selected?.slot ?? selectedSlot)}
        onSelect={(id) => onSelectSlot(Number(id))}
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
          <ActiveSponsorCard
            slot={selected}
            chairmanPercent={sponsorship.chairmanPercent}
          />
          {!sponsorship.offerWindowOpen || selected.offers.length === 0 ? (
            selected.provisional ? (
              <View className="mt-3 border-2 border-dashed border-ink/30 bg-paper p-3">
                <PixelText className="text-sm uppercase text-ink">
                  {t('clubFinances.incomeProtected')}
                </PixelText>
                <Text className="mt-1 text-sm leading-5 text-ink/70">
                  {t('clubFinances.yourCurrentSponsorIncome')}
                </Text>
              </View>
            ) : null
          ) : (
            <View className="mt-4 gap-3">
              <SectionLabel
                eyebrow={t('clubFinances.offers')}
                title={t('clubFinances.chooseForSlot', {
                  slot: selected.slotLabel,
                })}
              />
              {selected.offers.map((offer) => (
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
    </View>
  );
}

function SponsorHeading({
  title,
  eyebrow,
  stamp,
  targetRef,
  onLayout,
}: {
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
        <PixelText className="mt-1 text-xl uppercase text-ink">
          {title}
        </PixelText>
      </View>
      <StatusChip label={stamp} selected />
    </View>
  );
}

function ActiveSponsorCard({
  slot,
  chairmanPercent,
}: {
  readonly slot: SponsorSlotViewModel;
  readonly chairmanPercent?: number;
}) {
  const t = useCopy();
  const statusLabel = slot.provisional
    ? t('clubFinances.statusContinuity')
    : slot.objectiveStatus === 'MET'
      ? t('clubFinances.statusTargetMet')
      : slot.objectiveStatus === 'FAILED'
        ? t('clubFinances.statusTargetMissed')
        : t('clubFinances.statusActive');
  const statusTone =
    slot.objectiveStatus === 'MET'
      ? ('success' as const)
      : slot.objectiveStatus === 'FAILED'
        ? ('danger' as const)
        : ('normal' as const);
  const accessibilityLabel = [
    slot.provisional
      ? t('clubFinances.a11y.continuitySponsor', { sponsor: slot.sponsorName })
      : t('clubFinances.a11y.activeSponsor', { sponsor: slot.sponsorName }),
    t('clubFinances.a11y.contractValuePerMonth', {
      amount: formatCurrency(t, slot.actualMonthlyFee),
    }),
    slot.objectiveLabel === undefined
      ? undefined
      : t('clubFinances.a11y.objective', { objective: slot.objectiveLabel }),
    slot.objectiveProgressLabel === undefined
      ? undefined
      : `${slot.objectiveProgressLabel}.`,
    slot.actualBonus === undefined
      ? undefined
      : t('clubFinances.a11y.contractBonusColon', {
          amount: formatCurrency(t, slot.actualBonus),
        }),
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel}
      className="border-2 border-b-4 border-ink bg-white p-4"
    >
      <View className="flex-row flex-wrap items-start justify-between gap-2">
        <View className="min-w-0 flex-1">
          <PixelText className="text-base uppercase leading-6 text-ink">
            {slot.sponsorName}
          </PixelText>
          <Text className="mt-1 text-sm leading-5 text-ink/70">
            {slot.offerLine}
          </Text>
        </View>
        <StatusChip label={statusLabel} tone={statusTone} />
      </View>
      <View className="mt-3 border-t border-ink/20 pt-3">
        <Text className="font-mono text-base text-ink">
          {t('clubFinances.contractPerMonth', {
            amount: formatCurrency(t, slot.actualMonthlyFee),
          })}
        </Text>
      </View>
      {slot.objectiveLabel === undefined ? null : (
        <View className="mt-3 border-2 border-ink/20 bg-paper p-3">
          <Text className="text-sm font-bold leading-5 text-ink">
            {slot.objectiveLabel}
          </Text>
          {slot.objectiveProgressLabel === undefined ? null : (
            <Text className="mt-1 font-mono text-sm text-ink/70">
              {slot.objectiveProgressLabel}
            </Text>
          )}
          <Text className="mt-2 font-mono text-sm text-ink">
            {t('clubFinances.targetBonus', {
              amount: formatCurrency(t, slot.actualBonus ?? 0),
            })}
          </Text>
        </View>
      )}
    </View>
  );
}

function SponsorOfferCard({
  offer,
  slot,
  chairmanPercent,
  onReview,
}: {
  readonly offer: SponsorOfferViewModel;
  readonly slot: SponsorSlotViewModel;
  readonly chairmanPercent?: number;
  readonly onReview?: (
    offer: SponsorOfferViewModel,
    slot: SponsorSlotViewModel,
  ) => void;
}) {
  const t = useCopy();
  const accessibilityLabel = [
    t('clubFinances.a11y.reviewSponsorForSlot', {
      sponsor: offer.sponsorName,
      slot: slot.slotLabel,
    }),
    t('clubFinances.a11y.profileOffer', { profile: offer.profileLabel }),
    t('clubFinances.a11y.contractValuePerMonth', {
      amount: formatCurrency(t, offer.actualMonthlyFee),
    }),
    t('clubFinances.a11y.objective', { objective: offer.objectiveLabel }),
    t('clubFinances.a11y.contractBonus', {
      amount: formatCurrency(t, offer.actualBonus),
    }),
  ].join(' ');
  return (
    <View className="border-2 border-b-4 border-ink bg-white p-4">
      <View className="flex-row flex-wrap items-start justify-between gap-2">
        <View className="min-w-0 flex-1">
          <PixelText className="text-base uppercase leading-6 text-ink">
            {offer.sponsorName}
          </PixelText>
          <Text className="mt-1 text-sm leading-5 text-ink/70">
            {offer.offerLine}
          </Text>
        </View>
        <StatusChip
          label={offer.profileLabel}
          tone={offer.profile === 'BOLD' ? 'hero' : 'normal'}
        />
      </View>
      <View className="mt-3 gap-1 border-t border-ink/20 pt-3">
        <Text className="font-mono text-base text-ink">
          {t('clubFinances.contractPerMonth', {
            amount: formatCurrency(t, offer.actualMonthlyFee),
          })}
        </Text>
        <Text className="mt-2 text-sm font-bold leading-5 text-ink">
          {offer.objectiveLabel}
        </Text>
        <Text className="font-mono text-sm text-ink">
          {t('clubFinances.targetBonus', {
            amount: formatCurrency(t, offer.actualBonus),
          })}
        </Text>
      </View>
      {onReview === undefined ? null : (
        <View className="mt-4">
          <ActionButton
            label={t('clubFinances.reviewOffer')}
            accessibilityLabel={accessibilityLabel}
            onPress={() => onReview(offer, slot)}
          />
        </View>
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

function ItemizedStatementSection({
  viewModel,
  onOpenLedgerLine,
}: ItemizedStatementSectionProps) {
  const t = useCopy();
  return (
    <View>
      <SectionLabel
        eyebrow={t('clubFinances.weekly')}
        title={t('clubFinances.expensesAndIncome')}
      />
      {viewModel.ledger.length === 0 ? (
        <EmptyDocket
          title={t('clubFinances.nothingYet')}
          detail={t('clubFinances.nothingYetDetail')}
        />
      ) : (
        <View className="border-2 border-ink bg-white">
          <View className="flex-row border-b border-ink/20 px-3 py-2">
            <PixelText className="flex-1 text-sm uppercase tracking-wide text-ink/70">
              {t('clubFinances.columnEntry')}
            </PixelText>
            <PixelText className="text-right text-sm uppercase tracking-wide text-ink/70">
              {t('clubFinances.columnAmount')}
            </PixelText>
          </View>
          {viewModel.ledger.map((line) => {
            // The list runs newest first, so the head row names the week just
            // settled. Only that week keeps the white paper; the weeks behind
            // it sit back on cream, which turns a wall of identical rows into
            // "this week, then history" at a glance.
            const currentWeek =
              line.periodLabel === viewModel.ledger[0]?.periodLabel;
            const rowClass = currentWeek
              ? 'min-h-11 flex-row items-center border-b border-ink/10 px-3 py-2'
              : 'min-h-11 flex-row items-center border-b border-ink/10 bg-paper px-3 py-2';
            const amountClass =
              line.kind === 'income'
                ? 'text-pitch-ink'
                : line.kind === 'expense'
                  ? 'text-red-dark'
                  : 'text-ink';
            const accessibilityLabel = t(
              line.amount > 0
                ? 'clubFinances.a11y.ledgerRowPlus'
                : 'clubFinances.a11y.ledgerRow',
              {
                period: line.periodLabel,
                label: line.label,
                amount: formatCurrency(t, line.amount),
              },
            );
            const content = (
              <>
                <View className="flex-1 pr-3">
                  <Text className="text-base text-ink">{line.label}</Text>
                  <Text className="font-mono text-xs uppercase text-ink/70">
                    {line.periodLabel}
                  </Text>
                </View>
                <Text className={`font-mono text-base ${amountClass}`}>
                  {formatCurrency(t, line.amount, true)}
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
                  className={rowClass}
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
                className={rowClass}
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

function RecentTransactionsSection({
  viewModel,
}: RecentTransactionsSectionProps) {
  const t = useCopy();
  return (
    <View>
      <SectionLabel
        eyebrow={t('clubFinances.oneOffs')}
        title={t('clubFinances.signingsAndPurchases')}
      />
      {viewModel.recentTransactions.length === 0 ? (
        <EmptyDocket
          title={t('clubFinances.nothingSignedOrBuilt')}
          detail={t('clubFinances.nothingSignedOrBuiltDetail')}
        />
      ) : (
        <View className="border-2 border-ink bg-white">
          {viewModel.recentTransactions.map((transaction) => (
            <View
              key={transaction.id}
              className="min-h-12 flex-row items-center border-b border-ink/10 px-3 py-2"
            >
              <View className="flex-1 pr-3">
                <Text className="text-base font-bold text-ink">
                  {transaction.label}
                </Text>
                <Text className="font-mono text-xs uppercase text-ink/70">
                  {t('clubFinances.periodAndBalance', {
                    period: transaction.periodLabel,
                    amount: formatCurrency(t, transaction.balanceAfter),
                  })}
                </Text>
              </View>
              <Text
                className={`font-mono text-base ${transaction.kind === 'income' ? 'text-pitch-ink' : 'text-red-dark'}`}
              >
                {formatCurrency(t, transaction.amount, true)}
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
function TrainingPointIncomeSection({
  income,
}: {
  readonly income: TrainingPointIncomeViewModel;
}) {
  const t = useCopy();
  return (
    <View>
      <SectionLabel
        eyebrow={t('clubFinances.trainingPoints')}
        title={t('clubFinances.whatEarnsThem')}
      />
      <View className="border-2 border-ink bg-white">
        {income.rows.map((row) => (
          <View
            key={row.id}
            accessible
            accessibilityRole="text"
            accessibilityLabel={t('clubFinances.a11y.trainingPointsRow', {
              label: row.label,
              points: row.points,
            })}
            className="min-h-11 flex-row items-center border-b border-ink/10 px-3 py-2"
          >
            <View className="flex-1 pr-3">
              <Text className="text-base text-ink">{row.label}</Text>
              {row.detail === undefined ? null : (
                <Text className="font-mono text-xs uppercase text-ink/70">
                  {row.detail}
                </Text>
              )}
            </View>
            <Text className="font-mono text-base text-blue-dark">
              +{row.points}
            </Text>
          </View>
        ))}
        <View
          accessible
          accessibilityRole="text"
          accessibilityLabel={t('clubFinances.a11y.trainingPointsTotal', {
            points: income.total,
          })}
          className="min-h-11 flex-row items-center bg-paper px-3 py-2"
        >
          <PixelText className="flex-1 pr-3 text-sm uppercase text-ink">
            {t('clubFinances.perWeek')}
          </PixelText>
          <Text className="font-mono text-lg text-ink">{income.total}</Text>
        </View>
      </View>
    </View>
  );
}

/**
 * Where the money comes from, as multipliers rather than as amounts.
 *
 * The statement above says what the club banked last week; nothing said why it
 * was that number, or what would make it bigger. Unbuilt commercial buildings
 * keep a row — greyed, with the worth they WOULD have — because the panel is
 * read as often for "how do I earn more" as for "what do I own".
 */
/**
 * One settled receipt: "Week 26 $3.7k".
 *
 * No sign — every source in this panel pays the club, so a "+" on all of them
 * marked nothing. No season either, and the figure is rounded to thousands so
 * three of them fit one line at any text scale.
 */
function incomeHistoryEntryLabel(
  t: CopyFn,
  entry: { readonly week: number; readonly amount: number },
): string {
  return t('clubFinances.incomeRecentEntry', {
    week: entry.week,
    amount: formatThousandsForCopy(t, entry.amount),
  });
}

function IncomeGenerationSection({
  income,
  compact,
}: {
  readonly income: IncomeGenerationViewModel;
  readonly compact: boolean;
}) {
  const t = useCopy();
  return (
    <View>
      <SectionLabel
        eyebrow={t('clubFinances.incomeGeneration')}
        title={t('clubFinances.bringingInRevenue')}
      />
      <View className="border-2 border-ink bg-white">
        {income.rows.map((row) => (
          <View
            key={row.id}
            accessible
            accessibilityRole="text"
            accessibilityLabel={`${row.label}, ${row.effect}. ${row.detail}${
              row.history === undefined
                ? ''
                : `. ${t('clubFinances.incomeRecent')}: ${row.history
                    .map((entry) => incomeHistoryEntryLabel(t, entry))
                    .join(', ')}`
            }`}
            className="min-h-11 border-b border-ink/10 px-3 py-2 last:border-b-0"
          >
            <View className={compact ? 'gap-1' : 'flex-row items-center'}>
              <View className={compact ? 'min-w-0' : 'min-w-0 flex-1 pr-3'}>
                <Text
                  className={
                    row.owned ? 'text-base text-ink' : 'text-base text-ink/45'
                  }
                >
                  {row.label}
                </Text>
                <Text className="mt-0.5 text-xs leading-4 text-ink/60">
                  {row.detail}
                </Text>
              </View>
              <Text
                className={
                  row.owned
                    ? 'font-mono text-base text-pitch-ink'
                    : 'font-mono text-base text-ink/40'
                }
              >
                {row.effect}
              </Text>
            </View>
            {row.history === undefined ? null : (
              <View className="mt-1.5 flex-row flex-wrap items-center gap-x-3 gap-y-1">
                <PixelText className="text-xs uppercase text-ink/55">
                  {t('clubFinances.incomeRecent')}
                </PixelText>
                {/* One text node, comma-separated: these are all receipts, so
                    the row wants to read as a list rather than as a set of
                    signed deltas. */}
                <Text className="font-mono text-xs text-pitch-dark">
                  {row.history
                    .map((entry) => incomeHistoryEntryLabel(t, entry))
                    .join(', ')}
                </Text>
              </View>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * Everything the club owns, what each one buys it, and what the lot costs to
 * run. The grid above shows where they are; this says what they are for.
 */
function FacilityRegisterSection({
  facilities,
}: {
  readonly facilities: ClubFacilityGridViewModel;
}) {
  const t = useCopy();
  return (
    // No margin of its own: SectionFlow already spaces every section by gap-6.
    <View>
      <SectionLabel
        eyebrow={t('clubFinances.onTheBooks')}
        title={t('clubFinances.whatTheClubOwns')}
        right={
          <StatusChip
            label={t('clubFinances.builtCount', {
              count: facilities.buildings.length,
            })}
          />
        }
      />
      <View className="border-2 border-ink bg-white">
        {facilities.buildings.map((building) => (
          <View
            key={building.id}
            accessible
            accessibilityRole="text"
            accessibilityLabel={t('clubFinances.a11y.facilityRow', {
              name: building.name,
              level: building.level,
              effect: building.effectLabel,
              upkeep: formatCurrency(t, building.weeklyUpkeep),
            })}
            className="flex-row items-start border-b border-ink/10 px-3 py-2"
          >
            <View className="flex-1 pr-3">
              <Text className="text-base font-bold text-ink">
                {t('clubFinances.nameAndLevel', {
                  name: building.name,
                  level: building.level,
                })}
              </Text>
              <Text className="mt-1 text-sm leading-5 text-ink/70">
                {building.status === 'operational'
                  ? building.effectLabel
                  : projectWeeksRemaining(
                      t,
                      building.status,
                      building.weeksRemaining,
                    )}
              </Text>
            </View>
            <Text className="font-mono text-base text-red-dark">
              {building.weeklyUpkeep === 0
                ? formatCurrency(t, 0)
                : formatCurrency(t, -building.weeklyUpkeep)}
            </Text>
          </View>
        ))}
        <View
          accessible
          accessibilityRole="text"
          accessibilityLabel={t('clubFinances.a11y.totalUpkeepAWeek', {
            amount: formatCurrency(t, facilities.weeklyUpkeep),
          })}
          className="min-h-11 flex-row items-center bg-paper px-3 py-2"
        >
          <PixelText className="flex-1 pr-3 text-sm uppercase text-ink">
            {t('clubFinances.runningCost')}
          </PixelText>
          <Text className="font-mono text-lg text-red-dark">
            {t('clubFinances.perWeekShort', {
              amount: formatCurrency(t, -facilities.weeklyUpkeep),
            })}
          </Text>
        </View>
      </View>
    </View>
  );
}

/**
 * The empty half of the staff board: no coach yet, and the only move is the
 * market. The board label lives in the screen header, not here — the staff
 * board is a row of peer cards, and a label inside the first one would drop
 * the second column 44pt below the first.
 */
function CoachingVacancySection({
  onOpenCoachMarket,
}: {
  readonly onOpenCoachMarket?: () => void;
}) {
  const t = useCopy();
  return (
    <PaperPanel
      kicker={t('clubFinances.vacancy')}
      title={t('clubFinances.touchlineNeedsAVoice')}
      stamp={t('clubFinances.stampOpen')}
    >
      <Text className="text-sm leading-5 text-ink/70">
        {t('clubFinances.hireAHeadCoach')}
      </Text>
      {onOpenCoachMarket ? (
        <View className="mt-3">
          <ActionButton
            label={t('clubFinances.openCoachMarket')}
            accessibilityLabel={t('clubFinances.a11y.openTheCoachMarket')}
            onPress={onOpenCoachMarket}
          />
        </View>
      ) : null}
    </PaperPanel>
  );
}

interface CoachCardSectionProps {
  coach: CoachStaffMemberViewModel;
  /** Head coach only: the speech desk sits under his card, or nowhere. */
  coachSpeech?: CoachSpeechViewModel;
  onDismissCoach?: (role: 'HEAD' | 'ASSISTANT') => void;
  onTrainCoachSpeech?: () => void;
  /** Measured by the briefing so its scrim cuts a hole over this button. */
  trainCoachRef?: RefObject<View | null>;
}

/** One coach, one section: head and assistant stand side by side on a wide
 * window instead of stacking down a 1180pt-wide page. */
function CoachCardSection({
  coach,
  coachSpeech,
  onDismissCoach,
  onTrainCoachSpeech,
  trainCoachRef,
}: CoachCardSectionProps) {
  const t = useCopy();
  return (
    <View className="border-2 border-b-4 border-ink bg-white p-3">
      <View className="flex-row items-start gap-3">
        <View className="border-2 border-b-4 border-ink bg-blue-light px-2 pt-2">
          <ManagementSprite
            spriteKey={`coach:${coach.portraitId}:rest`}
            width={72}
            accessibilityLabel={t('clubFinances.a11y.coachPortrait', {
              name: coach.name,
            })}
          />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="font-pixel text-sm uppercase text-blue-dark">
            {coach.roleLabel}
          </Text>
          <Text className="mt-1 text-lg font-bold text-ink" numberOfLines={1}>
            {coach.name}
          </Text>
          <Text className="mt-1 text-sm text-ink/70">
            {t('clubFinances.coachLine', {
              age: coach.age,
              personality: coach.personalityLabel,
              level: coach.level,
            })}
          </Text>
          <Text className="mt-1 font-mono text-sm text-ink">
            {t('clubFinances.perWeekAmount', {
              amount: formatCurrency(t, coach.weeklyWage),
            })}
          </Text>
        </View>
      </View>
      <View className="mt-3 flex-row gap-2">
        {coach.specialtyLabels.map((specialty) => (
          <View
            key={specialty}
            className="flex-1 border-2 border-ink bg-paper px-2 py-2"
          >
            <PixelText className="text-center text-sm uppercase text-ink">
              {specialty}
            </PixelText>
          </View>
        ))}
      </View>
      <View className="mt-3 border-2 border-blue-dark bg-blue-light px-3 py-2">
        {coach.effectLabels.map((effect) => (
          <Text key={effect} className="text-sm font-bold text-ink">
            {effect}
          </Text>
        ))}
      </View>
      <Text className="mt-2 text-sm text-ink/70">
        {t('clubFinances.coachEmployed', {
          n: coach.seasonsEmployed,
          count: coach.seasonsEmployed,
        })}
      </Text>
      {coachSpeech === undefined || onTrainCoachSpeech === undefined ? null : (
        <View ref={trainCoachRef} collapsable={false} className="mt-3">
          {/* The running tally sits ABOVE the button, so the stock is visible
              whether or not this week's purchase is available. Absent at zero:
              an empty shelf needs no label. */}
          {coachSpeech.bankedLabel === undefined ? null : (
            <Text className="mb-2 font-pixel text-sm uppercase text-ink">
              {coachSpeech.bankedLabel}
            </Text>
          )}
          <ActionButton
            label={coachSpeech.label}
            accessibilityLabel={t('coachSpeech.a11y.trainCoach', {
              name: coach.name,
              points: coachSpeech.trainingPointsCost,
            })}
            disabled={coachSpeech.blockedLabel !== undefined}
            visuallyDisabled={coachSpeech.blockedLabel !== undefined}
            onPress={onTrainCoachSpeech}
          />
          {/* One line under the button: the price when it can be paid, the
              reason when it cannot. Never both — a dead button explaining
              itself does not also need a price list. */}
          <Text className="mt-2 text-sm text-ink/70">
            {coachSpeech.blockedLabel ??
              t('coachSpeech.costDetail', {
                points: coachSpeech.trainingPointsCost,
                boost: coachSpeech.boost,
              })}
          </Text>
        </View>
      )}
      {onDismissCoach ? (
        <View className="mt-3">
          <ActionButton
            label={t('clubFinances.dismissSeverance', {
              amount: formatCurrency(t, coach.severanceCost),
            })}
            accessibilityLabel={t('clubFinances.a11y.dismissWithSeverance', {
              name: coach.name,
            })}
            variant="danger"
            onPress={() => onDismissCoach(coach.role)}
          />
        </View>
      ) : null}
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
  /** The selected building's card, so a tap on the grid can scroll to it. */
  facilityDetailRef: RefObject<View | null>;
  revealFacilityDetail: () => void;
  relocatingBuildingId: string | null;
  setRelocatingBuildingId: Dispatch<SetStateAction<string | null>>;
  previewCell: { x: number; y: number } | null;
  setPreviewCell: Dispatch<SetStateAction<{ x: number; y: number } | null>>;
  /** Why the last tapped square was refused, shown in place of the placement hint. */
  placementRejection: string | null;
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
  facilityPlacementTargetRef: RefObject<View | null>;
  facilityPlacementFocusRef: RefObject<View | null>;
  showBuildPlacementHelper: boolean;
  dismissFacilityPlacementHelper: () => void;
  scrollFacilityGuideTargetIntoView: (phase: GuidedFirstFacilityPhase) => void;
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
  facilityDetailRef,
  revealFacilityDetail,
  relocatingBuildingId,
  setRelocatingBuildingId,
  previewCell,
  setPreviewCell,
  placementRejection,
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
  facilityPlacementTargetRef,
  facilityPlacementFocusRef,
  showBuildPlacementHelper,
  dismissFacilityPlacementHelper,
  scrollFacilityGuideTargetIntoView,
}: GroundsSectionProps) {
  const t = useCopy();
  const facilities = viewModel.facilities;
  // Everything `canUpgrade` asks for EXCEPT the money. Being short of cash no
  // longer greys the button out: the label keeps naming the real price, and the
  // tap answers with how much more the club needs. A greyed "Need $4,825" told
  // the manager the number but read as a dead control, and it named a different
  // figure from the Move button beside it.
  const upgradeOfferable =
    selectedBuilding !== undefined &&
    selectedBuilding.status === 'operational' &&
    selectedBuilding.upgradeCost !== undefined &&
    selectedBuilding.upgradeBlockedReason === undefined &&
    facilities.activeProject === undefined;
  return (
    <View
      ref={groundsRef}
      collapsable={false}
      className={
        guideGrounds
          ? guideFocus === 'coaching-office'
            ? 'relative border-2 border-blue-dark bg-blue-light p-1'
            : 'relative mt-20 border-2 border-blue-dark bg-blue-light p-1'
          : 'relative'
      }
    >
      <SectionLabel
        eyebrow={t('clubFinances.clubGrounds')}
        title={t('clubFinances.buildThePlaceAroundTheTeam')}
        right={
          <StatusChip
            label={t('clubFinances.openCount', {
              count: viewModel.facilities.buildings.filter(
                (building) => building.status === 'operational',
              ).length,
            })}
          />
        }
      />
      <PaperPanel
        kicker={t('clubFinances.eightBySixGrounds')}
        title={t('clubFinances.facilitiesGrid')}
        stamp={t('clubFinances.perWeekShort', {
          amount: formatCurrency(t, viewModel.facilities.weeklyUpkeep),
        })}
      >
        <Text className="mb-3 text-sm leading-4 text-ink/70">
          {t('clubFinances.pickABuildingFrom')}
        </Text>
        {viewModel.facilities.activeProject ? (
          <View className="mb-3 flex-row items-center gap-3 border-2 border-b-4 border-amber-800 bg-amber-100 p-3">
            <ManagementSprite
              spriteKey="facility:worksite"
              width={54}
              accessibilityLabel={t('clubFinances.a11y.activeConstructionSite')}
            />
            <View className="min-w-0 flex-1">
              <Text className="font-pixel text-sm uppercase text-amber-900">
                {t('clubFinances.worksCrewBusy')}
              </Text>
              <PixelText className="mt-1 text-base uppercase text-ink">
                {t('clubFinances.projectWeeksLeft', {
                  name: viewModel.facilities.activeProject.name,
                  weeks: viewModel.facilities.activeProject.weeksRemaining,
                })}
              </PixelText>
              <Text className="mt-1 text-sm text-ink/70">
                {t('clubFinances.onlyOneConstructionOr')}
              </Text>
            </View>
          </View>
        ) : null}
        {facilities.activeAdjacencies.length > 0 ? (
          <View className="mb-3 border-2 border-pitch-dark bg-pitch-light px-3 py-2">
            <Text className="font-pixel text-sm uppercase text-ink">
              {t('clubFinances.pairBonusActive')}
            </Text>
            <Text className="mt-1 text-sm leading-4 text-ink/70">
              {facilities.activeAdjacencies
                .map((id) => facilityAdjacencyLabel(id, t))
                .join(' · ')}
            </Text>
          </View>
        ) : null}
        <View ref={facilityPlacementTargetRef} collapsable={false}>
          <View
            ref={facilityGuideGridTargetRef}
            collapsable={false}
            className={
              placementActive ||
              (guidedFirstFacility && guidedFacilityPhase === 'grid') ||
              guideFocus === 'facility-upgrade'
                ? 'relative overflow-visible border-2 border-ink bg-pitch-light'
                : 'relative overflow-hidden border-2 border-ink bg-pitch-light'
            }
            style={{ aspectRatio: facilities.width / facilities.height }}
            onLayout={(event) => {
              setFacilityGridWidth(event.nativeEvent.layout.width);
              if (guidedFacilityPhase === 'grid')
                scrollFacilityGuideTargetIntoView('grid');
            }}
            onPointerMove={dismissFacilityPlacementHelper}
            onTouchStart={dismissFacilityPlacementHelper}
          >
            {showBuildPlacementHelper ? (
              <View
                pointerEvents="none"
                style={styles.facilityPlacementHelperAnchor}
              >
                <View
                  ref={facilityPlacementFocusRef}
                  collapsable={false}
                  accessible
                  accessibilityRole="header"
                  accessibilityLabel={t('clubFinances.buildHere')}
                  pointerEvents="none"
                  {...guideHeadingProps()}
                  className="rounded-full border-2 border-b-4 border-gold-dark bg-gold-light px-4 py-2"
                  style={[
                    styles.guidedFacilityGlow,
                    styles.facilityPlacementHelper,
                  ]}
                >
                  <PixelText
                    accessibilityLiveRegion="polite"
                    className="text-center text-sm uppercase text-ink"
                  >
                    {t('clubFinances.buildHere')}
                  </PixelText>
                </View>
              </View>
            ) : null}
            {guidedFirstFacility &&
            guidedFacilityPhase === 'grid' &&
            facilityGridWidth > 0 ? (
              <TutorialTapCue
                label={t('clubFinances.bertSays')}
                detail={t('clubFinances.placeYourBuilding')}
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
              }}
            >
              {Array.from({ length: facilities.height }, (_, y) => (
                <View
                  key={`facility-row-${y}`}
                  style={{ flex: 1, flexDirection: 'row' }}
                >
                  {Array.from({ length: facilities.width }, (_, x) => {
                    const occupied = cellIsOccupied(x, y);
                    const guideAllowsCell =
                      !guidedFirstFacility ||
                      guidedFirstFacilityAllowsPlacement(
                        selectedBuildType,
                        x,
                        y,
                      );
                    const buildable =
                      placementActive &&
                      guideAllowsCell &&
                      !occupied &&
                      canPlaceAt(x, y);
                    return (
                      <View
                        key={`facility-cell-${x}-${y}`}
                        style={{
                          flex: 1,
                          borderRightWidth: x === facilities.width - 1 ? 0 : 1,
                          borderBottomWidth:
                            y === facilities.height - 1 ? 0 : 1,
                          borderColor: 'rgba(36, 31, 46, 0.28)',
                        }}
                      >
                        <Pressable
                          accessible={placementActive}
                          accessibilityRole={
                            placementActive ? 'button' : 'none'
                          }
                          accessibilityLabel={
                            placementActive
                              ? t(
                                  buildable
                                    ? 'clubFinances.a11y.buildAtColumnRow'
                                    : 'clubFinances.a11y.blockedAtColumnRow',
                                  { column: x + 1, row: y + 1 },
                                )
                              : undefined
                          }
                          disabled={!placementActive || !guideAllowsCell}
                          // A blocked square answers with the refusal cue, not
                          // the click that means the tap landed.
                          pressSfx={buildable ? 'click' : 'warning'}
                          onPress={() => {
                            dismissFacilityPlacementHelper();
                            handleGridCell(x, y);
                          }}
                          onPressIn={() => setPreviewCell({ x, y })}
                          onPressOut={() => setPreviewCell(null)}
                          // A mouse has a hover phase, so the fits/blocked footprint
                          // tracks the cursor instead of forcing a click-and-hold on
                          // every square to discover whether the building fits.
                          onHoverIn={() => setPreviewCell({ x, y })}
                          onHoverOut={() => setPreviewCell(null)}
                          style={{
                            flex: 1,
                            backgroundColor: occupied
                              ? 'transparent'
                              : placementActive
                                ? buildable
                                  ? 'rgba(154, 99, 214, 0.32)'
                                  : 'rgba(36, 31, 46, 0.05)'
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
                              <View
                                style={{
                                  position: 'absolute',
                                  width: FACILITY_PLACEMENT_PLUS_SIZE,
                                  height: FACILITY_PLACEMENT_PLUS_THICKNESS,
                                  backgroundColor: '#5b3a91',
                                }}
                              />
                              <View
                                style={{
                                  position: 'absolute',
                                  width: FACILITY_PLACEMENT_PLUS_THICKNESS,
                                  height: FACILITY_PLACEMENT_PLUS_SIZE,
                                  backgroundColor: '#5b3a91',
                                }}
                              />
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
              importantForAccessibility={
                placementActive ? 'no-hide-descendants' : 'auto'
              }
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 3,
              }}
            >
              {facilities.buildings.map((building) => {
                const selected = building.id === selectedBuildingId;
                const moving = building.id === relocatingBuildingId;
                const comboActive = building.activeAdjacencyIds.length > 0;
                const guidedUpgradeTarget =
                  guideFocus === 'facility-upgrade' &&
                  building.id === selectedBuildingId;
                const cellSize = facilityGridWidth / facilities.width;
                const artWidth = Math.max(24, building.width * cellSize - 10);
                const artHeight = Math.max(24, building.height * cellSize - 10);
                return (
                  <Pressable
                    key={building.id}
                    accessibilityRole="button"
                    accessibilityLabel={t(
                      comboActive
                        ? 'clubFinances.a11y.facilityCellCombo'
                        : 'clubFinances.a11y.facilityCell',
                      {
                        name: building.name,
                        level: building.level,
                        effect: building.effectLabel,
                      },
                    )}
                    disabled={placementActive}
                    onPress={() => {
                      setSelectedBuildingId(building.id);
                      setSelectedBuildType(null);
                      revealFacilityDetail();
                    }}
                    style={{
                      position: 'absolute',
                      left: `${(building.x * 100) / facilities.width}%`,
                      top: `${(building.y * 100) / facilities.height}%`,
                      width: `${(building.width * 100) / facilities.width}%`,
                      height: `${(building.height * 100) / facilities.height}%`,
                      padding: 2,
                      backgroundColor: comboActive ? '#8fd98f' : undefined,
                      shadowColor: comboActive ? '#3f8a4a' : undefined,
                      shadowOpacity: comboActive ? 0.9 : 0,
                      shadowRadius: comboActive ? 5 : 0,
                      zIndex: guidedUpgradeTarget ? 4 : undefined,
                    }}
                  >
                    {guidedUpgradeTarget ? (
                      <TutorialTapCue
                        label={t('clubFinances.bertSays')}
                        detail={t('clubFinances.reviewTheUpgrade')}
                        labelOffsetX={Math.max(
                          0,
                          TUTORIAL_TAP_CUE_WIDTH / 2 -
                            (building.width * cellSize) / 2,
                        )}
                        style={{
                          left: '50%',
                          marginLeft: -TUTORIAL_TAP_CUE_WIDTH / 2,
                          top: -72,
                        }}
                      />
                    ) : null}
                    <View
                      style={{
                        flex: 1,
                        borderWidth: selected || comboActive ? 3 : 2,
                        borderColor: selected
                          ? '#5b3a91'
                          : comboActive
                            ? '#3f8a4a'
                            : '#241f2e',
                        backgroundColor: moving
                          ? '#c9a6ec'
                          : facilityColor(building),
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
                          width={Math.max(
                            24,
                            Math.min(64, Math.min(artWidth, artHeight)),
                          )}
                          accessibilityLabel={t(
                            'clubFinances.a11y.facilityConstruction',
                            {
                              name: building.name,
                            },
                          )}
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
                          borderWidth: 2,
                          borderColor: '#241f2e',
                          backgroundColor: '#f4f1eadd',
                          paddingHorizontal: 4,
                          paddingVertical: 2,
                        }}
                      >
                        <PixelText className="text-center text-xs uppercase text-ink">
                          {building.status === 'operational'
                            ? `L${building.level}`
                            : `${building.status === 'construction' ? 'BUILD' : building.status === 'closed' ? 'CLOSED' : 'UP'} · ${building.weeksRemaining}W`}
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
                  left: `${(previewCell.x * 100) / facilities.width}%`,
                  top: `${(previewCell.y * 100) / facilities.height}%`,
                  width: `${(activeFootprint.width * 100) / facilities.width}%`,
                  height: `${(activeFootprint.height * 100) / facilities.height}%`,
                  borderWidth: 3,
                  borderColor: canPlaceAt(previewCell.x, previewCell.y)
                    ? '#5b3a91'
                    : '#a83440',
                  backgroundColor: canPlaceAt(previewCell.x, previewCell.y)
                    ? 'rgba(154, 99, 214, 0.45)'
                    : 'rgba(217, 79, 82, 0.40)',
                  zIndex: 4,
                }}
              />
            ) : null}
          </View>
        </View>

        {placementActive ? (
          <View className="mt-3 flex-row items-start justify-between gap-3 border-2 border-blue-dark bg-blue-light px-3 py-2">
            <View className="flex-1">
              <PixelText className="text-sm uppercase text-blue-dark">
                {relocatingBuildingId !== null
                  ? t('clubFinances.movingLabel', { name: activeLabel })
                  : t('clubFinances.placingLabel', { name: activeLabel })}
              </PixelText>
              <Text
                className={
                  placementRejection === null
                    ? 'mt-1 text-sm text-ink/70'
                    : 'mt-1 text-sm font-bold text-red-dark'
                }
              >
                {placementRejection ?? t('clubFinances.tapAnyPlusSquareAbove')}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('clubFinances.a11y.cancelPlacement')}
              onPress={cancelPlacement}
              className="min-h-11 items-center justify-center border-2 border-blue-dark bg-white px-3"
            >
              <PixelText className="text-sm uppercase text-blue-dark">
                {t('clubFinances.cancel')}
              </PixelText>
            </Pressable>
          </View>
        ) : (
          <View className="mt-3 border-2 border-dashed border-ink/30 bg-paper px-3 py-2">
            <Text className="text-sm text-ink/70">
              {t('clubFinances.pickABuildingFrom')}
              <Text className="font-bold text-ink">
                {t('clubFinances.buildMenu')}
              </Text>{' '}
              {t('clubFinances.belowToStartEvery')}
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
              <PixelText className="text-sm uppercase text-ink">
                {t('clubFinances.whatItDoes')}
              </PixelText>
              <Text className="mt-1 text-sm text-ink/80">
                {facilityBenefit(placementType, t)}
              </Text>
            </View>
          </View>
        ) : null}

        {selectedBuilding ? (
          <View
            ref={facilityDetailRef}
            collapsable={false}
            className="mt-3 border-2 border-ink bg-white p-3"
          >
            <View className="flex-row items-start justify-between gap-3">
              <View className="border-2 border-ink bg-paper p-1">
                <FacilitySprite
                  type={selectedBuilding.type}
                  level={selectedBuilding.level}
                  size={48}
                />
              </View>
              <View className="flex-1">
                <PixelText className="text-base uppercase text-ink">
                  {t('clubFinances.nameAndLevel', {
                    name: selectedBuilding.name,
                    level: selectedBuilding.level,
                  })}
                </PixelText>
                <Text className="mt-1 text-sm text-ink/70">
                  {selectedBuilding.status === 'operational'
                    ? t('clubFinances.upkeepAndMoveCost', {
                        upkeep: formatCurrency(
                          t,
                          selectedBuilding.weeklyUpkeep,
                        ),
                        fee: formatCurrency(t, selectedBuilding.relocationFee),
                      })
                    : projectWeeksRemaining(
                        t,
                        selectedBuilding.status,
                        selectedBuilding.weeksRemaining,
                      )}
                </Text>
                <Text className="mt-2 text-sm font-bold leading-4 text-blue-dark">
                  {selectedBuilding.effectLabel}
                </Text>
                {selectedBuilding.nextLevelEffectLabel ? (
                  <PixelText className="mt-1 text-xs uppercase leading-4 text-ink/70">
                    {t('clubFinances.nextLevel', {
                      effect: selectedBuilding.nextLevelEffectLabel,
                    })}
                  </PixelText>
                ) : null}
                {selectedBuilding.activeAdjacencyIds.length > 0 ? (
                  <PixelText className="mt-2 text-xs uppercase text-pitch-ink">
                    {t('clubFinances.activeCombo', {
                      combos: selectedBuilding.activeAdjacencyIds
                        .map((id) => facilityAdjacencyLabel(id, t))
                        .join(' · '),
                    })}
                  </PixelText>
                ) : null}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t(
                  'clubFinances.a11y.closeSelectedFacility',
                )}
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
                accessibilityLabel={
                  selectedBuilding.status !== 'operational'
                    ? t('clubFinances.a11y.cannotMoveProjectActive', {
                        name: selectedBuilding.name,
                      })
                    : selectedBuilding.canRelocate
                      ? t('clubFinances.a11y.moveForFee', {
                          name: selectedBuilding.name,
                          amount: formatCurrency(
                            t,
                            selectedBuilding.relocationFee,
                          ),
                        })
                      : t('clubFinances.a11y.cannotMoveNeedMore', {
                          name: selectedBuilding.name,
                          amount: formatCurrency(
                            t,
                            selectedBuilding.relocationShortfall,
                          ),
                        })
                }
                accessibilityState={{
                  disabled:
                    selectedBuilding.status !== 'operational' ||
                    !selectedBuilding.canRelocate,
                }}
                disabled={
                  selectedBuilding.status !== 'operational' ||
                  !selectedBuilding.canRelocate
                }
                onPress={() => setRelocatingBuildingId(selectedBuilding.id)}
                className={
                  selectedBuilding.status === 'operational' &&
                  selectedBuilding.canRelocate
                    ? 'min-h-12 flex-1 items-center justify-center border-2 border-b-4 border-ink bg-blue-light px-2'
                    : 'min-h-12 flex-1 items-center justify-center border-2 border-ink/30 bg-ink/5 px-2'
                }
              >
                <PixelText
                  className={
                    selectedBuilding.status === 'operational' &&
                    selectedBuilding.canRelocate
                      ? 'text-center text-sm uppercase text-ink'
                      : 'text-center text-sm uppercase text-ink/35'
                  }
                >
                  {selectedBuilding.status !== 'operational'
                    ? t('clubFinances.projectActive')
                    : selectedBuilding.canRelocate
                      ? t('clubFinances.moveCost', {
                          amount: formatCurrency(
                            t,
                            selectedBuilding.relocationFee,
                          ),
                        })
                      : t('clubFinances.needAmount', {
                          amount: formatCurrency(
                            t,
                            selectedBuilding.relocationShortfall,
                          ),
                        })}
                </PixelText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  selectedBuilding.upgradeCost === undefined
                    ? t('clubFinances.a11y.atMaximumLevel', {
                        name: selectedBuilding.name,
                      })
                    : selectedBuilding.status !== 'operational'
                      ? t('clubFinances.a11y.cannotUpgradeProjectActive', {
                          name: selectedBuilding.name,
                        })
                      : viewModel.facilities.activeProject !== undefined
                        ? t('clubFinances.a11y.cannotUpgradeCrewBusy', {
                            name: selectedBuilding.name,
                          })
                        : selectedBuilding.upgradeBlockedReason !== undefined
                          ? selectedBuilding.upgradeBlockedReason
                          : t('clubFinances.a11y.upgradeForCost', {
                              name: selectedBuilding.name,
                              amount: formatCurrency(
                                t,
                                selectedBuilding.upgradeCost,
                              ),
                            })
                }
                accessibilityState={{ disabled: !upgradeOfferable }}
                disabled={!upgradeOfferable}
                onPress={() => onUpgradeFacility?.(selectedBuilding.id)}
                className={
                  upgradeOfferable
                    ? 'min-h-12 flex-1 items-center justify-center border-2 border-b-4 border-ink bg-blue px-2'
                    : 'min-h-12 flex-1 items-center justify-center border-2 border-ink/30 bg-ink/5 px-2'
                }
              >
                <PixelText
                  className={
                    upgradeOfferable
                      ? 'text-center text-sm uppercase text-white'
                      : 'text-center text-sm uppercase text-ink/35'
                  }
                >
                  {selectedBuilding.status !== 'operational'
                    ? t('clubFinances.projectActive')
                    : viewModel.facilities.activeProject !== undefined
                      ? t('clubFinances.crewBusy')
                      : selectedBuilding.upgradeBlockedReason !== undefined
                        ? t('clubFinances.lockedReason', {
                            reason:
                              selectedBuilding.upgradeBlockedDivision ===
                              undefined
                                ? t('clubFinances.lockedPromotion')
                                : `D${selectedBuilding.upgradeBlockedDivision}`,
                          })
                        : selectedBuilding.upgradeCost === undefined
                          ? t('clubFinances.maxLevel')
                          : t('clubFinances.upgradeCost', {
                              amount: formatCurrency(
                                t,
                                selectedBuilding.upgradeCost,
                              ),
                            })}
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
              accessibilityLabel={
                selectedBuilding.canClose
                  ? t('clubFinances.a11y.closeAndRecover', {
                      name: selectedBuilding.name,
                      amount: formatCurrency(t, selectedBuilding.closeRefund),
                    })
                  : t('clubFinances.a11y.cannotCloseProjectActive', {
                      name: selectedBuilding.name,
                    })
              }
              accessibilityState={{ disabled: !selectedBuilding.canClose }}
              disabled={!selectedBuilding.canClose}
              onPress={() => onCloseFacility?.(selectedBuilding.id)}
              className={
                selectedBuilding.canClose
                  ? 'mt-2 min-h-12 items-center justify-center border-2 border-b-4 border-red-dark bg-white px-2'
                  : 'mt-2 min-h-12 items-center justify-center border-2 border-ink/30 bg-ink/5 px-2'
              }
            >
              <PixelText
                className={
                  selectedBuilding.canClose
                    ? 'text-center text-sm uppercase text-red-dark'
                    : 'text-center text-sm uppercase text-ink/35'
                }
              >
                {selectedBuilding.canClose
                  ? t('clubFinances.closeRefund', {
                      amount: formatCurrency(t, selectedBuilding.closeRefund),
                    })
                  : t('clubFinances.projectActive')}
              </PixelText>
            </Pressable>
          </View>
        ) : null}
      </PaperPanel>
    </View>
  );
}

interface BuildMenuSectionProps {
  viewModel: ClubFinancesViewModel;
  guideFocus?: AssistantGuideFocus;
  guidedFirstFacility: boolean;
  guidedFacilityPhase: GuidedFirstFacilityPhase;
  selectedBuildType: FacilityTypeViewModel | null;
  setSelectedBuildType: Dispatch<SetStateAction<FacilityTypeViewModel | null>>;
  setSelectedBuildingId: Dispatch<SetStateAction<string | null>>;
  setRelocatingBuildingId: Dispatch<SetStateAction<string | null>>;
  buildMenuReminder: string | null;
  setBuildMenuReminder: Dispatch<SetStateAction<string | null>>;
  requiredBuildType?: FacilityTypeViewModel;
  guidanceNudgeTarget?: GuidanceNudgeTarget;
  guidanceNudgeToken?: number;
  incomeFacilitiesFlashToken?: number;
  reduceMotion: boolean;
  onRequiredBuildTypeBlocked?: (required: FacilityTypeViewModel) => void;
  facilityGuideBuildTargetRef: RefObject<View | null>;
  scrollFacilityGuideTargetIntoView: (phase: GuidedFirstFacilityPhase) => void;
  revealFacilityPlacement: () => void;
  /** Lights the Fan Shop and Stadium Stand after the board's loan lands. */
  guideIncomeFacilities: boolean;
}

/**
 * The catalog, lifted out of the grounds panel so a wide window can stand it
 * beside the grid instead of below it. Its own board section comes first on a
 * phone, so a choice leads forward to the grounds instead of jumping upward.
 */
function BuildMenuSection({
  viewModel,
  guideFocus,
  guidedFirstFacility,
  guidedFacilityPhase,
  selectedBuildType,
  setSelectedBuildType,
  setSelectedBuildingId,
  setRelocatingBuildingId,
  buildMenuReminder,
  setBuildMenuReminder,
  requiredBuildType,
  guidanceNudgeTarget,
  guidanceNudgeToken,
  incomeFacilitiesFlashToken,
  reduceMotion,
  onRequiredBuildTypeBlocked,
  facilityGuideBuildTargetRef,
  scrollFacilityGuideTargetIntoView,
  revealFacilityPlacement,
  guideIncomeFacilities,
}: BuildMenuSectionProps) {
  const t = useCopy();
  return (
    <View>
      <SectionLabel
        eyebrow={t('clubFinances.buildMenu')}
        title={t('clubFinances.buildTheFacility')}
      />
      <View
        ref={facilityGuideBuildTargetRef}
        collapsable={false}
        className="relative border-2 border-b-4 border-ink bg-white p-3"
        onLayout={() => {
          if (guidedFirstFacility && guidedFacilityPhase === 'build-menu') {
            scrollFacilityGuideTargetIntoView('build-menu');
          }
        }}
      >
        {buildMenuReminder !== null ? (
          <Text
            accessibilityLiveRegion="polite"
            className="mb-3 border-2 border-gold-dark bg-gold-light px-3 py-3 text-sm font-bold leading-5 text-ink"
          >
            {buildMenuReminder}
          </Text>
        ) : null}
        <View
          className={
            guidedFirstFacility && guidedFacilityPhase === 'build-menu'
              ? 'mt-20 flex-row flex-wrap gap-2'
              : 'flex-row flex-wrap gap-2'
          }
        >
          {viewModel.facilities.catalog.map((entry) => {
            const selected = selectedBuildType === entry.type;
            const knownAdjacency = viewModel.facilities.discoveredAdjacencies
              .map((id) => facilityAdjacencyPresentation(id, t))
              .find((presentation) =>
                presentation?.facilityTypes.includes(entry.type),
              );
            const adjacencyGuidance =
              knownAdjacency === undefined
                ? undefined
                : `${knownAdjacency.pairLabel} · ${knownAdjacency.effectLabel}`;
            const guideAllowsType =
              !guidedFirstFacility ||
              guidedFirstFacilityAllowsBuildType(entry.type);
            const requiredBuildChoiceBlocked =
              requiredBuildType !== undefined &&
              entry.type !== requiredBuildType;
            const entryEnabled =
              entry.available &&
              entry.affordable &&
              guideAllowsType &&
              !requiredBuildChoiceBlocked;
            const openingPitchChoiceBlocked =
              entry.blockedByOpeningTrainingPitch || !guideAllowsType;
            const blockedChoiceCanExplain =
              openingPitchChoiceBlocked || requiredBuildChoiceBlocked;
            const guidedIncome =
              guideIncomeFacilities && isIncomeFacilityType(entry.type);
            // Sentence per catalog key, joined with a space — the same shape
            // the sponsor cards use. Building it as one template would bake
            // English clause order into every language.
            const cardAccessibilityLabel = [
              t('clubFinances.a11y.facilityCard', {
                name: entry.name,
                built: entry.builtCount,
                limit: entry.buildLimit,
                effect: entry.effectLabel.replace(/[.!?]+$/u, ''),
                width: entry.width,
                height: entry.height,
              }),
              t('clubFinances.a11y.buildTimeWeeks', {
                n: entry.buildWeeks,
                count: entry.buildWeeks,
              }),
              adjacencyGuidance === undefined
                ? undefined
                : t('clubFinances.a11y.knownComboIs', {
                    combo: adjacencyGuidance,
                  }),
              guideAllowsType
                ? undefined
                : t('clubFinances.a11y.buildTheTrainingPitchFirst'),
              entry.available
                ? t('clubFinances.a11y.buildCostAndUpkeep', {
                    cost: formatCurrency(t, entry.buildCost),
                    upkeep: formatCurrency(t, entry.weeklyUpkeep),
                  })
                : t('clubFinances.a11y.lockedSentence'),
              entry.blockedReason ||
                (entry.available &&
                !entry.affordable &&
                entry.affordabilityShortfall > 0
                  ? t('clubFinances.a11y.needMoreSentence', {
                      amount: formatCurrency(t, entry.affordabilityShortfall),
                    })
                  : undefined),
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <Fragment key={entry.type}>
                {/* Keep the banner beside the two cards it introduces. Their
                    top-of-menu position now keeps all three in the natural
                    opening viewport, so tutorial entry must not scroll. */}
                {guidedIncome && entry.type === 'fan-shop' ? (
                  <View className="w-full border-2 border-b-4 border-gold-dark bg-gold-light px-3 py-3">
                    <PixelText className="text-sm uppercase tracking-wide text-ink">
                      {t('clubFinances.bertSays')}
                    </PixelText>
                    <Text className="mt-1 text-sm leading-5 text-ink">
                      {viewModel.facilities.activeProject === undefined
                        ? t('clubFinances.incomeFacilitiesHint')
                        : t('clubFinances.incomeFacilitiesBusyHint', {
                            name: viewModel.facilities.activeProject.name,
                          })}
                    </Text>
                  </View>
                ) : null}
                <View
                  className={
                    guideFocus === 'coaching-office' &&
                    entry.type === 'coaching-office'
                      ? 'relative mt-20 w-[48%]'
                      : 'relative w-[48%]'
                  }
                >
                  {/* The inbox sends you here to build a Coaching Office, and the
                    viewport already lands on it — but nothing said which of
                    the eight cards to press. It wears the same gold tutorial
                    glow as the Train button and the same arrow. */}
                  {guideFocus === 'coaching-office' &&
                  entry.type === 'coaching-office' &&
                  !selected ? (
                    <TutorialTapCue
                      label={t('clubFinances.tapHere')}
                      detail={t('clubFinances.coachingOfficeCue')}
                      style={{
                        left: '50%',
                        marginLeft: -TUTORIAL_TAP_CUE_WIDTH / 2,
                        top: -82,
                      }}
                    />
                  ) : null}
                  {guidedFirstFacility &&
                  guidedFacilityPhase === 'build-menu' &&
                  entry.type === 'training-pitch' ? (
                    <TutorialTapCue
                      label={t('clubFinances.tapHere')}
                      detail={t('clubFinances.trainingPitchCue')}
                      style={{
                        left: '50%',
                        marginLeft: -TUTORIAL_TAP_CUE_WIDTH / 2,
                        top: -82,
                      }}
                    />
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={cardAccessibilityLabel}
                    accessibilityState={{ disabled: !entryEnabled, selected }}
                    disabled={!entryEnabled && !blockedChoiceCanExplain}
                    onPress={() => {
                      if (requiredBuildChoiceBlocked) {
                        setSelectedBuildType(null);
                        setSelectedBuildingId(null);
                        setRelocatingBuildingId(null);
                        setBuildMenuReminder(null);
                        onRequiredBuildTypeBlocked?.(requiredBuildType);
                        return;
                      }
                      if (openingPitchChoiceBlocked) {
                        setBuildMenuReminder(
                          t('clubFinances.buildTrainingPitchFirstReminder'),
                        );
                        return;
                      }
                      setBuildMenuReminder(null);
                      const nextBuildType = selected ? null : entry.type;
                      setSelectedBuildType(nextBuildType);
                      setSelectedBuildingId(null);
                      setRelocatingBuildingId(null);
                      // Every build selection shows the same immediate grid
                      // marker. The opening lesson keeps its own scroll target.
                      if (nextBuildType !== null) {
                        revealFacilityPlacement();
                      }
                    }}
                    className={
                      selected
                        ? 'relative min-h-36 w-full border-2 border-b-4 border-blue-dark bg-blue-light/30 p-2'
                        : (guideFocus === 'coaching-office' &&
                              entry.type === 'coaching-office') ||
                            guidedIncome
                          ? 'relative min-h-36 w-full border-2 border-b-4 border-gold-dark bg-gold-light/25 p-2'
                          : entryEnabled
                            ? 'relative min-h-36 w-full border-2 border-b-4 border-ink bg-white p-2'
                            : 'relative min-h-36 w-full border-2 border-ink/20 bg-ink/5 p-2'
                    }
                    // Lit even when the club cannot afford it yet: the point
                    // of the highlight is which buildings earn, and a shop
                    // the manager has to save up for is still the answer.
                    style={
                      (guideFocus === 'coaching-office' &&
                        entry.type === 'coaching-office') ||
                      guidedIncome
                        ? styles.guidedFacilityGlow
                        : undefined
                    }
                  >
                    <GuidanceDoubleFlash
                      trigger={
                        guidedIncome
                          ? incomeFacilitiesFlashToken
                          : (guidanceNudgeTarget === 'coaching-office' &&
                                entry.type === 'coaching-office') ||
                              (guidanceNudgeTarget ===
                                'training-ground-facility' &&
                                entry.type === 'training-pitch')
                            ? guidanceNudgeToken
                            : undefined
                      }
                      playOnMount={guidedIncome}
                      reduceMotion={reduceMotion}
                    />
                    <View className="mb-2 flex-row items-start gap-2">
                      <View style={{ opacity: entryEnabled ? 1 : 0.35 }}>
                        <FacilitySprite
                          type={entry.type}
                          size={32}
                          showLevel={false}
                        />
                      </View>
                      {/* German compounds are single unbreakable words wider
                          than this column — Trainingsplatz drew as
                          "TRAININGSPL / ATZ" and Trainerbüro as "TRAINERBÜR /
                          O". English never hits it because every facility name
                          has a space to wrap at. Two lines plus shrink-to-fit
                          keeps the word whole in every locale. */}
                      <PixelText
                        numberOfLines={2}
                        adjustsFontSizeToFit
                        className={
                          entryEnabled
                            ? 'flex-1 text-sm uppercase leading-4 text-ink'
                            : 'flex-1 text-sm uppercase leading-4 text-ink/35'
                        }
                      >
                        {entry.name}
                      </PixelText>
                    </View>
                    <Text
                      className={
                        entryEnabled
                          ? 'text-xs font-bold leading-4 text-blue-dark'
                          : 'text-xs font-bold leading-4 text-ink/35'
                      }
                    >
                      {entry.effectLabel}
                    </Text>
                    <Text
                      className={
                        entryEnabled
                          ? 'mt-1 font-mono text-sm text-ink/70'
                          : 'mt-1 font-mono text-sm text-ink/30'
                      }
                    >
                      {entry.available
                        ? t('clubFinances.facilityCardStats', {
                            built: entry.builtCount,
                            limit: entry.buildLimit,
                            width: entry.width,
                            height: entry.height,
                            cost: formatCurrency(t, entry.buildCost),
                            weeks: entry.buildWeeks,
                            upkeep: formatCurrency(t, entry.weeklyUpkeep),
                          })
                        : t('clubFinances.locked')}
                    </Text>
                    {adjacencyGuidance !== undefined && entry.available ? (
                      <View className="mt-2 border-t border-pitch-dark/25 pt-2">
                        <PixelText className="text-xs uppercase tracking-wide text-pitch-ink">
                          {t('clubFinances.knownCombo')}
                        </PixelText>
                        <Text className="mt-1 text-xs leading-4 text-ink/65">
                          {adjacencyGuidance}
                        </Text>
                      </View>
                    ) : null}
                    {entry.blockedReason ? (
                      <Text className="mt-1 text-xs font-bold text-red-dark">
                        {entry.blockedReason}
                      </Text>
                    ) : null}
                    {entry.available &&
                    !entry.affordable &&
                    entry.affordabilityShortfall > 0 ? (
                      <PixelText className="mt-1 text-xs uppercase text-red-dark">
                        {t('clubFinances.needMoreAmount', {
                          amount: formatCurrency(
                            t,
                            entry.affordabilityShortfall,
                          ),
                        })}
                      </PixelText>
                    ) : null}
                  </Pressable>
                </View>
              </Fragment>
            );
          })}
        </View>
      </View>
    </View>
  );
}

/**
 * What the grounds have taught the manager so far. Sits under the build menu
 * because the pairs are a reason to pick one card over another.
 */
function FacilityPairBonusesSection({
  facilities,
  guideAnchorRef,
  onGuideAnchorLayout,
}: {
  readonly facilities: ClubFacilityGridViewModel;
  readonly guideAnchorRef: RefObject<View | null>;
  readonly onGuideAnchorLayout: () => void;
}) {
  const t = useCopy();
  return (
    <View
      ref={guideAnchorRef}
      collapsable={false}
      onLayout={onGuideAnchorLayout}
    >
      <SectionLabel
        eyebrow={t('clubFinances.knownCombo')}
        title={t('clubFinances.facilityPairBonuses')}
      />
      <View className="gap-2 border-2 border-b-4 border-ink bg-white p-3">
        {facilities.discoveredAdjacencies.length === 0 ? (
          <Text className="text-sm leading-4 text-ink/70">
            {t('clubFinances.noPairingsDiscoveredYet')}
          </Text>
        ) : (
          facilities.discoveredAdjacencies.map((adjacency) => {
            const presentation = facilityAdjacencyPresentation(adjacency, t);
            const active = facilities.activeAdjacencies.includes(adjacency);
            return (
              <View
                key={adjacency}
                className="flex-row items-start gap-3 border border-ink/20 bg-white px-3 py-3"
              >
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
                        {t('clubFinances.whyItWorks', {
                          reason: presentation.rationale,
                        })}
                      </Text>
                    </>
                  ) : null}
                </View>
                <StatusChip
                  label={
                    active
                      ? t('clubFinances.adjacencyActive')
                      : t('clubFinances.adjacencyKnown')
                  }
                  tone={active ? 'success' : 'normal'}
                />
              </View>
            );
          })
        )}
      </View>
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
    <View
      ref={trainingGroundRef}
      collapsable={false}
      onLayout={onTrainingGroundLayout}
    >
      <SectionLabel
        eyebrow={t('clubFinances.oneBigCall')}
        title={t('clubFinances.trainingGround')}
        right={<StatusChip label={t('clubFinances.facility01')} />}
      />
      <PaperPanel
        kicker={t('clubFinances.worksOrder')}
        title={t('clubFinances.turnMudIntoMomentum')}
        stamp={
          facility.built
            ? t('clubFinances.stampBuilt')
            : facility.underConstruction
              ? t('clubFinances.stampWeeksLeft', {
                  weeks: facility.weeksRemaining ?? 0,
                })
              : t('clubFinances.stampDecision')
        }
      >
        <View className="flex-row items-center gap-4 border-y-2 border-ink py-4">
          <View className="items-center justify-center border-2 border-emerald-900 bg-pitch p-2">
            <ManagementSprite
              spriteKey={
                facility.underConstruction
                  ? 'facility:worksite'
                  : 'facility:training-pitch:l1'
              }
              width={58}
              accessibilityLabel={
                facility.underConstruction
                  ? t('clubFinances.a11y.trainingGroundConstructionSite')
                  : t('clubFinances.trainingGround')
              }
            />
          </View>
          <View className="flex-1">
            <PixelText className="text-base uppercase text-ink">
              {t('clubFinances.trainingGroundLevel1')}
            </PixelText>
            <Text className="mt-2 text-sm leading-4 text-ink/70">
              {t('clubFinances.aProperWeeklyPractice')}
            </Text>
          </View>
        </View>
        <View className="mt-3 flex-row gap-2">
          <Metric
            label={t('clubFinances.buildCost')}
            value={formatCurrency(t, facility.cost)}
            tone="negative"
          />
          <Metric
            label={t('clubFinances.weeklyReturn')}
            value={t('clubFinances.plusTrainingPoints', {
              points: facility.weeklyTrainingPoints,
            })}
            tone="positive"
          />
        </View>
        <PixelText className="mt-3 text-sm uppercase tracking-wide text-ink/70">
          {t('clubFinances.m1Offer', {
            cost: formatCurrency(t, facility.cost),
            points: facility.weeklyTrainingPoints,
          })}
        </PixelText>
        {!facility.built && !facility.underConstruction ? (
          <View
            className={
              guideTrainingGround
                ? 'relative mt-3 border-2 border-blue-dark bg-blue-light p-1'
                : 'relative mt-3'
            }
          >
            {guideTrainingGround ? (
              <TutorialTapCue
                detail={t('clubFinances.buildTheFacility')}
                style={{
                  left: '50%',
                  marginLeft: -TUTORIAL_TAP_CUE_WIDTH / 2,
                  top: -72,
                }}
              />
            ) : null}
            <ActionButton
              label={t('clubFinances.approveBuild')}
              accessibilityLabel={t(
                'clubFinances.a11y.buildTheTrainingGroundFor8000',
              )}
              onPress={onBuildTrainingGround}
              disabled={!facility.affordable}
            />
          </View>
        ) : null}
        {facility.underConstruction ? (
          <View className="mt-3 border-2 border-b-4 border-amber-800 bg-amber-100 p-3">
            <Text className="text-center font-pixel text-base uppercase text-amber-900">
              {t('clubFinances.sportsFacilityInConstruction')}
            </Text>
            <Text className="mt-2 text-center text-sm text-ink/65">
              {t('clubFinances.benefitsStartWhenThe')}
            </Text>
          </View>
        ) : null}
        {!facility.built &&
        !facility.underConstruction &&
        !facility.affordable ? (
          <PixelText className="mt-2 text-center text-sm uppercase tracking-wide text-red-dark">
            {t('clubFinances.insufficientBalance')}
          </PixelText>
        ) : null}
      </PaperPanel>
    </View>
  );
}

function facilityColor(building: ClubFacilityBuildingViewModel): string {
  if (building.type === 'training-pitch' || building.type === 'youth-field')
    return '#8fd98f';
  if (building.type === 'medical-bay') return '#f7d7ba';
  if (building.type === 'fan-shop' || building.type === 'stadium-stand')
    return '#C8DDF0';
  return '#f7d7ba';
}

/** The temporary gold placement instruction and shared tutorial glow. */
const styles = StyleSheet.create({
  facilityPlacementHelperAnchor: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
  },
  facilityPlacementHelper: {
    width: 144,
    opacity: 0.5,
  },
  guidedFacilityGlow: {
    boxShadow: '0 0 12px 4px rgba(237, 181, 74, 0.9)',
    shadowColor: '#edb54a',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 9,
    elevation: 10,
  },
});
