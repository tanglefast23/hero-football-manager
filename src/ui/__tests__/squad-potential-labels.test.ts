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
});
