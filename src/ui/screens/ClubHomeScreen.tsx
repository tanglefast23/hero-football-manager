import { ScrollView, Text, View } from 'react-native';
import { ActionButton, Metric, PaperPanel, StatusChip, formatCurrency } from '../components/Scorecard';
import { StageSection } from '../components/ChalkboardStage';
import { PixelPortrait } from '../components/PixelPortrait';
import type { ClubAlertViewModel, HomeViewModel } from '../models';
import { scaledBody } from '../text-scale';
import type { TextScale } from '../../persistence';
import { TutorialTapCue } from '../TutorialTapCue';
import { TUTORIAL_TAP_CUE_WIDTH } from '../tutorial-cue-position';
import { SfxPressable as Pressable } from '../components/SfxPressable';
import { SectionFlow, type FlowSection } from '../layout/SectionFlow';
import { useLayoutMode } from '../layout/use-layout-mode';

/** Full-card tint per alert tone — bible palette only, never off-palette Tailwind hues. */
function alertPalette(tone: ClubAlertViewModel['tone']): string {
  if (tone === 'urgent') return 'border-red-dark bg-red-light';
  if (tone === 'event') return 'border-blue-dark bg-blue-light';
  return 'border-blue-dark bg-blue-light';
}

export interface ClubHomeScreenProps {
  viewModel: HomeViewModel;
  onOpenFixture: (fixtureId: string) => void;
  onOpenAlert: (alertId: string) => void;
  onOpenLeague: () => void;
  onProtectBoardCandidate: (playerId: string) => void;
  guideAlertId?: string;
  lockOtherAlerts?: boolean;
  guideBoard?: boolean;
  textScale?: TextScale;
}

