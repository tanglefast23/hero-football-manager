import { readFileSync } from 'fs';
import { join } from 'path';
import { loadCatalog } from '../../../i18n';

/**
 * The screen itself cannot be rendered here — this suite runs on the node
 * environment with no DOM and no react-native — so what is pinned is the small
 * set of facts about the file that are expensive to notice by eye and easy to
 * break by tidying: the order the steps are drawn in, and the two NativeWind
 * traps this repo has already been bitten by.
 */
const SOURCE = readFileSync(
  join(process.cwd(), 'src', 'ui', 'screens', 'SeasonPodiumScreen.tsx'),
  'utf8',
);

describe('the podium screen', () => {
  it('draws the steps 2 · 1 · 3, winner in the middle', () => {
    // Reversing this is invisible in a diff and wrong in every photograph of a
    // podium ever taken.
    expect(SOURCE).toMatchSource(/BLOCK_ORDER[^=]*=\s*\[2,\s*1,\s*3\]/);
  });

  it('makes the winner s block the tallest and third place the shortest', () => {
    const heights =
      /BLOCK_HEIGHT[^=]*=\s*\{\s*1:\s*(\d+),\s*2:\s*(\d+),\s*3:\s*(\d+)/.exec(
        SOURCE,
      );
    expect(heights).not.toBeNull();
    const [first, second, third] = heights!.slice(1).map(Number);
    expect(first).toBeGreaterThan(second);
    expect(second).toBeGreaterThan(third);
  });

  /**
   * NativeWind does not process `className` on `Animated.View` / `Animated.Text`
   * — the styles silently vanish. Every animated wrapper here must stay
   * style-only, with the look on a plain View or Text inside it.
   */
  it('keeps every animated wrapper style-only', () => {
    const animatedWithClassName =
      /<Animated\.(?:View|Text)[^>]*className=/s.exec(SOURCE);
    expect(animatedWithClassName?.[0] ?? null).toBeNull();
  });

  /**
   * The music is the awards bed, started by `menuThemeForScreen` for the whole
   * boundary. A bed started inside the screen would loop underneath that one.
   */
  it('starts no music bed of its own', () => {
    expect(SOURCE).not.toMatchSource(
      /playCelebrationAnthem|setMenuTheme|playBed/,
    );
  });

  /**
   * The three ordinals are looked up through `ORDINAL_KEYS[...]`, a variable.
   * i18n gate 1b only scans LITERAL `t('...')` calls, so it cannot see these —
   * a rename in the catalog would ship as `seasonPodium.first` drawn on the
   * winner's block, in every language, with CI green.
   */
  it('names three ordinal keys the catalog actually has', () => {
    const english = loadCatalog('en').strings;
    const keys = [...SOURCE.matchAll(/'(seasonPodium\.[a-zA-Z.]+)'/g)].map(
      (match) => match[1]!,
    );

    expect(keys).toEqual(
      expect.arrayContaining([
        'seasonPodium.first',
        'seasonPodium.second',
        'seasonPodium.third',
      ]),
    );
    expect(keys.filter((key) => !(key in english))).toEqual([]);
  });

  it('can always be skipped, and ends itself if it is not', () => {
    expect(SOURCE).toMatchSource(/onPress=\{completeOnce\}/);
    expect(SOURCE).toMatchSource(/setTimeout\(\s*completeOnce/);
  });
});
