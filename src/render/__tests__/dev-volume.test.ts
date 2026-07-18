import { devVolumePercent, DEV_VOLUME_LEVELS, nextDevVolume } from '../dev-volume';

describe('development volume steps', () => {
  it('cycles from the current 100% mix through mute and each quarter step', () => {
    let volume = 1 as (typeof DEV_VOLUME_LEVELS)[number];
    const seen: number[] = [];

    for (let i = 0; i < DEV_VOLUME_LEVELS.length; i++) {
      volume = nextDevVolume(volume);
      seen.push(devVolumePercent(volume));
    }

    expect(seen).toEqual([0, 25, 50, 75, 100]);
  });
});
