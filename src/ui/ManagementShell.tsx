import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton } from './components/Scorecard';
import type { ManagementTab } from './models';

const TABS: ReadonlyArray<{ id: ManagementTab; label: string; glyph: string; available: boolean }> = [
  { id: 'home', label: 'Home', glyph: '⌂', available: true },
  { id: 'squad', label: 'Squad', glyph: '11', available: true },
  { id: 'club', label: 'Club', glyph: '▦', available: true },
  { id: 'market', label: 'Market', glyph: 'M2', available: false },
  { id: 'league', label: 'League', glyph: '≡', available: true },
];

export interface ManagementShellProps {
  children: ReactNode;
  clubName: string;
  seasonLabel: string;
  weekLabel: string;
  activeTab: ManagementTab;
  onTabChange: (tab: ManagementTab) => void;
  onAdvanceWeek: () => void;
  onOpenSettings?: () => void;
  advanceWeekLabel?: string;
  advanceWeekDisabled?: boolean;
}

export function ManagementShell({
  children,
  clubName,
  seasonLabel,
  weekLabel,
  activeTab,
  onTabChange,
  onAdvanceWeek,
  onOpenSettings,
  advanceWeekLabel = 'Advance Week  ▸',
  advanceWeekDisabled = false,
}: ManagementShellProps) {
  return (
    <SafeAreaView className="flex-1 bg-ink" edges={['top', 'left', 'right', 'bottom']}>
      <View className="flex-row items-center justify-between border-b-2 border-sky/30 bg-ink-soft px-4 py-3">
        <View className="flex-1 pr-3">
          <Text className="text-xs font-bold uppercase tracking-[2px] text-sky">Manager’s docket</Text>
          <Text className="mt-1 text-lg font-bold uppercase tracking-wide text-paper" numberOfLines={1}>
            {clubName}
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <View className="border border-paper/40 px-3 py-2">
            <Text className="text-right font-mono text-xs font-bold text-paper">{seasonLabel}</Text>
            <Text className="mt-1 text-right font-mono text-xs text-sky">{weekLabel}</Text>
          </View>
          {onOpenSettings ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open settings"
              onPress={onOpenSettings}
              className="min-h-11 min-w-11 items-center justify-center border border-paper/40"
              style={({ pressed }) => ({ opacity: pressed ? 0.65 : undefined })}
            >
              <Text className="font-mono text-lg font-bold text-sky">⚙</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <View className="flex-1">{children}</View>

      <View className="border-t-2 border-sky/30 bg-ink-soft px-3 pt-2">
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
