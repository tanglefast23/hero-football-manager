import type { ComponentProps } from 'react';
import { Pressable as NativePressable } from 'react-native';
import { playStatStepSfx, playUiClickSfx } from '../../render/management-sfx';

type NativePressableProps = ComponentProps<typeof NativePressable>;
type SfxPressableProps = NativePressableProps & {
  pressSfx?: 'click' | 'stat-step';
};

/**
 * Shared management interaction surface. It gives every custom button/card a
 * short tap cue and a visible pressed state while preserving its own styles.
 */
export function SfxPressable({
  onPress,
  pressSfx = 'click',
  style,
  ...props
}: SfxPressableProps) {
  return (
    <NativePressable
      {...props}
      onPress={onPress == null ? undefined : event => {
        if (pressSfx === 'stat-step') playStatStepSfx();
        else playUiClickSfx();
        onPress(event);
      }}
      style={state => [
        typeof style === 'function' ? style(state) : style,
        state.pressed ? { opacity: 0.7 } : undefined,
      ]}
    />
  );
}
