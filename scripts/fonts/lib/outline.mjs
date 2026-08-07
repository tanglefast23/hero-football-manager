/**
 * Axis-aligned rectangles -> TrueType contours.
 *
 * Every new Vietnamese mark is a set of rectangles on the Silkscreen grid
 * (`docs/superpowers/specs/2026-08-06-vietnamese-pixel-diacritics.md` §2), and
 * emitting one four-point contour per rectangle would leave coincident edges
 * running through the middle of a mark. That renders correctly under non-zero
 * winding but is not how Silkscreen draws its own accents — its marks are the
 * *union* outline, with diagonally touching cells joined into a single
 * self-touching loop. This reproduces that.
 *
 * Winding follows the face: outer contours run clockwise in the y-up design
 * space (measured — Silkscreen's `o` has a clockwise outer ring and a
 * counter-clockwise counter), which is what TrueType's non-zero fill expects.
 */

/** Distinct coordinates, so overlapping or unequal-height rectangles still grid. */
function axis(values) {
  return [...new Set(values)].sort((a, b) => a - b);
}

export function rectsToContours(rects) {
  if (rects.length === 0) return [];

  const xs = axis(rects.flatMap((rect) => [rect[0], rect[2]]));
  const ys = axis(rects.flatMap((rect) => [rect[1], rect[3]]));
  const columns = xs.length - 1;
  const rows = ys.length - 1;

  const filled = new Set();
  for (let column = 0; column < columns; column += 1) {
    for (let row = 0; row < rows; row += 1) {
      const cx = (xs[column] + xs[column + 1]) / 2;
      const cy = (ys[row] + ys[row + 1]) / 2;
      if (
        rects.some(
          ([x0, y0, x1, y1]) => cx > x0 && cx < x1 && cy > y0 && cy < y1,
        )
      ) {
        filled.add(`${column},${row}`);
      }
    }
  }
  const isFilled = (column, row) => filled.has(`${column},${row}`);

  // Boundary edges, oriented so the ink is always on the right-hand side.
  const edges = new Map();
  const add = (from, to) => {
    const key = `${from.x},${from.y}`;
    const list = edges.get(key);
    if (list === undefined) edges.set(key, [{ from, to }]);
    else list.push({ from, to });
  };
  for (let column = 0; column < columns; column += 1) {
    for (let row = 0; row < rows; row += 1) {
      if (!isFilled(column, row)) continue;
      const x0 = xs[column];
      const x1 = xs[column + 1];
      const y0 = ys[row];
      const y1 = ys[row + 1];
      if (!isFilled(column - 1, row)) add({ x: x0, y: y0 }, { x: x0, y: y1 });
      if (!isFilled(column, row + 1)) add({ x: x0, y: y1 }, { x: x1, y: y1 });
      if (!isFilled(column + 1, row)) add({ x: x1, y: y1 }, { x: x1, y: y0 });
      if (!isFilled(column, row - 1)) add({ x: x1, y: y0 }, { x: x0, y: y0 });
    }
  }

  const direction = (edge) => ({
    x: Math.sign(edge.to.x - edge.from.x),
    y: Math.sign(edge.to.y - edge.from.y),
  });
  /**
   * At a vertex where two cells touch only at a corner, four edges meet and the
   * walk has a choice. Taking the *left* turn keeps the two cells in one loop,
   * which is what Silkscreen does (measured on `í`, `ê`, `ô`).
   */
  const preference = (incoming, candidate) => {
    const from = direction(incoming);
    const to = direction(candidate);
    if (to.x === -from.y && to.y === from.x) return 0; // left
    if (to.x === from.x && to.y === from.y) return 1; // straight
    if (to.x === from.y && to.y === -from.x) return 2; // right
    return 3; // reversal
  };

  const contours = [];
  const used = new Set();
  const identity = (edge) =>
    `${edge.from.x},${edge.from.y}->${edge.to.x},${edge.to.y}`;

  const starts = [...edges.values()]
    .flat()
    .sort((a, b) => a.from.x - b.from.x || a.from.y - b.from.y);
  for (const start of starts) {
    if (used.has(identity(start))) continue;
    const loop = [];
    let edge = start;
    for (;;) {
      used.add(identity(edge));
      loop.push(edge.from);
      const candidates = (edges.get(`${edge.to.x},${edge.to.y}`) ?? []).filter(
        (next) => !used.has(identity(next)),
      );
      if (candidates.length === 0) break;
      candidates.sort((a, b) => preference(edge, a) - preference(edge, b));
      edge = candidates[0];
    }
    contours.push(collapse(loop));
  }
  return contours;
}

/** Drop points that only continue a straight run. */
function collapse(points) {
  const kept = [];
  for (let index = 0; index < points.length; index += 1) {
    const previous = points[(index - 1 + points.length) % points.length];
    const current = points[index];
    const next = points[(index + 1) % points.length];
    const collinear =
      (current.x - previous.x) * (next.y - current.y) ===
      (current.y - previous.y) * (next.x - current.x);
    if (!collinear) kept.push(current);
  }
  return kept;
}
