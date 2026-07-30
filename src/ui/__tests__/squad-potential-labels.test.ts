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
    // The numeric cells and train gutter give that extra role width back to
    // the only flexible cell, so ordinary names still fit at phone width.
    expect(source).toContain("wideColumns ? 'w-16' : 'w-9'");
    expect(source).toContain("wideColumns ? 'w-28' : 'w-12'");
    expect(source).toContain("wideColumns ? 'w-28' : 'w-14'");
    expect(source).toContain('<View className="w-12" />');
    expect(source).toContain("'ml-1 h-11 w-11");
  });
});
