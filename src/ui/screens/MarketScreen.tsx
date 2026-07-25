import { cloneElement, useEffect, useRef, useState, type Dispatch, type ReactNode, type RefObject, type SetStateAction } from 'react';
import {
  ScrollView,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import type { AssistantGuideFocus } from '../../content';
import type { ContractOffer, ContractPerk, PitchCard } from '../../game/market';
import { ActionButton, Metric, PaperPanel, SectionLabel, StatusChip, formatCurrency } from '../components/Scorecard';
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
} from '../tutorial-cue-position';
import { SectionFlow, type FlowSection } from '../layout/SectionFlow';
import { useLayoutMode } from '../layout/use-layout-mode';
import { PixelText } from '../components/PixelText';

export interface MarketScreenProps {
  readonly viewModel: MarketViewModel;
  readonly onStartScoutMission: (optionId: string) => void;
  readonly onOpenScoutReport: (playerId: string) => void;
  readonly onTransferAction: (playerId: string, direction: 'BUY' | 'SELL', bidId?: string) => void;
  readonly onHireCoach: (coachId: string, role: 'HEAD' | 'ASSISTANT') => void;
  readonly onSignYouth: (playerId: string) => void;
  readonly onDeclineYouth: () => void;
  readonly onSubmitContractOffer: (offer: ContractOffer, pitchCard?: PitchCard) => void;
  readonly onCloseNegotiation: () => void;
  readonly onDismissGuideFocus?: () => void;
  readonly guideFocus?: AssistantGuideFocus;
  readonly requestedSection?: MarketSectionId;
  readonly requestedSectionToken?: number;
}

const MIN_GUIDE_SCROLL_DISTANCE = 24;

function initialSection(viewModel: MarketViewModel): MarketSectionId {
  if (viewModel.negotiation !== undefined && viewModel.sections.includes('TRANSFERS')) {
    return 'TRANSFERS';
  }
  if (viewModel.youth?.status === 'OPEN' && viewModel.sections.includes('YOUTH')) return 'YOUTH';
  if (viewModel.sections.includes('SCOUT')) return 'SCOUT';
  return viewModel.sections[0] ?? 'COACHES';
}

