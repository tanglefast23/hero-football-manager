import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  BackHandler,
  Easing,
  Image,
  Platform,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ImageSourcePropType,
  type ImageStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RivalHeroIntroViewModel } from '../application/rival-hero-intro';
import type { CopyParams } from '../i18n';
import { useCopy, usePixelStyles, type LocaleFaces } from '../i18n';
import type { RivalHeroIntroHeroId } from '../game/rival-hero-intro';
import { PlayerRunSprite, PLAYER_SPRITE_CELL } from '../render/PlayerRunSprite';
import { PowerTitleTakeover } from '../render/PowerTitleTakeover';
import { setRivalIntroMusicActive } from '../render/menu-audio';
import { powerCutInPresentation } from '../render/power-cut-in';
import { CharacterSpeechOverlay } from './CharacterSpeechOverlay';
import { rivalHeroSceneComposition } from './rival-hero-intro-layout';
import {
  RIVAL_HERO_POWER_EXIT_MS,
  advanceRivalHeroIntroPhase,
  rivalHeroPowerAutoExitMs,
  type RivalHeroIntroPhase,
} from './rival-hero-intro-sequence';
import { useReducedMotion } from './use-reduced-motion';
import { useScreenReaderEnabled } from './use-screen-reader';

const ABSOLUTE_FILL = {
  position: 'absolute' as const,
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
};

export const RIVAL_HERO_INTRO_BACKDROPS: Readonly<
  Record<RivalHeroIntroHeroId, ImageSourcePropType>
> = Object.freeze({
  'special-f171': require('../../assets/images/rival-hero-intros/barry-allan.png'),
  'special-f178': require('../../assets/images/rival-hero-intros/scott-somers.png'),
  'special-f174': require('../../assets/images/rival-hero-intros/steve-rodgers.png'),
  'special-f176': require('../../assets/images/rival-hero-intros/bruno-bannor.png'),
  'special-f168': require('../../assets/images/rival-hero-intros/bruce-wain.png'),
});

export interface RivalHeroIntroScreenProps {
  viewModel: RivalHeroIntroViewModel;
  reduceMotion?: boolean;
  onComplete: (heroId: RivalHeroIntroHeroId) => void;
}

/**
 * First-meeting division rival scene: power identity first, character second.
 * The career owns whether it is due; this screen owns only the staged reveal.
 */
