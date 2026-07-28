/**
 * Bert's two-frame walk, as data.
 *
 * He is not a sprite sheet — he is thirty absolutely-positioned rectangles — so
 * his walk cannot be a row of cells in the atlas. It is instead a pair of
 * whole-pixel offsets applied over his authored geometry.
 *
 * Two frames at `BERT_WALK_STEP_MS`, matching `PlayerRunSprite` exactly. The
 * two characters share a screen during onboarding week and must move in the
 * same language; a smoother Bert beside a two-frame rookie would read as two
 * games.
 *
 * Every offset is a whole number. `docs/11-art-style.md` makes one logical
 * pixel the unit and forbids half-pixels, so the walk moves and resizes parts
 * rather than rotating them — an animated small-angle rotation is exactly the
 * off-grid shimmer that rule exists to prevent. Bert's authored pose already
 * contains static rotations (lapels, brows, moustache, arms) and those are left
 * untouched.
 */

/** How long each of the two frames holds. Same cadence as `PlayerRunSprite`. */
export const BERT_WALK_STEP_MS = 130;

/** The sprite box every offset is measured inside. */
export const BERT_SPRITE_SIZE = { width: 104, height: 180 } as const;

/** The only parts the walk touches. Everything else rides the body offset. */
export type BertWalkPart =
  | 'leftLeg'
  | 'rightLeg'
  | 'leftShoe'
  | 'rightShoe'
  | 'groundShadow'
  | 'leftArm'
  | 'rightArm'
  | 'leftHand'
  | 'rightHand';

export interface BertPartDelta {
  /**
   * Whole pixels down the screen, whatever edge the part is anchored to. The
   * component resolves the sign: a bottom-anchored part subtracts, a
   * top-anchored part adds.
   */
  readonly dy: number;
  /** Whole pixels of extra length. Legs only — a planted leg stretches. */
  readonly dh?: number;
}

export interface BertWalkFrame {
  /** Whole-pixel shift of the whole figure. Negative lifts him. */
  readonly bodyDy: number;
  readonly parts: Readonly<Record<BertWalkPart, BertPartDelta>>;
}

const STILL: Readonly<Record<BertWalkPart, BertPartDelta>> = {
  leftLeg: { dy: 0, dh: 0 },
  rightLeg: { dy: 0, dh: 0 },
  leftShoe: { dy: 0 },
  rightShoe: { dy: 0 },
  groundShadow: { dy: 0 },
  leftArm: { dy: 0 },
  rightArm: { dy: 0 },
  leftHand: { dy: 0 },
  rightHand: { dy: 0 },
};

/**
 * Frame A is the authored pose, unchanged — a walk has to be able to hand him
 * back exactly as the briefing card drew him.
 *
 * Frame B is the passing position. His left foot lifts four pixels while the
 * hip stays put (the leg shortens by as much as it rises, so the joint does not
 * travel), the body rises one, and the planted right leg stretches by one to
 * keep that foot on the ground rather than floating with him. The ground shadow
 * cancels the body offset for the same reason: shadows do not bob.
 */
export const BERT_WALK_FRAMES: readonly BertWalkFrame[] = [
  { bodyDy: 0, parts: STILL },
  {
    bodyDy: -1,
    parts: {
      // Rises 3 within the figure, plus the body's 1, without moving the hip.
      leftLeg: { dy: -3, dh: -3 },
      leftShoe: { dy: -3 },
      // Stretches 1 downward to stand still while the body lifts off it.
      rightLeg: { dy: 1, dh: 1 },
      rightShoe: { dy: 1 },
      groundShadow: { dy: 1 },
      // A front-facing swing: one arm forward reads as one arm lower.
      leftArm: { dy: 2 },
      leftHand: { dy: 2 },
      rightArm: { dy: -2 },
      rightHand: { dy: -2 },
    },
  },
];

/** Every part the frames are allowed to name, for the component and its tests. */
export const BERT_WALK_PARTS = Object.keys(STILL) as readonly BertWalkPart[];
