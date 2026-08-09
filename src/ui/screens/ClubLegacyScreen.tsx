import { useCallback, useEffect, useRef } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton, PaperPanel, StatusChip } from '../components/Scorecard';
import {
  ChalkboardBackdrop,
  StageSection,
} from '../components/ChalkboardStage';
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
import { useCopy } from '../../i18n';

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
  const t = useCopy();
  const desktopContent = useDesktopContentStyle();
  const wide = useLayoutMode() === 'twoColumn';
  // Legends retire in a queue, and this choice is irreversible: without the
  // guard the second tap of a double-tap decides the next legend's future too.
  const guardTap = useTapGuard();
  const dismissFrameRef = useRef<number | null>(null);
  const dismissGuidanceAfterPress = useCallback(() => {
    if (
      !guided ||
      onDismissGuidance === undefined ||
      dismissFrameRef.current !== null
    )
      return;
    dismissFrameRef.current = requestAnimationFrame(() => {
      dismissFrameRef.current = null;
      onDismissGuidance();
    });
  }, [guided, onDismissGuidance]);
  useEffect(
    () => () => {
      if (dismissFrameRef.current !== null)
        cancelAnimationFrame(dismissFrameRef.current);
    },
    [],
  );

  return (
    <SafeAreaView
      className="flex-1 bg-pitch-ink"
      edges={['top', 'left', 'right', 'bottom']}
      onPointerUp={dismissGuidanceAfterPress}
      onTouchEnd={dismissGuidanceAfterPress}
    >
      <ChalkboardBackdrop wide={wide} />
      <View className="flex-row items-center justify-between px-4 py-3">
        <View className="flex-1">
          <Text className="font-pixel text-xs uppercase tracking-[2px] text-gold-light">
            {t('clubLegacy.clubLegacy')}
          </Text>
          <Text className="mt-1 font-pixel text-lg uppercase text-white">
            {t('clubLegacy.aLegendsNextChapter')}
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <StatusChip label={viewModel.seasonLabel} tone="hero" />
          <SettingsButton onPress={onOpenSettings} />
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={[
          { padding: 16, paddingBottom: 28 },
          desktopContent,
        ]}
      >
        <PaperPanel
          kicker={t('clubLegacy.retirementOffice')}
          title={viewModel.playerName}
          stamp={t('clubLegacy.clubLegend')}
        >
          <View className="flex-row items-center gap-4">
            <View className="overflow-hidden border-2 border-b-4 border-gold-dark bg-gold-light">
              <PixelPortrait
                playerId={viewModel.playerId}
                role={viewModel.role}
                lookId={viewModel.lookId}
                expression="joy"
              />
            </View>
            <View className="flex-1 flex-row flex-wrap gap-2">
              <StatusChip label={viewModel.role} />
              {/* Same chip the board panel puts on a hero it is about to sell:
                  a powered player's farewell should never read like anyone's. */}
              {viewModel.isHero ? (
                <StatusChip label={t('clubLegacy.hero')} tone="hero" />
              ) : null}
              {/* The label, never `archetype` — that field is the persisted id
                  the summary table is keyed by, and a chip is the one place a
                  translated word belongs. */}
              <StatusChip label={viewModel.archetypeLabel} tone="hero" />
              <StatusChip
                label={t('clubLegacy.fame', { fame: viewModel.fame })}
                tone="success"
              />
            </View>
          </View>
          <Text className="mt-4 text-base leading-6 text-ink/70">
            {/* Plural siblings rather than a ternary: the ternary encodes
                English's rule, and pt-BR and French put zero in the singular. */}
            {t('clubLegacy.seasonsAtClub', {
              n: viewModel.seasonsAtClub,
              count: viewModel.seasonsAtClub,
              player: viewModel.playerName,
            })}
          </Text>
          <PixelText className="mt-2 text-sm uppercase text-ink/50">
            {viewModel.personality} · {viewModel.queueLabel}
          </PixelText>
        </PaperPanel>

        <View className="mt-6 gap-4">
          <StageSection
            eyebrow={t('clubLegacy.yourDecision')}
            title={t('clubLegacy.howShouldTheLegacyContinue')}
          />
          {viewModel.choices.map((choice, index) => (
            <View
              key={choice.id}
              className={
                guided && index === 0
                  ? 'relative border-2 border-blue-dark bg-blue-light p-1'
                  : 'relative'
              }
              style={
                guided && index === 0
                  ? { marginTop: TUTORIAL_TAP_CUE_RESERVED_SPACE }
                  : undefined
              }
            >
              {guided && index === 0 ? (
                <TutorialTapCue
                  detail={t('clubLegacy.chooseTheLegacy')}
                  style={{
                    left: '50%',
                    marginLeft: -TUTORIAL_TAP_CUE_WIDTH / 2,
                    top: -TUTORIAL_TAP_CUE_ABOVE_OFFSET,
                  }}
                />
              ) : null}
              <PaperPanel
                kicker={
                  viewModel.choices.length === 1
                    ? t('clubLegacy.theOffer')
                    : t('clubLegacy.option', { number: index + 1 })
                }
                title={choice.label}
                className="bg-blue-light"
              >
                <Text className="text-base leading-6 text-ink/70">
                  {choice.detail}
                </Text>
                <View className="my-3 border-t border-ink/20" />
                <PixelText className="mb-3 text-sm uppercase leading-5 text-ink">
                  {choice.outcome}
                </PixelText>
                <ActionButton
                  // ▸ is not a Silkscreen glyph, so it stays out of the catalog
                  // and is appended here.
                  label={`${t('clubLegacy.choose', { choice: choice.label })}  ▸`}
                  accessibilityLabel={t('clubLegacy.a11y.chooseForPlayer', {
                    choice: choice.label,
                    player: viewModel.playerName,
                    outcome: choice.outcome,
                  })}
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
              eyebrow={t('clubLegacy.clubRecord')}
              title={t('clubLegacy.formerPlayers')}
            />
            <PaperPanel
              kicker={t('clubLegacy.retired')}
              // Plural siblings rather than a ternary, for the same reason
              // `seasonsAtClub` uses them: the ternary encodes English's rule.
              title={t('clubLegacy.formerPlayerCount', {
                n: viewModel.formerPlayerTotal,
                count: viewModel.formerPlayerTotal,
              })}
              stamp={t('clubLegacy.clubHistory')}
            >
              <View className="gap-2">
                {viewModel.formerPlayers.map((former) => (
                  <View
                    key={former.playerId}
                    accessible
                    accessibilityRole="summary"
                    accessibilityLabel={t(
                      former.isHero
                        ? 'clubLegacy.a11y.formerHero'
                        : 'clubLegacy.a11y.formerPlayer',
                      { player: former.playerName, detail: former.detail },
                    )}
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
                        <Text
                          className="flex-1 text-base font-bold text-ink"
                          numberOfLines={1}
                        >
                          {former.playerName}
                        </Text>
                        {former.isHero ? (
                          <StatusChip
                            label={t('clubLegacy.hero')}
                            tone="hero"
                          />
                        ) : null}
                      </View>
                      <Text className="mt-1 font-mono text-sm text-ink/65">
                        {former.detail}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
              {viewModel.formerPlayerTotal > viewModel.formerPlayers.length ? (
                <PixelText className="mt-3 text-sm uppercase text-ink/50">
                  {t('clubLegacy.moreInArchive', {
                    count:
                      viewModel.formerPlayerTotal -
                      viewModel.formerPlayers.length,
                  })}
                </PixelText>
              ) : null}
            </PaperPanel>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
