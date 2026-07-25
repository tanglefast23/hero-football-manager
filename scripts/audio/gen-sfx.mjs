// Generates every SFX in the catalog into assets/audio/sfx/*.wav.
// Each sound is built from scripts/audio/synth.mjs primitives; sound-specific
// shaping (chords, sweeps, gates) lives here since it's one-off per sound.
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { saveWav, SAMPLE_RATE } from './wav.mjs';
import {
  mulberry32,
  secondsToSamples,
  oscSine,
  oscSquare,
  oscTriangle,
  oscSaw,
  noiseWhite,
  noisePink,
  expGlide,
  vibrato,
  adsr,
  decayEnv,
  applyEnv,
  lowpass,
  highpass,
  bandpass,
  timeVaryingBandpass,
  softClip,
  mix,
  gainBuf,
  concat,
  silence,
  resize,
  crossfadeLoop,
  normalize,
  note,
} from './synth.mjs';
import { SFX_CATALOG } from './catalog.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '../../assets/audio/sfx');

// ---- shared instrument helpers ----

// Referee whistle: triangle tone + quiet 3rd-harmonic overtone + a thin
// bandpassed breath-noise layer. freq may be a constant or (t) => Hz.
function whistleTone(n, freq, rng, sampleRate = SAMPLE_RATE) {
  const freq3 = typeof freq === 'function' ? (t) => freq(t) * 3 : freq * 3;
  const freq0 = typeof freq === 'function' ? freq(0) : freq;
  const tone = oscTriangle(n, freq, sampleRate);
  const overtone = gainBuf(oscTriangle(n, freq3, sampleRate), 0.15);
  const breath = gainBuf(bandpass(noiseWhite(n, rng), freq0 * 0.8, freq0 * 1.6, sampleRate), 0.12);
  const env = adsr(n, { attack: 0.008, decay: 0.01, sustain: 0.95, release: 0.025, sampleRate });
  return applyEnv(mix([{ buf: tone }, { buf: overtone }, { buf: breath }]), env);
}

// Percussive "knock": a pitch-dropping sine + a lowpassed noise burst on top.
function thump(n, { baseFreq, pitchDrop, noiseAmt, cutoff, decay, rng }) {
  const knock = oscSine(n, expGlide(baseFreq, baseFreq * pitchDrop, n / SAMPLE_RATE));
  const knockEnv = applyEnv(knock, decayEnv(n, { attack: 0.001, decay }));
  const noise = applyEnv(lowpass(noiseWhite(n, rng), cutoff), decayEnv(n, { attack: 0.001, decay: decay * 0.4 }));
  return mix([{ buf: knockEnv, gain: 1 }, { buf: noise, gain: noiseAmt }]);
}

// Bell-ish single note: fundamental + two quiet, slightly-detuned harmonics.
function chimeNote(n, freq, decay = 0.35) {
  const tone = mix([
    { buf: oscSine(n, freq), gain: 1 },
    { buf: oscSine(n, freq * 2.01), gain: 0.25 },
    { buf: oscSine(n, freq * 3.98), gain: 0.1 },
  ]);
  return applyEnv(tone, decayEnv(n, { attack: 0.003, decay }));
}

// Metallic ping: inharmonic sine partials, each decaying at its own rate
// (higher partials die faster) — the "struck metal bar" character.
function metallicPing(n, baseFreq, partialRatios) {
  const layers = partialRatios.map((ratio, i) => {
    const decay = 0.6 / (1 + i * 0.6);
    const g = 1 / (1 + i * 0.8);
    const tone = oscSine(n, baseFreq * ratio);
    return { buf: applyEnv(tone, decayEnv(n, { attack: 0.001, decay })), gain: g };
  });
  return mix(layers);
}

// Triad played as a block chord, blending triangle (round) + square (bite).
function chordHit(n, noteNames, decay) {
  const layers = noteNames.map((name) => ({
    buf: mix([
      { buf: oscTriangle(n, note(name)), gain: 0.6 },
      { buf: oscSquare(n, note(name), 0.5), gain: 0.25 },
    ]),
    gain: 1 / noteNames.length,
  }));
  return applyEnv(mix(layers), decayEnv(n, { attack: 0.005, decay }));
}

// Low-rate sample-and-hold amplitude gate — a broken/glitchy stutter.
function stutterGate(n, rng, rateHz, lowLevel) {
  const gate = new Float32Array(n);
  const stepN = Math.max(1, Math.round(SAMPLE_RATE / rateHz));
  let level = 1;
  for (let i = 0; i < n; i++) {
    if (i % stepN === 0) level = rng() > 0.25 ? 1 : lowLevel;
    gate[i] = level;
  }
  return gate;
}

