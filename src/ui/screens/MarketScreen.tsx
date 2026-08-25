import {
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type Dispatch,
  type ReactNode,
  type RefObject,
  type SetStateAction,
} from 'react';
import {
  AccessibilityInfo,
  ScrollView,
  Text,
  View,
  type GestureResponderEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import type { AssistantGuideFocus } from '../../content';
import type { ContractOffer, ContractPerk, PitchCard } from '../../game/market';
import { PROMOTION_WAGE_CLAUSE_PERCENT } from '../../game/contract-wages';
import {
  ActionButton,
  Metric,
  PaperPanel,
  SectionLabel,
  StatusChip,
  formatCurrency,
} from '../components/Scorecard';
import { EmptyDocket } from '../components/EmptyDocket';
import { ManagementSprite } from '../components/ManagementSprite';
import { PixelPortrait } from '../components/PixelPortrait';
import { SfxPressable as Pressable } from '../components/SfxPressable';
import type {
  MarketNegotiationViewModel,
  MarketSectionId,
  MarketViewModel,
} from '../market-models';
import { TutorialTapCue } from '../TutorialTapCue';
import {
  TUTORIAL_TAP_CUE_ABOVE_OFFSET,
  TUTORIAL_TAP_CUE_RESERVED_SPACE,
  TUTORIAL_TAP_CUE_WIDTH,
  type TutorialAnchorLayout,
} from '../tutorial-cue-position';
import { SectionFlow, type FlowSection } from '../layout/SectionFlow';
import { ScreenTabs, type ScreenTab } from '../components/ScreenTabs';
import { useLayoutMode } from '../layout/use-layout-mode';
import { PixelText } from '../components/PixelText';
import { useDesktopContentStyle } from '../layout/DesktopClamp';
import { useTapGuard } from '../use-tap-guard';
import { AgentFinalDemandGate } from '../AgentFinalDemandGate';
import { useGuideAnchor } from '../use-guide-anchor';
import { contractDraftPerk } from '../../application/market-view-model';
import { useCopy } from '../../i18n';
import {
  GuidanceDoubleFlash,
  type GuidanceNudgeTarget,
} from '../GuidanceDoubleFlash';

export interface MarketScreenProps {
  readonly viewModel: MarketViewModel;
  readonly onStartScoutMission: (optionId: string) => void;
  readonly onOpenScoutReport: (playerId: string) => void;
  readonly onDismissScoutReport: (playerId: string) => void;
  readonly onBuyDetailedScoutReport: (playerId: string) => void;
  readonly onTransferAction: (
    playerId: string,
    direction: 'BUY' | 'SELL',
    bidId?: string,
  ) => void;
  readonly onHireCoach: (coachId: string, role: 'HEAD' | 'ASSISTANT') => void;
  readonly onSignYouth: (playerId: string) => void;
  readonly onDeclineYouth: () => void;
  readonly onSubmitContractOffer: (
    offer: ContractOffer,
    pitchCard?: PitchCard,
  ) => void;
  readonly onCloseNegotiation: () => void;
  readonly onDismissGuideFocus?: () => void;
  readonly onDealsGuideAnchorChange?: (
    anchor: TutorialAnchorLayout | null,
  ) => void;
  readonly guideFocus?: AssistantGuideFocus;
  readonly requestedSection?: MarketSectionId;
  readonly requestedSectionToken?: number;
  readonly lockedSection?: MarketSectionId;
  readonly onBlockedSectionChange?: () => void;
  readonly guidanceNudgeTarget?: GuidanceNudgeTarget;
  readonly guidanceNudgeToken?: number;
  readonly reduceMotion?: boolean;
}

const MIN_GUIDE_SCROLL_DISTANCE = 24;

function initialSection(viewModel: MarketViewModel): MarketSectionId {
  if (
    viewModel.negotiation !== undefined &&
    viewModel.sections.includes('TRANSFERS')
  ) {
    return 'TRANSFERS';
  }
  if (
    viewModel.youth?.status === 'OPEN' &&
    viewModel.sections.includes('YOUTH')
  )
    return 'YOUTH';
  if (viewModel.sections.includes('SCOUT')) return 'SCOUT';
  return viewModel.sections[0] ?? 'COACHES';
}

export function MarketScreen({
  viewModel,
  onStartScoutMission,
  onOpenScoutReport,
  onDismissScoutReport,
  onBuyDetailedScoutReport,
  onTransferAction,
  onHireCoach,
  onSignYouth,
  onDeclineYouth,
  onSubmitContractOffer,
  onCloseNegotiation,
  onDismissGuideFocus,
  onDealsGuideAnchorChange,
  guideFocus,
  requestedSection,
  requestedSectionToken,
  lockedSection,
  onBlockedSectionChange,
  guidanceNudgeTarget,
  guidanceNudgeToken,
  reduceMotion = false,
}: MarketScreenProps) {
  const t = useCopy();
  const desktopContent = useDesktopContentStyle();
  // The store re-validates every spend, so a double-tap costs nothing — but
  // the second call earns a phantom error buzz and banner. Guard the three
  // spend callbacks the way the negotiation sheet already guards its offers.
  const guardTap = useTapGuard();
  const [section, setSection] = useState<MarketSectionId>(() =>
    lockedSection !== undefined && viewModel.sections.includes(lockedSection)
      ? lockedSection
      : initialSection(viewModel),
  );
  const [focusedScoutedPlayerId, setFocusedScoutedPlayerId] =
    useState<string>();
  const [focusedListingToken, setFocusedListingToken] = useState(0);
  const [scrollDismissedGuideFocus, setScrollDismissedGuideFocus] =
    useState<AssistantGuideFocus>();
  const visibleGuideFocus =
    scrollDismissedGuideFocus === guideFocus ? undefined : guideFocus;
  const marketViewportRef = useRef<View>(null);
  const marketScrollRef = useRef<ScrollView>(null);
  const focusedListingRef = useRef<View>(null);
  const focusedScrollDoneRef = useRef<string | undefined>(undefined);
  const southAmericaScoutActionRef = useRef<View>(null);
  const latestScrollOffsetRef = useRef(0);
  const scoutDragStartOffsetRef = useRef(0);
  const youthSectionVisible =
    viewModel.sections.includes('YOUTH') && viewModel.youth !== undefined;
  const scoutSectionVisible = viewModel.sections.includes('SCOUT');
  const transferSectionVisible = viewModel.sections.includes('TRANSFERS');
  const coachSectionVisible = viewModel.sections.includes('COACHES');
  const lockedSectionVisible =
    lockedSection !== undefined && viewModel.sections.includes(lockedSection);
  const guideDealsTab =
    guideFocus === 'scout-report' &&
    section === 'SCOUT' &&
    transferSectionVisible;
  const {
    anchorRef: dealsGuideAnchorRef,
    scheduleMeasurement: scheduleDealsGuideMeasurement,
  } = useGuideAnchor(guideDealsTab, onDealsGuideAnchorChange);

  const dismissScrollGuide = (focus: AssistantGuideFocus) => {
    setScrollDismissedGuideFocus(focus);
    onDismissGuideFocus?.();
  };

  const handleSignPlayer = (playerId: string) => {
    const listing = viewModel.transfers.find(
      (candidate) =>
        candidate.direction === 'BUY' && candidate.playerId === playerId,
    );
    if (listing === undefined) {
      void AccessibilityInfo.announceForAccessibility(
        t('market.scoutedPlayerUnavailable'),
      );
      return;
    }
    focusedScrollDoneRef.current = undefined;
    setFocusedScoutedPlayerId(playerId);
    setFocusedListingToken((token) => token + 1);
    setSection('TRANSFERS');
  };

  const handleFocusedListingLayout = () => {
    const playerId = focusedScoutedPlayerId;
    const target = focusedListingRef.current;
    const viewport = marketViewportRef.current;
    if (
      playerId === undefined ||
      focusedScrollDoneRef.current === playerId ||
      target === null ||
      viewport === null
    ) {
      return;
    }
    focusedScrollDoneRef.current = playerId;
    target.measureInWindow((_targetX, targetY) => {
      viewport.measureInWindow((_viewportX, viewportY) => {
        marketScrollRef.current?.scrollTo({
          y: Math.max(
            0,
            latestScrollOffsetRef.current + targetY - viewportY - 16,
          ),
          animated: !reduceMotion,
        });
        const listing = viewModel.transfers.find(
          (candidate) => candidate.playerId === playerId,
        );
        if (listing !== undefined) {
          void AccessibilityInfo.announceForAccessibility(
            t('market.a11y.actionForPlayer', {
              action: listing.actionLabel,
              player: listing.playerName,
            }),
          );
        }
      });
    });
  };

  const handleScrollBeginDrag = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    if (guideFocus === 'transfer-list') {
      dismissScrollGuide('transfer-list');
      return;
    }
    if (guideFocus === 'scout-mission') {
      scoutDragStartOffsetRef.current = event.nativeEvent.contentOffset.y;
    }
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const currentOffset = event.nativeEvent.contentOffset.y;
    latestScrollOffsetRef.current = currentOffset;
    if (guideDealsTab) scheduleDealsGuideMeasurement();
    if (guideFocus === 'transfer-list') {
      dismissScrollGuide('transfer-list');
      return;
    }
    if (
      guideFocus !== 'scout-mission' ||
      scrollDismissedGuideFocus === 'scout-mission'
    )
      return;
    const dragStartOffset = scoutDragStartOffsetRef.current;
    if (currentOffset < dragStartOffset + MIN_GUIDE_SCROLL_DISTANCE) return;

    const viewport = marketViewportRef.current;
    const target = southAmericaScoutActionRef.current;
    if (viewport === null || target === null) return;
    viewport.measureInWindow(
      (_viewportX, viewportY, _viewportWidth, viewportHeight) => {
        target.measureInWindow(
          (_targetX, targetY, _targetWidth, targetHeight) => {
            const targetFullyVisible =
              targetY >= viewportY &&
              targetY + targetHeight <= viewportY + viewportHeight;
            if (targetFullyVisible) dismissScrollGuide('scout-mission');
          },
        );
      },
    );
  };

  useEffect(() => {
    if (lockedSection !== undefined && lockedSectionVisible) {
      setSection(lockedSection);
    }
  }, [lockedSection, lockedSectionVisible]);

  useEffect(() => {
    if (lockedSection !== undefined) return;
    if (viewModel.negotiation !== undefined) setSection('TRANSFERS');
  }, [lockedSection, viewModel.negotiation?.id]);

  useEffect(() => {
    if (!viewModel.sections.includes(section))
      setSection(initialSection(viewModel));
  }, [section, viewModel]);

  useEffect(() => {
    if (
      focusedScoutedPlayerId !== undefined &&
      !viewModel.transfers.some(
        (listing) => listing.playerId === focusedScoutedPlayerId,
      )
    ) {
      setFocusedScoutedPlayerId(undefined);
    }
  }, [focusedScoutedPlayerId, viewModel.transfers]);

  useEffect(() => {
    if (guideFocus === 'scout-mission') {
      scoutDragStartOffsetRef.current = latestScrollOffsetRef.current;
    }
  }, [guideFocus]);

  useEffect(() => {
    if (lockedSection !== undefined) return;
    if (guideFocus === 'youth-intake' && youthSectionVisible)
      setSection('YOUTH');
    else if (
      (guideFocus === 'scout-mission' || guideFocus === 'scout-report') &&
      scoutSectionVisible
    )
      setSection('SCOUT');
    else if (
      (guideFocus === 'transfer-list' ||
        guideFocus === 'transfer-bid' ||
        guideFocus === 'transfer-negotiation') &&
      transferSectionVisible
    )
      setSection('TRANSFERS');
    else if (
      (guideFocus === 'coach-market' ||
        guideFocus === 'coach-hire' ||
        guideFocus === 'assistant-coach-hire') &&
      coachSectionVisible
    )
      setSection('COACHES');
  }, [
    coachSectionVisible,
    guideFocus,
    lockedSection,
    scoutSectionVisible,
    transferSectionVisible,
    youthSectionVisible,
  ]);

  const negotiationDraft = useContractDraft(viewModel.negotiation);
  const layoutMode = useLayoutMode();

  useEffect(() => {
    if (lockedSection !== undefined) return;
    if (requestedSection === 'YOUTH' && youthSectionVisible)
      setSection('YOUTH');
    else if (requestedSection === 'SCOUT' && scoutSectionVisible)
      setSection('SCOUT');
    else if (requestedSection === 'TRANSFERS' && transferSectionVisible)
      setSection('TRANSFERS');
    else if (requestedSection === 'COACHES' && coachSectionVisible)
      setSection('COACHES');
  }, [
    coachSectionVisible,
    lockedSection,
    requestedSection,
    requestedSectionToken,
    scoutSectionVisible,
    transferSectionVisible,
    youthSectionVisible,
  ]);

  /**
   * The docket's boards, in desk order. The strip rides in the header rather
   * than under the registration panel: the manager reads the office name, then
   * picks a board, exactly as the League screen's competition office works.
   */
  const docketTabs: ScreenTab<MarketSectionId>[] = [
    ...(youthSectionVisible
      ? [
          {
            id: 'YOUTH' as const,
            label: t('market.tab.youth'),
            accessibilityLabel: t('market.a11y.youthDesk'),
          },
        ]
      : []),
    ...(scoutSectionVisible
      ? [
          {
            id: 'SCOUT' as const,
            label: t('market.tab.scout'),
            accessibilityLabel: t('market.a11y.scoutDesk'),
          },
        ]
      : []),
    ...(transferSectionVisible
      ? [
          {
            id: 'TRANSFERS' as const,
            label: t('market.tab.deals'),
            accessibilityLabel: t('market.a11y.dealsDesk'),
          },
        ]
      : []),
    ...(coachSectionVisible
      ? [
          {
            id: 'COACHES' as const,
            label: t('market.tab.coaches'),
            accessibilityLabel: t('market.a11y.coachesDesk'),
          },
        ]
      : []),
  ];

  const header = (
    <View className="mb-5">
      <View className="flex-row items-end justify-between gap-3">
        <View className="flex-1">
          <Text className="font-pixel text-sm uppercase tracking-[2px] text-blue-dark">
            {t('market.recruitmentOffice')}
          </Text>
          <Text className="mt-1 font-pixel text-xl uppercase text-ink">
            {t('market.marketDocket')}
          </Text>
        </View>
        <StatusChip label={viewModel.periodLabel} />
      </View>
      <ScreenTabs
        tabs={docketTabs}
        activeId={section}
        anchor={
          guideDealsTab
            ? {
                id: 'TRANSFERS',
                ref: dealsGuideAnchorRef,
                onLayout: scheduleDealsGuideMeasurement,
              }
            : undefined
        }
        onSelect={(nextSection) => {
          if (lockedSection !== undefined && nextSection !== lockedSection) {
            onBlockedSectionChange?.();
            return;
          }
          if (nextSection !== 'TRANSFERS') {
            setFocusedScoutedPlayerId(undefined);
          }
          setSection(nextSection);
        }}
        flashTabId={
          guidanceNudgeTarget === 'youth-intake' && section !== 'YOUTH'
            ? 'YOUTH'
            : guidanceNudgeTarget === 'head-coach-market' &&
                section !== 'COACHES'
              ? 'COACHES'
              : undefined
        }
        flashToken={guidanceNudgeToken}
        reduceMotion={reduceMotion}
      />
    </View>
  );

  const youthDesk = viewModel.youth ? (
    <YouthDesk
      viewModel={viewModel}
      onSignYouth={(playerId) => guardTap(() => onSignYouth(playerId))}
      onDeclineYouth={onDeclineYouth}
      guideFocus={visibleGuideFocus}
      guidanceNudgeTarget={guidanceNudgeTarget}
      guidanceNudgeToken={guidanceNudgeToken}
      reduceMotion={reduceMotion}
    />
  ) : null;
  const scoutDesk = scoutSectionVisible ? (
    <ScoutingDesk
      viewModel={viewModel}
      onStartScoutMission={(missionId) =>
        guardTap(() => onStartScoutMission(missionId))
      }
      onOpenScoutReport={onOpenScoutReport}
      onDismissScoutReport={onDismissScoutReport}
      onBuyDetailedScoutReport={onBuyDetailedScoutReport}
      onSignPlayer={handleSignPlayer}
      southAmericaScoutActionRef={southAmericaScoutActionRef}
      guideFocus={visibleGuideFocus}
    />
  ) : null;
  const transferDesk = transferSectionVisible ? (
    <TransferDesk
      viewModel={viewModel}
      onTransferAction={(playerId, direction, bidId) => {
        if (playerId === focusedScoutedPlayerId) {
          setFocusedScoutedPlayerId(undefined);
        }
        onTransferAction(playerId, direction, bidId);
      }}
      guideFocus={visibleGuideFocus}
      focusedPlayerId={focusedScoutedPlayerId}
      focusedListingRef={focusedListingRef}
      focusedListingToken={focusedListingToken}
      onFocusedListingLayout={handleFocusedListingLayout}
      reduceMotion={reduceMotion}
    />
  ) : null;
  const coachDesk = coachSectionVisible ? (
    <CoachDesk
      viewModel={viewModel}
      compact={layoutMode !== 'twoColumn'}
      onHireCoach={(coachId, role) =>
        guardTap(() => onHireCoach(coachId, role))
      }
      guidanceNudgeTarget={guidanceNudgeTarget}
      guidanceNudgeToken={guidanceNudgeToken}
      reduceMotion={reduceMotion}
    />
  ) : null;

  /** Only the chosen board is on the desk, so its weight is the one that counts. */
  const activeDeskSection: FlowSection | undefined =
    section === 'YOUTH' && viewModel.youth
      ? {
          key: 'youth-desk',
          weight: 4 + 5 * viewModel.youth.offers.length,
          node: youthDesk,
        }
      : section === 'SCOUT' && scoutSectionVisible
        ? { key: 'scout-desk', weight: 8, node: scoutDesk }
        : section === 'TRANSFERS' && transferSectionVisible
          ? {
              key: 'transfer-desk',
              weight: 3 + 3 * viewModel.transfers.length,
              node: transferDesk,
            }
          : coachSectionVisible
            ? {
                key: 'coach-desk',
                weight: 3 + 4 * viewModel.coaches.length,
                node: coachDesk,
              }
            : undefined;

  const sections: FlowSection[] = [
    ...(transferSectionVisible
      ? [
          {
            key: 'registration',
            weight: 5,
            node: <RegistrationDesk viewModel={viewModel} flush />,
          },
        ]
      : []),
    ...(viewModel.negotiation
      ? [
          {
            key: 'negotiation',
            weight: 10,
            node: (
              <NegotiationPanel
                viewModel={viewModel.negotiation}
                draft={negotiationDraft}
                onSubmitContractOffer={onSubmitContractOffer}
                onClose={onCloseNegotiation}
                guided={visibleGuideFocus === 'transfer-negotiation'}
                flush
              />
            ),
          },
        ]
      : []),
    ...(activeDeskSection === undefined ? [] : [activeDeskSection]),
  ];

  return (
    <View ref={marketViewportRef} collapsable={false} className="flex-1">
      <ScrollView
        ref={marketScrollRef}
        className="flex-1"
        contentContainerStyle={[
          { padding: 16, paddingBottom: 28 },
          desktopContent,
        ]}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        <SectionFlow mode={layoutMode} header={header} sections={sections} />
      </ScrollView>
      {/* Outside the ScrollView: the overlay fills its parent, and the panel it
          belongs to sits somewhere down a scrolling column. */}
      <AgentFinalDemandGate negotiation={viewModel.negotiation} />
    </View>
  );
}

