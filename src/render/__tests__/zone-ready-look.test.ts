import { ZONE_READY_FLASH_TICKS, zoneReadyTint } from '../zone-ready-look';

function channels(css: string): [number, number, number] {
  return [
    parseInt(css.slice(1, 3), 16),
    parseInt(css.slice(3, 5), 16),
    parseInt(css.slice(5, 7), 16),
  ];
}

describe('zoneReadyTint', () => {
  it('flashes between two tints across one cycle', () => {
    const first = zoneReadyTint(0, false);
    const second = zoneReadyTint(ZONE_READY_FLASH_TICKS / 2, false);

    expect(first).not.toBe(second);
    expect(zoneReadyTint(ZONE_READY_FLASH_TICKS, false)).toBe(first);
  });

  it('keeps every phase red-shifted, never green or blue', () => {
    for (let tick = 0; tick < ZONE_READY_FLASH_TICKS * 2; tick += 1) {
      const [r, g, b] = channels(zoneReadyTint(tick, false));
      expect(r).toBe(255);
      expect(g).toBeLessThan(r);
      expect(b).toBeLessThan(g);
    }
  });

  it('holds one steady red when motion is reduced', () => {
    const steady = zoneReadyTint(0, true);
    expect(zoneReadyTint(ZONE_READY_FLASH_TICKS / 2, true)).toBe(steady);
    const [r, g] = channels(steady);
    expect(g).toBeLessThan(r);
  });
});

describe('zoneReadyTint flash pace', () => {
  it('stretches the period with the playback rate', () => {
    // At 3x, a tick is a third of the wall clock, so the phase has to last
    // three times as many ticks to flash at the same pace.
    const hot = zoneReadyTint(0, false, 3);

    expect(zoneReadyTint(ZONE_READY_FLASH_TICKS / 2, false, 3)).not.toBe(hot);
    expect(zoneReadyTint((ZONE_READY_FLASH_TICKS * 3) / 2, false, 3)).not.toBe(
      hot,
    );
    expect(zoneReadyTint(ZONE_READY_FLASH_TICKS * 3, false, 3)).toBe(hot);
  });
});