// Linearly sweeps a bandpass window from [loStart,hiStart] to [loEnd,hiEnd].
function sweepBand(buf, loRange, hiRange, chunks = 10) {
  const dur = buf.length / SAMPLE_RATE;
  return timeVaryingBandpass(
    buf,
    (t) => {
      const f = Math.min(1, t / dur);
      return [loRange[0] + (loRange[1] - loRange[0]) * f, hiRange[0] + (hiRange[1] - hiRange[0]) * f];
    },
    chunks,
  );
}

// Gentle auto-leveler: tracks local RMS (via a lowpass on the squared signal)
// and compensates toward the buffer's overall RMS, gain-clamped both ways.
// Broadband noise has large natural short-window RMS swings (pink noise's
// 1/f spectrum carries real energy at sub-second timescales) — without this,
// two arbitrary 30ms windows of the same "steady" texture can differ by
// 8-10dB purely by chance, which reads as an uneven, pulsing ambient bed.
function levelize(buf, cutoffHz, gainClamp) {
  const squared = new Float32Array(buf.length);
  for (let i = 0; i < buf.length; i++) squared[i] = buf[i] * buf[i];
  const smoothedPower = lowpass(squared, cutoffHz);
  let sumSq = 0;
  for (let i = 0; i < buf.length; i++) sumSq += squared[i];
  const targetRms = Math.sqrt(sumSq / buf.length);
  const out = new Float32Array(buf.length);
  for (let i = 0; i < buf.length; i++) {
    const localRms = Math.sqrt(Math.max(smoothedPower[i], 1e-8));
    const g = Math.min(gainClamp, Math.max(1 / gainClamp, targetRms / localRms));
    out[i] = buf[i] * g;
  }
  return out;
}

// Oscillates a bandpass window's center around centerHz — a "voice-ish wobble".
function wobbleBand(buf, centerHz, spreadHz, wobbleHz, bandwidth, chunks = 12) {
  return timeVaryingBandpass(
    buf,
    (t) => {
      const c = centerHz + spreadHz * Math.sin(2 * Math.PI * wobbleHz * t);
      return [Math.max(60, c - bandwidth / 2), c + bandwidth / 2];
    },
    chunks,
  );
}

// ---- match core ----

function genKickoffWhistle(seed) {
  const rng = mulberry32(seed);
  const tone1 = whistleTone(secondsToSamples(0.14), 2600, rng);
  const gap = silence(secondsToSamples(0.02));
  const tone2 = whistleTone(secondsToSamples(0.16), 3000, rng);
  return concat([tone1, gap, tone2]);
}

function genHalftimeWhistle(seed) {
  const rng = mulberry32(seed);
  const n = secondsToSamples(0.9);
  return whistleTone(n, vibrato(2800, 6, 12), rng);
}

function genFulltimeWhistle(seed) {
  const rng = mulberry32(seed);
  const blast = () => whistleTone(secondsToSamples(0.17), 2900, rng);
  const gap = () => silence(secondsToSamples(0.09));
  return concat([blast(), gap(), blast(), gap(), blast()]);
}

function genKickPass(seed) {
  const rng = mulberry32(seed);
  const n = secondsToSamples(0.09);
  return thump(n, { baseFreq: 180, pitchDrop: 0.7, noiseAmt: 0.25, cutoff: 900, decay: 0.06, rng });
}

function genKickShot(seed) {
  const rng = mulberry32(seed);
  const n = secondsToSamples(0.2);
  // Leather "thwack" — a short bandpassed-noise snap, the foot striking the
  // ball. This attack transient is what reads as a hard STRIKE vs a soft pass.
  const thwackN = secondsToSamples(0.022);
  const thwack = resize(applyEnv(bandpass(noiseWhite(thwackN, rng), 1400, 3800), decayEnv(thwackN, { attack: 0.0004, decay: 0.016 })), n);
  // Deep bass punch — sine glide from higher, longer decay for weight/thunk.
  const punch = applyEnv(oscSine(n, expGlide(160, 46, 0.11)), decayEnv(n, { attack: 0.001, decay: 0.17 }));
  // Mid thump body.
  const body = thump(n, { baseFreq: 130, pitchDrop: 0.55, noiseAmt: 0.35, cutoff: 1100, decay: 0.11, rng });
  // softClip glues the layers and lifts RMS so the strike cuts over the music.
  return softClip(mix([{ buf: thwack, gain: 0.75 }, { buf: body, gain: 0.7 }, { buf: punch, gain: 1.0 }]), 1.35);
}

function genBallBounce(seed) {
  const rng = mulberry32(seed);
  const n = secondsToSamples(0.05);
  const click = applyEnv(highpass(noiseWhite(n, rng), 1200), decayEnv(n, { attack: 0.0005, decay: 0.02 }));
  const tick = applyEnv(oscSine(n, 300), decayEnv(n, { attack: 0.0005, decay: 0.025 }));
  return mix([{ buf: click, gain: 0.7 }, { buf: tick, gain: 0.5 }]);
}

