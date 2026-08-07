import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Atlas,
  Canvas,
  Circle,
  Group,
  Oval,
  Rect,
  Skia,
  useRSXformBuffer,
  type SkImage,
  type SkRect,
  type SkRSXform,
} from '@shopify/react-native-skia';
import {
  Easing as ReanimatedEasing,
  cancelAnimation,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { playLeagueChampionsSfx, stopLeagueChampionsSfx } from '../../render/menu-audio';
import {
  playCelebrationAnthem,
  playEndingFarewell,
  stopCelebrationAudio,
} from '../../render/celebration-audio';
import { PLAYER_SPRITE_CELL, PlayerRunSprite } from '../../render/PlayerRunSprite';
import { buildFallbackAtlas, buildSpriteAtlas } from '../../render/sprites/buildAtlas';
import { PIXEL_ART_SAMPLING } from '../../render/pixel-art-sampling';
import { BertFullBody } from '../BertFullBody';
import { CelebrationCoachRow } from '../components/CelebrationCoachRow';
import { CharacterSpeechOverlay } from '../CharacterSpeechOverlay';
import { PixelText } from '../components/PixelText';
import { SfxPressable } from '../components/SfxPressable';
import {
  FIREWORK_CELL,
  fireworkBursts,
  fireworkShellRuns,
  type FireworkBurst,
} from '../endgame-fireworks';
import { grassTopFor, groundScene } from '../endgame-ground';
import {
  bertSignoffLines,
  FINALE_BERT_MOMENT,
  FINALE_CELL,
  finaleStage,
  type FinaleBert,
  type FinaleSpot,
} from '../endgame-finale';
import type {
  EndgameCelebrationKind,
  EndgameCelebrationPlayerViewModel,
  EndgameCelebrationViewModel,
} from '../models';
import { useCopy } from '../../i18n';

/**
 * The end of the climb, in three shapes.
 *
 * One screen rather than three, because all three stand on the same pixel-art
 * ground under the same fireworks and differ only in who walks out on it and
 * what is said. Splitting them would be three copies of a stadium.
 *
 * Each moment brings its own music rather than carrying the previous screen's
 * bed through. The design doc asked for continuity, and the owner overruled it
 * once the true ending existed to listen to: a season-boundary theme playing
 * under a man thanking you for his career is the wrong sound, and the summit is
 * the one place in the game worth its own song. The true ending therefore runs
 * TWO — the farewell under the speech, the anthem the moment the squad joins
 * him — handed over in `TrueEnding`.
 */

/** How long the two trophy screens hold before they hand back on their own. */
const TROPHY_SCENE_MS = 9_000;
const REDUCED_MOTION_MS = 6_000;
/** Gold, red and sky — the celebration palette the rest of the game uses. */
const FIREWORK_COLORS = ['#f6c744', '#d94f52', '#62b5e5'];
/**
 * How many shells each moment gets.
 *
 * Cup Winners is staged smaller than the D1 screen on purpose (the design doc's
 * section 5), and the sky is the loudest thing on it. Leaving all five up there
 * inflated the Cup past the summit it is supposed to sit below, so it gets
 * three — enough for a sky that keeps going, not enough to out-shout D1.
 */
const FIREWORK_COUNTS: Readonly<Record<EndgameCelebrationKind, number>> = Object.freeze({
  'global-league': 5,
  'cup-winners': 3,
  'true-ending': 5,
});
/** One firing cycle of the whole sky, shared by every shell. */
const FIREWORK_LOOP_MS = 2_600;
const FALLBACK_SPRITE = 24;
const SPEECH_SPRITE_SCALE = 6;
/**
 * How far up the foreground grass the speaking star stands, as a fraction of
 * the grass band. High enough that his head breaks the horizon against the
 * stand — a figure entirely below the grass line reads as pasted on rather
 * than standing in the place — and clear of anything docked at the bottom.
 */
const SPEECH_GRASS_FRACTION = 0.38;
const SPEECH_GROUND_FLOOR = 96;
/** Bert, beside a squad that is two-thirds of the way back up the pitch. */
const BERT_SCALE = 0.4;
/** One jump-and-land of the curtain call, shared by everybody on the pitch. */
const CURTAIN_LOOP_MS = 900;
/** How high a man leaves the grass, in art pixels before his own scale. */
const JUMP_HEIGHT = 7;
/** How far the star rocks either side of upright. About fifteen degrees. */
const DANCE_RADIANS = 0.26;
/**
 * Where a speaking character comes to rest, as a fraction of the window in from
 * the right. Mirrors `CharacterSpeechOverlay`'s own mark, so the silent Bert of
 * the reduced-motion still lies exactly where the talking one does.
 */
const BERT_REST_FROM_RIGHT = 0.2;
/**
 * Type in the sky carries its own ink halo.
 *
 * The sky is not a flat backdrop any more — a shell opens in it, and a lamp
 * bank at `#f4f1ea` sits in it. White copy crossing either of those is white on
 * white. A halo is the bible's own 1px ink drop-shadow opened up enough to
 * survive the brightest thing behind it, and it costs no rectangle.
 */
const SKY_TEXT_HALO = Object.freeze({
  textShadowColor: '#19142a',
  textShadowOffset: { width: 0, height: 2 },
  textShadowRadius: 7,
});

type CelebrationAtlas = ReturnType<typeof buildSpriteAtlas>;

export interface EndgameCelebrationScreenProps {
  viewModel: EndgameCelebrationViewModel;
  reduceMotion?: boolean;
  onComplete: () => void;
  /**
   * The very last tap of the true ending, which belongs on the title screen
   * rather than on next season's desk.
   *
   * Optional, and falls back to `onComplete`: the two trophy moments never
   * reach it, and a caller that only has one way off the screen — the dev
   * harness — should not have to invent a second.
   */
  onReturnToTitle?: () => void;
}

export function EndgameCelebrationScreen({
  viewModel,
  reduceMotion = false,
  onComplete,
  onReturnToTitle,
}: EndgameCelebrationScreenProps) {
  const finished = useRef(false);
  const completeOnce = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    stopLeagueChampionsSfx();
    stopCelebrationAudio();
    onComplete();
  }, [onComplete]);
  const returnToTitleOnce = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    stopLeagueChampionsSfx();
    stopCelebrationAudio();
    (onReturnToTitle ?? onComplete)();
  }, [onComplete, onReturnToTitle]);

  return (
    // The ground is full-bleed and sits outside the safe area on purpose. An
    // absolutely-positioned child of a SafeAreaView is placed inside its
    // padding, which would have left an ink strip along the notch and another
    // under the grass — the stacked-layer look this scene exists to end.
    <View className="flex-1 bg-ink">
      <Ground />
      <FireworkSky sceneKey={viewModel.kind} reduceMotion={reduceMotion} />
      {/* Each moment carries its own safe area rather than sharing one here,
          because the true ending paints a layer of its own BEHIND the copy —
          men standing on the grass, placed in window coordinates — and an
          absolutely-positioned child of a SafeAreaView lands inside its
          padding, which would drop the whole squad by the height of the notch. */}
      {viewModel.kind === 'true-ending' ? (
        <TrueEnding
          viewModel={viewModel}
          reduceMotion={reduceMotion}
          onDone={returnToTitleOnce}
        />
      ) : (
        <TrophyScene viewModel={viewModel} reduceMotion={reduceMotion} onDone={completeOnce} />
      )}
    </View>
  );
}

