// Generates the title, management, and event themes. They share Match Day
// Heroes' A-minor/C-major harmony and chiptune-adjacent sound palette, but each
// has a different job:
//
// - Heroes Start Here: a compact, immediately memorable title-screen fanfare.
// - Clubhouse Dreams: a warm two-minute loop for the game's primary management
//   screens, with enough space and sectional change to survive long sessions.
// - The Big Call: an urgent loop for story interruptions where the player has
//   to weigh a risky choice, with dramatic momentum but space to read.
//
// Everything is synthesized here. No samples or third-party music are used.
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

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '../../assets/audio/music');

const CHORDS = {
  A: { bass: 'A2', fifth: 'E3', octave: 'A3', tones: ['A4', 'C5', 'E5'] },
  F: { bass: 'F2', fifth: 'C3', octave: 'F3', tones: ['F4', 'A4', 'C5'] },
  C: { bass: 'C3', fifth: 'G3', octave: 'C4', tones: ['C4', 'E4', 'G4'] },
  G: { bass: 'G2', fifth: 'D3', octave: 'G3', tones: ['G4', 'B4', 'D5'] },
  D: { bass: 'D2', fifth: 'A2', octave: 'D3', tones: ['D4', 'F4', 'A4'] },
  E: { bass: 'E2', fifth: 'B2', octave: 'E3', tones: ['E4', 'G#4', 'B4'] },
};

function makeClock(bpm) {
  const beatSec = 60 / bpm;
  return {
    bpm,
    beatSec,
    barN: secondsToSamples(beatSec * 4),
    beats: (count) => secondsToSamples(count * beatSec),
  };
}

function shiftOctave(name, amount) {
  if (!name) return name;
  return name.replace(/(-?\d+)$/, (_, octave) => String(Number(octave) + amount));
}

function sequenceBar(pattern, clock, voice, options = {}) {
  const parts = pattern.map(([name, beats]) => (
    name ? voice(name, beats, clock, options) : new Float32Array(clock.beats(beats))
  ));
  return resize(concat(parts), clock.barN);
}

function titleLead(name, beats, clock, { octaveShift = 0, softer = false } = {}) {
  const totalN = clock.beats(beats);
  const soundN = Math.max(1, Math.round(totalN * 0.86));
  const pitch = vibrato(note(shiftOctave(name, octaveShift)), 5.4, softer ? 4 : 8);
  const raw = mix([
    { buf: oscSquare(soundN, pitch, 0.25), gain: softer ? 0.3 : 0.46 },
    { buf: oscTriangle(soundN, pitch), gain: softer ? 0.62 : 0.47 },
    { buf: oscSine(soundN, pitch), gain: 0.14 },
  ]);
  const rounded = lowpass(raw, softer ? 3600 : 5200);
  const shaped = applyEnv(rounded, adsr(soundN, {
    attack: 0.006,
    decay: 0.04,
    sustain: softer ? 0.5 : 0.66,
    release: Math.min(0.07, (soundN / SAMPLE_RATE) * 0.3),
  }));
  return resize(shaped, totalN);
}

function warmPluck(name, beats, clock, { bell = false, softer = false } = {}) {
  const totalN = clock.beats(beats);
  const soundN = Math.max(1, Math.round(totalN * 0.82));
  const frequency = note(name);
  const raw = mix([
    { buf: oscTriangle(soundN, frequency), gain: 0.72 },
    { buf: oscSine(soundN, frequency * 2), gain: bell ? 0.22 : 0.1 },
    { buf: oscSquare(soundN, frequency, 0.5), gain: softer ? 0.05 : 0.09 },
  ]);
  const rounded = lowpass(raw, bell ? 3900 : 2600);
  const shaped = applyEnv(rounded, decayEnv(soundN, {
    attack: bell ? 0.002 : 0.006,
    decay: bell ? 0.42 : 0.3,
  }));
  return resize(shaped, totalN);
}

