import { useRef, useState } from 'react';
import { PanResponder, ScrollView, Text, View } from 'react-native';
import { CrossPlatformModal as Modal } from './components/CrossPlatformModal';
import { ActionButton } from './components/Scorecard';
import { SfxPressable as Pressable } from './components/SfxPressable';
import {
  adjustDevVolume,
  DEV_VOLUME_LEVELS,
  devVolumePercent,
  type DevVolume,
} from '../render/dev-volume';
import type { CutInMode, HudSide, TextScale } from '../persistence';
import { ENABLED_LOCALES, localeMeta, useCopy, type Locale } from '../i18n';
import type { GlossaryCatalog } from '../content';
import { GlossaryPanel } from './GlossaryPanel';
import { HallOfFameScreen } from './screens/HallOfFameScreen';
import type { HallOfFameViewModel } from './models';
import { volumeThumbLeft } from './volume-slider-thumb';
import { PixelText } from './components/PixelText';
import type { AssistantMode } from '../game/types';
import { PrivacySupportPanel } from './PrivacySupportPanel';

/** Snap a raw 0–1 gesture position to the nearest supported volume level. */
function snapVolume(raw: number): DevVolume {
  const clamped = Math.max(0, Math.min(1, raw));
  let nearest: DevVolume = DEV_VOLUME_LEVELS[0];
  for (const level of DEV_VOLUME_LEVELS) {
    if (Math.abs(level - clamped) < Math.abs(nearest - clamped))
      nearest = level;
  }
  return nearest;
}

/** A chunky pixel volume slider — track + blue fill + thumb, draggable via PanResponder. */
function VolumeSlider({
  value,
  onChange,
}: {
  value: DevVolume;
  onChange: (v: DevVolume) => void;
}) {
  const t = useCopy();
  const widthRef = useRef(0);
  const [trackWidth, setTrackWidth] = useState(0);
  // The PanResponder is built once, so calling `onChange` directly would capture
  // the first render's prop — which closes over a stale preferences snapshot and
  // persists it, silently reverting every other setting changed since Settings
  // opened. Route through a ref so the handlers always see the live callback.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const valueRef = useRef(value);
  valueRef.current = value;
  const commit = (locationX: number) => {
    if (widthRef.current <= 0) return;
    const next = snapVolume(locationX / widthRef.current);
    // Only five levels exist; skipping no-ops avoids a SQLite write per pointer move.
    if (next !== valueRef.current) onChangeRef.current(next);
  };
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => commit(e.nativeEvent.locationX),
      onPanResponderMove: (e) => commit(e.nativeEvent.locationX),
    }),
  ).current;
  const pct = `${value * 100}%` as const;

  return (
    <View>
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="font-pixel text-base uppercase text-ink/60">
          {t('settings.volume.title')}
        </Text>
        <Text className="font-mono text-lg text-ink">
          {devVolumePercent(value)}%
        </Text>
      </View>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={t('settings.volume.label')}
        accessibilityHint={t('settings.volume.hint')}
        accessibilityValue={{
          min: 0,
          max: 100,
          now: devVolumePercent(value),
          text: t('settings.volume.percent', {
            percent: devVolumePercent(value),
          }),
        }}
        accessibilityActions={[
          { name: 'increment', label: t('settings.volume.increase') },
          { name: 'decrement', label: t('settings.volume.decrease') },
        ]}
        onAccessibilityAction={(event) => {
          if (
            event.nativeEvent.actionName === 'increment' ||
            event.nativeEvent.actionName === 'decrement'
          ) {
            onChange(adjustDevVolume(value, event.nativeEvent.actionName));
          }
        }}
        {...responder.panHandlers}
        onLayout={(e) => {
          widthRef.current = e.nativeEvent.layout.width;
          setTrackWidth(e.nativeEvent.layout.width);
        }}
        className="h-12 justify-center"
      >
        <View className="h-5 justify-center overflow-hidden rounded-full border-2 border-ink bg-grey-light">
          <View className="h-full bg-blue" style={{ width: pct }} />
        </View>
        <View
          pointerEvents="none"
          className="absolute top-2.5 h-7 w-7 rounded-full border-2 border-b-4 border-ink bg-blue-light"
          style={{ left: volumeThumbLeft(trackWidth, value) }}
        />
      </View>
      <View className="mt-2 flex-row justify-between">
        {DEV_VOLUME_LEVELS.map((level) => (
          <Text key={level} className="font-mono text-xs text-ink/40">
            {level * 100}
          </Text>
        ))}
      </View>
    </View>
  );
}

