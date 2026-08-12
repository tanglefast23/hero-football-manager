import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { hasHoverPointer } from '../pointer-capability';
import { useGuideAnchor } from '../use-guide-anchor';
import type { TutorialAnchorLayout } from '../tutorial-cue-position';

/**
 * Long enough that an unhurried tap still counts as a tap. RN suppresses
 * onPress once onLongPress has fired, so a shorter delay would silently steal
 * taps from whatever the control does — a sort header would stop sorting for
 * anyone who presses deliberately.
 */
const TOUCH_HOLD_MS = 500;

/** A touch tip has no pointer to leave, so it retires on its own. */
const TOUCH_TIP_LINGER_MS = 4000;

/** Comfortable reading measure for one sentence at 13px. */
const TIP_WIDTH = 208;

/** Below this the bubble stops being a column-width popover and spans the screen. */
const NARROW_SCREEN_MAX_WIDTH = 600;
const NARROW_SCREEN_GUTTER = 16;

/** Clear of the anchor without losing the visual tie to it. */
const BUBBLE_ANCHOR_GAP = 4;

interface OpenInfoTip {
  text: string;
  anchor: TutorialAnchorLayout;
  align: 'left' | 'right';
  bubbleWidth: number;
  narrow: boolean;
}

/*
 * One open tip, published to a layer that renders last.
 *
 * Raising the anchor's own z-index was the previous fix and it cannot work: a
 * child's z-index is resolved inside its parent's stacking context, so a later
 * *sibling of the parent* — the contract block under the morale row — still
 * paints over the bubble no matter how high the anchor is raised. The only
 * placement that is unconditionally on top is one outside every card, which is
 * what this layer is.
 *
 * ponytail: module-scope singleton rather than a context. One window, one
 * pointer, one finger — exactly one tip can be open. Make it a context if a
 * second independent surface ever needs its own layer.
 */
let openTip: OpenInfoTip | null = null;
let openTipOwner: object | null = null;
const openTipListeners = new Set<() => void>();

function publishOpenTip(owner: object, tip: OpenInfoTip): void {
  openTipOwner = owner;
  openTip = tip;
  for (const listener of openTipListeners) listener();
}

function retractOpenTip(owner: object): void {
  // A newer tip already took the layer; its owner clears it, not this one.
  if (openTipOwner !== owner) return;
  openTipOwner = null;
  openTip = null;
  for (const listener of openTipListeners) listener();
}

function subscribeToOpenTip(listener: () => void): () => void {
  openTipListeners.add(listener);
  return () => {
    openTipListeners.delete(listener);
  };
}

const readOpenTip = () => openTip;

/**
 * Renders whichever InfoTip is open, above every screen.
 *
 * Mount exactly once, as the last child of the app's root view, so it paints
 * after all of it. It never takes a pointer event, so the control the tip
 * describes keeps working underneath.
 */
export function InfoTipLayer() {
  const tip = useSyncExternalStore(
    subscribeToOpenTip,
    readOpenTip,
    readOpenTip,
  );
  const { width } = useWindowDimensions();
  if (tip === null) return null;
  // Hangs from the anchor's near edge, then is pulled back on screen whole. A
  // tip on the last column would otherwise run off the right of a phone.
  const preferredLeft =
    tip.align === 'right'
      ? tip.anchor.x + tip.anchor.width - tip.bubbleWidth
      : tip.anchor.x;
  const left = Math.max(
    NARROW_SCREEN_GUTTER,
    Math.min(preferredLeft, width - tip.bubbleWidth - NARROW_SCREEN_GUTTER),
  );
  return (
    <View pointerEvents="none" style={styles.layer}>
      <View
        style={[
          styles.bubble,
          {
            width: tip.bubbleWidth,
            left,
            top: tip.anchor.y + tip.anchor.height + BUBBLE_ANCHOR_GAP,
          },
          tip.narrow ? styles.bubbleNarrow : null,
        ]}
      >
        <Text style={[styles.text, tip.narrow ? styles.textNarrow : null]}>
          {tip.text}
        </Text>
      </View>
    </View>
  );
}

export interface InfoTipProps {
  /** What the thing under the pointer actually means, in one sentence. */
  text: string;
  /** Read out instead of the raw label, so the explanation is not pointer-only. */
  accessibilityLabel: string;
  /** Which edge the bubble hangs from, so it never runs off a column's side. */
  align?: 'left' | 'right';
  /**
   * Applied to the anchor, not the child. A wrapped table header has to keep
   * occupying its column: without this the anchor shrinks to its text and the
   * heading drifts off the numbers it labels.
   */
  className?: string;
  /**
   * The same job as `className`, for a caller whose column width is a measured
   * number of points rather than a utility class — Tailwind's widths are rem,
   * and a rem is React Native's 14pt on native, so `w-12` is 42pt and not 48.
   */
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  onPress?: () => void;
  /**
   * Greys nothing out on its own — it only stops the tap. A control the manager
   * cannot use is still a control they may not understand, so the explanation
   * stays reachable by hold and by screen reader either way.
   */
  disabled?: boolean;
}

