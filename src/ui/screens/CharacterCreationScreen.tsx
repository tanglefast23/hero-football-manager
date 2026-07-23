import { useMemo, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SfxPressable as Pressable } from '../components/SfxPressable';
import {
  CREATION_STAT_MAX,
  CREATION_STAT_MIN,
  DEFAULT_CREATED_APPEARANCE,
  DEFAULT_CREATION_RATINGS,
  OUTFIELD_CREATION_STATS,
  creationPointsRemaining,
  createdAppearanceLookId,
  type CreatedPlayerAppearance,
  type DifficultyMode,
  type CreatedPlayerDraft,
  type OutfieldCreationRatings,
  type OutfieldCreationStat,
} from '../../game';
import { ActionButton, PaperPanel, StatusChip } from '../components/Scorecard';
import { SettingsButton } from '../SettingsOverlay';
import { PixelPortrait } from '../components/PixelPortrait';
import { playManagementHaptic } from '../../render/haptics';
import { stepChoice } from '../appearance-stepper';

export interface CharacterCreationScreenProps {
  initialDifficulty: DifficultyMode;
  onComplete: (draft: CreatedPlayerDraft) => void;
  onOpenSettings: () => void;
}

const STAT_COPY: Record<OutfieldCreationStat, { label: string; detail: string }> = {
  pac: { label: 'PACE', detail: 'Burst and recovery runs' },
  sho: { label: 'SHOOTING', detail: 'Finishing and striking' },
  pas: { label: 'PASSING', detail: 'Weight and vision' },
  def: { label: 'DEFENDING', detail: 'Challenges and marking' },
  tec: { label: 'TECHNIQUE', detail: 'Touch under pressure' },
  sta: { label: 'STAMINA', detail: 'Late-match engine' },
};

