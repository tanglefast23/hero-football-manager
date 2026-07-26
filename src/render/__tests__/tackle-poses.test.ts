import { readFileSync } from 'fs';
import { join } from 'path';
import {
  actionPose,
  STAGGER_LEAN,
  STAGGER_RECOIL_PIXELS,
  STAGGER_TICKS,
  staggerPush,
} from '../animation';
import { tacklePoses, type TacklePoseInput } from '../tackle-poses';

/**
 * A five-seed census of full matches measured 130.4 TACKLE events per match, of
 * which 99.8 were beaten challenges that still made contact. Those played
 * `tackle-thud` with nothing drawn at all, so the moment read as "nothing
 * happened". These tests pin the beat that fixes it, and the untested
 * knockdown/fall rows it now sits beside.
 */
const base: TacklePoseInput = {
  won: false,
  contact: true,
  startTick: 41,
  tick: 42,
  challenger: { x: 3000, y: 5000 },
  target: { x: 3120, y: 5000 },
  challengerTeam: 0,
  targetOutUntilTick: 0,
  challengerBusy: false,
};

describe('beaten challenge (TACKLE won:false, contact:true)', () => {
  it('staggers the challenger — the loser, not the winner', () => {
    const result = tacklePoses(base);
    expect(result.challenger?.kind).toBe('stagger');
    expect(result.target).toBeUndefined();
    expect(result.impact).toBeUndefined();
  });

  it('shoves the loser back the way he was beaten', () => {
    // The target is 120 pitch units to the +x side (the presser standoff ring),
    // so the recoil must point the other way.
    const pose = tacklePoses(base).challenger;
    expect(pose?.kind === 'stagger' && pose.direction).toEqual({ x: -1, y: -0 });
    expect(pose?.kind === 'stagger' && pose.rotation).toBe(-STAGGER_LEAN);
  });

  it('marks the midpoint between the two bodies, so the mark reads as contact', () => {
    const pose = tacklePoses(base).challenger;
    expect(pose?.kind === 'stagger' && pose.contact).toEqual({ x: 3060, y: 5000 });
  });

  it('leans toward whichever side the shove lands on', () => {
    const mirrored = tacklePoses({ ...base, target: { x: 2880, y: 5000 } }).challenger;
    expect(mirrored?.kind === 'stagger' && mirrored.direction).toEqual({ x: 1, y: -0 });
    expect(mirrored?.kind === 'stagger' && mirrored.rotation).toBe(STAGGER_LEAN);
  });

  it('starts one tick early, matching the interpolated visual clock', () => {
    expect(tacklePoses(base).challenger?.startTick).toBe(41);
  });

  it('stays silent when the challenge never made contact', () => {
    // Same rule the audio uses: no contact, no thud, so no mark either.
    expect(tacklePoses({ ...base, contact: false })).toEqual({});
  });

  it('never steals the body from a live slide', () => {
    // A missed slide already reads as a long grounded recovery; overwriting it
    // with a three-tick stagger would cut that short.
    expect(tacklePoses({ ...base, challengerBusy: true })).toEqual({});
  });

  it('refuses to place a mark against an expired decoy parked off-pitch', () => {
    const gone = { x: -1000, y: -1000 };
    expect(tacklePoses({ ...base, target: gone })).toEqual({});
    expect(tacklePoses({ ...base, challenger: gone })).toEqual({});
  });

  it('falls back to a team-facing shove when both share a coordinate', () => {
    const stacked = { ...base, target: { ...base.challenger } };
    const home = tacklePoses(stacked).challenger;
    expect(home?.kind === 'stagger' && home.direction).toEqual({ x: -0, y: 1 });
    const away = tacklePoses({ ...stacked, challengerTeam: 1 }).challenger;
    expect(away?.kind === 'stagger' && away.direction).toEqual({ x: -0, y: -1 });
  });
});

describe('won and knocked-out challenges keep their existing poses', () => {
  it('drops the dispossessed player on a won challenge with contact', () => {
    const result = tacklePoses({ ...base, won: true });
    expect(result.target?.kind).toBe('fall');
    expect(result.challenger).toBeUndefined();
  });

  it('draws nothing for a won challenge with no contact', () => {
    expect(tacklePoses({ ...base, won: true, contact: false })).toEqual({});
  });

  it('holds a knocked-out target down until their recovery tick, with an impact', () => {
    const result = tacklePoses({ ...base, won: true, targetOutUntilTick: 180 });
    expect(result.target).toMatchObject({ kind: 'knockdown', untilTick: 180 });
    expect(result.impact).toEqual({ x: 3120, y: 5000 });
  });

  it('ranks a knockout above the beaten-challenge stagger', () => {
    // Power tackles can knock a target out while still reporting won:false.
    const result = tacklePoses({ ...base, targetOutUntilTick: 180 });
    expect(result.target?.kind).toBe('knockdown');
    expect(result.challenger).toBeUndefined();
  });
});

