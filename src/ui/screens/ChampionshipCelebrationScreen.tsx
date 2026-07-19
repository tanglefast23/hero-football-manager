import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Atlas,
  Canvas,
  Circle,
  Skia,
  type SkImage,
  type SkRect,
  type SkRSXform,
} from '@shopify/react-native-skia';
import {
  playLeagueChampionsSfx,
  stopLeagueChampionsSfx,
} from '../../render/menu-audio';
import { buildFallbackAtlas, buildSpriteAtlas } from '../../render/sprites/buildAtlas';
import { BertFullBody } from '../AssistantGuideOverlay';
import type {
  ChampionshipCelebrationPlayerViewModel,
  ChampionshipCelebrationViewModel,
} from '../models';

const CUTSCENE_MS = 8_200;
const REDUCED_MOTION_MS = 5_000;
const CONFETTI_COLORS = ['#f6c744', '#d94f52', '#5b3a91', '#f4f1ea', '#63c56b', '#62b5e5'];
const FIREWORK_COLORS = ['#f6c744', '#d94f52', '#62b5e5'];
const FALLBACK_SPRITE = 24;

type CelebrationAtlas = ReturnType<typeof buildSpriteAtlas>;

export interface ChampionshipCelebrationScreenProps {
  viewModel: ChampionshipCelebrationViewModel;
  reduceMotion?: boolean;
  onComplete: () => void;
}

