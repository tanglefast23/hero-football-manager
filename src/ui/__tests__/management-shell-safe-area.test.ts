import { readFileSync } from 'fs';
import { join } from 'path';

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('management shell safe-area chrome', () => {
  const shell = source('src/ui/ManagementShell.tsx');

  test('the shell paints the top and bottom insets itself', () => {
    // SafeAreaView must not letterbox the screen: a top/bottom edge there
    // paints the notch and home-indicator strips in the root colour instead of
    // the chrome colour, which is what made the Dynamic Island read as a
    // separate lighter band above the HUD.
    expect(shell).toContain("edges={['left', 'right']}");
    expect(shell).toContain('const insets = useSafeAreaInsets();');
  });

  test('the HUD bar owns the status-bar strip so it is one colour', () => {
    expect(shell).toContain('className="flex-1 bg-paper-dark"');
    expect(shell).toContain(
      'className="border-b-2 border-ink bg-paper-dark px-3 pb-2.5"',
    );
    expect(shell).toContain('styles.hudTopLayer');
    expect(shell).toContain(
      '{ paddingTop: insets.top + HUD_TOP_BREATHING_ROOM }',
    );
  });

  test('the tab bar reaches the bottom edge with trimmed clearance', () => {
    expect(shell).toContain('const TAB_BAR_BOTTOM_CLEARANCE = 8;');
    expect(shell).toContain('const TAB_BAR_BOTTOM_INSET_TRIM = 14;');
    expect(shell).toContain('insets.bottom - TAB_BAR_BOTTOM_INSET_TRIM');
    expect(shell).toContain('TAB_BAR_BOTTOM_CLEARANCE,');
  });

  test('the content column keeps the paper backdrop', () => {
    expect(shell).toContain(
      '<View className="flex-1 bg-paper">{children}</View>',
    );
  });
});
