import type { NationalCupRoundLabel } from '../game/career';

/**
 * The cup's own round type, re-exported (type only, no runtime import) so the
 * title card and the bracket that names the round can never drift apart.
 */
export type CupRoundLabel = NationalCupRoundLabel;

/** The competition's player-facing name. */
export const CUP_TITLE_CARD_TITLE = 'HERO CUP';

/** Ball crosses, card holds, whistle. */
export const CUP_TITLE_CARD_MS = 2_600;
/**
 * Reduce Motion drops the flight, not the card. Two seconds still clears the
 * ~1.2s two short pixel-font lines need, so the round is read before kickoff.
 */
export const CUP_TITLE_CARD_REDUCED_MOTION_MS = 2_000;
/** The ball's crossing; the card then holds for the remainder of the duration. */
export const CUP_TITLE_CARD_BALL_MS = 1_100;

export interface CupTitleCardModel {
  /** Always CUP_TITLE_CARD_TITLE — the one big line. */
  readonly title: string;
  /** The round, uppercased for the pixel font, e.g. "QUARTER-FINAL". */
  readonly roundLabel: string;
  /** How long the card holds kickoff. */
  readonly durationMs: number;
  /** False under Reduce Motion: the card appears without the flying ball. */
  readonly showBall: boolean;
  /** Spoken form, which keeps the round's real casing. */
  readonly accessibilityLabel: string;
}

/**
 * The opening card for a Hero Cup tie, or null for a league fixture.
 *
 * `cupRoundLabel` is the whole test: activeCareerMatchday only sets it on a
 * cup matchday, so a league week reaches the match screen with it undefined
 * and no card is built.
 */
export function cupTitleCard(
  cupRoundLabel: CupRoundLabel | undefined,
  reduceMotion: boolean,
): CupTitleCardModel | null {
  if (cupRoundLabel === undefined) return null;
  return {
    title: CUP_TITLE_CARD_TITLE,
    roundLabel: cupRoundLabel.toUpperCase(),
    durationMs: reduceMotion ? CUP_TITLE_CARD_REDUCED_MOTION_MS : CUP_TITLE_CARD_MS,
    showBall: !reduceMotion,
    accessibilityLabel: `Hero Cup. ${cupRoundLabel}.`,
  };
}

/**
 * The ball's path, sampled at `progress` 0..1.
 *
 * `x` is a fraction of the card's width and runs past both edges so the ball
 * flies in and out rather than popping. `y` is a fraction of the arc height,
 * 0 at both ends and -1 at the apex (negative is up on screen). `spin` is
 * degrees of roll, two full turns across the crossing.
 */
export function cupTitleBallFlight(progress: number): {
  x: number;
  y: number;
  spin: number;
} {
  const t = Math.max(0, Math.min(1, progress));
  return {
    x: -0.18 + t * 1.36,
    y: -4 * t * (1 - t),
    spin: t * 720,
  };
}
