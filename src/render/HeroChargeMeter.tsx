import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useCopy } from '../i18n';
import {
  CHARGE_BAND_WIDTH,
  CHARGE_FILL_COLOR,
  CHARGE_RAINBOW_CYCLE_MS,
  CHARGE_RAINBOW_CYCLE_WIDTH,
  chargeMeterAccessibilityLabel,
  rainbowStripBands,
  type ChargeMeter,
} from './hero-charge-meter';

export interface HeroChargeMeterProps {
  meter: ChargeMeter;
  /** Content width of the carrier card — the strip is sized in real pixels. */
  trackWidth: number;
  reduceMotion: boolean;
}

/**
 * A hero carrier's banked Heat, under their energy bar on the possession card.
 * Blue while it fills; a sliding rainbow strip for the whole Zone window; empty
 * again once the power is spent.
 */
export function HeroChargeMeter({ meter, trackWidth, reduceMotion }: HeroChargeMeterProps) {
  const t = useCopy();
  const slide = useRef(new Animated.Value(0)).current;
  const ready = meter.state === 'ready';

  useEffect(() => {
    if (!ready || reduceMotion) {
      slide.setValue(0);
      return;
    }
    const animation = Animated.loop(
      Animated.timing(slide, {
        toValue: 1,
        duration: CHARGE_RAINBOW_CYCLE_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [ready, reduceMotion, slide]);

  // Travelling from one cycle behind to zero moves the colours rightwards while
  // the strip still covers the track at both ends of the loop.
  const travel = slide.interpolate({
    inputRange: [0, 1],
    outputRange: [-CHARGE_RAINBOW_CYCLE_WIDTH, 0],
  });

  return (
    <View
      accessible
      accessibilityLabel={chargeMeterAccessibilityLabel(meter, t)}
      style={styles.track}
    >
      {ready ? (
        <Animated.View style={[styles.strip, { transform: [{ translateX: travel }] }]}>
          {rainbowStripBands(trackWidth).map((color, index) => (
            <View key={index} style={[styles.band, { backgroundColor: color }]} />
          ))}
        </Animated.View>
      ) : (
        <View style={[styles.fill, { width: `${Math.round(meter.fill * 100)}%` }]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 4, marginTop: 4, backgroundColor: '#3a3350', overflow: 'hidden' },
  fill: { height: 4, backgroundColor: CHARGE_FILL_COLOR },
  strip: { flexDirection: 'row', height: 4 },
  band: { width: CHARGE_BAND_WIDTH, height: 4 },
});
