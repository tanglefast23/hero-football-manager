import { ScrollView, Text, View } from 'react-native';
import appConfig from '../../app.json';
import { SUPPORT_EMAIL } from '../release/support';
import { ActionButton, PaperPanel } from './components/Scorecard';
import { useCopy } from '../i18n';

// Keep the full OFL text in the native app bundle beside the two derived TTFs.
// Metro only emits assets that have a module owner, so the license panel owns
// the notice it tells the player about.
const silkscreenLicenseAsset = require('../../assets/fonts/OFL.txt') as number;
void silkscreenLicenseAsset;

export interface PrivacySupportPanelProps {
  onBack: () => void;
  onEmailSupport: () => void;
  onOpenPrivacyPolicy: () => void;
  supportError?: string | null;
}

/** Player-visible privacy, support, build, and license information. */
export function PrivacySupportPanel({
  onBack,
  onEmailSupport,
  onOpenPrivacyPolicy,
  supportError,
}: PrivacySupportPanelProps) {
  const t = useCopy();
  const version = appConfig.expo.version;
  const build = appConfig.expo.ios.buildNumber;

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 4 }}
    >
      <Text className="font-pixel text-2xl uppercase text-ink">
        {t('settings.privacy.label')}
      </Text>
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
          <Text className="text-sm font-bold leading-5 text-ink">
            {supportError}
          </Text>
        </View>
      ) : null}

      <View className="mt-5 gap-5">
        <PaperPanel
          kicker={t('privacySupport.privacyKicker')}
          title={t('privacySupport.privacyTitle')}
          stamp={t('privacySupport.privacyStamp')}
        >
          <Text className="text-base leading-6 text-ink/70">
            {t('privacySupport.heroFootballManagerDoes')}
          </Text>
          <Text className="mt-3 text-base leading-6 text-ink/70">
            {t('privacySupport.yourPreferencesPlayerAnd')}
          </Text>
          {/* Apple requires the submitted policy URL to be reachable from
              inside the app, not only from the store listing. */}
          <View className="mt-4">
            <ActionButton
              label={t('privacySupport.readPrivacyPolicy')}
              accessibilityLabel={t('privacySupport.a11y.readPrivacyPolicy')}
              onPress={onOpenPrivacyPolicy}
              variant="paper"
            />
          </View>
        </PaperPanel>

        <PaperPanel
          kicker={t('privacySupport.supportKicker')}
          title={t('privacySupport.supportTitle')}
          stamp={t('privacySupport.supportStamp')}
        >
          <Text className="text-base leading-6 text-ink/70">
            {t('privacySupport.tellUsWhatHappened')}
          </Text>
          <Text selectable className="mt-3 font-mono text-base text-blue-dark">
            {SUPPORT_EMAIL}
          </Text>
          <View className="mt-4">
            <ActionButton
              label={t('privacySupport.emailSupport')}
              accessibilityLabel={t(
                'privacySupport.a11y.emailHeroFootballManagerSupport',
              )}
              onPress={onEmailSupport}
              variant="paper"
            />
          </View>
        </PaperPanel>

        {/* "OFL 1.1" is a licence identifier, not copy — it names the same
            licence in every language, so it stays out of the catalog. The
            typeface name does have a key, because Vietnamese ships the
            HFMSilkscreen derivative and may want to say so. */}
        <PaperPanel
          kicker={t('privacySupport.openSourceKicker')}
          title={t('privacySupport.openSourceTitle')}
          stamp="OFL 1.1"
        >
          <Text className="text-sm leading-5 text-ink/65">
            {t('privacySupport.silkscreenFontCopyrightThe')}
          </Text>
        </PaperPanel>
      </View>

      <View className="mt-6">
        <ActionButton
          label={`‹  ${t('privacySupport.backToSettings')}`}
          accessibilityLabel={t('privacySupport.a11y.backToSettings')}
          onPress={onBack}
          variant="primary"
        />
      </View>
    </ScrollView>
  );
}
