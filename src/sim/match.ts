import { mulberry32 } from './rng';
import { HALF_TICKS } from './geometry';
import { emit } from './events';
import { movementTick, restartKickoff } from './engine';
import type { MatchInput, MatchOpts, MatchResult, MatchState, ReplayEnvelope, SimPlayer, TeamDef } from './types';

export const ENGINE_VERSION = 'm0.2';
const TOTAL_TICKS = HALF_TICKS * 2;

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
  if (home.players.length !== 11 || away.players.length !== 11) {
    throw new Error('teams must have 11 players');
  }
  const state: MatchState = {
    tick: 0, half: 1, phase: 'play', score: [0, 0],
    players: makePlayers(home, away, opts),
    ball: { kind: 'held', by: 9 },
    resolve: [100, 100],
    rng: mulberry32(seed),
    events: [], pendingInputs: [],
    blindAutoHome: opts.blindAutoHome ?? false,
  };
  restartKickoff(state, 0);
  emit(state, { t: 0, kind: 'KICKOFF', half: 1 });
  return state;
}

export function queueInput(state: MatchState, input: MatchInput): void {
  state.pendingInputs.push(input);
}

export function tick(state: MatchState): void {
  if (state.phase === 'fulltime') return;
  state.tick++;

  movementTick(state);

  if (state.half === 1 && state.tick === HALF_TICKS) {
    state.half = 2;
    emit(state, { t: state.tick, kind: 'HALF_TIME' });
    state.resolve = [Math.min(100, state.resolve[0] + 30), Math.min(100, state.resolve[1] + 30)];
    for (const p of state.players) p.condition = Math.min(100, p.condition + 15);
    restartKickoff(state, 1);
    emit(state, { t: state.tick, kind: 'KICKOFF', half: 2 });
  } else if (state.tick >= TOTAL_TICKS) {
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

export function runReplay(env: ReplayEnvelope): MatchResult {
  if (env.schemaVersion !== 1) {
    throw new Error(`replay schema mismatch: ${env.schemaVersion}`);
  }
  if (env.engineVersion !== ENGINE_VERSION) {
    throw new Error(`replay engine mismatch: ${env.engineVersion} vs ${ENGINE_VERSION}`);
  }
  return runMatch(env.seed, env.home, env.away, env.inputs);
}
