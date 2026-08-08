// Dependency-free synthesis toolkit: oscillators, noise, envelopes, filters, mixing.
// All generators take a sample COUNT (not seconds) so layers built from different
// primitives line up exactly — use secondsToSamples() at the call site.
import { SAMPLE_RATE } from './wav.mjs';

// ---- seeded PRNG (copied verbatim from src/sim/rng.ts so behavior matches the sim) ----
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function secondsToSamples(seconds, sampleRate = SAMPLE_RATE) {
  return Math.round(seconds * sampleRate);
}

function resolveFreq(freq, t) {
  return typeof freq === 'function' ? freq(t) : freq;
}

// ---- oscillators (freq: Hz number, or (t: seconds) => Hz for glides/vibrato) ----
export function oscSine(n, freq, sampleRate = SAMPLE_RATE) {
  const out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    out[i] = Math.sin(2 * Math.PI * phase);
    phase += resolveFreq(freq, i / sampleRate) / sampleRate;
    phase -= Math.floor(phase);
  }
  return out;
}

// Note: duty != 0.5 introduces a DC bias of (2*duty-1) — DC-block (highpass)
// downstream if you need an off-center duty cycle without offset.
export function oscSquare(n, freq, duty = 0.5, sampleRate = SAMPLE_RATE) {
  const out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    out[i] = phase < duty ? 1 : -1;
    phase += resolveFreq(freq, i / sampleRate) / sampleRate;
    phase -= Math.floor(phase);
  }
  return out;
}

export function oscTriangle(n, freq, sampleRate = SAMPLE_RATE) {
  const out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    out[i] = phase < 0.5 ? -1 + 4 * phase : 3 - 4 * phase;
    phase += resolveFreq(freq, i / sampleRate) / sampleRate;
    phase -= Math.floor(phase);
  }
  return out;
}

export function oscSaw(n, freq, sampleRate = SAMPLE_RATE) {
  const out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    out[i] = 2 * phase - 1;
    phase += resolveFreq(freq, i / sampleRate) / sampleRate;
    phase -= Math.floor(phase);
  }
  return out;
}

// ---- noise ----
export function noiseWhite(n, rng) {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = rng() * 2 - 1;
  return out;
}

// Paul Kellet's refined pink-noise approximation (3-pole), gain-compensated.
export function noisePink(n, rng) {
  const out = new Float32Array(n);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  for (let i = 0; i < n; i++) {
    const white = rng() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.969 * b2 + white * 0.153852;
    out[i] = (b0 + b1 + b2 + white * 0.1848) * 0.25;
  }
  return out;
}

// ---- pitch shaping ----
// Exponential glide from startHz to endHz over `duration` seconds, then holds at endHz.
export function expGlide(startHz, endHz, duration) {
  const ratio = endHz / startHz;
  return (t) => startHz * ratio ** (Math.min(t, duration) / duration);
}

// Sine-LFO vibrato around baseHz, +/-depthCents, at rateHz.
export function vibrato(baseHz, rateHz = 5, depthCents = 20) {
  const depthRatio = 2 ** (depthCents / 1200);
  return (t) => baseHz * depthRatio ** Math.sin(2 * Math.PI * rateHz * t);
}

// ---- envelopes (multiply into a buffer via applyEnv) ----
export function adsr(n, { attack = 0.01, decay = 0.05, sustain = 0.6, release = 0.1, sampleRate = SAMPLE_RATE } = {}) {
  const env = new Float32Array(n);
  const aN = Math.max(1, secondsToSamples(attack, sampleRate));
  const dN = Math.max(0, secondsToSamples(decay, sampleRate));
  const rN = Math.max(0, secondsToSamples(release, sampleRate));
  const sN = Math.max(0, n - aN - dN - rN);
  let i = 0;
  for (let k = 0; k < aN && i < n; k++, i++) env[i] = k / aN;
  for (let k = 0; k < dN && i < n; k++, i++) env[i] = 1 - (1 - sustain) * (k / dN);
  for (let k = 0; k < sN && i < n; k++, i++) env[i] = sustain;
  for (let k = 0; k < rN && i < n; k++, i++) env[i] = sustain * (1 - k / rN);
  return env;
}

// Percussive envelope: linear attack then true exponential decay (for resonant/ringing sounds).
export function decayEnv(n, { attack = 0.002, decay = 0.2, sampleRate = SAMPLE_RATE } = {}) {
  const env = new Float32Array(n);
  const aN = Math.max(1, secondsToSamples(attack, sampleRate));
  const tau = decay / 5; // ~5 time-constants to reach ~0
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const a = i < aN ? i / aN : 1;
    env[i] = a * Math.exp(-t / tau);
  }
  return env;
}

export function applyEnv(buf, env) {
  const out = new Float32Array(buf.length);
  for (let i = 0; i < buf.length; i++) out[i] = buf[i] * (env[i] ?? 0);
  return out;
}

// ---- filters ----
export function lowpass(buf, cutoffHz, sampleRate = SAMPLE_RATE) {
  const out = new Float32Array(buf.length);
  const rc = 1 / (2 * Math.PI * cutoffHz);
  const dt = 1 / sampleRate;
  const alpha = dt / (rc + dt);
  let prev = 0;
  for (let i = 0; i < buf.length; i++) {
    prev += alpha * (buf[i] - prev);
    out[i] = prev;
  }
  return out;
}

