import { useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SfxPressable as Pressable } from '../ui/components/SfxPressable';
import {
  CUP_TITLE_CARD_BALL_MS,
  cupTitleBallFlight,
  type CupTitleCardModel,
} from './cup-title-card';
import { usePixelStyles, type LocaleFaces } from '../i18n';

/** Ball diameter in points, and how high the lob rises over the plaque. */
const BALL_SIZE = 24;
const ARC_HEIGHT = 64;
/**
 * Animated.interpolate takes ranges, not curves, so the parabola is sampled.
 * Thirteen frames is smooth at this size and keeps the output arrays short.
 */
const BALL_FRAMES = Array.from({ length: 13 }, (_, index) => index / 12);
const BALL_PATH = BALL_FRAMES.map(cupTitleBallFlight);

export interface CupTitleCardProps {
  readonly card: CupTitleCardModel;
  /** Called once, on the hold's expiry or a tap. */
  readonly onDone: () => void;
}

/**
 * The opening card for a Hero Cup tie: big competition name, the round
 * underneath, and a ball lobbed across the screen behind them.
 *
 * The match is already paused when this mounts (MatchScreen holds the
 * 'title-card' reason), so the card delays kickoff without the clock running
 * behind it. Reduce Motion parks the ball off-screen and simply shows the
 * plaque, still long enough to read. A tap skips straight to kickoff.
 */
export function CupTitleCard({ card, onDone }: CupTitleCardProps) {
  const styles = usePixelStyles(makeStyles);
  const { width } = useWindowDimensions();
  const narrow = width < 380;
  // Under Reduce Motion the value starts past the end of the flight, so the
  // ball is off-screen and nothing ever animates.
  const flight = useRef(new Animated.Value(card.showBall ? 0 : 1)).current;
  const finished = useRef(false);

  const finishOnce = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    onDone();
  }, [onDone]);

  useEffect(() => {
    const hold = setTimeout(finishOnce, card.durationMs);
    if (!card.showBall) return () => clearTimeout(hold);

    const crossing = Animated.timing(flight, {
      toValue: 1,
      duration: CUP_TITLE_CARD_BALL_MS,
      easing: Easing.linear,
      useNativeDriver: true,
    });
    crossing.start();
    return () => {
      clearTimeout(hold);
      crossing.stop();
    };
  }, [card.durationMs, card.showBall, finishOnce, flight]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${card.accessibilityLabel} Tap to kick off.`}
      onPress={finishOnce}
      style={styles.overlay}
    >
      {card.showBall ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ballTrack,
            {
              transform: [
                {
                  translateX: flight.interpolate({
                    inputRange: BALL_FRAMES,
                    outputRange: BALL_PATH.map(point => point.x * width),
                  }),
                },
                {
                  translateY: flight.interpolate({
                    inputRange: BALL_FRAMES,
                    outputRange: BALL_PATH.map(point => point.y * ARC_HEIGHT),
                  }),
                },
                {
                  rotate: flight.interpolate({
                    inputRange: BALL_FRAMES,
                    outputRange: BALL_PATH.map(point => `${Math.round(point.spin)}deg`),
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.ball}>
            <View style={[styles.ballPatch, styles.ballPatchCenter]} />
            <View style={[styles.ballPatch, styles.ballPatchTop]} />
            <View style={[styles.ballPatch, styles.ballPatchBottom]} />
          </View>
        </Animated.View>
      ) : null}

      <View style={styles.plaque}>
        <View style={styles.plaqueHighlight} />
        <Text style={[styles.title, narrow ? styles.titleNarrow : null]} numberOfLines={1}>
          {card.title}
        </Text>
        <View style={styles.rule} />
        <Text style={styles.round} numberOfLines={1}>{card.roundLabel}</Text>
      </View>
    </Pressable>
  );
}

// Palette from the pixel bible (docs/11): ink #241f2e canvas, ink-soft #3a3350
// plaque face, cream #f4f1ea text, hero gold #edb54a for the one thing that
// should shout. Chunky 4px ink outline with a heavier bottom lip, per Track A.
const makeStyles = (faces: LocaleFaces) => StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    // Above every match overlay: banners sit at 8, the guided coach button at 50.
    zIndex: 60,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(36, 31, 46, 0.95)',
    paddingHorizontal: 16,
  },
  // Anchored off-screen left; the flight translates it across the full width.
  ballTrack: {
    position: 'absolute',
    left: -BALL_SIZE / 2,
    top: '32%',
  },
  ball: {
    width: BALL_SIZE,
    height: BALL_SIZE,
    borderRadius: BALL_SIZE / 2,
    borderWidth: 2,
    borderColor: '#241f2e',
    backgroundColor: '#f4f1ea',
  },
  ballPatch: { position: 'absolute', width: 6, height: 6, backgroundColor: '#241f2e' },
  ballPatchCenter: { top: 7, left: 7 },
  ballPatchTop: { top: 0, left: 13 },
  ballPatchBottom: { bottom: 1, left: 2 },
  plaque: {
    overflow: 'hidden',
    alignItems: 'center',
    backgroundColor: '#3a3350',
    borderWidth: 4,
    borderColor: '#241f2e',
    borderBottomWidth: 8,
    borderRadius: 4,
    paddingHorizontal: 32,
    paddingTop: 24,
    paddingBottom: 24,
  },
  plaqueHighlight: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 8,
    backgroundColor: '#49415f',
  },
  title: {
    fontFamily: faces.display,
    color: '#edb54a',
    fontSize: 42,
    letterSpacing: 2,
    textShadowColor: '#241f2e',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 0,
  },
  titleNarrow: { fontSize: 30 },
  rule: { alignSelf: 'stretch', height: 4, marginVertical: 16, backgroundColor: '#edb54a' },
  round: {
    fontFamily: faces.display,
    color: '#f4f1ea',
    fontSize: 16,
    letterSpacing: 3,
  },
});
