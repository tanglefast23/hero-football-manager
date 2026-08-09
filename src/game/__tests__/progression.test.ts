import type { Attrs, PowerId } from '../../sim/types';
import {
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
    expect(
      renewalQuote(
        player('odd-wage-hero', { power: 'FIRE_TORCH', wage: 201 }),
        3.5,
      ),
    ).toBe(704);

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
    const hero = player('hero', {
      power: 'SUPER_SPEED',
      contractSeasonsRemaining: 0,
    });
    expect(() => renewalQuote(hero, 2)).toThrow();
    expect(() => renewalQuote(hero, 6)).toThrow();
    expect(() => renewContract(hero, 4, 0)).toThrow();
    expect(() => renewContract(hero, 4, 4)).toThrow();
    expect(() =>
      renewContract({ ...hero, contractSeasonsRemaining: 1 }, 4, 2),
    ).toThrow(/only after it expires/);
  });
});