export function RivalHeroIntroScreen({
  viewModel,
  reduceMotion = false,
  onComplete,
}: RivalHeroIntroScreenProps) {
  const t = useCopy();
  const styles = usePixelStyles(makeStyles);
  const reduce = useReducedMotion(reduceMotion);
  const screenReaderEnabled = useScreenReaderEnabled();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const short = height < 480;
  const sceneComposition = rivalHeroSceneComposition(width, height);
  const backdropSize = Math.min(width, height) * sceneComposition.backdropZoom;
  const backdropLeft =
    width * sceneComposition.backdropAnchorX -
    backdropSize * sceneComposition.backdropAnchorX;
  const backdropTop =
    height * sceneComposition.backdropAnchorY -
    backdropSize * sceneComposition.backdropAnchorY;
  const heroScale = short ? 3 : 4;
  const heroWidth = PLAYER_SPRITE_CELL.width * heroScale;
  const heroHeight = PLAYER_SPRITE_CELL.height * heroScale;
  const heroCentreX = backdropLeft + backdropSize * sceneComposition.heroX;
  const heroGroundY = backdropTop + backdropSize * sceneComposition.heroY;
  const groundOffset = Math.max(0, height - heroGroundY);
  const cardWidth = Math.min(Math.max(280, width - 24), 360);
  const cardHeight = short ? 124 : 176;
  const cardBottom = groundOffset + heroHeight + (short ? 16 : 34);

  const [phase, setPhase] = useState<RivalHeroIntroPhase>('power');
  const phaseRef = useRef<RivalHeroIntroPhase>('power');
  const [appActive, setAppActive] = useState(
    AppState.currentState === 'active',
  );
  const [cardRunKey, setCardRunKey] = useState(0);
  const [speechAdvanceSignal, setSpeechAdvanceSignal] = useState(0);
  const [backdropFailed, setBackdropFailed] = useState(false);
  const completedRef = useRef(false);
  const cardExit = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setRivalIntroMusicActive(true);
    return () => setRivalIntroMusicActive(false);
  }, []);

  const presentation = useMemo(
    () => powerCutInPresentation(viewModel.power, t),
    [t, viewModel.power],
  );
  const powerAccessibilityLabel = t('rivalHeroIntro.a11y.powerCard', {
    title: viewModel.title,
    hero: viewModel.name,
    power: presentation.name,
  } satisfies CopyParams);
  const speechAccessibilityLabel = t('rivalHeroIntro.a11y.speech', {
    title: viewModel.title,
    hero: viewModel.name,
    taunt: viewModel.taunt,
  } satisfies CopyParams);

  const enterSpeech = useCallback(() => {
    phaseRef.current = 'speech';
    setPhase('speech');
  }, []);

  const beginPowerExit = useCallback(() => {
    if (phaseRef.current !== 'power') return;
    phaseRef.current = advanceRivalHeroIntroPhase('power');
    setPhase('power-exit');
    const animation = Animated.timing(cardExit, {
      toValue: 1,
      duration: reduce ? 150 : RIVAL_HERO_POWER_EXIT_MS,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished && phaseRef.current === 'power-exit') enterSpeech();
    });
  }, [cardExit, enterSpeech, reduce]);

  const finishSpeech = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    phaseRef.current = 'done';
    setPhase('done');
    onComplete(viewModel.heroId);
  }, [onComplete, viewModel.heroId]);

  const autoExitMs = rivalHeroPowerAutoExitMs(screenReaderEnabled, appActive);
  useEffect(() => {
    if (phase !== 'power' || autoExitMs === undefined) return undefined;
    const timer = setTimeout(beginPowerExit, autoExitMs);
    return () => clearTimeout(timer);
  }, [autoExitMs, beginPowerExit, cardRunKey, phase]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const active = nextState === 'active';
      setAppActive(active);
      if (!active) {
        if (phaseRef.current === 'power' || phaseRef.current === 'power-exit') {
          cardExit.stopAnimation();
          cardExit.setValue(0);
          phaseRef.current = 'power';
          setPhase('power');
        }
        return;
      }
      if (phaseRef.current === 'power') {
        cardExit.setValue(0);
        setCardRunKey((key) => key + 1);
      }
    });
    return () => subscription.remove();
  }, [cardExit]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (phaseRef.current === 'power') beginPowerExit();
        else if (phaseRef.current === 'speech')
          setSpeechAdvanceSignal((value) => value + 1);
        return true;
      },
    );
    return () => subscription.remove();
  }, [beginPowerExit]);

  useEffect(() => setBackdropFailed(false), [viewModel.heroId]);

  const cardAnimatedStyle = {
    opacity: cardExit.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
    transform: reduce
      ? []
      : [
          {
            scale: cardExit.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 0.92],
            }),
          },
        ],
  };
  const backdropImageStyle = {
    position: 'absolute' as const,
    left: backdropLeft,
    top: backdropTop,
    width: backdropSize,
    height: backdropSize,
    ...(Platform.OS === 'web'
      ? ({ imageRendering: 'pixelated' } as unknown as ImageStyle)
      : {}),
  };

  return (
    <View
      style={styles.root}
      accessibilityViewIsModal
      testID="rival-hero-intro-screen"
    >
      {backdropFailed ? null : (
        <Image
          accessible={false}
          fadeDuration={0}
          onError={() => setBackdropFailed(true)}
          resizeMode="stretch"
          source={RIVAL_HERO_INTRO_BACKDROPS[viewModel.heroId]}
          style={backdropImageStyle}
          testID={`rival-hero-backdrop-${viewModel.heroId}`}
        />
      )}
      <View
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        style={styles.backdropShade}
      />

      <View
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        style={[styles.rivalBanner, { top: insets.top + (short ? 8 : 14) }]}
      >
        <View style={[styles.ribbonWing, styles.ribbonWingLeft]} />
        <View style={[styles.ribbonWing, styles.ribbonWingRight]} />
        <Text
          adjustsFontSizeToFit
          numberOfLines={1}
          style={styles.rivalBannerText}
        >
          {viewModel.title}
        </Text>
      </View>

      <View
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        style={[
          styles.hero,
          {
            bottom: groundOffset,
            height: heroHeight,
            left: heroCentreX,
            marginLeft: -heroWidth / 2,
            width: heroWidth,
          },
        ]}
      >
        <PlayerRunSprite
          playerId={viewModel.heroId}
          lookId={viewModel.lookId}
          role={viewModel.role}
          scale={heroScale}
          walking={false}
        />
      </View>

      {phase === 'power' || phase === 'power-exit' ? (
        <Animated.View
          style={[
            styles.powerCard,
            {
              bottom: cardBottom,
              height: cardHeight,
              left: (width - cardWidth) / 2,
              width: cardWidth,
            },
            cardAnimatedStyle,
          ]}
        >
          <PowerTitleTakeover
            key={`${viewModel.heroId}:${cardRunKey}`}
            accessibilityHint={t('rivalHeroIntro.a11y.continueToTaunt')}
            accessibilityLabel={powerAccessibilityLabel}
            additionalPowerCount={0}
            ending={false}
            focusOnMount
            layout="mobile"
            onAccessibilityEscape={beginPowerExit}
            onDismiss={beginPowerExit}
            playerName={viewModel.name}
            power={viewModel.power}
            reduceMotion={reduce}
            skippable
            teamColor={presentation.color}
            compact={short}
          />
        </Animated.View>
      ) : null}

      {phase === 'speech' ? (
        <CharacterSpeechOverlay
          accessibilityLabel={speechAccessibilityLabel}
          advanceSignal={speechAdvanceSignal}
          bubbleScale={short ? 0.88 : 1}
          characterCentreRatio={0.5}
          characterHeight={heroHeight}
          characterWidth={heroWidth}
          focusOnMount
          groundOffset={groundOffset}
          handleAccessibilityEscape
          heading={viewModel.name}
          hideCharacter
          instant
          lines={[viewModel.taunt]}
          mirrorSprite={false}
          onDone={finishSpeech}
          reduceMotion={reduce}
          typewriter
        />
      ) : null}
    </View>
  );
}

