import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Atlas,
  Canvas,
  Rect,
  Skia,
  type SkImage,
  type SkRect,
  type SkRSXform,
} from '@shopify/react-native-skia';
import { SfxPressable as Pressable } from '../components/SfxPressable';
import { ActionButton } from '../components/Scorecard';
import { DESKTOP_CONTENT_MAX_WIDTH } from '../layout/DesktopClamp';
import {
  playDrillCompleteSfx,
  playDrillGainRevealSfx,
  playDrillProgressSfx,
  playMidseasonFootstepsSfx,
  playPositiveSfx,
  playSuperTrainingYaySfx,
  playTrainingStatDing,
  stopDrillCompleteSfx,
  stopDrillProgressSfx,
  stopMidseasonFootstepsSfx,
} from '../../render/management-sfx';
import {
  buildFallbackAtlas,
  buildSpriteAtlas,
} from '../../render/sprites/buildAtlas';
import { PIXEL_ART_SAMPLING } from '../../render/pixel-art-sampling';
import type {
  MidseasonTrainingPlayerViewModel,
  MidseasonTrainingViewModel,
} from '../models';
import { useCopy } from '../../i18n';

// The drill progress bed is four seconds long. Finish with it so the payoff
// never drops into silence before the Continue state appears.
const CELEBRATION_MS = 4_000;
const FALLBACK_SPRITE = 24;
const CONFETTI_COLORS = ['#f6c744', '#63c56b', '#62b5e5', '#f4f1ea', '#2f6f3e'];
const FIREWORK_COLORS = ['#f6c744', '#63c56b', '#62b5e5'];
const ROLE_ORDER = ['FWD', 'MID', 'DEF', 'GK'] as const;
const ROW_BOTTOMS = [0.66, 0.49, 0.32, 0.15] as const;
const PLUS_COUNT = 18;
const PLAYER_ROW_HEIGHT = 68;
const PLAYER_FOCUS_Y = 42;

type CameraShot = 'wide' | 'forwards' | 'defenders';

type CelebrationAtlas = ReturnType<typeof buildSpriteAtlas>;

export interface MidseasonTrainingCelebrationScreenProps {
  readonly viewModel: MidseasonTrainingViewModel;
  readonly reduceMotion?: boolean;
  readonly onContinue: () => void;
}

/**
 * A full-squad training payoff on the same green pitch language as a live
 * match. The first press fast-forwards to the final tableau; the next press,
 * the visible Continue button, or any press after the motion ends returns home.
 */
