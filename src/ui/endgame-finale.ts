/**
 * The curtain call the true ending finishes on, and the last words in the game.
 *
 * The star has said his piece and walked off. What follows is the rest of the
 * club coming out to the middle of the grass: everybody jumping, the star among
 * them dancing rather than jumping, and Bert flat out in front of the lot of
 * them with the one thing left to say.
 *
 * The staging is a pure function of the window, so where every man stands — and
 * the promise that none of them ends up standing on the stand — is checkable
 * headlessly. Jest has no DOM; if this lived in the component nobody could test
 * it, and this is the last thing anybody sees.
 */

import { grassTopFor } from './endgame-ground';
import {
  BERT_MOMENTS,
  bertExpressionParts,
  bertHeadOffset,
  bertPostureHidesFace,
  bertPostureParts,
  type BertMomentId,
} from './bert-poses';
import { BERT_SPRITE_SIZE } from './bert-walk-frames';

/**
 * Bert's sign-off, and the only place in the game that speaks about the game.
 *
 * Two bubbles, because the sentiment is doing the work and a third would start
 * explaining it. Kept here rather than in the view model on purpose: every other
 * line on this screen is about the manager's own career and is built from his
 * save, and these two are the same in every career that reaches them. Authoring
 * them beside the staging also means the dev harness and the shipped game read
 * from one copy of the words instead of two that can drift.
 *
 * Both are SHORT, and that is a measurement rather than a preference. A speech
 * bubble is placed above the speaker, who stands four fifths of the way across
 * the screen, so on a 375pt phone it settles at about 166pt wide however much
 * text it holds. At that width a line runs to roughly fifteen characters: this
 * pair draws about seven lines each, and half as much again would put a white
 * column over the squad he is talking about. `MAX_SIGNOFF_CHARACTERS` holds the
 * ceiling that keeps them that size.
 */
export const BERT_SIGNOFF_LINES: readonly string[] = Object.freeze([
  'One last thing. This game was made by one man on his own — Joe Vu — and he thanks you very much.',
  'People like you are what let him make the next one. Keep an eye out for it.',
]);

/** See `BERT_SIGNOFF_LINES`: past this a bubble starts covering the pitch. */
export const MAX_SIGNOFF_CHARACTERS = 100;

/**
 * The pose he says it in: worn out, propped on an elbow, at the end of the
 * longest season there is. The pairing comes from the approved thirty in
 * `BERT_MOMENTS` — `lie-prop` is the lying posture, and this is the moment that
 * uses it.
 */
export const FINALE_BERT_MOMENT: BertMomentId = 'worn-out';

/** One player sprite cell, matching `PLAYER_SPRITE_CELL` without importing Skia. */
export const FINALE_CELL = Object.freeze({ width: 24, height: 30 });

/** Margin the rows keep from both edges of the window. */
const SIDE_MARGIN = 16;
/** Space between two men in a row, as a fraction of one sprite's width. */
const GAP_RATIO = 0.18;
/**
 * Nobody is drawn bigger than this, however few of them walk out.
 *
 * Smaller than the man who was just talking, on purpose: he stood a few yards
 * from the camera and they are out in the middle of the field. A squad drawn at
 * his size would be standing on his mark rather than up the pitch.
 */
const FRONT_MAX_SCALE = 1.8;
/** The far row is drawn smaller still, which is the whole of the depth cue. */
const BACK_SCALE_RATIO = 0.8;
/**
 * Where each row's feet land, as a fraction of the grass band measured up from
 * the bottom of the window.
 *
 * Both rows stand well up the pitch. That is partly perspective — men in the
 * middle of the field are a long way further off than the man who was talking
 * to you — and partly room: Bert lies in the near grass below them, and his
 * speech bubble hangs above him in the empty foreground. Bring the squad any
 * closer and the bubble covers the celebration it is talking about.
 */