export function highpass(buf, cutoffHz, sampleRate = SAMPLE_RATE) {
  const out = new Float32Array(buf.length);
  const rc = 1 / (2 * Math.PI * cutoffHz);
  const dt = 1 / sampleRate;
  const alpha = rc / (rc + dt);
  let prevIn = 0;
  let prevOut = 0;
  for (let i = 0; i < buf.length; i++) {
    const cur = alpha * (prevOut + buf[i] - prevIn);
    out[i] = cur;
    prevIn = buf[i];
    prevOut = cur;
  }
  return out;
}

export function bandpass(buf, lowHz, highHz, sampleRate = SAMPLE_RATE) {
  return highpass(lowpass(buf, highHz, sampleRate), lowHz, sampleRate);
}

// Approximates a moving bandpass (sweep, doppler, wobble) by filtering short
// chunks, each with a [lowHz, highHz] pair from bandFn(tSeconds). The one-pole
// filters above are constant-coefficient, so this chunked approach is the
// simplest way to get a time-varying band without a true time-varying filter.
export function timeVaryingBandpass(buf, bandFn, chunks = 10, sampleRate = SAMPLE_RATE) {
  const chunkLen = Math.ceil(buf.length / chunks);
  const parts = [];
  for (let c = 0; c < chunks; c++) {
    const start = c * chunkLen;
    if (start >= buf.length) break;
    const end = Math.min(buf.length, start + chunkLen);
    const [lo, hi] = bandFn(start / sampleRate);
    parts.push(bandpass(buf.slice(start, end), lo, hi, sampleRate));
  }
  return concat(parts);
}

export function softClip(buf, drive = 1) {
  const out = new Float32Array(buf.length);
  for (let i = 0; i < buf.length; i++) out[i] = Math.tanh(buf[i] * drive);
  return out;
}

// ---- mixing / gain ----
export function gainBuf(buf, g) {
  const out = new Float32Array(buf.length);
  for (let i = 0; i < buf.length; i++) out[i] = buf[i] * g;
  return out;
}

// layers: [{ buf, gain = 1, offset = 0 (samples) }]
export function mix(layers) {
  let maxLen = 0;
  for (const { buf, offset = 0 } of layers) maxLen = Math.max(maxLen, buf.length + offset);
  const out = new Float32Array(maxLen);
  for (const { buf, gain = 1, offset = 0 } of layers) {
    for (let i = 0; i < buf.length; i++) out[i + offset] += buf[i] * gain;
  }
  return out;
}

export function concat(buffers) {
  let total = 0;
  for (const b of buffers) total += b.length;
  const out = new Float32Array(total);
  let offset = 0;
  for (const b of buffers) {
    out.set(b, offset);
    offset += b.length;
  }
  return out;
}

export function silence(n) {
  return new Float32Array(n);
}

export function resize(buf, n) {
  const out = new Float32Array(n);
  out.set(buf.subarray(0, Math.min(n, buf.length)));
  return out;
}

export function peakOf(buf) {
  let peak = 0;
  for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i]));
  return peak;
}

export function dbToLin(db) {
  return 10 ** (db / 20);
}

// Scales buf so its peak sample sits at targetDb dBFS (e.g. -1).
export function normalize(buf, targetDb = -1) {
  const peak = peakOf(buf);
  if (peak <= 0) return buf;
  return gainBuf(buf, dbToLin(targetDb) / peak);
}

// Crossfades the tail into the head so the buffer loops without a click, then
// trims the tail. Output is (buf.length - fadeSamples) long. Equal-power is the
// default for uncorrelated sources (noise, or different musical moments),
// while the optional linear curve avoids a gain bump when the overlap contains
// closely related copies of the same phrase.
export function crossfadeLoop(buf, fadeSamples, curve = 'equalPower') {
  const fadeN = Math.min(fadeSamples, Math.floor(buf.length / 2));
  const tailStart = buf.length - fadeN;
  const out = buf.slice(0, tailStart);
  for (let i = 0; i < fadeN; i++) {
    const progress = i / fadeN;
    const headGain = curve === 'linear' ? progress : Math.sin(progress * (Math.PI / 2));
    const tailGain = curve === 'linear' ? 1 - progress : Math.cos(progress * (Math.PI / 2));
    out[i] = buf[i] * headGain + buf[tailStart + i] * tailGain;
  }
  return out;
}

// ---- music theory helpers (A minor / C major — the game's shared key) ----
const NOTE_OFFSET = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };

export function noteHz(midiNote) {
  return 440 * 2 ** ((midiNote - 69) / 12);
}

// Note name like "A4", "C#5", "Bb3" -> Hz.
export function note(name) {
  const m = /^([A-G])(#|b)?(-?\d+)$/.exec(name);
  if (!m) throw new Error(`bad note name: ${name}`);
  const [, letter, accidental, octaveStr] = m;
  let semitone = NOTE_OFFSET[letter];
  if (accidental === '#') semitone += 1;
  if (accidental === 'b') semitone -= 1;
  const octave = parseInt(octaveStr, 10);
  return noteHz(semitone + (octave - 4) * 12 + 69);
}
