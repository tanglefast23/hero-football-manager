import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('first landing startup', () => {
  const html = readFileSync(join(process.cwd(), 'public/index.html'), 'utf8');
  const webEntry = readFileSync(join(process.cwd(), 'index.web.ts'), 'utf8');
  const app = readFileSync(join(process.cwd(), 'App.tsx'), 'utf8');

  test('registers the title without fetching CanvasKit first', () => {
    expect(webEntry).toContain("import App from './App';");
    expect(webEntry).toContain('registerRootComponent(App);');
    expect(webEntry).not.toContain('LoadSkiaWeb');
    expect(html).not.toContain('canvaskit.wasm');
  });

  test('keeps a wordless, non-interactive status shell inside the React root', () => {
    const rootStart = html.indexOf('<div id="root">');
    const shellStart = html.indexOf('<div\n        class="startup-shell"');
    const bodyEnd = html.indexOf('</body>');
    const rootHtml = html.slice(rootStart, bodyEnd);

    expect(rootStart).toBeGreaterThan(-1);
    expect(shellStart).toBeGreaterThan(rootStart);
    expect(shellStart).toBeLessThan(bodyEnd);
    expect(rootHtml).toContain('role="status"');
    expect(rootHtml).toContain('aria-label="Hero Football Manager"');
    expect(rootHtml).toContain('aria-busy="true"');
    expect(rootHtml).not.toMatch(
      /<button|Story|Settings|Continue|New Game|Opening Club Files/i,
    );
  });

  test('waits 500ms before showing the football loading indicator', () => {
    expect(html).toContain('class="startup-indicator"');
    expect(html).toContain(
      'animation: startup-reveal 1ms steps(1, end) 500ms forwards;',
    );
    expect(app).toContain('const LOADING_INDICATOR_DELAY_MS = 500;');
    expect(app).toContain('() => setShowIndicator(true)');
    expect(app).toContain('LOADING_INDICATOR_DELAY_MS');
    expect(app).toContain('{showIndicator ? (');
    expect(app).toContain('outputRange: [0, 80]');
  });

  test('warms native management audio only after a healthy committed title', () => {
    expect(app).toContain("Platform.OS === 'web'");
    expect(app).toContain('bootError !== null');
    expect(app).toContain('!store.persistenceReady');
    expect(app).toContain('store.persistenceLoadError !== null');
    expect(app).toContain("store.screen !== 'welcome'");
    expect(app).toContain("landingView !== 'title'");
    expect(app).toContain('const titleFrame = requestAnimationFrame(() => {');
    expect(app).toContain('warmTimer = setTimeout(prewarmManagementSfx, 0);');
    expect(app).toContain('cancelAnimationFrame(titleFrame);');
    expect(app).toContain('clearTimeout(warmTimer);');
  });
});
