let mockCleanup: (() => void) | undefined;
const mockStep = jest.fn();
let mockStepsRemaining = 100;

jest.mock('react', () => ({
  useEffect: (effect: () => (() => void) | undefined) => {
    mockCleanup = effect();
  },
}));
jest.mock('../../application/rival-preload', () => ({
  createPreloadPump: () => ({
    get done() {
      return mockStepsRemaining === 0;
    },
    step: () => {
      mockStep();
      mockStepsRemaining -= 1;
    },
  }),
}));

import { useRivalPreload } from '../use-rival-preload';
import type { LeagueFixture } from '../../game/types';

describe('rival preload scheduling', () => {
  const host = globalThis as {
    requestIdleCallback?: (
      run: (deadline: {
        didTimeout?: boolean;
        timeRemaining: () => number;
      }) => void,
    ) => number;
    cancelIdleCallback?: (handle: number) => void;
  };
  const originalRequest = host.requestIdleCallback;
  const originalCancel = host.cancelIdleCallback;
  beforeEach(() => {
    jest.useFakeTimers();
    mockStep.mockClear();
    mockStepsRemaining = 100;
    delete host.requestIdleCallback;
    delete host.cancelIdleCallback;
  });

  afterEach(() => {
    mockCleanup?.();
    mockCleanup = undefined;
    jest.restoreAllMocks();
    jest.useRealTimers();
    host.requestIdleCallback = originalRequest;
    host.cancelIdleCallback = originalCancel;
  });

  it.each([false, true])(
    'makes bounded timer progress when requestIdleCallback is absent (watching=%s)',
    (watching) => {
      let now = 0;
      jest.spyOn(performance, 'now').mockImplementation(() => now++);
      useRivalPreload('matchday', [{} as LeagueFixture], {}, watching);

      jest.advanceTimersByTime(500);

      expect(mockStep.mock.calls.length).toBeGreaterThan(0);
      expect(mockStep.mock.calls.length).toBeLessThan(100);
      mockCleanup?.();
      const completed = mockStep.mock.calls.length;
      jest.advanceTimersByTime(2000);
      expect(mockStep).toHaveBeenCalledTimes(completed);
    },
  );

  it('makes one burst on a timed-out native idle callback and cancels the next one', () => {
    let callback:
      | ((deadline: {
          didTimeout: boolean;
          timeRemaining: () => number;
        }) => void)
      | undefined;
    const schedule = jest.fn((run) => {
      callback = run;
      return 42;
    });
    const cancel = jest.fn();
    host.requestIdleCallback = schedule;
    host.cancelIdleCallback = cancel;
    useRivalPreload('matchday', [{} as LeagueFixture], {}, true);

    callback!({ didTimeout: true, timeRemaining: () => 0 });

    expect(mockStep).toHaveBeenCalledTimes(1);
    expect(schedule).toHaveBeenCalledTimes(2);
    mockCleanup?.();
    expect(cancel).toHaveBeenCalledWith(42);
    callback!({ didTimeout: true, timeRemaining: () => 50 });
    expect(mockStep).toHaveBeenCalledTimes(1);
  });

  it('bounds a generous native idle deadline by elapsed time', () => {
    let now = 0;
    jest.spyOn(performance, 'now').mockImplementation(() => now++);
    host.requestIdleCallback = jest.fn((run) => {
      setTimeout(() => run({ timeRemaining: () => 50 }), 500);
      return 1;
    });
    useRivalPreload('matchday', [{} as LeagueFixture], {}, false);
    jest.advanceTimersByTime(500);
    expect(mockStep.mock.calls.length).toBeGreaterThan(0);
    expect(mockStep.mock.calls.length).toBeLessThan(100);
  });
});
