// Generates the match theme: a seamless-loop chiptune-adjacent track in
// A minor / C major, built from bars (melody + bass + drums) sequenced over
// a 4-chord progression. Also produces the shipped .m4a via macOS afconvert.
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { saveWav, SAMPLE_RATE } from './wav.mjs';
import {
  mulberry32,
  secondsToSamples,
  oscSquare,
  oscTriangle,
  oscSine,
  noiseWhite,
  vibrato,
  decayEnv,
  adsr,
  applyEnv,
  lowpass,
  highpass,
  mix,
  gainBuf,
  concat,
  resize,
  crossfadeLoop,
  softClip,
  normalize,
  note,
} from './synth.mjs';
import { MUSIC_CATALOG } from './catalog.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '../../assets/audio/music');

const BPM = 128; // in the 120-132 brief; 60/128 is a clean fraction, keeps bars sample-exact
const BEAT_SEC = 60 / BPM;
const BAR_SEC = BEAT_SEC * 4;
const BAR_N = secondsToSamples(BAR_SEC);

// ---- key: A minor / C major share the same 7 natural notes ----
const SCALE_LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
function scaleDegreeName(baseOctave, degree) {
  const octaveOffset = Math.floor(degree / 7);
  const idx = ((degree % 7) + 7) % 7;
  return `${SCALE_LETTERS[idx]}${baseOctave + octaveOffset}`;
}
const ROOT_DEGREE = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };

// I-V-vi-IV (C-G-Am-F) for the A section; the same four chords reordered
// (vi-IV-I-V) for the B section, so both sections stay in the shared key
// without introducing new harmony.
const PROGRESSION_A = ['C', 'G', 'A', 'F'];
const PROGRESSION_B = ['A', 'F', 'C', 'G'];

// "Gallop" bounce (long-short-short-long-short-short) reads as energetic
// without being a wall of straight 8ths — cheerful, not frantic.
const RHYTHM_BEATS = [1, 0.5, 0.5, 1, 0.5, 0.5]; // sums to 4 beats
// Melodic cells as scale-degree offsets from the current chord's root.
// Diatonic-only offsets (root/3rd/5th/6th/octave), so every chord's
// triad quality (major/minor) falls out correctly from the scale itself.
const CELL_CALL = [0, 2, 4, 5, 4, 2];
const CELL_RESPONSE = [7, 4, 2, 0, 2, 4];

function melodyBar(chordRoot, cell) {
  const rootDegree = ROOT_DEGREE[chordRoot];
  const parts = [];
  for (let i = 0; i < cell.length; i++) {
    const freq = note(scaleDegreeName(5, rootDegree + cell[i]));
    const beatN = secondsToSamples(RHYTHM_BEATS[i] * BEAT_SEC);
    const soundN = Math.round(beatN * 0.85); // articulation gap before next note
    const vibFreq = vibrato(freq, 5.5, 12);
    // square carries the line; a quiet triangle underneath rounds off the
    // harsh 8-bit edge per the "16-bit-adjacent, warmer" brief
    const tone = mix([
      { buf: oscSquare(soundN, vibFreq, 0.5), gain: 0.7 },
      { buf: oscTriangle(soundN, vibFreq), gain: 0.3 },
    ]);
    const env = adsr(soundN, { attack: 0.005, decay: 0.03, sustain: 0.7, release: Math.min(0.05, (soundN / SAMPLE_RATE) * 0.3) });
    parts.push(resize(applyEnv(tone, env), beatN));
  }
  return resize(concat(parts), BAR_N);
}

function bassBar(chordRoot) {
  const rootFreq = note(`${chordRoot}2`);
  const beatN = secondsToSamples(BEAT_SEC);
  const parts = [];
  for (let i = 0; i < 4; i++) {
    const soundN = Math.round(beatN * 0.55); // punchy pluck, not sustained
    const tone = oscTriangle(soundN, rootFreq);
    parts.push(resize(applyEnv(tone, decayEnv(soundN, { attack: 0.004, decay: 0.16 })), beatN));
  }
  return resize(concat(parts), BAR_N);
}

