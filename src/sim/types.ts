import type { Vec } from './geometry';
import type { Rng } from './rng';
import type { EnergyUse, FormationId, TeamTactics, Mentality } from './tactics';

export type PowerId =
  | 'SUPER_SPEED'
  | 'BLINK_RUN'
  | 'THUNDER_STRIKE'
  | 'FIRE_TORCH'
  | 'PHASE_RUN'
  | 'PORTAL_PASS'
  | 'DECOY_DOUBLE'
  | 'FUTURE_SIGHT'
  | 'SUPER_STRENGTH'
  | 'WEB_TRAP'
  | 'ELASTIC_KEEPER'
  // m1.13 additions. Every one triggers from a sustained situation rather than
  // from carrying the ball, which is what kept Magnet Touch (cut) and the two
  // midfield powers from ever firing.
  | 'RALLY_CRY'
  | 'ICE_RINK'
  | 'SHADOW_MARK'
  | 'GRAVITY_WELL'
  | 'GIANT_GK'
  // m1.14 pass-disruption power.
  | 'GUST';
export type Role = 'GK' | 'DEF' | 'MID' | 'FWD';
export type FirePolicy = 'SAVE_FOR_TAP' | 'FIRE_WHEN_READY';

export interface Attrs {
  pac: number;
  sho: number;
  pas: number;
  def: number;
  tec: number;
  sta: number;
  ref: number;
}

/** Authored contest effects are expressed directly in fixed-point log-ratio units. */
export interface D64Modifier {
  readonly d64Mod: number;
}

export interface PlayerDef {
  id: string;
  name: string;
  role: Role;
  attrs: Attrs;
  /** Immutable career condition at match entry; static/authored teams default to 100. */
  readonly startingCondition?: number;
  power?: PowerId;
  powerTier?: 1 | 2 | 3;
  lookId?: string;
}

export interface TeamDef {
  id: string;
  name: string;
  players: PlayerDef[];
  /** Heat gain scale in whole or half percentages. Career coaches may raise it above 100. */
  heroGaugeRatePercent?: number;
  /** Match-eligible substitutes. They remain outside the fixed 22 render slots until used. */
  bench?: PlayerDef[];
}

export type PowerState =
  | { kind: 'idle' }
  | { kind: 'zone'; remainingTicks: number }
  | {
      kind: 'armed';
      remainingTicks: number;
      /**
       * The window this press opened, so the drain bar and the on-pitch ring
       * read the right denominator. A save keeper's is five times an outfield
       * hero's; a hardcoded 20 pinned their bar full then dumped it.
       */
      windowTicks: number;
      /** What the press is worth if it lands. Read by BOTH fire sites. */
      strength: number;
      /**
       * An on-target shot arrived at this keeper's goal during the window.
       *
       * Evidence, not inference. A reason computed at expiry would claim "no
       * shot on net" about a match where a shot passed while the keeper was
       * knocked down and the keeper recovered before the window lapsed.
       */
      sawShotOnTarget: boolean;
    }
  | {
      kind: 'winding';
      untilTick: number;
      strength: number;
      /** Target captured when a visible, placed wind-up begins. */
      targetIdx?: number;
      /** Stable identity prevents a substitution inheriting somebody else's lock. */
      targetPlayerId?: string;
      /** A second captured target for authored multi-blocker effects. */
      secondaryTargetIdx?: number;
      /** Stable identity paired with the second captured target. */
      secondaryTargetPlayerId?: string;
      /** Destination paired with the second captured target. */
      secondaryAnchor?: Vec;
      /** Friendly carrier whose attack created an off-ball placed wind-up. */
      carrierIdx?: number;
      /** Friendly runner committed to Gravity Well's opened lane. */
      runnerIdx?: number;
      /** Stable identity prevents a substitute inheriting Gravity's run. */
      runnerPlayerId?: string;
      /** The opened-lane destination paired with the runner. */
      runnerAnchor?: Vec;
    }
  | {
      kind: 'active';
      untilTick: number;
      strength: number;
      /** Locked one-moment target, such as Future Sight's outlet. */
      targetIdx?: number;
      /** Optional second locked target for a single multi-blocker moment. */
      secondaryTargetIdx?: number;
      /** Destination paired with the second locked target. */
      secondaryAnchor?: Vec;
      /** Friendly carrier for an off-ball one-moment attack such as Decoy or Gravity. */
      carrierIdx?: number;
      /** Stable target identity for one-action commitments across substitutions. */
      targetPlayerId?: string;
      /** Friendly runner committed to Gravity Well's opened lane. */
      runnerIdx?: number;
      /** Stable identity paired with the Gravity runner. */
      runnerPlayerId?: string;
      /** The committed Gravity runner's visible lane destination. */
      runnerAnchor?: Vec;
      /** Shadow Mark is invisible during its two-second burrow, then hunts. */
      armedAtTick?: number;
      /** Ensures a power's authored next action happens once instead of smearing across its duration. */
      commitment?:
        | 'SPEED_ACTION'
        | 'THUNDER_SHOT'
        | 'BLINK_ACTION'
        | 'FIRE_RUN'
        | 'PHASE_ACTION'
        | 'POWER_OUTLET'
        | 'SHADOW_HUNT';
    };

