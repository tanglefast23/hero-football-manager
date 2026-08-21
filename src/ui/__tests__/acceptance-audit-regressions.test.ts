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
    expect(source('src/ui/screens/NewGameWelcomeScreen.tsx')).toContainSource(
      "t('newGameWelcome.brief.meetTheSquadNote')",
    );
  });

  test('resumes character creation from the saved career difficulty', () => {
    const creation = source('src/ui/screens/CharacterCreationScreen.tsx');
    const app = source('App.tsx');

    expect(creation).toContainSource('initialDifficulty: DifficultyMode;');
    expect(creation).toContainSource(
      'useState<DifficultyMode>(initialDifficulty)',
    );
    expect(app).toContainSource(
      "initialDifficulty={store.career.difficulty ?? 'CHAIRMAN'}",
    );
  });

  test('makes transient notices temporary and produces one clean spoken sentence', () => {
    const app = source('App.tsx');

    // Errors used to be the exception and sat there until tapped. A tap is not
    // a reliable exit — anything drawn over the banner eats it — so every tone
    // now retires itself on the same timer.
    expect(app).not.toContainSource("if (tone === 'error') return undefined;");
    expect(app).toContainSource('setTimeout(onDismiss, 4_000)');
    expect(app).toContainSource('}, [message, onDismiss]);');
    expect(app).toContainSource('feedbackNoticeAccessibilityLabel(message, t)');
    expect(loadCatalog('en').strings['app.a11y.tapToDismiss']).toBe(
      '{sentence} Tap to dismiss.',
    );
    expect(app).toContainSource('/[.!?]$/.test(trimmed)');
  });

  test('keeps the feedback notice tappable and at the two-column measure', () => {
    const app = source('App.tsx');

    // Nested under the screen, the banner sat beneath every overlay that
    // renders after it — a Bert walk-on, an inbox reminder — and those are
    // full-screen pressables, so they ate the tap meant to dismiss it. Last
    // child but for the tip layer is the only place nothing can cover it.
    const notice = app.indexOf('onDismiss={store.clearError}');
    const confirmation = app.indexOf('<ConfirmationSheet');
    const tips = app.indexOf('<InfoTipLayer />');
    expect(confirmation).toBeGreaterThan(-1);
    expect(notice).toBeGreaterThan(confirmation);
    expect(tips).toBeGreaterThan(notice);

    // Full-bleed across a desktop monitor disagreed with the columns under it.
    expect(app).toContainSource('w-full max-w-[1180px] border-2 px-4 py-3');
    expect(app).toContainSource('absolute left-4 right-4 top-32 items-center');
  });

  test('keeps facility accessibility copy equal to the visible build facts', () => {
    const club = source('src/ui/screens/ClubFinancesScreen.tsx');
    const notice = source('src/ui/FacilityProjectNotice.tsx');

    // The card's label is composed from catalog sentences now, so the guarantee
    // is that the same facts are still passed in — footprint, build time, the
    // blocked reason and the shortfall.
    expect(club).toContainSource("t('clubFinances.a11y.facilityCard', {");
    expect(club).toContainSource('width: entry.width,');
    expect(club).toContainSource('height: entry.height,');
    expect(club).toContainSource("t('clubFinances.a11y.buildTimeWeeks', {");
    expect(club).toContainSource(
      'n: entry.buildWeeks, count: entry.buildWeeks,',
    );
    expect(club).toContainSource('entry.blockedReason');
    expect(club).toContainSource('entry.affordabilityShortfall > 0');
    expect(notice).toContainSource(
      "t('facilityProjectNotice.a11y.letThemBuildCloseConfirmation')",
    );
    expect(
      loadCatalog('en').strings[
        'facilityProjectNotice.a11y.letThemBuildCloseConfirmation'
      ],
    ).toBe('Let them build. Close construction confirmation');
  });

  test('announces the Bert instruction on guided tabs and reserves cue space', () => {
    const shell = source('src/ui/ManagementShell.tsx');
    const squad = source('src/ui/screens/SquadTrainingScreen.tsx');
    const club = source('src/ui/screens/ClubFinancesScreen.tsx');

    // The instruction is catalog copy now; what this test still guards is that a
    // guided tab announces the tab AND the per-tab instruction, and that the
    // instruction still differs between Squad and Home.
    expect(shell).toContainSource("t('managementShell.a11y.guidedTab'");
    expect(shell).toContainSource("? t('managementShell.a11y.openSquad')");
    expect(shell).toContainSource(": t('managementShell.a11y.returnHome')");
    const strings = loadCatalog('en').strings;
    expect(strings['managementShell.a11y.guidedTab']).toBe(
      '{tab} tab. Bert says: {instruction}',
    );
    expect(strings['managementShell.a11y.openSquad']).toBe('open Squad');
    expect(strings['managementShell.a11y.returnHome']).toBe('return Home');
    expect(squad).toContainSource(
      "'relative border-4 border-blue-dark bg-blue-light p-1'",
    );
    expect(squad).toContainSource("label={t('squadTraining.tapHere')}");
    expect(club).toContainSource(
      "'relative mt-20 border-2 border-blue-dark bg-blue-light p-1'",
    );
  });

  test('keeps awakening presentation styled and announces the actual reward', () => {
    const awakening = source('src/ui/screens/AwakeningCutsceneScreen.tsx');

    expect(awakening).toContainSource(
      '<View style={[\n            styles.storyPanel,',
    );
    expect(awakening).toContainSource('viewModel.playerName');
    expect(awakening).toContainSource('viewModel.powerName');
    expect(awakening).toContainSource('viewModel.licenseLabel');
  });

  test('does not collapse the match statement into its dismiss backdrop', () => {
    const summary = source('src/ui/PostMatchSummaryModal.tsx');
    const statement = source('src/ui/components/FinancialStatement.tsx');

    expect(summary).toContainSource('accessible={false}');
    expect(summary).toContainSource('style={StyleSheet.absoluteFill}');
    // The row labels moved into the statement component with the reveal math;
    // every row still narrates itself rather than dissolving into the panel.
    expect(statement).toContainSource(
      'accessibilityLabel={rowAccessibilityLabel(line, t)}',
    );
    expect(statement).toContainSource(
      "return t('financialStatement.a11y.rowPlain', { label: line.label, amount: signed });",
    );
  });

  test('labels net training-point movement truthfully for positive and negative weeks', () => {
    const body = source('src/ui/components/FinancialReportBody.tsx');

    expect(body).toContainSource("label={t('financialReport.tpChange')}");
    expect(loadCatalog('en').strings['financialReport.tpChange']).toBe(
      'TP change',
    );
    // The count-up formatter keeps the signed presentation the old
    // formatSignedCompactNumber call guaranteed.
    expect(body).toContainSource(
      'format={amount => formatSignedCompactNumber(t, amount)}',
    );
    expect(body).not.toContainSource(
      'value={`+${formatCompactNumber(viewModel.trainingPointsGained)}`}',
    );
  });

  test('uses native text rows for noninteractive ledger entries', () => {
    const club = source('src/ui/screens/ClubFinancesScreen.tsx');

    expect(club).toContainSource('if (onOpenLedgerLine === undefined)');
    expect(club).toContainSource('accessibilityRole="text"');
    expect(club).not.toContainSource('disabled={!onOpenLedgerLine}');
  });

  test('keeps placement cells exposed while completed facility art fills its footprint', () => {
    const club = source('src/ui/screens/ClubFinancesScreen.tsx');

    expect(club).toContainSource("position: 'relative'");
    // The cells stay in the grid's stacking context while facility art uses
    // its own layer and becomes noninteractive during placement.
    expect(club).not.toContainSource('zIndex: placementActive ? 2 : 0');
    expect(club).not.toContainSource('facilityPlacementHoverTip');
    expect(club).toContainSource(
      'placementActive && previewCell && activeFootprint',
    );
    expect(club).toContainSource('zIndex: 3');
    expect(club).toContainSource('accessible={placementActive}');
    expect(club).toContainSource("? 'clubFinances.a11y.buildAtColumnRow'");
    expect(club).toContainSource(": 'clubFinances.a11y.blockedAtColumnRow'");
    expect(club).toContainSource('{ column: x + 1, row: y + 1 },');
    expect(club).toContainSource(
      "occupied\n                              ? 'transparent'",
    );
    expect(club).toContainSource('width={artWidth}');
    expect(club).toContainSource('height={artHeight}');
    expect(club).not.toContainSource('placementActive && occupied');
    expect(club).toContainSource(
      'accessibilityElementsHidden={placementActive}',
    );
    expect(club).toContainSource(
      "importantForAccessibility={placementActive ? 'no-hide-descendants' : 'auto'}",
    );
  });

  test('exposes the current difficulty as informational text', () => {
    const settings = source('src/ui/SettingsOverlay.tsx');

    // Still a non-interactive text row announcing the difficulty; the level is
    // named from the catalog now, because COZY/CHAIRMAN is a code, not copy.
    expect(settings).toContainSource(
      'accessibilityRole="text" accessibilityLabel={t(\'settings.difficulty.a11y\', { level: difficultyName })}',
    );
    expect(settings).toContainSource(
      "t(difficultyLabel === 'COZY' ? 'settings.difficulty.cozy' : 'settings.difficulty.chairman')",
    );
  });

  test('marks the current match week and offers a button only when match day is ready', () => {
    const home = source('src/ui/screens/ClubHomeScreen.tsx');

    // Advancing the week is the bottom bar's job, so the card carries no
    // disabled stand-in button pointing at it.
    expect(home).toContainSource('{fixture.matchdayReady ? (');
    expect(home).not.toContainSource('Use Advance Week below');
    expect(home).not.toContainSource('Advance to fixture week');
    expect(home).toContainSource(
      'const fixtureIsThisWeek = viewModel.isCurrentGameWeek;',
    );
    expect(home).toContainSource(
      '<MatchWeekMarquee active={fixtureIsThisWeek}>',
    );
    expect(home).toContainSource(
      'absolute -inset-3 border-2 border-ink bg-red-dark',
    );
    expect(home).toContainSource('HORIZONTAL_MARQUEE_BULBS');
    expect(home).toContainSource('VERTICAL_MARQUEE_BULBS');
  });

  test('keeps Quick Match hidden unless its setting is on', () => {
    const matchDay = source('src/ui/screens/FixtureMatchDayScreen.tsx');
    const app = source('App.tsx');

    expect(matchDay).toContainSource("t('fixtureMatchDay.playMatch')");
    expect(matchDay).toContainSource('quickMatchEnabled ? (');
    expect(matchDay).toContainSource("t('fixtureMatchDay.quickMatch')");
    expect(app).toContainSource(
      'quickMatchEnabled={preferences.quickMatchEnabled}',
    );
    expect(app).toContainSource('store.quickResult({');
    const strings = loadCatalog('en').strings;
    expect(strings['fixtureMatchDay.playMatch']).toBe('Play match');
    expect(strings['fixtureMatchDay.play']).toBe('Play');
    expect(strings['fixtureMatchDay.quickMatch']).toBe('Quick Match');
    expect(strings['fixtureMatchDay.playMatch']).not.toMatchSource(/watch/i);
  });

  test('lets each match choose and remember its opening formation', () => {
    const app = source('App.tsx');
    const matchDay = source('src/ui/screens/FixtureMatchDayScreen.tsx');
    const liveMatch = source('src/render/MatchScreen.tsx');

    // The chip opens a named picker now instead of cycling blind, so the
    // guarantee is the same and the wiring is `onSelectFormation`.
    expect(matchDay).toContainSource(
      'onSelectFormation: (formation: FormationId) => void;',
    );
    expect(app).toContainSource('onSelectFormation={selectFormationPreset}');
    expect(app).toContainSource(
      'formationPresets={preferences.formationPresets}',
    );
    expect(liveMatch).toContainSource('livePresets[0],');
    expect(liveMatch).toContainSource('onFormationChange?.(formation);');
  });

  test('offers every owned formation live, not just the three presets', () => {
    // A coach-taught fourth shape used to reach the pitch only by evicting one
    // of the three preset slots, because the live rail read the slots. It now
    // reads the same list the matchday picker offers, while slot 0 keeps
    // deciding the shape the match opens on.
    const app = source('App.tsx');
    const liveMatch = source('src/render/MatchScreen.tsx');

    expect(app).toContainSource('formationOptions={matchdayFormationOptions}');
    expect(app).toContainSource(
      'formationPresets={preferences.formationPresets}',
    );
    // Slot 0 still decides the shape the match opens on; the third argument
    // is the manager's HERO POWER setting, which does not touch formation.
    expect(liveMatch).toContainSource('livePresets[0],');
    expect(liveMatch).toContainSource('matchPoliciesForControlledTeam(');
  });

  test('never reorders the live formation chips under the manager', () => {
    // Remembering the pick moves it to slot 0 for the NEXT match. Read live,
    // that swapped the tapped chip's label with the first one's, so the white
    // border looked stuck on 4-4-2. The screen freezes the order at mount.
    const liveMatch = source('src/render/MatchScreen.tsx');

    expect(liveMatch).toContainSource(
      'const presetsRef = useRef(formationPresets);',
    );
    expect(liveMatch).toContainSource(
      'const optionsRef = useRef<readonly FormationId[]>(',
    );
    expect(liveMatch).toContainSource('formations={liveFormationOptions}');
    expect(liveMatch).toContainSource(
      'nextFormation(displayedFormation, liveFormationOptions),',
    );
    // Both live props may only be read to seed the frozen copies: the
    // destructure, the type, and the seed itself. `formationPresets` gets a
    // fourth read as the fallback when no option list is passed;
    // `formationOptions` gets two more because its seed rejects an empty list.
    expect(liveMatch.match(/formationPresets/g)).toHaveLength(4);
    expect(liveMatch.match(/formationOptions/g)).toHaveLength(5);
  });

  test('keeps the match-day docket free of redundant live-coaching and auto-context blocks', () => {
    const matchDay = source('src/ui/screens/FixtureMatchDayScreen.tsx');

    expect(matchDay).not.toContainSource('title="Live coaching"');
    expect(matchDay).not.toContainSource(
      'Set the XI here. Shape the match live.',
    );
    expect(matchDay).not.toContainSource('In context');
    expect(matchDay).not.toContainSource(
      'activation. Powers fire automatically',
    );
  });

  test('keeps the README engine marker synchronized with the replay version', () => {
    expect(source('README.md')).toContainSource(
      `Current engine: **${ENGINE_VERSION}**.`,
    );
  });
});