export interface SettingsOverlayProps {
  open: boolean;
  glossary: GlossaryCatalog;
  glossaryOpen: boolean;
  privacySupportOpen: boolean;
  volume: DevVolume;
  reduceMotion: boolean;
  hudSide: HudSide;
  hapticsEnabled: boolean;
  textScale: TextScale;
  language: Locale;
  onCycleLanguage: () => void;
  highContrast: boolean;
  colorSafeKits: boolean;
  cutInMode: CutInMode;
  performanceLimited?: boolean;
  /** Omitted in Release builds so Developer Mode cannot be discovered or enabled. */
  developerMode?: boolean;
  /** Omit both values when no career is loaded; there is nothing to advise. */
  assistantMode?: AssistantMode;
  onSetAssistantMode?: (mode: AssistantMode) => void;
  accessibilityCopy?: { title: string; body: string };
  /**
   * Omit to hide the row: with no career loaded there is no record to open,
   * not even a locked one. Present in both states otherwise — the locked page
   * is what tells a manager the climb has an end.
   */
  hallOfFame?: HallOfFameViewModel;
  hallOfFameOpen?: boolean;
  onHallOfFameOpenChange?: (open: boolean) => void;
  difficultyLabel?: 'COZY' | 'CHAIRMAN';
  saveError?: string | null;
  onEmailSupport: () => void;
  onVolumeChange: (v: DevVolume) => void;
  onToggleReduceMotion: () => void;
  onToggleHudSide: () => void;
  onToggleHaptics: () => void;
  onCycleTextScale: () => void;
  onToggleHighContrast: () => void;
  onToggleColorSafeKits: () => void;
  onToggleCutInMode: () => void;
  onRetry3x?: () => void;
  onToggleDeveloperMode?: () => void;
  onGlossaryOpenChange: (open: boolean) => void;
  onPrivacySupportOpenChange: (open: boolean) => void;
  onOpenChange: (open: boolean) => void;
}

export function SettingsButton({
  onPress,
  variant = 'paper',
}: {
  onPress: () => void;
  variant?: 'paper' | 'match';
}) {
  const t = useCopy();
  const match = variant === 'match';
  return (
    <Pressable
      immediatePress={match}
      accessibilityRole="button"
      accessibilityLabel={t('settings.open')}
      hitSlop={8}
      onPress={onPress}
      className={
        match
          ? 'h-11 w-11 items-center justify-center rounded border-2 border-b-4 border-ink bg-ink-soft'
          : 'h-11 w-11 items-center justify-center border-2 border-b-4 border-ink bg-white'
      }
      style={({ pressed }) => ({
        opacity: pressed ? 0.72 : undefined,
        transform: [{ translateY: pressed ? 1 : 0 }],
      })}
    >
      <Text
        className={
          match
            ? 'font-mono text-xl font-bold text-paper'
            : 'font-mono text-xl font-bold text-blue-dark'
        }
      >
        ⚙
      </Text>
    </Pressable>
  );
}

