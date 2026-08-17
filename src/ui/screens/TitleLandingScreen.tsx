import { useState } from 'react';
import { ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton, PaperPanel, StatusChip } from '../components/Scorecard';
import {
  ChalkboardBackdrop,
  PaperSticker,
} from '../components/ChalkboardStage';
import { useLayoutMode } from '../layout/use-layout-mode';
import { FormationDiagram } from '../components/FormationDiagram';
import { LanguageButton } from '../components/LanguageButton';
import { useCopy, type Locale } from '../../i18n';
import { SfxPressable as Pressable } from '../components/SfxPressable';
import type { AppPreferences } from '../../persistence';
import type { GlossaryCatalog } from '../../content';
import { GlossaryPanel } from '../GlossaryPanel';
import { TitlePlayerPopScene } from '../components/TitlePlayerPopScene';
import { PixelText } from '../components/PixelText';
import { layoutModeForWidth, titleMascotFits } from '../layout/layout-mode';
import { PrivacySupportPanel } from '../PrivacySupportPanel';
import { ChunkyControl } from '../components/ChunkyControl';
import { TYPE_ART_EXCEPTION, TYPE_SIZE } from '../ui-tokens';

export interface TitleLandingScreenProps {
  hasSavedCareer: boolean;
  reduceMotion?: boolean;
  onStory: () => void;
  onSettings: () => void;
  /**
   * Language lives here because this is the screen every player lands on, every
   * launch — so it is reachable before the first decision, without hunting
   * through Settings.
   */
  language: Locale;
  onLanguageChange: (locale: Locale) => void;
}

