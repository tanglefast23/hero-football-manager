import { useRef, useState } from 'react';
import { Modal, PanResponder, ScrollView, Text, View } from 'react-native';
import { ActionButton } from './components/Scorecard';
import { SfxPressable as Pressable } from './components/SfxPressable';
import { adjustDevVolume, DEV_VOLUME_LEVELS, devVolumePercent, type DevVolume } from '../render/dev-volume';
import type { CutInMode, HudSide, TextScale } from '../persistence';
import type { GlossaryCatalog } from '../content';
import { GlossaryPanel } from './GlossaryPanel';
import { volumeThumbLeft } from './volume-slider-thumb';
import { PixelText } from './components/PixelText';

/** Snap a raw 0–1 gesture position to the nearest supported volume level. */
function snapVolume(raw: number): DevVolume {
  const clamped = Math.max(0, Math.min(1, raw));
  let nearest: DevVolume = DEV_VOLUME_LEVELS[0];
  for (const level of DEV_VOLUME_LEVELS) {
    if (Math.abs(level - clamped) < Math.abs(nearest - clamped)) nearest = level;
  }
  return nearest;
}

/** A chunky pixel volume slider — track + blue fill + thumb, draggable via PanResponder. */
function VolumeSlider({ value, onChange }: { value: DevVolume; onChange: (v: DevVolume) => void }) {
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
      onPanResponderGrant: e => commit(e.nativeEvent.locationX),
      onPanResponderMove: e => commit(e.nativeEvent.locationX),
    }),
  ).current;
  const pct = `${value * 100}%` as const;

  return (
    <View>
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="font-pixel text-base uppercase text-ink/60">Volume</Text>
        <Text className="font-mono text-lg text-ink">{devVolumePercent(value)}%</Text>
      </View>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Master volume"
        accessibilityHint="Swipe up or down to adjust in 25 percent steps"
        accessibilityValue={{ min: 0, max: 100, now: devVolumePercent(value), text: `${devVolumePercent(value)} percent` }}
        accessibilityActions={[
          { name: 'increment', label: 'Increase volume' },
          { name: 'decrement', label: 'Decrease volume' },
        ]}
        onAccessibilityAction={event => {
          if (event.nativeEvent.actionName === 'increment' || event.nativeEvent.actionName === 'decrement') {
            onChange(adjustDevVolume(value, event.nativeEvent.actionName));
          }
        }}
        {...responder.panHandlers}
        onLayout={e => {
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
        {DEV_VOLUME_LEVELS.map(level => (
          <Text key={level} className="font-mono text-xs text-ink/40">{level * 100}</Text>
        ))}
      </View>
    </View>
  );
}

export interface SettingsOverlayProps {
  open: boolean;
  glossary: GlossaryCatalog;
  glossaryOpen: boolean;
  volume: DevVolume;
  reduceMotion: boolean;
  hudSide: HudSide;
  hapticsEnabled: boolean;
  textScale: TextScale;
  highContrast: boolean;
  colorSafeKits: boolean;
  cutInMode: CutInMode;
  accessibilityCopy?: { title: string; body: string };
  difficultyLabel?: 'COZY' | 'CHAIRMAN';
  saveError?: string | null;
  onVolumeChange: (v: DevVolume) => void;
  onToggleReduceMotion: () => void;
  onToggleHudSide: () => void;
  onToggleHaptics: () => void;
  onCycleTextScale: () => void;
  onToggleHighContrast: () => void;
  onToggleColorSafeKits: () => void;
  onToggleCutInMode: () => void;
  onGlossaryOpenChange: (open: boolean) => void;
  onOpenChange: (open: boolean) => void;
}

export function SettingsButton({
  onPress,
  variant = 'paper',
}: {
  onPress: () => void;
  variant?: 'paper' | 'match';
}) {
  const match = variant === 'match';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open settings"
      hitSlop={8}
      onPress={onPress}
      className={match
        ? 'h-11 w-11 items-center justify-center rounded border-2 border-b-4 border-ink bg-ink-soft'
        : 'h-11 w-11 items-center justify-center border-2 border-b-4 border-ink bg-white'}
      style={({ pressed }) => ({
        opacity: pressed ? 0.72 : undefined,
        transform: [{ translateY: pressed ? 1 : 0 }],
      })}
    >
      <Text className={match ? 'font-mono text-xl font-bold text-paper' : 'font-mono text-xl font-bold text-blue-dark'}>⚙</Text>
    </Pressable>
  );
}