function padBar(chordName, clock, { brightness = 1500, pulse = false } = {}) {
  const chord = CHORDS[chordName];
  const layers = chord.tones.map((tone, index) => ({
    buf: mix([
      { buf: oscTriangle(clock.barN, note(tone)), gain: 0.74 },
      { buf: oscSine(clock.barN, note(tone)), gain: 0.26 },
    ]),
    gain: index === 1 ? 0.92 : 1,
  }));
  const warm = lowpass(mix(layers), brightness);
  const env = adsr(clock.barN, { attack: 0.06, decay: 0.1, sustain: pulse ? 0.42 : 0.56, release: 0.16 });
  return applyEnv(warm, env);
}

function arpNote(name, clock, { soft = false } = {}) {
  const totalN = clock.beats(0.5);
  const soundN = Math.round(totalN * 0.72);
  const raw = mix([
    { buf: oscTriangle(soundN, note(name)), gain: 0.78 },
    { buf: oscSquare(soundN, note(name), 0.25), gain: soft ? 0.08 : 0.18 },
  ]);
  const shaped = applyEnv(lowpass(raw, soft ? 2500 : 4100), decayEnv(soundN, {
    attack: 0.003,
    decay: soft ? 0.24 : 0.18,
  }));
  return resize(shaped, totalN);
}

function arpeggioBar(chordName, clock, { reverse = false, soft = false } = {}) {
  const tones = CHORDS[chordName].tones;
  const order = reverse ? [2, 1, 0, 1, 2, 1, 0, 1] : [0, 1, 2, 1, 0, 1, 2, 1];
  return resize(concat(order.map((index) => arpNote(tones[index], clock, { soft }))), clock.barN);
}

function bassNote(name, beats, clock, { soft = false } = {}) {
  const totalN = clock.beats(beats);
  const soundN = Math.max(1, Math.round(totalN * (soft ? 0.7 : 0.76)));
  const frequency = note(name);
  const raw = mix([
    { buf: oscTriangle(soundN, frequency), gain: soft ? 0.9 : 0.78 },
    { buf: lowpass(oscSaw(soundN, frequency), soft ? 380 : 540), gain: soft ? 0.1 : 0.22 },
  ]);
  const shaped = applyEnv(raw, decayEnv(soundN, { attack: 0.004, decay: soft ? 0.38 : 0.3 }));
  return resize(shaped, totalN);
}

function bassBar(chordName, clock, { walking = false, soft = false } = {}) {
  const { bass, fifth, octave } = CHORDS[chordName];
  const rest = (beats) => new Float32Array(clock.beats(beats));
  const voice = (name, beats) => bassNote(name, beats, clock, { soft });
  const pattern = walking
    ? [voice(bass, 0.75), rest(0.25), voice(fifth, 0.5), voice(octave, 0.5), voice(bass, 1), voice(fifth, 1)]
    : [voice(bass, 1), rest(0.5), voice(fifth, 0.5), voice(octave, 1), voice(fifth, 1)];
  return resize(concat(pattern), clock.barN);
}

function kick(rng, soft = false) {
  const n = secondsToSamples(soft ? 0.12 : 0.14);
  const body = oscSine(n, expGlide(soft ? 110 : 140, soft ? 50 : 54, 0.11));
  const click = lowpass(noiseWhite(n, rng), soft ? 650 : 950);
  return applyEnv(
    mix([{ buf: body, gain: 0.94 }, { buf: click, gain: soft ? 0.08 : 0.19 }]),
    decayEnv(n, { attack: 0.001, decay: soft ? 0.1 : 0.11 }),
  );
}

function snare(rng, soft = false) {
  const n = secondsToSamples(soft ? 0.1 : 0.13);
  const noise = bandpass(noiseWhite(n, rng), soft ? 900 : 650, soft ? 4300 : 6200);
  const body = oscTriangle(n, soft ? 205 : 180);
  return applyEnv(
    mix([{ buf: noise, gain: soft ? 0.62 : 0.82 }, { buf: body, gain: soft ? 0.16 : 0.28 }]),
    decayEnv(n, { attack: 0.001, decay: soft ? 0.065 : 0.095 }),
  );
}

function clap(rng, soft = false) {
  const burstN = secondsToSamples(soft ? 0.045 : 0.058);
  return mix([0, 0.018, 0.036].map((seconds, index) => ({
    buf: applyEnv(
      highpass(noiseWhite(burstN, rng), soft ? 1800 : 1300),
      decayEnv(burstN, { attack: 0.0005, decay: soft ? 0.028 : 0.038 }),
    ),
    gain: (1 - index * 0.2) * (soft ? 0.72 : 1),
    offset: secondsToSamples(seconds),
  })));
}