/**
 * A beaten defender the sim has put on the grass (TACKLE `dropped`). The pose
 * must be `knockdown`, not `fall`: `fall` has no untilTick and runs a hardcoded
 * TACKLED_RECOVERY_TICKS, so it would animate 1.0s of prone against the sim's
 * 0.8s freeze and leave him moving while drawn on the floor.
 */
describe('dropped challenger (TACKLE dropped:true)', () => {
  const droppedBase: TacklePoseInput = {
    ...base,
    dropped: true,
    challengerRecoveryUntil: 50, // sim tick 42 + BEATEN_FALL_TICKS
  };

  it('floors the challenger rather than staggering him', () => {
    const result = tacklePoses(droppedBase);
    expect(result.challenger?.kind).toBe('knockdown');
    expect(result.target).toBeUndefined();
  });

  it('holds him down to the sim recovery tick so the get-up lands on it', () => {
    const pose = tacklePoses(droppedBase).challenger;
    expect(pose).toMatchObject({ kind: 'knockdown', untilTick: 50, startTick: 41 });
  });

  it('adds no impact burst — those stay knockouts only', () => {
    expect(tacklePoses(droppedBase).impact).toBeUndefined();
  });

  it('floors him even when a stale pose is still running', () => {
    // Unlike the stagger, going to ground outranks whatever the body was doing.
    const result = tacklePoses({ ...droppedBase, challengerBusy: true });
    expect(result.challenger?.kind).toBe('knockdown');
  });

  it('still only staggers when the sim left him on his feet', () => {
    const result = tacklePoses({ ...base, challengerRecoveryUntil: 0 });
    expect(result.challenger?.kind).toBe('stagger');
  });

  it('leans the floored body the way it was beaten', () => {
    const pose = tacklePoses(droppedBase).challenger;
    expect(pose?.kind === 'knockdown' && pose.anchor).toEqual({ x: 3000, y: 5000 });
    const mirrored = tacklePoses({ ...droppedBase, target: { x: 2880, y: 5000 } }).challenger;
    expect(pose?.kind === 'knockdown' && pose.rotation)
      .not.toBe(mirrored?.kind === 'knockdown' && mirrored.rotation);
  });
});

describe('stagger pose envelope', () => {
  const stagger = tacklePoses(base).challenger!;

  it('peaks early and eases back to nothing, so the sprite returns smoothly', () => {
    expect(staggerPush(0)).toBe(0);
    expect(staggerPush(STAGGER_TICKS * 0.25)).toBe(1);
    expect(staggerPush(STAGGER_TICKS)).toBe(0);
    // Monotonic release: no second bounce.
    const release = [0.3, 0.5, 0.7, 0.9].map(t => staggerPush(STAGGER_TICKS * t));
    expect(release).toEqual([...release].sort((a, b) => b - a));
  });

  it('is over inside a few hundred milliseconds — 100 a match cannot linger', () => {
    // TICK_MS is 100, so three ticks is 300ms.
    expect(STAGGER_TICKS).toBe(3);
    expect(actionPose(stagger, 41 + STAGGER_TICKS).active).toBe(false);
    expect(actionPose(stagger, 41 + STAGGER_TICKS + 50).active).toBe(false);
  });

  it('displaces the sprite in source pixels and tilts it, both at the same peak', () => {
    const peak = actionPose(stagger, 41 + STAGGER_TICKS * 0.25);
    expect(peak.active).toBe(true);
    expect(peak.forwardOffset).toBe(STAGGER_RECOIL_PIXELS);
    expect(Math.abs(peak.rotation)).toBeCloseTo(STAGGER_LEAN, 10);
    // Never blends toward an anchor: that is the fall/knockdown mechanism.
    expect(peak.anchorWeight).toBe(0);
  });

  it('stays a nudge, not a knockdown — a fifth of a body width and ~13°', () => {
    expect(STAGGER_RECOIL_PIXELS).toBeLessThan(24 / 4); // player cell is 24 source px
    expect(STAGGER_LEAN).toBeLessThan(Math.PI / 8);
  });

  it('is suppressed entirely by Reduce Motion, via the one guard in MatchScreen', () => {
    const source = readFileSync(join(process.cwd(), 'src/render/MatchScreen.tsx'), 'utf8');
    // Every tackle pose — and therefore the scuff, which is derived from the
    // stagger pose — hangs off this single guard.
    expect(source).toContain("if (!reduceMotion && e.kind === 'TACKLE') {");
    expect(source).toContain('const poses = tacklePoses({');
  });
});
