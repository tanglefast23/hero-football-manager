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
  | 'ELASTIC_KEEPER';
export type Role = 'GK' | 'DEF' | 'MID' | 'FWD';
export type FirePolicy = 'SAVE_FOR_TAP' | 'FIRE_WHEN_READY';

export interface Attrs {
  pac: number; sho: number; pas: number; def: number; tec: number; sta: number; ref: number;
}

export interface PlayerDef {
  id: string; name: string; role: Role; attrs: Attrs; power?: PowerId; lookId?: string;
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
  | { kind: 'winding'; untilTick: number; strength: number; targetIdx?: number }
  | { kind: 'active'; untilTick: number; strength: number };

export type OutReason = 'ko' | 'ignited' | 'redcard';

/**
 * A committed slide is replay state, not renderer choreography. The direction
 * is locked at launch; movement and contact resolution advance from this same
 * state on every deterministic tick.
 */
export interface SlideTackleState {
  targetIdx: number;
  startTick: number;
  untilTick: number;
  direction: Vec;
  remainingDistance: number;
  previousPos: Vec;
  targetPreviousPos: Vec;
}

export interface SimPlayer {
  def: PlayerDef;
  team: 0 | 1;
  pos: Vec;
  condition: number;
  gauge: number; // this is HEAT (In-the-Zone model, 2026-07-17) — field name kept as `gauge` to limit churn
  powerState: PowerState;
  /** Fixed pitch point for place-and-spring effects such as Web Trap. */
  powerAnchor?: Vec;
  firePolicy: FirePolicy;
  outUntilTick: number;       // 0 = fine
  outReason?: OutReason;
  slideTackle?: SlideTackleState;
  tackleRecoveryUntil: number;
  tackleCooldownUntil: number;
  cards: 0 | 1 | 2;
}

export type BallState =
  | { kind: 'held'; by: number; caught?: true; releaseAfterTick?: number }
  | { kind: 'loose'; pos: Vec; vel: Vec; z: number; vz: number }
  | {
    kind: 'pass';
    pos: Vec;
    from: number;
    to: number;
    willSucceed: boolean;
    interceptor: number;
    z: number;
    vz: number;
    speed: number;
  }
  | {
    kind: 'shot';
    pos: Vec;
    vel: Vec;
    by: number;
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
  | { t: number; kind: 'SLIDE_STARTED'; by: number; on: number; direction: Vec; untilTick: number }
  | { t: number; kind: 'TACKLE'; by: number; on: number; won: boolean; style: 'standing' | 'slide' | 'power'; contact: boolean }
  | { t: number; kind: 'SHOT'; by: number; power: number; trajectory: 'driven' | 'lifted' }
  | { t: number; kind: 'SAVE'; by: number; resolveLeft: number }
  | { t: number; kind: 'MISS'; by: number }
  | { t: number; kind: 'GOAL'; by: number; team: 0 | 1 }
  | { t: number; kind: 'POWER_READY'; player: number }
  | { t: number; kind: 'POWER_FIRED'; player: number; power: PowerId; strength: number }
  | { t: number; kind: 'POWER_INTERRUPTED'; player: number }
  | { t: number; kind: 'POWER_EXPIRED'; player: number }
  | { t: number; kind: 'CARD'; player: number; color: 'yellow' | 'red' }
  | { t: number; kind: 'IGNITED'; player: number }
  | { t: number; kind: 'EXTINGUISHED'; player: number }
  | { t: number; kind: 'RECOVERED'; player: number }
  | { t: number; kind: 'FORMATION_CHANGED'; team: 0 | 1; formation: FormationId }
  | { t: number; kind: 'MENTALITY_CHANGED'; team: 0 | 1; mentality: Mentality }
  | { t: number; kind: 'ENERGY_USE_CHANGED'; team: 0 | 1; energyUse: EnergyUse }
  | { t: number; kind: 'SUBSTITUTION'; team: 0 | 1; player: number; outPlayerId: string; inPlayerId: string }
  | { t: number; kind: 'HALF_TIME' }
  | { t: number; kind: 'FULL_TIME' };

export type MatchInput =
  | { tick: number; kind: 'POWER_TAP'; player: number }
  | { tick: number; kind: 'SET_AUTO_POWERS'; enabled: boolean }
  | { tick: number; kind: 'SET_FORMATION'; formation: FormationId }
  | { tick: number; kind: 'SET_MENTALITY'; mentality: Mentality }
  | { tick: number; kind: 'SET_ENERGY_USE'; energyUse: EnergyUse }
  | { tick: number; kind: 'SUBSTITUTE'; player: number; replacementId: string };

export interface MatchOpts {
  homePolicy?: FirePolicy;   // default SAVE_FOR_TAP
  awayPolicy?: FirePolicy;   // default FIRE_WHEN_READY
  controlledTeam?: 0 | 1;   // watched side; enables replay-recorded coaching inputs
  homeFormation?: FormationId;
  awayFormation?: FormationId;
  blindAutoHome?: boolean;   // TEST-ONLY: home heroes auto-fire ignoring context (timing-value baseline)
}

/**
 * Positional-table movement bookkeeping (m0.5 rework): possession phase,
 * turnover blend, and the presser lease. Pure derived-from-play state —
 * consumes no rng, so it adds nothing to the replay envelope.
 */
export interface MovementState {
  phase: 0 | 1;           // team of the current/last holder — picks each side's in/out-of-possession table
  blendFrom: 0 | 1;       // phase being blended away from after a turnover (== phase once settled)
  blendStartTick: number; // tick the blend began; factor = clamp((tick - start) / BLEND_TICKS, 0, 1)
  presserIdx: number;     // leased presser (holds the role >= PRESSER_LEASE_TICKS), -1 = none
  presserSinceTick: number;
}

export interface MatchState {
  tick: number;
  half: 1 | 2;
  phase: 'play' | 'fulltime';
  score: [number, number];
  players: SimPlayer[];      // 22; 0-10 team 0 (attacks toward y=0), 11-21 team 1
  ball: BallState;
  movement: MovementState;
  tactics: [TeamTactics, TeamTactics];
  bench: [PlayerDef[], PlayerDef[]];
  substitutionsUsed: [number, number];
  resolve: [number, number];
  rng: Rng;
  events: MatchEvent[];
  pendingInputs: MatchInput[];
  blindAutoHome: boolean;
  seed: number;
  opts: MatchOpts;
  teams: [TeamDef, TeamDef];   // match-owned deep copies (createMatch detaches from caller data)
  inputLog: MatchInput[];      // append-only history of every queued input (replay capture)
}

export interface MatchResult { score: [number, number]; events: MatchEvent[]; }

export interface ReplayEnvelope {
  schemaVersion: 1;
  engineVersion: string;
  seed: number;
  home: TeamDef;
  away: TeamDef;
  inputs: MatchInput[];
  opts?: MatchOpts;
}
