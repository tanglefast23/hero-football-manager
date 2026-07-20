import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
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
import type {
  TrainingActivityId,
  TrainingTransitionScene,
} from '../application/training-transition';
import { buildFallbackAtlas, buildSpriteAtlas } from './sprites/buildAtlas';
import { playerLookId } from './sprites/player-look';

export const TRAINING_TRANSITION_MS = 3_000;
const REDUCED_MOTION_MS = 650;
const STAGE_HEIGHT = 238;
const FALLBACK_SPRITE = 24;

const ACTIVITY_CODE: Record<TrainingActivityId, number> = {
  sprints: 0,
  finishing: 1,
  rondo: 2,
  duels: 3,
  circuit: 4,
  'keeper-drills': 5,
  generic: 6,
};

export function TrainingTransitionOverlay({
  scene,
  reduceMotion,
  onComplete,
}: {
  scene: TrainingTransitionScene;
  reduceMotion: boolean;
  onComplete: () => void;
}) {
  const { width: viewportWidth } = useWindowDimensions();
  const stageWidth = Math.min(520, Math.max(280, viewportWidth - 32));
  const progress = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  useEffect(() => {
    progress.setValue(reduceMotion ? 1 : 0);
    const animation = reduceMotion ? null : Animated.timing(progress, {
      toValue: 1,
      duration: TRAINING_TRANSITION_MS,
      useNativeDriver: false,
    });
    animation?.start();
    const timer = setTimeout(
      onComplete,
      reduceMotion ? REDUCED_MOTION_MS : TRAINING_TRANSITION_MS,
    );
    return () => {
      animation?.stop();
      clearTimeout(timer);
    };
  }, [onComplete, progress, reduceMotion]);

  const accessibilityLabel = scene.mode === 'plan'
    ? `Training week. ${scene.participants.map(participant =>
      `${participant.playerName}, ${participant.activityLabel}`,
    ).join('. ')}`
    : `${scene.participants[0]?.playerName ?? 'A player'} completes basic ball work.`;

  return (
    <View
      accessibilityViewIsModal
      accessibilityLabel={accessibilityLabel}
      style={styles.overlay}
    >
      <View style={[styles.card, { width: stageWidth }]}>
        <View style={styles.titleHighlight} />
        <View style={styles.titleBar}>
          <Text style={styles.kicker}>TRAINING WEEK</Text>
          <Text style={styles.timerLabel}>{reduceMotion ? 'READY' : '3 SEC'}</Text>
        </View>

        <View style={styles.heading}>
          <Text style={styles.title}>PUTTING IN THE WORK</Text>
          <Text style={styles.drillList} numberOfLines={2}>
            {scene.drillLabels.join('  •  ').toUpperCase()}
          </Text>
        </View>

        <View style={styles.stageFrame}>
          <TrainingAtlasStage
            scene={scene}
            width={stageWidth - 16}
            reduceMotion={reduceMotion}
          />
        </View>

        <View style={styles.stationLabels}>
          {scene.participants.map(participant => (
            <View key={participant.playerId} style={styles.stationLabel}>
              <Text style={styles.playerName} numberOfLines={1}>{participant.playerName}</Text>
              <Text style={styles.activityName} numberOfLines={1}>{participant.activityLabel}</Text>
            </View>
          ))}
        </View>

        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressFill,
              reduceMotion && styles.progressFillReduced,
              { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
            ]}
          />
        </View>
      </View>
    </View>
  );
}

