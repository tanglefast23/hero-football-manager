// Generates "Match Day Heroes": a seamless heroic-stadium loop for watched
// matches. The arrangement is deliberately busy enough to create momentum but
// leaves frequent rhythmic gaps for whistles, tackles, goals, and power SFX.
//
// Structure (32 bars / ~60s): kickoff intro -> main hook -> answer ->
// stadium-clap break -> full hook return. Everything is synthesized here, so
// the shipped track has no samples or third-party licensing dependencies.
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
  oscSaw,
  noiseWhite,
  vibrato,
  expGlide,
  decayEnv,
  adsr,
  applyEnv,
  lowpass,
  highpass,
  bandpass,
  mix,
  concat,
  resize,
  crossfadeLoop,
  softClip,
  normalize,
  note,
} from './synth.mjs';
import { MUSIC_CATALOG } from './catalog.mjs';
import { generateMenuMusic } from './gen-menu-music.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '../../assets/audio/music');

const BPM = 128;
const BEAT_SEC = 60 / BPM;
const BAR_SEC = BEAT_SEC * 4;
const BAR_N = secondsToSamples(BAR_SEC);
const beatSamples = (beats) => secondsToSamples(beats * BEAT_SEC);

// A minor keeps the track compatible with the existing tonal SFX. The G major
// final bar naturally pulls back to A minor when the file loops.
const CHORDS = {
  A: { bass: 'A2', octave: 'A3', fifth: 'E3', tones: ['A4', 'C5', 'E5'] },
  F: { bass: 'F2', octave: 'F3', fifth: 'C3', tones: ['F4', 'A4', 'C5'] },
  C: { bass: 'C3', octave: 'C4', fifth: 'G3', tones: ['C4', 'E4', 'G4'] },
  G: { bass: 'G2', octave: 'G3', fifth: 'D3', tones: ['G4', 'B4', 'D5'] },
};
const PROGRESSION = ['A', 'F', 'C', 'G'];

// [note name or null for a rest, duration in beats]. Each row is exactly one
// bar. The compact rise-and-fall contour is intended to be recognizable after
// one match without becoming grating over a whole season.
const MAIN_HOOK = [
  [['A5', 0.5], ['C6', 0.5], ['E6', 1], ['D6', 0.5], ['C6', 0.5], ['A5', 1]],
  [['A5', 0.5], ['C6', 0.5], ['F6', 1], ['E6', 0.5], ['C6', 0.5], ['A5', 1]],
  [['G5', 0.5], ['C6', 0.5], ['E6', 0.5], ['G6', 0.5], ['E6', 0.5], ['D6', 0.5], ['C6', 1]],
  [['D6', 0.5], ['B5', 0.5], ['G5', 1], ['A5', 0.5], ['B5', 0.5], ['D6', 1]],
];

const MAIN_HOOK_LIFT = [
  [['A5', 0.5], ['C6', 0.5], ['E6', 0.5], ['G6', 0.5], ['E6', 0.5], ['D6', 0.5], ['C6', 0.5], ['A5', 0.5]],
  [['A5', 0.5], ['C6', 0.5], ['F6', 1], ['A6', 0.5], ['G6', 0.5], ['E6', 1]],
  [['G5', 0.5], ['C6', 0.5], ['E6', 0.5], ['G6', 0.5], ['A6', 0.5], ['G6', 0.5], ['E6', 1]],
  [['D6', 0.5], ['B5', 0.5], ['G5', 1], ['D6', 0.5], ['E6', 0.5], ['G6', 0.5], [null, 0.5]],
];

const ANSWER = [
  [['E6', 1], ['C6', 0.5], ['A5', 0.5], ['C6', 1], ['E6', 1]],
  [['F6', 0.5], ['E6', 0.5], ['C6', 1], ['A5', 1], ['C6', 1]],
  [['E6', 0.5], ['G6', 0.5], ['C7', 1], ['G6', 0.5], ['E6', 0.5], ['D6', 1]],
  [['B5', 0.5], ['D6', 0.5], ['G6', 1], ['E6', 0.5], ['D6', 0.5], ['B5', 1]],
];

