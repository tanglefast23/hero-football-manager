import { readFileSync } from 'fs';
import { join } from 'path';

describe('rival hero power showcase layering', () => {
  it('renders the effect canvas above the showcase stacking context', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/ui/RivalHeroPowerShowcase.tsx'),
      'utf8',
    );
    const showcaseStart = source.indexOf(
      'testID={`rival-hero-power-showcase-${viewModel.heroId}`}',
    );
    const showcaseEnd = source.indexOf('</View>', showcaseStart);
    const foregroundCanvas = source.indexOf(
      'style={styles.foregroundEffects}',
      showcaseEnd,
    );

    expect(showcaseStart).toBeGreaterThan(-1);
    expect(showcaseEnd).toBeGreaterThan(showcaseStart);
    expect(foregroundCanvas).toBeGreaterThan(showcaseEnd);
    expect(source).toMatch(
      /foregroundEffects:\s*\{[^}]*pointerEvents: 'none'[^}]*zIndex: 10/s,
    );
  });
});
