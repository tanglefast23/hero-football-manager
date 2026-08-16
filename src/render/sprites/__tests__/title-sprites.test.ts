import fullSheet from '../sprites.json';
import titleSheet from '../title-sprites.json';
import { TITLE_SPRITE_KEYS } from '../../../ui/components/title-sprite-keys';

/**
 * `title-sprites.json` is the reason the web first load no longer carries the
 * 1.98 MB match sprite pool: the title screen draws 13 sprites and now imports
 * only those. Three things have to stay true or that trade goes bad.
 *
 * 1. The subset holds exactly the keys `TITLE_SPRITE_KEYS` names. That const
 *    also types the pop scenes' hero tables, so a scene asking for anything
 *    else is already a compile error; this catches the other half, where
 *    someone adds a key and forgets to run the extract.
 * 2. Every subset sprite is the full sheet's own rows, so the title cannot
 *    drift into different pixels. Rewrite the subset with
 *    `node scripts/generate-title-sprites.mjs`, which EXTRACTS from the
 *    checked-in sheet — never regenerate it from `player-art-roster.mjs`,
 *    whose hair ramp has drifted from what ships (see
 *    `hair-skin-separation.test.ts`).
 * 3. It stays a subset. The whole pool would put 1.98 MB back in the first
 *    load, and no test below would otherwise notice.
 */
describe('title sprite subset', () => {
  it('holds exactly the keys the pop scenes are typed against', () => {
    expect(Object.keys(titleSheet.sprites).sort()).toEqual(
      [...TITLE_SPRITE_KEYS].sort(),
    );
  });

  it('carries the same rows as the full sheet', () => {
    for (const key of TITLE_SPRITE_KEYS) {
      expect(
        titleSheet.sprites[key as keyof typeof titleSheet.sprites],
      ).toEqual(fullSheet.sprites[key as keyof typeof fullSheet.sprites]);
    }
  });

  it('carries the same cell and palette as the full sheet', () => {
    expect(titleSheet.cell).toEqual(fullSheet.cell);
    expect(titleSheet.palette).toEqual(fullSheet.palette);
  });

  it('stays a subset — the whole pool would put 1.98 MB back in the first load', () => {
    expect(Object.keys(titleSheet.sprites).length).toBeLessThan(
      Object.keys(fullSheet.sprites).length / 10,
    );
  });
});
