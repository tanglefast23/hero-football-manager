import { pixelStylesFor } from '../use-pixel-styles';
import type { LocaleFaces } from '../locales';

const make = (faces: LocaleFaces) => ({
  title: { fontFamily: faces.display, fontSize: 24 },
  score: { fontFamily: faces.data, fontSize: 18 },
});

describe('pixelStylesFor', () => {
  test('builds styles against the locale s faces', () => {
    expect(pixelStylesFor(make, 'en').title.fontFamily).toBe(
      'HFMSilkscreen_700Bold',
    );
    expect(pixelStylesFor(make, 'vi').title.fontFamily).toBe(
      'HFMSilkscreen_700Bold',
    );
    expect(pixelStylesFor(make, 'vi').score.fontFamily).toBe(
      'HFMSilkscreen_400Regular',
    );
  });

  test('returns the same object for the same factory and locale', () => {
    // Sibling components sharing a factory must share one style object, or
    // StyleSheet.create runs per render and every memo downstream breaks.
    expect(pixelStylesFor(make, 'en')).toBe(pixelStylesFor(make, 'en'));
  });

  test('caches per locale, so a language change really does rebuild', () => {
    expect(pixelStylesFor(make, 'en')).not.toBe(pixelStylesFor(make, 'vi'));
  });

  test('non-font properties survive untouched', () => {
    expect(pixelStylesFor(make, 'vi').title.fontSize).toBe(24);
  });
});