interface RegistrationDeskProps {
  viewModel: MarketViewModel;
  flush?: boolean;
}

function RegistrationDesk({ viewModel, flush = false }: RegistrationDeskProps) {
  const t = useCopy();
  const closed = !viewModel.window.open;
  const countdownLabel = t('market.openInWeeks', {
    n: viewModel.window.weeksUntilOpen,
    count: viewModel.window.weeksUntilOpen,
  });
  return (
    <View className={flush ? undefined : 'mt-5'}>
      <PaperPanel
        kicker={t('market.registrationDesk')}
        title={t('market.buildTheNextGreat')}
        stamp={
          viewModel.window.open
            ? t('market.windowOpenStamp')
            : t('market.windowShutStamp')
        }
        tone={closed ? 'muted' : 'default'}
      >
        <View className="flex-row gap-2">
          <Metric
            label={t('market.cash')}
            value={formatCurrency(t, viewModel.cash)}
            muted={closed}
          />
          <Metric
            label={t('market.level')}
            value={viewModel.divisionLabel}
            muted={closed}
          />
          <Metric
            label={t('market.window')}
            value={
              viewModel.window.open
                ? t('market.windowOpenValue')
                : t('market.windowClosedValue')
            }
            tone={viewModel.window.open ? 'positive' : 'normal'}
            muted={closed}
          />
        </View>
        <Text
          className={
            closed
              ? 'mt-3 text-sm leading-5 text-grey-dark'
              : 'mt-3 text-sm leading-5 text-ink/60'
          }
        >
          {viewModel.window.detail}
        </Text>
      </PaperPanel>
      {closed ? (
        <View className="mt-2">
          <ActionButton
            label={countdownLabel}
            accessibilityLabel={countdownLabel}
            disabled
            onPress={() => undefined}
          />
        </View>
      ) : null}
    </View>
  );
}

