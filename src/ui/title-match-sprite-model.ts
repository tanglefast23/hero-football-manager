// The title screen's pop scene draws 13 sprites. It used to import the whole
// 1.98 MB `sprites.json` to get them, which put the entire match-day sprite
// pool in the web first load. It now imports the extracted subset
// `title-sprites.json` (14 KB), written by `scripts/generate-title-sprites.mjs`
// and held to the full sheet, row for row, by `title-sprites.test.ts`.
//
// Synchronous on purpose: the title is the first thing drawn, so its sprites
// must not arrive a frame late.
import titleSpriteData from '../render/sprites/title-sprites.json';
import {
  spriteRows,
  spriteRuns,
  type MatchSpriteSheet,
  type MatchSpriteRun,
} from '../render/sprites/sprite-runs';

export type { MatchSpriteRun };

export const titleMatchSpriteSheet = titleSpriteData as MatchSpriteSheet;

export function titleMatchSpriteRows(spriteKey: string): readonly string[] {
  return spriteRows(titleMatchSpriteSheet, spriteKey);
}

export function titleMatchSpriteRuns(spriteKey: string): MatchSpriteRun[] {
  return spriteRuns(titleMatchSpriteSheet, spriteKey);
}