function TrainingAtlasStage({
  scene,
  width,
  reduceMotion,
}: {
  scene: TrainingTransitionScene;
  width: number;
  reduceMotion: boolean;
}) {
  const [spriteFrame, setSpriteFrame] = useState(0);
  const stationCount = scene.participants.length;
  const spriteCount = stationCount * 2;
  const elapsed = useSharedValue(0);
  const startedAt = useSharedValue(-1);
  const stageWidth = useSharedValue(width);
  const activityCodes = useSharedValue<Float32Array>(() => Float32Array.from(
    scene.participants.map(participant => ACTIVITY_CODE[participant.activityId]),
  ));

  useEffect(() => {
    stageWidth.value = width;
  }, [stageWidth, width]);

  useEffect(() => {
    if (reduceMotion) return undefined;
    const timer = setInterval(() => setSpriteFrame(frame => frame + 1), 150);
    return () => clearInterval(timer);
  }, [reduceMotion]);

  const participantVisualIds = useMemo(() => scene.participants.map(participant => (
    `r:${playerLookId(participant.playerId, participant.role, participant.lookId)}`
  )), [scene.participants]);

  const atlas = useMemo(() => {
    try {
      return buildSpriteAtlas(Skia, participantVisualIds);
    } catch (error) {
      console.warn('TrainingTransitionOverlay: sprite atlas unavailable', error);
      return buildFallbackAtlas(Skia, FALLBACK_SPRITE);
    }
  }, [participantVisualIds]);

  const sprites: SkRect[] = useMemo(() => {
    const frame = spriteFrame % 2 === 0 ? 'run0' : 'run1';
    const ball = atlas.rectFor('ball');
    return [
      ...scene.participants.map((participant, index) => {
        const keeperFrame = participant.activityId === 'keeper-drills'
          && participant.role === 'GK'
          ? spriteFrame % 2 === 0 ? 'ready0' : 'ready1'
          : frame;
        const rect = atlas.rectFor(`${participantVisualIds[index]}:${keeperFrame}`);
        return Skia.XYWHRect(rect.x, rect.y, rect.w, rect.h);
      }),
      ...scene.participants.map(() => Skia.XYWHRect(ball.x, ball.y, ball.w, ball.h)),
    ];
  }, [atlas, participantVisualIds, scene.participants, spriteFrame]);

  const onFrame = useCallback((info: FrameInfo) => {
    'worklet';
    if (startedAt.value < 0) startedAt.value = info.timestamp;
    elapsed.value = (info.timestamp - startedAt.value) / 1000;
  }, [elapsed, startedAt]);
  useFrameCallback(onFrame, !reduceMotion);

  const transforms = useRSXformBuffer(spriteCount, (transform, index) => {
    'worklet';
    const isBall = index >= stationCount;
    const station = isBall ? index - stationCount : index;
    const code = activityCodes.value[station] ?? 6;
    const laneWidth = stageWidth.value / stationCount;
    const laneLeft = laneWidth * station;
    const playerScale = stationCount === 1 ? 4.1 : stationCount === 2 ? 3.35 : 2.65;
    const playerWidth = 24 * playerScale;
    const playerHeight = 30 * playerScale;
    const baseX = laneLeft + (laneWidth - playerWidth) / 2;
    const baseY = STAGE_HEIGHT - playerHeight - 27;
    const t = elapsed.value;
    const wave = Math.sin(t * Math.PI * 2);
    const pulse = (Math.sin(t * Math.PI * 4) + 1) / 2;

    if (!isBall) {
      let x = baseX;
      let y = baseY;
      let rotation = 0;

      if (code === 0) {
        x = laneLeft + 7 + pulse * Math.max(0, laneWidth - playerWidth - 14);
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

    const ballScale = stationCount === 1 ? 3.1 : 2.4;
    const groundY = baseY + playerHeight - 6 * ballScale;
    let ballX = laneLeft + laneWidth / 2;
    let ballY = groundY;
    let visible = true;

    if (code === 1) {
      const progress = (t % 1.15) / 1.15;
      ballX = baseX + playerWidth * 0.68 + progress * laneWidth * 0.42;
      ballY = groundY - Math.sin(progress * Math.PI) * 34;
    } else if (code === 2) {
      const pass = (wave + 1) / 2;
      ballX = laneLeft + laneWidth * (0.22 + pass * 0.56);
      ballY = groundY - Math.sin(pass * Math.PI) * 8;
    } else if (code === 3) {
      ballX += wave * 7;
    } else if (code === 5) {
      const progress = (t % 1.25) / 1.25;
      ballX = laneLeft + laneWidth * (0.88 - progress * 0.66);
      ballY = groundY - Math.sin(progress * Math.PI) * 46;
    } else if (code === 6) {
      const progress = (t % 1.6) / 1.6;
      ballX = -12 + progress * (stageWidth.value + 24);
      ballY = groundY - Math.sin(progress * Math.PI) * 22;
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
    <Canvas style={{ width, height: STAGE_HEIGHT }}>
      <Fill color="#2d6a4f" />
      {Array.from({ length: stationCount }, (_, index) => (
        <Rect
          key={index}
          x={(width / stationCount) * index + 5}
          y={8}
          width={width / stationCount - 10}
          height={STAGE_HEIGHT - 16}
          color={index % 2 === 0 ? '#3f8a4a' : '#367c43'}
        />
      ))}
      <Atlas image={atlas.image as SkImage} sprites={sprites} transforms={transforms} />
    </Canvas>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 80,
    elevation: 80,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(36, 31, 46, 0.82)',
    paddingHorizontal: 16,
  },
  card: {
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#241f2e',
    backgroundColor: '#f5f1e7',
    shadowColor: '#18131f',
    shadowOffset: { width: 7, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  titleHighlight: {
    height: 5,
    backgroundColor: '#a3c8f0',
  },
  titleBar: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#3972bd',
    paddingHorizontal: 16,
  },
  kicker: {
    color: '#ffffff',
    fontFamily: 'Silkscreen_700Bold',
    fontSize: 16,
    letterSpacing: 1,
  },
  timerLabel: {
    color: '#d9e9fb',
    fontFamily: 'Silkscreen_400Regular',
    fontSize: 10,
  },
  heading: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 14,
  },
  title: {
    color: '#241f2e',
    fontFamily: 'Silkscreen_700Bold',
    fontSize: 18,
  },
  drillList: {
    marginTop: 7,
    color: '#3972bd',
    fontFamily: 'Silkscreen_400Regular',
    fontSize: 10,
    lineHeight: 16,
  },
  stageFrame: {
    marginHorizontal: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#241f2e',
  },
  stationLabels: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingBottom: 14,
    paddingTop: 10,
  },
  stationLabel: {
    minWidth: 0,
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  playerName: {
    color: '#241f2e',
    fontFamily: 'Silkscreen_700Bold',
    fontSize: 10,
    textAlign: 'center',
  },
  activityName: {
    marginTop: 3,
    color: '#6b6675',
    fontFamily: 'Silkscreen_400Regular',
    fontSize: 9,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  progressTrack: {
    height: 9,
    borderTopWidth: 2,
    borderColor: '#241f2e',
    backgroundColor: '#cfc8da',
  },
  progressFill: {
    width: '100%',
    height: '100%',
    backgroundColor: '#9a5bd5',
  },
  progressFillReduced: {
    backgroundColor: '#3972bd',
  },
});
