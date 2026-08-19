import {
  allocateTickerLane,
  BANNER_BIG_FONT_PX,
  BANNER_FONT_PX,
  goalTickerLifeTicks,
  tickerBandTop,
  TICKER_TOP_INSET,
  EXTRUDE_OFFSETS,
  EXTRUDE_STEPS,
  OUTLINE_OFFSETS,
  OUTLINE_OFFSETS_CHEAP,
  OUTLINE_PX,
  SHADOW_DROP_PX,
  tickerDurationMs,
  tickerLane,
  tickerLaneTop,
  tickerRemainingDurationMs,
  TICKER_LANE_HEIGHT,
  TICKER_LANES,
  tickerTranslateX,
} from '../match-ticker';

describe('outline offsets', () => {
  it('rings the glyphs on all eight sides without a copy on top of the fill', () => {
    expect(OUTLINE_OFFSETS).toHaveLength(8);
    expect(
      OUTLINE_OFFSETS.some((offset) => offset.x === 0 && offset.y === 0),
    ).toBe(false);
    const unique = new Set(OUTLINE_OFFSETS.map((o) => `${o.x},${o.y}`));
    expect(unique.size).toBe(8);
    for (const offset of OUTLINE_OFFSETS) {
      expect(Math.max(Math.abs(offset.x), Math.abs(offset.y))).toBe(OUTLINE_PX);
    }
  });

  it('keeps a four-sided ring for reduced-effects devices, never an empty one', () => {
    expect(OUTLINE_OFFSETS_CHEAP).toHaveLength(4);
    expect(OUTLINE_OFFSETS_CHEAP.every((o) => o.x === 0 || o.y === 0)).toBe(
      true,
    );
  });
});

describe('extrusion', () => {
  it('steps the slab down from the fill, deepest copy painted first', () => {
    expect(EXTRUDE_OFFSETS).toEqual([2, 1]);
    expect(EXTRUDE_OFFSETS).toHaveLength(EXTRUDE_STEPS);
    // Every step is below the fill, or the slab would sit on top of the text.
    expect(EXTRUDE_OFFSETS.every((drop) => drop > 0)).toBe(true);
  });

  it('puts the soft shadow under the deepest slab step, not inside it', () => {
    expect(SHADOW_DROP_PX).toBeGreaterThan(Math.max(...EXTRUDE_OFFSETS));
  });
});

describe('allocateTickerLane', () => {
  it('fills the hole a middle line left behind instead of stacking on a live one', () => {
    // Lanes 0, 2 and 3 are still running; lane 1 expired.
    expect(allocateTickerLane([0, 2, 3], 0)).toBe(1);
  });

  it('hands out every lane before it repeats', () => {
    const taken: number[] = [];
    for (let i = 0; i < TICKER_LANES; i += 1) {
      taken.push(allocateTickerLane(taken, 0));
    }
    expect(taken).toEqual([0, 1, 2, 3]);
  });

  it('falls back to the lane the newest-four cap is about to free', () => {
    expect(allocateTickerLane([0, 1, 2, 3], 2)).toBe(2);
  });
});

describe('tickerLane', () => {
  it('gives a fresh line the lowest free lane', () => {
    expect(tickerLane([{ lane: 0 }, { lane: 2 }], undefined)).toBe(1);
  });

  it('reuses the lane of the line it replaces, so a coaching tap never jumps rows', () => {
    const live = [
      { lane: 0, subject: 'formation' },
      { lane: 1, subject: 'mentality' },
    ];
    expect(tickerLane(live, 'formation')).toBe(0);
    expect(tickerLane(live, 'mentality')).toBe(1);
  });

  it('treats a subject with no live line as a fresh line', () => {
    expect(tickerLane([{ lane: 0, subject: 'formation' }], 'energy')).toBe(1);
  });

  it('falls back to the oldest line lane when all four are running', () => {
    const live = [{ lane: 3 }, { lane: 0 }, { lane: 1 }, { lane: 2 }];
    expect(tickerLane(live, undefined)).toBe(3);
  });
});

describe('tickerDurationMs', () => {
  it('crosses in the wall-clock time the tick lifetime is worth at each speed', () => {
    expect(tickerDurationMs(30, 1)).toBe(3000);
    expect(tickerDurationMs(30, 2)).toBe(1500);
    expect(tickerDurationMs(30, 3)).toBe(1000);
    // The rival Zone warning holds 20 ticks, not 30.
    expect(tickerDurationMs(20, 1)).toBe(2000);
  });

  it('is never zero and never infinite', () => {
    expect(tickerDurationMs(0, 1)).toBeGreaterThan(0);
    expect(Number.isFinite(tickerDurationMs(30, 3))).toBe(true);
  });
});

