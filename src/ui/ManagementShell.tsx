import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import {
  ActionButton,
  formatCompactNumber,
  formatCurrency,
} from './components/Scorecard';
import type { ManagementTab, ResourceSummaryViewModel } from './models';
import { TutorialTapCue } from './TutorialTapCue';
import type { TutorialAnchorLayout } from './tutorial-cue-position';
import { SettingsButton } from './SettingsOverlay';
import { FansGlyph } from './components/FansGlyph';
import { SfxPressable as Pressable } from './components/SfxPressable';
import { playUiClickSfx } from '../render/management-sfx';
import { managementHeaderLine } from './management-header';
import { managementKeyBindings, tabNumberKey } from './management-key-bindings';
import { useKeyBindings } from './use-key-bindings';
import { PixelText } from './components/PixelText';
import { InfoTip } from './components/InfoTip';
import { useGuideAnchor } from './use-guide-anchor';
import { useCountUpNumber } from './use-count-up-number';
import { IdleAttract } from './components/IdleAttract';
import type { DeveloperSaveSlot, DeveloperSaveSummary } from '../persistence';
import { useCopy, type CopyFn } from '../i18n';
import {
  GuidanceDoubleFlash,
  type GuidanceNudgeTarget,
} from './GuidanceDoubleFlash';

const TABS: ReadonlyArray<{
  id: ManagementTab;
  labelKey: string;
  glyph: string;
  available: boolean;
  tipKey: string;
}> = [
  {
    id: 'home',
    labelKey: 'managementShell.tab.home',
    glyph: '⌂',
    available: true,
    tipKey: 'managementShell.tabTip.home',
  },
  {
    id: 'squad',
    labelKey: 'managementShell.tab.squad',
    glyph: '11',
    available: true,
    tipKey: 'managementShell.tabTip.squad',
  },
  {
    id: 'club',
    labelKey: 'managementShell.tab.club',
    glyph: '▦',
    available: true,
    tipKey: 'managementShell.tabTip.club',
  },
  {
    id: 'market',
    labelKey: 'managementShell.tab.market',
    glyph: '⇄',
    available: true,
    tipKey: 'managementShell.tabTip.market',
  },
  {
    id: 'league',
    labelKey: 'managementShell.tab.league',
    glyph: '≡',
    available: true,
    tipKey: 'managementShell.tabTip.league',
  },
];

// This one-line status header labels fixed desk data. Its complete sentence is
// also exposed through accessibilityLabel. Player actions below are not capped:
// they grow with the selected Dynamic Type category.
const FIXED_HEADER_MAX_FONT_SIZE_MULTIPLIER = 1.3;

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
function abbrev(t: CopyFn, n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000)
    return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (abs >= 10_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  return formatCompactNumber(t, n);
}

