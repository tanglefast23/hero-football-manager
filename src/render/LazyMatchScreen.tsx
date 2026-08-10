import { lazy } from 'react';

/**
 * One shared split point for every live-match consumer.
 *
 * Keeping the dynamic import here prevents Metro from treating MatchScreen as
 * shared eager code when the main app, awakening demo, and QA route all use it.
 */
export const LazyMatchScreen = lazy(async () => {
  const module = await import('./MatchScreen');
  return { default: module.MatchScreen };
});
