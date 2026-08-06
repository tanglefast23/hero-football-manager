import { ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { PostMatchBuzzCard } from '../components/PostMatchBuzzCard';
import {
  SPEECH_BUBBLE_FONT_SIZE,
  SPEECH_BUBBLE_LINE_HEIGHT,
  SpeechBubbleTail,
  speechBubbleStyles,
} from '../speech-bubble';
import type { FulltimeReactionViewModel } from '../models';
import { useCopy } from '../../i18n';

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
  const t = useCopy();
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
          <PixelText className="text-[12px] uppercase tracking-[2px] text-blue-dark">{t('postMatchLedger.matchComplete')}</PixelText>
          <PixelText className="mt-1 text-base uppercase text-ink">{t('postMatchLedger.full-timeReport')}</PixelText>
        </View>
        <SettingsButton onPress={onOpenSettings} />
      </View>
      <ScrollView className="flex-1" contentContainerStyle={[{ padding: 16, paddingBottom: 24 }, desktopContent]}>
        {/* Stacked rather than side by side: two names in 24-point columns
            either wrapped mid-word or truncated to "BRAMB LE RO_" on a phone,
            which is no way to read your own club's name. The vertical run has
            the width to spell both out without crowding the score. */}
        <View className="items-center py-3">
          <StatusChip label="Full time" tone={resultTone} />
          <PixelText className="mt-3 text-[12px] uppercase text-blue-dark">{result.competition}</PixelText>

          <TeamLine
            name={result.homeTeam}
            outcome={result.winner === 'home' && result.outcomeLabel !== 'DRAW'
              ? result.outcomeLabel
              : null}
          />

          <View className="mt-3 flex-row items-center border-2 border-ink bg-ink px-5 py-3">
            <Text className="font-mono text-[26px] text-paper">{result.homeScore}</Text>
            <Text className="mx-3 font-mono text-[18px] text-paper/60">–</Text>
            <Text className="font-mono text-[26px] text-paper">{result.awayScore}</Text>
          </View>
          {result.winner === null ? (
            <PixelText className="mt-3 text-base uppercase text-ink/70">Draw</PixelText>
          ) : null}

          <TeamLine
            name={result.awayTeam}
            outcome={result.winner === 'away' && result.outcomeLabel !== 'DRAW'
              ? result.outcomeLabel
              : null}
          />
        </View>

        {viewModel.reaction ? (
          <FulltimeReaction reaction={viewModel.reaction} textScale={textScale} />
        ) : null}

        {viewModel.buzz === undefined ? null : (
          <PostMatchBuzzCard buzz={viewModel.buzz} className="mt-6" />
        )}

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
            accessibilityLabel={t('postMatchLedger.a11y.continueToTheHome')}
            onPress={onContinue}
          />
        </DesktopClamp>
      </View>
    </SafeAreaView>
  );
}

/**
 * One club, on its own line, spelled out. The outcome stays where the old WIN
 * marker sat, but speaks from the manager's point of view and uses the matching
 * success/danger colour. The club name no longer gets an unrelated red box.
 */
function TeamLine({
  name,
  outcome,
}: {
  name: string;
  outcome: 'WIN' | 'LOSS' | null;
}) {
  return (
    <View className="mt-4 items-center">
      <View className="px-4 py-2">
        <PixelText
          className="text-center text-base uppercase text-ink"
          numberOfLines={2}
        >
          {name}
        </PixelText>
      </View>
      {outcome ? (
        <PixelText
          className={outcome === 'WIN'
            ? 'mt-2 text-[18px] uppercase text-pitch-ink'
            : 'mt-2 text-[18px] uppercase text-red-dark'}
        >
          {outcome === 'WIN' ? 'We Won!' : 'We Lost'}
        </PixelText>
      ) : null}
    </View>
  );
}

/**
 * The touchline, bottom left, once the numbers have been read.
 *
 * The gaffer carries the whole verdict now. The report used to print a written
 * headline under the score and leave him standing there mute, which said the
 * same thing twice in two voices and gave the silent version the better billing.
 * He speaks every week instead: the score states the fact, he says what it meant.
 *
 * On the blame roll the assistant stands to his right, which is the side the
 * pointing sprite's arm comes out of, so the finger lands on a person rather
 * than on air.
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
      : reaction.pose === 'cry'
        ? `${reaction.coachName} is in tears`
        // A draw leaves him at rest, so there is no mood to name — read out who
        // is talking and let the line carry the rest.
        : `${reaction.coachName} on the result`;

  return (
    <View className="mt-6 items-start">
      {/* The same bubble Bert speaks out of, down to the drawn tail — see
          src/ui/speech-bubble.tsx. The tail points at the gaffer's half, not the
          assistant's: it is his line either way. */}
      <View style={[speechBubbleStyles.box, styles.reactionBubble]}>
        <Text
          style={[
            speechBubbleStyles.text,
            scaledBody(textScale, SPEECH_BUBBLE_FONT_SIZE, SPEECH_BUBBLE_LINE_HEIGHT),
          ]}
        >{reaction.line}</Text>
        <SpeechBubbleTail left={REACTION_TAIL_LEFT} />
      </View>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={`${mood}. "${reaction.line}"`}
        className="flex-row items-end gap-3"
      >
        <ManagementSprite spriteKey={`coach:${reaction.coachPortraitId}:${reaction.pose}`} width={COACH_SPRITE_WIDTH} />
        {blaming ? (
          <ManagementSprite spriteKey={`coach:${reaction.assistantPortraitId}:rest`} width={COACH_SPRITE_WIDTH} />
        ) : null}
      </View>
    </View>
  );
}

const COACH_SPRITE_WIDTH = 56;
/** He stands flush left under the bubble, so the tail points at his middle. */
const REACTION_TAIL_LEFT = COACH_SPRITE_WIDTH / 2;

const styles = StyleSheet.create({
  reactionBubble: {
    maxWidth: 280,
    // The drawn tail hangs below the bubble, so the sprite has to start below
    // the point rather than below the box.
    marginBottom: 18,
  },
});
