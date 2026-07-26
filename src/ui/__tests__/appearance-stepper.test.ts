import { CREATED_APPEARANCE_OPTION_COUNTS, CREATED_PLAYER_LOOK_COUNT } from '../../game';
import { formatChoiceValue, stepChoice } from '../appearance-stepper';

describe('stepChoice', () => {
  it('wraps backward from the first option to the last', () => {
    expect(stepChoice(0, -1, 6)).toBe(5); // skin tone
    expect(stepChoice(0, -1, 10)).toBe(9); // hair
    expect(stepChoice(0, -1, 4)).toBe(3); // kit accent
  });

  it('wraps forward from the last option to the first', () => {
    expect(stepChoice(5, 1, 6)).toBe(0);
    expect(stepChoice(9, 1, 10)).toBe(0);
    expect(stepChoice(3, 1, 4)).toBe(0);
  });

  it('steps without wrapping in the middle of a range', () => {
    expect(stepChoice(2, 1, 6)).toBe(3);
    expect(stepChoice(2, -1, 6)).toBe(1);
  });
});

describe('formatChoiceValue', () => {
  it('reads as a one-based position out of the total', () => {
    expect(formatChoiceValue(2, 10)).toBe('3/10');
    expect(formatChoiceValue(0, 6)).toBe('1/6');
  });

  it('fits the widest paper-doll value inside the stepper cell', () => {
    // Silkscreen advances a flat 0.7em per glyph, so at text-sm (14px) the
    // widest value has to stay inside the w-16 (64px) value column. The spaced
    // "10 / 10" needs 70px, which is why hair shipped truncated to "3 / …".
    const widest = Object.values(CREATED_APPEARANCE_OPTION_COUNTS)
      .map(count => formatChoiceValue(count - 1, count))
      .reduce((longest, value) => (value.length > longest.length ? value : longest));
    expect(widest).toBe('10/10');
    expect(widest.length * 0.7 * 14).toBeLessThanOrEqual(64);
  });
});

describe('paper-doll option counts', () => {
  it('matches the look atlas the steppers cycle through', () => {
    const { skinTone, hairstyle, kitAccent } = CREATED_APPEARANCE_OPTION_COUNTS;
    expect(hairstyle).toBe(10);
    expect(skinTone * hairstyle * kitAccent).toBe(CREATED_PLAYER_LOOK_COUNT);
  });
});
