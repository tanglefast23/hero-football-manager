/**
 * Levels every shipped audio asset to one loudness per class, so the mix is
 * set by measurement instead of by whatever each source recording happened to
 * arrive at.
 *
 * Why not peak normalisation (what catalog.mjs's `targetDb` does): peak says
 * nothing about how loud a sound *is*. A 2s fanfare and a 60ms tap both peaked
 * at -1dBFS sounded ~15dB apart, and that spread — not any one bad file — is
 * what made the game's audio feel uneven.
 *
 * Measurement. Long cues use the EBU R128 max-momentary window (400ms), the
 * standard reading for a one-shot. Cues whose audible span is shorter than the
 * window are measured instead as K-weighted loudness over the sound itself,
 * floored at a 100ms integration time: a fixed 400ms window reads a 60ms click
 * ~8dB quieter than it sounds, and normalising to that would demand make-up
 * gain no ceiling can hold. Music uses integrated LUFS, since a bed is judged
 * over its length rather than at its loudest bar.
 *
 * Classes. `music` and `sfx` are the two the mix is built on; `bed` is the
 * handful of SFX that play continuously underneath other cues (see BEDS), and
 * levelling those to one-shot loudness would put a fire crackle on top of the
 * goal it burns under.
 *
 * Usage:
 *   node scripts/audio/normalize-levels.mjs            # measure, report, write
 *   node scripts/audio/normalize-levels.mjs --check    # measure only; exit 1 on drift
 *   node scripts/audio/normalize-levels.mjs --dry-run  # measure + plan, touch nothing
 *
 * Re-run it after `gen-sfx.mjs` / `gen-music.mjs`: those write the synth stage's
 * peak targets straight into assets/, which undoes this pass for the files they
 * own.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');
const MANIFEST = join(__dirname, 'levels.json');

/** Loudness every asset of a class is brought to, in LUFS. */
export const TARGETS = {
  // Integrated. Set to where the beds already sat on average (-20.4 LUFS), so
  // this pass closes their 7.7 LU spread without moving a mix that was tuned by
  // ear. With the render ring's 0.5 on every music player that puts the score
  // ~7 LU under the effects — the usual game relationship, where effects and
  // voice sit above the music rather than fighting it.
  music: -20,
  // Max-momentary. Chosen by sweep: it is the loudest target the whole set
  // reaches with no cue needing more than 6dB of limiting, so nothing gets
  // audibly squashed to hit it.
  sfx: -16,
  // Max-momentary, 4 LU under the one-shots so a continuous bed stays behind
  // whatever plays over it.
  bed: -20,
};

/** True-peak ceiling every output is held under, in dBTP. */
const CEILING = -1.0;
/** Gain smaller than this is inaudible and not worth a re-encode. */
const MIN_GAIN_DB = 0.5;
/**
 * How far a cue may be pushed past the ceiling before the limiter is doing more
 * harm than the levelling is worth. A sparse click peaks ~17dB above its own
 * RMS, so chasing it to a sustained cue's loudness costs 16dB of gain
 * reduction — which is no longer the same sound. Cues that hit this cap stop
 * short of target and say so.
 */
const MAX_LIMITING_DB = 6;
/** `--check` fails when a shipped asset sits further than this from its target. */
const CHECK_TOLERANCE_LU = 1.0;

const MOMENTARY_WINDOW_S = 0.4;
const MIN_INTEGRATION_S = 0.1;

/** SFX that play underneath other cues rather than as one-shots. */
const BEDS = new Set([
  'assets/audio/sfx/flame-loop.m4a',
  'assets/audio/sfx/ledger-spin.wav',
  'assets/audio/sfx/drill-progress.m4a',
]);

/**
 * Kept in the repo as the raw source for a rebuild, never played. Levelling it
 * would defeat the point of holding on to the untouched recording.
 */
const SOURCES_ONLY = new Set(['assets/audio/sfx/dialogue2.m4a']);

// ---------------------------------------------------------------- ffmpeg ----

// ITU-R BS.1770 K-weighting, as the two biquads the spec defines at 48kHz.
const KWEIGHT = [
  'aresample=48000',
  'biquad=b0=1.53512485958697:b1=-2.69169618940638:b2=1.19839281085285'
    + ':a0=1:a1=-1.69065929318241:a2=0.73248077421585',
  'biquad=b0=1.0:b1=-2.0:b2=1.0:a0=1:a1=-1.99004745483398:a2=0.99007225036621',
].join(',');

