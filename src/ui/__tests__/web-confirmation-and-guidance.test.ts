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

  it('makes the coach cue optional and dismisses retained guidance on the next tap', () => {
    const market = readFileSync(join(process.cwd(), 'src/ui/screens/MarketScreen.tsx'), 'utf8');
    const shell = readFileSync(join(process.cwd(), 'src/ui/ManagementShell.tsx'), 'utf8');

    expect(market).toContain('detail="If you want to hire this coach"');
    expect(shell).toContain('onPointerDown={onDismissGuidance}');
  });
});
