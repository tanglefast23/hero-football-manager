/**
 * Bert, taken apart into an expression and a posture.
 *
 * `BertFullBody` draws one fixed arrangement of rectangles with a single
 * `pointing` variant. That was enough when he lived in a framed card saying one
 * thing per page; now that he stands on the screen and speaks a line at a time,
 * every beat wearing the same face reads as a cardboard cut-out.
 *
 * Head and body vary independently, so any expression can sit on any posture
 * and a line of dialogue picks whichever pair fits. The neutral pairing —
 * `neutral` on `stand` — uses the authored rectangles at their authored
 * geometry, with one deliberate exception noted on `bertExpressionParts`: the
 * nose is painted earlier, which uncovers a few pixels of his far eye.
 *
 * Geometry is in the sprite's own 104x180 space; `BertFullBody` scales it.
 */

/** One rectangle. Anchors mirror the StyleSheet they replace. */
export interface BertPart {
  readonly left?: number;
  readonly right?: number;
  readonly top?: number;
  readonly bottom?: number;
  readonly width: number;
  readonly height: number;
  readonly color: string;
  readonly rotate?: number;
}

/**
 * Kept in step with `BertFullBody`'s StyleSheet. `hair` is silver rather than
 * the mid-grey he was drawn with: that grey was picked against the briefing
 * card's pale panel, and on a dimmed screen it sat within a few points of the
 * dim itself and his hair disappeared.
 */
export const BERT_PALETTE = {
  ink: '#241f2e',
  skin: '#eab48c',
  skinShade: '#cf9268',
  skinLight: '#f7d7ba',
  hair: '#c9c5d0',
  brow: '#6a4326',
  jacket: '#3a3350',
  lapel: '#5b3a91',
  shirt: '#f4f1ea',
  tie: '#d94f52',
  mouth: '#a83440',
  shadow: '#c9c5d0',
  sweat: '#77a4d8',
  blush: '#cf9268',
} as const;

const C = BERT_PALETTE;

type Anchor = 'left' | 'right';
type VAnchor = 'top' | 'bottom';

function part(
  anchor: Anchor,
  x: number,
  vAnchor: VAnchor,
  y: number,
  width: number,
  height: number,
  color: string,
  rotate?: number,
): BertPart {
  return {
    [anchor]: x,
    [vAnchor]: y,
    width,
    height,
    color,
    ...(rotate === undefined ? {} : { rotate }),
  } as BertPart;
}

/* ------------------------------------------------------------- EXPRESSIONS */

export type BertEyes = 'open' | 'wide' | 'squint' | 'closed' | 'side' | 'up' | 'dot';
export type BertMouth =
  | 'flat' | 'open' | 'wide' | 'smile' | 'frown' | 'smirk' | 'grimace' | 'oh';
export type BertAccent = 'none' | 'sweat' | 'blush' | 'vein';

/** Skull, ears, hair and pate — constant across every expression. */
function headBase(): BertPart[] {
  return [
    part('left', 17, 'top', 42, 13, 28, C.skinShade),
    part('right', 17, 'top', 42, 13, 28, C.skinShade),
    part('left', 31, 'top', 12, 44, 23, C.skin),
    part('left', 24, 'top', 27, 58, 48, C.skin),
    part('left', 31, 'top', 68, 44, 24, C.skinShade),
    part('left', 22, 'top', 22, 10, 27, C.hair),
    part('right', 21, 'top', 22, 10, 27, C.hair),
    part('left', 40, 'top', 17, 21, 5, C.skinLight),
  ];
}

function noseAndMoustache(angle: number): BertPart[] {
  return [
    part('left', 42, 'top', 48, 25, 24, C.skinShade),
    part('left', 46, 'top', 51, 13, 7, C.skinLight),
    part('left', 31, 'top', 70, 22, 10, C.brow, angle),
    part('right', 29, 'top', 70, 22, 10, C.brow, -angle),
  ];
}

