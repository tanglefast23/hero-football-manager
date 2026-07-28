import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useReducedMotion } from './use-reduced-motion';

/** How far in from the right edge a character comes to rest. */
const PENETRATION = 1 / 5;
const WALK_PX_PER_S = 248;
/** Lean into the line, and stand back up before leaving. */
const SPEAK_TILT_DEG = -6;
const TILT_MS = 200;
/** A beat between arriving and speaking, so the two reads as cause and effect. */
const SETTLE_MS = 240;
const BUBBLE_POP_MS = 200;

export interface CharacterSpeechOverlayProps {
  /** One bubble per entry. A tap moves to the next; the last tap sends them off. */
  lines: readonly string[];
  /** The character themselves — a match sprite, or Bert's pixel figure. */
  children: React.ReactNode;
  /** Rendered size of `children`, needed to place the bubble above their head. */
  characterWidth: number;
  characterHeight: number;
  /**
   * Set to advance without waiting for a tap, for a character who is making a
   * remark rather than briefing you. A tap still skips ahead.
   */
  autoAdvanceMs?: number;
  /** Clearance from the bottom of the screen, e.g. above a tab bar. */
  groundOffset?: number;
  /** Fires once they are all the way off screen. */
  onDone: () => void;
  reduceMotion?: boolean;
  accessibilityLabel?: string;
}

type Phase = 'arriving' | 'speaking' | 'leaving';

/**
 * A character walks in from the right, stops a fifth of the way across, and
 * says their piece one speech bubble at a time. Tapping anywhere advances;
 * tapping past the last line sends them back off the way they came.
 *
 * This replaces the framed dialogue card. The card put a portrait in a box and
 * asked the player to find its button; this puts the character on the page they
 * are talking about and makes the whole screen the button.
 */
