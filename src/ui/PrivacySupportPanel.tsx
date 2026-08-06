import { ScrollView, Text, View } from 'react-native';
import appConfig from '../../app.json';
import { SUPPORT_EMAIL } from '../release/support';
import { ActionButton, PaperPanel } from './components/Scorecard';

export interface PrivacySupportPanelProps {
  onBack: () => void;
  onEmailSupport: () => void;
  supportError?: string | null;
}

/** Player-visible privacy, support, build, and license information. */
export function PrivacySupportPanel({ onBack, onEmailSupport, supportError }: PrivacySupportPanelProps) {
  const version = appConfig.expo.version;
  const build = appConfig.expo.ios.buildNumber;

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 4 }}>
      <Text className="font-pixel text-2xl uppercase text-ink">Privacy &amp; Support</Text>
      <Text className="mt-2 text-sm leading-5 text-ink/60">
        Hero Football Manager · Version {version} ({build})
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
            Hero Football Manager does not require an account and does not use ads, analytics, or tracking. The game does not send your gameplay or personal information to the developer.
          </Text>
          <Text className="mt-3 text-base leading-6 text-ink/70">
            Your preferences, player and club names, and career save stay on this device. A save file leaves the app only when you deliberately choose Export Save and select where to share it. You can delete the career in the game, and deleting the app removes its local data from the device.
          </Text>
        </PaperPanel>

        <PaperPanel kicker="Need a hand?" title="Support" stamp="Email">
          <Text className="text-base leading-6 text-ink/70">
            Tell us what happened, which device you use, and the game version shown above. Never include passwords or other private account information.
          </Text>
          <Text selectable className="mt-3 font-mono text-base text-blue-dark">{SUPPORT_EMAIL}</Text>
          <View className="mt-4">
            <ActionButton
              label="Email support"
              accessibilityLabel="Email Hero Football Manager support"
              onPress={onEmailSupport}
              variant="paper"
            />
          </View>
        </PaperPanel>

        <PaperPanel kicker="Open-source notice" title="Silkscreen" stamp="OFL 1.1">
          <Text className="text-sm leading-5 text-ink/65">
            Silkscreen font copyright The Silkscreen Project Authors. Licensed under the SIL Open Font License, Version 1.1.
          </Text>
        </PaperPanel>
      </View>

      <View className="mt-6">
        <ActionButton label="‹  Back to settings" accessibilityLabel="Back to settings" onPress={onBack} variant="primary" />
      </View>
    </ScrollView>
  );
}
