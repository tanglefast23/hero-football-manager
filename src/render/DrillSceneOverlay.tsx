import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import {
  Atlas,
  Canvas,
  Fill,
  Rect,
  Skia,
  useRSXformBuffer,
  type SkImage,
  type SkRect,
} from '@shopify/react-native-skia';
import { useFrameCallback, useSharedValue, type FrameInfo } from 'react-native-reanimated';
import { SfxPressable as Pressable } from '../ui/components/SfxPressable';
import { playDrillProgressSfx, stopDrillProgressSfx } from './management-sfx';
import { buildFallbackAtlas, buildSpriteAtlas } from './sprites/buildAtlas';
import { snapSpriteScale } from './interpolate';
import { PIXEL_ART_SAMPLING } from './pixel-art-sampling';
import { playerLookId } from './sprites/player-look';
import { useCopy, usePixelStyles, type LocaleFaces } from '../i18n';

/** Per-drill sprite scene: fast enough to chain-tap, always tap-to-skip. */
export const DRILL_SCENE_MS = 2_200;
const REDUCED_MOTION_MS = 450;
/** The number holds for a beat, then climbs; the gain only names itself after. */
const COUNT_START_MS = 300;
export const COUNT_UP_MS = 1_400;
const STAGE_HEIGHT = 200;
const FALLBACK_SPRITE = 24;
// Nominal stage magnifications, sized for the ~200pt stage. Never drawn raw:
// docs/11 requires on-screen pixel art at integer multiples of the source, so
// each is snapped through snapSpriteScale (one source texel -> a whole number
// of device pixels) before it reaches the atlas transforms below.
const NOMINAL_PLAYER_SCALE = 4.1;
const NOMINAL_BALL_SCALE = 3.1;

export type DrillActivityId =
  | 'sprints'
  | 'finishing'
  | 'rondo'
  | 'duels'
  | 'circuit'
  | 'keeper-drills'
  | 'generic';

/** Maps a training path to the sprite activity the player performs on stage. */
export function drillActivityId(pathId: string): DrillActivityId {
  if (pathId === 'first-touch') return 'rondo';
  const known: DrillActivityId[] = ['sprints', 'finishing', 'rondo', 'duels', 'circuit', 'keeper-drills'];
  return known.includes(pathId as DrillActivityId) ? (pathId as DrillActivityId) : 'generic';
}

const ACTIVITY_CODE: Record<DrillActivityId, number> = {
  sprints: 0,
  finishing: 1,
  rondo: 2,
  duels: 3,
  circuit: 4,
  'keeper-drills': 5,
  generic: 6,
};

export interface DrillSceneOverlayProps {
  playerId: string;
  playerName: string;
  role: 'GK' | 'DEF' | 'MID' | 'FWD';
  lookId?: string;
  activityId: DrillActivityId;
  /** Drill title, e.g. "Sprints 1". */
  drillName: string;
  /** Short stat code shown with the gain, e.g. "PAC". */
  shortCode: string;
  before: number;
  after: number;
  isSuper: boolean;
  reduceMotion?: boolean;
  onComplete: () => void;
}

/**
 * A single player runs their drill on a pitch stage while the stat counts up.
 * Plays for ~2.2s, but a tap anywhere ends it instantly and jumps back to the
 * Drills popup so chain-training stays snappy.
 */