function genDecoyPop(seed) {
  const rng = mulberry32(seed);
  const n = secondsToSamples(0.22);
  // A tiny high click supplies the comic "p", while a very short downward
  // bubble glide makes it read as a magical double vanishing rather than a
  // football bouncing on turf.
  const clickN = secondsToSamples(0.025);
  const click = resize(
    applyEnv(highpass(noiseWhite(clickN, rng), 1800), decayEnv(clickN, { attack: 0.0005, decay: 0.018 })),
    n,
  );
  const bubble = applyEnv(
    oscSine(n, expGlide(920, 170, 0.12)),
    decayEnv(n, { attack: 0.001, decay: 0.16 }),
  );
  const sparkle = applyEnv(
    oscTriangle(n, expGlide(1500, 900, 0.08)),
    decayEnv(n, { attack: 0.001, decay: 0.07 }),
  );
  return softClip(mix([
    { buf: click, gain: 0.85 },
    { buf: bubble, gain: 0.9 },
    { buf: sparkle, gain: 0.18 },
  ]), 1.1);
}

function genPostDing() {
  const n = secondsToSamples(0.7);
  return metallicPing(n, 1400, [1, 2.4, 4.2, 6.1]);
}

function genNetSwish(seed) {
  const rng = mulberry32(seed);
  const n = secondsToSamples(0.35);
  const swept = sweepBand(noiseWhite(n, rng), [2200, 400], [4200, 1400], 10);
  const env = adsr(n, { attack: 0.04, decay: 0.05, sustain: 0.45, release: 0.2 });
  return applyEnv(swept, env);
}

function genGoalFanfare(seed) {
  const rng = mulberry32(seed);
  const noteDur = 0.22;
  const noteN = secondsToSamples(noteDur);
  const names = ['C5', 'E5', 'G5'];
  const layers = names.map((name, i) => {
    const tone = mix([
      { buf: oscSquare(noteN, note(name), 0.5), gain: 0.5 },
      { buf: oscTriangle(noteN, note(name) * 2), gain: 0.25 },
    ]);
    const isLast = i === names.length - 1;
    const buf = applyEnv(tone, decayEnv(noteN, { attack: 0.005, decay: isLast ? 0.5 : 0.16 }));
    return { buf, gain: 0.9, offset: Math.round(i * noteDur * 0.85 * SAMPLE_RATE) };
  });
  const totalN = secondsToSamples(1.3);
  const arp = resize(mix(layers), totalN);
  const swell = applyEnv(bandpass(noisePink(totalN, rng), 400, 3000), adsr(totalN, { attack: 0.15, decay: 0.1, sustain: 0.5, release: 0.5 }));
  return mix([{ buf: arp, gain: 1 }, { buf: swell, gain: 0.35 }]);
}

function genCrowdCheer(seed) {
  const rng = mulberry32(seed);
  const n = secondsToSamples(1.4);
  const wobbled = wobbleBand(noisePink(n, rng), 1000, 500, 3.5, 900, 14);
  const env = adsr(n, { attack: 0.1, decay: 0.15, sustain: 0.7, release: 0.4 });
  return applyEnv(wobbled, env);
}

function genCrowdOoh(seed) {
  const rng = mulberry32(seed);
  const n = secondsToSamples(1.2);
  const swept = sweepBand(noisePink(n, rng), [2200, 500], [3600, 1200], 14);
  const env = adsr(n, { attack: 0.06, decay: 0.25, sustain: 0.4, release: 0.5 });
  return applyEnv(swept, env);
}

function genCrowdAmbient(seed) {
  const rng = mulberry32(seed);
  const fadeN = secondsToSamples(0.05);
  const n = secondsToSamples(8) + fadeN;
  const murmur = levelize(lowpass(noisePink(n, rng), 450), 28, 2.5);
  // Organic level movement: sum of slow LFOs so it never reads as a single
  // mechanical pulse. Frequencies are exact multiples of 1/8Hz (1, 3, 2
  // cycles per 8s loop) so the modulation itself is periodic across the
  // loop point — otherwise the two edges sample different phases of the
  // envelope and the loop reads as a level jump even with sample-accurate
  // crossfading underneath.
  const shaped = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const mod = 0.75 + 0.15 * Math.sin(2 * Math.PI * 0.125 * t) + 0.08 * Math.sin(2 * Math.PI * 0.375 * t + 1.7) + 0.05 * Math.sin(2 * Math.PI * 0.25 * t + 0.4);
    shaped[i] = murmur[i] * mod;
  }
  return crossfadeLoop(shaped, fadeN);
}

