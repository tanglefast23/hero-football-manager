import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Canvas } from '@shopify/react-native-skia';
import type { PowerId } from '../../sim/types';
import { livePowerEffectActors } from '../../render/live-power-effect-actors';
import { PowerEffectScene } from '../../render/PowerEffectScene';
import { powerEffectDescriptor } from '../../render/power-effect-descriptors';
import { TitleMatchSprite } from './TitleMatchSprite';
import { usePixelStyles, type LocaleFaces } from '../../i18n';

interface PopHero {
  readonly spriteKey: string;
  readonly name: string;
  readonly power: PowerId;
  readonly powerLabel: string;
  readonly targetSpriteKey?: string;
}

const OUTFIELD_HEROES: readonly PopHero[] = [
  {
    spriteKey: 'u:f12:run0',
    name: 'Zip Vela',
    power: 'SUPER_SPEED',
    powerLabel: 'CATCH ME!',
  },
  {
    spriteKey: 'u:f21:run0',
    name: 'Dario Flint',
    power: 'FIRE_TORCH',
    powerLabel: 'FLAME ON!',
    targetSpriteKey: 'r:f09:run0',
  },
  {
    spriteKey: 'u:f45:run0',
    name: 'Leo Quick',
    power: 'THUNDER_STRIKE',
    powerLabel: 'FEEL THE THUNDER!',
    targetSpriteKey: 'r:f18:run0',
  },
  {
    spriteKey: 'u:f73:run0',
    name: 'Ty Brooks',
    power: 'BLINK_RUN',
    powerLabel: 'MISS ME?',
  },
  {
    spriteKey: 'u:f31:run0',
    name: 'Ravi Chan',
    power: 'WEB_TRAP',
    powerLabel: 'STUCK WITH ME!',
    targetSpriteKey: 'r:f27:run0',
  },
  {
    spriteKey: 'u:f57:run0',
    name: 'Bo Hedges',
    power: 'SUPER_STRENGTH',
    powerLabel: 'MY BALL NOW!',
    targetSpriteKey: 'r:f34:run0',
  },
];

const KEEPER_HEROES: readonly PopHero[] = [
  {
    spriteKey: 'u:g08:ready0',
    name: 'Mia Stretch',
    power: 'ELASTIC_KEEPER',
    powerLabel: 'NOTHING GETS PAST ME!',
    targetSpriteKey: 'r:f39:run0',
  },
  {
    spriteKey: 'u:g14:ready0',
    name: 'Gus Tower',
    power: 'GIANT_GK',
    powerLabel: "YOU'RE ALL ANTS!",
  },
];

const HERO_SEQUENCE: readonly PopHero[] = [
  OUTFIELD_HEROES[1],
  OUTFIELD_HEROES[3],
  KEEPER_HEROES[1],
  OUTFIELD_HEROES[2],
  OUTFIELD_HEROES[4],
  OUTFIELD_HEROES[0],
  KEEPER_HEROES[0],
  OUTFIELD_HEROES[5],
];
const SOLO_POSITIONS = ['34%', '42%', '50%', '58%', '66%'] as const;

export function TitlePlayerPopScene({
  reduceMotion = false,
}: {
  readonly reduceMotion?: boolean;
}) {
  const styles = usePixelStyles(makeStyles);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [appearance, setAppearance] = useState(0);
  const showNextHero = useCallback(() => {
    setAppearance(current => current + 1);
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      setElapsedMs(2_100);
      return undefined;
    }
    const interval = setInterval(() => {
      setElapsedMs(current => current + 90);
    }, 90);
    return () => clearInterval(interval);
  }, [reduceMotion]);

  return (
    <View
      accessibilityLabel="Superpowered football players popping onto the title screen while using their powers"
      style={styles.scene}
    >
      <PopSlot
        key={reduceMotion ? 'still' : appearance}
        appearance={appearance}
        left={SOLO_POSITIONS[appearance % SOLO_POSITIONS.length]}
        reduceMotion={reduceMotion}
        elapsedMs={elapsedMs}
        hero={HERO_SEQUENCE[appearance % HERO_SEQUENCE.length]}
        onComplete={showNextHero}
      />
    </View>
  );
}

