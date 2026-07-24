import { useState, type ComponentProps } from 'react';
import { Pressable as NativePressable } from 'react-native';
import { playStatStepSfx, playUiClickSfx } from '../../render/management-sfx';

type NativePressableProps = ComponentProps<typeof NativePressable>;
type SfxPressableProps = NativePressableProps & {
  pressSfx?: 'click' | 'stat-step';
};

/**
 * Shared management interaction surface. It gives every custom button/card a
 * short tap cue and a visible pressed state while preserving its own styles.
 *
 * The pressed state is tracked with local state and the style is always
 * passed down as a plain array — NEVER as a state callback function. On
 * native, a function style bypasses NativeWind's style processing and the
 * underlying Pressable silently drops layout properties (absolute insets
 * collapse to zero height, alignment is ignored, backgrounds vanish). The
 * facilities grid was invisible and untappable on iOS because of exactly
 * that; keep this component callback-free.
 */
export function SfxPressable({
  onPress,
  onPressIn,
  onPressOut,
  pressSfx = 'click',
  style,
  ...props
}: SfxPressableProps) {
  const [pressed, setPressed] = useState(false);
  return (
    <NativePressable
      {...props}
      onPressIn={event => {
        setPressed(true);
        onPressIn?.(event);
      }}
      onPressOut={event => {
        setPressed(false);
        onPressOut?.(event);
      }}
      onPress={onPress == null ? undefined : event => {
        if (pressSfx === 'stat-step') playStatStepSfx();
        else playUiClickSfx();
        onPress(event);
      }}
      style={[
        typeof style === 'function'
          ? style({ pressed } as Parameters<typeof style>[0])
          : style,
        pressed ? { opacity: 0.7 } : undefined,
      ]}
    />
  );
}
