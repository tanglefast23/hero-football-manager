// Pure TS render-frame math: no React Native / Skia / Expo imports, no
// Math.random / Date.now — safe to unit test headless (same rule as src/sim/).
import { ballHeight, ballPos } from '../sim/engine';
import { PITCH_H, PITCH_W, type Vec } from '../sim/geometry';
import { ARM_WINDOW_TICKS, ZONE_WINDOW_TICKS } from '../sim/powers';
import type { MatchState } from '../sim/types';
import { playerAt, RENDER_PLAYER_COUNT } from '../sim/entities';
import { snapDevicePixels } from './pixel-grid';

// No 'ready' state exists (Task 14 amendment ledger item 5) — a hero's
// zone window is its own status, distinct from an ordinary idle 'ok'.
export type PlayerStatus = 'ok' | 'windup' | 'active' | 'out' | 'ignited' | 'zone' | 'sliding' | 'recovering';

export interface PitchFrame {
  players: Vec[];
  ball: Vec;
  ballHeight: number; // centimetres above the pitch plane
  carrier: number; // -1 when ball not held
  statuses: PlayerStatus[];
  zoneFraction: number[]; // remainingTicks / ZONE_WINDOW_TICKS while in zone, else 0
  moved: boolean[]; // true if a player's position changed vs the passed previous frame
  travel: number[]; // cumulative render-only distance, used to keep foot cadence tied to motion
  visible: boolean[]; // two reserved Decoy slots stay hidden while unused
  ballShooting: boolean; // the ball is a live shot (drives the shot trail); a pass/loose/held ball is false
}

