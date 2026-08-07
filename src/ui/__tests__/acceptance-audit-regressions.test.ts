import { readFileSync } from 'fs';
import { join } from 'path';
import { ENGINE_VERSION } from '../../sim/match';
import { loadCatalog } from '../../i18n';

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('player-facing acceptance audit regressions', () => {
  test('opens the story with the intended 15 of 17 roster truth', () => {
    // The sentence is catalog copy now; the brief still has to say it, so the
    // guarantee moves to the key the row draws.
    expect(source('src/ui/screens/NewGameWelcomeScreen.tsx'))
      .toContain("t('newGameWelcome.brief.meetTheSquadNote')");
  });

  test('resumes character creation from the saved career difficulty', () => {
    const creation = source('src/ui/screens/CharacterCreationScreen.tsx');
    const app = source('App.tsx');

    expect(creation).toContain('initialDifficulty: DifficultyMode;');
    expect(creation).toContain('useState<DifficultyMode>(initialDifficulty)');
    expect(app).toContain("initialDifficulty={store.career.difficulty ?? 'CHAIRMAN'}");
  });

  test('makes transient notices temporary and produces one clean spoken sentence', () => {
    const app = source('App.tsx');

    expect(app).toContain("if (tone === 'error') return undefined;");
    expect(app).toContain('setTimeout(onDismiss, 4_000)');
    expect(app).toContain('feedbackNoticeAccessibilityLabel(message, t)');
    expect(loadCatalog('en').strings['app.a11y.tapToDismiss']).toBe('{sentence} Tap to dismiss.');
    expect(app).toContain("/[.!?]$/.test(trimmed)");
  });

  test('keeps facility accessibility copy equal to the visible build facts', () => {
    const club = source('src/ui/screens/ClubFinancesScreen.tsx');
    const notice = source('src/ui/FacilityProjectNotice.tsx');

    // The card's label is composed from catalog sentences now, so the guarantee
    // is that the same facts are still passed in — footprint, build time, the
    // blocked reason and the shortfall.
    expect(club).toContain("t('clubFinances.a11y.facilityCard', {");
    expect(club).toContain('width: entry.width,');
    expect(club).toContain('height: entry.height,');
    expect(club).toContain("t('clubFinances.a11y.buildTimeWeeks', {");
    expect(club).toContain('n: entry.buildWeeks, count: entry.buildWeeks,');
    expect(club).toContain('entry.blockedReason');
    expect(club).toContain('entry.affordabilityShortfall > 0');
    expect(notice).toContain("t('facilityProjectNotice.a11y.letThemBuildCloseConfirmation')");
    expect(loadCatalog('en').strings['facilityProjectNotice.a11y.letThemBuildCloseConfirmation'])
      .toBe('Let them build. Close construction confirmation');
  });

  test('announces the Bert instruction on guided tabs and reserves cue space', () => {
    const shell = source('src/ui/ManagementShell.tsx');
    const squad = source('src/ui/screens/SquadTrainingScreen.tsx');
    const club = source('src/ui/screens/ClubFinancesScreen.tsx');

    // The instruction is catalog copy now; what this test still guards is that a
    // guided tab announces the tab AND the per-tab instruction, and that the
    // instruction still differs between Squad and Home.
    expect(shell).toContain("t('managementShell.a11y.guidedTab'");
    expect(shell).toContain("? t('managementShell.a11y.openSquad')");
    expect(shell).toContain(": t('managementShell.a11y.returnHome')");
    const strings = loadCatalog('en').strings;
    expect(strings['managementShell.a11y.guidedTab']).toBe('{tab} tab. Bert says: {instruction}');
    expect(strings['managementShell.a11y.openSquad']).toBe('open Squad');
    expect(strings['managementShell.a11y.returnHome']).toBe('return Home');
    expect(squad).toContain("'relative mt-20 border-4 border-blue-dark bg-blue-light p-1'");
    expect(club).toContain("'relative mt-20 border-2 border-blue-dark bg-blue-light p-1'");
  });

  test('keeps awakening presentation styled and announces the actual reward', () => {
    const awakening = source('src/ui/screens/AwakeningCutsceneScreen.tsx');

    expect(awakening).toContain('<View style={[\n            styles.storyPanel,');
    expect(awakening).toContain('viewModel.playerName');
    expect(awakening).toContain('viewModel.powerName');
    expect(awakening).toContain('viewModel.licenseLabel');
  });

  test('does not collapse the match statement into its dismiss backdrop', () => {
    const summary = source('src/ui/PostMatchSummaryModal.tsx');
    const statement = source('src/ui/components/FinancialStatement.tsx');

    expect(summary).toContain('accessible={false}');
    expect(summary).toContain('style={StyleSheet.absoluteFill}');
    // The row labels moved into the statement component with the reveal math;
    // every row still narrates itself rather than dissolving into the panel.
    expect(statement).toContain('accessibilityLabel={rowAccessibilityLabel(line, t)}');
    expect(statement).toContain(
      "return t('financialStatement.a11y.rowPlain', { label: line.label, amount: signed });",
    );
  });

  test('labels net training-point movement truthfully for positive and negative weeks', () => {
    const body = source('src/ui/components/FinancialReportBody.tsx');

    expect(body).toContain("label={t('financialReport.tpChange')}");
    expect(loadCatalog('en').strings['financialReport.tpChange']).toBe('TP change');
    // The count-up formatter keeps the signed presentation the old
    // formatSignedCompactNumber call guaranteed.
    expect(body).toContain("format={amount => `${amount > 0 ? '+' : ''}${formatCompactNumber(amount)}`}");
    expect(body).not.toContain('value={`+${formatCompactNumber(viewModel.trainingPointsGained)}`}');
  });

  test('uses native text rows for noninteractive ledger entries', () => {
    const club = source('src/ui/screens/ClubFinancesScreen.tsx');

    expect(club).toContain('if (onOpenLedgerLine === undefined)');
    expect(club).toContain('accessibilityRole="text"');
    expect(club).not.toContain('disabled={!onOpenLedgerLine}');
  });

  test('keeps placement cells exposed while completed facility art fills its footprint', () => {
    const club = source('src/ui/screens/ClubFinancesScreen.tsx');

    expect(club).toContain("position: 'relative'");
    // The hovered SfxPressable has to share the grid's stacking context so its
    // raised tooltip can clear the absolutely positioned building layer.
    expect(club).not.toContain('zIndex: placementActive ? 2 : 0');
    expect(club).toContain('shared hover-tip host raises only the active cell');
    expect(club).toContain('zIndex: 3');
    expect(club).toContain('accessible={placementActive}');
    expect(club).toContain("? 'clubFinances.a11y.buildAtColumnRow'");
    expect(club).toContain(": 'clubFinances.a11y.blockedAtColumnRow'");
    expect(club).toContain('{ column: x + 1, row: y + 1 },');
    expect(club).toContain("occupied\n                              ? 'transparent'");
    expect(club).toContain('width={artWidth}');
    expect(club).toContain('height={artHeight}');
    expect(club).not.toContain('placementActive && occupied');
    expect(club).toContain('accessibilityElementsHidden={placementActive}');
    expect(club).toContain("importantForAccessibility={placementActive ? 'no-hide-descendants' : 'auto'}");
  });

  test('exposes the current difficulty as informational text', () => {
    const settings = source('src/ui/SettingsOverlay.tsx');

    // Still a non-interactive text row announcing the difficulty; the level is
    // named from the catalog now, because COZY/CHAIRMAN is a code, not copy.
    expect(settings).toContain('accessibilityRole="text" accessibilityLabel={t(\'settings.difficulty.a11y\', { level: difficultyName })}');
    expect(settings).toContain("t(difficultyLabel === 'COZY' ? 'settings.difficulty.cozy' : 'settings.difficulty.chairman')");
  });

  test('marks the current match week and offers a button only when match day is ready', () => {
    const home = source('src/ui/screens/ClubHomeScreen.tsx');

    // Advancing the week is the bottom bar's job, so the card carries no
    // disabled stand-in button pointing at it.
    expect(home).toContain('{fixture.matchdayReady ? (');
    expect(home).not.toContain('Use Advance Week below');
    expect(home).not.toContain('Advance to fixture week');
    expect(home).toContain('const fixtureIsThisWeek = viewModel.isCurrentGameWeek;');
    expect(home).toContain('<MatchWeekMarquee active={fixtureIsThisWeek}>');
    expect(home).toContain('absolute -inset-3 border-2 border-ink bg-red-dark');
    expect(home).toContain('HORIZONTAL_MARQUEE_BULBS');
    expect(home).toContain('VERTICAL_MARQUEE_BULBS');
  });

  test('calls the active match option Play while retaining Quick Result', () => {
    const matchDay = source('src/ui/screens/FixtureMatchDayScreen.tsx');

    // The copy moved to the catalog, so the guarantee is checked in two parts:
    // the screen asks for these keys, and the keys still say Play, not Watch.
    expect(matchDay).toContain("t('fixtureMatchDay.playMatch')");
    expect(matchDay).toContain("t('fixtureMatchDay.quickResult')");
    const strings = loadCatalog('en').strings;
    expect(strings['fixtureMatchDay.playMatch']).toBe('Play match');
    expect(strings['fixtureMatchDay.play']).toBe('Play');
    expect(strings['fixtureMatchDay.quickResult']).toBe('Quick result');
    expect(strings['fixtureMatchDay.playMatch']).not.toMatch(/watch/i);
  });

  test('keeps the match-day docket free of redundant live-coaching and auto-context blocks', () => {
    const matchDay = source('src/ui/screens/FixtureMatchDayScreen.tsx');

    expect(matchDay).not.toContain('title="Live coaching"');
    expect(matchDay).not.toContain('Set the XI here. Shape the match live.');
    expect(matchDay).not.toContain('In context');
    expect(matchDay).not.toContain('activation. Powers fire automatically');
  });

  test('keeps the README engine marker synchronized with the replay version', () => {
    expect(source('README.md')).toContain(`Current engine: **${ENGINE_VERSION}**.`);
  });
});