/** Controlled settings modal; each screen reserves its own top-right trigger slot. */
export function SettingsOverlay({
  open,
  glossary,
  glossaryOpen,
  privacySupportOpen,
  volume,
  reduceMotion,
  hudSide,
  hapticsEnabled,
  textScale,
  language,
  onCycleLanguage,
  highContrast,
  colorSafeKits,
  cutInMode,
  performanceLimited = false,
  developerMode,
  assistantMode,
  onSetAssistantMode,
  accessibilityCopy,
  hallOfFame,
  hallOfFameOpen = false,
  onHallOfFameOpenChange,
  difficultyLabel,
  saveError,
  onEmailSupport,
  onVolumeChange,
  onToggleReduceMotion,
  onToggleHudSide,
  onToggleHaptics,
  onCycleTextScale,
  onToggleHighContrast,
  onToggleColorSafeKits,
  onToggleCutInMode,
  onRetry3x,
  onToggleDeveloperMode,
  onGlossaryOpenChange,
  onPrivacySupportOpenChange,
  onOpenChange,
}: SettingsOverlayProps) {
  const t = useCopy();
  // `difficultyLabel` is the career's own difficulty CODE, not copy — the same
  // two values are compared in `src/game`. It is mapped to a catalog name here
  // rather than drawn raw, so the code stays a code.
  const difficultyName =
    difficultyLabel === undefined
      ? undefined
      : t(
          difficultyLabel === 'COZY'
            ? 'settings.difficulty.cozy'
            : 'settings.difficulty.chairman',
        );
  const hudSideName = t(
    hudSide === 'left' ? 'settings.matchInfo.left' : 'settings.matchInfo.right',
  );
  const setOpenState = (next: boolean) => {
    if (!next) onPrivacySupportOpenChange(false);
    onOpenChange(next);
  };
  // Both sub-pages want the wider panel: a record read in a column two words
  // across is not a record anybody reads.
  const subPageOpen =
    privacySupportOpen ||
    glossaryOpen ||
    (hallOfFameOpen && hallOfFame !== undefined);

  return (
    <Modal
      visible={open}
      transparent
      animationType={reduceMotion ? 'none' : 'fade'}
      onRequestClose={() => setOpenState(false)}
    >
      <View
        className="flex-1 items-center justify-center px-6"
        style={{ backgroundColor: 'rgba(36,31,46,0.55)' }}
      >
        <Pressable
          accessible={false}
          className="absolute inset-0"
          onPress={() => setOpenState(false)}
        />
        {/* The panel is a sibling of the backdrop so taps and accessibility
              focus on its controls never bubble into the close target. */}
        <View
          accessible={false}
          accessibilityViewIsModal
          importantForAccessibility="yes"
          className={
            subPageOpen
              ? 'w-full max-w-lg border-2 border-b-4 border-ink bg-paper p-5'
              : 'w-full max-w-sm border-2 border-b-4 border-ink bg-paper p-5'
          }
          style={{ height: '88%' }}
        >
          {privacySupportOpen ? (
            <PrivacySupportPanel
              onBack={() => onPrivacySupportOpenChange(false)}
              onEmailSupport={onEmailSupport}
              supportError={saveError}
            />
          ) : glossaryOpen ? (
            <GlossaryPanel
              content={glossary}
              onBack={() => onGlossaryOpenChange(false)}
            />
          ) : hallOfFameOpen && hallOfFame !== undefined ? (
            <HallOfFameScreen
              viewModel={hallOfFame}
              onBack={() => onHallOfFameOpenChange?.(false)}
            />
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 4 }}
            >
              <Text className="font-pixel text-2xl uppercase text-ink">
                {t('settings.title')}
              </Text>
              {accessibilityCopy ? (
                <View className="mt-3 border-2 border-blue-dark bg-blue-light px-3 py-2">
                  <PixelText className="text-sm uppercase text-blue-dark">
                    {accessibilityCopy.title}
                  </PixelText>
                  <Text className="mt-1 text-sm leading-5 text-ink/65">
                    {accessibilityCopy.body}
                  </Text>
                </View>
              ) : null}
              {saveError ? (
                <View
                  accessible
                  accessibilityRole="alert"
                  accessibilityLiveRegion="assertive"
                  className="mt-4 border-2 border-stamp bg-red-light px-3 py-2"
                >
                  <Text className="text-sm font-bold leading-5 text-ink">
                    {saveError}
                  </Text>
                </View>
              ) : null}
              <View className="my-4 h-0.5 bg-ink/15" />
              {difficultyName ? (
                <View
                  accessible
                  accessibilityRole="text"
                  accessibilityLabel={t('settings.difficulty.a11y', {
                    level: difficultyName,
                  })}
                  className="mb-4 flex-row items-center justify-between border-2 border-gold-dark bg-gold-light px-3 py-2"
                >
                  <Text className="font-pixel text-sm uppercase text-ink">
                    {t('settings.difficulty.title')}
                  </Text>
                  <Text className="font-pixel text-base text-gold-dark">
                    {difficultyName}
                  </Text>
                </View>
              ) : null}
              <VolumeSlider value={volume} onChange={onVolumeChange} />
              <View className="mt-5 gap-3 border-t border-ink/15 pt-5">
                {developerMode !== undefined &&
                onToggleDeveloperMode !== undefined ? (
                  <Pressable
                    accessibilityRole="switch"
                    accessibilityLabel={t('settings.developerMode.label')}
                    accessibilityState={{ checked: developerMode }}
                    onPress={onToggleDeveloperMode}
                    className={
                      developerMode
                        ? 'min-h-12 flex-row items-center justify-between border-2 border-gold-dark bg-gold-light px-3 py-2'
                        : 'min-h-12 flex-row items-center justify-between border-2 border-ink bg-paper-dark px-3 py-2'
                    }
                  >
                    <Text className="font-pixel text-sm uppercase text-ink">
                      {t('settings.developerMode.label')}
                    </Text>
                    <Text className="font-pixel text-base text-ink">
                      {t(developerMode ? 'settings.on' : 'settings.off')}
                    </Text>
                  </Pressable>
                ) : null}
                <Pressable
                  accessibilityRole="switch"
                  accessibilityLabel={t('settings.reduceMotion.label')}
                  accessibilityState={{ checked: reduceMotion }}
                  onPress={onToggleReduceMotion}
                  className={
                    reduceMotion
                      ? 'min-h-12 flex-row items-center justify-between border-2 border-ink bg-blue-light px-3 py-2'
                      : 'min-h-12 flex-row items-center justify-between border-2 border-ink bg-paper-dark px-3 py-2'
                  }
                >
                  <Text className="font-pixel text-sm uppercase text-ink">
                    {t('settings.reduceMotion.label')}
                  </Text>
                  <Text className="font-pixel text-base text-ink">
                    {t(reduceMotion ? 'settings.on' : 'settings.off')}
                  </Text>
                </Pressable>
                {performanceLimited && onRetry3x !== undefined ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('settings.performance.retryA11y')}
                    onPress={onRetry3x}
                    className="min-h-12 flex-row items-center justify-between border-2 border-blue-dark bg-blue-light px-3 py-2"
                  >
                    <Text className="font-pixel text-sm uppercase text-ink">
                      {t('settings.performance.label')}
                    </Text>
                    <Text className="font-pixel text-sm text-blue-dark">
                      {t('settings.performance.try3x')}
                    </Text>
                  </Pressable>
                ) : null}
                <Pressable
                  accessibilityRole="switch"
                  accessibilityLabel={t('settings.haptics.label')}
                  accessibilityState={{ checked: hapticsEnabled }}
                  onPress={onToggleHaptics}
                  className={
                    hapticsEnabled
                      ? 'min-h-12 flex-row items-center justify-between border-2 border-ink bg-blue-light px-3 py-2'
                      : 'min-h-12 flex-row items-center justify-between border-2 border-ink bg-paper-dark px-3 py-2'
                  }
                >
                  <Text className="font-pixel text-sm uppercase text-ink">
                    {t('settings.haptics.label')}
                  </Text>
                  <Text className="font-pixel text-base text-ink">
                    {t(hapticsEnabled ? 'settings.on' : 'settings.off')}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('settings.textSize.a11y', {
                    percent: Math.round(textScale * 100),
                  })}
                  onPress={onCycleTextScale}
                  className="min-h-12 flex-row items-center justify-between border-2 border-ink bg-paper-dark px-3 py-2"
                >
                  <Text className="font-pixel text-sm uppercase text-ink">
                    {t('settings.textSize.label')}
                  </Text>
                  <Text className="font-pixel text-base text-blue-dark">
                    {t(
                      textScale === 1
                        ? 'settings.textSize.system'
                        : textScale === 1.15
                          ? 'settings.textSize.roomy'
                          : 'settings.textSize.large',
                    )}
                  </Text>
                </Pressable>
                {/* Hidden while one language has shipped: a row that cycles
                  through a single option is a control that does nothing. It
                  appears as soon as a second locale is enabled. The value draws
                  in that language's own face, because the endonyms are exactly
                  the strings the active face may not have glyphs for. */}
                {ENABLED_LOCALES.length > 1 ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('settings.language.a11y', {
                      language: localeMeta(language).endonym,
                    })}
                    onPress={onCycleLanguage}
                    className="min-h-12 flex-row items-center justify-between border-2 border-ink bg-paper-dark px-3 py-2"
                  >
                    <Text className="font-pixel text-sm uppercase text-ink">
                      {t('settings.language.title')}
                    </Text>
                    <Text
                      className="text-base text-blue-dark"
                      style={{ fontFamily: localeMeta(language).faces.display }}
                    >
                      {localeMeta(language).endonym}
                    </Text>
                  </Pressable>
                ) : null}
                {assistantMode !== undefined &&
                onSetAssistantMode !== undefined ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t(
                      assistantMode === 'teacher'
                        ? 'settings.assistant.a11y.teaching'
                        : 'settings.assistant.a11y.advising',
                    )}
                    onPress={() =>
                      onSetAssistantMode(
                        assistantMode === 'teacher' ? 'advisor' : 'teacher',
                      )
                    }
                    className={
                      assistantMode === 'teacher'
                        ? 'min-h-12 flex-row items-center justify-between border-2 border-ink bg-blue-light px-3 py-2'
                        : 'min-h-12 flex-row items-center justify-between border-2 border-ink bg-paper-dark px-3 py-2'
                    }
                  >
                    <Text className="font-pixel text-sm uppercase text-ink">
                      {t('settings.assistant.label')}
                    </Text>
                    <Text className="font-pixel text-base uppercase text-blue-dark">
                      {t(
                        assistantMode === 'teacher'
                          ? 'settings.assistant.teacher'
                          : 'settings.assistant.advisor',
                      )}
                    </Text>
                  </Pressable>
                ) : null}
                <Pressable
                  accessibilityRole="switch"
                  accessibilityLabel={t('settings.highContrast.label')}
                  accessibilityState={{ checked: highContrast }}
                  onPress={onToggleHighContrast}
                  className={
                    highContrast
                      ? 'min-h-12 flex-row items-center justify-between border-2 border-ink bg-blue-light px-3 py-2'
                      : 'min-h-12 flex-row items-center justify-between border-2 border-ink bg-paper-dark px-3 py-2'
                  }
                >
                  <Text className="font-pixel text-sm uppercase text-ink">
                    {t('settings.highContrast.label')}
                  </Text>
                  <Text className="font-pixel text-base text-ink">
                    {t(highContrast ? 'settings.on' : 'settings.off')}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="switch"
                  accessibilityLabel={t('settings.colorSafeKits.label')}
                  accessibilityState={{ checked: colorSafeKits }}
                  onPress={onToggleColorSafeKits}
                  className={
                    colorSafeKits
                      ? 'min-h-12 flex-row items-center justify-between border-2 border-ink bg-blue-light px-3 py-2'
                      : 'min-h-12 flex-row items-center justify-between border-2 border-ink bg-paper-dark px-3 py-2'
                  }
                >
                  <Text className="font-pixel text-sm uppercase text-ink">
                    {t('settings.colorSafeKits.label')}
                  </Text>
                  <Text className="font-pixel text-base text-ink">
                    {t(colorSafeKits ? 'settings.on' : 'settings.off')}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('settings.powerLabels.a11y', {
                    mode: t(
                      cutInMode === 'full'
                        ? 'settings.powerLabels.a11yPlayerCard'
                        : 'settings.powerLabels.a11yBanner',
                    ),
                  })}
                  onPress={onToggleCutInMode}
                  className="min-h-12 flex-row items-center justify-between border-2 border-ink bg-paper-dark px-3 py-2"
                >
                  <Text className="font-pixel text-sm uppercase text-ink">
                    {t('settings.powerLabels.label')}
                  </Text>
                  <Text className="font-pixel text-base uppercase text-blue-dark">
                    {t(
                      cutInMode === 'full'
                        ? 'settings.powerLabels.player'
                        : 'settings.powerLabels.banner',
                    )}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  // `hudSide` is a persisted code ('left' | 'right'), so the name
                  // is looked up rather than drawn — the same sentence the title
                  // screen speaks, from the same key.
                  accessibilityLabel={t(
                    'titleLanding.a11y.matchInfoPanelSide',
                    { side: hudSideName },
                  )}
                  onPress={onToggleHudSide}
                  className="min-h-12 flex-row items-center justify-between border-2 border-ink bg-paper-dark px-3 py-2"
                >
                  <Text className="font-pixel text-sm uppercase text-ink">
                    {t('settings.matchInfo.label')}
                  </Text>
                  <Text className="font-pixel text-base uppercase text-blue-dark">
                    {hudSideName}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('settings.glossary.open')}
                  onPress={() => onGlossaryOpenChange(true)}
                  className="min-h-12 flex-row items-center justify-between border-2 border-ink bg-paper-dark px-3 py-2"
                >
                  <Text className="font-pixel text-sm uppercase text-ink">
                    {t('settings.glossary.label')}
                  </Text>
                  <Text className="font-pixel text-base text-blue-dark">
                    {t('settings.glossary.value')}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('settings.privacy.open')}
                  onPress={() => onPrivacySupportOpenChange(true)}
                  className="min-h-12 flex-row items-center justify-between border-2 border-ink bg-paper-dark px-3 py-2"
                >
                  <Text className="font-pixel text-sm uppercase text-ink">
                    {t('settings.privacy.label')}
                  </Text>
                  <Text className="font-pixel text-base text-blue-dark">
                    {t('settings.privacy.value')}
                  </Text>
                </Pressable>
                {hallOfFame === undefined ? null : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t(
                      hallOfFame.status === 'complete'
                        ? 'settings.hallOfFame.a11y.open'
                        : 'settings.hallOfFame.a11y.locked',
                    )}
                    onPress={() => onHallOfFameOpenChange?.(true)}
                    className="min-h-12 flex-row items-center justify-between border-2 border-ink bg-paper-dark px-3 py-2"
                  >
                    <Text className="font-pixel text-sm uppercase text-ink">
                      {t('settings.hallOfFame.label')}
                    </Text>
                    {/* Says which it is before it is opened, and opens either way:
                      the locked page is what explains what finishes the climb. */}
                    <Text className="font-pixel text-base uppercase text-blue-dark">
                      {t(
                        hallOfFame.status === 'complete'
                          ? 'settings.hallOfFame.record'
                          : 'settings.hallOfFame.locked',
                      )}
                    </Text>
                  </Pressable>
                )}
              </View>
              <View className="mt-6">
                <ActionButton
                  label={t('settings.done')}
                  accessibilityLabel={t('settings.close')}
                  onPress={() => setOpenState(false)}
                  variant="primary"
                />
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}