function drumBar(rng) {
  const beatN = secondsToSamples(BEAT_SEC);
  const layers = [];
  for (const beatIdx of [0, 2]) {
    // kick: low sine thump + lowpassed noise, soft-edged rather than clicky
    const kickN = secondsToSamples(0.09);
    const kick = mix([
      { buf: oscSine(kickN, 90), gain: 0.8 },
      { buf: lowpass(noiseWhite(kickN, rng), 250), gain: 0.5 },
    ]);
    layers.push({ buf: applyEnv(kick, decayEnv(kickN, { attack: 0.001, decay: 0.07 })), gain: 0.9, offset: Math.round(beatIdx * beatN) });
  }
  for (const beatIdx of [0.5, 1.5, 2.5, 3.5]) {
    const hatN = secondsToSamples(0.035);
    const hat = applyEnv(highpass(noiseWhite(hatN, rng), 6000), decayEnv(hatN, { attack: 0.0005, decay: 0.02 }));
    layers.push({ buf: hat, gain: 0.35, offset: Math.round(beatIdx * beatN) });
  }
  return resize(mix(layers), BAR_N);
}

// 4 chords x 2 bars each ("call" then "response" over the same chord) = 8 bars.
function buildSection(progression, rng) {
  const bars = [];
  for (const chordRoot of progression) {
    for (const cell of [CELL_CALL, CELL_RESPONSE]) {
      bars.push(
        resize(
          mix([
            { buf: melodyBar(chordRoot, cell), gain: 1 },
            { buf: bassBar(chordRoot), gain: 0.7 },
            { buf: drumBar(rng), gain: 0.6 },
          ]),
          BAR_N,
        ),
      );
    }
  }
  return concat(bars);
}

// 8-bar A + 8-bar B, played twice (ABAB) to reach the 45-60s brief at this
// tempo — a single AB pass is only ~30s. Second pass reuses the same
// progressions/melody but the rng continues, so drum noise texture varies
// slightly rather than repeating byte-for-byte.
function buildSong(seed) {
  const rng = mulberry32(seed);
  const sections = [
    buildSection(PROGRESSION_A, rng),
    buildSection(PROGRESSION_B, rng),
    buildSection(PROGRESSION_A, rng),
    buildSection(PROGRESSION_B, rng),
  ];
  const raw = concat(sections);
  // gentle master glue — rounds transients without audible distortion
  return softClip(raw, 1.15);
}

export function generateMusic(outDir = OUT_DIR) {
  mkdirSync(outDir, { recursive: true });
  const entry = MUSIC_CATALOG[0];
  const raw = buildSong(2001);
  const fadeN = secondsToSamples(entry.loopFadeMs / 1000);
  const looped = crossfadeLoop(raw, fadeN);
  const finalBuf = normalize(looped, entry.targetDb);

  const wavPath = join(outDir, `${entry.name}.wav`);
  saveWav(wavPath, finalBuf, SAMPLE_RATE);
  const ms = (finalBuf.length / SAMPLE_RATE) * 1000;
  console.log(`${entry.name}.wav  ${ms.toFixed(0)}ms  ${BPM} BPM  peak ${entry.targetDb}dBFS`);

  const m4aPath = join(outDir, `${entry.name}.m4a`);
  try {
    execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '96000', wavPath, m4aPath], { stdio: 'pipe' });
    console.log(`${entry.name}.m4a  written via afconvert (-b 96000)`);
  } catch {
    // Some afconvert builds throw "Couldn't set audio converter property
    // ('!dat')" when an explicit bitrate is requested for a MONO AAC target
    // — reproduces even on afconvert's own self-generated mono WAVs, so it's
    // a toolchain quirk, not our source file. Max-quality VBR sidesteps it
    // while keeping the output mono (stereo-upmixing to satisfy -b would
    // double runtime channel count for no benefit on a mono source).
    try {
      execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-s', '3', '-q', '127', wavPath, m4aPath], { stdio: 'pipe' });
      console.log(`${entry.name}.m4a  written via afconvert (VBR q127 fallback — this afconvert build rejects -b 96000 on mono AAC)`);
    } catch (err2) {
      console.warn(`afconvert unavailable or failed, skipping .m4a (${err2.message})`);
    }
  }

  return { wavPath, m4aPath, ms };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  generateMusic();
}