function YouthDesk({
  viewModel,
  onSignYouth,
  onDeclineYouth,
  guideFocus,
  guidanceNudgeTarget,
  guidanceNudgeToken,
  reduceMotion,
}: Pick<
  MarketScreenProps,
  | 'viewModel'
  | 'onSignYouth'
  | 'onDeclineYouth'
  | 'guideFocus'
  | 'guidanceNudgeTarget'
  | 'guidanceNudgeToken'
  | 'reduceMotion'
>) {
  const t = useCopy();
  const intake = viewModel.youth;
  if (intake === undefined) return null;
  return (
    <View className="relative overflow-hidden border-[3px] border-ink bg-pitch-ink p-4">
      <GuidanceDoubleFlash
        trigger={
          guidanceNudgeTarget === 'youth-intake'
            ? guidanceNudgeToken
            : undefined
        }
        reduceMotion={reduceMotion}
      />
      {/* The academy gets its own chalkboard stage inside the market desk. */}
      <View
        pointerEvents="none"
        className="absolute -left-12 -top-10 h-40 w-40 rounded-full border-4 border-paper/10"
      />
      <View
        pointerEvents="none"
        className="absolute -right-10 bottom-4 h-32 w-32 rounded-full border-4 border-paper/10"
      />
      <View className="mb-3 flex-row items-end justify-between gap-3">
        <View className="flex-1">
          <Text className="font-pixel text-xs uppercase tracking-[2px] text-gold-light">
            {t('market.pre-seasonAcademyIntake')}
          </Text>
          <Text className="mt-1 font-pixel text-lg uppercase text-white">
            {t('market.meetTheNextGeneration')}
          </Text>
        </View>
        <StatusChip label={intake.rosterLabel} />
      </View>
      <View
        className={
          intake.status === 'OPEN'
            ? '-rotate-1 self-start border-2 border-ink bg-blue px-3 py-2'
            : '-rotate-1 self-start border-2 border-ink bg-paper px-3 py-2'
        }
      >
        <Text
          className={
            intake.status === 'OPEN'
              ? 'font-pixel text-sm uppercase text-white'
              : 'font-pixel text-sm uppercase text-ink'
          }
        >
          {intake.headline}
        </Text>
      </View>
      <Text className="mt-2 text-sm leading-5 text-paper/75">
        {intake.detail}
      </Text>

      {intake.offers.length === 0 ? (
        <View className="mt-4">
          <EmptyDocket
            title={t('market.noOffersWaiting')}
            detail={t('market.aFreshYouthIntake')}
          />
        </View>
      ) : (
        <View className="mt-4 gap-3">
          {intake.offers.map((offer) => (
            <View
              key={offer.playerId}
              className="border-2 border-b-4 border-ink bg-white p-3"
            >
              {/* The portrait is fixed-size art. The stamp shares only the name
                  row so the metadata below can use all remaining card width. */}
              <View className="flex-row items-start justify-between gap-3">
                <View className="shrink-0 overflow-hidden border-2 border-ink bg-blue-light">
                  {/* Another club's player, so their strip, not ours. */}
                  <PixelPortrait
                    playerId={offer.playerId}
                    role={offer.role}
                    lookId={offer.lookId}
                    stockKit
                  />
                </View>
                <View className="min-w-0 flex-1">
                  <View className="flex-row items-start justify-between gap-2">
                    <Text
                      className="min-w-0 flex-1 text-lg font-bold text-ink"
                      numberOfLines={1}
                    >
                      {offer.playerName}
                    </Text>
                    <View className="shrink-0 -rotate-2 border-2 border-blue-dark bg-blue-light px-2 py-1">
                      <PixelText className="text-sm uppercase text-blue-dark">
                        {t('market.academy')}
                      </PixelText>
                    </View>
                  </View>
                  <Text
                    className="mt-1 font-pixel text-sm uppercase text-blue-dark"
                    numberOfLines={2}
                  >
                    {offer.role} · {offer.ageLabel} · {offer.archetypeLabel}
                  </Text>
                  <Text
                    className="mt-1 font-pixel text-sm uppercase text-gold-dark"
                    numberOfLines={2}
                  >
                    {t('market.potentialValue', {
                      grade: offer.potentialLabel,
                    })}
                  </Text>
                </View>
              </View>
              <YouthStatLine stats={offer.stats} />
              <View className="mt-3 flex-row gap-2">
                <Metric
                  label={t('market.signing')}
                  value={formatCurrency(t, offer.signingBonus)}
                  tone="negative"
                />
                <Metric
                  label={t('market.weeklyWage')}
                  value={formatCurrency(t, offer.weeklyWage)}
                />
              </View>
              <Text className="mt-2 text-sm text-ink/60">
                {t('market.promotionWageClause', {
                  percent: PROMOTION_WAGE_CLAUSE_PERCENT,
                })}
              </Text>
              <View className="mt-3 flex-row items-center justify-between gap-3">
                <Text className="flex-1 text-sm text-stamp">
                  {offer.blockedReason ?? t('market.threeYearAcademyContract')}
                </Text>
                <SmallAction
                  label={t('market.sign')}
                  accessibilityLabel={t('market.a11y.signYouthPlayer', {
                    player: offer.playerName,
                  })}
                  disabled={!offer.available}
                  onPress={() => onSignYouth(offer.playerId)}
                />
              </View>
            </View>
          ))}
          <ActionButton
            label={t('market.declineRemainingIntake')}
            accessibilityLabel={t(
              'market.a11y.declineAllRemainingYouthIntakeOffers',
            )}
            variant="paper"
            disabled={!intake.canDecline}
            onPress={onDeclineYouth}
          />
        </View>
      )}
    </View>
  );
}

