import { useEffect } from 'react';
import { Modal, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton, PaperPanel } from './components/Scorecard';
import { PixelPortrait } from './components/PixelPortrait';
import { playPositiveSfx } from '../render/management-sfx';

export interface PlayerSigningConfirmation {
  playerId: string;
  playerName: string;
  role: 'GK' | 'DEF' | 'MID' | 'FWD';
  lookId?: string;
  source: 'rookie' | 'transfer' | 'academy';
}

export function PlayerSigningOverlay({
  player,
  reduceMotion = false,
  onClose,
}: {
  player: PlayerSigningConfirmation;
  reduceMotion?: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (player.source === 'rookie') playPositiveSfx();
  }, [player.source]);

  const isRookie = player.source === 'rookie';

  return (
    <Modal
      visible
      transparent
      statusBarTranslucent
      animationType={reduceMotion ? 'none' : 'fade'}
      onRequestClose={onClose}
    >
      <SafeAreaView className="flex-1 justify-center bg-ink/60 px-4 py-6" edges={['top', 'left', 'right', 'bottom']}>
        <View accessibilityViewIsModal className="w-full max-w-[560px] self-center">
          <PaperPanel
            kicker={isRookie
              ? 'First contract signed'
              : player.source === 'academy' ? 'Academy contract signed' : 'Transfer complete'}
            title="Welcome to the club!"
            stamp="SIGNED"
          >
            <View className="items-center border-y-2 border-ink bg-gold-light py-4">
              <View className="border-2 border-b-4 border-ink bg-white px-4 pt-3">
                <PixelPortrait playerId={player.playerId} role={player.role} lookId={player.lookId} expression="joy" />
              </View>
              <Text className="mt-3 font-pixel text-xl uppercase text-ink">{player.playerName}</Text>
              <Text className="mt-1 font-mono text-sm font-bold uppercase text-blue-dark">
                {player.role} · {isRookie
                  ? 'Your first hire'
                  : player.source === 'academy' ? 'Academy graduate' : 'First-team signing'}
              </Text>
            </View>
            <Text className="mt-4 text-center text-base leading-5 text-ink/65">
              {isRookie
                ? '“Thanks for the opportunity, boss! I’m going to score so many goals they’ll need a second scoreboard.”'
                : player.source === 'academy'
                ? 'The contract is complete, and the player has joined your squad.'
                : 'The transfer is complete. Your new player is ready for selection.'}
            </Text>
            <View className="mt-4">
              <ActionButton
                label={isRookie ? 'Meet Bert  ▸' : 'Return to club  ▸'}
                accessibilityLabel={isRookie
                  ? 'Close rookie signing celebration and meet Bert'
                  : 'Close player signing confirmation'}
                onPress={onClose}
              />
            </View>
          </PaperPanel>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
