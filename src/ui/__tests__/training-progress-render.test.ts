import { readFileSync } from 'fs';
import { join } from 'path';

describe('training stat option rendering', () => {
  it('greys out and disables an at-cap stat option in the picker', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/ui/TrainingDrillModal.tsx'),
      'utf8',
    );

    // At-cap options are visually distinct (greyed, disabled) rather than
    // just showing a lower gain number — the manager shouldn't be able to
    // select a stat that can't grow.
    expect(source).toContain("option.atCap\n                        ? 'flex-row items-center justify-between border-2 border-ink/20 bg-white px-3 py-3 opacity-40'");
    expect(source).toContain('disabled={option.atCap}');
    expect(source).toContain('{option.current}/{option.cap} {option.shortCode}');
  });
});
