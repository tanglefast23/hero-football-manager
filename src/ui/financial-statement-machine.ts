import type { LedgerLineReveal } from '../game/types';

/**
 * The Financial Report's reveal sequencer as a pure reducer (spec §4): rows
 * spin and land one at a time, multiplied rows walk their chip/odometer/
 * adjacency beats, the net row slams the stamp, and a tap completes the
 * current row atomically. No React, no timers, no audio — the machine consumes
 * events and RETURNS commands; the runtime executes them. That is what makes
 * the riskiest logic in the feature testable headless.
 *
 * Cancellation: every `start`/`tap` bumps `generation` BEFORE emitting
 * `schedule` commands (which embed the new generation); a `timer`,
 * `amountSettled`, or `stampSettled` event carrying a stale generation — or a
 * stale `settleKey` — reduces to zero commands.
 */

export interface MachineTimings {
  rowSpinMs: number;
  surgeSpinFactor: number;
  netSpinMs: number;
  interRowMs: number;
  chipMs: number;
  odometerMs: number;
  adjacencyMs: number;
  stampMs: number;
}

/** Spec §4's timing table. */
export const DEFAULT_MACHINE_TIMINGS: MachineTimings = {
  rowSpinMs: 500,
  surgeSpinFactor: 1.3,
  netSpinMs: 650,
  interRowMs: 80,
  chipMs: 150,
  odometerMs: 200,
  adjacencyMs: 150,
  stampMs: 250,
};

export interface MachineRow {
  id: string;
  amount: number;
  reveal?: LedgerLineReveal;
}

export interface MachineConfig {
  rows: readonly MachineRow[];
  netAmount: number;
  timings: MachineTimings;
  reduceMotion: boolean;
}

export type RowPhase =
  | 'pending'
  | 'spinning'
  | 'base'
  | 'chip'
  | 'multiplied'
  | 'adjacency'
  | 'complete';

export type SettleMode = 'land' | 'odometer' | 'adjacency' | 'instant';

interface RowRuntime {
  phase: RowPhase;
  shownValue: number;
  settleKey: number;
  settleMode: SettleMode;
}

interface NetRuntime {
  phase: 'pending' | 'spinning' | 'base' | 'complete';
  shownValue: number;
  settleKey: number;
  settleMode: SettleMode;
}

export type MachineCursor =
  | { kind: 'row'; index: number }
  | { kind: 'net' }
  | { kind: 'done' };

export interface BannerEvent {
  rowId: string;
  kind: 'attendance' | 'merch';
}

export interface MachineState {
  generation: number;
  rows: readonly RowRuntime[];
  net: NetRuntime;
  stampPhase: 'hidden' | 'slamming' | 'complete';
  status: 'running' | 'reportComplete';
  cursor: MachineCursor;
  bannerQueue: readonly BannerEvent[];
  bannersEnqueued: readonly string[];
}

export type MachineTarget = { target: 'row'; index: number } | { target: 'net' };

export type MachineEvent =
  | { type: 'start' }
  | ({ type: 'timer'; generation: number; expectPhase: RowPhase | 'advance' } & MachineTarget)
  | ({ type: 'amountSettled'; generation: number; settleKey: number } & MachineTarget)
  | { type: 'stampSettled'; generation: number }
  | { type: 'tap' }
  | { type: 'bannerShown'; rowId: string };

export type MachineCommand =
  | { type: 'schedule'; afterMs: number; event: MachineEvent }
  | { type: 'playSpin' }
  | { type: 'stopSpin' }
  | { type: 'playThunk' }
  | { type: 'playSurgeIgnition' }
  | { type: 'stopSurgeBed' };

export function slotPhaseForRow(phase: RowPhase): 'pending' | 'spinning' | 'settled' {
  if (phase === 'pending') return 'pending';
  if (phase === 'spinning') return 'spinning';
  return 'settled';
}

