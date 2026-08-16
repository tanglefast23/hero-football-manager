import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useCopy, usePixelStyles, type LocaleFaces } from '../../i18n';
import { TitleMatchSprite } from './TitleMatchSprite';
import type { TitleSpriteBaseKey } from './title-sprite-keys';

interface WebPopHero {
  readonly spriteKey: TitleSpriteBaseKey;
  readonly powerLabelKey: string;
  readonly color: string;
  readonly targetSpriteKey?: TitleSpriteBaseKey;
}

const HEROES: readonly WebPopHero[] = [
  {
    spriteKey: 'u:f21:run0',
    powerLabelKey: 'titlePlayerPop.bubble.flameOn',
    color: '#ed6a3a',
    targetSpriteKey: 'r:f09:run0',
  },
  {
    spriteKey: 'u:f73:run0',
    powerLabelKey: 'titlePlayerPop.bubble.missMe',
    color: '#8f7be8',
  },
  {
    spriteKey: 'u:g14:ready0',
    powerLabelKey: 'titlePlayerPop.bubble.youreAllAnts',
    color: '#e8c85a',
  },
  {
    spriteKey: 'u:f45:run0',
    powerLabelKey: 'titlePlayerPop.bubble.feelTheThunder',
    color: '#62b5f2',
    targetSpriteKey: 'r:f18:run0',
  },
];

export function TitlePlayerPopScene({
  reduceMotion = false,
}: {
  readonly reduceMotion?: boolean;
}) {
  const t = useCopy();
  const styles = usePixelStyles(makeStyles);
  const [appearance, setAppearance] = useState(0);
  const showNextHero = useCallback(
    () => setAppearance((current) => current + 1),
    [],
  );
  const hero = HEROES[appearance % HEROES.length];
  const progress = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(1);
      return undefined;
    }
    progress.setValue(0);
    const animation = Animated.sequence([
      Animated.spring(progress, {
        toValue: 1,
        damping: 7,
        stiffness: 180,
        mass: 0.75,
        useNativeDriver: true,
      }),
      Animated.delay(3_200),
      Animated.timing(progress, {
        toValue: 0,
        duration: 280,
        easing: Easing.in(Easing.back(1.1)),
        useNativeDriver: true,
      }),
    ]);
    animation.start(({ finished }) => {
      if (finished) showNextHero();
    });
    return () => animation.stop();
  }, [appearance, progress, reduceMotion, showNextHero]);

  return (
    <View
      accessibilityLabel={t('titlePlayerPop.a11y.scene')}
      style={styles.scene}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.popSlot,
          {
            opacity: progress,
            transform: [
              {
                translateY: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [174, 0],
                }),
              },
              { rotate: appearance % 2 === 0 ? '-2deg' : '3deg' },
            ],
          },
        ]}
      >
        <View style={styles.powerBubble}>
          <Text style={styles.powerBubbleText}>{t(hero.powerLabelKey)}</Text>
        </View>
        <View style={styles.artRow}>
          {hero.targetSpriteKey ? (
            <View style={styles.target}>
              <TitleMatchSprite spriteKey={hero.targetSpriteKey} scale={3} />
            </View>
          ) : null}
          <View style={[styles.pixelBurst, { backgroundColor: hero.color }]} />
          <View
            style={[styles.pixelBurstSmall, { backgroundColor: hero.color }]}
          />
          <TitleMatchSprite spriteKey={hero.spriteKey} scale={4} />
        </View>
      </Animated.View>
    </View>
  );
}

const makeStyles = (faces: LocaleFaces) =>
  StyleSheet.create({
    scene: { height: 250, overflow: 'visible', position: 'relative' },
    popSlot: {
      position: 'absolute',
      bottom: 12,
      left: '50%',
      width: 196,
      marginLeft: -98,
      alignItems: 'center',
    },
    artRow: { position: 'relative', alignItems: 'center' },
    target: { position: 'absolute', right: -52, bottom: 2, opacity: 0.86 },
    pixelBurst: {
      position: 'absolute',
      width: 112,
      height: 112,
      bottom: 2,
      opacity: 0.32,
      transform: [{ rotate: '45deg' }],
    },
    pixelBurstSmall: {
      position: 'absolute',
      width: 68,
      height: 68,
      bottom: 24,
      opacity: 0.52,
      transform: [{ rotate: '45deg' }],
    },
    powerBubble: {
      zIndex: 5,
      maxWidth: 194,
      marginBottom: 6,
      borderWidth: 3,
      borderColor: '#17131e',
      backgroundColor: '#f4ead0',
      paddingHorizontal: 10,
      paddingVertical: 7,
      transform: [{ rotate: '-1deg' }],
    },
    powerBubbleText: {
      color: '#17131e',
      fontFamily: faces.display,
      fontSize: 13,
      lineHeight: 17,
      textAlign: 'center',
      textTransform: 'uppercase',
    },
  });
