export const CLUB_CREST_GRID = 8;

type CrestPattern =
  'solid' | 'halves' | 'quarters' | 'sash' | 'hoops' | 'pinstripes';

type CrestMotif =
  | 'anchor'
  | 'beacon'
  | 'bolt'
  | 'book'
  | 'comet'
  | 'crown'
  | 'flower'
  | 'gear'
  | 'gem'
  | 'leaf'
  | 'moon'
  | 'owl'
  | 'star'
  | 'tower'
  | 'tree';

export interface ClubCrestSpec {
  readonly primary: string;
  readonly secondary: string;
  readonly pattern: CrestPattern;
  readonly motif: CrestMotif;
}

export interface ClubCrestRun {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly color: string;
}

const INK = '#241F2E';

/** The launch clubs keep the palette authored in content/clubs.json. */
const AUTHORED_CLUBS: Readonly<Record<string, ClubCrestSpec>> = {
  'bramble rovers': {
    primary: '#31703F',
    secondary: '#EDB54A',
    pattern: 'sash',
    motif: 'leaf',
  },
  'ferrous united': {
    primary: '#6B6675',
    secondary: '#E8433F',
    pattern: 'halves',
    motif: 'gear',
  },
  'harbor comets': {
    primary: '#2F55B8',
    secondary: '#F4F1EA',
    pattern: 'solid',
    motif: 'comet',
  },
  'oakridge owls': {
    primary: '#6A4326',
    secondary: '#F7D894',
    pattern: 'hoops',
    motif: 'owl',
  },
  'neon athletic': {
    primary: '#9A63D6',
    secondary: '#A3C8F0',
    pattern: 'pinstripes',
    motif: 'star',
  },
  'meadow city': {
    primary: '#529F5B',
    secondary: '#F7D894',
    pattern: 'quarters',
    motif: 'flower',
  },
  'quartz fc': {
    primary: '#C9C5D0',
    secondary: '#241F2E',
    pattern: 'solid',
    motif: 'gem',
  },
  'thunder borough': {
    primary: '#EDB54A',
    secondary: '#16121F',
    pattern: 'halves',
    motif: 'bolt',
  },
  'cedar crown': {
    primary: '#26512F',
    secondary: '#BA7517',
    pattern: 'hoops',
    motif: 'crown',
  },
  'moonlight town': {
    primary: '#5B3A91',
    secondary: '#C9A6EC',
    pattern: 'solid',
    motif: 'moon',
  },
};

const GENERATED_PREFIXES: Readonly<
  Record<string, Omit<ClubCrestSpec, 'pattern'>>
> = {
  alder: { primary: '#31703F', secondary: '#EDB54A', motif: 'leaf' },
  beacon: { primary: '#EDB54A', secondary: '#16121F', motif: 'beacon' },
  copper: { primary: '#BA7517', secondary: '#F4F1EA', motif: 'gear' },
  dunwich: { primary: '#5B3A91', secondary: '#C9C5D0', motif: 'tower' },
  elm: { primary: '#3F8A4A', secondary: '#F4F1EA', motif: 'tree' },
  fable: { primary: '#2F55B8', secondary: '#F7D894', motif: 'book' },
  garnet: { primary: '#A83440', secondary: '#F2938C', motif: 'gem' },
  harbour: { primary: '#3F6FB5', secondary: '#F4F1EA', motif: 'anchor' },
  iron: { primary: '#6B6675', secondary: '#E8433F', motif: 'gear' },
  juniper: { primary: '#26512F', secondary: '#C9A6EC', motif: 'tree' },
};

const SUFFIX_PATTERNS: Readonly<Record<string, CrestPattern>> = {
  athletic: 'pinstripes',
  city: 'quarters',
  rovers: 'sash',
  united: 'halves',
  wanderers: 'hoops',
};

const FALLBACK_STYLES = Object.values(GENERATED_PREFIXES);
const FALLBACK_PATTERNS = Object.values(SUFFIX_PATTERNS);