export function ChampionshipCelebrationScreen({
  viewModel,
  reduceMotion = false,
  onComplete,
}: ChampionshipCelebrationScreenProps) {
  const { width, height } = useWindowDimensions();
  const titleProgress = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const tossProgress = useRef(new Animated.Value(0)).current;
  const crowdProgress = useRef(new Animated.Value(0)).current;
  const confettiProgress = useRef(new Animated.Value(0)).current;
  const fireworkProgress = useRef(new Animated.Value(0)).current;
  const finished = useRef(false);
  const confetti = useMemo(() => makeConfetti(width), [width]);
  const spriteAtlas = useMemo<CelebrationAtlas>(() => {
    try {
      return buildSpriteAtlas(Skia);
    } catch (error) {
      console.warn('ChampionshipCelebrationScreen: sprite atlas unavailable', error);
      return buildFallbackAtlas(Skia, FALLBACK_SPRITE);
    }
  }, []);

  const completeOnce = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    stopLeagueChampionsSfx();
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    playLeagueChampionsSfx();
    const timeout = setTimeout(completeOnce, reduceMotion ? REDUCED_MOTION_MS : CUTSCENE_MS);
    if (reduceMotion) {
      return () => {
        clearTimeout(timeout);
        stopLeagueChampionsSfx();
      };
    }

    const titleAnimation = Animated.sequence([
      Animated.delay(180),
      Animated.spring(titleProgress, {
        toValue: 1,
        damping: 8,
        stiffness: 160,
        mass: 0.75,
        useNativeDriver: true,
      }),
      Animated.delay(3_350),
      Animated.timing(titleProgress, {
        toValue: 2,
        duration: 520,
        easing: Easing.in(Easing.back(1.3)),
        useNativeDriver: true,
      }),
    ]);
    const tossAnimation = Animated.loop(Animated.sequence([
      Animated.timing(tossProgress, {
        toValue: 1,
        duration: 430,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(tossProgress, {
        toValue: 0,
        duration: 390,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.delay(120),
    ]));
    const crowdAnimation = Animated.loop(Animated.sequence([
      Animated.timing(crowdProgress, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(crowdProgress, {
        toValue: 0,
        duration: 260,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    ]));
    const confettiAnimation = Animated.loop(Animated.timing(confettiProgress, {
      toValue: 1,
      duration: 3_200,
      easing: Easing.linear,
      useNativeDriver: true,
    }));
    const fireworkAnimation = Animated.loop(Animated.sequence([
      Animated.delay(320),
      Animated.timing(fireworkProgress, {
        toValue: 1,
        duration: 900,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(fireworkProgress, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }),
    ]));

    titleAnimation.start();
    tossAnimation.start();
    crowdAnimation.start();
    confettiAnimation.start();
    fireworkAnimation.start();

    return () => {
      clearTimeout(timeout);
      titleAnimation.stop();
      tossAnimation.stop();
      crowdAnimation.stop();
      confettiAnimation.stop();
      fireworkAnimation.stop();
      stopLeagueChampionsSfx();
    };
  }, [completeOnce, confettiProgress, crowdProgress, fireworkProgress, reduceMotion, titleProgress, tossProgress]);

  const titleStyle = reduceMotion ? undefined : {
    opacity: titleProgress.interpolate({
      inputRange: [0, 0.18, 1, 1.72, 2],
      outputRange: [0, 1, 1, 1, 0],
    }),
    transform: [
      {
        translateY: titleProgress.interpolate({
          inputRange: [0, 1, 2],
          outputRange: [-80, 0, -110],
        }),
      },
      {
        scale: titleProgress.interpolate({
          inputRange: [0, 0.8, 1, 2],
          outputRange: [0.25, 1.16, 1, 0.72],
        }),
      },
    ],
  };
  const tossedStyle = reduceMotion ? undefined : {
    transform: [
      {
        translateY: tossProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -58],
        }),
      },
      {
        rotate: tossProgress.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: ['-5deg', '4deg', '-3deg'],
        }),
      },
    ],
  };
  const crowdStyle = reduceMotion ? undefined : {
    transform: [{
      translateY: crowdProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -5],
      }),
    }],
  };
  const supporters = viewModel.squad.slice(0, 4);
  const backRow = viewModel.squad.slice(4);

  return (
    <SafeAreaView
      className="flex-1 bg-ink"
      edges={['top', 'left', 'right', 'bottom']}
      accessibilityLabel={`${viewModel.clubName} won the league. ${viewModel.star.name} is lifted by the team.`}
    >
      <View style={StyleSheet.absoluteFill}>
        <View style={styles.nightSky} />
        <View style={styles.stand}>
          {Array.from({ length: 72 }, (_, index) => (
            <View
              key={index}
              style={[
                styles.fan,
                {
                  left: `${(index * 37) % 100}%`,
                  top: 12 + ((index * 23) % 120),
                  backgroundColor: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
                },
              ]}
            />
          ))}
        </View>
        <View style={styles.pitch}>
          <View style={styles.pitchStripe} />
          <View style={styles.pitchLine} />
          <View style={styles.centerCircle} />
        </View>
        <View style={[styles.floodlight, styles.floodlightLeft]} />
        <View style={[styles.floodlight, styles.floodlightRight]} />
      </View>

      {!reduceMotion ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {FIREWORK_COLORS.map((color, index) => (
            <Firework
              key={color}
              progress={fireworkProgress}
              color={color}
              left={width * (0.2 + index * 0.3)}
              top={height * (index === 1 ? 0.19 : 0.29)}
              radius={index === 1 ? 64 : 46}
            />
          ))}
          {confetti.map(piece => (
            <Animated.View
              key={piece.id}
              style={[
                styles.confetti,
                {
                  left: piece.left,
                  top: piece.top,
                  width: piece.width,
                  height: piece.height,
                  backgroundColor: piece.color,
                  opacity: confettiProgress.interpolate({
                    inputRange: [0, 0.04, 0.92, 1],
                    outputRange: [0, 1, 1, 0],
                  }),
                  transform: [
                    {
                      translateY: confettiProgress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, height + 160],
                      }),
                    },
                    {
                      rotate: confettiProgress.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0deg', `${piece.turns * 360}deg`],
                      }),
                    },
                  ],
                },
              ]}
            />
          ))}
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Skip league championship celebration"
        onPress={completeOnce}
        style={({ pressed }) => [styles.skipButton, { opacity: pressed ? 0.65 : 1 }]}
      >
        <Text className="font-pixel text-xs uppercase text-white">Skip ▸</Text>
      </Pressable>

      <Animated.View pointerEvents="none" style={[styles.titleCard, titleStyle]}>
        <Text className="text-center font-mono text-xs font-bold uppercase tracking-[4px] text-gold">
          {viewModel.seasonLabel} · Final whistle
        </Text>
        <Text
          className="mt-2 text-center font-pixel text-4xl uppercase leading-[42px] text-white"
          adjustsFontSizeToFit
          numberOfLines={2}
        >
          YOU WON{`\n`}THE LEAGUE!
        </Text>
        <View className="mt-3 self-center border-2 border-gold bg-ink/80 px-4 py-2">
          <Text className="text-center font-mono text-sm font-bold uppercase text-gold">
            {viewModel.clubName} · Champions
          </Text>
        </View>
      </Animated.View>

      <View pointerEvents="none" style={styles.celebrationStage}>
        <Animated.View style={[styles.backRow, crowdStyle]}>
          <CelebrationSpriteRow
            atlas={spriteAtlas}
            players={backRow}
            width={Math.max(280, width - 20)}
            height={66}
            maxScale={1.42}
          />
        </Animated.View>

        <View style={styles.liftGroup}>
          <Animated.View style={[styles.starWrap, tossedStyle]}>
            <View style={styles.starBurst} />
            <Text style={styles.starCrown}>★</Text>
            <CelebrationSpriteRow
              atlas={spriteAtlas}
              players={[viewModel.star]}
              width={90}
              height={94}
              maxScale={2.65}
            />
          </Animated.View>
          <Animated.View style={[styles.supporterRow, crowdStyle]}>
            <CelebrationSpriteRow
              atlas={spriteAtlas}
              players={supporters}
              width={180}
              height={68}
              maxScale={1.65}
            />
          </Animated.View>
        </View>

        <View style={styles.starNameplate}>
          <Text className="text-center font-pixel text-base uppercase text-ink" numberOfLines={1}>
            {viewModel.star.name}
          </Text>
          <Text className="mt-1 text-center font-mono text-[10px] font-bold uppercase tracking-wider text-ink/70">
            {viewModel.star.hasRecordedGoals
              ? `Golden boot · ${viewModel.star.goals} goal${viewModel.star.goals === 1 ? '' : 's'}`
              : 'Season star'}
          </Text>
        </View>

        <View style={styles.bertLabel}>
          <Text className="font-pixel text-[10px] uppercase text-white">{viewModel.assistantName}</Text>
          <Text className="font-mono text-[8px] uppercase text-gold">Still here!</Text>
        </View>
        <View style={styles.bertWrap}>
          <BertFullBody pointing={false} />
        </View>
      </View>
    </SafeAreaView>
  );
}

