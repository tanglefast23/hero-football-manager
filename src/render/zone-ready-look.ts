/**
 * How a hero who has banked his power reads on the pitch: normal size, flushed
 * red, and slowly flashing.
 *
 * The foot oval marks WHERE the hero is; this tint marks that he is loaded
 * even when the oval is behind another sprite.
 */

/**
 * One flash cycle, in sim ticks AT 1x SPEED. 20 ticks = 2s of wall clock.
 *
 * The period is multiplied by the playback rate below, so 2x and 3x do not
 * divide it into a strobe: 3x would otherwise flash at 3.75Hz, past the 3-per-
 * second ceiling that photosensitivity guidance draws.
 */
export const ZONE_READY_FLASH_TICKS = 20;

/**
 * Atlas tints are multiplied over the sprite (`colorBlendMode="modulate"`), so
 * every entry here keeps red at full and pulls green/blue down: the skin (and
 * the kit with it) shifts red without flattening into a colour block.
 */
const ZONE_READY_TINT_HOT = '#ff8f7a';
const ZONE_READY_TINT_COOL = '#ffd0c4';
const ZONE_READY_TINT_STEADY = '#ffb3a3';

/**
 * The flashing red body tint. `reduceMotion` holds it at a steady mid red.
 * `playbackRate` is the match speed (1x/2x/3x), which stretches the period so
 * the flash stays at one wall-clock pace however fast the match is running.
 */
export function zoneReadyTint(
  tick: number,
  reduceMotion: boolean,
  playbackRate = 1,
): string {
  if (reduceMotion) return ZONE_READY_TINT_STEADY;
  const period = ZONE_READY_FLASH_TICKS * Math.max(1, Math.round(playbackRate));
  const phase = (((tick % period) + period) % period) / period;
  const blend = (1 - Math.cos(phase * Math.PI * 2)) / 2;
  const hot = [255, 143, 122];
  const cool = [255, 208, 196];
  const channel = (at: number) =>
    Math.round(hot[at] + (cool[at] - hot[at]) * blend)
      .toString(16)
      .padStart(2, '0');
  return `#${channel(0)}${channel(1)}${channel(2)}`;
}
