import { flameTongues } from '../flames';

// Pull the x/y numbers out of an SVG path so we can assert on geometry bounds.
// Every command in a flame tongue is written as alternating x y pairs.
function coords(d: string): { xs: number[]; ys: number[] } {
  const nums = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  return {
    xs: nums.filter((_, i) => i % 2 === 0),
    ys: nums.filter((_, i) => i % 2 === 1),
  };
}

describe('flameTongues', () => {
  it('returns three layered tongues per base position', () => {
    expect(flameTongues(100, 200, 40, 60, 1.0, 5)).toHaveLength(15);
    expect(flameTongues(100, 200, 40, 60, 1.0, 4)).toHaveLength(12);
  });

  it('emits closed teardrop paths with a valid fill and opacity', () => {
    for (const t of flameTongues(100, 200, 40, 60, 1.0)) {
      expect(t.d.startsWith('M')).toBe(true);
      expect(t.d).toContain('Q');
      expect(t.d.trimEnd().endsWith('Z')).toBe(true);
      expect(t.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(t.opacity).toBeGreaterThan(0);
      expect(t.opacity).toBeLessThanOrEqual(1);
    }
  });

  it('is deterministic — same inputs give byte-identical output (no Math.random)', () => {
    expect(flameTongues(100, 200, 40, 60, 2.5)).toEqual(flameTongues(100, 200, 40, 60, 2.5));
  });

  it('flickers — the shapes change as the phase advances', () => {
    const a = flameTongues(100, 200, 40, 60, 1.0);
    const b = flameTongues(100, 200, 40, 60, 1.7);
    expect(a.some((t, i) => t.d !== b[i].d)).toBe(true);
  });

  it('stays within its footprint: rises upward from the base, never past the spread', () => {
    const cx = 100, cy = 200, width = 40, height = 60;
    for (const t of flameTongues(cx, cy, width, height, 1.0)) {
      const { xs, ys } = coords(t.d);
      for (const x of xs) {
        expect(x).toBeGreaterThanOrEqual(cx - width - 0.5);
        expect(x).toBeLessThanOrEqual(cx + width + 0.5);
      }
      for (const y of ys) {
        // Fire rises up (smaller y); the base sits at cy.
        expect(y).toBeLessThanOrEqual(cy + 0.5);
        expect(y).toBeGreaterThanOrEqual(cy - height * 1.05);
      }
    }
  });
});
