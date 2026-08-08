import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Canvas } from '@shopify/react-native-skia';
import type { RivalHeroIntroViewModel } from '../application/rival-hero-intro';
import { PlayerRunSprite } from '../render/PlayerRunSprite';
import { PowerEffectScene } from '../render/PowerEffectScene';
import { POWER_EFFECT_DESCRIPTORS } from '../render/power-effect-descriptors';
import { ManagementSprite } from './components/ManagementSprite';
import {
  RIVAL_HERO_POWER_INTRO_MS,
  RIVAL_HERO_POWER_HOLD_MS,
} from './rival-hero-intro-sequence';

const SHOWCASE_MS = RIVAL_HERO_POWER_INTRO_MS + RIVAL_HERO_POWER_HOLD_MS;
const INK = '#241f2e';

type ShowcaseProp = 'console' | 'coach' | 'impact-block' | 'teddy' | undefined;

const SHOWCASE_PROP: Readonly<
  Record<RivalHeroIntroViewModel['heroId'], ShowcaseProp>
> = Object.freeze({
  'special-f171': undefined,
  'special-f178': 'console',
  'special-f174': 'coach',
  'special-f176': 'impact-block',
  'special-f168': 'teddy',
});

const PROP_REACTION_DELAY_MS: Readonly<
  Record<Exclude<ShowcaseProp, undefined>, number>
> = Object.freeze({
  console: 1_000,
  coach: 480,
  'impact-block': 1_120,
  teddy: 1_900,
});

interface RivalHeroPowerShowcaseProps {
  readonly active: boolean;
  readonly height: number;
  readonly heroCentreX: number;
  readonly heroGroundOffset: number;
  readonly heroHeight: number;
  readonly heroScale: number;
  readonly heroWidth: number;
  readonly reduceMotion: boolean;
  readonly runKey: number;
  readonly viewModel: RivalHeroIntroViewModel;
  readonly width: number;
}

/**
 * A three-second, world-space demonstration of the headline rival's power.
 *
 * The match and this scene share `PowerEffectScene`, so the promise made here
 * has the same silhouette and colours as the ability the player later sees on
 * the pitch. The extra coach and props only give those effects a readable
 * target in the rival's room.
 */
