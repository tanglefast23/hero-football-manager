import {
  INITIAL_LOYALTY_MAX,
  INITIAL_LOYALTY_MIN,
  LOYALTY_NO_RENEWAL_THRESHOLD,
  adjustLoyalty,
  initialLoyalty,
  loyaltyRenewalPercent,
  playerLoyalty,
  willRenegotiate,
} from '../loyalty';

describe('initialLoyalty', () => {
  it('always lands inside the 60 to 75 band', () => {
    for (let index = 0; index < 500; index += 1) {
      const value = initialLoyalty(12345, `player-${index}`);
      expect(value).toBeGreaterThanOrEqual(INITIAL_LOYALTY_MIN);
      expect(value).toBeLessThanOrEqual(INITIAL_LOYALTY_MAX);
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it('is stable for the same seed and player, and differs across players', () => {
    expect(initialLoyalty(999, 'rojas')).toBe(initialLoyalty(999, 'rojas'));
    const spread = new Set(
      Array.from({ length: 60 }, (_, index) => initialLoyalty(999, `p${index}`)),
    );
    expect(spread.size).toBeGreaterThan(8);
  });

  it('rejects a non-uint32 career seed', () => {
    expect(() => initialLoyalty(-1, 'rojas')).toThrow('career seed');
  });

  it('rejects an empty player ID', () => {
    expect(() => initialLoyalty(999, '  ')).toThrow('player ID');
  });
});

describe('playerLoyalty', () => {
  it('prefers the persisted value when present', () => {
    expect(playerLoyalty({ id: 'rojas', loyalty: 41 }, 999)).toBe(41);
  });

  it('derives a value when the field is absent', () => {
    expect(playerLoyalty({ id: 'rojas' }, 999)).toBe(initialLoyalty(999, 'rojas'));
  });
});

describe('adjustLoyalty', () => {
  it('clamps to 0 and 100', () => {
    expect(adjustLoyalty(98, 5)).toBe(100);
    expect(adjustLoyalty(2, -5)).toBe(0);
    expect(adjustLoyalty(60, -5)).toBe(55);
  });

  it('rejects a fractional delta', () => {
    expect(() => adjustLoyalty(60, 1.5)).toThrow('loyalty delta');
  });
});

describe('loyaltyRenewalPercent', () => {
  it('matches the design table', () => {
    expect(loyaltyRenewalPercent(100)).toBe(-20);
    expect(loyaltyRenewalPercent(75)).toBe(-10);
    expect(loyaltyRenewalPercent(50)).toBe(0);
    expect(loyaltyRenewalPercent(25)).toBe(10);
    expect(loyaltyRenewalPercent(0)).toBe(20);
  });

  it('rejects a loyalty outside 0 to 100', () => {
    expect(() => loyaltyRenewalPercent(101)).toThrow('loyalty');
  });
});

describe('willRenegotiate', () => {
  it('is false below the no-renewal threshold and true at it', () => {
    expect(willRenegotiate(LOYALTY_NO_RENEWAL_THRESHOLD - 1)).toBe(false);
    expect(willRenegotiate(LOYALTY_NO_RENEWAL_THRESHOLD)).toBe(true);
  });
});
