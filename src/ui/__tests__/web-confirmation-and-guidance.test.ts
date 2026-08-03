import { readFileSync } from 'fs';
import { join } from 'path';

describe('cross-platform destructive confirmation and retained guidance', () => {
  const appSource = readFileSync(join(process.cwd(), 'App.tsx'), 'utf8');

  it('routes start-over through the in-app confirmation sheet instead of native Alert', () => {
    const start = appSource.indexOf('const startNewCareer = useCallback');
    const end = appSource.indexOf('\n\n  useEffect', start);
    const startOverHandler = appSource.slice(start, end);

    expect(startOverHandler).toContain('requestConfirmation({');
    expect(startOverHandler).toContain("confirmLabel: 'Erase and start over'");
    expect(startOverHandler).not.toContain('Alert.alert');
  });

  it('does not use React Native Alert for any web-facing error path', () => {
    expect(appSource).not.toContain('Alert.alert');
    expect(appSource).not.toMatch(/import\s*\{[^}]*\bAlert\b[^}]*\}\s*from\s*['"]react-native['"]/);
  });

  it('removes coach-card cues while retaining action-specific guidance until its target is used', () => {
    const market = readFileSync(join(process.cwd(), 'src/ui/screens/MarketScreen.tsx'), 'utf8');
    const shell = readFileSync(join(process.cwd(), 'src/ui/ManagementShell.tsx'), 'utf8');
    const legacy = readFileSync(join(process.cwd(), 'src/ui/screens/ClubLegacyScreen.tsx'), 'utf8');
    const match = readFileSync(join(process.cwd(), 'src/render/MatchScreen.tsx'), 'utf8');

    expect(market).not.toContain('detail="If you want to hire this coach"');
    expect(shell).toContain('onPointerUp={dismissGuidanceAfterPress}');
    expect(shell).toContain('onTouchEnd={dismissGuidanceAfterPress}');
    expect(shell).toContain('requestAnimationFrame(() => {');
    expect(appSource).toContain('setTipDismissSequence(sequence => sequence + 1)');
    expect(appSource).toContain("guideAlertId={visibleAssistantObjectiveTarget === 'training-ground-alert'");
    expect(appSource).toContain('lockOtherAlerts={assistantObjective?.target === \'training-ground-alert\'}');
    expect(appSource).toContain('onDismissGuidance={dismissVisibleTips}');
    expect(legacy).toContain('onTouchEnd={dismissGuidanceAfterPress}');
    expect(match).not.toContain('dismissFirstMatchCueAfterPress');
    expect(match).toContain("firstMatchTutorialStepRef.current = 'tired-player-cue';");
    expect(match).toContain("automaticPauseReasonsRef.current.delete('tutorial');");
  });

  it('keeps the first-week helper text after its floating arrow retires', () => {
    const shell = readFileSync(join(process.cwd(), 'src/ui/ManagementShell.tsx'), 'utf8');

    expect(appSource).toContain('guideTarget={hideCoachHiringCues ? undefined : visibleAssistantObjectiveTarget}');
    expect(appSource).toContain('guideObjective={assistantObjective?.text}');
    expect(appSource).not.toContain('guideObjective={visibleAssistantObjective');
    expect(shell).toContain("accessibilityLabel={`Bert's current job: ${guideObjective}`}");
    expect(shell).toContain('{guideObjective}</Text>');
    expect(shell).toContain("Bert's job");
  });

  it('never dismisses guidance before the press it collides with has landed', () => {
    // Dismissing on press-down dropped the cue and the room its screen reserved
    // above the highlighted control, so the control slid out from under the
    // finger and the tap the cue was asking for went to its replacement.
    const shell = readFileSync(join(process.cwd(), 'src/ui/ManagementShell.tsx'), 'utf8');

    expect(shell).not.toContain('onPointerDown={onDismissGuidance}');
    expect(shell).not.toContain('onTouchStart={onDismissGuidance}');
  });

  it('keeps the club name on the compact resource row', () => {
    const shell = readFileSync(join(process.cwd(), 'src/ui/ManagementShell.tsx'), 'utf8');
    const clubName = shell.indexOf('{clubName}');
    const resources = shell.indexOf('{resourceCluster}', clubName);
    const period = shell.indexOf('{headerLine.visible}');

    expect(clubName).toBeGreaterThan(0);
    expect(resources).toBeGreaterThan(clubName);
    expect(period).toBeGreaterThan(resources);
  });
});
