import { clubKitPlan, swatchById } from '../club-kit';
import { loadSpriteSheet } from '../loader';

const KIT = { base: 'FOREST', pattern: 'STRIPES', patternColor: 'STONE' };
const band = (rows: readonly string[]) => rows.slice(16, 24).join('');

/**
 * The complaint this answers: "before, their jersey colour was constantly
 * changing". It was, and it was not a bug — the sprite sheet ships a red home
 * kit and a blue away kit, and a club wore whichever side of the fixture it
 * took. So the same squad changed colour every other week.
 *
 * A chosen kit has to beat that: it belongs to the CLUB, so it travels with
 * them to both sides of the draw.
 */
describe('a chosen kit travels with the club', () => {
  it('paints the same shirt whether the club is at home or away', () => {
    const forest = swatchById('FOREST')!.ramp;
    const stone = swatchById('STONE')!.ramp;

    const home = loadSpriteSheet(
      ['r:f00'],
      clubKitPlan({ kit: KIT, userSide: 'r', colorSafeKits: false }),
    );
    const away = loadSpriteSheet(
      ['u:f00'],
      clubKitPlan({ kit: KIT, userSide: 'u', colorSafeKits: false }),
    );

    // Same tokens, same colours behind them, whichever side the club took.
    expect(band(away.sprites['u:f00:run0'])).toBe(
      band(home.sprites['r:f00:run0']),
    );
    for (const step of [0, 1, 2]) {
      expect(home.palette[String(step + 1)]).toBe(forest[step]);
      expect(away.palette[String(step + 1)]).toBe(forest[step]);
      expect(home.palette[String(step + 4)]).toBe(stone[step]);
      expect(away.palette[String(step + 4)]).toBe(stone[step]);
    }
  });

  it('leaves a club with no chosen kit changing sides as it always did', () => {
    const home = loadSpriteSheet(
      ['r:f00'],
      clubKitPlan({ userSide: 'r', colorSafeKits: false }),
    );
    const away = loadSpriteSheet(
      ['u:f00'],
      clubKitPlan({ userSide: 'u', colorSafeKits: false }),
    );
    expect(band(away.sprites['u:f00:run0'])).not.toBe(
      band(home.sprites['r:f00:run0']),
    );
  });

  it('keeps the opponent in a strip the club is not wearing', () => {
    const plan = clubKitPlan({ kit: KIT, userSide: 'u', colorSafeKits: false });
    expect(plan.u?.base).toEqual(swatchById('FOREST')!.ramp);
    // The home opponent keeps its authored red: FOREST clashes with neither
    // stock kit, so nobody has to change.
    expect(plan.r).toBeUndefined();
  });
});
