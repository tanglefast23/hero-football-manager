/** Thumb diameter in points; must match the `h-7 w-7` class on the knob. */
export const VOLUME_THUMB_SIZE = 28;

/**
 * Left offset of the volume knob in points.
 *
 * Positioning the knob at `left: <value>%` puts its *left edge* at the end of
 * the track at full volume, so the knob hangs past the track and is clipped by
 * the panel — and mirrors off the left edge at silence. Travelling across
 * `track - thumb` instead keeps the whole knob inside the track at every level.
 */
export function volumeThumbLeft(trackWidth: number, value: number): number {
  const travel = Math.max(0, trackWidth - VOLUME_THUMB_SIZE);
  const clamped = Math.max(0, Math.min(1, value));
  return travel * clamped;
}
