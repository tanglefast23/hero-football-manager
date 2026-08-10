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
 * Debug builds and static web review exports get it automatically. The manual
 * switch exists only for a bounded release-like QA build such as TestFlight;
 * production source keeps it off so an App Store archive fails closed.
 *
 * `npm run release:check` fails while this is `true`, so an enabled QA override
 * cannot silently become the App Store archive.
 *
 * Typed `boolean` rather than inferred so both settings compile without the
 * literal type turning the other branch into dead code TypeScript complains
 * about.
 */
export const DEVELOPER_MODE_AVAILABLE: boolean = false;

export function developerModeAvailable(
  isDev: boolean,
  platform: string,
): boolean {
  return isDev || platform === 'web' || DEVELOPER_MODE_AVAILABLE;
}
