import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  findNodeHandle,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PlayerRunSprite } from '../render/PlayerRunSprite';
import { playPositiveSfx } from '../render/management-sfx';
import { useCopy, usePixelStyles, type LocaleFaces } from '../i18n';
import type { PlayerGiftCelebrationViewModel } from './models';
import { CrossPlatformModal as Modal } from './components/CrossPlatformModal';
import { formatCurrency } from './components/Scorecard';
import { useReducedMotion } from './use-reduced-motion';
import { useScreenReaderEnabled } from './use-screen-reader';

const LAST_BEAT = 3;
const BEAT_MS = 430;

export function PlayerGiftCelebration({
  result,
  reduceMotion = false,
  onDone,
}: {
  result: PlayerGiftCelebrationViewModel;
  reduceMotion?: boolean;
  onDone: () => void;
}) {
  const t = useCopy();
  const styles = usePixelStyles(makeStyles);
  const reduce = useReducedMotion(reduceMotion);
  const screenReader = useScreenReaderEnabled();
  const waitingForScreenReader = screenReader === null;
  const staticMode = reduce || screenReader === true;
  const [beatState, setBeatState] = useState(0);
  const beatRef = useRef(beatState);
  const pressableRef = useRef<View>(null);
  const pop = useRef(new Animated.Value(0)).current;
  const beat = staticMode ? LAST_BEAT : beatState;
  const cost = formatCurrency(t, result.cost);
  const requestStatus =
    result.transferRequestOutcome === undefined
      ? ''
      : result.transferRequestOutcome.status === 'WITHDRAWN'
        ? t('playerGift.transferRequestWithdrawn')
        : t('playerGift.transferRequestStillActive', {
            morale: result.transferRequestOutcome.moraleTarget,
          });
  const resultLabel = t('playerGift.a11y.result', {
    player: result.playerName,
    cost,
    gain: result.moraleGain,
    requestStatus,
  });

  const advance = useCallback(() => {
    if (staticMode) {
      onDone();
      return;
    }
    if (beatRef.current >= LAST_BEAT) {
      onDone();
      return;
    }
    beatRef.current += 1;
    setBeatState(beatRef.current);
  }, [onDone, staticMode]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const target = pressableRef.current;
      if (target === null) return;
      if (Platform.OS === 'web') {
        (target as unknown as { focus?: () => void }).focus?.();
        return;
      }
      const handle = findNodeHandle(target);
      if (handle !== null) AccessibilityInfo.setAccessibilityFocus(handle);
    });
    return () => cancelAnimationFrame(frame);
  }, [result.sequence]);

  useEffect(() => {
    playPositiveSfx();
    void AccessibilityInfo.announceForAccessibility(resultLabel);
  }, [result.sequence, resultLabel]);

  useEffect(() => {
    if (staticMode) {
      beatRef.current = LAST_BEAT;
      setBeatState(LAST_BEAT);
      pop.setValue(1);
      return undefined;
    }
    pop.setValue(0);
    const animation = Animated.spring(pop, {
      toValue: 1,
      speed: 28,
      bounciness: 10,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [pop, result.sequence, staticMode]);

  useEffect(() => {
    if (staticMode || waitingForScreenReader) return undefined;
    const timer = setTimeout(advance, beat === LAST_BEAT ? 700 : BEAT_MS);
    return () => clearTimeout(timer);
  }, [advance, beat, staticMode, waitingForScreenReader]);

  return (
    <Modal
      visible
      transparent
      statusBarTranslucent
      animationType={reduce ? 'none' : 'fade'}
      onRequestClose={onDone}
    >
      <Pressable
        ref={pressableRef}
        accessibilityRole="button"
        accessibilityLabel={resultLabel}
        accessibilityHint={t('playerGift.continue')}
        accessibilityViewIsModal
        onPress={advance}
        style={styles.backdrop}
      >
        <SafeAreaView
          accessibilityViewIsModal
          style={styles.safeArea}
          edges={['top', 'left', 'right', 'bottom']}
        >
          <Text style={styles.title} numberOfLines={2}>
            {t('playerGift.title', { player: result.playerName })}
          </Text>

          <Animated.View
            style={[
              styles.giftGroup,
              {
                opacity: pop,
                transform: [
                  { scale: pop },
                  {
                    translateY: pop.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-18, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <GiftIcon />
            {beat >= 1 ? (
              <Text style={styles.cost}>
                {t('playerGift.costResult', { cost })}
              </Text>
            ) : null}
          </Animated.View>

          {beat >= 2 ? (
            <Animated.View
              style={[
                styles.playerRow,
                {
                  opacity: pop,
                  transform: [
                    {
                      translateX: pop.interpolate({
                        inputRange: [0, 1],
                        outputRange: [42, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <PlayerRunSprite
                playerId={result.playerId}
                role={result.role}
                lookId={result.lookId}
                scale={4}
                walking={beat === 2 && !staticMode}
                accessibilityLabel={result.playerName}
              />
              {beat >= LAST_BEAT ? (
                <View style={styles.moraleCard}>
                  <Text style={styles.morale}>
                    {t('playerGift.moraleResult', {
                      gain: result.moraleGain,
                    })}
                  </Text>
                  {requestStatus === '' ? null : (
                    <Text style={styles.requestStatus}>{requestStatus}</Text>
                  )}
                </View>
              ) : null}
            </Animated.View>
          ) : null}

          <Text style={styles.continue}>{t('playerGift.continue')} ›</Text>
        </SafeAreaView>
      </Pressable>
    </Modal>
  );
}

function GiftIcon() {
  const styles = usePixelStyles(makeStyles);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={styles.bowRow}>
        <View style={[styles.bow, styles.bowLeft]} />
        <View style={[styles.bow, styles.bowRight]} />
      </View>
      <View style={styles.lid}>
        <View style={styles.ribbonVertical} />
      </View>
      <View style={styles.box}>
        <View style={styles.ribbonVertical} />
      </View>
      <View style={[styles.sparkle, styles.sparkleLeft]} />
      <View style={[styles.sparkle, styles.sparkleRight]} />
    </View>
  );
}

const makeStyles = (faces: LocaleFaces) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(36,31,46,0.82)',
    },
    safeArea: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 20,
      gap: 16,
    },
    title: {
      color: '#fffaf0',
      fontFamily: faces.display,
      fontSize: 22,
      lineHeight: 30,
      textAlign: 'center',
      textTransform: 'uppercase',
    },
    giftGroup: { alignItems: 'center', minHeight: 150 },
    bowRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginBottom: -3,
    },
    bow: {
      width: 32,
      height: 24,
      backgroundColor: '#ffd65a',
      borderColor: '#241f2e',
      borderWidth: 4,
    },
    bowLeft: { transform: [{ rotate: '-18deg' }], marginRight: -4 },
    bowRight: { transform: [{ rotate: '18deg' }], marginLeft: -4 },
    lid: {
      width: 116,
      height: 28,
      backgroundColor: '#ee4b49',
      borderColor: '#241f2e',
      borderWidth: 4,
    },
    box: {
      width: 100,
      height: 72,
      alignSelf: 'center',
      backgroundColor: '#d53845',
      borderColor: '#241f2e',
      borderTopWidth: 0,
      borderWidth: 4,
    },
    ribbonVertical: {
      width: 20,
      height: '100%',
      alignSelf: 'center',
      backgroundColor: '#ffd65a',
    },
    sparkle: {
      position: 'absolute',
      width: 10,
      height: 10,
      backgroundColor: '#fff4a8',
    },
    sparkleLeft: { left: -25, top: 42, transform: [{ rotate: '45deg' }] },
    sparkleRight: { right: -28, top: 10, transform: [{ rotate: '45deg' }] },
    cost: {
      marginTop: 8,
      color: '#ff7b70',
      fontFamily: faces.display,
      fontSize: 20,
    },
    playerRow: {
      minHeight: 126,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 14,
    },
    moraleCard: {
      maxWidth: 220,
      borderWidth: 4,
      borderBottomWidth: 7,
      borderColor: '#241f2e',
      backgroundColor: '#d9f4a8',
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    morale: {
      color: '#245332',
      fontFamily: faces.display,
      fontSize: 18,
      lineHeight: 24,
      textAlign: 'center',
    },
    continue: {
      color: '#fffaf0',
      fontFamily: faces.data,
      fontSize: 13,
      textTransform: 'uppercase',
    },
    requestStatus: {
      marginTop: 8,
      color: '#245332',
      fontFamily: faces.data,
      fontSize: 14,
      lineHeight: 19,
      textAlign: 'center',
    },
  });