/** The safe box the copy and the controls of every moment live inside. */
function CelebrationSafeArea({
  accessibilityLabel,
  children,
}: {
  accessibilityLabel: string;
  children: React.ReactNode;
}) {
  return (
    <SafeAreaView
      className="flex-1"
      edges={['top', 'left', 'right', 'bottom']}
      accessibilityLabel={accessibilityLabel}
    >
      {children}
    </SafeAreaView>
  );
}

/**
 * The ground itself, in one Skia pass.
 *
 * The whole composition — where the horizon falls, which rectangle is which
 * ink — lives in `endgame-ground.ts` as a pure function of the window size, so
 * this is only the paint. Flat rects rather than art files, for the same reason
 * the fireworks are runs: it fits any window without resampling and costs
 * nothing in the bundle.
 */
function Ground() {
  const { width, height } = useWindowDimensions();
  const scene = useMemo(() => groundScene(width, height), [width, height]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* Keyed on the window size so a resize builds a new surface. Skia's web
          canvas keeps the surface it was created with: restyling it stretches
          nothing and the ground stayed drawn at the old width, ending in mid-air
          partway across a widened desktop window. */}
      <Canvas
        key={`${width}x${height}`}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ width, height }}
      >
        <Group>
          {scene.sky.map(rect => (
            <Rect
              key={rect.id}
              x={rect.x}
              y={rect.y}
              width={rect.width}
              height={rect.height}
              color={rect.color}
            />
          ))}
        </Group>
        <Group>
          {scene.glows.map(glow => (
            <Circle
              key={glow.id}
              cx={glow.cx}
              cy={glow.cy}
              r={glow.radius}
              color={glow.color}
              opacity={glow.opacity}
            />
          ))}
        </Group>
        <Group>
          {scene.rects.map(rect => (
            <Rect
              key={rect.id}
              x={rect.x}
              y={rect.y}
              width={rect.width}
              height={rect.height}
              color={rect.color}
              opacity={rect.opacity ?? 1}
            />
          ))}
        </Group>
      </Canvas>
    </View>
  );
}