function brows(angle: number, dy: number): BertPart[] {
  return [
    part('left', 30, 'top', 41 + dy, 15, 7, C.brow, angle),
    part('right', 29, 'top', 41 + dy, 15, 7, C.brow, -angle),
  ];
}

function eyes(style: BertEyes): BertPart[] {
  switch (style) {
    case 'wide':
      return [part('left', 35, 'top', 48, 8, 8, C.ink), part('right', 34, 'top', 48, 8, 8, C.ink)];
    case 'squint':
      return [part('left', 35, 'top', 51, 7, 3, C.ink), part('right', 34, 'top', 51, 7, 3, C.ink)];
    case 'closed':
      return [part('left', 34, 'top', 52, 9, 2, C.ink), part('right', 33, 'top', 52, 9, 2, C.ink)];
    case 'side':
      return [part('left', 33, 'top', 50, 5, 5, C.ink), part('right', 37, 'top', 50, 5, 5, C.ink)];
    case 'up':
      return [part('left', 36, 'top', 48, 5, 5, C.ink), part('right', 35, 'top', 48, 5, 5, C.ink)];
    case 'dot':
      return [part('left', 37, 'top', 51, 3, 3, C.ink), part('right', 36, 'top', 51, 3, 3, C.ink)];
    default:
      return [part('left', 36, 'top', 50, 5, 5, C.ink), part('right', 35, 'top', 50, 5, 5, C.ink)];
  }
}

function mouth(style: BertMouth): BertPart[] {
  switch (style) {
    case 'open': return [part('left', 44, 'top', 81, 17, 8, C.mouth)];
    case 'wide': return [part('left', 41, 'top', 80, 23, 11, C.mouth)];
    case 'smile': return [
      part('left', 44, 'top', 82, 17, 4, C.mouth),
      part('left', 42, 'top', 80, 4, 3, C.mouth),
      part('right', 40, 'top', 80, 4, 3, C.mouth),
    ];
    case 'frown': return [
      part('left', 44, 'top', 82, 17, 4, C.mouth),
      part('left', 42, 'top', 84, 4, 3, C.mouth),
      part('right', 40, 'top', 84, 4, 3, C.mouth),
    ];
    case 'smirk': return [part('left', 44, 'top', 82, 15, 4, C.mouth, -8)];
    case 'grimace': return [
      part('left', 42, 'top', 81, 21, 6, C.mouth),
      part('left', 42, 'top', 82, 21, 2, C.shirt),
    ];
    case 'oh': return [part('left', 48, 'top', 80, 9, 9, C.mouth)];
    default: return [part('left', 46, 'top', 82, 13, 4, C.mouth)];
  }
}

function accent(kind: BertAccent): BertPart[] {
  switch (kind) {
    case 'sweat': return [
      part('right', 8, 'top', 30, 6, 10, C.sweat),
      part('right', 6, 'top', 40, 4, 5, C.sweat),
    ];
    case 'blush': return [
      part('left', 26, 'top', 62, 11, 5, C.blush),
      part('right', 25, 'top', 62, 11, 5, C.blush),
    ];
    case 'vein': return [
      part('left', 24, 'top', 20, 4, 9, C.tie),
      part('left', 20, 'top', 24, 12, 4, C.tie),
    ];
    default: return [];
  }
}

interface ExpressionSpec {
  readonly label: string;
  readonly eyes: BertEyes;
  readonly mouth: BertMouth;
  /** Brow angle in degrees, and how far down the face the pair sits. */
  readonly brow: readonly [number, number];
  readonly moustache: number;
  readonly accent?: BertAccent;
}

