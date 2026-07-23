import { Text, View } from 'react-native';
import type { M2LeagueFixtureViewModel } from '../m2-league-models';
import { StatusChip } from './Scorecard';

export function LeagueFixtureRow({ fixture }: { fixture: M2LeagueFixtureViewModel }) {
  const resultTone = fixture.result === 'WIN'
    ? 'success' as const
    : fixture.result === 'LOSS'
      ? 'danger' as const
      : 'normal' as const;
  const resultLabel = fixture.result ?? (fixture.currentWeek ? 'NEXT' : fixture.venue);

  return (
    <View
      accessible
      accessibilityLabel={`${fixture.weekLabel}, ${fixture.venue.toLowerCase()} against ${fixture.opponentName}, ${fixture.status === 'PLAYED' ? fixture.scoreLabel : 'scheduled'}`}
      className={fixture.currentWeek
        ? 'min-h-16 flex-row items-center border-2 border-b-4 border-blue-dark bg-blue-light px-3 py-2'
        : 'min-h-16 flex-row items-center border-2 border-b-4 border-ink bg-white px-3 py-2'}
    >
      <View className="w-16 pr-2">
        <Text className="font-mono text-sm font-bold uppercase text-blue-dark">{fixture.weekLabel}</Text>
        <Text className="mt-1 font-mono text-sm uppercase text-ink/50">{fixture.venue}</Text>
      </View>
      <View className="flex-1 border-l border-ink/20 pl-3">
        <Text className="text-sm text-ink/50" numberOfLines={1}>{fixture.venue === 'HOME' ? 'Hosts' : 'Visits'}</Text>
        <Text className="mt-0.5 text-base font-bold text-ink" numberOfLines={1}>{fixture.opponentName}</Text>
      </View>
      <View className="items-end gap-1 pl-2">
        <Text className="font-mono text-base font-bold text-ink">{fixture.scoreLabel}</Text>
        <StatusChip label={resultLabel} tone={resultTone} />
      </View>
    </View>
  );
}
