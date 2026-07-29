// Generates the fixed-point log tables used by scale-invariant match contests.
// Math.log is allowed HERE (build machine, one-off) — never in src/sim runtime.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const outputDirectory = process.argv[2] ?? 'src/sim';
const K = Number(process.env.LOG_RATIO_K ?? '29');
const D64 = 64;

if (!Number.isSafeInteger(K) || K < 1 || K > 200) {
  throw new Error('LOG_RATIO_K must be an integer from 1 to 200');
}

mkdirSync(outputDirectory, { recursive: true });

const logValues = Array.from(
  { length: 999 },
  (_, index) => Math.round(D64 * K * Math.log(index + 1)),
);
const conditionValues = Array.from(
  { length: 101 },
  (_, condition) => Math.round(D64 * K * Math.log(0.75 + 0.25 * condition / 100)),
);
const resolveValues = Array.from(
  { length: 101 },
  (_, resolve) => Math.round(D64 * K * Math.log(0.9 + 0.1 * resolve / 100)),
);

const writeTable = (name, values) => {
  writeFileSync(join(outputDirectory, name), JSON.stringify({ k: K, values }));
};

writeTable('log-table.json', logValues);
writeTable('clog-table.json', conditionValues);
writeTable('resolve-table.json', resolveValues);
console.log(`wrote ${logValues.length} rating, ${conditionValues.length} condition, and ${resolveValues.length} Resolve entries at K=${K}`);
