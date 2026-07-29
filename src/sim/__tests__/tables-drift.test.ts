import { execSync } from 'child_process';
import { readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Drift guard (m0.5 quality review): the committed tables must be exactly what
// the committed generator emits. Without this, a tuner who edits generator
// params but forgets to regenerate iterates against stale tables (the change
// silently no-ops), and the "generated content is never hand-edited" rule has
// no enforcement. Emission is deterministic, so a byte-compare is safe.
describe('formation tables drift guard', () => {
  it('committed formation-tables.json is byte-identical to fresh generator output', () => {
    const root = join(__dirname, '..', '..', '..');
    const scratch = join(tmpdir(), `formation-tables-drift-${process.pid}.json`);
    try {
      execSync(`node scripts/gen-formation-tables.mjs "${scratch}"`, { cwd: root });
      const fresh = readFileSync(scratch, 'utf8');
      const committed = readFileSync(join(root, 'src', 'sim', 'formation-tables.json'), 'utf8');
      expect(fresh).toBe(committed);
    } finally {
      rmSync(scratch, { force: true });
    }
  });

  it('committed log-ratio tables are byte-identical to fresh generator output', () => {
    const root = join(__dirname, '..', '..', '..');
    const scratch = join(tmpdir(), `attribute-tables-drift-${process.pid}`);
    const names = ['log-table.json', 'clog-table.json', 'resolve-table.json'] as const;
    try {
      execSync(`node scripts/gen-log-table.mjs "${scratch}"`, { cwd: root });
      for (const name of names) {
        const fresh = readFileSync(join(scratch, name), 'utf8');
        const committed = readFileSync(join(root, 'src', 'sim', name), 'utf8');
        expect(fresh).toBe(committed);
      }
    } finally {
      rmSync(scratch, { force: true, recursive: true });
    }
  });

  it('committed movement tables are byte-identical to fresh generator output', () => {
    const root = join(__dirname, '..', '..', '..');
    const scratch = join(tmpdir(), `movement-tables-drift-${process.pid}`);
    const names = ['pace-table.json', 'stamina-tables.json'] as const;
    try {
      execSync(`node scripts/gen-movement-tables.mjs "${scratch}"`, { cwd: root });
      for (const name of names) {
        const fresh = readFileSync(join(scratch, name), 'utf8');
        const committed = readFileSync(join(root, 'src', 'sim', name), 'utf8');
        expect(fresh).toBe(committed);
      }
    } finally {
      rmSync(scratch, { force: true, recursive: true });
    }
  });
});
