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

    expect(source).toContain('const ROSTER_ROLE_COLUMN_WIDTH = 48;');
    expect(source).toContain(
      'roleColumn: { width: ROSTER_ROLE_COLUMN_WIDTH, flexShrink: 0 }',
    );
    expect(source).toMatch(
      /<Text[\s\S]*?style=\{styles\.roleColumn\}[\s\S]*?adjustsFontSizeToFit[\s\S]*?>\{player\.role\}<\/Text>/,
    );
    expect(source).not.toContain("'w-10 font-pixel text-sm text-ink'");
    expect(source).not.toContain("'w-10 font-pixel text-sm text-blue-dark'");
    // A View does not clip its children on native, so a header wider than its
    // column paints over its neighbour instead of truncating. Every phone width
    // holds its own label plus the sort arrow; the flexible name cell pays.
    expect(source).toContain("wideColumns ? 'w-16' : 'w-12'");
    expect(source).toContain("wideColumns ? 'w-28' : 'w-12'");
    expect(source).toContain("wideColumns ? 'w-28' : 'w-[60px]'");
    expect(source).toContain("const headerLabelSize = wideColumns ? 'text-xs' : 'text-[10px]';");
    expect(source).toContain("const ROSTER_TRAIN_COLUMN_CLASS = 'w-11';");
    expect(source).toContain('<View className={ROSTER_TRAIN_COLUMN_CLASS} />');
    // A 40pt circle with hitSlop back out to the 44pt minimum touch target.
    expect(source).toContain("'ml-1 h-10 w-10 items-center justify-center rounded-full");
    expect(source).toContain('hitSlop={ROSTER_TRAIN_BUTTON_HIT_SLOP}');
  });
});
