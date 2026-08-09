import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadCatalog } from '../../i18n';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');
const screen = read('src/ui/screens/ClubFinancesScreen.tsx');
const tabs = read('src/ui/components/ScreenTabs.tsx');
const confirmation = read('src/ui/components/ConfirmationSheet.tsx');
const scorecard = read('src/ui/components/Scorecard.tsx');
const app = read('App.tsx');
const seasonEnd = read('src/ui/screens/SeasonEndScreen.tsx');
const harness = read('src/ui/dev-harness/entries/club-business.tsx');
const palette = read('tailwind.config.js');

describe('Club Business phone and accessibility contracts', () => {
  it('keeps the phone cash summary to two columns and preserves the club name', () => {
    const cashPanel = /function CashPositionSection[\s\S]*?function EmergencyLoanSection/.exec(screen)?.[0];
    expect(cashPanel).toBeDefined();
    expect(cashPanel).toContain("<Metric label={t('clubFinances.balance')}");
    expect(cashPanel).toMatch(/clubFinances\.nextFourWeeksTypical[\s\S]*?<\/View>\s*<View className="mt-2 flex-row gap-2">[\s\S]*?clubFinances\.fourWeekBalanceTypical/);
    expect(cashPanel).toContain('<View className="mt-2 flex-row">');
    expect(screen).toMatch(/viewModel\.clubName[\s\S]{0,120}numberOfLines=\{2\}|numberOfLines=\{2\}[\s\S]{0,120}viewModel\.clubName/);
  });

  it('shows one sponsor slot panel at a time and links each tab to it', () => {
    expect(screen).toContain('idPrefix="sponsor-slots"');
    expect(screen).toContain('linkPanels');
    expect(screen).toContain('nativeID={`sponsor-slots-panel-${selected.slot}`}');
    expect(screen).toContain('webSponsorPanelProps(`sponsor-slots-tab-${selected.slot}`)');
    expect(screen).toContain('selected.offers.map(offer => (');
  });

  it('moves keyboard focus with sponsor tab selection', () => {
    expect(tabs).toContain("if (key === 'ArrowRight')");
    expect(tabs).toContain("else if (key === 'Home')");
    expect(tabs).toContain('document.getElementById(`${tabSetId}-tab-${next.id}`)?.focus();');
    expect(tabs).toContain("tabIndex: input.selected ? 0 : -1");
  });

  it('moves the Season 3 walkthrough to the real Buzz progress element', () => {
    expect(screen).toContain('const sponsorBuzzAccessibilityRef = useRef<View>(null);');
    expect(screen).toContain('sponsorBuzzAccessibilityRef.current ?? sponsorBuzzTargetRef.current');
    expect(screen).toContain('focusGuideTarget(focusTarget);');
    expect(screen).toContain('focusTargetRef={sponsorBuzzAccessibilityRef}');
    expect(screen).toMatch(/ref=\{focusTargetRef\}[\s\S]*?accessibilityRole="progressbar"/);
  });

  it('keeps the confirmation focus boundary modal, reversible, and touch sized', () => {
    expect(confirmation).toContain('accessibilityViewIsModal');
    expect(confirmation).toContain("role: 'dialog'");
    expect(confirmation).toContain("'aria-modal': true");
    expect(confirmation).toContain('onKeyDown: trapWebDialogFocus');
    expect(confirmation).toContain("if (event.shiftKey && activeIndex <= 0)");
    expect(confirmation).toContain("else if (!event.shiftKey && active === last)");
    expect(confirmation).toContain('focusable={false}');
    expect(confirmation).toContain("return { tabIndex: -1, 'aria-hidden': true };");
    expect(confirmation).toContain("return { inert: true, 'aria-hidden': true };");
    expect(confirmation).toContain('onShow={scheduleHeadingFocus}');
    expect(confirmation).toContain("document.getElementById('club-confirmation-heading')");
    expect(confirmation).toContain('headingFocusFrameRef.current = requestAnimationFrame(focusHeading);');
    expect(confirmation).toContain('headingFocusTimerRef.current = setTimeout(() => {');
    expect(confirmation).toContain('onDismiss={completeDismissal}');
    expect(confirmation).toContain("Platform.OS !== 'android'");
    expect(confirmation).toContain('onRequestClose={cancel}');
    expect(confirmation.indexOf('accessibilityViewIsModal'))
      .toBeLessThan(confirmation.indexOf('className="absolute inset-0"'));
    expect(app).toContain('onAfterConfirmDismiss: () => {');
    expect(app).toContain("if (Platform.OS !== 'web')");
    expect(app).toContain('focusSponsorSummaryToken={sponsorSummaryFocusToken}');
    expect(scorecard).toContain('style={[{ minHeight: 44,');
  });

  it('uses a phone-safe signing label while the dialog carries the full terms', () => {
    expect(app).toContain("confirmLabel: 'Sign deal'");
    expect(app).toContain('Objective: ${offer.objectiveLabel}. Target bonus');
    expect(app).toContain('On Chairman, the club receives');
  });

  it('does not report a dismissed raw-save share sheet as a successful export', () => {
    expect(app).toContain('const result = await Share.share');
    expect(app).toContain('if (result.action !== Share.sharedAction)');
    expect(app).toContain("throw new Error('the share sheet was dismissed')");
  });

  it('shows both target outcomes and the actual Week 30 cash before season rollover', () => {
    expect(seasonEnd).toContain('viewModel.clubBusinessSettlement');
    expect(seasonEnd).toContain("t('seasonEnd.seasonEndPayday')");
    expect(seasonEnd).toContain("label={result.met ? t('seasonEnd.targetMet') : t('seasonEnd.targetMissed')}");
    expect(seasonEnd).toContain("t('seasonEnd.clubReceived', { amount: formatCurrency(t, result.actualBonus) })");
    expect(loadCatalog('en').strings['seasonEnd.clubReceived']).toBe('Club received {amount}');
    expect(seasonEnd).toContain('viewModel.clubBusinessSettlement.buzz.actualPayout');
  });

  it('stacks the season record and full goals line on phones', () => {
    expect(seasonEnd).toContain("<View className={wide ? 'mt-3 flex-row gap-2' : 'mt-3 gap-2'}>");
    expect(seasonEnd).toMatch(/Metric label={t\(.seasonEnd.record.\)}[\s\S]*?Metric label={t\(.seasonEnd.goals.\)}/);
  });

  it('reviews a real season-end transition plus failed and long-copy pressure states', () => {
    expect(harness).toContain("'season-end-results'");
    expect(harness).toContain("'long-copy'");
    expect(harness).toContain("const reduceMotion = caseId !== 'confirm-offer';");
    expect(harness).toContain('advanceWeek(prepareRealSeasonEnd(ready))');
    expect(harness).toContain("label: 'Score 99 league goals'");
    expect(harness).toContain('Northstar Community Equipment Cooperative');
    expect(harness).not.toContain('objectiveWinner');
  });

  it('uses an AA-safe guided-heading color on the blue focus background', () => {
    const sponsorHeading = /function SponsorHeading[\s\S]*?function ActiveSponsorCard/.exec(screen)?.[0];
    expect(sponsorHeading).toContain('text-ink');
    expect(sponsorHeading).not.toContain('text-blue-dark');

    const ink = paletteColor('ink');
    const focusBlue = paletteColor('blue-light');
    expect(contrastRatio(ink, focusBlue)).toBeGreaterThanOrEqual(4.5);

    const pitchInk = paletteColor('pitch-ink');
    for (const surface of ['white', 'paper', 'pitch-light', 'gold-light'] as const) {
      const surfaceColor = surface === 'white' ? '#ffffff' : paletteColor(surface);
      expect(contrastRatio(pitchInk, surfaceColor)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrastRatio(blendHex(paletteColor('paper'), pitchInk, 0.75), pitchInk))
      .toBeGreaterThanOrEqual(4.5);
    expect(seasonEnd).toContain('bg-pitch-ink');
    expect(seasonEnd).not.toContain('bg-pitch-dark');
    expect(read('src/ui/components/ChalkboardStage.tsx'))
      .toContain('<Text accessibilityRole="header"');
  });
});

function paletteColor(name: string): string {
  const key = name.includes('-') ? `'${name}'` : name;
  const match = new RegExp(`${key}:\\s*'(#[0-9a-fA-F]{6})'`).exec(palette);
  if (match === null) throw new Error(`missing ${name} from the UI palette`);
  return match[1];
}

function contrastRatio(first: string, second: string): number {
  const [lighter, darker] = [relativeLuminance(first), relativeLuminance(second)]
    .sort((left, right) => right - left);
  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map(index => Number.parseInt(hex.slice(index, index + 2), 16) / 255)
    .map(channel => channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function blendHex(foreground: string, background: string, opacity: number): string {
  const channel = (hex: string, index: number) => Number.parseInt(hex.slice(index, index + 2), 16);
  const blended = [1, 3, 5].map(index => Math.round(
    channel(foreground, index) * opacity + channel(background, index) * (1 - opacity),
  ));
  return `#${blended.map(value => value.toString(16).padStart(2, '0')).join('')}`;
}
