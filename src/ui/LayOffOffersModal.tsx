import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CrossPlatformModal as Modal } from './components/CrossPlatformModal';
import { SfxPressable as Pressable } from './components/SfxPressable';
import { ActionButton, formatCurrency } from './components/Scorecard';
import { PixelText } from './components/PixelText';
import { useLayoutMode } from './layout/use-layout-mode';
import { useCopy } from '../i18n';

export interface LayOffOffer {
  /** The saved bid id the sale is accepted against. */
  readonly id: string;
  readonly clubName: string;
  readonly fee: number;
}

export interface LayOffOffersModalProps {
  playerName: string;
  offers: readonly LayOffOffer[];
  onAccept: (bidId: string) => void;
  onCancel: () => void;
  reduceMotion?: boolean;
}

/**
 * The clubs that would take this player off the wage bill, opened straight from
 * the player file. Bids come from the same transfer listing the Market screen
 * uses, so there is one sale path, not two.
 */
export function LayOffOffersModal({
  playerName,
  offers,
  onAccept,
  onCancel,
  reduceMotion = false,
}: LayOffOffersModalProps) {
  const t = useCopy();
  const wide = useLayoutMode() === 'twoColumn';

  return (
    <Modal
      visible
      transparent
      animationType={reduceMotion ? 'none' : 'fade'}
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <SafeAreaView
        className="flex-1"
        edges={['top', 'left', 'right', 'bottom']}
      >
        <View
          accessibilityViewIsModal
          className={
            wide
              ? 'flex-1 items-center justify-center px-3 py-6'
              : 'flex-1 justify-end px-3 pb-3'
          }
        >
          <Pressable
            accessible={false}
            style={StyleSheet.absoluteFill}
            onPress={onCancel}
          >
            <View
              className="flex-1"
              style={{ backgroundColor: 'rgba(36,31,46,0.62)' }}
            />
          </Pressable>

          <View
            className="w-full max-w-[520px] overflow-hidden border-2 border-b-4 border-ink bg-paper"
            style={{ maxHeight: '92%' }}
          >
            <View className="flex-row items-center justify-between border-b-2 border-ink bg-red-light px-4 py-3">
              <View className="flex-1 pr-3">
                <PixelText className="text-sm uppercase text-red-dark">
                  {t('layOff.kicker')}
                </PixelText>
                <Text className="mt-1 font-pixel text-xl uppercase text-ink">
                  {t('layOff.title', { player: playerName })}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('layOff.cancel')}
                onPress={onCancel}
                className="h-11 w-11 items-center justify-center border-2 border-ink bg-white"
                style={{ minWidth: 44, minHeight: 44 }}
              >
                <Text className="font-pixel text-lg text-ink">×</Text>
              </Pressable>
            </View>

            <View className="border-b border-ink/20 bg-white px-4 py-2">
              <Text className="text-xs leading-4 text-ink/60">
                {t('layOff.hint')}
              </Text>
            </View>

            <ScrollView
              className="min-h-0"
              contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
            >
              {offers.length === 0 ? (
                <View className="items-center border-2 border-dashed border-ink/25 bg-white/50 px-3 py-6">
                  <Text className="text-center text-sm leading-5 text-ink/60">
                    {t('layOff.empty')}
                  </Text>
                </View>
              ) : (
                offers.map((offer, index) => (
                  <View
                    key={offer.id}
                    className="mb-2 flex-row items-center gap-3 border-2 border-ink bg-white px-3 py-2"
                  >
                    <View className="flex-1">
                      <Text className="font-bold text-ink" numberOfLines={1}>
                        {index + 1}. {offer.clubName}
                      </Text>
                      <Text className="mt-1 font-mono text-sm text-pitch-ink">
                        {t('market.feeAmount', {
                          fee: formatCurrency(t, offer.fee),
                        })}
                      </Text>
                    </View>
                    <ActionButton
                      label={t('layOff.accept')}
                      accessibilityLabel={t('layOff.a11y.accept', {
                        club: offer.clubName,
                        fee: formatCurrency(t, offer.fee),
                        player: playerName,
                      })}
                      variant="danger"
                      compact
                      onPress={() => onAccept(offer.id)}
                    />
                  </View>
                ))
              )}
            </ScrollView>

            <View className="border-t-2 border-ink bg-paper-dark px-4 py-3">
              <ActionButton
                label={t('layOff.cancel')}
                accessibilityLabel={t('layOff.cancel')}
                variant="paper"
                onPress={onCancel}
              />
            </View>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
