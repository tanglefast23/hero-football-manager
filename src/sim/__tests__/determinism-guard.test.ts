import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const SIM_DIR = join(__dirname, '..');
// Transcendental / engine-varying Math (audit R2 extended the list), wall
// clocks, and high-res timers. Only add/multiply/divide/compare plus
// round/min/max/abs/trunc/floor/sqrt-of-integers keep replays portable.
const BANNED = /\b(?:Math\.(?:exp|hypot|pow|sin|cos|tan|log|random|atan2|atan|asin|acos|cbrt|log2|log10|log1p|expm1|sinh|cosh|tanh|fround)|Date\.now|new Date|performance\.now)\s*\(/g;

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
      // Exponentiation operator (audit R2): x ** y compiles to Math.pow — same
      // transcendental-drift risk in disguise. Comments already stripped above.
      if (src.includes('**')) offenders.push(`${f}: exponentiation operator ** (use multiplication)`);
    }
    expect(offenders).toEqual([]);
  });
});
