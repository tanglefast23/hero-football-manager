import {
  FLOODLIGHT_HEIGHT,
  FLOODLIGHT_WIDTH,
  GRASS_BANDS,
  GRASS_PERCENT,
  GROUND_PALETTE,
  HORIZON_PERCENT,
  SKY_BANDS,
  STAND_TILE_HEIGHT,
  STAND_TILE_WIDTH,
  crowdSpeckle,
  floodlightRuns,
  groundScene,
  standRuns,
} from '../endgame-ground';

/** The phone floor the scene is composed against. */
const PHONE = { width: 375, height: 812 };

describe('the ground as pixel art', () => {
  it('draws the stand from bays of a single declared width', () => {
    const runs = standRuns(STAND_TILE_WIDTH);

    expect(runs.length).toBeGreaterThan(0);
    runs.forEach((run) => {
      expect(run.x).toBeGreaterThanOrEqual(0);
      expect(run.x + run.width).toBeLessThanOrEqual(STAND_TILE_WIDTH);
      expect(run.y).toBeLessThan(STAND_TILE_HEIGHT);
      expect(run.width).toBeGreaterThan(0);
    });
  });

  it('draws the floodlight inside its own cell', () => {
    const runs = floodlightRuns();

    expect(runs.length).toBeGreaterThan(0);
    runs.forEach((run) => {
      expect(run.x).toBeGreaterThanOrEqual(0);
      expect(run.x + run.width).toBeLessThanOrEqual(FLOODLIGHT_WIDTH);
      expect(run.y).toBeLessThan(FLOODLIGHT_HEIGHT);
      expect(run.width).toBeGreaterThan(0);
    });
  });

  /**
   * Runs are same-ink spans, so two of them may never touch on one row: a
   * split that produced neighbours means a run was cut for no reason and the
   * stand costs more rects than it needs.
   */
  it.each([
    ['the stand', () => standRuns(STAND_TILE_WIDTH * 3)],
    ['the floodlight', floodlightRuns],
  ])('merges every same-ink span of %s', (_label, build) => {
    const byRow = new Map<number, ReturnType<typeof floodlightRuns>>();
    build().forEach((run) =>
      byRow.set(run.y, [...(byRow.get(run.y) ?? []), run]),
    );

    byRow.forEach((row) => {
      const ordered = [...row].sort((left, right) => left.x - right.x);
      ordered.forEach((run, index) => {
        const previous = ordered[index - 1];
        if (previous === undefined) return;
        expect(
          previous.x + previous.width === run.x && previous.color === run.color,
        ).toBe(false);
      });
    });
  });

  /**
   * Bays are stitched into full-width rows before flattening. A uniform row —
   * the roof, the wall — must therefore come back as one run however many bays
   * it spans, not one run per bay.
   */
  it('merges a uniform row across every bay it spans', () => {
    const wide = standRuns(STAND_TILE_WIDTH * 4);
    const roof = wide.filter((run) => run.y === 0);

    expect(roof).toHaveLength(1);
    expect(roof[0].width).toBe(STAND_TILE_WIDTH * 4);
  });

  it('paints only from the ground palette', () => {
    const inks = new Set(Object.values(GROUND_PALETTE));

    [...standRuns(STAND_TILE_WIDTH), ...floodlightRuns()].forEach((run) => {
      expect(inks.has(run.color)).toBe(true);
    });
  });

  /** A gap in a row would be a hole in the stand with the sky behind it. */
  it('paints every column of every row of the stand', () => {
    const columns = STAND_TILE_WIDTH * 3 + 5;
    const byRow = new Map<number, number>();
    standRuns(columns).forEach((run) =>
      byRow.set(run.y, (byRow.get(run.y) ?? 0) + run.width),
    );

    expect(byRow.size).toBe(STAND_TILE_HEIGHT);
    byRow.forEach((painted) => expect(painted).toBe(columns));
  });

  it('has an empty stand rather than a broken one at zero width', () => {
    expect(standRuns(0)).toEqual([]);
    expect(crowdSpeckle(0)).toEqual([]);
  });
});

describe('the crowd', () => {
  it('stands in the same places every time', () => {
    expect(crowdSpeckle(60)).toEqual(crowdSpeckle(60));
  });

  it('spreads across the whole stand rather than clumping in one bay', () => {
    const columns = 60;
    const bays = new Set(
      crowdSpeckle(columns).map((speck) =>
        Math.floor(speck.x / STAND_TILE_WIDTH),
      ),
    );

    expect(bays.size).toBe(Math.ceil(columns / STAND_TILE_WIDTH));
  });

  it('keeps every supporter on the terrace, never on the roof or the wall', () => {
    crowdSpeckle(60).forEach((speck) => {
      expect(speck.x).toBeGreaterThanOrEqual(0);
      expect(speck.x).toBeLessThan(60);
      // Below the roof and its dark underside, above the front rail.
      expect(speck.y).toBeGreaterThanOrEqual(6);
      expect(speck.y).toBeLessThanOrEqual(16);
    });
  });
});

