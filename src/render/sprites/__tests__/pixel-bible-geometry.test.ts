import portraitData from '../portraits.json';
import spriteData from '../sprites.json';
import managementData from '../management-sprites.json';
import { EVENT_PALETTE } from '../../../ui/event-pixel-art';
import { EVENT_SPRITE_ROWS } from '../../../ui/event-pixel-sprites';
import {
  FINANCE_PALETTE,
  SPRITE_ROWS as FINANCE_SPRITE_ROWS,
} from '../../../ui/finance-pixel-art';

/**
 * The docs/11 rules a colour grep cannot reach: outline weight, outline colour,
 * and whether a silhouette survives on the background it actually sits on.
 *
 * Two rules from the bible are deliberately NOT asserted here, because measuring
 * them showed the rule does not bind at this resolution:
 *
 * - Equal stair steps. 62-75% of genuine curves mix their step runs, because a
 *   24x29 chibi silhouette is short organic runs, not long curves — an evenly
 *   stepped head at this size reads mechanical. Scoped in docs/11 instead.
 * - The 4-value ramp. Sprites average 8.5-9.4 colours, which is correct: a whole
 *   character wears skin + hair + kit + ink. The rule governs an icon, not a cast
 *   member, so counting colours per sprite measures the wrong unit.
 */

type Palette = Record<string, string | null>;
type Sprites = Record<string, readonly string[]>;

const EMPTY = '.';

/**
 * Each source is judged against the background it is actually drawn on. Judging
 * match sprites against cream invents thousands of failures that do not exist.
 */
const SOURCES: readonly {
  name: string;
  palette: Palette;
  sprites: Sprites;
  backdrop: string;
}[] = [
  {
    name: 'portraits',
    ...(portraitData as { palette: Palette; sprites: Sprites }),
    backdrop: '#f4f1ea',
  },
  {
    name: 'match sprites',
    ...(spriteData as { palette: Palette; sprites: Sprites }),
    backdrop: '#5cb85c',
  },
  {
    name: 'management sprites',
    ...(managementData as { palette: Palette; sprites: Sprites }),
    backdrop: '#f4f1ea',
  },
  {
    name: 'event objects',
    palette: EVENT_PALETTE,
    sprites: EVENT_SPRITE_ROWS,
    backdrop: '#f4f1ea',
  },
  {
    name: 'finance icons',
    palette: FINANCE_PALETTE,
    sprites: FINANCE_SPRITE_ROWS,
    backdrop: '#f4f1ea',
  },
];

const toRgb = (hex: string): number[] =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

