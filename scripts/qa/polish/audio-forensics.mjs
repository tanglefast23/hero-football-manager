/**
 * Polish-audit audio asset forensics.
 *
 * File-level audio truth: peak/RMS headroom and duration for every shipped cue. No loopback
 * device exists on this Mac, so file-level analysis is the authoritative audio-level surface
 * (spec §3.1-F); mix-under-load stays code-read territory.
 *
 *   node scripts/qa/polish/audio-forensics.mjs [--dir assets/audio] [--out artifacts/polish-audit-2026-08-06/audio-forensics.md]
 *
 * Requires ffmpeg + ffprobe on PATH. Exits 1 if any file peaks above -0.1 dBFS
 * (clipping-adjacent), so a retest can gate on it. Sanity check: stat-step-tap*.m4a are
 * documented peak-maxed and MUST appear near the top of the peak table — if they don't,
 * distrust the parse, not the docs.
 * Spec: docs/superpowers/plans/2026-08-06-polish-audit-spec.md §7.5
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1];
};
const dir = path.resolve(flag('--dir', 'assets/audio'));
const out = path.resolve(flag('--out', 'artifacts/polish-audit-2026-08-06/audio-forensics.md'));
const PEAK_LIMIT_DB = -0.1;

function* walk(root) {
  for (const name of readdirSync(root)) {
    const p = path.join(root, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(m4a|wav|mp3)$/i.test(name)) yield p;
  }
}

function probeSeconds(file) {
  const res = spawnSync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file,
  ], { encoding: 'utf8' });
  const value = parseFloat((res.stdout || '').trim());
  return Number.isFinite(value) ? value : null;
}

function astats(file) {
  const res = spawnSync('ffmpeg', [
    '-hide_banner', '-i', file,
    '-af', 'astats=measure_overall=Peak_level+RMS_level:measure_perchannel=none:metadata=1',
    '-f', 'null', '-',
  ], { encoding: 'utf8' });
  const text = res.stderr || '';
  const last = (re) => {
    let match; let found = null;
    const global = new RegExp(re.source, 'g');
    while ((match = global.exec(text)) !== null) found = match[1];
    return found === null ? null : parseFloat(found);
  };
  return {
    peakDb: last(/Peak level dB:\s*(-?[\d.]+|-?inf)/),
    rmsDb: last(/RMS level dB:\s*(-?[\d.]+|-?inf)/),
  };
}

const rows = [];
for (const file of walk(dir)) {
  const rel = path.relative(process.cwd(), file);
  const { peakDb, rmsDb } = astats(file);
  rows.push({ rel, seconds: probeSeconds(file), peakDb, rmsDb });
}
rows.sort((a, b) => (b.peakDb ?? -999) - (a.peakDb ?? -999));

const hot = rows.filter((r) => r.peakDb !== null && r.peakDb > PEAK_LIMIT_DB);
const fmt = (v, digits = 1) => (v === null || !Number.isFinite(v) ? 'n/a' : v.toFixed(digits));
const lines = [
  `# Audio forensics — ${new Date().toISOString().slice(0, 10)}`,
  '',
  `${rows.length} files under \`${path.relative(process.cwd(), dir)}\`; sorted by peak. `
    + `Flag threshold: peak > ${PEAK_LIMIT_DB} dBFS. Flagged: ${hot.length}.`,
  '',
  '| file | peak dBFS | RMS dBFS | seconds |',
  '|---|---:|---:|---:|',
  ...rows.map((r) => `| ${r.rel} | ${fmt(r.peakDb)} | ${fmt(r.rmsDb)} | ${fmt(r.seconds, 2)} |`),
];
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, `${lines.join('\n')}\n`);

console.log(`wrote ${path.relative(process.cwd(), out)} (${rows.length} files)`);
console.log('hottest 10:');
for (const r of rows.slice(0, 10)) console.log(`  ${fmt(r.peakDb)} dBFS  ${r.rel}`);
if (hot.length > 0) {
  console.error(`FAIL: ${hot.length} file(s) peak above ${PEAK_LIMIT_DB} dBFS`);
  process.exit(1);
}
