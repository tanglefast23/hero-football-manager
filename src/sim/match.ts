import { mulberry32 } from './rng';
import { HALF_TICKS } from './geometry';
import { emit } from './events';
import { movementTick, possessionTick, restartKickoff, shotFlightTick, tackleTick } from './engine';
import { powerTick } from './powers';
import type { Attrs, MatchInput, MatchOpts, MatchResult, MatchState, PlayerDef, ReplayEnvelope, Role, SimPlayer, TeamDef } from './types';

// m0.9 adds replayable manual control for either fixture side. Match tuning
// and RNG are unchanged, but the accepted input domain is replay-affecting.
export const ENGINE_VERSION = 'm0.9';
const TOTAL_TICKS = HALF_TICKS * 2;
const STOPPAGE_CAP = 50;
// A replay tap can only matter on a tick the match actually simulates. Even one
// input per simulated tick dwarfs a real match (zones cap taps to a few dozen),
// so this bound rejects corrupt/DoS input floods without touching any real replay.
const MAX_REPLAY_TICK = TOTAL_TICKS + STOPPAGE_CAP;
const MAX_REPLAY_INPUTS = MAX_REPLAY_TICK;
const VALID_ROLES: ReadonlySet<Role> = new Set(['GK', 'DEF', 'MID', 'FWD']);
const VALID_POWER_IDS: ReadonlySet<string> = new Set(['SUPER_SPEED', 'SUPER_STRENGTH', 'FIRE_TORCH']);
const VALID_FIRE_POLICIES: ReadonlySet<string> = new Set(['SAVE_FOR_TAP', 'FIRE_WHEN_READY']);
const ATTR_KEYS: ReadonlyArray<keyof Attrs> = ['pac', 'sho', 'pas', 'def', 'tec', 'sta', 'ref'];

function deepCopyTeam(t: TeamDef): TeamDef {
  return { id: t.id, name: t.name, players: t.players.map(p => ({ ...p, attrs: { ...p.attrs } })) };
}

function ballSettled(state: MatchState): boolean {
  return state.ball.kind === 'held' || state.ball.kind === 'loose';
}

function makePlayers(home: TeamDef, away: TeamDef, opts: MatchOpts): SimPlayer[] {
  const mk = (team: 0 | 1, defs: TeamDef): SimPlayer[] =>
    defs.players.map(def => ({
      def, team,
      pos: { x: 0, y: 0 }, // set by restartKickoff below
      condition: 100, gauge: 0,
      powerState: { kind: 'idle' as const },
      firePolicy: team === 0 ? (opts.homePolicy ?? 'SAVE_FOR_TAP') : (opts.awayPolicy ?? 'FIRE_WHEN_READY'),
      outUntilTick: 0, tackleCooldownUntil: 0, cards: 0 as const,
    }));
  return [...mk(0, home), ...mk(1, away)];
}

export function createMatch(seed: number, home: TeamDef, away: TeamDef, opts: MatchOpts = {}): MatchState {
  validateTeamDef(home, 'home team');
  validateTeamDef(away, 'away team');
  const optsCopy: MatchOpts = { ...opts }; // detach from caller's opts object, same reasoning as deepCopyTeam below
  const teams: [TeamDef, TeamDef] = [deepCopyTeam(home), deepCopyTeam(away)];
  const state: MatchState = {
    tick: 0, half: 1, phase: 'play', score: [0, 0],
    players: makePlayers(teams[0], teams[1], optsCopy),
    ball: { kind: 'held', by: 9 },
    // Inert placeholder (blendFrom === phase → no blend); restartKickoff below
    // resets it properly for the opening kickoff.
    movement: { phase: 0, blendFrom: 0, blendStartTick: 0, presserIdx: -1, presserSinceTick: 0 },
    resolve: [100, 100],
    rng: mulberry32(seed),
    events: [], pendingInputs: [],
    blindAutoHome: optsCopy.blindAutoHome ?? false,
    seed, opts: optsCopy, teams, inputLog: [],
  };
  restartKickoff(state, 0);
  emit(state, { t: 0, kind: 'KICKOFF', half: 1 });
  return state;
}

export function queueInput(state: MatchState, input: MatchInput): void {
  if (input.tick <= state.tick) {
    throw new Error(`input stamped for tick ${input.tick} but match is at tick ${state.tick} — inputs must be future-stamped`);
  }
  if (input.kind === 'POWER_TAP') {
    const target = state.players[input.player];
    if (!Number.isSafeInteger(input.player)
      || input.player < 0
      || input.player > 21
      || !target?.def.power
      || target.firePolicy !== 'SAVE_FOR_TAP') {
      throw new Error(
        `invalid POWER_TAP target ${input.player} — taps may only target heroes on the manually controlled team`
      );
    }
  }
  // Separate copies so pendingInputs (consumed/spliced by powerTick) and inputLog
  // (the append-only replay record) can never alias the same object.
  state.pendingInputs.push({ ...input });
  state.inputLog.push({ ...input });
}

