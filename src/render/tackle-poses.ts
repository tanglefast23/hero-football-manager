// Which render-only poses a TACKLE event produces. Pure TS (no RN/Skia/Expo, no
// Math.random / Date.now) so Jest can assert the whole decision table headless —
// MatchScreen itself is unimportable under the test runner, and this used to be
// an untested inline block inside its RAF loop.
//
// Nothing here touches sim state. The engine has already decided the outcome; a
// pose only says how the two bodies sell it.
import type { Vec } from '../sim/geometry';
import { STAGGER_LEAN, type PlayerActionAnimation } from './animation';

export interface TacklePoseInput {
  /** Did the challenger win the ball? */
  won: boolean;
  /** Did the two players actually collide? Only contact makes a mark or a thud. */
  contact: boolean;
  /**
   * Visual start tick: the event tick minus one, because the interpolated visual
   * clock trails the sim tick by exactly that (see `visualTick` in the worklets).
   */
  startTick: number;
  /** Current sim tick, used to read the target's out window. */
  tick: number;
  /** The challenger's position this tick. */
  challenger: Vec;
  /** The target's position this tick. */
  target: Vec;
  /** Facing fallback for the degenerate case where both share a coordinate. */
  challengerTeam: 0 | 1 | undefined;
  /** The target's `outUntilTick`, or null when the target has left the pitch. */
  targetOutUntilTick: number | null;
  /** True while the challenger is already mid-pose (a live slide owns the body). */
  challengerBusy: boolean;
}

export interface TacklePoseResult {
  /** Pose for the target, when the challenge put them on the floor. */
  target?: PlayerActionAnimation;
  /** Pose for the challenger, when the challenge was beaten. */
  challenger?: PlayerActionAnimation;
  /** Where to punch up the impact burst. Knockouts only. */
  impact?: Vec;
}

/**
 * snapshotFrame parks an absent entity (an expired Decoy clone) far off-pitch at
 * (-1000, -1000). Anything placed between the two players has to reject that or
 * it draws its mark hundreds of metres outside the touchline.
 */
function onPitch(point: Vec): boolean {
  return point.x >= 0 && point.y >= 0;
}

/**
 * Three outcomes, in priority order:
 *
 *  - Target knocked OUT (Super Strength) — hold them flat until their recovery
 *    tick and punch up an impact burst.
 *  - Challenge WON with contact — the quick fall-and-recover dispossession.
 *  - Challenge BEATEN with contact — the challenger staggers. This is the common
 *    case by a wide margin (~100 of the ~130 tackles in a match) and the one
 *    that used to produce no visual at all: the thud played, both sprites
 *    carried on, and the moment read as nothing having happened.
 *
 * A whiffed challenge with no contact stays silent, exactly as its audio does.
 */
export function tacklePoses(input: TacklePoseInput): TacklePoseResult {
  const dx = input.target.x - input.challenger.x;
  const dy = input.target.y - input.challenger.y;
  const magnitude = Math.hypot(dx, dy);
  // Toward the target; the sign convention below flips it for the loser.
  const direction = magnitude > 0
    ? { x: dx / magnitude, y: dy / magnitude }
    : { x: 0, y: input.challengerTeam === 0 ? -1 : 1 };
  const rotation = direction.x >= 0 ? Math.PI / 2 : -Math.PI / 2;

  if (input.targetOutUntilTick !== null && input.targetOutUntilTick > input.tick) {
    return {
      target: {
        kind: 'knockdown',
        startTick: input.startTick,
        anchor: { ...input.target },
        rotation: -rotation,
        untilTick: input.targetOutUntilTick,
      },
      impact: { ...input.target },
    };
  }

  if (input.won) {
    return input.contact
      ? {
          target: {
            kind: 'fall',
            startTick: input.startTick,
            anchor: { ...input.target },
            rotation: -rotation,
          },
        }
      : {};
  }

  if (!input.contact || input.challengerBusy) return {};
  if (!onPitch(input.challenger) || !onPitch(input.target)) return {};

  // Shove the challenger back along the reverse of the closing direction, and
  // lean him the same way, so both the displacement and the tilt say "beaten".
  const away = { x: -direction.x, y: -direction.y };
  return {
    challenger: {
      kind: 'stagger',
      startTick: input.startTick,
      direction: away,
      contact: {
        x: (input.challenger.x + input.target.x) / 2,
        y: (input.challenger.y + input.target.y) / 2,
      },
      rotation: away.x >= 0 ? STAGGER_LEAN : -STAGGER_LEAN,
    },
  };
}
