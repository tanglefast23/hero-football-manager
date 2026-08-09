interface NavigatorWithHardwareHints extends Navigator {
  deviceMemory?: number;
}

/**
 * Browser hardware values are approximate. They only shorten the initial
 * warm-up; they never disable 3x without measured frame-pacing evidence.
 */
export function hasWeakDeviceHardwareHint(): boolean {
  if (typeof navigator === 'undefined') return false;
  const hints = navigator as NavigatorWithHardwareHints;
  return (
    (hints.deviceMemory !== undefined && hints.deviceMemory <= 2) ||
    (hints.hardwareConcurrency !== undefined && hints.hardwareConcurrency <= 2)
  );
}
