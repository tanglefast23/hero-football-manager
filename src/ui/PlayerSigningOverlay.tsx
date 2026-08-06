import { useEffect } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton, PaperPanel } from './components/Scorecard';
import { PixelPortrait } from './components/PixelPortrait';
import { playPositiveSfx } from '../render/management-sfx';
import { useCopy } from '../i18n';

export interface PlayerSigningConfirmation {
  playerId: string;
  playerName: string;
  role: 'GK' | 'DEF' | 'MID' | 'FWD';
  lookId?: string;
  source: 'rookie' | 'transfer' | 'academy';
}

/**
 * The receipt for a transfer.
 *
 * The rookie and the academy graduates do not come through here: those are
 * players the manager picked one at a time, so they play as a walk-on instead
 * (see PlayerWalkOnWelcome). This card is for the bought players, who arrive by
 * the windowful and where a confirmation is all that is wanted.
 */
export function PlayerSigningOverlay({
  player,
  reduceMotion = false,
  onClose,
}: {
  player: PlayerSigningConfirmation;
  reduceMotion?: boolean;
  onClose: () => void;
}) {
  const t = useCopy();
  // Every signing is a receipt worth celebrating, not just the first one — an
  // arrival opening in silence read as a failed purchase. Keyed on who signed,
  // not on how: back-to-back signings swap the props without unmounting, and
  // the second arrival still gets its own cue.
  useEffect(() => {
    playPositiveSfx();
  }, [player.playerId]);


  return (
    <Modal
      visible
      transparent
      statusBarTranslucent
      animationType={reduceMotion ? 'none' : 'fade'}
      onRequestClose={onClose}
    >
      <SafeAreaView className="flex-1 justify-center bg-ink/60 px-4 py-6" edges={['top', 'left', 'right', 'bottom']}>
        {/* The signing is already done — this is the receipt, so an outside tap
            closes it. Sibling of the panel so taps on its controls never bubble
            into the close target. */}
        <Pressable accessible={false} className="absolute inset-0" onPress={onClose} />
        <View accessibilityViewIsModal className="w-full max-w-[560px] self-center">
          <PaperPanel
            kicker="Transfer complete"
            title="Welcome to the club!"
            stamp="SIGNED"
          >
            <View className="items-center border-y-2 border-ink bg-gold-light py-4">
              <View className="border-2 border-b-4 border-ink bg-white px-4 pt-3">
                <PixelPortrait playerId={player.playerId} role={player.role} lookId={player.lookId} expression="joy" />
              </View>
              <Text
                numberOfLines={2}
                className="mt-3 px-4 text-center font-pixel text-xl uppercase text-ink"
              >
                {player.playerName}
              </Text>
              <Text className="mt-1 font-pixel text-sm uppercase text-blue-dark">
                {t('playerSigning.firstTeamSigning', { role: player.role })}
              </Text>
            </View>
            <Text className="mt-4 text-center text-base leading-5 text-ink/65">
              {t('playerSigning.theTransferIsComplete')}</Text>
            <View className="mt-4">
              <ActionButton
                label="Return to club  ▸"
                accessibilityLabel={t('playerSigning.a11y.closePlayerSigningConfirmation')}
                onPress={onClose}
              />
            </View>
          </PaperPanel>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
