import { readFileSync } from 'fs';
import { join } from 'path';

describe('training stat option rendering', () => {
  it('greys out and disables a stat only at the universal safety ceiling', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/ui/screens/SquadTrainingScreen.tsx'),
      'utf8',
    );

    expect(source).toContain("option.atSafetyCeiling\n                    ? 'flex-row items-center justify-between border-2 border-ink/20 bg-white px-3 py-3 opacity-40'");
    expect(source).toContain('disabled={option.atSafetyCeiling}');
    expect(source).toContain("option.atSafetyCeiling ? 'Maximum 999' : `Current ${option.currentValue} · no personal cap`");

    const appSource = readFileSync(join(process.cwd(), 'App.tsx'), 'utf8');
    expect(appSource).toContain('Maximum 999 reached');
    expect(appSource).toContain('These stats cannot go any higher.');
  });
});