// Strips leading and trailing silence, so "how long is this sound" is measured
// on the sound and not on the padding around it.
const TRIM = [
  'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0:detection=peak',
  'areverse',
  'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0:detection=peak',
  'areverse',
].join(',');

/** ffmpeg reports every measurement on stderr, so that — not the exit code — is the result. */
function analyse(file, chain) {
  const result = spawnSync('ffmpeg', [
    '-nostdin', '-hide_banner', '-i', file, '-af', chain, '-f', 'null', '-',
  ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return result.stderr ?? '';
}

function probe(file) {
  const raw = execFileSync('ffprobe', [
    '-v', 'error', '-select_streams', 'a:0',
    '-show_entries', 'format=duration:stream=codec_name,channels,sample_rate,bit_rate',
    '-of', 'json', file,
  ], { encoding: 'utf8' });
  const json = JSON.parse(raw);
  const stream = json.streams[0];
  return {
    duration: Number(json.format.duration),
    codec: stream.codec_name,
    channels: Number(stream.channels),
    sampleRate: Number(stream.sample_rate),
    bitRate: Number(stream.bit_rate) || null,
  };
}

function lastMatch(text, pattern) {
  const found = [...text.matchAll(pattern)];
  return found.length ? found[found.length - 1] : null;
}

/** Duration of the output ffmpeg actually produced, from its final progress line. */
function outputSeconds(stderr) {
  const m = lastMatch(stderr, /time=(\d+):(\d+):([\d.]+)/g);
  if (!m) return 0;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

function measure(file) {
  const info = probe(file);

  // Padded so ebur128 always has a full window to report, however short the cue.
  const ebu = analyse(file, 'adelay=600:all=1,apad=pad_dur=1,ebur128=peak=true');
  const momentary = [...ebu.matchAll(/M: *(-?\d+\.\d+)/g)].map((m) => Number(m[1]));
  const maxMomentary = momentary.length ? Math.max(...momentary) : null;
  const peakMatch = lastMatch(ebu, /Peak: *(-?\d+\.\d+)/g);
  const truePeak = peakMatch ? Number(peakMatch[1]) : null;

  const unpadded = analyse(file, 'ebur128=peak=true');
  const integratedMatch = lastMatch(unpadded, /^ +I: *(-?\d+\.\d+) LUFS/gm);
  const integrated = integratedMatch ? Number(integratedMatch[1]) : null;

  const span = outputSeconds(analyse(file, TRIM));
  const stats = analyse(file, `${TRIM},${KWEIGHT},astats=metadata=1:reset=0`);
  const overall = stats.slice(stats.lastIndexOf('Overall'));
  const rmsMatch = /RMS level dB: (-?[\d.]+)/.exec(overall);
  const kRms = rmsMatch ? Number(rmsMatch[1]) : null;

  return { ...info, span, maxMomentary, integrated, truePeak, kRms };
}

/**
 * The one number a file is levelled by. Music is judged over its length;
 * one-shots at their loudest moment, except when the sound is over before a
 * momentary window closes — see the file header.
 */
function perceivedLoudness(measured, cls) {
  if (cls === 'music') return measured.integrated;
  if (measured.span >= MOMENTARY_WINDOW_S || measured.kRms === null) return measured.maxMomentary;
  const integration = Math.max(measured.span, MIN_INTEGRATION_S);
  const shortfall = 10 * Math.log10(measured.span / integration);
  // BS.1770 sums both channels of a stereo pair at unity, which astats' mean
  // across channels does not.
  const stereoSum = measured.channels === 2 ? 3.01 : 0;
  return -0.691 + measured.kRms + shortfall + stereoSum;
}

// ------------------------------------------------------------- inventory ----

function sourceFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** Every asset the app actually loads, so unused files in assets/ are left alone. */
function referencedAssets() {
  const found = new Set();
  for (const file of sourceFiles(join(ROOT, 'src'))) {
    if (file.includes('__tests__')) continue;
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(/assets\/audio\/(?:sfx|music)\/[\w.-]+/g)) found.add(m[0]);
  }
  return [...found]
    .filter((p) => !SOURCES_ONLY.has(p) && existsSync(join(ROOT, p)))
    .sort();
}

function classify(assetPath) {
  if (assetPath.includes('/music/')) return 'music';
  return BEDS.has(assetPath) ? 'bed' : 'sfx';
}

// -------------------------------------------------------------- rendering ---

function encodeArgs(info) {
  if (info.codec === 'aac') {
    // Held at the source bitrate: this is a second generation either way, and
    // at these lengths the added loss is far below the levelling it buys.
    const kbps = Math.max(48, Math.round((info.bitRate ?? 96000) / 1000));
    return ['-c:a', 'aac', '-b:a', `${kbps}k`, '-ar', String(info.sampleRate), '-ac', String(info.channels)];
  }
  return ['-c:a', 'pcm_s16le', '-ar', String(info.sampleRate), '-ac', String(info.channels)];
}

function render(file, out, gainDb, limit, info) {
  const chain = [];
  if (info.codec === 'aac') {
    // AAC decoders expose the complete final 1024-sample packet even when the
    // MP4 track declares a shorter, gapless duration. Without trimming back to
    // that declared duration, every levelling pass bakes the filler into the
    // next encode. That regression added 614 playable samples (27.8ms) to the
    // management loop. Preserve the source's exact sample count before gain.
    chain.push(`atrim=end_sample=${Math.round(info.duration * info.sampleRate)}`);
  }
  chain.push(`volume=${gainDb.toFixed(2)}dB`);
  if (limit) {
    // Held 0.3dB under the ceiling in the sample domain: alimiter is not
    // true-peak aware, and inter-sample peaks land above the samples it sees.
    const linear = 10 ** ((CEILING - 0.3) / 20);
    chain.push(`alimiter=limit=${linear.toFixed(6)}:attack=1:release=30:level=false:latency=true`);
  }
  execFileSync('ffmpeg', [
    '-nostdin', '-hide_banner', '-loglevel', 'error', '-y',
    '-i', file, '-af', chain.join(','), ...encodeArgs(info), out,
  ]);
}

/** Close enough to the target that no listener could pick it out of the set. */
const SOLVE_TOLERANCE_LU = 0.3;
const SOLVE_ATTEMPTS = 5;

/**
 * Finds the gain that actually lands the file on its target, re-rendering from
 * the original every time rather than stacking passes on the previous output.
 *
 * A straight `target - measured` gain only works while the result stays under
 * the ceiling. Past that the limiter takes back part of what the gain added —
 * a transient asked for +16dB comes out 4dB short — so the residual is fed
 * back in and the file re-rendered. A few cues (very short clicks, already
 * peak-normalised at the source) cannot reach the target at any gain: the
 * limiter gives back whatever it is handed. Those stop at their best level and
 * are recorded as unreachable rather than quietly ground into a square wave.
 */
function solve(file, out, row) {
  const maxGain = CEILING + MAX_LIMITING_DB - row.measured.truePeak;
  let gain = Math.min(row.gain, maxGain);
  let limit = row.wouldPeak > CEILING;
  let best = null;

  for (let attempt = 0; attempt < SOLVE_ATTEMPTS; attempt++) {
    render(file, out, gain, limit, row.measured);
    const after = measure(out);
    const loudness = perceivedLoudness(after, row.cls);
    const miss = Math.abs(row.target - loudness);

    if (best === null || miss < best.miss) {
      best = { gain, limit, loudness, truePeak: after.truePeak, miss };
    }
    // alimiter works on samples, not inter-sample peaks, so the true peak can
    // still land over the ceiling; that is always a reason to go round again.
    const overCeiling = after.truePeak > CEILING;
    if (miss <= SOLVE_TOLERANCE_LU && !overCeiling) {
      return {
        gainDb: Number(gain.toFixed(2)),
        limited: limit,
        after: Number(loudness.toFixed(1)),
        afterTruePeak: after.truePeak,
      };
    }
    if (overCeiling) limit = true;
    const next = Math.min(gain + (row.target - loudness), maxGain);
    if (next === gain) break; // pinned at the limiting cap; more gain buys nothing
    if (next > row.gain) limit = true;
    gain = next;
  }

  // Re-render the best attempt, since the loop's last render is not it.
  render(file, out, best.gain, best.limit, row.measured);
  return {
    gainDb: Number(best.gain.toFixed(2)),
    limited: best.limit,
    after: Number(best.loudness.toFixed(1)),
    afterTruePeak: best.truePeak,
    unreachable: best.miss > SOLVE_TOLERANCE_LU,
  };
}

// ------------------------------------------------------------------ main ----

const args = new Set(process.argv.slice(2));
const check = args.has('--check');
const dryRun = args.has('--dry-run');

const assets = referencedAssets();
const rows = [];

console.log(`Measuring ${assets.length} referenced assets...\n`);
for (const assetPath of assets) {
  const file = join(ROOT, assetPath);
  const cls = classify(assetPath);
  const measured = measure(file);
  const loudness = perceivedLoudness(measured, cls);
  if (loudness === null || !Number.isFinite(loudness)) {
    // Silently treating an unreadable file as "already on target" is how a
    // whole class ships unlevelled; a measurement that failed is a bug.
    throw new Error(`${assetPath}: could not measure loudness (class ${cls})`);
  }
  const target = TARGETS[cls];
  const gain = target - loudness;
  const wouldPeak = (measured.truePeak ?? 0) + gain;
  rows.push({ assetPath, cls, measured, loudness, target, gain, wouldPeak });
}

/**
 * The handful of cues the limiter cannot lift to target (see solve()). They are
 * on target as far as the process can take them, so `--check` holds them to the
 * level the last pass recorded instead of to the class target.
 */
const recorded = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')).assets : {};
function offTarget(row) {
  const entry = recorded[row.assetPath];
  if (entry?.unreachable) return Math.abs(entry.after - row.loudness) > CHECK_TOLERANCE_LU;
  return Math.abs(row.gain) > CHECK_TOLERANCE_LU;
}

const width = Math.max(...rows.map((r) => r.assetPath.length));
console.log(`${'ASSET'.padEnd(width)}  CLS    NOW     GAIN    TP     ACTION`);
for (const row of rows) {
  const action = check
    ? (offTarget(row) ? 'OFF TARGET' : recorded[row.assetPath]?.unreachable ? 'ok (capped)' : 'ok')
    : Math.abs(row.gain) < MIN_GAIN_DB ? 'skip (inaudible)'
      : row.wouldPeak > CEILING ? `gain + limit ${(row.wouldPeak - CEILING).toFixed(1)}dB`
        : 'gain';
  console.log(
    `${row.assetPath.padEnd(width)}  ${row.cls.padEnd(5)} `
    + `${(row.loudness ?? NaN).toFixed(1).padStart(6)} `
    + `${(row.gain >= 0 ? '+' : '') + row.gain.toFixed(1).padStart(5)} `
    + `${(row.measured.truePeak ?? NaN).toFixed(1).padStart(5)}   ${action}`,
  );
}

if (check) {
  const off = rows.filter(offTarget);
  console.log(`\n${rows.length - off.length}/${rows.length} assets within ${CHECK_TOLERANCE_LU} LU of target.`);
  if (off.length) {
    console.log(`${off.length} OFF TARGET — run without --check to level them.`);
    process.exit(1);
  }
  process.exit(0);
}

const work = rows.filter((r) => Math.abs(r.gain) >= MIN_GAIN_DB);
console.log(`\n${work.length} of ${rows.length} assets need levelling.`);
if (dryRun) process.exit(0);

const staging = mkdtempSync(join(tmpdir(), 'hfm-audio-levels-'));
const manifest = { target: TARGETS, ceilingDbtp: CEILING, generatedBy: relative(ROOT, fileURLToPath(import.meta.url)), assets: {} };

try {
  for (const row of rows) {
    const file = join(ROOT, row.assetPath);
    const entry = {
      class: row.cls,
      before: Number(row.loudness.toFixed(1)),
      beforeTruePeak: row.measured.truePeak,
      gainDb: 0,
      limited: false,
    };

    if (Math.abs(row.gain) >= MIN_GAIN_DB) {
      const out = join(staging, `out${extname(row.assetPath)}`);
      const solved = solve(file, out, row);
      renameSync(out, file);
      Object.assign(entry, solved, { bytes: statSync(file).size });
      console.log(`  ${row.assetPath}  ${entry.before} -> ${entry.after} LUFS `
        + `(${entry.gainDb >= 0 ? '+' : ''}${entry.gainDb}dB`
        + `${entry.limited ? ', limited' : ''}${entry.unreachable ? ', target unreachable' : ''})`);
    } else {
      entry.after = entry.before;
      entry.afterTruePeak = row.measured.truePeak;
      entry.bytes = statSync(file).size;
    }

    manifest.assets[row.assetPath] = entry;
  }
} finally {
  rmSync(staging, { recursive: true, force: true });
}

writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`\nWrote ${relative(ROOT, MANIFEST)}.`);
