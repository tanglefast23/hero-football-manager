import { shouldShowOpeningBrief } from '../opening-brief';

describe('opening brief visibility', () => {
  it('shows for a new career and throughout the opening week', () => {
    expect(shouldShowOpeningBrief(null)).toBe(true);
    expect(shouldShowOpeningBrief({ season: 1, week: 1 })).toBe(true);
  });

  it('stays hidden after the opening week, including later season starts', () => {
    expect(shouldShowOpeningBrief({ season: 1, week: 2 })).toBe(false);
    expect(shouldShowOpeningBrief({ season: 1, week: 5 })).toBe(false);
    expect(shouldShowOpeningBrief({ season: 2, week: 1 })).toBe(false);
  });
});
