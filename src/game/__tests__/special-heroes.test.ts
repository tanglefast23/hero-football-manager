import { createCareer } from '../career';
import { createLaunchCareerSetup } from '../../application/launch';
import { runHeadlessFullCareer } from '../headless';
import { buildCareerMatchTeamDef, careerHeroLimit } from '../squad';
import { roleOverall } from '../archetype-caps';
import { isReservedFieldLook } from '../player-appearance';
import {
  SPECIAL_HERO_ROSTER,
  isSpecialHeroId,
  scoutOnlySpecialHeroes,
  specialHeroAttrs,
  specialHeroTargetOverall,
  specialHeroesForDivision,
  validateSpecialHeroRoster,
} from '../special-heroes';
import type { CareerPlayer, GameState } from '../types';

const OUTFIELD = ['pac', 'sho', 'pas', 'def', 'tec', 'sta'] as const;

const specialsIn = (state: GameState) =>
  state.players.filter((player) => isSpecialHeroId(player.id));
const overall = (player: CareerPlayer) =>
  roleOverall(player.role, player.attrs);

describe('the special hero roster', () => {
  it('assigns every character a power their role can actually fire', () => {
    expect(() => validateSpecialHeroRoster()).not.toThrow();
    expect(SPECIAL_HERO_ROSTER).toHaveLength(15);
  });

  it('places eleven and reserves four for the scout', () => {
    const placed = ([5, 4, 3, 2, 1] as const).flatMap((division) =>
      specialHeroesForDivision(division),
    );
    expect(placed).toHaveLength(11);
    expect(scoutOnlySpecialHeroes()).toHaveLength(4);
    expect(
      ([5, 4, 3, 2, 1] as const).map((d) => specialHeroesForDivision(d).length),
    ).toEqual([1, 1, 2, 3, 4]);
    // Order is the rank inside the host club, so it must be 1..N with no gaps.
    for (const division of [5, 4, 3, 2, 1] as const) {
      const heroes = specialHeroesForDivision(division);
      expect(heroes.map((hero) => hero.order)).toEqual(
        heroes.map((_, index) => index + 1),
      );
    }
  });
});

describe('special hero ratings', () => {
  /**
   * The owner's requirement was that the number 1 player is *truly* better, not
   * marginally, and better in the stats the role actually uses. Both halves are
   * checked here because `roleOverall` is a flat mean and cannot express the
   * second one on its own.
   */
  it('lands roleOverall exactly on target across every plausible base', () => {
    const failures: string[] = [];
    for (const base of [20, 40, 55, 75, 120, 300, 900]) {
      for (const count of [1, 2, 3, 4]) {
        for (let order = 1; order <= count; order += 1) {
          const target = specialHeroTargetOverall(base, count, order);
          for (const role of ['FWD', 'MID', 'DEF'] as const) {
            const attrs = specialHeroAttrs(role, target);
            if (roleOverall(role, attrs) !== target) {
              failures.push(
                `${role} base=${base} count=${count} order=${order}`,
              );
            }
          }
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('clears the best ordinary player by eight and spaces the ranks by three', () => {
    expect(
      [1, 2, 3, 4].map((order) => specialHeroTargetOverall(50, 4, order)),
    ).toEqual([67, 64, 61, 58]);
    expect(specialHeroTargetOverall(50, 1, 1)).toBe(58);
  });

  it('spikes the attribute the role is actually judged on', () => {
    const peak = (role: 'FWD' | 'MID' | 'DEF') => {
      const attrs = specialHeroAttrs(role, 60);
      return OUTFIELD.reduce(
        (best, key) => (attrs[key] > attrs[best] ? key : best),
        OUTFIELD[0],
      );
    };
    expect([peak('FWD'), peak('MID'), peak('DEF')]).toEqual([
      'sho',
      'pas',
      'def',
    ]);
  });

  it('refuses to ship a rating it cannot hit exactly', () => {
    expect(() => specialHeroAttrs('FWD', 0)).toThrow();
  });
});

describe('placement in a career', () => {
  it('gives division five its one hero, on the strongest rival, in the starting eleven', () => {
    const career = createCareer(createLaunchCareerSetup(20260720));
    const specials = specialsIn(career);
    expect(specials.map((player) => player.name)).toEqual(['Larry Alan']);

    const hero = specials[0];
    expect(hero.clubId).not.toBe(career.userClubId);
    expect(hero.power).toBe('SUPER_SPEED');
    expect(hero.licensed).toBe(true);

    const squad = career.players.filter(
      (player) => player.clubId === hero.clubId,
    );
    const ordinary = squad.filter((player) => !isSpecialHeroId(player.id));
    const bestOrdinary = Math.max(...ordinary.map(overall));
    expect(overall(hero)).toBe(bestOrdinary + 8);
    expect(overall(hero)).toBeGreaterThan(Math.max(...ordinary.map(overall)));

    // Prepending matters: startingEleven takes the first N of each role in array
    // order, so an appended hero would sit on the bench for ever.
    const lineup = career.lineups.find((line) => line.clubId === hero.clubId)!;
    expect(lineup.playerIds).toContain(hero.id);

    // The intro and the pitch both receive this exact fixed face. Losing it at
    // the match boundary would fall back to a generated ordinary head.
    const matchTeam = buildCareerMatchTeamDef(career, hero.clubId);
    expect(
      matchTeam.players.find((player) => player.id === hero.id)?.lookId,
    ).toBe(hero.lookId);
  });

  it('never lets an ordinary player wear a reserved face', () => {
    const career = runHeadlessFullCareer(createLaunchCareerSetup(20260720), 7);
    const strays = career.players.filter(
      (player) =>
        !isSpecialHeroId(player.id) &&
        player.lookId !== undefined &&
        isReservedFieldLook(player.lookId),
    );
    expect(strays).toEqual([]);
  });

  it('rebuilds each season without duplicating a character or leaking into the pyramid', () => {
    const career = runHeadlessFullCareer(createLaunchCareerSetup(20260720), 7);
    const specials = specialsIn(career);
    expect(new Set(specials.map((player) => player.id)).size).toBe(
      specials.length,
    );

    // Specials belong to a division, not a club, so nothing may persist them
    // into pyramid data — that is what would carry a D1 character down to D4.
    const leaked = (career.m2?.pyramid.divisions ?? [])
      .flatMap((division) => division.clubs.flatMap((club) => club.squad))
      .filter((player) => isSpecialHeroId(player.id));
    expect(leaked).toEqual([]);

    for (const club of career.clubs) {
      expect(() => buildCareerMatchTeamDef(career, club.id)).not.toThrow();
      const lineup = career.lineups.find((row) => row.clubId === club.id)!;
      const licensedStarters = career.players.filter(
        (player) => lineup.playerIds.includes(player.id) && player.licensed,
      );
      expect(licensedStarters.length).toBeLessThanOrEqual(
        careerHeroLimit(career),
      );
    }
  });

  it('keeps the user club out of placement', () => {
    for (const seed of [20260720, 12345, 999]) {
      const career = runHeadlessFullCareer(createLaunchCareerSetup(seed), 4);
      for (const hero of specialsIn(career)) {
        expect(hero.clubId).not.toBe(career.userClubId);
      }
    }
  });
});
