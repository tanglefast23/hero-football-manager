export const DEV_VOLUME_LEVELS = [0, 0.25, 0.5, 0.75, 1] as const;

export type DevVolume = (typeof DEV_VOLUME_LEVELS)[number];

export function nextDevVolume(current: DevVolume): DevVolume {
  const index = DEV_VOLUME_LEVELS.indexOf(current);
  return DEV_VOLUME_LEVELS[(index + 1) % DEV_VOLUME_LEVELS.length];
}

export function devVolumePercent(volume: DevVolume): number {
  return volume * 100;
}

export function adjustDevVolume(
  value: DevVolume,
  action: 'increment' | 'decrement',
): DevVolume {
  const index = DEV_VOLUME_LEVELS.indexOf(value);
  const delta = action === 'increment' ? 1 : -1;
  const nextIndex = Math.max(0, Math.min(DEV_VOLUME_LEVELS.length - 1, index + delta));
  return DEV_VOLUME_LEVELS[nextIndex];
}
