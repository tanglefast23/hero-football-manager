import { drainStamina, effectiveStat, speedFor } from '../engine';
import { PITCH_H } from '../geometry';
import { createMatch, envelopeFrom, queueInput, runReplay, tick } from '../match';
import { ROVERS, UNITED } from '../teams';
import type { PlayerDef, TeamDef } from '../types';
import {
  COACHING_FORMATION_IDS,
  DEFAULT_FORMATION_PRESETS,
  FORMATION_IDS,
  FORMATION_LAYOUTS,
  formationTarget,
  mentalityTarget,
  nextFormation,
  nextMentality,
} from '../tactics';

describe('match tactics', () => {
  it('ships three distinct balanced, attacking, and defensive presets', () => {
    expect(DEFAULT_FORMATION_PRESETS).toEqual(['4-4-2', '3-4-3', '5-3-2']);
    expect(new Set(DEFAULT_FORMATION_PRESETS).size).toBe(3);
    expect(COACHING_FORMATION_IDS).toEqual(['4-4-2', '4-3-3', '5-3-2', '3-4-3']);
  });

  it.each(FORMATION_IDS)('%s has exactly ten in-bounds outfield dots', formation => {
    expect(FORMATION_LAYOUTS[formation]).toHaveLength(10);
    for (const [x, y] of FORMATION_LAYOUTS[formation]) {
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(1);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(1);
    }
  });

  it('cycles only the configured formation presets', () => {
    expect(nextFormation('4-4-2', DEFAULT_FORMATION_PRESETS)).toBe('3-4-3');
    expect(nextFormation('3-4-3', DEFAULT_FORMATION_PRESETS)).toBe('5-3-2');
    expect(nextFormation('5-3-2', DEFAULT_FORMATION_PRESETS)).toBe('4-4-2');
  });

  it('cycles mentality in the agreed balanced, attack, protect order', () => {
    expect(nextMentality('BALANCED')).toBe('ATTACK');
    expect(nextMentality('ATTACK')).toBe('PROTECT');
    expect(nextMentality('PROTECT')).toBe('BALANCED');
  });

  it('moves a slot differently in the attacking and defensive formations', () => {
    const base = { x: 3400, y: 6000 };
    expect(formationTarget(0, 5, '4-3-3', base)).not.toEqual(base);
    expect(formationTarget(0, 5, '5-3-2', base)).not.toEqual(base);
    expect(formationTarget(0, 5, '4-3-3', base)).not.toEqual(formationTarget(0, 5, '5-3-2', base));
  });

  it('keeps converted wide players on their original side of the pitch', () => {
    const base = { x: 3400, y: 6000 };
    // Variable-line formations use a separate engine-slot map. A display-dot
    // ordering bug used to send these slots several thousand units laterally.
    for (const [slot, formation] of [
      [4, '3-5-2'],
      [8, '5-3-2'],
      [9, '4-5-1'],
      [4, '3-4-3'],
    ] as const) {
      expect(Math.abs(formationTarget(0, slot, formation, base).x - base.x)).toBeLessThan(1000);
    }
  });

  it('pushes ATTACK toward goal and PROTECT toward home for either team', () => {
    const home = { x: 3400, y: PITCH_H / 2 };
    expect(mentalityTarget(0, 9, 'ATTACK', true, home).y).toBeLessThan(home.y);
    expect(mentalityTarget(0, 9, 'PROTECT', false, home).y).toBeGreaterThan(home.y);
    expect(mentalityTarget(1, 9, 'ATTACK', true, home).y).toBeGreaterThan(home.y);
    expect(mentalityTarget(1, 9, 'PROTECT', false, home).y).toBeLessThan(home.y);
  });

  it('makes the 3-4-3 back three hold extra counter-risk when defending', () => {
    const base = { x: 2000, y: 7000 };
    const attacking = formationTarget(0, 1, '3-4-3', base, true);
    const defending = formationTarget(0, 1, '3-4-3', base, false);
    expect(defending.y).toBeLessThan(attacking.y);
    expect(Math.abs(defending.x - 3400)).toBeGreaterThan(Math.abs(attacking.x - 3400));
  });

  it('records formation and mentality changes as deterministic coaching inputs', () => {
    const match = createMatch(42, ROVERS, UNITED, { controlledTeam: 0 });
    queueInput(match, { tick: 1, kind: 'SET_FORMATION', formation: '4-3-3' });
    queueInput(match, { tick: 1, kind: 'SET_MENTALITY', mentality: 'ATTACK' });
    tick(match);

    expect(match.tactics[0]).toEqual({ formation: '4-3-3', mentality: 'ATTACK' });
    expect(match.events).toEqual(expect.arrayContaining([
      { t: 1, kind: 'FORMATION_CHANGED', team: 0, formation: '4-3-3' },
      { t: 1, kind: 'MENTALITY_CHANGED', team: 0, mentality: 'ATTACK' },
    ]));

    const replay = runReplay(envelopeFrom(match));
    expect(replay.events).toEqual(expect.arrayContaining([
      { t: 1, kind: 'FORMATION_CHANGED', team: 0, formation: '4-3-3' },
      { t: 1, kind: 'MENTALITY_CHANGED', team: 0, mentality: 'ATTACK' },
    ]));
  });

  it('swaps a compatible bench player into the same render slot with fresh energy', () => {
    const replacement: PlayerDef = {
      id: 'bench-mid',
      name: 'Mae Thorn',
      role: 'MID',
      attrs: { pac: 55, sho: 45, pas: 58, def: 47, tec: 56, sta: 64, ref: 10 },
    };
    const home: TeamDef = { ...ROVERS, bench: [replacement] };
    const match = createMatch(42, home, UNITED, { controlledTeam: 0 });
    match.players[6].condition = 9;

    queueInput(match, { tick: 1, kind: 'SUBSTITUTE', player: 6, replacementId: replacement.id });
    tick(match);

    expect(match.players[6].def.id).toBe(replacement.id);
    expect(match.players[6].condition).toBeGreaterThan(99);
    expect(match.bench[0]).toEqual([]);
    expect(match.substitutionsUsed[0]).toBe(1);
    expect(match.events).toContainEqual({
      t: 1,
      kind: 'SUBSTITUTION',
      team: 0,
      player: 6,
      outPlayerId: 'r6',
      inPlayerId: replacement.id,
    });
  });

  it('rejects goalkeeper-for-outfielder substitutions', () => {
    const keeper: PlayerDef = {
      id: 'bench-gk',
      name: 'Ada Gloves',
      role: 'GK',
      attrs: { pac: 40, sho: 20, pas: 45, def: 42, tec: 38, sta: 60, ref: 64 },
    };
    const home: TeamDef = { ...ROVERS, bench: [keeper] };
    const match = createMatch(42, home, UNITED, { controlledTeam: 0 });
    expect(() => queueInput(match, {
      tick: 1,
      kind: 'SUBSTITUTE',
      player: 6,
      replacementId: keeper.id,
    })).toThrow('goalkeepers may only be swapped');
  });

  it('makes high STA drain more slowly and low condition reduce live performance', () => {
    const match = createMatch(42, ROVERS, UNITED);
    const lowStamina = match.players[1];
    const highStamina = match.players[2];
    lowStamina.def.attrs.sta = 40;
    highStamina.def.attrs.sta = 80;
    for (let tickIndex = 0; tickIndex < 100; tickIndex += 1) {
      drainStamina(lowStamina, true);
      drainStamina(highStamina, true);
    }
    expect(highStamina.condition).toBeGreaterThan(lowStamina.condition);

    const fullSpeed = speedFor(match, 1);
    const fullDefense = effectiveStat(match, 1, 'def');
    lowStamina.condition = 20;
    expect(speedFor(match, 1)).toBeLessThan(fullSpeed);
    expect(effectiveStat(match, 1, 'def')).toBeLessThan(fullDefense);
  });
});
