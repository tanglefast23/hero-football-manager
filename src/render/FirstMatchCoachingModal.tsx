import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

export interface FirstMatchCoachingModalProps {
  readonly title: string;
  readonly body: string;
  readonly detail?: string;
  readonly buttonLabel: string;
  readonly reduceMotion: boolean;
  readonly onContinue: () => void;
}

export function FirstMatchCoachingModal({
  title,
  body,
  detail,
  buttonLabel,
  reduceMotion,
  onContinue,
}: FirstMatchCoachingModalProps) {
  return (
    <Modal
      transparent
      animationType={reduceMotion ? 'none' : 'fade'}
      statusBarTranslucent
      onRequestClose={onContinue}
    >
      <View style={styles.backdrop}>
        <View accessibilityViewIsModal style={styles.card}>
          <Text style={styles.eyebrow}>MATCH PAUSED</Text>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.rule} />
          <Text style={styles.body}>{body}</Text>
          {detail === undefined ? null : <Text style={styles.detail}>{detail}</Text>}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={buttonLabel}
            style={({ pressed }) => [
              styles.button,
              pressed ? styles.buttonPressed : null,
            ]}
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
    borderWidth: 3,
    borderBottomWidth: 7,
    borderColor: '#241f2e',
    backgroundColor: '#f4f1ea',
    padding: 20,
  },
  eyebrow: {
    color: '#3f6fb5',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  title: {
    marginTop: 8,
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
