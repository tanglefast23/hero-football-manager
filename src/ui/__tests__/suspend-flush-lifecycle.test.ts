import {
  subscribeToNativeSuspend,
  type NativeAppStateLike,
} from '../suspend-flush-lifecycle';

describe('native career-save flush lifecycle', () => {
  it('flushes on inactive and background, but not while active', () => {
    const listeners = new Set<
      (
        state: Parameters<
          Parameters<NativeAppStateLike['addEventListener']>[1]
        >[0],
      ) => void
    >();
    const appState: NativeAppStateLike = {
      addEventListener(_type, listener) {
        listeners.add(listener);
        return { remove: () => listeners.delete(listener) };
      },
    };
    const flush = jest.fn();

    const cleanup = subscribeToNativeSuspend(appState, flush);
    for (const listener of listeners) listener('active');
    for (const listener of listeners) listener('unknown');
    expect(flush).not.toHaveBeenCalled();

    for (const listener of listeners) listener('inactive');
    for (const listener of listeners) listener('background');
    expect(flush).toHaveBeenCalledTimes(2);

    cleanup?.();
    expect(listeners.size).toBe(0);
  });

  it('fails soft when a test or host does not provide AppState', () => {
    expect(subscribeToNativeSuspend(undefined, jest.fn())).toBeUndefined();
  });
});
