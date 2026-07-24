import { EVENT_SPRITE_ROWS } from './event-pixel-sprites';

/**
 * 8-bit story-object art for club events. Each event names 2-3 floating
 * objects pulled straight from its story text (a rat and a blazer, not a
 * painted scene). Sprites are 16x16 character grids over the docs/11 bible
 * palette, drawn with chunky ink outlines like the cast portraits.
 */

export const EVENT_SPRITE_SCALE = 5;
export const EVENT_SPRITE_CELL = 16;

const PALETTE: Readonly<Record<string, string>> = {
  K: '#241f2e',
  k: '#3a3350',
  W: '#ffffff',
  P: '#f4f1ea',
  D: '#d9d3e0',
  R: '#d94f52',
  r: '#a83440',
  E: '#f2938c',
  B: '#5a8fd6',
  b: '#3f6fb5',
  C: '#a3c8f0',
  G: '#edb54a',
  g: '#c8862a',
  L: '#f7d894',
  V: '#9a63d6',
  v: '#5b3a91',
  U: '#c9a6ec',
  T: '#5cb85c',
  t: '#3f8a4a',
  S: '#8fd98f',
  N: '#9a95a4',
  n: '#6b6675',
  M: '#c9c5d0',
  F: '#ff6a00',
  H: '#8a4f38',
  h: '#cf9268',
};

/** The 2-3 story objects for each event's `art` key. */
export const EVENT_OBJECTS: Readonly<Record<string, readonly string[]>> = {
  'event-giant-spider': ['spider', 'scarf'],
  'event-meteor-shard': ['meteor-crystal', 'star-sparkle'],
  'event-lightning-training': ['lightning-bolt', 'cone'],
  'event-energy-salesman': ['drink-can', 'sunglasses'],
  'event-abandoned-lab': ['flask', 'bus'],
  'event-radioactive-paint': ['paint-bucket', 'brush', 'star-sparkle'],
  'event-old-boot': ['boot', 'star-sparkle'],
  'event-team-bbq': ['spatula', 'burger'],
  'event-prank-war': ['cone', 'party-hat'],
  'event-lost-mascot': ['mascot-head', 'ball'],
  'event-kit-clash': ['shirt', 'shirt-alt'],
  'event-trophy-rat': ['rat', 'trophy', 'blazer'],
  'event-hero-expose': ['newspaper', 'camera'],
  'event-viral-goal': ['phone', 'ball'],
  'event-pundit-tactics': ['tv', 'tactics-board'],
  'event-popup-sponsor': ['bed', 'money-bag'],
  'event-hero-commercial': ['cereal-box', 'safe'],
  'event-player-slump': ['rain-cloud', 'ball'],
  'event-homesick-youth': ['envelope', 'dog'],
  'event-lottery-win': ['ticket', 'money-bag'],
  'event-player-feud': ['locker', 'cone'],
  'event-agent-whispers': ['briefcase', 'phone'],
  'event-flu-wave': ['thermometer', 'trumpet'],
  'event-miracle-physio': ['tape-roll', 'tuning-fork'],
  'event-ultras-tickets': ['banner-flag', 'ticket'],
  'event-school-visit': ['letter', 'star-sparkle'],
  'event-hundredth-fan': ['ticket', 'scarf'],
  'event-training-drone': ['drone', 'cone'],
  'event-haunted-scoreboard': ['scoreboard', 'ghost'],
  'event-community-mural': ['paint-bucket', 'brush'],
};

const FALLBACK_OBJECTS: readonly string[] = ['ball', 'star-sparkle'];

/** Resolves an event art key (with or without a `-success` suffix). */
export function eventObjectIds(artKey: string): readonly string[] {
  const baseKey = artKey.endsWith('-success')
    ? artKey.slice(0, -'-success'.length)
    : artKey;
  return EVENT_OBJECTS[baseKey] ?? FALLBACK_OBJECTS;
}

export interface EventPixelRun {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly color: string;
}

/** Horizontal same-color pixel runs for one sprite, ready for Skia rects. */
export function eventSpriteRuns(spriteId: string): EventPixelRun[] {
  const rows = EVENT_SPRITE_ROWS[spriteId];
  if (rows === undefined) throw new Error(`unknown event sprite ${spriteId}`);
  const runs: EventPixelRun[] = [];
  rows.forEach((row, y) => {
    let runStart = -1;
    let runColor: string | undefined;
    const flush = (end: number) => {
      if (runStart >= 0 && runColor !== undefined) {
        runs.push({ id: `${spriteId}:${y}:${runStart}`, x: runStart, y, width: end - runStart, color: runColor });
      }
      runStart = -1;
      runColor = undefined;
    };
    for (let x = 0; x < row.length; x += 1) {
      const color = PALETTE[row[x]];
      if (color === undefined) {
        flush(x);
        continue;
      }
      if (color !== runColor) {
        flush(x);
        runStart = x;
        runColor = color;
      }
    }
    flush(row.length);
  });
  return runs;
}

/** Deterministic scatter layout for up to three floating story objects. */
export function eventObjectLayout(artKey: string, count: number): ReadonlyArray<{
  readonly leftPercent: number;
  readonly topOffset: number;
  readonly rotationDeg: number;
  readonly phase: number;
}> {
  let hash = 2166136261;
  for (let index = 0; index < artKey.length; index += 1) {
    hash ^= artKey.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const unsigned = hash >>> 0;
  const slots = count === 3
    ? [{ left: 16 }, { left: 46 }, { left: 74 }]
    : [{ left: 24 }, { left: 62 }];
  return slots.slice(0, count).map((slot, index) => ({
    leftPercent: slot.left + ((unsigned >>> (index * 5)) % 7) - 3,
    topOffset: 12 + ((unsigned >>> (index * 7 + 3)) % 34),
    rotationDeg: (((unsigned >>> (index * 9 + 1)) % 17) - 8),
    phase: ((unsigned >>> (index * 4 + 2)) % 100) / 100,
  }));
}

export function eventSpriteIds(): string[] {
  return Object.keys(EVENT_SPRITE_ROWS);
}

export { EVENT_SPRITE_ROWS };