export function TitleLandingScreen({
  hasSavedCareer,
  reduceMotion = false,
  onStory,
  onSettings,
  language,
  onLanguageChange,
}: TitleLandingScreenProps) {
  const t = useCopy();
  const { width, height } = useWindowDimensions();
  const isWide = layoutModeForWidth(width) === 'twoColumn' && height >= 600;
  // The two-column title puts the mascot beside the wordmark rather than over
  // it, so only the one-column layout has to earn the room.
  const showMascot = isWide || titleMascotFits(height);

  return (
    <SafeAreaView
      className="flex-1 bg-pitch-ink"
      edges={['top', 'left', 'right', 'bottom']}
    >
      <View pointerEvents="none" className="absolute inset-0 overflow-hidden">
        <View className="absolute -left-28 top-16 h-72 w-72 rounded-full border-4 border-paper/15" />
        <View className="absolute -right-24 top-64 h-64 w-64 rounded-full border-4 border-paper/10" />
        {isWide ? (
          <View className="absolute right-[9%] top-1/2 h-[440px] w-[440px] -translate-y-1/2 rounded-full border-4 border-paper/10" />
        ) : null}
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1, alignItems: 'center' }}
      >
        <View
          className={
            isWide
              ? 'w-full max-w-[1180px] flex-1 flex-row items-center justify-between gap-12 px-12 py-10'
              : 'w-full max-w-[480px] flex-1 justify-between px-5 py-5'
          }
        >
          <View
            className={isWide ? 'min-w-0 max-w-[620px] flex-1' : 'relative'}
          >
            <View className="flex-row items-start justify-between">
              <View className="-rotate-2 border-2 border-ink bg-paper px-3 py-2">
                <Text
                  className={`font-pixel uppercase text-pitch-ink ${TYPE_SIZE.caption}`}
                >
                  {t('titleLanding.smallClubBigHeroes')}
                </Text>
              </View>
              <View
                className={
                  isWide
                    ? 'h-14 w-14 rotate-3 items-center justify-center border-[3px] border-ink bg-gold'
                    : 'h-11 w-11 rotate-3 items-center justify-center border-2 border-ink bg-gold'
                }
              >
                <Text
                  className={`font-pixel text-ink ${isWide ? TYPE_ART_EXCEPTION.titleStarWide : TYPE_SIZE.display}`}
                >
                  ★
                </Text>
              </View>
            </View>

            <View className={isWide ? 'mt-12' : 'mt-7'}>
              <Text
                className={`font-pixel uppercase text-paper/80 ${TYPE_SIZE.caption} ${
                  isWide ? 'tracking-[4px]' : 'tracking-[3px]'
                }`}
              >
                {t('titleLanding.theBeautifulGameGetsStrange')}
              </Text>
              <Text
                className={`font-pixel uppercase tracking-tight text-white ${
                  isWide
                    ? `mt-4 ${TYPE_ART_EXCEPTION.titleWordmarkWide}`
                    : `mt-2 ${TYPE_ART_EXCEPTION.titleWordmarkCompact}`
                }`}
              >
                {t('titleLanding.titleHero')}
                {'\n'}
                {t('titleLanding.titleFootball')}
              </Text>
              <View
                className={
                  isWide
                    ? '-mt-1 -rotate-2 self-start border-[3px] border-ink bg-blue px-5 py-2'
                    : '-mt-1 -rotate-2 self-start border-2 border-ink bg-blue px-3 py-1'
                }
              >
                <Text
                  className={`font-pixel uppercase text-white ${TYPE_SIZE.display}`}
                >
                  {t('titleLanding.manager')}
                </Text>
              </View>
              <Text
                className={`font-mono uppercase text-paper/80 ${TYPE_SIZE.body} ${
                  isWide ? 'mt-7 max-w-lg leading-7' : 'mt-4 max-w-sm leading-5'
                }`}
              >
                {t('titleLanding.trainATinyClub')}
              </Text>
            </View>
          </View>

          {/* The gap exists to hold the mascot's overhang. With no mascot to
              hold it is dead pitch, and on the short screens that drop him it is
              the room STORY and CONTINUE need to stay above the fold. */}
          <View
            className={
              isWide ? 'w-[430px] pt-28' : showMascot ? 'mt-32' : 'mt-10'
            }
          >
            <TitleMenu
              hasSavedCareer={hasSavedCareer}
              reduceMotion={reduceMotion}
              showMascot={showMascot}
              onStory={onStory}
              onSettings={onSettings}
              language={language}
              onLanguageChange={onLanguageChange}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function TitleMenu({
  hasSavedCareer,
  reduceMotion,
  showMascot,
  onStory,
  onSettings,
  language,
  onLanguageChange,
}: {
  readonly hasSavedCareer: boolean;
  readonly reduceMotion: boolean;
  /** False where the viewport cannot hold the overhang — see titleMascotFits. */
  readonly showMascot: boolean;
  readonly onStory: () => void;
  readonly onSettings: () => void;
  readonly language: Locale;
  readonly onLanguageChange: (locale: Locale) => void;
}) {
  const t = useCopy();
  return (
    <View className="relative z-20">
      {showMascot ? (
        <View
          pointerEvents="none"
          className="absolute -top-[250px] left-0 right-0 z-20 h-[252px]"
        >
          <TitlePlayerPopScene reduceMotion={reduceMotion} />
        </View>
      ) : null}
      <View className="z-10 gap-2 border-[3px] border-ink bg-paper p-3">
        <View className="mb-1 flex-row items-center justify-between">
          <Text
            className={`font-pixel uppercase tracking-[1px] text-ink/60 ${TYPE_SIZE.caption}`}
          >
            {t('titleLanding.pickYourBoots')}
          </Text>
          {hasSavedCareer ? (
            <StatusChip label={t('titleLanding.saveFound')} tone="success" />
          ) : (
            <StatusChip label={t('titleLanding.newFile')} tone="hero" />
          )}
        </View>
        <View className="mb-1 flex-row justify-end">
          <LanguageButton value={language} onChange={onLanguageChange} />
        </View>
        <ChunkyControl
          accessibilityRole="button"
          accessibilityLabel={
            hasSavedCareer
              ? t('titleLanding.a11y.openStoryAndSavedCareerOptions')
              : t('titleLanding.a11y.openStoryMode')
          }
          onPress={onStory}
          className="relative min-h-20 border-[3px] px-4"
          square
          tone="primary"
        >
          <Text
            className={`font-pixel uppercase text-white ${TYPE_SIZE.display}`}
          >
            {t('titleLanding.story')}
          </Text>
          <Text
            className={`mt-1 max-w-[82%] font-mono uppercase leading-4 text-white/75 ${TYPE_SIZE.caption}`}
          >
            {hasSavedCareer
              ? t('titleLanding.continueYourClub')
              : t('titleLanding.takeTheKeys')}
          </Text>
          <Text
            className={`absolute right-4 top-3 font-pixel text-white ${TYPE_ART_EXCEPTION.titleActionArrow}`}
          >
            ▸
          </Text>
        </ChunkyControl>
        <ChunkyControl
          accessibilityRole="button"
          accessibilityLabel={t('settings.open')}
          onPress={onSettings}
          className="min-h-12 flex-row items-center justify-between border-[3px] px-4"
          compact
          square
          tone="paper"
        >
          <View className="flex-row items-center gap-3">
            <Text className={`font-pixel text-blue-dark ${TYPE_SIZE.heading}`}>
              ⚙
            </Text>
            <Text
              className={`font-pixel uppercase text-ink ${TYPE_SIZE.caption}`}
            >
              {t('titleLanding.settings')}
            </Text>
          </View>
          <Text className={`font-pixel text-ink/45 ${TYPE_SIZE.heading}`}>
            ›
          </Text>
        </ChunkyControl>
      </View>
    </View>
  );
}

