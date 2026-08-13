import type { LedgerLineReveal } from '../game/types';

/**
 * The Financial Report's reveal sequencer as a pure reducer (spec §4): rows
 * spin and land in reveal groups, multiplied rows walk their chip/odometer/
 * adjacency beats, the net row slams the stamp, and a tap completes the
 * current group atomically. No React, no timers, no audio — the machine
 * consumes events and RETURNS commands; the runtime executes them. That is
 * what makes the riskiest logic in the feature testable headless.
 *
 * Reveal groups: short statements reveal one row at a time. From
 * PAIRING_THRESHOLD rows, the money-star rows (anything carrying a reveal)
 * still reveal solo while runs of constant rows reveal two at a time, a lone
 * odd row closing a run by itself — a long sponsor-week ledger stays brisk
 * without stealing the gate's spotlight (owner revision, 2026-08-06).
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

/** Ledgers at or past this row count reveal their constant rows in pairs. */
export const PAIRING_THRESHOLD = 8;

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
  { kind: 'group'; index: number } | { kind: 'net' } | { kind: 'done' };

export interface BannerEvent {
  rowId: string;
  kind: 'attendance' | 'merch';
  /** What the surge added versus a typical 0% week — the banner's headline number. */
  bonusAmount: number;
}

export interface MachineState {
  generation: number;
  rows: readonly RowRuntime[];
  net: NetRuntime;
  stampPhase: 'hidden' | 'slamming' | 'complete';
  status: 'running' | 'reportComplete';
  cursor: MachineCursor;
  /** Reveal order: each group is one or two row indices revealed together. */
  groups: readonly (readonly number[])[];
  bannerQueue: readonly BannerEvent[];
  bannersEnqueued: readonly string[];
}

export type MachineEvent =
  | { type: 'start' }
  | {
      type: 'timer';
      generation: number;
      expectPhase: RowPhase | 'advance';
      target: 'group' | 'net';
      index: number; // group index; ignored for net
    }
  | {
      type: 'amountSettled';
      generation: number;
      settleKey: number;
      target: 'row' | 'net';
      index: number; // row index; ignored for net
    }
  | { type: 'stampSettled'; generation: number }
  | { type: 'tap' }
  /**
   * Ends the whole reveal at once: every row on its final amount, the net on
   * its total, the stamp down. `tap` deliberately lands only the group under
   * the cursor — a tap on the panel means "next", and walking the statement a
   * beat at a time is the reveal. This is the other request, the one the
   * report's own Continue button makes: "I am leaving, show me the total."
   */
  | { type: 'skipAll' }
  | { type: 'bannerShown'; rowId: string };

export type MachineCommand =
  | { type: 'schedule'; afterMs: number; event: MachineEvent }
  | { type: 'playSpin' }
  | { type: 'stopSpin' }
  | { type: 'playThunk' }
  | { type: 'playSurgeIgnition' }
  | { type: 'stopSurgeBed' };

export function slotPhaseForRow(
  phase: RowPhase,
): 'pending' | 'spinning' | 'settled' {
  if (phase === 'pending') return 'pending';
  if (phase === 'spinning') return 'spinning';
  return 'settled';
}

/**
 * Reveal order for a statement: singleton groups for every row below the
 * pairing threshold; at or above it, reveal-carrying rows stay solo and each
 * consecutive run of constant rows pairs up, odd tail solo.
 */
export function buildRevealGroups(
  rows: readonly MachineRow[],
): (readonly number[])[] {
  if (rows.length < PAIRING_THRESHOLD) {
    return rows.map((_row, index) => [index]);
  }
  const groups: number[][] = [];
  let run: number[] = [];
  const flushRun = () => {
    for (let cursor = 0; cursor + 1 < run.length; cursor += 2) {
      groups.push([run[cursor], run[cursor + 1]]);
    }
    if (run.length % 2 === 1) groups.push([run[run.length - 1]]);
    run = [];
  };
  rows.forEach((row, index) => {
    if (row.reveal !== undefined) {
      flushRun();
      groups.push([index]);
    } else {
      run.push(index);
    }
  });
  flushRun();
  return groups;
}

/**
 * What the surge added versus a typical (0%) week, recovered from the stored
 * reveal. The pre-variance base is not persisted, but the rounding round-trip
 * recovers it exactly for the shipped bands.
 */
export function surgeBonusAmount(row: MachineRow): number {
  const reveal = row.reveal;
  if (reveal === undefined || !reveal.surge) return 0;
  const raw = Math.round((reveal.base * 100) / (100 + reveal.variancePercent));
  if (reveal.source === 'merch') {
    const zeroAfterMultiplier = Math.floor(
      (raw * merchMultiplierPercent(reveal)) / 100,
    );
    const zeroAmount =
      zeroAfterMultiplier +
      Math.floor((zeroAfterMultiplier * reveal.adjacencyPercent) / 100);
    return row.amount - zeroAmount;
  }
  const zeroAmount =
    raw + Math.floor((raw * (reveal.multiplierPercent - 100)) / 100);
  return row.amount - zeroAmount;
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
  return reveal.source === 'merch'
    ? merchMultiplierPercent(reveal) > 100
    : reveal.multiplierPercent > 100;
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
  if (reveal.source === 'merch')
    return Math.floor((reveal.base * merchMultiplierPercent(reveal)) / 100);
  return row.amount;
}

