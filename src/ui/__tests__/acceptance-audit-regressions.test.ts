import { readFileSync } from 'fs';
import { join } from 'path';
import { ENGINE_VERSION } from '../../sim/match';

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('player-facing acceptance audit regressions', () => {
  test('opens the story with the intended 15 of 17 roster truth', () => {
    expect(source('src/ui/screens/NewGameWelcomeScreen.tsx'))
      .toContain('Fifteen players. Two open shirts. Zero heroes.');
  });

  test('resumes character creation from the saved career difficulty', () => {
    const creation = source('src/ui/screens/CharacterCreationScreen.tsx');
    const app = source('App.tsx');

    expect(creation).toContain('initialDifficulty: DifficultyMode;');
    expect(creation).toContain('useState<DifficultyMode>(initialDifficulty)');
    expect(app).toContain("initialDifficulty={store.career.difficulty ?? 'COZY'}");
  });

  test('makes transient notices temporary and produces one clean spoken sentence', () => {
    const app = source('App.tsx');

    expect(app).toContain("if (tone === 'error') return undefined;");
    expect(app).toContain('setTimeout(onDismiss, 4_000)');
    expect(app).toContain('feedbackNoticeAccessibilityLabel(message)');
    expect(app).toContain("/[.!?]$/.test(trimmed)");
  });

  test('keeps facility accessibility copy equal to the visible build facts', () => {
    const club = source('src/ui/screens/ClubFinancesScreen.tsx');
    const notice = source('src/ui/FacilityProjectNotice.tsx');

    expect(club).toContain('entry.width} by ${entry.height} footprint');
    expect(club).toContain('Build time ${entry.buildWeeks}');
    expect(club).toContain('entry.blockedReason');
    expect(club).toContain('entry.affordabilityShortfall > 0');
    expect(notice).toContain('accessibilityLabel="Let them build. Close construction confirmation"');
  });

  test('announces the Bert instruction on guided tabs and reserves cue space', () => {
    const shell = source('src/ui/ManagementShell.tsx');
    const squad = source('src/ui/screens/SquadTrainingScreen.tsx');
    const club = source('src/ui/screens/ClubFinancesScreen.tsx');

    expect(shell).toContain('Bert says: ${tab.id === \'squad\' ? \'open Squad\' : \'return Home\'}');
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

    expect(summary).toContain('accessible={false}');
    expect(summary).toContain('style={StyleSheet.absoluteFill}');
    expect(summary).toContain('accessibilityLabel={`${line.label},');
  });

  test('labels net training-point movement truthfully for positive and negative weeks', () => {
    const summary = source('src/ui/PostMatchSummaryModal.tsx');

    expect(summary).toContain('label="TP change"');
    expect(summary).toContain('formatSignedCompactNumber(viewModel.trainingPointsGained)');
    expect(summary).not.toContain('value={`+${formatCompactNumber(viewModel.trainingPointsGained)}`}');
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
    expect(club).toContain('zIndex: placementActive ? 2 : 0');
    expect(club).toContain('zIndex: 3');
    expect(club).toContain('accessible={placementActive}');
    expect(club).toContain("`${buildable ? 'Build at' : 'Blocked at'} column ${x + 1}, row ${y + 1}`");
    expect(club).toContain("occupied\n                              ? 'transparent'");
    expect(club).toContain('width={artWidth}');
    expect(club).toContain('height={artHeight}');
    expect(club).not.toContain('placementActive && occupied');
    expect(club).toContain('accessibilityElementsHidden={placementActive}');
    expect(club).toContain("importantForAccessibility={placementActive ? 'no-hide-descendants' : 'auto'}");
  });

  test('exposes the current difficulty as informational text', () => {
    const settings = source('src/ui/SettingsOverlay.tsx');

    expect(settings).toContain('accessibilityRole="text" accessibilityLabel={`Career difficulty ${difficultyLabel}`}');
  });

  test('tells the player how to enter a current-week match day', () => {
    const home = source('src/ui/screens/ClubHomeScreen.tsx');

    expect(home).toContain("'Use Advance Week below'");
    expect(home).toContain("Use Advance Week below to prepare Match Day.");
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
