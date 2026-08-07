import { useEffect } from 'react';
import { Platform } from 'react-native';
import { flushPendingCareerSave } from '../application/store';

/**
 * True only where the page-lifecycle events the hook below listens for actually
 * exist. React Native defines a global `window` but no `document`, and a static
 * web export prerenders in Node with neither, so both targets are asked for by
 * capability rather than inferred from the platform — the discipline
 * audio-lifecycle.ts and pointer-capability.ts already follow.
 */
function hasPageLifecycleDom(): boolean {
  const page = typeof document === 'undefined' ? undefined : document;
  const view = typeof window === 'undefined' ? undefined : window;
  return typeof page?.addEventListener === 'function'
    && typeof view?.addEventListener === 'function';
}

/**
 * Writes any queued career save the moment the app is hidden. Web only.
 *
 * iOS can kill a backgrounded web app — the game installed to an iPad home
 * screen is exactly that — without ever telling the page. The save queue is
 * serial, so a completed action's write can still be sitting behind a long one
 * when that happens, and the action is gone. `visibilitychange` is the signal
 * every iOS browser gives; `pagehide` covers the navigation/terminate case that
 * `beforeunload` is unreliable for on iOS.
 *
 * Deliberately does not tear anything down: a page restored from the
 * back-forward cache never re-mounts React, so the store and the save queue must
 * still be live and usable afterwards.
 */
export function useSuspendFlush(): void {
  useEffect(() => {
    // Platform is resolved here, not at module scope: several UI tests mock
    // react-native without it (the trap documented on SfxPressable). It is a
    // cheap first read, not the safety check — 'web' still covers a prerender
    // with no DOM, so both listener targets are feature-detected below.
    if (Platform?.OS !== 'web' || !hasPageLifecycleDom()) return undefined;

    const flush = () => {
      // Fire and forget: a hidden page may not get to finish, and there is
      // nothing useful to do with the promise here.
      void flushPendingCareerSave();
    };
    const onVisibilityChange = () => {
      if (document.hidden) flush();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', flush);
    };
  }, []);
}
