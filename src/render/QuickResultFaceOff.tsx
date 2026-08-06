import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  Atlas,
  Canvas,
  Circle,
  Fill,
  Skia,
  useRSXformBuffer,
  type SkImage,
  type SkRect,
} from '@shopify/react-native-skia';
import { useFrameCallback, useSharedValue, type FrameInfo } from 'react-native-reanimated';
import { SfxPressable as Pressable } from '../ui/components/SfxPressable';
import type { QuickResultFaceOffViewModel } from '../ui/models';
import { playQuickResultFaceOffSfx, stopQuickResultFaceOffSfx } from './management-sfx';
import { buildFallbackAtlas, buildSpriteAtlas } from './sprites/buildAtlas';
import { playerLookId } from './sprites/player-look';
import { snapSpriteScale } from './interpolate';
import { PIXEL_ART_SAMPLING } from './pixel-art-sampling';

/**
 * The Quick Result face-off: the club's best outfielder, the opponent's best
 * outfielder, and a large VS between them, for about four seconds.
 *
 * Presentation only. The match was simulated, settled and saved before this
 * mounted; the scene reads a decided result and hands on to whatever screen
 * that result was going to open. A tap skips it.
 *
 * The player art is front-facing `run0`/`run1` — the atlas has no side profile
 * and no kicking pose — so the two stand opposite each other facing the
 * camera, exactly as they do on the drill stage, and the strike is carried by
 * the ball's travel plus a small lunge rather than by a leg swing.
 */

/** Entrance, hold, strike, settle — the four beats of the scene. */
const ENTRANCE_MS = 640;
const STRIKE_START_MS = 2_300;
const STRIKE_MS = 1_100;
/**
 * The beat after the ball has finished travelling. The strike is the scene's
 * punchline, so the manager gets half a second to read where the ball went
 * before the next screen takes over.
 */
const POST_STRIKE_HOLD_MS = 500;
export const FACE_OFF_MS = STRIKE_START_MS + STRIKE_MS + POST_STRIKE_HOLD_MS;
export const FACE_OFF_REDUCED_MOTION_MS = 2_400;
/** The drill stage's cadence, so the two scenes idle at the same speed. */
const IDLE_FRAME_MS = 130;
/** Matches DrillSceneOverlay: never drawn raw, always through snapSpriteScale. */
const NOMINAL_PLAYER_SCALE = 4.1;
const NOMINAL_BALL_SCALE = 3.1;
const FALLBACK_SPRITE = 24;

/** Worklets cannot read a string union, so the strike crosses as a number. */
const STRIKE_CODE: Readonly<Record<'club' | 'opponent' | 'bounce', number>> = {
  club: 0,
  opponent: 1,
  bounce: 2,
};

const TURF = '#3f8a4a';
const TURF_LINE = 'rgba(244, 241, 234, 0.28)';

export interface QuickResultFaceOffProps {
  readonly faceOff: QuickResultFaceOffViewModel;
  readonly reduceMotion: boolean;
  /** Called exactly once, on the hold's expiry or a tap. */
  readonly onDone: () => void;
}

