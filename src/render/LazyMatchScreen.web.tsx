import { lazy } from 'react';

/** The match owns CanvasKit loading on web; the title does not wait for it. */
export const LazyMatchScreen = lazy(async () => {
  const { LoadSkiaWeb } =
    await import('@shopify/react-native-skia/lib/module/web');
  await LoadSkiaWeb({ locateFile: (file) => `/${file}` });
  const module = await import('../ui/SkiaSurfaceImplementations');
  return { default: module.MatchScreen };
});
