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
      let totalSlides = 0, totalSlideWins = 0;
      for (let seed = 1; seed <= N; seed++) {
        const r = runMatch(seed, ROVERS, UNITED);
        const lastSlideByPlayer = new Map<number, number>();
        for (const e of r.events) {
          if (e.kind !== 'SLIDE_STARTED') continue;
          const last = lastSlideByPlayer.get(e.by);
          if (last !== undefined) expect(e.t - last).toBeGreaterThanOrEqual(25);
          lastSlideByPlayer.set(e.by, e.t);
        }
        const goals = r.score[0] + r.score[1];
        const shots = shotCount(r);
        const saves = r.events.filter(e => e.kind === 'SAVE').length;
        totalGoals += goals;
        totalShots += shots;
        totalSaves += saves;
        totalSlides += r.events.filter(e => e.kind === 'SLIDE_STARTED').length;
        totalSlideWins += r.events.filter(e => e.kind === 'TACKLE' && e.style === 'slide' && e.won).length;
        savedOrConceded += saves + goals;
        if (goals > maxGoals) maxGoals = goals;
      }
      const goalsPerMatch = totalGoals / N;
      const shotsPerMatch = totalShots / N;
      const saveRate = totalSaves / savedOrConceded;
      console.log(`BALANCE RAILS normal: goals/match=${goalsPerMatch.toFixed(3)} maxGoalsInAMatch=${maxGoals} shots/match=${shotsPerMatch.toFixed(3)} saveRate=${saveRate.toFixed(4)} slides/match=${(totalSlides / N).toFixed(3)} slideWinRate=${(totalSlideWins / Math.max(1, totalSlides)).toFixed(3)} over ${N} seeds`);
      expect(goalsPerMatch).toBeGreaterThanOrEqual(1.5);
      expect(goalsPerMatch).toBeLessThanOrEqual(4.0);
      expect(maxGoals).toBeLessThanOrEqual(12);
      expect(shotsPerMatch).toBeGreaterThanOrEqual(8);
      expect(shotsPerMatch).toBeLessThanOrEqual(40);
      expect(saveRate).toBeGreaterThanOrEqual(0.55);
      expect(saveRate).toBeLessThanOrEqual(0.90);
      expect(totalSlides / N).toBeGreaterThanOrEqual(2);
      expect(totalSlides / N).toBeLessThanOrEqual(30);
    }, 30000);

    it('a +20-stat team dominates from either side without a runaway blowout (200 paired seeds)', () => {
      const strong = structuredClone(ROVERS);
      for (const p of strong.players) {
        for (const k of Object.keys(p.attrs) as Array<keyof typeof p.attrs>) {
          p.attrs[k] = Math.min(99, p.attrs[k] + 20);
        }
      }
      const N = 200;
      let homeStrongWins = 0, awayStrongWins = 0;
      let homeWeakWins = 0, awayWeakWins = 0;
      let homeStrongGoals = 0, awayStrongGoals = 0, weakGoals = 0;
      let strongShots = 0, strongPasses = 0;
      const goalMargins: number[] = [];
      for (let seed = 1; seed <= N; seed++) {
        const home = runMatch(seed, strong, UNITED);
        const away = runMatch(seed, UNITED, strong);
        if (home.score[0] > home.score[1]) homeStrongWins++;
        else if (home.score[1] > home.score[0]) homeWeakWins++;
        if (away.score[1] > away.score[0]) awayStrongWins++;
        else if (away.score[0] > away.score[1]) awayWeakWins++;
        homeStrongGoals += home.score[0];
        awayStrongGoals += away.score[1];
        weakGoals += home.score[1] + away.score[0];
        goalMargins.push(
          Math.abs(home.score[0] - home.score[1]),
          Math.abs(away.score[0] - away.score[1]),
        );
        strongShots += home.events.filter(e => e.kind === 'SHOT' && e.by < 11).length;
        strongShots += away.events.filter(e => e.kind === 'SHOT' && e.by >= 11).length;
        strongPasses += home.events.filter(e => e.kind === 'PASS' && e.from < 11).length;
        strongPasses += away.events.filter(e => e.kind === 'PASS' && e.from >= 11).length;
      }
      const homeStrongGoalsPerMatch = homeStrongGoals / N;
      const awayStrongGoalsPerMatch = awayStrongGoals / N;
      const strongGoalsPerMatch = (homeStrongGoals + awayStrongGoals) / (N * 2);
      const weakGoalsPerMatch = weakGoals / (N * 2);
      goalMargins.sort((a, b) => a - b);
      const percentile = (p: number): number => goalMargins[Math.ceil(goalMargins.length * p) - 1];
      const p95GoalMargin = percentile(0.95);
      const p99GoalMargin = percentile(0.99);
      const maxGoalMargin = goalMargins[goalMargins.length - 1];
      console.log(`BALANCE RAILS mismatch: homeStrongWins=${homeStrongWins} awayStrongWins=${awayStrongWins} homeWeakWins=${homeWeakWins} awayWeakWins=${awayWeakWins} strongGoals/match=${strongGoalsPerMatch.toFixed(3)} weakGoals/match=${weakGoalsPerMatch.toFixed(3)} p95GoalMargin=${p95GoalMargin} p99GoalMargin=${p99GoalMargin} maxGoalMargin=${maxGoalMargin} sideGoalGap=${Math.abs(homeStrongGoalsPerMatch - awayStrongGoalsPerMatch).toFixed(3)} strongShots/match=${(strongShots / (N * 2)).toFixed(3)} strongPasses/match=${(strongPasses / (N * 2)).toFixed(3)} over ${N} paired seeds`);
      expect(homeStrongWins).toBeGreaterThanOrEqual(N * 0.8);
      expect(awayStrongWins).toBeGreaterThanOrEqual(N * 0.8);
      expect(homeStrongWins).toBeGreaterThan(homeWeakWins * 3);
      expect(awayStrongWins).toBeGreaterThan(awayWeakWins * 3);
      expect(strongGoalsPerMatch).toBeGreaterThan(weakGoalsPerMatch * 2);
      expect(strongGoalsPerMatch).toBeLessThan(9);
      // A blowout is the absolute score difference, never the winner's raw goal
      // total: 18-14 is a four-goal margin, while 18-0 fails the hard tail rail.
      expect(p95GoalMargin).toBeLessThanOrEqual(9);
      expect(p99GoalMargin).toBeLessThanOrEqual(11);
      expect(maxGoalMargin).toBeLessThanOrEqual(12);
      expect(Math.abs(homeStrongGoalsPerMatch - awayStrongGoalsPerMatch)).toBeLessThanOrEqual(1.5);
    }, 90000);
  });
});