/**
 * A hover explanation that a touch screen can still reach.
 *
 * Hover is the desktop affordance and simply never fires on a phone, so the
 * same sentence is also available on a long press and — always — through the
 * accessibility label. A tip that only existed on hover would be a feature the
 * iOS build could not ship.
 *
 * The bubble is `pointerEvents="none"` so it can never sit between the pointer
 * and the control it is describing, which would make a sortable header stop
 * sorting the moment its own tip appeared.
 */
export function InfoTip({
  text,
  accessibilityLabel,
  align = 'left',
  className,
  style,
  children,
  onPress,
  disabled = false,
}: InfoTipProps) {
  const [shown, setShown] = useState(false);
  const { width } = useWindowDimensions();
  const pointer = hasHoverPointer();
  const linger = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearLinger = useCallback(() => {
    if (linger.current !== null) clearTimeout(linger.current);
    linger.current = null;
  }, []);
  useEffect(() => clearLinger, [clearLinger]);

  const hide = useCallback(() => {
    clearLinger();
    setShown(false);
  }, [clearLinger]);

  /**
   * A phone has no cursor to move away, so the tip retires itself. It is also
   * dismissed by the next tap anywhere on the control.
   */
  const showForTouch = useCallback(() => {
    clearLinger();
    setShown(true);
    linger.current = setTimeout(() => setShown(false), TOUCH_TIP_LINGER_MS);
  }, [clearLinger]);

  /**
   * On a phone the bubble spans the screen's usable width instead of hanging
   * off one column: a 208px bubble anchored to a 64px column either overflows
   * the screen or wraps to five words a line.
   */
  const narrow = width < NARROW_SCREEN_MAX_WIDTH;
  const bubbleWidth = narrow
    ? Math.max(160, Math.min(TIP_WIDTH, width - NARROW_SCREEN_GUTTER * 2))
    : TIP_WIDTH;

  // Stable identity for this tip's claim on the shared layer.
  const layerOwner = useRef({}).current;
  const publish = useCallback(
    (anchor: TutorialAnchorLayout | null) => {
      if (anchor === null) {
        retractOpenTip(layerOwner);
        return;
      }
      publishOpenTip(layerOwner, { text, anchor, align, bubbleWidth, narrow });
    },
    [align, bubbleWidth, layerOwner, narrow, text],
  );
  const { anchorRef, scheduleMeasurement } = useGuideAnchor(shown, publish);
  useEffect(() => () => retractOpenTip(layerOwner), [layerOwner]);

  return (
    <View
      // Measured, not laid out relative to: the bubble is drawn by InfoTipLayer
      // outside every card, which is the only way it can be above all of them.
      // `collapsable={false}` keeps a real host node for measureInWindow.
      ref={anchorRef}
      collapsable={false}
      onLayout={scheduleMeasurement}
      style={[styles.anchor, style]}
      className={className}
    >
      <Pressable
        accessibilityRole={onPress === undefined ? 'text' : 'button'}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={text}
        // Hover opens the bubble only where a pointer can hover. A tablet's
        // browser is 'web' but has no cursor to move away, and its tap-time
        // synthetic hover left this bubble open over the roster; a touch screen
        // gets the hold below instead, which retires itself.
        onPointerEnter={pointer ? () => setShown(true) : undefined}
        onPointerLeave={pointer ? hide : undefined}
        onLongPress={showForTouch}
        onPress={() => {
          hide();
          onPress?.();
        }}
        disabled={disabled && onPress !== undefined}
        // Opacity only. A function-form style carrying layout on a Pressable
        // collapses it to zero height on iOS — a trap this codebase has hit
        // twice — so the box stays in className and only the fade lives here.
        style={
          onPress === undefined
            ? undefined
            : ({ pressed }) => ({
                opacity: pressed && !disabled ? 0.65 : undefined,
              })
        }
        delayLongPress={TOUCH_HOLD_MS}
      >
        {children}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: { position: 'relative' },
  /**
   * Covers the window and paints last. `pointerEvents="none"` on the layer is
   * what keeps the control underneath usable — without it this would swallow
   * every tap on the app.
   */
  layer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 1000,
    elevation: 20,
  },
  bubble: {
    position: 'absolute',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: '#241f2e',
    // Fully opaque, and nothing behind it can reach through: the layer above is
    // the last thing painted in the app.
    backgroundColor: '#3f6fb5',
  },
  /** Roomier on a phone: it is a tap target's answer, not a hover whisper. */
  bubbleNarrow: { paddingHorizontal: 12, paddingVertical: 10 },
  text: {
    color: '#f4f1ea',
    fontSize: 13,
    lineHeight: 18,
  },
  // 15px clears the iOS minimum comfortable reading size; 13px is a desktop
  // hover size and is genuinely hard to read at arm's length.
  textNarrow: { fontSize: 15, lineHeight: 21 },
});
