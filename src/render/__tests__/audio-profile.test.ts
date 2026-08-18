import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { audioKeysForProfile, passComboPlaybackRate } from '../audio';

describe('match audio profiles', () => {
  it('loads only the staged power and shared clip sounds for an awakening demo', () => {
    const showcase = audioKeysForProfile('showcase', 'SUPER_STRENGTH');
    expect(showcase).toContain('super-strength-boom');
    expect(showcase).toContain('kick-pass');
    expect(showcase).toContain('ball-flight-whoosh');
    expect(showcase).not.toContain('blink-teleport');
    expect(showcase.length).toBeLessThan(audioKeysForProfile('full').length);
  });

  it('keeps Fire Torch-specific impact and recovery sounds in its demo', () => {
    expect(audioKeysForProfile('showcase', 'FIRE_TORCH')).toEqual(
      expect.arrayContaining(['flame-up', 'flame-hit', 'extinguisher-spray']),
    );
  });
});

describe('pass combo cue', () => {
  it('ships the asset the SFX table names', () => {
    // The require() in audio.ts is resolved by the bundler, not by Jest, so a
    // missing file would only show up as silence on a device.
    expect(
      existsSync(join(process.cwd(), 'assets/audio/sfx/pass-combo.m4a')),
    ).toBe(true);
  });

  it('is loaded in a full match but not in the awakening demo', () => {
    expect(audioKeysForProfile('full')).toContain('pass-combo');
    expect(audioKeysForProfile('showcase', 'SUPER_STRENGTH')).not.toContain(
      'pass-combo',
    );
  });

  it('climbs with the run, then stops climbing before it chirps', () => {
    expect(passComboPlaybackRate(2)).toBe(1);
    expect(passComboPlaybackRate(3)).toBeGreaterThan(1);
    expect(passComboPlaybackRate(6)).toBeGreaterThan(passComboPlaybackRate(3));
    expect(passComboPlaybackRate(40)).toBe(passComboPlaybackRate(99));
  });

  it('never returns a rate that would stall or garble the sample', () => {
    for (const count of [-5, 0, 1, 2, 9, 999, Number.NaN]) {
      const rate = passComboPlaybackRate(count);
      expect(rate).toBeGreaterThanOrEqual(1);
      expect(rate).toBeLessThanOrEqual(1.5);
    }
  });
});