export function MidseasonTrainingCelebrationScreen({
  viewModel,
  reduceMotion = false,
  onContinue,
}: MidseasonTrainingCelebrationScreenProps) {
  const t = useCopy();
  const { width, height } = useWindowDimensions();
  const [finished, setFinished] = useState(reduceMotion);
  const [cameraShot, setCameraShot] = useState<CameraShot>('wide');
  const finishedRef = useRef(reduceMotion);
  const continuedRef = useRef(false);
  const animationsRef = useRef<Animated.CompositeAnimation[]>([]);
  const reinforcementTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const cameraCutTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const titleProgress = useRef(
    new Animated.Value(reduceMotion ? 1 : 0),
  ).current;
  const confettiProgress = useRef(new Animated.Value(0)).current;
  const fireworkProgress = useRef(
    FIREWORK_COLORS.map(() => new Animated.Value(0)),
  ).current;
  const rowJumpProgress = useRef(
    ROLE_ORDER.map(() => new Animated.Value(0)),
  ).current;
  const plusProgress = useRef(
    Array.from({ length: PLUS_COUNT }, () => new Animated.Value(0)),
  ).current;
  const confetti = useMemo(() => makeConfetti(width), [width]);
  const visualIds = useMemo(
    () => viewModel.squad.map((player) => player.spriteKey.slice(0, -5)),
    [viewModel.squad],
  );
  const spriteAtlas = useMemo<CelebrationAtlas>(() => {
    try {
      return buildSpriteAtlas(Skia, visualIds);
    } catch (error) {
      console.warn(
        'MidseasonTrainingCelebrationScreen: sprite atlas unavailable',
        error,
      );
      return buildFallbackAtlas(Skia, FALLBACK_SPRITE);
    }
  }, [visualIds]);

  const pitchTop = Math.max(104, Math.round(height * 0.18));
  const pitchHeight = Math.max(300, height - pitchTop);
  const pitchWidth = Math.min(width, Math.max(300, pitchHeight * 0.68));
  const pitchLeft = (width - pitchWidth) / 2;

  const stopSceneAudio = useCallback(() => {
    for (const timer of reinforcementTimersRef.current) clearTimeout(timer);
    reinforcementTimersRef.current = [];
    stopDrillProgressSfx();
    stopDrillCompleteSfx();
    stopMidseasonFootstepsSfx();
  }, []);

  const clearCameraCuts = useCallback(() => {
    for (const timer of cameraCutTimersRef.current) clearTimeout(timer);
    cameraCutTimersRef.current = [];
  }, []);

  const finishAnimation = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    for (const animation of animationsRef.current) animation.stop();
    animationsRef.current = [];
    clearCameraCuts();
    setCameraShot('wide');
    stopSceneAudio();
    playDrillGainRevealSfx();
    titleProgress.setValue(1);
    for (const value of rowJumpProgress) value.setValue(0);
    setFinished(true);
  }, [clearCameraCuts, rowJumpProgress, stopSceneAudio, titleProgress]);

  const continueOnce = useCallback(() => {
    if (continuedRef.current) return;
    continuedRef.current = true;
    clearCameraCuts();
    stopSceneAudio();
    onContinue();
  }, [clearCameraCuts, onContinue, stopSceneAudio]);

  const handleWholeScreenPress = useCallback(() => {
    if (!finishedRef.current) finishAnimation();
    else continueOnce();
  }, [continueOnce, finishAnimation]);

  useEffect(() => {
    if (reduceMotion) {
      finishedRef.current = true;
      setFinished(true);
      titleProgress.setValue(1);
      return stopSceneAudio;
    }

    playDrillProgressSfx();
    playDrillCompleteSfx();
    playMidseasonFootstepsSfx();
    reinforcementTimersRef.current = [
      setTimeout(playTrainingStatDing, 700),
      setTimeout(playPositiveSfx, 1_550),
      setTimeout(playSuperTrainingYaySfx, 2_800),
    ];
    cameraCutTimersRef.current = [
      setTimeout(() => setCameraShot('forwards'), 700),
      setTimeout(() => setCameraShot('wide'), 1_350),
      setTimeout(() => setCameraShot('defenders'), 2_100),
      setTimeout(() => setCameraShot('wide'), 2_850),
    ];
    const title = Animated.spring(titleProgress, {
      toValue: 1,
      damping: 8,
      stiffness: 165,
      mass: 0.75,
      useNativeDriver: true,
    });
    const confettiFall = Animated.loop(
      Animated.timing(confettiProgress, {
        toValue: 1,
        duration: 2_900,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    const fireworks = fireworkProgress.map((value, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(180 + index * 260),
          Animated.timing(value, {
            toValue: 1,
            duration: 760,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.delay(400),
        ]),
      ),
    );
    const jumps = rowJumpProgress.map((value, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 70),
          Animated.timing(value, {
            toValue: 1,
            duration: 220,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: 240,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.delay(110),
        ]),
      ),
    );
    const plusBursts = plusProgress.map((value, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay((index % 6) * 115),
          Animated.timing(value, {
            toValue: 1,
            duration: 920 + (index % 4) * 80,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.delay(240 + (index % 3) * 90),
        ]),
      ),
    );
    animationsRef.current = [
      title,
      confettiFall,
      ...fireworks,
      ...jumps,
      ...plusBursts,
    ];
    for (const animation of animationsRef.current) animation.start();
    const timer = setTimeout(finishAnimation, CELEBRATION_MS);

    return () => {
      clearTimeout(timer);
      clearCameraCuts();
      for (const animation of animationsRef.current) animation.stop();
      animationsRef.current = [];
      stopSceneAudio();
    };
  }, [
    clearCameraCuts,
    confettiProgress,
    finishAnimation,
    fireworkProgress,
    plusProgress,
    reduceMotion,
    rowJumpProgress,
    stopSceneAudio,
    titleProgress,
  ]);

  const titleStyle = finished
    ? undefined
    : {
        opacity: titleProgress,
        transform: [
          {
            translateY: titleProgress.interpolate({
              inputRange: [0, 1],
              outputRange: [-42, 0],
            }),
          },
        ],
      };

  const closeRoleIndex =
    cameraShot === 'forwards' ? 0 : cameraShot === 'defenders' ? 2 : null;
  const closeScale = width >= 900 ? 5 : 3;
  const focusedRowY =
    closeRoleIndex === null
      ? height / 2
      : height -
        pitchHeight * ROW_BOTTOMS[closeRoleIndex] -
        PLAYER_ROW_HEIGHT +
        PLAYER_FOCUS_Y;
  const cameraTranslateY =
    closeRoleIndex === null ? 0 : (height / 2 - focusedRowY) * closeScale;
  const cameraTranslateStyle =
    closeRoleIndex === null
      ? undefined
      : { transform: [{ translateY: cameraTranslateY }] };
  const cameraScaleStyle =
    closeRoleIndex === null
      ? undefined
      : { transform: [{ scale: closeScale }] };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        finished
          ? t('midseasonTraining.a11y.continue')
          : t('midseasonTraining.a11y.skip')
      }
      onPress={handleWholeScreenPress}
      style={styles.root}
    >
      <SafeAreaView
        style={styles.root}
        edges={['top', 'left', 'right', 'bottom']}
      >
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, cameraTranslateStyle]}
        >
          <View style={[StyleSheet.absoluteFill, cameraScaleStyle]}>
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              <View style={styles.nightSky} />
              <View style={[styles.stands, { height: pitchTop + 18 }]}>
                {Array.from({ length: 64 }, (_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.fan,
                      {
                        left: `${(index * 37) % 100}%`,
                        top: 12 + ((index * 19) % Math.max(20, pitchTop - 24)),
                        backgroundColor:
                          CONFETTI_COLORS[index % CONFETTI_COLORS.length],
                      },
                    ]}
                  />
                ))}
              </View>
              <View
                style={[
                  styles.pitch,
                  {
                    left: pitchLeft,
                    top: pitchTop,
                    width: pitchWidth,
                    height: pitchHeight,
                  },
                ]}
              >
                <View style={styles.pitchStripeOne} />
                <View style={styles.pitchStripeTwo} />
                <View style={styles.touchline} />
                <View style={styles.halfwayLine} />
                <View style={styles.centerCircle} />
              </View>
              <View style={[styles.floodlight, styles.floodlightLeft]} />
              <View style={[styles.floodlight, styles.floodlightRight]} />
            </View>

            {!finished ? (
              <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                {FIREWORK_COLORS.map((color, index) => (
                  <Firework
                    key={color}
                    progress={fireworkProgress[index]}
                    color={color}
                    left={width * (0.18 + index * 0.32)}
                    top={pitchTop * (index === 1 ? 0.34 : 0.58)}
                    radius={index === 1 ? 58 : 44}
                  />
                ))}
                {confetti.map((piece) => (
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
                          inputRange: [0, 0.05, 0.9, 1],
                          outputRange: [0, 1, 1, 0],
                        }),
                        transform: [
                          {
                            translateY: confettiProgress.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0, height + 100],
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
                {plusProgress.map((progress, index) => (
                  <Animated.Text
                    key={`plus-${index}`}
                    style={[
                      styles.plus,
                      {
                        left:
                          pitchLeft +
                          7 +
                          ((index * 61) % Math.max(1, pitchWidth - 58)),
                        top:
                          pitchTop +
                          pitchHeight * (0.28 + ((index * 17) % 55) / 100),
                        color: index % 3 === 0 ? '#f6c744' : '#f4f1ea',
                        opacity: progress.interpolate({
                          inputRange: [0, 0.16, 0.75, 1],
                          outputRange: [0, 1, 0.9, 0],
                        }),
                        transform: [
                          {
                            translateY: progress.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0, -104 - (index % 4) * 12],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    +{viewModel.statGain}
                  </Animated.Text>
                ))}
              </View>
            ) : null}

            <View
              pointerEvents="none"
              style={[styles.crestWrap, { top: pitchTop + 20 }]}
            >
              <GreenBullPixelMark />
              <Text
                style={styles.centerName}
                numberOfLines={2}
                adjustsFontSizeToFit
              >
                {t('midseasonTraining.centerName')}
              </Text>
            </View>

            {ROLE_ORDER.map((role, index) => {
              const players = viewModel.squad.filter(
                (player) => player.role === role,
              );
              const jumpStyle = finished
                ? undefined
                : {
                    transform: [
                      {
                        translateY: rowJumpProgress[index].interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, -11],
                        }),
                      },
                    ],
                  };
              return (
                <Animated.View
                  key={role}
                  pointerEvents="none"
                  style={[
                    styles.playerRow,
                    {
                      left: pitchLeft,
                      bottom: pitchHeight * ROW_BOTTOMS[index],
                      width: pitchWidth,
                    },
                    jumpStyle,
                  ]}
                >
                  <CelebrationPlayerRow
                    atlas={spriteAtlas}
                    players={players}
                    width={pitchWidth}
                  />
                </Animated.View>
              );
            })}
          </View>
        </View>

        <Animated.View
          pointerEvents="none"
          style={[styles.titleCard, titleStyle]}
        >
          <Text style={styles.kicker}>
            {t('midseasonTraining.trainingTrip')}
          </Text>
          <Text style={styles.title}>{t('midseasonTraining.teamBoost')}</Text>
          <View style={styles.gainCard}>
            <Text style={styles.gainText}>
              {t('midseasonTraining.plusAllStats', {
                gain: viewModel.statGain,
              })}
            </Text>
          </View>
        </Animated.View>

        <View style={styles.footer}>
          <View style={styles.footerMeasure}>
            {finished ? (
              <>
                <ActionButton
                  label={t('midseasonTraining.continue')}
                  accessibilityLabel={t('midseasonTraining.a11y.continue')}
                  variant="confirm"
                  onPress={continueOnce}
                />
                <Text style={styles.tapHint}>
                  {t('midseasonTraining.tapAnywhere')}
                </Text>
              </>
            ) : (
              <Text style={styles.tapHint}>
                {t('midseasonTraining.tapToFinish')}
              </Text>
            )}
          </View>
        </View>
      </SafeAreaView>
    </Pressable>
  );
}

function CelebrationPlayerRow({
  atlas,
  players,
  width,
}: {
  readonly atlas: CelebrationAtlas;
  readonly players: readonly MidseasonTrainingPlayerViewModel[];
  readonly width: number;
}) {
  const height = PLAYER_ROW_HEIGHT;
  const geometry = useMemo(() => {
    if (players.length === 0) return { scale: 1, entries: [] };
    const gap = 4;
    const available = width - gap * (players.length - 1);
    const scale = Math.max(
      1,
      Math.min(2, Math.floor(available / (players.length * 24))),
    );
    const spriteWidth = 24 * scale;
    const totalWidth =
      spriteWidth * players.length + gap * (players.length - 1);
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
  }, [players, width]);
  const sprites: SkRect[] = useMemo(
    () =>
      geometry.entries.map(({ player }) => {
        const rect = atlas.rectFor(player.spriteKey);
        return Skia.XYWHRect(rect.x, rect.y, rect.w, rect.h);
      }),
    [atlas, geometry.entries],
  );
  const transforms: SkRSXform[] = useMemo(
    () =>
      geometry.entries.map(({ x, y }) => Skia.RSXform(geometry.scale, 0, x, y)),
    [geometry],
  );

  return (
    <Canvas style={{ width, height }}>
      <Atlas
        image={atlas.image as SkImage}
        sprites={sprites}
        transforms={transforms}
        sampling={PIXEL_ART_SAMPLING}
      />
      {geometry.entries.map(({ player, x, y }) =>
        player.isCaptain ? (
          <Rect
            key={player.id}
            x={x + 16 * geometry.scale}
            y={y + 12 * geometry.scale}
            width={4 * geometry.scale}
            height={2 * geometry.scale}
            color="#f6c744"
            antiAlias={false}
          />
        ) : null,
      )}
    </Canvas>
  );
}

function GreenBullPixelMark() {
  return (
    <View style={styles.crest} accessibilityElementsHidden>
      {GREEN_BULL_PIXELS.flatMap((row, y) =>
        [...row].map((pixel, x) =>
          pixel === '.' ? null : (
            <View
              key={`${x}:${y}`}
              style={[
                styles.crestPixel,
                {
                  left: x * 4,
                  top: y * 4,
                  backgroundColor:
                    pixel === 'G'
                      ? '#63c56b'
                      : pixel === 'D'
                        ? '#2f6f3e'
                        : '#f6c744',
                },
              ]}
            />
          ),
        ),
      )}
    </View>
  );
}

const GREEN_BULL_PIXELS = [
  '..DDD.........DDD..',
  '.DGGGD.......DGGGD.',
  'DGGGGGD.....DGGGGGD',
  'DGG.DGGD...DGGD.GGD',
  '.DGGGGD..Y..DGGGGD.',
  '..DGGD..YYY..DGGD..',
  '...DGGD..Y..DGGD...',
  '....DGGD...DGGD....',
  '.....DD.....DD.....',
] as const;

function Firework({
  progress,
  color,
  left,
  top,
  radius,
}: {
  readonly progress: Animated.Value;
  readonly color: string;
  readonly left: number;
  readonly top: number;
  readonly radius: number;
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
  return Array.from({ length: 48 }, (_, index) => ({
    id: `midseason-confetti-${index}`,
    left: (index * 73) % Math.max(1, width),
    top: -34 - ((index * 47) % 260),
    width: 5 + (index % 3) * 2,
    height: 8 + (index % 4) * 2,
    color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
    turns: 2 + (index % 4),
  }));
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden', backgroundColor: '#19142a' },
  nightSky: { position: 'absolute', inset: 0, backgroundColor: '#19142a' },
  stands: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    overflow: 'hidden',
    borderBottomWidth: 5,
    borderBottomColor: '#241f2e',
    backgroundColor: '#3a3350',
  },
  fan: { position: 'absolute', width: 4, height: 4, opacity: 0.74 },
  pitch: {
    position: 'absolute',
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#f4f1ea',
    backgroundColor: '#3f8a4a',
  },
  pitchStripeOne: {
    position: 'absolute',
    left: '25%',
    top: 0,
    bottom: 0,
    width: '25%',
    backgroundColor: '#5cb85c',
  },
  pitchStripeTwo: {
    position: 'absolute',
    left: '75%',
    top: 0,
    bottom: 0,
    width: '25%',
    backgroundColor: '#5cb85c',
  },
  touchline: {
    position: 'absolute',
    left: 10,
    right: 10,
    top: 10,
    bottom: 10,
    borderWidth: 2,
    borderColor: '#f4f1ea',
  },
  halfwayLine: {
    position: 'absolute',
    left: 10,
    right: 10,
    top: '50%',
    height: 2,
    backgroundColor: '#f4f1ea',
  },
  centerCircle: {
    position: 'absolute',
    left: '34%',
    top: '40%',
    width: '32%',
    aspectRatio: 1,
    borderWidth: 2,
    borderColor: '#f4f1ea',
    borderRadius: 999,
  },
  floodlight: {
    position: 'absolute',
    top: 12,
    width: 86,
    height: 14,
    backgroundColor: '#f4f1ea',
    shadowColor: '#ffffff',
    shadowOpacity: 0.9,
    shadowRadius: 20,
  },
  floodlightLeft: { left: -12, transform: [{ rotate: '-9deg' }] },
  floodlightRight: { right: -12, transform: [{ rotate: '9deg' }] },
  titleCard: {
    position: 'absolute',
    zIndex: 15,
    left: 16,
    right: 16,
    top: 14,
    alignItems: 'center',
  },
  kicker: {
    color: '#f6c744',
    fontFamily: 'HFMSilkscreen_700Bold',
    fontSize: 10,
    letterSpacing: 2,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 4,
    color: '#f4f1ea',
    fontFamily: 'HFMSilkscreen_700Bold',
    fontSize: 26,
    lineHeight: 30,
    textAlign: 'center',
    textTransform: 'uppercase',
    textShadowColor: '#241f2e',
    textShadowOffset: { width: 3, height: 3 },
    textShadowRadius: 0,
  },
  gainCard: {
    marginTop: 7,
    borderWidth: 3,
    borderBottomWidth: 6,
    borderColor: '#241f2e',
    backgroundColor: '#f6c744',
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  gainText: {
    color: '#241f2e',
    fontFamily: 'HFMSilkscreen_700Bold',
    fontSize: 12,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  crestWrap: {
    position: 'absolute',
    zIndex: 12,
    left: '50%',
    width: 150,
    marginLeft: -75,
    alignItems: 'center',
  },
  crest: {
    width: 84,
    height: 36,
    borderWidth: 2,
    borderColor: '#f6c744',
    backgroundColor: '#241f2e',
  },
  crestPixel: { position: 'absolute', width: 4, height: 4 },
  centerName: {
    marginTop: 3,
    color: '#f4f1ea',
    fontFamily: 'HFMSilkscreen_700Bold',
    fontSize: 8,
    lineHeight: 10,
    textAlign: 'center',
    textTransform: 'uppercase',
    textShadowColor: '#241f2e',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 0,
  },
  playerRow: {
    position: 'absolute',
    zIndex: 10,
    height: PLAYER_ROW_HEIGHT,
    alignItems: 'center',
  },
  plus: {
    position: 'absolute',
    zIndex: 13,
    fontFamily: 'HFMSilkscreen_700Bold',
    fontSize: 24,
    width: 44,
    textAlign: 'center',
    textShadowColor: '#241f2e',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 0,
  },
  confetti: {
    position: 'absolute',
    zIndex: 20,
    borderWidth: 1,
    borderColor: '#241f2e',
  },
  fireworkSpark: {
    position: 'absolute',
    zIndex: 18,
    width: 4,
    height: 13,
  },
  footer: {
    position: 'absolute',
    zIndex: 30,
    left: 18,
    right: 18,
    bottom: 12,
  },
  footerMeasure: {
    width: '100%',
    maxWidth: DESKTOP_CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    gap: 5,
  },
  tapHint: {
    color: '#f4f1ea',
    fontFamily: 'HFMSilkscreen_700Bold',
    fontSize: 9,
    lineHeight: 13,
    textAlign: 'center',
    textTransform: 'uppercase',
    textShadowColor: '#241f2e',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 0,
  },
});