/**
 * The one sprite sheet every man on this screen is drawn from.
 *
 * Falls back to flat blocks rather than throwing: a missing look would take out
 * the last screen of a career, and a celebration in silhouette is a better
 * ending than a crash.
 */
function useCelebrationAtlas(
  players: readonly EndgameCelebrationPlayerViewModel[],
): CelebrationAtlas {
  const visualIds = useMemo(
    () => players.map(player => player.spriteKey.slice(0, -':run0'.length)),
    [players],
  );
  return useMemo<CelebrationAtlas>(() => {
    try {
      return buildSpriteAtlas(Skia, visualIds);
    } catch (error) {
      console.warn('EndgameCelebrationScreen: sprite atlas unavailable', error);
      return buildFallbackAtlas(Skia, FALLBACK_SPRITE);
    }
  }, [visualIds]);
}

/** Where a celebration's feet belong: up in the near grass, not on the floor. */
function useGrassFootline(): number {
  const { height } = useWindowDimensions();
  return Math.max(SPEECH_GROUND_FLOOR, (height - grassTopFor(height)) * SPEECH_GRASS_FRACTION);
}

/**
 * The shells going off above the stand.
 *
 * Reduced motion parks every one of them open at full brightness: a still sky
 * of fireworks is the same information as a moving one, and the moving version
 * is the part that has to go.
 */
function FireworkSky({
  sceneKey,
  reduceMotion,
}: {
  sceneKey: EndgameCelebrationKind;
  reduceMotion: boolean;
}) {
  const { width, height } = useWindowDimensions();
  const progress = useRef(new Animated.Value(0)).current;
  const bursts = useMemo(
    () => fireworkBursts(sceneKey, FIREWORK_COUNTS[sceneKey], FIREWORK_COLORS.length),
    [sceneKey],
  );

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(1);
      return undefined;
    }
    progress.setValue(0);
    const loop = Animated.loop(Animated.timing(progress, {
      toValue: 1,
      duration: FIREWORK_LOOP_MS,
      easing: Easing.linear,
      useNativeDriver: true,
    }));
    loop.start();
    return () => loop.stop();
  }, [progress, reduceMotion]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {bursts.map(burst => (
        <FireworkShell
          key={burst.id}
          burst={burst}
          progress={progress}
          reduceMotion={reduceMotion}
          left={(width * burst.leftPercent) / 100}
          top={(height * burst.topPercent) / 100}
        />
      ))}
    </View>
  );
}