export function tick(state: MatchState): void {
  if (state.phase === 'fulltime') return;
  state.tick++;

  powerTick(state);
  movementTick(state);
  possessionTick(state);
  tackleTick(state);
  shotFlightTick(state);

  if (state.half === 1 && state.tick >= HALF_TICKS && (ballSettled(state) || state.tick >= HALF_TICKS + STOPPAGE_CAP)) {
    state.half = 2;
    emit(state, { t: state.tick, kind: 'HALF_TIME' });
    state.resolve = [Math.min(100, state.resolve[0] + 30), Math.min(100, state.resolve[1] + 30)];
    for (const p of state.players) p.condition = Math.min(100, p.condition + 15);
    restartKickoff(state, 1);
    emit(state, { t: state.tick, kind: 'KICKOFF', half: 2 });
  } else if (state.half === 2 && state.tick >= TOTAL_TICKS && (ballSettled(state) || state.tick >= TOTAL_TICKS + STOPPAGE_CAP)) {
    state.phase = 'fulltime';
    emit(state, { t: state.tick, kind: 'FULL_TIME' });
  }
}

export function runMatch(seed: number, home: TeamDef, away: TeamDef, inputs: MatchInput[] = [], opts: MatchOpts = {}): MatchResult {
  const state = createMatch(seed, home, away, opts);
  for (const i of inputs) queueInput(state, i);
  while (state.phase !== 'fulltime') tick(state);
  return { score: state.score, events: state.events };
}

/**
 * Replay envelopes carry only production opts. blindAutoHome is a TEST-ONLY flag
 * (types.ts): serializing it would let a saved replay silently flip home heroes to
 * the blind-firing test baseline, so it is deliberately dropped here.
 */
function serializeReplayOpts(opts: MatchOpts): MatchOpts {
  const out: MatchOpts = {};
  if (opts.homePolicy !== undefined) out.homePolicy = opts.homePolicy;
  if (opts.awayPolicy !== undefined) out.awayPolicy = opts.awayPolicy;
  return out;
}

export function envelopeFrom(state: MatchState): ReplayEnvelope {
  return {
    schemaVersion: 1,
    engineVersion: ENGINE_VERSION,
    seed: state.seed,
    home: deepCopyTeam(state.teams[0]),
    away: deepCopyTeam(state.teams[1]),
    inputs: state.inputLog.map(i => ({ ...i })),
    opts: serializeReplayOpts(state.opts),
  };
}

export function validateTeamDef(team: TeamDef, label: string): void {
  if (!team || typeof team !== 'object') {
    throw new Error(`${label} must be an object`);
  }
  if (typeof team.id !== 'string' || team.id.trim().length === 0
    || typeof team.name !== 'string' || team.name.trim().length === 0) {
    throw new Error(`${label} must have a non-empty id and name`);
  }
  if (!Array.isArray(team.players) || team.players.length !== 11) {
    throw new Error(`${label} must have exactly 11 players`);
  }

  const playerIds = new Set<string>();
  let goalkeeperCount = 0;

  for (const p of team.players as PlayerDef[]) {
    if (!p || typeof p !== 'object') {
      throw new Error(`${label} player must be an object`);
    }
    if (typeof p.id !== 'string' || p.id.trim().length === 0) {
      throw new Error(`${label} player IDs must be non-empty strings`);
    }
    if (playerIds.has(p.id)) {
      throw new Error(`${label} player IDs must be unique; duplicate ${p.id}`);
    }
    playerIds.add(p.id);
    if (typeof p.name !== 'string' || p.name.trim().length === 0) {
      throw new Error(`${label} player names must be non-empty strings`);
    }
    if (!VALID_ROLES.has(p.role)) {
      throw new Error(`${label} player ${p.id} has invalid role ${String(p.role)}`);
    }
    if (p.role === 'GK') goalkeeperCount += 1;
    for (const key of ATTR_KEYS) {
      const v = p.attrs?.[key];
      if (!Number.isSafeInteger(v) || v < 1 || v > 99) {
        throw new Error(`${label} player ${p.id} has invalid attrs.${key} (${v}); expected an integer from 1 to 99`);
      }
    }
    if (p.power !== undefined && !VALID_POWER_IDS.has(p.power)) {
      throw new Error(`${label} player ${p.id} has unknown power ${String(p.power)}`);
    }
  }
  // Slot 0 is the goalkeeper by position (the engine reads index 0/11 as GK
  // regardless of role). Reject a squad whose slot 0 isn't a GK — otherwise an
  // all-outfield team validates and an outfielder silently keeps goal.
  if (team.players[0].role !== 'GK') {
    throw new Error(`${label} slot 0 must be the goalkeeper (role GK), got ${String(team.players[0].role)}`);
  }
  if (goalkeeperCount !== 1) {
    throw new Error(`${label} must have exactly one goalkeeper, got ${goalkeeperCount}`);
  }
}