export function DrillSceneOverlay({
  playerId,
  playerName,
  role,
  lookId,
  activityId,
  drillName,
  shortCode,
  before,
  after,
  isSuper,
  reduceMotion = false,
  onComplete,
}: DrillSceneOverlayProps) {
  const t = useCopy();
  const styles = usePixelStyles(makeStyles);
  const { width: viewportWidth } = useWindowDimensions();
  const stageWidth = Math.min(460, Math.max(260, viewportWidth - 48));
  const progress = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const [countedValue, setCountedValue] = useState(reduceMotion ? after : before);
  const completedRef = useRef(false);
  const completeOnce = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    const duration = reduceMotion ? REDUCED_MOTION_MS : DRILL_SCENE_MS;
    progress.setValue(reduceMotion ? 1 : 0);
    const animation = reduceMotion ? null : Animated.timing(progress, {
      toValue: 1,
      duration,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    animation?.start();

    if (reduceMotion) {
      const skip = setTimeout(completeOnce, duration);
      return () => {
        animation?.stop();
        clearTimeout(skip);
      };
    }

    // The count-up owns the progress bed: it starts on the first tick upwards and
    // is cut the instant the number lands, so the sound lasts exactly as long as
    // the motion — never a beat longer, even when the scene is tapped away.
    const startedAt = Date.now();
    let sounding = false;
    const timer = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const ratio = Math.max(0, Math.min(1, (elapsed - COUNT_START_MS) / COUNT_UP_MS));
      if (!sounding && elapsed >= COUNT_START_MS) {
        sounding = true;
        playDrillProgressSfx();
      }
      setCountedValue(Math.round(before + (after - before) * ratio));
      if (ratio >= 1) {
        clearInterval(timer);
        stopDrillProgressSfx();
        Animated.sequence([
          Animated.spring(pop, { toValue: 1.3, friction: 4, useNativeDriver: true }),
          Animated.spring(pop, { toValue: 1, friction: 5, useNativeDriver: true }),
        ]).start();
      }
    }, 40);

    const finish = setTimeout(completeOnce, duration);
    return () => {
      animation?.stop();
      clearInterval(timer);
      clearTimeout(finish);
      stopDrillProgressSfx();
    };
  }, [after, before, completeOnce, pop, progress, reduceMotion]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('trainingDrill.a11y.drillScene', {
        player: playerName,
        drill: drillName,
        gain: after - before,
        stat: shortCode,
      })}
      onPress={completeOnce}
      style={styles.overlay}
    >
      <View style={[styles.card, { width: stageWidth }]}>
        <View style={styles.titleHighlight} />
        <View style={styles.titleBar}>
          {/* The star is drawn from the system fallback face, as it always
              was, so it stays out of the catalog and out of the glyph gate. */}
          <Text style={styles.kicker}>{isSuper
            ? `★ ${t('trainingDrill.superSession')}`
            : t('trainingDrill.puttingInTheWork')}</Text>
          <Text style={styles.timerLabel}>{t('trainingDrill.tapToSkip')}</Text>
        </View>

        <View style={styles.heading}>
          <Text style={styles.title} numberOfLines={1}>{playerName}</Text>
          <Text style={styles.drillList} numberOfLines={1}>{drillName.toUpperCase()}</Text>
        </View>

        <View style={styles.stageFrame}>
          <DrillAtlasStage
            playerId={playerId}
            playerName={playerName}
            role={role}
            lookId={lookId}
            activityId={activityId}
            width={stageWidth - 16}
            reduceMotion={reduceMotion}
          />
        </View>

        <View style={styles.gainRow}>
          <Animated.Text style={[styles.gainValue, { transform: [{ scale: pop }] }]}>
            {countedValue}
          </Animated.Text>
        </View>

        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressFill,
              isSuper && styles.progressFillSuper,
              { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
            ]}
          />
        </View>
      </View>
    </Pressable>
  );
}

