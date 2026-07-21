import { powerCutInDurationMs, powerCutInPresentation, shouldShowFullPowerCutIn } from '../power-cut-in';
import type { PowerId } from '../../sim/types';

describe('M4 power cut-in policy', () => {
  it('has readable comic presentation for every shipped power', () => {
    const powers: PowerId[] = [
      'SUPER_SPEED', 'BLINK_RUN', 'THUNDER_STRIKE', 'FIRE_TORCH', 'PHASE_RUN', 'PORTAL_PASS',
      'MAGNET_TOUCH', 'DECOY_DOUBLE', 'FUTURE_SIGHT', 'SUPER_STRENGTH', 'WEB_TRAP', 'ELASTIC_KEEPER',
    ];
    for (const power of powers) {
      expect(powerCutInPresentation(power)).toMatchObject({
        name: expect.any(String),
        glyph: expect.any(String),
        color: expect.stringMatching(/^#[0-9a-f]{6}$/i),
      });
    }
  });

  it('uses full panels only when motion and the user setting allow them', () => {
    expect(shouldShowFullPowerCutIn('full', false)).toBe(true);
    expect(shouldShowFullPowerCutIn('banner', false)).toBe(false);
    expect(shouldShowFullPowerCutIn('full', true)).toBe(false);
    expect(powerCutInDurationMs(false)).toBeGreaterThan(powerCutInDurationMs(true));
  });
});
