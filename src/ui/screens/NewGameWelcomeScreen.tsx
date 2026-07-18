import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton, PaperPanel, StatusChip } from '../components/Scorecard';

export interface NewGameWelcomeScreenProps {
  hasSavedCareer: boolean;
  savedCareerLabel?: string;
  onStartNewCareer: () => void;
  onContinueCareer?: () => void;
  onOpenAccessibility?: () => void;
}

export function NewGameWelcomeScreen({
  hasSavedCareer,
  savedCareerLabel,
  onStartNewCareer,
  onContinueCareer,
  onOpenAccessibility,
}: NewGameWelcomeScreenProps) {
  return (
    <SafeAreaView className="flex-1 bg-ink" edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 justify-between px-5 py-6">
          <View>
            <View className="mb-6 flex-row items-start justify-between">
              <View className="h-14 w-14 -rotate-2 items-center justify-center border-2 border-signal bg-ink-soft">
                <Text className="font-mono text-2xl font-bold text-signal">HF</Text>
              </View>
              <View className="rotate-2 border-2 border-stamp px-3 py-2">
                <Text className="text-xs font-bold uppercase tracking-[2px] text-stamp">Board approved</Text>
              </View>
            </View>

            <Text className="text-xs font-bold uppercase tracking-[3px] text-sky">A club in crisis</Text>
            <Text className="mt-3 text-2xl font-bold uppercase leading-7 tracking-wide text-paper">
              The keys are yours.{`\n`}Make them heroes.
            </Text>
            <Text className="mt-4 max-w-sm text-sm leading-5 text-paper/70">
              A tiny ground. A nervous board. One blank registration card with your name waiting.
              Build the club they will talk about for decades.
            </Text>
          </View>

          <PaperPanel kicker="Incoming file" title="Week one brief" stamp="Urgent" className="my-7">
            <View className="gap-3">
              <View className="flex-row gap-3">
                <Text className="font-mono text-sm font-bold text-stamp">01</Text>
                <View className="flex-1">
                  <Text className="text-sm font-bold uppercase text-ink">Meet the squad</Text>
                  <Text className="mt-1 text-xs leading-4 text-ink/60">Thirteen hopefuls. One empty shirt. Zero heroes.</Text>
                </View>
              </View>
              <View className="h-px bg-ink/20" />
              <View className="flex-row gap-3">
                <Text className="font-mono text-sm font-bold text-stamp">02</Text>
                <View className="flex-1">
                  <Text className="text-sm font-bold uppercase text-ink">Survive the books</Text>
                  <Text className="mt-1 text-xs leading-4 text-ink/60">Every ticket, wage, and training point matters.</Text>
                </View>
              </View>
              <View className="h-px bg-ink/20" />
              <View className="flex-row items-center justify-between gap-3">
                <View className="flex-1">
                  <Text className="text-sm font-bold uppercase text-ink">First match</Text>
                  <Text className="mt-1 text-xs leading-4 text-ink/60">No powers. Just eleven players and a before-picture.</Text>
                </View>
                <StatusChip label="2 empty licenses" tone="hero" />
              </View>
            </View>
          </PaperPanel>

          <View className="gap-3">
            {hasSavedCareer && onContinueCareer ? (
              <ActionButton
                label={savedCareerLabel ? `Continue · ${savedCareerLabel}` : 'Continue career'}
                accessibilityLabel="Continue saved career"
                onPress={onContinueCareer}
                variant="paper"
              />
            ) : null}
            <ActionButton
              label={hasSavedCareer ? 'Start over · erase save' : 'Take the keys  ▸'}
              accessibilityLabel={hasSavedCareer ? 'Replace saved career' : 'Start a new career'}
              onPress={onStartNewCareer}
            />
            {onOpenAccessibility ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open accessibility settings"
                onPress={onOpenAccessibility}
                className="min-h-11 items-center justify-center"
                style={({ pressed }) => ({ opacity: pressed ? 0.65 : undefined })}
              >
                <Text className="text-xs font-bold uppercase tracking-widest text-sky">Accessibility & controls</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
