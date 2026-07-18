export const DEV_VOLUME_LEVELS = [0, 0.25, 0.5, 0.75, 1] as const;

export type DevVolume = (typeof DEV_VOLUME_LEVELS)[number];

export function nextDevVolume(current: DevVolume): DevVolume {
  const index = DEV_VOLUME_LEVELS.indexOf(current);
  return DEV_VOLUME_LEVELS[(index + 1) % DEV_VOLUME_LEVELS.length];
}

export function devVolumePercent(volume: DevVolume): number {
  return volume * 100;
}
