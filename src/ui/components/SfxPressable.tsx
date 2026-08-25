import { useRef, useState, type ComponentProps, type ReactNode } from 'react';
import {
  Platform,
  Pressable as NativePressable,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import {
  playDangerSfx,
  playManagementActionSfx,
  playMatchControlSfx,
  playPositiveSfx,
  playStatStepSfx,
  playUiClickSfx,
} from '../../render/management-sfx';
import {
  createManagementFeedbackActivation,
  withManagementFeedbackActivation,
  type ManagementFeedbackActivation,
} from '../../render/management-feedback-activation';
import { hasHoverPointer } from '../pointer-capability';
import { createPressCueGate, type PressCueGate } from '../press-cue-gate';

type NativePressableProps = ComponentProps<typeof NativePressable>;
type SfxPressableProps = NativePressableProps & {
  /**
   * 'warning' is for a control that stays live so it can explain itself but
   * cannot honour the tap — an affirming click there reads as "done" when
   * nothing happened.
   */
  pressSfx?:
    'click' | 'positive' | 'danger' | 'match-control' | 'stat-step' | 'warning';
  /**
   * One short line explaining what this control does, shown on mouse hover.
   * Pointer-only by design: it never appears on a touch screen, where a tap has
   * no hover phase to open it and nothing to close it again.
   */
  tip?: string;
  /** Which side of the control the tip opens on. Defaults to above. */
  tipSide?: 'top' | 'bottom';
  /**
   * Removes react-native-web's 50ms press-in delay. It defaults on because the
   * delay made short clicks on navigation and dismiss controls feel ignored.
   * Native React Native already defaults to zero.
   */
  immediatePress?: boolean;
};

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
 * Whether the caller already moves this surface itself.
 *
 * A dozen buttons author their own press travel — the title screen's play
 * button drops 3px, the league rows 2px, the settings toggle 1px — and those
 * distances are chosen against each button's own border weight. The shared
 * depress is a floor for everything else, so it stands aside wherever a caller
 * has already said how far its surface should move.
 */
function setsTransform(style: unknown): boolean {
  if (style == null || typeof style !== 'object') return false;
  if (Array.isArray(style)) return style.some(setsTransform);
  return (style as ViewStyle).transform != null;
}

type PressCue = NonNullable<SfxPressableProps['pressSfx']>;

function playPressCue(pressSfx: PressCue): void {
  if (pressSfx === 'positive') playPositiveSfx();
  else if (pressSfx === 'danger') playDangerSfx();
  else if (pressSfx === 'stat-step') playStatStepSfx();
  else if (pressSfx === 'warning') playManagementActionSfx('warning');
  else if (pressSfx === 'match-control') playMatchControlSfx();
  else playUiClickSfx();
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
  immediatePress = true,
  style,
  children,
  disabled,
  ...props
}: SfxPressableProps) {
  const [pressed, setPressed] = useState(false);
  const [hovered, setHovered] = useState(false);
  // One gate per control, so a keyboard activation here is judged by this
  // button's own presses rather than by a tap somewhere else on the screen.
  const gateRef = useRef<PressCueGate | null>(null);
  const cueGate = (gateRef.current ??= createPressCueGate());
  const feedbackRef = useRef<ManagementFeedbackActivation | null>(null);
  const pointer = hasHoverPointer();
  const showTip =
    pointer && hovered && !pressed && tip !== undefined && tip.length > 0;

  return (
    <NativePressable
      {...props}
      {...(immediatePress && Platform.OS === 'web' ? { delayPressIn: 0 } : {})}
      disabled={disabled}
      // Left unwired without a hovering pointer, so a caller's own hover work
      // (the facilities grid previews a footprint from it) cannot latch either.
      onHoverIn={
        !pointer
          ? undefined
          : (event) => {
              setHovered(true);
              onHoverIn?.(event);
            }
      }
      onHoverOut={
        !pointer
          ? undefined
          : (event) => {
              setHovered(false);
              onHoverOut?.(event);
            }
      }
      onPressIn={(event) => {
        setPressed(true);
        const feedback = createManagementFeedbackActivation();
        feedbackRef.current = feedback;
        withManagementFeedbackActivation(feedback, () => {
          // A surface with nothing to activate has nothing to answer for, so the
          // cue lives exactly where a press handler does.
          if (onPress != null) cueGate.pressIn(() => playPressCue(pressSfx));
          onPressIn?.(event);
        });
      }}
      onPressOut={(event) => {
        // A completed press ends the hover too. A touch screen that reports a
        // hovering pointer anyway still gets no stuck tip: the synthetic hover
        // arrives with the touch, and this clears it when the finger lifts.
        setPressed(false);
        setHovered(false);
        cueGate.pressOut();
        const feedback = feedbackRef.current;
        setTimeout(() => {
          if (feedbackRef.current === feedback) feedbackRef.current = null;
        }, 0);
        onPressOut?.(event);
      }}
      onPress={
        onPress == null
          ? undefined
          : (event) => {
              const feedback =
                feedbackRef.current ?? createManagementFeedbackActivation();
              feedbackRef.current = null;
              withManagementFeedbackActivation(feedback, () => {
                cueGate.press(() => playPressCue(pressSfx));
                onPress(event);
              });
            }
      }
      style={(() => {
        const resolved =
          typeof style === 'function'
            ? style({ pressed, hovered } as Parameters<typeof style>[0])
            : style;
        return [
          tip !== undefined ? hoverTipAnchor : undefined,
          resolved,
          minimumTapTarget,
          pressed && !setsOpacity(resolved) ? { opacity: 0.7 } : undefined,
          // The press has to be felt, not just seen dimmer. Dimming alone reads
          // as "this went away"; moving the surface under the finger reads as
          // "this took the press". It lands with the touch and leaves with it,
          // so nothing is queued and nothing can be left depressed.
          pressed && !disabled && !setsTransform(resolved)
            ? pressDepress
            : undefined,
          // A mouse gets a cursor and a 1px lift so the UI stops feeling dead.
          pointer && !disabled ? pointerCursor : undefined,
          pointer && hovered && !pressed && !disabled ? hoverLift : undefined,
          showTip ? hoverTipTopLayer : undefined,
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
export function HoverTipAnchor({
  tip,
  className,
  children,
}: {
  tip?: string;
  className?: string;
  children: ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  const pointer = hasHoverPointer();
  const showTip = pointer && hovered && tip !== undefined && tip.length > 0;

  return (
    <View
      className={className}
      style={showTip ? hoverTipTopLayer : hoverTipAnchor}
      onPointerEnter={pointer ? () => setHovered(true) : undefined}
      onPointerLeave={pointer ? () => setHovered(false) : undefined}
      // Same net as the pressable above: the release of a press ends the hover,
      // so a touch that reported itself as a pointer cannot leave the tip open.
      onPointerUp={pointer ? () => setHovered(false) : undefined}
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
/**
 * The pressed surface: one pixel down, three percent smaller.
 *
 * Every management button in the game is drawn with a thick bottom border, so
 * travelling a single pixel down reads as that lip compressing — the same
 * mechanism a physical key uses. The values are deliberately small: this fires
 * on press-in and is removed on press-out with no tween, so anything larger
 * would snap rather than depress.
 */
const pressDepress: ViewStyle = {
  transform: [{ translateY: 1 }, { scale: 0.97 }],
};
const minimumTapTarget: ViewStyle = { minWidth: 44, minHeight: 44 };
const hoverTipAnchor: ViewStyle = { position: 'relative' };
// Raise the host, not only the absolute bubble. A child's z-index is trapped in
// its parent's paint order, which is why later roster text appeared over tips.
const hoverTipTopLayer: ViewStyle = { zIndex: 1000, elevation: 20 };

function HoverTip({
  text,
  side,
}: {
  text: string;
  side: 'top' | 'bottom';
}): ReactNode {
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
