import {
  DEFAULT_MACHINE_TIMINGS,
  createMachine,
  reduce,
  slotPhaseForRow,
} from '../financial-statement-machine';
import type {
  MachineCommand,
  MachineConfig,
  MachineEvent,
  MachineRow,
  MachineState,
} from '../financial-statement-machine';
import type { LedgerLineReveal } from '../../game/types';

type GateReveal = Extract<LedgerLineReveal, { source: 'league-gate' | 'cup-gate' }>;
type MerchReveal = Extract<LedgerLineReveal, { source: 'merch' }>;

const gateReveal = (over: Partial<GateReveal> = {}): LedgerLineReveal => ({
  source: 'league-gate',
  base: 1000,
  variancePercent: 5,
  surge: false,
  multiplierPercent: 200,
  facilityCount: 2,
  ...over,
});

const merchReveal = (over: Partial<MerchReveal> = {}): LedgerLineReveal => ({
  source: 'merch',
  base: 250,
  variancePercent: 5,
  surge: false,
  multiplierTimes: 3,
  facilityCount: 3,
  adjacencyPercent: 10,
  adjacencyAmount: 75,
  ...over,
});

function config(rows: MachineRow[], reduceMotion = false): MachineConfig {
  return {
    rows,
    netAmount: rows.reduce((sum, row) => sum + row.amount, 0),
    timings: DEFAULT_MACHINE_TIMINGS,
    reduceMotion,
  };
}

const plainRow = (id: string, amount: number): MachineRow => ({ id, amount });
const gateRow = (id: string, over: Parameters<typeof gateReveal>[0] = {}): MachineRow => {
  const reveal = gateReveal(over);
  if (reveal.source === 'merch') throw new Error('unreachable');
  const amount = reveal.base + Math.floor(reveal.base * (reveal.multiplierPercent - 100) / 100);
  return { id, amount, reveal };
};
const merchRow = (id: string, over: Parameters<typeof merchReveal>[0] = {}): MachineRow => {
  const reveal = merchReveal(over);
  if (reveal.source !== 'merch') throw new Error('unreachable');
  const amount = reveal.base * reveal.multiplierTimes + reveal.adjacencyAmount;
  return { id, amount, reveal };
};

/** Drives the machine by executing its own scheduled events synchronously. */
class Harness {
  state: MachineState;
  readonly log: MachineCommand[] = [];
  private queue: { afterMs: number; event: MachineEvent }[] = [];

  constructor(private readonly cfg: MachineConfig) {
    this.state = createMachine(cfg);
  }

  dispatch(event: MachineEvent): MachineCommand[] {
    const result = reduce(this.cfg, this.state, event);
    this.state = result.state;
    const emitted = [...result.commands];
    this.log.push(...emitted);
    for (const command of emitted) {
      if (command.type === 'schedule') this.queue.push({ afterMs: command.afterMs, event: command.event });
    }
    return emitted;
  }

  /** Pops and dispatches the next scheduled event, returning its delay. */
  fireNext(): number {
    const next = this.queue.shift();
    if (next === undefined) throw new Error('nothing scheduled');
    this.dispatch(next.event);
    return next.afterMs;
  }

  hasScheduled(): boolean {
    return this.queue.length > 0;
  }

  /** The digit reels report a settle through the shell; simulate it. */
  settleCurrent(): void {
    const cursor = this.state.cursor;
    if (cursor.kind === 'row') {
      const row = this.state.rows[cursor.index];
      this.dispatch({
        type: 'amountSettled',
        generation: this.state.generation,
        target: 'row',
        index: cursor.index,
        settleKey: row.settleKey,
      });
      return;
    }
    if (cursor.kind === 'net') {
      this.dispatch({
        type: 'amountSettled',
        generation: this.state.generation,
        target: 'net',
        settleKey: this.state.net.settleKey,
      });
      return;
    }
    throw new Error('nothing to settle');
  }

  runToCompletion(maxSteps = 200): void {
    for (let step = 0; step < maxSteps; step += 1) {
      if (this.state.status === 'reportComplete') return;
      if (this.hasScheduled()) {
        this.fireNext();
        continue;
      }
      // No timer pending: the shell would be animating a settle or the stamp.
      if (this.state.stampPhase === 'slamming') {
        this.dispatch({ type: 'stampSettled', generation: this.state.generation });
        continue;
      }
      this.settleCurrent();
    }
    throw new Error('machine never completed');
  }

  countCommands(type: MachineCommand['type']): number {
    return this.log.filter(command => command.type === type).length;
  }
}

