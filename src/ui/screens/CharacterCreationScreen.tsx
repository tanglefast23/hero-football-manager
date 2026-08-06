import { useMemo, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SfxPressable as Pressable } from '../components/SfxPressable';
import {
  CREATED_APPEARANCE_OPTION_COUNTS as APPEARANCE_OPTIONS,
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
import { ChalkboardBackdrop, StickerWord } from '../components/ChalkboardStage';
import { PixelPortrait } from '../components/PixelPortrait';
import { playManagementHaptic } from '../../render/haptics';
import { formatChoiceValue, stepChoice } from '../appearance-stepper';
import { useLayoutMode } from '../layout/use-layout-mode';
import { PixelText } from '../components/PixelText';
import { useCopy } from '../../i18n';

export interface CharacterCreationScreenProps {
  initialDifficulty: DifficultyMode;
  onComplete: (draft: CreatedPlayerDraft) => void;
}

/**
 * The stepper label and value live in fixed cells (flex-1 and w-16), so system
 * text far above this multiplier ellipsises them rather than reflowing. Body
 * prose is unaffected: it scales through the in-game Text size setting.
 *
 * The value cell holds text-sm (0.875rem) in w-16 (4rem), so a value may be at
 * most 4.571em wide however the platform sizes a rem. The widest value, "10/10",
 * is 4.0em in Silkscreen Bold and only 3.375em in the Regular cut, which is why
 * the value renders in the `data` voice: Bold overran the cell above 1.143x and
 * shipped as "10/…" on any device with system text above the default.
 */
const STEPPER_MAX_FONT_SIZE_MULTIPLIER = 1.2;

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
}: CharacterCreationScreenProps) {
  const t = useCopy();
  const wide = useLayoutMode() === 'twoColumn';
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

  const identityPanels = (
    <>
      <PaperPanel kicker="Paper doll" title="Choose their look" stamp="Saved">
        {/* Portrait and steppers sit side by side only when there is room for
            readable stepper labels; phones stack them. */}
        <View className={wide ? 'flex-row items-center gap-4' : 'items-center gap-4'}>
          {/* `rest` rather than `joy` so the rookie blinks while you dress them:
              every joy face squints, and PixelPortrait can only close eyes it can
              find open (see portrait-blink). */}
          <View className="border-2 border-b-4 border-ink bg-blue-light p-2">
            <PixelPortrait
              playerId="created-player-preview"
              role="FWD"
              lookId={createdAppearanceLookId(appearance)}
              expression="rest"
            />
          </View>
          <View className={wide ? 'min-w-0 flex-1 gap-2' : 'w-full gap-2'}>
            <AppearanceChoice
              label="Skin tone"
              value={formatChoiceValue(appearance.skinTone, APPEARANCE_OPTIONS.skinTone)}
              onPrevious={() => cycleAppearance('skinTone', -1, APPEARANCE_OPTIONS.skinTone)}
              onNext={() => cycleAppearance('skinTone', 1, APPEARANCE_OPTIONS.skinTone)}
            />
            <AppearanceChoice
              label="Hair"
              value={formatChoiceValue(appearance.hairstyle, APPEARANCE_OPTIONS.hairstyle)}
              onPrevious={() => cycleAppearance('hairstyle', -1, APPEARANCE_OPTIONS.hairstyle)}
              onNext={() => cycleAppearance('hairstyle', 1, APPEARANCE_OPTIONS.hairstyle)}
            />
            <AppearanceChoice
              label="Kit accent"
              value={formatChoiceValue(appearance.kitAccent, APPEARANCE_OPTIONS.kitAccent)}
              onPrevious={() => cycleAppearance('kitAccent', -1, APPEARANCE_OPTIONS.kitAccent)}
              onNext={() => cycleAppearance('kitAccent', 1, APPEARANCE_OPTIONS.kitAccent)}
            />
          </View>
        </View>
      </PaperPanel>

      <PaperPanel kicker="Career pressure" title="Choose difficulty" stamp={difficulty} className="mt-5">
        {/* A radio reports its state as `checked`, not `selected` — the latter
            becomes aria-selected on web, which role="radio" does not expose, so
            a screen reader announced neither option as chosen. */}
        <View accessibilityRole="radiogroup" accessibilityLabel={t('characterCreation.a11y.careerPressure')} className="gap-3">
          {([
            ['CHAIRMAN', 'Expert mode'],
            ['COZY', 'Casual mode'],
          ] as const).map(([mode, label]) => {
            const selected = difficulty === mode;
            return (
              <Pressable
                key={mode}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={`${mode} (${label})`}
                onPress={() => {
                  setDifficulty(mode);
                }}
                className={selected
                  ? 'min-h-14 border-2 border-ink bg-blue px-3 py-3'
                  : 'min-h-14 border-2 border-ink/30 bg-white px-3 py-3'}
              >
                <View className="flex-row items-center gap-2">
                  {/* Glyph-only node: ●/○ are in neither Silkscreen weight, so
                      the radio dot stands alone and falls back to the system
                      face on purpose instead of flipping the label mid-string. */}
                  <Text className={selected ? 'text-base text-white' : 'text-base text-ink'}>
                    {selected ? '●' : '○'}
                  </Text>
                  <Text className={selected
                    ? 'font-pixel text-base text-white'
                    : 'font-pixel text-base text-ink'}
                  >
                    {mode} ({label})
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </PaperPanel>

      <PaperPanel kicker="Registration card" title="Name" stamp="Required" className="mt-5">
        <TextInput
          accessibilityLabel={t('characterCreation.a11y.createdPlayerName')}
          value={name}
          onChangeText={setName}
          placeholder="Type a player name"
          placeholderTextColor="#6B665D"
          autoCapitalize="words"
          autoCorrect={false}
          maxLength={24}
          className="min-h-14 border-2 border-ink bg-paper-dark px-3 py-3 text-xl font-bold text-ink"
        />
        {/* The chip and the terms need 397px of Silkscreen on a 325px card, so
            the row wraps instead of running the wage off the edge. */}
        <View className="mt-3 flex-row flex-wrap items-center justify-between gap-2">
          <StatusChip label="Position: FWD" selected />
          <PixelText className="shrink text-sm uppercase text-ink/50">$180 / week · 1 season</PixelText>
        </View>
      </PaperPanel>
    </>
  );

  const pointsChip = (
    <View className={pointsRemaining === 0
      ? 'rotate-2 border-[3px] border-ink bg-pitch-light px-3 py-2'
      : 'rotate-2 border-[3px] border-ink bg-blue px-3 py-2'}
    >
      <Text className={pointsRemaining === 0
        ? 'text-center font-mono text-2xl text-ink'
        : 'text-center font-mono text-2xl text-white'}
      >
        {pointsRemaining}
      </Text>
      <Text className={pointsRemaining === 0
        ? 'text-center font-pixel text-sm uppercase text-ink/60'
        : 'text-center font-pixel text-sm uppercase text-white/80'}
      >
        left
      </Text>
    </View>
  );

  const statBalancing = (
    <>
      <View className={wide ? 'gap-2' : 'mt-6 gap-2'}>
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
                className="h-11 w-11 items-center justify-center border-2 border-ink bg-blue"
                // Static style array on purpose — layout must never live in a
                // function-form style (the twice-hit iOS zero-height trap). The
                // 44pt minimum is explicit points: h-11 is 38.5pt on native.
                // SfxPressable supplies the pressed dim when no opacity is set.
                style={[{ minWidth: 44, minHeight: 44 }, value <= CREATION_STAT_MIN ? { opacity: 0.3 } : null]}
              >
                <Text className="font-mono text-2xl font-bold text-white">−</Text>
              </Pressable>
              <Text className="w-12 text-center font-mono text-2xl text-ink">{value}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Increase ${copy.label}, currently ${value}`}
                accessibilityState={{ disabled: value >= CREATION_STAT_MAX || pointsRemaining <= 0 }}
                disabled={value >= CREATION_STAT_MAX || pointsRemaining <= 0}
                pressSfx="stat-step"
                onPress={() => {
                  adjust(stat, 1);
                }}
                className="h-11 w-11 items-center justify-center border-2 border-ink bg-blue"
                style={[
                  { minWidth: 44, minHeight: 44 },
                  value >= CREATION_STAT_MAX || pointsRemaining <= 0 ? { opacity: 0.3 } : null,
                ]}
              >
                <Text className="font-mono text-2xl font-bold text-white">+</Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </>
  );

  const signRookie = (
    <>
      {!canSubmit && submitAttempted ? (
        <Text
          accessibilityRole="alert"
          className="mb-2 text-center text-sm font-bold text-red-light"
        >
          {submitBlockReason}
        </Text>
      ) : null}
      <ActionButton
        // '›' is in Silkscreen; '▸' is not and rendered in the fallback face.
        label="Sign the rookie  ›"
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
    </>
  );

  return (
    <SafeAreaView className="flex-1 bg-pitch-ink" edges={['top', 'left', 'right', 'bottom']}>
      <ChalkboardBackdrop wide={wide} />
      <View className={wide ? 'w-full max-w-[1180px] self-center px-10 pt-6' : 'px-5 py-4'}>
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="font-pixel text-xs uppercase tracking-[3px] text-gold-light">{t('characterCreation.clubFile00')}</Text>
            <View className="mt-2 flex-row flex-wrap items-center gap-2">
              <Text className={wide
                ? 'font-pixel text-4xl uppercase text-white'
                : 'font-pixel text-2xl uppercase text-white'}
              >
                {t('characterCreation.yourFirst')}</Text>
              <StickerWord text="hire" wide={wide} />
            </View>
          </View>
          {pointsChip}
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
      >
        {wide ? (
          <View className="w-full max-w-[1180px] flex-row items-start gap-6 self-center px-6">
            <View className="flex-1">{identityPanels}</View>
            <View className="flex-1">
              {statBalancing}
              <View className="mt-5">{signRookie}</View>
            </View>
          </View>
        ) : (
          <>
            {identityPanels}
            {statBalancing}
          </>
        )}
      </ScrollView>

      {wide ? null : (
        <View className="border-t-[6px] border-white bg-ink/25 p-3">
          {signRookie}
        </View>
      )}
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
      <PixelText
        className="min-w-0 flex-1 text-sm uppercase text-ink"
        maxFontSizeMultiplier={STEPPER_MAX_FONT_SIZE_MULTIPLIER}
        numberOfLines={1}
      >
        {label}
      </PixelText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Previous ${label}, currently ${value}`}
        pressSfx="stat-step"
        onPress={() => {
          onPrevious();
        }}
        className="h-11 w-11 items-center justify-center border-2 border-ink bg-blue"
        // Static style, not a function: layout in a function-form style is the
        // twice-hit iOS zero-height trap. 44pt minimum in explicit points —
        // h-11 is only 38.5pt on native; SfxPressable supplies the pressed dim.
        style={{ minWidth: 44, minHeight: 44 }}
      >
        <Text className="font-pixel text-xl text-white">‹</Text>
      </Pressable>
      <PixelText
        variant="data"
        className="w-16 text-center text-sm text-blue-dark"
        maxFontSizeMultiplier={STEPPER_MAX_FONT_SIZE_MULTIPLIER}
        numberOfLines={1}
      >
        {value}
      </PixelText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Next ${label}, currently ${value}`}
        pressSfx="stat-step"
        onPress={() => {
          onNext();
        }}
        className="h-11 w-11 items-center justify-center border-2 border-ink bg-blue"
        style={{ minWidth: 44, minHeight: 44 }}
      >
        <Text className="font-pixel text-xl text-white">›</Text>
      </Pressable>
    </View>
  );
}
