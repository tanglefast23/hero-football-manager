/**
 * Every sprite the title pop scene may draw — the one list, read by three
 * things that must not disagree:
 *
 * - the two pop scenes, whose hero tables are typed against it;
 * - `scripts/generate-title-sprites.mjs`, which extracts exactly these rows
 *   from the checked-in `sprites.json` into `title-sprites.json`;
 * - `src/render/sprites/__tests__/title-sprites.test.ts`, which holds the
 *   extract to this list and to the full sheet.
 *
 * It exists because the title is the ONLY screen that gets its sprites
 * synchronously. Everything else waits for the 1.98 MB pool to arrive as a
 * chunk; the title cannot, so it carries a 14 KB subset instead. A key the
 * subset does not hold would throw on the first screen a player ever sees, so
 * asking for one is a type error rather than a runtime one.
 *
 * Adding a look: add the key here, then run
 * `node scripts/generate-title-sprites.mjs`.
 */
export const TITLE_SPRITE_KEYS = [
  'r:f09:run0',
  'r:f18:run0',
  'r:f27:run0',
  'r:f34:run0',
  'r:f39:run0',
  'u:f12:run0',
  'u:f21:run0',
  'u:f31:run0',
  'u:f45:run0',
  'u:f57:run0',
  'u:f73:run0',
  'u:g08:ready0',
  'u:g14:ready0',
] as const;

export type TitleSpriteBaseKey = (typeof TITLE_SPRITE_KEYS)[number];

/**
 * `:webbed` and `:ignited` are recoloured at runtime from a base key's own
 * rows, so they need no extra sprite in the subset.
 */
export type TitleSpriteKey =
  | TitleSpriteBaseKey
  | `${TitleSpriteBaseKey}:webbed`
  | `${TitleSpriteBaseKey}:ignited`;
