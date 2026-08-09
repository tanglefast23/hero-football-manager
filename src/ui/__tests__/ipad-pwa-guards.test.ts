import { readFileSync } from 'fs';
import { join } from 'path';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

/**
 * Source-level fences for the iPad / installed-web-app audit. They cover the
 * invariants a build is not needed to check; the shipped shell and CSS are
 * checked against a real export by `npm run qa:ipad`.
 *
 * Spec: docs/superpowers/plans/2026-08-06-ipad-pwa-audit-spec.md
 */
describe('iPad and installed web app guards', () => {
  it('flushes a queued career save when the app is hidden', () => {
    const hook = read('src/ui/use-suspend-flush.ts');
    const app = read('App.tsx');

    // iOS kills a backgrounded web app without warning, so the write cannot be
    // left waiting its turn in the serial queue.
    expect(hook).toContainSource(
      "document.addEventListener('visibilitychange', onVisibilityChange)",
    );
    expect(hook).toContainSource("window.addEventListener('pagehide', flush)");
    expect(hook).toContainSource('void flushPendingCareerSave();');
    expect(app).toContainSource('useSuspendFlush();');
    // A back-forward-cache restore never re-mounts React, so the hook must not
    // tear the store or its queue down.
    expect(hook).not.toContainSource('teardown');
  });

  it('writes that career ahead of the queue instead of waiting for it', () => {
    const store = read('src/application/store.ts');

    // Awaiting the queue would observe durability without making it arrive any
    // sooner; only cutting ahead shortens the window a kill can land in.
    expect(store).toContainSource(
      'export async function flushPendingCareerSave()',
    );
    expect(store).toContainSource('&& exclusiveSaveDepth === 0');
    expect(store).toContainSource(
      'pendingCareerSave = null;\n    try {\n      await repository.save(snapshot.state);',
    );
    // Multi-statement sequences must never have a cut-ahead land inside them.
    expect(store).toContainSource('let exclusiveSaveDepth = 0;');
    expect(store).toContainSource(
      'withExclusiveSave(() => repository.delete())',
    );
    expect(store).toContainSource(
      'withExclusiveSave(() => repository.restoreBackup())',
    );
    expect(store).toContainSource('() => withExclusiveSave(async () => {');
  });

  it('asks the browser to keep the save, and remembers the answer', () => {
    const storage = read('src/persistence/persistent-storage.ts');
    const app = read('App.tsx');

    expect(storage).toContainSource('navigator.storage');
    expect(storage).toContainSource('await storage.persist()');
    expect(storage).toContainSource('export function persistentStorageGrant()');
    expect(app).toContainSource('void requestPersistentStorage();');
  });

  it('never mistakes a suspended launch for a failed one', () => {
    const app = read('App.tsx');

    // iOS suspends a backgrounded web app mid-boot and throttles its timers, so
    // the deadline has to be postponed rather than fired while nobody is looking.
    expect(app).toContainSource('function appIsHidden()');
    expect(app).toContainSource(
      'if (appIsHidden()) {\n          armBootTimeout();',
    );
    expect(app).toContainSource("AppState.currentState !== 'active'");
  });

  it('re-bases the match clock when the app comes back', () => {
    const match = read('src/render/MatchScreen.tsx');

    // RAF stops while hidden but performance.now() does not, so without this the
    // first frame back would see a multi-minute delta.
    expect(match).toContainSource("const appIsActive = next === 'active';");
    expect(match).toContainSource('last = performance.now();');
    expect(match).toContainSource('acc = 0;');
  });

  it('keeps hover-only UI gated on a hovering pointer, not on being the web', () => {
    for (const path of [
      'src/ui/components/SfxPressable.tsx',
      'src/ui/components/InfoTip.tsx',
      'src/render/SubstitutionBoard.tsx',
    ]) {
      const source = read(path);
      expect(source).toContainSource('hasHoverPointer');
      expect(source).not.toContainSource("Platform?.OS === 'web'");
    }
    expect(read('src/ui/pointer-capability.ts')).toContainSource(
      "matchMedia('(hover: hover)')",
    );
  });

  it('keeps the browser from stealing taps, holds and overscroll', () => {
    const css = read('global.css');

    expect(css).toContainSource('touch-action: manipulation;');
    expect(css).toContainSource('-webkit-touch-callout: none;');
    expect(css).toContainSource('overscroll-behavior: none;');
  });

  it('ships a shell an iPad can install', () => {
    const html = read('public/index.html');
    const manifest = JSON.parse(read('public/manifest.json')) as Record<
      string,
      unknown
    >;

    // Expo resolves public/index.html ahead of its own template, so the
    // placeholders it substitutes have to survive.
    expect(html).toContainSource('%LANG_ISO_CODE%');
    expect(html).toContainSource('%WEB_TITLE%');
    expect(html).toContainSource('<div id="root"></div>');
    expect(html).toContainSource('viewport-fit=cover');
    expect(html).toContainSource('name="apple-mobile-web-app-capable"');
    expect(html).toContainSource('name="theme-color"');
    expect(html).toContainSource('rel="apple-touch-icon"');
    expect(html).toContainSource('rel="manifest"');
    // global.css is a stylesheet link and lands after first paint.
    expect(html).toContainSource('background: #241f2e;');

    expect(manifest.display).toBe('standalone');
    // Native locks portrait; the tablet is played in landscape.
    expect(manifest.orientation).toBe('any');
    expect(manifest.theme_color).toBe('#241f2e');
  });

  it('keeps focused inputs above the size that makes iOS zoom the page', () => {
    const creation = read('src/ui/screens/CharacterCreationScreen.tsx');
    const glossary = read('src/ui/GlossaryPanel.tsx');

    // Under 16px, focusing an input zooms the whole page on iOS. text-base is
    // exactly 16 on web and text-xl is 20.
    expect(creation).toContainSource('text-xl font-bold text-ink');
    expect(creation).toContainSource('autoCapitalize="words"');
    expect(creation).toContainSource('autoCorrect={false}');
    expect(glossary).toContainSource('text-base text-ink');
    expect(glossary).toContainSource('autoCapitalize="none"');
  });
});