function DrillAtlasStage({
  playerId,
  playerName,
  role,
  lookId,
  activityId,
  width,
  reduceMotion,
}: {
  playerId: string;
  playerName: string;
  role: 'GK' | 'DEF' | 'MID' | 'FWD';
  lookId?: string;
  activityId: DrillActivityId;
  width: number;
  reduceMotion: boolean;
}) {
  const t = useCopy();
  const [spriteFrame, setSpriteFrame] = useState(0);
  const { scale: devicePixelRatio } = useWindowDimensions();
  const elapsed = useSharedValue(0);
  const startedAt = useSharedValue(-1);
  const stageWidth = useSharedValue(width);
  const activityCode = useSharedValue(ACTIVITY_CODE[activityId]);
  // Snapped on the JS thread, crossed into the worklet as shared values (the
  // stageWidth pattern above): pitchScale 1 because the RSXform scale maps
  // source pixels straight to dp here — snapSpriteScale then makes
  // scale * dpr a whole number of device pixels.
  const playerMagnification = useSharedValue(
    snapSpriteScale(1, NOMINAL_PLAYER_SCALE, devicePixelRatio).drawScale,
  );
  const ballMagnification = useSharedValue(
    snapSpriteScale(1, NOMINAL_BALL_SCALE, devicePixelRatio).drawScale,
  );

  useEffect(() => {
    stageWidth.value = width;
  }, [stageWidth, width]);
  useEffect(() => {
    activityCode.value = ACTIVITY_CODE[activityId];
  }, [activityCode, activityId]);
  useEffect(() => {
    playerMagnification.value = snapSpriteScale(1, NOMINAL_PLAYER_SCALE, devicePixelRatio).drawScale;
    ballMagnification.value = snapSpriteScale(1, NOMINAL_BALL_SCALE, devicePixelRatio).drawScale;
  }, [ballMagnification, devicePixelRatio, playerMagnification]);

  useEffect(() => {
    if (reduceMotion) return undefined;
    const timer = setInterval(() => setSpriteFrame(frame => frame + 1), 130);
    return () => clearInterval(timer);
  }, [reduceMotion]);

  const visualId = useMemo(
    () => `r:${playerLookId(playerId, role, lookId)}`,
    [playerId, role, lookId],
  );

  const atlas = useMemo(() => {
    try {
      return buildSpriteAtlas(Skia, [visualId]);
    } catch (error) {
      console.warn('DrillSceneOverlay: sprite atlas unavailable', error);
      return buildFallbackAtlas(Skia, FALLBACK_SPRITE);
    }
  }, [visualId]);

  const sprites: SkRect[] = useMemo(() => {
    const frame = spriteFrame % 2 === 0 ? 'run0' : 'run1';
    const keeperFrame = activityId === 'keeper-drills' && role === 'GK'
      ? spriteFrame % 2 === 0 ? 'ready0' : 'ready1'
      : frame;
    const player = atlas.rectFor(`${visualId}:${keeperFrame}`);
    const ball = atlas.rectFor('ball');
    return [
      Skia.XYWHRect(player.x, player.y, player.w, player.h),
      Skia.XYWHRect(ball.x, ball.y, ball.w, ball.h),
    ];
  }, [atlas, activityId, role, visualId, spriteFrame]);

  const onFrame = useCallback((info: FrameInfo) => {
    'worklet';
    if (startedAt.value < 0) startedAt.value = info.timestamp;
    elapsed.value = (info.timestamp - startedAt.value) / 1000;
  }, [elapsed, startedAt]);
  useFrameCallback(onFrame, !reduceMotion);

  const transforms = useRSXformBuffer(2, (transform, index) => {
    'worklet';
    const isBall = index === 1;
    const code = activityCode.value;
    const laneWidth = stageWidth.value;
    const playerScale = playerMagnification.value;
    const playerWidth = 24 * playerScale;
    const playerHeight = 30 * playerScale;
    const baseX = (laneWidth - playerWidth) / 2;
    const baseY = STAGE_HEIGHT - playerHeight - 20;
    const t = elapsed.value;
    const wave = Math.sin(t * Math.PI * 2);
    const pulse = (Math.sin(t * Math.PI * 4) + 1) / 2;

    if (!isBall) {
      let x = baseX;
      let y = baseY;
      let rotation = 0;

      if (code === 0) {
        x = 7 + pulse * Math.max(0, laneWidth - playerWidth - 14);
        y -= Math.abs(Math.sin(t * Math.PI * 8)) * 4;
      } else if (code === 1) {
        rotation = -0.12 * Math.max(0, wave);
        x -= Math.max(0, wave) * 5;
      } else if (code === 2) {
        x += wave * Math.min(12, laneWidth * 0.08);
        y -= Math.abs(Math.sin(t * Math.PI * 4)) * 3;
      } else if (code === 3) {
        x += wave * Math.min(15, laneWidth * 0.1);
        rotation = wave * 0.08;
      } else if (code === 4) {
        x += wave * Math.min(9, laneWidth * 0.06);
        y -= Math.abs(Math.sin(t * Math.PI * 3)) * 30;
      } else if (code === 5) {
        x += wave * Math.min(24, laneWidth * 0.16);
        rotation = wave * 0.16;
      } else {
        rotation = -0.13 * Math.max(0, wave);
        y -= Math.abs(Math.sin(t * Math.PI * 4)) * 3;
      }

      transform.set(
        playerScale * Math.cos(rotation),
        playerScale * Math.sin(rotation),
        x,
        y,
      );
      return;
    }

    const ballScale = ballMagnification.value;
    const groundY = baseY + playerHeight - 6 * ballScale;
    let ballX = laneWidth / 2;
    let ballY = groundY;
    let visible = true;

    if (code === 1) {
      const shot = (t % 1.15) / 1.15;
      ballX = baseX + playerWidth * 0.68 + shot * laneWidth * 0.42;
      ballY = groundY - Math.sin(shot * Math.PI) * 34;
    } else if (code === 2) {
      const pass = (wave + 1) / 2;
      ballX = laneWidth * (0.22 + pass * 0.56);
      ballY = groundY - Math.sin(pass * Math.PI) * 8;
    } else if (code === 3) {
      ballX += wave * 7;
    } else if (code === 5) {
      const save = (t % 1.25) / 1.25;
      ballX = laneWidth * (0.88 - save * 0.66);
      ballY = groundY - Math.sin(save * Math.PI) * 46;
    } else if (code === 6) {
      const roll = (t % 1.6) / 1.6;
      ballX = -12 + roll * (stageWidth.value + 24);
      ballY = groundY - Math.sin(roll * Math.PI) * 22;
    } else {
      visible = false;
    }

    transform.set(
      visible ? ballScale : 0,
      0,
      visible ? ballX : -100,
      visible ? ballY : -100,
    );
  });

  return (
    <Canvas style={{ width, height: STAGE_HEIGHT }} accessibilityLabel={t('trainingDrill.a11y.onTheTrainingPitch', { player: playerName })}>
      <Fill color="#2d6a4f" />
      <Rect x={5} y={8} width={width - 10} height={STAGE_HEIGHT - 16} color="#3f8a4a" />
      <Atlas
        image={atlas.image as SkImage}
        sprites={sprites}
        transforms={transforms}
        sampling={PIXEL_ART_SAMPLING}
      />
    </Canvas>
  );
}