export const BERT_EXPRESSIONS = {
  neutral: { label: 'Neutral', eyes: 'open', mouth: 'flat', brow: [8, 0], moustache: 8 },
  warm: { label: 'Warm', eyes: 'squint', mouth: 'smile', brow: [4, 2], moustache: 10 },
  delighted: { label: 'Delighted', eyes: 'closed', mouth: 'wide', brow: [2, -2], moustache: 12, accent: 'blush' },
  proud: { label: 'Proud', eyes: 'squint', mouth: 'smile', brow: [12, -2], moustache: 12 },
  chuckling: { label: 'Chuckling', eyes: 'closed', mouth: 'open', brow: [4, 0], moustache: 11 },
  encouraging: { label: 'Encouraging', eyes: 'open', mouth: 'smile', brow: [10, -1], moustache: 9 },
  sly: { label: 'Sly', eyes: 'side', mouth: 'smirk', brow: [16, 1], moustache: 8 },
  wry: { label: 'Wry', eyes: 'squint', mouth: 'smirk', brow: [18, -1], moustache: 8 },
  deadpan: { label: 'Deadpan', eyes: 'dot', mouth: 'flat', brow: [0, 1], moustache: 6 },
  unimpressed: { label: 'Unimpressed', eyes: 'squint', mouth: 'flat', brow: [-6, 3], moustache: 5 },
  sceptical: { label: 'Sceptical', eyes: 'side', mouth: 'flat', brow: [22, -3], moustache: 6 },
  thinking: { label: 'Thinking', eyes: 'up', mouth: 'flat', brow: [10, -2], moustache: 7 },
  explaining: { label: 'Explaining', eyes: 'open', mouth: 'open', brow: [8, -1], moustache: 9 },
  insistent: { label: 'Insistent', eyes: 'wide', mouth: 'open', brow: [-8, 2], moustache: 10 },
  stern: { label: 'Stern', eyes: 'squint', mouth: 'frown', brow: [-14, 3], moustache: 4 },
  grave: { label: 'Grave', eyes: 'open', mouth: 'frown', brow: [-10, 2], moustache: 5 },
  disappointed: { label: 'Disappointed', eyes: 'closed', mouth: 'frown', brow: [-4, 4], moustache: 4 },
  weary: { label: 'Weary', eyes: 'closed', mouth: 'flat', brow: [-2, 5], moustache: 3 },
  exasperated: { label: 'Exasperated', eyes: 'up', mouth: 'grimace', brow: [-12, 2], moustache: 4 },
  wincing: { label: 'Wincing', eyes: 'squint', mouth: 'grimace', brow: [-16, 3], moustache: 4, accent: 'sweat' },
  worried: { label: 'Worried', eyes: 'wide', mouth: 'grimace', brow: [-18, 1], moustache: 5, accent: 'sweat' },
  alarmed: { label: 'Alarmed', eyes: 'wide', mouth: 'oh', brow: [-20, -2], moustache: 6, accent: 'sweat' },
  shocked: { label: 'Shocked', eyes: 'wide', mouth: 'wide', brow: [-22, -4], moustache: 8 },
  outraged: { label: 'Outraged', eyes: 'squint', mouth: 'wide', brow: [-24, 4], moustache: 12, accent: 'vein' },
  barking: { label: 'Barking', eyes: 'wide', mouth: 'wide', brow: [-18, 3], moustache: 14, accent: 'vein' },
  pleading: { label: 'Pleading', eyes: 'wide', mouth: 'frown', brow: [20, -2], moustache: 6 },
  hopeful: { label: 'Hopeful', eyes: 'wide', mouth: 'smile', brow: [18, -3], moustache: 9 },
  relieved: { label: 'Relieved', eyes: 'closed', mouth: 'smile', brow: [6, 1], moustache: 10, accent: 'sweat' },
  smug: { label: 'Smug', eyes: 'closed', mouth: 'smirk', brow: [14, 0], moustache: 11 },
  conspiring: { label: 'Conspiring', eyes: 'side', mouth: 'open', brow: [12, 2], moustache: 8 },
} as const satisfies Record<string, ExpressionSpec>;

export type BertExpressionId = keyof typeof BERT_EXPRESSIONS;

/**
 * Nose and moustache are painted BEFORE the brows and eyes.
 *
 * The shipped StyleSheet paints the nose after, which is survivable for one
 * fixed face — it clips three of the far eye's five pixels — but across thirty
 * expressions it eats a different amount of each, and a sideways glance
 * disappears under it completely.
 */
