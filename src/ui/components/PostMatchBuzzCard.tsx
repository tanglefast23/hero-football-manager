import { Text, View } from 'react-native';
import type { PostMatchViewModel } from '../models';
import { PixelText } from './PixelText';
import { StatusChip, formatCurrency } from './Scorecard';
import { useCopy } from '../../i18n';

/** Immediate cause-and-effect for the Season 3 social-following system. */
export function PostMatchBuzzCard({ buzz, className = '' }: {
  readonly buzz: NonNullable<PostMatchViewModel['buzz']>;
  readonly className?: string;
}) {
  const t = useCopy();
  const breakdown = [
    buzz.win > 0 ? t('postMatchBuzzCard.win', { points: buzz.win }) : undefined,
    buzz.goals > 0 ? t('postMatchBuzzCard.goals', { points: buzz.goals }) : undefined,
    buzz.heroMoments > 0 ? t('postMatchBuzzCard.heroes', { points: buzz.heroMoments }) : undefined,
  ].filter(Boolean).join(' · ') || t('postMatchBuzzCard.noBuzzEarned');
  const capped = buzz.earned < buzz.rawEarned;
  const accessibilityLabel = [
    buzz.earned > 0
      ? t('postMatchBuzzCard.a11y.clubBuzzPlus', { points: buzz.earned })
      : t('postMatchBuzzCard.a11y.clubBuzzUnchanged'),
    breakdown.replaceAll('·', ','),
    capped ? t('postMatchBuzzCard.a11y.capLimited') : undefined,
    buzz.payout === undefined
      ? t('postMatchBuzzCard.a11y.currentBuzz', { value: buzz.valueAfter })
      : t('postMatchBuzzCard.a11y.paidOutAndReset', { amount: formatCurrency(t, buzz.payout) }),
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
          <PixelText className="text-sm uppercase text-ink">{t('clubFinances.clubBuzz')}</PixelText>
          <Text className="mt-1 font-mono text-xl text-ink">
            {buzz.earned > 0 ? `+${buzz.earned}` : '+0'}
          </Text>
        </View>
        <StatusChip label={`${buzz.valueAfter} / 100`} tone="hero" />
      </View>
      <Text className="mt-3 text-sm font-bold leading-5 text-ink">{breakdown}</Text>
      {capped ? (
        <Text className="mt-1 text-sm text-ink/70">{t('postMatchBuzzCard.reachedThe100BuzzCap')}</Text>
      ) : null}
      {buzz.payout === undefined ? null : (
        <View className="mt-3 border-2 border-ink bg-white px-3 py-2">
          <Text className="text-sm font-bold text-ink">
            {t('postMatchBuzz.paidOut', { amount: formatCurrency(t, buzz.payout) })}
          </Text>
        </View>
      )}
    </View>
  );
}
