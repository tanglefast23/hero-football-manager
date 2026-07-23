import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const SIM_DIR = join(__dirname, '..');

const ALLOWED: Record<string, string[]> = {
  'rng.ts': [],
  'geometry.ts': [],
  'contest.ts': ['rng', 'contest-table.json', 'geometry'],
  'types.ts': ['geometry', 'rng', 'tactics'],
  'tactics.ts': ['geometry'],
  'teams.ts': ['types'],
  'movement-table.ts': ['formation-tables.json', 'geometry'],
  'events.ts': ['types'],
  'entities.ts': ['types'],
  'substitutions.ts': ['events', 'types'],
  'auto-coaching.ts': ['geometry', 'events', 'substitutions', 'tactics', 'types'],
  'powers.ts': ['types', 'geometry', 'events', 'entities'],
  'engine.ts': ['movement-table', 'geometry', 'events', 'types', 'contest', 'powers', 'tactics', 'entities'],
  'match.ts': ['rng', 'geometry', 'events', 'engine', 'types', 'powers', 'auto-coaching', 'substitutions', 'tactics'],
  'runtime-golden.ts': ['match', 'teams'],
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
      // EVERY import specifier (audit R3 + m0.5 review follow-up): from-clauses,
      // side-effect imports, and dynamic import()/require() — a package import
      // (e.g. 'react-native') must fail here in any syntactic form.
      const imports = [
        ...src.matchAll(/from\s+['"]([^'"]+)['"]/g),
        ...src.matchAll(/import\s+['"]([^'"]+)['"]/g),
        ...src.matchAll(/(?:import|require)\s*\(\s*['"]([^'"]+)['"]/g),
      ].map(m => m[1]);
      for (const spec of imports) {
        if (!spec.startsWith('./')) {
          violations.push(`${f} imports '${spec}' (non-relative — sim modules may only import sim modules)`);
          continue;
        }
        if (!ALLOWED[f].includes(spec.slice(2))) violations.push(`${f} imports '${spec}' (not allowed)`);
      }
    }
    expect(violations).toEqual([]);
  });
});
