import { VOLUME_THUMB_SIZE, volumeThumbLeft } from '../volume-slider-thumb';

const TRACK = 300;

describe('volume slider thumb placement', () => {
  it('keeps the whole thumb inside the track at full volume', () => {
    const left = volumeThumbLeft(TRACK, 1);

    expect(left).toBe(TRACK - VOLUME_THUMB_SIZE);
    expect(left + VOLUME_THUMB_SIZE).toBeLessThanOrEqual(TRACK);
  });

  it('keeps the whole thumb inside the track at silence', () => {
    const left = volumeThumbLeft(TRACK, 0);

    expect(left).toBe(0);
    expect(left).toBeGreaterThanOrEqual(0);
  });

  it('never lets the thumb escape either edge at any supported level', () => {
    for (const level of [0, 0.25, 0.5, 0.75, 1] as const) {
      const left = volumeThumbLeft(TRACK, level);
      expect(left).toBeGreaterThanOrEqual(0);
      expect(left + VOLUME_THUMB_SIZE).toBeLessThanOrEqual(TRACK);
    }
  });

  it('places the midpoint level in the middle of the usable travel', () => {
    expect(volumeThumbLeft(TRACK, 0.5)).toBe((TRACK - VOLUME_THUMB_SIZE) / 2);
  });

  it('collapses to the left edge before the track has been measured', () => {
    expect(volumeThumbLeft(0, 1)).toBe(0);
  });
});
