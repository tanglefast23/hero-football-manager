/**
 * "How long until he is back?" — the seconds a downed, webbed or held player
 * still has to sit out, plus the pixel-digit shapes used to draw that number
 * over his head.
 *
 * Pure TS on purpose (no react-native/Skia imports), same reason as
 * `interpolate.ts`: Jest can exercise it headless while MatchScreen cannot be
 * imported under the test runner.
 */
import { RENDER_PLAYER_COUNT, playerAt } from '../sim/entities';
import {
  GLYPH_HEIGHT,
  GLYPH_WIDTH,
  pixelGlyph,
  type PixelGlyph,
} from './pixel-glyphs';
import { TICK_MS } from '../sim/geometry';
import type { MatchState, SimPlayer } from '../sim/types';

export interface IncapacityCountdown {
  /** Render slot, so the caller can read the drawn position out of its frame. */
  slot: number;
  /** Whole seconds still to serve, always 1 or more. */
  seconds: number;
}

/**
 * Every way a player is stuck ON THE SPOT with a known end tick — a knockout
 * (`outUntilTick`, which also covers being set alight) and Web Trap. Standing
 * still is the qualifying property, not merely "cannot act", for two reasons:
 * the number is anchored to a tick-quantised position while the sprite itself
 * interpolates, so a moving body would leave its own countdown hopping behind
 * it; and a player who is still running does not look held.
 *
 * Deliberately excluded:
 *  - `outReason === 'redcard'` — he is not coming back, so a countdown lies.
 *  - `tackleRecoveryUntil` (4 ticks) and `actionLockedUntilTick` (the 5-tick
 *    Super Strength wind-up, during which the carrier can still dribble): both
 *    are sub-second, so they flash "1" and then jump when the real KO lands.
 *  - `forcedMovement` (Ice Rink) — the victim slides 110 units a tick for
 *    several seconds, and the slide has its own authored VFX already.
 */
function heldUntilTick(player: SimPlayer): number {
  if (player.outReason === 'redcard') return 0;
  return Math.max(player.outUntilTick, player.webbedUntilTick ?? 0);
}

export function incapacitySecondsLeft(player: SimPlayer, tick: number): number {
  const ticksLeft = heldUntilTick(player) - tick;
  if (ticksLeft <= 0) return 0;
  // Round up: the last partial second still reads as "1", never as "0".
  return Math.ceil((ticksLeft * TICK_MS) / 1000);
}

export function incapacityCountdowns(state: MatchState): IncapacityCountdown[] {
  const found: IncapacityCountdown[] = [];
  for (let slot = 0; slot < RENDER_PLAYER_COUNT; slot += 1) {
    const player = playerAt(state, slot);
    if (player === undefined) continue;
    const seconds = incapacitySecondsLeft(player, state.tick);
    if (seconds > 0) found.push({ slot, seconds });
  }
  return found;
}

/**
 * The digits themselves now live in `pixel-glyphs.ts`, shared with the
 * substitution nameplate. This module keeps the countdown's own vocabulary —
 * `countdownGlyph` and the two cell constants — so every existing caller and
 * its test are untouched by that move.
 */
export const COUNTDOWN_DIGIT_WIDTH = GLYPH_WIDTH;
export const COUNTDOWN_DIGIT_HEIGHT = GLYPH_HEIGHT;

export type CountdownGlyph = PixelGlyph;

/** Lays `seconds` out as pixel cells. Non-positive values draw nothing. */
export function countdownGlyph(seconds: number): CountdownGlyph {
  if (seconds <= 0) return { pixels: [], width: 0, height: 0 };
  return pixelGlyph(String(Math.floor(seconds)));
}
