import { Text, View } from 'react-native';
import type { PostMatchViewModel } from '../models';
import { PixelText } from './PixelText';
import { StatusChip, formatCurrency } from './Scorecard';

/** Immediate cause-and-effect for the Season 3 social-following system. */
export function PostMatchBuzzCard({ buzz, className = '' }: {
  readonly buzz: NonNullable<PostMatchViewModel['buzz']>;
  readonly className?: string;
}) {
  const breakdown = [
    buzz.win > 0 ? `Win +${buzz.win}` : undefined,
    buzz.goals > 0 ? `Goals +${buzz.goals}` : undefined,
    buzz.heroMoments > 0 ? `Heroes +${buzz.heroMoments}` : undefined,
  ].filter(Boolean).join(' · ') || 'No Buzz earned this match';
  const capped = buzz.earned < buzz.rawEarned;
  const accessibilityLabel = [
    `Club Buzz ${buzz.earned > 0 ? `plus ${buzz.earned}` : 'unchanged'}.`,
    breakdown.replaceAll('·', ','),
    capped ? 'The 100 point cap limited this gain.' : undefined,
    buzz.payout === undefined
      ? `Current Buzz ${buzz.valueAfter} of 100.`
      : `Buzz paid out ${formatCurrency(buzz.payout)} and reset to zero.`,
  ].filter(Boolean).join(' ');
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel}
      className={`${className} border-2 border-b-4 border-gold-dark bg-gold-light p-4`}
    >
      <View className="flex-row flex-wrap items-start justify-between gap-2">
        <View className="min-w-0 flex-1">
          <PixelText className="text-sm uppercase text-ink">Club Buzz</PixelText>
          <Text className="mt-1 font-mono text-xl text-ink">
            {buzz.earned > 0 ? `+${buzz.earned}` : '+0'}
          </Text>
        </View>
        <StatusChip label={`${buzz.valueAfter} / 100`} tone="hero" />
      </View>
      <Text className="mt-3 text-sm font-bold leading-5 text-ink">{breakdown}</Text>
      {capped ? (
        <Text className="mt-1 text-sm text-ink/70">Reached the 100 Buzz cap.</Text>
      ) : null}
      {buzz.payout === undefined ? null : (
        <View className="mt-3 border-2 border-ink bg-white px-3 py-2">
          <Text className="text-sm font-bold text-ink">
            Buzz paid out {formatCurrency(buzz.payout)} · reset to 0
          </Text>
        </View>
      )}
    </View>
  );
}