function CelebrationSpriteRow({
  atlas,
  players,
  width,
  height,
  maxScale,
}: {
  atlas: CelebrationAtlas;
  players: readonly ChampionshipCelebrationPlayerViewModel[];
  width: number;
  height: number;
  maxScale: number;
}) {
  const geometry = useMemo(() => {
    if (players.length === 0) return { scale: 1, entries: [] };
    const gap = players.length === 1 ? 0 : 4;
    const availableWidth = width - gap * (players.length - 1);
    const scale = Math.min(maxScale, availableWidth / (players.length * 24));
    const spriteWidth = 24 * scale;
    const totalWidth = spriteWidth * players.length + gap * (players.length - 1);
    const startX = (width - totalWidth) / 2;
    const y = height - 30 * scale;
    return {
      scale,
      entries: players.map((player, index) => ({
        player,
        x: startX + index * (spriteWidth + gap),
        y,
      })),
    };
  }, [height, maxScale, players, width]);
  const sprites: SkRect[] = useMemo(() => geometry.entries.map(({ player }) => {
    const rect = atlas.rectFor(player.spriteKey);
    return Skia.XYWHRect(rect.x, rect.y, rect.w, rect.h);
  }), [atlas, geometry.entries]);
  const transforms: SkRSXform[] = useMemo(() => geometry.entries.map(({ x, y }) => (
    Skia.RSXform(geometry.scale, 0, x, y)
  )), [geometry]);

  return (
    <Canvas
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width, height }}
    >
      {geometry.entries.map(({ player, x, y }) => player.isHero ? (
        <Circle
          key={player.id}
          cx={x + 12 * geometry.scale}
          cy={y + 15 * geometry.scale}
          r={14 * geometry.scale}
          color="#f6c744"
          opacity={0.35}
        />
      ) : null)}
      <Atlas image={atlas.image as SkImage} sprites={sprites} transforms={transforms} />
    </Canvas>
  );
}

