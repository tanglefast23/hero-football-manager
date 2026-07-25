import { useState, type ComponentProps, type ReactNode } from 'react';
import { Platform, Pressable as NativePressable, Text, View, type ViewStyle } from 'react-native';
import { playStatStepSfx, playUiClickSfx } from '../../render/management-sfx';

type NativePressableProps = ComponentProps<typeof NativePressable>;
type SfxPressableProps = NativePressableProps & {
  pressSfx?: 'click' | 'stat-step';
  /**
   * One short line explaining what this control does, shown on mouse hover.
   * Pointer-only by design: a tap has no hover phase, so this never fires on a
   * phone and never blocks a touch.
   */
  tip?: string;
  /** Which side of the control the tip opens on. Defaults to above. */
  tipSide?: 'top' | 'bottom';
};

/**
 * Hover and cursor only exist where there is a pointer. Resolved lazily rather
 * than at module scope: several UI tests mock react-native without `Platform`,
 * and evaluating it on import would break them at load time.
 */
function hasPointer(): boolean {
  return Platform?.OS === 'web';
}

/**
 * True when a resolved style already dims the surface itself. Style arrays
 * flatten left-to-right, so the fallback dim below would otherwise silently
 * override every call site that authored its own pressed opacity.
 */
function setsOpacity(style: unknown): boolean {
  if (style == null || typeof style !== 'object') return false;
  if (Array.isArray(style)) return style.some(setsOpacity);
  return (style as ViewStyle).opacity != null;
}

/**
 * Shared management interaction surface. It gives every custom button/card a
 * short tap cue, a visible pressed state, and — on desktop — a pointer cursor,
 * a hover lift, and an optional explanatory tip, while preserving its own
 * styles.
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
  onHoverIn,
  onHoverOut,
  pressSfx = 'click',
  tip,
  tipSide = 'top',
  style,
  children,
  disabled,
  ...props
}: SfxPressableProps) {
  const [pressed, setPressed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const pointer = hasPointer();
  const showTip = pointer && hovered && !pressed && tip !== undefined && tip.length > 0;

  return (
    <NativePressable
      {...props}
      disabled={disabled}
      onHoverIn={event => {
        setHovered(true);
        onHoverIn?.(event);
      }}
      onHoverOut={event => {
        setHovered(false);
        onHoverOut?.(event);
      }}
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
      style={(() => {
        const resolved = typeof style === 'function'
          ? style({ pressed, hovered } as Parameters<typeof style>[0])
          : style;
        return [
          resolved,
          pressed && !setsOpacity(resolved) ? { opacity: 0.7 } : undefined,
          // A mouse gets a cursor and a 1px lift so the UI stops feeling dead.
          pointer && !disabled ? pointerCursor : undefined,
          pointer && hovered && !pressed && !disabled ? hoverLift : undefined,
        ];
      })()}
    >
      {typeof children === 'function'
        ? children({ pressed, hovered } as Parameters<typeof children>[0])
        : children}
      {showTip ? <HoverTip text={tip} side={tipSide} /> : null}
    </NativePressable>
  );
}

/**
 * Hover tip for a control that cannot host one itself: ActionButton clips its
 * children to keep the bevel gloss inside its rounded corners, so a tip nested
 * in it would be cut off. Wrapping it anchors the tip outside that clip.
 *
 * Pointer-only for the same reason as the tip above — a tap has no hover phase.
 */
export function HoverTipAnchor({ tip, className, children }: {
  tip?: string;
  className?: string;
  children: ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  const pointer = hasPointer();
  const showTip = pointer && hovered && tip !== undefined && tip.length > 0;

  return (
    <View
      className={className}
      onPointerEnter={pointer ? () => setHovered(true) : undefined}
      onPointerLeave={pointer ? () => setHovered(false) : undefined}
    >
      {children}
      {showTip ? <HoverTip text={tip} side="top" /> : null}
    </View>
  );
}

/**
 * `cursor` is understood by react-native-web but is not part of React Native's
 * own ViewStyle, so it is declared once here rather than cast at each use.
 */
const pointerCursor = { cursor: 'pointer' } as ViewStyle;
const hoverLift: ViewStyle = { transform: [{ translateY: -1 }] };

function HoverTip({ text, side }: { text: string; side: 'top' | 'bottom' }): ReactNode {
  return (
    <View
      pointerEvents="none"
      className={`absolute left-1/2 z-50 w-44 -translate-x-1/2 border-2 border-ink bg-ink px-2 py-1 ${
        side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
      }`}
    >
      <Text className="font-mono text-[10px] leading-4 text-paper">{text}</Text>
    </View>
  );
}
