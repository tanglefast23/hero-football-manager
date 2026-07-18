import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  CREATION_STAT_MAX,
  CREATION_STAT_MIN,
  DEFAULT_CREATION_RATINGS,
  OUTFIELD_CREATION_STATS,
  creationPointsRemaining,
  type CreatedPlayerDraft,
  type OutfieldCreationRatings,
  type OutfieldCreationStat,
} from '../../game';
import { ActionButton, PaperPanel, StatusChip } from '../components/Scorecard';

export interface CharacterCreationScreenProps {
  onComplete: (draft: CreatedPlayerDraft) => void;
}

const STAT_COPY: Record<OutfieldCreationStat, { label: string; detail: string }> = {
  pac: { label: 'PAC', detail: 'Burst and recovery runs' },
  sho: { label: 'SHO', detail: 'Finishing and striking' },
  pas: { label: 'PAS', detail: 'Weight and vision' },
  def: { label: 'DEF', detail: 'Challenges and marking' },
  tec: { label: 'TEC', detail: 'Touch under pressure' },
  sta: { label: 'STA', detail: 'Late-match engine' },
};

export function CharacterCreationScreen({ onComplete }: CharacterCreationScreenProps) {
  const [name, setName] = useState('');
  const [ratings, setRatings] = useState<OutfieldCreationRatings>({
    ...DEFAULT_CREATION_RATINGS,
  });
  const pointsRemaining = useMemo(() => creationPointsRemaining(ratings), [ratings]);
  const canSubmit = name.trim().length >= 2 && pointsRemaining === 0;

  function adjust(stat: OutfieldCreationStat, delta: -1 | 1): void {
    setRatings(current => {
      const nextValue = current[stat] + delta;
      if (nextValue < CREATION_STAT_MIN || nextValue > CREATION_STAT_MAX) return current;
      if (delta > 0 && creationPointsRemaining(current) <= 0) return current;
      return { ...current, [stat]: nextValue };
    });
  }

  return (
    <SafeAreaView className="flex-1 bg-ink" edges={['top', 'left', 'right', 'bottom']}>
      <View className="border-b-2 border-signal bg-ink-soft px-5 py-4">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="text-xs font-bold uppercase tracking-[3px] text-signal">Club file 00</Text>
            <Text className="mt-2 text-2xl font-bold uppercase leading-7 tracking-wide text-paper">
              Create “You.”
            </Text>
          </View>
          <View className="-rotate-3 border-2 border-stamp px-3 py-2">
            <Text className="text-xs font-bold uppercase tracking-widest text-stamp">Rookie</Text>
          </View>
        </View>
        <Text className="mt-3 max-w-sm text-sm leading-5 text-paper/65">
          A decent Division-Five forward, shaped your way. Flavor, not a cheat code.
        </Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
        <PaperPanel kicker="Registration card" title="Name on the shirt" stamp="Required">
          <TextInput
            accessibilityLabel="Created player name"
            value={name}
            onChangeText={setName}
            placeholder="Type a player name"
            placeholderTextColor="#6B665D"
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={24}
            className="min-h-14 border-2 border-ink bg-paper-dark px-3 py-3 text-lg font-bold text-ink"
          />
          <View className="mt-3 flex-row items-center justify-between">
            <StatusChip label="FWD" selected />
            <Text className="text-xs font-bold uppercase tracking-wide text-ink/50">180 / week · 1 season</Text>
          </View>
        </PaperPanel>

        <View className="mt-6 flex-row items-end justify-between gap-3">
          <View className="flex-1">
            <Text className="text-xs font-bold uppercase tracking-[2px] text-sky">Six visible stats</Text>
            <Text className="mt-1 text-xl font-bold uppercase text-paper">Spend every point</Text>
          </View>
          <View className={pointsRemaining === 0 ? 'border-2 border-emerald-600 bg-emerald-100 px-3 py-2' : 'border-2 border-signal bg-signal px-3 py-2'}>
            <Text className="text-center font-mono text-xl font-bold text-ink">{pointsRemaining}</Text>
            <Text className="text-xs font-bold uppercase text-ink/60">left</Text>
          </View>
        </View>

        <View className="mt-3 gap-2">
          {OUTFIELD_CREATION_STATS.map(stat => {
            const copy = STAT_COPY[stat];
            const value = ratings[stat];
            return (
              <View key={stat} className="min-h-20 flex-row items-center border-2 border-paper/25 bg-ink-soft p-3">
                <View className="w-16">
                  <Text className="font-mono text-lg font-bold text-signal">{copy.label}</Text>
                  <Text className="mt-1 text-xs leading-4 text-paper/45">{copy.detail}</Text>
                </View>
                <View className="mx-3 h-2 flex-1 overflow-hidden border border-paper/25 bg-ink">
                  <View
                    className="h-full bg-sky"
                    style={{ width: `${((value - CREATION_STAT_MIN) / (CREATION_STAT_MAX - CREATION_STAT_MIN)) * 100}%` }}
                  />
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Decrease ${copy.label}`}
                  accessibilityState={{ disabled: value <= CREATION_STAT_MIN }}
                  disabled={value <= CREATION_STAT_MIN}
                  onPress={() => adjust(stat, -1)}
                  className="h-11 w-11 items-center justify-center border-2 border-paper/40"
                  style={({ pressed }) => ({ opacity: pressed ? 0.65 : value <= CREATION_STAT_MIN ? 0.3 : 1 })}
                >
                  <Text className="font-mono text-xl font-bold text-paper">−</Text>
                </Pressable>
                <Text className="w-12 text-center font-mono text-xl font-bold text-paper">{value}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Increase ${copy.label}`}
                  accessibilityState={{ disabled: value >= CREATION_STAT_MAX || pointsRemaining <= 0 }}
                  disabled={value >= CREATION_STAT_MAX || pointsRemaining <= 0}
                  onPress={() => adjust(stat, 1)}
                  className="h-11 w-11 items-center justify-center border-2 border-signal bg-signal"
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.65 : value >= CREATION_STAT_MAX || pointsRemaining <= 0 ? 0.3 : 1,
                  })}
                >
                  <Text className="font-mono text-xl font-bold text-ink">+</Text>
                </Pressable>
              </View>
            );
          })}
        </View>

        <Text className="mt-4 text-xs leading-4 text-paper/45">
          REF is goalkeeper-only and stays hidden at its outfield filler value. Every legal build has the same total quality.
        </Text>
      </ScrollView>

      <View className="border-t-2 border-signal bg-ink-soft p-3">
        <ActionButton
          label="Sign the rookie  ▸"
          accessibilityLabel="Finish creating player"
          disabled={!canSubmit}
          onPress={() => onComplete({ name, ratings })}
        />
      </View>
    </SafeAreaView>
  );
}