export function RivalHeroPowerShowcase({
  active,
  height,
  heroCentreX,
  heroGroundOffset,
  heroHeight,
  heroScale,
  heroWidth,
  reduceMotion,
  runKey,
  viewModel,
  width,
}: RivalHeroPowerShowcaseProps) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const heroX = useRef(new Animated.Value(0)).current;
  const heroY = useRef(new Animated.Value(0)).current;
  const propReaction = useRef(new Animated.Value(0)).current;
  const descriptor = POWER_EFFECT_DESCRIPTORS[viewModel.power];
  const showcaseProp = SHOWCASE_PROP[viewModel.heroId];
  const propSide = heroCentreX > width * 0.7 ? -1 : 1;
  const targetOffset = Math.round(Math.min(220, Math.max(72, width * 0.22)));
  const targetX = Math.round(
    Math.max(40, Math.min(width - 40, heroCentreX + propSide * targetOffset)),
  );
  const groundY = height - heroGroundOffset;
  const targetY = Math.round(groundY - Math.min(38, heroHeight * 0.28));
  const origin = useMemo(
    () => ({
      x: Math.round(heroCentreX),
      y: Math.round(groundY - heroHeight * 0.52),
    }),
    [groundY, heroCentreX, heroHeight],
  );
  const targets = useMemo(
    () => [
      { x: targetX, y: targetY },
      { x: targetX + propSide * 8, y: targetY - 12 },
    ],
    [propSide, targetX, targetY],
  );

  useEffect(() => {
    if (!active) {
      setElapsedMs(0);
      return undefined;
    }
    if (reduceMotion) {
      setElapsedMs(descriptor.durationMs * 0.76);
      return undefined;
    }
    let frame = 0;
    let start: number | undefined;
    const tick = (now: number) => {
      start ??= now;
      const rawElapsed = Math.min(SHOWCASE_MS, now - start);
      setElapsedMs((rawElapsed / SHOWCASE_MS) * descriptor.durationMs);
      if (rawElapsed < SHOWCASE_MS) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, descriptor.durationMs, reduceMotion, runKey]);

  useEffect(() => {
    heroX.stopAnimation();
    heroY.stopAnimation();
    heroX.setValue(0);
    heroY.setValue(0);
    if (!active || reduceMotion) return undefined;

    const linear = (value: number, duration: number) =>
      Animated.timing(heroX, {
        toValue: value,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      });
    let animation: Animated.CompositeAnimation | undefined;

    if (viewModel.power === 'SUPER_SPEED') {
      const dash = Math.round(Math.min(104, Math.max(30, width * 0.09)));
      animation = Animated.sequence([
        Animated.delay(180),
        linear(-dash, 460),
        linear(dash, 620),
        linear(-Math.round(dash * 0.42), 520),
        linear(Math.round(dash * 0.24), 390),
        linear(0, 310),
      ]);
    } else if (viewModel.power === 'SUPER_STRENGTH') {
      animation = Animated.sequence([
        Animated.delay(760),
        Animated.parallel([
          linear(propSide * Math.round(Math.min(54, targetOffset * 0.36)), 360),
          Animated.timing(heroY, {
            toValue: -8,
            duration: 360,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(heroY, {
          toValue: 7,
          duration: 130,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.parallel([
          linear(0, 500),
          Animated.timing(heroY, {
            toValue: 0,
            duration: 280,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ]);
    } else if (viewModel.power === 'RALLY_CRY') {
      animation = Animated.sequence([
        Animated.delay(320),
        Animated.timing(heroY, {
          toValue: -9,
          duration: 180,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(heroY, {
          toValue: 0,
          duration: 220,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]);
    }

    animation?.start();
    return () => animation?.stop();
  }, [
    active,
    heroX,
    heroY,
    propSide,
    reduceMotion,
    runKey,
    targetOffset,
    viewModel.power,
    width,
  ]);

  useEffect(() => {
    propReaction.stopAnimation();
    propReaction.setValue(0);
    if (!active || reduceMotion || showcaseProp === undefined) return undefined;
    const duration = showcaseProp === 'teddy' ? 150 : 90;
    const animation = Animated.sequence([
      Animated.delay(PROP_REACTION_DELAY_MS[showcaseProp]),
      Animated.timing(propReaction, {
        toValue: 1,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
      Animated.timing(propReaction, {
        toValue: -1,
        duration: duration * 2,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
      Animated.timing(propReaction, {
        toValue: 0,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [active, propReaction, reduceMotion, runKey, showcaseProp]);

  const heroAnimatedStyle = {
    transform: [{ translateX: heroX }, { translateY: heroY }],
  };
  const propAnimatedStyle = propReactionStyle(showcaseProp, propReaction);
  const heroWalking =
    active &&
    !reduceMotion &&
    (viewModel.power === 'SUPER_SPEED' || viewModel.power === 'SUPER_STRENGTH');
  const showAfterimages =
    active && viewModel.power === 'SUPER_SPEED' && !reduceMotion;

  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={styles.fill}
      testID={`rival-hero-power-showcase-${viewModel.heroId}`}
    >
      {active && showcaseProp !== undefined ? (
        <Animated.View
          style={[
            styles.showcaseProp,
            {
              bottom: heroGroundOffset,
              left: targetX,
            },
            propAnimatedStyle,
          ]}
          testID={`rival-hero-showcase-target-${showcaseProp}`}
        >
          <ShowcaseTarget kind={showcaseProp} />
        </Animated.View>
      ) : null}

      {showAfterimages
        ? [-1, 1].map((direction, index) => (
            <Animated.View
              key={direction}
              style={[
                styles.afterimage,
                {
                  bottom: heroGroundOffset,
                  height: heroHeight,
                  left: heroCentreX,
                  marginLeft: -heroWidth / 2,
                  opacity: index === 0 ? 0.2 : 0.12,
                  transform: [
                    {
                      translateX: Animated.add(
                        heroX,
                        direction *
                          Math.round(heroWidth * (0.32 + index * 0.2)),
                      ),
                    },
                  ],
                  width: heroWidth,
                },
              ]}
            >
              <PlayerRunSprite
                playerId={viewModel.heroId}
                lookId={viewModel.lookId}
                role={viewModel.role}
                scale={heroScale}
                walking
              />
            </Animated.View>
          ))
        : null}

      <Animated.View
        style={[
          styles.hero,
          {
            bottom: heroGroundOffset,
            height: heroHeight,
            left: heroCentreX,
            marginLeft: -heroWidth / 2,
            width: heroWidth,
          },
          heroAnimatedStyle,
        ]}
      >
        <PlayerRunSprite
          playerId={viewModel.heroId}
          lookId={viewModel.lookId}
          role={viewModel.role}
          scale={heroScale}
          walking={heroWalking}
        />
      </Animated.View>

      {active && viewModel.power !== 'SUPER_SPEED' ? (
        <Canvas style={styles.effects} testID="rival-hero-showcase-effects">
          <PowerEffectScene
            anchor={{
              x: Math.round((origin.x + targetX) / 2),
              y: targetY + 28,
            }}
            elapsedMs={elapsedMs}
            height={height}
            origin={origin}
            power={viewModel.power}
            reduceMotion={reduceMotion}
            showDemoActors={false}
            showPlaceholderActors={false}
            targets={targets}
            width={width}
          />
        </Canvas>
      ) : null}
    </View>
  );
}

function ShowcaseTarget({
  kind,
}: {
  readonly kind: Exclude<ShowcaseProp, undefined>;
}) {
  if (kind === 'coach') {
    return (
      <View style={styles.coachTarget}>
        <ManagementSprite spriteKey="coach:amara-okafor:joy" width={72} />
      </View>
    );
  }
  if (kind === 'console') return <PixelProp art={CONSOLE_ART} scale={4} />;
  if (kind === 'impact-block')
    return <PixelProp art={IMPACT_BLOCK_ART} scale={4} />;
  return <PixelProp art={TEDDY_ART} scale={4} />;
}

function propReactionStyle(
  kind: ShowcaseProp,
  reaction: Animated.Value,
): StyleProp<ViewStyle> {
  if (kind === 'coach') {
    return {
      transform: [
        {
          translateY: reaction.interpolate({
            inputRange: [-1, 0, 1],
            outputRange: [0, 0, -12],
          }),
        },
      ],
    };
  }
  if (kind === 'impact-block') {
    return {
      transform: [
        {
          scaleY: reaction.interpolate({
            inputRange: [-1, 0, 1],
            outputRange: [1.08, 1, 0.76],
          }),
        },
        {
          translateY: reaction.interpolate({
            inputRange: [-1, 0, 1],
            outputRange: [-2, 0, 7],
          }),
        },
      ],
    };
  }
  if (kind === 'teddy') {
    return {
      transform: [
        {
          rotate: reaction.interpolate({
            inputRange: [-1, 0, 1],
            outputRange: ['-14deg', '0deg', '12deg'],
          }),
        },
      ],
    };
  }
  return {
    transform: [
      {
        translateX: reaction.interpolate({
          inputRange: [-1, 0, 1],
          outputRange: [-7, 0, 7],
        }),
      },
    ],
  };
}

interface PixelArt {
  readonly palette: Readonly<Record<string, string>>;
  readonly rows: readonly string[];
}

function PixelProp({
  art,
  scale,
}: {
  readonly art: PixelArt;
  readonly scale: number;
}) {
  const width = Math.max(...art.rows.map((row) => row.length));
  return (
    <View
      style={{
        height: art.rows.length * scale,
        position: 'relative',
        width: width * scale,
      }}
    >
      {pixelRuns(art).map((run) => (
        <View
          key={run.id}
          style={{
            backgroundColor: run.color,
            height: scale,
            left: run.x * scale,
            position: 'absolute',
            top: run.y * scale,
            width: run.length * scale,
          }}
        />
      ))}
    </View>
  );
}

function pixelRuns(art: PixelArt) {
  const runs: Array<{
    color: string;
    id: string;
    length: number;
    x: number;
    y: number;
  }> = [];
  art.rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const key = row[x];
      let end = x + 1;
      while (end < row.length && row[end] === key) end += 1;
      const color = art.palette[key];
      if (color !== undefined) {
        runs.push({ color, id: `${y}:${x}`, length: end - x, x, y });
      }
      x = end;
    }
  });
  return runs;
}

const CONSOLE_ART: PixelArt = Object.freeze({
  palette: Object.freeze({
    i: INK,
    d: '#6b6675',
    m: '#9a95a4',
    b: '#5a8fd6',
    l: '#a3c8f0',
    r: '#d94f52',
  }),
  rows: Object.freeze([
    '..iiiiiiiiiiiiii..',
    '.iddddddddddddddi.',
    'idibbbbbbbbbbbidi',
    'idibllllllllbbidi',
    'idibbbbbbbbbbbidi',
    'idibbbrrbbbbbbidi',
    'idibbbbbbbbbbbidi',
    'idiiiiiiiiiiiiidi',
    'immmmmmmmmmmmmmi.',
    '.iiiiiiiiiiiiii..',
    '.....iddddi.......',
    '....iimmmmii......',
    '...ii......ii.....',
  ]),
});

const IMPACT_BLOCK_ART: PixelArt = Object.freeze({
  palette: Object.freeze({
    i: INK,
    d: '#a83440',
    r: '#d94f52',
    h: '#f2938c',
    g: '#6b6675',
    m: '#9a95a4',
  }),
  rows: Object.freeze([
    '...iiiiiiiiiiii...',
    '..ihhhhhhhhhhhhi..',
    '.ihrrrrrrrrrrrrhi.',
    'ihrrrrrrrrrrrrrrhi',
    'iddddddddddddddddi',
    'idddggddddggdddddi',
    'idddmmddddmmdddddi',
    'idddggddddggdddddi',
    'iddddddddddddddddi',
    '.iiiiiiiiiiiiiiii.',
    '..iii........iii..',
  ]),
});

const TEDDY_ART: PixelArt = Object.freeze({
  palette: Object.freeze({
    i: INK,
    d: '#6a4326',
    b: '#8a5a30',
    h: '#a9743d',
    c: '#f7d894',
  }),
  rows: Object.freeze([
    '..iii.....iii....',
    '.ihhi.....ihhi...',
    '.ihhiiiiiiihhi...',
    '..ihhhhhhhhhi....',
    '.ihhihhhhihhhi...',
    '.ihhhhhhhhhhhi...',
    '..ihhiiiihhhi....',
    '..ihhhccchhhi....',
    '...iihhhhii......',
    '..iihhhhhhhii....',
    '.ihhhhhhhhhhhi...',
    'ihhhhhhhhhhhhhi..',
    'ihhhbbbbbbhhhhi..',
    '.ihhhhhhhhhhhi...',
    '..iihhhhhhhii....',
    '..iii.....iii....',
  ]),
});

const styles = StyleSheet.create({
  fill: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 3,
  },
  effects: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 4,
  },
  hero: {
    position: 'absolute',
    zIndex: 3,
  },
  afterimage: {
    position: 'absolute',
    zIndex: 2,
  },
  showcaseProp: {
    alignItems: 'center',
    marginLeft: -36,
    position: 'absolute',
    width: 72,
    zIndex: 5,
  },
  coachTarget: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    minHeight: 72,
    width: 72,
  },
});