export function bertExpressionParts(id: BertExpressionId): BertPart[] {
  const spec = BERT_EXPRESSIONS[id];
  return [
    ...headBase(),
    ...noseAndMoustache(spec.moustache),
    ...brows(spec.brow[0], spec.brow[1]),
    ...eyes(spec.eyes),
    ...mouth(spec.mouth),
    ...accent('accent' in spec ? spec.accent as BertAccent : 'none'),
  ];
}

/* ---------------------------------------------------------------- POSTURES */

/** Everything below the collar for an upright Bert; arms come from the pose. */
function standingTorso(): BertPart[] {
  return [
    part('left', 26, 'bottom', 6, 25, 10, C.ink),
    part('right', 22, 'bottom', 6, 25, 10, C.ink),
    part('left', 31, 'bottom', 15, 18, 37, C.jacket),
    part('right', 26, 'bottom', 15, 18, 37, C.jacket),
    part('left', 23, 'top', 88, 60, 51, C.jacket),
    part('left', 43, 'top', 91, 20, 43, C.shirt),
    part('left', 49, 'top', 96, 9, 35, C.tie),
    part('left', 31, 'top', 93, 18, 26, C.lapel, 18),
    part('right', 30, 'top', 93, 18, 26, C.lapel, -18),
  ];
}

