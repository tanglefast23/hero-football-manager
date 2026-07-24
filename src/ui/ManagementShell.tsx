import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChalkboardBackdrop } from './components/ChalkboardStage';
import { useLayoutMode } from './layout/use-layout-mode';
import { ActionButton, formatCompactNumber, formatCurrency } from './components/Scorecard';
import type { ManagementTab, ResourceSummaryViewModel } from './models';
import { TutorialTapCue } from './TutorialTapCue';
import type { TutorialAnchorLayout } from './tutorial-cue-position';
import { SettingsButton } from './SettingsOverlay';
import { SfxPressable as Pressable } from './components/SfxPressable';

function useGuideAnchor(
  enabled: boolean,
  onAnchorChange?: (anchor: TutorialAnchorLayout | null) => void,
) {
  const anchorRef = useRef<View>(null);
  const measurementFrameRef = useRef<number | null>(null);

  const measureAnchor = useCallback(() => {
    anchorRef.current?.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) onAnchorChange?.({ x, y, width, height });
    });
  }, [onAnchorChange]);

  const scheduleMeasurement = useCallback(() => {
    if (!enabled || onAnchorChange === undefined) return;
    if (measurementFrameRef.current !== null) cancelAnimationFrame(measurementFrameRef.current);
    measurementFrameRef.current = requestAnimationFrame(() => {
      measurementFrameRef.current = null;
      measureAnchor();
    });
  }, [enabled, measureAnchor, onAnchorChange]);

  useEffect(() => {
    if (!enabled) {
      onAnchorChange?.(null);
      return;
    }
    scheduleMeasurement();
    return () => {
      if (measurementFrameRef.current !== null) {
        cancelAnimationFrame(measurementFrameRef.current);
        measurementFrameRef.current = null;
      }
      onAnchorChange?.(null);
    };
  }, [enabled, onAnchorChange, scheduleMeasurement]);

  return { anchorRef, scheduleMeasurement };
}

const TABS: ReadonlyArray<{ id: ManagementTab; label: string; glyph: string; available: boolean }> = [
  { id: 'home', label: 'Home', glyph: '⌂', available: true },
  { id: 'squad', label: 'Squad', glyph: '11', available: true },
  { id: 'club', label: 'Club', glyph: '▦', available: true },
  { id: 'market', label: 'Market', glyph: '⇄', available: true },
  { id: 'league', label: 'League', glyph: '≡', available: true },
];