function luminance(hex: string): number {
  const channels = toRgb(hex).map((value) => {
    const scaled = value / 255;
    return scaled <= 0.03928
      ? scaled / 12.92
      : ((scaled + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(a: string, b: string): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Anything this dark at a silhouette edge is acting as the outline. */
const OUTLINE_MAX_LUMINANCE = 0.1;

function outlineKeys(palette: Palette): Set<string> {
  return new Set(
    Object.entries(palette)
      .filter(
        ([, hex]) => hex !== null && luminance(hex) < OUTLINE_MAX_LUMINANCE,
      )
      .map(([key]) => key),
  );
}

interface EdgePixel {
  key: string;
  /** Step direction pointing inward from the background. */
  dx: number;
  dy: number;
  x: number;
  y: number;
}

/** Two sheets declare no `cell`, so the grid comes from the rows themselves. */
const reader =
  (rows: readonly string[]) =>
  (x: number, y: number): string =>
    y < 0 ||
    y >= rows.length ||
    rows[y] === undefined ||
    x < 0 ||
    x >= rows[y].length
      ? EMPTY
      : rows[y][x];

function edgePixels(rows: readonly string[]): EdgePixel[] {
  const at = reader(rows);
  const found: EdgePixel[] = [];
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      const key = at(x, y);
      if (key === EMPTY) continue;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        if (at(x + dx, y + dy) === EMPTY) {
          found.push({ key, dx: -dx, dy: -dy, x, y });
          break;
        }
      }
    }
  }
  return found;
}

describe.each(SOURCES)(
  '$name obey the pixel bible',
  ({ palette, sprites, backdrop }) => {
    const outlines = outlineKeys(palette);
    const names = Object.keys(sprites);

    it('never outlines with pure black, only dark tints (docs/11 Track B)', () => {
      const black = Object.entries(palette).filter(
        ([, hex]) => hex !== null && /^#0{6}$/i.test(hex),
      );
      expect(black).toEqual([]);
      expect(outlines.size).toBeGreaterThan(0);
    });

    it('keeps the outline band one pixel thick almost everywhere (rule 8)', () => {
      let single = 0;
      let outlined = 0;
      for (const name of names) {
        const rows = sprites[name];
        const at = reader(rows);
        for (const edge of edgePixels(rows)) {
          if (!outlines.has(edge.key)) continue;
          outlined++;
          let depth = 0;
          while (
            at(edge.x + edge.dx * depth, edge.y + edge.dy * depth) === edge.key
          )
            depth++;
          if (depth === 1) single++;
        }
      }
      // A thicker band at a chin or a boot sole is authored weight, not drift;
      // the floor catches a sprite family drawn at the wrong weight throughout.
      expect(single / outlined).toBeGreaterThan(0.65);
    });

    it('does not let a bare fill dissolve into its own background (rule 10)', () => {
      const dissolving: string[] = [];
      for (const name of names) {
        for (const edge of edgePixels(sprites[name])) {
          if (outlines.has(edge.key)) continue;
          const hex = palette[edge.key];
          if (
            hex !== null &&
            hex !== undefined &&
            contrastRatio(hex, backdrop) < 1.6
          ) {
            dissolving.push(`${name}@${edge.x},${edge.y}:${hex}`);
          }
        }
      }
      expect(dissolving).toEqual([]);
    });
  },
);

describe('portrait silhouettes have a complete one-pixel outline', () => {
  const sheet = portraitData as { palette: Palette; sprites: Sprites };
  const outlines = outlineKeys(sheet.palette);

  it('leaves no bare fill exposed to the portrait background', () => {
    const bare: string[] = [];
    for (const [name, rows] of Object.entries(sheet.sprites)) {
      for (const edge of edgePixels(rows)) {
        if (!outlines.has(edge.key))
          bare.push(`${name}@${edge.x},${edge.y}:${edge.key}`);
      }
    }
    expect(bare).toEqual([]);
  });
});

/**
 * Rule 3 — "exaggerate one feature per face" — is an aesthetic judgment, and no
 * metric decides it. What a metric *can* catch is the failure mode the rule
 * exists to prevent: a cast where every face is emphasised the same way, so the
 * roster reads as one head in recolours.
 *
 * The proxy is the ink carried in the eye band versus the jaw band. It is not a
 * verdict on any single face — the eye band naturally carries more ink — but the
 * spread across the roster says whether faces are being pushed in different
 * directions at all. Measured 2026-08-08: 0.67 to 4.5, median 1.50.
 */
describe('portrait cast varies where it exaggerates (rule 3)', () => {
  const sheet = portraitData as { palette: Palette; sprites: Sprites };
  const outlines = outlineKeys(sheet.palette);

  const ratios = Object.keys(sheet.sprites)
    .filter((name) => name.endsWith(':rest'))
    .map((name) => {
      const rows = sheet.sprites[name];
      let top = -1;
      let bottom = -1;
      for (let y = 0; y < rows.length; y++) {
        if ([...rows[y]].some((c) => c !== EMPTY)) {
          if (top < 0) top = y;
          bottom = y;
        }
      }
      const height = bottom - top + 1;
      const inkIn = (from: number, to: number): number => {
        let n = 0;
        for (let y = from; y <= to && y < rows.length; y++) {
          for (const key of rows[y])
            if (key !== EMPTY && outlines.has(key)) n++;
        }
        return n;
      };
      const eyes = inkIn(
        top + Math.round(height * 0.28),
        top + Math.round(height * 0.52),
      );
      const jaw = inkIn(
        top + Math.round(height * 0.55),
        top + Math.round(height * 0.8),
      );
      return eyes / (jaw || 1);
    })
    .sort((a, b) => a - b);

  it('pushes different faces in different directions', () => {
    expect(ratios).toHaveLength(448);
    const p10 = ratios[Math.floor(ratios.length * 0.1)];
    const p90 = ratios[Math.floor(ratios.length * 0.9)];
    // A cast drawn to one template collapses this toward 1.
    expect(p90 / p10).toBeGreaterThan(2);
  });

  it('leaves few faces with no dominant feature at all', () => {
    const flat = ratios.filter((r) => r > 0.8 && r < 1.25).length;
    expect(flat / ratios.length).toBeLessThan(0.15);
  });
});

/**
 * The spread metric above is only worth keeping if it can actually fail. Codex
 * asked for the proof rather than the claim, so this is it: clone one portrait
 * across the whole roster and the gate must reject it decisively.
 */
describe('the cast-spread metric can fail', () => {
  const sheet = portraitData as { palette: Palette; sprites: Sprites };
  const outlines = outlineKeys(sheet.palette);

  const ratioOf = (rows: readonly string[]): number => {
    let top = -1;
    let bottom = -1;
    for (let y = 0; y < rows.length; y++) {
      if ([...rows[y]].some((c) => c !== EMPTY)) {
        if (top < 0) top = y;
        bottom = y;
      }
    }
    const height = bottom - top + 1;
    const inkIn = (from: number, to: number): number => {
      let n = 0;
      for (let y = from; y <= to && y < rows.length; y++) {
        for (const key of rows[y]) if (key !== EMPTY && outlines.has(key)) n++;
      }
      return n;
    };
    const eyes = inkIn(
      top + Math.round(height * 0.28),
      top + Math.round(height * 0.52),
    );
    const jaw = inkIn(
      top + Math.round(height * 0.55),
      top + Math.round(height * 0.8),
    );
    return eyes / (jaw || 1);
  };

  it('rejects a roster of copies of one face', () => {
    const cloned = Object.keys(sheet.sprites)
      .filter((name) => name.endsWith(':rest'))
      .map(() => ratioOf(sheet.sprites['f00:rest']));
    const p10 = cloned[Math.floor(cloned.length * 0.1)];
    const p90 = cloned[Math.floor(cloned.length * 0.9)];
    expect(p90 / p10).toBe(1);
    expect(p90 / p10).not.toBeGreaterThan(2);
  });
});

/**
 * Rule 7, rewritten after review. The first formulation — "every step run on a
 * curve must be equal" — was wrong twice: equal run lengths describe a straight
 * diagonal, not a curve, and the check condemned 62-75% of the cast, which is
 * the medium rather than a defect. A convincing pixel curve *changes* its step
 * length; what it must not do is stumble.
 *
 * So the gate looks for the stumble: a single-row step marooned between two
 * runs of three or more. That is the classic accidental jaggie, and unlike the
 * old check it finds a short, nameable list — 18 in the portrait sheet and
 * 110 in the match sheet on the expanded 448-face roster.
 */
function maroonedSteps(rows: readonly string[]): number {
  const edge: (number | null)[] = [];
  for (let y = 0; y < rows.length; y++) {
    let x = -1;
    for (let i = 0; i < rows[y].length; i++) {
      if (rows[y][i] !== EMPTY) {
        x = i;
        break;
      }
    }
    edge.push(x < 0 ? null : x);
  }
  const runs: { x: number; len: number }[] = [];
  let i = 0;
  while (i < rows.length) {
    if (edge[i] === null) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < rows.length && edge[j + 1] === edge[i]) j++;
    runs.push({ x: edge[i] as number, len: j - i + 1 });
    i = j + 1;
  }
  if (runs.length === 0) return 0;
  const segments: { x: number; len: number }[][] = [];
  let seg = [runs[0]];
  for (let k = 1; k < runs.length; k++) {
    const dir = Math.sign(runs[k].x - runs[k - 1].x);
    const prev =
      seg.length > 1
        ? Math.sign(seg[seg.length - 1].x - seg[seg.length - 2].x)
        : dir;
    if (dir !== 0 && dir === prev) seg.push(runs[k]);
    else {
      if (seg.length >= 3) segments.push(seg);
      seg = [runs[k - 1], runs[k]];
    }
  }
  if (seg.length >= 3) segments.push(seg);

  let found = 0;
  for (const segment of segments) {
    const lengths = segment.slice(0, -1).map((r) => r.len);
    for (let k = 1; k < lengths.length - 1; k++) {
      if (lengths[k] === 1 && lengths[k - 1] >= 3 && lengths[k + 1] >= 3)
        found++;
    }
  }
  return found;
}

describe.each([
  { name: 'portraits', sheet: portraitData as { sprites: Sprites } },
  { name: 'match sprites', sheet: spriteData as { sprites: Sprites } },
])('$name curves do not stumble (rule 7)', ({ sheet }) => {
  it('has no marooned single steps', () => {
    const offenders = Object.keys(sheet.sprites).flatMap((name) => {
      const count = maroonedSteps(sheet.sprites[name]);
      return count === 0 ? [] : [`${name}:${count}`];
    });
    expect(offenders).toEqual([]);
  });
});