function Firework({
  progress,
  color,
  left,
  top,
  radius,
}: {
  progress: Animated.Value;
  color: string;
  left: number;
  top: number;
  radius: number;
}) {
  return (
    <View style={{ position: 'absolute', left, top }}>
      {Array.from({ length: 12 }, (_, index) => {
        const angle = (index / 12) * Math.PI * 2;
        return (
          <Animated.View
            key={index}
            style={[
              styles.fireworkSpark,
              {
                backgroundColor: color,
                opacity: progress.interpolate({
                  inputRange: [0, 0.18, 0.82, 1],
                  outputRange: [0, 1, 0.8, 0],
                }),
                transform: [
                  {
                    translateX: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, Math.cos(angle) * radius],
                    }),
                  },
                  {
                    translateY: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, Math.sin(angle) * radius],
                    }),
                  },
                  { rotate: `${(angle * 180) / Math.PI + 90}deg` },
                ],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

function makeConfetti(width: number) {
  return Array.from({ length: 52 }, (_, index) => ({
    id: `confetti-${index}`,
    left: (index * 73) % Math.max(1, width),
    top: -40 - ((index * 47) % 460),
    width: 5 + (index % 3) * 2,
    height: 9 + (index % 4) * 2,
    color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
    turns: 2 + (index % 4),
  }));
}

const styles = StyleSheet.create({
  nightSky: { position: 'absolute', inset: 0, backgroundColor: '#19142a' },
  stand: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: '46%',
    overflow: 'hidden',
    borderBottomWidth: 5,
    borderBottomColor: '#241f2e',
    backgroundColor: '#3a3350',
  },
  fan: { position: 'absolute', width: 4, height: 4, opacity: 0.7 },
  pitch: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '58%',
    overflow: 'hidden',
    backgroundColor: '#3f8a4a',
  },
  pitchStripe: { position: 'absolute', left: '24%', top: 0, bottom: 0, width: '25%', backgroundColor: '#4f9b59' },
  pitchLine: { position: 'absolute', left: 0, right: 0, top: '56%', height: 3, backgroundColor: 'rgba(244,241,234,0.75)' },
  centerCircle: { position: 'absolute', left: '32%', top: '35%', width: '36%', aspectRatio: 1, borderWidth: 3, borderColor: 'rgba(244,241,234,0.75)', borderRadius: 999 },
  floodlight: { position: 'absolute', top: 16, width: 84, height: 16, backgroundColor: '#f4f1ea', shadowColor: '#ffffff', shadowOpacity: 0.9, shadowRadius: 22 },
  floodlightLeft: { left: -14, transform: [{ rotate: '-10deg' }] },
  floodlightRight: { right: -14, transform: [{ rotate: '10deg' }] },
  skipButton: { position: 'absolute', zIndex: 20, right: 12, top: 10, minWidth: 74, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.55)', backgroundColor: 'rgba(36,31,46,0.72)' },
  titleCard: { position: 'absolute', zIndex: 15, left: 18, right: 18, top: '10%', alignItems: 'center' },
  celebrationStage: { position: 'absolute', inset: 0, zIndex: 8 },
  backRow: { position: 'absolute', left: 10, right: 10, bottom: 22, height: 66, alignItems: 'center', justifyContent: 'flex-end' },
  liftGroup: { position: 'absolute', left: '50%', bottom: 105, width: 180, height: 184, marginLeft: -90, alignItems: 'center', justifyContent: 'flex-end' },
  starWrap: { position: 'absolute', zIndex: 4, top: -2, width: 90, height: 100, alignItems: 'center', justifyContent: 'center' },
  starBurst: { position: 'absolute', width: 84, height: 84, borderRadius: 42, borderWidth: 4, borderColor: '#f6c744', backgroundColor: 'rgba(246,199,68,0.24)' },
  starCrown: { position: 'absolute', zIndex: 3, top: -13, fontSize: 25, color: '#f6c744', textShadowColor: '#241f2e', textShadowRadius: 2 },
  supporterRow: { zIndex: 2, width: 180, height: 68, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 2 },
  starNameplate: { position: 'absolute', zIndex: 12, left: 56, right: 82, bottom: 56, borderWidth: 3, borderColor: '#241f2e', backgroundColor: '#f6c744', paddingHorizontal: 9, paddingVertical: 8, shadowColor: '#241f2e', shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0 },
  bertWrap: { position: 'absolute', zIndex: 13, right: -12, bottom: -18, width: 104, height: 180, transform: [{ scale: 0.55 }] },
  bertLabel: { position: 'absolute', zIndex: 14, right: 6, bottom: 116, alignItems: 'center', borderWidth: 2, borderColor: '#f6c744', backgroundColor: '#241f2e', paddingHorizontal: 6, paddingVertical: 4, transform: [{ rotate: '3deg' }] },
  confetti: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(36,31,46,0.25)' },
  fireworkSpark: { position: 'absolute', width: 4, height: 14, borderRadius: 2 },
});
