import { lazy } from 'react';
import { Platform } from 'react-native';
import type { PlayerGiftCelebration } from './PlayerGiftCelebration';
import { loadPixelSheets } from '../render/sprites/pixel-sheets';

let pending: Promise<{ default: typeof PlayerGiftCelebration }> | undefined;

function loadPlayerGiftCelebration() {
  pending ??= (async () => {
    if (Platform.OS === 'web') {
      const { LoadSkiaWeb } =
        await import('@shopify/react-native-skia/lib/module/web');
      await Promise.all([
        LoadSkiaWeb({ locateFile: (file) => `/${file}` }),
        loadPixelSheets(),
      ]);
    }
    const module = await import('./SkiaSurfaceImplementations');
    return { default: module.PlayerGiftCelebration };
  })();
  return pending;
}

export const LazyPlayerGiftCelebration = lazy(loadPlayerGiftCelebration);
export const preloadPlayerGiftCelebration = loadPlayerGiftCelebration;
