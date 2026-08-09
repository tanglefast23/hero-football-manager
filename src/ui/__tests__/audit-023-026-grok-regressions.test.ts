import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const app = readFileSync(join(process.cwd(), 'App.tsx'), 'utf8');

describe('Grok regressions for locale and lazy QA loading', () => {
  it('lets only the latest asynchronous language choice update preferences', () => {
    expect(app).toContainSource('const languageRequestIdRef = useRef(0);');
    expect(app).toContainSource(
      'const requestId = ++languageRequestIdRef.current;',
    );
    expect(
      app.match(/requestId !== languageRequestIdRef\.current/g),
    ).toHaveLength(2);
  });

  it('continues cold boot in English if a saved locale chunk fails', () => {
    expect(app).toContainSource(
      "nextPreferences = { ...stored, language: 'en' };",
    );
    expect(app).toContainSource(
      "copyRef.current('app.languageCouldNotLoad', { detail })",
    );
    expect(app).toContainSource('store.notify(languageWarning);');
  });

  it('puts the lazy QA root behind an error boundary with a title fallback', () => {
    expect(app).toContainSource(
      'const [qaBypassed, setQaBypassed] = useState(false);',
    );
    expect(app).toContainSource('if (qaRoot !== null && !qaBypassed)');
    expect(app).toContainSource(
      '<ScreenErrorBoundary onRecover={() => setQaBypassed(true)}>',
    );
  });
});
