import { useLocale } from './locale-context';
import { localeMeta, type Locale, type LocaleFaces } from './locales';

/**
 * Module-scope `StyleSheet.create` blocks that name a pixel face, rebuilt per
 * language.
 *
 * Files in `src/render/` and the cut-in screens set `fontFamily` directly
 * rather than through a NativeWind class, so the CSS-variable swap at the app
 * root cannot reach them — their styles are evaluated once at import. Threading
 * a face through every JSX node would mean touching ~57 call sites; this lets a
 * component convert with one line instead:
 *
 *     const makeStyles = (faces: LocaleFaces) => StyleSheet.create({
 *       title: { fontFamily: faces.display, fontSize: 24 },
 *     });
 *
 *     function Board() {
 *       const styles = usePixelStyles(makeStyles);
 *       // every `styles.x` call site is unchanged
 *     }
 *
 * Results are cached per (factory, locale), so sibling components sharing a
 * factory share one style object and `StyleSheet.create` runs at most once per
 * language rather than once per render.
 */
type StyleFactory<T> = (faces: LocaleFaces) => T;

const cache = new WeakMap<StyleFactory<unknown>, Map<Locale, unknown>>();

export function pixelStylesFor<T>(make: StyleFactory<T>, locale: Locale): T {
  let byLocale = cache.get(make as StyleFactory<unknown>);
  if (byLocale === undefined) {
    byLocale = new Map();
    cache.set(make as StyleFactory<unknown>, byLocale);
  }
  const cached = byLocale.get(locale);
  if (cached !== undefined) return cached as T;
  const built = make(localeMeta(locale).faces);
  byLocale.set(locale, built);
  return built;
}

export function usePixelStyles<T>(make: StyleFactory<T>): T {
  return pixelStylesFor(make, useLocale());
}
