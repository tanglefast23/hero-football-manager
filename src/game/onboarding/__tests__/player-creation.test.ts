import {
  CREATION_POINT_POOL,
  CREATION_RATING_TOTAL,
  CREATION_STAT_MAX,
  CREATION_STAT_MIN,
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
    expect(creationPointsRemaining(DEFAULT_CREATION_RATINGS)).toBe(0);
    expect(Object.values(DEFAULT_CREATION_RATINGS).reduce((sum, value) => sum + value, 0))
      .toBe(CREATION_RATING_TOTAL);
    expect(CREATION_RATING_TOTAL).toBe(6 * CREATION_STAT_MIN + CREATION_POINT_POOL);
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

  it('rejects unspent points, values outside the bounds, and malformed names', () => {
    expect(() => validateCreatedPlayerDraft({
      name: 'Rook',
      ratings: { ...DEFAULT_CREATION_RATINGS, pac: 52 },
    })).toThrow('remaining');
    expect(() => validateCreatedPlayerDraft({
      name: 'Rook',
      ratings: { ...DEFAULT_CREATION_RATINGS, pac: CREATION_STAT_MAX + 1, sho: 52 },
    })).toThrow('PAC');
    expect(() => validateCreatedPlayerDraft({ name: ' ', ratings: DEFAULT_CREATION_RATINGS }))
      .toThrow('name');
  });
});
