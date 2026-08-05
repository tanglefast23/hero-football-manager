import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, PixelRatio, StyleSheet, Text, View } from 'react-native';
import { formatCurrency } from './Scorecard';

/**
 * The slot-machine amount: every digit is a vertical reel that cycles fast
 * while spinning and clicks into place left-to-right on the land. The sign,
 * `$`, and commas stay static. The reel always lands on the true saved amount
 * — value and phase come from the statement machine, never from local guesses.
 *
 * The track holds TWO full 0-9 cycles plus a closing zero so a settle can
 * always roll UPWARD from any previous digit to any target digit (the
 * odometer rule) without ever exposing a blank frame.
 */

export type SlotTone = 'income' | 'expense' | 'neutral';
export type SlotPhase = 'pending' | 'spinning' | 'settled';
export type SlotSettleMode = 'land' | 'odometer' | 'adjacency' | 'instant';

export interface SlotAmountProps {
  /** What the reel settles to now (base, multiplied, or final). */
  value: number;
  /** The row's FINAL amount — reserves layout width from the first frame. */
  finalValue: number;
  phase: SlotPhase;
  settleMode: SlotSettleMode;
  /** Bumped by the machine to re-run the settle animation for a new value. */
  settleKey: number;
  /** Total duration for odometer/adjacency modes, from MachineTimings. */
  settleDurationMs?: number;
  tone: SlotTone;
  surge: boolean;
  large?: boolean;
  reduceMotion: boolean;
  /** Fires once per settleKey when the settle fully completes (pop included). */
  onSettled?: (settleKey: number) => void;
}

const TONE_COLORS: Record<SlotTone, string> = {
  income: '#265b30',
  expense: '#a83440',
  neutral: '#241f2e',
};
const SURGE_SETTLED_COLOR = '#b45309';
const SURGE_FLICKER = ['#b45309', '#dc2626', '#f59e0b'];
/** 55% alpha suffix for spinning digits (reduced saturation until the land). */
const SPIN_ALPHA = '8C';

const TRACK_DIGITS = [...'0123456789', ...'0123456789', '0'];
const CYCLE = 10;

/** Silkscreen digit advance ≈ 0.8em; a fixed cell keeps the reels from jittering. */
const DIGIT_EM = 0.8;
const SPIN_CYCLE_MS = 260;
const LAND_MS_PER_DIGIT = 90;
const LAND_STAGGER_MS = 30;
const POP_MS = 120;

