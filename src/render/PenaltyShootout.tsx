import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import {
  Atlas,
  Canvas,
  Fill,
  Line,
  Rect,
  Skia,
  useRSXformBuffer,
  type SkImage,
  type SkRect,
} from '@shopify/react-native-skia';
import {
  useFrameCallback,
  useSharedValue,
  type FrameInfo,
} from 'react-native-reanimated';
import { useCopy, usePixelStyles, type LocaleFaces } from '../i18n';
import { SfxPressable as Pressable } from '../ui/components/SfxPressable';
import type { PenaltyShootoutViewModel } from '../ui/models';
import { initAudio, playForEvent, teardownAudio } from './audio';
import { snapSpriteScale } from './interpolate';
import { PIXEL_ART_SAMPLING } from './pixel-art-sampling';
import { buildFallbackAtlas, buildSpriteAtlas } from './sprites/buildAtlas';
import { playerLookId } from './sprites/player-look';
import { clubKitPlan } from './sprites/club-kit';
import type { ClubKitChoice } from './sprites/club-kit';

// Half the original pace (720 / 420). Every kick shares a shooter, a keeper and
// a ball at the same three points on screen, so the eye has nothing to track
// between them: at the old speed the sequence read as one blur rather than as
// five separate penalties. The ball flight scales with OUTCOME_MS on its own.
export const PENALTY_KICK_MS = 1_440;
export const PENALTY_OUTCOME_MS = 840;
export const PENALTY_FINAL_HOLD_MS = 1_200;
export const PENALTY_REDUCED_MOTION_MS = 1_800;

const TURF = '#3f8a4a';
const TURF_ALT = '#5cb85c';
const CREAM = '#f4f1ea';
const INK = '#241f2e';
const MISS = '#f5a3a0';
const FALLBACK_SPRITE = 24;
const NOMINAL_PLAYER_SCALE = 3.4;
const NOMINAL_BALL_SCALE = 3;

export interface PenaltyShootoutProps {
  readonly shootout: PenaltyShootoutViewModel;
  readonly reduceMotion: boolean;
  /** The manager's kit setting, so these shirts match the ones on the pitch. */
  readonly colorSafeKits?: boolean;
  /** The club's own kit. Absent means the stock strip. */
  readonly clubKit?: ClubKitChoice;
  readonly onDone: () => void;
}

