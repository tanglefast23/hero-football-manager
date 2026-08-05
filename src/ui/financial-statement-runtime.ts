import type {
  MachineCommand,
  MachineConfig,
  MachineEvent,
  MachineState,
} from './financial-statement-machine';
import { createMachine, reduce } from './financial-statement-machine';

/**
 * The RN-free executor between the pure machine and the component: it owns
 * the authoritative state ref, runs reductions synchronously against it, and
 * executes the returned commands. Reducing against closed-over React state
 * would let two batched presses act on the same row; running commands inside
 * a functional updater risks duplicate effects under Strict Mode — so the
 * component only ever calls `dispatch` and renders the published snapshots.
 */

export interface RuntimeAudio {
  playSpin(): void;
  stopSpin(): void;
  playThunk(): void;
  playSurgeIgnition(): void;
  stopSurgeBed(): void;
  stopAll(): void;
}

export interface StatementRuntime {
  dispatch(event: MachineEvent): void;
  /** Clears every pending timer, suppresses in-flight callbacks, stops audio once. */
  dispose(): void;
  getState(): MachineState;
}

/** Opaque so node's Timeout and react-native's numeric handles both fit. */
type TimerHandle = unknown;

export function createStatementRuntime(options: {
  config: MachineConfig;
  audio: RuntimeAudio;
  onState: (state: MachineState) => void;
  setTimeoutFn?: (callback: () => void, ms: number) => TimerHandle;
  clearTimeoutFn?: (handle: TimerHandle) => void;
}): StatementRuntime {
  const { config, audio, onState } = options;
  const setTimeoutFn = options.setTimeoutFn
    ?? ((callback: () => void, ms: number): TimerHandle => setTimeout(callback, ms));
  const clearTimeoutFn = options.clearTimeoutFn
    ?? ((handle: TimerHandle): void => clearTimeout(handle as Parameters<typeof clearTimeout>[0]));

  let state = createMachine(config);
  let disposed = false;
  const pending = new Set<TimerHandle>();

  function execute(commands: readonly MachineCommand[]): void {
    for (const command of commands) {
      switch (command.type) {
        case 'schedule': {
          const handle = setTimeoutFn(() => {
            pending.delete(handle);
            if (disposed) return;
            dispatch(command.event);
          }, command.afterMs);
          pending.add(handle);
          break;
        }
        case 'playSpin': audio.playSpin(); break;
        case 'stopSpin': audio.stopSpin(); break;
        case 'playThunk': audio.playThunk(); break;
        case 'playSurgeIgnition': audio.playSurgeIgnition(); break;
        case 'stopSurgeBed': audio.stopSurgeBed(); break;
      }
    }
  }

  function dispatch(event: MachineEvent): void {
    if (disposed) return;
    // Reduce against the authoritative ref, replace it synchronously, publish
    // the snapshot, and only then execute commands.
    const result = reduce(config, state, event);
    state = result.state;
    onState(state);
    execute(result.commands);
  }

  return {
    dispatch,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      for (const handle of pending) clearTimeoutFn(handle);
      pending.clear();
      audio.stopAll();
    },
    getState: () => state,
  };
}
