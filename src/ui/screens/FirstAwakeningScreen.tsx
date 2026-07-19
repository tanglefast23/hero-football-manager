import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { OnboardingContent } from '../../content';
import type { OnboardingOrigin } from '../../game';
import { ActionButton, PaperPanel, StatusChip } from '../components/Scorecard';

export interface FirstAwakeningScreenProps {
  playerName: string;
  content: OnboardingContent;
  selectedOrigin?: OnboardingOrigin;
  powerName?: string;
  onChoose: (origin: OnboardingOrigin) => void;
  onContinue: () => void;
}

const ORIGIN_MARK: Record<OnboardingOrigin, string> = {
  CHEMICAL: 'H₂O?',
  CREATURE: 'BUG!',
  SERUM: 'RX??',
};

function fillName(copy: string, name: string): string {
  return copy.split('{name}').join(name);
}

export function FirstAwakeningScreen({
  playerName,
  content,
  selectedOrigin,
  powerName,
  onChoose,
  onContinue,
}: FirstAwakeningScreenProps) {
  const revealed = selectedOrigin !== undefined && powerName !== undefined;
  const selectedCopy = content.choices.find(choice => choice.origin === selectedOrigin);

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'left', 'right', 'bottom']}>
      <View className={revealed ? 'border-b-2 border-gold bg-white px-5 py-4' : 'border-b-2 border-stamp bg-white px-5 py-4'}>
        <Text className={revealed ? 'text-sm font-bold uppercase text-gold-dark' : 'text-sm font-bold uppercase text-stamp'}>
          Final whistle · incident report
        </Text>
        <Text className="mt-2 text-3xl font-bold uppercase leading-8 text-ink">
          {revealed ? 'That was no injury.' : `${playerName} is down.`}
        </Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
        <View className="items-center py-4">
          <View className={revealed ? 'h-36 w-36 rotate-3 items-center justify-center border-4 border-gold bg-stamp' : 'h-36 w-36 -rotate-2 items-center justify-center border-4 border-stamp bg-pitch'}>
            <View className="absolute h-1 w-44 rotate-45 bg-paper/70" />
            <View className="absolute h-1 w-44 -rotate-45 bg-paper/70" />
            <View className={revealed ? 'h-20 w-14 items-center justify-center border-4 border-paper bg-gold' : 'h-10 w-24 rotate-6 items-center justify-center border-4 border-paper bg-stamp'}>
              <Text className="font-mono text-2xl font-bold text-ink">{revealed ? '★' : '!!'}</Text>
            </View>
          </View>
          <View className={revealed ? 'mt-5 -rotate-2 border-2 border-gold bg-gold px-4 py-2' : 'mt-5 rotate-2 border-2 border-stamp px-4 py-2'}>
            <Text className={revealed ? 'text-sm font-bold uppercase text-ink' : 'text-sm font-bold uppercase text-stamp'}>
              {revealed ? 'Hero #1 confirmed' : 'Panic — then something fizzes'}
            </Text>
          </View>
        </View>

        {!revealed ? (
          <>
            <PaperPanel kicker="Pitch-side cut-in" title="Hold on…" stamp="Live">
              <Text className="text-base leading-6 text-ink/75">{fillName(content.collapse, playerName)}</Text>
            </PaperPanel>
            <Text className="mt-6 text-sm font-bold uppercase text-blue-dark">{content.prompt}</Text>
            <View className="mt-3 gap-3">
              {content.choices.map(choice => (
                <Pressable
                  key={choice.origin}
                  accessibilityRole="button"
                  accessibilityLabel={`${choice.label}. ${choice.hint}`}
                  onPress={() => onChoose(choice.origin)}
                  className="min-h-24 flex-row items-center border-2 border-ink/30 bg-white p-3"
                  style={({ pressed }) => ({ opacity: pressed ? 0.68 : undefined })}
                >
                  <View className="mr-3 h-14 w-14 -rotate-2 items-center justify-center border-2 border-gold bg-gold">
                    <Text className="font-mono text-base font-bold text-ink">{ORIGIN_MARK[choice.origin]}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-bold uppercase text-ink">{choice.label}</Text>
                    <Text className="mt-2 text-sm leading-5 text-blue-dark">{choice.hint}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </>
        ) : (
          <PaperPanel kicker="Origin revealed" title={powerName} stamp="Awakened" className="bg-gold">
            <Text className="text-base leading-6 text-ink">
              {selectedCopy ? fillName(selectedCopy.reveal, playerName) : `${playerName} awakens.`}
            </Text>
            <View className="mt-4 flex-row gap-2">
              <StatusChip label="License 1 / 2" selected />
              <StatusChip label="Rookie wage locked" tone="hero" />
            </View>
            <Text className="mt-4 text-sm leading-5 text-ink/60">
              The 180/week deal survives the awakening. At renewal, the agent will ask for hero money.
            </Text>
          </PaperPanel>
        )}
      </ScrollView>

      {revealed ? (
        <View className="border-t-2 border-gold bg-white p-3">
          <ActionButton
            label="Bring on match two  ▸"
            accessibilityLabel="Finish first awakening"
            onPress={onContinue}
          />
        </View>
      ) : null}
    </SafeAreaView>
  );
}
