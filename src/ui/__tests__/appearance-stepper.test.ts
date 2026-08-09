import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CREATED_APPEARANCE_OPTION_COUNTS,
  CREATED_PLAYER_LOOK_COUNT,
} from '../../game';
import {
  STEPPER_VALUE_CELL_EM,
  formatChoiceValue,
  stepChoice,
  stepperValueWidthEm,
} from '../appearance-stepper';

const source = readFileSync(
  join(process.cwd(), 'src/ui/screens/CharacterCreationScreen.tsx'),
  'utf8',
);

/** Read off the screen itself so this budget cannot drift from the cap it ships. */
const MAX_FONT_SIZE_MULTIPLIER = Number(
  /const STEPPER_MAX_FONT_SIZE_MULTIPLIER = ([\d.]+);/.exec(source)?.[1],
);

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

  it('fits the widest paper-doll value inside the stepper cell at full text scale', () => {
    // The cell holds STEPPER_VALUE_CELL_EM of text, and the screen lets system
    // text grow to STEPPER_MAX_FONT_SIZE_MULTIPLIER, so the widest value has to
    // fit at that multiplier — not merely at 1x, where "10/10" also fit and
    // still shipped as "10/…" on every phone with larger text turned on.
    const widest = Object.values(CREATED_APPEARANCE_OPTION_COUNTS)
      .map((count) => formatChoiceValue(count - 1, count))
      .reduce((longest, value) =>
        value.length > longest.length ? value : longest,
      );
    expect(widest).toBe('10/10');
    expect(
      stepperValueWidthEm(widest, 'data') * MAX_FONT_SIZE_MULTIPLIER,
    ).toBeLessThanOrEqual(STEPPER_VALUE_CELL_EM);
  });

  it('reads in the data voice, the only cut the widest value fits in', () => {
    // Silkscreen Bold is a pixel column wider per glyph. That is the whole bug:
    // the value rendered in the display voice, overflowed above 1.143x system
    // text, and RN ellipsised the number the stepper exists to show.
    expect(stepperValueWidthEm('10/10', 'display')).toBeGreaterThan(
      STEPPER_VALUE_CELL_EM / MAX_FONT_SIZE_MULTIPLIER,
    );
    expect(source).toContain('variant="data"');
    expect(source).not.toMatch(/className="w-16 text-center font-pixel/);
  });
});

describe('paper-doll option counts', () => {
  it('matches the look atlas the steppers cycle through', () => {
    const { skinTone, hairstyle, kitAccent } = CREATED_APPEARANCE_OPTION_COUNTS;
    expect(hairstyle).toBe(10);
    expect(skinTone * hairstyle * kitAccent).toBe(CREATED_PLAYER_LOOK_COUNT);
  });
});