export function MarketScreen({
  viewModel,
  onStartScoutMission,
  onOpenScoutReport,
  onTransferAction,
  onHireCoach,
  onSignYouth,
  onDeclineYouth,
  onSubmitContractOffer,
  onCloseNegotiation,
  onDismissGuideFocus,
  guideFocus,
  requestedSection,
  requestedSectionToken,
}: MarketScreenProps) {
  const [section, setSection] = useState<MarketSectionId>(() => initialSection(viewModel));
  const [scrollDismissedGuideFocus, setScrollDismissedGuideFocus] = useState<AssistantGuideFocus>();
  const visibleGuideFocus = scrollDismissedGuideFocus === guideFocus ? undefined : guideFocus;
  const marketViewportRef = useRef<View>(null);
  const southAmericaScoutActionRef = useRef<View>(null);
  const latestScrollOffsetRef = useRef(0);
  const scoutDragStartOffsetRef = useRef(0);
  const youthSectionVisible = viewModel.sections.includes('YOUTH') && viewModel.youth !== undefined;
  const scoutSectionVisible = viewModel.sections.includes('SCOUT');
  const transferSectionVisible = viewModel.sections.includes('TRANSFERS');
  const coachSectionVisible = viewModel.sections.includes('COACHES');

  const dismissScrollGuide = (focus: AssistantGuideFocus) => {
    setScrollDismissedGuideFocus(focus);
    onDismissGuideFocus?.();
  };

  const handleScrollBeginDrag = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
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
    if (guideFocus === 'transfer-list') {
      dismissScrollGuide('transfer-list');
      return;
    }
    if (guideFocus !== 'scout-mission' || scrollDismissedGuideFocus === 'scout-mission') return;
    const dragStartOffset = scoutDragStartOffsetRef.current;
    if (
      currentOffset < dragStartOffset + MIN_GUIDE_SCROLL_DISTANCE
    ) return;

    const viewport = marketViewportRef.current;
    const target = southAmericaScoutActionRef.current;
    if (viewport === null || target === null) return;
    viewport.measureInWindow((_viewportX, viewportY, _viewportWidth, viewportHeight) => {
      target.measureInWindow((_targetX, targetY, _targetWidth, targetHeight) => {
        const targetFullyVisible = targetY >= viewportY
          && targetY + targetHeight <= viewportY + viewportHeight;
        if (targetFullyVisible) dismissScrollGuide('scout-mission');
      });
    });
  };

  useEffect(() => {
    if (viewModel.negotiation !== undefined) setSection('TRANSFERS');
  }, [viewModel.negotiation?.id]);

  useEffect(() => {
    if (!viewModel.sections.includes(section)) setSection(initialSection(viewModel));
  }, [section, viewModel]);

  useEffect(() => {
    if (guideFocus === 'scout-mission') {
      scoutDragStartOffsetRef.current = latestScrollOffsetRef.current;
    }
  }, [guideFocus]);

  useEffect(() => {
    if (guideFocus === 'youth-intake' && youthSectionVisible) setSection('YOUTH');
    else if ((guideFocus === 'scout-mission' || guideFocus === 'scout-report') && scoutSectionVisible) setSection('SCOUT');
    else if ((guideFocus === 'transfer-list' || guideFocus === 'transfer-bid' || guideFocus === 'transfer-negotiation') && transferSectionVisible) setSection('TRANSFERS');
    else if ((guideFocus === 'coach-market' || guideFocus === 'coach-hire' || guideFocus === 'assistant-coach-hire') && coachSectionVisible) setSection('COACHES');
  }, [coachSectionVisible, guideFocus, scoutSectionVisible, transferSectionVisible, youthSectionVisible]);

  const negotiationDraft = useContractDraft(viewModel.negotiation);
  const layoutMode = useLayoutMode();

  useEffect(() => {
    if (layoutMode !== 'single') return;
    if (requestedSection === 'YOUTH' && youthSectionVisible) setSection('YOUTH');
    else if (requestedSection === 'SCOUT' && scoutSectionVisible) setSection('SCOUT');
    else if (requestedSection === 'TRANSFERS' && transferSectionVisible) setSection('TRANSFERS');
    else if (requestedSection === 'COACHES' && coachSectionVisible) setSection('COACHES');
  }, [
    coachSectionVisible,
    layoutMode,
    requestedSection,
    requestedSectionToken,
    scoutSectionVisible,
    transferSectionVisible,
    youthSectionVisible,
  ]);

  const header = (
    <View className="flex-row items-end justify-between gap-3">
      <View className="flex-1">
        <Text className="font-pixel text-sm uppercase tracking-[2px] text-blue-dark">
          Recruitment office
        </Text>
        <Text className="mt-1 font-pixel text-xl uppercase text-ink">Market docket</Text>
      </View>
      <StatusChip label={viewModel.periodLabel} />
    </View>
  );
  const wideHeader = cloneElement(header, {
    className: `mb-5 ${header.props.className}`,
  });

  const youthDesk = viewModel.youth ? (
    <YouthDesk
      viewModel={viewModel}
      onSignYouth={onSignYouth}
      onDeclineYouth={onDeclineYouth}
      guideFocus={visibleGuideFocus}
    />
  ) : null;
  const scoutDesk = scoutSectionVisible ? (
    <ScoutingDesk
      viewModel={viewModel}
      onStartScoutMission={onStartScoutMission}
      onOpenScoutReport={onOpenScoutReport}
      southAmericaScoutActionRef={southAmericaScoutActionRef}
      guideFocus={visibleGuideFocus}
    />
  ) : null;
  const transferDesk = transferSectionVisible ? (
    <TransferDesk viewModel={viewModel} onTransferAction={onTransferAction} guideFocus={visibleGuideFocus} />
  ) : null;
  const coachDesk = coachSectionVisible ? (
    <CoachDesk viewModel={viewModel} onHireCoach={onHireCoach} />
  ) : null;

  const activeDesk = section === 'YOUTH' && viewModel.youth
    ? youthDesk
    : section === 'SCOUT'
      ? scoutDesk
      : section === 'TRANSFERS'
        ? transferDesk
        : coachDesk;

  const sections: FlowSection[] = [
    {
      key: 'registration',
      weight: 5,
      node: <RegistrationDesk viewModel={viewModel} flush />,
    },
    ...(viewModel.negotiation ? [{
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
    }] : []),
    ...(viewModel.youth ? [{
      key: 'youth-desk',
      weight: 4 + 5 * viewModel.youth.offers.length,
      node: youthDesk,
    }] : []),
    ...(scoutSectionVisible ? [{
      key: 'scout-desk',
      weight: 8,
      node: scoutDesk,
    }] : []),
    ...(transferSectionVisible ? [{
      key: 'transfer-desk',
      weight: 3 + 3 * viewModel.transfers.length,
      node: transferDesk,
    }] : []),
    ...(coachSectionVisible ? [{
      key: 'coach-desk',
      weight: 3 + 4 * viewModel.coaches.length,
      node: coachDesk,
    }] : []),
  ];

  return (
    <View ref={marketViewportRef} collapsable={false} className="flex-1">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
      {layoutMode === 'single' ? (
        <>
          {header}
          <RegistrationDesk viewModel={viewModel} />

          {viewModel.negotiation ? (
            <NegotiationPanel
              viewModel={viewModel.negotiation}
              draft={negotiationDraft}
              onSubmitContractOffer={onSubmitContractOffer}
              onClose={onCloseNegotiation}
              guided={visibleGuideFocus === 'transfer-negotiation'}
            />
          ) : null}

          <View className="mt-6 flex-row border-2 border-b-4 border-ink bg-paper-dark p-1">
            {viewModel.sections.includes('YOUTH') && viewModel.youth ? (
              <DocketTab id="YOUTH" label="Youth" glyph="★" selected={section === 'YOUTH'} onPress={setSection} />
            ) : null}
            {viewModel.sections.includes('SCOUT') ? (
              <DocketTab id="SCOUT" label="Scout" glyph="⌖" selected={section === 'SCOUT'} onPress={setSection} />
            ) : null}
            {viewModel.sections.includes('TRANSFERS') ? (
              <DocketTab id="TRANSFERS" label="Deals" glyph="⇄" selected={section === 'TRANSFERS'} onPress={setSection} />
            ) : null}
            {viewModel.sections.includes('COACHES') ? (
              <DocketTab id="COACHES" label="Coaches" glyph="▣" selected={section === 'COACHES'} onPress={setSection} />
            ) : null}
          </View>

          <View className="mt-6">{activeDesk}</View>
        </>
      ) : (
        <SectionFlow mode={layoutMode} header={wideHeader} sections={sections} />
      )}
      </ScrollView>
    </View>
  );
}

