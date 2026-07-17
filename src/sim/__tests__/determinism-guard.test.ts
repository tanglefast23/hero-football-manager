import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const SIM_DIR = join(__dirname, '..');
const BANNED = /\b(?:Math\.(?:exp|hypot|pow|sin|cos|tan|log|random)|Date\.now|new Date)\s*\(/g;

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

describe('determinism guard', () => {
  it('sim sources contain no nondeterministic or engine-varying calls', () => {
    const offenders: string[] = [];
    for (const f of readdirSync(SIM_DIR)) {
      if (!f.endsWith('.ts')) continue;
      const src = stripComments(readFileSync(join(SIM_DIR, f), 'utf8'));
      const hits = src.match(BANNED);
      if (hits) offenders.push(`${f}: ${hits.join(', ')}`);
    }
    expect(offenders).toEqual([]);
  });
});
