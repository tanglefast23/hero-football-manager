import {
  CREATION_BASE_RATING,
  CREATION_POINT_POOL,
  CREATION_RATING_TOTAL,
  CREATION_STAT_MAX,
  CREATION_STAT_MIN,
  DEFAULT_CREATED_APPEARANCE,
  DEFAULT_CREATION_RATINGS,
  creationPointsRemaining,
  validateCreatedPlayerDraft,
} from '../player-creation';

describe('created outfield player point-buy', () => {
  it('uses six visible outfield stats and pins the hidden GK-only REF filler', () => {
    const result = validateCreatedPlayerDraft({
      name: '  Jo   Rook  ',
      ratings: DEFAULT_CREATION_RATINGS,
    });

    expect(result.name).toBe('Jo Rook');
    expect(result.attrs).toEqual({
      ...DEFAULT_CREATION_RATINGS,
      ref: 10,
    });
    expect(DEFAULT_CREATION_RATINGS).toEqual({
      pac: 50,
      sho: 50,
      pas: 50,
      def: 50,
      tec: 50,
      sta: 50,
    });
    expect(creationPointsRemaining(DEFAULT_CREATION_RATINGS)).toBe(15);
    expect(Object.values(DEFAULT_CREATION_RATINGS).reduce((sum, value) => sum + value, 0))
      .toBe(6 * CREATION_BASE_RATING);
    expect(CREATION_RATING_TOTAL).toBe(6 * CREATION_BASE_RATING + CREATION_POINT_POOL);
  });

  it('starts every appearance selector on its first option', () => {
    expect(DEFAULT_CREATED_APPEARANCE).toEqual({
      skinTone: 0,
      hairstyle: 0,
      kitAccent: 0,
    });
    expect(validateCreatedPlayerDraft({
      name: 'Jo Rook',
      ratings: DEFAULT_CREATION_RATINGS,
    }).appearance).toEqual(DEFAULT_CREATED_APPEARANCE);
  });

  it('allows flavor specialization without exceeding the Div-5 cap', () => {
    const specialist = {
      pac: CREATION_STAT_MAX,
      sho: CREATION_STAT_MAX,
      pas: CREATION_STAT_MAX,
      def: 50,
      tec: CREATION_STAT_MIN,
      sta: CREATION_STAT_MIN,
    };
    expect(creationPointsRemaining(specialist)).toBe(0);
    expect(() => validateCreatedPlayerDraft({ name: 'Dash Rook', ratings: specialist }))
      .not.toThrow();
  });

  it('allows unspent points and lets reductions fund a different balance', () => {
    const redistributed = {
      ...DEFAULT_CREATION_RATINGS,
      pac: 45,
      sho: 65,
      tec: 55,
    };
    expect(creationPointsRemaining(redistributed)).toBe(0);
    expect(() => validateCreatedPlayerDraft({ name: 'Rook', ratings: redistributed }))
      .not.toThrow();
    expect(() => validateCreatedPlayerDraft({
      name: 'Rook',
      ratings: DEFAULT_CREATION_RATINGS,
    })).not.toThrow();
  });

  it('rejects overspending, values outside the bounds, and malformed names', () => {
    expect(() => validateCreatedPlayerDraft({
      name: 'Rook',
      ratings: { ...DEFAULT_CREATION_RATINGS, pac: CREATION_STAT_MAX, sho: 51 },
    })).toThrow('exceed');
    expect(() => validateCreatedPlayerDraft({
      name: 'Rook',
      ratings: { ...DEFAULT_CREATION_RATINGS, pac: CREATION_STAT_MAX + 1 },
    })).toThrow('PAC');
    expect(() => validateCreatedPlayerDraft({ name: ' ', ratings: DEFAULT_CREATION_RATINGS }))
      .toThrow('name');
  });
});