function hat(rng, open = false, soft = false) {
  const n = secondsToSamples(open ? 0.09 : 0.035);
  return applyEnv(
    highpass(noiseWhite(n, rng), soft ? 6800 : 6000),
    decayEnv(n, { attack: 0.0005, decay: open ? 0.065 : 0.022 }),
  );
}

function tom(frequency) {
  const n = secondsToSamples(0.11);
  return applyEnv(
    oscSine(n, expGlide(frequency * 1.25, frequency, 0.08)),
    decayEnv(n, { attack: 0.001, decay: 0.085 }),
  );
}

function titleDrums(rng, clock, { intensity = 1, stadium = false, fill = false } = {}) {
  const layers = [];
  const place = (buf, beat, gain) => layers.push({ buf, gain, offset: clock.beats(beat) });
  const kickBeats = intensity < 0.7 ? [0, 2] : intensity > 1.05 ? [0, 1.5, 2, 3.5] : [0, 2, 2.75];
  for (const beat of kickBeats) place(kick(rng), beat, 0.7 * intensity);
  for (const beat of [1, 3]) {
    place(snare(rng), beat, 0.48 * intensity);
    if (stadium) place(clap(rng), beat, 0.38 * intensity);
  }
  for (let eighth = 0; eighth < 8; eighth++) {
    place(hat(rng, fill && eighth === 7), eighth * 0.5, (eighth % 2 ? 0.21 : 0.14) * intensity);
  }
  if (fill) {
    for (const [beat, frequency] of [[3, 205], [3.25, 175], [3.5, 145], [3.75, 118]]) {
      place(tom(frequency), beat, 0.38 * intensity);
    }
  }
  return resize(mix(layers), clock.barN);
}

function managementDrums(rng, clock, { intensity = 1, shaker = true, fill = false } = {}) {
  const layers = [];
  const place = (buf, beat, gain) => layers.push({ buf, gain, offset: clock.beats(beat) });
  for (const beat of intensity < 0.7 ? [0, 2] : [0, 2, 3.25]) {
    place(kick(rng, true), beat, 0.48 * intensity);
  }
  for (const beat of [1, 3]) {
    place(snare(rng, true), beat, 0.3 * intensity);
    place(clap(rng, true), beat, 0.14 * intensity);
  }
  if (shaker) {
    for (let eighth = 0; eighth < 8; eighth++) {
      place(hat(rng, false, true), eighth * 0.5, (eighth % 2 ? 0.11 : 0.07) * intensity);
    }
  }
  if (fill) {
    for (const [beat, frequency] of [[3.25, 155], [3.5, 135], [3.75, 115]]) {
      place(tom(frequency), beat, 0.19 * intensity);
    }
  }
  return resize(mix(layers), clock.barN);
}

function fanfareStabs(chordName, clock, { quiet = false } = {}) {
  const chord = CHORDS[chordName];
  const hitN = clock.beats(0.42);
  const hit = applyEnv(
    lowpass(mix(chord.tones.map((tone) => ({
      buf: mix([
        { buf: oscSaw(hitN, note(tone)), gain: 0.28 },
        { buf: oscSquare(hitN, note(tone), 0.5), gain: 0.12 },
      ]),
    }))), quiet ? 2000 : 3100),
    decayEnv(hitN, { attack: 0.008, decay: quiet ? 0.26 : 0.32 }),
  );
  return resize(mix([
    { buf: hit, offset: clock.beats(0) },
    { buf: hit, gain: 0.78, offset: clock.beats(1.5) },
    { buf: hit, gain: 0.9, offset: clock.beats(3) },
  ]), clock.barN);
}