const BACK_ROW_FEET = 0.86;
const FRONT_ROW_FEET = 0.74;
/** Bert, right down in the foreground, nearer than anyone. */
const BERT_FEET = 0.08;
/**
 * Where the rows are centred, as a fraction of the window width.
 *
 * Left of centre on purpose. Bert lies four fifths of the way across and his
 * bubble hangs above him, so a squad centred on the window would celebrate with
 * a white box over its right-hand third. Nudging them this way puts almost all
 * of the club in the clear and still reads as the middle of the field, which
 * runs off both edges of the screen anyway.
 */
const ROW_CENTRE = 0.43;
/**
 * How far apart two neighbours are in the shared bounce loop.
 *
 * The golden ratio rather than a hash: it spreads any number of men evenly and
 * can never land two neighbours on the same beat, which is what separates a
 * squad jumping from one body copied eleven times.
 */
const PHASE_STEP = 0.6180339887;

export interface FinalePerformer {
  readonly id: string;
  /** Atlas key, exactly as the celebration view model builds it. */
  readonly spriteKey: string;
  /** The man the ending belongs to. At most one, and he dances. */
  readonly isStar: boolean;
}

export interface FinaleSpot {
  readonly id: string;
  readonly spriteKey: string;
  /** Top-left of the sprite at rest, in window pixels. */
  readonly x: number;
  readonly y: number;
  readonly scale: number;
  /** 0 is the far row, 1 the near one. Painted in this order. */
  readonly row: 0 | 1;
  /** The star rocks side to side instead of jumping. */
  readonly dancing: boolean;
  /** Where in the shared bounce loop this man is, 0 to 1. */
  readonly phase: number;
}

export interface FinaleBert {
  readonly scale: number;
  /** Clearance from the bottom of the window to his lowest pixel. */
  readonly up: number;
  /** Height of the drawn figure, which is not the height of his box. */
  readonly visibleHeight: number;
  readonly boxWidth: number;
  readonly boxHeight: number;
  /**
   * The empty strip below his lowest pixel inside his own box. A lying pose
   * does not reach the floor of a box drawn for a standing man, and without
   * this he floats.
   */
  readonly boxFloorGap: number;
}

export interface FinaleStage {
  readonly spots: readonly FinaleSpot[];
  readonly bert: FinaleBert;
}

/**
 * The extent of a posed Bert inside his own sprite box, in box pixels.
 *
 * Measured from the pose rather than written down, so the bubble keeps sitting
 * on his head if the pose is ever redrawn. Static rotations on a lapel or a
 * moustache are ignored — they move an edge by a pixel or two, and a bubble
 * cares about his skull.
 */
export function bertMomentExtent(moment: BertMomentId): { readonly top: number; readonly bottom: number } {
  const { expression, posture } = BERT_MOMENTS[moment];
  const parts = [
    ...bertPostureParts(posture).map(part => ({ part, dy: 0 })),
    ...(bertPostureHidesFace(posture)
      ? []
      : bertExpressionParts(expression).map(part => ({ part, dy: bertHeadOffset(posture).y }))),
  ];
  let top: number = BERT_SPRITE_SIZE.height;
  let bottom = 0;
  parts.forEach(({ part, dy }) => {
    const partTop = part.top === undefined
      ? BERT_SPRITE_SIZE.height - ((part.bottom ?? 0) - dy) - part.height
      : part.top + dy;
    top = Math.min(top, partTop);
    bottom = Math.max(bottom, partTop + part.height);
  });
  return { top, bottom };
}

/**
 * Where everybody stands for the curtain call.
 *
 * Two rows, because one row of twelve on a phone draws men about twenty pixels
 * tall and a squad you cannot see is not a squad coming out to celebrate. The
 * far row is smaller and higher up the pitch, the near row bigger and lower,
 * and the star stands in the middle of the near one — the biggest figure on the
 * screen, which is where the eye should be when he starts dancing.
 */
