import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton, formatCompactNumber } from './components/Scorecard';
import type { ManagementTab, ResourceSummaryViewModel } from './models';
import { TutorialTapCue } from './TutorialTapCue';

const TABS: ReadonlyArray<{ id: ManagementTab; label: string; glyph: string; available: boolean }> = [
  { id: 'home', label: 'Home', glyph: '⌂', available: true },
  { id: 'squad', label: 'Squad', glyph: '11', available: true },
  { id: 'club', label: 'Club', glyph: '▦', available: true },
  { id: 'market', label: 'Market', glyph: 'M2', available: false },
  { id: 'league', label: 'League', glyph: '≡', available: true },
];

/** Compact top-bar numerals: commas under 10k, then k / M so three fit on one row. */
function abbrev(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (abs >= 10_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  return formatCompactNumber(n);
}

function ResourceChip({ glyph, name, value, tone }: {
  glyph: string;
  name: string;
  value: number;
  tone?: 'hero';
}) {
  const hero = tone === 'hero';
  return (
    <View
      accessible
      accessibilityLabel={`${name}: ${formatCompactNumber(value)}`}
      className={hero
        ? 'flex-row items-baseline gap-1 border-2 border-gold-dark bg-white px-2 py-1'
        : 'flex-row items-baseline gap-1 border-2 border-ink bg-white px-2 py-1'}
    >
      <Text className={hero ? 'font-mono text-xs font-bold text-gold-dark' : 'font-mono text-xs font-bold text-blue-dark'}>
        {glyph}
      </Text>
      <Text className={hero ? 'font-mono text-sm font-bold text-gold-dark' : 'font-mono text-sm font-bold text-ink'}>
        {abbrev(value)}
      </Text>
    </View>
  );
}

export interface ManagementShellProps {
  children: ReactNode;
  clubName: string;
  seasonLabel: string;
  weekLabel: string;
  resources: ResourceSummaryViewModel;
  activeTab: ManagementTab;
  onTabChange: (tab: ManagementTab) => void;
  onAdvanceWeek: () => void;
  onOpenLedger?: () => void;
  onOpenSettings?: () => void;
  advanceWeekLabel?: string;
  advanceWeekDisabled?: boolean;
  guideFocus?: 'money' | 'navigation';
  guideTarget?: 'home-tab' | 'squad-tab' | 'training-plan' | 'advance-week';
}

export function ManagementShell({
  children,
  clubName,
  seasonLabel,
  weekLabel,
  resources,
  activeTab,
  onTabChange,
  onAdvanceWeek,
  onOpenLedger,
  onOpenSettings,
  advanceWeekLabel = 'Advance Week  ▸',
  advanceWeekDisabled = false,
  guideFocus,
  guideTarget,
}: ManagementShellProps) {
  const resourceCluster = (
    <View className={guideFocus === 'money'
      ? 'flex-row gap-1.5 border-2 border-blue-dark bg-blue-light p-1'
      : 'flex-row gap-1.5'}>
      <ResourceChip glyph="G" name="Money" value={resources.money} />
      <ResourceChip glyph="TP" name="Training points" value={resources.trainingPoints} />
      <ResourceChip glyph="✦" name="Hero essence" value={resources.heroEssence} tone="hero" />
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'left', 'right', 'bottom']}>
      {/* Persistent HUD bar — club + date on the left, resources on the right. */}
      <View className="flex-row items-center justify-between gap-2 border-b-2 border-ink bg-paper-dark py-2.5 pl-16 pr-3">
        <View className="flex-1 pr-1">
          <Text className="font-pixel text-base uppercase text-ink" numberOfLines={1}>
            {clubName}
          </Text>
          <Text className="mt-1 font-mono text-sm font-bold uppercase text-blue-dark" numberOfLines={1}>
            {seasonLabel} · {weekLabel}
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          {onOpenLedger ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open the club ledger"
              onPress={onOpenLedger}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : undefined })}
            >
              {resourceCluster}
            </Pressable>
          ) : (
            resourceCluster
          )}
          {onOpenSettings ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open settings"
              onPress={onOpenSettings}
              className="min-h-11 min-w-11 items-center justify-center border-2 border-ink bg-white"
              style={({ pressed }) => ({ opacity: pressed ? 0.65 : undefined })}
            >
              <Text className="font-mono text-lg font-bold text-blue-dark">⚙</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <View className="flex-1">{children}</View>

      <View className="border-t-2 border-ink bg-paper-dark px-3 pt-2">
        <View className={guideTarget === 'advance-week' ? 'relative border-2 border-blue-dark bg-blue-light p-1' : 'relative'}>
          {guideTarget === 'advance-week' ? (
            <TutorialTapCue
              detail="Advance week"
              style={styles.advanceCue}
            />
          ) : null}
          <ActionButton
            label={advanceWeekLabel}
            accessibilityLabel={guideTarget === 'advance-week'
              ? `Bert says: read the desk, then ${advanceWeekLabel.replace('▸', '').trim()}`
              : advanceWeekLabel.replace('▸', '').trim()}
            onPress={onAdvanceWeek}
            disabled={advanceWeekDisabled}
            compact
          />
        </View>
        <View
          className={guideFocus === 'navigation'
            ? 'mt-2 flex-row border-2 border-blue-dark bg-blue-light/40'
            : 'mt-2 flex-row'}
          accessibilityRole="tablist"
        >
          {TABS.map(tab => {
            const selected = tab.id === activeTab;
            const guideTab = guideTarget === 'home-tab'
              ? 'home'
              : guideTarget === 'squad-tab'
                ? 'squad'
                : undefined;
            const guided = guideTab === tab.id;
            return (
              <Pressable
                key={tab.id}
                accessibilityRole="tab"
                accessibilityLabel={tab.available ? `${tab.label} tab` : `${tab.label} tab, available in M2`}
                accessibilityState={{ selected, disabled: !tab.available }}
                disabled={!tab.available}
                onPress={() => onTabChange(tab.id)}
                className={guided
                  ? 'relative min-h-12 flex-1 items-center justify-center border-2 border-blue-dark bg-blue-light'
                  : 'relative min-h-12 flex-1 items-center justify-center'}
                style={({ pressed }) => ({ opacity: !tab.available ? 0.35 : pressed ? 0.7 : undefined })}
              >
                {guided ? (
                  <TutorialTapCue
                    detail={tab.id === 'squad' ? 'Open squad' : 'Return home'}
                    style={styles.tabCue}
                  />
                ) : null}
                <Text className={selected ? 'font-mono text-lg font-bold text-ink' : 'font-mono text-lg text-ink/50'}>
                  {tab.glyph}
                </Text>
                <Text className={selected ? 'mt-1 text-sm font-bold uppercase text-ink' : 'mt-1 text-sm uppercase text-ink/50'}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  advanceCue: { left: '50%', marginLeft: -73, top: -78 },
  tabCue: { bottom: 54, left: '50%', marginLeft: -73 },
});