function isSurged(row: MachineRow): boolean {
  return row.reveal?.surge === true;
}

function bannerKind(row: MachineRow): BannerEvent['kind'] {
  return row.reveal?.source === 'merch' ? 'merch' : 'attendance';
}

function hasMultiplierBeat(row: MachineRow): boolean {
  const reveal = row.reveal;
  if (reveal === undefined) return false;
  return reveal.source === 'merch' ? reveal.multiplierTimes > 1 : reveal.multiplierPercent > 100;
}

function hasAdjacencyBeat(row: MachineRow): boolean {
  return row.reveal?.source === 'merch' && row.reveal.adjacencyAmount > 0;
}

/** What the reel lands on first: the varied base, or the flat amount. */
function baseValue(row: MachineRow): number {
  return row.reveal?.base ?? row.amount;
}

/** The value after the ×N beat: final for gates, pre-adjacency for merch. */
function multipliedValue(row: MachineRow): number {
  const reveal = row.reveal;
  if (reveal === undefined) return row.amount;
  if (reveal.source === 'merch') return reveal.base * reveal.multiplierTimes;
  return row.amount;
}

export function createMachine(config: MachineConfig): MachineState {
  if (config.reduceMotion) {
    // Everything lands instantly; surged banners still queue (spec §4 — they
    // are information, not decoration).
    const surged = config.rows.filter(isSurged);
    return {
      generation: 0,
      rows: config.rows.map(row => ({
        phase: 'complete',
        shownValue: row.amount,
        settleKey: 0,
        settleMode: 'instant',
      })),
      net: { phase: 'complete', shownValue: config.netAmount, settleKey: 0, settleMode: 'instant' },
      stampPhase: 'complete',
      status: 'reportComplete',
      cursor: { kind: 'done' },
      bannerQueue: surged.map(row => ({ rowId: row.id, kind: bannerKind(row) })),
      bannersEnqueued: surged.map(row => row.id),
    };
  }
  return {
    generation: 0,
    rows: config.rows.map(() => ({
      phase: 'pending',
      shownValue: 0,
      settleKey: 0,
      settleMode: 'instant',
    })),
    net: { phase: 'pending', shownValue: 0, settleKey: 0, settleMode: 'instant' },
    stampPhase: 'hidden',
    status: 'running',
    cursor: config.rows.length > 0 ? { kind: 'row', index: 0 } : { kind: 'net' },
    bannerQueue: [],
    bannersEnqueued: [],
  };
}

interface Reduction {
  state: MachineState;
  commands: readonly MachineCommand[];
}

function withRow(state: MachineState, index: number, patch: Partial<RowRuntime>): MachineState {
  return {
    ...state,
    rows: state.rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)),
  };
}

function enqueueBanner(state: MachineState, row: MachineRow): MachineState {
  if (!isSurged(row) || state.bannersEnqueued.includes(row.id)) return state;
  return {
    ...state,
    bannerQueue: [...state.bannerQueue, { rowId: row.id, kind: bannerKind(row) }],
    bannersEnqueued: [...state.bannersEnqueued, row.id],
  };
}

/** Starts spinning whatever the cursor points at; done cursors finish silently. */
function enterCursor(config: MachineConfig, state: MachineState): Reduction {
  const commands: MachineCommand[] = [];
  if (state.cursor.kind === 'row') {
    const index = state.cursor.index;
    const row = config.rows[index];
    const surge = isSurged(row);
    const spinMs = surge
      ? Math.round(config.timings.rowSpinMs * config.timings.surgeSpinFactor)
      : config.timings.rowSpinMs;
    commands.push({ type: 'playSpin' });
    if (surge) commands.push({ type: 'playSurgeIgnition' });
    commands.push({
      type: 'schedule',
      afterMs: spinMs,
      event: { type: 'timer', generation: state.generation, target: 'row', index, expectPhase: 'base' },
    });
    return { state: withRow(state, index, { phase: 'spinning' }), commands };
  }
  if (state.cursor.kind === 'net') {
    commands.push({ type: 'playSpin' });
    commands.push({
      type: 'schedule',
      afterMs: config.timings.netSpinMs,
      event: { type: 'timer', generation: state.generation, target: 'net', expectPhase: 'base' },
    });
    return {
      state: { ...state, net: { ...state.net, phase: 'spinning' } },
      commands,
    };
  }
  return { state, commands: [] };
}

