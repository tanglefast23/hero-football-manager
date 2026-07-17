import { createMatch, ENGINE_VERSION, envelopeFrom, queueInput, runMatch, runReplay, tick } from '../match';
import { activatePower, ZONE_WINDOW_TICKS } from '../powers';
import { ROVERS, UNITED } from '../teams';
import { mulberry32 } from '../rng';
import { GOAL_CENTER_X, PITCH_H } from '../geometry';
import type { MatchInput, MatchOpts, MatchResult, MatchState } from '../types';

// M0 acceptance suite (Task 13). These are the fun-gate: PARITY + CAUSAL
// DIVERGENCE establish that taps are recorded inputs that genuinely change a
// deterministic outcome; GATE-1/2/3 are the redesigned timing-value decision
// record (replacing the old `contextual > blind` test — see the plan's Task 13
// section) — each gate is a separate claim the game makes about firing powers,
// not one blended comparison; GOLDEN REPLAY locks full payloads; BALANCE RAILS
// keeps the retuned engine (Lever A) inside sane bounds. If a gate fails, that
// is a design problem (tune contexts/effects) — never a test to weaken, with
// the one exception already decided for GATE-3 (>= x0.95, not strict >).

// Known M0 hero indices (see teams.ts): Dario Flint (FIRE_TORCH, home FWD),
// Zip Vela (SUPER_SPEED, home FWD), Rex Bould (SUPER_STRENGTH, rival DEF).
const TORCH = 9;
const SPEEDSTER = 10;
const RIVAL = 14;

const BOOTSTRAP_SEED = 20260717; // arbitrary fixed seed — only determinism matters
const BOOTSTRAP_RESAMPLES = 1000;

// ---- helpers ------------------------------------------------------------

function shotCount(r: { events: MatchResult['events'] }): number {
  return r.events.filter(e => e.kind === 'SHOT').length;
}

function tickUntil(m: MatchState, pred: () => boolean, max: number): void {
  for (let i = 0; i < max && !pred(); i++) tick(m);
}

/**
 * Percentile bootstrap 95% CI of the mean of `sample`. The resampler is
 * mulberry32, never Math.random: this file lives under __tests__ so the
 * sim's determinism guard doesn't scan it, but a CI computation that isn't
 * itself reproducible would make a failing gate impossible to debug.
 */
function bootstrapMeanCI95(sample: number[], resamples: number, seed: number): { mean: number; lower: number; upper: number } {
  const n = sample.length;
  const mean = sample.reduce((a, b) => a + b, 0) / n;
  const rng = mulberry32(seed);
  const resampleMeans: number[] = new Array(resamples);
  for (let r = 0; r < resamples; r++) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += sample[Math.floor(rng() * n)];
    resampleMeans[r] = sum / n;
  }
  resampleMeans.sort((a, b) => a - b);
  const lower = resampleMeans[Math.floor(resamples * 0.025)];
  const upper = resampleMeans[Math.min(resamples - 1, Math.floor(resamples * 0.975))];
  return { mean, lower, upper };
}

/**
 * Memoized runMatch keyed by seed+opts. GATE-1 and GATE-3 both need the
 * "contextual auto" home-goals series over the same 400 seeds; computing it
 * once instead of twice halves the real wall-clock cost of the two gates
 * without changing what either one measures (declaration order runs GATE-1
 * first, so GATE-3 finds it already warm).
 */
const matchCache = new Map<string, MatchResult>();
function cachedHomeGoals(seed: number, opts: MatchOpts): number {
  const key = `${seed}:${JSON.stringify(opts)}`;
  let r = matchCache.get(key);
  if (!r) {
    r = runMatch(seed, ROVERS, UNITED, [], opts);
    matchCache.set(key, r);
  }
  return r.score[0];
}

function fingerprintAt(m: MatchState) {
  return m.players.map(p => ({
    x: Math.round(p.pos.x),
    y: Math.round(p.pos.y),
    gauge: Math.round(p.gauge),
    condition: Math.round(p.condition),
  }));
}

