import { runMatch } from '../match';
import { ROVERS, UNITED } from '../teams';
import type { MatchResult } from '../types';

// M0 acceptance suite (Task 13), split from the original parity.test.ts so jest
// workers can run these files in parallel (test-infra task, audit loop). BALANCE
// RAILS keeps the retuned engine (Lever A) inside sane bounds — if a rail fails,
// that is a design problem (tune contexts/effects), never a test to weaken.

function shotCount(r: { events: MatchResult['events'] }): number {
  return r.events.filter(e => e.kind === 'SHOT').length;
}

describe('M0 acceptance suite (Task 13)', () => {
  describe('balance rails', () => {
    it('a normal matchup stays within sane bounds (200 seeds)', () => {
      const N = 200;
      let totalGoals = 0, totalShots = 0, totalSaves = 0, savedOrConceded = 0, maxGoals = 0;
      for (let seed = 1; seed <= N; seed++) {
        const r = runMatch(seed, ROVERS, UNITED);
        const goals = r.score[0] + r.score[1];
        const shots = shotCount(r);
        const saves = r.events.filter(e => e.kind === 'SAVE').length;
        totalGoals += goals;
        totalShots += shots;
        totalSaves += saves;
        savedOrConceded += saves + goals;
        if (goals > maxGoals) maxGoals = goals;
      }
      const goalsPerMatch = totalGoals / N;
      const shotsPerMatch = totalShots / N;
      const saveRate = totalSaves / savedOrConceded;
      console.log(`BALANCE RAILS normal: goals/match=${goalsPerMatch.toFixed(3)} maxGoalsInAMatch=${maxGoals} shots/match=${shotsPerMatch.toFixed(3)} saveRate=${saveRate.toFixed(4)} over ${N} seeds`);
      expect(goalsPerMatch).toBeGreaterThanOrEqual(1.5);
      expect(goalsPerMatch).toBeLessThanOrEqual(4.0);
      expect(maxGoals).toBeLessThanOrEqual(12);
      expect(shotsPerMatch).toBeGreaterThanOrEqual(8);
      expect(shotsPerMatch).toBeLessThanOrEqual(40);
      expect(saveRate).toBeGreaterThanOrEqual(0.55);
      expect(saveRate).toBeLessThanOrEqual(0.90);
    }, 30000);

    it('a +20-stat team dominates without a runaway blowout (200 seeds)', () => {
      const strong = structuredClone(ROVERS);
      for (const p of strong.players) {
        for (const k of Object.keys(p.attrs) as Array<keyof typeof p.attrs>) {
          p.attrs[k] = Math.min(99, p.attrs[k] + 20);
        }
      }
      const N = 200;
      let strongWins = 0, weakWins = 0, strongGoals = 0, strongShots = 0, strongPasses = 0;
      for (let seed = 1; seed <= N; seed++) {
        const r = runMatch(seed, strong, UNITED);
        if (r.score[0] > r.score[1]) strongWins++;
        else if (r.score[1] > r.score[0]) weakWins++;
        strongGoals += r.score[0];
        strongShots += r.events.filter(e => e.kind === 'SHOT' && (e as { by: number }).by < 11).length;
        strongPasses += r.events.filter(e => e.kind === 'PASS' && (e as { from: number }).from < 11).length;
      }
      const strongGoalsPerMatch = strongGoals / N;
      console.log(`BALANCE RAILS blowout: strongWins=${strongWins} weakWins=${weakWins} strongGoals/match=${strongGoalsPerMatch.toFixed(3)} strongShots/match=${(strongShots / N).toFixed(3)} strongPasses/match=${(strongPasses / N).toFixed(3)} over ${N} seeds`);
      expect(strongWins).toBeGreaterThan(weakWins * 3);
      expect(strongGoalsPerMatch).toBeLessThan(10);
    }, 30000);
  });
});