export type OutReason = 'ko' | 'ignited' | 'redcard';

/**
 * A committed slide is replay state, not renderer choreography. The direction
 * is locked at launch; movement and contact resolution advance from this same
 * state on every deterministic tick.
 */
interface SlideTackleState {
  targetIdx: number;
  startTick: number;
  untilTick: number;
  direction: Vec;
  remainingDistance: number;
  previousPos: Vec;
  targetPreviousPos: Vec;
  /** Snapshot of Shadow Mark's one-challenge d64 bonus; the cloak is consumed when the slide starts. */
  shadowDefenseBonus?: number;
}

export interface SimPlayer {
  def: PlayerDef;
  team: 0 | 1;
  pos: Vec;
  /** Ordinary movement sub-pixel carry in 1/128 pitch units per axis. */
  movementResidue?: Vec;
  condition: number;
  gauge: number; // this is HEAT (In-the-Zone model, 2026-07-17) — field name kept as `gauge` to limit churn
  /** Match-local Zone budget; prevents dominant teams from farming unlimited hero moments. */
  zonesOpened: number;
  powerState: PowerState;
  /** Fixed pitch point for place-and-spring effects such as Web Trap. */
  powerAnchor?: Vec;
  /** Rally may grant one fourth Zone exactly once per hero per match. */
  encoreState?: 'BANKED' | 'CONSUMED';
  /** One queued threshold refill after Rally catches a hero already ready/busy. */
  encoreQueuedRefill?: boolean;
  /** A webbed player cannot move, act, challenge, or recover the loose ball. */
  webbedUntilTick?: number;
  /** Portal arrival protection ends on its deadline or the receiver's action. */
  portalProtectedUntilTick?: number;
  /** Authored Ice movement keeps the carrier and ball together. */
  forcedMovement?: { kind: 'ICE_SLIDE'; untilTick: number; step: Vec };
  /** Super Strength freezes the captured carrier through the visible charge. */
  actionLockedUntilTick?: number;
  /** Owner of the Strength lock, used for safe cancellation. */
  actionLockSourceIdx?: number;
  firePolicy: FirePolicy;
  outUntilTick: number; // 0 = fine
  outReason?: OutReason;
  slideTackle?: SlideTackleState;
  /**
   * Consecutive beaten standing challenges against one carrier. The third in a
   * row always puts this defender on the floor, so no single defender can grind
   * a duel indefinitely. Keyed by carrier index and expired by `lastFailTick`,
   * so a failure from an old duel cannot fell him in a fresh one.
   */
  beatenStreak?: { targetIdx: number; count: number; lastFailTick: number };
  tackleRecoveryUntil: number;
  tackleCooldownUntil: number;
  cards: 0 | 1 | 2;
  /**
   * Pass-combo speed bonus tier in ten-thousandths (2000 = +20%). The live
   * bonus is derived from this and `comboTicks` rather than stored, so a value
   * read every tick by every mover cannot drift.
   */
  comboTierD: number;
  /** Ticks left on that bonus, 30 down to 0. At 0 the tier is cleared too. */
  comboTicks: number;
  /**
   * Id of the last pass chain this entity touched the ball in; 0 means never.
   * Live chain ids start at 1, so a freshly built entity — a substitute, a new
   * Decoy clone — can never match a live chain by accident.
   */
  comboChainId: number;
}

