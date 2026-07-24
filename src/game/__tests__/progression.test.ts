import type { Attrs, PowerId } from '../../sim/types';
import {
  applyTrainingPlan,
  renewContract,
  renewalQuote,
  selectLicensedHeroes,
  type FocusDrill,
  type ProgressionPlayer,
} from '../progression';

const BASE_ATTRS: Attrs = {
  pac: 50,
  sho: 50,
  pas: 50,
  def: 50,
  tec: 50,
  sta: 50,
  ref: 50,
};

function player(
  id: string,
  options: {
    power?: PowerId;
    attrs?: Attrs;
    wage?: number;
    licensed?: boolean;
    onHeroWage?: boolean;
    contractSeasonsRemaining?: number;
  } = {},
): ProgressionPlayer {
  return {
    id,
    attrs: options.attrs ?? { ...BASE_ATTRS },
    power: options.power,
    licensed: options.licensed ?? false,
    weeklyWage: options.wage ?? 200,
    onHeroWage: options.onHeroWage ?? false,
    contractSeasonsRemaining: options.contractSeasonsRemaining ?? 1,
  };
}

describe('hero licensing', () => {
  it('sets exactly the selected heroes as licensed without mutating the roster', () => {
    const roster = [
      player('speed', { power: 'SUPER_SPEED' }),
      player('strength', { power: 'SUPER_STRENGTH', licensed: true }),
      player('torch', { power: 'FIRE_TORCH' }),
      player('regular'),
    ];
    const before = JSON.stringify(roster);

    const result = selectLicensedHeroes(roster, ['speed', 'torch']);

    expect(result.map(({ id, licensed }) => [id, licensed])).toEqual([
      ['speed', true],
      ['strength', false],
      ['torch', true],
      ['regular', false],
    ]);
    expect(result).not.toBe(roster);
    expect(result.every((next, index) => next !== roster[index])).toBe(true);
    expect(JSON.stringify(roster)).toBe(before);
  });

  it.each([
    ['duplicate selection', ['speed', 'speed'], 2],
    ['over the cap', ['speed', 'strength', 'torch'], 2],
    ['unknown player', ['missing'], 2],
    ['player without a power', ['regular'], 2],
  ])('rejects %s', (_label, selectedIds, limit) => {
    const roster = [
      player('speed', { power: 'SUPER_SPEED' }),
      player('strength', { power: 'SUPER_STRENGTH' }),
      player('torch', { power: 'FIRE_TORCH' }),
      player('regular'),
    ];

    expect(() => selectLicensedHeroes(roster, selectedIds, limit)).toThrow();
  });
});

describe('contract renewal', () => {
  it('preserves a non-hero wage and applies the hero wage cliff only at renewal', () => {
    const regular = player('regular', { wage: 240 });
    const hero = player('hero', {
      power: 'SUPER_SPEED',
      wage: 240,
      contractSeasonsRemaining: 0,
    });

    expect(renewalQuote(regular, 4)).toBe(240);
    expect(renewalQuote(hero, 4)).toBe(960);
    expect(renewalQuote(hero, 3.5)).toBe(840);
    expect(renewalQuote(player('odd-wage-hero', { power: 'FIRE_TORCH', wage: 201 }), 3.5)).toBe(704);

    const renewed = renewContract(hero, 4, 3);
    expect(renewed).toMatchObject({
      weeklyWage: 960,
      onHeroWage: true,
      contractSeasonsRemaining: 3,
    });
    expect(hero).toMatchObject({
      weeklyWage: 240,
      onHeroWage: false,
      contractSeasonsRemaining: 0,
    });

    const expiredHeroRate = { ...renewed, contractSeasonsRemaining: 0 };
    expect(renewalQuote(expiredHeroRate, 5)).toBe(960);
    expect(renewContract(expiredHeroRate, 5, 2)).toMatchObject({
      weeklyWage: 960,
      onHeroWage: true,
      contractSeasonsRemaining: 2,
    });
  });

  it('rejects early renewals, invalid multipliers, and terms outside the M1 contract rules', () => {
    const hero = player('hero', { power: 'SUPER_SPEED', contractSeasonsRemaining: 0 });
    expect(() => renewalQuote(hero, 2)).toThrow();
    expect(() => renewalQuote(hero, 6)).toThrow();
    expect(() => renewContract(hero, 4, 0)).toThrow();
    expect(() => renewContract(hero, 4, 4)).toThrow();
    expect(() => renewContract(
      { ...hero, contractSeasonsRemaining: 1 },
      4,
      2,
    )).toThrow(/only after it expires/);
  });
});

