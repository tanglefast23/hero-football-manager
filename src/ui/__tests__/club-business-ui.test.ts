import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadCatalog } from '../../i18n';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');
const screen = read('src/ui/screens/ClubFinancesScreen.tsx');
const tabs = read('src/ui/components/ScreenTabs.tsx');
const confirmation = read('src/ui/components/ConfirmationSheet.tsx');
const scorecard = read('src/ui/components/Scorecard.tsx');
const chunkyControl = read('src/ui/components/ChunkyControl.tsx');
const app = read('App.tsx');
const seasonEnd = read('src/ui/screens/SeasonEndScreen.tsx');
const harness = read('src/ui/dev-harness/entries/club-business.tsx');
const palette = read('tailwind.config.js');

describe('Club Business phone and accessibility contracts', () => {
  it('keeps the phone cash summary to two columns and preserves the club name', () => {
    const cashPanel =
      /function CashPositionSection[\s\S]*?function EmergencyLoanSection/.exec(
        screen,
      )?.[0];
    expect(cashPanel).toBeDefined();
    expect(cashPanel).toContainSource(
      "<Metric label={t('clubFinances.balance')}",
    );
    expect(cashPanel).toMatchSource(
      /clubFinances\.nextFourWeeksTypical[\s\S]*?<\/View>\s*<View className="mt-2 flex-row gap-2">[\s\S]*?clubFinances\.fourWeekBalanceTypical/,
    );
    expect(cashPanel).toContainSource('<View className="mt-2 flex-row">');
    expect(screen).toMatchSource(
      /viewModel\.clubName[\s\S]{0,120}numberOfLines=\{2\}|numberOfLines=\{2\}[\s\S]{0,120}viewModel\.clubName/,
    );
  });

  it('shows one sponsor slot panel at a time and links each tab to it', () => {
    expect(screen).toContainSource('idPrefix="sponsor-slots"');
    expect(screen).toContainSource('linkPanels');
    expect(screen).toContainSource(
      'nativeID={`sponsor-slots-panel-${selected.slot}`}',
    );
    expect(screen).toContainSource(
      'webSponsorPanelProps(`sponsor-slots-tab-${selected.slot}`)',
    );
    expect(screen).toContainSource('selected.offers.map(offer => (');
  });

  it('moves keyboard focus with sponsor tab selection', () => {
    expect(tabs).toContainSource("if (key === 'ArrowRight')");
    expect(tabs).toContainSource("else if (key === 'Home')");
    expect(tabs).toContainSource(
      'document.getElementById(`${tabSetId}-tab-${next.id}`)?.focus();',
    );
    expect(tabs).toContainSource('tabIndex: input.selected ? 0 : -1');
  });

  it('keeps the confirmation focus boundary modal, reversible, and touch sized', () => {
    expect(confirmation).toContainSource('accessibilityViewIsModal');
    expect(confirmation).toContainSource("role: 'dialog'");
    expect(confirmation).toContainSource("'aria-modal': true");
    expect(confirmation).toContainSource('onKeyDown: trapWebDialogFocus');
    expect(confirmation).toContainSource(
      'if (event.shiftKey && activeIndex <= 0)',
    );
    expect(confirmation).toContainSource(
      'else if (!event.shiftKey && active === last)',
    );
    expect(confirmation).toContainSource('focusable={false}');
    expect(confirmation).toContainSource(
      "return { tabIndex: -1, 'aria-hidden': true };",
    );
    expect(confirmation).toContainSource(
      "return { inert: true, 'aria-hidden': true };",
    );
    expect(confirmation).toContainSource('onShow={scheduleHeadingFocus}');
    expect(confirmation).toContainSource(
      "document.getElementById('club-confirmation-heading')",
    );
    expect(confirmation).toContainSource(
      'headingFocusFrameRef.current = requestAnimationFrame(focusHeading);',
    );
    expect(confirmation).toContainSource(
      'headingFocusTimerRef.current = setTimeout(() => {',
    );
    expect(confirmation).toContainSource('onDismiss={completeDismissal}');
    expect(confirmation).toContainSource("Platform.OS !== 'android'");
    expect(confirmation).toContainSource('onRequestClose={cancel}');
    expect(confirmation.indexOf('accessibilityViewIsModal')).toBeLessThan(
      confirmation.indexOf('className="absolute inset-0"'),
    );
    expect(app).toContainSource('onAfterConfirmDismiss: () => {');
    expect(app).toContainSource(
      'setSponsorSummaryFocusToken(token => (token ?? 0) + 1);',
    );
    expect(app).toContainSource(
      'focusSponsorSummaryToken={sponsorSummaryFocusToken}',
    );
    expect(screen).toContainSource(
      'slot.provisional && slot.offers.length > 0',
    );
    expect(screen).toContainSource(
      'if (nextSlot !== undefined) setSelectedSponsorSlot(nextSlot.slot);',
    );
    expect(screen).toContainSource("kicker={t('clubFinances.sponsorDesk')}");
    expect(scorecard).toContainSource('<ChunkyControl');
    expect(chunkyControl).toContainSource('style={[{ minHeight: 44 }, style]}');
  });

  it('uses a phone-safe signing label while the dialog carries the full terms', () => {
    // Catalogued, not inline: these four sentences shipped in English to six of
    // the seven languages while they were literals in `App.tsx`. The dialog is
    // assembled from whole sentences so no translation has to carry a leading
    // space, so the terms are asserted key by key.
    const strings = loadCatalog('en').strings;
    expect(app).toContainSource("confirmLabel: t('confirm.sponsor.confirm')");
    expect(strings['confirm.sponsor.confirm']).toBe('Sign deal');
    expect(app).toContainSource("t('confirm.sponsor.objective'");
    expect(strings['confirm.sponsor.objective']).toBe(
      'Objective: {objective}. Target bonus {bonus}.',
    );
    expect(app).toContainSource(
      'fee: formatCurrency(t, offer.actualMonthlyFee)',
    );
    expect(app).toContainSource('bonus: formatCurrency(t, offer.actualBonus)');
    expect(app).not.toContainSource("t('confirm.sponsor.chairmanFee'");
  });

  it('shows both target outcomes and the actual Week 30 cash before season rollover', () => {
    expect(seasonEnd).toContainSource('viewModel.clubBusinessSettlement');
    expect(seasonEnd).toContainSource("t('seasonEnd.seasonEndPayday')");
    expect(seasonEnd).toContainSource(
      "label={result.met ? t('seasonEnd.targetMet') : t('seasonEnd.targetMissed')}",
    );
    expect(seasonEnd).toContainSource(
      "t('seasonEnd.clubReceived', { amount: formatCurrency(t, result.actualBonus) })",
    );
    expect(loadCatalog('en').strings['seasonEnd.clubReceived']).toBe(
      'Club received {amount}',
    );
  });

  it('stacks the season record and full goals line on phones', () => {
    expect(seasonEnd).toContainSource(
      "<View className={wide ? 'mt-3 flex-row gap-2' : 'mt-3 gap-2'}>",
    );
    expect(seasonEnd).toMatchSource(
      /Metric label={t\(.seasonEnd.record.\)}[\s\S]*?Metric label={t\(.seasonEnd.goals.\)}/,
    );
  });

  it('reviews a real season-end transition plus failed and long-copy pressure states', () => {
    expect(harness).toContainSource("'season-end-results'");
    expect(harness).toContainSource("'long-copy'");
    expect(harness).toContainSource(
      "const reduceMotion = caseId !== 'confirm-offer';",
    );
    expect(harness).toContainSource('advanceWeek(prepareRealSeasonEnd(ready))');
    expect(harness).toContainSource("label: 'Score 99 league goals'");
    expect(harness).toContainSource(
      'Northstar Community Equipment Cooperative',
    );
    expect(harness).not.toContainSource('objectiveWinner');
  });

  it('uses an AA-safe guided-heading color on the blue focus background', () => {
    const sponsorHeading =
      /function SponsorHeading[\s\S]*?function ActiveSponsorCard/.exec(
        screen,
      )?.[0];
    expect(sponsorHeading).toContainSource('text-ink');
    expect(sponsorHeading).not.toContainSource('text-blue-dark');

    const ink = paletteColor('ink');
    const focusBlue = paletteColor('blue-light');
    expect(contrastRatio(ink, focusBlue)).toBeGreaterThanOrEqual(4.5);

    const pitchInk = paletteColor('pitch-ink');
    for (const surface of [
      'white',
      'paper',
      'pitch-light',
      'gold-light',
    ] as const) {
      const surfaceColor =
        surface === 'white' ? '#ffffff' : paletteColor(surface);
      expect(contrastRatio(pitchInk, surfaceColor)).toBeGreaterThanOrEqual(4.5);
    }
    expect(
      contrastRatio(blendHex(paletteColor('paper'), pitchInk, 0.75), pitchInk),
    ).toBeGreaterThanOrEqual(4.5);
    expect(seasonEnd).toContainSource('bg-pitch-ink');
    expect(seasonEnd).not.toContainSource('bg-pitch-dark');
    expect(read('src/ui/components/ChalkboardStage.tsx')).toContainSource(
      '<Text accessibilityRole="header"',
    );
  });
});

function paletteColor(name: string): string {
  const key = name.includes('-') ? `'${name}'` : name;
  const match = new RegExp(`${key}:\\s*'(#[0-9a-fA-F]{6})'`).exec(palette);
  if (match === null) throw new Error(`missing ${name} from the UI palette`);
  return match[1];
}

function contrastRatio(first: string, second: string): number {
  const [lighter, darker] = [
    relativeLuminance(first),
    relativeLuminance(second),
  ].sort((left, right) => right - left);
  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5]
    .map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255)
    .map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    );
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function blendHex(
  foreground: string,
  background: string,
  opacity: number,
): string {
  const channel = (hex: string, index: number) =>
    Number.parseInt(hex.slice(index, index + 2), 16);
  const blended = [1, 3, 5].map((index) =>
    Math.round(
      channel(foreground, index) * opacity +
        channel(background, index) * (1 - opacity),
    ),
  );
  return `#${blended.map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}
