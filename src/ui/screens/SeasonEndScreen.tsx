import { useCallback, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import type {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ContractOffer, PitchCard } from '../../game/market';
import { PROMOTION_WAGE_CLAUSE_PERCENT } from '../../game/contract-wages';
import {
  ActionButton,
  Metric,
  PaperPanel,
  StatusChip,
  formatCurrency,
} from '../components/Scorecard';
import {
  ChalkboardBackdrop,
  StageSection,
} from '../components/ChalkboardStage';
import { PixelPortrait } from '../components/PixelPortrait';
import { useLayoutMode } from '../layout/use-layout-mode';
import type { SeasonEndViewModel } from '../models';
import { scaledBody } from '../text-scale';
import type { TextScale } from '../../persistence';
import { SfxPressable as Pressable } from '../components/SfxPressable';
import { SettingsButton } from '../SettingsOverlay';
import { NegotiationPanel, useContractDraft } from './MarketScreen';
import { useTapGuard } from '../use-tap-guard';
import { PixelText } from '../components/PixelText';
import { DesktopClamp, useDesktopContentStyle } from '../layout/DesktopClamp';
import { AgentFinalDemandGate } from '../AgentFinalDemandGate';
import { AgentFinalDemandWalkOn } from '../AgentFinalDemandWalkOn';
import { isExpiredContractRevealed } from '../expired-contract-reveal';
import { useCopy } from '../../i18n';
import { ClubCrest } from '../components/ClubCrest';

/**
 * How long the agent's greeting holds before he walks off. Long enough to read
 * six words at the typewriter's pace, short enough that it never becomes a
 * gate between the manager and the table he asked for.
 */
const AGENT_GREETING_HOLD_MS = 1_400;

export interface SeasonEndScreenProps {
  viewModel: SeasonEndViewModel;
  onSelectContractTerm: (playerId: string, term: 1 | 2 | 3) => void;
  onRenewContract: (playerId: string, term: 1 | 2 | 3) => void;
  onReleaseContract: (playerId: string) => void;
  onStartRenewal: (playerId: string) => void;
  onSubmitRenewalOffer: (offer: ContractOffer, pitchCard?: PitchCard) => void;
  onCloseRenewal: () => void;
  onPrimaryAction: () => void;
  onOpenSettings: () => void;
  /**
   * Fires the first time the expired-contract section is genuinely on screen.
   *
   * The season review is a long page and the renewal queue is the last thing on
   * it, so a lesson raised on arrival would be delivered over the league table
   * about a card the manager has not reached. Reported upward rather than owned
   * here because whether it is worth saying is a career question — Teacher
   * mode, once per career — and this screen holds neither.
   */
  onExpiredContractVisible?: () => void;
  guideCopy?: { title: string; body: string };
  textScale?: TextScale;
}

export function SeasonEndScreen({
  viewModel,
  onSelectContractTerm,
  onRenewContract,
  onReleaseContract,
  onStartRenewal,
  onSubmitRenewalOffer,
  onCloseRenewal,
  onPrimaryAction,
  onOpenSettings,
  onExpiredContractVisible,
  guideCopy,
  textScale = 1,
}: SeasonEndScreenProps) {
  const t = useCopy();
  const desktopContent = useDesktopContentStyle();
  const renewalDraft = useContractDraft(viewModel.renewalNegotiation);
  const wide = useLayoutMode() === 'twoColumn';
  // Renewals arrive as a queue: committing one re-renders this same button
  // holding the next player, so an ordinary double-tap would sign a wage the
  // manager never saw.
  const guardTap = useTapGuard();
  /** The player whose agent is currently on screen, before his table opens. */
  const [agentGreetingPlayerId, setAgentGreetingPlayerId] = useState<
    string | null
  >(null);
  const contract = viewModel.expiredContract;
  /*
   * Three measurements decide whether the renewal queue has been reached, and
   * all three live in refs rather than state. Storing the scroll offset in
   * state would repaint the whole review — league table, awards, settlement —
   * on every frame of a flick, for a value nothing above draws.
   */
  const revealedExpiredContractRef = useRef(false);
  const viewportHeightRef = useRef(0);
  const expiredContractTopRef = useRef<number | undefined>(undefined);
  const scrollOffsetRef = useRef(0);
  const checkExpiredContractReached = useCallback(() => {
    if (
      revealedExpiredContractRef.current ||
      onExpiredContractVisible === undefined
    )
      return;
    if (
      !isExpiredContractRevealed({
        sectionTop: expiredContractTopRef.current,
        viewportHeight: viewportHeightRef.current,
        scrollOffset: scrollOffsetRef.current,
      })
    )
      return;
    revealedExpiredContractRef.current = true;
    onExpiredContractVisible();
  }, [onExpiredContractVisible]);
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
      viewportHeightRef.current = event.nativeEvent.layoutMeasurement.height;
      checkExpiredContractReached();
    },
    [checkExpiredContractReached],
  );
  // A tall desktop window can show the queue without a scroll ever happening,
  // and no scroll event means no `layoutMeasurement`. The two layouts supply
  // the same pair of numbers from the other direction.
  const handleScrollViewLayout = useCallback(
    (event: LayoutChangeEvent) => {
      viewportHeightRef.current = event.nativeEvent.layout.height;
      checkExpiredContractReached();
    },
    [checkExpiredContractReached],
  );
  const handleExpiredContractLayout = useCallback(
    (event: LayoutChangeEvent) => {
      expiredContractTopRef.current = event.nativeEvent.layout.y;
      checkExpiredContractReached();
    },
    [checkExpiredContractReached],
  );
  // The season-end fanfare is owned by App.tsx, keyed per career/season so it
  // fires exactly once. Do not add a second cue here.
  const outcomeTone =
    viewModel.outcomeLabel === 'CHAMPIONS' ||
    viewModel.outcomeLabel === 'PROMOTED'
      ? 'success'
      : viewModel.outcomeLabel === 'RELEGATED'
        ? 'danger'
        : 'normal';

  return (
    <SafeAreaView
      className="flex-1 bg-pitch-ink"
      edges={['top', 'left', 'right', 'bottom']}
    >
      <ChalkboardBackdrop wide={wide} />
      <View className="flex-row items-center justify-between px-4 py-3">
        <View>
          <Text className="font-pixel text-xs uppercase tracking-[2px] text-gold-light">
            {t('titleLanding.frontOffice')}
          </Text>
          <Text className="mt-1 font-pixel text-base uppercase text-white">
            {t('seasonEnd.seasonReview')}
          </Text>
        </View>
        <SettingsButton onPress={onOpenSettings} />
      </View>
      <ScrollView
        className="flex-1"
        contentContainerStyle={[
          { padding: 16, paddingBottom: 28 },
          desktopContent,
        ]}
        onLayout={handleScrollViewLayout}
        onScroll={handleScroll}
        // Frequent enough that Bert arrives as the section clears the fold
        // rather than a beat after it, and still far short of every frame.
        scrollEventThrottle={64}
      >
        <View className="items-center py-3">
          <Text className="font-pixel text-xs uppercase tracking-[2px] text-gold-light">
            {t('seasonEnd.seasonComplete')}
          </Text>
          <Text className="mt-2 font-pixel text-3xl uppercase tracking-wide text-white">
            {viewModel.seasonLabel}
          </Text>
          <View className="mt-4 rotate-2 border-2 border-red bg-red-light/25 px-5 py-3">
            <PixelText className="text-xl uppercase text-red-light">
              {t(`seasonEnd.outcome.${viewModel.outcomeLabel.toLowerCase()}`)}
            </PixelText>
          </View>
          <Text className="mt-5 text-center font-pixel text-xl uppercase text-white">
            {viewModel.headline}
          </Text>
          <Text
            className="mt-2 max-w-sm text-center text-paper/75"
            style={scaledBody(textScale)}
          >
            {viewModel.summary}
          </Text>
          <View className="mt-4 flex-row gap-2">
            <StatusChip
              label={t('seasonEnd.finishedPosition', {
                position: viewModel.finalPosition,
              })}
              tone={outcomeTone}
            />
            <StatusChip
              label={t('seasonEnd.prize', {
                amount: formatCurrency(t, viewModel.prizeMoney),
              })}
            />
            <StatusChip
              label={t(
                viewModel.difficultyLabel === 'CHAIRMAN'
                  ? 'settings.difficulty.chairman'
                  : 'settings.difficulty.cozy',
              )}
              tone="hero"
            />
          </View>
        </View>

        {viewModel.clubBusinessSettlement ? (
          <View className="mt-6">
            <StageSection
              eyebrow={t('seasonEnd.clubBusiness')}
              title={t('seasonEnd.seasonEndPayday')}
            />
            <PaperPanel
              kicker={t('seasonEnd.cashActuallyReceived')}
              title={t('seasonEnd.sponsorsAndBuzz')}
              stamp={formatCurrency(
                t,
                viewModel.clubBusinessSettlement.actualPayoutTotal,
                true,
              )}
            >
              {viewModel.clubBusinessSettlement.buzz ? (
                <View
                  className="border-2 border-ink bg-blue-light p-3"
                  accessible
                  accessibilityLabel={t('seasonEnd.a11y.buzzPayout', {
                    reached: viewModel.clubBusinessSettlement.buzz.reached,
                    amount: formatCurrency(
                      t,
                      viewModel.clubBusinessSettlement.buzz.actualPayout,
                    ),
                    resetTo: viewModel.clubBusinessSettlement.buzz.resetTo,
                  })}
                >
                  <View className="flex-row flex-wrap items-center justify-between gap-2">
                    <PixelText className="text-base uppercase text-ink">
                      {t('seasonEnd.buzzPayout')}
                    </PixelText>
                    <StatusChip label={t('seasonEnd.paid')} tone="success" />
                  </View>
                  <Text className="mt-2 text-sm leading-5 text-ink">
                    {t('seasonEnd.buzzSettlement', {
                      reached: viewModel.clubBusinessSettlement.buzz.reached,
                      amount: formatCurrency(
                        t,
                        viewModel.clubBusinessSettlement.buzz.actualPayout,
                      ),
                      resetTo: viewModel.clubBusinessSettlement.buzz.resetTo,
                    })}
                  </Text>
                </View>
              ) : null}

              {viewModel.clubBusinessSettlement.objectiveResults.length > 0 ? (
                <View
                  className={
                    viewModel.clubBusinessSettlement.buzz
                      ? 'mt-3 gap-2'
                      : 'gap-2'
                  }
                >
                  {viewModel.clubBusinessSettlement.objectiveResults.map(
                    (result) => (
                      <View
                        key={result.contractId}
                        className="border-2 border-ink bg-white p-3"
                        accessible
                        // One whole sentence per outcome: "target met" is not a
                        // fragment that can be dropped into an English frame in
                        // every language.
                        accessibilityLabel={t(
                          result.met
                            ? 'seasonEnd.a11y.sponsorTargetMet'
                            : 'seasonEnd.a11y.sponsorTargetMissed',
                          {
                            sponsor: result.sponsorName,
                            objective: result.objectiveLabel,
                            amount: formatCurrency(t, result.actualBonus),
                          },
                        )}
                      >
                        <View className="flex-row flex-wrap items-start justify-between gap-2">
                          <PixelText className="min-w-0 flex-1 text-base uppercase text-ink">
                            {result.sponsorName}
                          </PixelText>
                          <StatusChip
                            label={
                              result.met
                                ? t('seasonEnd.targetMet')
                                : t('seasonEnd.targetMissed')
                            }
                            tone={result.met ? 'success' : 'danger'}
                          />
                        </View>
                        <Text className="mt-2 text-sm leading-5 text-ink/70">
                          {result.objectiveLabel}
                        </Text>
                        <Text
                          className={
                            result.met
                              ? 'mt-2 font-mono text-base text-pitch-ink'
                              : 'mt-2 font-mono text-base text-red-dark'
                          }
                        >
                          {t('seasonEnd.clubReceived', {
                            amount: formatCurrency(t, result.actualBonus),
                          })}
                        </Text>
                      </View>
                    ),
                  )}
                  <View className="flex-row flex-wrap items-center justify-between gap-2 border-t-2 border-ink pt-3">
                    <PixelText className="text-sm uppercase text-ink/70">
                      {t('seasonEnd.objectiveBonuses')}
                    </PixelText>
                    <Text className="font-mono text-lg text-ink">
                      {formatCurrency(
                        t,
                        viewModel.clubBusinessSettlement.objectiveBonusTotal,
                      )}
                    </Text>
                  </View>
                </View>
              ) : null}
            </PaperPanel>
          </View>
        ) : null}

        {viewModel.recap ? (
          <View className="mt-6">
            <StageSection
              eyebrow={t('seasonEnd.seasonInNumbers')}
              title={t('seasonEnd.theYearInTheCabinet')}
            />
            {guideCopy ? (
              <PaperPanel
                kicker={t('seasonEnd.bertRudge')}
                title={guideCopy.title}
                stamp={t('seasonEnd.filed')}
              >
                <Text className="text-ink/70" style={scaledBody(textScale)}>
                  {guideCopy.body}
                </Text>
              </PaperPanel>
            ) : null}
            <View className={wide ? 'mt-3 flex-row gap-2' : 'mt-3 gap-2'}>
              <Metric
                label={t('seasonEnd.record')}
                value={viewModel.recap.record}
              />
              <Metric
                label={t('seasonEnd.goals')}
                value={viewModel.recap.goals}
              />
            </View>
            <View className="mt-2 flex-row gap-2">
              <Metric
                label={t('seasonEnd.cashChange')}
                value={formatCurrency(t, viewModel.recap.cashChange, true)}
              />
              <Metric
                label={t('seasonEnd.closingCash')}
                value={formatCurrency(t, viewModel.recap.closingCash)}
              />
            </View>
            <PaperPanel
              kicker={t('seasonEnd.cupAndDevelopment')}
              title={viewModel.recap.cupResult}
              stamp={t('seasonEnd.capsReached', {
                count: viewModel.recap.trainingCapsReached,
              })}
              className="mt-3"
            >
              <Text className="text-sm leading-5 text-ink/60">
                {viewModel.recap.memorableEventTitle
                  ? t('seasonEnd.clubStoryOfTheYear', {
                      title: viewModel.recap.memorableEventTitle,
                    })
                  : t('seasonEnd.noSingleClubStory')}
              </Text>
            </PaperPanel>
            {viewModel.recap.awards.length > 0 ? (
              <View className="mt-5">
                <StageSection
                  eyebrow={t('seasonEnd.clubHonours')}
                  title={t('seasonEnd.seasonAwards')}
                />
                <View className="gap-3">
                  {viewModel.recap.awards.map((award) => (
                    <View
                      key={`${award.label}-${award.playerId}`}
                      className="flex-row items-center gap-3 border-2 border-gold-dark bg-gold-light p-3"
                    >
                      <View className="overflow-hidden border-2 border-ink bg-blue-light">
                        <PixelPortrait
                          playerId={award.playerId}
                          role={award.role}
                          lookId={award.lookId}
                          expression="joy"
                        />
                      </View>
                      <View className="min-w-0 flex-1">
                        <Text className="font-pixel text-sm uppercase tracking-wide text-gold-dark">
                          {award.label}
                        </Text>
                        <PixelText className="mt-1 text-lg uppercase text-ink">
                          {award.playerName}
                        </PixelText>
                        <Text className="mt-1 text-sm leading-5 text-ink/60">
                          {award.detail}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        {viewModel.promotionRewards ? (
          <View className="mt-6">
            <StageSection
              eyebrow={t('seasonEnd.promotionRewards')}
              title={t('seasonEnd.newDoorsAreOpen')}
            />
            <PaperPanel
              kicker={t('seasonEnd.permanentClubProgress')}
              title={viewModel.promotionRewards.divisionLabel}
              stamp={t('seasonEnd.unlockedCount', {
                count: viewModel.promotionRewards.items.length,
              })}
              className="bg-gold-light"
            >
              <Text className="text-sm leading-5 text-ink/60">
                {t('seasonEnd.theseRewardsStayUnlocked')}
              </Text>
              <View className="mt-3 gap-2">
                {viewModel.promotionRewards.items.map((reward, index) => (
                  <View
                    key={reward.title}
                    className="border-2 border-ink bg-white p-3"
                  >
                    <View className="flex-row items-start gap-3">
                      <View className="h-7 w-7 items-center justify-center border-2 border-ink bg-gold">
                        <Text className="font-mono text-sm text-ink">
                          {index + 1}
                        </Text>
                      </View>
                      <View className="flex-1">
                        <PixelText className="text-base uppercase text-ink">
                          {reward.title}
                        </PixelText>
                        <Text className="mt-1 text-sm leading-5 text-ink/60">
                          {reward.detail}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </PaperPanel>
          </View>
        ) : null}

        <View className="mt-6">
          <StageSection
            eyebrow={t('seasonEnd.finalWhistle')}
            title={t('seasonEnd.leagueTable')}
          />
          <View className="border-2 border-ink bg-white">
            <View className="flex-row border-b border-ink/15 px-3 py-2">
              <Text className="w-8 font-mono text-sm text-ink/50">
                {t('col.league.position')}
              </Text>
              <PixelText className="flex-1 text-sm uppercase text-ink/50">
                {t('col.league.club')}
              </PixelText>
              <Text className="w-8 text-right font-mono text-sm text-ink/50">
                {t('col.league.played')}
              </Text>
              <Text className="w-12 text-right font-mono text-sm text-ink/50">
                {t('col.league.goalDifference')}
              </Text>
              <Text className="w-12 text-right font-mono text-sm text-ink/50">
                {t('col.league.points')}
              </Text>
            </View>
            {viewModel.table.map((row) => {
              const rowClass = row.isUserClub
                ? 'bg-blue-light'
                : row.promoted
                  ? 'bg-pitch-light'
                  : '';
              const textClass = 'text-ink';
              return (
                <View
                  key={row.clubId}
                  className={`flex-row px-3 py-2 ${rowClass}`}
                >
                  <Text className={`w-8 font-mono text-base ${textClass}`}>
                    {row.position}
                  </Text>
                  <View className="flex-1 flex-row items-center pr-2">
                    <ClubCrest clubName={row.clubName} />
                    <Text
                      className={`ml-2 flex-1 text-base ${row.isUserClub ? 'font-bold' : ''} ${textClass}`}
                      numberOfLines={1}
                    >
                      {row.clubName}
                    </Text>
                    {row.promoted ? (
                      <Text
                        className={
                          row.isUserClub
                            ? 'text-sm font-bold text-ink'
                            : 'text-sm font-bold text-pitch-ink'
                        }
                      >
                        ↑
                      </Text>
                    ) : null}
                  </View>
                  <Text
                    className={`w-8 text-right font-mono text-base ${textClass}`}
                  >
                    {row.played}
                  </Text>
                  <Text
                    className={`w-12 text-right font-mono text-base ${textClass}`}
                  >
                    {row.goalDifference > 0 ? '+' : ''}
                    {row.goalDifference}
                  </Text>
                  <Text
                    className={`w-12 text-right font-mono text-base ${textClass}`}
                  >
                    {row.points}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {contract ? (
          <View className="mt-6" onLayout={handleExpiredContractLayout}>
            <StageSection
              eyebrow={t('seasonEnd.beforeTheDoorsClose')}
              title={t('seasonEnd.expiredContracts', {
                n: contract.remainingExpiredCount,
                count: contract.remainingExpiredCount,
              })}
              right={
                <StatusChip
                  label={t('seasonEnd.decisionNeeded')}
                  tone="danger"
                />
              }
            />
            <PaperPanel
              kicker={
                contract.powerName
                  ? t('seasonEnd.heroAgentMeeting')
                  : t('seasonEnd.renewalMeeting')
              }
              title={contract.playerName}
              stamp={contract.powerName ?? contract.role}
              className={contract.isHeroWageCliff ? 'bg-gold-light' : undefined}
            >
              <View className="flex-row items-center gap-3 border-y-2 border-ink py-4">
                <View className="overflow-hidden border-2 border-ink bg-blue-light">
                  <PixelPortrait
                    playerId={contract.playerId}
                    role={contract.role}
                    lookId={contract.lookId}
                    expression={contract.isHeroWageCliff ? 'joy' : 'rest'}
                  />
                </View>
                <View className="flex-1">
                  <PixelText className="text-sm uppercase tracking-wide text-ink/50">
                    {t('seasonEnd.weeklyWageRequest')}
                  </PixelText>
                  <View className="mt-2 flex-row items-center gap-2">
                    {contract.isHeroWageCliff ? (
                      <Text className="font-mono text-base text-ink/40 line-through">
                        {formatCurrency(t, contract.currentWeeklyWage)}
                      </Text>
                    ) : null}
                    <Text className="font-mono text-xl text-stamp">
                      {formatCurrency(t, contract.quotedWeeklyWage)}
                    </Text>
                    {contract.isHeroWageCliff ? (
                      <StatusChip label={t('seasonEnd.heroRate')} tone="hero" />
                    ) : null}
                  </View>
                </View>
              </View>

              {contract.isHeroWageCliff ? (
                <View className="mt-3 border-2 border-gold-dark bg-gold/40 p-3">
                  <PixelText className="text-sm uppercase tracking-wide text-gold-dark">
                    {t('seasonEnd.theBargainYearsAreOver')}
                  </PixelText>
                  <Text className="mt-1 text-sm leading-5 text-ink/60">
                    {t('seasonEnd.theAwakeningNeverChanged')}
                  </Text>
                </View>
              ) : null}

              {viewModel.renewalNegotiation === undefined ? (
                <>
                  {contract.renewalBlockedReason === undefined ? (
                    <>
                      <Text className="mt-3 text-sm leading-5 text-ink/60">
                        {t('market.promotionWageClause', {
                          percent: PROMOTION_WAGE_CLAUSE_PERCENT,
                        })}
                      </Text>
                      <PixelText className="mt-4 text-sm uppercase tracking-wide text-ink/50">
                        {t('seasonEnd.contractLength')}
                      </PixelText>
                      <View className="mt-2 flex-row gap-2">
                        {contract.termOptions.map((term) => {
                          const selected = contract.selectedTerm === term;
                          return (
                            <Pressable
                              key={term}
                              accessibilityRole="radio"
                              accessibilityLabel={t(
                                'seasonEnd.a11y.seasonContract',
                                { count: term },
                              )}
                              accessibilityState={{ selected }}
                              onPress={() =>
                                onSelectContractTerm(contract.playerId, term)
                              }
                              className={
                                selected
                                  ? 'min-h-11 flex-1 items-center justify-center border-2 border-blue-dark bg-blue-light'
                                  : 'min-h-11 flex-1 items-center justify-center border-2 border-ink/30 bg-paper-dark'
                              }
                            >
                              <Text className="font-mono text-base text-ink">
                                {term}
                              </Text>
                              <PixelText className="mt-1 text-sm uppercase text-ink/50">
                                {t('seasonEnd.seasonUnit', { n: term })}
                              </PixelText>
                            </Pressable>
                          );
                        })}
                      </View>
                      {contract.shortTermReason === undefined ? null : (
                        <Text className="mt-2 text-sm leading-5 text-ink/60">
                          {contract.shortTermReason}
                        </Text>
                      )}
                      <View className="mt-3">
                        <ActionButton
                          label={t('seasonEnd.signNow', {
                            wage: formatCurrency(t, contract.quotedWeeklyWage),
                          })}
                          accessibilityLabel={t('seasonEnd.a11y.signPlayer', {
                            player: contract.playerName,
                            seasons: contract.selectedTerm,
                            wage: formatCurrency(t, contract.quotedWeeklyWage),
                          })}
                          onPress={() =>
                            guardTap(() =>
                              onRenewContract(
                                contract.playerId,
                                contract.selectedTerm,
                              ),
                            )
                          }
                        />
                      </View>
                      <View className="mt-2">
                        <ActionButton
                          // '▸' is not in Silkscreen, so it stays outside the
                          // catalog and keeps rendering in the fallback face.
                          label={`${t('seasonEnd.meetTheAgent')}  ▸`}
                          accessibilityLabel={t(
                            'seasonEnd.a11y.negotiateWithAgent',
                            { player: contract.playerName },
                          )}
                          // Both routes out of an expiring contract are real
                          // choices, so both wear the primary blue. The paper
                          // face read as the lesser option and steered the
                          // manager into signing without hearing the demand.
                          onPress={() =>
                            guardTap(() =>
                              setAgentGreetingPlayerId(contract.playerId),
                            )
                          }
                        />
                      </View>
                      <Text className="mt-2 text-center text-sm text-ink/50">
                        {t('seasonEnd.signingNowPaysThe')}
                      </Text>
                    </>
                  ) : (
                    <View className="mt-4 border-2 border-stamp bg-red-light px-3 py-3">
                      <PixelText className="text-sm uppercase tracking-wide text-stamp">
                        {t('seasonEnd.talksAreOver')}
                      </PixelText>
                      <Text className="mt-1 text-sm leading-5 text-ink/70">
                        {contract.renewalBlockedReason}
                      </Text>
                    </View>
                  )}
                  <View className="mt-2">
                    <ActionButton
                      label={t('seasonEnd.letPlayerLeave')}
                      accessibilityLabel={t('seasonEnd.a11y.letPlayerLeave', {
                        player: contract.playerName,
                      })}
                      onPress={() => onReleaseContract(contract.playerId)}
                      variant="danger"
                    />
                  </View>
                </>
              ) : null}
            </PaperPanel>
            {viewModel.renewalNegotiation ? (
              <NegotiationPanel
                viewModel={viewModel.renewalNegotiation}
                draft={renewalDraft}
                onSubmitContractOffer={onSubmitRenewalOffer}
                onClose={onCloseRenewal}
              />
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      {/* Same rule as the full-time report: the bar spans the window, the
          button inside it keeps the two-column measure of the review above. */}
      <View className="border-t-[6px] border-white bg-ink/25 p-3">
        <DesktopClamp>
          <ActionButton
            // '▸' is not in Silkscreen, so it stays outside the catalog and
            // keeps rendering in the fallback face.
            label={`${viewModel.sliceComplete ? t('seasonEnd.finishCareerReview') : t('seasonEnd.beginNextSeason')}  ▸`}
            accessibilityLabel={
              viewModel.sliceComplete
                ? t('seasonEnd.a11y.finishTheCareerReview')
                : t('seasonEnd.a11y.beginTheNextSeason')
            }
            onPress={onPrimaryAction}
            disabled={!viewModel.canContinue}
          />
          {!viewModel.canContinue ? (
            <PixelText className="mt-2 text-center text-sm uppercase tracking-wide text-red-light">
              {t('seasonEnd.resolveTheExpiredContractFirst')}
            </PixelText>
          ) : null}
        </DesktopClamp>
      </View>
      {/* Root-level, not inside the panel: the overlay fills its parent, and
          the renewal card lives halfway down a scroll view. */}
      <AgentFinalDemandGate negotiation={viewModel.renewalNegotiation} />
      {/* The agent's own entrance, before the table of numbers he brought. He
          says his one line and is gone; the negotiation opens behind him. */}
      {agentGreetingPlayerId === null ? null : (
        <AgentFinalDemandWalkOn
          line={t('seasonEnd.showMeTheMoolah')}
          autoAdvanceMs={AGENT_GREETING_HOLD_MS}
          onDone={() => {
            const playerId = agentGreetingPlayerId;
            setAgentGreetingPlayerId(null);
            onStartRenewal(playerId);
          }}
        />
      )}
    </SafeAreaView>
  );
}
