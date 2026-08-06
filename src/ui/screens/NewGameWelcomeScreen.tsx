import type { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton, PaperPanel, StatusChip } from '../components/Scorecard';
import { ChalkboardBackdrop, StickerWord } from '../components/ChalkboardStage';
import { PixelPortrait } from '../components/PixelPortrait';
import { SettingsButton } from '../SettingsOverlay';
import { SfxPressable as Pressable } from '../components/SfxPressable';
import { useLayoutMode } from '../layout/use-layout-mode';
import { PixelText } from '../components/PixelText';
import { useCopy } from '../../i18n';

export interface NewGameWelcomeScreenProps {
  hasSavedCareer: boolean;
  savedCareerLabel?: string;
  showOpeningBrief: boolean;
  onStartNewCareer: () => void;
  onContinueCareer?: () => void;
  onOpenAccessibility?: () => void;
  onBackToTitle?: () => void;
  onOpenSettings: () => void;
}

/** One white pixel line of the chalkboard masthead. */
function MastheadLine({ text, wide }: { text: string; wide: boolean }) {
  return (
    <Text
      className={wide
        ? 'font-pixel text-[52px] uppercase leading-[54px] tracking-tight text-white'
        : 'font-pixel text-[34px] uppercase leading-[37px] tracking-tight text-white'}
    >
      {text}
    </Text>
  );
}

/** One numbered line of the week-one dossier: chunky pixel number tile + copy. */
function BriefRow({ index, title, note, children }: { index: string; title: string; note: string; children?: ReactNode }) {
  return (
    <View className="flex-row items-start gap-3">
      <View className="h-6 w-6 items-center justify-center bg-ink">
        <Text className="font-mono text-sm text-paper">{index}</Text>
      </View>
      <View className="flex-1">
        <Text className="font-pixel text-sm uppercase text-ink">{title}</Text>
        <Text className="mt-1 text-sm leading-4 text-ink/60">{note}</Text>
        {children}
      </View>
    </View>
  );
}

