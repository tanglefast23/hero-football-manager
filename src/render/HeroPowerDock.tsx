import { useEffect, useRef, type RefObject } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  View,
  findNodeHandle,
  useWindowDimensions,
} from 'react-native';
import { SfxPressable as Pressable } from '../ui/components/SfxPressable';
import { useCopy, usePixelStyles } from '../i18n';
import type { TutorialAnchorLayout } from '../ui/tutorial-cue-position';
import { useGuideAnchor } from '../ui/use-guide-anchor';
import { TICK_MS } from '../sim/geometry';
import { isShotSavePower } from '../sim/powers';
import { powerCutInPresentation } from './power-cut-in';
import { KIT_PANEL_BORDER_COLOR, KIT_PANEL_TEXT_COLOR } from './team-kit-ui';
import { firstName, lastName } from './pixel-glyphs';
import {
  heroPowerPressable,
  type HeroPowerCell,
  type HeroPowerDockLayout,
  type HeroPowerTarget,
} from './hero-power-dock';

export interface HeroPowerDockProps {
  cells: readonly HeroPowerCell[];
  layout: HeroPowerDockLayout;
  /** Which bottom corner of the pitch — always the one the card is not using. */
  side: 'left' | 'right';
  desktop: boolean;
  reduceMotion: boolean;
  guideTarget?: HeroPowerTarget;
  guideStep?: 'armed' | 'waiting-fire' | 'fire';
  onGuideAnchorChange?: (anchor: TutorialAnchorLayout | null) => void;
  onFire: (slot: number, pressable: boolean) => void;
}

/** How often the streak runs. Long enough to read as a nudge, not a strobe. */
const STREAK_CYCLE_MS = 3000;
/** One lap. The rest of the cycle is still. */
const STREAK_RUN_MS = 720;
/** Bar length as a share of the button edge. */
const STREAK_LENGTH_SHARE = 0.4;
/**
 * Four, not two. FIRE is the only press that costs nothing, and at 44pt a
 * two-pixel bar inside a two-pixel border read as part of the border.
 */
const STREAK_THICKNESS = 4;
/** Half a flash cycle: up in this, down in this. ~1.4s a beat, a pulse not a strobe. */
const FLASH_HALF_MS = 700;
/** Peak white over the power colour. Enough to lift it, not enough to wash it out. */
const FLASH_PEAK_OPACITY = 0.42;

const useStyles = () =>
  usePixelStyles((faces) =>
    StyleSheet.create({
      dock: {
        position: 'absolute',
        zIndex: 4,
        flexDirection: 'row',
        // Extra rows stack UPWARD, away from the touchline, so the first row
        // never moves as the club earns more Hero Licenses mid-career.
        flexWrap: 'wrap-reverse',
        alignItems: 'flex-end',
      },
      dockPhone: { bottom: 8 },
      dockDesktop: { bottom: 12 },
      dockLeft: { left: 8, justifyContent: 'flex-start' },
      dockRight: { right: 8, justifyContent: 'flex-end' },
      /** An empty cell holds its place so live buttons never slide sideways. */
      cell: { alignItems: 'center', justifyContent: 'flex-end' },
      button: {
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: KIT_PANEL_BORDER_COLOR,
        borderRadius: 3,
        // backgroundColor is the power's authored colour, applied inline.
      },
      /** Charged but waiting: visible, faded, and not pressable. */
      buttonArm: { opacity: 0.72, borderStyle: 'dashed' },
      buttonInert: { opacity: 0.45 },
      heroName: { color: KIT_PANEL_TEXT_COLOR },
      label: {
        fontFamily: faces.display,
        color: KIT_PANEL_TEXT_COLOR,
        textAlign: 'center',
      },
      name: {
        fontFamily: faces.display,
        color: '#f4f1ea',
        textAlign: 'center',
        marginTop: 2,
      },
      /** Drains across the foot of an armed button for its twenty ticks. */
      armedTrack: {
        height: 3,
        alignSelf: 'stretch',
        marginTop: 2,
        backgroundColor: 'rgba(0,0,0,0.45)',
      },
      armedFill: { height: 3, backgroundColor: '#f4f1ea' },
      /** The travelling cue. Drawn just inside the border, never over it. */
      streak: { position: 'absolute', backgroundColor: '#ffffff' },
      /** The FIRE beat. Fills the button under the streak and the label. */
      flash: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#ffffff',
      },
    }),
  );

