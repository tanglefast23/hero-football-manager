type NativeAppStateStatus =
  'active' | 'background' | 'inactive' | 'unknown' | 'extension';

export interface NativeAppStateLike {
  addEventListener(
    type: 'change',
    listener: (state: NativeAppStateStatus) => void,
  ): { remove(): void };
}

/**
 * Connects React Native's lifecycle to the queue-jumping career-save flush.
 * Both iOS transitions away from the foreground are handled: `inactive` can
 * be the last event delivered before suspension, while Android commonly goes
 * straight to `background`.
 */
export function subscribeToNativeSuspend(
  appState: NativeAppStateLike | undefined,
  flush: () => void,
): (() => void) | undefined {
  if (typeof appState?.addEventListener !== 'function') return undefined;

  const subscription = appState.addEventListener('change', (state) => {
    if (state === 'inactive' || state === 'background') flush();
  });
  return () => subscription.remove();
}
