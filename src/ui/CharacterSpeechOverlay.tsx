import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  findNodeHandle,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useCopy } from '../i18n';
import { bertTypewriterStepMs } from './bert-typewriter';
import {
  SPEECH_BUBBLE_FONT_SIZE,
  SPEECH_BUBBLE_LINE_HEIGHT,
  SpeechBubbleTail,
  speechBubbleStyles,
} from './speech-bubble';
import { useReducedMotion } from './use-reduced-motion';
import { useScreenReaderEnabled } from './use-screen-reader';

/** How far in from the right edge a character comes to rest. */
const PENETRATION = 1 / 5;
/** The original 248 px/s read as a wait. Walk-ons now cross the same distance
 *  in half the time while keeping the authored linear stride. */
const WALK_PX_PER_S = 248 * 2;
/** Lean into the line, and stand back up before leaving. */
const SPEAK_TILT_DEG = -6;
const TILT_MS = 200;
/** A beat between arriving and speaking, so the two reads as cause and effect. */
const SETTLE_MS = 240;
const BUBBLE_POP_MS = 200;
/** Widest the bubble is ever drawn, and the margin it keeps from both edges. */
const BUBBLE_MAX_WIDTH = 320;
const BUBBLE_GUTTER = 8;
const BUBBLE_FONT_SIZE = SPEECH_BUBBLE_FONT_SIZE;
const BUBBLE_LINE_HEIGHT = SPEECH_BUBBLE_LINE_HEIGHT;
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
  renderCharacter?: (state: {
    phase: Phase;
    walking: boolean;
  }) => React.ReactNode;
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
  /** Give web keyboard and Android TalkBack focus to a blocking briefing. */
  focusOnMount?: boolean;
  /** Horizontal centre as a fraction of the viewport; existing walk-ons use 0.8. */
  characterCentreRatio?: number;
  /** Keep placement and bubble behavior while a parent owns the visible sprite. */
  hideCharacter?: boolean;
  /** Route the platform accessibility escape gesture through the normal tap path. */
  handleAccessibilityEscape?: boolean;
  /** A changed value routes hardware Back through the same normal tap path. */
  advanceSignal?: number;
}

type Phase = 'arriving' | 'speaking' | 'leaving';

interface RevealRecord {
  lineIndex: number;
  line: string;
  count: number;
}

/**
 * The letters themselves — the only thing that re-renders per keystroke.
 *
 * It reads the reveal straight out of the overlay's ref through
 * `useSyncExternalStore`, so a character landing repaints this `<Text>` and
 * nothing else. Everything expensive in the overlay — the sprite, the shadow,
 * the bubble transform — sits above this boundary and stays put.
 *
 * Rendered inside the bubble's `<Text>`, so it returns bare text nodes and
 * inherits that style; the unrevealed tail keeps its own dimmed style, which is
 * what reserves the line's full width and stops the bubble reflowing per letter.
 */
