import sheetData from '../sprites.json';
import { deriveBackFacingFrame, loadSpriteSheet, type SpriteSheet } from '../loader';

/**
 * The pitch is vertical, so a run cycle has to read as motion toward or away
 * from the camera: boots square to their own shin (no sideways toe overhang)
 * and a stride that alternates which foot is nearer. Every run frame on the
 * sheet is held to that, which is what makes the mechanical rollout across all
 * 866 looks trustworthy. Keeper ready poses are a planted stance, not a stride,
 * and are excluded by design.
 */
const sheet = sheetData as SpriteSheet;
const BOOT_BAND_TOP = 26;
const BOOT_TOKENS = 'WwGg'; // boot white/off-white, plus the derived sole greys
const SHIN = { left: [9, 10], right: [13, 14] } as const;
const OUTLINE = 'K';

const runKeys = Object.keys(sheet.sprites).filter(key => /:run[01]$/.test(key));
const readyKeys = Object.keys(sheet.sprites).filter(key => /:ready[01]$/.test(key));
const lookIds = [...new Set(runKeys.map(key => key.replace(/:run[01]$/, '')))];

const band = (rows: readonly string[]) => rows.slice(BOOT_BAND_TOP);
const isBoot = (token: string) => BOOT_TOKENS.includes(token);

function bootColumns(row: string): number[] {
  return [...row].flatMap((token, column) => isBoot(token) ? [column] : []);
}

/** Deepest band row carrying a boot pixel in the given columns, or -1. */
function bootBottom(rows: readonly string[], columns: readonly number[]): number {
  let bottom = -1;
  rows.forEach((row, index) => {
    if (columns.some(column => isBoot(row[column]))) bottom = index;
  });
  return bottom;
}

/** Maximal runs of columns carrying boot pixels — one group per boot. */
function bootGroups(rows: readonly string[]): number[][] {
  const groups: number[][] = [];
  for (let column = 0; column < sheet.cell.w; column += 1) {
    if (!rows.some(row => isBoot(row[column]))) continue;
    const previous = groups[groups.length - 1];
    if (previous !== undefined && previous[previous.length - 1] === column - 1) previous.push(column);
    else groups.push([column]);
  }
  return groups;
}

const paintedColumns = (rows: readonly string[]) => [...new Set(rows
  .flatMap(row => [...row].flatMap((token, column) => token === '.' ? [] : [column])))].sort();

const silhouette = (rows: readonly string[]) => rows.map(row => row.replace(/[^.]/g, '#'));

