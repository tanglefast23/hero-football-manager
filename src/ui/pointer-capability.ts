import { Platform } from 'react-native';

/** Only the `matches` flag is read, so the DOM type is not needed here. */
type HoverQuery = { matches: boolean };

let hoverQuery: HoverQuery | null | undefined;

/**
 * True only where a pointer can rest on a control without pressing it.
 *
 * `Platform.OS === 'web'` used to stand in for that and is wrong on a tablet:
 * an iPad running the game as a home-screen PWA is 'web', and WebKit answers a
 * tap there with a synthetic mouse-hover sequence whose matching leave only
 * arrives on some later tap somewhere else. Every hover-only surface latched
 * on and stayed — nav tips stacked up over the tab bar with nothing held down.
 * The synthetic events report themselves as a mouse, so filtering on
 * `pointerType` cannot see them; the capability has to be asked about up front.
 *
 * The media query answers the real question, and touch-only iOS/iPadOS answers
 * no. The list is kept and re-read on each call rather than cached as a
 * boolean, so attaching a trackpad to a tablet brings hover back on the next
 * render without a listener.
 */
export function hasHoverPointer(): boolean {
  // Platform is resolved here, not at module scope: several UI tests mock
  // react-native without it and an import-time read breaks them at load (the
  // same trap documented on SfxPressable and useKeyBindings).
  if (Platform?.OS !== 'web') return false;
  if (hoverQuery === undefined) {
    hoverQuery =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(hover: hover)')
        : null;
  }
  // No matchMedia at all (jest, or a browser too old to answer): keep the
  // desktop behaviour rather than silently dropping hover everywhere.
  return hoverQuery === null ? true : hoverQuery.matches;
}
