/**
 * A web deploy replaces the hashed chunk files, so a document loaded before it
 * 404s when it lazy-imports a screen it has not visited yet. Going back to the
 * title cannot help — the rejected import stays rejected for the lifetime of
 * the document, so "Continue" silently dies. Only a document reload recovers.
 */
const STALE_BUNDLE_MARKERS = [
  /AsyncRequireError/,
  /ChunkLoadError/,
  /Failed to fetch dynamically imported module/,
  /Importing a module script failed/,
];

export function isStaleBundleError(error: unknown): boolean {
  const detail =
    error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return STALE_BUNDLE_MARKERS.some((marker) => marker.test(detail));
}