const ANSWER_LIFT = [
  [['E6', 0.5], ['A6', 0.5], ['C7', 1], ['B6', 0.5], ['A6', 0.5], ['E6', 1]],
  [['F6', 0.5], ['A6', 0.5], ['C7', 1], ['A6', 0.5], ['G6', 0.5], ['E6', 1]],
  [['E6', 0.5], ['G6', 0.5], ['C7', 0.5], ['E7', 0.5], ['C7', 0.5], ['G6', 0.5], ['E6', 1]],
  [['D6', 0.5], ['G6', 0.5], ['B6', 1], ['A6', 0.5], ['G6', 0.5], ['D6', 0.5], [null, 0.5]],
];

function shiftOctave(name, amount) {
  if (!name) return name;
  return name.replace(/(-?\d+)$/, (_, octave) => String(Number(octave) + amount));
}

function leadTone(name, beats, { octaveShift = 0, softer = false } = {}) {
  const totalN = beatSamples(beats);
  const soundN = Math.max(1, Math.round(totalN * 0.84));
  const freq = note(shiftOctave(name, octaveShift));
  const pitch = vibrato(freq, 5.2, softer ? 5 : 9);
  const raw = mix([
    { buf: oscSquare(soundN, pitch, 0.25), gain: softer ? 0.35 : 0.48 },
    { buf: oscTriangle(soundN, pitch), gain: softer ? 0.65 : 0.52 },
  ]);
  const rounded = lowpass(raw, softer ? 3800 : 5200);
  const env = adsr(soundN, {
    attack: 0.006,
    decay: 0.035,
    sustain: softer ? 0.56 : 0.68,
    release: Math.min(0.06, (soundN / SAMPLE_RATE) * 0.28),
  });
  return resize(applyEnv(rounded, env), totalN);
}

function melodyBar(pattern, options) {
  const parts = pattern.map(([name, beats]) =>
    name ? leadTone(name, beats, options) : new Float32Array(beatSamples(beats)),
  );
  return resize(concat(parts), BAR_N);
}

function padBar(chordName) {
  const chord = CHORDS[chordName];
  const soundN = BAR_N;
  const layers = chord.tones.map((tone, index) => ({
    buf: mix([
      { buf: oscTriangle(soundN, note(tone)), gain: 0.78 },
      { buf: oscSine(soundN, note(tone)), gain: 0.22 },
    ]),
    gain: index === 1 ? 0.9 : 1,
  }));
  const warm = lowpass(mix(layers), 1500);
  return applyEnv(warm, adsr(soundN, { attack: 0.045, decay: 0.08, sustain: 0.55, release: 0.14 }));
}

function arpPluck(name, beats = 0.5) {
  const totalN = beatSamples(beats);
  const soundN = Math.round(totalN * 0.72);
  const freq = note(name);
  const raw = mix([
    { buf: oscTriangle(soundN, freq), gain: 0.72 },
    { buf: oscSquare(soundN, freq, 0.25), gain: 0.28 },
  ]);
  const bright = lowpass(raw, 4200);
  return resize(applyEnv(bright, decayEnv(soundN, { attack: 0.003, decay: 0.18 })), totalN);
}

function arpeggioBar(chordName, reverse = false) {
  const tones = CHORDS[chordName].tones;
  const order = reverse ? [2, 1, 0, 1, 2, 1, 0, 1] : [0, 1, 2, 1, 0, 1, 2, 1];
  return resize(concat(order.map((index) => arpPluck(tones[index]))), BAR_N);
}

function bassNote(name, beats, soundingBeats = beats * 0.72) {
  const totalN = beatSamples(beats);
  const soundN = beatSamples(soundingBeats);
  const freq = note(name);
  const raw = mix([
    { buf: oscTriangle(soundN, freq), gain: 0.82 },
    { buf: lowpass(oscSaw(soundN, freq), 520), gain: 0.18 },
  ]);
  return resize(applyEnv(raw, decayEnv(soundN, { attack: 0.004, decay: 0.28 })), totalN);
}

