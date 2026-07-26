import { createMatch, tick } from '../../sim/match';
import { BEATEN_FALL_TICKS } from '../../sim/engine';
import { ROVERS, UNITED } from '../../sim/teams';
import { filesForEvent } from '../../render/audio';
import type { MatchEvent } from '../../sim/types';

/**
 * The measurement instrument behind docs/superpowers/specs/2026-07-26-duel-punctuation-design.md.
 *
 * Opt-in only (`npm run test:probe -- src/audit/__tests__/duel-punctuation-probe.test.ts`):
 * jest.config.js excludes `src/audit/__tests__/*-probe.test.ts` from the normal
 * run, and this costs ~40s.
 *
 * It exists because three plausible-sounding stories about this feature turned
 * out to be false when measured, in ways no unit test would have caught:
 *
 *  - Slides do NOT miss geometrically. Every slide whose target still held the
 *    ball made contact; the rest missed because the carrier passed mid-flight.
 *  - The fall mechanic does not deliver cover slides on its own. Before the MID
 *    relaxation, any opponent satisfied every slide gate in 0.8% of lost
 *    challenges, because 79% of covers are midfielders.
 *  - Lowering the drop rate to calm a blowout makes the mismatch asymmetry
 *    WORSE, not better. The clamp ceiling is the lever.
 *
 * Numbers here are descriptive. The assertions are deliberately loose rails that
 * only catch a regression back to the pre-m1.30 grind; read the console table
 * when tuning.
 */
const SEEDS = 30;
const LOCK_RANGE = 250;
const TICKS_PER_SECOND = 10;

interface Census {
  standingAttempts: number;
  standingWon: number;
  drops: number;
  fullWeightThuds: number;
  bodyFalls: number;
  scuffs: number;
  slidesLaunched: number;
  slideContacts: number;
  slidesWon: number;
  midSlides: number;
  passes: number;
  shots: number;
  goals: number;
  zonesOpened: number;
  longLockSpells: number;
  maxAttemptsInOneDuel: number;
  matchTicks: number;
}

function blank(): Census {
  return {
    standingAttempts: 0, standingWon: 0, drops: 0,
    fullWeightThuds: 0, bodyFalls: 0, scuffs: 0,
    slidesLaunched: 0, slideContacts: 0, slidesWon: 0, midSlides: 0,
    passes: 0, shots: 0, goals: 0, zonesOpened: 0,
    longLockSpells: 0, maxAttemptsInOneDuel: 0, matchTicks: 0,
  };
}

function censusMatch(seed: number, into: Census): void {
  const state = createMatch(seed, ROVERS, UNITED, {
    homePolicy: 'FIRE_WHEN_READY', awayPolicy: 'FIRE_WHEN_READY',
  });
  let seen = 0;
  // Running state as primitives rather than objects: reassigning an annotated
  // nullable object from an expression that reads its own field trips TS's
  // circular-inference check (TS7022).
  let spellCarrier = -1;
  let spellPresser = -1;
  let spellTicks = 0;
  let duelOn = -1;
  let duelBy = -1;
  let duelAttempts = 0;
  let duelLastTick = -100;

  while (state.phase !== 'fulltime') {
    tick(state);
    into.matchTicks += 1;

    for (const e of (state.events as MatchEvent[]).slice(seen)) {
      const sounds = filesForEvent(e);
      if (sounds.includes('tackle-thud')) into.fullWeightThuds += 1;
      if (sounds.includes('body-fall')) into.bodyFalls += 1;
      if (sounds.includes('duel-scuff')) into.scuffs += 1;
      if (e.kind === 'PASS') into.passes += 1;
      if (e.kind === 'SHOT') into.shots += 1;
      if (e.kind === 'GOAL') into.goals += 1;
      if (e.kind === 'POWER_READY') into.zonesOpened += 1;
      if (e.kind === 'SLIDE_STARTED') {
        into.slidesLaunched += 1;
        if (state.players[e.by]?.def.role === 'MID') into.midSlides += 1;
      }
      if (e.kind !== 'TACKLE') continue;
      if (e.style === 'slide' && e.contact) into.slideContacts += 1;
      if (e.style === 'slide' && e.won) into.slidesWon += 1;
      if (e.style !== 'standing') continue;
      into.standingAttempts += 1;
      if (e.won) into.standingWon += 1;
      if (e.dropped) into.drops += 1;
      // Consecutive FAILURES by one defender against one carrier — what the
      // backstop actually bounds. A win or a drop ends the streak, so grouping
      // by raw attempts instead would count the defender's post-recovery return
      // as a fourth attempt in the same duel and misread the cap.
      const sameDuel = duelOn === e.on && duelBy === e.by && e.t - duelLastTick <= 15;
      duelAttempts = sameDuel && !e.won && !e.dropped ? duelAttempts + 1 : e.won || e.dropped ? 0 : 1;
      duelOn = e.on;
      duelBy = e.by;
      duelLastTick = e.t;
      into.maxAttemptsInOneDuel = Math.max(into.maxAttemptsInOneDuel, duelAttempts);
    }
    seen = state.events.length;

    if (state.ball.kind !== 'held') { spellCarrier = -1; continue; }
    const carrierIdx = state.ball.by;
    const carrier = state.players[carrierIdx];
    let nearest = -1;
    let nearestD2 = LOCK_RANGE * LOCK_RANGE;
    for (let i = 0; i < state.players.length; i += 1) {
      const p = state.players[i];
      if (p.team === carrier.team) continue;
      const d2 = (p.pos.x - carrier.pos.x) ** 2 + (p.pos.y - carrier.pos.y) ** 2;
      if (d2 <= nearestD2) { nearestD2 = d2; nearest = i; }
    }
    if (nearest === -1) { spellCarrier = -1; continue; }
    const sameSpell = spellCarrier === carrierIdx && spellPresser === nearest;
    spellTicks = sameSpell ? spellTicks + 1 : 1;
    spellCarrier = carrierIdx;
    spellPresser = nearest;
    if (spellTicks === 3 * TICKS_PER_SECOND) into.longLockSpells += 1;
  }
}

