import { grassTopFor } from '../endgame-ground';
import {
  bertSignoffLines,
  FINALE_BERT_MOMENT,
  FINALE_CELL,
  MAX_SIGNOFF_CHARACTERS,
  bertMomentExtent,
  finaleStage,
  type FinalePerformer,
} from '../endgame-finale';

/** The phone floor the staging is composed against. */
const PHONE = { width: 375, height: 812 };
const SIZES = [
  { width: 320, height: 568 },
  PHONE,
  { width: 1280, height: 800 },
];

function squad(count: number): FinalePerformer[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index === 0 ? 'star' : `p${index}`,
    spriteKey: `r:look-${index}:run0`,
    isStar: index === 0,
  }));
}

describe('the curtain call', () => {
  it('brings everybody out', () => {
    const stage = finaleStage(squad(12), PHONE.width, PHONE.height);

    expect(stage.spots).toHaveLength(12);
    expect(new Set(stage.spots.map((spot) => spot.id)).size).toBe(12);
  });

  it('stands them in two rows, the far one smaller and higher', () => {
    const stage = finaleStage(squad(12), PHONE.width, PHONE.height);
    const back = stage.spots.filter((spot) => spot.row === 0);
    const front = stage.spots.filter((spot) => spot.row === 1);

    expect(back.length).toBeGreaterThan(0);
    expect(front.length).toBeGreaterThan(0);
    expect(back[0].scale).toBeLessThan(front[0].scale);
    expect(back[0].y).toBeLessThan(front[0].y);
    // Painted back to front, so the near row overlaps the far one and not the
    // other way round.
    expect(
      stage.spots.slice(0, back.length).every((spot) => spot.row === 0),
    ).toBe(true);
  });

  it('gives the star the middle of the near row, and only he dances', () => {
    const stage = finaleStage(squad(12), PHONE.width, PHONE.height);
    const dancers = stage.spots.filter((spot) => spot.dancing);
    const front = stage.spots.filter((spot) => spot.row === 1);
    const starPosition = front.findIndex((spot) => spot.dancing);

    expect(dancers).toHaveLength(1);
    expect(dancers[0].id).toBe('star');
    expect(dancers[0].row).toBe(1);
    expect(starPosition).toBe(Math.floor((front.length - 1) / 2));
  });

  it('is a crowd jumping rather than one body copied', () => {
    const phases = finaleStage(squad(12), PHONE.width, PHONE.height).spots.map(
      (spot) => spot.phase,
    );

    phases.forEach((phase) => {
      expect(phase).toBeGreaterThanOrEqual(0);
      expect(phase).toBeLessThan(1);
    });
    expect(new Set(phases.map((phase) => phase.toFixed(4))).size).toBe(
      phases.length,
    );
  });

  it('stages the same men in the same places every time', () => {
    expect(finaleStage(squad(9), PHONE.width, PHONE.height)).toEqual(
      finaleStage(squad(9), PHONE.width, PHONE.height),
    );
  });

  /** The fault the whole scene exists to end: a figure standing on the stand. */
  it.each(SIZES)(
    'keeps every man on the grass at $width x $height',
    ({ width, height }) => {
      const stage = finaleStage(squad(12), width, height);
      const grassTop = grassTopFor(height);

      stage.spots.forEach((spot) => {
        expect(spot.y).toBeGreaterThanOrEqual(grassTop);
        expect(spot.y + FINALE_CELL.height * spot.scale).toBeLessThanOrEqual(
          height,
        );
        expect(spot.x).toBeGreaterThanOrEqual(0);
        expect(spot.x + FINALE_CELL.width * spot.scale).toBeLessThanOrEqual(
          width,
        );
      });
    },
  );

  /**
   * Both rows share one centre, and it sits left of the window's — Bert speaks
   * from four fifths of the way across and his bubble hangs over that side.
   */
  it.each(SIZES)(
    'lines both rows up on one mark, clear of Bert, at $width x $height',
    ({ width, height }) => {
      const stage = finaleStage(squad(11), width, height);

      const centres = ([0, 1] as const).flatMap((row) => {
        const inRow = stage.spots.filter((spot) => spot.row === row);
        if (inRow.length === 0) return [];
        const left = inRow[0].x;
        const right =
          inRow[inRow.length - 1].x + FINALE_CELL.width * inRow[0].scale;
        return [(left + right) / 2];
      });

      expect(centres).toHaveLength(2);
      // Within a sprite of each other, so the two rows read as one group. Not
      // exact: on a narrow phone the wider row is held off the edge first, and a
      // row half off the screen would be a worse answer than a row a few pixels
      // out of line.
      expect(Math.abs(centres[0] - centres[1])).toBeLessThan(FINALE_CELL.width);
      expect(centres[0]).toBeLessThan(width / 2);
    },
  );

  it('still stages a lone star, and a squad with no star at all', () => {
    const alone = finaleStage(squad(1), PHONE.width, PHONE.height);
    const leaderless = finaleStage(
      squad(4).map((performer) => ({ ...performer, isStar: false })),
      PHONE.width,
      PHONE.height,
    );

    expect(alone.spots).toHaveLength(1);
    expect(alone.spots[0].dancing).toBe(true);
    expect(alone.spots[0].row).toBe(1);
    expect(leaderless.spots).toHaveLength(4);
    expect(leaderless.spots.some((spot) => spot.dancing)).toBe(false);
  });

  it('has an empty pitch rather than a broken one with nobody left', () => {
    const stage = finaleStage([], PHONE.width, PHONE.height);

    expect(stage.spots).toEqual([]);
    expect(stage.bert.scale).toBeGreaterThan(0);
  });
});

