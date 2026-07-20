import type { ComponentProps } from 'react';
import { Pressable as NativePressable } from 'react-native';
import { playUiClickSfx } from '../../render/management-sfx';

type NativePressableProps = ComponentProps<typeof NativePressable>;

/**
 * Shared management interaction surface. It gives every custom button/card a
 * short tap cue and a visible pressed state while preserving its own styles.
 */
export function SfxPressable({ onPress, style, ...props }: NativePressableProps) {
  return (
    <NativePressable
      {...props}
      onPress={onPress == null ? undefined : event => {
        playUiClickSfx();
        onPress(event);
      }}
      style={state => [
        typeof style === 'function' ? style(state) : style,
        state.pressed ? { opacity: 0.7 } : undefined,
      ]}
    />
  );
}
