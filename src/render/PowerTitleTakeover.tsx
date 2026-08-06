import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import type { PowerId } from '../sim/types';
import { powerCutInPresentation } from './power-cut-in';
import { KIT_PANEL_BORDER_COLOR, KIT_PANEL_TEXT_COLOR } from './team-kit-ui';
import { usePixelStyles, type LocaleFaces } from '../i18n';

const INTRO_OVERSHOOT = 1.06;
const OUTRO_DELAY_MS = 1100;
const OUTRO_ANIMATION_MS = 400;

export interface PowerTitleTakeoverProps {
  power: PowerId;
  playerName: string;
  additionalPowerCount: number;
  teamColor: string;
  ending: boolean;
  layout: 'mobile' | 'desktop';
  compact?: boolean;
  reduceMotion: boolean;
  skippable: boolean;
  accessibilityLabel: string;
  onDismiss: () => void;
}

/**
 * The control-area power announcement. It deliberately replaces chrome rather
 * than covering the pitch: the match stays readable and keeps running at the
 * selected speed while the club-colour panel supplies the spectacle.
 */
export function PowerTitleTakeover({
  power,
  playerName,
  additionalPowerCount,
  teamColor,
  ending,
  layout,
  compact = false,
  reduceMotion,
  skippable,
  accessibilityLabel,
  onDismiss,
}: PowerTitleTakeoverProps) {
  const styles = usePixelStyles(makeStyles);
  const presentation = powerCutInPresentation(power);
  const intro = useSharedValue(1);
  const titleReveal = useSharedValue(1);
  const sheen = useSharedValue(1);
  const outro = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      intro.value = 1;
      titleReveal.value = 1;
      sheen.value = 1;
      return;
    }
    intro.value = 0;
    titleReveal.value = 0;
    sheen.value = 0;
    intro.value = withSequence(
      withTiming(INTRO_OVERSHOOT, { duration: 130, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: 110, easing: Easing.inOut(Easing.quad) }),
    );
    titleReveal.value = withDelay(
      70,
      withTiming(1, { duration: 210, easing: Easing.out(Easing.cubic) }),
    );
    sheen.value = withDelay(
      110,
      withTiming(1, { duration: 420, easing: Easing.out(Easing.quad) }),
    );
  }, [power, playerName, reduceMotion]);

  useEffect(() => {
    if (reduceMotion || !ending) {
      outro.value = 0;
      return;
    }
    // The lifecycle owner removes the panel after 1.5s. Hold the completed
    // card for 1.1s, then spend the final 0.4s on the exit.
    outro.value = withDelay(
      OUTRO_DELAY_MS,
      withTiming(1, { duration: OUTRO_ANIMATION_MS, easing: Easing.in(Easing.cubic) }),
    );
  }, [ending, reduceMotion]);

  const shellStyle = useAnimatedStyle(() => ({
    opacity: (1 - outro.value) * Math.min(1, intro.value),
    transform: [
      { translateY: (1 - Math.min(1, intro.value)) * 22 },
      { translateX: outro.value * (layout === 'mobile' ? 54 : -44) },
      { scale: 0.86 + Math.min(1, intro.value) * 0.14 - outro.value * 0.05 },
    ],
  }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleReveal.value,
    transform: [{ translateX: (1 - titleReveal.value) * 42 }],
  }));
  const sheenStyle = useAnimatedStyle(() => ({
    opacity: sheen.value < 1 ? 0.5 : 0,
    transform: [
      { translateX: -180 + sheen.value * (layout === 'mobile' ? 620 : 500) },
      { rotate: '-12deg' },
    ],
  }));

  const desktop = layout === 'desktop';
  return (
    <Pressable
      accessibilityRole={skippable ? 'button' : 'text'}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={skippable ? 'Tap to dismiss the power title' : undefined}
      disabled={!skippable}
      onPress={onDismiss}
      style={[
        styles.pressable,
        desktop ? styles.pressableDesktop : styles.pressableMobile,
        compact && !desktop ? styles.pressableMobileCompact : null,
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.shell,
          desktop ? styles.shellDesktop : styles.shellMobile,
          compact && !desktop ? styles.shellMobileCompact : null,
          { backgroundColor: teamColor },
          reduceMotion ? null : shellStyle,
        ]}
      >
        <View style={styles.topPixelRail}>
          {Array.from({ length: desktop ? 8 : 12 }, (_, index) => (
            <View
              key={index}
              style={[styles.railPixel, index % 2 === 0 ? styles.railPixelBright : null]}
            />
          ))}
        </View>
        <Animated.View style={[styles.sheen, reduceMotion ? styles.sheenHidden : sheenStyle]} />
        <View style={[styles.corner, styles.cornerTopLeft]} />
        <View style={[styles.corner, styles.cornerTopRight]} />
        <View style={[styles.corner, styles.cornerBottomLeft]} />
        <View style={[styles.corner, styles.cornerBottomRight]} />

        <View style={styles.copy}>
          <View style={styles.statusPill}>
            <Text style={styles.statusText}>{ending ? 'POWER COMPLETE' : 'SUPER POWER'}</Text>
          </View>
          <Text style={[
            styles.glyph,
            desktop ? styles.glyphDesktop : null,
            compact && !desktop ? styles.glyphCompact : null,
          ]}>
            {presentation.glyph}
          </Text>
          <Animated.View style={[styles.titleWrap, reduceMotion ? null : titleStyle]}>
            <Text
              adjustsFontSizeToFit
              minimumFontScale={0.55}
              numberOfLines={2}
              style={[
                styles.title,
                desktop ? styles.titleDesktop : null,
                compact && !desktop ? styles.titleCompact : null,
              ]}
            >
              {presentation.name}
            </Text>
          </Animated.View>
          <Text
            numberOfLines={1}
            style={[styles.playerName, compact && !desktop ? styles.playerNameCompact : null]}
          >
            {playerName}
          </Text>
          {additionalPowerCount > 0 ? (
            <Text style={styles.additional}>
              +{additionalPowerCount} MORE {additionalPowerCount === 1 ? 'HERO' : 'HEROES'} LIVE
            </Text>
          ) : null}
        </View>
      </Animated.View>
    </Pressable>
  );
}