const TITLE_HOOK = [
  [['E5', 0.5], ['G5', 0.5], ['C6', 1], ['G5', 0.5], ['A5', 0.5], ['G5', 1]],
  [['D5', 0.5], ['G5', 0.5], ['B5', 1], ['D6', 0.5], ['B5', 0.5], ['G5', 1]],
  [['E5', 0.5], ['A5', 0.5], ['C6', 0.5], ['E6', 0.5], ['D6', 0.5], ['C6', 0.5], ['A5', 1]],
  [['A5', 0.5], ['C6', 0.5], ['F6', 1], ['E6', 0.5], ['C6', 0.5], ['G5', 1]],
];

const TITLE_ANSWER = [
  [['G5', 0.5], ['C6', 0.5], ['E6', 1], ['D6', 0.5], ['C6', 0.5], ['G5', 1]],
  [['B5', 0.5], ['D6', 0.5], ['G6', 1], ['F6', 0.5], ['D6', 0.5], ['B5', 1]],
  [['C6', 0.5], ['E6', 0.5], ['A6', 1], ['G6', 0.5], ['E6', 0.5], ['C6', 1]],
  [['C6', 0.5], ['A5', 0.5], ['F5', 1], ['A5', 0.5], ['C6', 0.5], ['E6', 1]],
];

const TITLE_LIFT = [
  [['G5', 0.5], ['C6', 0.5], ['E6', 0.5], ['G6', 0.5], ['A6', 0.5], ['G6', 0.5], ['E6', 1]],
  [['D6', 0.5], ['G6', 0.5], ['B6', 1], ['A6', 0.5], ['G6', 0.5], ['D6', 1]],
  [['E6', 0.5], ['A6', 0.5], ['C7', 1], ['B6', 0.5], ['A6', 0.5], ['E6', 1]],
  [['C6', 0.5], ['F6', 0.5], ['A6', 0.5], ['G6', 0.5], ['E6', 0.5], ['C6', 0.5], ['G5', 0.5], [null, 0.5]],
];

function titleBar(index, rng, clock) {
  const progression = ['C', 'G', 'A', 'F'];
  const chordName = progression[index % progression.length];
  const cycle = Math.floor(index / 4);
  const barInCycle = index % 4;
  const layers = [
    { buf: padBar(chordName, clock, { brightness: cycle === 3 ? 1300 : 1700 }), gain: index === 23 ? 0.15 : cycle === 3 ? 0.14 : 0.2 },
    { buf: arpeggioBar(chordName, clock, { reverse: cycle % 2 === 1, soft: cycle === 3 }), gain: cycle === 3 ? 0.18 : 0.3 },
  ];

  if (cycle === 0) {
    layers.push({ buf: fanfareStabs(chordName, clock), gain: 0.36 });
    layers.push({ buf: bassBar(chordName, clock), gain: 0.48 });
    layers.push({ buf: titleDrums(rng, clock, { intensity: 0.62, fill: index === 3 }), gain: 0.58 });
    if (barInCycle >= 2) layers.push({ buf: sequenceBar(TITLE_HOOK[barInCycle], clock, titleLead, { softer: true }), gain: 0.48 });
  } else if (cycle === 1) {
    layers.push({ buf: sequenceBar(TITLE_HOOK[barInCycle], clock, titleLead), gain: 0.68 });
    layers.push({ buf: bassBar(chordName, clock), gain: 0.56 });
    layers.push({ buf: titleDrums(rng, clock, { intensity: 0.9, stadium: true, fill: index === 7 }), gain: 0.64 });
  } else if (cycle === 2) {
    layers.push({ buf: sequenceBar(TITLE_ANSWER[barInCycle], clock, titleLead), gain: 0.64 });
    layers.push({ buf: bassBar(chordName, clock, { walking: true }), gain: 0.58 });
    layers.push({ buf: titleDrums(rng, clock, { intensity: 1, stadium: true, fill: index === 11 }), gain: 0.66 });
  } else if (cycle === 3) {
    layers.push({ buf: fanfareStabs(chordName, clock, { quiet: true }), gain: 0.28 });
    layers.push({ buf: bassBar(chordName, clock, { soft: true }), gain: 0.46 });
    layers.push({ buf: titleDrums(rng, clock, { intensity: 0.7, stadium: true, fill: index === 15 }), gain: 0.56 });
  } else if (cycle === 4) {
    layers.push({ buf: sequenceBar(TITLE_LIFT[barInCycle], clock, titleLead), gain: 0.7 });
    layers.push({ buf: sequenceBar(TITLE_HOOK[barInCycle], clock, titleLead, { octaveShift: -1, softer: true }), gain: 0.2 });
    layers.push({ buf: bassBar(chordName, clock, { walking: true }), gain: 0.6 });
    layers.push({ buf: titleDrums(rng, clock, { intensity: 1.06, stadium: true, fill: index === 19 }), gain: 0.68 });
  } else {
    layers.push({ buf: sequenceBar(TITLE_HOOK[barInCycle], clock, titleLead), gain: 0.72 });
    layers.push({ buf: sequenceBar(TITLE_HOOK[barInCycle], clock, titleLead, { octaveShift: -1, softer: true }), gain: 0.22 });
    layers.push({ buf: fanfareStabs(chordName, clock), gain: 0.2 });
    layers.push({ buf: bassBar(chordName, clock, { walking: true }), gain: 0.62 });
    // Put the final fill one bar before the boundary so its last tom does not
    // hang across the loop seam.
    layers.push({ buf: titleDrums(rng, clock, { intensity: 1.1, stadium: true, fill: index === 22 }), gain: 0.7 });
  }

  return resize(mix(layers), clock.barN);
}

