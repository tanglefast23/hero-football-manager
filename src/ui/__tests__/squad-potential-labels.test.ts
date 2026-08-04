import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('squad potential labels', () => {
  it('uses compact phone headers and explains potential as the SUPER session chance', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/ui/screens/SquadTrainingScreen.tsx'),
      'utf8',
    );

    expect(source).toContain('useWindowDimensions');
    expect(source).toContain("wideColumns ? 'Score' : 'OVR'");
    expect(source).toContain("wideColumns ? 'Potential' : 'POT'");
    expect(source).toContain("wideColumns ? 'Condition' : 'Cond'");
    // The + button speaks for itself; the clipped "Train" header is gone.
    expect(source).not.toContain('>Train</PixelText>');
    expect(source).toContain('player.potentialGrade');
    expect(source).toContain('${selectedPlayer.superChancePercent}% SUPER');
    expect(source).toContain('selectedPlayer.positionTrainingLabel');
    expect(source).not.toContain('Projected max ${selectedPlayer.projectedOverall}');
    expect(source).not.toContain('player.remainingPotential');
  });

  it('always reserves enough fixed space to show the full player position', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/ui/screens/SquadTrainingScreen.tsx'),
      'utf8',
    );

    // The role column is one measured width shared by the header and the cells
    // under it. It used to be two — `w-12` above `width: 48` — which put the
    // POS heading 6pt left of the positions it labelled, because a rem is
    // React Native's 14pt on native and `w-12` is therefore 42pt, not 48.
    expect(source).toContain('role: { width: REGISTER_COLUMN_WIDTH.phone.role, flexShrink: 0 }');
    expect(source).toContain('role: { width: REGISTER_COLUMN_WIDTH.wide.role, flexShrink: 0 }');
    expect(source).toMatch(
      /<Text[\s\S]*?style=\{columns\.role\}[\s\S]*?adjustsFontSizeToFit[\s\S]*?>\{player\.role\}<\/Text>/,
    );
    expect(source).not.toContain("'w-10 font-pixel text-sm text-ink'");
    expect(source).not.toContain("'w-10 font-pixel text-sm text-blue-dark'");
    // Widths are derived, not chosen: see squad-register-columns.ts and the
    // test beside it, which re-runs the arithmetic for every column.
    expect(source).toContain("const headerLabelSize = wideColumns ? 'text-xs' : 'text-[10px]';");
    expect(source).toContain("const ROSTER_TRAIN_COLUMN_CLASS = 'w-11';");
    expect(source).toContain('<View className={ROSTER_TRAIN_COLUMN_CLASS} />');
    expect(source).toContain("'ml-1 h-10 w-10 items-center justify-center rounded-full");
    // 35pt of circle plus hitSlop, summed and checked in squad-register-columns.
    expect(source).toContain('hitSlop={TRAIN_BUTTON_HIT_SLOP}');
  });
});
