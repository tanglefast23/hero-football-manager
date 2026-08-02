import { useCallback, useEffect, useState } from 'react';
import {
  formatDevHarnessHash,
  parseDevHarnessHash,
  type DevHarnessRoute,
} from './route';

/**
 * The location hash, on the one platform that has one.
 *
 * Feature-detected rather than gated on `Platform.OS`: React Native defines a
 * global `window` but no `window.location`, so asking for the thing itself is
 * both shorter and honest about what is missing. On native every function here
 * is inert — the harness holds its route in state and the address bar simply
 * does not exist, which is the whole of "degrades harmlessly".
 */
function hashLocation(): Location | undefined {
  if (typeof window === 'undefined') return undefined;
  const { location } = window;
  return typeof location?.hash === 'string' ? location : undefined;
}

export interface DevHarnessHash {
  readonly route: DevHarnessRoute;
  /** Navigate, leaving a history entry so the browser's Back works. */
  readonly push: (route: DevHarnessRoute) => void;
  /**
   * Correct the address in place, without a history entry.
   *
   * Used when what is on screen and what the hash says have parted company —
   * a stale bookmark that fell back to the menu, or an entry named with no
   * case. Leaving a history entry for a correction the reviewer did not ask
   * for would make Back walk into the bad address again.
   */
  readonly replace: (route: DevHarnessRoute) => void;
}

/**
 * The harness's live address.
 *
 * Seeded from the hash at first render, so a cold load of
 * `#/dev/awards-ceremony/sweep` opens on that state rather than opening the
 * menu and correcting itself a frame later.
 */
export function useHarnessHash(): DevHarnessHash {
  const [route, setRoute] = useState<DevHarnessRoute>(() => {
    const location = hashLocation();
    return location === undefined ? {} : parseDevHarnessHash(location.hash);
  });

  useEffect(() => {
    const location = hashLocation();
    if (location === undefined) return undefined;

    const onHashChange = () => setRoute(parseDevHarnessHash(location.hash));
    // Anything can have moved the hash between first render and this effect —
    // a redirect, a restored session. Re-read once before listening.
    onHashChange();

    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const push = useCallback((next: DevHarnessRoute) => {
    setRoute(next);
    const location = hashLocation();
    const hash = formatDevHarnessHash(next);
    if (location !== undefined && location.hash !== hash) location.hash = hash;
  }, []);

  const replace = useCallback((next: DevHarnessRoute) => {
    setRoute(next);
    const location = hashLocation();
    const hash = formatDevHarnessHash(next);
    if (location === undefined || location.hash === hash) return;
    // replaceState keeps the path and query and fires no hashchange, so the
    // correction cannot bounce back through the listener above.
    if (typeof window.history?.replaceState === 'function') {
      window.history.replaceState(null, '', hash);
    } else {
      location.hash = hash;
    }
  }, []);

  return { route, push, replace };
}
