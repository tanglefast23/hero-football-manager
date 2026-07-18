import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton, PaperPanel, StatusChip } from '../components/Scorecard';
import { FormationDiagram } from '../components/FormationDiagram';
import { FORMATION_LABELS } from '../../sim/tactics';
import type { AppPreferences } from '../../persistence';

export interface TitleLandingScreenProps {
  hasSavedCareer: boolean;
  onStory: () => void;
  onSettings: () => void;
}

export function TitleLandingScreen({
  hasSavedCareer,
  onStory,
  onSettings,
}: TitleLandingScreenProps) {
  return (
    <SafeAreaView className="flex-1 bg-ink" edges={['top', 'left', 'right', 'bottom']}>
      <View pointerEvents="none" className="absolute inset-0 overflow-hidden">
        <View className="absolute -right-24 top-20 h-72 w-72 rotate-12 border-2 border-sky/10" />
        <View className="absolute -left-20 bottom-24 h-52 w-72 -rotate-12 border-2 border-signal/10" />
        <View className="absolute left-1/2 top-0 h-full w-px bg-paper/5" />
        <View className="absolute left-0 top-1/2 h-px w-full bg-paper/5" />
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 justify-between px-5 py-6">
          <View>
            <View className="flex-row items-start justify-between">
              <View className="-rotate-3 border-2 border-signal bg-ink-soft px-3 py-2">
                <Text className="font-mono text-xs font-bold uppercase tracking-[2px] text-signal">
                  HFM · Story build
                </Text>
              </View>
              <View className="h-12 w-12 rotate-3 items-center justify-center border-2 border-stamp bg-paper">
                <Text className="font-mono text-xl font-bold text-stamp">★</Text>
              </View>
            </View>

            <View className="mt-12">
              <Text className="text-xs font-bold uppercase tracking-[4px] text-sky">The beautiful game gets strange</Text>
              <Text className="mt-4 text-5xl font-bold uppercase leading-[52px] tracking-tight text-paper">
                Hero{`\n`}Football{`\n`}Manager
              </Text>
              <View className="mt-5 h-2 w-32 -rotate-2 bg-signal" />
              <Text className="mt-6 max-w-sm text-base leading-6 text-paper/65">
                Build a tiny club. Discover impossible players. Make match-day legends.
              </Text>
            </View>
          </View>

          <View className="mt-12 gap-3">
            <View className="mb-1 flex-row items-center justify-between">
              <Text className="text-xs font-bold uppercase tracking-[2px] text-sky">Choose your entrance</Text>
              {hasSavedCareer ? <StatusChip label="Save found" tone="success" /> : <StatusChip label="New file" tone="hero" />}
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={hasSavedCareer ? 'Open story and saved career options' : 'Open story mode'}
              onPress={onStory}
              className="relative min-h-24 overflow-hidden border-2 border-ink bg-signal px-5 py-4 shadow-lg shadow-black/40"
              style={({ pressed }) => ({ opacity: pressed ? 0.78 : undefined })}
            >
              <View pointerEvents="none" className="absolute -right-8 -top-12 h-40 w-24 rotate-12 bg-paper/25" />
              <Text className="font-mono text-3xl font-bold uppercase tracking-widest text-ink">Story</Text>
              <Text className="mt-1 max-w-[80%] text-xs font-bold uppercase tracking-wide text-ink/60">
                {hasSavedCareer ? 'Continue your club or begin again' : 'Take the keys to your first club'}
              </Text>
              <Text className="absolute right-5 top-6 font-mono text-4xl font-bold text-ink">▸</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open settings"
              onPress={onSettings}
              className="min-h-14 flex-row items-center justify-between border-2 border-paper/35 bg-ink-soft px-4 py-3"
              style={({ pressed }) => ({ opacity: pressed ? 0.65 : undefined })}
            >
              <View className="flex-row items-center gap-3">
                <Text className="font-mono text-lg font-bold text-sky">⚙</Text>
                <Text className="text-sm font-bold uppercase tracking-[2px] text-paper">Settings</Text>
              </View>
              <Text className="font-mono text-lg text-paper/45">›</Text>
            </Pressable>

            <Text className="mt-2 text-center font-mono text-xs uppercase tracking-widest text-paper/30">
              Heroes start here
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export interface TitleSettingsScreenProps {
  preferences: AppPreferences;
  onCycleVolume: () => void;
  onCycleFormation: (slot: number) => void;
  onToggleAutoPowers: () => void;
  onBack: () => void;
  backLabel?: string;
}

export function TitleSettingsScreen({
  preferences,
  onCycleVolume,
  onCycleFormation,
  onToggleAutoPowers,
  onBack,
  backLabel = 'Back to title',
}: TitleSettingsScreenProps) {
  const volumePercent = Math.round(preferences.masterVolume * 100);
  return (
    <SafeAreaView className="flex-1 bg-ink" edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 justify-between px-5 py-6">
          <View>
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-xs font-bold uppercase tracking-[3px] text-sky">Front office</Text>
                <Text className="mt-2 text-3xl font-bold uppercase tracking-wide text-paper">Settings</Text>
              </View>
              <View className="-rotate-3 border-2 border-stamp px-3 py-2">
                <Text className="text-xs font-bold uppercase tracking-[2px] text-stamp">Coach’s board</Text>
              </View>
            </View>

            <PaperPanel kicker="Match-day kit" title="Three formations" stamp="Tap to swap" className="mt-10">
              <Text className="text-sm leading-5 text-ink/65">
                These are the three shapes available from the live Formation button. The first shape starts every watched match.
              </Text>
              <View className="mt-5 flex-row gap-2">
                {preferences.formationPresets.map((formation, index) => (
                  <Pressable
                    key={`${index}-${formation}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Formation slot ${index + 1}, ${formation}. Tap to replace.`}
                    onPress={() => onCycleFormation(index)}
                    className="flex-1 items-center border-2 border-ink bg-paper-dark px-2 py-3"
                    style={({ pressed }) => ({ opacity: pressed ? 0.7 : undefined })}
                  >
                    <FormationDiagram formation={formation} compact />
                    <Text className="mt-2 font-mono text-sm font-bold text-ink">{formation}</Text>
                    <Text className="mt-1 text-center text-xs font-bold uppercase text-ink/50" numberOfLines={2}>
                      {FORMATION_LABELS[formation]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </PaperPanel>

            <PaperPanel kicker="Hero control" title="Power activation" stamp={preferences.autoPowers ? 'AUTO' : 'MANUAL'} className="mt-6">
              <Text className="text-sm leading-5 text-ink/65">
                Manual lets you tap glowing heroes directly on the pitch. Auto fires powers in a useful context at reduced strength.
              </Text>
              <Pressable
                accessibilityRole="switch"
                accessibilityLabel="Automatic hero powers"
                accessibilityState={{ checked: preferences.autoPowers }}
                onPress={onToggleAutoPowers}
                className={preferences.autoPowers ? 'mt-5 min-h-14 flex-row items-center justify-between border-2 border-ink bg-signal px-4 py-3' : 'mt-5 min-h-14 flex-row items-center justify-between border-2 border-ink bg-paper-dark px-4 py-3'}
                style={({ pressed }) => ({ opacity: pressed ? 0.72 : undefined })}
              >
                <View>
                  <Text className="text-xs font-bold uppercase tracking-[2px] text-ink/55">Tap to change</Text>
                  <Text className="mt-1 font-mono text-lg font-bold text-ink">
                    {preferences.autoPowers ? 'AUTO POWERS' : 'TAP PLAYERS'}
                  </Text>
                </View>
                <Text className="font-mono text-2xl font-bold text-ink">{preferences.autoPowers ? 'ON' : 'OFF'}</Text>
              </Pressable>
            </PaperPanel>

            <PaperPanel kicker="Master mix" title="Game audio" stamp={`${volumePercent}%`} className="mt-6">
              <Text className="text-sm leading-5 text-ink/65">
                One master level keeps the opening, clubhouse, match music, and sound effects balanced together.
              </Text>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Master audio ${volumePercent} percent`}
                accessibilityHint="Cycles through 0, 25, 50, 75, and 100 percent"
                onPress={onCycleVolume}
                className="mt-5 border-2 border-ink bg-signal px-4 py-4"
                style={({ pressed }) => ({ opacity: pressed ? 0.75 : undefined })}
              >
                <View className="flex-row items-end justify-between">
                  <View>
                    <Text className="text-xs font-bold uppercase tracking-[2px] text-ink/55">Tap to change</Text>
                    <Text className="mt-1 font-mono text-2xl font-bold text-ink">
                      {volumePercent === 0 ? 'MUTED' : `${volumePercent}%`}
                    </Text>
                  </View>
                  <Text className="font-mono text-3xl text-ink">{volumePercent === 0 ? '×' : '♪'}</Text>
                </View>
              </Pressable>

              <View className="mt-5 gap-2 border-t border-ink/20 pt-4">
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs font-bold uppercase tracking-wide text-ink/60">Title theme</Text>
                  <StatusChip label="Heroes Start Here" selected />
                </View>
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs font-bold uppercase tracking-wide text-ink/60">Management</Text>
                  <StatusChip label="Clubhouse Dreams" />
                </View>
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs font-bold uppercase tracking-wide text-ink/60">Match day</Text>
                  <StatusChip label="Match Day Heroes" />
                </View>
              </View>
            </PaperPanel>
          </View>

          <View className="mt-8">
            <ActionButton
              label={`‹  ${backLabel}`}
              accessibilityLabel={backLabel}
              onPress={onBack}
              variant="paper"
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