describe('focus training', () => {
  const drills: FocusDrill[] = [
    { id: 'sprints', moneyCost: 400, tpCost: 10, gains: { pac: 4 } },
    { id: 'rondo', moneyCost: 600, tpCost: 15, gains: { pas: 3, tec: 2 } },
  ];

  it('charges drills once and applies their gains only to assigned players', () => {
    const roster = [player('a'), player('b'), player('c')];
    const before = JSON.stringify(roster);

    const result = applyTrainingPlan(roster, ['a', 'c'], drills, { money: 2_000, tp: 40 });

    expect(result.resources).toEqual({ money: 1_000, tp: 15 });
    expect(result.players[0].attrs).toMatchObject({ pac: 54, pas: 53, tec: 52 });
    expect(result.players[1]).toBe(roster[1]);
    expect(result.players[2].attrs).toMatchObject({ pac: 54, pas: 53, tec: 52 });
    expect(JSON.stringify(roster)).toBe(before);
  });

  it('keeps growing past 99 and stops only at the universal 999 safety ceiling', () => {
    const almostMaxed = player('max', {
      attrs: { ...BASE_ATTRS, pac: 98, pas: 97, tec: 99 },
    });

    const result = applyTrainingPlan(
      [almostMaxed],
      ['max'],
      drills,
      { money: 1_000, tp: 25 },
    );

    expect(result.players[0].attrs).toMatchObject({ pac: 102, pas: 100, tec: 101 });
    expect(almostMaxed.attrs).toMatchObject({ pac: 98, pas: 97, tec: 99 });
  });

  it('rejects unaffordable plans, invalid IDs, too many drills, and non-integer tuning', () => {
    const roster = [player('a')];
    const fourDrills = [
      ...drills,
      { id: 'duels', moneyCost: 400, tpCost: 10, gains: { def: 2 } },
      { id: 'circuit', moneyCost: 400, tpCost: 10, gains: { sta: 2 } },
    ];

    expect(() => applyTrainingPlan(roster, ['a'], drills, { money: 999, tp: 25 })).toThrow();
    expect(() => applyTrainingPlan(roster, ['missing'], drills, { money: 1_000, tp: 25 })).toThrow();
    expect(() => applyTrainingPlan(roster, ['a'], fourDrills, { money: 2_000, tp: 50 })).toThrow();
    expect(() => applyTrainingPlan(
      roster,
      ['a'],
      [{ id: 'bad', moneyCost: 1.5, tpCost: 1, gains: { pac: 1 } }],
      { money: 100, tp: 100 },
    )).toThrow();
    expect(() => applyTrainingPlan(
      roster,
      ['a'],
      [{ id: 'bad', moneyCost: 1, tpCost: 1, gains: { pac: 1.5 } }],
      { money: 100, tp: 100 },
    )).toThrow();
  });

  it.each([
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['a fraction', 50.5],
    ['zero', 0],
    ['over 999', 1_000],
  ])('rejects %s in existing roster attributes, even for an unassigned player', (_label, pac) => {
    const roster = [
      player('assigned'),
      player('malformed-bench', { attrs: { ...BASE_ATTRS, pac } }),
    ];

    expect(() => applyTrainingPlan(
      roster,
      ['assigned'],
      drills,
      { money: 1_000, tp: 25 },
    )).toThrow(/Player malformed-bench attribute pac must be from 1 to 999/);
  });
});