export function QuickResultFaceOff({ faceOff, reduceMotion, onDone }: QuickResultFaceOffProps) {
  const { width, height, scale: devicePixelRatio } = useWindowDimensions();
  const [idleFrame, setIdleFrame] = useState(0);
  const entrance = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const finished = useRef(false);

  const finishOnce = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    onDone();
  }, [onDone]);

  useEffect(() => {
    playQuickResultFaceOffSfx();
    const duration = reduceMotion ? FACE_OFF_REDUCED_MOTION_MS : FACE_OFF_MS;
    const hold = setTimeout(finishOnce, duration);

    if (reduceMotion) {
      return () => {
        clearTimeout(hold);
        stopQuickResultFaceOffSfx();
      };
    }

    const animation = Animated.timing(entrance, {
      toValue: 1,
      duration: ENTRANCE_MS,
      easing: Easing.out(Easing.back(1.8)),
      useNativeDriver: true,
    });
    animation.start();

    const idle = setInterval(() => setIdleFrame(frame => frame + 1), IDLE_FRAME_MS);

    return () => {
      clearTimeout(hold);
      clearInterval(idle);
      animation.stop();
      // The scene is skippable, so the horn must be cuttable: 2.3s of brass
      // over the Financial Report is the loudest kind of stale.
      stopQuickResultFaceOffSfx();
    };
  }, [entrance, finishOnce, reduceMotion]);

  const [club, opponent] = faceOff.sides;
  const clubVisualId = useMemo(
    () => `r:${playerLookId(club.playerId, club.role, club.lookId)}`,
    [club.playerId, club.role, club.lookId],
  );
  const opponentVisualId = useMemo(
    () => `r:${playerLookId(opponent.playerId, opponent.role, opponent.lookId)}`,
    [opponent.playerId, opponent.role, opponent.lookId],
  );

  // An atlas failure degrades to the fallback and STILL shows the scene — the
  // skip path belongs to a missing view model, not to missing art.
  const atlas = useMemo(() => {
    try {
      return buildSpriteAtlas(Skia, [clubVisualId, opponentVisualId]);
    } catch (error) {
      console.warn('QuickResultFaceOff: sprite atlas unavailable', error);
      return buildFallbackAtlas(Skia, FALLBACK_SPRITE);
    }
  }, [clubVisualId, opponentVisualId]);

  const playerScale = snapSpriteScale(1, NOMINAL_PLAYER_SCALE, devicePixelRatio).drawScale;
  const ballScale = snapSpriteScale(1, NOMINAL_BALL_SCALE, devicePixelRatio).drawScale;

  const stageY = height * 0.42;
  const clubX = width * 0.24;
  const opponentX = width * 0.76;

  const sprites: SkRect[] = useMemo(() => {
    const frame = idleFrame % 2 === 0 ? 'run0' : 'run1';
    const pick = (visualId: string) => {
      const rect = atlas.rectFor(`${visualId}:${frame}`);
      return Skia.XYWHRect(rect.x, rect.y, rect.w, rect.h);
    };
    const ball = atlas.rectFor('ball');
    return [pick(clubVisualId), pick(opponentVisualId), Skia.XYWHRect(ball.x, ball.y, ball.w, ball.h)];
  }, [atlas, clubVisualId, opponentVisualId, idleFrame]);

  /**
   * The strike, on the UI thread.
   *
   * The ball's travel is the only thing that says who won, so it cannot be a
   * re-render loop — it is a shared clock read straight by the RSXform worklet,
   * the same arrangement the drill stage uses.
   */
  const elapsedMs = useSharedValue(0);
  const startedAt = useSharedValue(-1);
  const strikeCode = useSharedValue(STRIKE_CODE[faceOff.strike]);
  const geometry = useSharedValue({ clubX, opponentX, stageY, playerScale, ballScale });

  useEffect(() => {
    strikeCode.value = STRIKE_CODE[faceOff.strike];
  }, [faceOff.strike, strikeCode]);
  useEffect(() => {
    geometry.value = { clubX, opponentX, stageY, playerScale, ballScale };
  }, [ballScale, clubX, geometry, opponentX, playerScale, stageY]);

  const onFrame = useCallback((info: FrameInfo) => {
    'worklet';
    if (startedAt.value < 0) startedAt.value = info.timestamp;
    elapsedMs.value = info.timestamp - startedAt.value;
  }, [elapsedMs, startedAt]);
  useFrameCallback(onFrame, !reduceMotion);

  const transforms = useRSXformBuffer(sprites.length, (transform, index) => {
    'worklet';
    const { clubX: left, opponentX: right, stageY: y, playerScale: ps, ballScale: bs } = geometry.value;
    // RSXform translates the sprite's TOP-LEFT, so every anchor below is
    // shifted by half the drawn sprite to sit where the layout expects it.
    // 24x30 is the source cell the drill stage measures against; the ball is
    // the 6x6 sprite the loader documents.
    const halfPlayerW = 12 * ps;
    const halfPlayerH = 15 * ps;
    const halfBall = 3 * bs;
    const centre = (left + right) / 2;
    const reach = (right - left) / 2;
    // 0 until the strike begins, then 0..1 across it. Under Reduce Motion the
    // clock never runs, so the ball simply rests in the middle.
    const t = Math.max(0, Math.min(1, (elapsedMs.value - STRIKE_START_MS) / STRIKE_MS));
    const code = strikeCode.value;

    if (index === 2) {
      let x = centre;
      if (code === 0) {
        // Club won: struck left to right, past the opponent and off the edge.
        x = centre + t * (reach * 2.4);
      } else if (code === 1) {
        x = centre - t * (reach * 2.4);
      } else if (t > 0) {
        // Drawn: two full traversals between the pair, finishing in the middle.
        x = centre + Math.sin(t * Math.PI * 2) * reach * 0.9;
      }
      transform.set(bs, 0, x - halfBall, y + halfPlayerH - halfBall);
      return;
    }

    // A small lunge on whoever struck it — the atlas has no kicking frame, so
    // the shove into the ball is all the body language available.
    const lunging = (code === 0 && index === 0) || (code === 1 && index === 1);
    const lunge = lunging ? Math.sin(Math.min(t, 0.5) * Math.PI * 2) * 10 : 0;
    const towards = index === 0 ? 1 : -1;
    const anchorX = index === 0 ? left : right;
    transform.set(ps, 0, anchorX + lunge * towards - halfPlayerW, y - halfPlayerH);
  });

  const entranceShift = (from: number) => entrance.interpolate({
    inputRange: [0, 1],
    outputRange: [from, 0],
  });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${faceOff.accessibilityLabel} Tap to skip.`}
      onPress={finishOnce}
      style={styles.overlay}
    >
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        <Fill color={TURF} />
        {/* The centre circle, so the two are unmistakably stood on a pitch. */}
        <Circle
          cx={width * 0.5}
          cy={stageY + 24}
          r={Math.min(width, height) * 0.22}
          color={TURF_LINE}
          style="stroke"
          strokeWidth={3}
        />
        <Atlas
          image={atlas.image as SkImage}
          sprites={sprites}
          transforms={transforms}
          sampling={PIXEL_ART_SAMPLING}
        />
      </Canvas>

      {/* The one moment of drama the scene has. */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.versus,
          {
            top: stageY - 44,
            opacity: entrance,
            transform: [
              { scale: entrance.interpolate({ inputRange: [0, 1], outputRange: [1.6, 1] }) },
              { rotate: '-4deg' },
            ],
          },
        ]}
      >
        <Text style={styles.versusText}>VS</Text>
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.nameplate,
          { left: 0, width: width * 0.48, top: stageY + 70 },
          { opacity: entrance, transform: [{ translateX: entranceShift(-width * 0.3) }] },
        ]}
      >
        <Text style={styles.playerName} numberOfLines={1}>{club.playerName}</Text>
        <Text style={styles.clubName} numberOfLines={1}>{club.clubName}</Text>
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.nameplate,
          { right: 0, width: width * 0.48, top: stageY + 70 },
          { opacity: entrance, transform: [{ translateX: entranceShift(width * 0.3) }] },
        ]}
      >
        <Text style={styles.playerName} numberOfLines={1}>{opponent.playerName}</Text>
        <Text style={styles.clubName} numberOfLines={1}>{opponent.clubName}</Text>
      </Animated.View>

      <View pointerEvents="none" style={styles.skipHint}>
        <Text style={styles.skipHintText}>TAP TO SKIP</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 40,
    backgroundColor: TURF,
  },
  versus: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  versusText: {
    fontFamily: 'Silkscreen_700Bold',
    fontSize: 64,
    lineHeight: 76,
    color: '#f4f1ea',
    textShadowColor: '#241f2e',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 0,
  },
  nameplate: { position: 'absolute', alignItems: 'center', paddingHorizontal: 8 },
  playerName: {
    fontFamily: 'Silkscreen_400Regular',
    fontSize: 15,
    lineHeight: 20,
    color: '#f4f1ea',
    textShadowColor: '#241f2e',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 0,
  },
  clubName: {
    fontFamily: 'Silkscreen_400Regular',
    fontSize: 11,
    lineHeight: 16,
    color: 'rgba(244, 241, 234, 0.7)',
  },
  skipHint: { position: 'absolute', right: 16, bottom: 20 },
  skipHintText: {
    fontFamily: 'Silkscreen_400Regular',
    fontSize: 11,
    color: 'rgba(244, 241, 234, 0.75)',
  },
});
