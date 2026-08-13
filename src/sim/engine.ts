import {
  BLEND_TICKS,
  blendedTableTarget,
  gkTarget,
  kickoffPos,
} from './movement-table';
import {
  clamp,
  dist,
  dist2,
  moveToward,
  GOAL_CENTER_X,
  GOAL_W,
  HALF_TICKS,
  PITCH_W,
  PITCH_H,
  type Vec,
} from './geometry';
import { emit } from './events';
import {
  conditionedRatingD64,
  contest,
  contestProbability,
  ratingD64,
  resolveD64,
} from './contest';
import {
  addGauge,
  clearPowerCommitment,
  clearRestartPowerState,
  consumeDecoyAction,
  consumeKeeperShotCharge,
  consumePhaseChallenge,
  consumePortalProtection,
  consumeShadowMark,
  finishMomentPower,
  futureSightInterceptor,
  gravityPriorityTarget,
  gravityRunnerTarget,
  gustDisruptsPass,
  gustPuntDestination,
  interruptWindup,
  isShadowMarked,
  powerActionBlocked,
  powerInteractionBlocked,
  speedMultiplier,
  fireSuppressed,
  dribbleBonus,
  defenseBonus,
  keeperSaveBonus,
  knockOut,
  phaseRunPreventsShot,
  powerFinishShotProfile,
  STRENGTH_LOCK_RANGE,
} from './powers';
import {
  energyDrainMultiplier,
  energyMovementMultiplier,
  formationTarget,
  mentalityTarget,
  type EnergyUse,
} from './tactics';
import type {
  Attrs,
  D64Modifier,
  MatchState,
  MovementState,
  SimPlayer,
} from './types';
import {
  activePlayerIndices,
  attributedPlayerIndex,
  BASE_PLAYER_COUNT,
  formationSlotForEntity,
  playerAt,
  requirePlayerAt,
} from './entities';
import {
  BASE_MOVEMENT_SPEED,
  matchAttribute,
  matchPaceAttribute,
  paceSpeed128,
  PACE_SPEED_SCALE,
  slideStaminaDrainScale,
  staminaEnduranceScale,
} from './attributes';

export {
  addGauge,
  interruptWindup,
  speedMultiplier,
  fireSuppressed,
  dribbleBonus,
  defenseBonus,
  knockOut,
};

const STANDING_TACKLE_RANGE = 200;
const SLIDE_TACKLE_MIN_RANGE = 800;
const SLIDE_TACKLE_MAX_RANGE = 1100;
export const SLIDE_TACKLE_TICKS = 4;
const SLIDE_TACKLE_SPEED_MULTIPLIER = 4.2;
const SLIDE_TACKLE_CONDITION_FLOOR = 30;
const SLIDE_TACKLE_PREFERRED_CONDITION = 80;
const SLIDE_TACKLE_CONDITION_COST = 0.4;
const SLIDE_TACKLE_COOLDOWN_TICKS = 40;
export const SLIDE_SUCCESS_RECOVERY_TICKS = 6;
const SLIDE_MISS_RECOVERY_TICKS = 12;
const SLIDE_CONTACT_RANGE = 50;

const STANDING_TACKLE_COOLDOWN_TICKS = 10;

// A beaten defender used to pay nothing: he kept his feet, kept his standoff
// ring, and re-rolled one second later. MEASURED, 30-40 seeded matches: 121
// standing challenges a match (one per 1.7s), only 20.5% won, and 10 duels a
// match where one pair stayed locked for 2s+ while travelling ~11m up the pitch.
// Dropping the loser is what punctuates that grind.
//
// The chance scales with how outgunned he is, so TEC finally buys something
// visible. 0.25 at an even duel is roughly 20 falls a match (one per 10s); 0.35
// measured out near 30, which reads as slapstick.
const BEATEN_DROP_BASE = 0.25;
const BEATEN_DROP_DELTA_SCALE = 0.015;
// The clamp band, not the base rate, is what bounds this mechanic. A carrier's
// TEC usually exceeds his marker's DEF (MEASURED mean delta at a lost challenge:
// -19.7 in an even match, -36.8 for the weaker side of a +20 mismatch), so the
// raw curve sits above its ceiling in nearly every duel and the ceiling is what
// actually sets the rate.
//
// 0.20 was MEASURED against two constraints. A [0.10, 0.70] band gave 36 falls a
// match in even play — one every 5.5s, slapstick — and lifted the dominant side
// of the +20 rail by +0.56 goals a match, breaking the p95 blowout rail (10 vs
// <=9). [0.12, 0.20] lands ~19 falls a match, the agreed one-per-10s cadence.
//
// Lowering BEATEN_DROP_BASE instead makes a mismatch WORSE, not better (0.15
// measured a 3.26x fell-rate asymmetry against 2.68x at 0.25): the ceiling still
// lets a lopsided duel drop often while ordinary duels drop less, so the gap
// widens. Tune the ceiling for blowouts, the base for tempo.
//
// What survives of the delta term at this band: a defender who outclasses his
// man by ~9+ points falls at the 0.12 floor instead of 0.20, so DEF still buys
// staying on your feet. TEC's payoff is the drop existing at all.
const BEATEN_DROP_MIN = 0.12;
const BEATEN_DROP_MAX = 0.2;
/**
 * 0.8s. MEASURED: when a challenge is lost the covering opponent is 8.2m away
 * and closes at up to 6.2 m/s net, reaching standing range in ~1.0s — so the
 * cover's arrival, not the fall length, governs the breakaway. A longer fall
 * would only leave a body on the turf beside an already-live duel.
 */
export const BEATEN_FALL_TICKS = 8;
const BEATEN_FALL_COOLDOWN_EXTRA = 4;
/** A failure older than 3s starts a new count rather than extending the old one. */
export const BEATEN_STREAK_STALE_TICKS = 30;
const BEATEN_STREAK_FORCE_COUNT = 3;
/**
 * How close a floored opponent must be to the carrier for the breakaway window
 * to be open. 15m covers the whole fall: the carrier only travels ~3.2m in
 * BEATEN_FALL_TICKS, and the beaten man is inside 2m when he goes down.
 */
/**
 * Letting midfielders slide on the breakaway beat was designed, built, measured,
 * and cut. Recorded here because the measurements are the reason and the idea
 * will otherwise come back:
 *
 *  - Unrestricted it broke the +20 blowout rail (p95 goal margin 10 vs <=9) by
 *    handing the dominant side 4.05 extra winning challenges a match.
 *  - Gating on a real chance of winning did not help: the strong side's
 *    midfielders were the ones passing the gate.
 *  - Restricting it to a team's own defensive third passed the rails but left
 *    the whole path at 0.10 slides a match — two per twenty matches.
 *
 * The slides arrived anyway, from defenders. Flooring beaten defenders leaves
 * carriers in open space, and a carrier in space keeps the ball instead of
 * passing, so committed slides connect: launches 5.1 -> 8.9 a match, contact
 * rate 17% -> 44%, slides won 0.4 -> 1.4. Nothing in slideLaunchRange changed.
 */

// Heat rewards, one table so each role's decisive act is worth about a shot.
// Frequent actions stay cheap on purpose: a completed pass paid even 3 Heat
// would let a midfielder making 40 passes out-charge every striker.
const SHOT_GAUGE = 20;
const SAVE_GAUGE = 30;
const MISS_GAUGE = 10;
const GOALKEEPER_DISTRIBUTION_GAUGE = 5;
const TACKLE_WON_GAUGE = 18;
const INTERCEPTION_GAUGE = 12;
const LOOSE_BALL_GAUGE = 8;
const TACKLE_ATTEMPT_GAUGE = 3;
const PASS_RECEIVED_GAUGE = 2;
const FAILED_PASS_LOOSE_CHANCE = 0.35;
const FAILED_PASS_DEFLECTION_SPEED = 240;

function goalYFor(team: 0 | 1): number {
  return team === 0 ? 0 : PITCH_H;
}

function isAvailable(state: MatchState, idx: number): boolean {
  const p = playerAt(state, idx);
  if (p === undefined) return false;
  return (
    p.outUntilTick <= state.tick &&
    p.slideTackle === undefined &&
    p.tackleRecoveryUntil <= state.tick &&
    !powerInteractionBlocked(state, idx)
  );
}

function isConscious(state: MatchState, idx: number): boolean {
  const player = playerAt(state, idx);
  return player !== undefined && player.outUntilTick <= state.tick;
}

/**
 * Bounded fallback retained only for non-PAC movement and the canonical STA
 * table generator. Contest, decision, and shot execution consumers use the
 * explicit d64 domain wrappers below.
 */
function conditionedStat(
  state: MatchState,
  idx: number,
  stat: keyof Attrs,
): number {
  const player = requirePlayerAt(state, idx);
  // STA determines drain; every other action stat follows the canon curve:
  // full value at 100 condition, down to at most a 25% penalty at zero.
  const baseAttribute = matchAttribute(player.def.attrs[stat]);
  if (stat === 'sta') return baseAttribute;
  const conditionScale = 0.75 + 0.25 * (player.condition / 100);
  return Math.max(1, Math.round(baseAttribute * conditionScale));
}

export function contestStat(
  state: MatchState,
  idx: number,
  stat: keyof Attrs,
): number {
  const player = requirePlayerAt(state, idx);
  return conditionedRatingD64(player.def.attrs[stat], player.condition);
}

export function movementStat(
  state: MatchState,
  idx: number,
  stat: keyof Attrs,
): number {
  if (stat === 'pac') {
    const player = requirePlayerAt(state, idx);
    const pace = matchPaceAttribute(player.def.attrs.pac);
    const conditionScale = 0.75 + 0.25 * (player.condition / 100);
    return Math.max(1, Math.round(pace * conditionScale));
  }
  return conditionedStat(state, idx, stat);
}

export function executionStat(
  state: MatchState,
  idx: number,
  stat: keyof Attrs,
): number {
  const player = requirePlayerAt(state, idx);
  return conditionedRatingD64(player.def.attrs[stat], player.condition);
}

export function decisionStat(
  state: MatchState,
  idx: number,
  stat: keyof Attrs,
): number {
  const player = requirePlayerAt(state, idx);
  return conditionedRatingD64(player.def.attrs[stat], player.condition);
}

function conditionedPaceSpeed128(state: MatchState, idx: number): number {
  const player = requirePlayerAt(state, idx);
  const fullSpeed128 = paceSpeed128(player.def.attrs.pac);
  const baseSpeed128 = BASE_MOVEMENT_SPEED * PACE_SPEED_SCALE;
  const paceContribution128 = fullSpeed128 - baseSpeed128;
  const conditionScale = 0.75 + (0.25 * player.condition) / 100;
  return baseSpeed128 + Math.round(paceContribution128 * conditionScale);
}

function speedFor128(state: MatchState, idx: number): number {
  return Math.round(
    conditionedPaceSpeed128(state, idx) * speedMultiplier(state, idx),
  );
}

/** Authoritative integer-coordinate speed for non-residue movement consumers. */
export function speedFor(state: MatchState, idx: number): number {
  return Math.round(speedFor128(state, idx) / PACE_SPEED_SCALE);
}

export function ballPos(state: MatchState): Vec {
  const b = state.ball;
  return b.kind === 'held' ? requirePlayerAt(state, b.by).pos : b.pos;
}