function merchMultiplierPercent(
  reveal: Extract<LedgerLineReveal, { source: 'merch' }>,
): number {
  return reveal.multiplierPercent ?? reveal.multiplierTimes * 100;
}

export function createMachine(config: MachineConfig): MachineState {
  const groups = buildRevealGroups(config.rows);
  if (config.reduceMotion) {
    // Everything lands instantly; surged banners still queue (spec §4 — they
    // are information, not decoration).
    const surged = config.rows.filter(isSurged);
    return {
      generation: 0,
      rows: config.rows.map((row) => ({
        phase: 'complete',
        shownValue: row.amount,
        settleKey: 0,
        settleMode: 'instant',
      })),
      net: {
        phase: 'complete',
        shownValue: config.netAmount,
        settleKey: 0,
        settleMode: 'instant',
      },
      stampPhase: 'complete',
      status: 'reportComplete',
      cursor: { kind: 'done' },
      groups,
      bannerQueue: surged.map((row) => ({
        rowId: row.id,
        kind: bannerKind(row),
        bonusAmount: surgeBonusAmount(row),
      })),
      bannersEnqueued: surged.map((row) => row.id),
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
    net: {
      phase: 'pending',
      shownValue: 0,
      settleKey: 0,
      settleMode: 'instant',
    },
    stampPhase: 'hidden',
    status: 'running',
    cursor: groups.length > 0 ? { kind: 'group', index: 0 } : { kind: 'net' },
    groups,
    bannerQueue: [],
    bannersEnqueued: [],
  };
}

interface Reduction {
  state: MachineState;
  commands: readonly MachineCommand[];
}

function withRow(
  state: MachineState,
  index: number,
  patch: Partial<RowRuntime>,
): MachineState {
  return {
    ...state,
    rows: state.rows.map((row, rowIndex) =>
      rowIndex === index ? { ...row, ...patch } : row,
    ),
  };
}

function enqueueBanner(state: MachineState, row: MachineRow): MachineState {
  if (!isSurged(row) || state.bannersEnqueued.includes(row.id)) return state;
  return {
    ...state,
    bannerQueue: [
      ...state.bannerQueue,
      {
        rowId: row.id,
        kind: bannerKind(row),
        bonusAmount: surgeBonusAmount(row),
      },
    ],
    bannersEnqueued: [...state.bannersEnqueued, row.id],
  };
}

/** Starts spinning whatever the cursor points at; done cursors finish silently. */
function enterCursor(config: MachineConfig, state: MachineState): Reduction {
  const commands: MachineCommand[] = [];
  if (state.cursor.kind === 'group') {
    const groupIndex = state.cursor.index;
    const group = state.groups[groupIndex];
    if (group === undefined) return { state, commands: [] };
    const surge = group.some((rowIndex) => isSurged(config.rows[rowIndex]));
    const spinMs = surge
      ? Math.round(config.timings.rowSpinMs * config.timings.surgeSpinFactor)
      : config.timings.rowSpinMs;
    commands.push({ type: 'playSpin' });
    if (surge) commands.push({ type: 'playSurgeIgnition' });
    commands.push({
      type: 'schedule',
      afterMs: spinMs,
      event: {
        type: 'timer',
        generation: state.generation,
        target: 'group',
        index: groupIndex,
        expectPhase: 'base',
      },
    });
    let next = state;
    for (const rowIndex of group)
      next = withRow(next, rowIndex, { phase: 'spinning' });
    return { state: next, commands };
  }
  if (state.cursor.kind === 'net') {
    commands.push({ type: 'playSpin' });
    commands.push({
      type: 'schedule',
      afterMs: config.timings.netSpinMs,
      event: {
        type: 'timer',
        generation: state.generation,
        target: 'net',
        index: 0,
        expectPhase: 'base',
      },
    });
    return {
      state: { ...state, net: { ...state.net, phase: 'spinning' } },
      commands,
    };
  }
  return { state, commands: [] };
}

/** Advances the cursor past the current group and schedules the next entrance. */
function scheduleAdvance(
  config: MachineConfig,
  state: MachineState,
): Reduction {
  const nextCursor: MachineCursor =
    state.cursor.kind === 'group'
      ? state.cursor.index + 1 < state.groups.length
        ? { kind: 'group', index: state.cursor.index + 1 }
        : { kind: 'net' }
      : { kind: 'done' };
  const advanced: MachineState = { ...state, cursor: nextCursor };
  if (nextCursor.kind === 'done') {
    return { state: advanced, commands: [] };
  }
  return {
    state: advanced,
    commands: [
      {
        type: 'schedule',
        afterMs: config.timings.interRowMs,
        event: {
          type: 'timer',
          generation: state.generation,
          target: nextCursor.kind === 'group' ? 'group' : 'net',
          index: nextCursor.kind === 'group' ? nextCursor.index : 0,
          expectPhase: 'advance',
        },
      },
    ],
  };
}

/** The current group's indices, or undefined when the cursor is off rows. */
function currentGroup(state: MachineState): readonly number[] | undefined {
  return state.cursor.kind === 'group'
    ? state.groups[state.cursor.index]
    : undefined;
}

/**
 * A settled base beat for one row of the current group: thunk on the group's
 * first land, surge stop + banner for surged rows, sub-phase walk for
 * multiplied rows, advance once every row in the group is complete.
 */
function settleRowBase(
  config: MachineConfig,
  state: MachineState,
  index: number,
): Reduction {
  const row = config.rows[index];
  const group = currentGroup(state) ?? [index];
  const partnersComplete = group.every(
    (rowIndex) =>
      rowIndex === index || state.rows[rowIndex].phase === 'complete',
  );
  const firstLandOfGroup =
    group.every(
      (rowIndex) =>
        rowIndex === index || state.rows[rowIndex].phase !== 'complete',
    ) || group.length === 1;
  const commands: MachineCommand[] = firstLandOfGroup
    ? [{ type: 'playThunk' }]
    : [];
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
      event: {
        type: 'timer',
        generation: next.generation,
        target: 'group',
        index: next.cursor.kind === 'group' ? next.cursor.index : 0,
        expectPhase: 'multiplied',
      },
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
  if (!partnersComplete) {
    return { state: next, commands };
  }
  const advanced = scheduleAdvance(config, next);
  return {
    state: advanced.state,
    commands: [...commands, ...advanced.commands],
  };
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
      const group = state.groups[event.index];
      if (group === undefined) return { state, commands: [] };
      if (event.expectPhase === 'base') {
        if (
          !group.every((rowIndex) => state.rows[rowIndex].phase === 'spinning')
        ) {
          return { state, commands: [] };
        }
        let next = state;
        for (const rowIndex of group) {
          next = withRow(next, rowIndex, {
            phase: 'base',
            shownValue: baseValue(config.rows[rowIndex]),
            settleKey: state.rows[rowIndex].settleKey + 1,
            settleMode: 'land',
          });
        }
        return { state: next, commands: [{ type: 'stopSpin' }] };
      }
      if (event.expectPhase === 'multiplied') {
        // Multiplied rows are always singleton groups.
        const rowIndex = group[0];
        const row = state.rows[rowIndex];
        if (row === undefined || row.phase !== 'chip')
          return { state, commands: [] };
        return {
          state: withRow(state, rowIndex, {
            phase: 'multiplied',
            shownValue: multipliedValue(config.rows[rowIndex]),
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
        if (
          state.net.phase !== 'base' ||
          event.settleKey !== state.net.settleKey
        ) {
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
      if (row === undefined || source === undefined)
        return { state, commands: [] };
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
      const group = state.groups[state.cursor.index] ?? [];
      let next: MachineState = { ...state, generation };
      for (const rowIndex of group) {
        const source = config.rows[rowIndex];
        next = withRow(next, rowIndex, {
          phase: 'complete',
          shownValue: source.amount,
          settleKey: state.rows[rowIndex].settleKey + 1,
          settleMode: 'instant',
        });
        next = enqueueBanner(next, source);
      }
      const advanced = scheduleAdvance(config, next);
      return {
        state: advanced.state,
        commands: [...commands, ...advanced.commands],
      };
    }

    case 'skipAll': {
      if (state.status === 'reportComplete') return { state, commands: [] };
      // Generation bumped so every scheduled spin/advance timer still in flight
      // reduces to nothing, exactly as `tap` does.
      const surged = config.rows.filter(isSurged);
      return {
        state: {
          ...state,
          generation: state.generation + 1,
          rows: state.rows.map((row, index) => ({
            ...row,
            phase: 'complete',
            shownValue: config.rows[index].amount,
            settleKey: row.settleKey + 1,
            settleMode: 'instant',
          })),
          net: {
            phase: 'complete',
            shownValue: config.netAmount,
            settleKey: state.net.settleKey + 1,
            settleMode: 'instant',
          },
          stampPhase: 'complete',
          status: 'reportComplete',
          cursor: { kind: 'done' },
          // Surge banners are information, not decoration (spec §4): skipping
          // the animation must not skip a number the manager never saw.
          bannerQueue: [
            ...state.bannerQueue,
            ...surged
              .filter((row) => !state.bannersEnqueued.includes(row.id))
              .map((row) => ({
                rowId: row.id,
                kind: bannerKind(row),
                bonusAmount: surgeBonusAmount(row),
              })),
          ],
          bannersEnqueued: surged.map((row) => row.id),
        },
        commands: [
          { type: 'stopSpin' },
          { type: 'stopSurgeBed' },
          { type: 'playThunk' },
        ],
      };
    }

    case 'bannerShown': {
      const head = state.bannerQueue[0];
      if (head === undefined || head.rowId !== event.rowId)
        return { state, commands: [] };
      return {
        state: { ...state, bannerQueue: state.bannerQueue.slice(1) },
        commands: [],
      };
    }
  }
}