/** Advances the cursor past `index` and schedules the next row's entrance. */
function scheduleAdvance(
  config: MachineConfig,
  state: MachineState,
): Reduction {
  const nextCursor: MachineCursor = state.cursor.kind === 'row'
    ? (state.cursor.index + 1 < config.rows.length
      ? { kind: 'row', index: state.cursor.index + 1 }
      : { kind: 'net' })
    : { kind: 'done' };
  const advanced: MachineState = { ...state, cursor: nextCursor };
  if (nextCursor.kind === 'done') {
    return { state: advanced, commands: [] };
  }
  const target: MachineTarget = nextCursor.kind === 'row'
    ? { target: 'row', index: nextCursor.index }
    : { target: 'net' };
  return {
    state: advanced,
    commands: [{
      type: 'schedule',
      afterMs: config.timings.interRowMs,
      event: { type: 'timer', generation: state.generation, expectPhase: 'advance', ...target },
    }],
  };
}

/** The row's landing beat: thunk, surge stop + banner, then the next sub-phase. */
function settleRowBase(config: MachineConfig, state: MachineState, index: number): Reduction {
  const row = config.rows[index];
  const commands: MachineCommand[] = [{ type: 'playThunk' }];
  let next = state;
  if (isSurged(row)) {
    commands.push({ type: 'stopSurgeBed' });
    next = enqueueBanner(next, row);
  }
  if (hasMultiplierBeat(row)) {
    next = withRow(next, index, { phase: 'chip' });
    commands.push({
      type: 'schedule',
      afterMs: config.timings.chipMs,
      event: { type: 'timer', generation: next.generation, target: 'row', index, expectPhase: 'multiplied' },
    });
    return { state: next, commands };
  }
  if (hasAdjacencyBeat(row)) {
    next = withRow(next, index, {
      phase: 'adjacency',
      shownValue: row.amount,
      settleKey: state.rows[index].settleKey + 1,
      settleMode: 'adjacency',
    });
    return { state: next, commands };
  }
  next = withRow(next, index, { phase: 'complete' });
  const advanced = scheduleAdvance(config, next);
  return { state: advanced.state, commands: [...commands, ...advanced.commands] };
}

