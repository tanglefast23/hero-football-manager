import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MatchScreen, type PowerMatchQaConfig } from '../render/MatchScreen';
import {
  powerMatchShowcaseAway,
  powerMatchShowcaseHome,
} from '../render/power-match-showcase';
import type { PowerId } from '../sim/types';
import { ActionButton } from './components/Scorecard';

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

  useEffect(() => {
    if (!visible) return;
    setFrozen(false);
    setReplayKey(key => key + 1);
  }, [powerId, visible]);

  const replay = useCallback(() => {
    setFrozen(false);
    setReplayKey(key => key + 1);
  }, []);

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
            seed={42}
            home={home}
            away={away}
            controlledTeam={0}
            reduceMotion={reduceMotion}
            cutInMode="full"
            maximumSpeed={1}
            powerMatchQa={powerMatchQa}
            presentationOnly
            onPowerShowcaseComplete={() => setFrozen(true)}
            onOpenSettings={onClose}
            onDone={ignoreFinishedMatch}
          />

          {frozen ? (
            <View
              accessibilityViewIsModal
              accessibilityLabel={`${playerName}'s ${powerName} match demonstration is complete. ${description}`}
              style={styles.freezeOverlay}
            >
              <View style={styles.resultCard}>
                <Text style={styles.kicker}>POWER SEEN IN A MATCH</Text>
                <Text style={styles.powerName}>{powerName}</Text>
                <Text style={styles.description}>{description}</Text>
                <View style={styles.buttonRow}>
                  <View style={styles.button}>
                    <ActionButton
                      label="REPLAY"
                      accessibilityLabel={`Replay ${powerName} in the match`}
                      variant="paper"
                      pressSfx="click"
                      onPress={replay}
                    />
                  </View>
                  <View style={styles.button}>
                    <ActionButton
                      label="CONT"
                      accessibilityLabel={`${continueLabel}. Continue after the ${powerName} match demonstration`}
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

const styles = StyleSheet.create({
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
    fontFamily: 'Silkscreen_700Bold',
    fontSize: 10,
    letterSpacing: 1.6,
  },
  powerName: {
    marginTop: 4,
    color: '#241f2e',
    fontFamily: 'Silkscreen_700Bold',
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