function RevealingLine({
  characters,
  line,
  lineIndex,
  revealRef,
  subscribe,
  typing,
}: {
  characters: string[];
  line: string;
  lineIndex: number;
  revealRef: { current: RevealRecord };
  subscribe: (listener: () => void) => () => void;
  typing: boolean;
}) {
  const getCount = useCallback(() => {
    if (!typing) return characters.length;
    const reveal = revealRef.current;
    // A reveal belonging to a line we are no longer showing reads as nothing
    // revealed, exactly as the old parent-side derivation did.
    return reveal.lineIndex === lineIndex && reveal.line === line
      ? Math.min(reveal.count, characters.length)
      : 0;
  }, [characters.length, line, lineIndex, revealRef, typing]);
  const count = useSyncExternalStore(subscribe, getCount, getCount);
  const visibleLine = characters.slice(0, count).join('');
  const unrevealedLine = characters.slice(count).join('');
  return (
    <>
      {visibleLine}
      {unrevealedLine.length === 0 ? null : (
        <Text style={styles.unrevealedText}>{unrevealedLine}</Text>
      )}
    </>
  );
}

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
  focusOnMount = false,
  characterCentreRatio = 1 - PENETRATION,
  hideCharacter = false,
  handleAccessibilityEscape = false,
  advanceSignal,
}: CharacterSpeechOverlayProps) {
  const t = useCopy();
  const { width: viewportWidth, height: viewportHeight } =
    useWindowDimensions();
  const reduce = useReducedMotion(reduceMotion);
  const screenReaderEnabled = useScreenReaderEnabled();
  const initialPhase: Phase = reduce || instant ? 'speaking' : 'arriving';
  const [phase, setPhase] = useState<Phase>(initialPhase);
  // A ref makes two fast taps observe each other's phase change even when React
  // batches both events before the next render.
  const phaseRef = useRef<Phase>(initialPhase);
  const moveToPhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);
  // `speaking` starts before the settle/pop animation is complete. Keeping that
  // visual readiness separate prevents a tap in the gap from dismissing a line
  // the player has not seen yet.
  const [speechReady, setSpeechReady] = useState(reduce || instant);
  const speechReadyRef = useRef(reduce || instant);
  const markSpeechReady = useCallback((ready: boolean) => {
    speechReadyRef.current = ready;
    setSpeechReady(ready);
  }, []);
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
  // WHY THE REVEAL IS NOT PARENT STATE. A typewriter commits once per character
  // — every 10-30ms (`bertTypewriterStepMs`). Held as state up here, each of
  // those commits re-rendered this whole overlay: the bubble, the ground
  // shadow, the progress dots, and `renderCharacter`, which redraws the speaking
  // character's sprite. On the web build that is the JS thread's own budget,
  // because react-native-web forces `useNativeDriver` back to a JS fallback, so
  // the walk-on springs are already running there too. Bert talking was one of
  // the two places the game measurably stuttered.
  //
  // So the count lives in a ref and is published to one subscriber: the `<Text>`
  // that actually draws the letters. The parent re-renders twice per LINE (see
  // `lineComplete`) instead of once per character.
  const revealListeners = useRef(new Set<() => void>()).current;
  const subscribeToReveal = useCallback(
    (listener: () => void) => {
      revealListeners.add(listener);
      return () => {
        revealListeners.delete(listener);
      };
    },
    [revealListeners],
  );
  const emitReveal = useCallback(() => {
    revealListeners.forEach((listener) => {
      listener();
    });
  }, [revealListeners]);
  // Advancing reads this rather than the state value: two taps landing in the
  // same tick would both see a stale `lineIndex` and skip a line, and a skipped
  // line here is a rule the player is never told again.
  const lineIndexRef = useRef(0);
  // The same protection applies to the reveal. Two quick taps may complete a
  // line and advance it, but can never jump over an unseen line.
  const revealRef = useRef(initialReveal);
  /**
   * Whether the line on screen has finished typing.
   *
   * The only part of the reveal the overlay itself needs: it decides the
   * accessibility hint and arms the auto-advance. It flips at most twice per
   * line — false when a line starts, true when it lands — which is why it can
   * afford to be state when the character count cannot.
   */
  const [lineComplete, setLineComplete] = useState(
    initialReveal.count >= lineCharacters.length,
  );
  /** The one place the reveal is written. Publishes to the text, not the tree. */
  const publishReveal = useCallback(
    (next: typeof initialReveal) => {
      revealRef.current = next;
      emitReveal();
      setLineComplete(next.count >= Array.from(next.line).length);
    },
    [emitReveal],
  );
  const doneRef = useRef(false);
  const pressableRef = useRef<View>(null);

  useEffect(() => {
    if (!focusOnMount) return undefined;
    const frame = requestAnimationFrame(() => {
      const target = pressableRef.current;
      if (target === null) return;
      if (Platform.OS === 'web') {
        (target as unknown as { focus?: () => void }).focus?.();
        return;
      }
      const handle = findNodeHandle(target);
      if (handle !== null) AccessibilityInfo.setAccessibilityFocus(handle);
    });
    return () => cancelAnimationFrame(frame);
  }, [focusOnMount]);

  const restLeft = viewportWidth * characterCentreRatio - characterWidth / 2;
  const offRight = viewportWidth + 24;

  const travel = useRef(
    new Animated.Value(reduce || instant ? restLeft : offRight),
  ).current;
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
      if (finished) moveToPhase('speaking');
    });
    return () => animation.stop();
  }, [instant, moveToPhase, offRight, phase, reduce, restLeft, travel, walkMs]);

  // Lean in and pop the bubble once they are standing still; both reset between
  // lines so every paragraph gets the same little delivery.
  useEffect(() => {
    if (phase !== 'speaking') return undefined;
    if (instant || reduce || speechReady) {
      lean.setValue(1);
      pop.setValue(1);
      if (!speechReady) markSpeechReady(true);
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
    animation.start(({ finished }) => {
      if (finished) markSpeechReady(true);
    });
    return () => animation.stop();
  }, [
    instant,
    lean,
    lineIndex,
    markSpeechReady,
    phase,
    pop,
    reduce,
    speechReady,
  ]);

  // Type Bert's current line. The full invisible remainder stays in the Text
  // node below, so the bubble takes its final size once instead of twitching
  // wider and taller as each character arrives.
  useEffect(() => {
    if (phase !== 'speaking') return undefined;

    const setRevealCount = (count: number) => {
      publishReveal({ lineIndex, line, count });
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
      const currentCount =
        active.lineIndex === lineIndex && active.line === line
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
      instant || speechReadyRef.current || lineIndex > 0 ? 0 : SETTLE_MS,
    );
    return () => {
      if (timer !== null) clearTimeout(timer);
    };
  }, [
    instant,
    line,
    lineCharacters.length,
    lineIndex,
    phase,
    reduce,
    typewriter,
  ]);

  // Leave.
  useEffect(() => {
    if (phase !== 'leaving') return undefined;
    // Stand up and leave together. A dismissal now starts visible movement in
    // the same frame instead of spending 200 ms upright before walking.
    const animation = Animated.parallel([
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
      if (finished && !doneRef.current) {
        doneRef.current = true;
        onDone();
      }
    });
    return () => animation.stop();
  }, [lean, offRight, onDone, phase, reduce, restLeft, travel, walkMs]);

  const advance = useCallback(() => {
    const activePhase = phaseRef.current;
    if (
      activePhase === 'arriving' ||
      (!speechReadyRef.current && lineIndexRef.current === 0)
    ) {
      // The first tap during entry or the settle beat completes the whole
      // presentation: character on mark, bubble open, speech ready to read.
      // Later lines are already typing while their delivery pop completes, so
      // their first tap must still finish the visible text instead of vanishing.
      travel.setValue(restLeft);
      lean.setValue(1);
      pop.setValue(1);
      markSpeechReady(true);
      if (activePhase === 'arriving') moveToPhase('speaking');
      return;
    }
    if (activePhase === 'leaving') {
      // A tap during the walk-off ends it here. It used to do nothing, so a
      // manager who had read the line still had to sit through the exit.
      travel.setValue(offRight);
      lean.setValue(0);
      if (!doneRef.current) {
        doneRef.current = true;
        onDone();
      }
      return;
    }

    const currentLineIndex = lineIndexRef.current;
    const currentLine = lines[currentLineIndex] ?? '';
    const currentLineLength = Array.from(currentLine).length;
    const activeReveal = revealRef.current;
    const revealedCount =
      activeReveal.lineIndex === currentLineIndex &&
      activeReveal.line === currentLine
        ? activeReveal.count
        : 0;
    if (typewriter && !reduce && revealedCount < currentLineLength) {
      publishReveal({
        lineIndex: currentLineIndex,
        line: currentLine,
        count: currentLineLength,
      });
      return;
    }

    const next = lineIndexRef.current + 1;
    if (next < lines.length) {
      lineIndexRef.current = next;
      markSpeechReady(false);
      const nextLine = lines[next] ?? '';
      publishReveal({
        lineIndex: next,
        line: nextLine,
        count: typewriter && !reduce ? 0 : Array.from(nextLine).length,
      });
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
    moveToPhase('leaving');
  }, [
    instant,
    lean,
    lines,
    markSpeechReady,
    moveToPhase,
    offRight,
    onDone,
    pop,
    publishReveal,
    reduce,
    restLeft,
    travel,
    typewriter,
  ]);

  const previousAdvanceSignalRef = useRef(advanceSignal);
  useEffect(() => {
    if (
      advanceSignal === undefined ||
      previousAdvanceSignalRef.current === advanceSignal
    )
      return;
    previousAdvanceSignalRef.current = advanceSignal;
    advance();
  }, [advance, advanceSignal]);

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
    markSpeechReady(true);
    moveToPhase('speaking');
  }, [markSpeechReady, moveToPhase, phase, reduce, restLeft, travel]);

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

  const lineFullyRevealed = !typewriter || reduce ? true : lineComplete;

  // Auto-advance for a character who is remarking rather than briefing.
  // VoiceOver reads slower than the character-count timers the callers pass,
  // so a timed line waits for a tap unless the screen reader is known off —
  // the same contract rivalHeroSpeechAutoExitMs applies, enforced here once
  // for every caller.
  useEffect(() => {
    if (
      autoAdvanceMs === undefined ||
      screenReaderEnabled !== false ||
      phase !== 'speaking' ||
      !speechReady ||
      !lineFullyRevealed
    )
      return undefined;
    const timer = setTimeout(advance, autoAdvanceMs);
    return () => clearTimeout(timer);
  }, [
    advance,
    autoAdvanceMs,
    lineFullyRevealed,
    lineIndex,
    phase,
    screenReaderEnabled,
    speechReady,
  ]);

  const onBubbleLayout = useCallback((event: LayoutChangeEvent) => {
    setBubbleWidth(event.nativeEvent.layout.width);
    setBubbleHeight(event.nativeEvent.layout.height);
  }, []);

  const lastLine = lineIndex >= lines.length - 1;

  /**
   * Whether the bubble has reported its own size yet.
   *
   * It cannot be *placed* until it has: `onLayout` is delivered a frame or more
   * after the bubble first mounts, and until then `bubbleLeft` can only fall
   * back to the character's centre. So the first pass is a measuring pass and is
   * not painted. `pop` starts at zero and usually hides it by accident;
   * `instant` sets `pop` to 1 straight away and does not, which is where the
   * garbled frame was actually visible.
   *
   * It does not have to be measured to be *sized*: the bubble is laid out at the
   * left edge with a maximum width and moved into place with a transform, so how
   * the words break is settled on the first pass and never revisited.
   */
  const bubbleMeasured = bubbleWidth > 0;

  /**
   * Widest the bubble is drawn on this screen.
   *
   * The flat cap overflows a 320pt phone once both gutters are counted, so the
   * narrower of the two always wins.
   */
  const bubbleMaxWidth = Math.min(
    BUBBLE_MAX_WIDTH * bubbleScale,
    viewportWidth - BUBBLE_GUTTER * 2,
  );

  // The bubble hangs over the character's head and is centred on them, but a
  // wide bubble on a narrow screen has to slide left to stay on the page — so
  // the tail tracks the character rather than sitting at the bubble's middle.
  const characterCentre = restLeft + characterWidth / 2;
  const bubbleLeft = useMemo(() => {
    if (bubbleWidth === 0) return characterCentre;
    const gutter = BUBBLE_GUTTER;
    const ideal = characterCentre - bubbleWidth / 2;
    return Math.min(
      Math.max(ideal, gutter),
      Math.max(gutter, viewportWidth - bubbleWidth - gutter),
    );
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

  const tilt = lean.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', `${SPEAK_TILT_DEG}deg`],
  });

  return (
    <Pressable
      ref={pressableRef}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? line}
      accessibilityHint={t(
        !speechReady || !lineFullyRevealed
          ? 'characterSpeech.a11y.showFullLine'
          : lastLine
            ? 'awardsCeremony.a11y.tapAnywhereToFinish'
            : 'characterSpeech.a11y.nextLine',
      )}
      accessibilityViewIsModal={focusOnMount}
      onAccessibilityEscape={handleAccessibilityEscape ? advance : undefined}
      onPress={advance}
      style={StyleSheet.absoluteFill}
    >
      <View
        testID="character-speech-visual-viewport"
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.visualViewport]}
      >
        {phase === 'speaking' ? (
          <Animated.View
            onLayout={onBubbleLayout}
            style={[
              styles.bubble,
              {
                bottom: bubbleBottom,
                // Never paint an unmeasured bubble, whatever `pop` is doing.
                opacity: bubbleMeasured ? pop : 0,
                // Placement is a transform, not a layout position — see
                // `styles.bubble`. `translateX` first, so `pop` still scales the
                // bubble about its own middle wherever it has come to rest.
                transform: [{ translateX: bubbleLeft }, { scale: pop }],
                maxWidth: bubbleMaxWidth,
              },
            ]}
          >
            {heading === undefined ? null : (
              <Text
                style={[
                  styles.bubbleHeading,
                  bubbleScale === 1
                    ? null
                    : {
                        fontSize: (BUBBLE_FONT_SIZE - 1) * bubbleScale,
                        lineHeight: (BUBBLE_LINE_HEIGHT - 2) * bubbleScale,
                      },
                ]}
              >
                {heading}
              </Text>
            )}
            <Text
              style={[
                styles.bubbleText,
                bubbleScale === 1
                  ? null
                  : {
                      fontSize: BUBBLE_FONT_SIZE * bubbleScale,
                      lineHeight: BUBBLE_LINE_HEIGHT * bubbleScale,
                    },
              ]}
            >
              <RevealingLine
                characters={lineCharacters}
                line={line}
                lineIndex={lineIndex}
                revealRef={revealRef}
                subscribe={subscribeToReveal}
                typing={typewriter && !reduce}
              />
            </Text>
            <SpeechBubbleTail left={tailLeft} />
          </Animated.View>
        ) : null}

        {hideCharacter ? null : (
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
            {renderCharacter === undefined
              ? children
              : renderCharacter({ phase, walking })}
          </Animated.View>
        )}

        {hideCharacter ? null : (
          <Animated.View
            style={[
              styles.groundShadow,
              {
                bottom: groundOffset - 2,
                width: characterWidth * 0.62,
                transform: [
                  { translateX: Animated.add(travel, characterWidth * 0.19) },
                ],
              },
            ]}
          />
        )}
      </View>

      {lines.length > 1 ? (
        <View pointerEvents="none" style={styles.progressRow}>
          {lines.map((_, index) => (
            <View
              key={index}
              style={[
                styles.progressDot,
                index === lineIndex ? styles.progressDotOn : null,
              ]}
            />
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // The character starts and ends beyond the right edge. Web includes transformed
  // descendants in page overflow unless the full-screen visual layer clips them.
  // Keep clipping off the Pressable itself so its input and modal semantics still
  // cover the complete screen.
  visualViewport: { overflow: 'hidden' },
  character: { position: 'absolute', left: 0 },
  groundShadow: {
    position: 'absolute',
    left: 0,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(36,31,46,0.22)',
  },
  /**
   * Pinned to the left edge and carried across by a transform, which is the
   * whole reason a long line reads as a paragraph rather than a column.
   *
   * An absolutely positioned box with no width of its own sizes to its content,
   * but only within what is left of the row it is placed on: the space from its
   * own `left` to the far edge. Positioning it at the character — four fifths of
   * the way across — therefore left about 75pt to break the words into, and
   * because `left` was itself computed from the measured width, every pass
   * narrowed the space the next one had to measure in. The width settled
   * wherever the wrap stopped changing, around 166pt on a 375pt phone, whatever
   * the line said. A transform moves the drawn bubble without moving the box it
   * was measured in, so the only limit on the width is `maxWidth`.
   *
   * Worth knowing if this ever comes back: the same loop looks milder in a
   * browser, where the box refills the space it is given and so creeps a gutter
   * wider on every pass instead of stopping. The phone is the honest instrument
   * here, because native measures a paragraph to its longest line.
   */
  bubble: {
    ...speechBubbleStyles.box,
    position: 'absolute',
    left: 0,
  },
  bubbleText: speechBubbleStyles.text,
  unrevealedText: { color: 'transparent' },
  bubbleHeading: {
    color: '#c22f2c',
    fontSize: BUBBLE_FONT_SIZE - 1,
    lineHeight: BUBBLE_LINE_HEIGHT - 2,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 5,
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