function PopSlot({
  appearance,
  left,
  reduceMotion,
  elapsedMs,
  hero,
  onComplete,
}: {
  readonly appearance: number;
  readonly left: `${number}%`;
  readonly reduceMotion: boolean;
  readonly elapsedMs: number;
  readonly hero: PopHero;
  readonly onComplete: () => void;
}) {
  const styles = usePixelStyles(makeStyles);
  const progress = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appearanceStartedAtMs = useRef(elapsedMs).current;
  const isGiant = hero.power === 'GIANT_GK';

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
      Animated.delay((isGiant ? 4_000 : 3_000) + Math.round(Math.random() * 500)),
      Animated.timing(progress, {
        toValue: 0,
        duration: 280,
        easing: Easing.in(Easing.back(1.1)),
        useNativeDriver: true,
      }),
    ]);
    animation.start(({ finished }) => {
      if (!finished) return;
      timer.current = setTimeout(onComplete, 1_150 + Math.round(Math.random() * 300));
    });

    return () => {
      if (timer.current !== null) clearTimeout(timer.current);
      animation.stop();
    };
  }, [isGiant, onComplete, progress, reduceMotion]);

  const duration = powerEffectDescriptor(hero.power).durationMs;
  const heroElapsed = Math.max(0, elapsedMs - appearanceStartedAtMs);
  const localElapsed = reduceMotion
    ? Math.round(duration * 0.62)
    : Math.min(duration, heroElapsed);
  const effectElapsed = hero.power === 'FIRE_TORCH'
    ? Math.max(2_850, localElapsed)
    : hero.power === 'WEB_TRAP'
      ? 2_580
      : localElapsed;
  const giantActor = livePowerEffectActors({
    id: `title-${appearance}`,
    power: hero.power,
    player: appearance,
    elapsedMs: localElapsed,
    width: 196,
    height: 204,
    origin: { x: 72, y: 128 },
    targets: [{ x: 150, y: 124 }],
    direction: -1,
    reduceMotion,
  })[0];
  const spriteScale = isGiant ? giantActor?.scale ?? 1 : 1;
  const baseScale = isGiant ? 3.4 : 4.1;
  // Bitmap art rule (docs/11, and see snapSpriteScale in render/interpolate.ts):
  // the drawn magnification must be a whole number, or nearest-neighbour
  // sampling doubles some source rows and drops others. The giant's growth is
  // folded into the sprite's own draw scale rather than applied as a fractional
  // transform on top, so the COMBINED scale stays integral and GIANT_GK grows
  // in pixel-perfect steps from his planted feet.
  const drawScale = Math.max(1, Math.round(baseScale * spriteScale));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.popSlot,
        {
          left,
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [174, isGiant ? -28 : -(appearance % 2) * 4],
              }),
            },
            { rotate: appearance % 2 === 0 ? '-2deg' : '3deg' },
          ],
        },
      ]}
    >
      <View style={styles.powerBubble}>
        <Text style={styles.powerBubbleText}>{hero.powerLabel}</Text>
      </View>

      <View style={styles.powerFx}>
        <Canvas style={styles.powerCanvas}>
          <PowerEffectScene
            power={hero.power}
            elapsedMs={effectElapsed}
            width={196}
            height={204}
            origin={{ x: 72, y: 128 }}
            targets={[{ x: 150, y: 124 }, { x: 166, y: 82 }]}
            anchor={{ x: 112, y: 60 }}
            tier={1}
            reduceMotion={reduceMotion}
          />
        </Canvas>
      </View>

      {hero.targetSpriteKey ? (
        <View style={styles.targetSprite}>
          <TitleMatchSprite
            spriteKey={hero.power === 'WEB_TRAP'
              ? `${hero.targetSpriteKey}:webbed`
              : hero.power === 'FIRE_TORCH'
                ? `${hero.targetSpriteKey}:ignited`
              : hero.targetSpriteKey}
            // Integer magnification only — 3.1 sampled the pixel art unevenly.
            scale={3}
          />
          {hero.power === 'WEB_TRAP' ? (
            <View pointerEvents="none" style={styles.webbedOverlay}>
              {[0, 1, 2].map(band => (
                <View
                  key={band}
                  style={[
                    styles.webbedBand,
                    { top: 20 + band * 21 },
                  ]}
                >
                  {[0, 1, 2, 3, 4, 5].map(segment => (
                    <View key={segment} style={styles.webbedSegment} />
                  ))}
                </View>
              ))}
              <View style={styles.webbedKnot} />
            </View>
          ) : null}
          {hero.power === 'FIRE_TORCH' ? (
            <View pointerEvents="none" style={styles.ignitedOverlay}>
              {[
                { left: 2, top: -9, rotate: '-8deg' },
                { right: -8, top: 10, rotate: '9deg' },
                { left: -9, top: 43, rotate: '-12deg' },
                { right: -6, top: 64, rotate: '11deg' },
              ].map((flame, index) => (
                <View
                  key={index}
                  style={[
                    styles.flamePixel,
                    {
                      left: flame.left,
                      right: flame.right,
                      top: flame.top,
                      transform: [{ rotate: flame.rotate }],
                    },
                  ]}
                >
                  <View style={styles.flameTip} />
                  <View style={styles.flameCrown} />
                  <View style={styles.flameBase} />
                  <View style={styles.flameCore} />
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      <TitleMatchSprite spriteKey={hero.spriteKey} scale={drawScale} />
    </Animated.View>
  );
}

const makeStyles = (faces: LocaleFaces) => StyleSheet.create({
  scene: {
    height: 250,
    overflow: 'visible',
    position: 'relative',
  },
  popSlot: {
    position: 'absolute',
    zIndex: 2,
    bottom: 12,
    width: 196,
    marginLeft: -98,
    alignItems: 'center',
  },
  powerFx: {
    position: 'absolute',
    zIndex: -1,
    left: 0,
    top: -54,
    transform: [{ scale: 1.4 }],
  },
  powerCanvas: {
    width: 196,
    height: 204,
  },
  targetSprite: {
    position: 'absolute',
    zIndex: -2,
    right: 0,
    bottom: 3,
    opacity: 0.92,
    transform: [{ rotate: '-3deg' }],
  },
  webbedOverlay: {
    position: 'absolute',
    inset: 0,
    zIndex: 3,
  },
  webbedBand: {
    position: 'absolute',
    left: 1,
    flexDirection: 'row',
    transform: [{ rotate: '12deg' }],
  },
  webbedSegment: {
    width: 9,
    height: 5,
    marginRight: 3,
    borderWidth: 1,
    borderColor: '#7d7887',
    backgroundColor: '#ffffff',
  },
  webbedKnot: {
    position: 'absolute',
    left: 34,
    top: 42,
    width: 8,
    height: 8,
    borderWidth: 2,
    borderColor: '#7d7887',
    backgroundColor: '#ffffff',
    transform: [{ rotate: '12deg' }],
  },
  ignitedOverlay: {
    position: 'absolute',
    inset: 0,
    zIndex: 3,
  },
  flamePixel: {
    position: 'absolute',
    width: 20,
    height: 26,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  flameTip: {
    position: 'absolute',
    top: 0,
    width: 7,
    height: 8,
    backgroundColor: '#d94f52',
  },
  flameCrown: {
    position: 'absolute',
    top: 6,
    width: 14,
    height: 13,
    borderWidth: 2,
    borderColor: '#7a2731',
    backgroundColor: '#ff6a00',
  },
  flameBase: {
    position: 'absolute',
    bottom: 0,
    width: 20,
    height: 10,
    borderWidth: 2,
    borderColor: '#7a2731',
    backgroundColor: '#d94f52',
  },
  flameCore: {
    zIndex: 2,
    width: 7,
    height: 11,
    marginBottom: 3,
    backgroundColor: '#f7d894',
  },
  powerBubble: {
    position: 'absolute',
    zIndex: 6,
    top: -64,
    minWidth: 108,
    maxWidth: 188,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 4,
    borderColor: '#241f2e',
    backgroundColor: '#f7d894',
    transform: [{ rotate: '-4deg' }],
  },
  powerBubbleText: {
    color: '#241f2e',
    fontFamily: faces.display,
    fontSize: 14,
    textAlign: 'center',
  },
});
