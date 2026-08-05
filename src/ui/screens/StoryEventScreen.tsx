import { useEffect, useRef } from 'react';
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

export interface StoryEventScreenProps {
  viewModel: StoryEventViewModel;
  onChoose: (choiceId: string) => void;
  onSelectPlayer?: () => void;
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
  const resolved = Boolean(viewModel.resolvedChoiceId && viewModel.outcomeText);
  const needsPlayer = viewModel.playerSelectionRequired && !viewModel.selectedPlayer;
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
          className="flex-1"
        >
          {riskySuccess ? <EventPixelConfetti progress={rewardReveal} reduceMotion={reduceMotion} /> : null}
          <View className="absolute right-4 top-4"><SettingsButton onPress={onOpenSettings} variant="match" /></View>
          <ScrollView
            bounces={false}
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end', padding: 16, paddingTop: 72 }}
            showsVerticalScrollIndicator={false}
          >
            <Animated.View
              className={panelClass}
              style={{
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
                    No bonus earned
                  </PixelText>
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
          <Text className="font-pixel text-xs uppercase tracking-[2px] text-red-light">Story interruption</Text>
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
          className="h-64 justify-end border-y-[3px] border-ink"
        >
          <View className="bg-ink/85 px-5 py-4">
            <Text className="font-pixel text-xs uppercase tracking-[2px] text-gold">{viewModel.categoryLabel}</Text>
            <Text className="mt-2 font-pixel text-2xl uppercase leading-8 text-paper">{viewModel.title}</Text>
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
          <Text className="text-ink/70" style={scaledBody(textScale)}>{viewModel.body}</Text>
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
              <Text className="mb-2 font-pixel text-xs uppercase tracking-[2px] text-gold-light">Player involved</Text>
              <Pressable
                accessibilityRole={onSelectPlayer ? 'button' : 'text'}
                accessibilityLabel={viewModel.selectedPlayer ? `Selected player ${viewModel.selectedPlayer.name}` : 'Choose a player for this event'}
                disabled={!onSelectPlayer || resolved}
                onPress={onSelectPlayer}
                className={viewModel.selectedPlayer ? 'min-h-14 flex-row items-center border-2 border-gold bg-gold-light p-3' : 'min-h-14 items-center justify-center border-2 border-dashed border-ink/40 bg-white p-3'}
              >
                {viewModel.selectedPlayer ? (
                  <>
                    <View className="mr-3 h-10 w-10 items-center justify-center border-2 border-ink bg-paper"><Text className="font-pixel text-sm text-ink">{viewModel.selectedPlayer.role}</Text></View>
                    <View className="flex-1"><PixelText className="text-base uppercase text-ink">{viewModel.selectedPlayer.name}</PixelText><Text className="mt-1 text-sm text-ink/60">{viewModel.selectedPlayer.detail}</Text></View>
                    {viewModel.selectedPlayer.powerName ? <StatusChip label={viewModel.selectedPlayer.powerName} tone="hero" /> : null}
                  </>
                ) : <PixelText className="text-base uppercase text-ink">+ Choose player</PixelText>}
              </Pressable>
            </View>
          ) : null}

          <View className="mt-6 gap-3">
              <Text className="font-pixel text-xs uppercase tracking-[2px] text-gold-light">Your call</Text>
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
                      <View className="flex-row items-center justify-between gap-2"><PixelText className="flex-1 text-base uppercase text-ink">{choice.label}</PixelText><StatusChip label={choice.tone} tone={choice.tone === 'risky' ? 'danger' : 'info'} /></View>
                      <Text className="mt-1 text-sm leading-5 text-ink/60">{choice.detail}</Text>
                      <Text className={choice.disabledReason ? 'mt-2 text-sm font-bold text-stamp' : choice.tone === 'risky' ? 'mt-2 text-sm font-bold text-stamp' : 'mt-2 text-sm font-bold text-blue-dark'}>{choice.disabledReason ?? choice.consequenceHint}</Text>
                    </View>
                  </Pressable>
                );
              })}
              {needsPlayer ? <PixelText className="text-center text-sm uppercase tracking-wide text-red-light">Choose a player before making this call</PixelText> : null}
            </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
