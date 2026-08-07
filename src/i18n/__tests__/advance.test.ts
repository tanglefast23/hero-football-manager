import { advanceEm } from '../advance';
import { LEAGUE_HEADER_ADVANCE_EM } from '../../ui/league-table-columns';

describe('advanceEm', () => {
  test('reproduces the hand-measured English header advances', () => {
    // The existing table was measured offline and typed in. If this parser
    // disagrees with it, one of them is wrong and every width derived from
    // either is suspect — so pin them against each other.
    //
    // Measured in the face the app actually draws. That the derivative agrees
    // with the numbers taken from stock Silkscreen is the whole point of the
    // append-only merge, and it is what keeps the column tables valid.
    for (const [label, expected] of Object.entries(LEAGUE_HEADER_ADVANCE_EM)) {
      expect({ label, em: advanceEm(label, 'HFMSilkscreen_400Regular') })
        .toEqual({ label, em: expected });
      expect(advanceEm(label, 'Silkscreen_400Regular')).toEqual(expected);
    }
  });

  test('Silkscreen is proportional, which is why character counts lie', () => {
    expect(advanceEm('W', 'HFMSilkscreen_400Regular'))
      .toBeGreaterThan(advanceEm('P', 'HFMSilkscreen_400Regular'));
  });

  test('refuses a character the face cannot draw rather than guessing', () => {
    expect(() => advanceEm('Đ', 'Silkscreen_400Regular')).toThrow(/cannot draw/);
    expect(advanceEm('Đ', 'HFMSilkscreen_400Regular')).toBeGreaterThan(0);
  });
});