function ScoutingDesk({
  viewModel,
  onStartScoutMission,
  onOpenScoutReport,
  onDismissScoutReport,
  onBuyDetailedScoutReport,
  onSignPlayer,
  southAmericaScoutActionRef,
  guideFocus,
}: Pick<
  MarketScreenProps,
  | 'viewModel'
  | 'onStartScoutMission'
  | 'onOpenScoutReport'
  | 'onDismissScoutReport'
  | 'onBuyDetailedScoutReport'
  | 'guideFocus'
> & {
  onSignPlayer: (playerId: string) => void;
  southAmericaScoutActionRef: RefObject<View | null>;
}) {
  const t = useCopy();
  const status = viewModel.scouting.status;
  const [selectedRegion, setSelectedRegion] = useState(
    viewModel.scouting.choices.some(
      (choice) => choice.region === 'SOUTH_AMERICA',
    )
      ? 'SOUTH_AMERICA'
      : viewModel.scouting.choices[0]?.region,
  );
  const [selectedRole, setSelectedRole] = useState<
    'ANY' | 'GK' | 'DEF' | 'MID' | 'FWD'
  >('ANY');
  const [selectedProspect, setSelectedProspect] = useState(
    viewModel.scouting.choices[0]?.prospectType,
  );
  const regionChoices = viewModel.scouting.choices.filter(
    (choice, index, all) =>
      all.findIndex((candidate) => candidate.region === choice.region) ===
      index,
  );
  const prospectChoices = viewModel.scouting.choices.filter(
    (choice, index, all) =>
      all.findIndex(
        (candidate) => candidate.prospectType === choice.prospectType,
      ) === index,
  );
  const selectedChoice = viewModel.scouting.choices.find(
    (choice) =>
      choice.region === selectedRegion &&
      choice.prospectType === selectedProspect &&
      (choice.prospectType === 'RUMORED_HERO' ||
      choice.prospectType === 'ELITE_PROSPECT'
        ? choice.role === undefined
        : (choice.role ?? 'ANY') === selectedRole),
  );
  const scrollDismissTargetId =
    viewModel.scouting.choices.find(
      (choice) => choice.region === 'SOUTH_AMERICA',
    )?.id ?? viewModel.scouting.choices[1]?.id;
  // The mission is live from dispatch until the report is opened, and both
  // states block every slip in the view model with market.scoutBusy.
  const scoutOut = status.kind === 'IN_PROGRESS' || status.kind === 'READY';
  const statusClass =
    status.kind === 'COMPLETED' || status.kind === 'READY'
      ? 'border-pitch-dark bg-pitch-light'
      : status.kind === 'IN_PROGRESS'
        ? 'border-blue-dark bg-blue-light'
        : 'border-ink bg-white';

  return (
    <View>
      <SectionLabel
        eyebrow={t('market.scoutDispatch')}
        title={t('market.findTheOverlooked')}
        right={<StatusChip label={viewModel.scouting.officeLabel} />}
      />
      <View className={`border-2 border-b-4 p-4 ${statusClass}`}>
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="font-pixel text-base uppercase text-ink">
              {status.headline}
            </Text>
            <Text className="mt-2 text-sm leading-5 text-ink/65">
              {status.detail}
            </Text>
          </View>
          {status.progressLabel ? (
            <StatusChip
              label={status.progressLabel}
              selected={status.kind === 'READY'}
            />
          ) : null}
        </View>
        <Text className="mt-3 border-t border-ink/20 pt-2 font-mono text-sm uppercase text-ink/50">
          {viewModel.scouting.precisionLabel}
        </Text>
      </View>

      {viewModel.scouting.reports.length > 0 ? (
        <View className="mt-5 gap-3">
          <Text className="font-pixel text-sm uppercase tracking-wide text-stamp">
            {t('market.scoutingReports')}
          </Text>
          {viewModel.scouting.reports.map((report) => (
            <View
              key={report.playerId}
              className="relative border-2 border-b-4 border-ink bg-white"
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('market.a11y.fullScoutingReportFor', {
                  player: report.playerName,
                })}
                onPress={() => onOpenScoutReport(report.playerId)}
                className="p-3"
                style={({ pressed }) => ({
                  opacity: pressed ? 0.78 : 1,
                })}
              >
                <View className="flex-row items-start justify-between gap-3">
                  <View className="overflow-hidden border-2 border-ink bg-blue-light">
                    {/* A scouted player is not signed yet. Stock strip. */}
                    <PixelPortrait
                      playerId={report.playerId}
                      role={report.role}
                      lookId={report.lookId}
                      stockKit
                    />
                  </View>
                  <View className="flex-1">
                    <Text
                      className="text-lg font-bold text-ink"
                      numberOfLines={1}
                    >
                      {report.playerName}
                    </Text>
                    <Text className="mt-1 font-pixel text-sm uppercase text-blue-dark">
                      {report.role} · {report.ageLabel}
                    </Text>
                    <Text
                      className="mt-1 font-pixel text-sm uppercase text-gold-dark"
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.7}
                    >
                      {t('market.potentialValue', {
                        grade: report.potentialLabel,
                      })}
                    </Text>
                  </View>
                </View>
                {report.powerLabel ? (
                  <View className="mt-3 flex-row items-center gap-1.5 border-2 border-gold-dark bg-gold-light px-3 py-2">
                    {/* Glyph-only node: ★ is not in Silkscreen, so it stands alone
                        and falls back to the system face on purpose — typed inside
                        the pixel-font string it flipped the face mid-word. */}
                    <Text className="text-sm text-ink">★</Text>
                    <Text className="font-pixel text-sm uppercase text-ink">
                      {t('market.confirmedPower', { power: report.powerLabel })}
                    </Text>
                  </View>
                ) : null}
                {report.rumorLabel ? (
                  <View className="mt-3 flex-row items-center gap-1.5 border-2 border-gold-dark bg-gold-light px-3 py-2">
                    <Text className="text-sm text-ink">★</Text>
                    <Text className="font-pixel text-sm uppercase text-ink">
                      {report.rumorLabel}
                    </Text>
                  </View>
                ) : null}
                <View className="mt-3 flex-row flex-wrap gap-1.5">
                  {report.stats.map((stat) => (
                    <View
                      key={stat.label}
                      className="min-w-[30%] flex-1 border border-ink/25 bg-paper px-2 py-1.5"
                    >
                      <PixelText className="text-sm uppercase text-ink/50">
                        {stat.label}
                      </PixelText>
                      <Text className="mt-0.5 font-mono text-base text-ink">
                        {stat.rangeLabel}
                      </Text>
                    </View>
                  ))}
                </View>
                {report.aboveHundredNote ? (
                  // Body face, not the pixel face: this is a sentence explaining
                  // a number, and it has to stay readable in every locale.
                  <Text className="mt-2 text-xs leading-4 text-ink/70">
                    {report.aboveHundredNote}
                  </Text>
                ) : null}
                {report.exactValues ? null : (
                  <Text className="mt-3 text-right font-pixel text-sm uppercase text-blue-dark">
                    {t('market.fullReportRangesShown')}
                  </Text>
                )}
              </Pressable>
              <View className="flex-row flex-wrap justify-end gap-2 px-3 pb-3">
                {report.exactValues ? null : (
                  <SmallAction
                    label={report.detailedReportLabel}
                    disabled={!report.detailedReportAvailable}
                    onPress={(event) => {
                      event.stopPropagation();
                      onBuyDetailedScoutReport(report.playerId);
                    }}
                  />
                )}
                <SmallAction
                  label={t('market.signThePlayer')}
                  accessibilityLabel={t('market.a11y.signPlayerFromReport', {
                    player: report.playerName,
                  })}
                  onPress={(event) => {
                    event.stopPropagation();
                    onSignPlayer(report.playerId);
                  }}
                />
                <SmallAction
                  label={t('market.dismissReport')}
                  disabled={!report.dismissAvailable}
                  onPress={(event) => {
                    event.stopPropagation();
                    onDismissScoutReport(report.playerId);
                  }}
                />
              </View>
              {report.detailedReportBlockedReason ? (
                <Text className="px-3 pb-3 text-right text-sm font-bold text-stamp">
                  {report.detailedReportBlockedReason}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
      {/* A scout in the field cannot be sent anywhere, so the whole slip
          picker goes away while he is out and returns when he is free —
          five rows of dead, blocked buttons taught the player nothing. */}
      {scoutOut ? null : (
        <View className="mt-5 gap-3">
          <Text className="font-pixel text-sm uppercase tracking-wide text-stamp">
            {t('market.missionSlips')}
          </Text>
          {viewModel.scouting.choices.length === 0 ? (
            <EmptyDocket
              title={t('market.noMissionsOnOffer')}
              detail={t('market.scoutingAssignmentsAreDrawn')}
            />
          ) : (
            <>
              <Text className="font-pixel text-sm uppercase text-ink/60">
                {t('market.scoutChooseRegion')}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {regionChoices.map((choice) => (
                  <SmallAction
                    key={choice.region}
                    label={choice.regionLabel}
                    selected={selectedRegion === choice.region}
                    onPress={() => setSelectedRegion(choice.region)}
                  />
                ))}
              </View>
              <Text className="font-pixel text-sm uppercase text-ink/60">
                {t('market.scoutChoosePosition')}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {(['ANY', 'GK', 'DEF', 'MID', 'FWD'] as const).map((role) => (
                  <SmallAction
                    key={role}
                    label={role === 'ANY' ? t('market.positionAny') : role}
                    selected={selectedRole === role}
                    disabled={
                      selectedProspect === 'RUMORED_HERO' ||
                      selectedProspect === 'ELITE_PROSPECT'
                    }
                    onPress={() => setSelectedRole(role)}
                  />
                ))}
              </View>
              <Text className="font-pixel text-sm uppercase text-ink/60">
                {t('market.scoutChooseProspect')}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {prospectChoices.map((choice) => (
                  <SmallAction
                    key={choice.prospectType}
                    label={choice.focusLabel}
                    selected={selectedProspect === choice.prospectType}
                    onPress={() => {
                      setSelectedProspect(choice.prospectType);
                      if (
                        choice.prospectType === 'RUMORED_HERO' ||
                        choice.prospectType === 'ELITE_PROSPECT'
                      )
                        setSelectedRole('ANY');
                    }}
                  />
                ))}
              </View>
              {selectedChoice === undefined
                ? null
                : [selectedChoice].map((choice, index) => (
                    <View
                      key={choice.id}
                      className={
                        choice.available
                          ? 'border-2 border-b-4 border-ink bg-white p-3'
                          : 'border-2 border-ink/25 bg-white/50 p-3 opacity-60'
                      }
                    >
                      <View className="flex-row items-start justify-between gap-3">
                        <View className="flex-1">
                          <PixelText className="text-base uppercase text-ink">
                            {choice.regionLabel}
                          </PixelText>
                          <Text className="mt-1 font-pixel text-sm uppercase text-blue-dark">
                            {choice.focusLabel}
                          </Text>
                        </View>
                        <Text className="font-mono text-base text-ink">
                          {choice.feeWaived === true
                            ? t('market.free')
                            : formatCurrency(t, choice.cost)}
                        </Text>
                      </View>
                      <Text className="mt-2 text-sm leading-5 text-ink/60">
                        {choice.detail}
                      </Text>
                      {/* The waiver only fires when the club can afford nothing
                        on the board, so say why the price vanished rather than
                        leaving FREE to look arbitrary beside four priced slips. */}
                      {choice.feeWaived === true ? (
                        <Text className="mt-2 text-sm font-bold leading-5 text-pitch-ink">
                          {t('market.scoutFavorLocal')}
                        </Text>
                      ) : null}
                      <View className="mt-3 flex-row items-center justify-between gap-3 border-t border-ink/15 pt-3">
                        <Text className="font-mono text-sm uppercase text-ink/50">
                          {choice.durationLabel}
                        </Text>
                        <GuidedAction
                          enabled={
                            guideFocus === 'scout-mission' && index === 0
                          }
                          detail={t('market.sendTheScout')}
                          targetRef={
                            choice.id === scrollDismissTargetId
                              ? southAmericaScoutActionRef
                              : undefined
                          }
                        >
                          <SmallAction
                            label={
                              choice.feeWaived === true
                                ? t('market.sendFreeScout')
                                : t('market.sendScout')
                            }
                            accessibilityLabel={
                              choice.feeWaived === true
                                ? t('market.a11y.sendScoutFreeFirstTrip', {
                                    region: choice.regionLabel,
                                    focus: choice.focusLabel,
                                  })
                                : t('market.a11y.sendScoutTo', {
                                    region: choice.regionLabel,
                                    focus: choice.focusLabel,
                                  })
                            }
                            disabled={!choice.available}
                            pressSfx="positive"
                            onPress={() => onStartScoutMission(choice.id)}
                          />
                        </GuidedAction>
                      </View>
                      {choice.blockedReason ? (
                        <Text className="mt-2 text-right text-sm font-bold text-stamp">
                          {choice.blockedReason}
                        </Text>
                      ) : null}
                    </View>
                  ))}
            </>
          )}
        </View>
      )}
    </View>
  );
}

function TransferDesk({
  viewModel,
  onTransferAction,
  guideFocus,
  focusedPlayerId,
  focusedListingRef,
  focusedListingToken,
  onFocusedListingLayout,
  reduceMotion,
}: Pick<MarketScreenProps, 'viewModel' | 'onTransferAction' | 'guideFocus'> & {
  focusedPlayerId?: string;
  focusedListingRef: RefObject<View | null>;
  focusedListingToken: number;
  onFocusedListingLayout: () => void;
  reduceMotion: boolean;
}) {
  const t = useCopy();
  const guidedListing =
    guideFocus === 'transfer-list'
      ? viewModel.transfers.find(
          (listing) => listing.direction === 'SELL' && !listing.listed,
        )
      : guideFocus === 'transfer-bid'
        ? viewModel.transfers.find(
            (listing) =>
              listing.direction === 'SELL' && listing.bids.length > 0,
          )
        : undefined;
  return (
    <View>
      <SectionLabel
        eyebrow={t('market.transfers')}
        title={t('market.buyPlayersSellYour')}
        right={
          <StatusChip
            label={viewModel.window.label}
            tone={viewModel.window.open ? 'success' : 'danger'}
          />
        }
      />
      {viewModel.transfers.length === 0 ? (
        <EmptyDocket
          title={t('market.noTransferActivity')}
          detail={t('market.scoutedPlayersAndListed')}
        />
      ) : (
        <View className="gap-3">
          {viewModel.transfers.map((listing) => {
            const focused =
              listing.direction === 'BUY' &&
              listing.playerId === focusedPlayerId;
            return (
              <View
                key={`${listing.direction}-${listing.playerId}`}
                ref={focused ? focusedListingRef : undefined}
                onLayout={focused ? onFocusedListingLayout : undefined}
                className={
                  focused
                    ? 'relative border-4 border-b-8 border-gold-dark bg-white'
                    : 'relative border-2 border-b-4 border-ink bg-white'
                }
              >
                <GuidanceDoubleFlash
                  trigger={focused ? focusedListingToken : undefined}
                  reduceMotion={reduceMotion}
                />
                <View
                  className={
                    listing.direction === 'BUY'
                      ? 'flex-row items-start justify-between gap-3 border-b-2 border-blue-dark bg-blue-light px-3 py-3'
                      : 'flex-row items-start justify-between gap-3 border-b-2 border-pitch-dark bg-pitch-light px-3 py-3'
                  }
                >
                  <View className="overflow-hidden border-2 border-ink bg-white">
                    <PixelPortrait
                      playerId={listing.playerId}
                      role={listing.role}
                      lookId={listing.lookId}
                      // A sale is one of ours in our kit; a buy is not ours yet.
                      stockKit={listing.direction === 'BUY'}
                    />
                  </View>
                  <View className="flex-1">
                    <Text
                      className="text-lg font-bold text-ink"
                      numberOfLines={1}
                    >
                      {listing.playerName}
                    </Text>
                    <Text className="mt-1 font-pixel text-sm uppercase text-ink/60">
                      {t('market.roleAndAge', {
                        role: listing.role,
                        age: listing.age,
                      })}
                    </Text>
                    <Text
                      className="mt-1 font-pixel text-sm uppercase text-gold-dark"
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.7}
                    >
                      {t('market.potentialValue', {
                        grade: listing.potentialLabel,
                      })}
                    </Text>
                  </View>
                  <View className="border-2 border-ink bg-white px-2 py-1">
                    <PixelText className="text-sm uppercase text-ink">
                      {listing.direction === 'BUY'
                        ? t('market.target')
                        : listing.listed
                          ? t('market.bidsIn')
                          : t('market.available')}
                    </PixelText>
                  </View>
                </View>
                <View className="p-3">
                  {/* No ★ prefix: the glyph is missing from Silkscreen and flipped
                    the chip to the system face mid-string; the gold hero tone
                    already marks the power. */}
                  {listing.powerLabel ? (
                    <StatusChip label={listing.powerLabel} tone="hero" />
                  ) : null}
                  <View
                    className={
                      listing.powerLabel
                        ? 'mt-3 flex-row gap-2'
                        : 'flex-row gap-2'
                    }
                  >
                    <Metric
                      label={t('market.valuation')}
                      value={formatCurrency(t, listing.valuation)}
                    />
                    <Metric
                      label={listing.quoteLabel}
                      value={formatCurrency(t, listing.quote)}
                      tone={
                        listing.direction === 'BUY' ? 'negative' : 'positive'
                      }
                    />
                  </View>
                  <View className="mt-3 flex-row items-center justify-between gap-3">
                    <Text className="flex-1 text-sm text-ink/55">
                      {listing.blockedReason ??
                        (listing.direction === 'BUY'
                          ? t('market.feeFirstPlayerTerms')
                          : listing.listed
                            ? t('market.reviewTheSavedBid')
                            : t('market.listThePlayerTo'))}
                    </Text>
                    {listing.direction === 'BUY' || !listing.listed ? (
                      <GuidedAction
                        enabled={
                          guideFocus === 'transfer-list' &&
                          listing === guidedListing
                        }
                        detail={t('market.requestTheBids')}
                      >
                        <SmallAction
                          label={listing.actionLabel}
                          accessibilityLabel={t('market.a11y.actionForPlayer', {
                            action: listing.actionLabel,
                            player: listing.playerName,
                          })}
                          disabled={!listing.available}
                          selected={focused}
                          onPress={() =>
                            onTransferAction(
                              listing.playerId,
                              listing.direction,
                            )
                          }
                        />
                      </GuidedAction>
                    ) : null}
                  </View>
                  {listing.direction === 'SELL' && listing.listed ? (
                    <View className="mt-3 gap-2 border-t-2 border-ink/15 pt-3">
                      {listing.bids.length === 0 ? (
                        <View className="items-center border-2 border-dashed border-ink/25 bg-white/50 px-3 py-4">
                          <PixelText className="text-sm uppercase text-ink/60">
                            {t('market.listedNoBidsYet')}
                          </PixelText>
                          <Text className="mt-1 text-center text-sm leading-5 text-ink/55">
                            {t('market.rivalClubsReviewThe')}
                          </Text>
                        </View>
                      ) : (
                        listing.bids.map((bid, index) => (
                          <View
                            key={bid.id}
                            className="flex-row items-center gap-3 border-2 border-ink bg-paper px-3 py-2"
                          >
                            <View className="flex-1">
                              <Text className="font-bold text-ink">
                                {index + 1}. {bid.buyerName}
                              </Text>
                              <Text className="mt-1 font-mono text-sm text-pitch-ink">
                                {t('market.feeAmount', {
                                  fee: formatCurrency(t, bid.fee),
                                })}
                              </Text>
                            </View>
                            <GuidedAction
                              enabled={
                                guideFocus === 'transfer-bid' &&
                                listing === guidedListing &&
                                index === 0
                              }
                              detail={t('market.reviewThisBid')}
                            >
                              <SmallAction
                                label={t('market.accept')}
                                accessibilityLabel={t('market.a11y.acceptBid', {
                                  club: bid.buyerName,
                                  fee: formatCurrency(t, bid.fee),
                                  player: listing.playerName,
                                })}
                                disabled={!listing.available}
                                onPress={() =>
                                  onTransferAction(
                                    listing.playerId,
                                    'SELL',
                                    bid.id,
                                  )
                                }
                              />
                            </GuidedAction>
                          </View>
                        ))
                      )}
                    </View>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

function CoachDesk({
  viewModel,
  compact,
  onHireCoach,
  guidanceNudgeTarget,
  guidanceNudgeToken,
  reduceMotion,
}: Pick<
  MarketScreenProps,
  | 'viewModel'
  | 'onHireCoach'
  | 'guidanceNudgeTarget'
  | 'guidanceNudgeToken'
  | 'reduceMotion'
> & {
  readonly compact: boolean;
}) {
  const t = useCopy();
  const firstAvailableHeadCoachId = viewModel.coaches.find(
    (coach) => coach.headAvailable,
  )?.id;
  return (
    <View>
      <SectionLabel
        eyebrow={t('market.pre-seasonShortlist')}
        title={t('market.aVoiceForThe')}
        right={
          <StatusChip
            label={t('market.candidates', {
              n: viewModel.coaches.length,
              count: viewModel.coaches.length,
            })}
          />
        }
      />
      {viewModel.coaches.length === 0 ? (
        <EmptyDocket
          title={t('market.shortlistPending')}
          detail={t('market.coachCandidatesRefreshEach')}
        />
      ) : (
        <View className="gap-3">
          {viewModel.coaches.map((coach) => (
            <View
              key={coach.id}
              className={
                coach.retiredLegend
                  ? 'border-2 border-b-4 border-gold-dark bg-gold-light p-3'
                  : 'border-2 border-b-4 border-ink bg-white p-3'
              }
            >
              <View className="flex-row items-start gap-3">
                <View className="border-2 border-b-4 border-ink bg-blue-light px-2 pt-2">
                  <ManagementSprite
                    spriteKey={`coach:${coach.portraitId}:rest`}
                    width={72}
                    accessibilityLabel={t('market.a11y.coachPortrait', {
                      name: coach.name,
                    })}
                  />
                </View>
                <View className="min-w-0 flex-1">
                  <Text
                    className="text-lg font-bold text-ink"
                    numberOfLines={1}
                  >
                    {coach.name}
                  </Text>
                  <Text className="mt-1 font-pixel text-sm uppercase text-blue-dark">
                    {t('market.coachAgeLine', {
                      age: coach.age,
                      personality: coach.personalityLabel,
                      level: coach.levelLabel,
                    })}
                  </Text>
                  {coach.retiredLegend ? (
                    <View className="mt-2 -rotate-2 self-start border-2 border-gold-dark bg-white px-2 py-1">
                      <PixelText className="text-sm uppercase text-gold-dark">
                        {t('market.clubLegend')}
                      </PixelText>
                    </View>
                  ) : null}
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
                <Text className="font-pixel text-sm uppercase text-ink">
                  {coach.assistantSlotUnlocked
                    ? t('market.coachWagesWithAssistant', {
                        head: formatCurrency(t, coach.headWeeklyWage),
                        assistant: formatCurrency(t, coach.assistantWeeklyWage),
                      })
                    : t('market.coachWages', {
                        head: formatCurrency(t, coach.headWeeklyWage),
                      })}
                </Text>
                <View className="mt-2 border-t border-blue-dark/25 pt-2">
                  <Text className="font-pixel text-sm uppercase text-blue-dark">
                    {t('market.asHeadCoach')}
                  </Text>
                  {coach.headEffectLabels.map((effect) => (
                    <Text
                      key={`head-${effect}`}
                      className="mt-1 text-sm font-bold text-ink"
                    >
                      {effect}
                    </Text>
                  ))}
                </View>
                {coach.assistantSlotUnlocked ? (
                  <View className="mt-2 border-t border-blue-dark/25 pt-2">
                    <Text className="font-pixel text-sm uppercase text-blue-dark">
                      {t('market.asAssistant')}
                    </Text>
                    {coach.assistantEffectLabels.map((effect) => (
                      <Text
                        key={`assistant-${effect}`}
                        className="mt-1 text-sm text-ink/75"
                      >
                        {effect}
                      </Text>
                    ))}
                  </View>
                ) : null}
                {coach.unlockLabel ? (
                  <Text className="mt-1 text-sm text-ink/65">
                    {coach.unlockLabel}
                  </Text>
                ) : null}
                {coach.loyaltyLabel ? (
                  <Text className="mt-1 text-sm font-bold text-gold-dark">
                    {coach.loyaltyLabel}
                  </Text>
                ) : null}
              </View>
              <View className="mt-3 gap-2">
                <Text className="text-sm text-stamp">
                  {coach.currentRole === undefined
                    ? (coach.blockedReason ?? t('market.availableToHire'))
                    : t(
                        coach.currentRole === 'HEAD'
                          ? 'market.currentRoleHead'
                          : 'market.currentRoleAssistant',
                      )}
                </Text>
                {!coach.assistantSlotUnlocked ? (
                  <Text className="text-sm font-bold text-blue-dark">
                    {t('market.buildTheCoachingOffice')}
                  </Text>
                ) : null}
                <View
                  className={compact ? 'gap-2' : 'flex-row justify-end gap-2'}
                >
                  <SmallAction
                    label={t('market.hireAsHead')}
                    accessibilityLabel={t('market.a11y.hireAsHeadCoach', {
                      name: coach.name,
                    })}
                    disabled={!coach.headAvailable}
                    onPress={() => onHireCoach(coach.id, 'HEAD')}
                    flashToken={
                      guidanceNudgeTarget === 'head-coach-market' &&
                      coach.id === firstAvailableHeadCoachId
                        ? guidanceNudgeToken
                        : undefined
                    }
                    reduceMotion={reduceMotion}
                  />
                  <SmallAction
                    label={t('market.hireAsAssistant')}
                    accessibilityLabel={t('market.a11y.hireAsAssistantCoach', {
                      name: coach.name,
                    })}
                    disabled={!coach.assistantAvailable}
                    onPress={() => onHireCoach(coach.id, 'ASSISTANT')}
                  />
                </View>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export interface ContractDraft {
  weeklyWage: number;
  setWeeklyWage: Dispatch<SetStateAction<number>>;
  termSeasons: 1 | 2 | 3;
  setTermSeasons: Dispatch<SetStateAction<1 | 2 | 3>>;
  perk: ContractPerk;
  setPerk: Dispatch<SetStateAction<ContractPerk>>;
  /** The teammate chosen to give up a Hero License, when the promise needs one. */
  reclaimPlayerId: string | undefined;
  setReclaimPlayerId: Dispatch<SetStateAction<string | undefined>>;
  pitchCard: PitchCard | undefined;
  setPitchCard: Dispatch<SetStateAction<PitchCard | undefined>>;
}

/**
 * Holds the in-progress contract offer for whichever screen renders the panel.
 *
 * It lives in the parent because `MarketScreen` renders `NegotiationPanel` from
 * two different JSX trees — one per layout mode — so crossing the wide-layout
 * breakdown point unmounts and remounts the panel. Owning the draft here means
 * dragging a desktop window wider mid-negotiation no longer silently discards
 * the wage, term, promise, and pitch card the user had dialled in.
 */
export function useContractDraft(
  viewModel: MarketNegotiationViewModel | undefined,
): ContractDraft {
  // A veteran may not be offered the usual two seasons, so the default has to
  // bend to the cap or the panel opens on a term the button cannot submit.
  const maxTerm = viewModel?.termOptions.at(-1) ?? 3;
  const [weeklyWage, setWeeklyWage] = useState(
    viewModel?.initialWeeklyWage ?? 0,
  );
  const [termSeasons, setTermSeasons] = useState<1 | 2 | 3>(
    Math.min(2, maxTerm) as 1 | 2 | 3,
  );
  const [perk, setPerk] = useState<ContractPerk>(contractDraftPerk(viewModel));
  const [reclaimPlayerId, setReclaimPlayerId] = useState<string | undefined>();
  const [pitchCard, setPitchCard] = useState<PitchCard | undefined>();

  const id = viewModel?.id;
  const initialWeeklyWage = viewModel?.initialWeeklyWage;
  const lastTermSeasons = viewModel?.lastOffer?.termSeasons;
  const lastPerk = viewModel?.lastOffer?.perk;
  const restoredPerk = contractDraftPerk(viewModel, lastPerk);

  // Two transitions, deliberately not one.
  //
  // This used to be a single effect keyed on `[id, roundLabel, initialWeeklyWage,
  // maxTerm]`, which reset ALL FOUR fields whenever any of them changed. Both
  // `roundLabel` and `initialWeeklyWage` change on every counter-offer, so a
  // manager who chose "3 years / Shirt #10" and then raised their wage signed a
  // 2-year Guaranteed Starter deal they never picked — binding for the whole
  // contract, and it spends a Hero License.
  //
  // The binding half of the draft belongs to the negotiation, so it restores
  // from the last offer on file: within a session that preserves the choice
  // across a round, and after a reload it rebuilds it from saved history rather
  // than snapping back to defaults. Before the first offer there is no history
  // and the defaults apply.
  useEffect(() => {
    if (id === undefined) return;
    setTermSeasons(lastTermSeasons ?? (Math.min(2, maxTerm) as 1 | 2 | 3));
    setPerk(restoredPerk);
  }, [id, lastTermSeasons, maxTerm, restoredPerk]);

  // The license a promise costs belongs to that promise. Switching to a promise
  // that spends none, or to a different player entirely, must not leave a
  // teammate silently marked for demotion.
  useEffect(() => {
    setReclaimPlayerId(undefined);
  }, [id, perk]);

  // The wage tracks the agent's counter, and the pitch card MUST clear: cards
  // are one-use, and re-submitting a spent one throws in `submitContractOffer`.
  useEffect(() => {
    if (initialWeeklyWage === undefined) return;
    setWeeklyWage(initialWeeklyWage);
    setPitchCard(undefined);
  }, [id, initialWeeklyWage]);

  return {
    weeklyWage,
    setWeeklyWage,
    termSeasons,
    setTermSeasons,
    perk,
    setPerk,
    reclaimPlayerId,
    setReclaimPlayerId,
    pitchCard,
    setPitchCard,
  };
}

export function NegotiationPanel({
  viewModel,
  draft,
  onSubmitContractOffer,
  onClose,
  onDismiss,
  guided = false,
  flush = false,
}: {
  viewModel: MarketNegotiationViewModel;
  /** Owned by the parent screen so a layout-mode remount cannot discard the offer. */
  draft: ContractDraft;
  onSubmitContractOffer: MarketScreenProps['onSubmitContractOffer'];
  onClose: () => void;
  /** Leaves renewal talks open while returning to the contract card. */
  onDismiss?: () => void;
  guided?: boolean;
  /** Omits the panel's own top margin — for use as a SectionFlow section, which owns inter-section spacing. Defaults to false so SeasonEndScreen is unaffected. */
  flush?: boolean;
}) {
  const t = useCopy();
  const {
    weeklyWage,
    setWeeklyWage,
    termSeasons,
    setTermSeasons,
    perk,
    setPerk,
    reclaimPlayerId,
    setReclaimPlayerId,
    pitchCard,
    setPitchCard,
  } = draft;
  // Talks allow three rounds and the panel re-renders in place after each one,
  // so a double-tap spends two of them on the identical offer — and a third
  // round reached that way can end the negotiation outright.
  const guardTap = useTapGuard();

  const open = viewModel.status === 'OPEN';
  /** The offer on the table is below what the agent will hear out. */
  const walksOut = weeklyWage < viewModel.walkOutWeeklyWage;
  const finalDemand = viewModel.finalDemand;
  const selectedPerk = viewModel.perks.find((option) => option.id === perk);
  const selectedPerkBlocked = selectedPerk?.available === false;
  // A promise that costs a Hero License cannot be sent until the club says
  // whose. Blocking the button is what stops the agent accepting a deal the
  // career would then refuse to complete.
  const reclaimChoice = selectedPerk?.heroLicenseReclaim;
  const selectedReclaim = reclaimChoice?.options.find(
    (option) => option.playerId === reclaimPlayerId,
  );
  const reclaimUnchosen =
    reclaimChoice !== undefined &&
    !reclaimChoice.options.some(
      (option) => option.playerId === reclaimPlayerId,
    );
  const moodClass =
    viewModel.mood === 'ANGRY' || viewModel.mood === 'UNHAPPY'
      ? 'border-red-dark bg-red-light'
      : viewModel.mood === 'PLEASED' || viewModel.mood === 'THRILLED'
        ? 'border-pitch-dark bg-pitch-light'
        : 'border-blue-dark bg-blue-light';

  return (
    <PaperPanel
      kicker={t('market.agentOnLineTwo')}
      title={viewModel.playerName}
      stamp={viewModel.roundLabel}
      className={flush ? undefined : 'mt-6'}
    >
      <View className={`flex-row items-center gap-3 border-2 p-3 ${moodClass}`}>
        <View className="overflow-hidden border-2 border-ink bg-white">
          {/* This panel serves a signing and a renewal alike, and nothing on
              the view model says which. Stock, because putting our kit on a
              rival's player reads worse than leaving one of ours in red. */}
          <PixelPortrait
            playerId={viewModel.playerId}
            role={viewModel.playerRole}
            lookId={viewModel.lookId}
            stockKit
            expression={
              viewModel.mood === 'ANGRY' || viewModel.mood === 'UNHAPPY'
                ? 'ko'
                : viewModel.mood === 'PLEASED' || viewModel.mood === 'THRILLED'
                  ? 'joy'
                  : 'rest'
            }
          />
        </View>
        <View className="flex-1">
          {/* `moodFace` has been computed in the view model since this feature
              shipped and rendered by nothing. It is decorative beside the
              already-labelled mood, so it is hidden from screen readers rather
              than read out as punctuation. */}
          <View className="flex-row items-center gap-2">
            <Text className="font-pixel text-base uppercase text-ink">
              {viewModel.moodLabel}
            </Text>
            <Text
              className="font-mono text-base text-ink/70"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              {viewModel.moodFace}
            </Text>
          </View>
          <PixelText className="mt-1 text-sm uppercase text-ink/60">
            {t('market.personalityLine', {
              personality: viewModel.personalityLabel,
            })}
          </PixelText>
          <Text className="mt-2 font-pixel text-sm uppercase text-blue-dark">
            {viewModel.pitchLeverageLabel}
          </Text>
        </View>
      </View>

      <Text className="mt-3 text-sm leading-5 text-ink/60">
        {t('market.promotionWageClause', {
          percent: PROMOTION_WAGE_CLAUSE_PERCENT,
        })}
      </Text>

      {viewModel.lastOutcomeLabel ? (
        <View className="mt-3 border-2 border-stamp bg-red-light px-3 py-2">
          <Text className="text-sm font-bold text-ink">
            {viewModel.lastOutcomeLabel}
          </Text>
        </View>
      ) : null}

      {/* The final round is not an offer, it is an answer. He has named one
          figure and the manager takes it or loses the player, so the wage
          stepper, the term buttons, the promises and the cards all come off —
          leaving three of them live beside a fixed number would read as levers
          that still do something. */}
      {open && finalDemand !== undefined ? (
        <View className="mt-4">
          <View className="border-2 border-stamp bg-red-light p-3">
            <PixelText className="text-sm uppercase tracking-wide text-stamp">
              {t('market.finalOffer')}
            </PixelText>
            <Text className="mt-2 text-sm leading-5 text-ink/80">
              {finalDemand.line}
            </Text>
          </View>
          <View className="mt-3 flex-row items-center justify-between border-2 border-ink bg-white px-3 py-3">
            <PixelText className="text-sm uppercase text-ink/50">
              {t('market.perWeek')}
            </PixelText>
            <Text className="font-mono text-2xl text-stamp">
              {formatCurrency(t, finalDemand.weeklyWage)}
            </Text>
          </View>
          <Text className="mt-2 text-center text-sm text-ink/50">
            {t('market.finalTerms', {
              seasons: finalDemand.termSeasons,
              promise:
                viewModel.perks.find((entry) => entry.id === finalDemand.perk)
                  ?.label ?? finalDemand.perk,
            })}
          </Text>
          <View className="mt-3">
            <ActionButton
              key={`${viewModel.id}:${finalDemand.weeklyWage}:${finalDemand.termSeasons}:${finalDemand.perk}`}
              label={t('market.signAtTheirPrice', {
                wage: formatCurrency(t, finalDemand.weeklyWage),
              })}
              accessibilityLabel={t('market.a11y.offerPlayerTermsAndPromise', {
                player: viewModel.playerName,
                wage: formatCurrency(t, finalDemand.weeklyWage),
                seasons: finalDemand.termSeasons,
                promise:
                  viewModel.perks.find((entry) => entry.id === finalDemand.perk)
                    ?.label ?? finalDemand.perk,
              })}
              variant="confirm"
              onPress={() =>
                guardTap(() =>
                  onSubmitContractOffer({
                    weeklyWage: finalDemand.weeklyWage,
                    termSeasons: finalDemand.termSeasons,
                    perk: finalDemand.perk,
                    // The agent's final demand keeps whichever promise was on
                    // the table, so it keeps the license arrangement with it.
                    ...(finalDemand.perk === perk && reclaimChoice !== undefined
                      ? { reclaimHeroLicenseFromPlayerId: reclaimPlayerId }
                      : {}),
                  }),
                )
              }
            />
          </View>
          <View className="mt-2">
            <ActionButton
              label={t('market.walkAway')}
              accessibilityLabel={t(
                'market.a11y.closeCompletedContractNegotiation',
              )}
              variant="paper"
              onPress={onClose}
            />
          </View>
        </View>
      ) : open ? (
        <>
          <View className="mt-4">
            <Text className="font-pixel text-sm uppercase text-stamp">
              {t('market.1WeeklyWage')}
            </Text>
            <View className="mt-2 flex-row items-stretch gap-2">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('market.a11y.reduceWeeklyWageBy', {
                  amount: formatCurrency(t, viewModel.wageStep),
                })}
                onPress={() =>
                  setWeeklyWage((value) =>
                    Math.max(viewModel.wageStep, value - viewModel.wageStep),
                  )
                }
                className="h-12 w-12 items-center justify-center border-2 border-b-4 border-ink bg-paper-dark"
                // Explicit points: h-12 is 42pt on native, under the 44pt
                // touch-target contract — see ActionButton's minHeight.
                style={{ minWidth: 44, minHeight: 44 }}
              >
                <Text className="font-mono text-2xl font-bold text-ink">-</Text>
              </Pressable>
              <View className="h-12 flex-1 items-center justify-center border-2 border-ink bg-white">
                <Text className="font-mono text-xl text-ink">
                  {t('market.perWeekAmount', {
                    amount: formatCurrency(t, weeklyWage),
                  })}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('market.a11y.increaseWeeklyWageBy', {
                  amount: formatCurrency(t, viewModel.wageStep),
                })}
                onPress={() =>
                  setWeeklyWage((value) => value + viewModel.wageStep)
                }
                className="h-12 w-12 items-center justify-center border-2 border-b-4 border-blue-dark bg-blue-light"
                style={{ minWidth: 44, minHeight: 44 }}
              >
                <Text className="font-mono text-2xl font-bold text-ink">+</Text>
              </Pressable>
            </View>
          </View>

          <View className="mt-4">
            <Text className="font-pixel text-sm uppercase text-stamp">
              {t('market.2ContractTerm')}
            </Text>
            <View className="mt-2 flex-row gap-2">
              {viewModel.termOptions.map((term) => (
                <Pressable
                  key={term}
                  accessibilityRole="radio"
                  accessibilityLabel={t('market.a11y.seasonContract', {
                    n: term,
                    seasons: term,
                  })}
                  accessibilityState={{ selected: termSeasons === term }}
                  onPress={() => setTermSeasons(term)}
                  className={
                    termSeasons === term
                      ? 'min-h-12 flex-1 items-center justify-center border-2 border-b-4 border-blue-dark bg-blue-light'
                      : 'min-h-12 flex-1 items-center justify-center border-2 border-ink/30 bg-white'
                  }
                >
                  <Text className="font-pixel text-base text-ink">
                    {t('market.termYears', { seasons: term })}
                  </Text>
                </Pressable>
              ))}
            </View>
            {viewModel.shortTermReason === undefined ? null : (
              <Text className="mt-2 text-sm leading-5 text-ink/60">
                {viewModel.shortTermReason}
              </Text>
            )}
            {/* Term stacks with the promise at 0/3/6%, invisibly. One line
                rather than a second grading system beside the first. */}
            <Text className="mt-2 text-sm leading-5 text-ink/50">
              {t('market.longerDealsSweetenThe')}
            </Text>
          </View>

          {/* Full width, mirroring the pitch cards below: the grade sits where a
              card's status sits, so the two lists read as one visual language.
              The old two-across grid clipped `detail` to a single line, which is
              why the promise consequences were never stated. */}
          <View className="mt-4">
            <View className="flex-row items-baseline justify-between gap-3">
              <Text className="font-pixel text-sm uppercase text-stamp">
                {t('market.onePromise')}
              </Text>
              {/* Captions the grade column. Without it "A · Huge" reads as the
                  best promise for the club, when it is the one that sways the
                  agent most AND costs the squad most. */}
              <PixelText className="text-sm uppercase text-ink/45">
                {t('market.valueToAgent')}
              </PixelText>
            </View>
            <View className="mt-2 gap-2">
              {viewModel.perks.map((option) => (
                <Pressable
                  key={option.id}
                  accessibilityRole="radio"
                  accessibilityLabel={t('market.a11y.perkWorthToAgent', {
                    label: option.label,
                    grade: option.gradeLabel.replace(' · ', ', '),
                    detail:
                      option.blockedReason === undefined
                        ? option.detail
                        : `${option.detail} ${option.blockedReason}`,
                  })}
                  accessibilityState={{
                    selected: perk === option.id,
                    disabled: !option.available,
                  }}
                  disabled={!option.available}
                  onPress={() => setPerk(option.id)}
                  className={
                    !option.available
                      ? 'min-h-14 border-2 border-ink/20 bg-ink/5 px-3 py-2 opacity-45'
                      : perk === option.id
                        ? 'min-h-14 border-2 border-b-4 border-blue-dark bg-blue-light px-3 py-2'
                        : 'min-h-14 border-2 border-ink/30 bg-white px-3 py-2'
                  }
                >
                  <View className="flex-row items-center justify-between gap-3">
                    <PixelText className="min-w-0 flex-1 text-sm uppercase text-ink">
                      {option.label}
                    </PixelText>
                    <PixelText className="text-sm uppercase text-ink/70">
                      {option.gradeLabel}
                    </PixelText>
                  </View>
                  <Text className="mt-1 text-sm text-ink/60">
                    {option.detail}
                  </Text>
                  {option.blockedReason === undefined ? null : (
                    <Text className="mt-1 text-sm font-bold text-stamp">
                      {option.blockedReason}
                    </Text>
                  )}
                </Pressable>
              ))}
            </View>
            {/* Asked here, inline under the promise that causes it, rather than
                in a modal after the fact: the license is part of the offer's
                price, and the manager is choosing the price. Nothing is applied
                until the agent signs, so abandoning the talks costs nothing. */}
            {reclaimChoice === undefined ? null : (
              <View className="mt-3 border-2 border-stamp bg-white px-3 py-3">
                <Text className="text-sm leading-5 text-ink/80">
                  {reclaimChoice.prompt}
                </Text>
                <View className="mt-2 gap-2">
                  {reclaimChoice.options.map((holder) => (
                    <Pressable
                      key={holder.playerId}
                      accessibilityRole="radio"
                      accessibilityLabel={`${holder.name}, ${holder.role}, ${holder.statusLabel}. ${holder.consequenceLabel}`}
                      accessibilityState={{
                        selected: reclaimPlayerId === holder.playerId,
                      }}
                      onPress={() => setReclaimPlayerId(holder.playerId)}
                      className={
                        reclaimPlayerId === holder.playerId
                          ? 'min-h-12 flex-row items-center justify-between gap-3 border-2 border-b-4 border-blue-dark bg-blue-light px-3 py-2'
                          : 'min-h-12 flex-row items-center justify-between gap-3 border-2 border-ink/30 bg-white px-3 py-2'
                      }
                    >
                      <PixelText className="min-w-0 flex-1 text-sm uppercase text-ink">
                        {holder.name}
                      </PixelText>
                      <PixelText className="text-sm uppercase text-ink/70">
                        {`${holder.role} · ${holder.statusLabel}`}
                      </PixelText>
                    </Pressable>
                  ))}
                </View>
                {selectedReclaim === undefined ? null : (
                  <Text className="mt-2 text-sm font-bold leading-5 text-stamp">
                    {selectedReclaim.consequenceLabel}
                  </Text>
                )}
              </View>
            )}
          </View>

          <View className="mt-4">
            <Text className="font-pixel text-sm uppercase text-stamp">
              {t('market.4PitchCardOptional')}
            </Text>
            <View className="mt-2 gap-2">
              {viewModel.cards.length === 0 ? (
                <EmptyDocket
                  title={t('market.noCardsInHand')}
                  detail={t('market.pitchCardsAreEarned')}
                />
              ) : (
                <>
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityLabel={t('market.noPitchCard')}
                    accessibilityState={{ selected: pitchCard === undefined }}
                    onPress={() => setPitchCard(undefined)}
                    className={
                      pitchCard === undefined
                        ? 'min-h-12 border-2 border-b-4 border-blue-dark bg-blue-light px-3 py-2'
                        : 'min-h-12 border-2 border-ink/30 bg-white px-3 py-2'
                    }
                  >
                    <PixelText className="text-sm uppercase text-ink">
                      {t('market.noPitchCard')}
                    </PixelText>
                  </Pressable>
                  {viewModel.cards.map((card) => {
                    const selected = pitchCard === card.id;
                    return (
                      <Pressable
                        key={card.id}
                        accessibilityRole="radio"
                        accessibilityLabel={t('market.a11y.cardLabelDetail', {
                          label: card.label,
                          detail: card.detail,
                        })}
                        accessibilityState={{ selected, disabled: card.used }}
                        disabled={card.used}
                        onPress={() =>
                          setPitchCard((current) =>
                            current === card.id ? undefined : card.id,
                          )
                        }
                        className={
                          card.used
                            ? 'min-h-14 border-2 border-ink/20 bg-ink/5 px-3 py-2 opacity-45'
                            : selected
                              ? 'min-h-14 border-2 border-b-4 border-blue-dark bg-blue-light px-3 py-2'
                              : 'min-h-14 border-2 border-ink/30 bg-white px-3 py-2'
                        }
                      >
                        <View className="flex-row items-center justify-between gap-3">
                          <PixelText className="min-w-0 flex-1 text-sm uppercase text-ink">
                            {card.label}
                          </PixelText>
                          {/* The loved/hated mapping has always been in the engine
                          and never on screen, so a hated card cost 10% AND one
                          of only three rounds with no warning. Read as how the
                          player takes it, not as a rule being quoted at you. */}
                          {card.used ||
                          card.affinity === undefined ||
                          card.affinity === 'NEUTRAL' ? null : (
                            <Text
                              className={
                                card.affinity === 'LOVED'
                                  ? 'font-pixel text-sm uppercase text-pitch-ink'
                                  : 'font-pixel text-sm uppercase text-stamp'
                              }
                            >
                              {card.affinity === 'LOVED'
                                ? t('market.heLlLikeThis')
                                : t('market.risky')}
                            </Text>
                          )}
                          <Text className="font-pixel text-sm uppercase text-ink/50">
                            {card.used
                              ? t('market.played')
                              : selected
                                ? t('market.loaded')
                                : t('market.card')}
                          </Text>
                        </View>
                        <Text className="mt-1 text-sm text-ink/60">
                          {card.detail}
                        </Text>
                      </Pressable>
                    );
                  })}
                </>
              )}
            </View>
          </View>

          <View
            className={
              guided
                ? 'relative border-2 border-blue-dark bg-blue-light p-1'
                : 'relative mt-4'
            }
            style={
              guided
                ? { marginTop: TUTORIAL_TAP_CUE_RESERVED_SPACE }
                : undefined
            }
          >
            <Text className="mb-2 text-center text-sm text-ink/60">
              {t('market.offerSummary', {
                wage: formatCurrency(t, weeklyWage),
                seasons: termSeasons,
                promise: selectedPerk?.label ?? perk,
              })}
            </Text>
            {guided ? (
              <TutorialTapCue
                detail={t('market.makeTheOffer')}
                style={{
                  left: '50%',
                  marginLeft: -TUTORIAL_TAP_CUE_WIDTH / 2,
                  top: -TUTORIAL_TAP_CUE_ABOVE_OFFSET,
                }}
              />
            ) : null}
            <ActionButton
              key={`${viewModel.id}:${weeklyWage}:${termSeasons}:${perk}`}
              // '›' is in Silkscreen; '▸' is not and rendered in the fallback face.
              label={
                walksOut
                  ? t('market.theyWillWalkOut')
                  : t('market.makeTheOfferArrow')
              }
              accessibilityLabel={
                walksOut
                  ? t('market.a11y.offerBelowWalkOut', {
                      wage: formatCurrency(t, weeklyWage),
                      floor: formatCurrency(t, viewModel.walkOutWeeklyWage),
                    })
                  : t('market.a11y.offerPlayerTermsAndPromise', {
                      player: viewModel.playerName,
                      wage: formatCurrency(t, weeklyWage),
                      seasons: termSeasons,
                      promise: selectedPerk?.label ?? perk,
                    })
              }
              variant="confirm"
              disabled={walksOut || selectedPerkBlocked || reclaimUnchosen}
              onPress={() =>
                guardTap(() =>
                  onSubmitContractOffer(
                    {
                      weeklyWage,
                      termSeasons,
                      perk,
                      ...(reclaimChoice === undefined
                        ? {}
                        : { reclaimHeroLicenseFromPlayerId: reclaimPlayerId }),
                    },
                    pitchCard,
                  ),
                )
              }
            />
          </View>
          <View className="mt-2">
            <ActionButton
              label={
                onDismiss === undefined
                  ? t('market.closeAgentFile')
                  : t('market.leaveTalksOpen')
              }
              accessibilityLabel={
                onDismiss === undefined
                  ? t('market.closeAgentFile')
                  : t('market.leaveTalksOpen')
              }
              variant="paper"
              onPress={onDismiss ?? onClose}
            />
          </View>
          {/* The rule, at the moment it applies, with the number in it. It used
              to be one line of grey print saying "below half their ask" — the
              half was never worked out for the manager, so the first they knew
              of it was the talks being over and the player sulking. */}
          {walksOut ? (
            <Text className="mt-2 text-center text-sm font-bold text-stamp">
              {t('market.walkOutInsult', {
                wage: formatCurrency(t, weeklyWage),
                floor: formatCurrency(t, viewModel.walkOutWeeklyWage),
              })}
            </Text>
          ) : (
            <Text className="mt-2 text-center text-sm text-ink/50">
              {t('market.threeRoundsMaximum', {
                floor: formatCurrency(t, viewModel.walkOutWeeklyWage),
              })}
            </Text>
          )}
        </>
      ) : (
        <View className="mt-4">
          <ActionButton
            label={t('market.closeAgentFile')}
            accessibilityLabel={t(
              'market.a11y.closeCompletedContractNegotiation',
            )}
            variant={viewModel.status === 'ACCEPTED' ? 'confirm' : 'paper'}
            onPress={onClose}
          />
        </View>
      )}
    </PaperPanel>
  );
}

function GuidedAction({
  enabled,
  detail,
  targetRef,
  children,
}: {
  enabled: boolean;
  detail: string;
  targetRef?: RefObject<View | null>;
  children: ReactNode;
}) {
  return (
    <View
      ref={targetRef}
      className={
        enabled
          ? 'relative border-2 border-blue-dark bg-blue-light p-1'
          : 'relative'
      }
      style={
        enabled ? { marginTop: TUTORIAL_TAP_CUE_RESERVED_SPACE } : undefined
      }
    >
      {enabled ? (
        <TutorialTapCue
          detail={detail}
          style={{
            left: '50%',
            marginLeft: -TUTORIAL_TAP_CUE_WIDTH / 2,
            top: -TUTORIAL_TAP_CUE_ABOVE_OFFSET,
          }}
        />
      ) : null}
      {children}
    </View>
  );
}

/**
 * The prospect's real stats, six across. Academy kids are the club's own, so the
 * card states them outright rather than the scout's estimated ranges — two
 * prospects on the same potential letter have to be tellable apart. The best of
 * the six is picked out in gold so the shape of the player reads at a glance.
 */
function YouthStatLine({
  stats,
}: {
  stats: readonly { readonly label: string; readonly value: number }[];
}) {
  if (stats.length === 0) return null;
  const best = Math.max(...stats.map((stat) => stat.value));
  return (
    <View
      className="mt-3 flex-row gap-1.5"
      accessibilityLabel={stats
        .map((stat) => `${stat.label} ${stat.value}`)
        .join(', ')}
    >
      {stats.map((stat) => {
        const strongest = stat.value === best;
        return (
          <View
            key={stat.label}
            className="min-w-0 flex-1 border border-ink/25 px-1 pb-1 pt-0.5"
          >
            <PixelText className="text-center text-[10px] uppercase text-ink/45">
              {stat.label}
            </PixelText>
            <Text
              className={
                strongest
                  ? 'mt-0.5 text-center font-mono text-base text-gold-dark'
                  : 'mt-0.5 text-center font-mono text-base text-ink'
              }
            >
              {stat.value}
            </Text>
            <View className="mt-1 h-1 bg-ink/10">
              <View
                className={strongest ? 'h-1 bg-gold-dark' : 'h-1 bg-pitch-ink'}
                style={{ width: `${Math.max(0, Math.min(100, stat.value))}%` }}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

function SmallAction({
  label,
  accessibilityLabel,
  disabled = false,
  selected = false,
  onPress,
  flashToken,
  reduceMotion = false,
  pressSfx,
}: {
  label: string;
  accessibilityLabel?: string;
  disabled?: boolean;
  selected?: boolean;
  onPress: (event: GestureResponderEvent) => void;
  flashToken?: number;
  reduceMotion?: boolean;
  pressSfx?: ComponentProps<typeof Pressable>['pressSfx'];
}) {
  return (
    <Pressable
      pressSfx={pressSfx}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      className={
        disabled
          ? 'relative min-h-11 min-w-24 items-center justify-center border-2 border-ink/20 bg-ink/5 px-3'
          : selected
            ? 'relative min-h-11 min-w-24 items-center justify-center border-2 border-b-4 border-pitch-dark bg-pitch-light px-3'
            : 'relative min-h-11 min-w-24 items-center justify-center border-2 border-b-4 border-blue-dark bg-blue-light px-3'
      }
      style={({ pressed }) => ({
        transform: [{ translateY: pressed && !disabled ? 2 : 0 }],
      })}
    >
      <GuidanceDoubleFlash trigger={flashToken} reduceMotion={reduceMotion} />
      <PixelText
        className={
          disabled
            ? 'text-center text-sm uppercase text-ink/30'
            : 'text-center text-sm uppercase text-ink'
        }
      >
        {label}
      </PixelText>
    </Pressable>
  );
}
