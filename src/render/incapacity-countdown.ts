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

/** 3x5 pixel digits, row-major, one character per pixel. */
const DIGIT_ROWS: readonly string[] = [
  '111101101101111', // 0
  '010010010010010', // 1
  '111001111100111', // 2
  '111001111001111', // 3
  '101101111001001', // 4
  '111100111001111', // 5
  '111100111101111', // 6
  '111001001001001', // 7
  '111101111101111', // 8
  '111101111001111', // 9
];

export const COUNTDOWN_DIGIT_WIDTH = 3;
export const COUNTDOWN_DIGIT_HEIGHT = 5;
/** Blank column between digits, so "12" does not read as one blob. */
const DIGIT_GAP = 1;

export interface CountdownGlyph {
  /** Lit cells, origin at the glyph's top-left. */
  pixels: readonly { x: number; y: number }[];
  width: number;
  height: number;
}

/** Lays `seconds` out as pixel cells. Non-positive values draw nothing. */
export function countdownGlyph(seconds: number): CountdownGlyph {
  if (seconds <= 0) return { pixels: [], width: 0, height: 0 };
  const digits = [...String(Math.floor(seconds))];
  const pixels: { x: number; y: number }[] = [];
  digits.forEach((digit, index) => {
    const rows = DIGIT_ROWS[Number(digit)];
    const left = index * (COUNTDOWN_DIGIT_WIDTH + DIGIT_GAP);
    for (let cell = 0; cell < rows.length; cell += 1) {
      if (rows[cell] !== '1') continue;
      pixels.push({
        x: left + (cell % COUNTDOWN_DIGIT_WIDTH),
        y: Math.floor(cell / COUNTDOWN_DIGIT_WIDTH),
      });
    }
  });
  return {
    pixels,
    width:
      digits.length * COUNTDOWN_DIGIT_WIDTH + (digits.length - 1) * DIGIT_GAP,
    height: COUNTDOWN_DIGIT_HEIGHT,
  };
}
