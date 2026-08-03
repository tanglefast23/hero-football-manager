import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton, SectionLabel, StatusChip } from '../components/Scorecard';
import type { PostMatchViewModel } from '../models';
import { SettingsButton } from '../SettingsOverlay';
import { SfxPressable as Pressable } from '../components/SfxPressable';
import { scaledBody } from '../text-scale';
import type { TextScale } from '../../persistence';
import { PixelText } from '../components/PixelText';
import { DesktopClamp, useDesktopContentStyle } from '../layout/DesktopClamp';
import { ManagementSprite } from '../components/ManagementSprite';
import type { FulltimeReactionViewModel } from '../models';

export interface PostMatchLedgerScreenProps {
  viewModel: PostMatchViewModel;
  onContinue: () => void;
  onReplayHighlight?: (highlightId: string) => void;
  textScale?: TextScale;
  onOpenSettings: () => void;
}

export function PostMatchLedgerScreen({
  viewModel,
  onContinue,
  onReplayHighlight,
  onOpenSettings,
  textScale = 1,
}: PostMatchLedgerScreenProps) {
  const desktopContent = useDesktopContentStyle();
  const { result } = viewModel;
  const resultTone = result.outcomeLabel === 'WIN'
    ? 'success'
    : result.outcomeLabel === 'LOSS'
      ? 'danger'
      : 'normal';

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'left', 'right', 'bottom']}>
      <View className="flex-row items-center justify-between border-b-2 border-ink bg-paper-dark px-4 py-3">
        <View>
          <PixelText className="text-sm uppercase tracking-[2px] text-blue-dark">Match complete</PixelText>
          <PixelText className="mt-1 text-base uppercase text-ink">Full-time report</PixelText>
        </View>
        <SettingsButton onPress={onOpenSettings} />
      </View>
      <ScrollView className="flex-1" contentContainerStyle={[{ padding: 16, paddingBottom: 24 }, desktopContent]}>
        {/* Stacked rather than side by side: two names in 24-point columns
            either wrapped mid-word or truncated to "BRAMB LE RO_" on a phone,
            which is no way to read your own club's name. The vertical run has
            the width to spell both out, and it gives the winner's box somewhere
            to sit without crowding the score. */}
        <View className="items-center py-3">
          <StatusChip label="Full time" tone={resultTone} />
          <PixelText className="mt-3 text-sm uppercase text-blue-dark">{result.competition}</PixelText>

          <TeamLine name={result.homeTeam} won={result.winner === 'home'} />

          <View className="mt-3 flex-row items-center border-2 border-ink bg-ink px-5 py-3">
            <Text className="font-mono text-3xl text-paper">{result.homeScore}</Text>
            <Text className="mx-3 font-mono text-xl text-paper/60">–</Text>
            <Text className="font-mono text-3xl text-paper">{result.awayScore}</Text>
          </View>
          {result.winner === null ? (
            <PixelText className="mt-3 text-base uppercase text-ink/60">Draw</PixelText>
          ) : null}

          <TeamLine name={result.awayTeam} won={result.winner === 'away'} />

          <Text className="mt-5 text-center text-ink/70" style={scaledBody(textScale)}>{result.headline}</Text>
        </View>

        {viewModel.reaction ? (
          <FulltimeReaction reaction={viewModel.reaction} textScale={textScale} />
        ) : null}

        {viewModel.highlights.length ? (
          <View className="mt-6">
            <SectionLabel eyebrow="Match tape" title="Highlights" />
            <View className="gap-2">
              {viewModel.highlights.map(highlight => (
                <Pressable
                  key={highlight.id}
                  accessibilityRole={onReplayHighlight ? 'button' : 'text'}
                  accessibilityLabel={`${highlight.minuteLabel}. ${highlight.description}`}
                  disabled={!onReplayHighlight}
                  onPress={() => onReplayHighlight?.(highlight.id)}
                  className="min-h-12 flex-row items-center border border-ink/25 bg-white px-3 py-2"
                  style={({ pressed }) => ({ opacity: pressed ? 0.68 : undefined })}
                >
                  <Text className="w-12 font-mono text-base text-gold-dark">{highlight.minuteLabel}</Text>
                  <Text className="flex-1 text-ink" style={scaledBody(textScale)}>{highlight.description}</Text>
                  {onReplayHighlight ? <Text className="font-mono text-base text-blue-dark">▶</Text> : null}
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* The bar stays full-bleed, the button inside it does not: on a wide
          window it shares the two-column measure with the highlights above,
          so its edges line up with them instead of running off to the frame. */}
      <View className="border-t-2 border-ink/20 bg-white p-3">
        <DesktopClamp>
          <ActionButton
            label="Back to the office  ▸"
            accessibilityLabel="Continue to the Home screen and review the match summary"
            onPress={onContinue}
          />
        </DesktopClamp>
      </View>
    </SafeAreaView>
  );
}

/**
 * One club, on its own line, spelled out. The winner wears a red box with the
 * word under it rather than beside it, so the box stays a box on the narrowest
 * phone instead of squeezing into a badge.
 */
function TeamLine({ name, won }: { name: string; won: boolean }) {
  return (
    <View className="mt-4 items-center">
      <View className={won
        ? 'border-2 border-stamp px-4 py-2'
        : 'px-4 py-2'}>
        <PixelText
          className="text-center text-base uppercase text-ink"
          numberOfLines={2}
        >
          {name}
        </PixelText>
      </View>
      {won ? (
        <PixelText className="mt-2 text-xl uppercase text-stamp">Win</PixelText>
      ) : null}
    </View>
  );
}

/**
 * The touchline, bottom left, once the numbers have been read.
 *
 * The gaffer is the last thing on the report on purpose: the result is the
 * headline, and his opinion of it is the footnote. On the blame roll the
 * assistant stands to his right, which is the side the pointing sprite's arm
 * comes out of, so the finger lands on a person rather than on air.
 */
function FulltimeReaction({
  reaction,
  textScale,
}: {
  reaction: FulltimeReactionViewModel;
  textScale: TextScale;
}) {
  const blaming = reaction.pose === 'point' && reaction.assistantPortraitId !== undefined;
  const mood = reaction.pose === 'joy'
    ? `${reaction.coachName} is celebrating`
    : blaming
      ? `${reaction.coachName} is blaming ${reaction.assistantName}`
      : `${reaction.coachName} is in tears`;

  return (
    <View className="mt-6 items-start">
      {blaming && reaction.blameLine ? (
        <View className="max-w-[280px]">
          <View className="border-2 border-ink bg-white px-3 py-2">
            <Text className="text-ink" style={scaledBody(textScale)}>{reaction.blameLine}</Text>
          </View>
          {/* The tail sits under the gaffer's half of the bubble, not the
              assistant's: it is his line. */}
          <PixelText className="ml-6 text-base text-ink">▼</PixelText>
        </View>
      ) : null}
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={blaming && reaction.blameLine
          ? `${mood}. "${reaction.blameLine}"`
          : mood}
        className="flex-row items-end gap-3"
      >
        <ManagementSprite spriteKey={`coach:${reaction.coachPortraitId}:${reaction.pose}`} width={56} />
        {blaming ? (
          <ManagementSprite spriteKey={`coach:${reaction.assistantPortraitId}:rest`} width={56} />
        ) : null}
      </View>
    </View>
  );
}