describe('Bert, flat out in front of them', () => {
  it.each(SIZES)(
    'lies nearer the viewer than anybody at $width x $height',
    ({ width, height }) => {
      const stage = finaleStage(squad(12), width, height);
      const bertTop = height - stage.bert.up - stage.bert.visibleHeight;
      // Clear of the nearest man's FEET, not merely of his head: he is lying in
      // front of the whole squad, and his speech bubble hangs in the gap.
      const nearestFeet = Math.max(
        ...stage.spots.map((spot) => spot.y + FINALE_CELL.height * spot.scale),
      );

      expect(bertTop).toBeGreaterThan(nearestFeet);
      expect(stage.bert.up).toBeGreaterThan(0);
      expect(height - stage.bert.up).toBeLessThanOrEqual(height);
    },
  );

  /**
   * A lying pose does not fill the box drawn for a standing man. Measuring it
   * is what puts his speech bubble on his head instead of in the air above it.
   */
  it('measures the drawn figure rather than his whole box', () => {
    const extent = bertMomentExtent(FINALE_BERT_MOMENT);
    const stage = finaleStage(squad(12), PHONE.width, PHONE.height);

    expect(extent.top).toBeGreaterThan(0);
    expect(extent.bottom).toBeGreaterThan(extent.top);
    expect(extent.bottom - extent.top).toBeLessThan(180);
    expect(stage.bert.visibleHeight).toBeLessThan(stage.bert.boxHeight);
    expect(stage.bert.boxFloorGap).toBeGreaterThanOrEqual(0);
  });

  it('lies down rather than standing up', () => {
    const lying = bertMomentExtent(FINALE_BERT_MOMENT);
    const standing = bertMomentExtent('hello');

    expect(lying.bottom - lying.top).toBeLessThan(
      standing.bottom - standing.top,
    );
  });
});

describe('the last thing anybody says', () => {
  /**
   * The ceiling is geometry, not taste: his bubble is drawn 320pt wide with its
   * foot pinned above him, and it grows upward into the squad. Three lines fit
   * in the foreground, four do not.
   */
  it('is two bubbles, and neither is tall enough to cover the pitch', () => {
    expect(bertSignoffLines()).toHaveLength(2);
    bertSignoffLines().forEach((line) => {
      expect(line.length).toBeLessThanOrEqual(MAX_SIGNOFF_CHARACTERS);
    });
  });

  it('thanks the player, names the man who made it, and points at the next one', () => {
    const [thanks, next] = bertSignoffLines();

    expect(thanks).toContain('Joe Vu');
    expect(thanks).toContain('one man on his own');
    expect(thanks.toLowerCase()).toContain('thanks you very much');
    expect(next.toLowerCase()).toContain('the next one');
  });
});