/** Height in centimetres above the pitch; caught keepers hold the ball at chest height. */
export function ballHeight(state: MatchState): number {
  const b = state.ball;
  return b.kind === 'held' ? (b.caught ? GOALKEEPER_CATCH_HEIGHT : 0) : b.z;
}

const ORDINARY_CONDITION_COST = 0.0205;
const SPRINT_CONDITION_COST = 0.058;

export function drainStamina(
  p: SimPlayer,
  movedFar: boolean,
  energyUse: EnergyUse = 'BALANCED',
): void {
  // The design-pinned comparison is STA 40 => 1.36x drain and STA 80 =>
  // 1.12x. Condition affects speed plus every contested action exactly once.
  const enduranceScale = staminaEnduranceScale(p.def.attrs.sta);
  const cost =
    (movedFar ? SPRINT_CONDITION_COST : ORDINARY_CONDITION_COST) *
    enduranceScale *
    energyDrainMultiplier(energyUse);
  p.condition = Math.max(0, p.condition - cost);
}

function drainSlideCondition(p: SimPlayer, energyUse: EnergyUse): void {
  const drainMultiplier = slideStaminaDrainScale(p.def.attrs.sta);
  p.condition = clamp(
    p.condition -
      SLIDE_TACKLE_CONDITION_COST *
        drainMultiplier *
        energyDrainMultiplier(energyUse),
    0,
    100,
  );
}

export function restartKickoff(state: MatchState, toTeam: 0 | 1): void {
  clearRestartPowerState(state);
  state.ballHolderId = null;
  state.ballHolderTeam = null;
  state.assistCandidateId = null;
  const center = { x: PITCH_W / 2, y: PITCH_H / 2 };
  for (let i = 0; i < BASE_PLAYER_COUNT; i++) {
    const p = state.players[i];
    // A restart resets ordinary tackle choreography; a genuinely knocked-out,
    // ignited, or dismissed player remains unavailable and is not teleported.
    p.slideTackle = undefined;
    p.tackleRecoveryUntil = 0;
    p.beatenStreak = undefined;
    if (!isConscious(state, i)) continue;
    p.pos = formationTarget(
      p.team,
      i % 11,
      state.tactics[p.team].formation,
      kickoffPos(p.team, i % 11),
    );
    p.movementResidue = { x: 0, y: 0 };
  }
  let striker = toTeam === 0 ? 9 : 20;
  if (!isConscious(state, striker)) {
    const base = toTeam === 0 ? 0 : 11;
    for (let s = base + 10; s >= base; s--) {
      if (isConscious(state, s)) {
        striker = s;
        break;
      }
    }
  }
  state.players[striker].pos = { ...center };
  state.players[striker].movementResidue = { x: 0, y: 0 };
  state.ball = { kind: 'held', by: striker };
  // Restart repositioning is a teleport — snap the phase to the kicking team
  // (no blend) and drop the presser lease.
  state.movement = {
    phase: toTeam,
    blendFrom: toTeam,
    blendStartTick: state.tick,
    presserIdx: -1,
    presserSinceTick: state.tick,
  };
}

/** Presser hysteresis: once selected, a presser holds the role for at least this many ticks unless unavailable (movement spec — kills per-tick flip-flop between near-equidistant defenders). */
export const PRESSER_LEASE_TICKS = 10;
const CARRIER_SPEED_SCALE = 0.37;

/**
 * Radius a presser closes to instead of standing on the carrier's exact point,
 * widened by the carrier's pace edge over the presser.
 *
 * This one ring fixes two separate audit findings.
 *
 * READABILITY. The presser used to target the carrier's position exactly, so for
 * 45.9% of possession ticks (MEASURED, 20 matches) an opponent sat within 60
 * pitch units of the carrier — about 3.4pt against a 23pt sprite, i.e. two
 * sprites ~85% overlapped, moving as one blob. That is the "players tying up
 * looks like slowdown" complaint: a readability failure, not a frame-rate one.
 *
 * PACE. PAC was not merely weak, it was mildly HARMFUL: MEASURED -0.063 ppm for
 * +11 PAC on every outfielder, against DEF +0.463 and TEC +0.375. The cause was
 * arithmetic. `speedFor` is `40 + pac`, and a carrier multiplies that whole sum
 * by CARRIER_SPEED_SCALE, so a pace-90 carrier dribbles at 0.37 * 130 = 48 while
 * a pace-40 presser closes at 80 — no carrier at any pace could outrun any
 * realistic presser, and each pace point was worth 1.0 speed to a defender
 * against 0.37 to a carrier. Buying pace armed the opposition's press harder
 * than your own attack. A pace-widened ring gives the stat somewhere to pay off
 * without touching dribble speed, so match tempo is unchanged.
 *
 * 90 was MEASURED, 80 seeds, ROVERS vs UNITED at its even point (delta 0):
 *
 * ```
 * base   goals/match  +11 PAC  +11 SHO  +11 DEF   sep <60   sep >=120
 * none       2.19      -0.063   +0.100   +0.463     45.9%      49.9%
 *  60        2.45      -0.038   +0.212   +0.862      2.4%      79.9%
 *  90        2.38      +0.225   +0.250   +0.587      0.9%      91.5%
 * 120        2.50      +0.363   +0.188   +0.788      0.9%      95.4%
 * 150        2.86      +0.700       -    +0.462      0.8%      98.2%
 * ```
 *
 * At 60 pace is still negative; by 150 pace outranks every other stat and
 * scoring leaves the 2.0..2.7 band because the press has been defanged. 90 makes
 * pace worth about as much as shooting while DEF stays correctly the strongest
 * stat, and moves 91.5% of duels to a >=120-unit gap (~7pt of clear air).
 *
 * The ring spans 30..150, deliberately inside STANDING_TACKLE_RANGE (200) at
 * every pace edge — pressing must still win the ball. A carrier only earns the
 * tight end of that range by being much slower than the defender.
 */
const PRESS_STANDOFF_BASE = 90;
const PRESS_STANDOFF_PACE_SPAN = 60;
const PRESS_STANDOFF_PACE_CLAMP = 20;

/** How far off the carrier this presser holds station, widened by the carrier's pace edge. */
function pressStandoffRadius(carrierPac: number, presserPac: number): number {
  const edge = clamp(
    carrierPac - presserPac,
    -PRESS_STANDOFF_PACE_CLAMP,
    PRESS_STANDOFF_PACE_CLAMP,
  );
  return (
    PRESS_STANDOFF_BASE +
    Math.round((PRESS_STANDOFF_PACE_SPAN * edge) / PRESS_STANDOFF_PACE_CLAMP)
  );
}

/**
 * The point `radius` short of the carrier on the presser's own approach line.
 * Already inside the ring means hold station — backing off would look like the
 * defender losing interest and would undo standing tackles.
 */
function standoffTarget(presserPos: Vec, carrierPos: Vec, radius: number): Vec {
  const d = dist(presserPos, carrierPos);
  if (d <= radius) return presserPos;
  const t = (d - radius) / d;
  return {
    x: Math.round(presserPos.x + (carrierPos.x - presserPos.x) * t),
    y: Math.round(presserPos.y + (carrierPos.y - presserPos.y) * t),
  };
}

const STRENGTH_ZONE_APPROACH_RANGE = STRENGTH_LOCK_RANGE + 600;

/**
 * Pure: the movement bookkeeping a movement tick would run under the current
 * state — phase turnover (blend restart) + presser lease renewal. movementTick
 * commits the result to state.movement; movementTargets only reads it. A
 * turnover mid-blend re-bases the blend on the interrupted phase pair (the
 * small target discontinuity is smoothed by the movement speed cap).
 */
function resolveMovement(state: MatchState): MovementState {
  const mv = state.movement;
  let { phase, blendFrom, blendStartTick, presserIdx, presserSinceTick } = mv;
  const b = state.ball;
  if (b.kind === 'held') {
    const holderTeam = requirePlayerAt(state, b.by).team;
    if (holderTeam !== phase) {
      blendFrom = phase;
      phase = holderTeam;
      blendStartTick = state.tick;
    }
    const leaseValid =
      presserIdx !== -1 &&
      isAvailable(state, presserIdx) &&
      requirePlayerAt(state, presserIdx).team !== holderTeam &&
      state.tick < presserSinceTick + PRESSER_LEASE_TICKS;
    if (!leaseValid) {
      presserIdx = nearestOpponent(state, b.by);
      presserSinceTick = state.tick;
    }
  }
  // Loose/pass/shot states keep the previous phase and let the lease age out.
  return { phase, blendFrom, blendStartTick, presserIdx, presserSinceTick };
}

/**
 * Turnover-blend stagger per engine slot (1-4 DEF, 5-8 MID, 9-10 FWD):
 * defenders re-shape first, forwards drift last, delays spread 0-9 ticks
 * (slots 6 and 9 deliberately share a delay; full spread matters, not
 * pairwise uniqueness) — the blend exists so all ten don't reverse
 * simultaneously, and a shared start would still pulse every line's
 * velocity in lockstep (accepted deviation, spec disposition record).
 */
const BLEND_DELAY: ReadonlyArray<number> = [0, 0, 2, 3, 1, 4, 6, 8, 5, 6, 9]; // index = engine slot; [0] unused (GK)
function blendDelay(slot: number): number {
  return BLEND_DELAY[slot];
}

/** Fallback (off-ball) target: GK narrows the angle on the goal-center→ball ray; outfielders sample the phase tables with the turnover blend. */
function fallbackTarget(
  state: MatchState,
  idx: number,
  mv: MovementState,
  ball: Vec,
): Vec {
  const p = requirePlayerAt(state, idx);
  const slot = formationSlotForEntity(state, idx);
  if (slot === 0) return gkTarget(p.team, ball);
  // In the closing minutes, the second forward reacts two ticks later to
  // phase changes. That small fatigue-era separation keeps the shape from
  // reverting to a rigid sheet without scrambling early/mid-match movement.
  const lateShapeLag = state.tick >= HALF_TICKS * 2 - 150 && slot === 9 ? 2 : 0;
  const t = clamp(
    (state.tick - mv.blendStartTick - blendDelay(slot) - lateShapeLag) /
      BLEND_TICKS,
    0,
    1,
  );
  const inPossession = mv.phase === p.team;
  const table = blendedTableTarget(
    p.team,
    slot,
    mv.blendFrom === p.team,
    inPossession,
    t,
    ball,
  );
  const formed = formationTarget(
    p.team,
    slot,
    state.tactics[p.team].formation,
    table,
    inPossession,
  );
  return mentalityTarget(
    p.team,
    slot,
    state.tactics[p.team].mentality,
    inPossession,
    formed,
  );
}