function FireworkShell({
  burst,
  progress,
  reduceMotion,
  left,
  top,
}: {
  burst: FireworkBurst;
  progress: Animated.Value;
  reduceMotion: boolean;
  left: number;
  top: number;
}) {
  const runs = useMemo(() => fireworkShellRuns(burst.shellId), [burst.shellId]);
  const color = FIREWORK_COLORS[burst.colorIndex % FIREWORK_COLORS.length];
  // One art pixel, at this shell's depth in the sky.
  const pixel = 2 * burst.scale;
  const size = FIREWORK_CELL * pixel;

  // Each shell owns a window of the shared loop: it opens, holds, and fades
  // while the others are elsewhere in their own windows.
  const open = burst.phase;
  const peak = (open + 0.16) % 1;
  const gone = (open + 0.34) % 1;
  const wraps = gone < open;
  const stops = wraps ? [0, gone, open, peak, 1] : [0, open, peak, gone, 1];
  const values = wraps ? [1, 0, 0, 1, 1] : [0, 0, 1, 0, 0];

  const animated = reduceMotion ? undefined : {
    opacity: progress.interpolate({ inputRange: stops, outputRange: values }),
    transform: [{
      scale: progress.interpolate({
        inputRange: stops,
        outputRange: wraps ? [1, 0.35, 0.35, 1, 1] : [0.35, 0.35, 1, 1.12, 1.12],
      }),
    }],
  };

  return (
    <Animated.View style={[{ position: 'absolute', left, top, width: size, height: size }, animated]}>
      <Canvas style={{ width: size, height: size }}>
        {runs.map(run => (
          <Rect
            key={run.id}
            x={run.x * pixel}
            y={run.y * pixel}
            width={run.width * pixel}
            height={pixel}
            color={color}
            opacity={run.opacity}
          />
        ))}
      </Canvas>
    </Animated.View>
  );
}

/**
 * Global League Champions and Cup Winners: the squad and Bert walk out
 * together, jumping, with the star out in front.
 *
 * The Cup screen is staged smaller on purpose. It is a real achievement out of
 * sequence, not the end of the climb, and giving it the same size as D1 would
 * say the manager had arrived when the copy is telling him he has not.
 */
function TrophyScene({
  viewModel,
  reduceMotion,
  onDone,
}: {
  viewModel: EndgameCelebrationViewModel;
  reduceMotion: boolean;
  onDone: () => void;
}) {
  const t = useCopy();
  const { width } = useWindowDimensions();
  const jump = useRef(new Animated.Value(0)).current;
  const summit = viewModel.kind === 'global-league';
  const spriteAtlas = useCelebrationAtlas(useMemo(
    () => [...(viewModel.star === undefined ? [] : [viewModel.star]), ...viewModel.squad],
    [viewModel.squad, viewModel.star],
  ));

  useEffect(() => {
    playLeagueChampionsSfx();
    playCelebrationAnthem();
    const timeout = setTimeout(onDone, reduceMotion ? REDUCED_MOTION_MS : TROPHY_SCENE_MS);
    if (reduceMotion) return () => clearTimeout(timeout);
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(jump, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(jump, {
        toValue: 0,
        duration: 380,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.delay(140),
    ]));
    animation.start();
    return () => {
      clearTimeout(timeout);
      animation.stop();
    };
  }, [jump, onDone, reduceMotion]);

  const jumpStyle = reduceMotion ? undefined : {
    transform: [{
      translateY: jump.interpolate({ inputRange: [0, 1], outputRange: [0, summit ? -34 : -22] }),
    }],
  };

  return (
    <CelebrationSafeArea accessibilityLabel={viewModel.accessibilityLabel}>
    <ScrollView style={styles.scene} contentContainerStyle={styles.sceneContent}>
      <View style={styles.headerBlock}>
        <PixelText
          style={SKY_TEXT_HALO}
          className="text-center text-xs uppercase tracking-[4px] text-gold"
        >
          {viewModel.seasonLabel}
        </PixelText>
        <PixelText
          style={SKY_TEXT_HALO}
          className={`mt-2 text-center uppercase text-white ${summit ? 'text-3xl leading-9' : 'text-2xl leading-7'}`}
          adjustsFontSizeToFit
          numberOfLines={2}
        >
          {viewModel.headline}
        </PixelText>
        <View style={styles.subheadingBand}>
          <PixelText className="text-center text-xs uppercase text-gold" numberOfLines={2}>
            {viewModel.subheading}
          </PixelText>
        </View>
      </View>

      {/* The copy sits in the sky with the title. Down on the grass it would
          need a panel behind it to stay readable, and a panel there is one more
          box standing between the player and the men he sent out. */}
      <View style={styles.copyBlock}>
        {viewModel.lines.map(line => (
          <PixelText
            key={line}
            variant="body"
            style={SKY_TEXT_HALO}
            className="mb-2 text-center text-sm leading-5 text-paper"
          >
            {line}
          </PixelText>
        ))}
      </View>

      {/* Everything below is pushed down onto the grass. */}
      <View style={styles.skyGap} />

      <Animated.View style={[styles.squadRow, jumpStyle]}>
        <CelebrationSpriteRow
          atlas={spriteAtlas}
          players={[
            ...(viewModel.star === undefined ? [] : [viewModel.star]),
            ...viewModel.squad,
          ].slice(0, summit ? 11 : 7)}
          width={Math.max(280, width - 32)}
          height={summit ? 92 : 74}
          maxScale={summit ? 2.1 : 1.6}
        />
      </Animated.View>

      <View style={styles.bertRow}>
        {/* Beside Bert, on the same grass line: the bench, watching the club
            they built come out with the trophy. */}
        <CelebrationCoachRow coaches={viewModel.coaches} spriteWidth={30} />
        {/* Sized through his own scale prop rather than a transform: a
            transformed box still takes its full height in layout, and the 47pt
            it was quietly holding is 47pt of grass the squad never got to
            stand on. */}
        <BertFullBody pointing={false} scale={BERT_SCALE} />
        <View style={styles.bertLabel}>
          <PixelText className="text-[10px] uppercase text-white">{viewModel.assistantName}</PixelText>
        </View>
      </View>

      {viewModel.star === undefined ? null : (
        <View style={styles.nameplate}>
          <PixelText className="text-center text-base uppercase text-ink" numberOfLines={1}>
            {viewModel.star.name}
          </PixelText>
          <PixelText variant="data" className="mt-1 text-center text-[10px] uppercase text-ink/70">
            {t('endgameCelebration.fame', { fame: viewModel.star.fame })}
          </PixelText>
        </View>
      )}

      <SfxPressable
        accessibilityRole="button"
        accessibilityLabel={t('endgameCelebration.a11y.continue')}
        onPress={onDone}
        style={styles.control}
      >
        {/* '›' is in Silkscreen; '▸' is not and rendered in the fallback face. */}
        <PixelText className="text-xs uppercase text-white">{t('endgameCelebration.continue')}</PixelText>
      </SfxPressable>
    </ScrollView>
    </CelebrationSafeArea>
  );
}