const MOTIFS: Readonly<Record<CrestMotif, readonly string[]>> = {
  anchor: ['.MM.', 'MMMM', '.MM.', 'M..M'],
  beacon: ['.MM.', '.MM.', 'MMMM', 'M..M'],
  bolt: ['..MM', '.MM.', 'MM..', 'M...'],
  book: ['M..M', 'MMMM', 'M..M', 'MMMM'],
  comet: ['...M', '.MMM', 'MMM.', 'M...'],
  crown: ['M..M', 'MMMM', '.MM.', 'MMMM'],
  flower: ['.M..', 'MMM.', '.M..', 'M.M.'],
  gear: ['.MM.', 'MMMM', 'M..M', '.MM.'],
  gem: ['.MM.', 'MMMM', '.MM.', '..M.'],
  leaf: ['..M.', '.MM.', 'MM..', 'M...'],
  moon: ['.MM.', 'MM..', 'MM..', '.MM.'],
  owl: ['M..M', 'MMMM', 'M..M', '.MM.'],
  star: ['M..M', '.MM.', 'MMMM', '.MM.'],
  tower: ['MMMM', '.MM.', '.MM.', 'M..M'],
  tree: ['.MM.', 'MMMM', '.MM.', 'M..M'],
};

export function clubCrestSpec(clubName: string): ClubCrestSpec {
  const words = normalizedWords(clubName);
  const authored = AUTHORED_CLUBS[words.join(' ')];
  if (authored !== undefined) return authored;

  const hash = hashName(words.join(' '));
  const base =
    GENERATED_PREFIXES[words[0] ?? ''] ??
    FALLBACK_STYLES[hash % FALLBACK_STYLES.length];
  const pattern =
    SUFFIX_PATTERNS[words.at(-1) ?? ''] ??
    FALLBACK_PATTERNS[hash % FALLBACK_PATTERNS.length];
  return { ...base, pattern };
}

export function clubCrestRuns(clubName: string): readonly ClubCrestRun[] {
  const spec = clubCrestSpec(clubName);
  const grid = Array.from({ length: CLUB_CREST_GRID }, () =>
    Array<string>(CLUB_CREST_GRID).fill('.'),
  );

  paintShield(grid, spec.pattern);
  MOTIFS[spec.motif].forEach((row, y) => {
    [...row].forEach((cell, x) => {
      if (cell === 'M') grid[y + 2][x + 2] = 'M';
    });
  });

  const colors: Readonly<Record<string, string>> = {
    K: INK,
    A: spec.primary,
    B: spec.secondary,
    M: spec.secondary,
  };
  const runs: ClubCrestRun[] = [];
  grid.forEach((row, y) => {
    let start = 0;
    while (start < row.length) {
      const key = row[start];
      if (key === '.') {
        start += 1;
        continue;
      }
      let end = start + 1;
      while (end < row.length && row[end] === key) end += 1;
      runs.push({
        id: `${y}:${start}:${key}`,
        x: start,
        y,
        width: end - start,
        color: colors[key],
      });
      start = end;
    }
  });
  return runs;
}

function paintShield(grid: string[][], pattern: CrestPattern): void {
  const interiors: readonly [number, number, number][] = [
    [1, 1, 6],
    [2, 1, 6],
    [3, 1, 6],
    [4, 1, 6],
    [5, 2, 4],
    [6, 3, 2],
  ];
  grid[0].splice(1, 6, ...Array<string>(6).fill('K'));
  grid[7].splice(3, 2, 'K', 'K');
  for (const [y, x, width] of interiors) {
    grid[y][x - 1] = 'K';
    grid[y][x + width] = 'K';
    for (let offset = 0; offset < width; offset += 1) {
      const cellX = x + offset;
      grid[y][cellX] = patternCell(pattern, cellX, y);
    }
  }
}

function patternCell(pattern: CrestPattern, x: number, y: number): string {
  if (pattern === 'halves') return x < 4 ? 'A' : 'B';
  if (pattern === 'quarters') return x < 4 === y < 4 ? 'A' : 'B';
  if (pattern === 'sash') return x === y || x === y + 1 ? 'B' : 'A';
  if (pattern === 'hoops') return y % 2 === 0 ? 'B' : 'A';
  if (pattern === 'pinstripes') return x % 2 === 0 ? 'B' : 'A';
  return 'A';
}

function normalizedWords(value: string): string[] {
  return value.trim().toLocaleLowerCase('en-US').split(/\s+/).filter(Boolean);
}

function hashName(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
