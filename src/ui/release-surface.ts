/**
 * True when the web bundle is running inside the Electron desktop shell.
 *
 * Structural, not injected: the shell can only serve the game through its
 * `hfm://` scheme, so a page on that scheme is inside the shell by
 * definition. A browser loading `dist/` sees `http:` or `file:` and keeps the
 * review surface. A preload-injected marker was rejected because a missing
 * preload would fail open.
 */
export function insideDesktopShell(
  location: { protocol?: string } | undefined = globalThis.location,
): boolean {
  return location?.protocol === 'hfm:';
}

/**
 * Local web exports are an intentional review surface, while an App Store
 * archive or the desktop shell must always enter the real game even if a QA
 * environment variable is accidentally present when Metro bundles it.
 */
export function qaRootRoutesEnabled(
  isDev: boolean,
  platform: string,
  desktopShell = false,
  location:
    { hostname?: string; protocol?: string } | undefined = globalThis.location,
): boolean {
  return (
    isDev || (platform === 'web' && !desktopShell && localReview(location))
  );
}

function localReview(
  location: { hostname?: string; protocol?: string } | undefined,
): boolean {
  return (
    location?.protocol === 'file:' ||
    location?.hostname === 'localhost' ||
    location?.hostname === '127.0.0.1' ||
    location?.hostname === '[::1]'
  );
}

/**
 * Developer Mode: the Settings toggle, and the save/load slot rail it reveals
 * in the management header.
 *
 * Debug builds and local web review exports get it automatically. The manual
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
  desktopShell = false,
  location:
    { hostname?: string; protocol?: string } | undefined = globalThis.location,
): boolean {
  return (
    isDev ||
    (platform === 'web' && !desktopShell && localReview(location)) ||
    (platform !== 'web' && DEVELOPER_MODE_AVAILABLE)
  );
}
