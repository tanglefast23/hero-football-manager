import { readFileSync } from 'fs';
import { join } from 'path';

describe('locked training progress rendering', () => {
  it('distinguishes at-cap from merely-unfunded zero gain', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/ui/screens/SquadTrainingScreen.tsx'),
      'utf8',
    );

    // Three distinct states, not a two-way atCap/gain toggle: at cap, funded
    // with zero gain (a real, separate situation), and a positive gain.
    expect(source).toContain("entry.atCap ? 'text-stamp' : entry.weeklyGain === 0 ? 'text-stamp' : 'text-pitch-dark'");
    expect(source).toContain("entry.atCap ? '· At cap' : entry.weeklyGain === 0 ? '· None this week' : `+${entry.weeklyGain}/week`");
  });
});
