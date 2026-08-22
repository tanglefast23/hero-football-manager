import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('startup recovery', () => {
  it('keeps the screen error boundary inside a root safe-area provider', () => {
    const app = readFileSync(join(process.cwd(), 'App.tsx'), 'utf8');
    const appRootStart = app.indexOf('export default function App()');
    const appRootEnd = app.indexOf(
      '\n}\n\nconst POWER_CUT_IN_QA_ENTRIES',
      appRootStart,
    );
    const appRoot = app.slice(appRootStart, appRootEnd);

    expect(appRoot).toMatch(
      /<SafeAreaProvider>\s*<ScreenErrorBoundary[\s\S]*?<GameApp \/>[\s\S]*?<\/ScreenErrorBoundary>\s*<\/SafeAreaProvider>/,
    );
  });

  it('offers a reload when the screen could not load its own code', () => {
    // Screens are lazy chunks on web. A tab left open across a deploy keeps the
    // old index.html, the host 404s that build's chunks, and the boundary's only
    // action — Back to title — returns to the same career, the same fixture and
    // the same 404. Fetching the current build is the one thing that fixes it.
    const boundary = readFileSync(
      join(process.cwd(), 'src/ui/ScreenErrorBoundary.tsx'),
      'utf8',
    );

    // The reload is offered only for a stale bundle, and only where there is a
    // document to reload. Native ships its JS inside the app: no deploy skew.
    expect(boundary).toContainSource(
      "const offerReload = staleBundle && typeof window !== 'undefined';",
    );
    expect(boundary).toContainSource(
      'if (offerReload && reloadBrowserDocument()) return;',
    );

    // The half that is easy to lose in a refactor: an ORDINARY crash must still
    // reach onRecover. That call is what records the crash in the store, and
    // the record is the only reason Continue routes past the screen that threw
    // instead of walking straight back into it. A stale bundle skips it on
    // purpose — the reload restarts the process, so an in-memory flag would not
    // survive to be read anyway.
    expect(boundary).toMatch(
      /if \(offerReload && reloadBrowserDocument\(\)\) return;\s*this\.setState\(\{ message: null, staleBundle: false \}\);\s*this\.props\.onRecover\(\);/,
    );
  });

  it('keeps a chosen language and reloads when its old web chunk is gone', () => {
    const app = readFileSync(join(process.cwd(), 'App.tsx'), 'utf8');

    expect(app).toMatch(
      /isStaleBundleError\(error\)[\s\S]*?savePreferences\(\{[\s\S]*?language,[\s\S]*?preferencesSaveQueueRef\.current\.finally\(\(\) => \{\s*reloadBrowserDocument\(\);/,
    );
  });

  it('does not reconcile the assistant inbox again for its own career update', () => {
    const app = readFileSync(join(process.cwd(), 'App.tsx'), 'utf8');

    expect(app).toMatch(
      /reconciledAssistantInboxCareerRef\.current === career[\s\S]*?store\.reconcileAssistantInbox\(\);[\s\S]*?reconciledAssistantInboxCareerRef\.current = useM1Store\.getState\(\)\.career/,
    );
  });

  it('reloads a locked web database instead of offering to delete a safe career', () => {
    const app = readFileSync(join(process.cwd(), 'App.tsx'), 'utf8');

    expect(app).toMatch(
      /browserDatabaseLock[\s\S]*?isBrowserDatabaseLockError\(bootError\)/,
    );
    expect(app).toMatch(
      /noteBootRetry\(\);\s*if \(reloadBrowserDocument\(\)\) return;[\s\S]*?onStartFresh={\s*browserDatabaseLock\s*\?\s*undefined/,
    );
    // Suppressing Start Fresh is right only while Retry can still work. Retry
    // here reloads the document, so a lock that never clears left the screen
    // with one button that had already failed and no second action, forever.
    // The counter must outlive the reload, so it cannot be component state.
    expect(app).toContainSource('bootRetryCount() < BOOT_RETRY_LIMIT');
    expect(app).toContainSource("const BOOT_RETRY_KEY = 'hfm.bootRetries';");
    expect(app).toContainSource('clearBootRetries();');
  });

  it('never file-resets a failed discard while a backup is still restorable', () => {
    const app = readFileSync(join(process.cwd(), 'App.tsx'), 'utf8');

    // The file-level resetCareerDatabase drops every table, backup included.
    // After a failed repository delete the backup may still load, so the
    // fallback must check for it (on fresh state) before wiping.
    expect(app).toMatch(
      /discardUnreadableSave\(\)\.then\(\(outcome\) => \{\s*if \(outcome !== 'failed'\) return undefined;[\s\S]*?if \(useM1Store\.getState\(\)\.backupSummary !== null\) return undefined;[\s\S]*?resetCareerDatabase\(/,
    );
  });

  it('lets a player export an unreadable save before deleting it', () => {
    const app = readFileSync(join(process.cwd(), 'App.tsx'), 'utf8');

    expect(app).toContainSource('onExportRaw={() => {');
    expect(app).toContainSource(
      'store.exportUnreadableSave(async (fileName, contents) => {',
    );
    expect(app).toContainSource(
      'Share.share({ title: fileName, message: contents })',
    );
    expect(app).toContainSource("label={t('app.exportRawSave')}");
  });
});
