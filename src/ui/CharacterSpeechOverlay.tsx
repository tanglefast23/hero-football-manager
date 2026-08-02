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
import { bertTypewriterStepMs } from './bert-typewriter';
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
/** Widest the bubble is ever drawn, and the margin it keeps from both edges. */
const BUBBLE_MAX_WIDTH = 320;
const BUBBLE_GUTTER = 8;
const BUBBLE_FONT_SIZE = 15;
const BUBBLE_LINE_HEIGHT = 21;
/** Clearance the bubble keeps from the top of the screen, and from the app's
 *  own header chrome sitting just under it. */
const TOP_SAFE_MARGIN = 72;

export interface CharacterSpeechOverlayProps {
  /** One bubble per entry. A tap moves to the next; the last tap sends them off. */
  lines: readonly string[];
  /** Optional emphatic heading above the current bubble line. */
  heading?: string;
  /** The character themselves — a match sprite, or Bert's pixel figure. */
  children?: React.ReactNode;
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
  /**
   * Places the character and bubble immediately, then finishes without an exit
   * walk. Briefings can opt in without changing animated character welcomes.
   */
  instant?: boolean;
  accessibilityLabel?: string;
  /** Fires with the index of the line now showing, including the first. */
  onLineChange?: (index: number) => void;
  /**
   * The player sheet holds only a right-facing run, so an arriving character is
   * drawn mirrored — in every phase but `leaving`. A front-facing figure has to
   * opt out, or it spends the whole conversation reversed.
   */
  mirrorSprite?: boolean;
  /**
   * A character that needs to know it is moving. `children` covers the common
   * case; this covers a figure whose own limbs animate, which cannot be told
   * from outside because the phase is internal.
   */
  renderCharacter?: (state: { phase: Phase; walking: boolean }) => React.ReactNode;
  /**
   * Grows the bubble with the character. A big figure beside small type reads
   * as a mistake rather than a choice.
   */
  bubbleScale?: number;
  /**
   * Reveals the current line one character at a time. A tap finishes that line
   * before a later tap advances; reduced-motion mode always shows it in full.
   */
  typewriter?: boolean;
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
  heading,
  children,
  characterWidth,
  characterHeight,
  autoAdvanceMs,
  groundOffset = 0,
  onDone,
  reduceMotion = false,
  instant = false,
  accessibilityLabel,
  onLineChange,
  mirrorSprite = true,
  renderCharacter,
  bubbleScale = 1,
  typewriter = false,
}: CharacterSpeechOverlayProps) {
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const reduce = useReducedMotion(reduceMotion);
  const [phase, setPhase] = useState<Phase>(reduce || instant ? 'speaking' : 'arriving');
  const [lineIndex, setLineIndex] = useState(0);
  const [bubbleWidth, setBubbleWidth] = useState(0);
  const [bubbleHeight, setBubbleHeight] = useState(0);
  const line = lines[Math.min(lineIndex, Math.max(0, lines.length - 1))] ?? '';
  const lineCharacters = useMemo(() => Array.from(line), [line]);
  const initialReveal = {
    lineIndex: 0,
    line,
    count: typewriter && !reduce ? 0 : lineCharacters.length,
  };
  const [reveal, setReveal] = useState(initialReveal);
  // Advancing reads this rather than the state value: two taps landing in the
  // same tick would both see a stale `lineIndex` and skip a line, and a skipped
  // line here is a rule the player is never told again.
  const lineIndexRef = useRef(0);
  // The same protection applies to the reveal. Two quick taps may complete a
  // line and advance it, but can never jump over an unseen line.
  const revealRef = useRef(initialReveal);
  const doneRef = useRef(false);

  const restLeft = viewportWidth * (1 - PENETRATION) - characterWidth / 2;
  const offRight = viewportWidth + 24;

  const travel = useRef(new Animated.Value(reduce || instant ? restLeft : offRight)).current;
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
    if (reduce || instant || phase !== 'arriving') return undefined;
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
  }, [instant, offRight, phase, reduce, restLeft, travel, walkMs]);

  // Lean in and pop the bubble once they are standing still; both reset between
  // lines so every paragraph gets the same little delivery.
  useEffect(() => {
    if (phase !== 'speaking') return undefined;
    if (instant) {
      lean.setValue(1);
      pop.setValue(1);
      return undefined;
    }
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
  }, [instant, lean, lineIndex, phase, pop, reduce]);

  // Type Bert's current line. The full invisible remainder stays in the Text
  // node below, so the bubble takes its final size once instead of twitching
  // wider and taller as each character arrives.
  useEffect(() => {
    if (phase !== 'speaking') return undefined;

    const setRevealCount = (count: number) => {
      const next = { lineIndex, line, count };
      revealRef.current = next;
      setReveal(next);
    };

    if (!typewriter || reduce) {
      setRevealCount(lineCharacters.length);
      return undefined;
    }

    setRevealCount(0);
    if (lineCharacters.length === 0) return undefined;

    const stepMs = bertTypewriterStepMs(line);
    let timer: ReturnType<typeof setTimeout> | null = null;
    const revealNextCharacter = () => {
      const active = revealRef.current;
      const currentCount = active.lineIndex === lineIndex && active.line === line
        ? active.count
        : 0;
      const nextCount = Math.min(lineCharacters.length, currentCount + 1);
      setRevealCount(nextCount);
      if (nextCount < lineCharacters.length) {
        timer = setTimeout(revealNextCharacter, stepMs);
      }
    };

    // The first walking line already waits for the bubble's settle beat. Start
    // the text with the bubble rather than typing several hidden characters.
    timer = setTimeout(
      revealNextCharacter,
      instant || lineIndex > 0 ? 0 : SETTLE_MS,
    );
    return () => {
      if (timer !== null) clearTimeout(timer);
    };
  }, [instant, line, lineCharacters.length, lineIndex, phase, reduce, typewriter]);

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

    const currentLineIndex = lineIndexRef.current;
    const currentLine = lines[currentLineIndex] ?? '';
    const currentLineLength = Array.from(currentLine).length;
    const activeReveal = revealRef.current;
    const revealedCount = activeReveal.lineIndex === currentLineIndex
      && activeReveal.line === currentLine
      ? activeReveal.count
      : 0;
    if (typewriter && !reduce && revealedCount < currentLineLength) {
      const completed = {
        lineIndex: currentLineIndex,
        line: currentLine,
        count: currentLineLength,
      };
      revealRef.current = completed;
      setReveal(completed);
      return;
    }

    const next = lineIndexRef.current + 1;
    if (next < lines.length) {
      lineIndexRef.current = next;
      const nextLine = lines[next] ?? '';
      const nextReveal = {
        lineIndex: next,
        line: nextLine,
        count: typewriter && !reduce ? 0 : Array.from(nextLine).length,
      };
      revealRef.current = nextReveal;
      setReveal(nextReveal);
      setLineIndex(next);
      return;
    }
    if (instant) {
      if (!doneRef.current) {
        doneRef.current = true;
        onDone();
      }
      return;
    }
    setPhase('leaving');
  }, [instant, lines, onDone, phase, reduce, restLeft, travel, typewriter]);

  // Announce the line to whoever is following along — the spotlight tracks it,
  // and the first line has to be reported as well as the ones tapped to.
  useEffect(() => {
    onLineChange?.(lineIndex);
  }, [lineIndex, onLineChange]);

  /**
   * Reduced motion can be answered after the walk has already started. The
   * arrival animation is then stopped by its own effect with the character
   * still off screen, so parking them on their mark is the only way back.
   */
  useEffect(() => {
    if (!reduce || phase !== 'arriving') return;
    travel.setValue(restLeft);
    setPhase('speaking');
  }, [phase, reduce, restLeft, travel]);

  /**
   * Keep them on their mark when the window changes size.
   *
   * `travel` is seeded once and only driven while arriving or leaving, but the
   * bubble recomputes its anchor from the live viewport every render. Without
   * this, resizing mid-briefing — or a first paint that lands before the layout
   * settles, which is the desktop case — leaves the character standing where
   * the old width put them while their bubble has already moved, tail pointing
   * at nobody.
   */
  useEffect(() => {
    if (phase !== 'speaking') return;
    travel.setValue(restLeft);
  }, [phase, restLeft, travel]);

  const revealedCharacterCount = !typewriter || reduce
    ? lineCharacters.length
    : reveal.lineIndex === lineIndex && reveal.line === line
      ? Math.min(reveal.count, lineCharacters.length)
      : 0;
  const lineFullyRevealed = revealedCharacterCount >= lineCharacters.length;

  // Auto-advance for a character who is remarking rather than briefing.
  useEffect(() => {
    if (
      autoAdvanceMs === undefined
      || phase !== 'speaking'
      || !lineFullyRevealed
    ) return undefined;
    const timer = setTimeout(advance, autoAdvanceMs);
    return () => clearTimeout(timer);
  }, [advance, autoAdvanceMs, lineFullyRevealed, lineIndex, phase]);

  const onBubbleLayout = useCallback((event: LayoutChangeEvent) => {
    setBubbleWidth(event.nativeEvent.layout.width);
    setBubbleHeight(event.nativeEvent.layout.height);
  }, []);

  const lastLine = lineIndex >= lines.length - 1;
  const visibleLine = lineCharacters.slice(0, revealedCharacterCount).join('');
  const unrevealedLine = lineCharacters.slice(revealedCharacterCount).join('');

  /**
   * Whether the bubble has reported its own size yet.
   *
   * It cannot be placed until it has: `onLayout` is delivered a frame or more
   * after the bubble first mounts, and until then `bubbleLeft` can only fall
   * back to the character's centre — four fifths of the way across — which on a
   * 375pt phone leaves about 75pt and breaks the line to roughly one word each.
   * So the first pass is a measuring pass and is not painted. `pop` starts at
   * zero and usually hides it by accident; `instant` sets `pop` to 1 straight
   * away and does not, which is where the garbled frame was actually visible.
   */
  const bubbleMeasured = bubbleWidth > 0;

  // The bubble hangs over the character's head and is centred on them, but a
  // wide bubble on a narrow screen has to slide left to stay on the page — so
  // the tail tracks the character rather than sitting at the bubble's middle.
  const characterCentre = restLeft + characterWidth / 2;
  const bubbleLeft = useMemo(() => {
    if (bubbleWidth === 0) return characterCentre;
    const gutter = BUBBLE_GUTTER;
    const ideal = characterCentre - bubbleWidth / 2;
    return Math.min(Math.max(ideal, gutter), Math.max(gutter, viewportWidth - bubbleWidth - gutter));
  }, [bubbleWidth, characterCentre, viewportWidth]);
  const tailLeft = Math.min(
    Math.max(characterCentre - bubbleLeft, 18),
    Math.max(18, bubbleWidth - 18),
  );

  /**
   * The bubble wants to sit above the character's head, but a tall character on
   * a short screen pushes it into whatever the app keeps at the top — on the
   * money briefing that is the cash counter and its own cue. Rather than let it
   * ride off the top, it stops short and overlaps the character instead, which
   * is the normal thing for a speech bubble to do.
   */
  const bubbleBottom = useMemo(() => {
    const ideal = groundOffset + characterHeight + 22;
    if (bubbleHeight === 0) return ideal;
    const highest = viewportHeight - bubbleHeight - TOP_SAFE_MARGIN;
    return Math.max(0, Math.min(ideal, highest));
  }, [bubbleHeight, characterHeight, groundOffset, viewportHeight]);

  const tilt = lean.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${SPEAK_TILT_DEG}deg`] });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? line}
      accessibilityHint={!lineFullyRevealed
        ? 'Tap anywhere to show the full line'
        : lastLine
          ? 'Tap anywhere to finish'
          : 'Tap anywhere for the next line'}
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
                bottom: bubbleBottom,
                // Never paint an unmeasured bubble, whatever `pop` is doing.
                opacity: bubbleMeasured ? pop : 0,
                transform: [{ scale: pop }],
                // The flat cap overflows a 320pt phone once both gutters are
                // counted, so the narrower of the two always wins.
                maxWidth: Math.min(
                  BUBBLE_MAX_WIDTH * bubbleScale,
                  viewportWidth - BUBBLE_GUTTER * 2,
                ),
              },
            ]}
          >
            {heading === undefined ? null : (
              <Text style={[styles.bubbleHeading, bubbleScale === 1 ? null : {
                fontSize: (BUBBLE_FONT_SIZE - 1) * bubbleScale,
                lineHeight: (BUBBLE_LINE_HEIGHT - 2) * bubbleScale,
              }]}>{heading}</Text>
            )}
            <Text style={[styles.bubbleText, bubbleScale === 1 ? null : {
              fontSize: BUBBLE_FONT_SIZE * bubbleScale,
              lineHeight: BUBBLE_LINE_HEIGHT * bubbleScale,
            }]}>
              {visibleLine}
              {unrevealedLine.length === 0 ? null : (
                <Text style={styles.unrevealedText}>{unrevealedLine}</Text>
              )}
            </Text>
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
                // right means drawing it mirrored. A front-facing figure opts
                // out — mirroring it would only reverse the arm it points with.
                { scaleX: mirrorSprite && phase !== 'leaving' ? -1 : 1 },
                { rotate: tilt },
              ],
            },
          ]}
        >
          {renderCharacter === undefined ? children : renderCharacter({ phase, walking })}
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
  bubbleText: {
    color: '#241f2e',
    fontSize: BUBBLE_FONT_SIZE,
    lineHeight: BUBBLE_LINE_HEIGHT,
    fontWeight: 'bold',
  },
  unrevealedText: { color: 'transparent' },
  bubbleHeading: {
    color: '#c44536',
    fontSize: BUBBLE_FONT_SIZE - 1,
    lineHeight: BUBBLE_LINE_HEIGHT - 2,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 5,
  },
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