export function lerpVec(a: Vec, b: Vec, t: number): Vec {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

// ---------------------------------------------------------------------------
// Pixel-art scale snapping.
//
// docs/11-art-style.md: "On-screen scaling is always an integer multiple".
// The pitch->screen factor is a continuous float (viewport width / PITCH_W), so
// multiplying it by a nominal draw scale lands each 1px source texel on a
// fractional number of device pixels — the GPU then doubles some source rows
// and drops others, and the pattern changes with every sub-pixel of movement
// (visible shimmer). Below 1.0 it deletes detail outright.
//
// The fix snaps the magnification in DEVICE pixels and divides the integer back
// down into a draw scale, so `scale * drawScale * dpr` is exactly a whole
// number while every existing `scale * drawScale` call site keeps working.
//
// This lives in interpolate.ts (not MatchScreen) because this is the render
// ring's pure-TS module: no react-native/Skia imports, so Jest can exercise it
// headless — MatchScreen itself is unimportable under the test runner.
// ---------------------------------------------------------------------------

// Magnifies each atlas source-pixel into screen px, before the pitch->screen
// `scale` factor. Player cells are 24x30 source px; at PLAYER_DRAW_SCALE=17
// that keeps the same ~28-34pt tall footprint as the prior 16x20@26 across the
// common iPhone width range (375-430pt) — crisper and more detailed, not bigger.
export const PLAYER_DRAW_SCALE = 17;

// The ball sprite is a separate 6x6 source asset, not a scaled-down player —
// reusing PLAYER_DRAW_SCALE would shrink it to a ~5pt speck. Calibrated
// instead for its own ~6pt on-screen radius (~12pt diameter) across the same
// width range.
export const BALL_DRAW_SCALE = 34;

export interface SnappedSpriteScale {
  /** Whole device pixels that one source pixel covers. Never below 1. */
  devicePixels: number;
  /**
   * Hand this to Skia in place of the nominal draw scale:
   * `pitchScale * drawScale * devicePixelRatio === devicePixels` exactly.
   */
  drawScale: number;
}

/**
 * Snaps one sprite family's magnification onto the device-pixel grid.
 *
 * The floor is `max(1, floor(dpr))`: one device pixel is the hard limit (any
 * less drops source texels), and on a hi-dpi display we also stay at roughly
 * one dp per source pixel, which is the footprint the sprites were authored
 * for. On a 1x display that floor collapses to 1 — deliberately, since forcing
 * 2 device pixels there would double every sprite on desktop web.
 */
export function snapSpriteScale(
  pitchScale: number,
  nominalDrawScale: number,
  devicePixelRatio: number,
): SnappedSpriteScale {
  const dpr = Math.max(1, devicePixelRatio);
  const floor = Math.max(1, Math.floor(dpr));
  const devicePixels = Math.max(floor, Math.round(pitchScale * nominalDrawScale * dpr));
  return { devicePixels, drawScale: devicePixels / (pitchScale * dpr) };
}

export interface MatchPitchLayout {
  /**
   * Canvas width in dp, always whole: a fractional canvas width would put the
   * whole surface (and therefore every sprite) off the device-pixel grid.
   */
  pitchWidth: number;
  /** Pitch-units -> dp. Still fractional; only Skia vector chrome uses it raw. */
  scale: number;
  player: SnappedSpriteScale;
  ball: SnappedSpriteScale;
}

/**
 * Derives the match canvas size plus both snapped sprite magnifications from
 * the viewport. `availablePitchHeight` is whatever vertical space the caller's
 * chrome leaves for the pitch.
 */
export function matchPitchLayout(
  viewportWidth: number,
  availablePitchHeight: number,
  devicePixelRatio: number,
): MatchPitchLayout {
  const pitchWidth = Math.max(
    1,
    Math.floor(Math.min(viewportWidth, availablePitchHeight * PITCH_W / PITCH_H)),
  );
  const scale = pitchWidth / PITCH_W;
  return {
    pitchWidth,
    scale,
    player: snapSpriteScale(scale, PLAYER_DRAW_SCALE, devicePixelRatio),
    ball: snapSpriteScale(scale, BALL_DRAW_SCALE, devicePixelRatio),
  };
}

// ---------------------------------------------------------------------------
// Match camera (pan / integer zoom / shake).
//
// There is one camera for the whole pitch: a single <Group transform> wrapping
// the canvas contents, so nothing per-draw-site changes. Both numbers it needs
// are computed here because both have to respect the device-pixel grid that
// snapSpriteScale() above just bought us:
//
//  - The zoom is an INTEGER magnification step (1x -> 2x), never a smooth ramp.
//    Group scale multiplies the already-snapped sprite magnification, so a
//    fractional zoom would put every source texel back on a fraction of a
//    device pixel and re-introduce the shimmer. An integer multiple of an
//    integer is still an integer. It is also the more deliberate read for pixel
//    art: a hard punch-in, not a dolly.
//  - The translate is rounded to whole DEVICE pixels for the same reason the
//    per-sprite translates are, through the one shared rule in pixel-grid.ts.
// ---------------------------------------------------------------------------

/** Peak screen-shake displacement, in dp, before decay and pixel-quantising. */
export const MATCH_SHAKE_AMPLITUDE_PT = 3;

export interface MatchShakeOffset {
  x: number;
  y: number;
}

/**
 * Decaying two-axis shake. Deterministic (two incommensurate sine terms, no
 * PRNG) so it can be asserted in a test, and quadratic decay so the first frame
 * carries the hit and the tail settles instead of buzzing.
 */
export function matchShakeOffset(
  elapsedMs: number,
  durationMs: number,
  amplitude: number,
): MatchShakeOffset {
  if (elapsedMs < 0 || elapsedMs >= durationMs || durationMs <= 0) return { x: 0, y: 0 };
  const progress = elapsedMs / durationMs;
  const decay = (1 - progress) ** 2;
  return {
    x: Math.sin(progress * Math.PI * 14) * amplitude * decay,
    // Shorter vertical throw: a mostly-horizontal shake reads as impact rather
    // than as the whole screen wobbling.
    y: Math.sin(progress * Math.PI * 11 + 1.7) * amplitude * decay * 0.7,
  };
}

export interface MatchCameraOffset {
  /** dp, already whole device pixels. */
  translateX: number;
  translateY: number;
  /** The integer magnification actually applied. */
  zoom: number;
}

/**
 * Camera translate for `<Group transform={[{translateX},{translateY},{scale}]}>`
 * (no `origin` prop — the centring is folded into the translate, so the composed
 * matrix stays `p -> zoom * p + translate` and the grid math above holds).
 *
 * `focus` is where to centre, in canvas dp. It is clamped so the visible window
 * never leaves the pitch: an activation must not reveal void beyond the touchline.
 */
export function matchCameraOffset(
  focusX: number,
  focusY: number,
  viewWidth: number,
  viewHeight: number,
  zoom: number,
  shake: MatchShakeOffset,
  devicePixelRatio: number,
): MatchCameraOffset {
  const steps = Math.max(1, Math.round(zoom));
  const halfWidth = viewWidth / (2 * steps);
  const halfHeight = viewHeight / (2 * steps);
  const centerX = Math.min(Math.max(focusX, halfWidth), viewWidth - halfWidth);
  const centerY = Math.min(Math.max(focusY, halfHeight), viewHeight - halfHeight);
  return {
    translateX: snapDevicePixels(viewWidth / 2 - steps * centerX + shake.x, devicePixelRatio),
    translateY: snapDevicePixels(viewHeight / 2 - steps * centerY + shake.y, devicePixelRatio),
    zoom: steps,
  };
}

/**
 * Captures one tick's render-relevant state. `previous`, when supplied, is
 * the caller's prior render snapshot (positions entering this tick plus its
 * accumulated visual travel). It derives `moved` and advances the run-cycle
 * distance without changing sim state. Omit it for the first frame at mount.
 */
export function snapshotFrame(state: MatchState, previous?: Pick<PitchFrame, 'players' | 'travel'>): PitchFrame {
  const entities = Array.from({ length: RENDER_PLAYER_COUNT }, (_, index) => playerAt(state, index));
  const positions = entities.map(player => player === undefined
    ? { x: -1000, y: -1000 }
    : { ...player.pos });
  const visible = entities.map(player => player !== undefined);
  return {
    players: positions,
    // Copy, don't alias: a held ball's ballPos IS the carrier's live pos
    // object (and a loose/pass/shot ball's pos is live sim state too).
    ball: { ...ballPos(state) },
    ballHeight: ballHeight(state),
    carrier: state.ball.kind === 'held' ? state.ball.by : -1,
    statuses: entities.map((p): PlayerStatus => {
      if (p === undefined) return 'out';
      if (p.outUntilTick > state.tick) return p.outReason === 'ignited' ? 'ignited' : 'out';
      if (p.slideTackle) return 'sliding';
      if (p.tackleRecoveryUntil > state.tick) return 'recovering';
      if (p.powerState.kind === 'zone' || p.powerState.kind === 'armed') return 'zone';
      if (p.powerState.kind === 'winding') return 'windup';
      if (p.powerState.kind === 'active') return 'active';
      return 'ok';
    }),
    zoneFraction: entities.map((p) => {
      if (p === undefined) return 0;
      if (p.powerState.kind === 'zone') return p.powerState.remainingTicks / ZONE_WINDOW_TICKS;
      if (p.powerState.kind === 'armed') return p.powerState.remainingTicks / ARM_WINDOW_TICKS;
      return 0;
    }),
    moved: positions.map((p, i) => previous !== undefined
      && visible[i] && previous.players[i].x >= 0
      && (p.x !== previous.players[i].x || p.y !== previous.players[i].y)),
    travel: positions.map((p, i) => {
      if (!previous || !visible[i] || previous.players[i].x < 0) return 0;
      const dx = p.x - previous.players[i].x;
      const dy = p.y - previous.players[i].y;
      return previous.travel[i] + Math.sqrt(dx * dx + dy * dy);
    }),
    visible,
    ballShooting: state.ball.kind === 'shot',
  };
}

/**
 * Blends only the continuous quantities (positions, travel) between two
 * snapshots. Discrete per-tick state (statuses, carrier, zoneFraction, moved,
 * ballShooting) snaps to `next` — there is no meaningful "half status".
 */
export function lerpFrame(prev: PitchFrame, next: PitchFrame, t: number): PitchFrame {
  return {
    players: prev.players.map((p, i) => lerpVec(p, next.players[i], t)),
    ball: lerpVec(prev.ball, next.ball, t),
    ballHeight: prev.ballHeight + (next.ballHeight - prev.ballHeight) * t,
    carrier: next.carrier,
    statuses: next.statuses,
    zoneFraction: next.zoneFraction,
    moved: next.moved,
    travel: prev.travel.map((distance, i) => distance + (next.travel[i] - distance) * t),
    visible: next.visible,
    ballShooting: next.ballShooting,
  };
}
