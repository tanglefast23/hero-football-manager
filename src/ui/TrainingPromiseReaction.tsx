import { Modal, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton, PaperPanel } from './components/Scorecard';
import { PixelPortrait } from './components/PixelPortrait';

export interface TrainingPromiseReactionPlayer {
  playerId: string;
  playerName: string;
  role: 'GK' | 'DEF' | 'MID' | 'FWD';
  lookId?: string;
}

const BUMPED_LINES = [
  'Benched already? I was just warming up 😤',
  "Rude. I'll remember this. 😒",
  'Cold, boss. Ice cold. 🥶',
];

const PROMISED_LINES = [
  "Cheers boss — won't waste it 🙏",
  "Finally! Let's go 🔥",
  "You won't regret this 💪",
];

/** Picks a stable line per player id so the same player always gets the same reaction. */
function pickLine(playerId: string, lines: readonly string[]): string {
  const sum = [...playerId].reduce((total, char) => total + char.charCodeAt(0), 0);
  return lines[sum % lines.length];
}

export function TrainingPromiseReaction({
  bumped,
  promised,
  reduceMotion = false,
  onDismiss,
}: {
  bumped: TrainingPromiseReactionPlayer;
  promised: TrainingPromiseReactionPlayer;
  reduceMotion?: boolean;
  onDismiss: () => void;
}) {
  return (
    <Modal
      visible
      transparent
      statusBarTranslucent
      animationType={reduceMotion ? 'none' : 'fade'}
      onRequestClose={onDismiss}
    >
      <SafeAreaView className="flex-1 justify-center bg-ink/60 px-4 py-6" edges={['top', 'left', 'right', 'bottom']}>
        <View accessibilityViewIsModal className="w-full max-w-[560px] self-center">
          <PaperPanel kicker="Promise kept" title="Training swap" stamp="SWAP">
            <View className="flex-row gap-3">
              <View className="flex-1 items-center border-2 border-b-4 border-ink bg-grey-light px-2 py-4">
                <View className="border-2 border-b-4 border-ink bg-white px-3 pt-2">
                  <PixelPortrait
                    playerId={bumped.playerId}
                    role={bumped.role}
                    lookId={bumped.lookId}
                    expression="rest"
                    reduceMotion={reduceMotion}
                  />
                </View>
                <Text className="mt-2 font-pixel text-sm uppercase text-ink" numberOfLines={1}>
                  {bumped.playerName}
                </Text>
                <Text className="mt-2 text-center text-sm leading-5 text-ink/70">
                  “{pickLine(bumped.playerId, BUMPED_LINES)}”
                </Text>
              </View>
              <View className="flex-1 items-center border-2 border-b-4 border-ink bg-gold-light px-2 py-4">
                <View className="border-2 border-b-4 border-ink bg-white px-3 pt-2">
                  <PixelPortrait
                    playerId={promised.playerId}
                    role={promised.role}
                    lookId={promised.lookId}
                    expression="joy"
                    reduceMotion={reduceMotion}
                  />
                </View>
                <Text className="mt-2 font-pixel text-sm uppercase text-ink" numberOfLines={1}>
                  {promised.playerName}
                </Text>
                <Text className="mt-2 text-center text-sm leading-5 text-ink/70">
                  “{pickLine(promised.playerId, PROMISED_LINES)}”
                </Text>
              </View>
            </View>
            <Text className="mt-4 text-center text-base leading-5 text-ink/65">
              {promised.playerName} takes the freed training slot, focused on their biggest-room stat.
              Change it any time on the training screen.
            </Text>
            <View className="mt-4">
              <ActionButton
                label="Got it"
                accessibilityLabel="Dismiss training promise reaction"
                onPress={onDismiss}
              />
            </View>
          </PaperPanel>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
