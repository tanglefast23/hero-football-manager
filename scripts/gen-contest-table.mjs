// Generates the logistic probability table used by src/sim/contest.ts.
// Math.exp is allowed HERE (build machine, one-off) — never in src/sim at runtime.
import { writeFileSync } from 'node:fs';

const table = [];
for (let d = -99; d <= 99; d++) {
  table.push(Math.round(65536 / (1 + Math.exp(-d / 12))));
}
writeFileSync('src/sim/contest-table.json', JSON.stringify(table));
console.log(`wrote ${table.length} entries`);