function genTackleThud(seed) {
  const rng = mulberry32(seed);
  const n = secondsToSamples(0.19);
  return thump(n, { baseFreq: 90, pitchDrop: 0.55, noiseAmt: 0.6, cutoff: 700, decay: 0.13, rng });
}

function genGrunt(seed) {
  const rng = mulberry32(seed);
  const n = secondsToSamples(0.2);
  const saw = oscSaw(n, expGlide(180, 90, 0.16));
  const formant = bandpass(saw, 300, 900);
  return applyEnv(formant, decayEnv(n, { attack: 0.01, decay: 0.14 }));
}

function genSaveSlap(seed) {
  const rng = mulberry32(seed);
  const n = secondsToSamples(0.19);
  const slap = applyEnv(highpass(noiseWhite(n, rng), 2000), decayEnv(n, { attack: 0.001, decay: 0.05 }));
  const low = applyEnv(oscSine(n, expGlide(110, 60, 0.15)), decayEnv(n, { attack: 0.001, decay: 0.12 }));
  return mix([{ buf: slap, gain: 0.7 }, { buf: low, gain: 0.7 }]);
}

function genCardWhistle(seed) {
  const rng = mulberry32(seed);
  const n = secondsToSamples(0.2);
  const tone = oscTriangle(n, 3200);
  const overtone = gainBuf(oscTriangle(n, 3200 * 3), 0.2);
  const breath = gainBuf(bandpass(noiseWhite(n, rng), 2500, 5000), 0.1);
  const env = adsr(n, { attack: 0.003, decay: 0.02, sustain: 0.8, release: 0.03 });
  return applyEnv(mix([{ buf: tone }, { buf: overtone }, { buf: breath }]), env);
}

function genCrowdJeer(seed) {
  const rng = mulberry32(seed);
  const n = secondsToSamples(1.2);
  const dur = n / SAMPLE_RATE;
  const shaped = timeVaryingBandpass(
    noisePink(n, rng),
    (t) => {
      const f = Math.min(1, t / dur);
      const center = 1100 - 700 * f + 120 * Math.sin(2 * Math.PI * 3 * t);
      return [Math.max(60, center - 350), center + 350];
    },
    14,
  );
  const env = adsr(n, { attack: 0.1, decay: 0.2, sustain: 0.6, release: 0.4 });
  return applyEnv(shaped, env);
}

// ---- zone & powers ----

function genZoneEnter(seed) {
  const rng = mulberry32(seed);
  const names = ['C5', 'E5', 'G5', 'C6'];
  const step = 0.09;
  const noteLen = secondsToSamples(0.35);
  const layers = names.map((name, i) => ({
    buf: chimeNote(noteLen, note(name), 0.3 + i * 0.05),
    gain: 0.55,
    offset: Math.round(i * step * SAMPLE_RATE),
  }));
  const totalN = secondsToSamples(0.6);
  const arp = resize(mix(layers), totalN);
  const sparkle = applyEnv(highpass(noiseWhite(totalN, rng), 6000), decayEnv(totalN, { attack: 0.01, decay: 0.25 }));
  return mix([{ buf: arp, gain: 1 }, { buf: sparkle, gain: 0.12 }]);
}

function genZoneExpire(seed) {
  const rng = mulberry32(seed);
  const n = secondsToSamples(0.38);
  const tone = oscTriangle(n, expGlide(500, 120, 0.35));
  const soft = lowpass(tone, 1400);
  const body = applyEnv(soft, adsr(n, { attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.2 }));
  const breath = applyEnv(lowpass(noiseWhite(n, rng), 500), decayEnv(n, { attack: 0.01, decay: 0.2 }));
  return mix([{ buf: body, gain: 0.8 }, { buf: breath, gain: 0.15 }]);
}

function genWindupRiser(seed) {
  const rng = mulberry32(seed);
  const dur = 1.5;
  const n = secondsToSamples(dur);
  const tone = gainBuf(oscSaw(n, expGlide(220, 950, dur)), 0.5);
  const softened = lowpass(tone, 3000);
  const risingTone = applyEnv(softened, adsr(n, { attack: 0.05, decay: 0, sustain: 0.8, release: 0.15 }));

  const tickCount = 15;
  const tickLayers = [];
  for (let i = 0; i < tickCount; i++) {
    const tNorm = (i / (tickCount - 1)) ** 0.6; // concave -> gaps shrink -> accelerating
    const startSample = Math.min(n - 1, Math.round(tNorm * dur * SAMPLE_RATE));
    const tickN = secondsToSamples(0.02);
    const tick = applyEnv(highpass(noiseWhite(tickN, rng), 2000), decayEnv(tickN, { attack: 0.0005, decay: 0.015 }));
    tickLayers.push({ buf: tick, gain: 0.5, offset: startSample });
  }
  return mix([{ buf: risingTone, gain: 1 }, ...tickLayers]);
}

