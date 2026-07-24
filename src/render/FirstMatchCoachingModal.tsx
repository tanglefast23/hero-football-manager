import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { PixelPortrait } from '../ui/components/PixelPortrait';
import type { PortraitRole } from '../ui/pixel-portrait-model';
import { energyBand } from './match-energy-ui';

export interface FirstMatchCoachingModalPlayer {
  readonly id: string;
  readonly name: string;
  readonly role: PortraitRole;
  readonly lookId?: string;
  /** Current match energy, 0-100. */
  readonly energyPercent: number;
}

export interface FirstMatchCoachingModalProps {
  readonly title: string;
  readonly body: string;
  readonly detail?: string;
  readonly buttonLabel: string;
  readonly player?: FirstMatchCoachingModalPlayer;
  readonly reduceMotion: boolean;
  readonly onContinue: () => void;
}

export function FirstMatchCoachingModal({
  title,
  body,
  detail,
  buttonLabel,
  player,
  reduceMotion,
  onContinue,
}: FirstMatchCoachingModalProps) {
  const [buttonPressed, setButtonPressed] = useState(false);
  return (
    <Modal
      transparent
      animationType={reduceMotion ? 'none' : 'fade'}
      statusBarTranslucent
      onRequestClose={onContinue}
    >
      <View style={styles.backdrop}>
        <View accessibilityViewIsModal style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.rule} />
          {player === undefined ? null : (
            <View style={styles.playerRow}>
              <View style={styles.portraitFrame}>
                <PixelPortrait
                  playerId={player.id}
                  role={player.role}
                  lookId={player.lookId}
                  expression="rest"
                  reduceMotion={reduceMotion}
                />
              </View>
              <View
                style={styles.playerFacts}
                accessible
                accessibilityLabel={`${player.name}. Energy ${player.energyPercent} percent.`}
              >
                <Text style={styles.playerName} numberOfLines={1}>{player.name}</Text>
                <View style={styles.energyRow}>
                  <View style={styles.energyTrack}>
                    <View
                      style={[
                        styles.energyFill,
                        energyBand(player.energyPercent) === 'amber' ? styles.energyFillMedium : null,
                        energyBand(player.energyPercent) === 'red' ? styles.energyFillLow : null,
                        { width: `${Math.max(0, Math.min(100, player.energyPercent))}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.energyValue}>{player.energyPercent}%</Text>
                </View>
              </View>
            </View>
          )}
          <Text style={styles.body}>{body}</Text>
          {detail === undefined ? null : <Text style={styles.detail}>{detail}</Text>}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={buttonLabel}
            onPressIn={() => setButtonPressed(true)}
            onPressOut={() => setButtonPressed(false)}
            style={[styles.button, buttonPressed ? styles.buttonPressed : null]}
            onPress={onContinue}
          >
            <Text style={styles.buttonText}>{buttonLabel}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#16121fcc',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    borderWidth: 3,
    borderBottomWidth: 7,
    borderColor: '#241f2e',
    backgroundColor: '#f4f1ea',
    padding: 20,
  },
  title: {
    color: '#241f2e',
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  rule: {
    height: 3,
    marginVertical: 14,
    backgroundColor: '#c9c5d0',
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  portraitFrame: {
    borderWidth: 2,
    borderColor: '#241f2e',
    backgroundColor: '#bcd5ee',
  },
  playerFacts: { flex: 1 },
  playerName: {
    color: '#241f2e',
    fontSize: 18,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  energyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  energyTrack: {
    flex: 1,
    height: 12,
    borderWidth: 2,
    borderColor: '#241f2e',
    backgroundColor: '#d9d5e0',
  },
  energyFill: {
    height: '100%',
    backgroundColor: '#65b96e',
  },
  energyFillMedium: { backgroundColor: '#edb54a' },
  energyFillLow: { backgroundColor: '#d94f52' },
  energyValue: {
    color: '#241f2e',
    fontSize: 14,
    fontWeight: '900',
  },
  body: {
    color: '#241f2e',
    fontSize: 18,
    lineHeight: 25,
  },
  detail: {
    marginTop: 10,
    color: '#6b6675',
    fontSize: 14,
    lineHeight: 20,
  },
  button: {
    minHeight: 50,
    marginTop: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: '#241f2e',
    backgroundColor: '#5a8fd6',
  },
  buttonPressed: {
    transform: [{ translateY: 2 }],
    borderBottomWidth: 3,
  },
  buttonText: {
    color: '#f4f1ea',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});