const ARMS = {
  /** The authored arms-down pair. */
  rest: (): BertPart[] => [
    part('left', 16, 'top', 101, 13, 42, C.jacket, 5),
    part('left', 17, 'top', 137, 13, 15, C.skinShade),
    part('right', 14, 'top', 101, 13, 42, C.jacket, -5),
    part('right', 15, 'top', 137, 13, 15, C.skinShade),
  ],
  /** The authored pointing arm. */
  point: (): BertPart[] => [
    part('left', 3, 'top', 101, 33, 13, C.jacket, -8),
    part('left', 0, 'top', 98, 15, 14, C.skinShade),
    part('left', -8, 'top', 101, 13, 6, C.skin),
    part('right', 14, 'top', 101, 13, 42, C.jacket, -5),
    part('right', 15, 'top', 137, 13, 15, C.skinShade),
  ],
  // Unrotated on purpose: a rotated forearm swings its far end away from the
  // hand, and the join is the whole point of the gesture.
  pointUp: (): BertPart[] => [
    part('left', 18, 'top', 72, 13, 40, C.jacket),
    part('left', 17, 'top', 58, 15, 15, C.skinShade),
    part('left', 21, 'top', 46, 7, 13, C.skin),
    part('right', 14, 'top', 101, 13, 42, C.jacket, -5),
    part('right', 15, 'top', 137, 13, 15, C.skinShade),
  ],
  crossed: (): BertPart[] => [
    part('left', 18, 'top', 104, 40, 13, C.jacket, 12),
    part('right', 17, 'top', 116, 40, 13, C.jacket, -12),
    part('left', 20, 'top', 112, 14, 13, C.skinShade),
    part('right', 19, 'top', 100, 14, 13, C.skinShade),
  ],
  hips: (): BertPart[] => [
    part('left', 14, 'top', 100, 12, 26, C.jacket, 16),
    part('left', 20, 'top', 122, 14, 13, C.skinShade),
    part('right', 13, 'top', 100, 12, 26, C.jacket, -16),
    part('right', 19, 'top', 122, 14, 13, C.skinShade),
  ],
  shrug: (): BertPart[] => [
    part('left', 11, 'top', 96, 13, 28, C.jacket, -20),
    part('left', 6, 'top', 118, 14, 13, C.skinShade),
    part('right', 10, 'top', 96, 13, 28, C.jacket, 20),
    part('right', 5, 'top', 118, 14, 13, C.skinShade),
  ],
  thumbsUp: (): BertPart[] => [
    part('left', 20, 'top', 104, 13, 30, C.jacket, 14),
    part('left', 22, 'top', 96, 15, 15, C.skinShade),
    part('left', 26, 'top', 86, 7, 12, C.skin),
    part('right', 14, 'top', 101, 13, 42, C.jacket, -5),
    part('right', 15, 'top', 137, 13, 15, C.skinShade),
  ],
  clipboard: (): BertPart[] => [
    part('left', 16, 'top', 104, 13, 32, C.jacket, 10),
    part('left', 14, 'top', 118, 32, 24, '#cf9268'),
    part('left', 22, 'top', 114, 16, 6, C.hair),
    part('right', 14, 'top', 101, 13, 42, C.jacket, -5),
    part('right', 15, 'top', 137, 13, 15, C.skinShade),
  ],
  scratchHead: (): BertPart[] => [
    part('right', 12, 'top', 74, 13, 34, C.jacket, 26),
    part('right', 12, 'top', 58, 14, 14, C.skinShade),
    part('left', 16, 'top', 101, 13, 42, C.jacket, 5),
    part('left', 17, 'top', 137, 13, 15, C.skinShade),
  ],
  bothOut: (): BertPart[] => [
    part('left', 4, 'top', 104, 32, 13, C.jacket, -14),
    part('left', 0, 'top', 100, 14, 14, C.skinShade),
    part('right', 3, 'top', 104, 32, 13, C.jacket, 14),
    part('right', 0, 'top', 100, 14, 14, C.skinShade),
  ],
  handUp: (): BertPart[] => [
    part('left', 14, 'top', 90, 13, 30, C.jacket, 12),
    part('left', 10, 'top', 76, 17, 18, C.skinShade),
    part('right', 14, 'top', 101, 13, 42, C.jacket, -5),
    part('right', 15, 'top', 137, 13, 15, C.skinShade),
  ],
  facePalm: (): BertPart[] => [
    part('left', 16, 'top', 82, 13, 32, C.jacket, 24),
    part('left', 22, 'top', 60, 20, 18, C.skinShade),
    part('right', 14, 'top', 101, 13, 42, C.jacket, -5),
    part('right', 15, 'top', 137, 13, 15, C.skinShade),
  ],
  pocket: (): BertPart[] => [
    part('left', 18, 'top', 101, 13, 34, C.jacket, 4),
    part('right', 14, 'top', 101, 13, 42, C.jacket, -5),
    part('right', 15, 'top', 137, 13, 15, C.skinShade),
  ],
  /** Both palms turned up and forward: "here, look at this". */
  present: (): BertPart[] => [
    part('left', 10, 'top', 106, 28, 13, C.jacket, -10),
    part('left', 4, 'top', 118, 16, 11, C.skinShade),
    part('right', 9, 'top', 106, 28, 13, C.jacket, 10),
    part('right', 3, 'top', 118, 16, 11, C.skinShade),
  ],
} as const;

type ArmsId = keyof typeof ARMS;

interface PostureSpec {
  readonly label: string;
  readonly arms?: ArmsId;
  /** Tips the whole figure, in degrees. */
  readonly lean?: number;
  /** Sinks the figure — slouch, sag. */
  readonly drop?: number;
  /** Rebuilt from scratch rather than posed from the standing torso. */
  readonly custom?: 'stride' | 'sit' | 'lie' | 'away';
  readonly slump?: boolean;
  readonly propped?: boolean;
}

