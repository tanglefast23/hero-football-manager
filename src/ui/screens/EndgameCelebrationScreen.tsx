import { useCallback, useEffect, useMemo, useRef } from 'react';
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
  Rect,
  Skia,
  type SkImage,
  type SkRect,
  type SkRSXform,
} from '@shopify/react-native-skia';
import { playLeagueChampionsSfx, stopLeagueChampionsSfx } from '../../render/menu-audio';
import { PLAYER_SPRITE_CELL, PlayerRunSprite } from '../../render/PlayerRunSprite';
import { buildFallbackAtlas, buildSpriteAtlas } from '../../render/sprites/buildAtlas';
import { PIXEL_ART_SAMPLING } from '../../render/pixel-art-sampling';
import { BertFullBody } from '../BertFullBody';
import { CharacterSpeechOverlay } from '../CharacterSpeechOverlay';
import { PixelText } from '../components/PixelText';
import { SfxPressable } from '../components/SfxPressable';
import {
  FIREWORK_CELL,
  fireworkBursts,
  fireworkShellRuns,
  type FireworkBurst,
} from '../endgame-fireworks';
import type {
  EndgameCelebrationPlayerViewModel,
  EndgameCelebrationViewModel,
} from '../models';

/**
 * The end of the climb, in three shapes.
 *
 * One screen rather than three, because all three stand on the same pixel-art
 * ground under the same fireworks and differ only in who walks out on it and
 * what is said. Splitting them would be three copies of a stadium.
 *
 * Nothing here touches `stopTheme`: whatever music carried the manager into
 * this moment carries him through it. Opening the summit with silence, or with
 * a restart, would make the biggest screen in the game the one that stutters.
 */

/** How long the two trophy screens hold before they hand back on their own. */
const TROPHY_SCENE_MS = 9_000;
const REDUCED_MOTION_MS = 6_000;
/** Gold, red and sky — the celebration palette the rest of the game uses. */
const FIREWORK_COLORS = ['#f6c744', '#d94f52', '#62b5e5'];
const FIREWORK_COUNT = 5;
/** One firing cycle of the whole sky, shared by every shell. */
const FIREWORK_LOOP_MS = 2_600;
const FALLBACK_SPRITE = 24;
const SPEECH_SPRITE_SCALE = 5;
/** Clearance the speaking star keeps above the bottom of the ground. */
const SPEECH_GROUND_OFFSET = 84;

type CelebrationAtlas = ReturnType<typeof buildSpriteAtlas>;

export interface EndgameCelebrationScreenProps {
  viewModel: EndgameCelebrationViewModel;
  reduceMotion?: boolean;
  onComplete: () => void;
}

export function EndgameCelebrationScreen({
  viewModel,
  reduceMotion = false,
  onComplete,
}: EndgameCelebrationScreenProps) {
  const finished = useRef(false);
  const completeOnce = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    stopLeagueChampionsSfx();
    onComplete();
  }, [onComplete]);

  return (
    <SafeAreaView
      className="flex-1 bg-ink"
      edges={['top', 'left', 'right', 'bottom']}
      accessibilityLabel={viewModel.accessibilityLabel}
    >
      <Ground />
      <FireworkSky sceneKey={viewModel.kind} reduceMotion={reduceMotion} />
      {viewModel.kind === 'true-ending' ? (
        <TrueEnding viewModel={viewModel} reduceMotion={reduceMotion} onDone={completeOnce} />
      ) : (
        <TrophyScene viewModel={viewModel} reduceMotion={reduceMotion} onDone={completeOnce} />
      )}
    </SafeAreaView>
  );
}

/**
 * A pixel-art football ground: floodlit stand, striped pitch, centre circle.
 * Flat blocks rather than art files, for the same reason the fireworks are runs
 * — it scales to any window and costs nothing to ship.
 */