const MANAGEMENT_HOOK = [
  [['C5', 1], ['E5', 0.5], ['G5', 0.5], ['E5', 1], ['D5', 1]],
  [['B4', 0.5], ['D5', 0.5], ['G5', 1], ['D5', 1], ['B4', 1]],
  [['A4', 1], ['C5', 0.5], ['E5', 0.5], ['G5', 1], ['E5', 1]],
  [['A4', 0.5], ['C5', 0.5], ['F5', 1], ['E5', 0.5], ['D5', 0.5], ['C5', 1]],
];

const MANAGEMENT_ANSWER = [
  [['E5', 0.5], ['G5', 0.5], ['C6', 1], ['G5', 1], ['E5', 1]],
  [['D5', 1], ['G5', 0.5], ['B5', 0.5], ['A5', 1], ['G5', 1]],
  [['C5', 0.5], ['E5', 0.5], ['A5', 1], ['G5', 0.5], ['E5', 0.5], ['C5', 1]],
  [['A4', 0.5], ['C5', 0.5], ['F5', 0.5], ['A5', 0.5], ['G5', 1], ['E5', 1]],
];

function managementBar(index, rng, clock) {
  const progression = ['F', 'C', 'G', 'A'];
  const chordName = progression[index % progression.length];
  const cycle = Math.floor(index / 4);
  const barInCycle = index % 4;
  const section = Math.floor(cycle / 2);
  const layers = [
    { buf: padBar(chordName, clock, { brightness: section === 3 ? 1050 : 1350 }), gain: section === 3 ? 0.22 : 0.27 },
    { buf: arpeggioBar(chordName, clock, { reverse: cycle % 2 === 1, soft: true }), gain: section === 3 ? 0.22 : 0.3 },
    { buf: bassBar(chordName, clock, { walking: section === 2 || section === 5, soft: true }), gain: section === 3 ? 0.4 : 0.48 },
  ];

  if (section === 0) {
    // Open the club in the morning: just enough rhythm to imply forward motion.
    layers.push({ buf: managementDrums(rng, clock, { intensity: 0.52, shaker: cycle === 1, fill: index === 7 }), gain: 0.45 });
    if (cycle === 1) layers.push({ buf: sequenceBar(MANAGEMENT_HOOK[barInCycle], clock, warmPluck, { softer: true }), gain: 0.38 });
  } else if (section === 1) {
    // The main management melody: calm, positive, and deliberately sparse.
    const phrase = cycle % 2 === 0 ? MANAGEMENT_HOOK : MANAGEMENT_ANSWER;
    layers.push({ buf: sequenceBar(phrase[barInCycle], clock, warmPluck), gain: 0.54 });
    layers.push({ buf: managementDrums(rng, clock, { intensity: 0.74, fill: index === 15 }), gain: 0.5 });
  } else if (section === 2) {
    // Training-day lift: a busier bass and bell color without match-day urgency.
    const phrase = cycle % 2 === 0 ? MANAGEMENT_ANSWER : MANAGEMENT_HOOK;
    layers.push({ buf: sequenceBar(phrase[barInCycle], clock, warmPluck, { bell: true }), gain: 0.5 });
    layers.push({ buf: managementDrums(rng, clock, { intensity: 0.88, fill: index === 23 }), gain: 0.52 });
  } else if (section === 3) {
    // Ledger/contract breather: lower density gives menu SFX and reading space.
    layers.push({ buf: fanfareStabs(chordName, clock, { quiet: true }), gain: 0.12 });
    layers.push({ buf: managementDrums(rng, clock, { intensity: 0.46, shaker: false, fill: index === 31 }), gain: 0.4 });
  } else if (section === 4) {
    // Optimistic mid-loop return, one octave sparkle above the core hook.
    const phrase = cycle % 2 === 0 ? MANAGEMENT_HOOK : MANAGEMENT_ANSWER;
    layers.push({ buf: sequenceBar(phrase[barInCycle], clock, warmPluck, { bell: true }), gain: 0.56 });
    layers.push({ buf: sequenceBar(phrase[barInCycle], clock, warmPluck, { softer: true }), gain: 0.12 });
    layers.push({ buf: managementDrums(rng, clock, { intensity: 0.78, fill: index === 39 }), gain: 0.5 });
  } else if (section === 5) {
    // Full clubhouse groove, still gentler and less crowded than a match.
    const phrase = cycle % 2 === 0 ? MANAGEMENT_ANSWER : MANAGEMENT_HOOK;
    layers.push({ buf: sequenceBar(phrase[barInCycle], clock, warmPluck), gain: 0.56 });
    layers.push({ buf: managementDrums(rng, clock, { intensity: 0.9, fill: index === 47 }), gain: 0.54 });
  } else {
    // Wind down naturally into the opening F chord when the file loops.
    if (cycle === 12) layers.push({ buf: sequenceBar(MANAGEMENT_HOOK[barInCycle], clock, warmPluck, { softer: true }), gain: 0.42 });
    layers.push({ buf: managementDrums(rng, clock, { intensity: cycle === 12 ? 0.66 : 0.48, shaker: cycle === 12, fill: index === 55 }), gain: 0.44 });
  }

  return resize(mix(layers), clock.barN);
}