function bassBar(chordName, busier = false) {
  const { bass, octave, fifth } = CHORDS[chordName];
  const rests = (beats) => new Float32Array(beatSamples(beats));
  const pattern = busier
    ? [
        bassNote(bass, 0.75), rests(0.25), bassNote(octave, 0.5), bassNote(fifth, 0.5),
        bassNote(bass, 0.75), rests(0.25), bassNote(fifth, 0.5), bassNote(octave, 0.5),
      ]
    : [bassNote(bass, 1), bassNote(fifth, 1), bassNote(octave, 1), bassNote(fifth, 1)];
  return resize(concat(pattern), BAR_N);
}

function kick(rng) {
  const n = secondsToSamples(0.13);
  const body = oscSine(n, expGlide(135, 52, 0.11));
  const click = lowpass(noiseWhite(n, rng), 900);
  return applyEnv(mix([{ buf: body, gain: 0.92 }, { buf: click, gain: 0.2 }]), decayEnv(n, { attack: 0.001, decay: 0.1 }));
}

function snare(rng) {
  const n = secondsToSamples(0.12);
  const noise = bandpass(noiseWhite(n, rng), 650, 6200);
  const body = oscTriangle(n, 185);
  return applyEnv(mix([{ buf: noise, gain: 0.8 }, { buf: body, gain: 0.28 }]), decayEnv(n, { attack: 0.001, decay: 0.09 }));
}

function clap(rng) {
  const burstN = secondsToSamples(0.055);
  const layers = [0, 0.018, 0.036].map((seconds, index) => ({
    buf: applyEnv(
      highpass(noiseWhite(burstN, rng), 1300),
      decayEnv(burstN, { attack: 0.0005, decay: 0.035 }),
    ),
    gain: 1 - index * 0.2,
    offset: secondsToSamples(seconds),
  }));
  return mix(layers);
}

function hat(rng, open = false) {
  const n = secondsToSamples(open ? 0.095 : 0.035);
  return applyEnv(
    highpass(noiseWhite(n, rng), 6000),
    decayEnv(n, { attack: 0.0005, decay: open ? 0.07 : 0.022 }),
  );
}

function tom(frequency) {
  const n = secondsToSamples(0.11);
  return applyEnv(oscSine(n, expGlide(frequency * 1.25, frequency, 0.08)), decayEnv(n, { attack: 0.001, decay: 0.085 }));
}

function drumBar(rng, { intensity = 1, stadium = false, fill = false } = {}) {
  const layers = [];
  const place = (buf, beat, gain) => layers.push({ buf, gain, offset: beatSamples(beat) });

  const kickBeats = intensity < 0.7 ? [0, 2] : intensity > 1.1 ? [0, 1.5, 2, 3.5] : [0, 2, 2.75];
  for (const beat of kickBeats) place(kick(rng), beat, 0.72 * intensity);
  for (const beat of [1, 3]) {
    place(snare(rng), beat, 0.48 * intensity);
    if (stadium) place(clap(rng), beat, 0.42 * intensity);
  }
  for (let eighth = 0; eighth < 8; eighth++) {
    place(hat(rng, eighth === 7 && fill), eighth * 0.5, (eighth % 2 === 0 ? 0.16 : 0.23) * intensity);
  }
  if (fill) {
    for (const [beat, frequency] of [[3, 190], [3.25, 165], [3.5, 140], [3.75, 115]]) {
      place(tom(frequency), beat, 0.38 * intensity);
    }
  }
  return resize(mix(layers), BAR_N);
}

function chordStabsBar(chordName) {
  const chord = CHORDS[chordName];
  const hitN = beatSamples(0.42);
  const hit = applyEnv(
    lowpass(
      mix(chord.tones.map((tone) => ({ buf: oscSaw(hitN, note(tone)), gain: 0.34 }))),
      2400,
    ),
    decayEnv(hitN, { attack: 0.006, decay: 0.28 }),
  );
  return resize(mix([
    { buf: hit, offset: beatSamples(0) },
    { buf: hit, gain: 0.8, offset: beatSamples(2) },
  ]), BAR_N);
}

