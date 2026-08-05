import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActionButton, formatCompactNumber, formatCurrency } from './components/Scorecard';
import type { ManagementTab, ResourceSummaryViewModel } from './models';
import { TutorialTapCue } from './TutorialTapCue';
import type { TutorialAnchorLayout } from './tutorial-cue-position';
import { SettingsButton } from './SettingsOverlay';
import { HoverTipAnchor, SfxPressable as Pressable } from './components/SfxPressable';
import { playUiClickSfx } from '../render/management-sfx';
import { managementHeaderLine } from './management-header';
import { managementKeyBindings, tabNumberKey } from './management-key-bindings';
import { useKeyBindings } from './use-key-bindings';
import { PixelText } from './components/PixelText';
import { InfoTip } from './components/InfoTip';
import { useGuideAnchor } from './use-guide-anchor';
import type { DeveloperSaveSlot, DeveloperSaveSummary } from '../persistence';

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
const DEVELOPER_AUTO_SLOT_LABELS = ['1', '2', '3', '4', '5'] as const;
const DEVELOPER_MANUAL_SLOT_LABELS = ['A', 'B', 'C', 'D', 'E'] as const;

/** Compact top-bar numerals: commas under 10k, then k / M so three fit on one row. */
function abbrev(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (abs >= 10_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  return formatCompactNumber(n);
}

function ResourceChip({ glyph, name, explainer, value, tone, onPress }: {
  glyph: string;
  name: string;
  /** What the glyph buys, for the manager who has never been told what TP is. */
  explainer: string;
  value: number;
  tone?: 'hero';
  /**
   * The InfoTip anchor's inner Pressable claims the touch responder, so a tap
   * on the chip face never reaches the shell's "open the ledger" Pressable
   * wrapped around the cluster. The action is forwarded through here instead.
   */
  onPress?: () => void;
}) {
  const hero = tone === 'hero';
  return (
    <InfoTip
      text={explainer}
      align="right"
      accessibilityLabel={`${name}: ${name === 'Money' ? formatCurrency(value) : formatCompactNumber(value)}. ${explainer}${onPress === undefined ? '' : ' Opens the club ledger.'}`}
      onPress={onPress}
    >
    <View
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
    </InfoTip>
  );
}

function DeveloperSaveControls({
  summaries,
  manualSaveSelecting,
  onPressSlot,
  onToggleManualSave,
}: {
  summaries: readonly DeveloperSaveSummary[];
  manualSaveSelecting: boolean;
  onPressSlot: (slot: DeveloperSaveSlot) => void;
  onToggleManualSave: () => void;
}) {
  const bySlot = new Map(summaries.map(summary => [summary.slot, summary]));
  const slotButton = (slot: DeveloperSaveSlot, manual: boolean) => {
    const summary = bySlot.get(slot);
    const choosingTarget = manual && manualSaveSelecting;
    // While S is active, A-E are save destinations and every load control is
    // frozen. That prevents a filled weekly slot from looking live while its
    // press is deliberately ignored by the manual-save flow.
    const enabled = choosingTarget || (!manualSaveSelecting && summary !== undefined);
    const purpose = choosingTarget
      ? `Save the current game to manual slot ${slot}`
      : summary === undefined
        ? `${manual ? 'Manual' : 'Weekly'} save slot ${slot}, empty`
        : `Load ${manual ? 'manual' : 'weekly'} save slot ${slot}, season ${summary.season}, week ${summary.week}`;
    return (
      <Pressable
        key={slot}
        accessibilityRole="button"
        accessibilityLabel={purpose}
        accessibilityState={{ disabled: !enabled }}
        disabled={!enabled}
        hitSlop={3}
        onPress={() => onPressSlot(slot)}
        className={choosingTarget
          ? 'h-8 w-6 items-center justify-center border-2 border-gold-dark bg-gold-light'
          : summary !== undefined
            ? 'h-8 w-6 items-center justify-center border-2 border-blue-dark bg-blue-light'
            : 'h-8 w-6 items-center justify-center border border-ink/25 bg-white'}
        style={({ pressed }) => ({ opacity: !enabled ? 0.35 : pressed ? 0.65 : 1 })}
      >
        <Text maxFontSizeMultiplier={1} className="font-mono text-xs font-bold text-ink">{slot}</Text>
      </Pressable>
    );
  };

  return (
    <View className="flex-row items-center gap-0.5">
      {DEVELOPER_AUTO_SLOT_LABELS.map(slot => slotButton(slot, false))}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={manualSaveSelecting ? 'Cancel manual save' : 'Choose a manual save slot'}
        onPress={onToggleManualSave}
        hitSlop={3}
        className={manualSaveSelecting
          ? 'h-8 w-6 items-center justify-center border-2 border-gold-dark bg-gold'
          : 'h-8 w-6 items-center justify-center border-2 border-ink bg-paper'}
        style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}
      >
        <Text maxFontSizeMultiplier={1} className="font-mono text-xs font-bold text-ink">S</Text>
      </Pressable>
      {DEVELOPER_MANUAL_SLOT_LABELS.map(slot => slotButton(slot, true))}
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
  /** Present only while Debug-build Developer Mode is on. */
  developerSaveSummaries?: readonly DeveloperSaveSummary[];
  developerManualSaveSelecting?: boolean;
  onPressDeveloperSaveSlot?: (slot: DeveloperSaveSlot) => void;
  onToggleDeveloperManualSave?: () => void;
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
  // '›' is in Silkscreen; '▸' is not and rendered in the fallback face.
  advanceWeekLabel = 'Advance Week  ›',
  advanceWeekDisabled = false,
  keyboardShortcutsEnabled = true,
  guideFocus,
  guideObjective,
  onGuideObjectivePress,
  guideTarget,
  onMoneyGuideAnchorChange,
  onNavigationGuideAnchorChange,
  onDismissGuidance,
  developerSaveSummaries,
  developerManualSaveSelecting = false,
  onPressDeveloperSaveSlot,
  onToggleDeveloperManualSave,
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
  const developerControlsVisible = developerSaveSummaries !== undefined
    && onPressDeveloperSaveSlot !== undefined
    && onToggleDeveloperManualSave !== undefined;

  // Forwarded into each chip's InfoTip: the chips cover essentially the whole
  // cluster, so the outer ledger Pressable below only ever receives taps in the
  // gaps. The click cue the outer SfxPressable would have played rides along.
  const openLedgerFromChip = onOpenLedger === undefined
    ? undefined
    : () => {
        playUiClickSfx();
        onOpenLedger();
      };
  const resourceCluster = (
    <View className="flex-shrink flex-row items-center gap-1.5">
      <View
        ref={moneyGuideAnchor.anchorRef}
        collapsable={false}
        onLayout={moneyGuideAnchor.scheduleMeasurement}
        className={guideFocus === 'money' ? 'border-2 border-blue-dark bg-blue-light p-1' : undefined}
      >
        <ResourceChip glyph="$" name="Money" explainer="Cash. Wages come out of it every week, and it pays for facilities, transfers and coaches." value={resources.money} onPress={openLedgerFromChip} />
      </View>
      <ResourceChip glyph="TP" name="Training points" explainer="Training Points. Earned each week and spent on drills — the only thing that improves a player." value={resources.trainingPoints} onPress={openLedgerFromChip} />
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
          {developerControlsVisible ? (
            <DeveloperSaveControls
              summaries={developerSaveSummaries}
              manualSaveSelecting={developerManualSaveSelecting}
              onPressSlot={onPressDeveloperSaveSlot}
              onToggleManualSave={onToggleDeveloperManualSave}
            />
          ) : null}
          {!developerControlsVisible ? <View className="flex-row items-center gap-2">
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
          </View> : null}
        </View>
        <View className={developerControlsVisible
          ? 'mt-2 flex-row items-center gap-2 border-t border-ink/15 pt-2'
          : 'mt-2 border-t border-ink/15 pt-2'}>
          <Text
            className={developerControlsVisible
              ? `min-w-0 flex-1 font-pixel text-sm uppercase ${developerManualSaveSelecting ? 'text-gold-dark' : 'text-blue-dark'}`
              : 'font-pixel text-sm uppercase text-blue-dark'}
            numberOfLines={1}
            adjustsFontSizeToFit
            accessibilityLabel={developerManualSaveSelecting
              ? 'Choose manual save slot A through E'
              : headerLine.spoken}
            maxFontSizeMultiplier={CHROME_MAX_FONT_SIZE_MULTIPLIER}
          >
            {developerManualSaveSelecting ? 'Choose A–E to save' : headerLine.visible}
          </Text>
          {developerControlsVisible ? (
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
              ) : resourceCluster}
              {onOpenSettings ? <SettingsButton onPress={onOpenSettings} /> : null}
            </View>
          ) : null}
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
              // Strip either arrow glyph: App still passes labels with '▸'.
              ? `Bert says: read the desk, then ${advanceWeekLabel.replace(/[▸›]/g, '').trim()}`
              : advanceWeekLabel.replace(/[▸›]/g, '').trim()}
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
