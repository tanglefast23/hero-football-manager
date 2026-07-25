import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton, PaperPanel, StatusChip } from '../components/Scorecard';
import { ChalkboardBackdrop, StageSection } from '../components/ChalkboardStage';
import { PixelPortrait } from '../components/PixelPortrait';
import { useLayoutMode } from '../layout/use-layout-mode';
import type { ClubLegacyChoiceViewModel, ClubLegacyViewModel } from '../models';
import { SettingsButton } from '../SettingsOverlay';
import { TutorialTapCue } from '../TutorialTapCue';
import { PixelText } from '../components/PixelText';
import {
  TUTORIAL_TAP_CUE_ABOVE_OFFSET,
  TUTORIAL_TAP_CUE_RESERVED_SPACE,
  TUTORIAL_TAP_CUE_WIDTH,
} from '../tutorial-cue-position';

export interface ClubLegacyScreenProps {
  viewModel: ClubLegacyViewModel;
  onChoose: (choice: ClubLegacyChoiceViewModel['id']) => void;
  onOpenSettings: () => void;
  guided?: boolean;
}

export function ClubLegacyScreen({
  viewModel,
  onChoose,
  onOpenSettings,
  guided = false,
}: ClubLegacyScreenProps) {
  const wide = useLayoutMode() === 'twoColumn';
  return (
    <SafeAreaView className="flex-1 bg-pitch-dark" edges={['top', 'left', 'right', 'bottom']}>
      <ChalkboardBackdrop wide={wide} />
      <View className="flex-row items-center justify-between px-4 py-3">
        <View className="flex-1">
          <Text className="font-pixel text-xs uppercase tracking-[2px] text-gold-light">Club legacy</Text>
          <Text className="mt-1 font-pixel text-lg uppercase text-white">A legend's next chapter</Text>
        </View>
        <View className="flex-row items-center gap-2">
          <StatusChip label={viewModel.seasonLabel} tone="hero" />
          <SettingsButton onPress={onOpenSettings} />
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
        <PaperPanel kicker="Retirement office" title={viewModel.playerName} stamp="Club legend">
          <View className="flex-row items-center gap-4">
            <View className="overflow-hidden border-2 border-b-4 border-gold-dark bg-gold-light">
              <PixelPortrait playerId={viewModel.playerId} role={viewModel.role} lookId={viewModel.lookId} expression="joy" />
            </View>
            <View className="flex-1 flex-row flex-wrap gap-2">
              <StatusChip label={viewModel.role} />
              <StatusChip label={viewModel.archetype} tone="hero" />
              <StatusChip label={`${viewModel.fame} fame`} tone="success" />
            </View>
          </View>
          <Text className="mt-4 text-base leading-6 text-ink/70">
            After {viewModel.seasonsAtClub} season{viewModel.seasonsAtClub === 1 ? '' : 's'} at the club,
            {' '}{viewModel.playerName} has earned a permanent place in its story.
          </Text>
          <PixelText className="mt-2 text-sm uppercase text-ink/50">
            {viewModel.personality} · {viewModel.queueLabel}
          </PixelText>
        </PaperPanel>

        <View className="mt-6 gap-4">
          <StageSection eyebrow="Your decision" title="How should the legacy continue?" />
          {viewModel.choices.map((choice, index) => (
            <View
              key={choice.id}
              className={guided && index === 0 ? 'relative border-2 border-blue-dark bg-blue-light p-1' : 'relative'}
              style={guided && index === 0 ? { marginTop: TUTORIAL_TAP_CUE_RESERVED_SPACE } : undefined}
            >
              {guided && index === 0 ? (
                <TutorialTapCue
                  detail="Choose the legacy"
                  style={{
                    left: '50%',
                    marginLeft: -TUTORIAL_TAP_CUE_WIDTH / 2,
                    top: -TUTORIAL_TAP_CUE_ABOVE_OFFSET,
                  }}
                />
              ) : null}
              <PaperPanel
                kicker={`Option ${index + 1}`}
                title={choice.label}
                className={choice.id === 'coach-candidate' ? 'bg-blue-light' : 'bg-pitch-light'}
              >
                <Text className="text-base leading-6 text-ink/70">{choice.detail}</Text>
                <View className="my-3 border-t border-ink/20" />
                <PixelText className="mb-3 text-sm uppercase leading-5 text-ink">
                  {choice.outcome}
                </PixelText>
                <ActionButton
                  label={`Choose ${choice.label}  ▸`}
                  accessibilityLabel={`Choose ${choice.label} for ${viewModel.playerName}. ${choice.outcome}`}
                  onPress={() => onChoose(choice.id)}
                  variant={choice.id === 'coach-candidate' ? 'action' : 'confirm'}
                />
              </PaperPanel>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