/**
 * The true ending, in two halves.
 *
 * First one man, alone on the pitch, talking to his manager. Then — once he has
 * said the last of it and walked off — the rest of the club coming out to the
 * middle of the grass, and Bert flat out in front of them with the last thing
 * anybody says in this game.
 *
 * No skip control and no timeout, across both halves. Everything else in the
 * game can be skipped once it has been seen; this plays exactly once in a
 * career and every line of it is the point, so the way out is tapping through
 * to the last one.
 */
function TrueEnding({
  viewModel,
  reduceMotion,
  onDone,
}: {
  viewModel: EndgameCelebrationViewModel;
  reduceMotion: boolean;
  onDone: () => void;
}) {
  const star = viewModel.star;
  const { width, height } = useWindowDimensions();
  const groundOffset = useGrassFootline();
  const [walkedOff, setWalkedOff] = useState(false);
  // Reduced motion, and a club with nobody left to send out, both go straight
  // to the still frame: everybody already in position, every bubble at once.
  const still = reduceMotion || star === undefined;
  const curtainCall = still || walkedOff;

  // Two beds, handed over on the same frame the squad joins him: the farewell
  // holds the speech for as long as the player takes to read it, and the anthem
  // opens the instant the pitch fills. Reduced motion collapses both beats into
  // one picture with everybody already out, so it opens on the anthem and never
  // plays the speech bed at all.
  useEffect(() => {
    if (curtainCall) playCelebrationAnthem();
    else playEndingFarewell();
  }, [curtainCall]);
  // Leaving for the title screen must not carry a song with it.
  useEffect(() => () => stopCelebrationAudio(), []);

  const performers = useMemo(() => (
    [...(star === undefined ? [] : [star]), ...viewModel.squad].map(player => ({
      id: player.id,
      spriteKey: player.spriteKey,
      isStar: player.id === star?.id,
    }))
  ), [star, viewModel.squad]);
  const stage = useMemo(() => finaleStage(performers, width, height), [performers, width, height]);
  const atlas = useCelebrationAtlas(
    useMemo(() => [...(star === undefined ? [] : [star]), ...viewModel.squad], [star, viewModel.squad]),
  );

  return (
    <>
      {/* Outside the safe area with the ground and the sky: these men stand in
          window coordinates, on grass that runs to the edges of the glass. */}
      {curtainCall ? (
        <>
          <CurtainCall spots={stage.spots} atlas={atlas} reduceMotion={reduceMotion} />
          {/* Stood over Bert, who is flat out in the near grass. He keeps his
              mark and his moment; the staff fill the space beside him that the
              squad never reaches, on the same footline he lies on. */}
          <View
            pointerEvents="none"
            style={[styles.finaleCoaches, {
              bottom: stage.bert.up,
              right: width * BERT_REST_FROM_RIGHT + stage.bert.boxWidth * 0.75,
            }]}
          >
            <CelebrationCoachRow coaches={viewModel.coaches} spriteWidth={32} />
          </View>
        </>
      ) : null}

      <CelebrationSafeArea accessibilityLabel={viewModel.accessibilityLabel}>
      {/* The speech overlay makes the whole screen its button, so the title
          sits above it and takes no touches of its own. */}
      <View pointerEvents="none" style={styles.trueEndingHeader}>
        <PixelText
          style={SKY_TEXT_HALO}
          className="text-center text-xs uppercase tracking-[4px] text-gold"
        >
          {viewModel.seasonLabel}
        </PixelText>
        <PixelText
          style={SKY_TEXT_HALO}
          className="mt-2 text-center text-3xl uppercase leading-9 text-white"
          adjustsFontSizeToFit
          numberOfLines={2}
        >
          {viewModel.headline}
        </PixelText>
        <View style={styles.subheadingBand}>
          <PixelText className="text-center text-xs uppercase text-gold" numberOfLines={2}>
            {viewModel.subheading}
          </PixelText>
        </View>
      </View>

      {still ? (
        <>
          {/* The talking Bert is placed by the speech overlay; the silent one
              has to be placed here, on the same mark and in the same box, so
              reduced motion shows the scene the tapped version builds. */}
          <View
            pointerEvents="none"
            style={[styles.stillBert, {
              bottom: stage.bert.up,
              right: width * BERT_REST_FROM_RIGHT - stage.bert.boxWidth / 2,
            }]}
          >
            <LyingBert bert={stage.bert} />
          </View>
          <StaticFarewell viewModel={viewModel} onDone={onDone} />
        </>
      ) : curtainCall ? (
        <BertSignOff bert={stage.bert} onDone={onDone} />
      ) : (
        <CharacterSpeechOverlay
          lines={viewModel.lines}
          characterWidth={PLAYER_SPRITE_CELL.width * SPEECH_SPRITE_SCALE}
          characterHeight={PLAYER_SPRITE_CELL.height * SPEECH_SPRITE_SCALE}
          groundOffset={groundOffset}
          bubbleScale={1.1}
          accessibilityLabel={viewModel.accessibilityLabel}
          renderCharacter={({ walking }) => (
            <PlayerRunSprite
              playerId={star.id}
              role={star.role}
              {...(star.lookId === undefined ? {} : { lookId: star.lookId })}
              scale={SPEECH_SPRITE_SCALE}
              walking={walking}
            />
          )}
          onDone={() => setWalkedOff(true)}
        />
      )}
      </CelebrationSafeArea>
    </>
  );
}