export function reduce(
  config: MachineConfig,
  state: MachineState,
  event: MachineEvent,
): Reduction {
  switch (event.type) {
    case 'start': {
      if (state.status === 'reportComplete') return { state, commands: [] };
      const started = { ...state, generation: state.generation + 1 };
      return enterCursor(config, started);
    }

    case 'timer': {
      if (event.generation !== state.generation) return { state, commands: [] };
      if (event.expectPhase === 'advance') {
        return enterCursor(config, state);
      }
      if (event.target === 'net') {
        if (state.net.phase !== 'spinning' || event.expectPhase !== 'base') {
          return { state, commands: [] };
        }
        return {
          state: {
            ...state,
            net: {
              phase: 'base',
              shownValue: config.netAmount,
              settleKey: state.net.settleKey + 1,
              settleMode: 'land',
            },
          },
          commands: [{ type: 'stopSpin' }],
        };
      }
      const row = state.rows[event.index];
      if (row === undefined) return { state, commands: [] };
      if (event.expectPhase === 'base') {
        if (row.phase !== 'spinning') return { state, commands: [] };
        return {
          state: withRow(state, event.index, {
            phase: 'base',
            shownValue: baseValue(config.rows[event.index]),
            settleKey: row.settleKey + 1,
            settleMode: 'land',
          }),
          commands: [{ type: 'stopSpin' }],
        };
      }
      if (event.expectPhase === 'multiplied') {
        if (row.phase !== 'chip') return { state, commands: [] };
        return {
          state: withRow(state, event.index, {
            phase: 'multiplied',
            shownValue: multipliedValue(config.rows[event.index]),
            settleKey: row.settleKey + 1,
            settleMode: 'odometer',
          }),
          commands: [],
        };
      }
      return { state, commands: [] };
    }

    case 'amountSettled': {
      if (event.generation !== state.generation) return { state, commands: [] };
      if (event.target === 'net') {
        if (state.net.phase !== 'base' || event.settleKey !== state.net.settleKey) {
          return { state, commands: [] };
        }
        // Thunk #1; the shell animates the slam and reports stampSettled.
        return {
          state: {
            ...state,
            net: { ...state.net, phase: 'complete' },
            stampPhase: 'slamming',
          },
          commands: [{ type: 'playThunk' }],
        };
      }
      const row = state.rows[event.index];
      const source = config.rows[event.index];
      if (row === undefined || source === undefined) return { state, commands: [] };
      if (event.settleKey !== row.settleKey) return { state, commands: [] };
      if (row.phase === 'base') {
        return settleRowBase(config, state, event.index);
      }
      if (row.phase === 'multiplied') {
        if (hasAdjacencyBeat(source)) {
          return {
            state: withRow(state, event.index, {
              phase: 'adjacency',
              shownValue: source.amount,
              settleKey: row.settleKey + 1,
              settleMode: 'adjacency',
            }),
            commands: [],
          };
        }
        const completed = withRow(state, event.index, { phase: 'complete' });
        return scheduleAdvance(config, completed);
      }
      if (row.phase === 'adjacency') {
        const completed = withRow(state, event.index, { phase: 'complete' });
        return scheduleAdvance(config, completed);
      }
      return { state, commands: [] };
    }

    case 'stampSettled': {
      if (event.generation !== state.generation) return { state, commands: [] };
      if (state.stampPhase !== 'slamming') return { state, commands: [] };
      return {
        state: {
          ...state,
          stampPhase: 'complete',
          status: 'reportComplete',
          cursor: { kind: 'done' },
        },
        commands: [{ type: 'playThunk' }],
      };
    }

    case 'tap': {
      if (state.status === 'reportComplete') return { state, commands: [] };
      const generation = state.generation + 1;
      const commands: MachineCommand[] = [
        { type: 'stopSpin' },
        { type: 'stopSurgeBed' },
        { type: 'playThunk' },
      ];
      if (state.cursor.kind === 'net' || state.cursor.kind === 'done') {
        // A tapped net coalesces the land and the stamp into one beat.
        return {
          state: {
            ...state,
            generation,
            net: {
              phase: 'complete',
              shownValue: config.netAmount,
              settleKey: state.net.settleKey + 1,
              settleMode: 'instant',
            },
            stampPhase: 'complete',
            status: 'reportComplete',
            cursor: { kind: 'done' },
          },
          commands,
        };
      }
      const index = state.cursor.index;
      const source = config.rows[index];
      let next: MachineState = { ...state, generation };
      next = withRow(next, index, {
        phase: 'complete',
        shownValue: source.amount,
        settleKey: state.rows[index].settleKey + 1,
        settleMode: 'instant',
      });
      next = enqueueBanner(next, source);
      const advanced = scheduleAdvance(config, next);
      return { state: advanced.state, commands: [...commands, ...advanced.commands] };
    }

    case 'bannerShown': {
      const head = state.bannerQueue[0];
      if (head === undefined || head.rowId !== event.rowId) return { state, commands: [] };
      return {
        state: { ...state, bannerQueue: state.bannerQueue.slice(1) },
        commands: [],
      };
    }
  }
}
