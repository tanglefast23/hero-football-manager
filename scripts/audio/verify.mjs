// Verifies every generated WAV against the catalog's declared bounds:
// format (22050/16-bit/mono), duration, peak level, DC offset, loop-click
// safety, and byte-for-byte regeneration determinism.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SAMPLE_RATE } from './wav.mjs';
import { SFX_CATALOG, MUSIC_CATALOG } from './catalog.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SFX_DIR = join(__dirname, '../../assets/audio/sfx');
const MUSIC_DIR = join(__dirname, '../../assets/audio/music');

const ALL = [...SFX_CATALOG.map((e) => ({ ...e, dir: SFX_DIR })), ...MUSIC_CATALOG.map((e) => ({ ...e, dir: MUSIC_DIR }))];

let failures = 0;
let checks = 0;

function fail(name, msg) {
  failures++;
  console.log(`  FAIL  ${name}: ${msg}`);
}

function ok(name, msg) {
  console.log(`  ok    ${name}: ${msg}`);
}

// ---- WAV parsing (independent of wav.mjs, so this actually checks the file) ----
function parseWav(buf) {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('not a RIFF/WAVE file');
  }
  let offset = 12;
  let fmt = null;
  let data = null;
  while (offset < buf.length - 8) {
    const id = buf.toString('ascii', offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === 'fmt ') fmt = { audioFormat: buf.readUInt16LE(body), channels: buf.readUInt16LE(body + 2), sampleRate: buf.readUInt32LE(body + 4), bitsPerSample: buf.readUInt16LE(body + 14) };
    if (id === 'data') data = { offset: body, size };
    offset = body + size + (size % 2); // chunks are word-aligned
  }
  if (!fmt || !data) throw new Error('missing fmt or data chunk');
  const numSamples = data.size / (fmt.bitsPerSample / 8);
  const samples = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const raw = buf.readInt16LE(data.offset + i * 2);
    samples[i] = raw / (raw < 0 ? 32768 : 32767);
  }
  return { fmt, samples };
}

function peakDb(samples, start = 0, end = samples.length) {
  let peak = 0;
  for (let i = start; i < end; i++) peak = Math.max(peak, Math.abs(samples[i]));
  return peak <= 0 ? -Infinity : 20 * Math.log10(peak);
}

function rmsDb(samples, start, end) {
  let sum = 0;
  for (let i = start; i < end; i++) sum += samples[i] * samples[i];
  const rms = Math.sqrt(sum / (end - start));
  return rms <= 0 ? -Infinity : 20 * Math.log10(rms);
}

function dcOffsetFraction(samples) {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i];
  const mean = sum / samples.length;
  const peak = Math.max(1e-9, peakLinear(samples));
  return Math.abs(mean) / peak;
}

function peakLinear(samples) {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]));
  return peak;
}

console.log('--- format, duration, peak, DC offset, loop-click ---');
for (const entry of ALL) {
  checks++;
  const path = join(entry.dir, `${entry.name}.wav`);
  let buf;
  try {
    buf = readFileSync(path);
  } catch {
    fail(entry.name, `missing file ${path}`);
    continue;
  }
  const { fmt, samples } = parseWav(buf);
  const problems = [];

  if (fmt.sampleRate !== SAMPLE_RATE) problems.push(`sample rate ${fmt.sampleRate} != ${SAMPLE_RATE}`);
  if (fmt.bitsPerSample !== 16) problems.push(`bit depth ${fmt.bitsPerSample} != 16`);
  if (fmt.channels !== 1) problems.push(`channels ${fmt.channels} != 1`);

  const durationMs = (samples.length / fmt.sampleRate) * 1000;
  if (durationMs < entry.minMs || durationMs > entry.maxMs) {
    problems.push(`duration ${durationMs.toFixed(0)}ms outside [${entry.minMs}, ${entry.maxMs}]`);
  }

  // Tolerance accounts for 16-bit quantization: normalize() targets the exact
  // dB in float, but int16 rounding of the peak sample can round UP by a
  // fraction of an LSB (~0.0003dB near -1dBFS) — not audible, not clipping.
  const peak = peakDb(samples);
  if (peak > -1.0 + 0.02) problems.push(`peak ${peak.toFixed(2)}dBFS exceeds -1dBFS ceiling`);

  const dcFrac = dcOffsetFraction(samples);
  if (dcFrac > 0.01) problems.push(`DC offset ${(dcFrac * 100).toFixed(2)}% of peak exceeds 1%`);

  if (entry.loop) {
    const edgeN = Math.round(0.03 * fmt.sampleRate); // 30ms
    const headDb = rmsDb(samples, 0, Math.min(edgeN, samples.length));
    const tailDb = rmsDb(samples, Math.max(0, samples.length - edgeN), samples.length);
    if (Number.isFinite(headDb) && Number.isFinite(tailDb)) {
      const delta = Math.abs(headDb - tailDb);
      if (delta > 3) problems.push(`loop edges differ by ${delta.toFixed(1)}dB (head ${headDb.toFixed(1)}, tail ${tailDb.toFixed(1)}) — click risk`);
    }
    // both near-silent is fine (nothing to click); only flag if not finite AND not both silent
  }

  if (problems.length) {
    fail(entry.name, problems.join('; '));
  } else {
    ok(entry.name, `${durationMs.toFixed(0)}ms, peak ${peak.toFixed(2)}dBFS, DC ${(dcFrac * 100).toFixed(2)}%${entry.loop ? ', loop edges OK' : ''}`);
  }
}

console.log('\n--- regeneration determinism (byte-identical across two runs) ---');
const tmpA = mkdtempSync(join(tmpdir(), 'hfm-audio-verify-a-'));
const tmpB = mkdtempSync(join(tmpdir(), 'hfm-audio-verify-b-'));
try {
  const genSfxPath = join(__dirname, 'gen-sfx.mjs');
  const genMusicPath = join(__dirname, 'gen-music.mjs');
  const genMenuMusicPath = join(__dirname, 'gen-menu-music.mjs');

  for (const [label, tmpDir] of [['A', tmpA], ['B', tmpB]]) {
    execFileSync(process.execPath, ['-e', `import('${pathToFileUrl(genSfxPath)}').then(m => m.generateAllSfx('${tmpDir}'))`], { stdio: 'pipe' });
    execFileSync(process.execPath, ['-e', `import('${pathToFileUrl(genMusicPath)}').then(m => m.generateMusic('${tmpDir}'))`], { stdio: 'pipe' });
    execFileSync(process.execPath, ['-e', `import('${pathToFileUrl(genMenuMusicPath)}').then(m => m.generateMenuMusic('${tmpDir}'))`], { stdio: 'pipe' });
  }

  for (const entry of ALL) {
    checks++;
    const a = readFileSync(join(tmpA, `${entry.name}.wav`));
    const b = readFileSync(join(tmpB, `${entry.name}.wav`));
    if (Buffer.compare(a, b) === 0) {
      ok(entry.name, `deterministic (${a.length} bytes, byte-identical across two runs)`);
    } else {
      fail(entry.name, `regeneration NOT byte-identical (${a.length} vs ${b.length} bytes)`);
    }
  }
} finally {
  rmSync(tmpA, { recursive: true, force: true });
  rmSync(tmpB, { recursive: true, force: true });
}

function pathToFileUrl(p) {
  return `file://${p}`;
}

console.log(`\n${checks - failures}/${checks} checks passed.`);
if (failures > 0) {
  console.log(`${failures} FAILURE(S).`);
  process.exit(1);
} else {
  console.log('All checks passed.');
}
