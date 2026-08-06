/**
 * Asks the browser to keep the save database.
 *
 * The web build stores the career in SQLite over OPFS, and a browser is free to
 * evict that when space runs short — Safari especially, which also ages out data
 * for sites it does not consider installed. `navigator.storage.persist()` is the
 * only way to ask it not to; an installed home-screen web app is normally granted
 * it without a prompt, and a plain tab is normally refused. Either way the answer
 * is worth recording: "the browser told us it may delete this" is the difference
 * between a mystery and a known risk when a career disappears.
 *
 * Fail-soft and web-only: native has a real file, and jest has no navigator.
 */
export type PersistentStorageGrant = 'granted' | 'refused' | 'unsupported';

let grant: PersistentStorageGrant | null = null;

/** What the browser last answered, or null before it has been asked. */
export function persistentStorageGrant(): PersistentStorageGrant | null {
  return grant;
}

/**
 * Asks once per session and remembers the answer. Never throws: a browser that
 * refuses, or has no Storage API at all, still gets to run the game.
 */
export async function requestPersistentStorage(): Promise<PersistentStorageGrant> {
  if (grant !== null) return grant;
  const storage = typeof navigator === 'undefined' ? undefined : navigator.storage;
  if (storage?.persist === undefined) {
    return record('unsupported');
  }
  try {
    // `persisted()` first: asking again when it is already granted is pointless,
    // and on some browsers `persist()` is the call that can show a prompt.
    const already = storage.persisted === undefined ? false : await storage.persisted();
    return record(already || await storage.persist() ? 'granted' : 'refused');
  } catch {
    return record('unsupported');
  }
}

/**
 * Remembers the answer and says it once in the console, so it is visible in a
 * browser's inspector (and the Metro log) rather than only through the getter
 * above. A career that disappears should not be the first time anyone learns
 * the browser said it might delete it.
 */
function record(answer: PersistentStorageGrant): PersistentStorageGrant {
  grant = answer;
  console.info(`persistence: browser storage is ${answer}`);
  return answer;
}