function genPowerInterrupt(seed) {
  const rng = mulberry32(seed);
  const n = secondsToSamples(0.3);
  const tone = oscSquare(n, expGlide(1200, 150, 0.28), 0.5); // duty != 0.5 biases DC (2*duty-1) — see oscSquare
  const gate = stutterGate(n, rng, 45, 0.12);
  const stuttered = applyEnv(applyEnv(tone, decayEnv(n, { attack: 0.002, decay: 0.22 })), gate);
  const noiseBurst = applyEnv(highpass(noiseWhite(n, rng), 1500), decayEnv(n, { attack: 0.001, decay: 0.05 }));
  return mix([{ buf: stuttered, gain: 0.8 }, { buf: noiseBurst, gain: 0.3 }]);
}

function genSuperSpeedWhoosh(seed) {
  const rng = mulberry32(seed);
  const n = secondsToSamples(0.45);
  const noise = noiseWhite(n, rng);
  const half = Math.ceil(n / 2);
  const rising = sweepBand(noise.slice(0, half), [300, 900], [2200, 4500], 8);
  const falling = sweepBand(noise.slice(half), [900, 300], [4500, 1200], 8);
  const swept = resize(concat([rising, falling]), n);
  const env = adsr(n, { attack: 0.08, decay: 0.05, sustain: 0.6, release: 0.15 });
  return applyEnv(swept, env);
}

function genBlinkTeleport(seed) {
  const rng = mulberry32(seed);
  const n = secondsToSamples(0.42);
  const chirpN = secondsToSamples(0.22);
  const depart = applyEnv(
    oscSine(chirpN, expGlide(700, 2600, 0.18)),
    decayEnv(chirpN, { attack: 0.002, decay: 0.18 }),
  );
  const arrive = applyEnv(
    oscTriangle(chirpN, expGlide(2600, 900, 0.18)),
    decayEnv(chirpN, { attack: 0.002, decay: 0.16 }),
  );
  const sparkle = applyEnv(
    highpass(noiseWhite(n, rng), 5000),
    decayEnv(n, { attack: 0.006, decay: 0.24 }),
  );
  return mix([
    { buf: depart, gain: 0.75 },
    { buf: arrive, gain: 0.6, offset: secondsToSamples(0.12) },
    { buf: sparkle, gain: 0.16 },
  ]);
}

function genThunderCharge(seed) {
  const rng = mulberry32(seed);
  const n = secondsToSamples(0.56);
  const hum = applyEnv(
    lowpass(oscSaw(n, expGlide(110, 620, 0.52)), 1800),
    adsr(n, { attack: 0.04, decay: 0.05, sustain: 0.7, release: 0.08 }),
  );
  const crackles = [];
  for (let i = 0; i < 12; i++) {
    const crackN = secondsToSamples(0.018 + rng() * 0.018);
    const crack = applyEnv(
      highpass(noiseWhite(crackN, rng), 2800),
      decayEnv(crackN, { attack: 0.0005, decay: 0.012 }),
    );
    crackles.push({
      buf: crack,
      gain: 0.35 + rng() * 0.4,
      offset: Math.round(rng() * (n - crackN)),
    });
  }
  return softClip(mix([{ buf: hum, gain: 0.65 }, ...crackles]), 1.25);
}

function genPhaseShift(seed) {
  const rng = mulberry32(seed);
  const n = secondsToSamples(0.44);
  const swept = sweepBand(noiseWhite(n, rng), [3800, 500], [7000, 2600], 12);
  const hollow = applyEnv(
    oscSine(n, expGlide(900, 180, 0.4)),
    adsr(n, { attack: 0.03, decay: 0.04, sustain: 0.45, release: 0.16 }),
  );
  const air = applyEnv(swept, adsr(n, { attack: 0.025, decay: 0.04, sustain: 0.55, release: 0.14 }));
  return mix([{ buf: air, gain: 0.65 }, { buf: hollow, gain: 0.4 }]);
}

function genPortalWarp(seed) {
  const rng = mulberry32(seed);
  const n = secondsToSamples(0.65);
  const swirl = sweepBand(noiseWhite(n, rng), [250, 1800], [1700, 6200], 14);
  const swirlEnv = applyEnv(swirl, adsr(n, { attack: 0.06, decay: 0.05, sustain: 0.5, release: 0.22 }));
  const whoomp = applyEnv(
    oscSine(n, expGlide(150, 48, 0.5)),
    decayEnv(n, { attack: 0.012, decay: 0.45 }),
  );
  const shield = chimeNote(n, note('C6'), 0.42);
  return resize(mix([
    { buf: swirlEnv, gain: 0.5 },
    { buf: whoomp, gain: 0.7 },
    { buf: shield, gain: 0.35, offset: secondsToSamples(0.16) },
  ]), n);
}