/**
 * A real temporary Decoy player. The two reserved identities (22 home, 23
 * away) never move or splice the starting-XI array, so replays and base player
 * indices stay stable even when both teams have a clone at once.
 */
export interface DecoyCloneState extends SimPlayer {
  ownerIdx: number;
  ownerPlayerId: string;
  sourceIdx: number;
  sourcePlayerId: string;
  formationSlot: number;
  untilTick: number;
}

export type BallState =
  | {
      kind: 'held';
      by: number;
      caught?: true;
      releaseAfterTick?: number;
      gustPunt?: true;
      gustHeroIdx?: number;
      gustGrade?: number;
    }
  | { kind: 'loose'; pos: Vec; vel: Vec; z: number; vz: number }
  | {
      kind: 'pass';
      pos: Vec;
      from: number;
      /**
       * Stable identity of the player who kicked it. `from` is a slot, and a
       * substitution or a Decoy respawn during the flight puts a different
       * player in that slot — so anything that credits the passer at ARRIVAL
       * must check this, not the index. Same reasoning as
       * `decoyReceiverPlayerId` below and `targetPlayerId` on PowerState.
       */
      fromPlayerId: string;
      to: number;
      willSucceed: boolean;
      interceptor: number;
      z: number;
      vz: number;
      speed: number;
      /** A disrupted pass becomes nobody's ball at its flight target. */
      looseOnArrival?: boolean;
      /** Deterministic roll-away applied when a disrupted pass lands loose. */
      deflectionVel?: Vec;
      /** Gust's redirect is visually distinct and triggers a forced GK punt. */
      gustRedirect?: true;
      /** The authored follow-up punt is guaranteed and renderer-visible. */
      gustPunt?: true;
      /** Gust owner retained across redirect flight for deterministic FX events. */
      gustHeroIdx?: number;
      /** Gust activation grade retained through the redirect and contestable punt. */
      gustGrade?: number;
      /** An authored pass flies to a fixed landing point, not the receiver's old body. */
      arrivalPos?: Vec;
      /** Stable identity required before a successful clone can materialize. */
      decoyReceiverPlayerId?: string;
      /** Stable identity required before Gust moves its receiver into the landing lane. */
      gustPuntReceiverPlayerId?: string;
      /** A power-read interception cannot be inherited by a substitute. */
      powerInterceptorPlayerId?: string;
    }
  | {
      kind: 'shot';
      pos: Vec;
      vel: Vec;
      by: number;
      /**
       * Stable id of the player who launched the shot. The flight lasts many
       * ticks and a substitution can land in between, so resolving `by`'s
       * occupant at goal time would credit the wrong player.
       */
      shooterId: string;
      /** Keeper-facing fixed-point execution strength; display `power` never feeds resolution. */
      shotStrengthD64: number;
      power: number;
      targetX: number;
      z: number;
      vz: number;
      trajectory: 'driven' | 'lifted';
      keeperChecked: boolean;
    };

