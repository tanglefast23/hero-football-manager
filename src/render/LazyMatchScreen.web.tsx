import { lazy } from 'react';
import { loadPixelSheets } from './sprites/pixel-sheets';

/** The match owns CanvasKit loading on web; the title does not wait for it. */
export const LazyMatchScreen = lazy(async () => {
  const { LoadSkiaWeb } =
    await import('@shopify/react-native-skia/lib/module/web');
  // The sprite pool is its own chunk on web and the atlas builder reads it
  // synchronously, so it has to be resident before the surface mounts. App
  // starts this fetch at module eval; this await is the guarantee.
  await Promise.all([
    LoadSkiaWeb({ locateFile: (file) => `/${file}` }),
    loadPixelSheets(),
  ]);
  const module = await import('../ui/SkiaSurfaceImplementations');
  return { default: module.MatchScreen };
});