// The event tune leans into A harmonic minor (the E-major turnaround supplies
// G-sharp) for more danger than the other themes without leaving their shared
// key or synth palette. Each phrase is still four bars, so it feels deliberate
// rather than frantic while the player reads the choice text.
const EVENT_HOOK = [
  [['A5', 0.5], ['C6', 0.5], ['E6', 0.5], ['A6', 0.5], ['G6', 0.5], ['E6', 0.5], ['C6', 0.5], ['A5', 0.5]],
  [['A5', 0.5], ['C6', 0.5], ['F6', 1], ['E6', 0.5], ['C6', 0.5], ['A5', 1]],
  [['A5', 0.5], ['D6', 0.5], ['F6', 0.5], ['A6', 0.5], ['F6', 0.5], ['E6', 0.5], ['D6', 1]],
  [['B5', 0.5], ['E6', 0.5], ['G#6', 1], ['B6', 0.5], ['A6', 0.5], ['G#6', 0.5], [null, 0.5]],
];

const EVENT_ANSWER = [
  [['E6', 0.5], ['C6', 0.5], ['A5', 1], ['C6', 0.5], ['E6', 0.5], ['A6', 1]],
  [['F6', 0.5], ['A6', 0.5], ['C7', 1], ['A6', 0.5], ['G6', 0.5], ['E6', 1]],
  [['F6', 0.5], ['D6', 0.5], ['A5', 1], ['D6', 0.5], ['F6', 0.5], ['A6', 1]],
  [['E6', 0.5], ['G#6', 0.5], ['B6', 0.5], ['E7', 0.5], ['D7', 0.5], ['B6', 0.5], ['G#6', 0.5], [null, 0.5]],
];