/** Controlled settings modal; each screen reserves its own top-right trigger slot. */
export function SettingsOverlay({
  open,
  glossary,
  glossaryOpen,
  volume,
  reduceMotion,
  hudSide,
  hapticsEnabled,
  textScale,
  highContrast,
  colorSafeKits,
  cutInMode,
  accessibilityCopy,
  difficultyLabel,
  saveError,
  onVolumeChange,
  onToggleReduceMotion,
  onToggleHudSide,
  onToggleHaptics,
  onCycleTextScale,
  onToggleHighContrast,
  onToggleColorSafeKits,
  onToggleCutInMode,
  onGlossaryOpenChange,
  onOpenChange,
}: SettingsOverlayProps) {
  const setOpenState = (next: boolean) => {
    onOpenChange(next);
  };

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
            className={glossaryOpen
              ? 'w-full max-w-lg border-2 border-b-4 border-ink bg-paper p-5'
              : 'w-full max-w-sm border-2 border-b-4 border-ink bg-paper p-5'}
            style={{ height: '88%' }}
          >
            {glossaryOpen ? (
              <GlossaryPanel content={glossary} onBack={() => onGlossaryOpenChange(false)} />
            ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 4 }}>
            <Text className="font-pixel text-2xl uppercase text-ink">Settings</Text>
            {accessibilityCopy ? (
              <View className="mt-3 border-2 border-blue-dark bg-blue-light px-3 py-2">
                <PixelText className="text-sm uppercase text-blue-dark">{accessibilityCopy.title}</PixelText>
                <Text className="mt-1 text-sm leading-5 text-ink/65">{accessibilityCopy.body}</Text>
              </View>
            ) : null}
            {saveError ? (
              <View
                accessible
                accessibilityRole="alert"
                accessibilityLiveRegion="assertive"
                className="mt-4 border-2 border-stamp bg-red-light px-3 py-2"
              >
                <Text className="text-sm font-bold leading-5 text-ink">{saveError}</Text>
              </View>
            ) : null}
            <View className="my-4 h-0.5 bg-ink/15" />
            {difficultyLabel ? (
              <View accessible accessibilityRole="text" accessibilityLabel={`Career difficulty ${difficultyLabel}`} className="mb-4 flex-row items-center justify-between border-2 border-gold-dark bg-gold-light px-3 py-2">
                <Text className="font-pixel text-sm uppercase text-ink">Career difficulty</Text>
                <Text className="font-pixel text-base text-gold-dark">{difficultyLabel}</Text>
              </View>
            ) : null}
            <VolumeSlider value={volume} onChange={onVolumeChange} />
            <View className="mt-5 gap-3 border-t border-ink/15 pt-5">
              <Pressable
                accessibilityRole="switch"
                accessibilityLabel="Reduce motion"
                accessibilityState={{ checked: reduceMotion }}
                onPress={onToggleReduceMotion}
                className={reduceMotion
                  ? 'min-h-12 flex-row items-center justify-between border-2 border-ink bg-blue-light px-3 py-2'
                  : 'min-h-12 flex-row items-center justify-between border-2 border-ink bg-paper-dark px-3 py-2'}
              >
                <Text className="font-pixel text-sm uppercase text-ink">Reduce motion</Text>
                <Text className="font-pixel text-base text-ink">{reduceMotion ? 'ON' : 'OFF'}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="switch"
                accessibilityLabel="Haptics"
                accessibilityState={{ checked: hapticsEnabled }}
                onPress={onToggleHaptics}
                className={hapticsEnabled ? 'min-h-12 flex-row items-center justify-between border-2 border-ink bg-blue-light px-3 py-2' : 'min-h-12 flex-row items-center justify-between border-2 border-ink bg-paper-dark px-3 py-2'}
              >
                <Text className="font-pixel text-sm uppercase text-ink">Haptics</Text>
                <Text className="font-pixel text-base text-ink">{hapticsEnabled ? 'ON' : 'OFF'}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`Text size ${Math.round(textScale * 100)} percent`} onPress={onCycleTextScale} className="min-h-12 flex-row items-center justify-between border-2 border-ink bg-paper-dark px-3 py-2">
                <Text className="font-pixel text-sm uppercase text-ink">Text size</Text>
                <Text className="font-pixel text-base text-blue-dark">{textScale === 1 ? 'SYSTEM' : textScale === 1.15 ? 'ROOMY' : 'LARGE'}</Text>
              </Pressable>
              <Pressable accessibilityRole="switch" accessibilityLabel="High contrast" accessibilityState={{ checked: highContrast }} onPress={onToggleHighContrast} className={highContrast ? 'min-h-12 flex-row items-center justify-between border-2 border-ink bg-blue-light px-3 py-2' : 'min-h-12 flex-row items-center justify-between border-2 border-ink bg-paper-dark px-3 py-2'}>
                <Text className="font-pixel text-sm uppercase text-ink">High contrast</Text><Text className="font-pixel text-base text-ink">{highContrast ? 'ON' : 'OFF'}</Text>
              </Pressable>
              <Pressable accessibilityRole="switch" accessibilityLabel="Color-safe kits" accessibilityState={{ checked: colorSafeKits }} onPress={onToggleColorSafeKits} className={colorSafeKits ? 'min-h-12 flex-row items-center justify-between border-2 border-ink bg-blue-light px-3 py-2' : 'min-h-12 flex-row items-center justify-between border-2 border-ink bg-paper-dark px-3 py-2'}>
                <Text className="font-pixel text-sm uppercase text-ink">Color-safe kits</Text><Text className="font-pixel text-base text-ink">{colorSafeKits ? 'ON' : 'OFF'}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`Power labels ${cutInMode === 'full' ? 'player card' : 'banner'}`} onPress={onToggleCutInMode} className="min-h-12 flex-row items-center justify-between border-2 border-ink bg-paper-dark px-3 py-2">
                <Text className="font-pixel text-sm uppercase text-ink">Power labels</Text><Text className="font-pixel text-base uppercase text-blue-dark">{cutInMode === 'full' ? 'PLAYER' : 'BANNER'}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Match information panel is on the ${hudSide}. Tap to move it.`}
                onPress={onToggleHudSide}
                className="min-h-12 flex-row items-center justify-between border-2 border-ink bg-paper-dark px-3 py-2"
              >
                <Text className="font-pixel text-sm uppercase text-ink">Match info</Text>
                <Text className="font-pixel text-base uppercase text-blue-dark">{hudSide}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open glossary"
                onPress={() => onGlossaryOpenChange(true)}
                className="min-h-12 flex-row items-center justify-between border-2 border-ink bg-paper-dark px-3 py-2"
              >
                <Text className="font-pixel text-sm uppercase text-ink">Glossary</Text>
                <Text className="font-pixel text-base text-blue-dark">A–Z ›</Text>
              </Pressable>
            </View>
            <View className="mt-6">
              <ActionButton label="Done" accessibilityLabel="Close settings" onPress={() => setOpenState(false)} variant="primary" />
            </View>
            </ScrollView>
            )}
          </View>
        </View>
      </Modal>
  );
}
