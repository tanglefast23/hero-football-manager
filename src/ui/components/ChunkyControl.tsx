import type { ComponentProps, ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { SfxPressable } from './SfxPressable';

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

export type ChunkyControlTone =
  'primary' | 'confirm' | 'action' | 'hero' | 'danger' | 'paper';

/** One authored face/highlight/lip recipe for every chunky control. */
export const CHUNKY_CONTROL_RAMP: Readonly<
  Record<
    ChunkyControlTone,
    { face: string; light: string; lip: string; text: string }
  >
> = Object.freeze({
  primary: {
    face: 'bg-blue',
    light: 'bg-blue-light',
    lip: 'bg-blue-dark',
    text: 'text-ink',
  },
  confirm: {
    face: 'bg-blue',
    light: 'bg-blue-light',
    lip: 'bg-blue-dark',
    text: 'text-ink',
  },
  action: {
    face: 'bg-blue',
    light: 'bg-blue-light',
    lip: 'bg-blue-dark',
    text: 'text-ink',
  },
  hero: {
    face: 'bg-gold',
    light: 'bg-gold-light',
    lip: 'bg-gold-dark',
    text: 'text-ink',
  },
  danger: {
    face: 'bg-red-dark',
    light: 'bg-red',
    lip: 'bg-ink',
    text: 'text-paper',
  },
  paper: {
    face: 'bg-paper',
    light: 'bg-white',
    lip: 'bg-paper-dark',
    text: 'text-ink',
  },
});

type BaseProps = Omit<
  ComponentProps<typeof SfxPressable>,
  'children' | 'style'
>;

export interface ChunkyControlProps extends BaseProps {
  children: ReactNode;
  tone?: ChunkyControlTone;
  compact?: boolean;
  square?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Shared chunky control: hard outline, top highlight, compressed bottom lip,
 * 44-point target, and the shared press-down feedback from SfxPressable.
 */
export function ChunkyControl({
  children,
  tone = 'primary',
  compact = false,
  square = false,
  disabled = false,
  className,
  style,
  ...props
}: ChunkyControlProps) {
  const ramp = disabled
    ? { face: 'bg-grey', light: 'bg-grey-light', lip: 'bg-grey-dark' }
    : CHUNKY_CONTROL_RAMP[tone];

  return (
    <SfxPressable
      {...props}
      disabled={disabled}
      className={cx(
        'relative min-h-12 justify-center overflow-hidden border-2 border-ink',
        square ? 'rounded-none' : 'rounded-lg',
        compact ? 'py-2' : 'py-3',
        ramp.face,
        disabled && 'opacity-60',
        className,
      )}
      style={[{ minHeight: 44 }, style]}
    >
      {({ pressed }) => (
        <>
          {!pressed && !disabled ? (
            <View
              pointerEvents="none"
              className={cx(
                'absolute inset-x-0 top-0',
                compact ? 'h-3' : 'h-5',
                ramp.light,
              )}
            />
          ) : null}
          <View
            pointerEvents="none"
            className={cx('absolute inset-x-0 bottom-0 h-2', ramp.lip)}
          />
          {children}
        </>
      )}
    </SfxPressable>
  );
}
