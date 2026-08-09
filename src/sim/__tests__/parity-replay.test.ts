import {
  createMatch,
  ENGINE_VERSION,
  envelopeFrom,
  queueInput,
  runMatch,
  runReplay,
  tick,
} from '../match';
import { ROVERS, UNITED } from '../teams';
import type { MatchInput, MatchResult, MatchState } from '../types';

// M0 acceptance suite (Task 13), split from the original parity.test.ts so jest
// workers can run these files in parallel (test-infra task, audit loop). PARITY +
// CAUSAL DIVERGENCE establish that taps are recorded inputs that genuinely change
// a deterministic outcome; GOLDEN REPLAY locks full payloads. See gates-auto.test.ts,
// gates-moments.test.ts, and balance-rails.test.ts for the rest of the suite.

// Taps only exist under the SAVE_FOR_TAP test instrumentation policy; the
// engine default is the shipped FIRE_WHEN_READY for both teams (m2.1).
const TAP_HOME = { homePolicy: 'SAVE_FOR_TAP' } as const;

function shotCount(r: { events: MatchResult['events'] }): number {
  return r.events.filter((e) => e.kind === 'SHOT').length;
}

function fingerprintAt(m: MatchState) {
  return m.players.map((p) => ({
    x: Math.round(p.pos.x),
    y: Math.round(p.pos.y),
    gauge: Math.round(p.gauge),
    condition: Math.round(p.condition),
  }));
}

describe('M0 acceptance suite (Task 13)', () => {
  describe('parity', () => {
    it('two fully automatic zero-input runs are byte-identical', () => {
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
        const base = runMatch(seed, ROVERS, UNITED, [], TAP_HOME);
        const ready = base.events.find(
          (e) =>
            e.kind === 'POWER_READY' && (e as { player: number }).player < 11,
        ) as { t: number; player: number } | undefined;
        if (!ready) continue;
        // Taps are only honored while that hero is in the Zone (powerTick), so
        // one tick after zone entry is the earliest legal, well-timed tap.
        const taps: MatchInput[] = [
          { tick: ready.t + 1, kind: 'POWER_TAP', player: ready.player },
        ];
        const tapped = runMatch(seed, ROVERS, UNITED, taps, TAP_HOME);
        if (
          tapped.score[0] !== base.score[0] ||
          tapped.score[1] !== base.score[1] ||
          shotCount(tapped) !== shotCount(base)
        ) {
          causal = true;
          evidence = `seed ${seed}: base score [${base.score}] shots ${shotCount(base)} vs tapped score [${tapped.score}] shots ${shotCount(tapped)}`;
        }
      }
      console.log(
        'CAUSAL DIVERGENCE evidence:',
        evidence || '(none found in seeds 1-60)',
      );
      expect(causal).toBe(true);
    }, 30000);
  });

  describe('golden replay', () => {
    it('full event payloads, score, and a state fingerprint are locked for a taped envelope', () => {
      // Discover a natural home Zone entry on seed 42 to script one legal tap.
      // Rigging powerState directly (as the other gates do) would not survive a
      // replay: the envelope only carries seed + teams + inputs + opts, never
      // ad hoc state mutation, so the taped match must be produced entirely
      // through the replayable pathway (createMatch + queueInput + tick).
      const discovery = runMatch(42, ROVERS, UNITED, [], TAP_HOME);
      const ready = discovery.events.find(
        (e) =>
          e.kind === 'POWER_READY' && (e as { player: number }).player < 11,
      ) as { t: number; player: number } | undefined;
      expect(ready).toBeDefined();
      const scriptedTap: MatchInput = {
        tick: ready!.t + 1,
        kind: 'POWER_TAP',
        player: ready!.player,
      };

      const m = createMatch(42, ROVERS, UNITED, TAP_HOME);
      queueInput(m, scriptedTap);
      const checkpoints = [500, 1000, 1500, 2000];
      const fingerprints: Record<number, ReturnType<typeof fingerprintAt>> = {};
      while (m.phase !== 'fulltime') {
        tick(m);
        if (checkpoints.includes(m.tick))
          fingerprints[m.tick] = fingerprintAt(m);
      }

      const env = envelopeFrom(m);
      expect(env.seed).toBe(42);
      expect(env.engineVersion).toBe(ENGINE_VERSION);
      expect(env.inputs).toEqual([scriptedTap]);

      const replayed = runReplay(env);
      expect(replayed.score).toEqual(m.score);
      expect(replayed.events).toEqual(m.events);

      expect({
        score: m.score,
        events: m.events,
        fingerprints,
      }).toMatchSnapshot();
    }, 15000);
  });
});
