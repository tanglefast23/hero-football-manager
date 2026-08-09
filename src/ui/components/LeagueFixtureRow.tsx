import { Text, View } from 'react-native';
import type { M2LeagueFixtureViewModel } from '../m2-league-models';
import { StatusChip } from './Scorecard';
import { useCopy } from '../../i18n';

/**
 * `venue`, `result` and `status` are CODES the row branches on, so the words
 * drawn from them are looked up here rather than rendered straight through.
 */
const VENUE_KEYS = {
  HOME: 'm2League.venueHome',
  AWAY: 'm2League.venueAway',
} as const;
const VENUE_A11Y_KEYS = {
  HOME: 'm2League.a11y.venueHome',
  AWAY: 'm2League.a11y.venueAway',
} as const;
const RESULT_KEYS = {
  WIN: 'm2League.resultWin',
  DRAW: 'm2League.resultDraw',
  LOSS: 'm2League.resultLoss',
} as const;

export function LeagueFixtureRow({
  fixture,
}: {
  fixture: M2LeagueFixtureViewModel;
}) {
  const t = useCopy();
  const resultTone =
    fixture.result === 'WIN'
      ? ('success' as const)
      : fixture.result === 'LOSS'
        ? ('danger' as const)
        : ('normal' as const);
  const resultLabel =
    fixture.result !== undefined
      ? t(RESULT_KEYS[fixture.result])
      : fixture.currentWeek
        ? t('m2League.fixtureNext')
        : t(VENUE_KEYS[fixture.venue]);

  return (
    <View
      accessible
      accessibilityLabel={t('m2League.a11y.fixtureRow', {
        week: fixture.weekLabel,
        venue: t(VENUE_A11Y_KEYS[fixture.venue]),
        opponent: fixture.opponentName,
        result:
          fixture.status === 'PLAYED'
            ? fixture.scoreLabel
            : t('m2League.a11y.scheduled'),
      })}
      className={
        fixture.currentWeek
          ? 'min-h-16 flex-row items-center border-2 border-b-4 border-blue-dark bg-blue-light px-3 py-2'
          : 'min-h-16 flex-row items-center border-2 border-b-4 border-ink bg-white px-3 py-2'
      }
    >
      <View className="w-16 pr-2">
        <Text className="font-pixel text-sm uppercase text-blue-dark">
          {fixture.weekLabel}
        </Text>
        <Text className="mt-1 font-mono text-sm uppercase text-ink/50">
          {t(VENUE_KEYS[fixture.venue])}
        </Text>
      </View>
      <View className="flex-1 border-l border-ink/20 pl-3">
        <Text className="text-sm text-ink/50" numberOfLines={1}>
          {t(fixture.venue === 'HOME' ? 'm2League.hosts' : 'm2League.visits')}
        </Text>
        <Text className="mt-0.5 text-base font-bold text-ink" numberOfLines={1}>
          {fixture.opponentName}
        </Text>
      </View>
      <View className="items-end gap-1 pl-2">
        <Text className="font-mono text-base text-ink">
          {fixture.scoreLabel}
        </Text>
        <StatusChip label={resultLabel} tone={resultTone} />
      </View>
    </View>
  );
}
