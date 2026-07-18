import { runMatch } from '../match';
import { ROVERS, UNITED } from '../teams';

describe('shooting and goals', () => {
  it('across 30 seeds, goals happen and scores are sane', () => {
    let totalGoals = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const r = runMatch(seed, ROVERS, UNITED);
      const goals = r.events.filter(e => e.kind === 'GOAL').length;
      expect(goals).toBe(r.score[0] + r.score[1]);
      expect(goals).toBeLessThanOrEqual(15);
      totalGoals += goals;
    }
    expect(totalGoals).toBeGreaterThan(15);
    expect(totalGoals).toBeLessThan(240);
  });

  it('saves deplete GK Resolve', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const save = runMatch(seed, ROVERS, UNITED).events.find(e => e.kind === 'SAVE') as { resolveLeft: number } | undefined;
      if (save) {
        expect(save.resolveLeft).toBeLessThan(100);
        return;
      }
    }
    throw new Error('no SAVE event in 30 matches — shooting is broken');
  });

  it('a much weaker GK concedes more (500-match aggregate)', () => {
    const weakGk = structuredClone(UNITED);
    weakGk.players[0].attrs.ref = 20;
    let vsNormal = 0, vsWeak = 0;
    for (let seed = 1; seed <= 500; seed++) {
      vsNormal += runMatch(seed, ROVERS, UNITED).score[0];
      vsWeak += runMatch(seed, ROVERS, weakGk).score[0];
    }
    expect(vsWeak).toBeGreaterThan(vsNormal);
  });
});
