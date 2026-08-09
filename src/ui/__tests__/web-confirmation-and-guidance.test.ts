import { readFileSync } from 'fs';
import { join } from 'path';
import { loadCatalog } from '../../i18n';

describe('cross-platform destructive confirmation and retained guidance', () => {
  const appSource = readFileSync(join(process.cwd(), 'App.tsx'), 'utf8');

  it('routes start-over through the in-app confirmation sheet instead of native Alert', () => {
    const start = appSource.indexOf('const beginNewCareer = useCallback');
    const end = appSource.indexOf(
      '\n\n  const startNewCareer = useCallback',
      start,
    );
    const beginNewCareerHandler = appSource.slice(start, end);

    expect(beginNewCareerHandler).toContainSource('requestConfirmation({');
    // The label is catalog copy now; what matters here is still that the sheet
    // carries a confirm label rather than falling back to a native Alert.
    expect(beginNewCareerHandler).toContainSource(
      "confirmLabel: copyRef.current('app.replaceSavedCareerConfirm')",
    );
    expect(loadCatalog('en').strings['app.replaceSavedCareerConfirm']).toBe(
      'Erase and start over',
    );
    expect(beginNewCareerHandler).not.toContainSource('Alert.alert');
  });

  it('does not use React Native Alert for any web-facing error path', () => {
    expect(appSource).not.toContainSource('Alert.alert');
    expect(appSource).not.toMatchSource(
      /import\s*\{[^}]*\bAlert\b[^}]*\}\s*from\s*['"]react-native['"]/,
    );
  });

  it('keeps a blocking Bert briefing outside an inert web and Android background', () => {
    const bert = readFileSync(
      join(process.cwd(), 'src/ui/BertBriefingWalkOn.tsx'),
      'utf8',
    );
    const speech = readFileSync(
      join(process.cwd(), 'src/ui/CharacterSpeechOverlay.tsx'),
      'utf8',
    );

    expect(appSource).toContainSource(
      'bertBriefingBackgroundProps(bertBriefingVisible)',
    );
    expect(appSource).toContainSource(
      'guideOverlayVisible || store.inboxDutyReminder !== null',
    );
    expect(bert).toContainSource(
      "return { role: 'dialog', 'aria-modal': true };",
    );
    expect(bert).toContainSource(
      "return { inert: true, 'aria-hidden': true };",
    );
    expect(bert).toContainSource("Platform.OS === 'android'");
    expect(bert).toContainSource(
      "importantForAccessibility: 'no-hide-descendants'",
    );
    expect(speech).toContainSource("if (Platform.OS === 'web') {");
    expect(speech).toContainSource(
      '(target as unknown as { focus?: () => void }).focus?.();',
    );
    expect(speech).toContainSource(
      'AccessibilityInfo.setAccessibilityFocus(handle)',
    );
    expect(bert).toContainSource('focusOnMount');
  });

  it('removes coach-card cues while retaining action-specific guidance until its target is used', () => {
    const market = readFileSync(
      join(process.cwd(), 'src/ui/screens/MarketScreen.tsx'),
      'utf8',
    );
    const shell = readFileSync(
      join(process.cwd(), 'src/ui/ManagementShell.tsx'),
      'utf8',
    );
    const legacy = readFileSync(
      join(process.cwd(), 'src/ui/screens/ClubLegacyScreen.tsx'),
      'utf8',
    );
    const match = readFileSync(
      join(process.cwd(), 'src/render/MatchScreen.tsx'),
      'utf8',
    );

    expect(market).not.toContainSource(
      'detail="If you want to hire this coach"',
    );
    expect(shell).toContainSource('onPointerUp={dismissGuidanceAfterPress}');
    expect(shell).toContainSource('onTouchEnd={dismissGuidanceAfterPress}');
    expect(shell).toContainSource('requestAnimationFrame(() => {');
    expect(appSource).toContainSource(
      'setTipDismissSequence(sequence => sequence + 1)',
    );
    expect(appSource).toContainSource(
      "guideAlertId={visibleAssistantObjectiveTarget === 'training-ground-alert'",
    );
    expect(appSource).toContainSource(
      "focusGuidedAlert={assistantObjective?.target === 'training-ground-alert'}",
    );
    expect(appSource).toContainSource('onDismissGuidance={dismissVisibleTips}');
    expect(legacy).toContainSource('onTouchEnd={dismissGuidanceAfterPress}');
    expect(match).not.toContainSource('dismissFirstMatchCueAfterPress');
    expect(match).toContainSource(
      "firstMatchTutorialStepRef.current = 'tired-player-cue';",
    );
    expect(match).toContainSource(
      "automaticPauseReasonsRef.current.delete('tutorial');",
    );
  });

  it('points at one first-week job without barring the other', () => {
    const home = readFileSync(
      join(process.cwd(), 'src/ui/screens/ClubHomeScreen.tsx'),
      'utf8',
    );

    // Hire a coach and build the pitch are both required before the week can
    // advance, so either may be done first. The guided row keeps its cue and
    // its glow; nothing on the desk is dimmed out of reach.
    expect(home).toContainSource('const guided = alert.id === guideAlertId;');
    expect(home).not.toContainSource('const locked =');
    expect(home).not.toContainSource('disabled={locked}');
    expect(home).not.toContainSource('opacity: locked');
    // Nor may the handler re-impose the bar the screen dropped. It used to
    // swallow every tap but the pitch's, which left the coach card doing
    // nothing while the Market tab it points at stayed open all along.
    expect(appSource).not.toContainSource("&& alertId !== 'training-ground'");
    // The focus prop survives for what it should still do: clear the optional
    // notes, never the jobs.
    expect(home).toContainSource('const visibleNotes = focusGuidedAlert');
  });

  it('keeps the first-week helper text after its floating arrow retires', () => {
    const shell = readFileSync(
      join(process.cwd(), 'src/ui/ManagementShell.tsx'),
      'utf8',
    );

    expect(appSource).toContainSource(
      'guideTarget={hideCoachHiringCues ? undefined : visibleAssistantObjectiveTarget}',
    );
    expect(appSource).toContainSource(
      'guideObjective={assistantObjective?.text}',
    );
    expect(appSource).not.toContainSource(
      'guideObjective={visibleAssistantObjective',
    );
    // The spoken line moved into the catalog too, so the shell holds the key and
    // still interpolates the live objective rather than announcing a fixed
    // sentence. Its English is staged with the rest of the extraction.
    expect(shell).toContainSource(
      "t('managementShell.a11y.bertsCurrentJob', { objective: guideObjective })",
    );
    expect(
      loadCatalog('en').strings['managementShell.a11y.bertsCurrentJob'],
    ).toBe("Bert's current job: {objective}");
    expect(shell).toContainSource('{guideObjective}</Text>');
    // The label moved into the copy catalog, so the shell holds the key and the
    // catalog holds the English. Asserting both keeps the original guarantee —
    // that this eyebrow still reads "Bert's job" — rather than weakening it to
    // "some key is present".
    expect(shell).toContainSource("t('managementShell.bertsJob')");
    expect(loadCatalog('en').strings['managementShell.bertsJob']).toBe(
      "Bert's job",
    );
  });

  it('never dismisses guidance before the press it collides with has landed', () => {
    // Dismissing on press-down dropped the cue and the room its screen reserved
    // above the highlighted control, so the control slid out from under the
    // finger and the tap the cue was asking for went to its replacement.
    const shell = readFileSync(
      join(process.cwd(), 'src/ui/ManagementShell.tsx'),
      'utf8',
    );

    expect(shell).not.toContainSource('onPointerDown={onDismissGuidance}');
    expect(shell).not.toContainSource('onTouchStart={onDismissGuidance}');
  });

  it('keeps the club name on the compact resource row', () => {
    const shell = readFileSync(
      join(process.cwd(), 'src/ui/ManagementShell.tsx'),
      'utf8',
    );
    const clubName = shell.indexOf('{clubName}');
    const resources = shell.indexOf('{resourceCluster}', clubName);
    const period = shell.indexOf('headerLine.visible', resources);

    expect(clubName).toBeGreaterThan(0);
    expect(resources).toBeGreaterThan(clubName);
    expect(period).toBeGreaterThan(resources);
  });
});