/** The movement priority ladder (unchanged order: carrier → charge lock → presser → receiver → loose chaser → table target). */
function targetFor(
  state: MatchState,
  i: number,
  mv: MovementState,
  presserIdx: number,
  ball: Vec,
): Vec {
  const p = requirePlayerAt(state, i);
  const isCarrier = state.ball.kind === 'held' && state.ball.by === i;
  const chargeTarget =
    p.def.power === 'SUPER_STRENGTH' &&
    p.powerState.kind === 'winding' &&
    p.powerState.targetIdx !== undefined &&
    p.powerState.targetIdx >= 0 &&
    playerAt(state, p.powerState.targetIdx) !== undefined
      ? requirePlayerAt(state, p.powerState.targetIdx).pos
      : null;
  const strengthZoneTarget =
    (p.powerState.kind === 'zone' || p.powerState.kind === 'armed') &&
    p.def.power === 'SUPER_STRENGTH' &&
    state.ball.kind === 'held' &&
    requirePlayerAt(state, state.ball.by).team !== p.team &&
    dist2(requirePlayerAt(state, state.ball.by).pos, p.pos) <
      STRENGTH_ZONE_APPROACH_RANGE * STRENGTH_ZONE_APPROACH_RANGE
      ? requirePlayerAt(state, state.ball.by).pos
      : null;
  const passReceiverIdx =
    state.ball.kind === 'pass'
      ? state.ball.willSucceed
        ? state.ball.to
        : state.ball.interceptor !== -1
          ? state.ball.interceptor
          : state.ball.to
      : -1;
  const isPassReceiver =
    passReceiverIdx === i &&
    state.ball.kind === 'pass' &&
    state.ball.decoyReceiverPlayerId === undefined;
  const chaseLoose =
    state.ball.kind === 'loose' && dist2(p.pos, ball) < 1500 * 1500;
  const gravityTarget = gravityRunnerTarget(state, i);
  // The presser holds a standoff ring rather than standing on the carrier, so a
  // duel reads as two players. Pass receivers and loose chasers still go to the
  // ball itself — they are contesting it, not shepherding a carrier.
  const pressTarget =
    i === presserIdx && state.ball.kind === 'held'
      ? standoffTarget(
          p.pos,
          ball,
          pressStandoffRadius(
            movementStat(state, state.ball.by, 'pac'),
            movementStat(state, i, 'pac'),
          ),
        )
      : null;
  return isCarrier
    ? carryTarget(state, i)
    : chargeTarget
      ? chargeTarget
      : strengthZoneTarget
        ? strengthZoneTarget
        : (gravityTarget ??
          pressTarget ??
          (isPassReceiver || chaseLoose
            ? ball
            : fallbackTarget(state, i, mv, ball)));
}

function slideMovementTick(state: MatchState, idx: number): void {
  const p = requirePlayerAt(state, idx);
  const slide = p.slideTackle;
  if (!slide) return;
  const before = { ...p.pos };
  p.movementResidue = { x: 0, y: 0 };
  const speed = Math.max(
    1,
    Math.round(speedFor(state, idx) * SLIDE_TACKLE_SPEED_MULTIPLIER),
  );
  const step = Math.min(speed, slide.remainingDistance);
  p.pos = {
    x: Math.round(clamp(p.pos.x + slide.direction.x * step, 0, PITCH_W)),
    y: Math.round(clamp(p.pos.y + slide.direction.y * step, 0, PITCH_H)),
  };
  slide.previousPos = before;
  slide.remainingDistance = Math.max(
    0,
    slide.remainingDistance - dist(before, p.pos),
  );
}

function moveTowardWithResidue(
  player: SimPlayer,
  target: Vec,
  speed128: number,
): Vec {
  const dx = target.x - player.pos.x;
  const dy = target.y - player.pos.y;
  const distance2 = dx * dx + dy * dy;
  if (
    distance2 === 0 ||
    distance2 * PACE_SPEED_SCALE * PACE_SPEED_SCALE <= speed128 * speed128
  ) {
    player.movementResidue = { x: 0, y: 0 };
    return { ...target };
  }
  const distance = Math.sqrt(distance2);
  const residue = player.movementResidue ?? { x: 0, y: 0 };
  const x128 = Math.round((dx * speed128) / distance) + residue.x;
  const y128 = Math.round((dy * speed128) / distance) + residue.y;
  const stepX = Math.trunc(x128 / PACE_SPEED_SCALE);
  const stepY = Math.trunc(y128 / PACE_SPEED_SCALE);
  const next = {
    x: clamp(player.pos.x + stepX, 0, PITCH_W),
    y: clamp(player.pos.y + stepY, 0, PITCH_H),
  };
  player.movementResidue =
    next.x === player.pos.x + stepX && next.y === player.pos.y + stepY
      ? {
          x: x128 - stepX * PACE_SPEED_SCALE,
          y: y128 - stepY * PACE_SPEED_SCALE,
        }
      : { x: 0, y: 0 };
  return next;
}

export function movementTick(state: MatchState): void {
  const ball = ballPos(state);
  const mv = resolveMovement(state);
  state.movement = mv;
  const presserIdx = state.ball.kind === 'held' ? mv.presserIdx : -1;
  for (const i of activePlayerIndices(state)) {
    const p = requirePlayerAt(state, i);
    if (!isConscious(state, i)) continue;
    if (p.outUntilTick !== 0) {
      if (p.outUntilTick !== Number.MAX_SAFE_INTEGER) {
        emit(state, {
          t: state.tick,
          kind: p.outReason === 'ignited' ? 'EXTINGUISHED' : 'RECOVERED',
          player: i,
        });
      }
      p.outUntilTick = 0;
      p.outReason = undefined;
    }
    if (p.slideTackle) {
      slideMovementTick(state, i);
      continue;
    }
    if (
      p.forcedMovement !== undefined &&
      p.forcedMovement.untilTick > state.tick
    ) {
      p.movementResidue = { x: 0, y: 0 };
      p.pos = {
        x: Math.round(clamp(p.pos.x + p.forcedMovement.step.x, 0, PITCH_W)),
        y: Math.round(
          clamp(p.pos.y + p.forcedMovement.step.y, 300, PITCH_H - 300),
        ),
      };
      continue;
    }
    if (powerInteractionBlocked(state, i)) {
      p.movementResidue = { x: 0, y: 0 };
      continue;
    }
    if (p.tackleRecoveryUntil > state.tick) {
      p.movementResidue = { x: 0, y: 0 };
      continue;
    }
    const target = targetFor(state, i, mv, presserIdx, ball);
    const before = p.pos;
    // A carrier controls the ball while moving and cannot sustain an off-ball
    // sprint. The slower dribble also gives pressing and passing decisions time
    // to read on a 3-4 minute match instead of producing a shot every few seconds.
    const carrying = state.ball.kind === 'held' && state.ball.by === i;
    const movementSpeed128 = carrying
      ? Math.round(speedFor128(state, i) * CARRIER_SPEED_SCALE)
      : Math.round(
          speedFor128(state, i) *
            energyMovementMultiplier(
              state.tactics[p.team].energyUse,
              p.condition,
            ),
        );
    p.pos = moveTowardWithResidue(p, target, movementSpeed128);
    drainStamina(
      p,
      dist2(before, p.pos) > 6400,
      state.tactics[p.team].energyUse,
    );
  }
}

/**
 * Dev/debug query (renderer overlay): the target each player would steer to if
 * a movement tick ran on the current state. Pure — no state mutation, no rng.
 * Out players report their own position (they don't move).
 */
export function movementTargets(state: MatchState): Vec[] {
  const ball = ballPos(state);
  const mv = resolveMovement(state);
  const presserIdx = state.ball.kind === 'held' ? mv.presserIdx : -1;
  const targets: Vec[] = [];
  for (let i = 0; i < BASE_PLAYER_COUNT; i++) {
    const t = isAvailable(state, i)
      ? targetFor(state, i, mv, presserIdx, ball)
      : state.players[i].pos;
    targets.push({ x: t.x, y: t.y }); // copies — never alias live sim positions
  }
  return targets;
}

const PASS_SPEED = 250;
const BALL_GRAVITY = 10;
export const BALL_CONTROL_HEIGHT = 150;
export const GOALKEEPER_CATCH_HOLD_TICKS = 6;
export const LIFTED_SHOT_CHANCE = 0.3;

const GOALKEEPER_CATCH_HEIGHT = 90;
const GOALKEEPER_DISTRIBUTION_FLIGHT_TICKS = 12;
const LIFTED_SHOT_GOAL_HEIGHT = 110;

/**
 * Initial vertical speed for semi-implicit Euler (`vz -= g; z += vz`) to
 * arrive at `targetHeight` after `flightTicks`. All values are integer cm/tick.
 */
export function verticalLaunchSpeed(
  flightTicks: number,
  targetHeight: number,
): number {
  const ticks = Math.max(1, Math.round(flightTicks));
  return Math.round(
    (targetHeight + (BALL_GRAVITY * ticks * (ticks + 1)) / 2) / ticks,
  );
}

/** Advances only the vertical component; the pitch-plane coordinate stays independent. */
export function advanceFlightHeight(ball: { z: number; vz: number }): void {
  if (ball.z === 0 && ball.vz === 0) return;
  ball.vz -= BALL_GRAVITY;
  ball.z = Math.max(0, ball.z + ball.vz);
  if (ball.z === 0 && ball.vz < 0) ball.vz = 0;
}

const DECISION_TICKS = 5;
const OPEN_LANE_CLEARANCE = 800;
const OPEN_SHOT_CLEARANCE = 600;
const PASS_SWITCH_MARGIN = 0.005;
const SHOT_FUN_BIAS = 0.06;
const MIN_SHOT_VALUE = 0.06;
const OBVIOUS_SHOT_DISTANCE = 1800;
const CARRY_TIME_DISCOUNT = 0.7;
const SHOT_KEEPER_MOD_D64 = 0;
const PASS_CONTEST_MOD_D64 = 640;
const GEOMETRY_RELIEF_D64 = 64;
const NO_D64_MOD: D64Modifier = { d64Mod: 0 };
// Resolve should make sustained pressure visible without turning one strong
// half into an irreversible keeper-collapse cascade. Six keeps repeated shots
// meaningful while preserving a realistic recovery window at halftime.
const RESOLVE_DAMAGE_DIVISOR = 6;
const SHOT_DISPLAY_BASELINE = 60;
const SHOT_DISTANCE_D64_PER_200 = 37;
const POWER_FINISH_FULL_ADVANTAGE_D64 = 196; // 1.10x
const POWER_FINISH_SATURATED_ADVANTAGE_D64 = 457; // 1.25x

interface ActionValues {
  shot: number;
  carry: number;
  pass: number;
}

type AttackingDecision =
  | { kind: 'shoot'; values: ActionValues }
  | { kind: 'carry'; values: ActionValues }
  | { kind: 'pass'; to: number; values: ActionValues };

interface PassOption {
  to: number;
  value: number;
  interceptor: number;
  interceptStat: number;
}

export function nearestOpponent(state: MatchState, idx: number): number {
  const me = requirePlayerAt(state, idx);
  let best = -1,
    bestD2 = Infinity;
  for (const i of activePlayerIndices(state)) {
    const o = requirePlayerAt(state, i);
    if (o.team === me.team || !isAvailable(state, i)) continue;
    const d2 = dist2(o.pos, me.pos);
    if (d2 < bestD2) {
      bestD2 = d2;
      best = i;
    }
  }
  return best;
}

/** Enemy decisions cannot plan around an active Shadow Mark, while the real
 * launch/challenge resolver still includes that defender. */
function nearestVisibleOpponent(state: MatchState, idx: number): number {
  const me = requirePlayerAt(state, idx);
  let best = -1,
    bestD2 = Infinity;
  for (const i of activePlayerIndices(state)) {
    const opponent = requirePlayerAt(state, i);
    if (
      opponent.team === me.team ||
      !isAvailable(state, i) ||
      isShadowMarked(state, i)
    )
      continue;
    const d2 = dist2(opponent.pos, me.pos);
    if (d2 < bestD2) {
      bestD2 = d2;
      best = i;
    }
  }
  return best;
}