export function CharacterSpeechOverlay({
  lines,
  children,
  characterWidth,
  characterHeight,
  autoAdvanceMs,
  groundOffset = 0,
  onDone,
  reduceMotion = false,
  accessibilityLabel,
}: CharacterSpeechOverlayProps) {
  const { width: viewportWidth } = useWindowDimensions();
  const reduce = useReducedMotion(reduceMotion);
  const [phase, setPhase] = useState<Phase>(reduce ? 'speaking' : 'arriving');
  const [lineIndex, setLineIndex] = useState(0);
  const [bubbleWidth, setBubbleWidth] = useState(0);

  const restLeft = viewportWidth * (1 - PENETRATION) - characterWidth / 2;
  const offRight = viewportWidth + 24;

  const travel = useRef(new Animated.Value(reduce ? restLeft : offRight)).current;
  const lean = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;
  // `leaving` is read on the JS side to flip the sprite, so it is state as well
  // as an animation phase.
  const walking = phase !== 'speaking';

  const walkMs = useCallback(
    (from: number, to: number) => (Math.abs(to - from) / WALK_PX_PER_S) * 1000,
    [],
  );

  // Arrive.
  useEffect(() => {
    if (reduce || phase !== 'arriving') return undefined;
    const animation = Animated.timing(travel, {
      toValue: restLeft,
      duration: walkMs(offRight, restLeft),
      easing: Easing.linear,
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished) setPhase('speaking');
    });
    return () => animation.stop();
  }, [offRight, phase, reduce, restLeft, travel, walkMs]);

  // Lean in and pop the bubble once they are standing still; both reset between
  // lines so every paragraph gets the same little delivery.
  useEffect(() => {
    if (phase !== 'speaking') return undefined;
    lean.setValue(0);
    pop.setValue(0);
    const animation = Animated.sequence([
      Animated.delay(lineIndex === 0 ? SETTLE_MS : 0),
      Animated.parallel([
        Animated.timing(lean, {
          toValue: 1,
          duration: reduce ? 0 : TILT_MS,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(pop, {
          toValue: 1,
          speed: 18,
          bounciness: 9,
          useNativeDriver: true,
        }),
      ]),
    ]);
    animation.start();
    return () => animation.stop();
  }, [lean, lineIndex, phase, pop, reduce]);

  // Leave.
  useEffect(() => {
    if (phase !== 'leaving') return undefined;
    const animation = Animated.sequence([
      Animated.timing(lean, {
        toValue: 0,
        duration: reduce ? 0 : TILT_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(travel, {
        toValue: offRight,
        duration: reduce ? 0 : walkMs(restLeft, offRight),
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ]);
    animation.start(({ finished }) => {
      if (finished) onDone();
    });
    return () => animation.stop();
  }, [lean, offRight, onDone, phase, reduce, restLeft, travel, walkMs]);

  const advance = useCallback(() => {
    if (phase === 'arriving') {
      // Never make the first tap a wasted one: skipping the walk should land
      // them on their mark, not swallow the tap that was meant to read a line.
      travel.setValue(restLeft);
      setPhase('speaking');
      return;
    }
    if (phase === 'leaving') return;
    if (lineIndex < lines.length - 1) {
      setLineIndex(index => index + 1);
      return;
    }
    setPhase('leaving');
  }, [lineIndex, lines.length, phase, restLeft, travel]);

  // Auto-advance for a character who is remarking rather than briefing.
  useEffect(() => {
    if (autoAdvanceMs === undefined || phase !== 'speaking') return undefined;
    const timer = setTimeout(advance, autoAdvanceMs);
    return () => clearTimeout(timer);
  }, [advance, autoAdvanceMs, lineIndex, phase]);

  const onBubbleLayout = useCallback((event: LayoutChangeEvent) => {
    setBubbleWidth(event.nativeEvent.layout.width);
  }, []);

  const line = lines[Math.min(lineIndex, lines.length - 1)];
  const lastLine = lineIndex >= lines.length - 1;

  // The bubble hangs over the character's head and is centred on them, but a
  // wide bubble on a narrow screen has to slide left to stay on the page — so
  // the tail tracks the character rather than sitting at the bubble's middle.
  const characterCentre = restLeft + characterWidth / 2;
  const bubbleLeft = useMemo(() => {
    if (bubbleWidth === 0) return characterCentre;
    const gutter = 8;
    const ideal = characterCentre - bubbleWidth / 2;
    return Math.min(Math.max(ideal, gutter), Math.max(gutter, viewportWidth - bubbleWidth - gutter));
  }, [bubbleWidth, characterCentre, viewportWidth]);
  const tailLeft = Math.min(
    Math.max(characterCentre - bubbleLeft, 18),
    Math.max(18, bubbleWidth - 18),
  );

  const tilt = lean.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${SPEAK_TILT_DEG}deg`] });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? line}
      accessibilityHint={lastLine ? 'Tap anywhere to finish' : 'Tap anywhere for the next line'}
      onPress={advance}
      style={StyleSheet.absoluteFill}
    >
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {phase === 'speaking' ? (
          <Animated.View
            onLayout={onBubbleLayout}
            style={[
              styles.bubble,
              {
                left: bubbleLeft,
                bottom: groundOffset + characterHeight + 22,
                opacity: pop,
                transform: [{ scale: pop }],
              },
            ]}
          >
            <Text style={styles.bubbleText}>{line}</Text>
            <View style={[styles.tailBorder, { left: tailLeft - 10 }]} />
            <View style={[styles.tailFill, { left: tailLeft - 7 }]} />
          </Animated.View>
        ) : null}

        <Animated.View
          style={[
            styles.character,
            {
              bottom: groundOffset,
              width: characterWidth,
              height: characterHeight,
              transform: [
                { translateX: travel },
                // The sheet only holds a right-facing run, so arriving from the
                // right means drawing it mirrored.
                { scaleX: phase === 'leaving' ? 1 : -1 },
                { rotate: tilt },
              ],
            },
          ]}
        >
          {children}
        </Animated.View>

        <Animated.View
          style={[
            styles.groundShadow,
            {
              bottom: groundOffset - 2,
              width: characterWidth * 0.62,
              transform: [{ translateX: Animated.add(travel, characterWidth * 0.19) }],
            },
          ]}
        />
      </View>

      {lines.length > 1 ? (
        <View pointerEvents="none" style={styles.progressRow}>
          {lines.map((_, index) => (
            <View
              key={index}
              style={[styles.progressDot, index === lineIndex ? styles.progressDotOn : null]}
            />
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  character: { position: 'absolute', left: 0 },
  groundShadow: {
    position: 'absolute',
    left: 0,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(36,31,46,0.22)',
  },
  bubble: {
    position: 'absolute',
    maxWidth: 320,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 3,
    borderColor: '#241f2e',
    borderRadius: 10,
    backgroundColor: '#ffffff',
    // The pixel-art drop shadow the rest of the UI uses: one hard offset, no blur.
    shadowColor: '#241f2e',
    shadowOffset: { width: 5, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
  },
  bubbleText: { color: '#241f2e', fontSize: 15, lineHeight: 21, fontWeight: 'bold' },
  // Two stacked triangles: the dark one is the bubble's border, the white one
  // sits a few pixels up to punch the border line out of the tail's mouth.
  tailBorder: {
    position: 'absolute',
    bottom: -16,
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 16,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#241f2e',
  },
  tailFill: {
    position: 'absolute',
    bottom: -9,
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 11,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#ffffff',
  },
  progressRow: {
    position: 'absolute',
    bottom: 14,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderWidth: 1,
    borderColor: 'rgba(36,31,46,0.35)',
    backgroundColor: '#ffffff',
  },
  progressDotOn: { borderColor: '#241f2e', backgroundColor: '#edb54a' },
});