/**
 * Bert's sign-off, said lying down in the near grass while the club jumps
 * behind him.
 *
 * `instant` because he is already there — he does not walk on, he is the man
 * who has been on the floor since the final whistle — and because the tap past
 * his last line should hand straight over rather than march him off screen.
 */
function BertSignOff({
  bert,
  onDone,
}: {
  bert: FinaleBert;
  onDone: () => void;
}) {
  const t = useCopy();
  return (
    <CharacterSpeechOverlay
      lines={bertSignoffLines(t)}
      characterWidth={bert.boxWidth}
      // The DRAWN height, not the box's. A lying pose leaves the top third of a
      // box built for a standing man empty, and a bubble placed off the box
      // hangs in the air well above his head with its tail pointing at nothing.
      characterHeight={bert.visibleHeight}
      groundOffset={bert.up}
      // Left at its own size, unlike the star's. His bubble was scaled up to
      // match a figure drawn six times life size; Bert is a small man lying
      // down, and a bubble grown to match the star's would reach up over the
      // squad he is talking about.
      instant
      accessibilityLabel={bertSignoffLines(t).join(' ')}
      onDone={onDone}
    >
      <LyingBert bert={bert} />
    </CharacterSpeechOverlay>
  );
}

/**
 * The figure itself, sat on the bottom edge of a box cropped to what he
 * actually covers. The empty strip above his head overflows upward, where there
 * is nothing to collide with.
 */
