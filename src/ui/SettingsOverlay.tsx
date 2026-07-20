import { useRef } from 'react';
import { Modal, PanResponder, Text, View } from 'react-native';
import { ActionButton } from './components/Scorecard';
import { SfxPressable as Pressable } from './components/SfxPressable';
import { adjustDevVolume, DEV_VOLUME_LEVELS, devVolumePercent, type DevVolume } from '../render/dev-volume';
import type { HudSide } from '../persistence';

/** Snap a raw 0–1 gesture position to the nearest supported volume level. */
function snapVolume(raw: number): DevVolume {
  const clamped = Math.max(0, Math.min(1, raw));
  let nearest: DevVolume = DEV_VOLUME_LEVELS[0];
  for (const level of DEV_VOLUME_LEVELS) {
    if (Math.abs(level - clamped) < Math.abs(nearest - clamped)) nearest = level;
  }
  return nearest;
}

/** A chunky pixel volume slider — track + violet fill + thumb, draggable via PanResponder. */
function VolumeSlider({ value, onChange }: { value: DevVolume; onChange: (v: DevVolume) => void }) {
  const widthRef = useRef(0);
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: e => {
        if (widthRef.current > 0) onChange(snapVolume(e.nativeEvent.locationX / widthRef.current));
      },
      onPanResponderMove: e => {
        if (widthRef.current > 0) onChange(snapVolume(e.nativeEvent.locationX / widthRef.current));
      },
    }),
  ).current;
  const pct = `${value * 100}%` as const;

  return (
    <View>
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="font-mono text-base font-bold uppercase text-ink/60">Volume</Text>
        <Text className="font-mono text-lg font-bold text-ink">{devVolumePercent(value)}%</Text>
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
        }}
        className="h-12 justify-center"
      >
        <View className="h-5 justify-center overflow-hidden rounded-full border-2 border-ink bg-grey-light">
          <View className="h-full bg-violet" style={{ width: pct }} />
        </View>
        <View
          pointerEvents="none"
          className="absolute top-2.5 -ml-4 h-7 w-7 rounded-full border-2 border-b-4 border-ink bg-violet-light"
          style={{ left: pct }}
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
  volume: DevVolume;
  reduceMotion: boolean;
  hudSide: HudSide;
  saveError?: string | null;
  onVolumeChange: (v: DevVolume) => void;
  onToggleReduceMotion: () => void;
  onToggleHudSide: () => void;
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
  volume,
  reduceMotion,
  hudSide,
  saveError,
  onVolumeChange,
  onToggleReduceMotion,
  onToggleHudSide,
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close settings"
          className="flex-1 items-center justify-center px-6"
          style={{ backgroundColor: 'rgba(36,31,46,0.55)' }}
          onPress={() => setOpenState(false)}
        >
          {/* stop taps inside the panel from closing the modal */}
          <Pressable className="w-full max-w-sm border-2 border-b-4 border-ink bg-paper p-5" onPress={() => {}}>
            <Text className="font-pixel text-2xl uppercase text-ink">Settings</Text>
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
            <VolumeSlider value={volume} onChange={onVolumeChange} />
            <View className="mt-5 gap-3 border-t border-ink/15 pt-5">
              <Pressable
                accessibilityRole="switch"
                accessibilityLabel="Reduce motion"
                accessibilityState={{ checked: reduceMotion }}
                onPress={onToggleReduceMotion}
                className={reduceMotion
                  ? 'min-h-12 flex-row items-center justify-between border-2 border-ink bg-violet-light px-3 py-2'
                  : 'min-h-12 flex-row items-center justify-between border-2 border-ink bg-paper-dark px-3 py-2'}
              >
                <Text className="font-mono text-sm font-bold uppercase text-ink">Reduce motion</Text>
                <Text className="font-mono text-base font-bold text-ink">{reduceMotion ? 'ON' : 'OFF'}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Match information HUD on the ${hudSide}. Tap to move it.`}
                onPress={onToggleHudSide}
                className="min-h-12 flex-row items-center justify-between border-2 border-ink bg-paper-dark px-3 py-2"
              >
                <Text className="font-mono text-sm font-bold uppercase text-ink">Match HUD</Text>
                <Text className="font-mono text-base font-bold uppercase text-violet-dark">{hudSide}</Text>
              </Pressable>
            </View>
            <View className="mt-6">
              <ActionButton label="Done" accessibilityLabel="Close settings" onPress={() => setOpenState(false)} variant="primary" />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
  );
}
