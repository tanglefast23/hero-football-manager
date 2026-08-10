/**
 * Static web exports are an intentional review surface, while an App Store
 * archive must always enter the real game even if a QA environment variable is
 * accidentally present when Metro bundles it.
 */
export function qaRootRoutesEnabled(isDev: boolean, platform: string): boolean {
  return isDev || platform === 'web';
}

/**
 * Developer Mode: the Settings toggle, and the save/load slot rail it reveals
 * in the management header.
 *
 * Deliberately a hand-flipped constant rather than `__DEV__`. The rail is the
 * only way to reach a mid-career state without replaying to it, and the
 * surfaces where that is most needed — static web exports, TestFlight builds —
 * are exactly the ones where `__DEV__` is false. So it is on everywhere by
 * default and switched off once, by hand, for an App Store archive.
 *
 * Forgetting that switch is the obvious failure, so it is not left to memory:
 * `npm run release:check` fails while this is `true`. Flip it to `false`,
 * archive, then flip it back.
 *
 * Typed `boolean` rather than inferred so both settings compile without the
 * literal type turning the other branch into dead code TypeScript complains
 * about.
 */
export const DEVELOPER_MODE_AVAILABLE: boolean = true;