export function CharacterCreationScreen({
  initialDifficulty,
  onComplete,
  onOpenSettings,
}: CharacterCreationScreenProps) {
  const [name, setName] = useState('');
  const [ratings, setRatings] = useState<OutfieldCreationRatings>({
    ...DEFAULT_CREATION_RATINGS,
  });
  const [appearance, setAppearance] = useState<CreatedPlayerAppearance>({ ...DEFAULT_CREATED_APPEARANCE });
  const [difficulty, setDifficulty] = useState<DifficultyMode>(initialDifficulty);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const pointsRemaining = useMemo(() => creationPointsRemaining(ratings), [ratings]);
  const hasValidName = name.trim().length >= 2;
  const canSubmit = hasValidName && pointsRemaining === 0;
  const pointLabel = pointsRemaining === 1 ? 'point' : 'points';
  const submitBlockReason = hasValidName
    ? `Spend ${pointsRemaining} more ${pointLabel} before signing.`
    : pointsRemaining === 0
      ? 'Name the rookie to sign them.'
      : `Name the rookie and spend ${pointsRemaining} more ${pointLabel} before signing.`;

  function adjust(stat: OutfieldCreationStat, delta: -1 | 1): void {
    setRatings(current => {
      const nextValue = current[stat] + delta;
      if (nextValue < CREATION_STAT_MIN || nextValue > CREATION_STAT_MAX) return current;
      if (delta > 0 && creationPointsRemaining(current) <= 0) return current;
      return { ...current, [stat]: nextValue };
    });
  }

  function cycleAppearance(
    key: keyof CreatedPlayerAppearance,
    delta: -1 | 1,
    count: number,
  ): void {
    setAppearance(current => ({
      ...current,
      [key]: stepChoice(current[key], delta, count),
    }) as CreatedPlayerAppearance);
  }

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'left', 'right', 'bottom']}>
      <View className="border-b-2 border-ink bg-white px-5 py-4">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="text-sm font-bold uppercase tracking-[3px] text-blue-dark">Club file 00</Text>
            <Text className="mt-2 text-3xl font-bold uppercase leading-9 tracking-wide text-ink">
              Your first hire
            </Text>
          </View>
          <View className="items-end gap-3">
            <SettingsButton onPress={onOpenSettings} />
            <View className="-rotate-3 border-2 border-stamp px-3 py-2">
              <Text className="text-sm font-bold uppercase tracking-widest text-stamp">Rookie</Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
        <PaperPanel kicker="Paper doll" title="Choose their look" stamp="Saved">
          <View className="flex-row items-center gap-4">
            <View className="border-2 border-b-4 border-ink bg-blue-light p-2">
              <PixelPortrait
                playerId="created-player-preview"
                role="FWD"
                lookId={createdAppearanceLookId(appearance)}
                expression="joy"
              />
            </View>
            <View className="min-w-0 flex-1 gap-2">
              <AppearanceChoice
                label="Skin tone"
                value={`${appearance.skinTone + 1} / 6`}
                onPrevious={() => cycleAppearance('skinTone', -1, 6)}
                onNext={() => cycleAppearance('skinTone', 1, 6)}
              />
              <AppearanceChoice
                label="Hair"
                value={`${appearance.hairstyle + 1} / 10`}
                onPrevious={() => cycleAppearance('hairstyle', -1, 10)}
                onNext={() => cycleAppearance('hairstyle', 1, 10)}
              />
              <AppearanceChoice
                label="Kit accent"
                value={`${appearance.kitAccent + 1} / 4`}
                onPrevious={() => cycleAppearance('kitAccent', -1, 4)}
                onNext={() => cycleAppearance('kitAccent', 1, 4)}
              />
            </View>
          </View>
        </PaperPanel>

        <PaperPanel kicker="Career pressure" title="Choose difficulty" stamp={difficulty} className="mt-5">
          <View className="gap-3">
            {([
              ['COZY', 'Casual mode'],
              ['CHAIRMAN', 'Expert mode'],
            ] as const).map(([mode, label]) => {
              const selected = difficulty === mode;
              return (
                <Pressable
                  key={mode}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${mode} (${label})`}
                  onPress={() => {
                    setDifficulty(mode);
                  }}
                  className={selected
                    ? 'min-h-14 border-2 border-violet-dark bg-violet-light px-3 py-3'
                    : 'min-h-14 border-2 border-ink/30 bg-white px-3 py-3'}
                >
                  <Text className="font-mono text-base font-bold text-ink">{selected ? '●' : '○'} {mode} ({label})</Text>
                </Pressable>
              );
            })}
          </View>
        </PaperPanel>

        <PaperPanel kicker="Registration card" title="Name" stamp="Required" className="mt-5">
          <TextInput
            accessibilityLabel="Created player name"
            value={name}
            onChangeText={setName}
            placeholder="Type a player name"
            placeholderTextColor="#6B665D"
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={24}
            className="min-h-14 border-2 border-ink bg-paper-dark px-3 py-3 text-xl font-bold text-ink"
          />
          <View className="mt-3 flex-row items-center justify-between">
            <StatusChip label="Position: FWD" selected />
            <Text className="text-sm font-bold uppercase tracking-wide text-ink/50">$180 / week · 1 season</Text>
          </View>
        </PaperPanel>

        <View className="mt-6 flex-row items-end justify-between gap-3">
          <View className="flex-1">
            <Text className="text-sm font-bold uppercase tracking-[2px] text-blue-dark">Six visible stats</Text>
            <Text className="mt-1 text-2xl font-bold uppercase text-ink">Balance your way</Text>
          </View>
          <View className={pointsRemaining === 0 ? 'border-2 border-pitch-dark bg-pitch-light px-3 py-2' : 'border-2 border-violet-dark bg-violet-light px-3 py-2'}>
            <Text className="text-center font-mono text-2xl font-bold text-ink">{pointsRemaining}</Text>
            <Text className="text-sm font-bold uppercase text-ink/60">left</Text>
          </View>
        </View>

        <View className="mt-3 gap-2">
          {OUTFIELD_CREATION_STATS.map(stat => {
            const copy = STAT_COPY[stat];
            const value = ratings[stat];
            return (
              <View key={stat} className="min-h-20 flex-row items-center border-2 border-ink bg-white p-3">
                <View className="w-28 shrink-0">
                  <Text className="font-mono text-base text-blue-dark" numberOfLines={1} adjustsFontSizeToFit>
                    <Text className="font-bold">{copy.label.slice(0, 3)}</Text>
                    <Text className="font-normal">{copy.label.slice(3)}</Text>
                  </Text>
                  <Text className="mt-1 text-sm leading-4 text-ink/45">{copy.detail}</Text>
                </View>
                <View className="mx-2 h-2 flex-1 overflow-hidden border border-ink/20 bg-ink/15">
                  <View
                    className="h-full bg-blue-dark"
                    style={{ width: `${((value - CREATION_STAT_MIN) / (CREATION_STAT_MAX - CREATION_STAT_MIN)) * 100}%` }}
                  />
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Decrease ${copy.label}, currently ${value}`}
                  accessibilityState={{ disabled: value <= CREATION_STAT_MIN }}
                  disabled={value <= CREATION_STAT_MIN}
                  pressSfx="stat-step"
                  onPress={() => {
                    adjust(stat, -1);
                  }}
                  className="h-11 w-11 items-center justify-center border-2 border-ink/40"
                  style={({ pressed }) => ({ opacity: pressed ? 0.65 : value <= CREATION_STAT_MIN ? 0.3 : 1 })}
                >
                  <Text className="font-mono text-2xl font-bold text-ink">−</Text>
                </Pressable>
                <Text className="w-12 text-center font-mono text-2xl font-bold text-ink">{value}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Increase ${copy.label}, currently ${value}`}
                  accessibilityState={{ disabled: value >= CREATION_STAT_MAX || pointsRemaining <= 0 }}
                  disabled={value >= CREATION_STAT_MAX || pointsRemaining <= 0}
                  pressSfx="stat-step"
                  onPress={() => {
                    adjust(stat, 1);
                  }}
                  className="h-11 w-11 items-center justify-center border-2 border-violet-dark bg-violet-light"
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.65 : value >= CREATION_STAT_MAX || pointsRemaining <= 0 ? 0.3 : 1,
                  })}
                >
                  <Text className="font-mono text-2xl font-bold text-ink">+</Text>
                </Pressable>
              </View>
            );
          })}
        </View>

        <Text className="mt-4 text-sm leading-4 text-ink/45">
          Spend every point before signing. Lower any stat to free more for another. REF is goalkeeper-only and stays hidden at its outfield filler value.
        </Text>
      </ScrollView>

      <View className="border-t-2 border-ink bg-white p-3">
        {!canSubmit && submitAttempted ? (
          <Text
            accessibilityRole="alert"
            className="mb-2 text-center text-sm font-bold text-red-dark"
          >
            {submitBlockReason}
          </Text>
        ) : null}
        <ActionButton
          label="Sign the rookie  ▸"
          accessibilityLabel={canSubmit
            ? 'Finish creating player'
            : 'Finish creating player. Tap to review missing requirements.'}
          pressSfx={canSubmit ? 'positive' : 'click'}
          onPress={() => {
            if (!canSubmit) {
              setSubmitAttempted(true);
              return;
            }
            playManagementHaptic('commit');
            onComplete({ name, ratings, appearance, difficulty });
          }}
        />
      </View>
    </SafeAreaView>
  );
}

function AppearanceChoice({
  label,
  value,
  onPrevious,
  onNext,
}: {
  label: string;
  value: string;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <View className="min-h-11 flex-row items-center justify-between gap-2 border-2 border-ink/30 bg-white px-2 py-2">
      <Text className="min-w-0 flex-1 text-sm font-bold uppercase text-ink" numberOfLines={1}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Previous ${label}, currently ${value}`}
        pressSfx="stat-step"
        onPress={() => {
          onPrevious();
        }}
        className="h-11 w-11 items-center justify-center border-2 border-violet-dark bg-violet-light"
        style={({ pressed }) => ({ opacity: pressed ? 0.65 : undefined })}
      >
        <Text className="font-mono text-xl font-bold text-ink">‹</Text>
      </Pressable>
      <Text className="w-16 text-center font-mono text-sm font-bold text-violet-dark">{value}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Next ${label}, currently ${value}`}
        pressSfx="stat-step"
        onPress={() => {
          onNext();
        }}
        className="h-11 w-11 items-center justify-center border-2 border-violet-dark bg-violet-light"
        style={({ pressed }) => ({ opacity: pressed ? 0.65 : undefined })}
      >
        <Text className="font-mono text-xl font-bold text-ink">›</Text>
      </Pressable>
    </View>
  );
}
