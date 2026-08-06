import { useEffect, useRef, useState } from 'react';
import { Animated, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { playEventSuccessSfx, playManagementActionSfx } from '../../render/management-sfx';
import { playManagementHaptic } from '../../render/haptics';
import { ActionButton, PaperPanel, StatusChip } from '../components/Scorecard';
import { EventArtwork } from '../components/EventArtwork';
import { SfxPressable as Pressable } from '../components/SfxPressable';
import { SettingsButton } from '../SettingsOverlay';
import type { StoryEventChoiceViewModel, StoryEventViewModel } from '../models';
import { scaledBody } from '../text-scale';
import type { TextScale } from '../../persistence';
import { PixelText } from '../components/PixelText';
import { EventPixelConfetti, EventRewardArt } from '../components/EventRewardArt';
import { useCopy } from '../../i18n';

export interface StoryEventScreenProps {
  viewModel: StoryEventViewModel;
  onChoose: (choiceId: string) => void;
  onSelectPlayer?: (playerId: string) => void;
  onContinue: () => void;
  onOpenSettings: () => void;
  reduceMotion?: boolean;
  guideCopy?: { title: string; body: string };
  textScale?: TextScale;
}

/**
 * Both calls are coloured, not just the dangerous one.
 *
 * A pastel-red card beside a white one reads as one option and one blank,
 * so the eye lands on the gamble by default and the guaranteed reward looks
 * like the absence of a choice. Blue is the game's safe colour everywhere
 * else — the guaranteed line under this card is already `text-blue-dark` —
 * so the fill just finishes a pairing the copy had already made. A disabled
 * call keeps the blank card: it is not an option, so it should not be one of
 * the two colours that mean "pick me".
 */
function choiceClass(choice: StoryEventChoiceViewModel): string {
  if (choice.disabled) return 'border-ink/20 bg-white opacity-40';
  return choice.tone === 'risky' ? 'border-stamp bg-red-light' : 'border-blue-dark bg-blue-light';
}

export function StoryEventScreen({
  viewModel,
  onChoose,
  onSelectPlayer,
  onContinue,
  onOpenSettings,
  reduceMotion = false,
  guideCopy,
  textScale = 1,
}: StoryEventScreenProps) {
  const t = useCopy();
  const resolved = Boolean(viewModel.resolvedChoiceId && viewModel.outcomeText);
  const needsPlayer = viewModel.playerSelectionRequired && !viewModel.selectedPlayer;
  const [pickerOpen, setPickerOpen] = useState(false);
  /**
   * What the cards laid over the artwork actually take up, so the stage objects
   * can sit above them instead of behind them. Measured rather than guessed:
   * both cards grow with their copy, and the outcome card grows with its
   * rewards.
   */
  const [outcomeCardHeight, setOutcomeCardHeight] = useState(0);
  const [titleBandHeight, setTitleBandHeight] = useState(0);
  /**
   * A locked card is read-only: the manager already answered for this player in
   * the chapter that opened the story. A resolved one is history.
   */
  const pickerAvailable = onSelectPlayer !== undefined
    && !resolved
    && viewModel.playerLocked !== true
    && viewModel.playerChoices.length > 0;
  const reveal = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const rewardReveal = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const playedOutcomeKey = useRef<string | null>(null);
  const outcomeKey = !resolved
    ? null
    : `${viewModel.id}:${viewModel.resolvedChoiceId ?? 'resolved'}`;
  const riskySuccess = viewModel.resolvedRisky === true && viewModel.resolvedSuccess === true;
  const riskyFailure = viewModel.resolvedRisky === true && viewModel.resolvedSuccess !== true;

  useEffect(() => {
    if (outcomeKey === null) return undefined;
    if (playedOutcomeKey.current !== outcomeKey) {
      playedOutcomeKey.current = outcomeKey;
      if (riskySuccess) {
        playEventSuccessSfx();
        playManagementHaptic('success');
      } else if (riskyFailure) {
        playManagementActionSfx('warning');
        playManagementHaptic('warning');
      } else {
        playManagementActionSfx('card');
        playManagementHaptic('select');
      }
    }
    if (reduceMotion) {
      reveal.setValue(1);
      rewardReveal.setValue(1);
      return undefined;
    }
    reveal.setValue(0);
    rewardReveal.setValue(0);
    const animation = Animated.parallel([
      Animated.spring(reveal, {
        toValue: 1,
        damping: 10,
        stiffness: 120,
        mass: 0.7,
        useNativeDriver: true,
      }),
      Animated.spring(rewardReveal, {
        toValue: 1,
        delay: 180,
        damping: 9,
        stiffness: 150,
        mass: 0.65,
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [outcomeKey, reduceMotion, reveal, rewardReveal, riskyFailure, riskySuccess]);

  if (resolved) {
    const rewards = viewModel.outcomeRewards ?? [];
    const headline = riskySuccess
      ? viewModel.successCutscene?.headline ?? viewModel.outcomeTitle ?? 'The risk paid off'
      : riskyFailure
        ? 'No bonus this time'
        : viewModel.outcomeTitle ?? 'Decision complete';
    const kicker = riskySuccess
      ? 'RISK PAID OFF'
      : riskyFailure
        ? 'RISK MISSED'
        : 'GUARANTEED RESULT';
    const panelClass = riskySuccess
      ? 'w-full max-w-[600px] self-center border-[3px] border-b-[7px] border-gold bg-ink/95 px-5 pb-5 pt-4'
      : riskyFailure
        ? 'w-full max-w-[600px] self-center border-[3px] border-b-[7px] border-red-dark bg-paper px-5 pb-5 pt-4'
        : 'w-full max-w-[600px] self-center border-[3px] border-b-[7px] border-blue-dark bg-paper px-5 pb-5 pt-4';
    return (
      <SafeAreaView className="flex-1 bg-pitch-ink" edges={['top', 'left', 'right', 'bottom']}>
        <EventArtwork
          artKey={riskySuccess ? `${viewModel.artKey}-success` : viewModel.artKey}
          category={viewModel.category}
          success={riskySuccess}
          reduceMotion={reduceMotion}
          sceneLayout="stage"
          // Plus the ScrollView's own bottom padding, which is part of what the
          // card occupies at the foot of the picture.
          sceneBottomInset={outcomeCardHeight === 0 ? 0 : outcomeCardHeight + 16}
          className="flex-1"
        >
          {riskySuccess ? <EventPixelConfetti progress={rewardReveal} reduceMotion={reduceMotion} /> : null}
          <View className="absolute right-4 top-4"><SettingsButton onPress={onOpenSettings} variant="match" /></View>
          <ScrollView
            bounces={false}
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end', padding: 16, paddingTop: 72 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Style-only wrapper. NativeWind silently drops `className` on an
                Animated view, which is why this panel had no paper, no border
                and no 600pt cap on a desktop — the outcome text, the red bar
                and the continue button all ran the full width of the screen.
                The classes live on the plain View inside. */}
            <Animated.View
              onLayout={event => setOutcomeCardHeight(event.nativeEvent.layout.height)}
              style={{
                width: '100%',
                maxWidth: 600,
                alignSelf: 'center',
                opacity: reveal,
                transform: [{
                  translateY: reveal.interpolate({
                    inputRange: [0, 1],
                    outputRange: [28, 0],
                    extrapolate: 'clamp',
                  }),
                }],
              }}
            >
              <View className={panelClass}>
              <Text className={riskySuccess
                ? 'font-pixel text-xs uppercase tracking-[3px] text-gold'
                : riskyFailure
                  ? 'font-pixel text-xs uppercase tracking-[3px] text-red-dark'
                  : 'font-pixel text-xs uppercase tracking-[3px] text-blue-dark'}>
                {kicker}
              </Text>
              <Text className={riskySuccess
                ? 'mt-2 font-pixel text-2xl uppercase leading-8 text-paper'
                : 'mt-2 font-pixel text-2xl uppercase leading-8 text-ink'}>
                {headline}
              </Text>
              <Text
                className={riskySuccess ? 'mt-3 text-paper/80' : 'mt-3 text-ink/75'}
                style={scaledBody(textScale)}
              >
                {viewModel.outcomeText}
              </Text>

              {riskyFailure ? (
                <View className="mt-4 border-2 border-red-dark bg-red-light px-4 py-3">
                  <PixelText className="text-center text-lg uppercase text-red-dark">
                    {t('storyEvent.noBonusEarned')}</PixelText>
                </View>
              ) : null}

              {rewards.length > 0 ? (
                <View className="mt-4 flex-row flex-wrap gap-3">
                  {rewards.map((reward, index) => (
                    <EventRewardArt
                      key={`${reward.kind}:${reward.label}`}
                      reward={reward}
                      index={index}
                      celebrate={riskySuccess}
                      reduceMotion={reduceMotion}
                    />
                  ))}
                </View>
              ) : null}

              <View className="mt-5">
                <ActionButton
                  label={viewModel.outcomeHasFollowUp ? 'Continue the story  ▸' : 'Return to the office  ▸'}
                  accessibilityLabel={viewModel.outcomeHasFollowUp
                    ? 'Continue to the follow-up story event'
                    : 'Continue after the story event result'}
                  onPress={onContinue}
                />
              </View>
              </View>
            </Animated.View>
          </ScrollView>
        </EventArtwork>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-pitch-ink" edges={['top', 'left', 'right', 'bottom']}>
      <View className="flex-row items-center justify-between px-4 py-3">
        <View>
          <Text className="font-pixel text-xs uppercase tracking-[2px] text-red-light">{t('storyEvent.storyInterruption')}</Text>
          <Text className="mt-1 font-pixel text-base uppercase text-white">{viewModel.categoryLabel}</Text>
        </View>
        <View className="flex-row items-center gap-2">
          <StatusChip label={viewModel.weekLabel} tone="danger" />
          <SettingsButton onPress={onOpenSettings} />
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 28 }}>
        <EventArtwork
          artKey={viewModel.artKey}
          category={viewModel.category}
          reduceMotion={reduceMotion}
          sceneLayout="stage"
          sceneBottomInset={titleBandHeight}
          className="h-64 justify-end border-y-[3px] border-ink"
        >
          <View
            onLayout={event => setTitleBandHeight(event.nativeEvent.layout.height)}
            className="bg-ink/85 px-5 py-4"
          >
            <Text className="font-pixel text-xs uppercase tracking-[2px] text-gold">{viewModel.categoryLabel}</Text>
            {/* Resolved from the event's own content id, so the story reads in the
                    player's language. The view model still carries the English
                    for anything that has not been translated yet. */}
            <Text className="mt-2 font-pixel text-2xl uppercase leading-8 text-paper">{t(`event.${viewModel.id}.title`)}</Text>
          </View>
        </EventArtwork>

        {/* The report is the dark band's own text — the band gives the story a
            name, this gives it the facts — so the two are one block: full-bleed
            like the band, with the band's bottom rule serving as the report's
            top edge instead of a second line 16px below it.
            Not "Something needs your call" — the choices below are already
            headed "Your call", and a panel title that repeats the next
            heading spends a line saying nothing. */}
        <PaperPanel
          kicker="Club report"
          title="What happened"
          className="border-x-0 border-t-0"
        >
          <Text className="text-ink/70" style={scaledBody(textScale)}>{t(`event.${viewModel.id}.body`)}</Text>
        </PaperPanel>

        <View className="w-full max-w-[720px] self-center p-4">
          {/* Bert's rules card follows the facts rather than preceding them: it
              explains safe-versus-risky, which is the decision immediately
              below, and moving it here keeps the report flush with the band
              whether or not this is the career's first interruption. */}
          {guideCopy ? (
            <PaperPanel kicker="Bert Rudge" title={guideCopy.title} stamp="No power effect">
              <Text className="text-ink/70" style={scaledBody(textScale)}>{guideCopy.body}</Text>
            </PaperPanel>
          ) : null}

          {viewModel.playerSelectionRequired || viewModel.selectedPlayer ? (
            <View className="mt-5">
              <Text className="mb-2 font-pixel text-xs uppercase tracking-[2px] text-gold-light">{t('storyEvent.playerInvolved')}</Text>
              <Pressable
                accessibilityRole={pickerAvailable ? 'button' : 'text'}
                accessibilityLabel={viewModel.selectedPlayer
                  ? `${viewModel.selectedPlayer.name}, ${viewModel.selectedPlayer.role}, overall ${viewModel.selectedPlayer.overall}. ${
                    viewModel.playerLocked === true
                      ? 'Chosen earlier in this story.'
                      : pickerOpen ? 'Close the squad list.' : 'Open the squad list to change.'
                  }`
                  : 'Choose a player for this event'}
                disabled={!pickerAvailable}
                onPress={() => setPickerOpen(open => !open)}
                className={viewModel.selectedPlayer ? 'min-h-14 flex-row items-center border-2 border-gold bg-gold-light p-3' : 'min-h-14 items-center justify-center border-2 border-dashed border-ink/40 bg-white p-3'}
              >
                {viewModel.selectedPlayer ? (
                  <>
                    <View className="mr-3 h-10 w-10 items-center justify-center border-2 border-ink bg-paper"><Text className="font-pixel text-sm text-ink">{viewModel.selectedPlayer.role}</Text></View>
                    <View className="flex-1"><PixelText className="text-base uppercase text-ink">{viewModel.selectedPlayer.name}</PixelText><Text className="mt-1 text-sm text-ink/60">{viewModel.selectedPlayer.detail}</Text></View>
                    {viewModel.selectedPlayer.powerName ? <StatusChip label={viewModel.selectedPlayer.powerName} tone="hero" /> : null}
                    <Text className="ml-3 font-mono text-xl text-ink">{viewModel.selectedPlayer.overall}</Text>
                  </>
                ) : <PixelText className="text-base uppercase text-ink">{t('storyEvent.choosePlayer')}</PixelText>}
              </Pressable>
              {/* The stats the call actually turns on. The card used to say
                  only "Starting XI", so a manager deciding whether to sell a
                  player was told his squad status and nothing else. */}
              {viewModel.selectedPlayer?.attributes === undefined ? null : (
                <View className="mt-2 flex-row flex-wrap gap-1.5 border-2 border-gold/60 bg-paper p-2">
                  {viewModel.selectedPlayer.attributes.map(attribute => (
                    <View key={attribute.label} className="min-w-[22%] flex-1 border border-ink/20 bg-white px-2 py-1">
                      <PixelText className="text-sm uppercase text-ink/50">{attribute.label}</PixelText>
                      <Text className="mt-0.5 font-mono text-base text-ink">{attribute.value}</Text>
                    </View>
                  ))}
                </View>
              )}
              {!pickerOpen || viewModel.playerChoices.length === 0 ? null : (
                <View className="mt-2 border-2 border-ink bg-white">
                  {viewModel.playerChoices.map(candidate => (
                    <Pressable
                      key={candidate.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: candidate.id === viewModel.selectedPlayer?.id }}
                      accessibilityLabel={`${candidate.name}, ${candidate.role}, overall ${candidate.overall}, ${candidate.detail}`}
                      onPress={() => {
                        onSelectPlayer?.(candidate.id);
                        setPickerOpen(false);
                      }}
                      className={candidate.id === viewModel.selectedPlayer?.id
                        ? 'min-h-12 flex-row items-center gap-3 border-b border-ink/15 bg-gold-light px-3 py-2'
                        : 'min-h-12 flex-row items-center gap-3 border-b border-ink/15 px-3 py-2'}
                    >
                      <View className="h-8 w-10 items-center justify-center border border-ink bg-paper">
                        <Text className="font-pixel text-sm text-ink">{candidate.role}</Text>
                      </View>
                      <View className="min-w-0 flex-1">
                        <Text className="text-base text-ink" numberOfLines={1}>{candidate.name}</Text>
                        <Text className="text-sm text-ink/50" numberOfLines={1}>{candidate.detail}</Text>
                      </View>
                      <Text className="font-mono text-base text-ink">{candidate.overall}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          ) : null}

          <View className="mt-6 gap-3">
              <Text className="font-pixel text-xs uppercase tracking-[2px] text-gold-light">{t('storyEvent.yourCall')}</Text>
              {viewModel.choices.map((choice, index) => {
                const disabled = Boolean(choice.disabled || needsPlayer);
                return (
                  <Pressable
                    key={choice.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${choice.label}. ${choice.detail}. ${choice.consequenceHint}`}
                    accessibilityState={{ disabled }}
                    disabled={disabled}
                    onPress={() => onChoose(choice.id)}
                    className={`min-h-20 flex-row items-center border-2 p-3 ${choiceClass(choice)}`}
                  >
                    <View className={choice.tone === 'risky' ? 'mr-3 h-10 w-10 items-center justify-center border-2 border-stamp' : 'mr-3 h-10 w-10 items-center justify-center border-2 border-blue-dark'}>
                      <Text className={choice.tone === 'risky' ? 'font-mono text-base text-stamp' : 'font-mono text-base text-blue-dark'}>{String(index + 1).padStart(2, '0')}</Text>
                    </View>
                    <View className="flex-1">
                      <View className="flex-row items-center justify-between gap-2"><PixelText className="flex-1 text-base uppercase text-ink">{t(`event.${viewModel.id}.${choice.id}.label`)}</PixelText><StatusChip label={choice.tone} tone={choice.tone === 'risky' ? 'danger' : 'info'} /></View>
                      <Text className="mt-1 text-sm leading-5 text-ink/60">{choice.detail}</Text>
                      <Text className={choice.disabledReason ? 'mt-2 text-sm font-bold text-stamp' : choice.tone === 'risky' ? 'mt-2 text-sm font-bold text-stamp' : 'mt-2 text-sm font-bold text-blue-dark'}>{choice.disabledReason ?? choice.consequenceHint}</Text>
                    </View>
                  </Pressable>
                );
              })}
              {needsPlayer ? <PixelText className="text-center text-sm uppercase tracking-wide text-red-light">{t('storyEvent.chooseAPlayerFirst')}</PixelText> : null}
            </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
