import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActionButton, formatCompactNumber, formatCurrency } from './components/Scorecard';
import type { ManagementTab, ResourceSummaryViewModel } from './models';
import { TutorialTapCue } from './TutorialTapCue';
import type { TutorialAnchorLayout } from './tutorial-cue-position';
import { SettingsButton } from './SettingsOverlay';
import { HoverTipAnchor, SfxPressable as Pressable } from './components/SfxPressable';
import { managementHeaderLine } from './management-header';
import { managementKeyBindings, tabNumberKey } from './management-key-bindings';
import { useKeyBindings } from './use-key-bindings';
import { PixelText } from './components/PixelText';
import { useGuideAnchor } from './use-guide-anchor';

const TABS: ReadonlyArray<{
  id: ManagementTab; label: string; glyph: string; available: boolean; tip: string;
}> = [
  { id: 'home', label: 'Home', glyph: '⌂', available: true, tip: 'Today\u2019s work: next fixture, inbox and the league table' },
  { id: 'squad', label: 'Squad', glyph: '11', available: true, tip: 'Your eleven and the bench: train players and set the lineup' },
  { id: 'club', label: 'Club', glyph: '▦', available: true, tip: 'Grounds, coaching staff and the books' },
  { id: 'market', label: 'Market', glyph: '⇄', available: true, tip: 'Scout, sign, sell and hire coaches' },
  { id: 'league', label: 'League', glyph: '≡', available: true, tip: 'Standings, fixtures and the cup' },
];

const ADVANCE_WEEK_TIP = 'Match day, wages and events · press Enter';

// Persistent chrome must not consume the screen when iOS Dynamic Type is at
// its accessibility maximum. The full names remain available to assistive
// technology through accessibilityLabel.
const CHROME_MAX_FONT_SIZE_MULTIPLIER = 1.3;