function ResourceChip({
  glyph,
  icon,
  name,
  explainer,
  value,
  money = false,
  tone,
  reduceMotion = false,
  onPress,
}: {
  /** Skipped when `icon` is given: the fans chip is drawn, not lettered. */
  glyph?: string;
  icon?: ReactNode;
  name: string;
  /** What the glyph buys, for the manager who has never been told what TP is. */
  explainer: string;
  value: number;
  /**
   * Whether the spoken figure is currency.
   *
   * A flag rather than `name === 'Money'`: the name is translated, so the old
   * comparison read the wrong formatter the moment the chip stopped being
   * English.
   */
  money?: boolean;
  tone?: 'hero';
  reduceMotion?: boolean;
  /**
   * The InfoTip anchor's inner Pressable claims the touch responder, so a tap
   * on the chip face never reaches the shell's "open the ledger" Pressable
   * wrapped around the cluster. The action is forwarded through here instead.
   */
  onPress?: () => void;
}) {
  const t = useCopy();
  const hero = tone === 'hero';
  // The chip face rolls to the new figure; the spoken label states the real
  // one. A screen reader must not have to wait out an animation, and the
  // rolling value is presentation, not the number the player is being told.
  const shownValue = useCountUpNumber(value, reduceMotion);
  const negativeMoney = money && shownValue < 0;
  const spoken = t('managementShell.a11y.resourceChip', {
    name,
    value: money ? formatCurrency(t, value) : formatCompactNumber(t, value),
    explainer,
  });
  return (
    <InfoTip
      text={explainer}
      align="right"
      accessibilityLabel={
        onPress === undefined
          ? spoken
          : `${spoken} ${t('managementShell.a11y.opensTheClubLedger')}`
      }
      onPress={onPress}
    >
      <View
        className={
          hero
            ? 'h-11 flex-row items-center gap-1 border-2 border-gold-dark bg-white px-2'
            : 'h-11 flex-row items-center gap-1 border-2 border-ink bg-white px-2'
        }
      >
        {/* font-pixel is the authored bold face; font-mono + font-bold would
          synthetically embolden the bitmap font and smear these glyphs. */}
        {icon ?? (
          <Text
            maxFontSizeMultiplier={1.2}
            className={
              hero
                ? 'font-pixel text-xs text-gold-dark'
                : negativeMoney
                  ? 'font-pixel text-xs text-red-dark'
                  : 'font-pixel text-xs text-blue-dark'
            }
          >
            {glyph}
          </Text>
        )}
        <Text
          maxFontSizeMultiplier={1.2}
          adjustsFontSizeToFit
          numberOfLines={1}
          className={
            hero
              ? 'font-mono text-sm text-gold-dark'
              : negativeMoney
                ? 'font-mono text-sm text-red-dark'
                : 'font-mono text-sm text-ink'
          }
        >
          {abbrev(t, shownValue)}
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
  const t = useCopy();
  const bySlot = new Map(summaries.map((summary) => [summary.slot, summary]));
  const slotButton = (slot: DeveloperSaveSlot, manual: boolean) => {
    const summary = bySlot.get(slot);
    const choosingTarget = manual && manualSaveSelecting;
    // While S is active, A-E are save destinations and every load control is
    // frozen. That prevents a filled weekly slot from looking live while its
    // press is deliberately ignored by the manual-save flow.
    const enabled =
      choosingTarget || (!manualSaveSelecting && summary !== undefined);
    const kind = t(
      manual ? 'managementShell.dev.manual' : 'managementShell.dev.weekly',
    );
    const kindLower = t(
      manual
        ? 'managementShell.dev.manualLower'
        : 'managementShell.dev.weeklyLower',
    );
    const purpose = choosingTarget
      ? t('managementShell.dev.a11y.saveToManualSlot', { slot })
      : summary === undefined
        ? t('managementShell.dev.a11y.emptySlot', { kind, slot })
        : t('managementShell.dev.a11y.loadSlot', {
            kind: kindLower,
            slot,
            season: summary.season,
            week: summary.week,
          });
    return (
      <Pressable
        key={slot}
        accessibilityRole="button"
        accessibilityLabel={purpose}
        accessibilityState={{ disabled: !enabled }}
        disabled={!enabled}
        hitSlop={3}
        onPress={() => onPressSlot(slot)}
        className={
          choosingTarget
            ? 'h-8 w-6 items-center justify-center border-2 border-gold-dark bg-gold-light'
            : summary !== undefined
              ? 'h-8 w-6 items-center justify-center border-2 border-blue-dark bg-blue-light'
              : 'h-8 w-6 items-center justify-center border border-ink/25 bg-white'
        }
        style={({ pressed }) => ({
          opacity: !enabled ? 0.35 : pressed ? 0.65 : 1,
        })}
      >
        <Text
          maxFontSizeMultiplier={1}
          className="font-mono text-xs font-bold text-ink"
        >
          {slot}
        </Text>
      </Pressable>
    );
  };

  return (
    <View className="flex-row items-center gap-0.5">
      {DEVELOPER_AUTO_SLOT_LABELS.map((slot) => slotButton(slot, false))}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          manualSaveSelecting
            ? t('managementShell.dev.a11y.cancelManualSave')
            : t('managementShell.dev.a11y.chooseAManualSaveSlot')
        }
        onPress={onToggleManualSave}
        hitSlop={3}
        className={
          manualSaveSelecting
            ? 'h-8 w-6 items-center justify-center border-2 border-gold-dark bg-gold'
            : 'h-8 w-6 items-center justify-center border-2 border-ink bg-paper'
        }
        style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}
      >
        <Text
          maxFontSizeMultiplier={1}
          className="font-mono text-xs font-bold text-ink"
        >
          S
        </Text>
      </Pressable>
      {DEVELOPER_MANUAL_SLOT_LABELS.map((slot) => slotButton(slot, true))}
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
  /** A tutorial job blocks progress but keeps the button pressable as a nudge. */
  advanceWeekGuidanceBlocked?: boolean;
  guidanceNudgeTarget?: GuidanceNudgeTarget;
  guidanceNudgeToken?: number;
  /** Resource figures land on their new value instead of rolling to it. */
  reduceMotion?: boolean;
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
  /** The focused blue inbox job and its deliberate escape back to the desk. */
  mustDoObjective?: string;
  onBackToInboxDuties?: () => void;
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
  reduceMotion = false,
  advanceWeekLabel,
  advanceWeekDisabled = false,
  advanceWeekGuidanceBlocked = false,
  guidanceNudgeTarget,
  guidanceNudgeToken,
  keyboardShortcutsEnabled = true,
  guideFocus,
  guideObjective,
  onGuideObjectivePress,
  mustDoObjective,
  onBackToInboxDuties,
  guideTarget,
  onMoneyGuideAnchorChange,
  onNavigationGuideAnchorChange,
  onDismissGuidance,
  developerSaveSummaries,
  developerManualSaveSelecting = false,
  onPressDeveloperSaveSlot,
  onToggleDeveloperManualSave,
}: ManagementShellProps) {
  const t = useCopy();
  // '›' is in Silkscreen; '▸' is not and rendered in the fallback face.
  const advanceWeek = advanceWeekLabel ?? t('managementShell.advanceWeek');
  const headerLine = managementHeaderLine(seasonLabel, weekLabel);
  const dismissFrameRef = useRef<number | null>(null);
  const dismissGuidanceAfterPress = useCallback(() => {
    if (onDismissGuidance === undefined || dismissFrameRef.current !== null)
      return;
    // RN web resolves Pressable.onPress after pointer-up. Waiting one frame lets
    // that action land before a disappearing cue reflows the control beneath it.
    dismissFrameRef.current = requestAnimationFrame(() => {
      dismissFrameRef.current = null;
      onDismissGuidance();
    });
  }, [onDismissGuidance]);
  useEffect(
    () => () => {
      if (dismissFrameRef.current !== null)
        cancelAnimationFrame(dismissFrameRef.current);
    },
    [],
  );

  // Desktop players drive the chrome from the keyboard; a no-op on phones.
  useKeyBindings(
    managementKeyBindings({
      tabs: TABS,
      onTabChange,
      onAdvanceWeek,
      advanceWeekDisabled,
    }),
    keyboardShortcutsEnabled,
  );

  const moneyGuideAnchor = useGuideAnchor(
    guideFocus === 'money',
    onMoneyGuideAnchorChange,
  );
  const navigationGuideAnchor = useGuideAnchor(
    guideFocus === 'navigation',
    onNavigationGuideAnchorChange,
  );
  const insets = useSafeAreaInsets();
  const developerControlsVisible =
    developerSaveSummaries !== undefined &&
    onPressDeveloperSaveSlot !== undefined &&
    onToggleDeveloperManualSave !== undefined;

  // Forwarded into each chip's InfoTip: the chips cover essentially the whole
  // cluster, so the outer ledger Pressable below only ever receives taps in the
  // gaps. The click cue the outer SfxPressable would have played rides along.
  const openLedgerFromChip =
    onOpenLedger === undefined
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
        className={
          guideFocus === 'money'
            ? 'border-2 border-blue-dark bg-blue-light p-1'
            : undefined
        }
      >
        <ResourceChip
          glyph="$"
          name={t('managementShell.money')}
          explainer={t('managementShell.moneyExplainer')}
          money
          value={resources.money}
          reduceMotion={reduceMotion}
          onPress={openLedgerFromChip}
        />
      </View>
      <ResourceChip
        glyph="TP"
        name={t('managementShell.trainingPoints')}
        explainer={t('managementShell.trainingPointsExplainer')}
        value={resources.trainingPoints}
        reduceMotion={reduceMotion}
        onPress={openLedgerFromChip}
      />
      {/* Last of the three, and the only one drawn rather than lettered: fans
          are not spent, they are what the gate and the merchandise are priced
          off, so the chip names the crowd in the crowd's own art. */}
      <ResourceChip
        icon={<FansGlyph />}
        name={t('managementShell.fans')}
        explainer={t('managementShell.fansExplainer')}
        value={resources.fans}
        reduceMotion={reduceMotion}
        onPress={openLedgerFromChip}
      />
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
        style={[
          styles.hudTopLayer,
          { paddingTop: insets.top + HUD_TOP_BREATHING_ROOM },
        ]}
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
          {!developerControlsVisible ? (
            <View className="flex-row items-center gap-2">
              {onOpenLedger ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t(
                    'managementShell.a11y.openTheClubLedger',
                  )}
                  onPress={onOpenLedger}
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.7 : undefined,
                  })}
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
          ) : null}
        </View>
        <View
          className={
            developerControlsVisible
              ? 'mt-2 flex-row items-center gap-2 border-t border-ink/15 pt-2'
              : 'mt-2 border-t border-ink/15 pt-2'
          }
        >
          <Text
            className={
              developerControlsVisible
                ? `min-w-0 flex-1 font-pixel text-sm uppercase ${developerManualSaveSelecting ? 'text-gold-dark' : 'text-blue-dark'}`
                : 'font-pixel text-sm uppercase text-blue-dark'
            }
            numberOfLines={1}
            adjustsFontSizeToFit
            accessibilityLabel={
              developerManualSaveSelecting
                ? t('managementShell.dev.a11y.chooseManualSaveSlotAThroughE')
                : headerLine.spoken
            }
            maxFontSizeMultiplier={FIXED_HEADER_MAX_FONT_SIZE_MULTIPLIER}
          >
            {developerManualSaveSelecting
              ? t('managementShell.dev.chooseASlotToSave')
              : headerLine.visible}
          </Text>
          {developerControlsVisible ? (
            <View className="flex-row items-center gap-2">
              {onOpenLedger ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t(
                    'managementShell.a11y.openTheClubLedger',
                  )}
                  onPress={onOpenLedger}
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.7 : undefined,
                  })}
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
          {mustDoObjective !== undefined &&
          onBackToInboxDuties !== undefined ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('managementShell.a11y.backToInbox', {
                objective: mustDoObjective,
              })}
              onPress={onBackToInboxDuties}
              className="relative mb-2 flex-row items-center border-2 border-b-4 border-blue-dark bg-blue-light px-3 py-2"
              style={({ pressed }) => ({
                opacity: pressed ? 0.72 : undefined,
              })}
            >
              <GuidanceDoubleFlash
                trigger={
                  advanceWeekGuidanceBlocked ? guidanceNudgeToken : undefined
                }
                reduceMotion={reduceMotion}
              />
              <Text className="font-mono text-xs font-bold uppercase text-blue-dark">
                {t('managementShell.backToInbox')}
              </Text>
              <Text className="ml-3 flex-1 font-pixel text-xs uppercase text-ink">
                {mustDoObjective}
              </Text>
              <Text className="font-mono text-lg font-bold text-ink">‹</Text>
            </Pressable>
          ) : null}
          {guideObjective ? (
            onGuideObjectivePress ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('managementShell.a11y.bertsCurrentJob', {
                  objective: guideObjective,
                })}
                onPress={onGuideObjectivePress}
                className="relative mb-2 flex-row items-center border-2 border-b-4 border-blue-dark bg-blue-light px-3 py-2"
                style={({ pressed }) => ({
                  opacity: pressed ? 0.72 : undefined,
                })}
              >
                <GuidanceDoubleFlash
                  trigger={
                    advanceWeekGuidanceBlocked && mustDoObjective === undefined
                      ? guidanceNudgeToken
                      : undefined
                  }
                  reduceMotion={reduceMotion}
                />
                <Text className="font-mono text-xs font-bold uppercase text-blue-dark">
                  {t('managementShell.bertsJob')}
                </Text>
                <Text className="ml-3 flex-1 font-pixel text-xs uppercase text-ink">
                  {guideObjective}
                </Text>
                <Text className="font-mono text-lg font-bold text-ink">›</Text>
              </Pressable>
            ) : (
              <View
                accessible
                accessibilityLabel={t('managementShell.a11y.bertsCurrentJob', {
                  objective: guideObjective,
                })}
                className="relative mb-2 flex-row items-center border-2 border-b-4 border-blue-dark bg-blue-light px-3 py-2"
              >
                <GuidanceDoubleFlash
                  trigger={
                    advanceWeekGuidanceBlocked && mustDoObjective === undefined
                      ? guidanceNudgeToken
                      : undefined
                  }
                  reduceMotion={reduceMotion}
                />
                <Text className="font-mono text-xs font-bold uppercase text-blue-dark">
                  {t('managementShell.bertsJob')}
                </Text>
                <Text className="ml-3 flex-1 font-pixel text-xs uppercase text-ink">
                  {guideObjective}
                </Text>
              </View>
            )
          ) : null}
          <View
            className={
              guideTarget === 'advance-week'
                ? 'relative border-2 border-blue-dark bg-blue-light p-1'
                : 'relative'
            }
            onPointerUp={(event) => {
              if (advanceWeekGuidanceBlocked) event.stopPropagation();
            }}
            onTouchEnd={(event) => {
              if (advanceWeekGuidanceBlocked) event.stopPropagation();
            }}
          >
            {guideTarget === 'advance-week' ? (
              <TutorialTapCue
                detail={t('managementShell.cueAdvanceWeek')}
                style={styles.advanceCue}
              />
            ) : null}
            {/* Once the desk is clear and nothing has moved for a few seconds,
              the week itself is the only thing left to do — so it asks. It
              waits while Bert still has a job for the player, because two
              things competing for attention is worse than none. */}
            <IdleAttract
              active={
                !advanceWeekDisabled &&
                !advanceWeekGuidanceBlocked &&
                !reduceMotion &&
                guideTarget !== 'advance-week'
              }
              restartKey={`${weekLabel}|${activeTab}|${guideObjective ?? ''}`}
            >
              <ActionButton
                label={advanceWeek}
                accessibilityLabel={
                  guideTarget === 'advance-week' || advanceWeekGuidanceBlocked
                    ? // Strip either arrow glyph: App still passes labels with '▸'.
                      t('managementShell.a11y.bertSaysReadTheDesk', {
                        action: advanceWeek.replace(/[▸›]/g, '').trim(),
                      })
                    : advanceWeek.replace(/[▸›]/g, '').trim()
                }
                onPress={onAdvanceWeek}
                disabled={advanceWeekDisabled}
                visuallyDisabled={advanceWeekGuidanceBlocked}
                pressSfx={advanceWeekGuidanceBlocked ? 'click' : undefined}
                compact
              />
            </IdleAttract>
          </View>
          <View
            ref={navigationGuideAnchor.anchorRef}
            collapsable={false}
            onLayout={navigationGuideAnchor.scheduleMeasurement}
            className={
              guideFocus === 'navigation'
                ? 'mt-2 flex-row border-2 border-blue-dark bg-blue-light/40'
                : 'mt-2 flex-row'
            }
            accessibilityRole="tablist"
          >
            {TABS.map((tab, index) => {
              const selected = tab.id === activeTab;
              const guideTab =
                guideTarget === 'home-tab'
                  ? 'home'
                  : guideTarget === 'squad-tab'
                    ? 'squad'
                    : undefined;
              const guided = guideTab === tab.id;
              const nudgeTab =
                guidanceNudgeTarget === 'home-tab'
                  ? 'home'
                  : guidanceNudgeTarget === 'squad-tab'
                    ? 'squad'
                    : guidanceNudgeTarget === 'training-plan' &&
                        activeTab !== 'squad'
                      ? 'squad'
                      : guidanceNudgeTarget === 'training-ground-alert' &&
                          activeTab !== 'home'
                        ? 'home'
                        : guidanceNudgeTarget === 'training-ground-facility' &&
                            activeTab !== 'club'
                          ? 'club'
                          : guidanceNudgeTarget === 'head-coach-market' &&
                              activeTab !== 'market'
                            ? 'market'
                            : guidanceNudgeTarget === 'coaching-office' &&
                                activeTab !== 'home' &&
                                activeTab !== 'club'
                              ? 'club'
                              : guidanceNudgeTarget === 'youth-intake' &&
                                  activeTab !== 'home' &&
                                  activeTab !== 'market'
                                ? 'market'
                                : undefined;
              const tabLabel = t(tab.labelKey);
              return (
                <Pressable
                  key={tab.id}
                  accessibilityRole="tab"
                  accessibilityLabel={
                    guided
                      ? t('managementShell.a11y.guidedTab', {
                          tab: tabLabel,
                          instruction:
                            tab.id === 'squad'
                              ? t('managementShell.a11y.openSquad')
                              : t('managementShell.a11y.returnHome'),
                        })
                      : tab.available
                        ? t('managementShell.a11y.tab', { tab: tabLabel })
                        : t('managementShell.a11y.tabUnavailable', {
                            tab: tabLabel,
                          })
                  }
                  accessibilityState={{ selected, disabled: !tab.available }}
                  disabled={!tab.available}
                  tip={
                    tab.available
                      ? t('managementShell.tabTipWithKey', {
                          tip: t(tab.tipKey),
                          key: tabNumberKey(index),
                        })
                      : t('managementShell.tabNotAvailableYet', {
                          tab: tabLabel,
                        })
                  }
                  onPress={() => onTabChange(tab.id)}
                  className={
                    guided
                      ? 'relative min-h-12 flex-1 items-center justify-center border-2 border-blue-dark bg-blue-light'
                      : 'relative min-h-12 flex-1 items-center justify-center'
                  }
                  style={({ pressed }) => ({
                    opacity: !tab.available ? 0.35 : pressed ? 0.7 : undefined,
                  })}
                >
                  <GuidanceDoubleFlash
                    trigger={
                      nudgeTab === tab.id ? guidanceNudgeToken : undefined
                    }
                    reduceMotion={reduceMotion}
                  />
                  {guided ? (
                    <TutorialTapCue
                      detail={
                        tab.id === 'squad'
                          ? t('managementShell.cueOpenSquad')
                          : t('managementShell.cueReturnHome')
                      }
                      labelOffsetX={tab.id === 'home' ? 42 : 0}
                      style={styles.tabCue}
                    />
                  ) : null}
                  <Text
                    className={
                      selected
                        ? 'font-pixel text-lg text-ink'
                        : 'font-mono text-lg text-ink/50'
                    }
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {tab.glyph}
                  </Text>
                  <PixelText
                    className={
                      selected
                        ? 'mt-1 text-sm uppercase text-ink'
                        : 'mt-1 text-sm uppercase text-ink/50'
                    }
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {tabLabel}
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
  // The content pane is the HUD's later sibling. Without a layer on the HUD
  // itself, that pane paints over every resource InfoTip, even though the
  // active InfoTip anchor has its own high z-index.
  hudTopLayer: { position: 'relative', zIndex: 1000, overflow: 'visible' },
  advanceCue: { left: '50%', marginLeft: -73, top: -78 },
  tabCue: { bottom: 54, left: '50%', marginLeft: -73 },
});