const EVENT_WARNING = [
  [['A5', 0.5], ['E6', 0.5], ['A6', 0.5], ['E6', 0.5], ['C6', 0.5], ['E6', 0.5], ['A6', 0.5], [null, 0.5]],
  [['A5', 0.5], ['F6', 0.5], ['A6', 0.5], ['F6', 0.5], ['C6', 0.5], ['F6', 0.5], ['A6', 0.5], [null, 0.5]],
  [['A5', 0.5], ['D6', 0.5], ['A6', 0.5], ['D6', 0.5], ['F6', 0.5], ['A6', 0.5], ['D7', 0.5], [null, 0.5]],
  [['B5', 0.5], ['E6', 0.5], ['B6', 0.5], ['E6', 0.5], ['G#6', 0.5], ['B6', 0.5], ['E7', 0.5], [null, 0.5]],
];

function eventBar(index, rng, clock) {
  const progression = ['A', 'F', 'D', 'E'];
  const chordName = progression[index % progression.length];
  const cycle = Math.floor(index / 4);
  const barInCycle = index % 4;
  const quiet = cycle === 0 || cycle === 4;
  const layers = [
    { buf: padBar(chordName, clock, { brightness: quiet ? 1150 : 1650, pulse: true }), gain: quiet ? 0.16 : 0.2 },
    { buf: arpeggioBar(chordName, clock, { reverse: cycle % 2 === 1, soft: quiet }), gain: quiet ? 0.3 : 0.38 },
    { buf: bassBar(chordName, clock, { walking: cycle >= 2 && cycle !== 4, soft: quiet }), gain: quiet ? 0.46 : 0.58 },
  ];

  if (cycle === 0) {
    // A quick suspense entrance: pulse first, then reveal half of the warning
    // motif so the screen change immediately feels like an interruption.
    layers.push({ buf: titleDrums(rng, clock, { intensity: 0.58, fill: index === 3 }), gain: 0.56 });
    if (barInCycle >= 2) {
      layers.push({ buf: sequenceBar(EVENT_WARNING[barInCycle], clock, titleLead, { octaveShift: -1, softer: true }), gain: 0.44 });
    }
  } else if (cycle === 1) {
    layers.push({ buf: sequenceBar(EVENT_HOOK[barInCycle], clock, titleLead), gain: 0.66 });
    layers.push({ buf: titleDrums(rng, clock, { intensity: 0.88, fill: index === 7 }), gain: 0.64 });
  } else if (cycle === 2) {
    layers.push({ buf: sequenceBar(EVENT_WARNING[barInCycle], clock, titleLead), gain: 0.64 });
    layers.push({ buf: fanfareStabs(chordName, clock, { quiet: true }), gain: 0.14 });
    layers.push({ buf: titleDrums(rng, clock, { intensity: 1, stadium: true, fill: index === 11 }), gain: 0.68 });
  } else if (cycle === 3) {
    layers.push({ buf: sequenceBar(EVENT_ANSWER[barInCycle], clock, titleLead), gain: 0.68 });
    layers.push({ buf: titleDrums(rng, clock, { intensity: 1.06, stadium: true, fill: index === 15 }), gain: 0.7 });
  } else if (cycle === 4) {
    // Brief investigation beat: pull the lead down an octave and open a pocket
    // in the mix for the player to read before the second build begins.
    layers.push({ buf: sequenceBar(EVENT_HOOK[barInCycle], clock, titleLead, { octaveShift: -1, softer: true }), gain: 0.42 });
    layers.push({ buf: titleDrums(rng, clock, { intensity: 0.68, stadium: true, fill: index === 19 }), gain: 0.58 });
  } else if (cycle === 5) {
    layers.push({ buf: sequenceBar(EVENT_WARNING[barInCycle], clock, titleLead), gain: 0.7 });
    layers.push({ buf: sequenceBar(EVENT_WARNING[barInCycle], clock, titleLead, { octaveShift: -1, softer: true }), gain: 0.16 });
    layers.push({ buf: titleDrums(rng, clock, { intensity: 1.08, stadium: true, fill: index === 23 }), gain: 0.7 });
  } else if (cycle === 6) {
    layers.push({ buf: sequenceBar(EVENT_ANSWER[barInCycle], clock, titleLead), gain: 0.72 });
    layers.push({ buf: fanfareStabs(chordName, clock), gain: 0.17 });
    layers.push({ buf: titleDrums(rng, clock, { intensity: 1.12, stadium: true, fill: index === 27 }), gain: 0.72 });
  } else {
    // Full hook return. The fill lands in bar 31 and the last bar resolves onto
    // E major, whose leading tone pulls naturally back to A minor at the seam.
    layers.push({ buf: sequenceBar(EVENT_HOOK[barInCycle], clock, titleLead), gain: 0.74 });
    layers.push({ buf: sequenceBar(EVENT_HOOK[barInCycle], clock, titleLead, { octaveShift: -1, softer: true }), gain: 0.2 });
    layers.push({ buf: fanfareStabs(chordName, clock), gain: 0.2 });
    layers.push({ buf: titleDrums(rng, clock, { intensity: 1.14, stadium: true, fill: index === 30 }), gain: 0.72 });
  }

  return resize(mix(layers), clock.barN);
}