/**
 * A white streak that laps the button's edge counter-clockwise every three
 * seconds, so a live fire button reads as pressable at a glance.
 *
 * Four bars rather than one travelling bar: a single element would have to
 * change orientation at each corner, and width/height are not animatable on the
 * native driver. Each bar owns one edge, slides along it for a quarter of the
 * lap, and is invisible the rest of the time — which is one interpolation per
 * edge and no layout work at all.
 *
 * Counter-clockwise in screen coordinates, where y grows downward: top edge
 * right-to-left, then down the left edge, then bottom edge left-to-right, then
 * up the right edge.
 *
 * On web the "native" driver runs on the JS thread. Accepted here where the
 * charge meter refused it: that strip animated continuously for as long as a
 * ready hero carried the ball, while this runs 720ms in every 3000 and only
 * while a fire button is actually up. `reduceMotion` stops it entirely.
 */
function PressableStreak({
  size,
  style,
}: {
  size: number;
  style: { position: 'absolute'; backgroundColor: string };
}) {
  const lap = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(lap, {
          toValue: 1,
          duration: STREAK_RUN_MS,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.delay(STREAK_CYCLE_MS - STREAK_RUN_MS),
        Animated.timing(lap, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [lap]);

  const length = Math.round(size * STREAK_LENGTH_SHARE);
  const travel = size - length;
  // Each leg owns a quarter of the lap and is clamped outside it, so a bar
  // parks at its corner instead of sliding on through the next edge.
  const leg = (index: number, from: number, to: number) => ({
    opacity: lap.interpolate({
      inputRange: [
        index / 4,
        index / 4 + 0.001,
        (index + 1) / 4 - 0.001,
        (index + 1) / 4,
      ],
      outputRange: [0, 1, 1, 0],
      extrapolate: 'clamp',
    }),
    offset: lap.interpolate({
      inputRange: [index / 4, (index + 1) / 4],
      outputRange: [from, to],
      extrapolate: 'clamp',
    }),
  });

  const top = leg(0, travel, 0);
  const left = leg(1, 0, travel);
  const bottom = leg(2, 0, travel);
  const right = leg(3, travel, 0);

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[
          style,
          {
            top: 0,
            left: 0,
            width: length,
            height: STREAK_THICKNESS,
            opacity: top.opacity,
            transform: [{ translateX: top.offset }],
          },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          style,
          {
            top: 0,
            left: 0,
            width: STREAK_THICKNESS,
            height: length,
            opacity: left.opacity,
            transform: [{ translateY: left.offset }],
          },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          style,
          {
            bottom: 0,
            left: 0,
            width: length,
            height: STREAK_THICKNESS,
            opacity: bottom.opacity,
            transform: [{ translateX: bottom.offset }],
          },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          style,
          {
            top: 0,
            right: 0,
            width: STREAK_THICKNESS,
            height: length,
            opacity: right.opacity,
            transform: [{ translateY: right.offset }],
          },
        ]}
      />
    </>
  );
}

/**
 * The FIRE beat: a white wash over the power colour, in and out every ~1.4s.
 *
 * Only while the authored moment is actually live. FIRE is the one press that
 * costs nothing, so it gets a cue that carries across the pitch; ARM is a
 * gamble and stays quiet, dashed and dimmed. The moment passing flips the cell
 * back to ARM on the next tick, which unmounts this and the streak with it.
 *
 * Same native-driver bargain as PressableStreak — on web that is the JS thread,
 * and it is accepted for the same reason: it runs only while a FIRE button is
 * up, which is a few seconds a match. `reduceMotion` stops it entirely.
 */
