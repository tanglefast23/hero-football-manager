import { ScrollView, Text, View } from 'react-native';
import appConfig from '../../app.json';
import { SUPPORT_EMAIL } from '../release/support';
import { ActionButton, PaperPanel } from './components/Scorecard';
import { useCopy } from '../i18n';

export interface PrivacySupportPanelProps {
  onBack: () => void;
  onEmailSupport: () => void;
  supportError?: string | null;
}

/** Player-visible privacy, support, build, and license information. */
export function PrivacySupportPanel({ onBack, onEmailSupport, supportError }: PrivacySupportPanelProps) {
  const t = useCopy();
  const version = appConfig.expo.version;
  const build = appConfig.expo.ios.buildNumber;

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 4 }}>
      <Text className="font-pixel text-2xl uppercase text-ink">{t('settings.privacy.label')}</Text>
      <Text className="mt-2 text-sm leading-5 text-ink/60">
        {t('privacySupport.versionLine', { version, build })}
      </Text>

      {supportError ? (
        <View
          accessible
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
          className="mt-4 border-2 border-stamp bg-red-light px-3 py-2"
        >
          <Text className="text-sm font-bold leading-5 text-ink">{supportError}</Text>
        </View>
      ) : null}

      <View className="mt-5 gap-5">
        <PaperPanel kicker="Your game stays yours" title="Privacy" stamp="No tracking">
          <Text className="text-base leading-6 text-ink/70">
            {t('privacySupport.heroFootballManagerDoes')}</Text>
          <Text className="mt-3 text-base leading-6 text-ink/70">
            {t('privacySupport.yourPreferencesPlayerAnd')}</Text>
        </PaperPanel>

        <PaperPanel kicker="Need a hand?" title="Support" stamp="Email">
          <Text className="text-base leading-6 text-ink/70">
            {t('privacySupport.tellUsWhatHappened')}</Text>
          <Text selectable className="mt-3 font-mono text-base text-blue-dark">{SUPPORT_EMAIL}</Text>
          <View className="mt-4">
            <ActionButton
              label="Email support"
              accessibilityLabel={t('privacySupport.a11y.emailHeroFootballManagerSupport')}
              onPress={onEmailSupport}
              variant="paper"
            />
          </View>
        </PaperPanel>

        <PaperPanel kicker="Open-source notice" title="Silkscreen" stamp="OFL 1.1">
          <Text className="text-sm leading-5 text-ink/65">
            {t('privacySupport.silkscreenFontCopyrightThe')}</Text>
        </PaperPanel>
      </View>

      <View className="mt-6">
        <ActionButton label="‹  Back to settings" accessibilityLabel={t('privacySupport.a11y.backToSettings')} onPress={onBack} variant="primary" />
      </View>
    </ScrollView>
  );
}
