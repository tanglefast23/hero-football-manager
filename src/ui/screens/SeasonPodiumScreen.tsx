import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SfxPressable as Pressable } from '../components/SfxPressable';
import { PlayerRunSprite } from '../../render/PlayerRunSprite';
import { playManagementActionSfx } from '../../render/management-sfx';
import type { SeasonPodiumPlaceViewModel, SeasonPodiumViewModel } from '../models';
import { useCopy } from '../../i18n';

/**
 * The medal ceremony for second and third.
 *
 * A season that ends one place short used to go straight from the final
 * whistle to a list of awards, which is the same screen a mid-table season
 * gets. This is the moment in between: the division's top three on the steps,
 * ours among them, before the boardroom paperwork starts.
 *
 * Read left to right the blocks are 2 · 1 · 3, which is the Olympic
 * arrangement — the winner in the middle with the runner-up on their own right
 * — and the same one the reference photograph uses.
 *
 * The music is NOT started here. `menuThemeForScreen` gives this screen the
 * boundary's own arcade bed, the same one the awards ceremony and the season
 * review play, so the ceremony music begins as the podium appears and runs
 * through both of the screens that follow without a gap at either seam.
 */

const CUTSCENE_MS = 7_600;
const REDUCED_MOTION_MS = 4_800;
const CONFETTI_COLORS = ['#edb54a', '#d94f52', '#5a8fd6', '#f4f1ea', '#5cb85c', '#f7d894'];
const CONFETTI_COUNT = 28;
/** Tallest to shortest, in the order the steps are read out. */
const BLOCK_HEIGHT: Record<1 | 2 | 3, number> = { 1: 92, 2: 66, 3: 48 };
const MEDAL_COLOR: Record<1 | 2 | 3, string> = {
  1: '#edb54a',
  2: '#c9c5d0',
  3: '#c8862a',
};
/** Viewer's left to right: runner-up, winner, third. */
const BLOCK_ORDER: readonly (1 | 2 | 3)[] = [2, 1, 3];
const SPRITE_SCALE = 2;
/** How far apart the three figures' hops are kept. */
const HOP_STAGGER_MS = 320;

export interface SeasonPodiumScreenProps {
  viewModel: SeasonPodiumViewModel;
  reduceMotion?: boolean;
  onComplete: () => void;
}