export function NewGameWelcomeScreen({
  hasSavedCareer,
  savedCareerLabel,
  showOpeningBrief,
  onStartNewCareer,
  onContinueCareer,
  onOpenAccessibility,
  onBackToTitle,
  onOpenSettings,
}: NewGameWelcomeScreenProps) {
  const t = useCopy();
  const wide = useLayoutMode() === 'twoColumn';

  const masthead = showOpeningBrief ? (
    <>
      <View className="flex-row items-start justify-between">
        {/* Club crest — a tilted enamel sticker on the chalkboard stage */}
        <View className="relative h-14 w-14 -rotate-2 items-center justify-center overflow-hidden border-2 border-ink bg-paper">
          <View pointerEvents="none" className="absolute left-0 right-0 top-0 h-1.5 bg-white" />
          <View pointerEvents="none" className="absolute bottom-0 left-0 right-0 h-1.5 bg-paper-dark" />
          <Text className="font-pixel text-2xl text-ink">HF</Text>
        </View>
        {/* Board stamp — full red tint, hand-applied tilt */}
        <View className="rotate-2 border-2 border-b-4 border-red bg-red-light/30 px-3 py-1.5">
          <Text className="font-pixel text-sm uppercase text-red-light">{t('newGameWelcome.boardApproved')}</Text>
        </View>
      </View>

      <Text className={wide
        ? 'mt-9 font-pixel text-sm uppercase tracking-[4px] text-gold-light'
        : 'mt-6 font-pixel text-xs uppercase tracking-[3px] text-gold-light'}
      >
        {t('newGameWelcome.aClubInCrisis')}</Text>

      <View className="mt-3 gap-1">
        <MastheadLine text="THE KEYS" wide={wide} />
        <MastheadLine text="ARE YOURS." wide={wide} />
        <MastheadLine text="MAKE THEM" wide={wide} />
        <StickerWord text="HEROES." wide={wide} />
      </View>

      <Text className={wide
        ? 'mt-6 max-w-lg font-mono text-base uppercase leading-7 text-paper/80'
        : 'mt-4 max-w-sm font-mono text-sm uppercase leading-5 text-paper/80'}
      >
        A tiny ground. A nervous board. One blank registration card with your name waiting.
        Build the club they will talk about for decades.
      </Text>
    </>
  ) : hasSavedCareer ? (
    <>
      <View className="flex-row items-start justify-between">
        <View className="relative h-14 w-14 rotate-1 items-center justify-center overflow-hidden border-2 border-ink bg-paper">
          <View pointerEvents="none" className="absolute left-0 right-0 top-0 h-1.5 bg-white" />
          <View pointerEvents="none" className="absolute bottom-0 left-0 right-0 h-1.5 bg-paper-dark" />
          <Text className="font-pixel text-2xl text-ink">HF</Text>
        </View>
        <View className="-rotate-2 border-2 border-b-4 border-pitch-light bg-pitch-light/25 px-3 py-1.5">
          <Text className="font-pixel text-sm uppercase text-pitch-light">{t('newGameWelcome.fileReady')}</Text>
        </View>
      </View>

      <Text className={wide
        ? 'mt-9 font-pixel text-sm uppercase tracking-[4px] text-gold-light'
        : 'mt-6 font-pixel text-xs uppercase tracking-[3px] text-gold-light'}
      >
        {t('newGameWelcome.theTouchlineKeptYourCoat')}</Text>

      <View className="mt-3 gap-1">
        <MastheadLine text="WELCOME" wide={wide} />
        <StickerWord text="BACK." wide={wide} />
      </View>

      <Text className={wide
        ? 'mt-6 max-w-lg font-mono text-base uppercase leading-7 text-paper/80'
        : 'mt-4 max-w-sm font-mono text-sm uppercase leading-5 text-paper/80'}
      >
        The squad has been pretending not to watch the clock. Your club is exactly where you left it.
      </Text>
    </>
  ) : null;

  const dossier = showOpeningBrief ? (
    <View className={wide ? 'pt-2' : 'my-7'}>
      <View className="relative mt-24">
        {/* A squad member peeks over the dossier; the panel is drawn after and
            covers the sprite's lower half, so only head and shoulders show. */}
        <View pointerEvents="none" className="absolute -top-[104px] right-5">
          <PixelPortrait playerId="welcome-brief-squad" role="FWD" expression="joy" />
        </View>
        <PaperPanel kicker="Incoming file" title="Week one brief" stamp="Urgent">
          <View className="gap-3">
            <BriefRow index="01" title="Meet the squad" note="Fifteen players. Two open shirts. Zero heroes." />
            <View className="h-0.5 bg-ink/15" />
            <BriefRow index="02" title="Survive the books" note="Every ticket, wage, and training point matters." />
            <View className="h-0.5 bg-ink/15" />
            <BriefRow index="03" title="First match" note="No powers. Just eleven players and a before-picture.">
              <View className="mt-2 flex-row">
                <StatusChip label="2 empty licenses" tone="hero" />
              </View>
            </BriefRow>
          </View>
        </PaperPanel>
      </View>
    </View>
  ) : hasSavedCareer ? (
    <View className={wide ? 'pt-2' : 'my-5'}>
      <View className="border-2 border-ink bg-white p-4">
        <View className="flex-row items-center justify-between gap-3">
          <View className="flex-1">
            <Text className="font-pixel text-xs uppercase tracking-[2px] text-red-dark">{t('newGameWelcome.savedCareer')}</Text>
            <Text className="mt-1 font-pixel text-lg uppercase text-ink">
              {savedCareerLabel ?? 'Club file ready'}
            </Text>
          </View>
          <StatusChip label="Verified" tone="success" />
        </View>
        <View className="mt-3 border-t-2 border-ink/15 pt-3">
          <Text className="text-sm leading-4 text-ink/65">
            Bert is on duty. The inbox will surface the three things worth your attention.
          </Text>
        </View>
      </View>
    </View>
  ) : null;

  const entranceChoices = (
    <View className="gap-3">
      {hasSavedCareer && onContinueCareer ? (
        <ActionButton
          label={savedCareerLabel ? `Continue · ${savedCareerLabel}` : 'Continue career'}
          accessibilityLabel={t('newGameWelcome.a11y.continueSavedCareer')}
          onPress={onContinueCareer}
          variant="paper"
        />
      ) : null}
      <ActionButton
        label={hasSavedCareer ? 'Start over · erase save' : 'Take the keys  ▸'}
        accessibilityLabel={hasSavedCareer ? 'Replace saved career' : 'Start a new career'}
        onPress={onStartNewCareer}
        variant={hasSavedCareer ? 'danger' : 'hero'}
        // Starting a fresh file is navigation, not the successful signing yet.
        // The 1.67s positive cue followed us onto player creation and overlapped
        // its first tap, making Chairman (but not a later Cozy tap) sound twice.
        pressSfx={hasSavedCareer ? 'danger' : 'click'}
      />
      {onOpenAccessibility ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('newGameWelcome.a11y.openAccessibilitySettings')}
          onPress={onOpenAccessibility}
          className="min-h-11 items-center justify-center"
          style={({ pressed }) => ({ opacity: pressed ? 0.65 : undefined })}
        >
          <PixelText className="text-sm uppercase tracking-widest text-paper/75">{t('newGameWelcome.accessibilityControls')}</PixelText>
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-pitch-ink" edges={['top', 'left', 'right', 'bottom']}>
      <ChalkboardBackdrop wide={wide} />
      <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1 }}>
        <View className={wide
          ? 'w-full max-w-[1180px] flex-1 self-center px-10 pb-8 pt-8'
          : 'flex-1 px-5 pb-4 pt-6'}
        >
          <View className="mb-5 flex-row items-center justify-between">
            {onBackToTitle ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('newGameWelcome.a11y.backToTitle')}
                onPress={onBackToTitle}
                className="min-h-11 justify-center"
                style={({ pressed }) => ({ opacity: pressed ? 0.65 : undefined })}
              >
                <Text className="font-pixel text-sm uppercase tracking-[2px] text-paper/75">{t('newGameWelcome.title')}</Text>
              </Pressable>
            ) : <View />}
            <SettingsButton onPress={onOpenSettings} />
          </View>

          {wide ? (
            <View className="flex-row items-start justify-between gap-16">
              <View className="w-[52%] max-w-[620px]">{masthead}</View>
              <View className="w-[430px]">
                {dossier}
                <View className="mt-4">{entranceChoices}</View>
              </View>
            </View>
          ) : (
            <>
              {masthead}
              {dossier}
            </>
          )}
        </View>
      </ScrollView>

      {/* The entrance choice is pinned on phones: on a short screen the brief
          scrolls, but the button that starts the game is never below the fold. */}
      {wide ? null : (
        <View className="border-t-[6px] border-white bg-ink/25 px-5 pb-2 pt-3">
          {entranceChoices}
        </View>
      )}
    </SafeAreaView>
  );
}