export type MatchEvent =
  | { t: number; kind: 'KICKOFF'; half: 1 | 2 }
  | { t: number; kind: 'PASS'; from: number; to: number; ok: boolean }
  | {
      t: number;
      kind: 'SLIDE_STARTED';
      by: number;
      on: number;
      direction: Vec;
      untilTick: number;
    }
  /** `dropped` marks a beaten challenger left on the grass; standing challenges only. */
  | {
      t: number;
      kind: 'TACKLE';
      by: number;
      on: number;
      won: boolean;
      style: 'standing' | 'slide' | 'power';
      contact: boolean;
      dropped?: true;
    }
  | {
      t: number;
      kind: 'SHOT';
      /** Stable base player credited in match reports. */
      by: number;
      /** Temporary entity that physically struck it, when different from `by`. */
      actor?: number;
      power: number;
      trajectory: 'driven' | 'lifted';
    }
  | { t: number; kind: 'SAVE'; by: number; resolveLeft: number }
  | { t: number; kind: 'MISS'; by: number }
  | {
      t: number;
      kind: 'GOAL';
      by: number;
      team: 0 | 1;
      /**
       * Stable id of the scorer, stamped when the shot launched. Like
       * `assistedById`, an id rather than a slot: the shot flies for many
       * ticks, so a substitution can change the slot's occupant before the
       * ball crosses the line.
       */
      scoredById: string;
      /**
       * Stable id of the teammate who held the ball immediately before the
       * scorer. A stable id rather than a slot because the assisting touch
       * precedes the goal by many ticks, so a substitution can land in between
       * and a slot would resolve to the wrong player.
       */
      assistedById?: string;
    }
  | { t: number; kind: 'POWER_READY'; player: number; power: PowerId }
  | {
      t: number;
      kind: 'POWER_FIRED';
      player: number;
      power: PowerId;
      strength: number;
    }
  /** A power's authored on-pitch effect landing, distinct from ordinary ball/body contact. */
  | {
      t: number;
      kind: 'POWER_IMPACT';
      player: number;
      power: PowerId;
      target?: number;
    }
  | { t: number; kind: 'POWER_INTERRUPTED'; player: number }
  | {
      t: number;
      kind: 'POWER_EXPIRED';
      player: number;
      power: PowerId;
      /** `no-shot` gates the NO SHOT ON NET line; everything else is generic. */
      reason: 'no-shot' | 'other';
    }
  | {
      t: number;
      kind: 'DECOY_POP';
      player: number;
      clone: number;
      source: number;
      pos: Vec;
      reason: 'expired' | 'turnover' | 'restart' | 'substitution' | 'invalid';
    }
  | {
      t: number;
      kind: 'GUST_REDIRECT';
      player: number;
      from: number;
      to: number;
    }
  | { t: number; kind: 'GUST_PUNT'; player: number; from: number; to: number }
  | { t: number; kind: 'CARD'; player: number; color: 'yellow' | 'red' }
  | { t: number; kind: 'IGNITED'; player: number }
  | { t: number; kind: 'EXTINGUISHED'; player: number }
  | { t: number; kind: 'RECOVERED'; player: number }
  | {
      t: number;
      kind: 'FORMATION_CHANGED';
      team: 0 | 1;
      formation: FormationId;
    }
  | { t: number; kind: 'MENTALITY_CHANGED'; team: 0 | 1; mentality: Mentality }
  | { t: number; kind: 'ENERGY_USE_CHANGED'; team: 0 | 1; energyUse: EnergyUse }
  | {
      t: number;
      kind: 'SUBSTITUTION';
      team: 0 | 1;
      player: number;
      outPlayerId: string;
      inPlayerId: string;
    }
  | { t: number; kind: 'HALF_TIME' }
  | { t: number; kind: 'FULL_TIME' };