export const BERT_POSTURES = {
  stand: { label: 'Stood square', arms: 'rest' },
  point: { label: 'Pointing across', arms: 'point' },
  'point-up': { label: 'Finger raised', arms: 'pointUp' },
  crossed: { label: 'Arms folded', arms: 'crossed' },
  hips: { label: 'Hands on hips', arms: 'hips' },
  shrug: { label: 'Shrugging', arms: 'shrug' },
  thumbs: { label: 'Thumbs up', arms: 'thumbsUp' },
  clipboard: { label: 'Clipboard out', arms: 'clipboard' },
  scratch: { label: 'Scratching head', arms: 'scratchHead' },
  'both-out': { label: 'Both arms out', arms: 'bothOut' },
  'hand-up': { label: 'Hand up, hold on', arms: 'handUp' },
  facepalm: { label: 'Face in hand', arms: 'facePalm' },
  pocket: { label: 'Hand in pocket', arms: 'pocket' },
  present: { label: 'Presenting, palms up', arms: 'present' },
  'lean-in': { label: 'Leaning in', arms: 'rest', lean: -9 },
  'lean-back': { label: 'Leaning back', arms: 'crossed', lean: 8 },
  'lean-point': { label: 'Leaning, pointing', arms: 'point', lean: -11 },
  confide: { label: 'Confiding', arms: 'handUp', lean: -13 },
  recoil: { label: 'Recoiling', arms: 'bothOut', lean: 12 },
  slouch: { label: 'Slouching', arms: 'pocket', drop: 9 },
  sag: { label: 'Sagging', arms: 'rest', drop: 13, lean: 4 },
  brace: { label: 'Braced forward', arms: 'hips', lean: -7, drop: 5 },
  triumph: { label: 'Arms up', arms: 'bothOut', lean: -3, drop: -4 },
  step: { label: 'Mid-stride', custom: 'stride', arms: 'rest' },
  'stride-point': { label: 'Striding, pointing', custom: 'stride', arms: 'point' },
  'sit-edge': { label: 'Perched, sitting', custom: 'sit' },
  'sit-slump': { label: 'Slumped, sitting', custom: 'sit', slump: true },
  'lie-side': { label: 'Lying on his side', custom: 'lie' },
  'lie-prop': { label: 'Propped on elbow', custom: 'lie', propped: true },
  'walk-off': { label: 'Walking away', custom: 'away' },
} as const satisfies Record<string, PostureSpec>;

export type BertPostureId = keyof typeof BERT_POSTURES;

function stride(): BertPart[] {
  return [
    part('left', 16, 'bottom', 6, 26, 10, C.ink),
    part('right', 14, 'bottom', 10, 26, 10, C.ink),
    part('left', 26, 'bottom', 15, 18, 34, C.jacket, 12),
    part('right', 24, 'bottom', 19, 18, 34, C.jacket, -12),
    part('left', 23, 'top', 88, 60, 51, C.jacket),
    part('left', 43, 'top', 91, 20, 43, C.shirt),
    part('left', 49, 'top', 96, 9, 35, C.tie, -6),
    part('left', 31, 'top', 93, 18, 26, C.lapel, 18),
    part('right', 30, 'top', 93, 18, 26, C.lapel, -18),
  ];
}

/**
 * Perched on the edge of something, three-quarters on. The torso stays at
 * standing height so the head needs no repositioning; the legs fold out to his
 * right, thighs level and shins straight down off the edge.
 */
function sit(slump: boolean): BertPart[] {
  const lift = slump ? 7 : 0;
  return [
    part('left', 6, 'bottom', 12, 17, 30, C.jacket),
    part('left', 28, 'bottom', 12, 17, 30, C.jacket),
    part('left', 2, 'bottom', 2, 25, 11, C.ink),
    part('left', 24, 'bottom', 2, 25, 11, C.ink),
    part('left', 6, 'bottom', 40, 56, 18, C.jacket),
    part('left', 30, 'top', 88 + lift, 58, 50, C.jacket),
    part('left', 50, 'top', 91 + lift, 20, 42, C.shirt),
    part('left', 56, 'top', 96 + lift, 9, 34, C.tie),
    part('left', 38, 'top', 93 + lift, 18, 26, C.lapel, 18),
    part('right', 22, 'top', 93 + lift, 18, 26, C.lapel, -18),
    part('left', 24, 'top', 101 + lift, 13, 38, C.jacket, 6),
    part('left', 25, 'top', 135 + lift, 13, 14, C.skinShade),
    part('right', 8, 'top', 101 + lift, 13, 38, C.jacket, -6),
    part('right', 9, 'top', 135 + lift, 13, 14, C.skinShade),
  ];
}

