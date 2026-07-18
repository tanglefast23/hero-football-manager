import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton, formatCompactNumber } from './components/Scorecard';
import type { ManagementTab, ResourceSummaryViewModel } from './models';

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
        ? 'flex-row items-baseline gap-1 border-2 border-gold-dark bg-ink px-2 py-1'
        : 'flex-row items-baseline gap-1 border-2 border-paper/25 bg-ink px-2 py-1'}
    >
      <Text className={hero ? 'font-mono text-[10px] font-bold text-gold' : 'font-mono text-[10px] font-bold text-sky'}>
        {glyph}
      </Text>
      <Text className={hero ? 'font-mono text-xs font-bold text-gold-light' : 'font-mono text-xs font-bold text-paper'}>
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
  advanceWeekLabel?: string;
  advanceWeekDisabled?: boolean;
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
  advanceWeekLabel = 'Advance Week  ▸',
  advanceWeekDisabled = false,
}: ManagementShellProps) {
  const resourceCluster = (
    <View className="flex-row gap-1.5">
      <ResourceChip glyph="G" name="Money" value={resources.money} />
      <ResourceChip glyph="TP" name="Training points" value={resources.trainingPoints} />
      <ResourceChip glyph="✦" name="Hero essence" value={resources.heroEssence} tone="hero" />
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-ink" edges={['top', 'left', 'right', 'bottom']}>
      {/* Persistent HUD bar — club + date on the left, resources on the right. */}
      <View className="flex-row items-center justify-between gap-2 border-b-2 border-ink bg-ink-soft px-3 py-2">
        <View className="flex-1 pr-1">
          <Text className="text-sm font-bold uppercase tracking-wide text-paper" numberOfLines={1}>
            {clubName}
          </Text>
          <Text className="mt-0.5 font-mono text-xs font-bold uppercase tracking-wide text-sky" numberOfLines={1}>
            {seasonLabel} · {weekLabel}
          </Text>
        </View>
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
      </View>

      <View className="flex-1">{children}</View>

      <View className="border-t-2 border-ink bg-ink-soft px-3 pt-2">
        <ActionButton
          label={advanceWeekLabel}
          accessibilityLabel={advanceWeekLabel.replace('▸', '').trim()}
          onPress={onAdvanceWeek}
          disabled={advanceWeekDisabled}
          compact
        />
        <View className="mt-2 flex-row" accessibilityRole="tablist">
          {TABS.map(tab => {
            const selected = tab.id === activeTab;
            return (
              <Pressable
                key={tab.id}
                accessibilityRole="tab"
                accessibilityLabel={tab.available ? `${tab.label} tab` : `${tab.label} tab, available in M2`}
                accessibilityState={{ selected, disabled: !tab.available }}
                disabled={!tab.available}
                onPress={() => onTabChange(tab.id)}
                className="min-h-12 flex-1 items-center justify-center"
                style={({ pressed }) => ({ opacity: !tab.available ? 0.35 : pressed ? 0.7 : undefined })}
              >
                <Text className={selected ? 'font-mono text-sm font-bold text-paper' : 'font-mono text-sm text-paper/60'}>
                  {tab.glyph}
                </Text>
                <Text className={selected ? 'mt-1 text-xs font-bold uppercase text-paper' : 'mt-1 text-xs uppercase text-paper/50'}>
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
