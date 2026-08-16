// The two big pixel sheets: `sprites.json` (1.98 MB) and `portraits.json`
// (1.36 MB).
//
// Native keeps the static imports. There is one bundle, so deferring buys
// nothing, and an async tick could blank a walk-on or a roster of faces. The
// web build overrides this file with `pixel-sheets.web.ts`, which fetches both
// as their own chunks — on web the static imports put 3.3 MB of pixel rows in
// front of first paint, because `App.tsx` imports the screens and walk-ons
// that draw them eagerly.
//
// Both files export the same functions, so callers never branch. This module
// is the ONLY place allowed to import the two JSON files: a second importer
// makes a sheet shared between the main graph and a lazy chunk, and Metro
// answers that by hoisting it into `__common`, which is a first-load file.
// Measured on 2026-08-16 — it happened, and it cost the whole saving.
//
// `management-sprites.json` is deliberately NOT here. It is 215 KB raw but
// only 10 KB gzip, and `ManagementSprite` takes its height from the sprite
// rows, so a late arrival would reflow the finances and staff rows. The worst
// ratio of the three sheets, and the only one that can shift a layout.
import portraitData from './portraits.json';
import sheetData from './sprites.json';
import type {
  MatchSpriteSheet,
  PixelSheets,
  PortraitSheetData,
} from './sprite-runs';

export type { PixelSheets };

const sheets: PixelSheets = {
  sprites: sheetData as unknown as MatchSpriteSheet,
  portraits: portraitData as unknown as PortraitSheetData,
};

/** The sheets if they have arrived, else undefined. Never blocks. */
export function peekPixelSheets(): PixelSheets | undefined {
  return sheets;
}

export function loadPixelSheets(): Promise<PixelSheets> {
  return Promise.resolve(sheets);
}

/** For callers that cannot be async. Throws rather than draw wrong pixels. */
export function requirePixelSheets(): PixelSheets {
  return sheets;
}

/** Fire-and-forget warm-up, called once from the app shell. */
export function prefetchPixelSheets(): void {
  // Already resident in the bundle.
}