// Persistent chrome must not consume the screen when iOS Dynamic Type is at
// its accessibility maximum. The full names remain available to assistive
// technology through accessibilityLabel.
const CHROME_MAX_FONT_SIZE_MULTIPLIER = 1.3;

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
      accessibilityLabel={`${name}: ${name === 'Money' ? formatCurrency(value) : formatCompactNumber(value)}`}
      className={hero
        ? 'h-11 flex-row items-center gap-1 border-2 border-gold-dark bg-white px-2'
        : 'h-11 flex-row items-center gap-1 border-2 border-ink bg-white px-2'}
    >
      <Text maxFontSizeMultiplier={1.2} className={hero ? 'font-mono text-xs font-bold text-gold-dark' : 'font-mono text-xs font-bold text-blue-dark'}>
        {glyph}
      </Text>
      <Text maxFontSizeMultiplier={1.2} adjustsFontSizeToFit numberOfLines={1} className={hero ? 'font-mono text-sm font-bold text-gold-dark' : 'font-mono text-sm font-bold text-ink'}>
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
  guideTarget?:
    | 'home-tab'
    | 'squad-tab'
    | 'training-plan'
    | 'training-ground-alert'
    | 'training-ground-facility'
    | 'advance-week';
  onMoneyGuideAnchorChange?: (anchor: TutorialAnchorLayout | null) => void;
  onNavigationGuideAnchorChange?: (anchor: TutorialAnchorLayout | null) => void;
  onDismissGuidance?: () => void;
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
  onMoneyGuideAnchorChange,
  onNavigationGuideAnchorChange,
  onDismissGuidance,
}: ManagementShellProps) {
  const wide = useLayoutMode() === 'twoColumn';
  const moneyGuideAnchor = useGuideAnchor(guideFocus === 'money', onMoneyGuideAnchorChange);
  const navigationGuideAnchor = useGuideAnchor(
    guideFocus === 'navigation',
    onNavigationGuideAnchorChange,
  );

  const resourceCluster = (
    <View className="flex-shrink flex-row items-center gap-1.5">
      <View
        ref={moneyGuideAnchor.anchorRef}
        collapsable={false}
        onLayout={moneyGuideAnchor.scheduleMeasurement}
        className={guideFocus === 'money' ? 'border-2 border-blue-dark bg-blue-light p-1' : undefined}
      >
        <ResourceChip glyph="$" name="Money" value={resources.money} />
      </View>
      <ResourceChip glyph="TP" name="Training points" value={resources.trainingPoints} />
    </View>
  );

  return (
    <SafeAreaView
      className="flex-1 bg-pitch-dark"
      edges={['top', 'left', 'right', 'bottom']}
      onPointerDown={onDismissGuidance}
    >
      <ChalkboardBackdrop wide={wide} />
      {/* Persistent HUD bar — club and controls share the top row. */}
      <View
        className="border-b-2 border-paper/10 px-3 py-2.5"
        onLayout={moneyGuideAnchor.scheduleMeasurement}
      >
        <View className="flex-row items-center gap-2">
          <Text
            className="min-w-0 flex-1 font-pixel text-sm uppercase text-white"
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {clubName}
          </Text>
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
              <SettingsButton onPress={onOpenSettings} />
            ) : null}
          </View>
        </View>
        <View className="mt-2 border-t border-paper/15 pt-2">
          <Text
            className="font-mono text-sm font-bold uppercase text-blue-light"
            numberOfLines={1}
            adjustsFontSizeToFit
            maxFontSizeMultiplier={CHROME_MAX_FONT_SIZE_MULTIPLIER}
          >
            {seasonLabel} · {weekLabel}
          </Text>
        </View>
      </View>

      <View className="flex-1">{children}</View>

      <View className="border-t-[6px] border-white bg-ink/25 px-3 pt-2">
        {/* Bottom chrome shares the content column: the Advance Week button and
            the five tabs never extend past the tables above them on desktop. */}
        <View className="w-full max-w-5xl self-center">
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
            maxFontSizeMultiplier={CHROME_MAX_FONT_SIZE_MULTIPLIER}
          />
        </View>
        <View
          ref={navigationGuideAnchor.anchorRef}
          collapsable={false}
          onLayout={navigationGuideAnchor.scheduleMeasurement}
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
                accessibilityLabel={guided
                  ? `${tab.label} tab. Bert says: ${tab.id === 'squad' ? 'open Squad' : 'return Home'}`
                  : tab.available ? `${tab.label} tab` : `${tab.label} tab, unavailable`}
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
                    labelOffsetX={tab.id === 'home' ? 42 : 0}
                    style={styles.tabCue}
                  />
                ) : null}
                <Text
                  className={selected ? 'font-mono text-lg font-bold text-white' : 'font-mono text-lg text-paper/60'}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  maxFontSizeMultiplier={CHROME_MAX_FONT_SIZE_MULTIPLIER}
                >
                  {tab.glyph}
                </Text>
                <Text
                  className={selected ? 'mt-1 text-sm font-bold uppercase text-white' : 'mt-1 text-sm uppercase text-paper/60'}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  maxFontSizeMultiplier={CHROME_MAX_FONT_SIZE_MULTIPLIER}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  advanceCue: { left: '50%', marginLeft: -73, top: -78 },
  tabCue: { bottom: 54, left: '50%', marginLeft: -73 },
});
