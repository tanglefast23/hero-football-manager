import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

export interface LockedPlanConfirmation {
  drillNames: readonly string[];
  playerCount: number;
}

const INTRO_MS = 180;
const HOLD_MS = 1_500;
const FADE_MS = 500;
const REDUCED_MOTION_MS = 900;

export function PlanLockedConfirmation({
  confirmation,
  reduceMotion,
  onComplete,
}: {
  confirmation: LockedPlanConfirmation;
  reduceMotion: boolean;
  onComplete: () => void;
}) {
  const opacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const scale = useRef(new Animated.Value(reduceMotion ? 1 : 0.94)).current;

  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(1);
      scale.setValue(1);
      const timer = setTimeout(onComplete, REDUCED_MOTION_MS);
      return () => clearTimeout(timer);
    }

    opacity.setValue(0);
    scale.setValue(0.94);
    const animation = Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: INTRO_MS,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: INTRO_MS,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(HOLD_MS),
      Animated.timing(opacity, {
        toValue: 0,
        duration: FADE_MS,
        useNativeDriver: true,
      }),
    ]);
    animation.start(({ finished }) => {
      if (finished) onComplete();
    });
    return () => animation.stop();
  }, [onComplete, opacity, reduceMotion, scale]);

  const playerLabel = `${confirmation.playerCount} player${confirmation.playerCount === 1 ? '' : 's'} assigned`;
  const accessibilityLabel = `Weekly plan locked. ${confirmation.drillNames.join(', ')}. ${playerLabel}.`;

  return (
    <Animated.View
      accessibilityViewIsModal
      accessibilityLiveRegion="assertive"
      accessibilityLabel={accessibilityLabel}
      style={[styles.overlay, { opacity }]}
    >
      <Animated.View style={[styles.cardShadow, { transform: [{ scale }] }]}>
        <View style={styles.card}>
          <View style={styles.highlight} />
          <View style={styles.titleBar}>
            <Text style={styles.kicker}>WEEKLY PLAN</Text>
            <Text style={styles.status}>LOCKED</Text>
          </View>
          <View style={styles.body}>
            <Text style={styles.title}>PLAN LOCKED!</Text>
            <View style={styles.rule} />
            <View style={styles.drillList}>
              {confirmation.drillNames.map(drillName => (
                <View key={drillName} style={styles.drillRow}>
                  <View style={styles.checkBox}>
                    <Text style={styles.check}>✓</Text>
                  </View>
                  <Text style={styles.drillName}>{drillName.toUpperCase()}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.playerCount}>{playerLabel.toUpperCase()}</Text>
          </View>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 70,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(36,31,46,0.36)',
  },
  cardShadow: {
    width: '100%',
    maxWidth: 400,
    paddingRight: 7,
    paddingBottom: 7,
    backgroundColor: '#241f2e',
  },
  card: {
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#241f2e',
    backgroundColor: '#f4f1ea',
  },
  highlight: {
    height: 5,
    backgroundColor: '#f7d894',
  },
  titleBar: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    backgroundColor: '#c8862a',
  },
  kicker: {
    fontFamily: 'Silkscreen_700Bold',
    fontSize: 13,
    color: '#ffffff',
  },
  status: {
    fontFamily: 'Silkscreen_400Regular',
    fontSize: 11,
    color: '#ffffff',
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 18,
  },
  title: {
    textAlign: 'center',
    fontFamily: 'Silkscreen_700Bold',
    fontSize: 21,
    color: '#241f2e',
  },
  rule: {
    height: 2,
    marginTop: 14,
    backgroundColor: '#c9c5d0',
  },
  drillList: {
    gap: 9,
    marginTop: 15,
  },
  drillRow: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#241f2e',
    backgroundColor: '#ffffff',
  },
  checkBox: {
    width: 38,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 2,
    borderRightColor: '#241f2e',
    backgroundColor: '#edb54a',
  },
  check: {
    fontFamily: 'Silkscreen_700Bold',
    fontSize: 17,
    color: '#241f2e',
  },
  drillName: {
    flex: 1,
    paddingHorizontal: 12,
    fontFamily: 'Silkscreen_700Bold',
    fontSize: 14,
    color: '#241f2e',
  },
  playerCount: {
    marginTop: 15,
    textAlign: 'center',
    fontFamily: 'Silkscreen_400Regular',
    fontSize: 11,
    color: '#3f6fb5',
  },
});