export function SlotAmount({
  value,
  finalValue,
  phase,
  settleMode,
  settleKey,
  settleDurationMs = 200,
  tone,
  surge,
  large = false,
  reduceMotion,
  onSettled,
}: SlotAmountProps) {
  const fontScale = PixelRatio.getFontScale();
  const baseSize = (large ? 18 : 14) * fontScale;
  const surgeSettled = surge && phase === 'settled';
  const fontSize = surgeSettled ? baseSize + 2 * fontScale : baseSize;
  const lineHeight = Math.ceil(fontSize * 1.3);
  const digitWidth = Math.ceil(fontSize * DIGIT_EM);
  const formatted = formatCurrency(value, true);
  const sizing = formatCurrency(finalValue, true);
  const color = surgeSettled ? SURGE_SETTLED_COLOR : TONE_COLORS[tone];
  const fontClass = surgeSettled ? 'font-pixel' : 'font-mono';

  const reels = useRef<Animated.Value[]>([]).current;
  const loops = useRef<Animated.CompositeAnimation[]>([]).current;
  const popScale = useRef(new Animated.Value(1)).current;
  const previousDigits = useRef<number[]>([]);
  const settledKeys = useRef(new Set<number>());
  const onSettledRef = useRef(onSettled);
  onSettledRef.current = onSettled;
  const [flickerColor, setFlickerColor] = useState<string | null>(null);

  const digitChars = formatted.split('').filter(char => char >= '0' && char <= '9');
  while (reels.length < digitChars.length) reels.push(new Animated.Value(0));

  // The surge flicker: three warm colors cycling while the reels spin.
  useEffect(() => {
    if (!surge || phase !== 'spinning' || reduceMotion) {
      setFlickerColor(null);
      return undefined;
    }
    let step = 0;
    setFlickerColor(SURGE_FLICKER[0]);
    const interval = setInterval(() => {
      step += 1;
      setFlickerColor(SURGE_FLICKER[step % SURGE_FLICKER.length]);
    }, 130);
    return () => clearInterval(interval);
  }, [surge, phase, reduceMotion]);

  useEffect(() => {
    if (reduceMotion) {
      if (!settledKeys.current.has(settleKey)) {
        settledKeys.current.add(settleKey);
        onSettledRef.current?.(settleKey);
      }
      return undefined;
    }

    const stopLoops = () => {
      for (const loop of loops) loop.stop();
      loops.length = 0;
    };

    if (phase === 'spinning') {
      stopLoops();
      reels.forEach((reel, index) => {
        reel.setValue(-(index % CYCLE) * lineHeight);
        const loop = Animated.loop(Animated.timing(reel, {
          toValue: -CYCLE * lineHeight - (index % CYCLE) * lineHeight,
          duration: SPIN_CYCLE_MS,
          easing: Easing.linear,
          useNativeDriver: true,
        }));
        loops.push(loop);
        loop.start();
      });
      return stopLoops;
    }

    if (phase !== 'settled' || settledKeys.current.has(settleKey)) return undefined;
    settledKeys.current.add(settleKey);
    stopLoops();

    const digits = digitChars.map(char => Number(char));
    if (settleMode === 'instant') {
      digits.forEach((digit, index) => {
        reels[index]?.setValue(-(CYCLE + digit) * lineHeight);
      });
      previousDigits.current = digits;
      onSettledRef.current?.(settleKey);
      return undefined;
    }

    const animations = digits.map((digit, index) => {
      const reel = reels[index];
      const targetIndex = CYCLE + digit;
      const previous = previousDigits.current[index];
      // Upward-only roll: start below the target by the digit delta (or a
      // short three-step roll when there is no meaningful previous digit).
      const delta = previous === undefined || settleMode === 'land'
        ? 3
        : (((digit - previous) % CYCLE) + CYCLE) % CYCLE || CYCLE;
      reel.setValue(-(targetIndex - delta) * lineHeight);
      return Animated.timing(reel, {
        toValue: -targetIndex * lineHeight,
        duration: settleMode === 'land' ? LAND_MS_PER_DIGIT : settleDurationMs,
        delay: settleMode === 'land' ? index * LAND_STAGGER_MS : 0,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      });
    });
    previousDigits.current = digits;

    const settle = Animated.parallel(animations);
    const sequence = settleMode === 'land'
      ? Animated.sequence([
          settle,
          Animated.sequence([
            Animated.timing(popScale, { toValue: 1.06, duration: POP_MS / 2, useNativeDriver: true }),
            Animated.timing(popScale, { toValue: 1, duration: POP_MS / 2, useNativeDriver: true }),
          ]),
        ])
      : settle;
    sequence.start(({ finished }) => {
      if (finished) onSettledRef.current?.(settleKey);
    });
    return () => sequence.stop();
    // digitChars derives from value, which settleKey already tracks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, settleKey, settleMode, reduceMotion, lineHeight]);

  if (reduceMotion || phase === 'pending') {
    return (
      <View style={{ alignItems: 'flex-end' }}>
        <Text
          className={fontClass}
          style={{ fontSize, lineHeight, color, opacity: phase === 'pending' ? 0 : 1 }}
          importantForAccessibility="no"
        >
          {sizing}
        </Text>
        {phase === 'pending' ? (
          <Text
            className="font-mono"
            style={[StyleSheet.absoluteFill as object, {
              fontSize,
              lineHeight,
              color: `${TONE_COLORS[tone]}4D`,
              textAlign: 'right',
            }]}
            importantForAccessibility="no"
          >
            {'$...'}
          </Text>
        ) : null}
      </View>
    );
  }

  const digitColor = phase === 'spinning'
    ? (flickerColor ?? `${TONE_COLORS[tone]}${SPIN_ALPHA}`)
    : color;
  let digitIndex = -1;

  return (
    <View style={{ alignItems: 'flex-end' }}>
      <Text
        className={fontClass}
        style={{ fontSize, lineHeight, opacity: 0 }}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        {sizing}
      </Text>
      <Animated.View
        style={[StyleSheet.absoluteFill as object, {
          flexDirection: 'row',
          justifyContent: 'flex-end',
          alignItems: 'center',
          transform: [{ scale: popScale }],
        }]}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        {formatted.split('').map((char, charIndex) => {
          if (char < '0' || char > '9') {
            return (
              <Text
                key={`static-${charIndex}`}
                className={fontClass}
                style={{ fontSize, lineHeight, color: digitColor }}
              >
                {char}
              </Text>
            );
          }
          digitIndex += 1;
          const reel = reels[digitIndex];
          return (
            <View
              key={`digit-${charIndex}`}
              style={{ width: digitWidth, height: lineHeight, overflow: 'hidden' }}
            >
              <Animated.View style={{ transform: [{ translateY: reel }] }}>
                {TRACK_DIGITS.map((trackChar, trackIndex) => (
                  <Text
                    key={trackIndex}
                    className={fontClass}
                    style={{
                      fontSize,
                      lineHeight,
                      height: lineHeight,
                      color: digitColor,
                      textAlign: 'center',
                    }}
                  >
                    {trackChar}
                  </Text>
                ))}
              </Animated.View>
            </View>
          );
        })}
      </Animated.View>
    </View>
  );
}
