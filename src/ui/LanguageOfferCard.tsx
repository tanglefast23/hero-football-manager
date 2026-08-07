import { Modal, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton, PaperPanel } from './components/Scorecard';
import { PixelText } from './components/PixelText';
import { localeMeta, useCopy, type Locale } from '../i18n';

export interface LanguageOfferCardProps {
  /** The language the device asked for, or `null` when there is nothing to offer. */
  readonly offered: Locale | null;
  readonly onKeep: () => void;
  readonly onUseEnglish: () => void;
}

/**
 * The one-time card shown when the game opens itself in the device's language.
 *
 * It exists because a language the player never sees is a language the game
 * does not have. Most people never open settings, so a language button alone
 * ships six translations that nobody finds.
 *
 * Three things it has to do at once, which is why it is a card and not a toast:
 *
 * 1. **Speak in the language it is announcing.** Every string here is a catalog
 *    key, and the whole card renders after the switch. A player who reads
 *    Spanish is told in Spanish; a player who does not is looking at the
 *    English escape hatch two lines down.
 * 2. **Carry the honest caveat.** These translations have not been through a
 *    native reader. Saying so here reaches exactly the players affected, at the
 *    only moment it matters — far better than a "beta" badge on a settings row
 *    that nobody opens.
 * 3. **Offer one tap out.** The English button is deliberately labelled in
 *    English, so it is legible to someone who cannot read the card at all.
 *
 * Shown once ever. `preferences.languageOffered` records that the question was
 * asked, not the answer, so choosing English does not mean being asked again on
 * the next launch.
 */
export function LanguageOfferCard({ offered, onKeep, onUseEnglish }: LanguageOfferCardProps) {
  const t = useCopy();
  if (offered === null) return null;
  const language = localeMeta(offered).endonym;

  // Dismissing keeps the language, it does not revert to English. Android back
  // and a web Escape both land on `onRequestClose`, and they are reflexes rather
  // than answers — the game has ALREADY switched by the time this card is drawn,
  // so keeping is the no-op. Reverting would take a player who cannot read
  // English and, on one stray keypress, put them in English for good.
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onKeep}>
      <SafeAreaView className="flex-1 items-center justify-center bg-ink/70 px-6">
        <View className="w-full max-w-md">
          <PaperPanel
            kicker={t('languageOffer.kicker')}
            title={t('languageOffer.title', { language })}
          >
            <PixelText variant="body" className="text-sm leading-5 text-ink/70">
              {t('languageOffer.body')}
            </PixelText>
            <View className="mt-4 gap-2">
              <ActionButton
                label={t('languageOffer.keep', { language })}
                accessibilityLabel={t('languageOffer.keep', { language })}
                onPress={onKeep}
              />
              {/* Deliberately English, whatever the card is set to: it is the
                  way out for someone who cannot read a word of the rest — which
                  is also why its spoken label is English. */}
              <ActionButton
                label="English"
                accessibilityLabel="Switch to English"
                onPress={onUseEnglish}
                variant="paper"
              />
            </View>
          </PaperPanel>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