function LyingBert({ bert }: { bert: FinaleBert }) {
  return (
    <View style={{ width: bert.boxWidth, height: bert.visibleHeight }}>
      <View style={{ position: 'absolute', left: 0, bottom: -bert.boxFloorGap }}>
        <BertFullBody
          pointing={false}
          moment={FINALE_BERT_MOMENT}
          scale={bert.scale}
          // The walk-on draws its own contact shadow; his baked-in one would
          // sit under a man who is not standing on it.
          groundShadow={false}
        />
      </View>
    </View>
  );
}

/**
 * The club out in the middle of the field: everybody jumping, the star among
 * them dancing rather than jumping.
 *
 * One batched Atlas draw for the whole squad, moved from the UI thread by a
 * single shared value — one component per sprite is the known perf trap, and
 * twelve of them each running their own timer is how a phone drops the last
 * frame of its own ending.
 *
 * Reduced motion parks the loop at zero: everybody stands in position, nobody
 * jumps, and the star stands square instead of rocking.
 */
function CurtainCall({
  spots,
  atlas,
  reduceMotion,
}: {
  spots: readonly FinaleSpot[];
  atlas: CelebrationAtlas;
  reduceMotion: boolean;
}) {
  const { width, height } = useWindowDimensions();
  const bounce = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      bounce.value = 0;
      return undefined;
    }
    bounce.value = 0;
    bounce.value = withRepeat(
      withTiming(1, { duration: CURTAIN_LOOP_MS, easing: ReanimatedEasing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(bounce);
  }, [bounce, reduceMotion]);

  const sprites: SkRect[] = useMemo(() => spots.map(spot => {
    const rect = atlas.rectFor(spot.spriteKey);
    return Skia.XYWHRect(rect.x, rect.y, rect.w, rect.h);
  }), [atlas, spots]);

  const transforms = useRSXformBuffer(spots.length, (transform, index) => {
    'worklet';
    const spot = spots[index];
    const beat = (bounce.value + spot.phase) % 1;
    const wave = Math.sin(beat * Math.PI * 2);
    // A jumper is off the floor for half his cycle and stood on it for the
    // other half, which is what a person jumping actually does; a full sine
    // would sink him into the grass on the way back.
    const lift = spot.dancing ? 0 : Math.max(0, wave) * JUMP_HEIGHT * spot.scale;
    const rotation = spot.dancing ? wave * DANCE_RADIANS : 0;
    const cos = Math.cos(rotation) * spot.scale;
    const sin = Math.sin(rotation) * spot.scale;
    const centreX = spot.x + (FINALE_CELL.width * spot.scale) / 2;
    const centreY = spot.y + (FINALE_CELL.height * spot.scale) / 2 - lift;
    transform.set(
      cos,
      sin,
      centreX - (cos * FINALE_CELL.width - sin * FINALE_CELL.height) / 2,
      centreY - (sin * FINALE_CELL.width + cos * FINALE_CELL.height) / 2,
    );
  });

  const dancer = spots.find(spot => spot.dancing);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Canvas
        key={`${width}x${height}`}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ width, height }}
      >
        {dancer === undefined ? null : (
          // A pool of light on the grass under the one man not jumping, so the
          // eye finds him in a row of twelve. Flattened, because the grass is
          // seen from the touchline: a circle here would stand up like a hoop.
          <Oval
            x={dancer.x - (FINALE_CELL.width * dancer.scale) / 2}
            y={dancer.y + FINALE_CELL.height * dancer.scale - FINALE_CELL.width * dancer.scale * 0.2}
            width={FINALE_CELL.width * dancer.scale * 2}
            height={FINALE_CELL.width * dancer.scale * 0.4}
            color="#f6c744"
            opacity={0.3}
          />
        )}
        <Atlas
          image={atlas.image as SkImage}
          sprites={sprites}
          transforms={transforms}
          sampling={PIXEL_ART_SAMPLING}
        />
      </Canvas>
    </View>
  );
}