export function ClubHomeScreen({
  viewModel,
  onOpenFixture,
  onOpenAlert,
  onOpenLeague,
  onProtectBoardCandidate,
  guideAlertId,
  lockOtherAlerts = false,
  guideBoard = false,
  textScale = 1,
}: ClubHomeScreenProps) {
  const fixture = viewModel.nextFixture;
  const fixtureIsThisWeek = viewModel.nextMatchTimingLabel === 'This week';
  const layoutMode = useLayoutMode();

  const sections: FlowSection[] = [
    {
      key: 'next-match',
      weight: 7,
      node: (
        <PaperPanel kicker="Next match" title={fixture.competition} stamp={viewModel.nextMatchTimingLabel}>
          <View className="border-y-2 border-ink py-4">
            <View className="flex-row items-center justify-between gap-2">
              <Text
                className="flex-1 text-right text-xl font-bold uppercase text-ink"
                numberOfLines={2}
                adjustsFontSizeToFit
                minimumFontScale={0.65}
              >
                {fixture.homeTeam}
              </Text>
              <View className="border-2 border-ink bg-ink px-3 py-2">
                <Text className="font-mono text-base font-bold text-paper">VS</Text>
              </View>
              <Text
                className="flex-1 text-xl font-bold uppercase text-ink"
                numberOfLines={2}
                adjustsFontSizeToFit
                minimumFontScale={0.65}
              >
                {fixture.awayTeam}
              </Text>
            </View>
            <View className="mt-3 flex-row justify-center gap-2">
              <StatusChip label={fixture.venueLabel} />
              <StatusChip
                label={`${fixture.opponentHeroCount} rival hero${fixture.opponentHeroCount === 1 ? '' : 'es'}`}
                tone="hero"
              />
            </View>
          </View>
          <View className="mt-4">
            <ActionButton
              label={fixture.matchdayReady
                ? 'Prepare match day  ▸'
                : fixtureIsThisWeek ? 'Use Advance Week below' : 'Advance to fixture week'}
              accessibilityLabel={fixture.matchdayReady
                ? `Open match day for ${fixture.homeTeam} versus ${fixture.awayTeam}`
                : fixtureIsThisWeek
                  ? `This week's fixture is ${fixture.homeTeam} versus ${fixture.awayTeam}. Use Advance Week below to prepare Match Day.`
                  : `Next fixture is ${fixture.homeTeam} versus ${fixture.awayTeam}. Advance to its match week to prepare.`}
              onPress={() => onOpenFixture(fixture.id)}
              disabled={!fixture.matchdayReady}
              variant="action"
            />
          </View>
        </PaperPanel>
      ),
    },
    {
      key: 'inbox',
      weight: 2 + 2 * Math.max(viewModel.alerts.length, 1),
      node: (
        <View>
          <StageSection
            eyebrow="Inbox"
            title="Needs your call"
            right={<StatusChip label={`${viewModel.alerts.length} open`} tone={viewModel.alerts.length ? 'danger' : 'normal'} />}
          />
          <View className="gap-2">
            {viewModel.alerts.length === 0 ? (
              <View className="border-2 border-b-4 border-ink bg-white p-4">
                <Text className="text-ink/60" style={scaledBody(textScale)}>Desk clear. The board is suspiciously quiet.</Text>
              </View>
            ) : viewModel.alerts.map(alert => {
              const guided = alert.id === guideAlertId;
              const locked = lockOtherAlerts && guideAlertId !== undefined && !guided;
              return (
                <Pressable
                  key={alert.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${alert.title}. ${alert.detail}`}
                  accessibilityState={{ disabled: locked }}
                  disabled={locked}
                  onPress={() => onOpenAlert(alert.id)}
                  className={`relative min-h-14 flex-row items-center justify-between border-2 border-b-4 p-3 ${alertPalette(alert.tone)}`}
                  style={({ pressed }) => ({ opacity: locked ? 0.45 : pressed ? 0.75 : undefined })}
                >
                  {guided ? (
                    <TutorialTapCue
                      detail="Build the facility"
                      style={{ left: '50%', marginLeft: -TUTORIAL_TAP_CUE_WIDTH / 2, top: -72 }}
                    />
                  ) : null}
                  <View className="flex-1 pr-3">
                    <Text className="text-base font-bold uppercase text-ink">{alert.title}</Text>
                    <Text className="mt-1 text-ink/70" style={scaledBody(textScale, 14, 18)} numberOfLines={2}>{alert.detail}</Text>
                  </View>
                  <Text className="font-mono text-xl font-bold text-ink">›</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ),
    },
    ...(viewModel.boardResolution ? [{
      key: 'board-resolution',
      weight: viewModel.boardResolution.soldPlayer && viewModel.boardResolution.replacementPlayer ? 13 : 6,
      node: (
        <View>
          <StageSection
            eyebrow="Boardroom aftermath"
            title={viewModel.boardResolution.headline}
            right={<StatusChip label={viewModel.boardResolution.kind === 'TARGET_MET' ? 'Resolved' : 'Squad rebuilt'} tone="success" />}
          />
          <PaperPanel
            kicker={viewModel.boardResolution.kind === 'TARGET_MET' ? 'Intervention closed' : 'Academy relief promotion'}
            title={viewModel.boardResolution.kind === 'TARGET_MET' ? 'No sale required' : viewModel.boardResolution.replacementPlayer?.name}
            stamp={viewModel.boardResolution.kind === 'TARGET_MET' ? 'Safe' : 'New youth'}
            className="bg-pitch-light"
          >
            <Text className="text-ink/70" style={scaledBody(textScale, 14, 20)}>{viewModel.boardResolution.detail}</Text>
            {viewModel.boardResolution.soldPlayer && viewModel.boardResolution.replacementPlayer ? (
              <>
                <View className="mt-4 flex-row items-center gap-3">
                  <View className="flex-1 items-center border-2 border-red-dark bg-red-light p-2">
                    <View className="overflow-hidden border-2 border-ink bg-white opacity-70">
                      <PixelPortrait playerId={viewModel.boardResolution.soldPlayer.id} role={viewModel.boardResolution.soldPlayer.role} lookId={viewModel.boardResolution.soldPlayer.lookId} expression="rest" />
                    </View>
                    <Text className="mt-2 text-center text-sm font-bold text-ink" numberOfLines={1}>{viewModel.boardResolution.soldPlayer.name}</Text>
                    <Text className="mt-1 text-center font-mono text-sm text-stamp">Sold · {formatCurrency(viewModel.boardResolution.soldPlayer.fee)}</Text>
                  </View>
                  <Text className="font-mono text-2xl font-bold text-ink">→</Text>
                  <View className="flex-1 items-center border-2 border-pitch-dark bg-white p-2">
                    <View className="overflow-hidden border-2 border-ink bg-blue-light">
                      <PixelPortrait playerId={viewModel.boardResolution.replacementPlayer.id} role={viewModel.boardResolution.replacementPlayer.role} lookId={viewModel.boardResolution.replacementPlayer.lookId} expression="joy" />
                    </View>
                    <Text className="mt-2 text-center text-sm font-bold text-ink" numberOfLines={1}>{viewModel.boardResolution.replacementPlayer.name}</Text>
                    <Text className="mt-1 text-center font-mono text-sm text-pitch-dark">Age {viewModel.boardResolution.replacementPlayer.age} · {formatCurrency(viewModel.boardResolution.replacementPlayer.weeklyWage)}/wk</Text>
                  </View>
                </View>
                <View className="mt-3 flex-row gap-2">
                  <Metric label="Fans" value={`−${viewModel.boardResolution.fansLost ?? 0}`} tone="negative" />
                  <Metric label="Squad morale" value={`${viewModel.boardResolution.moraleDelta ?? 0}`} tone="negative" />
                </View>
              </>
            ) : null}
          </PaperPanel>
        </View>
      ),
    }] : []),
    ...(viewModel.boardUltimatum ? [{
      key: 'board-ultimatum',
      weight: 8 + 2 * viewModel.boardUltimatum.candidates.length,
      node: (
        <View className={guideBoard ? 'relative border-2 border-blue-dark bg-blue-light p-1' : 'relative'}>
          {guideBoard ? (
            <TutorialTapCue
              label="Bert says"
              detail="Protect one player"
              style={{ left: '50%', marginLeft: -TUTORIAL_TAP_CUE_WIDTH / 2, top: -72 }}
            />
          ) : null}
          <StageSection
            eyebrow="Board intervention"
            title="Protect one player"
            right={<StatusChip label={`${viewModel.boardUltimatum.weeksRemaining} ${viewModel.boardUltimatum.weeksRemaining === 1 ? 'week' : 'weeks'}`} tone="danger" />}
          />
          <PaperPanel kicker="Board deadline" title="Reach the target. Avoid a forced sale." stamp="Career continues" className="bg-red-light">
            <Text className="text-ink/70" style={scaledBody(textScale, 14, 20)}>
              Reach {formatCurrency(viewModel.boardUltimatum.targetCash)} cash before the deadline. If you miss it, the board sells one candidate shown below at a {viewModel.boardUltimatum.candidates[0]?.discountPercent ?? 30}% discount. Your protected player is untouchable, and your career continues either way.
            </Text>
            <View className="mt-3 flex-row gap-2">
              <Metric label="Cash needed" value={formatCurrency(viewModel.boardUltimatum.cashNeeded)} tone="negative" />
              <Metric label="Deadline" value={`${viewModel.boardUltimatum.weeksRemaining} wk`} />
            </View>
            <View className="mt-4 gap-2">
              {viewModel.boardUltimatum.candidates.map(candidate => {
                const protectedPlayer = candidate.playerId === viewModel.boardUltimatum?.protectedPlayerId;
                return (
                  <Pressable
                    key={candidate.playerId}
                    accessibilityRole="radio"
                    accessibilityLabel={`${candidate.playerName}, ${candidate.role}, wage ${formatCurrency(candidate.weeklyWage)}, forced sale fee ${formatCurrency(candidate.forcedSaleFee)}. ${protectedPlayer ? 'Protected' : 'Protect this player'}.`}
                    accessibilityState={{ selected: protectedPlayer }}
                    onPress={() => onProtectBoardCandidate(candidate.playerId)}
                    className={protectedPlayer
                      ? 'min-h-14 flex-row items-center gap-3 border-2 border-b-4 border-blue-dark bg-blue-light p-2'
                      : 'min-h-14 flex-row items-center gap-3 border-2 border-ink bg-white p-2'}
                    style={({ pressed }) => ({ opacity: pressed ? 0.72 : undefined })}
                  >
                    <View className="overflow-hidden border-2 border-ink bg-blue-light">
                      <PixelPortrait playerId={candidate.playerId} role={candidate.role} lookId={candidate.lookId} />
                    </View>
                    <View className="flex-1">
                      <View className="flex-row items-center gap-2">
                        <Text className="flex-1 text-base font-bold text-ink" numberOfLines={1}>{candidate.playerName}</Text>
                        {candidate.isHero ? <StatusChip label="Hero" tone="hero" /> : null}
                      </View>
                      <Text className="mt-1 font-mono text-sm text-ink/65">
                        {candidate.role} · {formatCurrency(candidate.weeklyWage)}/wk · forced-sale fee {formatCurrency(candidate.forcedSaleFee)}
                      </Text>
                    </View>
                    <Text className={protectedPlayer
                      ? 'font-mono text-sm font-bold uppercase text-blue-dark'
                      : 'font-mono text-sm font-bold uppercase text-ink/45'}>
                      {protectedPlayer ? 'Protected' : 'Protect'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </PaperPanel>
        </View>
      ),
    }] : []),
    {
      key: 'table',
      weight: 2 + viewModel.table.length,
      node: (
        <View>
          <StageSection
            eyebrow={viewModel.divisionLabel}
            title="Table snapshot"
            right={<Text className="font-mono text-sm font-bold uppercase text-blue-light">Table ›</Text>}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open full league table"
            onPress={onOpenLeague}
            className="border-2 border-b-4 border-ink bg-white"
            style={({ pressed }) => ({ opacity: pressed ? 0.75 : undefined })}
          >
            <View className="flex-row border-b-2 border-ink/20 px-3 py-2">
              <Text className="w-8 font-mono text-sm font-bold text-ink/50">#</Text>
              <Text className="flex-1 text-sm font-bold uppercase text-ink/50">Club</Text>
              <Text className="w-8 text-right font-mono text-sm font-bold text-ink/50">P</Text>
              <Text className="w-10 text-right font-mono text-sm font-bold text-ink/50">GD</Text>
              <Text className="w-10 text-right font-mono text-sm font-bold text-ink/50">PTS</Text>
            </View>
            {viewModel.table.map(row => {
              const isUser = row.clubName === viewModel.clubName;
              return (
                <View
                  key={row.clubName}
                  className={isUser ? 'flex-row bg-blue-light px-3 py-2' : 'flex-row px-3 py-2'}
                >
                  <Text className={isUser ? 'w-8 font-mono text-base font-bold text-ink' : 'w-8 font-mono text-base text-ink'}>{row.position}</Text>
                  <Text className={isUser ? 'flex-1 text-base font-bold text-ink' : 'flex-1 text-base text-ink'} numberOfLines={1}>{row.clubName}</Text>
                  <Text className={isUser ? 'w-8 text-right font-mono text-base font-bold text-ink' : 'w-8 text-right font-mono text-base text-ink'}>{row.played}</Text>
                  <Text className={isUser ? 'w-10 text-right font-mono text-base font-bold text-ink' : 'w-10 text-right font-mono text-base text-ink'}>{row.goalDifference > 0 ? '+' : ''}{row.goalDifference}</Text>
                  <Text className={isUser ? 'w-10 text-right font-mono text-base font-bold text-ink' : 'w-10 text-right font-mono text-base text-ink'}>{row.points}</Text>
                </View>
              );
            })}
          </Pressable>
        </View>
      ),
    },
  ];

  return (
    <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
      <SectionFlow
        mode={layoutMode}
        header={
          <>
            <View className="flex-row items-end justify-between">
              <View>
                <Text className="font-pixel text-xs uppercase tracking-[2px] text-gold-light">Good morning, boss</Text>
                <Text className="mt-1 font-pixel text-xl uppercase tracking-wide text-white">{viewModel.managerName}</Text>
              </View>
              <View className="items-end">
                <Text className="text-sm uppercase tracking-wide text-paper/60">Recent form</Text>
                <View className="mt-2 flex-row gap-1">
                  {viewModel.form.map((result, index) => (
                    <StatusChip
                      key={`${result}-${index}`}
                      label={result}
                      tone={result === 'W' ? 'success' : result === 'L' ? 'danger' : 'normal'}
                    />
                  ))}
                </View>
              </View>
            </View>
            <View className="my-5 h-0.5 bg-paper/10" />
          </>
        }
        sections={sections}
      />
    </ScrollView>
  );
}