export function finaleStage(
  performers: readonly FinalePerformer[],
  width: number,
  height: number,
): FinaleStage {
  const grassTop = grassTopFor(height);
  const grassHeight = Math.max(1, height - grassTop);
  const bertExtent = bertMomentExtent(FINALE_BERT_MOMENT);
  const bertScale = Math.min(0.62, Math.max(0.42, width / 700));
  const bert: FinaleBert = {
    scale: bertScale,
    up: Math.max(16, grassHeight * BERT_FEET),
    visibleHeight: (bertExtent.bottom - bertExtent.top) * bertScale,
    boxWidth: BERT_SPRITE_SIZE.width * bertScale,
    boxHeight: BERT_SPRITE_SIZE.height * bertScale,
    boxFloorGap: (BERT_SPRITE_SIZE.height - bertExtent.bottom) * bertScale,
  };
  if (performers.length === 0) return { spots: [], bert };

  const star = performers.find(performer => performer.isStar);
  const others = performers.filter(performer => performer !== star);
  // Fewer men in the near row than the far one — the shape of a team photo,
  // where the back row is the wide one and the front row sits inside it.
  const frontCount = Math.max(1, Math.floor(performers.length / 2));
  const front = star === undefined
    ? others.slice(0, frontCount)
    : withStarCentred(others.slice(0, frontCount - 1), star);
  const back = star === undefined ? others.slice(frontCount) : others.slice(frontCount - 1);

  const frontScale = rowScale(front.length, width);
  const backScale = frontScale * BACK_SCALE_RATIO;
  const phaseOf = (performer: FinalePerformer) => (
    (performers.indexOf(performer) * PHASE_STEP) % 1
  );

  return {
    spots: [
      ...rowSpots(back, 0, backScale, BACK_ROW_FEET, width, height, grassTop, grassHeight, phaseOf),
      ...rowSpots(front, 1, frontScale, FRONT_ROW_FEET, width, height, grassTop, grassHeight, phaseOf),
    ],
    bert,
  };
}

/** The star in the middle of his row, with the rest closing up around him. */
function withStarCentred(
  others: readonly FinalePerformer[],
  star: FinalePerformer,
): FinalePerformer[] {
  const middle = Math.floor(others.length / 2);
  return [...others.slice(0, middle), star, ...others.slice(middle)];
}

/** How big one row is drawn: as big as it can be without leaving the window. */
function rowScale(count: number, width: number): number {
  if (count <= 0) return FRONT_MAX_SCALE;
  const available = Math.max(1, width - SIDE_MARGIN * 2);
  const perMan = available / count;
  return Math.min(FRONT_MAX_SCALE, perMan / (FINALE_CELL.width * (1 + GAP_RATIO)));
}

function rowSpots(
  row: readonly FinalePerformer[],
  index: 0 | 1,
  scale: number,
  feet: number,
  width: number,
  height: number,
  grassTop: number,
  grassHeight: number,
  phaseOf: (performer: FinalePerformer) => number,
): FinaleSpot[] {
  if (row.length === 0) return [];
  const spriteWidth = FINALE_CELL.width * scale;
  const gap = spriteWidth * GAP_RATIO;
  const rowWidth = spriteWidth * row.length + gap * (row.length - 1);
  // Clamped, so a full squad on a narrow phone stays on the screen rather than
  // walking off the left touchline to keep away from a bubble.
  const startX = Math.max(
    SIDE_MARGIN,
    Math.min(width * ROW_CENTRE - rowWidth / 2, width - SIDE_MARGIN - rowWidth),
  );
  // Never above the grass line, whatever the window shape does to the bands: a
  // man standing on the terrace is the old floor-plan mistake in a new place.
  const y = Math.max(
    grassTop + 2,
    height - grassHeight * feet - FINALE_CELL.height * scale,
  );
  return row.map((performer, position) => ({
    id: performer.id,
    spriteKey: performer.spriteKey,
    x: startX + position * (spriteWidth + gap),
    y,
    scale,
    row: index,
    dancing: performer.isStar,
    phase: phaseOf(performer),
  }));
}
