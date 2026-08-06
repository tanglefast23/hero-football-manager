import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ContractOffer, PitchCard } from '../../game/market';
import { ActionButton, Metric, PaperPanel, StatusChip, formatCurrency } from '../components/Scorecard';
import { ChalkboardBackdrop, StageSection } from '../components/ChalkboardStage';
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
  guideCopy,
  textScale = 1,
}: SeasonEndScreenProps) {
  const desktopContent = useDesktopContentStyle();
  const renewalDraft = useContractDraft(viewModel.renewalNegotiation);
  const wide = useLayoutMode() === 'twoColumn';
  // Renewals arrive as a queue: committing one re-renders this same button
  // holding the next player, so an ordinary double-tap would sign a wage the
  // manager never saw.
  const guardTap = useTapGuard();
  const contract = viewModel.expiredContract;
  // The season-end fanfare is owned by App.tsx, keyed per career/season so it
  // fires exactly once. Do not add a second cue here.
  const outcomeTone = viewModel.outcomeLabel === 'CHAMPIONS' || viewModel.outcomeLabel === 'PROMOTED'
    ? 'success'
    : viewModel.outcomeLabel === 'RELEGATED'
      ? 'danger'
      : 'normal';

  return (
    <SafeAreaView className="flex-1 bg-pitch-ink" edges={['top', 'left', 'right', 'bottom']}>
      <ChalkboardBackdrop wide={wide} />
      <View className="flex-row items-center justify-between px-4 py-3">
        <View>
          <Text className="font-pixel text-xs uppercase tracking-[2px] text-gold-light">Front office</Text>
          <Text className="mt-1 font-pixel text-base uppercase text-white">Season review</Text>
        </View>
        <SettingsButton onPress={onOpenSettings} />
      </View>
      <ScrollView className="flex-1" contentContainerStyle={[{ padding: 16, paddingBottom: 28 }, desktopContent]}>
        <View className="items-center py-3">
          <Text className="font-pixel text-xs uppercase tracking-[2px] text-gold-light">Season complete</Text>
          <Text className="mt-2 font-pixel text-3xl uppercase tracking-wide text-white">{viewModel.seasonLabel}</Text>
          <View className="mt-4 rotate-2 border-2 border-red bg-red-light/25 px-5 py-3">
            <PixelText className="text-xl uppercase text-red-light">{viewModel.outcomeLabel}</PixelText>
          </View>
          <Text className="mt-5 text-center font-pixel text-xl uppercase text-white">{viewModel.headline}</Text>
          <Text className="mt-2 max-w-sm text-center text-paper/75" style={scaledBody(textScale)}>{viewModel.summary}</Text>
          <View className="mt-4 flex-row gap-2">
            <StatusChip label={`Finished #${viewModel.finalPosition}`} tone={outcomeTone} />
            <StatusChip label={`Prize ${formatCurrency(viewModel.prizeMoney)}`} />
            <StatusChip label={viewModel.difficultyLabel} tone="hero" />
          </View>
        </View>

        {viewModel.clubBusinessSettlement ? (
          <View className="mt-6">
            <StageSection eyebrow="Club Business" title="Season-end payday" />
            <PaperPanel
              kicker="Cash actually received"
              title="Sponsors and Buzz"
              stamp={`+${formatCurrency(viewModel.clubBusinessSettlement.actualPayoutTotal)}`}
            >
              {viewModel.clubBusinessSettlement.buzz ? (
                <View
                  className="border-2 border-ink bg-blue-light p-3"
                  accessible
                  accessibilityLabel={`Buzz payout. Reached ${viewModel.clubBusinessSettlement.buzz.reached}. Club received ${formatCurrency(viewModel.clubBusinessSettlement.buzz.actualPayout)}. Reset to ${viewModel.clubBusinessSettlement.buzz.resetTo}.`}
                >
                  <View className="flex-row flex-wrap items-center justify-between gap-2">
                    <PixelText className="text-base uppercase text-ink">Buzz payout</PixelText>
                    <StatusChip label="PAID" tone="success" />
                  </View>
                  <Text className="mt-2 text-sm leading-5 text-ink">
                    Reached {viewModel.clubBusinessSettlement.buzz.reached} · Club received {formatCurrency(viewModel.clubBusinessSettlement.buzz.actualPayout)} · Reset to {viewModel.clubBusinessSettlement.buzz.resetTo}
                  </Text>
                </View>
              ) : null}

              {viewModel.clubBusinessSettlement.objectiveResults.length > 0 ? (
                <View className={viewModel.clubBusinessSettlement.buzz ? 'mt-3 gap-2' : 'gap-2'}>
                  {viewModel.clubBusinessSettlement.objectiveResults.map(result => (
                    <View
                      key={result.contractId}
                      className="border-2 border-ink bg-white p-3"
                      accessible
                      accessibilityLabel={`${result.sponsorName}. ${result.met ? 'Target met' : 'Target missed'}. Objective: ${result.objectiveLabel}. Club received ${formatCurrency(result.actualBonus)}.`}
                    >
                      <View className="flex-row flex-wrap items-start justify-between gap-2">
                        <PixelText className="min-w-0 flex-1 text-base uppercase text-ink">
                          {result.sponsorName}
                        </PixelText>
                        <StatusChip
                          label={result.met ? 'TARGET MET' : 'TARGET MISSED'}
                          tone={result.met ? 'success' : 'danger'}
                        />
                      </View>
                      <Text className="mt-2 text-sm leading-5 text-ink/70">{result.objectiveLabel}</Text>
                      <Text className={result.met
                        ? 'mt-2 font-mono text-base text-pitch-ink'
                        : 'mt-2 font-mono text-base text-red-dark'}
                      >
                        Club received {formatCurrency(result.actualBonus)}
                      </Text>
                    </View>
                  ))}
                  <View className="flex-row flex-wrap items-center justify-between gap-2 border-t-2 border-ink pt-3">
                    <PixelText className="text-sm uppercase text-ink/70">Objective bonuses</PixelText>
                    <Text className="font-mono text-lg text-ink">
                      {formatCurrency(viewModel.clubBusinessSettlement.objectiveBonusTotal)}
                    </Text>
                  </View>
                </View>
              ) : null}
            </PaperPanel>
          </View>
        ) : null}

        {viewModel.recap ? (
          <View className="mt-6">
            <StageSection eyebrow="Season in numbers" title="The year in the cabinet" />
            {guideCopy ? (
              <PaperPanel kicker="Bert Rudge" title={guideCopy.title} stamp="Filed">
                <Text className="text-ink/70" style={scaledBody(textScale)}>{guideCopy.body}</Text>
              </PaperPanel>
            ) : null}
            <View className={wide ? 'mt-3 flex-row gap-2' : 'mt-3 gap-2'}>
              <Metric label="Record" value={viewModel.recap.record} />
              <Metric label="Goals" value={viewModel.recap.goals} />
            </View>
            <View className="mt-2 flex-row gap-2">
              <Metric label="Cash change" value={`${viewModel.recap.cashChange >= 0 ? '+' : ''}${formatCurrency(viewModel.recap.cashChange)}`} />
              <Metric label="Closing cash" value={formatCurrency(viewModel.recap.closingCash)} />
            </View>
            <PaperPanel kicker="Cup and development" title={viewModel.recap.cupResult} stamp={`${viewModel.recap.trainingCapsReached} caps reached`} className="mt-3">
              <Text className="text-sm leading-5 text-ink/60">
                {viewModel.recap.memorableEventTitle
                  ? `Club story of the year: ${viewModel.recap.memorableEventTitle}.`
                  : 'No single club story took over the season.'}
              </Text>
            </PaperPanel>
            {viewModel.recap.awards.length > 0 ? (
              <View className="mt-5">
                <StageSection eyebrow="Club honours" title="Season awards" />
                <View className="gap-3">
                  {viewModel.recap.awards.map(award => (
                    <View key={`${award.label}-${award.playerId}`} className="flex-row items-center gap-3 border-2 border-gold-dark bg-gold-light p-3">
                      <View className="overflow-hidden border-2 border-ink bg-blue-light">
                        <PixelPortrait playerId={award.playerId} role={award.role} lookId={award.lookId} expression="joy" />
                      </View>
                      <View className="min-w-0 flex-1">
                        <Text className="font-pixel text-sm uppercase tracking-wide text-gold-dark">{award.label}</Text>
                        <PixelText className="mt-1 text-lg uppercase text-ink">{award.playerName}</PixelText>
                        <Text className="mt-1 text-sm leading-5 text-ink/60">{award.detail}</Text>
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
            <StageSection eyebrow="Promotion rewards" title="New doors are open" />
            <PaperPanel
              kicker="Permanent club progress"
              title={viewModel.promotionRewards.divisionLabel}
              stamp={`${viewModel.promotionRewards.items.length} unlocked`}
              className="bg-gold-light"
            >
              <Text className="text-sm leading-5 text-ink/60">
                These rewards stay unlocked even if the club is relegated later.
              </Text>
              <View className="mt-3 gap-2">
                {viewModel.promotionRewards.items.map((reward, index) => (
                  <View key={reward.title} className="border-2 border-ink bg-white p-3">
                    <View className="flex-row items-start gap-3">
                      <View className="h-7 w-7 items-center justify-center border-2 border-ink bg-gold">
                        <Text className="font-mono text-sm text-ink">{index + 1}</Text>
                      </View>
                      <View className="flex-1">
                        <PixelText className="text-base uppercase text-ink">{reward.title}</PixelText>
                        <Text className="mt-1 text-sm leading-5 text-ink/60">{reward.detail}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </PaperPanel>
          </View>
        ) : null}

        <View className="mt-6">
          <StageSection eyebrow="Final whistle" title="League table" />
          <View className="border-2 border-ink bg-white">
            <View className="flex-row border-b border-ink/15 px-3 py-2">
              <Text className="w-8 font-mono text-sm text-ink/50">#</Text>
              <PixelText className="flex-1 text-sm uppercase text-ink/50">Club</PixelText>
              <Text className="w-8 text-right font-mono text-sm text-ink/50">P</Text>
              <Text className="w-12 text-right font-mono text-sm text-ink/50">GD</Text>
              <Text className="w-12 text-right font-mono text-sm text-ink/50">PTS</Text>
            </View>
            {viewModel.table.map(row => {
              const rowClass = row.isUserClub
                ? 'bg-blue-light'
                : row.promoted
                  ? 'bg-pitch-light'
                  : '';
              const textClass = 'text-ink';
              return (
                <View key={row.clubId} className={`flex-row px-3 py-2 ${rowClass}`}>
                  <Text className={`w-8 font-mono text-base ${textClass}`}>{row.position}</Text>
                  <View className="flex-1 flex-row items-center pr-2">
                    <Text className={`flex-1 text-base ${row.isUserClub ? 'font-bold' : ''} ${textClass}`} numberOfLines={1}>{row.clubName}</Text>
                    {row.promoted ? <Text className={row.isUserClub ? 'text-sm font-bold text-ink' : 'text-sm font-bold text-pitch-ink'}>↑</Text> : null}
                  </View>
                  <Text className={`w-8 text-right font-mono text-base ${textClass}`}>{row.played}</Text>
                  <Text className={`w-12 text-right font-mono text-base ${textClass}`}>{row.goalDifference > 0 ? '+' : ''}{row.goalDifference}</Text>
                  <Text className={`w-12 text-right font-mono text-base ${textClass}`}>{row.points}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {contract ? (
          <View className="mt-6">
            <StageSection
              eyebrow="Before the doors close"
              title={contract.remainingExpiredCount === 1
                ? 'Expired contract'
                : `${contract.remainingExpiredCount} expired contracts`}
              right={<StatusChip label="Decision needed" tone="danger" />}
            />
            <PaperPanel
              kicker={contract.powerName ? 'Hero agent meeting' : 'Renewal meeting'}
              title={contract.playerName}
              stamp={contract.powerName ?? contract.role}
              className={contract.isHeroWageCliff ? 'bg-gold-light' : undefined}
            >
              <View className="flex-row items-center gap-3 border-y-2 border-ink py-4">
                <View className="overflow-hidden border-2 border-ink bg-blue-light">
                  <PixelPortrait playerId={contract.playerId} role={contract.role} lookId={contract.lookId} expression={contract.isHeroWageCliff ? 'joy' : 'rest'} />
                </View>
                <View className="flex-1">
                  <PixelText className="text-sm uppercase tracking-wide text-ink/50">Weekly wage request</PixelText>
                  <View className="mt-2 flex-row items-center gap-2">
                    {contract.isHeroWageCliff ? (
                      <Text className="font-mono text-base text-ink/40 line-through">
                        {formatCurrency(contract.currentWeeklyWage)}
                      </Text>
                    ) : null}
                    <Text className="font-mono text-xl text-stamp">
                      {formatCurrency(contract.quotedWeeklyWage)}
                    </Text>
                    {contract.isHeroWageCliff ? <StatusChip label="Hero rate" tone="hero" /> : null}
                  </View>
                </View>
              </View>

              {contract.isHeroWageCliff ? (
                <View className="mt-3 border-2 border-gold-dark bg-gold/40 p-3">
                  <PixelText className="text-sm uppercase tracking-wide text-gold-dark">The bargain years are over</PixelText>
                  <Text className="mt-1 text-sm leading-5 text-ink/60">
                    The awakening never changed this contract. Renewal does—and the agent knows exactly what a hero is worth.
                  </Text>
                </View>
              ) : null}

              {viewModel.renewalNegotiation === undefined ? (
                <>
                  {contract.renewalBlockedReason === undefined ? (
                    <>
                      <PixelText className="mt-4 text-sm uppercase tracking-wide text-ink/50">Contract length</PixelText>
                      <View className="mt-2 flex-row gap-2">
                        {contract.termOptions.map(term => {
                          const selected = contract.selectedTerm === term;
                          return (
                            <Pressable
                              key={term}
                              accessibilityRole="radio"
                              accessibilityLabel={`${term} season contract`}
                              accessibilityState={{ selected }}
                              onPress={() => onSelectContractTerm(contract.playerId, term)}
                              className={selected
                                ? 'min-h-11 flex-1 items-center justify-center border-2 border-blue-dark bg-blue-light'
                                : 'min-h-11 flex-1 items-center justify-center border-2 border-ink/30 bg-paper-dark'}
                            >
                              <Text className="font-mono text-base text-ink">{term}</Text>
                              <PixelText className="mt-1 text-sm uppercase text-ink/50">Season{term === 1 ? '' : 's'}</PixelText>
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
                          label={`Sign now · ${formatCurrency(contract.quotedWeeklyWage)}/wk`}
                          accessibilityLabel={`Sign ${contract.playerName} for ${contract.selectedTerm} seasons at ${formatCurrency(contract.quotedWeeklyWage)} per week, the asking price, with no promise`}
                          onPress={() => guardTap(() => onRenewContract(contract.playerId, contract.selectedTerm))}
                        />
                      </View>
                      <View className="mt-2">
                        <ActionButton
                          label="Meet the agent  ▸"
                          accessibilityLabel={`Negotiate with ${contract.playerName}'s agent to pay less than the asking price`}
                          onPress={() => onStartRenewal(contract.playerId)}
                          variant="paper"
                        />
                      </View>
                      <Text className="mt-2 text-center text-sm text-ink/50">
                        Signing now pays the full ask and promises nothing. Talks can beat that
                        price — three rounds, and a promise is your strongest chip.
                      </Text>
                    </>
                  ) : (
                    <View className="mt-4 border-2 border-stamp bg-red-light px-3 py-3">
                      <PixelText className="text-sm uppercase tracking-wide text-stamp">Talks are over</PixelText>
                      <Text className="mt-1 text-sm leading-5 text-ink/70">
                        {contract.renewalBlockedReason}
                      </Text>
                    </View>
                  )}
                  <View className="mt-2">
                    <ActionButton
                      label="Let player leave"
                      accessibilityLabel={`Let ${contract.playerName} leave on a free transfer`}
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
            label={viewModel.sliceComplete ? 'Finish career review  ▸' : 'Begin next season  ▸'}
            accessibilityLabel={viewModel.sliceComplete ? 'Finish the career review' : 'Begin the next season'}
            onPress={onPrimaryAction}
            disabled={!viewModel.canContinue}
          />
          {!viewModel.canContinue ? (
            <PixelText className="mt-2 text-center text-sm uppercase tracking-wide text-red-light">
              Resolve the expired contract first
            </PixelText>
          ) : null}
        </DesktopClamp>
      </View>
    </SafeAreaView>
  );
}