describe('the composition', () => {
  /**
   * The fault this scene replaced: a dark strip of sky, an empty purple band
   * doing nothing through the middle, and a pitch at the bottom. Every
   * horizontal slice now belongs to sky, stand or grass.
   */
  it('leaves no horizontal slice of the window to nobody', () => {
    const scene = groundScene(PHONE.width, PHONE.height);
    const spans = [...scene.sky, ...scene.rects]
      .map((rect) => ({ top: rect.y, bottom: rect.y + rect.height }))
      .sort((left, right) => left.top - right.top);

    // Merged, the painted bands have to come back as one unbroken run from the
    // top of the window to the bottom.
    const merged: { top: number; bottom: number }[] = [];
    spans.forEach((span) => {
      const last = merged[merged.length - 1];
      if (last !== undefined && span.top <= last.bottom + 0.001) {
        last.bottom = Math.max(last.bottom, span.bottom);
        return;
      }
      merged.push({ ...span });
    });

    expect(merged).toHaveLength(1);
    expect(merged[0].top).toBe(0);
    expect(merged[0].bottom).toBeCloseTo(PHONE.height, 5);
  });

  it('puts the horizon and the grass line where the bands say', () => {
    const scene = groundScene(PHONE.width, PHONE.height);

    expect(scene.horizonY).toBeCloseTo(
      (PHONE.height * HORIZON_PERCENT) / 100,
      5,
    );
    expect(scene.grassTopY).toBeCloseTo(
      (PHONE.height * GRASS_PERCENT) / 100,
      5,
    );
    expect(scene.horizonY).toBeLessThan(scene.grassTopY);
  });

  it('ends both ramps exactly at their band edge', () => {
    expect(SKY_BANDS[SKY_BANDS.length - 1].end).toBe(1);
    expect(GRASS_BANDS[GRASS_BANDS.length - 1].end).toBe(1);
    [SKY_BANDS, GRASS_BANDS].forEach((bands) => {
      bands.forEach((band, index) => {
        expect(band.end).toBeGreaterThan(
          index === 0 ? 0 : bands[index - 1].end,
        );
      });
    });
  });

  /**
   * The stripes carry the perspective. Identical ones read as a texture; ones
   * that widen as they come forward read as a plane running away from you.
   */
  it('widens the mown stripes toward the viewer', () => {
    const turf = GRASS_BANDS.slice(2);
    const heights = turf.map(
      (band, index) =>
        band.end - (index === 0 ? GRASS_BANDS[1].end : turf[index - 1].end),
    );

    heights.forEach((bandHeight, index) => {
      if (index === 0) return;
      expect(bandHeight).toBeGreaterThan(heights[index - 1]);
    });
  });

  it('stands both floodlights on the screen with their lamps in the sky', () => {
    const scene = groundScene(PHONE.width, PHONE.height);

    expect(scene.glows.length).toBeGreaterThan(0);
    scene.glows.forEach((glow) => {
      expect(glow.cx).toBeGreaterThan(0);
      expect(glow.cx).toBeLessThan(PHONE.width);
      expect(glow.cy).toBeLessThan(scene.horizonY);
      expect(glow.opacity).toBeLessThan(0.2);
    });
  });

  it('covers the window at any size without a gap at the right edge', () => {
    [{ width: 320, height: 568 }, PHONE, { width: 1280, height: 800 }].forEach(
      ({ width, height }) => {
        const scene = groundScene(width, height);
        const roof = scene.rects.filter((rect) =>
          rect.id.startsWith('stand-0-'),
        );
        const painted = roof.reduce((total, rect) => total + rect.width, 0);

        expect(painted).toBeGreaterThanOrEqual(width);
      },
    );
  });

  /** No image assets: the whole ground is rects and two haloes. */
  it('draws itself out of rectangles and nothing else', () => {
    const scene = groundScene(PHONE.width, PHONE.height);
    const painted = [...scene.sky, ...scene.rects];

    expect(painted.length).toBeGreaterThan(0);
    painted.forEach((rect) => {
      expect(rect.width).toBeGreaterThan(0);
      expect(rect.height).toBeGreaterThan(0);
      expect(rect.color).toMatch(/^#[0-9a-f]{6}$/);
    });
    expect(new Set(painted.map((rect) => rect.id)).size).toBe(painted.length);
  });
});
