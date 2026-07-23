import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
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

  useEffect(() => {
    if (requestedSection === 'YOUTH' && youthSectionVisible) setSection('YOUTH');
    else if (requestedSection === 'SCOUT' && scoutSectionVisible) setSection('SCOUT');
    else if (requestedSection === 'TRANSFERS' && transferSectionVisible) setSection('TRANSFERS');
    else if (requestedSection === 'COACHES' && coachSectionVisible) setSection('COACHES');
  }, [
    coachSectionVisible,
    requestedSection,
    requestedSectionToken,
    scoutSectionVisible,
    transferSectionVisible,
    youthSectionVisible,
  ]);

  return (
    <View ref={marketViewportRef} collapsable={false} className="flex-1">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
      <View className="flex-row items-end justify-between gap-3">
        <View className="flex-1">
          <Text className="font-mono text-sm font-bold uppercase tracking-[2px] text-blue-dark">
            Recruitment office
          </Text>
          <Text className="mt-1 font-pixel text-xl uppercase text-ink">Market docket</Text>
        </View>
        <StatusChip label={viewModel.periodLabel} />
      </View>

      <PaperPanel
        kicker="Registration desk"
        title="Build the next great side"
        stamp={viewModel.window.open ? 'Open' : 'Shut'}
        className="mt-5"
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

      {viewModel.negotiation ? (
        <NegotiationPanel
          viewModel={viewModel.negotiation}
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

      {section === 'YOUTH' && viewModel.youth ? (
        <YouthDesk
          viewModel={viewModel}
          onSignYouth={onSignYouth}
          onDeclineYouth={onDeclineYouth}
          guideFocus={visibleGuideFocus}
        />
      ) : section === 'SCOUT' ? (
        <ScoutingDesk
          viewModel={viewModel}
          onStartScoutMission={onStartScoutMission}
          onOpenScoutReport={onOpenScoutReport}
          southAmericaScoutActionRef={southAmericaScoutActionRef}
          guideFocus={visibleGuideFocus}
        />
      ) : section === 'TRANSFERS' ? (
        <TransferDesk viewModel={viewModel} onTransferAction={onTransferAction} guideFocus={visibleGuideFocus} />
      ) : (
        <CoachDesk viewModel={viewModel} onHireCoach={onHireCoach} />
      )}
      </ScrollView>
    </View>
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
    <View className="mt-6">
      <SectionLabel
        eyebrow="Pre-season academy intake"
        title="Meet the next generation"
        right={<StatusChip label={intake.rosterLabel} />}
      />
      <View className={intake.status === 'OPEN'
        ? 'border-2 border-b-4 border-violet-dark bg-violet-light p-4'
        : 'border-2 border-b-4 border-ink bg-white p-4'}
      >
        <Text className="font-pixel text-base uppercase text-ink">{intake.headline}</Text>
        <Text className="mt-2 text-sm leading-5 text-ink/65">{intake.detail}</Text>
      </View>

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
                  <Text className="mt-1 font-mono text-sm font-bold uppercase text-blue-dark">
                    {offer.role} · {offer.ageLabel} · {offer.archetypeLabel}
                  </Text>
                </View>
                <View className="-rotate-2 border-2 border-violet-dark bg-violet-light px-2 py-1">
                  <Text className="text-sm font-bold uppercase text-violet-dark">Academy</Text>
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
                <GuidedAction enabled={guideFocus === 'youth-intake' && offer === intake.offers[0]} detail="Review this youth">
                  <SmallAction
                    label="Sign"
                    accessibilityLabel={`Sign youth player ${offer.playerName}`}
                    disabled={!offer.available}
                    onPress={() => onSignYouth(offer.playerId)}
                  />
                </GuidedAction>
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
        ? 'min-h-14 flex-1 items-center justify-center border-2 border-violet-dark bg-violet-light px-1'
        : 'min-h-14 flex-1 items-center justify-center border-2 border-transparent px-1'}
      style={({ pressed }) => ({ opacity: pressed ? 0.65 : undefined })}
    >
      <Text className={selected ? 'font-mono text-lg font-bold text-ink' : 'font-mono text-lg text-ink/45'}>
        {glyph}
      </Text>
      <Text className={selected
        ? 'mt-0.5 text-sm font-bold uppercase text-ink'
        : 'mt-0.5 text-sm font-bold uppercase text-ink/50'}>
        {label}
      </Text>
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
    <View className="mt-6">
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
          <Text className="font-mono text-sm font-bold uppercase tracking-wide text-stamp">Scouting reports</Text>
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
                  <Text className="mt-1 font-mono text-sm font-bold uppercase text-blue-dark">
                    {report.role} · {report.ageLabel}
                  </Text>
                </View>
              </View>
              {report.powerLabel ? (
                <View className="mt-3 border-2 border-gold-dark bg-gold-light px-3 py-2">
                  <Text className="font-mono text-sm font-bold uppercase text-ink">★ Confirmed · {report.powerLabel}</Text>
                </View>
              ) : null}
              {report.rumorLabel ? (
                <View className="mt-3 border-2 border-gold-dark bg-gold-light px-3 py-2">
                  <Text className="font-mono text-sm font-bold uppercase text-ink">★ {report.rumorLabel}</Text>
                </View>
              ) : null}
              <View className="mt-3 flex-row flex-wrap gap-1.5">
                {report.stats.map(stat => (
                  <View key={stat.label} className="min-w-[30%] flex-1 border border-ink/25 bg-paper px-2 py-1.5">
                    <Text className="text-sm font-bold uppercase text-ink/50">{stat.label}</Text>
                    <Text className="mt-0.5 font-mono text-base font-bold text-ink">{stat.rangeLabel}</Text>
                  </View>
                ))}
              </View>
              <Text className="mt-3 text-right font-mono text-sm font-bold uppercase text-blue-dark">Full report · ranges shown</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <View className="mt-5 gap-3">
          <Text className="font-mono text-sm font-bold uppercase tracking-wide text-stamp">Mission slips</Text>
          {viewModel.scouting.choices.map((choice, index) => (
            <View
              key={choice.id}
              className={choice.available
                ? 'border-2 border-b-4 border-ink bg-white p-3'
                : 'border-2 border-ink/25 bg-white/50 p-3 opacity-60'}
            >
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1">
                  <Text className="text-base font-bold uppercase text-ink">{choice.regionLabel}</Text>
                  <Text className="mt-1 font-mono text-sm font-bold uppercase text-blue-dark">{choice.focusLabel}</Text>
                </View>
                <Text className="font-mono text-base font-bold text-ink">{formatCurrency(choice.cost)}</Text>
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
    <View className="mt-6">
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
                  <Text className="mt-1 font-mono text-sm font-bold uppercase text-ink/60">
                    {listing.role} · Age {listing.age}
                  </Text>
                </View>
                <View className="border-2 border-ink bg-white px-2 py-1">
                  <Text className="text-sm font-bold uppercase text-ink">
                    {listing.direction === 'BUY' ? 'Target' : listing.listed ? 'Bids in' : 'Available'}
                  </Text>
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
                    {listing.bids.map((bid, index) => (
                      <View key={bid.id} className="flex-row items-center gap-3 border-2 border-ink bg-paper px-3 py-2">
                        <View className="flex-1">
                          <Text className="font-bold text-ink">{index + 1}. {bid.buyerName}</Text>
                          <Text className="mt-1 font-mono text-sm font-bold text-pitch-dark">
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
    <View className="mt-6">
      <SectionLabel
        eyebrow="Pre-season shortlist"
        title="A voice for the touchline"
        right={<StatusChip label={`${viewModel.coaches.length} candidates`} />}
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
                  <Text className="mt-1 font-mono text-sm font-bold uppercase text-blue-dark">
                    Age {coach.age} · {coach.personalityLabel} · {coach.levelLabel}
                  </Text>
                  {coach.retiredLegend ? (
                    <View className="mt-2 self-start -rotate-2 border-2 border-gold-dark bg-white px-2 py-1">
                      <Text className="text-sm font-bold uppercase text-gold-dark">Club legend</Text>
                    </View>
                  ) : null}
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
                <Text className="font-mono text-sm font-bold uppercase text-ink">
                  {formatCurrency(coach.weeklyWage)} / week
                </Text>
                <View className="mt-2 border-t border-blue-dark/25 pt-2">
                  <Text className="font-mono text-sm font-bold uppercase text-blue-dark">As head coach</Text>
                  {coach.headEffectLabels.map(effect => (
                    <Text key={`head-${effect}`} className="mt-1 text-sm font-bold text-ink">{effect}</Text>
                  ))}
                </View>
                {coach.assistantSlotUnlocked ? (
                  <View className="mt-2 border-t border-blue-dark/25 pt-2">
                    <Text className="font-mono text-sm font-bold uppercase text-violet-dark">As assistant</Text>
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

export function NegotiationPanel({
  viewModel,
  onSubmitContractOffer,
  onClose,
  guided = false,
}: {
  viewModel: MarketNegotiationViewModel;
  onSubmitContractOffer: MarketScreenProps['onSubmitContractOffer'];
  onClose: () => void;
  guided?: boolean;
}) {
  const [weeklyWage, setWeeklyWage] = useState(viewModel.initialWeeklyWage);
  const [termSeasons, setTermSeasons] = useState<1 | 2 | 3>(2);
  const [perk, setPerk] = useState<ContractPerk>('GUARANTEED_STARTER');
  const [pitchCard, setPitchCard] = useState<PitchCard | undefined>();

  useEffect(() => {
    setWeeklyWage(viewModel.initialWeeklyWage);
    setPitchCard(undefined);
  }, [viewModel.id, viewModel.roundLabel, viewModel.initialWeeklyWage]);

  const open = viewModel.status === 'OPEN';
  const moodClass = viewModel.mood === 'ANGRY' || viewModel.mood === 'UNHAPPY'
    ? 'border-red-dark bg-red-light'
    : viewModel.mood === 'PLEASED' || viewModel.mood === 'THRILLED'
      ? 'border-pitch-dark bg-pitch-light'
      : 'border-blue-dark bg-blue-light';

  return (
    <PaperPanel kicker="Agent on line two" title={viewModel.playerName} stamp={viewModel.roundLabel} className="mt-6">
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
          <Text className="mt-1 text-sm font-bold uppercase text-ink/60">{viewModel.personalityLabel} personality</Text>
          <Text className="mt-2 font-mono text-sm font-bold uppercase text-blue-dark">
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
            <Text className="font-mono text-sm font-bold uppercase text-stamp">1 · Weekly wage</Text>
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
                <Text className="font-mono text-xl font-bold text-ink">{formatCurrency(weeklyWage)} / wk</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Increase weekly wage by ${formatCurrency(viewModel.wageStep)}`}
                onPress={() => setWeeklyWage(value => value + viewModel.wageStep)}
                className="h-12 w-12 items-center justify-center border-2 border-b-4 border-violet-dark bg-violet-light"
              >
                <Text className="font-mono text-2xl font-bold text-ink">+</Text>
              </Pressable>
            </View>
          </View>

          <View className="mt-4">
            <Text className="font-mono text-sm font-bold uppercase text-stamp">2 · Contract term</Text>
            <View className="mt-2 flex-row gap-2">
              {([1, 2, 3] as const).map(term => (
                <Pressable
                  key={term}
                  accessibilityRole="radio"
                  accessibilityLabel={`${term} season contract`}
                  accessibilityState={{ selected: termSeasons === term }}
                  onPress={() => setTermSeasons(term)}
                  className={termSeasons === term
                    ? 'min-h-12 flex-1 items-center justify-center border-2 border-b-4 border-violet-dark bg-violet-light'
                    : 'min-h-12 flex-1 items-center justify-center border-2 border-ink/30 bg-white'}
                >
                  <Text className="font-mono text-base font-bold text-ink">{term}Y</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View className="mt-4">
            <Text className="font-mono text-sm font-bold uppercase text-stamp">3 · One promise</Text>
            <View className="mt-2 flex-row flex-wrap gap-2">
              {viewModel.perks.map(option => (
                <Pressable
                  key={option.id}
                  accessibilityRole="radio"
                  accessibilityLabel={`${option.label}. ${option.detail}`}
                  accessibilityState={{ selected: perk === option.id }}
                  onPress={() => setPerk(option.id)}
                  className={perk === option.id
                    ? 'min-h-14 w-[48%] flex-grow justify-center border-2 border-b-4 border-violet-dark bg-violet-light px-3 py-2'
                    : 'min-h-14 w-[48%] flex-grow justify-center border-2 border-ink/30 bg-white px-3 py-2'}
                >
                  <Text className="text-sm font-bold uppercase text-ink">{option.label}</Text>
                  <Text className="mt-0.5 text-sm text-ink/55" numberOfLines={1}>{option.detail}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View className="mt-4">
            <Text className="font-mono text-sm font-bold uppercase text-stamp">4 · Pitch card · optional</Text>
            <View className="mt-2 gap-2">
              {viewModel.cards.map(card => {
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
                        ? 'min-h-14 border-2 border-b-4 border-violet-dark bg-violet-light px-3 py-2'
                        : 'min-h-14 border-2 border-ink/30 bg-white px-3 py-2'}
                  >
                    <View className="flex-row items-center justify-between gap-3">
                      <Text className="text-sm font-bold uppercase text-ink">{card.label}</Text>
                      <Text className="font-mono text-sm font-bold uppercase text-ink/50">
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
            className={guided ? 'relative mt-4 border-2 border-blue-dark bg-blue-light p-1' : 'relative mt-4'}
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
              label="Make the offer  ▸"
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
        : 'min-h-11 min-w-24 items-center justify-center border-2 border-b-4 border-violet-dark bg-violet-light px-3'}
      style={({ pressed }) => ({ transform: [{ translateY: pressed && !disabled ? 2 : 0 }] })}
    >
      <Text className={disabled
        ? 'text-center text-sm font-bold uppercase text-ink/30'
        : 'text-center text-sm font-bold uppercase text-ink'}>
        {label}
      </Text>
    </Pressable>
  );
}

function EmptyDocket({ title, detail }: { title: string; detail: string }) {
  return (
    <View className="items-center border-2 border-dashed border-ink/30 bg-white/50 px-5 py-10">
      <Text className="font-mono text-3xl text-ink/25">□</Text>
      <Text className="mt-3 font-pixel text-base uppercase text-ink">{title}</Text>
      <Text className="mt-2 text-center text-sm leading-5 text-ink/55">{detail}</Text>
    </View>
  );
}
