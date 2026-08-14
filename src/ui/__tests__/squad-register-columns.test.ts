import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CELL_FONT_SIZE,
  CELL_MAX_FONT_MULTIPLIER,
  CELL_WIDEST_VALUE_EM,
  HEADER_FONT_SIZE,
  HEADER_LABEL_ADVANCE_EM,
  HEADER_MIN_GUTTER,
  MINIMUM_TOUCH_TARGET,
  POTENTIAL_CELL_PADDING_RIGHT,
  REGISTER_COLUMN_WIDTH,
  TRAIN_BUTTON_DIAMETER,
  TRAIN_BUTTON_HIT_SLOP,
  headerWidthDemand,
} from '../squad-register-columns';

function screenSource(): string {
  return readFileSync(
    join(process.cwd(), 'src/ui/screens/SquadTrainingScreen.tsx'),
    'utf8',
  );
}

/**
 * The catalog keys each fixed column renders, phone and wide.
 *
 * The labels themselves are read out of the English catalog rather than typed
 * here: they are translated now, and a second hand-typed copy of a string that
 * lives in a file is a copy that goes stale. What this file still owns is the
 * ENGLISH arithmetic — every other locale is measured by gate 8b, which has the
 * font parser and does not need a hand-measured advance per language.
 */
const LABEL_KEYS = {
  role: { phone: 'col.squad.role', wide: 'col.squad.role' },
  overall: { phone: 'col.squad.overall', wide: 'col.squad.score' },
  potential: { phone: 'col.squad.potential', wide: 'col.squad.potentialLong' },
  condition: { phone: 'col.squad.condition', wide: 'col.squad.conditionLong' },
} as const;

const englishStrings: Record<string, string> = JSON.parse(
  readFileSync(join(process.cwd(), 'content/i18n/en.json'), 'utf8'),
).strings;

const LABELS = Object.fromEntries(
  Object.entries(LABEL_KEYS).map(([column, keys]) => [
    column,
    { phone: englishStrings[keys.phone]!, wide: englishStrings[keys.wide]! },
  ]),
) as Record<keyof typeof LABEL_KEYS, { phone: string; wide: string }>;

type ColumnKey = keyof typeof LABEL_KEYS;
const COLUMNS = Object.keys(LABELS) as ColumnKey[];

