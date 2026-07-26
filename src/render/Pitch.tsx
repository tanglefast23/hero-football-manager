import { memo } from 'react';
import { Circle, Group, Line, Rect } from '@shopify/react-native-skia';
import { PITCH_W, PITCH_H, GOAL_W, GOAL_CENTER_X } from '../sim/geometry';

// Real senior pitch (105m x 68m) proportions, applied as ratios against our
// own PITCH_H (goal-to-goal) / PITCH_W (touchline-to-touchline) units so the
// markings stay correctly proportioned regardless of the sim's unit system.
const REAL_LENGTH_M = 105;
const REAL_WIDTH_M = 68;
const PENALTY_BOX_W = PITCH_W * (40.3 / REAL_WIDTH_M);
const PENALTY_BOX_D = PITCH_H * (16.5 / REAL_LENGTH_M);
const GOAL_BOX_W = PITCH_W * (18.3 / REAL_WIDTH_M);
const GOAL_BOX_D = PITCH_H * (5.5 / REAL_LENGTH_M);
const CENTER_CIRCLE_R = PITCH_H * (9.15 / REAL_LENGTH_M);
const CENTER_SPOT_R = PITCH_H * (0.3 / REAL_LENGTH_M);
const POST_TICK_LEN = PITCH_H * (1.5 / REAL_LENGTH_M); // short goalpost tick into the pitch

const STRIPE_COUNT = 8;
// Mow stripes use two exact values from the pixel-bible pitch/turf ramp
// (docs/11): the base <Fill> is pitch-dark #3f8a4a, and these 4 bands paint
// the brighter pitch base #5cb85c over it.
const STRIPE_ALT_COLOR = '#5cb85c';
const LINE_COLOR = '#ffffff';
const LINE_W = 2; // pt — Skia strokeWidth is already screen-space, not pitch-space
const POST_W = 4; // pt — thicker than LINE_W so the goal mouth reads as posts at a glance

/**
 * Pitch dressing drawn under the sprite atlas: alternating mow stripes, and
 * the standard white line markings (border, halfway line, center circle +
 * spot, both penalty/goal boxes, goal mouths with thicker "post" ticks).
 * `scale` converts pitch-units (PITCH_W/PITCH_H) to screen points — the same
 * factor MatchScreen uses for players and the ball.
 */
/**
 * Memoized: `scale` only changes on viewport resize, but the parent HUD
 * re-renders every advanced tick — without the memo these 17 Skia nodes (and
 * their fresh point-object props) re-reconciled at up to 40Hz for nothing.
 */
export const Pitch = memo(PitchMarkings);

function PitchMarkings({ scale }: { scale: number }) {
  const w = PITCH_W * scale;
  const h = PITCH_H * scale;
  const stripeH = h / STRIPE_COUNT;
  const midY = h / 2;
  const goalCenterX = GOAL_CENTER_X * scale;
  const goalHalfW = (GOAL_W * scale) / 2;
  const penaltyW = PENALTY_BOX_W * scale;
  const penaltyD = PENALTY_BOX_D * scale;
  const goalBoxW = GOAL_BOX_W * scale;
  const goalBoxD = GOAL_BOX_D * scale;
  const centerR = CENTER_CIRCLE_R * scale;
  const spotR = CENTER_SPOT_R * scale;
  const postLen = POST_TICK_LEN * scale;

  return (
    <Group>
      {[1, 3, 5, 7].map((i) => (
        <Rect key={i} x={0} y={i * stripeH} width={w} height={stripeH} color={STRIPE_ALT_COLOR} />
      ))}

      <Rect
        x={LINE_W / 2}
        y={LINE_W / 2}
        width={w - LINE_W}
        height={h - LINE_W}
        color={LINE_COLOR}
        style="stroke"
        strokeWidth={LINE_W}
      />
      <Line p1={{ x: 0, y: midY }} p2={{ x: w, y: midY }} color={LINE_COLOR} strokeWidth={LINE_W} />
      <Circle cx={w / 2} cy={midY} r={centerR} color={LINE_COLOR} style="stroke" strokeWidth={LINE_W} />
      <Circle cx={w / 2} cy={midY} r={spotR} color={LINE_COLOR} />

      {/* Top penalty box, goal box, goal mouth + posts */}
      <Rect
        x={goalCenterX - penaltyW / 2}
        y={0}
        width={penaltyW}
        height={penaltyD}
        color={LINE_COLOR}
        style="stroke"
        strokeWidth={LINE_W}
      />
      <Rect
        x={goalCenterX - goalBoxW / 2}
        y={0}
        width={goalBoxW}
        height={goalBoxD}
        color={LINE_COLOR}
        style="stroke"
        strokeWidth={LINE_W}
      />
      <Line
        p1={{ x: goalCenterX - goalHalfW, y: 0 }}
        p2={{ x: goalCenterX + goalHalfW, y: 0 }}
        color={LINE_COLOR}
        strokeWidth={POST_W}
      />
      <Line
        p1={{ x: goalCenterX - goalHalfW, y: 0 }}
        p2={{ x: goalCenterX - goalHalfW, y: postLen }}
        color={LINE_COLOR}
        strokeWidth={POST_W}
      />
      <Line
        p1={{ x: goalCenterX + goalHalfW, y: 0 }}
        p2={{ x: goalCenterX + goalHalfW, y: postLen }}
        color={LINE_COLOR}
        strokeWidth={POST_W}
      />

      {/* Bottom penalty box, goal box, goal mouth + posts */}
      <Rect
        x={goalCenterX - penaltyW / 2}
        y={h - penaltyD}
        width={penaltyW}
        height={penaltyD}
        color={LINE_COLOR}
        style="stroke"
        strokeWidth={LINE_W}
      />
      <Rect
        x={goalCenterX - goalBoxW / 2}
        y={h - goalBoxD}
        width={goalBoxW}
        height={goalBoxD}
        color={LINE_COLOR}
        style="stroke"
        strokeWidth={LINE_W}
      />
      <Line
        p1={{ x: goalCenterX - goalHalfW, y: h }}
        p2={{ x: goalCenterX + goalHalfW, y: h }}
        color={LINE_COLOR}
        strokeWidth={POST_W}
      />
      <Line
        p1={{ x: goalCenterX - goalHalfW, y: h - postLen }}
        p2={{ x: goalCenterX - goalHalfW, y: h }}
        color={LINE_COLOR}
        strokeWidth={POST_W}
      />
      <Line
        p1={{ x: goalCenterX + goalHalfW, y: h - postLen }}
        p2={{ x: goalCenterX + goalHalfW, y: h }}
        color={LINE_COLOR}
        strokeWidth={POST_W}
      />
    </Group>
  );
}
