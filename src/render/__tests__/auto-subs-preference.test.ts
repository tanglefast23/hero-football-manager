import { readFileSync } from 'fs';
import { join } from 'path';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('bench cover survives the final whistle', () => {
  it('opens every match on the saved setting instead of off', () => {
    const match = source('src/render/MatchScreen.tsx');

    expect(match).toContain('autoSubs: initialAutoSubs = false,');
    expect(match).toContain('const [autoSubs, setAutoSubs] = useState(initialAutoSubs);');
    expect(match).toContain('const autoSubsRef = useRef(initialAutoSubs);');
    // The old default made the manager re-tick AUTO every week.
    expect(match).not.toContain('const [autoSubs, setAutoSubs] = useState(false);');
  });

  it('reports the board’s save so the preference outlives the screen', () => {
    const match = source('src/render/MatchScreen.tsx');

    expect(match).toContain(
      'if (nextAutoSubs !== autoSubsRef.current) onAutoSubsChange?.(nextAutoSubs);',
    );
  });

  it('evaluates Auto Subs after every engine tick inside a catch-up frame', () => {
    const match = source('src/render/MatchScreen.tsx');
    const loopStart = match.indexOf("while (acc >= TICK_MS && s.phase !== 'fulltime') {");
    const loopEnd = match.indexOf('\n      const newEvents =', loopStart);

    expect(loopStart).toBeGreaterThan(-1);
    expect(loopEnd).toBeGreaterThan(loopStart);
    const catchUpLoop = match.slice(loopStart, loopEnd);
    expect(catchUpLoop).toMatch(
      /if \(!heldForPowerReview\) \{\s*tick\(s\);[\s\S]*?queueControlledAutoSubstitution\(s, autoSubsRef\.current\);\s*\}/,
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
    expect(app).toContain('savePreferences({ ...preferencesRef.current, autoSubs });');
    expect(repository).toContain('autoSubs: z.boolean(),');
    expect(repository).toContain('autoSubs: false,');
  });
});