function genFutureSightRead(seed) {
  const rng = mulberry32(seed);
  const n = secondsToSamples(0.55);
  const tickN = secondsToSamples(0.035);
  const layers = [];
  for (let i = 0; i < 3; i++) {
    const tick = applyEnv(
      highpass(noiseWhite(tickN, rng), 3800),
      decayEnv(tickN, { attack: 0.0005, decay: 0.02 }),
    );
    layers.push({ buf: tick, gain: 0.55 + i * 0.15, offset: secondsToSamples(0.1 * i) });
  }
  const visionPing = chimeNote(secondsToSamples(0.34), note('E6'), 0.3);
  layers.push({ buf: visionPing, gain: 0.85, offset: secondsToSamples(0.21) });
  return resize(mix(layers), n);
}

function genFutureSightIntercept(seed) {
  const rng = mulberry32(seed);
  const n = secondsToSamples(0.34);
  const sweep = sweepBand(noiseWhite(n, rng), [5000, 500], [8500, 3000], 10);
  const air = applyEnv(sweep, decayEnv(n, { attack: 0.012, decay: 0.24 }));
  const catchPing = metallicPing(n, 920, [1, 2.6, 4.1]);
  return mix([{ buf: air, gain: 0.55 }, { buf: catchPing, gain: 0.5 }]);
}

function genWebCast(seed) {
  const rng = mulberry32(seed);
  const n = secondsToSamples(0.34);
  const filament = sweepBand(noiseWhite(n, rng), [900, 3800], [2600, 7200], 9);
  const flick = applyEnv(filament, decayEnv(n, { attack: 0.001, decay: 0.18 }));
  const twang = applyEnv(
    oscTriangle(n, expGlide(780, 260, 0.28)),
    decayEnv(n, { attack: 0.001, decay: 0.2 }),
  );
  return mix([{ buf: flick, gain: 0.5 }, { buf: twang, gain: 0.55 }]);
}

function genWebSpring(seed) {
  const rng = mulberry32(seed);
  const n = secondsToSamples(0.45);
  const snap = applyEnv(
    oscTriangle(n, expGlide(1100, 120, 0.34)),
    decayEnv(n, { attack: 0.001, decay: 0.24 }),
  );
  const fibers = applyEnv(
    bandpass(noiseWhite(n, rng), 900, 5500),
    adsr(n, { attack: 0.005, decay: 0.06, sustain: 0.25, release: 0.22 }),
  );
  return mix([{ buf: snap, gain: 0.8 }, { buf: fibers, gain: 0.45 }]);
}

function genKeeperStretch(seed) {
  const rng = mulberry32(seed);
  const halfN = secondsToSamples(0.25);
  const up = oscTriangle(halfN, expGlide(170, 680, 0.23));
  const down = oscTriangle(halfN, expGlide(680, 220, 0.23));
  const n = halfN * 2;
  const rubber = applyEnv(concat([up, down]), adsr(n, { attack: 0.01, decay: 0.04, sustain: 0.55, release: 0.12 }));
  const squeak = applyEnv(highpass(noiseWhite(n, rng), 3200), decayEnv(n, { attack: 0.004, decay: 0.25 }));
  return mix([{ buf: rubber, gain: 0.75 }, { buf: squeak, gain: 0.12 }]);
}

function genIceFreeze(seed) {
  const rng = mulberry32(seed);
  const n = secondsToSamples(0.6);
  const frost = applyEnv(
    highpass(noiseWhite(n, rng), 4600),
    adsr(n, { attack: 0.04, decay: 0.04, sustain: 0.4, release: 0.24 }),
  );
  const pings = ['C6', 'G6', 'E7'].map((name, i) => ({
    buf: chimeNote(secondsToSamples(0.32), note(name), 0.28),
    gain: 0.55 - i * 0.07,
    offset: secondsToSamples(0.09 * i),
  }));
  return resize(mix([{ buf: frost, gain: 0.24 }, ...pings]), n);
}

function genIceSlide(seed) {
  const rng = mulberry32(seed);
  const n = secondsToSamples(0.75);
  const scrape = sweepBand(noiseWhite(n, rng), [4200, 1600], [8200, 4800], 16);
  const glide = applyEnv(scrape, adsr(n, { attack: 0.03, decay: 0.04, sustain: 0.55, release: 0.22 }));
  const squeal = applyEnv(
    oscSine(n, expGlide(1400, 520, 0.68)),
    adsr(n, { attack: 0.05, decay: 0.06, sustain: 0.22, release: 0.22 }),
  );
  return mix([{ buf: glide, gain: 0.5 }, { buf: squeal, gain: 0.24 }]);
}

