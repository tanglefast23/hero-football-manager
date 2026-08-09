const DATABASE_LOCK_MARKERS = [
  'NoModificationAllowedError',
  'createSyncAccessHandle',
  'Access Handles cannot be created',
  'Invalid VFS state',
] as const;

/**
 * Browser SQLite owns one exclusive OPFS access handle. A second game tab can
 * fail before any repository opens, and the cached failed VFS cannot recover
 * inside the same document even after the other tab closes.
 */
export function isBrowserDatabaseLockError(error: unknown): boolean {
  const detail = error instanceof Error
    ? `${error.name}: ${error.message}`
    : String(error);
  return DATABASE_LOCK_MARKERS.some(marker => detail.includes(marker));
}

export interface BrowserReloadTarget {
  reload(): void;
}

/** Reloads the whole web document so Expo SQLite builds a fresh VFS. */
export function reloadBrowserDocument(
  target: BrowserReloadTarget | null = browserReloadTarget(),
): boolean {
  if (target === null) return false;
  target.reload();
  return true;
}

function browserReloadTarget(): BrowserReloadTarget | null {
  if (typeof window === 'undefined') return null;
  return typeof window.location?.reload === 'function' ? window.location : null;
}
