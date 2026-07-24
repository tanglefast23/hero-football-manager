import { useState } from 'react';
import { ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton, PaperPanel, StatusChip } from '../components/Scorecard';
import { ChalkboardBackdrop, PaperSticker } from '../components/ChalkboardStage';
import { useLayoutMode } from '../layout/use-layout-mode';
import { FormationDiagram } from '../components/FormationDiagram';
import { FORMATION_LABELS } from '../../sim/tactics';
import { SfxPressable as Pressable } from '../components/SfxPressable';
import type { AppPreferences } from '../../persistence';
import type { GlossaryCatalog } from '../../content';
import { GlossaryPanel } from '../GlossaryPanel';
import { TitlePlayerPopScene } from '../components/TitlePlayerPopScene';

export interface TitleLandingScreenProps {
  hasSavedCareer: boolean;
  reduceMotion?: boolean;
  onStory: () => void;
  onSettings: () => void;
}

export function TitleLandingScreen({
  hasSavedCareer,
  reduceMotion = false,
  onStory,
  onSettings,
}: TitleLandingScreenProps) {
  const { width, height } = useWindowDimensions();
  const isWide = width >= 900 && height >= 600;

  return (
    <SafeAreaView className="flex-1 bg-pitch-dark" edges={['top', 'left', 'right', 'bottom']}>
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
          className={isWide
            ? 'w-full max-w-[1180px] flex-1 flex-row items-center justify-between gap-20 px-12 py-10'
            : 'w-full max-w-[480px] flex-1 justify-between px-5 py-5'}
        >
          <View className={isWide ? 'w-[54%] max-w-[620px]' : 'relative'}>
            <View className="flex-row items-start justify-between">
              <View className="-rotate-2 border-2 border-ink bg-paper px-3 py-2">
                <Text className="font-pixel text-xs uppercase text-pitch-dark">
                  Small club · Big heroes
                </Text>
              </View>
              <View className={isWide
                ? 'h-14 w-14 rotate-3 items-center justify-center border-[3px] border-ink bg-gold'
                : 'h-11 w-11 rotate-3 items-center justify-center border-2 border-ink bg-gold'}
              >
                <Text className={isWide ? 'font-pixel text-3xl text-ink' : 'font-pixel text-xl text-ink'}>★</Text>
              </View>
            </View>

            <View className={isWide ? 'mt-12' : 'mt-7'}>
              <Text className={isWide
                ? 'font-pixel text-sm uppercase tracking-[4px] text-paper/80'
                : 'font-pixel text-xs uppercase tracking-[3px] text-paper/80'}
              >
                The beautiful game gets strange
              </Text>
              <Text className={isWide
                ? 'mt-4 font-pixel text-[68px] uppercase leading-[68px] tracking-tight text-white'
                : 'mt-2 font-pixel text-[43px] uppercase leading-[44px] tracking-tight text-white'}
              >
                Hero{`\n`}Football
              </Text>
              <View className={isWide
                ? '-mt-1 self-start -rotate-2 border-[3px] border-ink bg-blue px-5 py-2'
                : '-mt-1 self-start -rotate-2 border-2 border-ink bg-blue px-3 py-1'}
              >
                <Text className={isWide
                  ? 'font-pixel text-4xl uppercase text-white'
                  : 'font-pixel text-2xl uppercase text-white'}
                >
                  Manager!
                </Text>
              </View>
              <Text className={isWide
                ? 'mt-7 max-w-lg font-mono text-base uppercase leading-7 text-paper/80'
                : 'mt-4 max-w-sm font-mono text-sm uppercase leading-5 text-paper/80'}
              >
                Train a tiny club. Discover impossible players. Make match-day legends.
              </Text>
            </View>
          </View>

          <View className={isWide ? 'w-[430px] pt-28' : 'mt-32'}>
            <TitleMenu
              hasSavedCareer={hasSavedCareer}
              reduceMotion={reduceMotion}
              onStory={onStory}
              onSettings={onSettings}
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
  onStory,
  onSettings,
}: {
  readonly hasSavedCareer: boolean;
  readonly reduceMotion: boolean;
  readonly onStory: () => void;
  readonly onSettings: () => void;
}) {
  return (
    <View className="relative">
      <View pointerEvents="none" className="absolute -top-[250px] left-0 right-0 h-[252px]">
        <TitlePlayerPopScene reduceMotion={reduceMotion} />
      </View>
      <View className="z-10 gap-2 border-[3px] border-ink bg-paper p-3">
        <View className="mb-1 flex-row items-center justify-between">
          <Text className="font-pixel text-[10px] uppercase tracking-[1px] text-ink/60">Pick your boots</Text>
          {hasSavedCareer ? <StatusChip label="Save found" tone="success" /> : <StatusChip label="New file" tone="hero" />}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={hasSavedCareer ? 'Open story and saved career options' : 'Open story mode'}
          onPress={onStory}
          className="relative min-h-20 overflow-hidden border-[3px] border-ink bg-blue px-4 py-3"
          style={({ pressed }) => ({
            opacity: pressed ? 0.82 : undefined,
            transform: [{ translateY: pressed ? 3 : 0 }],
          })}
        >
          <View pointerEvents="none" className="absolute bottom-0 left-0 right-0 h-2 bg-blue-dark" />
          <Text className="font-pixel text-2xl uppercase text-white">Story</Text>
          <Text className="mt-1 max-w-[82%] font-mono text-[10px] uppercase leading-4 text-white/75">
            {hasSavedCareer ? 'Continue your club or begin again' : 'Take the keys to your first club'}
          </Text>
          <Text className="absolute right-4 top-3 font-pixel text-4xl text-white">▸</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open settings"
          onPress={onSettings}
          className="min-h-12 flex-row items-center justify-between border-[3px] border-ink bg-white px-4 py-2"
          style={({ pressed }) => ({
            opacity: pressed ? 0.72 : undefined,
            transform: [{ translateY: pressed ? 2 : 0 }],
          })}
        >
          <View className="flex-row items-center gap-3">
            <Text className="font-pixel text-lg text-blue-dark">⚙</Text>
            <Text className="font-pixel text-xs uppercase text-ink">Settings</Text>
          </View>
          <Text className="font-pixel text-lg text-ink/45">›</Text>
        </Pressable>
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
  accessibilityCopy,
  difficultyLabel,
  onBack,
  backLabel = 'Back to title',
}: TitleSettingsScreenProps) {
  const [showGlossary, setShowGlossary] = useState(false);
  const wide = useLayoutMode() === 'twoColumn';
  const volumePercent = Math.round(preferences.masterVolume * 100);
  if (showGlossary) {
    return (
      <SafeAreaView className="flex-1 bg-paper" edges={['top', 'left', 'right', 'bottom']}>
        <View className="flex-1 px-5 py-6">
          <GlossaryPanel content={glossary} onBack={() => setShowGlossary(false)} />
        </View>
      </SafeAreaView>
    );
  }
  const formationsPanel = (
    <PaperPanel kicker="Match-day kit" title="Three formations" stamp="Tap to swap">
      <Text className="text-base leading-5 text-ink/65">
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
  );

  const accessibilityPanel = (
    <PaperPanel kicker="Accessibility" title="Comfort and reach" stamp="Saved">
              <Text className="text-base leading-5 text-ink/65">
                {accessibilityCopy?.body ?? 'Reduce animated flourishes and put the live-match information where it is easiest to read.'}
              </Text>
              <View className="mt-5 gap-3">
                <Pressable
                  accessibilityRole="switch"
                  accessibilityLabel="Reduce motion"
                  accessibilityState={{ checked: preferences.reduceMotion }}
                  onPress={onToggleReduceMotion}
                  className={preferences.reduceMotion
                    ? 'min-h-14 flex-row items-center justify-between border-2 border-ink bg-blue-light px-4 py-3'
                    : 'min-h-14 flex-row items-center justify-between border-2 border-ink bg-paper-dark px-4 py-3'}
                  style={({ pressed }) => ({ opacity: pressed ? 0.72 : undefined })}
                >
                  <View className="flex-1 pr-3">
                    <Text className="font-mono text-base font-bold uppercase text-ink">Reduce motion</Text>
                    <Text className="mt-1 text-sm text-ink/60">Stops count-ups, flashes, pulses, and decorative match trails.</Text>
                  </View>
                  <Text className="font-mono text-lg font-bold text-ink">{preferences.reduceMotion ? 'ON' : 'OFF'}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Match information panel is on the ${preferences.hudSide}. Tap to move it.`}
                  onPress={onToggleHudSide}
                  className="min-h-14 flex-row items-center justify-between border-2 border-ink bg-paper-dark px-4 py-3"
                  style={({ pressed }) => ({ opacity: pressed ? 0.72 : undefined })}
                >
                  <View className="flex-1 pr-3">
                    <Text className="font-mono text-base font-bold uppercase text-ink">Match info position</Text>
                    <Text className="mt-1 text-sm text-ink/60">Moves the carrier card and top controls together.</Text>
                  </View>
                  <Text className="font-mono text-lg font-bold uppercase text-blue-dark">{preferences.hudSide}</Text>
                </Pressable>
                <AccessibilityToggle label="Haptics" detail="Turns all touch feedback on or off." enabled={preferences.hapticsEnabled} onPress={onToggleHaptics} />
                <AccessibilityChoice label="Text size" detail="Adds extra room to important story and review copy." value={preferences.textScale === 1 ? 'System' : preferences.textScale === 1.15 ? 'Roomy' : 'Large'} onPress={onCycleTextScale} />
                <AccessibilityToggle label="High contrast" detail="Darkens match chrome and strengthens live-match contrast." enabled={preferences.highContrast} onPress={onToggleHighContrast} />
                <AccessibilityToggle label="Color-safe kits" detail="Uses a high-separation blue and amber match pairing." enabled={preferences.colorSafeKits} onPress={onToggleColorSafeKits} />
                <AccessibilityChoice label="Power labels" detail="Choose a bottom-left player card or a minimal match banner." value={preferences.cutInMode === 'full' ? 'PLAYER' : 'BANNER'} onPress={onToggleCutInMode} />
              </View>
    </PaperPanel>
  );

  const difficultyPanel = difficultyLabel ? (
    <PaperPanel kicker="Current career" title="Boardroom pressure" stamp={difficultyLabel}>
      <Text className="text-base leading-5 text-ink/65">
        Difficulty is chosen when the career begins. It changes economy pressure, never match replay rules.
      </Text>
    </PaperPanel>
  ) : null;

  const audioPanel = (
    <PaperPanel kicker="Master mix" title="Game audio" stamp={`${volumePercent}%`}>
              <Text className="text-base leading-5 text-ink/65">
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
                    <Text className="text-sm font-bold uppercase tracking-[2px] text-ink/55">Tap to change</Text>
                    <Text className="mt-1 font-mono text-3xl font-bold text-ink">
                      {volumePercent === 0 ? 'MUTED' : `${volumePercent}%`}
                    </Text>
                  </View>
                  <Text className="font-mono text-4xl text-ink">{volumePercent === 0 ? '×' : '♪'}</Text>
                </View>
              </Pressable>

              <View className="mt-5 gap-2 border-t border-ink/20 pt-4">
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm font-bold uppercase tracking-wide text-ink/60">Title theme</Text>
                  <StatusChip label="Heroes Start Here" selected />
                </View>
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm font-bold uppercase tracking-wide text-ink/60">Management</Text>
                  <StatusChip label="Clubhouse Dreams" />
                </View>
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm font-bold uppercase tracking-wide text-ink/60">Match day</Text>
                  <StatusChip label="Match Day Heroes" />
                </View>
              </View>
    </PaperPanel>
  );

  const glossaryPanel = (
    <PaperPanel kicker="Club handbook" title="Glossary" stamp="A–Z">
      <Text className="text-base leading-5 text-ink/65">
        Look up football terms, player development, club systems, match controls, and hero mechanics.
      </Text>
      <View className="mt-4">
        <ActionButton
          label="Open glossary"
          accessibilityLabel="Open glossary"
          onPress={() => setShowGlossary(true)}
          variant="paper"
        />
      </View>
    </PaperPanel>
  );

  return (
    <SafeAreaView className="flex-1 bg-pitch-dark" edges={['top', 'left', 'right', 'bottom']}>
      <ChalkboardBackdrop wide={wide} />
      <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1 }}>
        <View className={wide
          ? 'w-full max-w-[1180px] flex-1 justify-between self-center px-10 py-8'
          : 'flex-1 justify-between px-5 py-6'}
        >
          <View>
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="font-pixel text-xs uppercase tracking-[3px] text-gold-light">Front office</Text>
                <Text className={wide
                  ? 'mt-2 font-pixel text-4xl uppercase text-white'
                  : 'mt-2 font-pixel text-3xl uppercase text-white'}
                >
                  Settings
                </Text>
              </View>
              <PaperSticker text="Coach’s board" className="-rotate-3" />
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
                </View>
              </View>
            ) : (
              <View className="mt-8 gap-6">
                {formationsPanel}
                {accessibilityPanel}
                {difficultyPanel}
                {audioPanel}
                {glossaryPanel}
              </View>
            )}
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

function AccessibilityToggle({ label, detail, enabled, onPress }: { label: string; detail: string; enabled: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="switch" accessibilityLabel={label} accessibilityState={{ checked: enabled }} onPress={onPress} className={enabled ? 'min-h-14 flex-row items-center justify-between border-2 border-ink bg-blue-light px-4 py-3' : 'min-h-14 flex-row items-center justify-between border-2 border-ink bg-paper-dark px-4 py-3'}>
      <View className="flex-1 pr-3"><Text className="font-mono text-base font-bold uppercase text-ink">{label}</Text><Text className="mt-1 text-sm text-ink/60">{detail}</Text></View>
      <Text className="font-mono text-lg font-bold text-ink">{enabled ? 'ON' : 'OFF'}</Text>
    </Pressable>
  );
}

function AccessibilityChoice({ label, detail, value, onPress }: { label: string; detail: string; value: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}, ${value}`} onPress={onPress} className="min-h-14 flex-row items-center justify-between border-2 border-ink bg-paper-dark px-4 py-3">
      <View className="flex-1 pr-3"><Text className="font-mono text-base font-bold uppercase text-ink">{label}</Text><Text className="mt-1 text-sm text-ink/60">{detail}</Text></View>
      <Text className="font-mono text-lg font-bold uppercase text-blue-dark">{value}</Text>
    </Pressable>
  );
}