const makeStyles = (faces: LocaleFaces) => StyleSheet.create({
  pressable: { width: '100%', flex: 1 },
  pressableMobile: { minHeight: 150 },
  pressableMobileCompact: { minHeight: 124 },
  pressableDesktop: {},
  shell: {
    flex: 1,
    overflow: 'hidden',
    borderWidth: 3,
    borderBottomWidth: 7,
    borderColor: KIT_PANEL_BORDER_COLOR,
    borderRadius: 4,
  },
  shellMobile: {
    minHeight: 150,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  shellMobileCompact: { minHeight: 124, paddingVertical: 6 },
  shellDesktop: {
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 28,
  },
  copy: { alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  statusPill: {
    borderWidth: 2,
    borderColor: KIT_PANEL_BORDER_COLOR,
    backgroundColor: '#f4f1eadd',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: {
    color: KIT_PANEL_TEXT_COLOR,
    fontFamily: faces.display,
    fontSize: 10,
    letterSpacing: 1.5,
  },
  glyph: {
    color: KIT_PANEL_TEXT_COLOR,
    fontFamily: faces.display,
    fontSize: 34,
    lineHeight: 40,
    marginTop: 4,
  },
  glyphCompact: { fontSize: 27, lineHeight: 31, marginTop: 2 },
  glyphDesktop: { fontSize: 54, lineHeight: 62, marginTop: 18 },
  titleWrap: { width: '100%' },
  title: {
    color: KIT_PANEL_TEXT_COLOR,
    fontFamily: faces.display,
    fontSize: 27,
    lineHeight: 31,
    letterSpacing: 1,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  titleCompact: { fontSize: 21, lineHeight: 24 },
  titleDesktop: { fontSize: 33, lineHeight: 40, letterSpacing: 1.5 },
  playerName: {
    color: KIT_PANEL_TEXT_COLOR,
    fontFamily: faces.display,
    fontSize: 12,
    letterSpacing: 1,
    marginTop: 5,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  playerNameCompact: { fontSize: 10, marginTop: 2 },
  additional: {
    color: KIT_PANEL_TEXT_COLOR,
    fontFamily: faces.data,
    fontSize: 9,
    letterSpacing: 0.8,
    marginTop: 5,
    textAlign: 'center',
  },
  topPixelRail: {
    position: 'absolute',
    left: 8,
    right: 8,
    top: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  railPixel: {
    width: 9,
    height: 5,
    backgroundColor: '#241f2e99',
  },
  railPixelBright: { backgroundColor: '#f4f1eaaa' },
  sheen: {
    position: 'absolute',
    top: -80,
    bottom: -80,
    width: 62,
    backgroundColor: '#ffffff88',
    zIndex: 1,
  },
  sheenHidden: { opacity: 0 },
  corner: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderColor: '#f4f1eadd',
  },
  cornerTopLeft: { left: 7, top: 7, borderLeftWidth: 3, borderTopWidth: 3 },
  cornerTopRight: { right: 7, top: 7, borderRightWidth: 3, borderTopWidth: 3 },
  cornerBottomLeft: { left: 7, bottom: 7, borderLeftWidth: 3, borderBottomWidth: 3 },
  cornerBottomRight: { right: 7, bottom: 7, borderRightWidth: 3, borderBottomWidth: 3 },
});