export type MatchInput =
  | { tick: number; kind: 'POWER_TAP'; player: number }
  | { tick: number; kind: 'SET_AUTO_POWERS'; enabled: boolean }
  | { tick: number; kind: 'SET_FORMATION'; formation: FormationId }
  | { tick: number; kind: 'SET_MENTALITY'; mentality: Mentality }
  | { tick: number; kind: 'SET_ENERGY_USE'; energyUse: EnergyUse }
  /**
   * The head coach's half-time speech: a flat, temporary lift to every stored
   * attribute of the controlled team, on the pitch and on the bench, for the
   * rest of the match. The amount is decided by the career ring (it scales with
   * division) and travels in the input, so a replay needs no career context.
   */
  | { tick: number; kind: 'MOTIVATIONAL_SPEECH'; boost: number }
  | { tick: number; kind: 'SUBSTITUTE'; player: number; replacementId: string };

export interface MatchOpts {
  homePolicy?: FirePolicy; // default FIRE_WHEN_READY (SAVE_FOR_TAP is explicit test instrumentation)
  awayPolicy?: FirePolicy; // default FIRE_WHEN_READY
  controlledTeam?: 0 | 1; // watched side; enables replay-recorded coaching inputs
  homeFormation?: FormationId;
  awayFormation?: FormationId;
  blindAutoHome?: boolean; // TEST-ONLY: home heroes auto-fire ignoring context (timing-value baseline)
}

/**
 * Positional-table movement bookkeeping (m0.5 rework): possession phase,
 * turnover blend, and the presser lease. Pure derived-from-play state —
 * consumes no rng, so it adds nothing to the replay envelope.
 */
export interface MovementState {
  phase: 0 | 1; // team of the current/last holder — picks each side's in/out-of-possession table
  blendFrom: 0 | 1; // phase being blended away from after a turnover (== phase once settled)
  blendStartTick: number; // tick the blend began; factor = clamp((tick - start) / BLEND_TICKS, 0, 1)
  presserIdx: number; // leased presser (holds the role >= PRESSER_LEASE_TICKS), -1 = none
  presserSinceTick: number;
}

/**
 * One team's live pass chain. `chainId` is an epoch: ending a chain increments
 * it, which drops every member at once without touching them. It is never
 * reset and never reused, because `restartKickoff` reuses the same SimPlayer
 * objects — a recycled id would silently re-enrol players from a chain that
 * ended before the restart.
 */
export interface PassComboChain {
  count: number;
  chainId: number;
}

export interface MatchState {
  tick: number;
  half: 1 | 2;
  phase: 'play' | 'fulltime';
  score: [number, number];
  players: SimPlayer[]; // 22; 0-10 team 0 (attacks toward y=0), 11-21 team 1
  /** Fixed optional clone slots: team 0 is entity 22, team 1 is entity 23. */
  decoyClones: [DecoyCloneState | null, DecoyCloneState | null];
  ball: BallState;
  /** Stable id of the player last observed holding the ball. */
  ballHolderId: string | null;
  /**
   * Team of that holder, recorded rather than derived: by the time the next
   * touch lands, a substitute may hold that slot, so the id alone no longer
   * leads back to the team the previous holder played for.
   */
  ballHolderTeam: 0 | 1 | null;
  /** Stable id of the previous same-team holder, or null when unassisted. */
  assistCandidateId: string | null;
  movement: MovementState;
  tactics: [TeamTactics, TeamTactics];
  bench: [PlayerDef[], PlayerDef[]];
  substitutionsUsed: [number, number];
  resolve: [number, number];
  /** Live pass chain per team. The render ring reads this instead of counting events. */
  passCombo: [PassComboChain, PassComboChain];
  rng: Rng;
  events: MatchEvent[];
  pendingInputs: MatchInput[];
  blindAutoHome: boolean;
  seed: number;
  opts: MatchOpts;
  teams: [TeamDef, TeamDef]; // match-owned deep copies (createMatch detaches from caller data)
  inputLog: MatchInput[]; // append-only history of every queued input (replay capture)
}

export interface MatchResult {
  score: [number, number];
  events: MatchEvent[];
}

export interface ReplayEnvelope {
  schemaVersion: 1;
  engineVersion: string;
  seed: number;
  home: TeamDef;
  away: TeamDef;
  inputs: MatchInput[];
  opts?: MatchOpts;
}
