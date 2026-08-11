import { lazy } from 'react';
import { Platform } from 'react-native';

/** Training joins the single deferred Skia bundle on web and native. */
export const LazyTrainingDrillModal = lazy(async () => {
  if (Platform.OS === 'web') {
    const { LoadSkiaWeb } =
      await import('@shopify/react-native-skia/lib/module/web');
    await LoadSkiaWeb({ locateFile: (file) => `/${file}` });
  }
  const module = await import('./SkiaSurfaceImplementations');
  return { default: module.TrainingDrillModal };
});
