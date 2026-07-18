import { mulberry32 } from '../rng';

describe('mulberry32', () => {
  it('same seed produces identical sequences', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 1000; i++) expect(a()).toBe(b());
  });

  it('different seeds diverge', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect(Array.from({ length: 10 }, a)).not.toEqual(Array.from({ length: 10 }, b));
  });

  it('outputs stay in [0,1) with a sane mean', () => {
    const r = mulberry32(7);
    let sum = 0;
    for (let i = 0; i < 10000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      sum += v;
    }
    expect(sum / 10000).toBeGreaterThan(0.47);
    expect(sum / 10000).toBeLessThan(0.53);
  });

  it('golden values: exact sequence is locked for replay determinism', () => {
    const r = mulberry32(42);
    expect([r(), r(), r()]).toMatchSnapshot();
    const r7 = mulberry32(7);
    expect([r7(), r7()]).toMatchSnapshot();
  });
});