describe('vertical-pitch run cycle feet', () => {
  it('covers every look on the sheet', () => {
    expect(lookIds).toHaveLength(866);
    expect(runKeys).toHaveLength(1732);
    expect(readyKeys).toHaveLength(100);
  });

  it('keeps every run frame on the declared grid', () => {
    const faults: string[] = [];
    let checkedRows = 0;
    for (const key of runKeys) {
      const rows = sheet.sprites[key];
      if (rows.length !== sheet.cell.h) faults.push(`${key}: ${rows.length} rows`);
      rows.forEach((row, index) => {
        checkedRows += 1;
        if (row.length !== sheet.cell.w) faults.push(`${key} row ${index}: width ${row.length}`);
        for (const token of row) {
          if (!(token in sheet.palette)) faults.push(`${key} row ${index}: token "${token}"`);
        }
      });
    }
    expect(faults).toEqual([]);
    expect(checkedRows).toBe(runKeys.length * sheet.cell.h);
  });

  it('points the toes at the camera: no boot pixel overhangs its own shin', () => {
    const allowed = new Set<number>([...SHIN.left, ...SHIN.right]);
    const overhangs = runKeys.flatMap(key => band(sheet.sprites[key]).flatMap((row, index) => (
      bootColumns(row).filter(column => !allowed.has(column)).map(column => `${key} row ${index} col ${column}`)
    )));
    expect(overhangs).toEqual([]);
  });

  it('strides along the pitch axis: one foot nearer, roles swapping per frame', () => {
    for (const id of lookIds) {
      const run0 = band(sheet.sprites[`${id}:run0`]);
      const run1 = band(sheet.sprites[`${id}:run1`]);
      const near0 = bootBottom(run0, SHIN.left);
      const far0 = bootBottom(run0, SHIN.right);
      const near1 = bootBottom(run1, SHIN.right);
      const far1 = bootBottom(run1, SHIN.left);
      expect({ id, planted: near0 > far0, present: far0 >= 0 }).toEqual({ id, planted: true, present: true });
      expect({ id, planted: near1 > far1, present: far1 >= 0 }).toEqual({ id, planted: true, present: true });
      // The lifted boot keeps a dark sole edge directly beneath it.
      expect(run0[far0 + 1][SHIN.right[0]]).toBe(OUTLINE);
      expect(run1[far1 + 1][SHIN.left[0]]).toBe(OUTLINE);
    }
  });

  it('no longer sways the legs sideways between frames', () => {
    for (const id of lookIds) {
      expect({ id, columns: paintedColumns(band(sheet.sprites[`${id}:run0`])) })
        .toEqual({ id, columns: paintedColumns(band(sheet.sprites[`${id}:run1`])) });
    }
  });

  it('keeps each look its own skin and boot tokens', () => {
    // Shin tokens differ across looks; a bulk rewrite must not paste one look's
    // skin onto another. The planted leg still shows shin on the first boot row.
    const shinPairs = new Set(lookIds.map(id => sheet.sprites[`${id}:run0`][27].slice(9, 11)));
    expect(shinPairs.size).toBeGreaterThan(4);
    for (const id of lookIds) {
      const run0 = sheet.sprites[`${id}:run0`];
      const run1 = sheet.sprites[`${id}:run1`];
      expect(run1[27].slice(13, 15)).toBe([...run0[27].slice(9, 11)].reverse().join(''));
      expect(run0[26]).toBe(run1[26]);
    }
  });

  it('turns the near boot sole-side out in every derived rear view', () => {
    for (const [frame, near, far] of [
      ['run0', SHIN.left, SHIN.right],
      ['run1', SHIN.right, SHIN.left],
    ] as const) {
      for (const id of lookIds) {
        const front = band(sheet.sprites[`${id}:${frame}`]);
        const back = band(deriveBackFacingFrame(sheet.sprites[`${id}:${frame}`]));
        expect({ id, frame, sole: back.some(row => near.some(column => 'Gg'.includes(row[column]))) })
          .toEqual({ id, frame, sole: true });
        expect({ id, frame, heel: back.every(row => far.every(column => !'Gg'.includes(row[column]))) })
          .toEqual({ id, frame, heel: true });
        expect(silhouette(back)).toEqual(silhouette(front));
      }
    }
  });

  it('leaves keeper ready poses level and untouched by the rear-sole swap', () => {
    for (const key of readyKeys) {
      const rows = sheet.sprites[key];
      const bootBand = band(rows);
      const bottoms = bootGroups(bootBand).map(group => bootBottom(bootBand, group));
      expect(bottoms.length).toBeGreaterThan(1);
      expect(new Set(bottoms).size).toBe(1); // level feet, so the swap never fires
      expect(band(deriveBackFacingFrame(rows))).toEqual(bootBand);
    }
  });

  it('carries the reworked feet through the real load pipeline', () => {
    const loaded = loadSpriteSheet(['r:f00', 'r:g00']);
    expect(band(loaded.sprites['r:f00:back0'])).not.toEqual(band(loaded.sprites['r:f00:run0']));
    expect(band(loaded.sprites['r:f00:back0']).join('')).toContain('G');
    expect(band(loaded.sprites['r:g00:backReady0'])).toEqual(band(loaded.sprites['r:g00:ready0']));
  });
});
