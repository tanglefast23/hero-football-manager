import { readFileSync } from 'fs';
import { join } from 'path';

const source = (path: string) =>
  readFileSync(join(process.cwd(), path), 'utf8');

describe('automatic substitution policy', () => {
  it('opens every live match on the saved setting, with a fresh install defaulting off', () => {
    const match = source('src/render/MatchScreen.tsx');
    const repository = source('src/persistence/preferences-repository.ts');

    expect(match).toContain('autoSubs: initialAutoSubs = false,');
    expect(match).toContain(
      'const [autoSubs, setAutoSubs] = useState(initialAutoSubs);',
    );
    expect(match).toContain('const autoSubsRef = useRef(initialAutoSubs);');
    expect(repository).toContain('autoSubs: false,');
    // The old default made the manager re-tick AUTO every week.
    expect(match).not.toContain(
      'const [autoSubs, setAutoSubs] = useState(false);',
    );
  });

  it('reports the board’s save so the preference outlives the screen', () => {
    const match = source('src/render/MatchScreen.tsx');

    expect(match).toContain(
      'if (nextAutoSubs !== autoSubsRef.current) onAutoSubsChange?.(nextAutoSubs);',
    );
  });

  it('evaluates Auto Subs after every engine tick inside a catch-up frame', () => {
    const match = source('src/render/MatchScreen.tsx');
    const loopStart = match.indexOf(
      "while (acc >= TICK_MS && s.phase !== 'fulltime') {",
    );
    const loopEnd = match.indexOf('\n      const newEvents =', loopStart);

    expect(loopStart).toBeGreaterThan(-1);
    expect(loopEnd).toBeGreaterThan(loopStart);
    const catchUpLoop = match.slice(loopStart, loopEnd);
    expect(catchUpLoop).toMatch(
      /if \(!heldForPowerReview && !heldForMatchVfxReview\) \{\s*tick\(s\);[\s\S]*?queueControlledAutoSubstitution\(s, autoSubsRef\.current\);\s*\}/,
    );
    expect(match.slice(loopEnd)).not.toContain(
      'queueControlledAutoSubstitution(s, autoSubsRef.current);',
    );
  });

  it('stores it beside the other match settings, not in the career save', () => {
    const app = source('App.tsx');
    const repository = source('src/persistence/preferences-repository.ts');

    expect(app).toContain('autoSubs={preferences.autoSubs}');
    expect(app).toContain('onAutoSubsChange={saveAutoSubs}');
    expect(app).toContain(
      'savePreferences({ ...preferencesRef.current, autoSubs });',
    );
    expect(repository).toContain('autoSubs: z.boolean(),');
    expect(repository).toContain('autoSubs: false,');
  });

  it('clears the switch when a new career begins, so a fresh manager starts off', () => {
    const app = source('App.tsx');
    const beginStart = app.indexOf('  const beginNewCareer = useCallback(');
    const beginEnd = app.indexOf('  const startNewCareer = useCallback(');

    expect(beginStart).toBeGreaterThan(-1);
    expect(beginEnd).toBeGreaterThan(beginStart);
    expect(app.slice(beginStart, beginEnd)).toContain(
      'if (preferencesRef.current.autoSubs) saveAutoSubs(false);',
    );
  });

  it('always enables tired-player swaps for Quick Result without changing the live preference', () => {
    const app = source('App.tsx');
    const store = source('src/application/store.ts');
    const quickResultStart = store.indexOf(
      "  quickResult(preferences = { initialFormation: '4-4-2' }) {",
    );
    const quickResultEnd = store.indexOf(
      '\n\n  watchMatch() {',
      quickResultStart,
    );

    expect(quickResultStart).toBeGreaterThan(-1);
    expect(quickResultEnd).toBeGreaterThan(quickResultStart);
    expect(store.slice(quickResultStart, quickResultEnd)).toContain(
      'autoSubs: true,',
    );
    expect(app).toContain('autoSubs={preferences.autoSubs}');
    expect(app).not.toContain('autoSubs: preferences.autoSubs,');
  });
});