const makeStyles = (faces: LocaleFaces) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: '#000000',
      overflow: 'hidden',
    },
    backdropShade: {
      ...ABSOLUTE_FILL,
      backgroundColor: 'rgba(10,7,18,0.24)',
    },
    rivalBanner: {
      position: 'absolute',
      alignSelf: 'center',
      minWidth: 210,
      maxWidth: '84%',
      zIndex: 8,
      borderWidth: 3,
      borderBottomWidth: 7,
      borderColor: '#edb54a',
      backgroundColor: '#241f2e',
      paddingHorizontal: 22,
      paddingVertical: 8,
    },
    rivalBannerText: {
      color: '#fff4cf',
      fontFamily: faces.display,
      fontSize: 17,
      lineHeight: 21,
      letterSpacing: 1.6,
      textAlign: 'center',
      textTransform: 'uppercase',
    },
    ribbonWing: {
      position: 'absolute',
      bottom: -7,
      width: 22,
      height: 15,
      borderWidth: 3,
      borderColor: '#241f2e',
      backgroundColor: '#c22f2c',
      zIndex: -1,
    },
    ribbonWingLeft: { left: -17 },
    ribbonWingRight: { right: -17 },
    hero: {
      position: 'absolute',
      zIndex: 3,
    },
    powerCard: {
      position: 'absolute',
      zIndex: 6,
    },
  });
