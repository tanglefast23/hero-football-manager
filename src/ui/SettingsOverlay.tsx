import { useRef, useState } from 'react';
import { Modal, PanResponder, Pressable, Text, View } from 'react-native';
import { ActionButton } from './components/Scorecard';
import { DEV_VOLUME_LEVELS, devVolumePercent, type DevVolume } from '../render/dev-volume';

/** Snap a raw 0–1 gesture position to the nearest supported volume level. */
function snapVolume(raw: number): DevVolume {
  const clamped = Math.max(0, Math.min(1, raw));
  let nearest: DevVolume = DEV_VOLUME_LEVELS[0];
  for (const level of DEV_VOLUME_LEVELS) {
    if (Math.abs(level - clamped) < Math.abs(nearest - clamped)) nearest = level;
  }
  return nearest;
}

/** A chunky pixel volume slider — track + gold fill + thumb, draggable via PanResponder. */
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
        {...responder.panHandlers}
        onLayout={e => {
          widthRef.current = e.nativeEvent.layout.width;
        }}
        className="h-10 justify-center"
      >
        <View className="h-5 justify-center overflow-hidden rounded-full border-2 border-ink bg-grey-light">
          <View className="h-full bg-gold" style={{ width: pct }} />
        </View>
        <View
          pointerEvents="none"
          className="absolute top-1.5 -ml-4 h-7 w-7 rounded-full border-2 border-b-4 border-ink bg-gold-light"
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
  volume: DevVolume;
  onVolumeChange: (v: DevVolume) => void;
  onOpenChange?: (open: boolean) => void;
}

/** Global top-left settings button + its modal. Rendered once, appears on every screen. */
export function SettingsOverlay({ volume, onVolumeChange, onOpenChange }: SettingsOverlayProps) {
  const [open, setOpen] = useState(false);
  const setOpenState = (next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open settings"
        hitSlop={8}
        onPress={() => setOpenState(true)}
        className="absolute left-3 top-14 h-11 w-11 items-center justify-center rounded-lg border-2 border-b-4 border-ink bg-paper"
        style={({ pressed }) => ({ opacity: pressed ? 0.8 : undefined, transform: [{ translateY: pressed ? 1 : 0 }] })}
      >
        <Text className="text-xl">⚙︎</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpenState(false)}>
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
            <View className="my-4 h-0.5 bg-ink/15" />
            <VolumeSlider value={volume} onChange={onVolumeChange} />
            <View className="mt-6">
              <ActionButton label="Done" accessibilityLabel="Close settings" onPress={() => setOpenState(false)} variant="primary" />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