describe('financial statement machine', () => {
  it('runs the happy path in order with one spin/stop/thunk per row and two net thunks', () => {
    const harness = new Harness(config([plainRow('wages', -3200), gateRow('gate')]));
    harness.dispatch({ type: 'start' });
    harness.runToCompletion();
    expect(harness.state.status).toBe('reportComplete');
    expect(harness.state.stampPhase).toBe('complete');
    // 2 rows + net = 3 spins/stops; thunks: one per row land + net land + stamp.
    expect(harness.countCommands('playSpin')).toBe(3);
    expect(harness.countCommands('stopSpin')).toBe(3);
    expect(harness.countCommands('playThunk')).toBe(4);
    expect(harness.state.rows.every(row => row.phase === 'complete')).toBe(true);
  });

  it('emits the base thunk on amountSettled, not on the spin timer', () => {
    const harness = new Harness(config([plainRow('wages', -3200)]));
    harness.dispatch({ type: 'start' });
    harness.fireNext(); // the spin -> base transition
    expect(harness.countCommands('playThunk')).toBe(0);
    expect(harness.countCommands('stopSpin')).toBe(1);
    harness.settleCurrent();
    expect(harness.countCommands('playThunk')).toBe(1);
  });

  it('ignores stale timers and stale settles entirely', () => {
    const harness = new Harness(config([gateRow('gate')]));
    harness.dispatch({ type: 'start' });
    const stale: MachineEvent = {
      type: 'timer',
      generation: harness.state.generation - 1,
      target: 'row',
      index: 0,
      expectPhase: 'base',
    };
    expect(harness.dispatch(stale)).toHaveLength(0);
    const staleSettle: MachineEvent = {
      type: 'amountSettled',
      generation: harness.state.generation,
      target: 'row',
      index: 0,
      settleKey: harness.state.rows[0].settleKey + 7,
    };
    expect(harness.dispatch(staleSettle)).toHaveLength(0);
  });

  it.each(['spinning', 'base', 'chip', 'multiplied', 'adjacency'] as const)(
    'a tap during the %s phase completes the row atomically with one thunk and one banner',
    phase => {
      const harness = new Harness(config([merchRow('merch', { surge: true, variancePercent: 15 })]));
      harness.dispatch({ type: 'start' });
      // Walk the row to the wanted phase using the machine's own flow.
      let guard = 0;
      while (harness.state.rows[0].phase !== phase) {
        if (guard++ > 20) throw new Error(`never reached ${phase}`);
        if (harness.hasScheduled()) harness.fireNext();
        else harness.settleCurrent();
      }
      const before = harness.countCommands('playThunk');
      const commands = harness.dispatch({ type: 'tap' });
      expect(harness.state.rows[0].phase).toBe('complete');
      expect(harness.state.rows[0].shownValue).toBe(825);
      expect(harness.state.rows[0].settleMode).toBe('instant');
      expect(harness.countCommands('playThunk')).toBe(before + 1);
      expect(commands.some(command => command.type === 'stopSpin')).toBe(true);
      expect(commands.some(command => command.type === 'stopSurgeBed')).toBe(true);
      // Exactly one banner for the surged row, no matter which phase the tap hit.
      expect(harness.state.bannerQueue).toHaveLength(1);
      expect(harness.state.bannersEnqueued).toEqual(['merch']);
      // The next row (the net) is scheduled.
      expect(harness.hasScheduled()).toBe(true);
    },
  );

  it('acts on the next row for each rapid tap, never re-completing the same row', () => {
    const harness = new Harness(config([plainRow('a', 100), plainRow('b', 200)]));
    harness.dispatch({ type: 'start' });
    harness.dispatch({ type: 'tap' }); // completes row a
    const thunksAfterFirst = harness.countCommands('playThunk');
    harness.dispatch({ type: 'tap' }); // must complete row b, not re-complete a
    expect(harness.state.rows[0].phase).toBe('complete');
    expect(harness.state.rows[1].phase).toBe('complete');
    expect(harness.countCommands('playThunk')).toBe(thunksAfterFirst + 1);
    harness.dispatch({ type: 'tap' }); // net
    expect(harness.state.status).toBe('reportComplete');
    // Done: further taps are no-ops.
    expect(harness.dispatch({ type: 'tap' })).toHaveLength(0);
  });

  it('coalesces a tapped net into one thunk with the stamp in the same reduction', () => {
    const harness = new Harness(config([]));
    harness.dispatch({ type: 'start' });
    const before = harness.countCommands('playThunk');
    harness.dispatch({ type: 'tap' });
    expect(harness.state.net.phase).toBe('complete');
    expect(harness.state.stampPhase).toBe('complete');
    expect(harness.state.status).toBe('reportComplete');
    expect(harness.countCommands('playThunk')).toBe(before + 1);
  });

  it('walks a full multiplier flow: base -> chip -> multiplied -> adjacency -> complete', () => {
    const harness = new Harness(config([merchRow('merch')]));
    harness.dispatch({ type: 'start' });
    const phases: string[] = [harness.state.rows[0].phase];
    let guard = 0;
    while (harness.state.rows[0].phase !== 'complete') {
      if (guard++ > 30) throw new Error('never completed');
      if (harness.hasScheduled()) harness.fireNext();
      else harness.settleCurrent();
      const phase = harness.state.rows[0].phase;
      if (phases[phases.length - 1] !== phase) phases.push(phase);
    }
    expect(phases).toEqual(['spinning', 'base', 'chip', 'multiplied', 'adjacency', 'complete']);
    // The shown values walk base -> multiplied -> final.
    expect(harness.state.rows[0].shownValue).toBe(825);
  });

  it('skips the chip for one shop with adjacency: base -> adjacency -> complete', () => {
    const harness = new Harness(config([
      merchRow('merch', { multiplierTimes: 1, facilityCount: 1, adjacencyAmount: 25 }),
    ]));
    harness.dispatch({ type: 'start' });
    const phases: string[] = [];
    let guard = 0;
    while (harness.state.rows[0].phase !== 'complete') {
      if (guard++ > 30) throw new Error('never completed');
      if (harness.hasScheduled()) harness.fireNext();
      else harness.settleCurrent();
      const phase = harness.state.rows[0].phase;
      if (phases[phases.length - 1] !== phase) phases.push(phase);
    }
    expect(phases).toEqual(['base', 'adjacency', 'complete']);
  });

  it('goes straight from base to complete for identity reveals', () => {
    const harness = new Harness(config([
      gateRow('gate', { multiplierPercent: 100, facilityCount: 0 }),
    ]));
    harness.dispatch({ type: 'start' });
    const phases: string[] = [];
    let guard = 0;
    while (harness.state.rows[0].phase !== 'complete') {
      if (guard++ > 30) throw new Error('never completed');
      if (harness.hasScheduled()) harness.fireNext();
      else harness.settleCurrent();
      const phase = harness.state.rows[0].phase;
      if (phases[phases.length - 1] !== phase) phases.push(phase);
    }
    expect(phases).toEqual(['base', 'complete']);
  });

  it('stretches a surged spin by the surge factor and fires its cues at the land', () => {
    const harness = new Harness(config([gateRow('gate', { surge: true, variancePercent: 15 })]));
    harness.dispatch({ type: 'start' });
    expect(harness.log.some(command => command.type === 'playSurgeIgnition')).toBe(true);
    const spinDelay = harness.fireNext(); // spin -> base
    expect(spinDelay).toBe(Math.round(
      DEFAULT_MACHINE_TIMINGS.rowSpinMs * DEFAULT_MACHINE_TIMINGS.surgeSpinFactor,
    ));
    // The bed keeps burning through the digit settle; it stops at the land.
    expect(harness.countCommands('stopSurgeBed')).toBe(0);
    expect(harness.state.bannerQueue).toHaveLength(0);
    harness.settleCurrent();
    expect(harness.countCommands('stopSurgeBed')).toBe(1);
    expect(harness.state.bannerQueue).toHaveLength(1);
  });

  it('starts an empty ledger directly on the net row', () => {
    const harness = new Harness(config([]));
    const commands = harness.dispatch({ type: 'start' });
    expect(harness.state.cursor).toEqual({ kind: 'net' });
    expect(harness.state.net.phase).toBe('spinning');
    expect(commands.some(command => command.type === 'playSpin')).toBe(true);
  });

  it('creates a reduce-motion machine fully complete with surged banners queued', () => {
    const rows = [
      gateRow('gate', { surge: true, variancePercent: 12 }),
      plainRow('wages', -3200),
      merchRow('merch', { surge: true, variancePercent: 18 }),
    ];
    const state = createMachine(config(rows, true));
    expect(state.status).toBe('reportComplete');
    expect(state.stampPhase).toBe('complete');
    expect(state.rows.every(row => row.phase === 'complete')).toBe(true);
    expect(state.net.phase).toBe('complete');
    expect(state.bannerQueue.map(banner => banner.rowId)).toEqual(['gate', 'merch']);
    expect(state.bannerQueue.map(banner => banner.kind)).toEqual(['attendance', 'merch']);
  });

  it('queues triple-surge banners FIFO in ledger order and dequeues only the head', () => {
    const rows = [
      gateRow('league', { surge: true, variancePercent: 12 }),
      gateRow('cup', { source: 'cup-gate', surge: true, variancePercent: 13 }),
      merchRow('merch', { surge: true, variancePercent: 14 }),
    ];
    const harness = new Harness(config(rows));
    harness.dispatch({ type: 'start' });
    harness.runToCompletion();
    expect(harness.state.bannerQueue.map(banner => banner.rowId)).toEqual(['league', 'cup', 'merch']);
    // A stale dismissal for a non-head banner is ignored.
    expect(harness.dispatch({ type: 'bannerShown', rowId: 'merch' })).toHaveLength(0);
    expect(harness.state.bannerQueue).toHaveLength(3);
    harness.dispatch({ type: 'bannerShown', rowId: 'league' });
    expect(harness.state.bannerQueue.map(banner => banner.rowId)).toEqual(['cup', 'merch']);
  });

  it('maps row phases onto slot phases', () => {
    expect(slotPhaseForRow('pending')).toBe('pending');
    expect(slotPhaseForRow('spinning')).toBe('spinning');
    expect(slotPhaseForRow('base')).toBe('settled');
    expect(slotPhaseForRow('chip')).toBe('settled');
    expect(slotPhaseForRow('multiplied')).toBe('settled');
    expect(slotPhaseForRow('adjacency')).toBe('settled');
    expect(slotPhaseForRow('complete')).toBe('settled');
  });
});
