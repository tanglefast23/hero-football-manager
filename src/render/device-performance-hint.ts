/** Native builds rely on measured frame pacing, not hardware labels. */
export function hasWeakDeviceHardwareHint(): boolean {
  return false;
}