function genShadowBurrow(seed) {
  const rng = mulberry32(seed);
  const n = secondsToSamples(0.65);
  const rumble = applyEnv(
    oscSine(n, expGlide(180, 42, 0.58)),
    adsr(n, { attack: 0.02, decay: 0.05, sustain: 0.55, release: 0.18 }),
  );
  const dirt = applyEnv(
    lowpass(noisePink(n, rng), 900),
    adsr(n, { attack: 0.01, decay: 0.07, sustain: 0.4, release: 0.2 }),
  );
  return highpass(mix([{ buf: rumble, gain: 0.7 }, { buf: dirt, gain: 0.55 }]), 28);
}

function genShadowEmerge(seed) {
  const rng = mulberry32(seed);
  const n = secondsToSamples(0.5);
  const rise = applyEnv(
    oscSine(n, expGlide(55, 520, 0.4)),
    decayEnv(n, { attack: 0.008, decay: 0.38 }),
  );
  const burst = applyEnv(
    bandpass(noiseWhite(n, rng), 280, 3600),
    decayEnv(n, { attack: 0.001, decay: 0.2 }),
  );
  const steal = metallicPing(n, 760, [1, 2.2, 3.7]);
  return mix([{ buf: rise, gain: 0.65 }, { buf: burst, gain: 0.55 }, { buf: steal, gain: 0.28 }]);
}

function genGiantGrow(seed) {
  const rng = mulberry32(seed);
  const n = secondsToSamples(0.65);
  const body = applyEnv(
    oscSaw(n, expGlide(58, 220, 0.58)),
    adsr(n, { attack: 0.04, decay: 0.05, sustain: 0.6, release: 0.16 }),
  );
  const softened = lowpass(body, 1100);
  const chord = chordHit(secondsToSamples(0.42), ['C3', 'G3', 'C4'], 0.38);
  const air = applyEnv(lowpass(noiseWhite(n, rng), 600), decayEnv(n, { attack: 0.02, decay: 0.45 }));
  return softClip(mix([
    { buf: softened, gain: 0.65 },
    { buf: chord, gain: 0.55, offset: secondsToSamples(0.18) },
    { buf: air, gain: 0.16 },
  ]), 1.15);
}

function genSuperStrengthBoom(seed) {
  const rng = mulberry32(seed);
  const stepDur = 0.5;
  const stepN = secondsToSamples(stepDur);
  const stepCount = 4;
  const steps = [];
  for (let i = 0; i < stepCount; i++) {
    const t = i / (stepCount - 1);
    const stepLen = secondsToSamples(0.09);
    const g = 0.3 + 0.5 * t;
    const step = thump(stepLen, { baseFreq: 70, pitchDrop: 0.8, noiseAmt: 0.5, cutoff: 500, decay: 0.06, rng });
    steps.push({ buf: step, gain: g, offset: Math.round(t * (stepDur - 0.09) * SAMPLE_RATE) });
  }
  const rumble = mix(steps);

  const impactN = secondsToSamples(0.35);
  const impactKnock = oscSine(impactN, expGlide(70, 35, 0.3));
  const impactNoise = lowpass(noiseWhite(impactN, rng), 900);
  const impactRaw = mix([{ buf: impactKnock, gain: 1.1 }, { buf: impactNoise, gain: 0.6 }]);
  const impact = softClip(applyEnv(impactRaw, decayEnv(impactN, { attack: 0.001, decay: 0.28 })), 2.2);

  return mix([{ buf: rumble, gain: 1 }, { buf: impact, gain: 1, offset: stepN }]);
}

function genFireTorchIgnite(seed) {
  const rng = mulberry32(seed);
  const n = secondsToSamples(0.5);
  const whoomp = applyEnv(lowpass(noiseWhite(n, rng), 500), adsr(n, { attack: 0.06, decay: 0.1, sustain: 0.4, release: 0.25 }));
  const whoompTone = applyEnv(oscSine(n, expGlide(150, 90, 0.3)), decayEnv(n, { attack: 0.02, decay: 0.3 }));

  const crackles = [];
  for (let i = 0; i < 10; i++) {
    const startSample = Math.round(rng() * 0.85 * n);
    const cN = secondsToSamples(0.02 + rng() * 0.02);
    const crackle = applyEnv(highpass(noiseWhite(cN, rng), 2500), decayEnv(cN, { attack: 0.0005, decay: 0.012 }));
    crackles.push({ buf: crackle, gain: 0.35 + rng() * 0.3, offset: startSample });
  }
  return mix([{ buf: whoomp, gain: 0.7 }, { buf: whoompTone, gain: 0.5 }, ...crackles]);
}