function buildTitleTheme() {
  const clock = makeClock(128);
  const rng = mulberry32(4101);
  const bars = Array.from({ length: 24 }, (_, index) => titleBar(index, rng, clock));
  return { bpm: clock.bpm, buffer: highpass(softClip(concat(bars), 1.05), 28) };
}

function buildManagementTheme() {
  const clock = makeClock(112);
  const rng = mulberry32(4102);
  const bars = Array.from({ length: 56 }, (_, index) => managementBar(index, rng, clock));
  return { bpm: clock.bpm, buffer: highpass(softClip(concat(bars), 1.02), 28) };
}

function buildEventTheme() {
  const clock = makeClock(136);
  const rng = mulberry32(4103);
  const bars = Array.from({ length: 32 }, (_, index) => eventBar(index, rng, clock));
  return { bpm: clock.bpm, buffer: highpass(softClip(concat(bars), 1.06), 28) };
}

function writeM4a(wavPath, m4aPath) {
  try {
    execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '96000', wavPath, m4aPath], { stdio: 'pipe' });
    return 'afconvert (-b 96000)';
  } catch {
    try {
      execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-s', '3', '-q', '127', wavPath, m4aPath], { stdio: 'pipe' });
      return 'afconvert (VBR q127 fallback)';
    } catch {
      execFileSync(
        'ffmpeg',
        ['-y', '-v', 'error', '-i', wavPath, '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', m4aPath],
        { stdio: 'pipe' },
      );
      return 'ffmpeg (AAC 96k)';
    }
  }
}

function renderTrack(entry, built, outDir) {
  const fadeN = secondsToSamples(entry.loopFadeMs / 1000);
  const looped = crossfadeLoop(built.buffer, fadeN);
  const finalBuf = normalize(looped, entry.targetDb);
  const wavPath = join(outDir, `${entry.name}.wav`);
  const m4aPath = join(outDir, `${entry.name}.m4a`);
  saveWav(wavPath, finalBuf, SAMPLE_RATE);
  const ms = (finalBuf.length / SAMPLE_RATE) * 1000;
  console.log(`${entry.name}.wav  ${ms.toFixed(0)}ms  ${built.bpm} BPM  peak ${entry.targetDb}dBFS`);
  try {
    const encoder = writeM4a(wavPath, m4aPath);
    console.log(`${entry.name}.m4a  written via ${encoder}`);
  } catch (err) {
    console.warn(`AAC encoders unavailable or failed, skipping ${entry.name}.m4a (${err.message})`);
  }
  return { wavPath, m4aPath, ms };
}

export function generateMenuMusic(outDir = OUT_DIR) {
  mkdirSync(outDir, { recursive: true });
  const openingEntry = MUSIC_CATALOG.find((entry) => entry.name === 'opening-theme');
  const managementEntry = MUSIC_CATALOG.find((entry) => entry.name === 'management-theme');
  const eventEntry = MUSIC_CATALOG.find((entry) => entry.name === 'event-theme');
  if (!openingEntry || !managementEntry || !eventEntry) throw new Error('menu music entries missing from MUSIC_CATALOG');
  return [
    renderTrack(openingEntry, buildTitleTheme(), outDir),
    renderTrack(managementEntry, buildManagementTheme(), outDir),
    renderTrack(eventEntry, buildEventTheme(), outDir),
  ];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  generateMenuMusic();
}