function FireFlash({
  style,
}: {
  style: { position: 'absolute'; backgroundColor: string };
}) {
  const beat = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(beat, {
          toValue: 1,
          duration: FLASH_HALF_MS,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(beat, {
          toValue: 0,
          duration: FLASH_HALF_MS,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [beat]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        style,
        {
          opacity: beat.interpolate({
            inputRange: [0, 1],
            outputRange: [0, FLASH_PEAK_OPACITY],
          }),
        },
      ]}
    />
  );
}

/**
 * The manager's fire buttons, pinned to a bottom corner of the pitch opposite
 * the possession card.
 *
 * One button per hero holding a banked Zone, in the power's own authored
 * colour. It exists only in MANUAL: every slot is FIRE_WHEN_READY otherwise,
 * Goalkeepers appear here too, but their rules key on the POWER. A save keeper
 * reads ARMED before danger and FIRE! when an enemy attack reaches the third.
 *
 * Its own component rather than more JSX inside MatchScreen: the screen's
 * hot-path guard forbids a bare `style={{` anywhere after the Skia canvas, and
 * its button-contract test counts `<Pressable` openings at a fixed indent.
 * Both stay meaningful with the dock's markup out here.
 */
export function HeroPowerDock({
  cells,
  layout,
  side,
  desktop,
  reduceMotion,
  guideTarget,
  guideStep,
  onGuideAnchorChange,
  onFire,
}: HeroPowerDockProps) {
  const styles = useStyles();
  const t = useCopy();
  const { width: viewportWidth, height: viewportHeight } =
    useWindowDimensions();
  const { anchorRef, scheduleMeasurement } = useGuideAnchor(
    guideTarget !== undefined,
    onGuideAnchorChange,
  );
  const guideVisible = cells.some(
    (cell) =>
      cell.state !== null &&
      cell.slot === guideTarget?.slot &&
      cell.playerId === guideTarget.playerId &&
      cell.power === guideTarget.power,
  );
  useEffect(() => {
    if (guideTarget !== undefined && !guideVisible) onGuideAnchorChange?.(null);
  }, [guideTarget, guideVisible, onGuideAnchorChange]);
  useEffect(() => {
    if (guideVisible) scheduleMeasurement();
  }, [
    desktop,
    guideVisible,
    layout.gap,
    layout.perRow,
    layout.rows,
    layout.size,
    scheduleMeasurement,
    side,
    viewportHeight,
    viewportWidth,
  ]);
  // Nothing banked: no dock at all, rather than a row of empty cells over the
  // grass for the whole first half.
  if (cells.length === 0 || cells.every((cell) => cell.state === null)) {
    return null;
  }
  const rowWidth =
    layout.size * layout.perRow + layout.gap * Math.max(0, layout.perRow - 1);
  return (
    <View
      style={[
        styles.dock,
        desktop ? styles.dockDesktop : styles.dockPhone,
        side === 'left' ? styles.dockLeft : styles.dockRight,
        { width: rowWidth, gap: layout.gap },
      ]}
    >
      {cells.map((cell) => (
        <View key={cell.slot} style={[styles.cell, { width: layout.size }]}>
          {cell.state === null ? null : (
            <HeroPowerButton
              cell={cell}
              layout={layout}
              desktop={desktop}
              reduceMotion={reduceMotion}
              styles={styles}
              t={t}
              tutorialTarget={
                guideTarget?.slot === cell.slot &&
                guideTarget.playerId === cell.playerId &&
                guideTarget.power === cell.power
              }
              guideStep={guideStep}
              guideRef={
                guideTarget?.slot === cell.slot &&
                guideTarget.playerId === cell.playerId &&
                guideTarget.power === cell.power
                  ? anchorRef
                  : undefined
              }
              onGuideLayout={scheduleMeasurement}
              onFire={onFire}
            />
          )}
        </View>
      ))}
    </View>
  );
}

function HeroPowerButton({
  cell,
  layout,
  desktop,
  reduceMotion,
  styles,
  t,
  tutorialTarget,
  guideStep,
  guideRef,
  onGuideLayout,
  onFire,
}: {
  cell: HeroPowerCell;
  layout: HeroPowerDockLayout;
  desktop: boolean;
  reduceMotion: boolean;
  styles: ReturnType<typeof useStyles>;
  t: ReturnType<typeof useCopy>;
  tutorialTarget: boolean;
  guideStep?: 'armed' | 'waiting-fire' | 'fire';
  guideRef?: RefObject<View | null>;
  onGuideLayout: () => void;
  onFire: (slot: number, pressable: boolean) => void;
}) {
  const presentation = powerCutInPresentation(cell.power, t);
  const pressable = heroPowerPressable(cell.state);
  const armed = cell.state === 'armed';
  const savePower = isShotSavePower(cell.power);
  const tutorialPaused = guideStep === 'armed' || guideStep === 'fire';
  const available =
    pressable && (!tutorialPaused || (tutorialTarget && guideStep === 'fire'));
  const hiddenFromTutorial = tutorialPaused && !tutorialTarget;
  const seconds = Math.ceil((cell.armedTicksRemaining * TICK_MS) / 1000);
  const a11yKey =
    cell.state === 'fire'
      ? savePower
        ? 'matchScreen.a11y.heroPowerKeeperFire'
        : 'matchScreen.a11y.heroPowerFire'
      : armed
        ? 'matchScreen.a11y.heroPowerArmed'
        : cell.state === 'down'
          ? 'matchScreen.a11y.heroPowerDown'
          : savePower
            ? 'matchScreen.a11y.heroPowerKeeperArm'
            : 'matchScreen.a11y.heroPowerArm';
  const a11yLabel = t(a11yKey, {
    player: cell.name,
    power: presentation.name,
    seconds,
  });
  const tutorialFireHint =
    tutorialTarget && guideStep === 'fire'
      ? t('matchScreen.a11y.heroPowerTutorialFireHint')
      : undefined;
  useEffect(() => {
    if (!tutorialTarget || guideStep !== 'fire') return undefined;
    const frame = requestAnimationFrame(() => {
      const target = guideRef?.current;
      if (target === null || target === undefined) return;
      if (Platform.OS === 'web') {
        (target as unknown as { focus?: (options?: object) => void }).focus?.({
          preventScroll: true,
        });
        return;
      }
      const handle = findNodeHandle(target);
      if (handle !== null) AccessibilityInfo.setAccessibilityFocus(handle);
    });
    return () => cancelAnimationFrame(frame);
  }, [guideRef, guideStep, tutorialTarget]);
  return (
    <>
      <Pressable
        ref={guideRef}
        collapsable={false}
        onLayout={tutorialTarget ? onGuideLayout : undefined}
        accessibilityRole="button"
        accessibilityLabel={
          Platform.OS === 'web' && tutorialFireHint !== undefined
            ? `${a11yLabel} ${tutorialFireHint}`
            : a11yLabel
        }
        accessibilityHint={Platform.OS === 'web' ? undefined : tutorialFireHint}
        accessibilityElementsHidden={hiddenFromTutorial}
        importantForAccessibility={
          hiddenFromTutorial ? 'no-hide-descendants' : 'auto'
        }
        focusable={!hiddenFromTutorial}
        tabIndex={hiddenFromTutorial ? -1 : undefined}
        accessibilityState={{ disabled: !available }}
        disabled={!available}
        immediatePress
        pressSfx="match-control"
        onPress={() => onFire(cell.slot, available)}
        style={({ pressed }) => [
          styles.button,
          {
            width: layout.size,
            height: layout.size,
            backgroundColor: presentation.color,
          },
          cell.state === 'arm' ? styles.buttonArm : null,
          armed || cell.state === 'down' ? styles.buttonInert : null,
          pressed ? { opacity: 0.7 } : null,
        ]}
      >
        <Text
          maxFontSizeMultiplier={1.3}
          numberOfLines={1}
          style={[
            styles.heroName,
            { fontSize: Math.round(layout.size * 0.22) },
          ]}
        >
          {firstName(cell.name)}
        </Text>
        {/* Both cues belong to FIRE alone. ARM accepts a press too, but it is
          a gamble that can cost a Zone — flashing it would read as "press me
          now" and sell the wrong press. An armed or downed button never
          animates either: pressing those does nothing at all. */}
        {cell.state === 'fire' && !reduceMotion ? (
          <>
            <FireFlash style={styles.flash} />
            <PressableStreak size={layout.size} style={styles.streak} />
          </>
        ) : null}
        {armed ? (
          <View style={styles.armedTrack}>
            <View
              style={[
                styles.armedFill,
                {
                  width: `${Math.max(
                    0,
                    Math.min(
                      100,
                      (cell.armedTicksRemaining / cell.armWindowTicks) * 100,
                    ),
                  )}%`,
                },
              ]}
            />
          </View>
        ) : (
          <Text
            maxFontSizeMultiplier={1.3}
            numberOfLines={1}
            style={[styles.label, { fontSize: Math.round(layout.size * 0.17) }]}
          >
            {t(
              cell.state === 'fire'
                ? 'matchScreen.heroPowerFire'
                : 'matchScreen.heroPowerArm',
            )}
          </Text>
        )}
      </Pressable>
      <Text
        maxFontSizeMultiplier={1.3}
        numberOfLines={1}
        style={[styles.name, { fontSize: desktop ? 9 : 8 }]}
      >
        {lastName(cell.name)}
      </Text>
    </>
  );
}