describe('duel punctuation census', () => {
  it('reports the match-feel numbers the design was tuned against', () => {
    const total = blank();
    for (let seed = 1; seed <= SEEDS; seed++) censusMatch(seed, total);
    const per = (n: number) => n / SEEDS;
    const secondsPerMatch = per(total.matchTicks) / TICKS_PER_SECOND;
    const every = (n: number) => (n === 0 ? 'never' : `${(secondsPerMatch / per(n)).toFixed(1)}s`);

    // eslint-disable-next-line no-console
    console.log([
      `--- DUEL PUNCTUATION, ${SEEDS} seeds, ${secondsPerMatch.toFixed(0)}s per match ---`,
      `standing challenges   ${per(total.standingAttempts).toFixed(1)}/match   one every ${every(total.standingAttempts)}`,
      `  won                 ${per(total.standingWon).toFixed(1)}  (${(100 * total.standingWon / total.standingAttempts).toFixed(1)}%)`,
      `  defender dropped    ${per(total.drops).toFixed(1)}  one every ${every(total.drops)}`,
      `longest single duel   ${total.maxAttemptsInOneDuel} attempts (backstop caps one defender at 3)`,
      `lock spells >= 3s     ${per(total.longLockSpells).toFixed(1)}/match`,
      '',
      `AUDIO  tackle-thud    ${per(total.fullWeightThuds).toFixed(1)}/match   one every ${every(total.fullWeightThuds)}`,
      `       body-fall      ${per(total.bodyFalls).toFixed(1)}/match   one every ${every(total.bodyFalls)}`,
      `       duel-scuff     ${per(total.scuffs).toFixed(1)}/match   one every ${every(total.scuffs)}`,
      '',
      `slides launched       ${per(total.slidesLaunched).toFixed(2)}/match (${per(total.midSlides).toFixed(2)} by midfielders on the breakaway beat)`,
      `slides contacting     ${per(total.slideContacts).toFixed(2)}/match (${(100 * total.slideContacts / Math.max(1, total.slidesLaunched)).toFixed(0)}% of launches)`,
      `slides won            ${per(total.slidesWon).toFixed(2)}/match`,
      '',
      `passes ${per(total.passes).toFixed(1)}  shots ${per(total.shots).toFixed(1)}  goals ${per(total.goals).toFixed(2)}  zones opened ${per(total.zonesOpened).toFixed(2)}`,
      `fall length in use: ${BEATEN_FALL_TICKS} ticks (${(BEATEN_FALL_TICKS / TICKS_PER_SECOND).toFixed(1)}s)`,
    ].join('\n'));

    // The grind is what this feature exists to kill: before m1.30 a single
    // defender re-rolled up to 10 times against one carrier and ~5.4 duels a
    // match ran past 3 seconds.
    expect(total.maxAttemptsInOneDuel).toBeLessThanOrEqual(3);
    expect(per(total.longLockSpells)).toBeLessThan(3);
    // Full-weight body impacts used to fire every 1.7s.
    expect(per(total.fullWeightThuds)).toBeLessThan(40);
    expect(total.drops).toBeGreaterThan(0);
    expect(total.bodyFalls).toBe(total.drops);
  }, 180_000);
});