interface RegistrationDeskProps {
  viewModel: MarketViewModel;
  flush?: boolean;
}

function RegistrationDesk({ viewModel, flush = false }: RegistrationDeskProps) {
  return (
    <PaperPanel
      kicker="Registration desk"
      title="Build the next great side"
      stamp={viewModel.window.open ? 'Open' : 'Shut'}
      className={flush ? undefined : 'mt-5'}
    >
      <View className="flex-row gap-2">
        <Metric label="Cash" value={formatCurrency(viewModel.cash)} />
        <Metric label="Level" value={viewModel.divisionLabel} />
        <Metric
          label="Window"
          value={viewModel.window.open ? 'OPEN' : 'CLOSED'}
          tone={viewModel.window.open ? 'positive' : 'negative'}
        />
      </View>
      <Text className="mt-3 text-sm leading-5 text-ink/60">{viewModel.window.detail}</Text>
    </PaperPanel>
  );
}

function YouthDesk({
  viewModel,
  onSignYouth,
  onDeclineYouth,
  guideFocus,
}: Pick<MarketScreenProps, 'viewModel' | 'onSignYouth' | 'onDeclineYouth' | 'guideFocus'>) {
  const intake = viewModel.youth;
  if (intake === undefined) return null;
  return (
    <View className="relative overflow-hidden border-[3px] border-ink bg-pitch-dark p-4">
      {/* The academy gets its own chalkboard stage inside the market desk. */}
      <View pointerEvents="none" className="absolute -left-12 -top-10 h-40 w-40 rounded-full border-4 border-paper/10" />
      <View pointerEvents="none" className="absolute -right-10 bottom-4 h-32 w-32 rounded-full border-4 border-paper/10" />
      <View className="mb-3 flex-row items-end justify-between gap-3">
        <View className="flex-1">
          <Text className="font-pixel text-xs uppercase tracking-[2px] text-gold-light">Pre-season academy intake</Text>
          <Text className="mt-1 font-pixel text-lg uppercase text-white">Meet the next generation</Text>
        </View>
        <StatusChip label={intake.rosterLabel} />
      </View>
      <View className={intake.status === 'OPEN'
        ? 'self-start -rotate-1 border-2 border-ink bg-blue px-3 py-2'
        : 'self-start -rotate-1 border-2 border-ink bg-paper px-3 py-2'}
      >
        <Text className={intake.status === 'OPEN'
          ? 'font-pixel text-sm uppercase text-white'
          : 'font-pixel text-sm uppercase text-ink'}
        >
          {intake.headline}
        </Text>
      </View>
      <Text className="mt-2 text-sm leading-5 text-paper/75">{intake.detail}</Text>

      {intake.offers.length === 0 ? (
        <View className="mt-4">
          <EmptyDocket title="No offers waiting" detail="A fresh youth intake arrives next pre-season." />
        </View>
      ) : (
        <View className="mt-4 gap-3">
          {intake.offers.map(offer => (
            <View key={offer.playerId} className="border-2 border-b-4 border-ink bg-white p-3">
              <View className="flex-row items-start justify-between gap-3">
                <View className="overflow-hidden border-2 border-ink bg-blue-light">
                  <PixelPortrait playerId={offer.playerId} role={offer.role} lookId={offer.lookId} />
                </View>
                <View className="flex-1">
                  <Text className="text-lg font-bold text-ink" numberOfLines={1}>{offer.playerName}</Text>
                  <Text className="mt-1 font-pixel text-sm uppercase text-blue-dark">
                    {offer.role} · {offer.ageLabel} · {offer.archetypeLabel}
                  </Text>
                  <Text className="mt-1 font-pixel text-sm uppercase text-gold-dark">
                    Potential {offer.potentialLabel}
                  </Text>
                </View>
                <View className="-rotate-2 border-2 border-blue-dark bg-blue-light px-2 py-1">
                  <PixelText className="text-sm uppercase text-blue-dark">Academy</PixelText>
                </View>
              </View>
              <View className="mt-3 flex-row gap-2">
                <Metric label="Signing" value={formatCurrency(offer.signingBonus)} tone="negative" />
                <Metric label="Weekly wage" value={formatCurrency(offer.weeklyWage)} />
              </View>
              <View className="mt-3 flex-row items-center justify-between gap-3">
                <Text className="flex-1 text-sm text-stamp">
                  {offer.blockedReason ?? 'Three-year academy contract ready.'}
                </Text>
                <SmallAction
                  label="Sign"
                  accessibilityLabel={`Sign youth player ${offer.playerName}`}
                  disabled={!offer.available}
                  onPress={() => onSignYouth(offer.playerId)}
                />
              </View>
            </View>
          ))}
          <ActionButton
            label="Decline remaining intake"
            accessibilityLabel="Decline all remaining youth intake offers"
            variant="paper"
            disabled={!intake.canDecline}
            onPress={onDeclineYouth}
          />
        </View>
      )}
    </View>
  );
}

function DocketTab({
  id,
  label,
  glyph,
  selected,
  onPress,
}: {
  id: MarketSectionId;
  label: string;
  glyph: string;
  selected: boolean;
  onPress: (id: MarketSectionId) => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={`${label} desk`}
      accessibilityState={{ selected }}
      onPress={() => onPress(id)}
      className={selected
        ? 'min-h-14 flex-1 items-center justify-center border-2 border-blue-dark bg-blue-light px-1'
        : 'min-h-14 flex-1 items-center justify-center border-2 border-transparent px-1'}
      style={({ pressed }) => ({ opacity: pressed ? 0.65 : undefined })}
    >
      <Text className={selected ? 'font-mono text-lg font-bold text-ink' : 'font-mono text-lg text-ink/45'}>
        {glyph}
      </Text>
      <PixelText className={selected
        ? 'mt-0.5 text-sm uppercase text-ink'
        : 'mt-0.5 text-sm uppercase text-ink/50'}>
        {label}
      </PixelText>
    </Pressable>
  );
}

