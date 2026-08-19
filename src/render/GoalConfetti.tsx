// The goal burst: colourful paper all over the screen, a short drop, then gone.
// Deliberately NOT drawn in the match's Skia canvas — that canvas is sized to
// the pitch and lives under a camera group whose scale is ~0.03, so anything
// authored for the screen comes out invisible there (the screen-space trap).
// Plain absolutely-positioned Views over the whole root instead, on the same
// one-Animated.Value-drives-every-piece pattern the podium confetti uses.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { GOAL_CONFETTI_MS, makeGoalConfetti } from './goal-confetti';

interface GoalConfettiProps {
  /** Bumped once per goal. 0 means "no goal yet"; a change restarts the burst. */
  readonly burstId: number;
  readonly width: number;
  readonly height: number;
}

export function GoalConfetti({ burstId, width, height }: GoalConfettiProps) {
  const progress = useRef(new Animated.Value(0)).current;
  // Nothing is mounted between goals: 120 idle Views on every sim tick is a
  // cost the rest of the match should not pay for a 2.2s effect.
  const [live, setLive] = useState(false);
  const pieces = useMemo(
    () => makeGoalConfetti(width, height),
    [width, height],
  );

  useEffect(() => {
    if (burstId === 0) return undefined;
    progress.setValue(0);
    setLive(true);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: GOAL_CONFETTI_MS,
      easing: Easing.linear,
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished) setLive(false);
    });
    return () => animation.stop();
  }, [burstId, progress]);

  if (!live) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((piece) => (
        <Animated.View
          key={piece.id}
          style={[
            styles.piece,
            {
              left: piece.left,
              top: piece.top,
              width: piece.width,
              height: piece.height,
              backgroundColor: piece.color,
              opacity: progress.interpolate({
                inputRange: [0, 0.04, 0.6, 1],
                outputRange: [0, 1, 1, 0],
              }),
              transform: [
                {
                  // The driver is linear, so the fall is shaped here: most of
                  // the drop early, easing out as it fades.
                  translateY: progress.interpolate({
                    inputRange: [0, 0.08, 0.4, 1],
                    outputRange: [0, 0, piece.drop * 0.55, piece.drop],
                  }),
                },
                {
                  scale: progress.interpolate({
                    inputRange: [0, 0.08, 1],
                    outputRange: [0.2, 1, 1],
                  }),
                },
                {
                  rotate: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', piece.spin],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  piece: { position: 'absolute' },
});
