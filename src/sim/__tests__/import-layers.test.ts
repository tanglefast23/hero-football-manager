import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const SIM_DIR = join(__dirname, '..');

const ALLOWED: Record<string, string[]> = {
  'rng.ts': [],
  'geometry.ts': [],
  'contest.ts': ['rng', 'contest-table.json', 'geometry'],
  'types.ts': ['geometry', 'rng'],
  'teams.ts': ['types'],
  'formation.ts': ['geometry'],
  'events.ts': ['types'],
  'powers.ts': ['types', 'geometry', 'events'],
  'engine.ts': ['formation', 'geometry', 'events', 'types', 'contest', 'powers'],
  'match.ts': ['rng', 'geometry', 'events', 'engine', 'types', 'powers'],
};

describe('import layers', () => {
  it('every sim module imports only from its allowed layer', () => {
    const violations: string[] = [];
    for (const f of readdirSync(SIM_DIR)) {
      if (!f.endsWith('.ts')) continue;
      if (!(f in ALLOWED)) {
        violations.push(`${f}: not in the layer map — add it deliberately`);
        continue;
      }
      const src = readFileSync(join(SIM_DIR, f), 'utf8');
      const imports = [...src.matchAll(/from\s+'\.\/([^']+)'/g)].map(m => m[1]);
      for (const imp of imports) {
        if (!ALLOWED[f].includes(imp)) violations.push(`${f} imports './${imp}' (not allowed)`);
      }
    }
    expect(violations).toEqual([]);
  });
});