const makeStyles = (faces: LocaleFaces) => StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(36, 31, 46, 0.86)',
    paddingHorizontal: 16,
  },
  card: {
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#241f2e',
    backgroundColor: '#f5f1e7',
    shadowColor: '#18131f',
    shadowOffset: { width: 6, height: 7 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  titleHighlight: { height: 5, backgroundColor: '#a3c8f0' },
  titleBar: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#3972bd',
    paddingHorizontal: 14,
  },
  kicker: { color: '#ffffff', fontFamily: faces.display, fontSize: 15, letterSpacing: 1 },
  timerLabel: { color: '#d9e9fb', fontFamily: faces.data, fontSize: 10 },
  heading: { paddingHorizontal: 14, paddingBottom: 10, paddingTop: 12 },
  title: { color: '#241f2e', fontFamily: faces.display, fontSize: 18 },
  drillList: { marginTop: 6, color: '#3972bd', fontFamily: faces.data, fontSize: 10, lineHeight: 16 },
  stageFrame: { marginHorizontal: 8, overflow: 'hidden', borderWidth: 2, borderColor: '#241f2e' },
  gainRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 10,
    paddingTop: 12,
    paddingBottom: 12,
  },
  // Green while it climbs and after it lands: the number itself is the gain.
  gainValue: { color: '#3f8a4a', fontFamily: faces.display, fontSize: 30 },
  progressTrack: { height: 9, borderTopWidth: 2, borderColor: '#241f2e', backgroundColor: '#cfc8da' },
  progressFill: { width: '100%', height: '100%', backgroundColor: '#3972bd' },
  progressFillSuper: { backgroundColor: '#edb54a' },
});
