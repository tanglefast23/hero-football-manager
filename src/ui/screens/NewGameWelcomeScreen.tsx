import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton, PaperPanel, StatusChip } from '../components/Scorecard';

export interface NewGameWelcomeScreenProps {
  hasSavedCareer: boolean;
  savedCareerLabel?: string;
  showOpeningBrief: boolean;
  onStartNewCareer: () => void;
  onContinueCareer?: () => void;
  onOpenAccessibility?: () => void;
  onBackToTitle?: () => void;
}

/**
 * One poster line of the masthead: a solid face with a hard offset shadow
 * (the retro title-screen look, echoing the button-label drop-shadow).
 * `gold` marks the hero payoff word — the screen's single gold moment.
 */
function MastheadLine({ text, tone = 'paper' }: { text: string; tone?: 'paper' | 'gold' }) {
  const face = tone === 'gold' ? 'text-gold' : 'text-ink';
  const shadow = tone === 'gold' ? 'text-gold-dark' : 'text-grey-dark';
  return (
    <View className="relative self-start">
      <Text
        className={`absolute left-0 top-0 font-mono text-5xl font-bold uppercase leading-none ${shadow}`}
        style={{ transform: [{ translateX: 3 }, { translateY: 3 }] }}
      >
        {text}
      </Text>
      <Text className={`font-mono text-5xl font-bold uppercase leading-none ${face}`}>{text}</Text>
    </View>
  );
}

/** One numbered line of the week-one dossier: chunky pixel number tile + copy. */
function BriefRow({ index, title, note, children }: { index: string; title: string; note: string; children?: ReactNode }) {
  return (
    <View className="flex-row items-start gap-3">
      <View className="h-6 w-6 items-center justify-center bg-ink">
        <Text className="font-mono text-sm font-bold text-paper">{index}</Text>
      </View>
      <View className="flex-1">
        <Text className="text-base font-bold uppercase tracking-wide text-ink">{title}</Text>
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
}: NewGameWelcomeScreenProps) {
  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 justify-between px-5 py-6">
          <View>
            {onBackToTitle ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back to title"
                onPress={onBackToTitle}
                className="mb-5 min-h-11 self-start justify-center"
                style={({ pressed }) => ({ opacity: pressed ? 0.65 : undefined })}
              >
                <Text className="text-sm font-bold uppercase tracking-[2px] text-blue-dark">‹ Title</Text>
              </Pressable>
            ) : null}
            {showOpeningBrief ? (
              <>
                <View className="flex-row items-start justify-between">
                  {/* Club crest — a chunky beveled pixel badge (cream enamel) */}
                  <View className="relative h-14 w-14 -rotate-2 items-center justify-center overflow-hidden border-2 border-ink bg-paper">
                    <View pointerEvents="none" className="absolute left-0 right-0 top-0 h-1.5 bg-white" />
                    <View pointerEvents="none" className="absolute bottom-0 left-0 right-0 h-1.5 bg-paper-dark" />
                    <Text className="font-mono text-3xl font-bold text-ink">HF</Text>
                  </View>
                  {/* Board stamp — full red tint, hand-applied tilt */}
                  <View className="rotate-2 border-2 border-b-4 border-red bg-red-light/30 px-3 py-1.5">
                    <Text className="font-mono text-sm font-bold uppercase text-red-dark">Board approved</Text>
                  </View>
                </View>

                <View className="my-5 h-0.5 bg-ink/20" />

                <Text className="text-sm font-bold uppercase tracking-[3px] text-blue-dark">A club in crisis</Text>

                <View className="mt-4 gap-1">
                  <MastheadLine text="THE KEYS" />
                  <MastheadLine text="ARE YOURS." />
                  <MastheadLine text="MAKE THEM" />
                  <MastheadLine text="HEROES." tone="gold" />
                </View>

                <Text className="mt-5 max-w-sm text-base leading-5 text-ink/70">
                  A tiny ground. A nervous board. One blank registration card with your name waiting.
                  Build the club they will talk about for decades.
                </Text>
              </>
            ) : null}
          </View>

          {showOpeningBrief ? (
            <PaperPanel kicker="Incoming file" title="Week one brief" stamp="Urgent" className="my-7">
              <View className="gap-3">
                <BriefRow index="01" title="Meet the squad" note="Sixteen hopefuls. One empty shirt. Zero heroes." />
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
          ) : null}

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
              variant={hasSavedCareer ? 'danger' : 'primary'}
            />
            {onOpenAccessibility ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open accessibility settings"
                onPress={onOpenAccessibility}
                className="min-h-11 items-center justify-center"
                style={({ pressed }) => ({ opacity: pressed ? 0.65 : undefined })}
              >
                <Text className="text-sm font-bold uppercase tracking-widest text-blue-dark">Accessibility & controls</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
