import {
  buildSpriteAtlas,
  clearSpriteAtlasCache,
  type SkiaApi,
  type SkiaRectLike,
} from '../sprites/buildAtlas';
import { ATLAS_GUTTER, atlasLayout, loadSpriteSheet } from '../sprites/loader';

/**
 * Pins the packing guarantee the match renderer samples through.
 *
 * scripts/generate-sprites.mjs writes no padding of its own — the sprite sheet
 * is raw pixel-map rows — so the entire separation between one sprite and the
 * next is created here at runtime, by atlasLayout's grid and buildSpriteAtlas's
 * paint loop. Nothing else pins it, and bleed from a lost gutter would show up
 * as a stray shoe or hair pixel on a transformed sprite rather than as a
 * failing test. These assertions are the fence.
 *
 * The invariant, as implemented:
 *  - a fixed 8-column grid of slotW x slotH slots, slot = the largest frame in
 *    the sheet plus ATLAS_GUTTER on every side (loader.ts atlasLayout);
 *  - each source rect sits at the slot's top-left inset by exactly
 *    ATLAS_GUTTER, sized to its own sprite, so every rect keeps at least one
 *    transparent texel of margin on all four sides;
 *  - buildSpriteAtlas paints only inside that rect, one 1px-tall run at a time,
 *    onto a cols*slotW x rows*slotH surface.
 */

const fullSheet = loadSpriteSheet();
const fullLayout = atlasLayout(fullSheet);
const fullKeys = Object.keys(fullSheet.sprites);

/** Two looks is enough to fill several rows and still build in milliseconds. */
const LOOKS = ['r:f00', 'r:f01'] as const;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const isInteger = (rect: Rect): boolean =>
  Number.isInteger(rect.x) &&
  Number.isInteger(rect.y) &&
  Number.isInteger(rect.w) &&
  Number.isInteger(rect.h);

const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Clear texels between two rects on the axis they are furthest apart on. */
const separation = (a: Rect, b: Rect): number =>
  Math.max(
    Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w)),
    Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h)),
  );

describe('sprite atlas packing', () => {
  it('sizes every slot to the largest frame plus a gutter on each side', () => {
    const widths = Object.values(fullSheet.sprites).map(
      (frame) => frame[0].length,
    );
    const heights = Object.values(fullSheet.sprites).map(
      (frame) => frame.length,
    );

    // Padding is added here and nowhere else, so the number is worth stating.
    expect(ATLAS_GUTTER).toBe(1);
    expect(fullLayout.slotW).toBe(Math.max(...widths) + ATLAS_GUTTER * 2);
    expect(fullLayout.slotH).toBe(Math.max(...heights) + ATLAS_GUTTER * 2);
    expect(fullLayout.cols).toBe(8);
    expect(fullLayout.rows).toBe(Math.ceil(fullKeys.length / fullLayout.cols));

    // And the margin is exactly the gutter, not slack: the widest and tallest
    // frames in the sheet stop one texel short of their slot's far edge, so the
    // checks below are tight rather than trivially satisfied.
    const rects = fullKeys.map((key) => fullLayout.rectFor(key));
    expect(
      Math.max(...rects.map((rect) => (rect.x % fullLayout.slotW) + rect.w)),
    ).toBe(fullLayout.slotW - ATLAS_GUTTER);
    expect(
      Math.max(...rects.map((rect) => (rect.y % fullLayout.slotH) + rect.h)),
    ).toBe(fullLayout.slotH - ATLAS_GUTTER);
  });

  it('places every cell on an integer boundary, inset by the gutter', () => {
    const offenders: string[] = [];

    for (const key of fullKeys) {
      const rect = fullLayout.rectFor(key);
      const frame = fullSheet.sprites[key];
      const left = rect.x % fullLayout.slotW;
      const top = rect.y % fullLayout.slotH;

      if (!isInteger(rect)) offenders.push(`${key}: non-integer rect`);
      // The rect's own size, not the slot's — a 6x6 ball must not be stretched.
      if (rect.w !== frame[0].length || rect.h !== frame.length) {
        offenders.push(
          `${key}: rect ${rect.w}x${rect.h} != sprite ${frame[0].length}x${frame.length}`,
        );
      }
      if (left !== ATLAS_GUTTER || top !== ATLAS_GUTTER) {
        offenders.push(
          `${key}: inset ${left},${top} != gutter ${ATLAS_GUTTER}`,
        );
      }
      // The far edges matter as much as the near ones: the widest sprite in the
      // sheet is what makes the right/bottom margin tight.
      if (left + rect.w > fullLayout.slotW - ATLAS_GUTTER)
        offenders.push(`${key}: overruns its slot width`);
      if (top + rect.h > fullLayout.slotH - ATLAS_GUTTER)
        offenders.push(`${key}: overruns its slot height`);
    }

    expect(offenders).toEqual([]);
  });

  it('keeps every cell inside the surface buildSpriteAtlas allocates', () => {
    // buildAtlas.ts computes exactly this for Skia.Surface.MakeOffscreen.
    const atlasW = fullLayout.cols * fullLayout.slotW;
    const atlasH = fullLayout.rows * fullLayout.slotH;

    const outside = fullKeys.filter((key) => {
      const rect = fullLayout.rectFor(key);
      return (
        rect.x < 0 ||
        rect.y < 0 ||
        rect.x + rect.w > atlasW ||
        rect.y + rect.h > atlasH
      );
    });

    expect(outside).toEqual([]);
  });

  it('gives every cell a slot of its own, so no two can overlap', () => {
    // Slots tile the atlas without overlapping, and the test above proves each
    // rect sits wholly inside its own slot — so one occupant per slot is a
    // complete non-overlap proof across all 7k+ cells without going quadratic.
    const occupant = new Map<string, string>();
    const shared: string[] = [];

    for (const key of fullKeys) {
      const rect = fullLayout.rectFor(key);
      const slot = `${Math.floor(rect.x / fullLayout.slotW)},${Math.floor(rect.y / fullLayout.slotH)}`;
      const previous = occupant.get(slot);
      if (previous !== undefined)
        shared.push(`${previous} and ${key} share slot ${slot}`);
      else occupant.set(slot, key);
    }

    expect(shared).toEqual([]);
    expect(occupant.size).toBe(fullKeys.length);
  });

  it('leaves a transparent texel between every pair of cells', () => {
    // Brute force on a small sheet, assuming nothing about the grid: the sheet
    // still spans several rows and mixes the 6x6 ball with full-size frames.
    const sheet = loadSpriteSheet(LOOKS);
    const layout = atlasLayout(sheet);
    const rects = Object.keys(sheet.sprites).map((key) => ({
      key,
      rect: layout.rectFor(key),
    }));
    const touching: string[] = [];

    expect(rects.length).toBeGreaterThan(layout.cols);
    for (let i = 0; i < rects.length; i += 1) {
      for (let j = i + 1; j < rects.length; j += 1) {
        const pair = `${rects[i].key} / ${rects[j].key}`;
        if (overlaps(rects[i].rect, rects[j].rect))
          touching.push(`${pair}: overlap`);
        // A gutter on each of the two facing edges — one texel is not enough,
        // because a sprite scaled up samples off both sides of the boundary.
        else if (separation(rects[i].rect, rects[j].rect) < ATLAS_GUTTER * 2) {
          touching.push(
            `${pair}: only ${separation(rects[i].rect, rects[j].rect)}px apart`,
          );
        }
      }
    }

    expect(touching).toEqual([]);
  });
});

