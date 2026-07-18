import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton, PaperPanel, StatusChip } from '../components/Scorecard';
import type { StoryEventChoiceViewModel, StoryEventViewModel } from '../models';

export interface StoryEventScreenProps {
  viewModel: StoryEventViewModel;
  onChoose: (choiceId: string) => void;
  onSelectPlayer?: () => void;
  onContinue: () => void;
}

function choiceClass(choice: StoryEventChoiceViewModel, resolvedChoiceId?: string): string {
  if (resolvedChoiceId === choice.id) return 'border-ink bg-signal';
  if (resolvedChoiceId || choice.disabled) return 'border-paper/20 bg-ink-soft opacity-40';
  if (choice.tone === 'risky') return 'border-stamp bg-red-100';
  return 'border-paper/30 bg-ink-soft';
}

export function StoryEventScreen({
  viewModel,
  onChoose,
  onSelectPlayer,
  onContinue,
}: StoryEventScreenProps) {
  const resolved = Boolean(viewModel.resolvedChoiceId && viewModel.outcomeText);
  const needsPlayer = viewModel.playerSelectionRequired && !viewModel.selectedPlayer;

  return (
    <SafeAreaView className="flex-1 bg-ink" edges={['top', 'left', 'right', 'bottom']}>
      <View className="flex-row items-center justify-between border-b-2 border-stamp bg-ink-soft px-4 py-3">
        <View>
          <Text className="text-xs font-bold uppercase tracking-[2px] text-stamp">Story interruption</Text>
          <Text className="mt-1 text-sm font-bold uppercase text-paper">{viewModel.categoryLabel}</Text>
        </View>
        <StatusChip label={viewModel.weekLabel} tone="danger" />
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
        <View className="items-center py-3">
          <View className="h-28 w-28 items-center justify-center border-2 border-stamp bg-ink-soft">
            <View className="absolute h-px w-24 rotate-45 bg-stamp" />
            <View className="absolute h-px w-24 -rotate-45 bg-stamp" />
            <View className="absolute h-px w-24 rotate-12 bg-stamp" />
            <View className="absolute h-px w-24 -rotate-12 bg-stamp" />
            <View className="h-12 w-9 items-center justify-center rounded-full border-2 border-paper bg-stamp">
              <View className="h-3 w-3 rounded-full bg-ink" />
            </View>
          </View>
          <Text className="mt-4 text-center text-2xl font-bold uppercase leading-7 tracking-wide text-paper">
            {viewModel.title}
          </Text>
          <View className="mt-3 -rotate-2 border-2 border-stamp px-3 py-2">
            <Text className="text-xs font-bold uppercase tracking-[2px] text-stamp">Giant spider on the pitch</Text>
          </View>
        </View>

        <PaperPanel kicker="Groundskeeper report" title="This is not in the handbook" stamp="Unverified">
          <Text className="text-sm leading-5 text-ink/70">{viewModel.body}</Text>
        </PaperPanel>

        {viewModel.playerSelectionRequired || viewModel.selectedPlayer ? (
          <View className="mt-5">
            <Text className="mb-2 text-xs font-bold uppercase tracking-[2px] text-sky">Player involved</Text>
            <Pressable
              accessibilityRole={onSelectPlayer ? 'button' : 'text'}
              accessibilityLabel={viewModel.selectedPlayer ? `Selected player ${viewModel.selectedPlayer.name}` : 'Choose a player for this event'}
              disabled={!onSelectPlayer || resolved}
              onPress={onSelectPlayer}
              className={viewModel.selectedPlayer ? 'min-h-14 flex-row items-center border-2 border-amber-500 bg-amber-100 p-3' : 'min-h-14 items-center justify-center border-2 border-dashed border-paper/40 bg-ink-soft p-3'}
              style={({ pressed }) => ({ opacity: pressed ? 0.68 : undefined })}
            >
              {viewModel.selectedPlayer ? (
                <>
                  <View className="mr-3 h-10 w-10 items-center justify-center border-2 border-ink bg-paper">
                    <Text className="font-mono text-xs font-bold text-ink">{viewModel.selectedPlayer.role}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-bold uppercase text-ink">{viewModel.selectedPlayer.name}</Text>
                    <Text className="mt-1 text-xs text-ink/60">{viewModel.selectedPlayer.detail}</Text>
                  </View>
                  {viewModel.selectedPlayer.powerName ? <StatusChip label={viewModel.selectedPlayer.powerName} tone="hero" /> : null}
                </>
              ) : (
                <Text className="text-sm font-bold uppercase tracking-widest text-paper">+ Choose player</Text>
              )}
            </Pressable>
          </View>
        ) : null}

        {!resolved ? (
          <View className="mt-6 gap-3">
            <Text className="text-xs font-bold uppercase tracking-[2px] text-sky">Your call</Text>
            {viewModel.choices.map((choice, index) => {
              const disabled = Boolean(viewModel.resolvedChoiceId || choice.disabled || needsPlayer);
              return (
                <Pressable
                  key={choice.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${choice.label}. ${choice.detail}. ${choice.consequenceHint}`}
                  accessibilityState={{ disabled }}
                  disabled={disabled}
                  onPress={() => onChoose(choice.id)}
                  className={`min-h-20 flex-row items-center border-2 p-3 ${choiceClass(choice, viewModel.resolvedChoiceId)}`}
                  style={({ pressed }) => ({ opacity: pressed ? 0.68 : undefined })}
                >
                  <View className={choice.tone === 'risky' ? 'mr-3 h-10 w-10 items-center justify-center border-2 border-stamp' : 'mr-3 h-10 w-10 items-center justify-center border-2 border-paper/40'}>
                    <Text className={choice.tone === 'risky' ? 'font-mono text-sm font-bold text-stamp' : 'font-mono text-sm font-bold text-paper'}>
                      {String(index + 1).padStart(2, '0')}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center justify-between gap-2">
                      <Text className={choice.tone === 'risky' ? 'flex-1 text-sm font-bold uppercase text-ink' : 'flex-1 text-sm font-bold uppercase text-paper'}>{choice.label}</Text>
                      <StatusChip label={choice.tone} tone={choice.tone === 'risky' ? 'danger' : 'normal'} />
                    </View>
                    <Text className={choice.tone === 'risky' ? 'mt-1 text-xs leading-4 text-ink/60' : 'mt-1 text-xs leading-4 text-paper/55'}>{choice.detail}</Text>
                    <Text className={choice.tone === 'risky' ? 'mt-2 text-xs font-bold text-stamp' : 'mt-2 text-xs font-bold text-sky'}>{choice.consequenceHint}</Text>
                  </View>
                </Pressable>
              );
            })}
            {needsPlayer ? (
              <Text className="text-center text-xs font-bold uppercase tracking-wide text-stamp">
                Choose a player before making this call
              </Text>
            ) : null}
          </View>
        ) : (
          <PaperPanel kicker="Incident outcome" title={viewModel.outcomeTitle ?? 'Decision resolved'} stamp="Filed" className="mt-6 bg-signal">
            <Text className="text-sm leading-5 text-ink">{viewModel.outcomeText}</Text>
          </PaperPanel>
        )}
      </ScrollView>

      {resolved ? (
        <View className="border-t-2 border-stamp bg-ink-soft p-3">
          <ActionButton
            label="Return to the office  ▸"
            accessibilityLabel="Continue after the story event"
            onPress={onContinue}
          />
        </View>
      ) : null}
    </SafeAreaView>
  );
}
