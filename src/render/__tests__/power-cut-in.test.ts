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

  it('uses only colors from the locked master art palette', () => {
    const powers: PowerId[] = [
      'SUPER_SPEED', 'BLINK_RUN', 'THUNDER_STRIKE', 'FIRE_TORCH', 'PHASE_RUN', 'PORTAL_PASS',
      'MAGNET_TOUCH', 'DECOY_DOUBLE', 'FUTURE_SIGHT', 'SUPER_STRENGTH', 'WEB_TRAP', 'ELASTIC_KEEPER',
    ];
    const allowed = new Set([
      '#5b3a91', '#9a63d6', '#c9a6ec',
      '#a83440', '#d94f52', '#f2938c',
      '#3f6fb5', '#5a8fd6', '#a3c8f0',
      '#c8862a', '#edb54a', '#f7d894',
      '#3f8a4a', '#5cb85c', '#8fd98f',
      '#6b6675', '#9a95a4', '#c9c5d0',
      '#241f2e', '#f4f1ea', '#ffffff',
    ]);

    for (const power of powers) {
      expect(allowed.has(powerCutInPresentation(power).color)).toBe(true);
    }
  });

  it('uses full panels only when motion and the user setting allow them', () => {
    expect(shouldShowFullPowerCutIn('full', false)).toBe(true);
    expect(shouldShowFullPowerCutIn('banner', false)).toBe(false);
    expect(shouldShowFullPowerCutIn('full', true)).toBe(false);
    expect(powerCutInDurationMs(false)).toBeGreaterThan(powerCutInDurationMs(true));
  });
});