/**
 * Down on one hip, legs stacked and bent, weight on the near elbow. He lies
 * across the box rather than standing in it, so the whole figure occupies the
 * lower half and the head rides the raised shoulder at the right.
 */
function lie(propped: boolean): BertPart[] {
  return [
    part('left', 6, 'bottom', 9, 46, 16, C.jacket, -4),
    part('left', 0, 'bottom', 7, 22, 11, C.ink),
    part('left', 14, 'bottom', 23, 40, 15, C.jacket, -14),
    part('left', 10, 'bottom', 26, 22, 11, C.ink),
    part('left', 40, 'bottom', 10, 26, 30, C.jacket),
    part('left', 52, 'bottom', 16, 38, 32, C.jacket, -14),
    part('left', 62, 'bottom', 24, 20, 22, C.shirt, -14),
    part('left', 66, 'bottom', 22, 8, 22, C.tie, -14),
    part('left', 48, 'bottom', 30, 20, 16, C.lapel, 16),
    ...(propped
      ? [
        part('left', 74, 'bottom', 6, 12, 28, C.jacket, 6),
        part('left', 74, 'bottom', 2, 15, 11, C.skinShade),
      ]
      : [
        part('left', 56, 'bottom', 30, 32, 12, C.jacket, -18),
        part('left', 84, 'bottom', 36, 14, 12, C.skinShade),
      ]),
  ];
}

/**
 * Seen from behind as he leaves. A bald man from behind is a skin oval unless
 * the horseshoe of hair does the work, so the ring is heavier here than on the
 * front view, and the neck is drawn to seat the skull on the collar.
 */
function away(): BertPart[] {
  return [
    part('left', 22, 'bottom', 6, 25, 10, C.ink),
    part('right', 18, 'bottom', 10, 25, 10, C.ink),
    part('left', 29, 'bottom', 15, 18, 35, C.jacket, 8),
    part('right', 24, 'bottom', 19, 18, 35, C.jacket, -8),
    part('left', 23, 'top', 88, 60, 51, C.jacket),
    part('left', 38, 'top', 88, 30, 8, C.shirt),
    part('left', 16, 'top', 101, 13, 42, C.jacket, 5),
    part('left', 17, 'top', 137, 13, 15, C.skinShade),
    part('right', 14, 'top', 101, 13, 42, C.jacket, -5),
    part('right', 15, 'top', 137, 13, 15, C.skinShade),
    part('left', 44, 'top', 78, 16, 14, C.skinShade),
    part('left', 17, 'top', 44, 13, 26, C.skinShade),
    part('right', 17, 'top', 44, 13, 26, C.skinShade),
    part('left', 26, 'top', 14, 52, 24, C.skin),
    part('left', 22, 'top', 30, 60, 50, C.skin),
    part('left', 38, 'top', 19, 24, 6, C.skinLight),
    part('left', 20, 'top', 34, 13, 46, C.hair),
    part('right', 19, 'top', 34, 13, 46, C.hair),
    part('left', 28, 'top', 62, 48, 18, C.hair),
  ];
}

export function bertPostureParts(id: BertPostureId): BertPart[] {
  const spec: PostureSpec = BERT_POSTURES[id];
  if (spec.custom === 'stride') return [...stride(), ...ARMS[spec.arms ?? 'rest']()];
  if (spec.custom === 'sit') return sit(spec.slump === true);
  if (spec.custom === 'lie') return lie(spec.propped === true);
  if (spec.custom === 'away') return away();
  return [...standingTorso(), ...ARMS[spec.arms ?? 'rest']()];
}

/** How far the whole figure tips for a posture, in degrees. */
export function bertPostureLean(id: BertPostureId): number {
  return (BERT_POSTURES[id] as PostureSpec).lean ?? 0;
}

/** True when the posture supplies its own head (or deliberately shows none). */
export function bertPostureHidesFace(id: BertPostureId): boolean {
  return (BERT_POSTURES[id] as PostureSpec).custom === 'away';
}

