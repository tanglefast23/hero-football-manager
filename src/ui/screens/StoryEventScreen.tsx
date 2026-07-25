import { useEffect, useRef } from 'react';
import { Animated, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { playEventSuccessSfx } from '../../render/management-sfx';
import { playManagementHaptic } from '../../render/haptics';
import { ActionButton, PaperPanel, StatusChip } from '../components/Scorecard';
import { EventArtwork } from '../components/EventArtwork';
import { SfxPressable as Pressable } from '../components/SfxPressable';
import { SettingsButton } from '../SettingsOverlay';
import type { StoryEventChoiceViewModel, StoryEventViewModel } from '../models';
import { scaledBody } from '../text-scale';
import type { TextScale } from '../../persistence';
import { PixelText } from '../components/PixelText';

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

function choiceClass(choice: StoryEventChoiceViewModel): string {
  if (choice.disabled) return 'border-ink/20 bg-white opacity-40';
  return choice.tone === 'risky' ? 'border-stamp bg-red-100' : 'border-ink/30 bg-white';
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
  const playedSuccessKey = useRef<string | null>(null);
  const successKey = viewModel.successCutscene === undefined
    ? null
    : `${viewModel.id}:${viewModel.resolvedChoiceId ?? 'resolved'}`;

  useEffect(() => {
    if (successKey === null) return undefined;
    if (playedSuccessKey.current !== successKey) {
      playedSuccessKey.current = successKey;
      playEventSuccessSfx();
      playManagementHaptic('success');
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
  }, [reduceMotion, reveal, rewardReveal, successKey]);

  if (viewModel.successCutscene !== undefined) {
    const cutscene = viewModel.successCutscene;
    return (
      <SafeAreaView className="flex-1 bg-pitch-dark" edges={['top', 'left', 'right', 'bottom']}>
        <EventArtwork
          artKey={cutscene.artKey}
          category={viewModel.category}
          success
          reduceMotion={reduceMotion}
          className="flex-1 justify-end"
        >
          <View className="absolute right-4 top-4"><SettingsButton onPress={onOpenSettings} variant="match" /></View>
          <Animated.View
            className="w-full max-w-[560px] self-center border-[3px] border-gold bg-ink/95 px-5 pb-5 pt-4"
            style={{
              opacity: reveal,
              transform: [{ translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }],
            }}
          >
            <Text className="font-pixel text-xs uppercase tracking-[3px] text-gold">Risky success</Text>
            <Text className="mt-2 font-pixel text-2xl uppercase leading-8 text-paper">{cutscene.headline}</Text>
            <Text className="mt-3 text-paper/80" style={scaledBody(textScale)}>{viewModel.outcomeText}</Text>
            <Animated.View
              className="mt-4"
              style={{
                opacity: rewardReveal,
                transform: [
                  { translateY: rewardReveal.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
                  { scale: rewardReveal.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
                ],
              }}
            >
              <View className="flex-row flex-wrap gap-2">
                {cutscene.rewards.length === 0
                  ? <StatusChip label="Club story secured" tone="success" />
                  : cutscene.rewards.map(reward => <StatusChip key={reward} label={reward} tone="success" />)}
              </View>
            </Animated.View>
            <View className="mt-5">
              <ActionButton
                label={cutscene.hasFollowUp ? 'Continue the story  ▸' : 'Return to the office  ▸'}
                accessibilityLabel={cutscene.hasFollowUp ? 'Continue to the follow-up story event' : 'Continue after the successful story event'}
                onPress={onContinue}
              />
            </View>
          </Animated.View>
        </EventArtwork>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-pitch-dark" edges={['top', 'left', 'right', 'bottom']}>
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

        <View className="w-full max-w-[720px] self-center p-4">
          {guideCopy ? (
            <PaperPanel kicker="Bert Rudge" title={guideCopy.title} stamp="No power effect">
              <Text className="text-ink/70" style={scaledBody(textScale)}>{guideCopy.body}</Text>
            </PaperPanel>
          ) : null}
          <PaperPanel kicker="Club report" title="Something needs your call" stamp="One shot" className="mt-4">
            <Text className="text-ink/70" style={scaledBody(textScale)}>{viewModel.body}</Text>
          </PaperPanel>

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

          {!resolved ? (
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
                    <View className={choice.tone === 'risky' ? 'mr-3 h-10 w-10 items-center justify-center border-2 border-stamp' : 'mr-3 h-10 w-10 items-center justify-center border-2 border-ink/40'}>
                      <Text className={choice.tone === 'risky' ? 'font-mono text-base text-stamp' : 'font-mono text-base text-ink'}>{String(index + 1).padStart(2, '0')}</Text>
                    </View>
                    <View className="flex-1">
                      <View className="flex-row items-center justify-between gap-2"><PixelText className="flex-1 text-base uppercase text-ink">{choice.label}</PixelText><StatusChip label={choice.tone} tone={choice.tone === 'risky' ? 'danger' : 'normal'} /></View>
                      <Text className="mt-1 text-sm leading-5 text-ink/60">{choice.detail}</Text>
                      <Text className={choice.disabledReason ? 'mt-2 text-sm font-bold text-stamp' : choice.tone === 'risky' ? 'mt-2 text-sm font-bold text-stamp' : 'mt-2 text-sm font-bold text-blue-dark'}>{choice.disabledReason ?? choice.consequenceHint}</Text>
                    </View>
                  </Pressable>
                );
              })}
              {needsPlayer ? <PixelText className="text-center text-sm uppercase tracking-wide text-red-light">Choose a player before making this call</PixelText> : null}
            </View>
          ) : (
            <PaperPanel kicker="Incident outcome" title={viewModel.outcomeTitle ?? 'Decision resolved'} stamp="Resolved" className="mt-6 bg-signal">
              <Text className="text-base leading-6 text-ink">{viewModel.outcomeText}</Text>
            </PaperPanel>
          )}
        </View>
      </ScrollView>

      {resolved ? <View className="border-t-[6px] border-white bg-ink/25 p-3"><ActionButton label="Return to the office  ▸" accessibilityLabel="Continue after the story event" onPress={onContinue} /></View> : null}
    </SafeAreaView>
  );
}