function genExtinguisherSpray(seed) {
  const rng = mulberry32(seed);
  const n = secondsToSamples(0.65);
  const hiss = bandpass(noiseWhite(n, rng), 700, 6000);
  // hand-tuned comedic gate: sputter, sputter, SPRAY, sputter, pfft-out
  const segments = [
    { frac: 0.06, level: 0.8 },
    { frac: 0.03, level: 0.05 },
    { frac: 0.05, level: 0.7 },
    { frac: 0.04, level: 0.05 },
    { frac: 0.55, level: 1.0 },
    { frac: 0.05, level: 0.1 },
    { frac: 0.06, level: 0.6 },
    { frac: 0.16, level: 0.0 },
  ];
  const gate = new Float32Array(n);
  let pos = 0;
  for (const seg of segments) {
    const segN = Math.round(seg.frac * n);
    for (let i = 0; i < segN && pos < n; i++, pos++) gate[pos] = seg.level;
  }
  while (pos < n) gate[pos++] = 0;
  const wobble = noiseWhite(n, rng); // subtle jitter so the steady spray isn't perfectly flat
  const shaped = new Float32Array(n);
  for (let i = 0; i < n; i++) shaped[i] = hiss[i] * gate[i] * (0.85 + 0.15 * wobble[i]);
  return applyEnv(shaped, adsr(n, { attack: 0.005, decay: 0, sustain: 1, release: 0.05 }));
}

function genMatchEndSting() {
  const chord1Len = secondsToSamples(0.35);
  const chord2Len = secondsToSamples(0.7);
  const chord1 = chordHit(chord1Len, ['G4', 'B4', 'D5'], 0.3);
  const chord2 = chordHit(chord2Len, ['C4', 'E4', 'G4', 'C5'], 0.6);
  return mix([{ buf: chord1, gain: 0.8 }, { buf: chord2, gain: 0.9, offset: secondsToSamples(0.32) }]);
}

// ---- driver ----

const GENERATORS = {
  'kickoff-whistle': genKickoffWhistle,
  'halftime-whistle': genHalftimeWhistle,
  'fulltime-whistle': genFulltimeWhistle,
  'kick-pass': genKickPass,
  'kick-shot': genKickShot,
  'ball-bounce': genBallBounce,
  'post-ding': genPostDing,
  'net-swish': genNetSwish,
  'goal-fanfare': genGoalFanfare,
  'crowd-cheer': genCrowdCheer,
  'crowd-ooh': genCrowdOoh,
  'crowd-ambient': genCrowdAmbient,
  'tackle-thud': genTackleThud,
  grunt: genGrunt,
  'save-slap': genSaveSlap,
  'card-whistle': genCardWhistle,
  'crowd-jeer': genCrowdJeer,
  'zone-enter': genZoneEnter,
  'zone-expire': genZoneExpire,
  'windup-riser': genWindupRiser,
  'power-interrupt': genPowerInterrupt,
  'super-speed-whoosh': genSuperSpeedWhoosh,
  'blink-teleport': genBlinkTeleport,
  'thunder-charge': genThunderCharge,
  'phase-shift': genPhaseShift,
  'portal-warp': genPortalWarp,
  'future-sight-read': genFutureSightRead,
  'future-sight-intercept': genFutureSightIntercept,
  'super-strength-boom': genSuperStrengthBoom,
  'web-cast': genWebCast,
  'web-spring': genWebSpring,
  'keeper-stretch': genKeeperStretch,
  'ice-freeze': genIceFreeze,
  'ice-slide': genIceSlide,
  'shadow-burrow': genShadowBurrow,
  'shadow-emerge': genShadowEmerge,
  'giant-grow': genGiantGrow,
  'fire-torch-ignite': genFireTorchIgnite,
  'extinguisher-spray': genExtinguisherSpray,
  'match-end-sting': genMatchEndSting,
  'decoy-pop': genDecoyPop,
};

export function generateAllSfx(outDir = OUT_DIR) {
  mkdirSync(outDir, { recursive: true });
  const results = [];
  SFX_CATALOG.forEach((entry, index) => {
    const gen = GENERATORS[entry.name];
    if (!gen) throw new Error(`no generator registered for "${entry.name}"`);
    const seed = 1000 + index;
    const finalBuf = normalize(gen(seed), entry.targetDb);
    const path = join(outDir, `${entry.name}.wav`);
    saveWav(path, finalBuf, SAMPLE_RATE);
    const ms = (finalBuf.length / SAMPLE_RATE) * 1000;
    results.push({ name: entry.name, ms, path });
    console.log(`${entry.name}.wav  ${ms.toFixed(0)}ms  peak ${entry.targetDb}dBFS`);
  });
  return results;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const results = generateAllSfx();
  console.log(`\ngenerated ${results.length} SFX -> ${OUT_DIR}`);
}
