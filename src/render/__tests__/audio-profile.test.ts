import { audioKeysForProfile } from '../audio';

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
