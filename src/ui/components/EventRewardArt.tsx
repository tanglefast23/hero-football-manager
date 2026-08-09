import { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { usePixelStyles, type LocaleFaces } from '../../i18n';
import { Canvas, Rect } from '@shopify/react-native-skia';
import type { StoryEventRewardViewModel } from '../models';
import { EVENT_SPRITE_CELL, eventSpriteRuns } from '../event-pixel-art';

const REWARD_SCALE = 5;
const REWARD_SIZE = EVENT_SPRITE_CELL * REWARD_SCALE;

const SPRITE_BY_KIND: Readonly<
  Record<StoryEventRewardViewModel['kind'], string>
> = {
  money: 'money-bag',
  morale: 'party-hat',
  fans: 'supporters',
  'training-points': 'cone',
  stat: 'trophy',
  injury: 'tape-roll',
  story: 'star-sparkle',
};

export function EventRewardArt({
  reward,
  index,
  celebrate,
  reduceMotion = false,
}: {
  reward: StoryEventRewardViewModel;
  index: number;
  celebrate: boolean;
  reduceMotion?: boolean;
}) {
  const styles = usePixelStyles(makeStyles);
  const progress = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const spriteId = SPRITE_BY_KIND[reward.kind];
  const runs = useMemo(() => eventSpriteRuns(spriteId), [spriteId]);

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(1);
      return undefined;
    }
    progress.setValue(0);
    const animation = Animated.spring(progress, {
      toValue: 1,
      delay: 160 + index * 110,
      damping: 8,
      stiffness: celebrate ? 180 : 130,
      mass: 0.62,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [celebrate, index, progress, reduceMotion]);

  return (
    <Animated.View
      accessible
      accessibilityLabel={reward.label}
      style={[
        styles.card,
        reward.positive ? styles.cardPositive : styles.cardNegative,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [18, 0],
                extrapolate: 'clamp',
              }),
            },
            {
              scale: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0.72, 1],
                extrapolate: 'clamp',
              }),
            },
          ],
        },
      ]}
    >
      <View style={styles.artFrame}>
        <Canvas style={{ width: REWARD_SIZE, height: REWARD_SIZE }}>
          {runs.map((run) => (
            <Rect
              key={run.id}
              x={run.x * REWARD_SCALE}
              y={run.y * REWARD_SCALE}
              width={run.width * REWARD_SCALE}
              height={REWARD_SCALE}
              color={run.color}
            />
          ))}
        </Canvas>
      </View>
      <Text
        style={[
          styles.label,
          reward.positive ? styles.labelPositive : styles.labelNegative,
        ]}
      >
        {reward.label}
      </Text>
    </Animated.View>
  );
}

export function EventPixelConfetti({
  progress,
  reduceMotion,
}: {
  progress: Animated.Value;
  reduceMotion: boolean;
}) {
  if (reduceMotion) return null;
  const pieces = Array.from({ length: 12 }, (_, index) => ({
    left: `${8 + ((index * 17) % 84)}%` as `${number}%`,
    distance: 70 + (index % 4) * 22,
    color: ['#edb54a', '#f7d894', '#5a8fd6', '#d94f52'][index % 4],
    delay: (index % 3) * 0.08,
  }));
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((piece, index) => (
        <Animated.View
          key={index}
          style={{
            position: 'absolute',
            left: piece.left,
            top: 4 + (index % 2) * 18,
            width: index % 2 === 0 ? 7 : 5,
            height: index % 2 === 0 ? 7 : 10,
            backgroundColor: piece.color,
            opacity: progress.interpolate({
              inputRange: [0, Math.min(0.7, 0.18 + piece.delay), 1],
              outputRange: [0, 1, 0],
              extrapolate: 'clamp',
            }),
            transform: [
              {
                translateY: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-12, piece.distance],
                  extrapolate: 'clamp',
                }),
              },
              {
                rotate: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', `${index % 2 === 0 ? 180 : -180}deg`],
                  extrapolate: 'clamp',
                }),
              },
            ],
          }}
        />
      ))}
    </View>
  );
}

const makeStyles = (faces: LocaleFaces) =>
  StyleSheet.create({
    card: {
      minWidth: 132,
      flexGrow: 1,
      flexBasis: 132,
      alignItems: 'center',
      borderWidth: 2,
      borderBottomWidth: 5,
      paddingHorizontal: 10,
      paddingVertical: 10,
    },
    cardPositive: {
      borderColor: '#c8862a',
      backgroundColor: '#f7d894',
    },
    cardNegative: {
      borderColor: '#a83440',
      backgroundColor: '#f2938c',
    },
    artFrame: {
      width: REWARD_SIZE,
      height: REWARD_SIZE,
      overflow: 'hidden',
    },
    label: {
      marginTop: 7,
      textAlign: 'center',
      fontFamily: faces.display,
      fontSize: 14,
      lineHeight: 19,
      textTransform: 'uppercase',
    },
    labelPositive: {
      color: '#241f2e',
    },
    labelNegative: {
      color: '#a83440',
    },
  });