export interface TitleSettingsScreenProps {
  preferences: AppPreferences;
  glossary: GlossaryCatalog;
  onCycleVolume: () => void;
  onCycleFormation: (slot: number) => void;
  onToggleReduceMotion: () => void;
  onToggleHudSide: () => void;
  onToggleHaptics: () => void;
  onCycleTextScale: () => void;
  onToggleHighContrast: () => void;
  onToggleColorSafeKits: () => void;
  onToggleCutInMode: () => void;
  onEmailSupport: () => void;
  onOpenPrivacyPolicy: () => void;
  supportError?: string | null;
  accessibilityCopy?: { title: string; body: string };
  difficultyLabel?: 'COZY' | 'CHAIRMAN';
  onBack: () => void;
  backLabel?: string;
}

export function TitleSettingsScreen({
  preferences,
  glossary,
  onCycleVolume,
  onCycleFormation,
  onToggleReduceMotion,
  onToggleHudSide,
  onToggleHaptics,
  onCycleTextScale,
  onToggleHighContrast,
  onToggleColorSafeKits,
  onToggleCutInMode,
  onEmailSupport,
  onOpenPrivacyPolicy,
  supportError,
  accessibilityCopy,
  difficultyLabel,
  onBack,
  backLabel,
}: TitleSettingsScreenProps) {
  const t = useCopy();
  const [showGlossary, setShowGlossary] = useState(false);
  const [showPrivacySupport, setShowPrivacySupport] = useState(false);
  const wide = useLayoutMode() === 'twoColumn';
  const volumePercent = Math.round(preferences.masterVolume * 100);
  // The default moved out of the parameter list because no hook can run there.
  const backText = backLabel ?? t('titleLanding.backToTitle');
  if (showGlossary) {
    return (
      <SafeAreaView
        className="flex-1 bg-paper"
        edges={['top', 'left', 'right', 'bottom']}
      >
        <View className="flex-1 px-5 py-6">
          <GlossaryPanel
            content={glossary}
            onBack={() => setShowGlossary(false)}
          />
        </View>
      </SafeAreaView>
    );
  }
  if (showPrivacySupport) {
    return (
      <SafeAreaView
        className="flex-1 bg-paper"
        edges={['top', 'left', 'right', 'bottom']}
      >
        <View className="flex-1 px-5 py-6">
          <PrivacySupportPanel
            onBack={() => setShowPrivacySupport(false)}
            onEmailSupport={onEmailSupport}
            onOpenPrivacyPolicy={onOpenPrivacyPolicy}
            supportError={supportError}
          />
        </View>
      </SafeAreaView>
    );
  }
  const formationsPanel = (
    <PaperPanel
      kicker={t('titleLanding.matchDayKit')}
      title={t('titleLanding.threeFormations')}
      stamp={t('titleLanding.tapToSwap')}
    >
      <Text className="text-base leading-5 text-ink/65">
        {t('titleLanding.theseAreTheThree')}
      </Text>
      <View className="mt-5 flex-row gap-2">
        {preferences.formationPresets.map((formation, index) => (
          <Pressable
            key={`${index}-${formation}`}
            accessibilityRole="button"
            accessibilityLabel={t('titleLanding.a11y.formationSlot', {
              slot: index + 1,
              formation,
            })}
            onPress={() => onCycleFormation(index)}
            className="flex-1 items-center border-2 border-ink bg-paper-dark px-2 py-3"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : undefined })}
          >
            <FormationDiagram formation={formation} compact />
            <Text className="mt-2 font-pixel text-sm text-ink">
              {formation}
            </Text>
            <PixelText
              className="mt-1 text-center text-xs uppercase text-ink/50"
              numberOfLines={2}
            >
              {t(`formation.${formation}.blurb`)}
            </PixelText>
          </Pressable>
        ))}
      </View>
    </PaperPanel>
  );

  const accessibilityPanel = (
    <PaperPanel
      kicker={t('titleLanding.accessibility')}
      title={t('titleLanding.comfortAndReach')}
      stamp={t('titleLanding.saved')}
    >
      <Text className="text-base leading-5 text-ink/65">
        {accessibilityCopy?.body ?? t('titleLanding.reduceAnimatedFlourishes')}
      </Text>
      <View className="mt-5 gap-3">
        <Pressable
          accessibilityRole="switch"
          accessibilityLabel={t('settings.reduceMotion.label')}
          accessibilityState={{ checked: preferences.reduceMotion }}
          onPress={onToggleReduceMotion}
          className={
            preferences.reduceMotion
              ? 'min-h-14 flex-row items-center justify-between border-2 border-ink bg-blue-light px-4 py-3'
              : 'min-h-14 flex-row items-center justify-between border-2 border-ink bg-paper-dark px-4 py-3'
          }
          style={({ pressed }) => ({ opacity: pressed ? 0.72 : undefined })}
        >
          <View className="flex-1 pr-3">
            <Text className="font-pixel text-base uppercase text-ink">
              {t('settings.reduceMotion.label')}
            </Text>
            <Text className="mt-1 text-sm text-ink/60">
              {t('titleLanding.stopsCount-upsFlashesPulses')}
            </Text>
          </View>
          <Text className="font-pixel text-lg text-ink">
            {t(preferences.reduceMotion ? 'settings.on' : 'settings.off')}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('titleLanding.a11y.matchInfoPanelSide', {
            side: t(
              preferences.hudSide === 'left'
                ? 'settings.matchInfo.left'
                : 'settings.matchInfo.right',
            ),
          })}
          onPress={onToggleHudSide}
          className="min-h-14 flex-row items-center justify-between border-2 border-ink bg-paper-dark px-4 py-3"
          style={({ pressed }) => ({ opacity: pressed ? 0.72 : undefined })}
        >
          <View className="flex-1 pr-3">
            <Text className="font-pixel text-base uppercase text-ink">
              {t('titleLanding.matchInfoPosition')}
            </Text>
            <Text className="mt-1 text-sm text-ink/60">
              {t('titleLanding.movesTheCarrierCard')}
            </Text>
          </View>
          <Text className="font-pixel text-lg uppercase text-blue-dark">
            {t(
              preferences.hudSide === 'left'
                ? 'settings.matchInfo.left'
                : 'settings.matchInfo.right',
            )}
          </Text>
        </Pressable>
        <AccessibilityToggle
          label={t('titleLanding.haptics')}
          detail={t('titleLanding.turnsAllTouchFeedback')}
          enabled={preferences.hapticsEnabled}
          onPress={onToggleHaptics}
        />
        <AccessibilityChoice
          label={t('settings.textSize.label')}
          detail={t('titleLanding.addsExtraRoom')}
          value={t(
            preferences.textScale === 1
              ? 'settings.textSize.system'
              : preferences.textScale === 1.15
                ? 'settings.textSize.roomy'
                : 'settings.textSize.large',
          )}
          onPress={onCycleTextScale}
        />
        <AccessibilityToggle
          label={t('settings.highContrast.label')}
          detail={t('titleLanding.darkensMatchChrome')}
          enabled={preferences.highContrast}
          onPress={onToggleHighContrast}
        />
        <AccessibilityToggle
          label={t('settings.colorSafeKits.label')}
          detail={t('titleLanding.usesAHighSeparation')}
          enabled={preferences.colorSafeKits}
          onPress={onToggleColorSafeKits}
        />
        <AccessibilityChoice
          label={t('settings.powerLabels.label')}
          detail={t('titleLanding.chooseABottomLeft')}
          value={t(
            preferences.cutInMode === 'full'
              ? 'settings.powerLabels.player'
              : 'settings.powerLabels.banner',
          )}
          onPress={onToggleCutInMode}
        />
      </View>
    </PaperPanel>
  );

  const difficultyPanel = difficultyLabel ? (
    <PaperPanel
      kicker={t('titleLanding.currentCareer')}
      title={t('titleLanding.boardroomPressure')}
      stamp={t(
        difficultyLabel === 'CHAIRMAN'
          ? 'settings.difficulty.chairman'
          : 'settings.difficulty.cozy',
      )}
    >
      <Text className="text-base leading-5 text-ink/65">
        {t('titleLanding.difficultyIsChosenWhen')}
      </Text>
    </PaperPanel>
  ) : null;

  const audioPanel = (
    <PaperPanel
      kicker={t('titleLanding.masterMix')}
      title={t('titleLanding.gameAudio')}
      stamp={`${volumePercent}%`}
    >
      <Text className="text-base leading-5 text-ink/65">
        {t('titleLanding.oneMasterLevelKeeps')}
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('titleLanding.a11y.masterAudioPercent', {
          percent: volumePercent,
        })}
        accessibilityHint={t(
          'titleLanding.a11y.cyclesThrough0255075And100Percent',
        )}
        onPress={onCycleVolume}
        className="mt-5 border-2 border-ink bg-signal px-4 py-4"
        style={({ pressed }) => ({ opacity: pressed ? 0.75 : undefined })}
      >
        <View className="flex-row items-end justify-between">
          <View>
            <PixelText className="text-sm uppercase tracking-[2px] text-ink/55">
              {t('titleLanding.tapToChange')}
            </PixelText>
            <Text className="mt-1 font-mono text-3xl text-ink">
              {volumePercent === 0 ? 'MUTED' : `${volumePercent}%`}
            </Text>
          </View>
          <Text className="font-mono text-4xl text-ink">
            {volumePercent === 0 ? '×' : '♪'}
          </Text>
        </View>
      </Pressable>

      <View className="mt-5 gap-2 border-t border-ink/20 pt-4">
        <View className="flex-row items-center justify-between">
          <PixelText className="text-sm uppercase tracking-wide text-ink/60">
            {t('titleLanding.titleTheme')}
          </PixelText>
          <StatusChip label={t('titleLanding.trackHeroesStartHere')} selected />
        </View>
        <View className="flex-row items-center justify-between">
          <PixelText className="text-sm uppercase tracking-wide text-ink/60">
            {t('titleLanding.management')}
          </PixelText>
          <StatusChip label={t('titleLanding.trackClubhouseDreams')} />
        </View>
        <View className="flex-row items-center justify-between">
          <PixelText className="text-sm uppercase tracking-wide text-ink/60">
            {t('titleLanding.matchDay')}
          </PixelText>
          <StatusChip label={t('titleLanding.trackMatchDayHeroes')} />
        </View>
      </View>
    </PaperPanel>
  );

  const glossaryPanel = (
    <PaperPanel
      kicker={t('titleLanding.clubHandbook')}
      title={t('titleLanding.glossary')}
      stamp={t('titleLanding.aToZ')}
    >
      <Text className="text-base leading-5 text-ink/65">
        {t('titleLanding.lookUpFootballTerms')}
      </Text>
      <View className="mt-4">
        <ActionButton
          label={t('settings.glossary.open')}
          accessibilityLabel={t('settings.glossary.open')}
          onPress={() => setShowGlossary(true)}
          variant="paper"
        />
      </View>
    </PaperPanel>
  );

  const privacySupportPanel = (
    <PaperPanel
      kicker={t('titleLanding.aboutThisBuild')}
      title={t('settings.privacy.label')}
      stamp={t('titleLanding.noTracking')}
    >
      <Text className="text-base leading-5 text-ink/65">
        {t('titleLanding.readHowLocalSaves')}
      </Text>
      <View className="mt-4">
        <ActionButton
          label={t('titleLanding.openPrivacySupport')}
          accessibilityLabel={t('settings.privacy.open')}
          onPress={() => setShowPrivacySupport(true)}
          variant="paper"
        />
      </View>
    </PaperPanel>
  );

  return (
    <SafeAreaView
      className="flex-1 bg-pitch-ink"
      edges={['top', 'left', 'right', 'bottom']}
    >
      <ChalkboardBackdrop wide={wide} />
      <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1 }}>
        <View
          className={
            wide
              ? 'w-full max-w-[1180px] flex-1 justify-between self-center px-10 py-8'
              : 'flex-1 justify-between px-5 py-6'
          }
        >
          <View>
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="font-pixel text-xs uppercase tracking-[3px] text-gold-light">
                  {t('titleLanding.frontOffice')}
                </Text>
                <Text
                  className={
                    wide
                      ? 'mt-2 font-pixel text-4xl uppercase text-white'
                      : 'mt-2 font-pixel text-3xl uppercase text-white'
                  }
                >
                  {t('titleLanding.settings')}
                </Text>
              </View>
              <PaperSticker
                text={t('titleLanding.coachsBoard')}
                className="-rotate-3"
              />
            </View>

            {wide ? (
              <View className="mt-8 flex-row items-start gap-6">
                <View className="flex-1 gap-6">
                  {formationsPanel}
                  {difficultyPanel}
                  {audioPanel}
                </View>
                <View className="flex-1 gap-6">
                  {accessibilityPanel}
                  {glossaryPanel}
                  {privacySupportPanel}
                </View>
              </View>
            ) : (
              <View className="mt-8 gap-6">
                {formationsPanel}
                {accessibilityPanel}
                {difficultyPanel}
                {audioPanel}
                {glossaryPanel}
                {privacySupportPanel}
              </View>
            )}
          </View>

          <View className="mt-8">
            <ActionButton
              label={`‹  ${backText}`}
              accessibilityLabel={backText}
              onPress={onBack}
              variant="paper"
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function AccessibilityToggle({
  label,
  detail,
  enabled,
  onPress,
}: {
  label: string;
  detail: string;
  enabled: boolean;
  onPress: () => void;
}) {
  const t = useCopy();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: enabled }}
      onPress={onPress}
      className={
        enabled
          ? 'min-h-14 flex-row items-center justify-between border-2 border-ink bg-blue-light px-4 py-3'
          : 'min-h-14 flex-row items-center justify-between border-2 border-ink bg-paper-dark px-4 py-3'
      }
    >
      <View className="flex-1 pr-3">
        <Text className="font-pixel text-base uppercase text-ink">{label}</Text>
        <Text className="mt-1 text-sm text-ink/60">{detail}</Text>
      </View>
      <Text className="font-pixel text-lg text-ink">
        {t(enabled ? 'settings.on' : 'settings.off')}
      </Text>
    </Pressable>
  );
}

function AccessibilityChoice({
  label,
  detail,
  value,
  onPress,
}: {
  label: string;
  detail: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${value}`}
      onPress={onPress}
      className="min-h-14 flex-row items-center justify-between border-2 border-ink bg-paper-dark px-4 py-3"
    >
      <View className="flex-1 pr-3">
        <Text className="font-pixel text-base uppercase text-ink">{label}</Text>
        <Text className="mt-1 text-sm text-ink/60">{detail}</Text>
      </View>
      <Text className="font-pixel text-lg uppercase text-blue-dark">
        {value}
      </Text>
    </Pressable>
  );
}