/**
 * The reduced-motion true ending, and the fallback for a club with nobody left
 * to send out. Every line at once — the star's, then Bert's — and one control
 * to leave by: no part of what either of them says is allowed to live only in
 * an animation.
 */
function StaticFarewell({
  viewModel,
  onDone,
}: {
  viewModel: EndgameCelebrationViewModel;
  onDone: () => void;
}) {
  const t = useCopy();
  return (
    <View style={styles.farewell}>
      <ScrollView style={styles.farewellList} contentContainerStyle={styles.farewellScroll}>
        {viewModel.star === undefined ? null : (
          <PixelText className="mb-3 text-center text-sm uppercase text-gold">
            {viewModel.star.name}
          </PixelText>
        )}
        {viewModel.lines.map(line => (
          <View key={line} style={styles.farewellBubble}>
            <PixelText variant="body" className="text-sm leading-5 text-ink">{line}</PixelText>
          </View>
        ))}
        <PixelText className="mb-3 mt-4 text-center text-sm uppercase text-gold">
          {viewModel.assistantName}
        </PixelText>
        {bertSignoffLines(t).map(line => (
          <View key={line} style={styles.farewellBubble}>
            <PixelText variant="body" className="text-sm leading-5 text-ink">{line}</PixelText>
          </View>
        ))}
      </ScrollView>
      <SfxPressable
        accessibilityRole="button"
        accessibilityLabel={t('endgameCelebration.a11y.finish')}
        onPress={onDone}
        style={styles.control}
      >
        <PixelText className="text-xs uppercase text-white">{t('endgameCelebration.finish')}</PixelText>
      </SfxPressable>
    </View>
  );
}

/**
 * The squad in one batched Atlas draw. One component per sprite is the known
 * perf trap; the whole row is a single call however many men walk out.
 */
function CelebrationSpriteRow({
  atlas,
  players,
  width,
  height,
  maxScale,
}: {
  atlas: CelebrationAtlas;
  players: readonly EndgameCelebrationPlayerViewModel[];
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
      <Atlas
        image={atlas.image as SkImage}
        sprites={sprites}
        transforms={transforms}
        sampling={PIXEL_ART_SAMPLING}
      />
    </Canvas>
  );
}

const styles = StyleSheet.create({
  scene: { flex: 1 },
  sceneContent: { flexGrow: 1, paddingHorizontal: 16, paddingVertical: 16 },
  headerBlock: { width: '100%' },
  trueEndingHeader: { position: 'absolute', left: 16, right: 16, top: 16, zIndex: 5 },
  subheadingBand: {
    marginTop: 12,
    alignSelf: 'center',
    borderWidth: 2,
    borderColor: '#f6c744',
    backgroundColor: 'rgba(36,31,46,0.8)',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  // Sky above, grass below: the gap is what puts the walk-out on the turf
  // instead of leaving it hanging where the old empty band used to be.
  skyGap: { flex: 1, minHeight: 24 },
  squadRow: { alignItems: 'center' },
  bertRow: { marginTop: 8, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 8 },
  bertLabel: {
    borderWidth: 2,
    borderColor: '#f6c744',
    backgroundColor: '#241f2e',
    paddingHorizontal: 8,
    paddingVertical: 4,
    minHeight: 24,
    justifyContent: 'center',
  },
  nameplate: {
    marginTop: 16,
    alignSelf: 'center',
    borderWidth: 3,
    borderColor: '#241f2e',
    backgroundColor: '#f6c744',
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 48,
    justifyContent: 'center',
    shadowColor: '#241f2e',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  copyBlock: { marginTop: 20, paddingHorizontal: 8 },
  control: {
    marginTop: 20,
    alignSelf: 'center',
    minWidth: 160,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#f6c744',
    backgroundColor: 'rgba(36,31,46,0.85)',
  },
  stillBert: { position: 'absolute' },
  finaleCoaches: { position: 'absolute', zIndex: 2 },
  // Below the fixed title band, which is about 150pt tall at the 375pt floor.
  farewell: { flex: 1, paddingHorizontal: 16, paddingBottom: 16, paddingTop: 180 },
  farewellList: { flex: 1 },
  farewellScroll: { paddingBottom: 16 },
  farewellBubble: {
    marginBottom: 12,
    borderWidth: 3,
    borderColor: '#241f2e',
    borderRadius: 10,
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
});