function Ground() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={styles.nightSky} />
      <View style={styles.stand}>
        {Array.from({ length: 72 }, (_, index) => (
          <View
            key={index}
            style={[
              styles.fan,
              {
                left: `${(index * 37) % 100}%`,
                top: 10 + ((index * 23) % 120),
                backgroundColor: FIREWORK_COLORS[index % FIREWORK_COLORS.length],
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
  );
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
  sceneKey: string;
  reduceMotion: boolean;
}) {
  const { width, height } = useWindowDimensions();
  const progress = useRef(new Animated.Value(0)).current;
  const bursts = useMemo(() => fireworkBursts(sceneKey, FIREWORK_COUNT, FIREWORK_COLORS.length), [sceneKey]);

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
  const { width } = useWindowDimensions();
  const jump = useRef(new Animated.Value(0)).current;
  const summit = viewModel.kind === 'global-league';
  const celebrationVisualIds = useMemo(() => (
    [...(viewModel.star === undefined ? [] : [viewModel.star]), ...viewModel.squad]
      .map(player => player.spriteKey.slice(0, -':run0'.length))
  ), [viewModel.squad, viewModel.star]);
  const spriteAtlas = useMemo<CelebrationAtlas>(() => {
    try {
      return buildSpriteAtlas(Skia, celebrationVisualIds);
    } catch (error) {
      console.warn('EndgameCelebrationScreen: sprite atlas unavailable', error);
      return buildFallbackAtlas(Skia, FALLBACK_SPRITE);
    }
  }, [celebrationVisualIds]);

  useEffect(() => {
    playLeagueChampionsSfx();
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
    <ScrollView style={styles.scene} contentContainerStyle={styles.sceneContent}>
      <View style={styles.headerBlock}>
        <PixelText className="text-center text-xs uppercase tracking-[4px] text-gold">
          {viewModel.seasonLabel}
        </PixelText>
        <PixelText
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
        <View style={styles.bertFigure}>
          <BertFullBody pointing={false} />
        </View>
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
            {`Fame ${viewModel.star.fame}`}
          </PixelText>
        </View>
      )}

      <View style={styles.copyBlock}>
        {viewModel.lines.map(line => (
          <PixelText key={line} variant="body" className="mb-2 text-center text-sm leading-5 text-paper">
            {line}
          </PixelText>
        ))}
      </View>

      <SfxPressable
        accessibilityRole="button"
        accessibilityLabel="Continue"
        onPress={onDone}
        style={styles.control}
      >
        <PixelText className="text-xs uppercase text-white">Continue ▸</PixelText>
      </SfxPressable>
    </ScrollView>
  );
}

/**
 * The true ending: one man, alone on the pitch, talking to his manager.
 *
 * No skip control and no timeout. Everything else in the game can be skipped
 * once it has been seen; this plays exactly once in a career and every line of
 * it is the point, so the way out is tapping through to the last one.
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

  return (
    <>
      {/* The speech overlay makes the whole screen its button, so the title
          sits above it and takes no touches of its own. */}
      <View pointerEvents="none" style={styles.trueEndingHeader}>
        <PixelText className="text-center text-xs uppercase tracking-[4px] text-gold">
          {viewModel.seasonLabel}
        </PixelText>
        <PixelText
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

      {reduceMotion || star === undefined ? (
        <StaticFarewell viewModel={viewModel} onDone={onDone} />
      ) : (
        <CharacterSpeechOverlay
          lines={viewModel.lines}
          characterWidth={PLAYER_SPRITE_CELL.width * SPEECH_SPRITE_SCALE}
          characterHeight={PLAYER_SPRITE_CELL.height * SPEECH_SPRITE_SCALE}
          groundOffset={SPEECH_GROUND_OFFSET}
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
          onDone={onDone}
        />
      )}
    </>
  );
}

/**
 * The reduced-motion true ending, and the fallback for a club with nobody left
 * to send out. Every line at once, and one control to leave by: no part of what
 * he says is allowed to live only in the walk-on.
 */
function StaticFarewell({
  viewModel,
  onDone,
}: {
  viewModel: EndgameCelebrationViewModel;
  onDone: () => void;
}) {
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
      </ScrollView>
      <SfxPressable
        accessibilityRole="button"
        accessibilityLabel="Finish"
        onPress={onDone}
        style={styles.control}
      >
        <PixelText className="text-xs uppercase text-white">Finish ▸</PixelText>
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
  nightSky: { position: 'absolute', inset: 0, backgroundColor: '#19142a' },
  stand: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: '44%',
    overflow: 'hidden',
    borderBottomWidth: 5,
    borderBottomColor: '#241f2e',
    backgroundColor: '#3a3350',
  },
  fan: { position: 'absolute', width: 4, height: 4, opacity: 0.6 },
  pitch: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '60%',
    overflow: 'hidden',
    backgroundColor: '#3f8a4a',
  },
  pitchStripe: { position: 'absolute', left: '24%', top: 0, bottom: 0, width: '25%', backgroundColor: '#4f9b59' },
  pitchLine: { position: 'absolute', left: 0, right: 0, top: '52%', height: 3, backgroundColor: 'rgba(244,241,234,0.75)' },
  centerCircle: {
    position: 'absolute',
    left: '32%',
    top: '30%',
    width: '36%',
    aspectRatio: 1,
    borderWidth: 3,
    borderColor: 'rgba(244,241,234,0.75)',
    borderRadius: 999,
  },
  floodlight: {
    position: 'absolute',
    top: 16,
    width: 84,
    height: 16,
    backgroundColor: '#f4f1ea',
    shadowColor: '#ffffff',
    shadowOpacity: 0.9,
    shadowRadius: 22,
  },
  floodlightLeft: { left: -14, transform: [{ rotate: '-10deg' }] },
  floodlightRight: { right: -14, transform: [{ rotate: '10deg' }] },
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
  squadRow: { marginTop: 24, alignItems: 'center' },
  bertRow: { marginTop: 8, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 8 },
  bertFigure: { width: 64, height: 104, transform: [{ scale: 0.55 }] },
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
  copyBlock: { marginTop: 24, paddingHorizontal: 8 },
  control: {
    marginTop: 'auto',
    alignSelf: 'center',
    minWidth: 160,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#f6c744',
    backgroundColor: 'rgba(36,31,46,0.85)',
  },
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
