import { lazy } from 'react';
import { Platform } from 'react-native';
import type { TrainingDrillModal } from './TrainingDrillModal';

let pending: Promise<{ default: typeof TrainingDrillModal }> | undefined;

/** Training joins the single deferred Skia bundle on web and native. */
function loadTrainingDrillModal() {
  pending ??= (async () => {
    if (Platform.OS === 'web') {
      const { LoadSkiaWeb } =
        await import('@shopify/react-native-skia/lib/module/web');
      await LoadSkiaWeb({ locateFile: (file) => `/${file}` });
    }
    const module = await import('./SkiaSurfaceImplementations');
    return { default: module.TrainingDrillModal };
  })();
  return pending;
}

export const LazyTrainingDrillModal = lazy(loadTrainingDrillModal);

/**
 * Warms the bundle while the roster is on screen. The first + tap used to pay
 * for the Skia download itself, under a null fallback — several silent seconds
 * that read as a dead button. Sharing one promise with `lazy` means the tap
 * either finds it loaded or joins the download already in flight.
 */
export const preloadTrainingDrillModal = loadTrainingDrillModal;
