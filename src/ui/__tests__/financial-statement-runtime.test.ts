import { DEFAULT_MACHINE_TIMINGS } from '../financial-statement-machine';
import type { MachineConfig } from '../financial-statement-machine';
import { createStatementRuntime } from '../financial-statement-runtime';
import type { RuntimeAudio } from '../financial-statement-runtime';

function fakeAudio(): RuntimeAudio & { calls: Record<string, number> } {
  const calls: Record<string, number> = {
    playSpin: 0, stopSpin: 0, playThunk: 0, playSurgeIgnition: 0, stopSurgeBed: 0, stopAll: 0,
  };
  return {
    calls,
    playSpin: () => { calls.playSpin += 1; },
    stopSpin: () => { calls.stopSpin += 1; },
    playThunk: () => { calls.playThunk += 1; },
    playSurgeIgnition: () => { calls.playSurgeIgnition += 1; },
    stopSurgeBed: () => { calls.stopSurgeBed += 1; },
    stopAll: () => { calls.stopAll += 1; },
  };
}

function twoRowConfig(): MachineConfig {
  return {
    rows: [
      { id: 'a', amount: 100 },
      { id: 'b', amount: 200 },
    ],
    netAmount: 300,
    timings: DEFAULT_MACHINE_TIMINGS,
    reduceMotion: false,
  };
}

describe('financial statement runtime', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('advances the machine through real timers', () => {
    const audio = fakeAudio();
    const states: string[] = [];
    const runtime = createStatementRuntime({
      config: twoRowConfig(),
      audio,
      onState: state => states.push(state.rows[0]?.phase ?? 'none'),
    });
    runtime.dispatch({ type: 'start' });
    expect(runtime.getState().rows[0].phase).toBe('spinning');
    expect(audio.calls.playSpin).toBe(1);
    jest.advanceTimersByTime(DEFAULT_MACHINE_TIMINGS.rowSpinMs);
    expect(runtime.getState().rows[0].phase).toBe('base');
    expect(audio.calls.stopSpin).toBe(1);
    expect(states.length).toBeGreaterThanOrEqual(2);
  });

  it('acts on consecutive rows for two synchronous taps (authoritative ref)', () => {
    const audio = fakeAudio();
    const runtime = createStatementRuntime({
      config: twoRowConfig(),
      audio,
      onState: () => {},
    });
    runtime.dispatch({ type: 'start' });
    runtime.dispatch({ type: 'tap' });
    runtime.dispatch({ type: 'tap' });
    expect(runtime.getState().rows[0].phase).toBe('complete');
    expect(runtime.getState().rows[1].phase).toBe('complete');
    expect(audio.calls.playThunk).toBe(2);
  });

  it('dispose clears pending timers, suppresses callbacks, and stops audio once', () => {
    const audio = fakeAudio();
    const runtime = createStatementRuntime({
      config: twoRowConfig(),
      audio,
      onState: () => {},
    });
    runtime.dispatch({ type: 'start' });
    const before = runtime.getState();
    runtime.dispose();
    runtime.dispose(); // double-dispose is safe
    jest.advanceTimersByTime(60_000);
    expect(runtime.getState()).toBe(before); // nothing ran after disposal
    expect(audio.calls.stopAll).toBe(1);
    expect(jest.getTimerCount()).toBe(0);
    // Dispatch after disposal is inert.
    runtime.dispatch({ type: 'tap' });
    expect(audio.calls.playThunk).toBe(0);
  });

  it('suppresses a callback already dequeued when disposal raced it', () => {
    const audio = fakeAudio();
    // An injected setTimeout that runs callbacks manually lets the test dispose
    // between the schedule and the callback's execution.
    const queued: Array<() => void> = [];
    const runtime = createStatementRuntime({
      config: twoRowConfig(),
      audio,
      onState: () => {},
      setTimeoutFn: (callback: () => void) => {
        queued.push(callback);
        return 0 as unknown as ReturnType<typeof setTimeout>;
      },
      clearTimeoutFn: () => {},
    });
    runtime.dispatch({ type: 'start' });
    const before = runtime.getState();
    runtime.dispose();
    for (const callback of queued) callback(); // the "already dequeued" callbacks
    expect(runtime.getState()).toBe(before);
    expect(audio.calls.stopSpin).toBe(0);
  });
});