/** Presentation only: settlement and the recorded winner already exist. */
export function PenaltyShootout({
  shootout,
  reduceMotion,
  colorSafeKits = true,
  clubKit,
  onDone,
}: PenaltyShootoutProps) {
  const t = useCopy();
  const styles = usePixelStyles(makeStyles);
  const { width, height, scale: devicePixelRatio } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(0);
  const [revealedCount, setRevealedCount] = useState(
    reduceMotion ? shootout.kicks.length : 0,
  );
  const finished = useRef(false);

  const finishOnce = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    onDone();
  }, [onDone]);

  const elapsedMs = useSharedValue(0);
  const startedAt = useSharedValue(-1);
  const outcomeCode = useSharedValue(1);
  const direction = useSharedValue(1);
  /** +1 while the club shoots (left end), -1 while the opponent does (right). */
  const shootingEnd = useSharedValue(1);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const schedule = (task: () => void, delay: number) => {
      const timer = setTimeout(task, delay);
      timers.push(timer);
    };

    if (reduceMotion) {
      const last = shootout.kicks.at(-1);
      shootingEnd.value = last?.shootingSide === 'opponent' ? -1 : 1;
      setActiveIndex(Math.max(0, shootout.kicks.length - 1));
      setRevealedCount(shootout.kicks.length);
      schedule(finishOnce, PENALTY_REDUCED_MOTION_MS);
      return () => timers.forEach(clearTimeout);
    }

    initAudio('showcase');
    const startKick = (index: number) => {
      const kick = shootout.kicks[index];
      if (kick === undefined) {
        schedule(finishOnce, PENALTY_FINAL_HOLD_MS);
        return;
      }
      setActiveIndex(index);
      startedAt.value = -1;
      elapsedMs.value = 0;
      outcomeCode.value = kick.outcome === 'score' ? 1 : 0;
      direction.value = index % 2 === 0 ? 1 : -1;
      shootingEnd.value = kick.shootingSide === 'club' ? 1 : -1;
      playForEvent({
        t: 0,
        kind: 'SHOT',
        by: 0,
        power: 1,
        trajectory: 'driven',
      });
      schedule(() => {
        setRevealedCount(index + 1);
        playForEvent(
          kick.outcome === 'score'
            ? {
                t: 0,
                kind: 'GOAL',
                by: 0,
                team: kick.shootingSide === 'club' ? 0 : 1,
                scoredById: kick.shooter.playerId,
              }
            : { t: 0, kind: 'SAVE', by: 1, resolveLeft: 0 },
        );
      }, PENALTY_OUTCOME_MS);
      schedule(() => startKick(index + 1), PENALTY_KICK_MS);
    };

    startKick(0);
    return () => {
      timers.forEach(clearTimeout);
      teardownAudio();
    };
  }, [
    direction,
    elapsedMs,
    finishOnce,
    outcomeCode,
    reduceMotion,
    shootingEnd,
    shootout,
    startedAt,
  ]);

  const onFrame = useCallback(
    (info: FrameInfo) => {
      'worklet';
      if (startedAt.value < 0) startedAt.value = info.timestamp;
      elapsedMs.value = info.timestamp - startedAt.value;
    },
    [elapsedMs, startedAt],
  );
  useFrameCallback(onFrame, !reduceMotion);

  const kick =
    shootout.kicks[activeIndex] ?? shootout.kicks[shootout.kicks.length - 1]!;
  // The keeper always faces a shooter from the other club, so he takes the
  // opposite kit — never the same shirt as the man on the spot.
  const shooterIsHome = (side: 'club' | 'opponent') =>
    side === 'club' ? shootout.clubIsHome : !shootout.clubIsHome;
  const shooterVisualId = visualId(
    kick.shooter,
    shooterIsHome(kick.shootingSide),
  );
  const goalkeeperVisualId = visualId(
    kick.goalkeeper,
    !shooterIsHome(kick.shootingSide),
  );
  const visualIds = useMemo(() => {
    const isHome = (side: 'club' | 'opponent') =>
      side === 'club' ? shootout.clubIsHome : !shootout.clubIsHome;
    return [
      ...new Set(
        shootout.kicks.flatMap((item) => [
          visualId(item.shooter, isHome(item.shootingSide)),
          visualId(item.goalkeeper, !isHome(item.shootingSide)),
        ]),
      ),
    ];
  }, [shootout.clubIsHome, shootout.kicks]);
  const atlas = useMemo(() => {
    try {
      // Same palette override the pitch used, so a match played in amber does
      // not finish in red. Away is always the atlas blue and needs no override.
      return buildSpriteAtlas(
        Skia,
        visualIds,
        clubKitPlan({
          kit: clubKit,
          userSide: shootout.clubIsHome ? 'r' : 'u',
          colorSafeKits,
        }),
      );
    } catch (error) {
      console.warn('PenaltyShootout: sprite atlas unavailable', error);
      return buildFallbackAtlas(Skia, FALLBACK_SPRITE);
    }
  }, [clubKit, colorSafeKits, shootout.clubIsHome, visualIds]);
  const playerScale = snapSpriteScale(
    1,
    NOMINAL_PLAYER_SCALE,
    devicePixelRatio,
  ).drawScale;
  const ballScale = snapSpriteScale(
    1,
    NOMINAL_BALL_SCALE,
    devicePixelRatio,
  ).drawScale;
  const goalWidth = Math.min(width * 0.56, 260);
  const goalHeight = Math.min(height * 0.16, 104);
  const goalX = width * 0.5;
  const goalY = height * 0.34;
  // Two run-up spots, mirrored about the goal: the club always steps up from
  // the left and the opponent from the right. With one shared spot the only
  // thing that changed between kicks was the name caption, so a shootout read
  // as one team taking every penalty.
  const clubShooterX = width * 0.27;
  const opponentShooterX = width * 0.73;
  const shooterY = height * 0.65;
  const geometry = useSharedValue({
    goalX,
    goalY,
    goalWidth,
    clubShooterX,
    opponentShooterX,
    shooterY,
    playerScale,
    ballScale,
  });
  useEffect(() => {
    geometry.value = {
      goalX,
      goalY,
      goalWidth,
      clubShooterX,
      opponentShooterX,
      shooterY,
      playerScale,
      ballScale,
    };
  }, [
    ballScale,
    clubShooterX,
    geometry,
    goalWidth,
    goalX,
    goalY,
    opponentShooterX,
    playerScale,
    shooterY,
  ]);

  const sprites: SkRect[] = useMemo(() => {
    const shooter = atlas.rectFor(`${shooterVisualId}:run0`);
    const goalkeeper = atlas.rectFor(`${goalkeeperVisualId}:ready0`);
    const ball = atlas.rectFor('ball');
    return [
      Skia.XYWHRect(shooter.x, shooter.y, shooter.w, shooter.h),
      Skia.XYWHRect(goalkeeper.x, goalkeeper.y, goalkeeper.w, goalkeeper.h),
      Skia.XYWHRect(ball.x, ball.y, ball.w, ball.h),
    ];
  }, [atlas, goalkeeperVisualId, shooterVisualId]);

  const transforms = useRSXformBuffer(sprites.length, (transform, index) => {
    'worklet';
    const g = geometry.value;
    const t = Math.max(0, Math.min(1, elapsedMs.value / PENALTY_OUTCOME_MS));
    const eased = t * t * (3 - 2 * t);
    const dir = direction.value;
    // +1 shoots left-to-right, -1 right-to-left. Everything the shooter does
    // mirrors on it: where he stands, which boot the ball sits by, and which
    // way his run-up carries him.
    const end = shootingEnd.value;
    const shooterX = end === 1 ? g.clubShooterX : g.opponentShooterX;
    const halfPlayerW = 12 * g.playerScale;
    const halfPlayerH = 15 * g.playerScale;
    const halfBall = 3 * g.ballScale;
    const ballStartX = shooterX + end * halfPlayerW * 0.65;
    const ballStartY = g.shooterY + halfPlayerH * 0.75;
    const ballTargetX = g.goalX + dir * g.goalWidth * 0.22;
    const ballTargetY = g.goalY + 12;

    if (index === 0) {
      const lunge = Math.sin(Math.min(t, 0.5) * Math.PI * 2) * 10 * end;
      transform.set(
        g.playerScale,
        0,
        shooterX + lunge - halfPlayerW,
        g.shooterY - halfPlayerH,
      );
      return;
    }
    if (index === 1) {
      const keeperDirection = outcomeCode.value === 1 ? -dir : dir;
      const dive =
        Math.max(0, (t - 0.3) / 0.7) * keeperDirection * g.goalWidth * 0.2;
      transform.set(
        g.playerScale,
        0,
        g.goalX + dive - halfPlayerW,
        g.goalY - halfPlayerH,
      );
      return;
    }
    transform.set(
      g.ballScale,
      0,
      ballStartX + (ballTargetX - ballStartX) * eased - halfBall,
      ballStartY +
        (ballTargetY - ballStartY) * eased -
        Math.sin(eased * Math.PI) * 28 -
        halfBall,
    );
  });

  const visibleKicks = shootout.kicks.slice(0, revealedCount);
  const shownClubScore = visibleKicks.at(-1)?.clubScore ?? 0;
  const shownOpponentScore = visibleKicks.at(-1)?.opponentScore ?? 0;
  const final = revealedCount === shootout.kicks.length;
  const outcomeVisible = revealedCount > activeIndex;
  const winnerName =
    shootout.winner === 'club' ? shootout.clubName : shootout.opponentName;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('matchScreen.a11y.tapToSkip', {
        label: shootout.accessibilityLabel,
      })}
      onPress={finishOnce}
      style={styles.overlay}
    >
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        <Fill color={TURF} />
        {[0, 2, 4].map((stripe) => (
          <Rect
            key={stripe}
            x={0}
            y={(height / 6) * stripe}
            width={width}
            height={height / 6}
            color={TURF_ALT}
            antiAlias={false}
          />
        ))}
        <Rect
          x={goalX - goalWidth / 2}
          y={goalY - goalHeight / 2}
          width={goalWidth}
          height={goalHeight}
          color="rgba(244, 241, 234, 0.12)"
          antiAlias={false}
        />
        {[0.25, 0.5, 0.75].map((fraction) => (
          <Line
            key={`net-${fraction}`}
            p1={{
              x: goalX - goalWidth / 2,
              y: goalY - goalHeight / 2 + goalHeight * fraction,
            }}
            p2={{
              x: goalX + goalWidth / 2,
              y: goalY - goalHeight / 2 + goalHeight * fraction,
            }}
            color="rgba(244, 241, 234, 0.28)"
            strokeWidth={1}
            antiAlias={false}
          />
        ))}
        <Rect
          x={goalX - goalWidth / 2}
          y={goalY - goalHeight / 2}
          width={goalWidth}
          height={goalHeight}
          color={CREAM}
          style="stroke"
          strokeWidth={4}
          antiAlias={false}
        />
        <Atlas
          image={atlas.image as SkImage}
          sprites={sprites}
          transforms={transforms}
          sampling={PIXEL_ART_SAMPLING}
        />
      </Canvas>

      <View pointerEvents="none" style={styles.header}>
        <Text style={styles.title}>{t('penaltyShootout.title')}</Text>
        <View style={styles.scoreRow}>
          <ScoreSide
            name={shootout.clubName}
            score={shownClubScore}
            kicks={visibleKicks.filter((item) => item.shootingSide === 'club')}
            styles={styles}
          />
          <Text style={styles.scoreDivider}>–</Text>
          <ScoreSide
            name={shootout.opponentName}
            score={shownOpponentScore}
            kicks={visibleKicks.filter(
              (item) => item.shootingSide === 'opponent',
            )}
            styles={styles}
          />
        </View>
        {activeIndex >= 10 && !final ? (
          <Text style={styles.suddenDeath}>
            {t('penaltyShootout.suddenDeath')}
          </Text>
        ) : null}
      </View>

      {outcomeVisible && !reduceMotion ? (
        <View pointerEvents="none" style={styles.outcomeWrap}>
          <Text style={kick.outcome === 'score' ? styles.outcome : styles.miss}>
            {t(
              kick.outcome === 'score'
                ? 'penaltyShootout.score'
                : 'penaltyShootout.miss',
            )}
          </Text>
        </View>
      ) : null}

      {final ? (
        <View pointerEvents="none" style={styles.winnerWrap}>
          <Text style={styles.winner}>
            {t('penaltyShootout.winner', { club: winnerName })}
          </Text>
        </View>
      ) : null}

      <View pointerEvents="none" style={styles.shooterName}>
        <Text style={styles.smallText}>{kick.shooter.playerName}</Text>
      </View>
      <View pointerEvents="none" style={styles.skipHint}>
        <Text style={styles.smallText}>{t('penaltyShootout.tapToSkip')}</Text>
      </View>
    </Pressable>
  );
}

