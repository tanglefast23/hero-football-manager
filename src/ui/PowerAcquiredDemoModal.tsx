import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MatchScreen, type PowerMatchQaConfig } from '../render/MatchScreen';
import {
  powerMatchShowcaseAway,
  powerMatchShowcaseHome,
  powerMatchShowcaseSeed,
} from '../render/power-match-showcase';
import type { PowerId } from '../sim/types';
import { ActionButton } from './components/Scorecard';
import { useCopy, usePixelStyles, type LocaleFaces } from '../i18n';

export interface PowerAcquiredDemoModalProps {
  visible: boolean;
  playerName: string;
  powerId: PowerId;
  powerName: string;
  description: string;
  continueLabel: string;
  reduceMotion?: boolean;
  onClose: () => void;
  onContinue: () => void;
}

const ignoreFinishedMatch = () => undefined;

/**
 * The final awakening beat shown as a real, deterministic 11v11 match clip.
 * It starts 1.5 seconds before the automatic activation, plays the production
 * match effect, then freezes one second after that power has ended.
 */
export function PowerAcquiredDemoModal({
  visible,
  playerName,
  powerId,
  powerName,
  description,
  continueLabel,
  reduceMotion = false,
  onClose,
  onContinue,
}: PowerAcquiredDemoModalProps) {
  const t = useCopy();
  const styles = usePixelStyles(makeStyles);
  const [replayKey, setReplayKey] = useState(0);
  const [frozen, setFrozen] = useState(false);
  const home = useMemo(
    () => powerMatchShowcaseHome(powerId, playerName),
    [playerName, powerId],
  );
  const away = useMemo(() => powerMatchShowcaseAway(), []);
  const powerMatchQa = useMemo<PowerMatchQaConfig>(
    () => ({ power: powerId }),
    [powerId],
  );

  /**
   * Opening only clears the freeze. It must NOT bump `replayKey`: the Modal
   * mounts its children the moment `visible` turns true, so a bump here mounted
   * MatchScreen, tore it straight back down, and mounted it again — building,
   * releasing and rebuilding ~40 native audio players inside one frame. iOS
   * answered that churn by killing the audio session ("Session lookup failed",
   * then "Server was dead when activation request was made"), which surfaced as
   * a warning toast over the demo. The key already carries `powerId`, and
   * REPLAY bumps the counter itself, so nothing here needs to.
   */
  useEffect(() => {
    if (!visible) return;
    setFrozen(false);
  }, [powerId, visible]);

  const replay = useCallback(() => {
    setFrozen(false);
    setReplayKey((key) => key + 1);
  }, []);

  /**
   * Stable on purpose. MatchScreen hangs its clip timers — including the
   * backstop that guarantees this card ever appears — off this callback's
   * identity, so a fresh arrow per render would restart the countdown every
   * time the awakening behind the modal re-rendered.
   */
  const showResult = useCallback(() => setFrozen(true), []);

  return (
    <Modal
      visible={visible}
      statusBarTranslucent
      animationType={reduceMotion ? 'none' : 'fade'}
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={styles.root}
        edges={['top', 'left', 'right', 'bottom']}
      >
        <View style={styles.match}>
          <MatchScreen
            key={`${powerId}:${replayKey}`}
            seed={powerMatchShowcaseSeed(powerId)}
            home={home}
            away={away}
            controlledTeam={0}
            reduceMotion={reduceMotion}
            cutInMode="full"
            maximumSpeed={1}
            audioProfile="showcase"
            powerMatchQa={powerMatchQa}
            presentationOnly
            onPowerShowcaseComplete={showResult}
            onOpenSettings={onClose}
            onDone={ignoreFinishedMatch}
          />

          {frozen ? (
            <View
              accessibilityViewIsModal
              accessibilityLabel={t(
                'powerAcquiredDemo.a11y.demonstrationComplete',
                {
                  player: playerName,
                  power: powerName,
                  description,
                },
              )}
              style={styles.freezeOverlay}
            >
              <View style={styles.resultCard}>
                <Text style={styles.kicker}>
                  {t('powerAcquiredDemo.powerSeenInAMatch')}
                </Text>
                <Text style={styles.powerName}>{powerName}</Text>
                <Text style={styles.description}>{description}</Text>
                <View style={styles.buttonRow}>
                  <View style={styles.button}>
                    <ActionButton
                      label={t('powerAcquiredDemo.replay')}
                      accessibilityLabel={t('powerAcquiredDemo.a11y.replay', {
                        power: powerName,
                      })}
                      variant="paper"
                      pressSfx="click"
                      onPress={replay}
                    />
                  </View>
                  <View style={styles.button}>
                    <ActionButton
                      label={t('powerAcquiredDemo.continue')}
                      accessibilityLabel={t('powerAcquiredDemo.a11y.continue', {
                        label: continueLabel,
                        power: powerName,
                      })}
                      onPress={onContinue}
                    />
                  </View>
                </View>
              </View>
            </View>
          ) : (
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              pointerEvents="auto"
              style={styles.inputShield}
            />
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const makeStyles = (faces: LocaleFaces) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: '#16121f',
    },
    match: {
      flex: 1,
    },
    inputShield: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: 'transparent',
    },
    freezeOverlay: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      // MatchScreen's possession card is deliberately raised above the pitch.
      // Raise the completed demo above the whole match HUD so that card can never
      // cover the power name or explanation.
      zIndex: 10,
      elevation: 10,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(22, 18, 31, 0.18)',
      padding: 14,
    },
    resultCard: {
      width: '100%',
      maxWidth: 600,
      alignSelf: 'center',
      borderWidth: 3,
      borderBottomWidth: 7,
      borderColor: '#241f2e',
      backgroundColor: '#f4f1ea',
      padding: 14,
    },
    kicker: {
      color: '#c8862a',
      fontFamily: faces.display,
      fontSize: 10,
      letterSpacing: 1.6,
    },
    powerName: {
      marginTop: 4,
      color: '#241f2e',
      fontFamily: faces.display,
      fontSize: 22,
      lineHeight: 28,
      textTransform: 'uppercase',
    },
    description: {
      marginTop: 6,
      color: '#3a3350',
      fontSize: 14,
      lineHeight: 19,
    },
    buttonRow: {
      marginTop: 12,
      flexDirection: 'row',
      gap: 10,
    },
    button: {
      flex: 1,
    },
  });