function ScoutingDesk({
  viewModel,
  onStartScoutMission,
  onOpenScoutReport,
  southAmericaScoutActionRef,
  guideFocus,
}: Pick<MarketScreenProps, 'viewModel' | 'onStartScoutMission' | 'onOpenScoutReport' | 'guideFocus'> & {
  southAmericaScoutActionRef: RefObject<View | null>;
}) {
  const status = viewModel.scouting.status;
  const scrollDismissTargetId = viewModel.scouting.choices.find(choice => (
    choice.regionLabel === 'South America'
  ))?.id ?? viewModel.scouting.choices[1]?.id;
  const statusClass = status.kind === 'COMPLETED' || status.kind === 'READY'
    ? 'border-pitch-dark bg-pitch-light'
    : status.kind === 'IN_PROGRESS'
      ? 'border-blue-dark bg-blue-light'
      : 'border-ink bg-white';

  return (
    <View>
      <SectionLabel
        eyebrow="Scout dispatch"
        title="Find the overlooked"
        right={<StatusChip label={viewModel.scouting.officeLabel} />}
      />
      <View className={`border-2 border-b-4 p-4 ${statusClass}`}>
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="font-pixel text-base uppercase text-ink">{status.headline}</Text>
            <Text className="mt-2 text-sm leading-5 text-ink/65">{status.detail}</Text>
          </View>
          {status.progressLabel ? <StatusChip label={status.progressLabel} selected={status.kind === 'READY'} /> : null}
        </View>
        <Text className="mt-3 border-t border-ink/20 pt-2 font-mono text-sm uppercase text-ink/50">
          {viewModel.scouting.precisionLabel}
        </Text>
      </View>

      {viewModel.scouting.reports.length > 0 ? (
        <View className="mt-5 gap-3">
          <Text className="font-pixel text-sm uppercase tracking-wide text-stamp">Scouting reports</Text>
          {viewModel.scouting.reports.map((report, index) => (
            <Pressable
              key={report.playerId}
              accessibilityRole="button"
              accessibilityLabel={`Full scouting report for ${report.playerName}`}
              onPress={() => onOpenScoutReport(report.playerId)}
              className={guideFocus === 'scout-report' && index === 0
                ? 'relative border-2 border-b-4 border-blue-dark bg-blue-light p-3'
                : 'relative border-2 border-b-4 border-ink bg-white p-3'}
              style={({ pressed }) => ({
                opacity: pressed ? 0.78 : 1,
                ...(guideFocus === 'scout-report' && index === 0
                  ? { marginTop: TUTORIAL_TAP_CUE_RESERVED_SPACE }
                  : {}),
              })}
            >
              {guideFocus === 'scout-report' && index === 0 ? (
                <TutorialTapCue
                  detail="Open the report"
                  style={{
                    left: '50%',
                    marginLeft: -TUTORIAL_TAP_CUE_WIDTH / 2,
                    top: -TUTORIAL_TAP_CUE_ABOVE_OFFSET,
                  }}
                />
              ) : null}
              <View className="flex-row items-start justify-between gap-3">
                <View className="overflow-hidden border-2 border-ink bg-blue-light">
                  <PixelPortrait playerId={report.playerId} role={report.role} lookId={report.lookId} />
                </View>
                <View className="flex-1">
                  <Text className="text-lg font-bold text-ink" numberOfLines={1}>{report.playerName}</Text>
                  <Text className="mt-1 font-pixel text-sm uppercase text-blue-dark">
                    {report.role} · {report.ageLabel}
                  </Text>
                  <Text className="mt-1 font-pixel text-sm uppercase text-gold-dark">
                    Potential {report.potentialLabel}
                  </Text>
                </View>
              </View>
              {report.powerLabel ? (
                <View className="mt-3 border-2 border-gold-dark bg-gold-light px-3 py-2">
                  <Text className="font-pixel text-sm uppercase text-ink">★ Confirmed · {report.powerLabel}</Text>
                </View>
              ) : null}
              {report.rumorLabel ? (
                <View className="mt-3 border-2 border-gold-dark bg-gold-light px-3 py-2">
                  <Text className="font-pixel text-sm uppercase text-ink">★ {report.rumorLabel}</Text>
                </View>
              ) : null}
              <View className="mt-3 flex-row flex-wrap gap-1.5">
                {report.stats.map(stat => (
                  <View key={stat.label} className="min-w-[30%] flex-1 border border-ink/25 bg-paper px-2 py-1.5">
                    <PixelText className="text-sm uppercase text-ink/50">{stat.label}</PixelText>
                    <Text className="mt-0.5 font-mono text-base text-ink">{stat.rangeLabel}</Text>
                  </View>
                ))}
              </View>
              <Text className="mt-3 text-right font-pixel text-sm uppercase text-blue-dark">Full report · ranges shown</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <View className="mt-5 gap-3">
          <Text className="font-pixel text-sm uppercase tracking-wide text-stamp">Mission slips</Text>
          {viewModel.scouting.choices.length === 0 ? (
            <EmptyDocket
              title="No missions on offer"
              detail="Scouting assignments are drawn up again next week."
            />
          ) : viewModel.scouting.choices.map((choice, index) => (
            <View
              key={choice.id}
              className={choice.available
                ? 'border-2 border-b-4 border-ink bg-white p-3'
                : 'border-2 border-ink/25 bg-white/50 p-3 opacity-60'}
            >
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1">
                  <PixelText className="text-base uppercase text-ink">{choice.regionLabel}</PixelText>
                  <Text className="mt-1 font-pixel text-sm uppercase text-blue-dark">{choice.focusLabel}</Text>
                </View>
                <Text className="font-mono text-base text-ink">{formatCurrency(choice.cost)}</Text>
              </View>
              <Text className="mt-2 text-sm leading-5 text-ink/60">{choice.detail}</Text>
              <View className="mt-3 flex-row items-center justify-between gap-3 border-t border-ink/15 pt-3">
                <Text className="font-mono text-sm uppercase text-ink/50">{choice.durationLabel}</Text>
                <GuidedAction
                  enabled={guideFocus === 'scout-mission' && index === 0}
                  detail="Send the scout"
                  targetRef={choice.id === scrollDismissTargetId ? southAmericaScoutActionRef : undefined}
                >
                  <SmallAction
                    label="Send scout"
                    accessibilityLabel={`Send scout to ${choice.regionLabel} for ${choice.focusLabel}`}
                    disabled={!choice.available}
                    onPress={() => onStartScoutMission(choice.id)}
                  />
                </GuidedAction>
              </View>
              {choice.blockedReason ? (
                <Text className="mt-2 text-right text-sm font-bold text-stamp">{choice.blockedReason}</Text>
              ) : null}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function TransferDesk({
  viewModel,
  onTransferAction,
  guideFocus,
}: Pick<MarketScreenProps, 'viewModel' | 'onTransferAction' | 'guideFocus'>) {
  const guidedListing = guideFocus === 'transfer-list'
    ? viewModel.transfers.find(listing => listing.direction === 'SELL' && !listing.listed)
    : guideFocus === 'transfer-bid'
      ? viewModel.transfers.find(listing => listing.direction === 'SELL' && listing.bids.length > 0)
      : undefined;
  return (
    <View>
      <SectionLabel
        eyebrow="Transfers"
        title="Buy players · sell your own"
        right={<StatusChip label={viewModel.window.label} tone={viewModel.window.open ? 'success' : 'danger'} />}
      />
      {viewModel.transfers.length === 0 ? (
        <EmptyDocket title="No transfer activity" detail="Scouted players and listed players will appear here." />
      ) : (
        <View className="gap-3">
          {viewModel.transfers.map(listing => (
            <View key={`${listing.direction}-${listing.playerId}`} className="border-2 border-b-4 border-ink bg-white">
              <View className={listing.direction === 'BUY'
                ? 'flex-row items-start justify-between gap-3 border-b-2 border-blue-dark bg-blue-light px-3 py-3'
                : 'flex-row items-start justify-between gap-3 border-b-2 border-pitch-dark bg-pitch-light px-3 py-3'}>
                <View className="overflow-hidden border-2 border-ink bg-white">
                  <PixelPortrait playerId={listing.playerId} role={listing.role} lookId={listing.lookId} />
                </View>
                <View className="flex-1">
                  <Text className="text-lg font-bold text-ink" numberOfLines={1}>{listing.playerName}</Text>
                  <Text className="mt-1 font-pixel text-sm uppercase text-ink/60">
                    {listing.role} · Age {listing.age}
                  </Text>
                  <Text className="mt-1 font-pixel text-sm uppercase text-gold-dark">
                    Potential {listing.potentialLabel}
                  </Text>
                </View>
                <View className="border-2 border-ink bg-white px-2 py-1">
                  <PixelText className="text-sm uppercase text-ink">
                    {listing.direction === 'BUY' ? 'Target' : listing.listed ? 'Bids in' : 'Available'}
                  </PixelText>
                </View>
              </View>
              <View className="p-3">
                {listing.powerLabel ? <StatusChip label={`★ ${listing.powerLabel}`} tone="hero" /> : null}
                <View className={listing.powerLabel ? 'mt-3 flex-row gap-2' : 'flex-row gap-2'}>
                  <Metric label="Valuation" value={formatCurrency(listing.valuation)} />
                  <Metric
                    label={listing.quoteLabel}
                    value={formatCurrency(listing.quote)}
                    tone={listing.direction === 'BUY' ? 'negative' : 'positive'}
                  />
                </View>
                <View className="mt-3 flex-row items-center justify-between gap-3">
                  <Text className="flex-1 text-sm text-ink/55">
                    {listing.blockedReason ?? (listing.direction === 'BUY'
                      ? 'Fee first. Player terms follow.'
                      : listing.listed
                        ? 'Review the saved bid before the registration window closes.'
                        : 'List the player to request up to three club bids. No sale happens yet.')}
                  </Text>
                  {listing.direction === 'BUY' || !listing.listed ? (
                    <GuidedAction enabled={guideFocus === 'transfer-list' && listing === guidedListing} detail="Request the bids">
                      <SmallAction
                        label={listing.actionLabel}
                        accessibilityLabel={`${listing.actionLabel} for ${listing.playerName}`}
                        disabled={!listing.available}
                        onPress={() => onTransferAction(listing.playerId, listing.direction)}
                      />
                    </GuidedAction>
                  ) : null}
                </View>
                {listing.direction === 'SELL' && listing.listed ? (
                  <View className="mt-3 gap-2 border-t-2 border-ink/15 pt-3">
                    {listing.bids.length === 0 ? (
                      <View className="items-center border-2 border-dashed border-ink/25 bg-white/50 px-3 py-4">
                        <PixelText className="text-sm uppercase text-ink/60">Listed · no bids yet</PixelText>
                        <Text className="mt-1 text-center text-sm leading-5 text-ink/55">
                          Rival clubs review the listing each week.
                        </Text>
                      </View>
                    ) : listing.bids.map((bid, index) => (
                      <View key={bid.id} className="flex-row items-center gap-3 border-2 border-ink bg-paper px-3 py-2">
                        <View className="flex-1">
                          <Text className="font-bold text-ink">{index + 1}. {bid.buyerName}</Text>
                          <Text className="mt-1 font-mono text-sm text-pitch-dark">
                            {formatCurrency(bid.fee)} fee
                          </Text>
                        </View>
                        <GuidedAction enabled={guideFocus === 'transfer-bid' && listing === guidedListing && index === 0} detail="Review this bid">
                          <SmallAction
                            label="Accept"
                            accessibilityLabel={`Accept ${bid.buyerName} bid of ${formatCurrency(bid.fee)} for ${listing.playerName}`}
                            disabled={!listing.available}
                            onPress={() => onTransferAction(listing.playerId, 'SELL', bid.id)}
                          />
                        </GuidedAction>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function CoachDesk({
  viewModel,
  onHireCoach,
}: Pick<MarketScreenProps, 'viewModel' | 'onHireCoach'>) {
  return (
    <View>
      <SectionLabel
        eyebrow="Pre-season shortlist"
        title="A voice for the touchline"
        right={<StatusChip label={`${viewModel.coaches.length} ${viewModel.coaches.length === 1 ? 'candidate' : 'candidates'}`} />}
      />
      {viewModel.coaches.length === 0 ? (
        <EmptyDocket title="Shortlist pending" detail="Coach candidates refresh each pre-season." />
      ) : (
        <View className="gap-3">
          {viewModel.coaches.map(coach => (
            <View
              key={coach.id}
              className={coach.retiredLegend
                ? 'border-2 border-b-4 border-gold-dark bg-gold-light p-3'
                : 'border-2 border-b-4 border-ink bg-white p-3'}
            >
              <View className="flex-row items-start gap-3">
                <View className="border-2 border-b-4 border-ink bg-blue-light px-2 pt-2">
                  <ManagementSprite
                    spriteKey={`coach:${coach.portraitId}:rest`}
                    width={72}
                    accessibilityLabel={`${coach.name} coach portrait`}
                  />
                </View>
                <View className="min-w-0 flex-1">
                  <Text className="text-lg font-bold text-ink" numberOfLines={1}>{coach.name}</Text>
                  <Text className="mt-1 font-pixel text-sm uppercase text-blue-dark">
                    Age {coach.age} · {coach.personalityLabel} · {coach.levelLabel}
                  </Text>
                  {coach.retiredLegend ? (
                    <View className="mt-2 self-start -rotate-2 border-2 border-gold-dark bg-white px-2 py-1">
                      <PixelText className="text-sm uppercase text-gold-dark">Club legend</PixelText>
                    </View>
                  ) : null}
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
                <Text className="font-pixel text-sm uppercase text-ink">
                  {formatCurrency(coach.weeklyWage)} / week
                </Text>
                <View className="mt-2 border-t border-blue-dark/25 pt-2">
                  <Text className="font-pixel text-sm uppercase text-blue-dark">As head coach</Text>
                  {coach.headEffectLabels.map(effect => (
                    <Text key={`head-${effect}`} className="mt-1 text-sm font-bold text-ink">{effect}</Text>
                  ))}
                </View>
                {coach.assistantSlotUnlocked ? (
                  <View className="mt-2 border-t border-blue-dark/25 pt-2">
                    <Text className="font-pixel text-sm uppercase text-blue-dark">As assistant</Text>
                    {coach.assistantEffectLabels.map(effect => (
                      <Text key={`assistant-${effect}`} className="mt-1 text-sm text-ink/75">{effect}</Text>
                    ))}
                  </View>
                ) : null}
                {coach.unlockLabel ? <Text className="mt-1 text-sm text-ink/65">{coach.unlockLabel}</Text> : null}
                {coach.loyaltyLabel ? <Text className="mt-1 text-sm font-bold text-gold-dark">{coach.loyaltyLabel}</Text> : null}
              </View>
              <View className="mt-3 gap-2">
                <Text className="text-sm text-stamp">
                  {coach.currentRole ?? coach.blockedReason ?? 'Available to hire.'}
                </Text>
                {!coach.assistantSlotUnlocked ? (
                  <Text className="text-sm font-bold text-blue-dark">Build the Coaching Office to open the assistant desk.</Text>
                ) : null}
                <View className="flex-row justify-end gap-2">
                  <SmallAction
                    label="Hire as head"
                    accessibilityLabel={`Hire ${coach.name} as head coach`}
                    disabled={!coach.headAvailable}
                    onPress={() => onHireCoach(coach.id, 'HEAD')}
                  />
                  <SmallAction
                    label="Hire as assistant"
                    accessibilityLabel={`Hire ${coach.name} as assistant coach`}
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
  pitchCard: PitchCard | undefined;
  setPitchCard: Dispatch<SetStateAction<PitchCard | undefined>>;
}

/**
 * Holds the in-progress contract offer for whichever screen renders the panel.
 *
 * It lives in the parent because `MarketScreen` renders `NegotiationPanel` from
 * two different JSX trees — one per layout mode — so crossing the 960px
 * breakdown point unmounts and remounts the panel. Owning the draft here means
 * dragging a desktop window wider mid-negotiation no longer silently discards
 * the wage, term, promise, and pitch card the user had dialled in.
 */
export function useContractDraft(viewModel: MarketNegotiationViewModel | undefined): ContractDraft {
  const [weeklyWage, setWeeklyWage] = useState(viewModel?.initialWeeklyWage ?? 0);
  const [termSeasons, setTermSeasons] = useState<1 | 2 | 3>(2);
  const [perk, setPerk] = useState<ContractPerk>('GUARANTEED_STARTER');
  const [pitchCard, setPitchCard] = useState<PitchCard | undefined>();

  const id = viewModel?.id;
  const roundLabel = viewModel?.roundLabel;
  const initialWeeklyWage = viewModel?.initialWeeklyWage;
  useEffect(() => {
    if (initialWeeklyWage === undefined) return;
    setWeeklyWage(initialWeeklyWage);
    setPitchCard(undefined);
    // Term and promise reset with the target too. Leaving them behind handed the
    // next player a term and a binding promise the user never chose for them.
    setTermSeasons(2);
    setPerk('GUARANTEED_STARTER');
  }, [id, roundLabel, initialWeeklyWage]);

  return {
    weeklyWage, setWeeklyWage, termSeasons, setTermSeasons,
    perk, setPerk, pitchCard, setPitchCard,
  };
}

export function NegotiationPanel({
  viewModel,
  draft,
  onSubmitContractOffer,
  onClose,
  guided = false,
  flush = false,
}: {
  viewModel: MarketNegotiationViewModel;
  /** Owned by the parent screen so a layout-mode remount cannot discard the offer. */
  draft: ContractDraft;
  onSubmitContractOffer: MarketScreenProps['onSubmitContractOffer'];
  onClose: () => void;
  guided?: boolean;
  /** Omits the panel's own top margin — for use as a SectionFlow section, which owns inter-section spacing. Defaults to false so SeasonEndScreen is unaffected. */
  flush?: boolean;
}) {
  const { weeklyWage, setWeeklyWage, termSeasons, setTermSeasons, perk, setPerk, pitchCard, setPitchCard } = draft;

  const open = viewModel.status === 'OPEN';
  const moodClass = viewModel.mood === 'ANGRY' || viewModel.mood === 'UNHAPPY'
    ? 'border-red-dark bg-red-light'
    : viewModel.mood === 'PLEASED' || viewModel.mood === 'THRILLED'
      ? 'border-pitch-dark bg-pitch-light'
      : 'border-blue-dark bg-blue-light';

  return (
    <PaperPanel kicker="Agent on line two" title={viewModel.playerName} stamp={viewModel.roundLabel} className={flush ? undefined : 'mt-6'}>
      <View className={`flex-row items-center gap-3 border-2 p-3 ${moodClass}`}>
        <View className="overflow-hidden border-2 border-ink bg-white">
          <PixelPortrait
            playerId={viewModel.playerId}
            role={viewModel.playerRole}
            lookId={viewModel.lookId}
            expression={viewModel.mood === 'ANGRY' || viewModel.mood === 'UNHAPPY'
              ? 'ko'
              : viewModel.mood === 'PLEASED' || viewModel.mood === 'THRILLED'
                ? 'joy'
                : 'rest'}
          />
        </View>
        <View className="flex-1">
          <Text className="font-pixel text-base uppercase text-ink">{viewModel.moodLabel}</Text>
          <PixelText className="mt-1 text-sm uppercase text-ink/60">{viewModel.personalityLabel} personality</PixelText>
          <Text className="mt-2 font-pixel text-sm uppercase text-blue-dark">
            {viewModel.pitchLeverageLabel}
          </Text>
        </View>
      </View>

      {viewModel.lastOutcomeLabel ? (
        <View className="mt-3 border-2 border-stamp bg-red-light px-3 py-2">
          <Text className="text-sm font-bold text-ink">{viewModel.lastOutcomeLabel}</Text>
        </View>
      ) : null}

      {open ? (
        <>
          <View className="mt-4">
            <Text className="font-pixel text-sm uppercase text-stamp">1 · Weekly wage</Text>
            <View className="mt-2 flex-row items-stretch gap-2">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Reduce weekly wage by ${formatCurrency(viewModel.wageStep)}`}
                onPress={() => setWeeklyWage(value => Math.max(viewModel.wageStep, value - viewModel.wageStep))}
                className="h-12 w-12 items-center justify-center border-2 border-b-4 border-ink bg-paper-dark"
              >
                <Text className="font-mono text-2xl font-bold text-ink">−</Text>
              </Pressable>
              <View className="h-12 flex-1 items-center justify-center border-2 border-ink bg-white">
                <Text className="font-mono text-xl text-ink">{formatCurrency(weeklyWage)} / wk</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Increase weekly wage by ${formatCurrency(viewModel.wageStep)}`}
                onPress={() => setWeeklyWage(value => value + viewModel.wageStep)}
                className="h-12 w-12 items-center justify-center border-2 border-b-4 border-blue-dark bg-blue-light"
              >
                <Text className="font-mono text-2xl font-bold text-ink">+</Text>
              </Pressable>
            </View>
          </View>

          <View className="mt-4">
            <Text className="font-pixel text-sm uppercase text-stamp">2 · Contract term</Text>
            <View className="mt-2 flex-row gap-2">
              {([1, 2, 3] as const).map(term => (
                <Pressable
                  key={term}
                  accessibilityRole="radio"
                  accessibilityLabel={`${term} season contract`}
                  accessibilityState={{ selected: termSeasons === term }}
                  onPress={() => setTermSeasons(term)}
                  className={termSeasons === term
                    ? 'min-h-12 flex-1 items-center justify-center border-2 border-b-4 border-blue-dark bg-blue-light'
                    : 'min-h-12 flex-1 items-center justify-center border-2 border-ink/30 bg-white'}
                >
                  <Text className="font-pixel text-base text-ink">{term}Y</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View className="mt-4">
            <Text className="font-pixel text-sm uppercase text-stamp">3 · One promise</Text>
            <View className="mt-2 flex-row flex-wrap gap-2">
              {viewModel.perks.map(option => (
                <Pressable
                  key={option.id}
                  accessibilityRole="radio"
                  accessibilityLabel={`${option.label}. ${option.detail}`}
                  accessibilityState={{ selected: perk === option.id }}
                  onPress={() => setPerk(option.id)}
                  className={perk === option.id
                    ? 'min-h-14 w-[48%] flex-grow justify-center border-2 border-b-4 border-blue-dark bg-blue-light px-3 py-2'
                    : 'min-h-14 w-[48%] flex-grow justify-center border-2 border-ink/30 bg-white px-3 py-2'}
                >
                  <PixelText className="text-sm uppercase text-ink">{option.label}</PixelText>
                  <Text className="mt-0.5 text-sm text-ink/55" numberOfLines={1}>{option.detail}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View className="mt-4">
            <Text className="font-pixel text-sm uppercase text-stamp">4 · Pitch card · optional</Text>
            <View className="mt-2 gap-2">
              {viewModel.cards.length === 0 ? (
                <EmptyDocket
                  title="No cards in hand"
                  detail="Pitch cards are earned from board objectives and cup runs."
                />
              ) : viewModel.cards.map(card => {
                const selected = pitchCard === card.id;
                return (
                  <Pressable
                    key={card.id}
                    accessibilityRole="radio"
                    accessibilityLabel={`${card.label}. ${card.detail}`}
                    accessibilityState={{ selected, disabled: card.used }}
                    disabled={card.used}
                    onPress={() => setPitchCard(current => current === card.id ? undefined : card.id)}
                    className={card.used
                      ? 'min-h-14 border-2 border-ink/20 bg-ink/5 px-3 py-2 opacity-45'
                      : selected
                        ? 'min-h-14 border-2 border-b-4 border-blue-dark bg-blue-light px-3 py-2'
                        : 'min-h-14 border-2 border-ink/30 bg-white px-3 py-2'}
                  >
                    <View className="flex-row items-center justify-between gap-3">
                      <PixelText className="text-sm uppercase text-ink">{card.label}</PixelText>
                      <Text className="font-pixel text-sm uppercase text-ink/50">
                        {card.used ? 'Played' : selected ? 'Loaded' : 'Card'}
                      </Text>
                    </View>
                    <Text className="mt-1 text-sm text-ink/60">{card.detail}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View
            className={guided ? 'relative border-2 border-blue-dark bg-blue-light p-1' : 'relative mt-4'}
            style={guided ? { marginTop: TUTORIAL_TAP_CUE_RESERVED_SPACE } : undefined}
          >
            {guided ? (
              <TutorialTapCue
                detail="Make the offer"
                style={{
                  left: '50%',
                  marginLeft: -TUTORIAL_TAP_CUE_WIDTH / 2,
                  top: -TUTORIAL_TAP_CUE_ABOVE_OFFSET,
                }}
              />
            ) : null}
            <ActionButton
              label="Make the offer ▸"
              accessibilityLabel={`Offer ${formatCurrency(weeklyWage)} per week for ${termSeasons} seasons`}
              variant="confirm"
              onPress={() => onSubmitContractOffer({ weeklyWage, termSeasons, perk }, pitchCard)}
            />
          </View>
          <Text className="mt-2 text-center text-sm text-ink/50">
            Three rounds maximum. An offer below half their ask ends talks immediately.
          </Text>
        </>
      ) : (
        <View className="mt-4">
          <ActionButton
            label="Close agent file"
            accessibilityLabel="Close completed contract negotiation"
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
      className={enabled ? 'relative border-2 border-blue-dark bg-blue-light p-1' : 'relative'}
      style={enabled ? { marginTop: TUTORIAL_TAP_CUE_RESERVED_SPACE } : undefined}
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

function SmallAction({
  label,
  accessibilityLabel,
  disabled,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className={disabled
        ? 'min-h-11 min-w-24 items-center justify-center border-2 border-ink/20 bg-ink/5 px-3'
        : 'min-h-11 min-w-24 items-center justify-center border-2 border-b-4 border-blue-dark bg-blue-light px-3'}
      style={({ pressed }) => ({ transform: [{ translateY: pressed && !disabled ? 2 : 0 }] })}
    >
      <PixelText className={disabled
        ? 'text-center text-sm uppercase text-ink/30'
        : 'text-center text-sm uppercase text-ink'}>
        {label}
      </PixelText>
    </Pressable>
  );
}