function buildBar(index, rng) {
  const chordName = PROGRESSION[index % PROGRESSION.length];
  const cycle = Math.floor(index / 4);
  const barInCycle = index % 4;
  const layers = [];

  // A warm harmonic floor and an arpeggio link every section together.
  layers.push({ buf: padBar(chordName), gain: cycle === 5 ? 0.12 : 0.2 });
  layers.push({ buf: arpeggioBar(chordName, cycle % 2 === 1), gain: cycle === 5 ? 0.18 : 0.32 });

  if (cycle === 0) {
    // Kickoff: establish the groove before the tune arrives.
    layers.push({ buf: bassBar(chordName), gain: 0.52 });
    layers.push({ buf: drumBar(rng, { intensity: 0.58, fill: index === 3 }), gain: 0.62 });
  } else if (cycle <= 2) {
    // Main hook, then a more animated second phrase.
    const phrase = cycle === 1 ? MAIN_HOOK : MAIN_HOOK_LIFT;
    layers.push({ buf: melodyBar(phrase[barInCycle]), gain: 0.68 });
    layers.push({ buf: bassBar(chordName, cycle === 2), gain: 0.58 });
    layers.push({ buf: drumBar(rng, { intensity: 0.9, stadium: cycle === 2, fill: index === 11 }), gain: 0.65 });
  } else if (cycle <= 4) {
    // Answer section climbs higher without changing key or instrumentation.
    const phrase = cycle === 3 ? ANSWER : ANSWER_LIFT;
    layers.push({ buf: melodyBar(phrase[barInCycle]), gain: 0.64 });
    layers.push({ buf: bassBar(chordName, true), gain: 0.6 });
    layers.push({ buf: drumBar(rng, { intensity: 1, stadium: true, fill: index === 19 }), gain: 0.67 });
  } else if (cycle === 5) {
    // Stadium break: two-beat chord calls and obvious claps create a breath
    // before the finale, while also opening the mix for in-game action cues.
    layers.push({ buf: chordStabsBar(chordName), gain: 0.36 });
    layers.push({ buf: bassBar(chordName), gain: 0.52 });
    layers.push({ buf: drumBar(rng, { intensity: 1.08, stadium: true, fill: index === 23 }), gain: 0.72 });
  } else {
    // Full return: hook plus a quiet octave double, never a dense extra
    // countermelody, so the foreground SFX still own the player's attention.
    const phrase = cycle === 6 ? MAIN_HOOK : MAIN_HOOK_LIFT;
    layers.push({ buf: melodyBar(phrase[barInCycle]), gain: 0.72 });
    layers.push({ buf: melodyBar(phrase[barInCycle], { octaveShift: -1, softer: true }), gain: 0.24 });
    layers.push({ buf: chordStabsBar(chordName), gain: 0.16 });
    layers.push({ buf: bassBar(chordName, true), gain: 0.62 });
    layers.push({ buf: drumBar(rng, { intensity: 1.08, stadium: true, fill: index === 31 }), gain: 0.68 });
  }

  return resize(mix(layers), BAR_N);
}

function buildSong(seed) {
  const rng = mulberry32(seed);
  const bars = Array.from({ length: 32 }, (_, index) => buildBar(index, rng));
  // The 25%-duty pulse voices are intentionally asymmetric. Remove their DC
  // component after the nonlinear glue stage so the file does not waste
  // speaker excursion on inaudible offset.
  return highpass(softClip(concat(bars), 1.06), 28);
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
    // afconvert's accepted AAC data-format string varies across macOS
    // toolchains. Prefer its VBR path when available, then use ffmpeg's native
    // AAC encoder as a deterministic local-development fallback.
    try {
      execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-s', '3', '-q', '127', wavPath, m4aPath], { stdio: 'pipe' });
      console.log(`${entry.name}.m4a  written via afconvert (VBR q127 fallback)`);
    } catch {
      try {
        execFileSync(
          'ffmpeg',
          ['-y', '-v', 'error', '-i', wavPath, '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', m4aPath],
          { stdio: 'pipe' },
        );
        console.log(`${entry.name}.m4a  written via ffmpeg (AAC 96k)`);
      } catch (err3) {
        console.warn(`AAC encoders unavailable or failed, skipping .m4a (${err3.message})`);
      }
    }
  }

  return { wavPath, m4aPath, ms };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  generateMusic();
  generateMenuMusic();
}
