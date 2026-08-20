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
    expect(
      Object.values(DEFAULT_CREATION_RATINGS).reduce(
        (sum, value) => sum + value,
        0,
      ),
    ).toBe(6 * CREATION_BASE_RATING);
    expect(CREATION_RATING_TOTAL).toBe(
      6 * CREATION_BASE_RATING + CREATION_POINT_POOL,
    );
  });

  it('starts every appearance selector on its first option', () => {
    expect(DEFAULT_CREATED_APPEARANCE).toEqual({
      skinTone: 0,
      hairstyle: 0,
      kitAccent: 0,
    });
    expect(
      validateCreatedPlayerDraft({
        name: 'Jo Rook',
        ratings: DEFAULT_CREATION_RATINGS,
      }).appearance,
    ).toEqual(DEFAULT_CREATED_APPEARANCE);
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
    expect(() =>
      validateCreatedPlayerDraft({ name: 'Dash Rook', ratings: specialist }),
    ).not.toThrow();
  });

  it('allows unspent points and lets reductions fund a different balance', () => {
    const redistributed = {
      ...DEFAULT_CREATION_RATINGS,
      pac: 45,
      sho: 65,
      tec: 55,
    };
    expect(creationPointsRemaining(redistributed)).toBe(0);
    expect(() =>
      validateCreatedPlayerDraft({ name: 'Rook', ratings: redistributed }),
    ).not.toThrow();
    expect(() =>
      validateCreatedPlayerDraft({
        name: 'Rook',
        ratings: DEFAULT_CREATION_RATINGS,
      }),
    ).not.toThrow();
  });

  it('rejects overspending, values outside the bounds, and malformed names', () => {
    expect(() =>
      validateCreatedPlayerDraft({
        name: 'Rook',
        ratings: {
          ...DEFAULT_CREATION_RATINGS,
          pac: CREATION_STAT_MAX,
          sho: 51,
        },
      }),
    ).toThrow('exceed');
    expect(() =>
      validateCreatedPlayerDraft({
        name: 'Rook',
        ratings: { ...DEFAULT_CREATION_RATINGS, pac: CREATION_STAT_MAX + 1 },
      }),
    ).toThrow('PAC');
    expect(() =>
      validateCreatedPlayerDraft({
        name: ' ',
        ratings: DEFAULT_CREATION_RATINGS,
      }),
    ).toThrow('name');
  });
});

describe('typed names are held to what the shipped pixel face can draw', () => {
  const draft = (name: string) => ({
    name,
    ratings: DEFAULT_CREATION_RATINGS,
  });

  it('accepts the alphabets the face carries', () => {
    // Latin-1 and the hand-built Vietnamese set are IN the face, so these must
    // keep working — a rule that only allowed ASCII would break six locales'
    // own keyboards to fix two.
    for (const name of [
      'Jo Rook',
      "Seán O'Neill-Vega",
      'Ægir Þórsson',
      'Nguyễn Quang Hải',
      'Renée Müller',
      'Player 7',
    ]) {
      expect(validateCreatedPlayerDraft(draft(name)).name).toBe(name);
    }
  });

  it('rejects everything the face would render as a tofu box', () => {
    // Each of these was ACCEPTED before, and drew as an empty box on the league
    // table, the scoreboard, the squad register and the match HUD, in all seven
    // languages. U+202E is here on its own account: it is not a glyph at all,
    // it reverses every character drawn after it.
    for (const name of [
      'Łukasz Piszczek', // Ł
      'Ünder Çalhanoğlu', // ğ
      'Ολυμπιακός', // Greek
      'Зенит', // Cyrillic
      '中村俊輔', // CJK
      '🏆 FC', // emoji
      'Bob‮htim S', // RIGHT-TO-LEFT OVERRIDE
      'Mr {count}', // braces knock translated lines back to English
    ]) {
      expect(() => validateCreatedPlayerDraft(draft(name))).toThrow(
        'cannot display',
      );
    }
  });

  it('holds club and squad renames to the same rule', () => {
    expect(() =>
      validateCreatedPlayerDraft({ ...draft('Jo Rook'), clubName: 'Зенит' }),
    ).toThrow('cannot display');
    expect(() =>
      validateCreatedPlayerDraft({
        ...draft('Jo Rook'),
        rosterNames: { 'club-p1': '🏆' },
      }),
    ).toThrow('cannot display');
  });
});

describe('club kit on the created-player draft', () => {
  const kit = { base: 'FOREST', pattern: 'STRIPES', patternColor: 'STONE' };

  it('carries the chosen kit through validation', () => {
    expect(
      validateCreatedPlayerDraft({
        name: 'Kit Picker',
        ratings: DEFAULT_CREATION_RATINGS,
        clubKit: kit,
      }).clubKit,
    ).toEqual(kit);
  });

  it('leaves a manager who never opened the editor on the stock strip', () => {
    expect(
      validateCreatedPlayerDraft({
        name: 'Kit Picker',
        ratings: DEFAULT_CREATION_RATINGS,
      }).clubKit,
    ).toBeUndefined();
  });

  it('rejects a malformed kit rather than persisting it', () => {
    expect(() =>
      validateCreatedPlayerDraft({
        name: 'Kit Picker',
        ratings: DEFAULT_CREATION_RATINGS,
        clubKit: { base: '', pattern: 'PLAIN', patternColor: 'STONE' },
      }),
    ).toThrow('Club kit base');
  });
});