describe('squad register column widths', () => {
  // A header that fits until you tap it does not fit: the sort arrow is part of
  // every measurement here, whether or not the column is the sorted one.
  it.each(COLUMNS)(
    'holds the phone %s header, its arrow and a gutter',
    (column) => {
      const demand = headerWidthDemand(
        LABELS[column].phone,
        HEADER_FONT_SIZE.phone,
      );
      expect(
        REGISTER_COLUMN_WIDTH.phone[column] - demand,
      ).toBeGreaterThanOrEqual(HEADER_MIN_GUTTER);
    },
  );

  it.each(COLUMNS)(
    'holds the wide %s header, its arrow and a gutter',
    (column) => {
      const demand = headerWidthDemand(
        LABELS[column].wide,
        HEADER_FONT_SIZE.wide,
      );
      expect(
        REGISTER_COLUMN_WIDTH.wide[column] - demand,
      ).toBeGreaterThanOrEqual(HEADER_MIN_GUTTER);
    },
  );

  it('holds row values at the fixed data cell cap without capping the app', () => {
    const max = CELL_MAX_FONT_MULTIPLIER;
    expect(
      readFileSync(join(process.cwd(), 'App.tsx'), 'utf8'),
    ).not.toContainSource('APP_MAX_FONT_SIZE_MULTIPLIER');
    for (const layout of ['phone', 'wide'] as const) {
      const width = REGISTER_COLUMN_WIDTH[layout];
      expect(width.overall).toBeGreaterThanOrEqual(
        CELL_WIDEST_VALUE_EM.overall * CELL_FONT_SIZE.value * max,
      );
      expect(width.potential).toBeGreaterThanOrEqual(
        CELL_WIDEST_VALUE_EM.potential * CELL_FONT_SIZE.value * max +
          POTENTIAL_CELL_PADDING_RIGHT,
      );
      // "100%" at 1.6 wanted 58.8pt of the 60pt this column used to be — the
      // number the manager checks most was one text size from painting over
      // the grade beside it.
      expect(width.condition).toBeGreaterThanOrEqual(
        CELL_WIDEST_VALUE_EM.condition * CELL_FONT_SIZE.condition * max,
      );
    }

    const screen = screenSource();
    expect(
      screen.match(/maxFontSizeMultiplier=\{CELL_MAX_FONT_MULTIPLIER\}/g),
    ).toHaveLength(3);
  });

  it('reads every header out of the catalog rather than typing it', () => {
    // A literal here is a header that stays English in six other languages,
    // which is the whole failure this test exists to catch. The register is the
    // screen a manager stares at longest.
    const source = screenSource();
    const labels = [
      ...source.matchAll(/<SquadSortHeader[\s\S]{0,160}?label=\{([^}]*)\}/g),
    ].map((match) => match[1]!);

    expect(labels.length).toBeGreaterThanOrEqual(5);
    for (const label of labels) {
      expect(label).toMatchSource(/^t\(/);
      expect(label).toContainSource("'col.squad.");
    }
    // No `label="…"` form survives, in this component or any sibling header.
    expect(source).not.toMatchSource(/<SquadSortHeader[\s\S]{0,160}?label="/);
  });

  it('shows a captaincy promise once in roster rows', () => {
    const source = screenSource();

    expect(englishStrings['squadTraining.promiseCaptaincy']).toBe(
      '(Promise) Captain',
    );
    expect(
      source.match(/player\.contractPromisePerk !== 'CAPTAINCY'/g),
    ).toHaveLength(2);
    expect(source).toContainSource(
      "selectedPlayer.contractPromisePerk !== 'CAPTAINCY'",
    );
  });

  it('measures every English label the register renders', () => {
    for (const keys of Object.values(LABEL_KEYS)) {
      for (const key of [keys.phone, keys.wide]) {
        expect(HEADER_LABEL_ADVANCE_EM[englishStrings[key]!]).toBeDefined();
      }
    }
  });

  it('draws the sort arrow instead of typing a glyph the pixel font lacks', () => {
    const source = screenSource();

    // Silkscreen has no ▼/▲, so a typed one is served by a fallback face at an
    // advance nothing here can predict — and the header clips to its column, so
    // the arrow was what got cut. The glyphs may survive in prose, nowhere else.
    const arrowLines = source.split('\n').filter((line) => /[▼▲]/.test(line));
    for (const line of arrowLines) {
      expect(line.trim()).toMatchSource(/^(\*|\/\/)/);
    }
    expect(source).toContainSource('function SquadSortArrow(');
    expect(source).toContainSource('borderTopWidth: SORT_ARROW_HEIGHT');
    expect(source).toContainSource('borderBottomWidth: SORT_ARROW_HEIGHT');
    expect(source).toContainSource('borderLeftWidth: SORT_ARROW_WIDTH / 2');
    // The gap the widths are sized around, in points: `gap-1` is 3.5pt here.
    expect(source).toContainSource('sortHeaderRow: { gap: SORT_ARROW_GAP }');
    // The arrow keeps its place when the label runs out of room.
    expect(source).toContainSource('sortHeaderLabel: { flexShrink: 1 }');
  });

  it('caps how far a header grows with the reader s text size', () => {
    expect(screenSource()).toContainSource(
      'maxFontSizeMultiplier={HEADER_MAX_FONT_MULTIPLIER}',
    );
  });

  it('raises desktop readability without changing native header sizing', () => {
    const source = screenSource();

    expect(source).toContainSource("wideColumns && Platform.OS === 'web'");
    expect(source).toContainSource("? 'text-[13px]'");
    expect(source).toContainSource("? 'text-xs'");
    expect(source).toContainSource('`${labelSize} uppercase text-ink/70`');
    expect(source).toContainSource(
      'className="mt-0.5 text-sm text-ink/70" numberOfLines={2}',
    );
  });

  it('gives the train button a tap target the platform accepts', () => {
    // The comment here used to claim 44 for a button that was really 39: the
    // circle is `w-10`, which is 35pt and not 40. Written as a sum so the claim
    // is checked rather than believed.
    expect(
      TRAIN_BUTTON_DIAMETER + 2 * TRAIN_BUTTON_HIT_SLOP,
    ).toBeGreaterThanOrEqual(MINIMUM_TOUCH_TARGET);
    expect(screenSource()).toContainSource('hitSlop={TRAIN_BUTTON_HIT_SLOP}');
  });

  it('gives the header and the cells under it one width each', () => {
    const source = screenSource();

    // Widths are points, not Tailwind classes: a rem is 14pt on native, so the
    // old `w-12` header sat 6pt left of the `width: 48` role cells below it.
    expect(source).toContainSource(
      'const columns = wideColumns ? ROSTER_COLUMN_STYLE.wide : ROSTER_COLUMN_STYLE.phone;',
    );
    for (const column of COLUMNS) {
      expect(source).toContainSource(`columnStyle={columns.${column}}`);
      expect(source).toContainSource(`style={columns.${column}}`);
    }
    expect(source).not.toContainSource("wideColumns ? 'w-16' : 'w-12'");
    expect(source).not.toContainSource("wideColumns ? 'w-28' : 'w-[60px]'");
  });
});