// The shell paints its own safe-area padding instead of letting SafeAreaView
// letterbox the screen: the status-bar/Dynamic Island strip then carries the
// HUD's own paper-dark, and the tab bar reaches the physical bottom edge so no
// paper-coloured band is wasted under it.
const HUD_TOP_BREATHING_ROOM = 4;
// Enough clearance for the home indicator without donating the full inset to
// empty chrome — the tabs sit lower and the content column keeps the pixels.
const TAB_BAR_BOTTOM_CLEARANCE = 8;
const TAB_BAR_BOTTOM_INSET_TRIM = 14;

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
      {/* font-pixel is the authored bold face; font-mono + font-bold would
          synthetically embolden the bitmap font and smear these glyphs. */}
      <Text maxFontSizeMultiplier={1.2} className={hero ? 'font-pixel text-xs text-gold-dark' : 'font-pixel text-xs text-blue-dark'}>
        {glyph}
      </Text>
      <Text maxFontSizeMultiplier={1.2} adjustsFontSizeToFit numberOfLines={1} className={hero ? 'font-mono text-sm text-gold-dark' : 'font-mono text-sm text-ink'}>
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
  /**
   * Desktop key shortcuts, on by default. The shell cannot see an overlay a
   * screen renders over it, so a caller that owns the keyboard for a while
   * (a full-screen tutorial page) passes false. React Native modals are
   * detected on their own — see useKeyBindings.
   */
  keyboardShortcutsEnabled?: boolean;
  guideFocus?: 'money' | 'navigation';
  /** Persistent first-week helper copy; floating arrows may retire after a tap. */
  guideObjective?: string;
  /** Present when the helper itself can take the manager to the required tab. */
  onGuideObjectivePress?: () => void;
  guideTarget?:
    | 'home-tab'
    | 'squad-tab'
    | 'training-plan'
    | 'training-ground-alert'
    | 'training-ground-facility'
    | 'advance-week';
  onMoneyGuideAnchorChange?: (anchor: TutorialAnchorLayout | null) => void;
  onNavigationGuideAnchorChange?: (anchor: TutorialAnchorLayout | null) => void;
  /**
   * Clears guidance the player has stopped following. It runs when the finger
   * lifts, never when it lands: dropping a cue also drops the room its screen
   * reserved above the highlighted control, and reflowing mid-press slid that
   * control out from under the finger, so the press the cue was asking for was
   * delivered to whatever had taken its place. A helper cue must never eat the
   * first tap.
   */
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
  keyboardShortcutsEnabled = true,
  guideFocus,
  guideObjective,
  onGuideObjectivePress,
  guideTarget,
  onMoneyGuideAnchorChange,
  onNavigationGuideAnchorChange,
  onDismissGuidance,
}: ManagementShellProps) {
  const headerLine = managementHeaderLine(seasonLabel, weekLabel);
  const dismissFrameRef = useRef<number | null>(null);
  const dismissGuidanceAfterPress = useCallback(() => {
    if (onDismissGuidance === undefined || dismissFrameRef.current !== null) return;
    // RN web resolves Pressable.onPress after pointer-up. Waiting one frame lets
    // that action land before a disappearing cue reflows the control beneath it.
    dismissFrameRef.current = requestAnimationFrame(() => {
      dismissFrameRef.current = null;
      onDismissGuidance();
    });
  }, [onDismissGuidance]);
  useEffect(() => () => {
    if (dismissFrameRef.current !== null) cancelAnimationFrame(dismissFrameRef.current);
  }, []);

  // Desktop players drive the chrome from the keyboard; a no-op on phones.
  useKeyBindings(
    managementKeyBindings({ tabs: TABS, onTabChange, onAdvanceWeek, advanceWeekDisabled }),
    keyboardShortcutsEnabled,
  );

  const moneyGuideAnchor = useGuideAnchor(guideFocus === 'money', onMoneyGuideAnchorChange);
  const navigationGuideAnchor = useGuideAnchor(
    guideFocus === 'navigation',
    onNavigationGuideAnchorChange,
  );
  const insets = useSafeAreaInsets();

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
      className="flex-1 bg-paper-dark"
      edges={['left', 'right']}
      onPointerUp={dismissGuidanceAfterPress}
      onTouchEnd={dismissGuidanceAfterPress}
    >
      {/* Persistent HUD bar — club and controls share the top row. The status-bar
          inset is padding on this bar, so the notch strip is HUD-coloured. */}
      <View
        className="border-b-2 border-ink bg-paper-dark px-3 pb-2.5"
        style={{ paddingTop: insets.top + HUD_TOP_BREATHING_ROOM }}
        onLayout={moneyGuideAnchor.scheduleMeasurement}
      >
        <View className="flex-row items-center gap-2">
          <Text
            className="min-w-0 flex-1 font-pixel text-sm uppercase text-ink"
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
        <View className="mt-2 border-t border-ink/15 pt-2">
          <Text
            className="font-pixel text-sm uppercase text-blue-dark"
            numberOfLines={1}
            adjustsFontSizeToFit
            accessibilityLabel={headerLine.spoken}
            maxFontSizeMultiplier={CHROME_MAX_FONT_SIZE_MULTIPLIER}
          >
            {headerLine.visible}
          </Text>
        </View>
      </View>

      <View className="flex-1 bg-paper">{children}</View>

      <View
        className="border-t-2 border-ink bg-paper-dark px-3 pt-2"
        style={{
          paddingBottom: Math.max(
            insets.bottom - TAB_BAR_BOTTOM_INSET_TRIM,
            TAB_BAR_BOTTOM_CLEARANCE,
          ),
        }}
      >
        {/* Bottom chrome shares the content column: the Advance Week button and
            the five tabs never extend past the tables above them on desktop. */}
        <View className="w-full max-w-5xl self-center">
        {guideObjective ? (
          onGuideObjectivePress ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Bert's current job: ${guideObjective}`}
              onPress={onGuideObjectivePress}
              className="mb-2 flex-row items-center border-2 border-b-4 border-blue-dark bg-blue-light px-3 py-2"
              style={({ pressed }) => ({ opacity: pressed ? 0.72 : undefined })}
            >
              <Text className="font-mono text-xs font-bold uppercase text-blue-dark">Bert's job</Text>
              <Text className="ml-3 flex-1 font-pixel text-xs uppercase text-ink">{guideObjective}</Text>
              <Text className="font-mono text-lg font-bold text-ink">›</Text>
            </Pressable>
          ) : (
            <View
              accessible
              accessibilityLabel={`Bert's current job: ${guideObjective}`}
              className="mb-2 flex-row items-center border-2 border-b-4 border-blue-dark bg-blue-light px-3 py-2"
            >
              <Text className="font-mono text-xs font-bold uppercase text-blue-dark">Bert's job</Text>
              <Text className="ml-3 flex-1 font-pixel text-xs uppercase text-ink">{guideObjective}</Text>
            </View>
          )
        ) : null}
        <HoverTipAnchor
          tip={advanceWeekDisabled ? undefined : ADVANCE_WEEK_TIP}
          className={guideTarget === 'advance-week' ? 'relative border-2 border-blue-dark bg-blue-light p-1' : 'relative'}
        >
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
        </HoverTipAnchor>
        <View
          ref={navigationGuideAnchor.anchorRef}
          collapsable={false}
          onLayout={navigationGuideAnchor.scheduleMeasurement}
          className={guideFocus === 'navigation'
            ? 'mt-2 flex-row border-2 border-blue-dark bg-blue-light/40'
            : 'mt-2 flex-row'}
          accessibilityRole="tablist"
        >
          {TABS.map((tab, index) => {
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
                tip={tab.available
                  ? `${tab.tip} · press ${tabNumberKey(index)}`
                  : `${tab.label} is not available yet`}
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
                  className={selected ? 'font-pixel text-lg text-ink' : 'font-mono text-lg text-ink/50'}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  maxFontSizeMultiplier={CHROME_MAX_FONT_SIZE_MULTIPLIER}
                >
                  {tab.glyph}
                </Text>
                <PixelText
                  className={selected ? 'mt-1 text-sm uppercase text-ink' : 'mt-1 text-sm uppercase text-ink/50'}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  maxFontSizeMultiplier={CHROME_MAX_FONT_SIZE_MULTIPLIER}
                >
                  {tab.label}
                </PixelText>
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