/** Where the expression sits for a posture that moved the shoulders. */
export function bertHeadOffset(id: BertPostureId): { x: number; y: number } {
  const spec: PostureSpec = BERT_POSTURES[id];
  if (spec.custom === 'sit') return { x: 7, y: spec.slump === true ? 7 : 0 };
  // The head block's jaw sits 92px down, and the lying torso tops out 48 up
  // from the floor: 180 - 92 - 48 = 40. Any less and the head floats free.
  if (spec.custom === 'lie') return { x: 22, y: 40 };
  return { x: 0, y: spec.drop ?? 0 };
}

/* ----------------------------------------------------------------- MOMENTS */

/**
 * The pairings, named for the moment they play rather than the emotion, since
 * that is how a beat picks one. Expression and posture stay independent, so any
 * other pairing remains available.
 */
export const BERT_MOMENTS = {
  hello: { label: 'Meeting you for the first time', expression: 'warm', posture: 'stand' },
  introducing: { label: 'Introducing himself', expression: 'proud', posture: 'hips' },
  'sizing-you-up': { label: 'Sizing you up', expression: 'sceptical', posture: 'crossed' },
  teasing: { label: 'Teasing you', expression: 'chuckling', posture: 'hips' },
  explaining: { label: 'Explaining how something works', expression: 'explaining', posture: 'both-out' },
  'pointing-out': { label: 'Pointing at the thing you need', expression: 'insistent', posture: 'lean-point' },
  'pointing-up': { label: 'One important detail', expression: 'stern', posture: 'point-up' },
  listing: { label: 'Running through the numbers', expression: 'deadpan', posture: 'clipboard' },
  'warning-money': { label: 'Warning you about money', expression: 'grave', posture: 'point' },
  'warning-hard': { label: 'Serious warning', expression: 'outraged', posture: 'brace' },
  'telling-off': { label: 'Telling you off', expression: 'barking', posture: 'lean-point' },
  disapproving: { label: 'Disapproving quietly', expression: 'disappointed', posture: 'crossed' },
  'bad-news': { label: 'Breaking bad news', expression: 'wincing', posture: 'sag' },
  'very-bad-news': { label: 'Breaking very bad news', expression: 'worried', posture: 'facepalm' },
  despairing: { label: 'Out of ideas', expression: 'exasperated', posture: 'facepalm' },
  shocked: { label: 'Genuinely shocked', expression: 'shocked', posture: 'recoil' },
  alarmed: { label: 'Something has gone wrong', expression: 'alarmed', posture: 'both-out' },
  unsure: { label: 'Not sure what to tell you', expression: 'thinking', posture: 'scratch' },
  shrugging: { label: 'It is out of his hands', expression: 'unimpressed', posture: 'shrug' },
  'hold-on': { label: 'Asking you to wait', expression: 'insistent', posture: 'hand-up' },
  confiding: { label: 'Letting you in on something', expression: 'conspiring', posture: 'confide' },
  smug: { label: 'He told you so', expression: 'smug', posture: 'lean-back' },
  encouraging: { label: 'Talking you into it', expression: 'encouraging', posture: 'lean-in' },
  approving: { label: 'Approving of a decision', expression: 'warm', posture: 'thumbs' },
  celebrating: { label: 'Celebrating a win', expression: 'delighted', posture: 'triumph' },
  relieved: { label: 'Relieved it worked out', expression: 'relieved', posture: 'pocket' },
  laughing: { label: 'Laughing at you, fondly', expression: 'chuckling', posture: 'lean-back' },
  hopeful: { label: 'Hoping you say yes', expression: 'pleading', posture: 'present' },
  'worn-out': { label: 'Long season, tired', expression: 'weary', posture: 'lie-prop' },
  leaving: { label: 'Walking off', expression: 'neutral', posture: 'walk-off' },
} as const satisfies Record<string, {
  label: string;
  expression: BertExpressionId;
  posture: BertPostureId;
}>;

export type BertMomentId = keyof typeof BERT_MOMENTS;