/** Records what buildSpriteAtlas asks Skia to allocate and paint. */
function recordingSkia() {
  const drawn: SkiaRectLike[] = [];
  const surface: { width: number; height: number }[] = [];
  const api = {
    Surface: {
      MakeOffscreen: (width: number, height: number) => {
        surface.push({ width, height });
        return {
          getCanvas: () => ({
            drawRect: (rect: SkiaRectLike) => {
              drawn.push(rect);
            },
          }),
          flush: () => undefined,
          makeImageSnapshot: () => ({ makeNonTextureImage: () => ({}) }),
        };
      },
    },
    Paint: () => ({ setColor: () => undefined }),
    Color: (value: string) => value,
  } as unknown as SkiaApi;
  return { api, drawn, surface };
}

describe('sprite atlas painting', () => {
  beforeEach(clearSpriteAtlasCache);
  afterEach(clearSpriteAtlasCache);

  it('paints every pixel run inside its own cell, never into a gutter', () => {
    const sheet = loadSpriteSheet(LOOKS);
    const layout = atlasLayout(sheet);
    const cellForSlot = new Map<string, { key: string; rect: Rect }>();
    for (const key of Object.keys(sheet.sprites)) {
      const rect = layout.rectFor(key);
      const slot = `${Math.floor(rect.x / layout.slotW)},${Math.floor(rect.y / layout.slotH)}`;
      cellForSlot.set(slot, { key, rect });
    }
    const skia = recordingSkia();

    buildSpriteAtlas(skia.api, LOOKS);

    // The offscreen surface is exactly the packed grid — no slack row or column
    // a stray run could hide in.
    expect(skia.surface).toEqual([
      {
        width: layout.cols * layout.slotW,
        height: layout.rows * layout.slotH,
      },
    ]);
    expect(skia.drawn.length).toBeGreaterThan(0);

    const strays: string[] = [];
    for (const run of skia.drawn) {
      const xInSlot = run.x % layout.slotW;
      const yInSlot = run.y % layout.slotH;
      const cell = cellForSlot.get(
        `${Math.floor(run.x / layout.slotW)},${Math.floor(run.y / layout.slotH)}`,
      );
      const at = `run ${run.x},${run.y} w${run.width} h${run.height}`;

      if (
        !Number.isInteger(run.x) ||
        !Number.isInteger(run.y) ||
        !Number.isInteger(run.width)
      ) {
        strays.push(`${at}: non-integer`);
        continue;
      }
      // One row at a time is what keeps a run from spilling into the row below.
      if (run.height !== 1) {
        strays.push(`${at}: height != 1`);
        continue;
      }
      if (cell === undefined) {
        strays.push(`${at}: lands in no cell`);
        continue;
      }
      if (
        run.x < cell.rect.x ||
        run.x + run.width > cell.rect.x + cell.rect.w
      ) {
        strays.push(`${at}: leaves ${cell.key} horizontally`);
      }
      if (run.y < cell.rect.y || run.y + 1 > cell.rect.y + cell.rect.h) {
        strays.push(`${at}: leaves ${cell.key} vertically`);
      }
      // Restating the same fact as the bleed guarantee: the gutter ring around
      // every slot stays unpainted, so a neighbour can never be sampled.
      if (
        xInSlot < ATLAS_GUTTER ||
        xInSlot + run.width > layout.slotW - ATLAS_GUTTER
      ) {
        strays.push(`${at}: paints the horizontal gutter`);
      }
      if (yInSlot < ATLAS_GUTTER || yInSlot + 1 > layout.slotH - ATLAS_GUTTER) {
        strays.push(`${at}: paints the vertical gutter`);
      }
    }

    expect(strays).toEqual([]);
  });
});
