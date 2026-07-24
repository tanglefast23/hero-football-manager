import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('squad potential labels', () => {
  it('uses compact phone headers and explains potential as the SUPER session chance', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/ui/screens/SquadTrainingScreen.tsx'),
      'utf8',
    );

    expect(source).toContain('useWindowDimensions');
    expect(source).toContain("wideColumns ? 'Current' : 'OVR'");
    expect(source).toContain("wideColumns ? 'Potential' : 'POT'");
    expect(source).toContain('player.potentialGrade');
    expect(source).toContain('${selectedPlayer.superChancePercent}% SUPER');
    expect(source).toContain('selectedPlayer.positionTrainingLabel');
    expect(source).not.toContain('Projected max ${selectedPlayer.projectedOverall}');
    expect(source).not.toContain('player.remainingPotential');
  });
});
