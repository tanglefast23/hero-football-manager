/**
 * How a hero who has banked his power reads on the pitch: a body that is 10%
 * bigger than a normal player, flushed red, and flashing.
 *
 * The zone ring (WorkletMatchOverlays) already marks WHERE the hero is; this
 * marks that he is loaded even when the ring is behind another sprite.
 */

/** Body growth while the power is banked. Applied to the snapped sprite scale. */
export const ZONE_READY_GROWTH = 1.1;

/**
 * One flash cycle, in sim ticks AT 1x SPEED. 8 ticks = 0.8s of wall clock.
 *
 * The period is multiplied by the playback rate below, so 2x and 3x do not
 * divide it into a strobe: 3x would otherwise flash at 3.75Hz, past the 3-per-
 * second ceiling that photosensitivity guidance draws.
 */
export const ZONE_READY_FLASH_TICKS = 8;

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
  const period =
    ZONE_READY_FLASH_TICKS * Math.max(1, Math.round(playbackRate));
  const phase = ((tick % period) + period) % period;
  return phase < period / 2 ? ZONE_READY_TINT_HOT : ZONE_READY_TINT_COOL;
}

/**
 * The grown sprite scale, landed back on whole device pixels — the same rule
 * the ball's apex growth follows, so a bigger hero is still a sharp hero.
 *
 * The `+ 1` floor is the whole point of the helper. A phone sprite is only a
 * handful of device pixels tall, and rounding 10% of 4 lands back on 4: the
 * hero would not grow at all on exactly the devices this ships to. So growth is
 * at least one whole device pixel, and 10% once the sprite is big enough for
 * 10% to be more than that.
 */
export function zoneReadyPlayerScale(
  playerScale: number,
  devicePixelRatio: number,
): number {
  'worklet';
  const dpr = Math.max(1, devicePixelRatio);
  const devicePixels = Math.round(playerScale * dpr);
  if (devicePixels <= 0) return 0;
  return (
    Math.max(devicePixels + 1, Math.round(devicePixels * ZONE_READY_GROWTH)) /
    dpr
  );
}