/** Forward carry vector with a small deterministic left/centre/right lane choice. */
function carryTarget(state: MatchState, idx: number): Vec {
  const carrier = requirePlayerAt(state, idx);
  const direction = carrier.team === 0 ? -1 : 1;
  const y = clamp(carrier.pos.y + direction * 800, 0, PITCH_H);
  const xs = [carrier.pos.x - 600, carrier.pos.x, carrier.pos.x + 600];
  let best = { x: clamp(xs[0], 0, PITCH_W), y };
  let bestScore = -Infinity;

  for (const rawX of xs) {
    const candidate = { x: clamp(rawX, 0, PITCH_W), y };
    let space = 1500;
    for (const i of activePlayerIndices(state)) {
      const opponent = requirePlayerAt(state, i);
      if (
        opponent.team === carrier.team ||
        !isAvailable(state, i) ||
        isShadowMarked(state, i)
      )
        continue;
      space = Math.min(space, dist(opponent.pos, candidate));
    }
    const centrality = GOAL_CENTER_X - Math.abs(candidate.x - GOAL_CENTER_X);
    const score = space + centrality * 0.15;
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

/** Distance from p to the strict interior of segment a→b; endpoint pressure is handled separately. */
function interiorSegmentDistance(p: Vec, a: Vec, b: Vec): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const apx = p.x - a.x;
  const apy = p.y - a.y;
  const length2 = abx * abx + aby * aby;
  if (length2 === 0) return Infinity;
  const projection = apx * abx + apy * aby;
  if (projection <= 0 || projection >= length2) return Infinity;
  const cross = Math.abs(abx * apy - aby * apx);
  return Math.round(cross / Math.sqrt(length2));
}

/** Nearest available opponent crossing the strict interior of a lane, capped at `openAt`. */
function laneClearance(
  state: MatchState,
  team: 0 | 1,
  from: Vec,
  to: Vec,
  openAt: number,
  includeGoalkeeper: boolean,
  forDecision = false,
): number {
  let clearance = openAt;
  for (const i of activePlayerIndices(state)) {
    const opponent = requirePlayerAt(state, i);
    if (opponent.team === team || !isAvailable(state, i)) continue;
    if (forDecision && isShadowMarked(state, i)) continue;
    if (!includeGoalkeeper && opponent.def.role === 'GK') continue;
    clearance = Math.min(
      clearance,
      interiorSegmentDistance(opponent.pos, from, to),
    );
  }
  return clearance;
}

/** 0..1 proxy for how much of the goal face is usable without transcendental math. */
function goalFacingQuality(pos: Vec, goalY: number): number {
  const depth = Math.abs(pos.y - goalY);
  const outsidePost = Math.max(0, Math.abs(pos.x - GOAL_CENTER_X) - GOAL_W / 2);
  if (depth === 0) return outsidePost === 0 ? 1 : 0.2;
  return clamp(depth / (depth + outsidePost * 2), 0.2, 1);
}

/** Average clearance across left, centre and right aim corridors. */
function shotCorridorQuality(state: MatchState, by: number, pos: Vec): number {
  const shooter = requirePlayerAt(state, by);
  const goalY = goalYFor(shooter.team);
  const aimXs = [
    GOAL_CENTER_X - GOAL_W / 2 + 100,
    GOAL_CENTER_X,
    GOAL_CENTER_X + GOAL_W / 2 - 100,
  ];
  let total = 0;
  for (const x of aimXs) {
    total += laneClearance(
      state,
      shooter.team,
      pos,
      { x, y: goalY },
      OPEN_SHOT_CLEARANCE,
      false,
      true,
    );
  }
  const openFraction = total / (aimXs.length * OPEN_SHOT_CLEARANCE);
  return 0.2 + openFraction * 0.8; // obstruction discourages; it never pretends physical blocks already exist
}

function hasFrontalPressure(
  state: MatchState,
  by: number,
  pos: Vec,
  forDecision = false,
): boolean {
  const shooter = requirePlayerAt(state, by);
  const goal = { x: GOAL_CENTER_X, y: goalYFor(shooter.team) };
  const goalDx = goal.x - pos.x;
  const goalDy = goal.y - pos.y;
  for (const i of activePlayerIndices(state)) {
    const opponent = requirePlayerAt(state, i);
    if (opponent.team === shooter.team || !isAvailable(state, i)) continue;
    if (forDecision && isShadowMarked(state, i)) continue;
    if (dist2(opponent.pos, pos) >= 400 * 400) continue;
    const opponentDx = opponent.pos.x - pos.x;
    const opponentDy = opponent.pos.y - pos.y;
    if (goalDx * opponentDx + goalDy * opponentDy > 0) return true;
  }
  return false;
}

function shadowFrontalPressure(
  state: MatchState,
  by: number,
  pos: Vec,
): number {
  const shooter = requirePlayerAt(state, by);
  const goal = { x: GOAL_CENTER_X, y: goalYFor(shooter.team) };
  const goalDx = goal.x - pos.x;
  const goalDy = goal.y - pos.y;
  for (const i of activePlayerIndices(state)) {
    const opponent = requirePlayerAt(state, i);
    if (
      opponent.team === shooter.team ||
      !isAvailable(state, i) ||
      !isShadowMarked(state, i)
    )
      continue;
    if (dist2(opponent.pos, pos) >= 400 * 400) continue;
    const opponentDx = opponent.pos.x - pos.x;
    const opponentDy = opponent.pos.y - pos.y;
    if (goalDx * opponentDx + goalDy * opponentDy > 0) return i;
  }
  return -1;
}

/** Aim error shared by decision quality and the actual launch. */
function shotSpreadAt(
  state: MatchState,
  by: number,
  pos: Vec,
  distance: number,
  forDecision = false,
): number {
  const shooter = requirePlayerAt(state, by);
  const defendingTeam: 0 | 1 = shooter.team === 0 ? 1 : 0;
  const keeperIdx = defendingTeam === 0 ? 0 : 11;
  const executionShare = contestProbability(
    executionStat(state, by, 'sho'),
    executionStat(state, keeperIdx, 'ref'),
  );
  const closeRangeSpread = Math.round(1200 - 700 * executionShare);
  const base = closeRangeSpread + Math.round(distance / 4);
  const pressureSpread = hasFrontalPressure(state, by, pos, forDecision)
    ? Math.round(base * 1.25)
    : base;
  const finish = powerFinishShotProfile(state, by);
  if (finish === null) return pressureSpread;
  const challengeHeadroom = poweredFinishChallengeHeadroom(state, by);
  const effectiveAimScale = 1 - (1 - finish.aimScale) * challengeHeadroom;
  return Math.round(pressureSpread * effectiveAimScale);
}

/** A power supplies an edge against the keeper in front of it, not a second
 * linear rating stack on a shooter who already overwhelms that keeper. Equal
 * elite players keep the full authored finish; only a large existing SHO-v-REF
 * advantage saturates it. */
function poweredFinishChallengeHeadroom(state: MatchState, by: number): number {
  const shooter = requirePlayerAt(state, by);
  const defendingTeam: 0 | 1 = shooter.team === 0 ? 1 : 0;
  const keeperIdx = defendingTeam === 0 ? 0 : 11;
  const advantageD64 =
    executionStat(state, by, 'sho') - executionStat(state, keeperIdx, 'ref');
  return clamp(
    (POWER_FINISH_SATURATED_ADVANTAGE_D64 - advantageD64) /
      (POWER_FINISH_SATURATED_ADVANTAGE_D64 - POWER_FINISH_FULL_ADVANTAGE_D64),
    0,
    1,
  );
}

interface ShotStrength {
  readonly d64: number;
  readonly displayPower: number;
}

/** Fixed-point shot execution plus a bounded display projection for events/Resolve. */
function shotStrengthAt(
  state: MatchState,
  by: number,
  distance: number,
): ShotStrength {
  const d64 =
    executionStat(state, by, 'sho') +
    shotBonus(state, by).d64Mod -
    Math.round((distance * SHOT_DISTANCE_D64_PER_200) / 200);
  return {
    d64,
    displayPower: clamp(
      Math.round(
        SHOT_DISPLAY_BASELINE + (d64 - ratingD64(SHOT_DISPLAY_BASELINE)) / 64,
      ),
      1,
      999,
    ),
  };
}

/**
 * Single shot/save probability seam for both the shooter's expected-value
 * decision and the ball's actual arrival. REF is fully symmetric in log-ratio
 * space; roster values, not a hidden divisor, now control keeper dominance.
 */
export function keeperSaveProbability(
  state: MatchState,
  keeperIdx: number,
  shotStrengthD64: number,
  keeperPowerBonus: D64Modifier = NO_D64_MOD,
): number {
  const keeper = requirePlayerAt(state, keeperIdx);
  return contestProbability(
    contestStat(state, keeperIdx, 'ref') +
      resolveD64(state.resolve[keeper.team]) +
      keeperPowerBonus.d64Mod,
    shotStrengthD64,
    SHOT_KEEPER_MOD_D64,
  );
}

/** Approximate probability that a shot from `pos` scores under the current shot/save model. */
function shotExpectedValue(state: MatchState, by: number, pos: Vec): number {
  const shooter = requirePlayerAt(state, by);
  const goal = { x: GOAL_CENTER_X, y: goalYFor(shooter.team) };
  const distance = dist(pos, goal);
  const spread = shotSpreadAt(state, by, pos, distance, true);
  const onTargetProbability = Math.min(1, GOAL_W / 2 / spread);
  const shotStrength = shotStrengthAt(state, by, distance);
  const defendingTeam: 0 | 1 = shooter.team === 0 ? 1 : 0;
  const keeperIdx = defendingTeam === 0 ? 0 : 11;
  const saveProbability = isAvailable(state, keeperIdx)
    ? keeperSaveProbability(state, keeperIdx, shotStrength.d64)
    : 0;
  // The current launch model loses too little quality with distance, so decision
  // quality supplies a smooth 17-42m falloff rather than another hard range cliff.
  const distanceQuality = clamp((5000 - distance) / 2800, 0, 1);
  return (
    onTargetProbability *
    (1 - saveProbability) *
    distanceQuality *
    goalFacingQuality(pos, goal.y) *
    shotCorridorQuality(state, by, pos)
  );
}

/** Future scoring value of retaining the ball at `pos` over the next few seconds. */
function positionThreat(state: MatchState, by: number, pos: Vec): number {
  const player = requirePlayerAt(state, by);
  const progress = clamp(
    (player.team === 0 ? PITCH_H - pos.y : pos.y) / PITCH_H,
    0,
    1,
  );
  const progressCurve = progress * progress;
  const centrality = clamp(
    1 - Math.abs(pos.x - GOAL_CENTER_X) / GOAL_CENTER_X,
    0,
    1,
  );
  const defendingTeam: 0 | 1 = player.team === 0 ? 1 : 0;
  const keeperIdx = defendingTeam === 0 ? 0 : 11;
  const skillScale =
    0.16 +
    0.3 *
      contestProbability(
        executionStat(state, by, 'sho'),
        executionStat(state, keeperIdx, 'ref'),
      );
  const buildupValue = progressCurve * skillScale * (0.75 + centrality * 0.25);
  return Math.max(shotExpectedValue(state, by, pos), buildupValue);
}

function opponentTurnoverCost(state: MatchState, opponent: number): number {
  if (opponent === -1) return 0.04;
  return (
    0.04 +
    positionThreat(state, opponent, requirePlayerAt(state, opponent).pos) * 0.5
  );
}

/** Expected completion and the exact contest input used if this pass launches. */
function passContestInputs(
  state: MatchState,
  from: number,
  to: number,
  forDecision = false,
  receiverPos?: Vec,
): { probability: number; interceptor: number; interceptStat: number } {
  const passer = requirePlayerAt(state, from);
  const receiver = requirePlayerAt(state, to);
  const targetPos = receiverPos ?? receiver.pos;
  let interceptor = -1;
  let interceptorDistance = Infinity;
  for (const idx of activePlayerIndices(state)) {
    const opponent = requirePlayerAt(state, idx);
    if (
      opponent.team === passer.team ||
      !isAvailable(state, idx) ||
      (forDecision && isShadowMarked(state, idx))
    )
      continue;
    const distance = dist2(opponent.pos, targetPos);
    if (distance < interceptorDistance) {
      interceptor = idx;
      interceptorDistance = distance;
    }
  }
  if (interceptor === -1)
    return { probability: 1, interceptor, interceptStat: 1 };

  const marker = requirePlayerAt(state, interceptor);
  const receiverSpace = dist(marker.pos, targetPos);
  const clearance = laneClearance(
    state,
    passer.team,
    passer.pos,
    targetPos,
    OPEN_LANE_CLEARANCE,
    true,
    forDecision,
  );
  // Open receivers and clear lanes reduce the defender's effective interception
  // pressure. This aligns the launch contest with the opportunity model until
  // the approved emergent pass-flight resolver replaces pre-rolled outcomes.
  const spaceRelief = clamp(Math.trunc((receiverSpace - 300) / 80), 0, 15);
  const laneRelief = clamp(Math.trunc((clearance - 200) / 80), 0, 8);
  const hidden = isShadowMarked(state, interceptor);
  const interceptStat =
    contestStat(state, interceptor, 'def') +
    defenseBonus(state, interceptor).d64Mod -
    (hidden ? 0 : (spaceRelief + laneRelief) * GEOMETRY_RELIEF_D64);
  return {
    probability: contestProbability(
      contestStat(state, from, 'pas'),
      interceptStat,
      PASS_CONTEST_MOD_D64,
    ),
    interceptor,
    interceptStat,
  };
}

function bestPassOption(state: MatchState, from: number): PassOption | null {
  const passer = requirePlayerAt(state, from);
  let best: PassOption | null = null;
  for (const i of activePlayerIndices(state)) {
    const mate = requirePlayerAt(state, i);
    if (i === from || mate.team !== passer.team || !isAvailable(state, i))
      continue;
    const distance2 = dist2(mate.pos, passer.pos);
    if (distance2 < 400 * 400 || distance2 > 3500 * 3500) continue;

    const inputs = passContestInputs(state, from, i, true);
    const value =
      inputs.probability * positionThreat(state, i, mate.pos) -
      (1 - inputs.probability) *
        opponentTurnoverCost(state, inputs.interceptor);
    if (best === null || value > best.value) {
      best = {
        to: i,
        value,
        interceptor: inputs.interceptor,
        interceptStat: inputs.interceptStat,
      };
    }
  }
  return best;
}

function carryExpectedValue(state: MatchState, carrierIdx: number): number {
  const carrier = requirePlayerAt(state, carrierIdx);
  const goal = { x: GOAL_CENTER_X, y: goalYFor(carrier.team) };
  const dribbleSpeed = Math.round(
    speedFor(state, carrierIdx) * CARRIER_SPEED_SCALE,
  );
  const next = moveToward(carrier.pos, goal, dribbleSpeed * DECISION_TICKS);
  const markerIdx = nearestVisibleOpponent(state, carrierIdx);
  if (markerIdx === -1) return positionThreat(state, carrierIdx, next);

  const marker = requirePlayerAt(state, markerIdx);
  const markerDistance = dist(marker.pos, carrier.pos);
  const goalDx = goal.x - carrier.pos.x;
  const goalDy = goal.y - carrier.pos.y;
  const markerDx = marker.pos.x - carrier.pos.x;
  const markerDy = marker.pos.y - carrier.pos.y;
  const goalSide = goalDx * markerDx + goalDy * markerDy > 0;
  const proximity = clamp((450 - markerDistance) / 250, 0, 1);
  const directionScale = goalSide ? 1 : 0.25;
  const tackleWin = contestProbability(
    contestStat(state, markerIdx, 'def') +
      defenseBonus(state, markerIdx).d64Mod,
    contestStat(state, carrierIdx, 'tec'),
    -dribbleBonus(state, carrierIdx).d64Mod,
  );
  const retainProbability = 1 - tackleWin * proximity * directionScale;
  // Carrying must spend another decision window before cashing in the better
  // position; discount that delay or an unpressured carrier rationally dribbles
  // all the way to the goal line instead of ever taking a good shot.
  return (
    retainProbability *
      positionThreat(state, carrierIdx, next) *
      CARRY_TIME_DISCOUNT -
    (1 - retainProbability) * opponentTurnoverCost(state, markerIdx)
  );
}

/** Pure, deterministic carrier choice: all actions share expected attacking value. */
export function attackingDecision(
  state: MatchState,
  carrierIdx: number,
): AttackingDecision {
  const carrier = requirePlayerAt(state, carrierIdx);
  const goal = { x: GOAL_CENTER_X, y: goalYFor(carrier.team) };
  const mentality = state.tactics[carrier.team].mentality;
  const shotBias =
    mentality === 'ATTACK' ? 1.25 : mentality === 'PROTECT' ? 0.82 : 1;
  const carryBias =
    mentality === 'ATTACK' ? 1.08 : mentality === 'PROTECT' ? 0.86 : 1;
  const passBias =
    mentality === 'ATTACK' ? 0.94 : mentality === 'PROTECT' ? 1.14 : 1;
  const shot =
    (carrier.def.role === 'GK' || phaseRunPreventsShot(state, carrierIdx)
      ? 0
      : shotExpectedValue(state, carrierIdx, carrier.pos)) * shotBias;
  const carry = carryExpectedValue(state, carrierIdx) * carryBias;
  const passOption = bestPassOption(state, carrierIdx);
  const pass = passOption === null ? -1 : passOption.value * passBias;
  const values = { shot, carry, pass };
  const gravityTarget = gravityPriorityTarget(state, carrierIdx);
  if (gravityTarget !== -1) return { kind: 'pass', to: gravityTarget, values };
  const corridorQuality = shotCorridorQuality(state, carrierIdx, carrier.pos);
  const obviousShot =
    carrier.def.role !== 'GK' &&
    !phaseRunPreventsShot(state, carrierIdx) &&
    dist(carrier.pos, goal) <= OBVIOUS_SHOT_DISTANCE &&
    goalFacingQuality(carrier.pos, goal.y) >= 0.6 &&
    corridorQuality >= 0.72;
  const inAttackingHalf =
    carrier.team === 0
      ? carrier.pos.y < PITCH_H / 2
      : carrier.pos.y > PITCH_H / 2;
  const speedBreakActive =
    inAttackingHalf &&
    carrier.powerState.kind === 'active' &&
    carrier.def.power === 'SUPER_SPEED';
  // Airborne shots made the old 26 m / 0.65 lane trigger cash a well-timed
  // burst into low-quality attempts. Carry to 22 m and a cleaner lane first.
  const speedBreakShot =
    speedBreakActive &&
    dist(carrier.pos, goal) <= 2200 &&
    goalFacingQuality(carrier.pos, goal.y) >= 0.6 &&
    corridorQuality >= 0.7;

  if (
    carrier.powerState.kind === 'winding' &&
    (carrier.def.power === 'THUNDER_STRIKE' ||
      carrier.def.power === 'BLINK_RUN' ||
      carrier.def.power === 'FIRE_TORCH' ||
      carrier.def.power === 'PHASE_RUN')
  ) {
    return { kind: 'carry', values };
  }
  if (
    carrier.powerState.kind === 'active' &&
    carrier.powerState.commitment === 'THUNDER_SHOT'
  ) {
    const ready =
      dist(carrier.pos, goal) <= 3200 &&
      goalFacingQuality(carrier.pos, goal.y) >= 0.55 &&
      corridorQuality >= 0.68 &&
      shot >= MIN_SHOT_VALUE;
    return ready ? { kind: 'shoot', values } : { kind: 'carry', values };
  }
  if (
    carrier.powerState.kind === 'active' &&
    carrier.powerState.commitment === 'POWER_OUTLET' &&
    carrier.powerState.targetIdx !== undefined &&
    isAvailable(state, carrier.powerState.targetIdx) &&
    requirePlayerAt(state, carrier.powerState.targetIdx).team ===
      carrier.team &&
    (carrier.powerState.targetPlayerId === undefined ||
      requirePlayerAt(state, carrier.powerState.targetIdx).def.id ===
        carrier.powerState.targetPlayerId)
  ) {
    return { kind: 'pass', to: carrier.powerState.targetIdx, values };
  }
  if (
    carrier.powerState.kind === 'active' &&
    (carrier.powerState.commitment === 'BLINK_ACTION' ||
      carrier.powerState.commitment === 'FIRE_RUN' ||
      carrier.powerState.commitment === 'PHASE_ACTION')
  ) {
    const readyDistance =
      carrier.powerState.commitment === 'FIRE_RUN' ? 3000 : 2400;
    const ready =
      dist(carrier.pos, goal) <= readyDistance &&
      goalFacingQuality(carrier.pos, goal.y) >= 0.55 &&
      corridorQuality >= 0.65 &&
      shot >= MIN_SHOT_VALUE;
    return ready ? { kind: 'shoot', values } : { kind: 'carry', values };
  }

  if (obviousShot || speedBreakShot) {
    return { kind: 'shoot', values };
  }
  // A Super Speed carrier owns the break without being forced into the generic
  // 24 m finish used by Blink, Fire and Phase. Its authored 22 m lane gate below
  // keeps elite speedsters from manufacturing an extra early shot while the
  // SPEED_ACTION commitment still spends the power on that one finish.
  if (
    inAttackingHalf &&
    (carrier.powerState.kind === 'winding' ||
      carrier.powerState.kind === 'active') &&
    carrier.def.power === 'SUPER_SPEED'
  ) {
    return { kind: 'carry', values };
  }
  if (
    shot >= MIN_SHOT_VALUE &&
    shot + SHOT_FUN_BIAS * corridorQuality >= Math.max(carry, pass)
  ) {
    return { kind: 'shoot', values };
  }
  if (passOption !== null && pass > carry + PASS_SWITCH_MARGIN) {
    return { kind: 'pass', to: passOption.to, values };
  }
  return { kind: 'carry', values };
}

export function possessionTick(state: MatchState): void {
  const b = state.ball;

  if (b.kind === 'loose') {
    b.pos = { x: b.pos.x + b.vel.x, y: b.pos.y + b.vel.y };
    b.vel = { x: Math.trunc(b.vel.x * 0.8), y: Math.trunc(b.vel.y * 0.8) };
    advanceFlightHeight(b);
    if (b.z > BALL_CONTROL_HEIGHT) return;
    // The nearest player wins a loose ball. Taking the first index inside the
    // radius handed team 0 (indices 0-10) every contested loose ball, and within
    // a team gave the keeper and defenders priority over the forwards — a
    // systematic home advantage in an otherwise symmetric engine. Ties fall to
    // the lower index so recovery stays deterministic.
    let recoveredBy = -1;
    let nearest = 150 * 150;
    for (const i of activePlayerIndices(state)) {
      if (!isAvailable(state, i)) continue;
      const p = requirePlayerAt(state, i);
      const distance = dist2(p.pos, b.pos);
      if (distance < nearest) {
        nearest = distance;
        recoveredBy = i;
      }
    }
    if (recoveredBy !== -1) {
      state.ball = { kind: 'held', by: recoveredBy };
      addGauge(state, recoveredBy, LOOSE_BALL_GAUGE);
    }
    return;
  }

  if (b.kind === 'pass') {
    const targetIdx = b.willSucceed
      ? b.to
      : b.interceptor !== -1
        ? b.interceptor
        : b.to;
    const targetPlayer = playerAt(state, targetIdx);
    const target =
      b.willSucceed && b.arrivalPos !== undefined
        ? b.arrivalPos
        : (targetPlayer?.pos ?? b.pos);
    b.pos = moveToward(b.pos, target, b.speed);
    advanceFlightHeight(b);
    if (dist2(b.pos, target) < 150 * 150) {
      // The 2.5D control gate is simulation truth, not a render trick: a
      // lofted ball can visibly pass over a player's pitch-plane coordinate.
      if (b.z > BALL_CONTROL_HEIGHT) return;
      // A recipient (or interceptor) knocked out mid-flight can't receive the ball
      // unconscious (the audit's phantom-pass bug) — it goes loose at the arrival
      // point instead, same as a failed pass with no interceptor.
      const shadowChallenger =
        b.interceptor !== -1 &&
        isAvailable(state, b.interceptor) &&
        isShadowMarked(state, b.interceptor)
          ? b.interceptor
          : -1;
      if (shadowChallenger !== -1) consumeShadowMark(state, shadowChallenger);
      if (b.looseOnArrival) {
        state.ball = {
          kind: 'loose',
          pos: { ...b.pos },
          vel:
            b.deflectionVel === undefined
              ? { x: 0, y: 0 }
              : { ...b.deflectionVel },
          z: b.z,
          vz: b.vz,
        };
      } else if (
        (b.willSucceed || b.interceptor !== -1) &&
        isAvailable(state, targetIdx) &&
        (b.powerInterceptorPlayerId === undefined ||
          requirePlayerAt(state, targetIdx).def.id ===
            b.powerInterceptorPlayerId) &&
        (b.gustPuntReceiverPlayerId === undefined ||
          requirePlayerAt(state, targetIdx).def.id ===
            b.gustPuntReceiverPlayerId) &&
        (b.decoyReceiverPlayerId === undefined ||
          requirePlayerAt(state, targetIdx).def.id === b.decoyReceiverPlayerId)
      ) {
        if (
          b.decoyReceiverPlayerId !== undefined &&
          playerAt(state, targetIdx) === undefined
        ) {
          state.ball = {
            kind: 'loose',
            pos: { ...b.pos },
            vel: { x: 0, y: 0 },
            z: b.z,
            vz: b.vz,
          };
          return;
        }
        if (b.gustPunt && b.arrivalPos !== undefined) {
          requirePlayerAt(state, targetIdx).pos = { ...b.arrivalPos };
        }
        state.ball = b.gustRedirect
          ? {
              kind: 'held',
              by: targetIdx,
              caught: true,
              releaseAfterTick: state.tick + 3,
              gustPunt: true,
              gustHeroIdx: b.gustHeroIdx,
              gustGrade: b.gustGrade,
            }
          : { kind: 'held', by: targetIdx };
        // Reading and cutting out a pass is a midfielder's decisive act, the way
        // a shot is a forward's. Paying it the same 2 Heat as simply being passed
        // to left MID carriers permanently short of ZONE_HEAT_THRESHOLD.
        const intercepted = !b.willSucceed && b.interceptor === targetIdx;
        addGauge(
          state,
          targetIdx,
          intercepted ? INTERCEPTION_GAUGE : PASS_RECEIVED_GAUGE,
        );
        const outlet = requirePlayerAt(state, targetIdx).powerState;
        if (
          intercepted &&
          outlet.kind === 'active' &&
          outlet.commitment === 'POWER_OUTLET' &&
          outlet.targetIdx !== undefined &&
          isAvailable(state, outlet.targetIdx) &&
          (outlet.targetPlayerId === undefined ||
            requirePlayerAt(state, outlet.targetIdx).def.id ===
              outlet.targetPlayerId)
        ) {
          emit(state, {
            t: state.tick,
            kind: 'POWER_IMPACT',
            player: targetIdx,
            power: 'FUTURE_SIGHT',
            target: b.to,
          });
          launchPass(state, targetIdx, outlet.targetIdx, true, true);
          finishMomentPower(state, targetIdx);
        }
      } else {
        state.ball = {
          kind: 'loose',
          pos: { ...b.pos },
          vel: { x: 0, y: 0 },
          z: b.z,
          vz: b.vz,
        };
      }
    }
    return;
  }

  if (b.kind !== 'held') return; // 'shot' handled in Task 10
  if (!isAvailable(state, b.by)) return; // unconscious/sliding/recovering carriers do not act
  if (powerActionBlocked(state, b.by)) return;
  if (b.releaseAfterTick !== undefined) {
    if (state.tick < b.releaseAfterTick) return;
    if (b.gustPunt) {
      const destination = gustPuntDestination(state, b.by, b.gustGrade);
      if (destination !== null) {
        emit(state, {
          t: state.tick,
          kind: 'GUST_PUNT',
          player: b.gustHeroIdx ?? b.by,
          from: b.by,
          to: destination.receiver,
        });
        addGauge(state, b.by, GOALKEEPER_DISTRIBUTION_GAUGE);
        launchPass(
          state,
          b.by,
          destination.receiver,
          true,
          true,
          true,
          b.gustGrade,
          destination.pos,
        );
      } else state.ball = { kind: 'held', by: b.by };
      return;
    }
    const option = bestPassOption(state, b.by);
    if (option !== null) {
      addGauge(state, b.by, GOALKEEPER_DISTRIBUTION_GAUGE);
      launchPass(state, b.by, option.to, true);
    } else state.ball = { kind: 'held', by: b.by };
    return;
  }
  if (state.tick % 5 !== 0) return;

  const carrierIdx = b.by;
  const carrier = requirePlayerAt(state, carrierIdx);
  const goal = { x: GOAL_CENTER_X, y: goalYFor(carrier.team) };
  const commitment =
    carrier.powerState.kind === 'active'
      ? carrier.powerState.commitment
      : undefined;
  const decision = attackingDecision(state, carrierIdx);

  if (decision.kind === 'shoot') {
    consumePortalProtection(state, carrierIdx);
    attemptShot(state, carrierIdx, dist(carrier.pos, goal));
    consumeDecoyAction(state, carrierIdx);
    if (
      commitment === 'SPEED_ACTION' ||
      commitment === 'THUNDER_SHOT' ||
      commitment === 'BLINK_ACTION' ||
      commitment === 'FIRE_RUN' ||
      commitment === 'PHASE_ACTION' ||
      commitment === 'POWER_OUTLET'
    ) {
      finishMomentPower(state, carrierIdx);
    } else clearPowerCommitment(state, carrierIdx);
    return;
  }

  if (decision.kind === 'pass') {
    launchPass(state, carrierIdx, decision.to, false);
    consumeDecoyAction(state, carrierIdx);
    if (
      commitment === 'POWER_OUTLET' ||
      commitment === 'SPEED_ACTION' ||
      commitment === 'THUNDER_SHOT' ||
      commitment === 'BLINK_ACTION' ||
      commitment === 'FIRE_RUN' ||
      commitment === 'PHASE_ACTION'
    ) {
      finishMomentPower(state, carrierIdx);
    } else clearPowerCommitment(state, carrierIdx);
    return;
  }
  consumeDecoyAction(state, carrierIdx);
  if (commitment === 'POWER_OUTLET') {
    finishMomentPower(state, carrierIdx);
  } else if (
    commitment !== 'SPEED_ACTION' &&
    commitment !== 'THUNDER_SHOT' &&
    commitment !== 'BLINK_ACTION' &&
    commitment !== 'FIRE_RUN' &&
    commitment !== 'PHASE_ACTION'
  ) {
    clearPowerCommitment(state, carrierIdx);
  }
}

export function launchPass(
  state: MatchState,
  from: number,
  to: number,
  lofted: boolean,
  guaranteed = false,
  gustPunt = false,
  gustGrade?: number,
  authoredArrivalPos?: Vec,
): void {
  const passer = requirePlayerAt(state, from);
  const controlledOutlet =
    passer.powerState.kind === 'active' &&
    passer.powerState.commitment === 'POWER_OUTLET';
  const authoredGuaranteed = guaranteed || controlledOutlet;
  const receiver = requirePlayerAt(state, to);
  const cloneTarget = to >= BASE_PLAYER_COUNT ? receiver : null;
  const intendedTarget = authoredArrivalPos ?? receiver.pos;
  const inputs = passContestInputs(state, from, to, false, intendedTarget);
  const rolledOk = authoredGuaranteed
    ? true
    : contest(
        state.rng,
        contestStat(state, from, 'pas'),
        inputs.interceptStat,
        PASS_CONTEST_MOD_D64,
      );
  consumePortalProtection(state, from);
  const gustRedirect =
    authoredGuaranteed || !rolledOk
      ? null
      : gustDisruptsPass(state, passer.team, from);
  const predictedInterceptor =
    authoredGuaranteed || !rolledOk || gustRedirect !== null
      ? -1
      : futureSightInterceptor(state, passer.team, to);
  const ok =
    authoredGuaranteed ||
    (gustRedirect === null && predictedInterceptor === -1 && rolledOk);
  const interceptor =
    authoredGuaranteed || gustRedirect !== null
      ? -1
      : predictedInterceptor === -1
        ? inputs.interceptor
        : predictedInterceptor;
  const ordinaryLoose =
    !ok &&
    gustRedirect === null &&
    predictedInterceptor === -1 &&
    interceptor !== -1 &&
    state.rng() < FAILED_PASS_LOOSE_CHANCE;
  const looseOnArrival =
    gustRedirect === null && !ok && (interceptor === -1 || ordinaryLoose);
  const passTo = gustRedirect?.goalkeeper ?? to;
  const targetIdx =
    gustRedirect !== null
      ? gustRedirect.goalkeeper
      : ok
        ? to
        : interceptor !== -1
          ? interceptor
          : to;
  const target =
    authoredArrivalPos !== undefined && gustPunt && ok
      ? authoredArrivalPos
      : requirePlayerAt(state, targetIdx).pos;
  const horizontalDistance = dist(passer.pos, target);
  const flightTicks = lofted
    ? Math.max(
        GOALKEEPER_DISTRIBUTION_FLIGHT_TICKS,
        Math.ceil(horizontalDistance / PASS_SPEED),
      )
    : Math.max(1, Math.ceil(horizontalDistance / PASS_SPEED));
  const speed = lofted
    ? Math.max(1, Math.ceil(horizontalDistance / flightTicks))
    : PASS_SPEED;
  emit(state, {
    t: state.tick,
    kind: 'PASS',
    from,
    to,
    ok: ok && gustRedirect === null,
  });
  state.ball = {
    kind: 'pass',
    pos: { ...passer.pos },
    from,
    to: passTo,
    willSucceed: gustRedirect !== null || ok,
    interceptor,
    z: 0,
    vz: lofted ? verticalLaunchSpeed(flightTicks, 0) : 0,
    speed,
    looseOnArrival,
    deflectionVel: looseOnArrival
      ? passDeflectionVelocity(passer.pos, target, from, to, state.tick)
      : undefined,
    ...(gustRedirect === null
      ? {}
      : {
          gustRedirect: true as const,
          gustHeroIdx: gustRedirect.hero,
          gustGrade: gustRedirect.grade,
        }),
    ...(gustPunt ? { gustPunt: true as const, gustGrade } : {}),
    ...(cloneTarget !== null && ok && gustRedirect === null
      ? {
          decoyReceiverPlayerId: cloneTarget.def.id,
        }
      : {}),
    ...(authoredArrivalPos !== undefined && gustPunt && ok
      ? {
          arrivalPos: { ...authoredArrivalPos },
          gustPuntReceiverPlayerId: receiver.def.id,
        }
      : {}),
    ...(predictedInterceptor === -1
      ? {}
      : {
          powerInterceptorPlayerId: requirePlayerAt(state, predictedInterceptor)
            .def.id,
        }),
  };
}

function passDeflectionVelocity(
  from: Vec,
  target: Vec,
  fromIdx: number,
  toIdx: number,
  tick: number,
): Vec {
  const dx = target.x - from.x;
  const dy = target.y - from.y;
  const length = Math.max(1, Math.sqrt(dx * dx + dy * dy));
  const side = (fromIdx + toIdx + tick) % 2 === 0 ? 1 : -1;
  return {
    x: Math.round((-dy / length) * FAILED_PASS_DEFLECTION_SPEED * side),
    y: Math.round((dx / length) * FAILED_PASS_DEFLECTION_SPEED * side),
  };
}

function inOwnDefensiveThird(team: 0 | 1, pos: Vec): boolean {
  return team === 0 ? pos.y >= (PITCH_H * 2) / 3 : pos.y <= PITCH_H / 3;
}

function isGoalSideOfCarrier(tackler: SimPlayer, carrier: SimPlayer): boolean {
  const carrierAttackY = carrier.team === 0 ? -1 : 1;
  return (tackler.pos.y - carrier.pos.y) * carrierAttackY >= 0;
}

/**
 * True while one of the carrier's own markers is still on the grass near him.
 *
 * This is the authored breakaway beat, and the only situation in which a
 * midfielder may commit to a slide. It needs no state of its own: a floored
 * player is exactly one with `tackleRecoveryUntil` in the future, so the
 * permission window IS the fall window (and a defender still down from his own
 * slide opens it too, which is the same picture).
 */
/**
 * 80% is the preferred band, not a cliff. Below it, the launch range and
 * opportunity narrows; below 50%, only a shorter emergency challenge in the
 * defender's own third is allowed. Under 30%, a player cannot launch at all.
 */
function slideLaunchRange(
  state: MatchState,
  tacklerIdx: number,
  carrierIdx: number,
): number {
  const tackler = requirePlayerAt(state, tacklerIdx);
  // An 8-11 metre slide is a spectacular committed defender tool. Midfielders
  // and forwards keep pressing into standing-tackle range instead of repeatedly
  // abandoning the team shape with the exaggerated long lunge.
  if (tackler.condition < SLIDE_TACKLE_CONDITION_FLOOR) return 0;
  const ownThird = inOwnDefensiveThird(
    tackler.team,
    requirePlayerAt(state, carrierIdx).pos,
  );
  if (tackler.def.role !== 'DEF') return 0;
  if (!isGoalSideOfCarrier(tackler, requirePlayerAt(state, carrierIdx)))
    return 0;
  if (tackler.condition >= SLIDE_TACKLE_PREFERRED_CONDITION)
    return SLIDE_TACKLE_MAX_RANGE;
  if (tackler.condition >= 50) return 1000;
  return ownThird ? 900 : 0;
}

function finishSlide(
  state: MatchState,
  tacklerIdx: number,
  won: boolean,
  contact: boolean,
): void {
  const tackler = requirePlayerAt(state, tacklerIdx);
  const slide = tackler.slideTackle;
  if (!slide) return;
  const targetIdx = slide.targetIdx;
  tackler.slideTackle = undefined;
  tackler.tackleRecoveryUntil =
    state.tick +
    (won ? SLIDE_SUCCESS_RECOVERY_TICKS : SLIDE_MISS_RECOVERY_TICKS);
  emit(state, {
    t: state.tick,
    kind: 'TACKLE',
    by: tacklerIdx,
    on: targetIdx,
    won,
    style: 'slide',
    contact,
  });
  if (won) {
    state.ball = { kind: 'held', by: tacklerIdx };
    addGauge(state, tacklerIdx, TACKLE_WON_GAUGE);
    interruptWindup(state, targetIdx);
  }
}

/** Closest approach of two moving points over the same tick, expressed as 0..1. */
function sweptContactFraction(
  tacklerFrom: Vec,
  tacklerTo: Vec,
  targetFrom: Vec,
  targetTo: Vec,
): number | null {
  const startX = tacklerFrom.x - targetFrom.x;
  const startY = tacklerFrom.y - targetFrom.y;
  const velocityX = tacklerTo.x - tacklerFrom.x - (targetTo.x - targetFrom.x);
  const velocityY = tacklerTo.y - tacklerFrom.y - (targetTo.y - targetFrom.y);
  const speed2 = velocityX * velocityX + velocityY * velocityY;
  const t =
    speed2 === 0
      ? 0
      : clamp(-(startX * velocityX + startY * velocityY) / speed2, 0, 1);
  const closestX = startX + velocityX * t;
  const closestY = startY + velocityY * t;
  return closestX * closestX + closestY * closestY <=
    SLIDE_CONTACT_RANGE * SLIDE_CONTACT_RANGE
    ? t
    : null;
}

/** Returns true while a committed slide owns this tick's challenge slot. */
function resolveActiveSlide(state: MatchState): boolean {
  const tacklerIdx =
    activePlayerIndices(state).find(
      (index) => requirePlayerAt(state, index).slideTackle !== undefined,
    ) ?? -1;
  if (tacklerIdx === -1) return false;

  const tackler = requirePlayerAt(state, tacklerIdx);
  const slide = tackler.slideTackle!;
  const carrierStillTargeted =
    state.ball.kind === 'held' &&
    state.ball.by === slide.targetIdx &&
    isConscious(state, slide.targetIdx);
  // The slide's target may be a Decoy Double clone that expired mid-slide, so this
  // lookup must not throw — requiring the entity here killed the whole match with
  // `missing match player entity 22`. Every path below already tolerates a target
  // that is no longer on the pitch, so behaviour is unchanged when it is present.
  const target = playerAt(state, slide.targetIdx);
  const contactFraction =
    carrierStillTargeted && target !== undefined
      ? sweptContactFraction(
          slide.previousPos,
          tackler.pos,
          slide.targetPreviousPos,
          target.pos,
        )
      : null;
  if (carrierStillTargeted && contactFraction !== null) {
    // Stop at the collision point. The coordinate persists through recovery;
    // the renderer no longer offsets the sprite and snaps it back afterward.
    tackler.pos = {
      x: Math.round(
        slide.previousPos.x +
          (tackler.pos.x - slide.previousPos.x) * contactFraction,
      ),
      y: Math.round(
        slide.previousPos.y +
          (tackler.pos.y - slide.previousPos.y) * contactFraction,
      ),
    };
    const won = contest(
      state.rng,
      contestStat(state, tacklerIdx, 'def') +
        (slide.shadowDefenseBonus ?? defenseBonus(state, tacklerIdx).d64Mod),
      contestStat(state, slide.targetIdx, 'tec'),
      -dribbleBonus(state, slide.targetIdx).d64Mod,
    );
    finishSlide(state, tacklerIdx, won, true);
    return true;
  }

  if (state.tick >= slide.untilTick || slide.remainingDistance <= 0) {
    finishSlide(state, tacklerIdx, false, false);
    return true;
  }
  // A committed miss still travels its locked path after the target releases
  // the ball. Stopping on the release tick made far-away slides look like a
  // one-step stumble even though the launch itself came from 8-11 metres.
  if (target !== undefined) slide.targetPreviousPos = { ...target.pos };
  return true;
}

function startSlide(
  state: MatchState,
  tacklerIdx: number,
  carrierIdx: number,
  distance: number,
): void {
  const tackler = requirePlayerAt(state, tacklerIdx);
  const carrier = requirePlayerAt(state, carrierIdx);
  const dx = carrier.pos.x - tackler.pos.x;
  const dy = carrier.pos.y - tackler.pos.y;
  const magnitude = Math.sqrt(dx * dx + dy * dy);
  const direction =
    magnitude > 0
      ? { x: dx / magnitude, y: dy / magnitude }
      : { x: 0, y: carrier.team === 0 ? -1 : 1 };
  const untilTick = state.tick + SLIDE_TACKLE_TICKS;
  const shadowDefenseBonus = isShadowMarked(state, tacklerIdx)
    ? defenseBonus(state, tacklerIdx).d64Mod
    : undefined;
  tackler.slideTackle = {
    targetIdx: carrierIdx,
    startTick: state.tick,
    untilTick,
    direction,
    remainingDistance: Math.min(
      SLIDE_TACKLE_MAX_RANGE,
      Math.max(SLIDE_TACKLE_MIN_RANGE, distance + SLIDE_CONTACT_RANGE),
    ),
    previousPos: { ...tackler.pos },
    targetPreviousPos: { ...carrier.pos },
    ...(shadowDefenseBonus === undefined ? {} : { shadowDefenseBonus }),
  };
  tackler.tackleCooldownUntil = state.tick + SLIDE_TACKLE_COOLDOWN_TICKS;
  drainSlideCondition(tackler, state.tactics[tackler.team].energyUse);
  if (shadowDefenseBonus !== undefined) consumeShadowMark(state, tacklerIdx);
  addGauge(state, tacklerIdx, TACKLE_ATTEMPT_GAUGE);
  emit(state, {
    t: state.tick,
    kind: 'SLIDE_STARTED',
    by: tacklerIdx,
    on: carrierIdx,
    direction: { ...direction },
    untilTick,
  });
}

/** Bumps this defender's consecutive-failure count against one carrier and returns it. */
function recordBeatenChallenge(
  state: MatchState,
  tackler: SimPlayer,
  carrierIdx: number,
): number {
  const previous = tackler.beatenStreak;
  const continues =
    previous !== undefined &&
    previous.targetIdx === carrierIdx &&
    state.tick - previous.lastFailTick <= BEATEN_STREAK_STALE_TICKS;
  const count = continues ? previous.count + 1 : 1;
  tackler.beatenStreak = {
    targetIdx: carrierIdx,
    count,
    lastFailTick: state.tick,
  };
  return count;
}

/**
 * Does a beaten defender end up on the grass? Either the carrier outclassed him,
 * or he has now failed BEATEN_STREAK_FORCE_COUNT times running against the same
 * man — the backstop that caps a grind no matter how the rolls fall.
 *
 * `roll` is the same draw that already decided the challenge. Conditional on
 * losing it is uniform on [winProbability, 1], so the top `dropChance` slice of
 * that range is exactly a dropChance-probability event and the RNG stream is
 * unchanged from before this mechanic existed.
 *
 * Goalkeepers are exempt: `shotFlightTick` gates the save contest on
 * `isAvailable`, so a prone keeper would concede every on-target shot.
 */
function beatenDefenderDrops(
  state: MatchState,
  tackler: SimPlayer,
  carrierIdx: number,
  delta: number,
  winProbability: number,
  roll: number,
): boolean {
  const streak = recordBeatenChallenge(state, tackler, carrierIdx);
  if (tackler.def.role === 'GK') return false;
  if (streak >= BEATEN_STREAK_FORCE_COUNT) return true;
  const dropChance = clamp(
    BEATEN_DROP_BASE - BEATEN_DROP_DELTA_SCALE * delta,
    BEATEN_DROP_MIN,
    BEATEN_DROP_MAX,
  );
  return roll > 1 - (1 - winProbability) * dropChance;
}

function standingTackle(
  state: MatchState,
  tacklerIdx: number,
  carrierIdx: number,
): void {
  const tackler = requirePlayerAt(state, tacklerIdx);
  tackler.tackleCooldownUntil = state.tick + STANDING_TACKLE_COOLDOWN_TICKS;
  // Named for what they are rather than contest()'s attacker/defender, which
  // inverts confusingly in a feature about the defender going down.
  const tacklerDef =
    contestStat(state, tacklerIdx, 'def') +
    defenseBonus(state, tacklerIdx).d64Mod;
  const carrierTec = contestStat(state, carrierIdx, 'tec');
  const mod = -dribbleBonus(state, carrierIdx).d64Mod;
  const winProbability = contestProbability(tacklerDef, carrierTec, mod);
  const roll = state.rng();
  const won = roll < winProbability;
  const dropped =
    !won &&
    beatenDefenderDrops(
      state,
      tackler,
      carrierIdx,
      (tacklerDef + mod - carrierTec) / 64,
      winProbability,
      roll,
    );
  emit(state, {
    t: state.tick,
    kind: 'TACKLE',
    by: tacklerIdx,
    on: carrierIdx,
    won,
    style: 'standing',
    contact: true,
    ...(dropped ? { dropped: true as const } : {}),
  });
  consumeShadowMark(state, tacklerIdx);
  addGauge(state, tacklerIdx, TACKLE_ATTEMPT_GAUGE);
  if (won) {
    tackler.beatenStreak = undefined;
    state.ball = { kind: 'held', by: tacklerIdx };
    addGauge(state, tacklerIdx, TACKLE_WON_GAUGE);
    interruptWindup(state, carrierIdx);
    return;
  }
  if (dropped) {
    tackler.beatenStreak = undefined;
    tackler.tackleRecoveryUntil = state.tick + BEATEN_FALL_TICKS;
    tackler.tackleCooldownUntil =
      state.tick + BEATEN_FALL_TICKS + BEATEN_FALL_COOLDOWN_EXTRA;
  }
}

export function tackleTick(state: MatchState): void {
  if (resolveActiveSlide(state)) return;
  if (state.ball.kind !== 'held') return;
  const carrierIdx = state.ball.by;
  const carrier = requirePlayerAt(state, carrierIdx);
  const iceSliding =
    carrier.forcedMovement?.kind === 'ICE_SLIDE' &&
    carrier.forcedMovement.untilTick > state.tick &&
    carrier.outUntilTick <= state.tick &&
    carrier.slideTackle === undefined &&
    carrier.tackleRecoveryUntil <= state.tick &&
    (carrier.webbedUntilTick ?? 0) <= state.tick;
  if (!isAvailable(state, carrierIdx) && !iceSliding) return;
  if ((carrier.actionLockedUntilTick ?? 0) > state.tick) return;
  if ((carrier.portalProtectedUntilTick ?? 0) > state.tick) return;

  let standingIdx = -1;
  let standingD2 = STANDING_TACKLE_RANGE * STANDING_TACKLE_RANGE + 1;
  let slideIdx = -1;
  let slideDistance = 0;
  let slideD2 = SLIDE_TACKLE_MAX_RANGE * SLIDE_TACKLE_MAX_RANGE + 1;
  for (const i of activePlayerIndices(state)) {
    const defender = requirePlayerAt(state, i);
    if (defender.team === carrier.team || !isAvailable(state, i)) continue;
    if (
      state.tick < defender.tackleCooldownUntil ||
      defender.powerState.kind === 'winding'
    )
      continue;
    const d2 = dist2(defender.pos, carrier.pos);
    if (fireSuppressed(state, i, carrierIdx)) continue;
    if (
      d2 <= STANDING_TACKLE_RANGE * STANDING_TACKLE_RANGE &&
      d2 < standingD2
    ) {
      if (consumePhaseChallenge(state, carrierIdx, i)) return;
      standingIdx = i;
      standingD2 = d2;
      continue;
    }
    if (defender.def.role === 'GK') continue;
    const launchRange = slideLaunchRange(state, i, carrierIdx);
    if (
      launchRange === 0 ||
      d2 < SLIDE_TACKLE_MIN_RANGE * SLIDE_TACKLE_MIN_RANGE ||
      d2 > launchRange * launchRange ||
      d2 >= slideD2
    )
      continue;
    if (consumePhaseChallenge(state, carrierIdx, i)) return;
    slideIdx = i;
    slideD2 = d2;
    slideDistance = Math.sqrt(d2);
  }

  if (standingIdx !== -1) standingTackle(state, standingIdx, carrierIdx);
  else if (slideIdx !== -1)
    startSlide(state, slideIdx, carrierIdx, slideDistance);
}

/** Moment-based shot spikes. Thunder Strike also drains Resolve through the normal save path. */
export function shotBonus(state: MatchState, by: number): D64Modifier {
  const finish = powerFinishShotProfile(state, by);
  if (finish === null) return NO_D64_MOD;
  return {
    d64Mod: Math.round(
      finish.powerD64Mod * poweredFinishChallengeHeadroom(state, by),
    ),
  };
}

export function attemptShot(
  state: MatchState,
  by: number,
  distToGoal: number,
): void {
  const shooter = requirePlayerAt(state, by);
  consumePortalProtection(state, by);
  const gy = goalYFor(shooter.team);
  const shadowAmbusher = shadowFrontalPressure(state, by, shooter.pos);
  const spread = shotSpreadAt(state, by, shooter.pos, distToGoal);
  const targetX = Math.round(GOAL_CENTER_X + (state.rng() * 2 - 1) * spread);
  const trajectory = state.rng() < LIFTED_SHOT_CHANCE ? 'lifted' : 'driven';
  // distToGoal / 200 (Task 13 pre-flight Lever A, was / 100): the old penalty made
  // shots too easy to save; halving it targets goals/match ~2-3 and save rate ~70-80%.
  const shotStrength = shotStrengthAt(state, by, distToGoal);
  if (shadowAmbusher !== -1) consumeShadowMark(state, shadowAmbusher);
  const attributedBy = attributedPlayerIndex(state, by);
  emit(state, {
    t: state.tick,
    kind: 'SHOT',
    by: attributedBy,
    ...(attributedBy === by ? {} : { actor: by }),
    power: shotStrength.displayPower,
    trajectory,
  });
  addGauge(state, by, SHOT_GAUGE);
  const dir = gy === 0 ? -1 : 1;
  const flightTicks = Math.max(
    1,
    Math.ceil(Math.abs(gy - shooter.pos.y) / 300),
  );
  state.ball = {
    kind: 'shot',
    shooterId: state.players[attributedBy].def.id,
    pos: { ...shooter.pos },
    vel: {
      x: Math.trunc((targetX - shooter.pos.x) / Math.max(1, distToGoal / 300)),
      y: 300 * dir,
    },
    by: attributedBy,
    shotStrengthD64: shotStrength.d64,
    power: shotStrength.displayPower,
    targetX,
    z: 0,
    vz:
      trajectory === 'lifted'
        ? verticalLaunchSpeed(flightTicks, LIFTED_SHOT_GOAL_HEIGHT)
        : 0,
    trajectory,
    keeperChecked: false,
  };
}

export function shotFlightTick(state: MatchState): void {
  const b = state.ball;
  if (b.kind !== 'shot') return;
  b.pos = { x: b.pos.x + b.vel.x, y: b.pos.y + b.vel.y };
  advanceFlightHeight(b);
  const shooter = requirePlayerAt(state, b.by);
  const gy = goalYFor(shooter.team);
  const defendingTeam: 0 | 1 = shooter.team === 0 ? 1 : 0;
  const gkIdx = defendingTeam === 0 ? 0 : 11;
  const onTarget = Math.abs(b.targetX - GOAL_CENTER_X) <= GOAL_W / 2;
  const keeper = state.players[gkIdx];
  const reachedKeeperPlane =
    gy === 0 ? b.pos.y <= keeper.pos.y : b.pos.y >= keeper.pos.y;

  // Resolve a catch at the goalkeeper, not after the ball has already drawn in
  // the net. This removes the apparent "goal, then bounce out" sequence.
  if (onTarget && !b.keeperChecked && reachedKeeperPlane) {
    b.keeperChecked = true;
    if (isAvailable(state, gkIdx)) {
      const powerSaveBonus = keeperSaveBonus(state, gkIdx);
      const saved =
        state.rng() <
        keeperSaveProbability(state, gkIdx, b.shotStrengthD64, powerSaveBonus);
      consumeKeeperShotCharge(state, gkIdx);
      if (saved) {
        state.resolve[defendingTeam] = Math.max(
          0,
          state.resolve[defendingTeam] -
            Math.round(b.power / RESOLVE_DAMAGE_DIVISOR),
        );
        emit(state, {
          t: state.tick,
          kind: 'SAVE',
          by: gkIdx,
          resolveLeft: state.resolve[defendingTeam],
        });
        // The move is over. Today's keeper always catches, so the turnover
        // below would clear this anyway — it is here so that if a save ever
        // drops a live rebound, the goal that follows is nobody's assist.
        state.assistCandidateId = null;
        // A clean catch ends Giant GK's current dangerous attack. Clear it
        // before awarding save Heat so the keeper earns their next opportunity.
        if (keeper.def.power === 'GIANT_GK') finishMomentPower(state, gkIdx);
        addGauge(state, gkIdx, SAVE_GAUGE);
        state.ball = {
          kind: 'held',
          by: gkIdx,
          caught: true,
          releaseAfterTick: state.tick + GOALKEEPER_CATCH_HOLD_TICKS,
        };
        return;
      }
    }
  }

  const crossed = gy === 0 ? b.pos.y <= 0 : b.pos.y >= PITCH_H;
  if (!crossed) return;

  if (!onTarget) {
    emit(state, { t: state.tick, kind: 'MISS', by: b.by });
    if (isAvailable(state, gkIdx)) addGauge(state, gkIdx, MISS_GAUGE);
    restartKickoff(state, defendingTeam);
    return;
  }

  state.score[shooter.team]++;
  const scorerId = b.shooterId;
  // No path today makes the scorer his own candidate — taking the ball always
  // displaces the previous holder. The guard is here so a future power that
  // hands the ball back to its passer cannot credit a solo goal as an assist.
  const assistedById = state.assistCandidateId;
  emit(state, {
    t: state.tick,
    kind: 'GOAL',
    by: b.by,
    team: shooter.team,
    scoredById: scorerId,
    ...(assistedById !== null && assistedById !== scorerId
      ? { assistedById }
      : {}),
  });
  restartKickoff(state, defendingTeam);
}