describe('tickerRemainingDurationMs', () => {
  it('retimes only the distance left when the speed changes mid-crossing', () => {
    // Half way across a 30-tick line, the manager taps ×2: 1500ms of crossing
    // remains at ×1, so 750ms remains at ×2.
    expect(tickerRemainingDurationMs(0.5, 30, 1)).toBe(1500);
    expect(tickerRemainingDurationMs(0.5, 30, 2)).toBe(750);
  });

  it('resumes a paused line from where it stopped, not from the left edge', () => {
    expect(tickerRemainingDurationMs(0.9, 30, 1)).toBeCloseTo(300, 5);
    expect(tickerRemainingDurationMs(0, 30, 1)).toBe(3000);
  });

  it('clamps a finished or out-of-range crossing to a positive duration', () => {
    expect(tickerRemainingDurationMs(1, 30, 1)).toBe(1);
    expect(tickerRemainingDurationMs(1.4, 30, 1)).toBe(1);
    expect(tickerRemainingDurationMs(-2, 30, 1)).toBe(3000);
  });
});

describe('tickerTranslateX', () => {
  it('starts fully off the left touchline and ends fully off the right', () => {
    expect(tickerTranslateX(0, 400)).toBe(-400);
    expect(tickerTranslateX(1, 400)).toBe(400);
    expect(tickerTranslateX(0.5, 400)).toBe(0);
  });

  it('moves every line the same distance so a goal keeps its power line', () => {
    // Two rows at the same progress share an x whatever their text is.
    expect(tickerTranslateX(0.31, 360)).toBe(tickerTranslateX(0.31, 360));
    let previous = -Infinity;
    for (let p = 0; p <= 1; p += 0.1) {
      const x = tickerTranslateX(p, 360);
      expect(x).toBeGreaterThan(previous);
      previous = x;
    }
  });
});

describe('lane geometry', () => {
  it('stacks lanes without letting the outline of one paint into the next', () => {
    expect(tickerLaneTop(0)).toBe(0);
    expect(tickerLaneTop(1)).toBe(TICKER_LANE_HEIGHT);
    // 18pt type + a 2pt ring + a 3pt extrusion has to fit inside a lane.
    expect(TICKER_LANE_HEIGHT).toBeGreaterThanOrEqual(18 + OUTLINE_PX * 2 + 3);
  });
});

describe('goalTickerLifeTicks', () => {
  it('slows the scorer line more the faster the match runs', () => {
    expect(goalTickerLifeTicks(30, 1)).toBe(35); // 30 * 1.15
    expect(goalTickerLifeTicks(30, 2)).toBe(39); // 30 * 1.3
    expect(goalTickerLifeTicks(30, 3)).toBe(48); // 30 * 1.6
  });

  it('leaves a goal crossing longer than a normal line at every speed', () => {
    for (const speed of [1, 2, 3] as const) {
      expect(
        tickerDurationMs(goalTickerLifeTicks(30, speed), speed),
      ).toBeGreaterThan(tickerDurationMs(30, speed));
    }
  });
});

describe('the doubled goal line', () => {
  it('takes two lanes so its power footnote is not printed through it', () => {
    // A goal on an empty ticker takes lanes 0 and 1; the footnote gets lane 2.
    expect(tickerLane([], undefined, 'big')).toBe(0);
    expect(tickerLane([{ lane: 0, size: 'big' }], undefined)).toBe(2);
  });

  it('will not start on the last lane, where its lower half would be clipped', () => {
    const live = [{ lane: 0 }, { lane: 1 }];
    expect(tickerLane(live, undefined)).toBe(2);
    // Only lanes 2+3 are free, and a big line needs both.
    expect(tickerLane(live, undefined, 'big')).toBe(2);
    expect(tickerLane([...live, { lane: 2 }], undefined, 'big')).toBe(0);
  });

  it('is twice the announcement size, and fits two lanes', () => {
    expect(BANNER_BIG_FONT_PX).toBe(BANNER_FONT_PX * 2);
    // Silkscreen's box is 1.28em: 46pt of type has to sit in the two lanes
    // tickerLaneSpan reserves for it.
    expect(BANNER_BIG_FONT_PX * 1.28).toBeLessThanOrEqual(
      TICKER_LANE_HEIGHT * 2,
    );
  });
});

describe('tickerBandTop', () => {
  it('drops the band 5% of the pitch below the touchline inset', () => {
    expect(tickerBandTop(600)).toBe(TICKER_TOP_INSET + 30);
    expect(tickerBandTop(0)).toBe(TICKER_TOP_INSET);
  });
});