/**
 * Sprite identity for one side of a kick, in the kit that side actually wore.
 *
 * `r` and `u` are the two kit palettes in the shared atlas — home red and away
 * blue — and they are the whole of the game's jersey colour: the pitch itself
 * picks between the same two in `visualIdForMatchPlayer`, and `primaryColor` in
 * clubs.json never reaches a sprite. So "the real kit" means the home/away side
 * this club took in this fixture, which `clubIsHome` carries over from the
 * store. The prefix used to be a hardcoded `r`, so the shooter and the keeper
 * facing him wore the same red shirt and every kick looked like one team
 * taking all of them.
 */
function visualId(
  side: PenaltyShootoutViewModel['kicks'][number]['shooter'],
  isHomeSide: boolean,
) {
  return `${isHomeSide ? 'r' : 'u'}:${playerLookId(side.playerId, side.role, side.lookId)}`;
}

function ScoreSide({
  name,
  score,
  kicks,
  styles,
}: {
  name: string;
  score: number;
  kicks: PenaltyShootoutViewModel['kicks'];
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.scoreSide}>
      <Text style={styles.clubName} numberOfLines={1}>
        {name}
      </Text>
      <Text style={styles.score}>{score}</Text>
      <View style={styles.markers}>
        {kicks.map((kick) => (
          <View
            key={kick.id}
            style={
              kick.outcome === 'score' ? styles.markerScore : styles.markerMiss
            }
          >
            {kick.outcome === 'miss' ? (
              <Text style={styles.markerX}>×</Text>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

const makeStyles = (faces: LocaleFaces) =>
  StyleSheet.create({
    overlay: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      zIndex: 40,
      backgroundColor: TURF,
    },
    header: {
      position: 'absolute',
      top: 20,
      left: 16,
      right: 16,
      alignItems: 'center',
    },
    title: {
      fontFamily: faces.display,
      fontSize: 22,
      lineHeight: 28,
      color: CREAM,
      textShadowColor: INK,
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 0,
    },
    scoreRow: {
      marginTop: 6,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    scoreSide: { width: '38%', alignItems: 'center' },
    clubName: {
      maxWidth: '100%',
      fontFamily: faces.data,
      fontSize: 11,
      lineHeight: 16,
      color: CREAM,
    },
    score: {
      fontFamily: faces.data,
      fontSize: 36,
      lineHeight: 42,
      color: CREAM,
    },
    scoreDivider: {
      fontFamily: faces.data,
      fontSize: 36,
      lineHeight: 42,
      color: 'rgba(244, 241, 234, 0.7)',
    },
    markers: {
      minHeight: 10,
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 4,
    },
    markerScore: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: CREAM,
    },
    markerMiss: {
      width: 9,
      height: 9,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: MISS,
    },
    markerX: {
      marginTop: -4,
      fontFamily: faces.data,
      fontSize: 11,
      lineHeight: 11,
      color: MISS,
    },
    suddenDeath: {
      marginTop: 6,
      fontFamily: faces.display,
      fontSize: 11,
      lineHeight: 16,
      color: CREAM,
    },
    outcomeWrap: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: '47%',
      alignItems: 'center',
    },
    outcome: {
      fontFamily: faces.display,
      fontSize: 44,
      lineHeight: 52,
      color: CREAM,
      textShadowColor: INK,
      textShadowOffset: { width: 0, height: 4 },
      textShadowRadius: 0,
    },
    miss: {
      fontFamily: faces.display,
      fontSize: 44,
      lineHeight: 52,
      color: MISS,
      textShadowColor: INK,
      textShadowOffset: { width: 0, height: 4 },
      textShadowRadius: 0,
    },
    winnerWrap: {
      position: 'absolute',
      left: 16,
      right: 16,
      top: '56%',
      alignItems: 'center',
    },
    winner: {
      fontFamily: faces.display,
      fontSize: 22,
      lineHeight: 28,
      color: CREAM,
      textShadowColor: INK,
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 0,
    },
    shooterName: { position: 'absolute', left: 16, bottom: 20 },
    skipHint: { position: 'absolute', right: 16, bottom: 20 },
    smallText: {
      fontFamily: faces.data,
      fontSize: 11,
      lineHeight: 16,
      color: 'rgba(244, 241, 234, 0.8)',
    },
  });
