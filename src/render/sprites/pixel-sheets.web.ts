// Web override of `pixel-sheets.ts`: 3.3 MB of pixel rows as their own chunks
// instead of 3.3 MB of object literal in front of first paint.
//
// Same shape as `src/i18n/load-catalogs.ts` — one cached promise plus a
// synchronous peek for callers that have already seen it resolve. `App` calls
// `prefetchPixelSheets()` at module eval, while the title is still drawing its
// own 14 KB `title-sprites.json` subset, so the sheets are resident long
// before any in-game surface renders.
//
// The two load together on purpose. They are the same asset class, they are
// wanted at the same moment, and one ready-state is easier to reason about
// than two racing ones.
import type {
  MatchSpriteSheet,
  PixelSheets,
  PortraitSheetData,
} from './sprite-runs';

export type { PixelSheets };

let loaded: PixelSheets | undefined;
let pending: Promise<PixelSheets> | undefined;

export function peekPixelSheets(): PixelSheets | undefined {
  return loaded;
}

export function loadPixelSheets(): Promise<PixelSheets> {
  // Clearing `pending` on failure is the load-bearing half. Without it a
  // single failed fetch is cached as a rejected promise for the life of the
  // page: every later caller gets the same rejection, and `React.lazy` keeps
  // its dead factory, so a match screen that lost one chunk stays dead until a
  // full reload.
  pending ??= Promise.all([
    import('./sprites.json'),
    import('./portraits.json'),
  ])
    .then(([sprites, portraits]) => {
      loaded = {
        sprites: (sprites.default ?? sprites) as unknown as MatchSpriteSheet,
        portraits: (portraits.default ??
          portraits) as unknown as PortraitSheetData,
      };
      return loaded;
    })
    .catch((error: unknown) => {
      pending = undefined;
      throw error;
    });
  return pending;
}

/**
 * For callers that cannot be async — `loadSpriteSheet` and the Skia atlas
 * builders. Every one of them sits behind a lazy factory that awaits
 * `loadPixelSheets()` first, so this throwing means a new entry point skipped
 * that gate, not that a player got unlucky with the network.
 */
export function requirePixelSheets(): PixelSheets {
  if (loaded === undefined)
    throw new Error('pixel sheets not loaded — await loadPixelSheets() first');
  return loaded;
}

export function prefetchPixelSheets(): void {
  // Only swallows the unhandled rejection. `loadPixelSheets` owns clearing the
  // cache, so a consumer that arrives later starts a fresh fetch whether or
  // not anything prefetched.
  void loadPixelSheets().catch(() => {});
}
