import { createMatch, queueInput, tick } from '../match';
import { activatePower, ZONE_WINDOW_TICKS } from '../powers';
import { ROVERS, UNITED } from '../teams';
import { GOAL_CENTER_X, PITCH_H } from '../geometry';
import type { MatchState } from '../types';
import { BOOTSTRAP_RESAMPLES, BOOTSTRAP_SEED, bootstrapMeanCI95 } from './helpers/gates';

// M0 acceptance suite (Task 13), split from the original parity.test.ts so jest
// workers can run these files in parallel (test-infra task, audit loop). GATE-2
// is the redesigned per-power moment-quality trio. If a gate fails, that is a
// design problem (tune contexts/effects) — never a test to weaken.

// Known M0 hero indices (see teams.ts): Dario Flint (FIRE_TORCH, home FWD),
// Zip Vela (SUPER_SPEED, home FWD), Rex Bould (SUPER_STRENGTH, rival DEF).
const TORCH = 9;
const SPEEDSTER = 10;
const RIVAL = 14;

function tickUntil(m: MatchState, pred: () => boolean, max: number): void {
  for (let i = 0; i < max && !pred(); i++) tick(m);
}

describe('M0 acceptance suite (Task 13)', () => {
  describe('GATE-2: moment quality', () => {
    const ATTACK_Y = Math.round(PITCH_H * 0.32); // attacking third — beyond the automatic close-range shot, but past the opposing forward line
    const OWN_Y = Math.round(PITCH_H * 0.85);    // deep in the defensive third

    function shotsAfterSpeedTap(seed: number, attackingHalf: boolean): number {
      const m = createMatch(seed, ROVERS, UNITED);
      m.ball = { kind: 'held', by: SPEEDSTER };
      m.players[SPEEDSTER].pos = { x: GOAL_CENTER_X, y: attackingHalf ? ATTACK_Y : OWN_Y };
      m.players[SPEEDSTER].powerState = { kind: 'zone', remainingTicks: ZONE_WINDOW_TICKS };
      queueInput(m, { tick: m.tick + 1, kind: 'POWER_TAP', player: SPEEDSTER });
      tickUntil(m, () => m.events.some(e => e.kind === 'POWER_FIRED' && (e as { player: number }).player === SPEEDSTER), 60);
      const fired = m.events.find(e => e.kind === 'POWER_FIRED' && (e as { player: number }).player === SPEEDSTER) as { t: number } | undefined;
      if (!fired) return 0; // a tap in the Zone always fires at 1.0 after the windup — should not happen
      const startIdx = m.events.length;
      const deadline = fired.t + 150;
      tickUntil(m, () => m.tick >= deadline, 200);
      return m.events.slice(startIdx).filter(e => e.kind === 'SHOT' && (e as { by: number }).by < 11).length;
    }

    it('SUPER_SPEED: tapping in the attacking half beats tapping deep in your own half (200 paired seeds, CI > 0)', () => {
      const N = 200;
      const diffs: number[] = new Array(N);
      for (let seed = 1; seed <= N; seed++) {
        const value = shotsAfterSpeedTap(seed, true);
        const anti = shotsAfterSpeedTap(seed, false);
        diffs[seed - 1] = value - anti;
      }
      const { mean, lower, upper } = bootstrapMeanCI95(diffs, BOOTSTRAP_RESAMPLES, BOOTSTRAP_SEED);
      console.log(`GATE-2 SUPER_SPEED: mean diff ${mean.toFixed(4)}, 95% CI [${lower.toFixed(4)}, ${upper.toFixed(4)}] over ${N} paired seeds`);
      expect(lower).toBeGreaterThan(0);
    }, 30000);

    it('FIRE_TORCH: a marker inside the ignite radius catches fire; alone, nobody does', () => {
      function fires(markerNearby: boolean): boolean {
        const m = createMatch(1, ROVERS, UNITED);
        m.ball = { kind: 'held', by: TORCH };
        m.players[TORCH].pos = { x: GOAL_CENTER_X, y: 5250 }; // midfield, far from a valuable shot
        if (markerNearby) {
          m.players[17].pos = { x: GOAL_CENTER_X, y: 5250 }; // co-located opponent, well inside the 800 ignite radius
        } else {
          for (const idx of [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]) m.players[idx].pos = { x: 200, y: 9000 }; // all far outside 800
        }
        activatePower(m, TORCH, 1);
        return m.events.some(e => e.kind === 'IGNITED');
      }
      expect(fires(true)).toBe(true);
      expect(fires(false)).toBe(false);
    });

    it('SUPER_STRENGTH (structural note): a contextual auto-fire locks a target at 0.85 — the separate no-target gate proves it cannot lapse-fire', () => {
      const m = createMatch(42, ROVERS, UNITED);
      m.ball = { kind: 'held', by: SPEEDSTER };
      m.players[SPEEDSTER].pos = { x: GOAL_CENTER_X, y: PITCH_H / 2 };
      m.players[RIVAL].pos = { ...m.players[SPEEDSTER].pos };
      m.players[RIVAL].powerState = { kind: 'zone', remainingTicks: ZONE_WINDOW_TICKS };

      tickUntil(m, () => m.events.some(e => e.kind === 'POWER_FIRED' && e.player === RIVAL), 60);

      const fired = m.events.find(e => e.kind === 'POWER_FIRED' && e.player === RIVAL);
      expect(fired).toMatchObject({ player: RIVAL, power: 'SUPER_STRENGTH', strength: 0.85 });
    });
  });
});
