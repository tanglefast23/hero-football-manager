import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton, PaperPanel, StatusChip } from '../components/Scorecard';
import type { ClubLegacyChoiceViewModel, ClubLegacyViewModel } from '../models';
import { SettingsButton } from '../SettingsOverlay';

export interface ClubLegacyScreenProps {
  viewModel: ClubLegacyViewModel;
  onChoose: (choice: ClubLegacyChoiceViewModel['id']) => void;
  onOpenSettings: () => void;
}

export function ClubLegacyScreen({
  viewModel,
  onChoose,
  onOpenSettings,
}: ClubLegacyScreenProps) {
  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'left', 'right', 'bottom']}>
      <View className="flex-row items-center justify-between border-b-2 border-gold-dark bg-white px-4 py-3">
        <View className="flex-1">
          <Text className="font-mono text-sm font-bold uppercase text-gold-dark">Club legacy</Text>
          <Text className="mt-1 font-pixel text-lg uppercase text-ink">A legend's next chapter</Text>
        </View>
        <View className="flex-row items-center gap-2">
          <StatusChip label={viewModel.seasonLabel} tone="hero" />
          <SettingsButton onPress={onOpenSettings} />
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
        <PaperPanel kicker="Retirement office" title={viewModel.playerName} stamp="Club legend">
          <View className="flex-row flex-wrap items-center gap-2">
            <StatusChip label={viewModel.role} />
            <StatusChip label={viewModel.archetype} tone="hero" />
            <StatusChip label={`${viewModel.fame} fame`} tone="success" />
          </View>
          <Text className="mt-4 text-base leading-6 text-ink/70">
            After {viewModel.seasonsAtClub} season{viewModel.seasonsAtClub === 1 ? '' : 's'} at the club,
            {' '}{viewModel.playerName} has earned a permanent place in its story.
          </Text>
          <Text className="mt-2 text-sm font-bold uppercase text-ink/50">
            {viewModel.personality} · {viewModel.queueLabel}
          </Text>
        </PaperPanel>

        <View className="mt-6 gap-4">
          <View>
            <Text className="font-mono text-sm font-bold uppercase text-blue-dark">Your decision</Text>
            <Text className="mt-1 text-xl font-bold uppercase text-ink">How should the legacy continue?</Text>
          </View>
          {viewModel.choices.map((choice, index) => (
            <PaperPanel
              key={choice.id}
              kicker={`Option ${index + 1}`}
              title={choice.label}
              className={choice.id === 'coach-candidate' ? 'bg-blue-light' : 'bg-pitch-light'}
            >
              <Text className="text-base leading-6 text-ink/70">{choice.detail}</Text>
              <View className="my-3 border-t border-ink/20" />
              <Text className="mb-3 text-sm font-bold uppercase leading-5 text-ink">
                {choice.outcome}
              </Text>
              <ActionButton
                label={`Choose ${choice.label}  ▸`}
                accessibilityLabel={`Choose ${choice.label} for ${viewModel.playerName}. ${choice.outcome}`}
                onPress={() => onChoose(choice.id)}
                variant={choice.id === 'coach-candidate' ? 'action' : 'confirm'}
              />
            </PaperPanel>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