describe('M0 acceptance suite (Task 13)', () => {
  describe('parity', () => {
    it('two zero-input runs are byte-identical (watched-no-taps == Quick Result)', () => {
      const a = runMatch(42, ROVERS, UNITED);
      const b = runMatch(42, ROVERS, UNITED);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });
  });

  describe('causal divergence', () => {
    it('a single well-timed tap changes the actual match outcome (score or shot count), not just event bytes', () => {
      let causal = false;
      let evidence = '';
      for (let seed = 1; seed <= 60 && !causal; seed++) {
        const base = runMatch(seed, ROVERS, UNITED);
        const ready = base.events.find(e => e.kind === 'POWER_READY' && (e as { player: number }).player < 11) as
          | { t: number; player: number } | undefined;
        if (!ready) continue;
        // Taps are only honored while that hero is in the Zone (powerTick), so
        // one tick after zone entry is the earliest legal, well-timed tap.
        const taps: MatchInput[] = [{ tick: ready.t + 1, kind: 'POWER_TAP', player: ready.player }];
        const tapped = runMatch(seed, ROVERS, UNITED, taps);
        if (tapped.score[0] !== base.score[0] || tapped.score[1] !== base.score[1] || shotCount(tapped) !== shotCount(base)) {
          causal = true;
          evidence = `seed ${seed}: base score [${base.score}] shots ${shotCount(base)} vs tapped score [${tapped.score}] shots ${shotCount(tapped)}`;
        }
      }
      console.log('CAUSAL DIVERGENCE evidence:', evidence || '(none found in seeds 1-60)');
      expect(causal).toBe(true);
    }, 30000);
  });

  describe('GATE-1: attention floor', () => {
    it('firing beats never-firing — home goals with all-FIRE_WHEN_READY vs SAVE_FOR_TAP never tapped (400 seeds, bootstrap CI lower bound > 0)', () => {
      const N = 400;
      const diffs: number[] = new Array(N);
      for (let seed = 1; seed <= N; seed++) {
        const firing = cachedHomeGoals(seed, { homePolicy: 'FIRE_WHEN_READY' });
        const neverFiring = cachedHomeGoals(seed, {}); // default SAVE_FOR_TAP, no taps queued anywhere
        diffs[seed - 1] = firing - neverFiring;
      }
      const { mean, lower, upper } = bootstrapMeanCI95(diffs, BOOTSTRAP_RESAMPLES, BOOTSTRAP_SEED);
      console.log(`GATE-1 attention floor: mean diff ${mean.toFixed(4)}, 95% CI [${lower.toFixed(4)}, ${upper.toFixed(4)}] over ${N} seeds`);
      expect(lower).toBeGreaterThan(0);
    }, 60000);
  });

  describe('GATE-2: moment quality', () => {
    const ATTACK_Y = Math.round(PITCH_H * 0.32); // attacking third — outside shot range (2500) but past the opposing forward line
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
        m.players[TORCH].pos = { x: GOAL_CENTER_X, y: 5250 }; // midfield, outside shot range
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

    it('SUPER_STRENGTH (structural note): every rival POWER_FIRED is context-locked at 0.85 across seeds 1-40 — a targetless fire cannot exist', () => {
      let fires = 0;
      for (let seed = 1; seed <= 40; seed++) {
        const r = runMatch(seed, ROVERS, UNITED);
        for (const e of r.events) {
          if (e.kind === 'POWER_FIRED' && (e as { player: number }).player === RIVAL) {
            fires++;
            expect((e as { strength: number }).strength).toBe(0.85);
          }
        }
      }
      console.log(`GATE-2 SUPER_STRENGTH: ${fires} rival fires across seeds 1-40, all locked at 0.85`);
      expect(fires).toBeGreaterThan(0);
    }, 15000);
  });

  describe('GATE-3: auto sanity', () => {
    it('contextual auto does not embarrass blind auto — home goals contextual-auto >= blind-auto * 0.95 (400 seeds)', () => {
      const N = 400;
      let contextual = 0, blind = 0;
      for (let seed = 1; seed <= N; seed++) {
        contextual += cachedHomeGoals(seed, { homePolicy: 'FIRE_WHEN_READY' });
        blind += cachedHomeGoals(seed, { homePolicy: 'FIRE_WHEN_READY', blindAutoHome: true });
      }
      console.log(`GATE-3 auto sanity: contextual=${contextual} blind=${blind} ratio=${(contextual / blind).toFixed(4)} over ${N} seeds`);
      expect(contextual).toBeGreaterThanOrEqual(blind * 0.95);
    }, 60000);
  });

  describe('golden replay', () => {
    it('full event payloads, score, and a state fingerprint are locked for a taped envelope', () => {
      // Discover a natural home Zone entry on seed 42 to script one legal tap.
      // Rigging powerState directly (as the other gates do) would not survive a
      // replay: the envelope only carries seed + teams + inputs + opts, never
      // ad hoc state mutation, so the taped match must be produced entirely
      // through the replayable pathway (createMatch + queueInput + tick).
      const discovery = runMatch(42, ROVERS, UNITED);
      const ready = discovery.events.find(e => e.kind === 'POWER_READY' && (e as { player: number }).player < 11) as
        | { t: number; player: number } | undefined;
      expect(ready).toBeDefined();
      const scriptedTap: MatchInput = { tick: ready!.t + 1, kind: 'POWER_TAP', player: ready!.player };

      const m = createMatch(42, ROVERS, UNITED);
      queueInput(m, scriptedTap);
      const checkpoints = [500, 1000, 1500, 2000];
      const fingerprints: Record<number, ReturnType<typeof fingerprintAt>> = {};
      while (m.phase !== 'fulltime') {
        tick(m);
        if (checkpoints.includes(m.tick)) fingerprints[m.tick] = fingerprintAt(m);
      }

      const env = envelopeFrom(m);
      expect(env.seed).toBe(42);
      expect(env.engineVersion).toBe(ENGINE_VERSION);
      expect(env.inputs).toEqual([scriptedTap]);

      const replayed = runReplay(env);
      expect(replayed.score).toEqual(m.score);
      expect(replayed.events).toEqual(m.events);

      expect({ score: m.score, events: m.events, fingerprints }).toMatchSnapshot();
    }, 15000);
  });

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
      let strongWins = 0, weakWins = 0, strongGoals = 0;
      for (let seed = 1; seed <= N; seed++) {
        const r = runMatch(seed, strong, UNITED);
        if (r.score[0] > r.score[1]) strongWins++;
        else if (r.score[1] > r.score[0]) weakWins++;
        strongGoals += r.score[0];
      }
      const strongGoalsPerMatch = strongGoals / N;
      console.log(`BALANCE RAILS blowout: strongWins=${strongWins} weakWins=${weakWins} strongGoals/match=${strongGoalsPerMatch.toFixed(3)} over ${N} seeds`);
      expect(strongWins).toBeGreaterThan(weakWins * 3);
      expect(strongGoalsPerMatch).toBeLessThan(10);
    }, 30000);
  });
});