/** Structural validation for the optional opts bag (Task 13 pre-flight, Issue B) — same reasoning as validateTeamDef: a deserialized envelope offers no runtime type guarantee. */
function validateOpts(opts: MatchOpts | undefined): void {
  if (opts === undefined) return;
  if (opts.homePolicy !== undefined && !VALID_FIRE_POLICIES.has(opts.homePolicy)) {
    throw new Error(`replay envelope: opts.homePolicy must be SAVE_FOR_TAP or FIRE_WHEN_READY, got ${String(opts.homePolicy)}`);
  }
  if (opts.awayPolicy !== undefined && !VALID_FIRE_POLICIES.has(opts.awayPolicy)) {
    throw new Error(`replay envelope: opts.awayPolicy must be SAVE_FOR_TAP or FIRE_WHEN_READY, got ${String(opts.awayPolicy)}`);
  }
  if (opts.blindAutoHome !== undefined && typeof opts.blindAutoHome !== 'boolean') {
    throw new Error(`replay envelope: opts.blindAutoHome must be a boolean, got ${String(opts.blindAutoHome)}`);
  }
}

/** Structural validation for a replay envelope — e.g. one deserialized from JSON, where TS types offer no runtime guarantee. Throws a descriptive error on the first violation found. */
export function validateEnvelope(env: ReplayEnvelope): void {
  if (env.schemaVersion !== 1) {
    throw new Error(`replay envelope: schemaVersion must be 1, got ${env.schemaVersion}`);
  }
  if (typeof env.engineVersion !== 'string') {
    throw new Error('replay envelope: engineVersion must be a string');
  }
  if (typeof env.seed !== 'number' || !Number.isFinite(env.seed) || !Number.isInteger(env.seed)) {
    throw new Error(`replay envelope: seed must be a finite integer, got ${env.seed}`);
  }
  validateTeamDef(env.home, 'replay envelope: home team');
  validateTeamDef(env.away, 'replay envelope: away team');
  validateOpts(env.opts);
  if (!Array.isArray(env.inputs)) {
    throw new Error('replay envelope: inputs must be an array');
  }
  if (env.inputs.length > MAX_REPLAY_INPUTS) {
    throw new Error(`replay envelope: too many inputs (${env.inputs.length} > ${MAX_REPLAY_INPUTS} max) — a tap can only land on a simulated tick`);
  }
  for (const input of env.inputs as MatchInput[]) {
    if (!input || typeof input !== 'object') {
      throw new Error('replay envelope: input must be an object');
    }
    if (input.kind !== 'POWER_TAP') {
      throw new Error(`replay envelope: unknown input kind ${String(input.kind)}`);
    }
    // Upper bound too: an input stamped past full time is never processed by the
    // sim, so accept-and-ignore is a validation gap — reject it here.
    if (typeof input.tick !== 'number' || !Number.isFinite(input.tick) || !Number.isInteger(input.tick) || input.tick < 1 || input.tick > MAX_REPLAY_TICK) {
      throw new Error(`replay envelope: input tick must be a finite integer in 1..${MAX_REPLAY_TICK}, got ${input.tick}`);
    }
    if (typeof input.player !== 'number' || !Number.isFinite(input.player) || !Number.isInteger(input.player) || input.player < 0 || input.player > 21) {
      throw new Error(`replay envelope: input player must be a finite integer in 0..21, got ${input.player}`);
    }
    const targetTeam = input.player < 11 ? 0 : 1;
    const targetSlot = targetTeam === 0 ? input.player : input.player - 11;
    const target = targetTeam === 0 ? env.home.players[targetSlot] : env.away.players[targetSlot];
    if (target?.power === undefined) {
      throw new Error(`replay envelope: input targets team ${targetTeam} slot ${targetSlot}, which is not a hero (no power)`);
    }
    const targetPolicy = targetTeam === 0
      ? (env.opts?.homePolicy ?? 'SAVE_FOR_TAP')
      : (env.opts?.awayPolicy ?? 'FIRE_WHEN_READY');
    if (targetPolicy !== 'SAVE_FOR_TAP') {
      throw new Error(`replay envelope: input targets team ${targetTeam}, which is not manually controlled`);
    }
  }
}

export function runReplay(env: ReplayEnvelope): MatchResult {
  validateEnvelope(env);
  if (env.engineVersion !== ENGINE_VERSION) {
    throw new Error(`replay engine mismatch: ${env.engineVersion} vs ${ENGINE_VERSION}`);
  }
  return runMatch(env.seed, env.home, env.away, env.inputs, env.opts ?? {});
}