export function SeasonPodiumScreen({
  viewModel,
  reduceMotion = false,
  onComplete,
}: SeasonPodiumScreenProps) {
  const t = useCopy();
  const { width, height } = useWindowDimensions();
  const titleProgress = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const riseProgress = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const confettiProgress = useRef(new Animated.Value(0)).current;
  const tableProgress = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const finished = useRef(false);
  const confetti = useMemo(() => makeConfetti(width), [width]);
  const placeByPosition = useMemo(() => new Map(
    viewModel.places.map(place => [place.position, place]),
  ), [viewModel.places]);

  const completeOnce = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    playManagementActionSfx('success');
    const timeout = setTimeout(completeOnce, reduceMotion ? REDUCED_MOTION_MS : CUTSCENE_MS);
    if (reduceMotion) return () => clearTimeout(timeout);

    const rise = Animated.timing(riseProgress, {
      toValue: 1,
      duration: 900,
      easing: Easing.out(Easing.back(1.1)),
      useNativeDriver: true,
    });
    const title = Animated.sequence([
      Animated.delay(520),
      Animated.spring(titleProgress, {
        toValue: 1,
        damping: 9,
        stiffness: 170,
        mass: 0.8,
        useNativeDriver: true,
      }),
    ]);
    const table = Animated.sequence([
      Animated.delay(1_150),
      Animated.timing(tableProgress, {
        toValue: 1,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    const fall = Animated.loop(Animated.timing(confettiProgress, {
      toValue: 1,
      duration: 3_400,
      easing: Easing.linear,
      useNativeDriver: true,
    }));

    const animations = [rise, title, table, fall];
    for (const animation of animations) animation.start();
    return () => {
      clearTimeout(timeout);
      for (const animation of animations) animation.stop();
    };
  }, [completeOnce, confettiProgress, reduceMotion, riseProgress, tableProgress, titleProgress]);

  const titleStyle = reduceMotion ? undefined : {
    opacity: titleProgress,
    transform: [
      { scale: titleProgress.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) },
    ],
  };
  const tableStyle = reduceMotion ? undefined : {
    opacity: tableProgress,
    transform: [
      { translateY: tableProgress.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) },
    ],
  };

  return (
    <SafeAreaView
      className="flex-1 bg-blue-light"
      edges={['top', 'left', 'right', 'bottom']}
      accessibilityLabel={t('seasonPodium.a11y.podium', {
        club: viewModel.clubName,
        position: viewModel.userPosition,
      })}
    >
      <View style={StyleSheet.absoluteFill}>
        <View style={styles.sky} />
        <View style={styles.stand}>
          {Array.from({ length: 96 }, (_, index) => (
            <View
              key={index}
              style={[
                styles.fan,
                {
                  left: `${(index * 41 + index * index * 7) % 100}%`,
                  top: 8 + ((index * 29 + index * index * 11) % 176),
                  backgroundColor: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
                },
              ]}
            />
          ))}
        </View>
        <View style={styles.standRail} />
        <View style={styles.pitch}>
          <View style={styles.pitchStripe} />
          <View style={styles.pitchLine} />
        </View>
      </View>

      {!reduceMotion ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {confetti.map(piece => (
            <Animated.View
              key={piece.id}
              style={[
                styles.confetti,
                {
                  left: piece.left,
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
                        outputRange: [piece.top, piece.top + height + 120],
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
        accessibilityLabel={t('seasonPodium.a11y.skip')}
        onPress={completeOnce}
        style={({ pressed }) => [styles.skipButton, { opacity: pressed ? 0.65 : 1 }]}
      >
        {/* '›' is in Silkscreen; '▸' is not and renders in the fallback face. */}
        <Text className="font-pixel text-xs uppercase text-white">{t('seasonPodium.skip')}</Text>
      </Pressable>

      <View style={styles.content}>
        <Animated.View style={[styles.titleCard, titleStyle]}>
          <Text className="text-center font-pixel text-xs uppercase tracking-[3px] text-ink/70">
            {viewModel.seasonLabel}
          </Text>
          <Text
            className="mt-1 text-center font-pixel text-3xl uppercase text-ink"
            adjustsFontSizeToFit
            numberOfLines={1}
          >
            {viewModel.headline}
          </Text>
          <View className="mt-2 self-center border-2 border-b-4 border-ink bg-gold px-3 py-1">
            <Text className="text-center font-pixel text-sm uppercase text-ink" numberOfLines={1}>
              {viewModel.clubName}
            </Text>
          </View>
        </Animated.View>

        {/* Podium and table are one group at the foot of the screen. Spread
            apart they left a band of empty pitch between the medal moment and
            the thing it is a picture of. */}
        <View style={styles.stage}>
          <View style={styles.podium}>
          {BLOCK_ORDER.map((position, index) => {
            const place = placeByPosition.get(position);
            if (place === undefined) return null;
            return (
              <PodiumStep
                key={position}
                place={place}
                phase={index}
                riseProgress={riseProgress}
                reduceMotion={reduceMotion}
              />
            );
          })}
        </View>

        <Animated.View style={[styles.table, tableStyle]}>
          {viewModel.places.map(place => (
            <View
              key={place.position}
              style={[styles.tableRow, place.isUserClub ? styles.tableRowOurs : null]}
            >
              <View style={styles.tableOrdinal}>
                <Text
                  className="font-pixel text-sm uppercase"
                  style={{ color: MEDAL_COLOR[place.position] }}
                >
                  {t(ORDINAL_KEYS[place.position])}
                </Text>
              </View>
              <Text
                className="flex-1 font-pixel text-sm uppercase text-ink"
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {place.clubName}
              </Text>
            </View>
          ))}
        </Animated.View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const ORDINAL_KEYS: Record<1 | 2 | 3, string> = {
  1: 'seasonPodium.first',
  2: 'seasonPodium.second',
  3: 'seasonPodium.third',
};

function PodiumStep({
  place,
  phase,
  riseProgress,
  reduceMotion,
}: {
  place: SeasonPodiumPlaceViewModel;
  /** Staggers this figure's hop against the other two. */
  phase: number;
  riseProgress: Animated.Value;
  reduceMotion: boolean;
}) {
  const t = useCopy();
  const blockHeight = BLOCK_HEIGHT[place.position];
  const hop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) return undefined;
    // Its own clock, started late, rather than a phase offset read off a shared
    // one: an offset inputRange has to wrap, and a wrapped range is no longer
    // monotonic, which is the one thing `interpolate` cannot take.
    const animation = Animated.sequence([
      Animated.delay(900 + phase * HOP_STAGGER_MS),
      Animated.loop(Animated.sequence([
        Animated.timing(hop, {
          toValue: 1,
          duration: 520,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(hop, {
          toValue: 0,
          duration: 520,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(460),
      ])),
    ]);
    animation.start();
    return () => animation.stop();
  }, [hop, phase, reduceMotion]);

  const riseStyle = reduceMotion ? undefined : {
    opacity: riseProgress.interpolate({
      inputRange: [0, 0.25, 1],
      outputRange: [0, 1, 1],
    }),
    transform: [{
      translateY: riseProgress.interpolate({
        inputRange: [0, 1],
        // Taller blocks travel further, so all three land together.
        outputRange: [blockHeight + 40, 0],
      }),
    }],
  };
  const hopStyle = reduceMotion ? undefined : {
    transform: [{
      translateY: hop.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }),
    }],
  };

  return (
    <Animated.View style={[styles.step, riseStyle]}>
      <Animated.View style={[styles.figure, hopStyle]}>
        <PlayerRunSprite
          playerId={place.playerId}
          role={place.role}
          lookId={place.lookId}
          scale={SPRITE_SCALE}
          accessibilityLabel={t('seasonPodium.a11y.onTheStep', {
            player: place.playerName,
            club: place.clubName,
            position: place.position,
          })}
        />
      </Animated.View>
      {/* The figure stands ON the step: nothing goes between them, or the
          player reads as hovering above their own block. */}
      <View
        style={[
          styles.block,
          {
            height: blockHeight,
            borderTopColor: MEDAL_COLOR[place.position],
          },
          place.isUserClub ? styles.blockOurs : null,
        ]}
      >
        {/* The ordinal alone. A numeral above it said the same thing twice. */}
        <Text className="font-pixel text-2xl uppercase text-ink">
          {t(ORDINAL_KEYS[place.position])}
        </Text>
      </View>
      <Text
        className="mt-1 font-pixel text-[9px] uppercase text-ink"
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
      >
        {place.playerName}
      </Text>
    </Animated.View>
  );
}

interface ConfettiPiece {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
  color: string;
  turns: number;
}

/**
 * Deterministic from the width alone — no `Math.random`, so two mounts of the
 * same screen fall the same way and a snapshot of it is stable.
 */
function makeConfetti(width: number): ConfettiPiece[] {
  return Array.from({ length: CONFETTI_COUNT }, (_unused, index) => ({
    id: `confetti-${index}`,
    left: ((index * 37) % 100) / 100 * Math.max(width - 12, 12),
    top: -40 - ((index * 53) % 260),
    width: 4 + (index % 3) * 2,
    height: 6 + (index % 2) * 4,
    color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
    turns: 1 + (index % 3),
  }));
}

const styles = StyleSheet.create({
  sky: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#a3c8f0',
  },
  // Anchored to the pitch rather than to the top of the window: the crowd
  // belongs directly behind the podium, and a stand placed from the top left a
  // band of empty sky between the supporters and the turf on a tall screen.
  stand: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: '38%',
    height: 200,
    backgroundColor: '#3f6fb5',
    overflow: 'hidden',
  },
  standRail: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: '38%',
    height: 6,
    backgroundColor: '#241f2e',
  },
  fan: {
    position: 'absolute',
    width: 5,
    height: 5,
    opacity: 0.75,
  },
  // The sprite cell carries a few transparent rows under the boots; without
  // this the figures hover a hair above their own step.
  figure: {
    marginBottom: -4,
  },
  pitch: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '38%',
    backgroundColor: '#5cb85c',
  },
  pitchStripe: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '26%',
    height: '26%',
    backgroundColor: '#8fd98f',
    opacity: 0.5,
  },
  pitchLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 3,
    backgroundColor: '#f4f1ea',
    opacity: 0.7,
  },
  confetti: {
    position: 'absolute',
    top: 0,
  },
  skipButton: {
    position: 'absolute',
    right: 16,
    top: 48,
    zIndex: 10,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#f4f1ea',
    backgroundColor: 'rgba(36, 31, 46, 0.75)',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    // Clears the skip control in the top-right rather than sliding under it.
    paddingTop: 84,
    paddingBottom: 16,
  },
  stage: {
    justifyContent: 'flex-end',
    gap: 16,
  },
  titleCard: {
    alignSelf: 'center',
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: '#241f2e',
    backgroundColor: '#f4f1ea',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  podium: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 4,
  },
  step: {
    // Flexed rather than fixed at 104pt: three fixed steps plus their gaps
    // overflow a 320pt phone once the screen's own padding is taken out.
    flex: 1,
    maxWidth: 112,
    alignItems: 'center',
  },
  block: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderTopWidth: 6,
    borderColor: '#241f2e',
    backgroundColor: '#f4f1ea',
  },
  blockOurs: {
    backgroundColor: '#f7d894',
  },
  table: {
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: '#241f2e',
    backgroundColor: '#f4f1ea',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tableRowOurs: {
    backgroundColor: '#f7d894',
  },
  tableOrdinal: {
    width: 40,
  },
});
