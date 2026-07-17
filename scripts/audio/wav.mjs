// Minimal WAV writer: 16-bit PCM mono. No dependencies.
import { writeFileSync } from 'node:fs';

export const SAMPLE_RATE = 22050;

// samples: Float32Array/number[] in [-1, 1]. Values outside are clamped.
export function encodeWav(samples, sampleRate = SAMPLE_RATE) {
  const numSamples = samples.length;
  const dataSize = numSamples * 2; // 16-bit = 2 bytes/sample
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8, 'ascii');
  buffer.write('fmt ', 12, 'ascii');
  buffer.writeUInt32LE(16, 16); // fmt chunk size (PCM)
  buffer.writeUInt16LE(1, 20); // audio format: PCM
  buffer.writeUInt16LE(1, 22); // channels: mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28); // byte rate
  buffer.writeUInt16LE(2, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample
  buffer.write('data', 36, 'ascii');
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    const scaled = clamped < 0 ? clamped * 32768 : clamped * 32767;
    buffer.writeInt16LE(Math.round(scaled), 44 + i * 2);
  }

  return buffer;
}

export function saveWav(path, samples, sampleRate = SAMPLE_RATE) {
  writeFileSync(path, encodeWav(samples, sampleRate));
}
