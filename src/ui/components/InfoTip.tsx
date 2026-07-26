import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

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

export interface InfoTipProps {
  /** What the thing under the pointer actually means, in one sentence. */
  text: string;
  /** Read out instead of the raw label, so the explanation is not pointer-only. */
  accessibilityLabel: string;
  /** Which edge the bubble hangs from, so it never runs off a column's side. */
  align?: 'left' | 'right';
  children: React.ReactNode;
  onPress?: () => void;
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
  children,
  onPress,
}: InfoTipProps) {
  const [shown, setShown] = useState(false);
  const { width } = useWindowDimensions();
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

  return (
    <View style={styles.anchor}>
      <Pressable
        accessibilityRole={onPress === undefined ? 'text' : 'button'}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={text}
        onPointerEnter={() => setShown(true)}
        onPointerLeave={hide}
        onLongPress={showForTouch}
        onPress={() => {
          hide();
          onPress?.();
        }}
        delayLongPress={TOUCH_HOLD_MS}
      >
        {children}
      </Pressable>
      {shown ? (
        <View
          pointerEvents="none"
          style={[
            styles.bubble,
            { width: bubbleWidth },
            // Near a screen edge the bubble hangs from the far side, so a tip on
            // the last column cannot run off the right of a phone.
            align === 'right' ? styles.bubbleRight : styles.bubbleLeft,
            narrow ? styles.bubbleNarrow : null,
          ]}
        >
          <Text style={[styles.text, narrow ? styles.textNarrow : null]}>{text}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: { position: 'relative' },
  bubble: {
    position: 'absolute',
    top: '100%',
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: '#241f2e',
    backgroundColor: '#3f6fb5',
    zIndex: 50,
    elevation: 12,
  },
  bubbleLeft: { left: 0 },
  bubbleRight: { right: 0 },
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
