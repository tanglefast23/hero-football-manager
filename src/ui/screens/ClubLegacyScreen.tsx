import { useCallback, useEffect, useRef } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton, PaperPanel, StatusChip } from '../components/Scorecard';
import { ChalkboardBackdrop, StageSection } from '../components/ChalkboardStage';
import { PixelPortrait } from '../components/PixelPortrait';
import { useLayoutMode } from '../layout/use-layout-mode';
import type { ClubLegacyChoiceViewModel, ClubLegacyViewModel } from '../models';
import { SettingsButton } from '../SettingsOverlay';
import { TutorialTapCue } from '../TutorialTapCue';
import { useTapGuard } from '../use-tap-guard';
import { PixelText } from '../components/PixelText';
import {
  TUTORIAL_TAP_CUE_ABOVE_OFFSET,
  TUTORIAL_TAP_CUE_RESERVED_SPACE,
  TUTORIAL_TAP_CUE_WIDTH,
} from '../tutorial-cue-position';
import { useDesktopContentStyle } from '../layout/DesktopClamp';

export interface ClubLegacyScreenProps {
  viewModel: ClubLegacyViewModel;
  onChoose: (choice: ClubLegacyChoiceViewModel['id']) => void;
  onOpenSettings: () => void;
  guided?: boolean;
  onDismissGuidance?: () => void;
}

export function ClubLegacyScreen({
  viewModel,
  onChoose,
  onOpenSettings,
  guided = false,
  onDismissGuidance,
}: ClubLegacyScreenProps) {
  const desktopContent = useDesktopContentStyle();
  const wide = useLayoutMode() === 'twoColumn';
  // Legends retire in a queue, and this choice is irreversible: without the
  // guard the second tap of a double-tap decides the next legend's future too.
  const guardTap = useTapGuard();
  const dismissFrameRef = useRef<number | null>(null);
  const dismissGuidanceAfterPress = useCallback(() => {
    if (!guided || onDismissGuidance === undefined || dismissFrameRef.current !== null) return;
    dismissFrameRef.current = requestAnimationFrame(() => {
      dismissFrameRef.current = null;
      onDismissGuidance();
    });
  }, [guided, onDismissGuidance]);
  useEffect(() => () => {
    if (dismissFrameRef.current !== null) cancelAnimationFrame(dismissFrameRef.current);
  }, []);

  return (
    <SafeAreaView
      className="flex-1 bg-pitch-dark"
      edges={['top', 'left', 'right', 'bottom']}
      onPointerUp={dismissGuidanceAfterPress}
      onTouchEnd={dismissGuidanceAfterPress}
    >
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

      <ScrollView className="flex-1" contentContainerStyle={[{ padding: 16, paddingBottom: 28 }, desktopContent]}>
        <PaperPanel kicker="Retirement office" title={viewModel.playerName} stamp="Club legend">
          <View className="flex-row items-center gap-4">
            <View className="overflow-hidden border-2 border-b-4 border-gold-dark bg-gold-light">
              <PixelPortrait playerId={viewModel.playerId} role={viewModel.role} lookId={viewModel.lookId} expression="joy" />
            </View>
            <View className="flex-1 flex-row flex-wrap gap-2">
              <StatusChip label={viewModel.role} />
              {/* Same chip the board panel puts on a hero it is about to sell:
                  a powered player's farewell should never read like anyone's. */}
              {viewModel.isHero ? <StatusChip label="Hero" tone="hero" /> : null}
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
                kicker={viewModel.choices.length === 1 ? 'The offer' : `Option ${index + 1}`}
                title={choice.label}
                className="bg-blue-light"
              >
                <Text className="text-base leading-6 text-ink/70">{choice.detail}</Text>
                <View className="my-3 border-t border-ink/20" />
                <PixelText className="mb-3 text-sm uppercase leading-5 text-ink">
                  {choice.outcome}
                </PixelText>
                <ActionButton
                  label={`Choose ${choice.label}  ▸`}
                  accessibilityLabel={`Choose ${choice.label} for ${viewModel.playerName}. ${choice.outcome}`}
                  onPress={() => guardTap(() => onChoose(choice.id))}
                  variant="action"
                />
              </PaperPanel>
            </View>
          ))}
        </View>

        {/* The club's own record of everyone who has left it. Nothing else in
            the game reads `retiredPlayers`, so before this the list grew for
            the whole career and was never once shown. It sits under the
            decision, not beside it: the queue is what this screen is for. */}
        {viewModel.formerPlayers.length === 0 ? null : (
          <View className="mt-6 gap-4">
            <StageSection
              eyebrow="Club record"
              title="Former players"
            />
            <PaperPanel
              kicker="Retired"
              title={`${viewModel.formerPlayerTotal} ${viewModel.formerPlayerTotal === 1 ? 'name' : 'names'}`}
              stamp="Club history"
            >
              <View className="gap-2">
                {viewModel.formerPlayers.map(former => (
                  <View
                    key={former.playerId}
                    accessible
                    accessibilityRole="summary"
                    accessibilityLabel={`${former.playerName}. ${former.detail}.${former.isHero ? ' Hero.' : ''}`}
                    className="flex-row items-center gap-3 border-2 border-ink/25 bg-white p-2"
                  >
                    <View className="overflow-hidden border-2 border-ink bg-paper-dark">
                      <PixelPortrait
                        playerId={former.playerId}
                        role={former.role}
                        lookId={former.lookId}
                        expression="rest"
                      />
                    </View>
                    <View className="flex-1">
                      <View className="flex-row items-center gap-2">
                        <Text className="flex-1 text-base font-bold text-ink" numberOfLines={1}>
                          {former.playerName}
                        </Text>
                        {former.isHero ? <StatusChip label="Hero" tone="hero" /> : null}
                      </View>
                      <Text className="mt-1 font-mono text-sm text-ink/65">{former.detail}</Text>
                    </View>
                  </View>
                ))}
              </View>
              {viewModel.formerPlayerTotal > viewModel.formerPlayers.length ? (
                <PixelText className="mt-3 text-sm uppercase text-ink/50">
                  {viewModel.formerPlayerTotal - viewModel.formerPlayers.length} more in the archive
                </PixelText>
              ) : null}
            </PaperPanel>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
