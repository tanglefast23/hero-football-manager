import { LAUNCH_POWER_IDS } from '../../game/power-catalog';
import {
  POWER_EFFECT_DESCRIPTORS,
  powerEffectDescriptor,
  powerEffectFrame,
} from '../power-effect-descriptors';
import { POWER_EFFECT_RENDER_STYLE } from '../power-effect-render-style';

describe('launch power effect direction', () => {
  it('renders production FX as hard-edged pixel art', () => {
    expect(POWER_EFFECT_RENDER_STYLE).toEqual({
      antiAlias: false,
      strokeCap: 'butt',
      strokeJoin: 'miter',
    });
  });

  it('gives every launch power a unique, accessible three-beat animation', () => {
    expect(Object.keys(POWER_EFFECT_DESCRIPTORS).sort()).toEqual(
      [...LAUNCH_POWER_IDS].sort(),
    );
    const signatures = new Set<string>();
    for (const power of LAUNCH_POWER_IDS) {
      const effect = powerEffectDescriptor(power);
      expect(effect.durationMs).toBeGreaterThanOrEqual(3_000);
      expect(effect.durationMs).toBeLessThanOrEqual(5_000);
      expect(effect.accessibilityLabel.length).toBeGreaterThan(30);
      expect(effect.beats).toHaveLength(3);
      expect(effect.beats[0].startMs).toBe(0);
      expect(effect.beats[2].endMs).toBe(effect.durationMs);
      expect(signatures.has(effect.signature)).toBe(false);
      signatures.add(effect.signature);
    }
  });

  it('preserves the owner-approved timing and tier cues', () => {
    const strength = powerEffectDescriptor('SUPER_STRENGTH');
    expect(strength.beats[1]).toMatchObject({ label: '0.5 SEC CHARGE' });
    expect(strength.beats[1].endMs - strength.beats[1].startMs).toBe(500);

    const web = powerEffectDescriptor('WEB_TRAP');
    expect(web.beats[2]).toMatchObject({ label: 'ROOTED' });
    expect(web.beats[2].endMs - web.beats[2].startMs).toBe(2_000);

    expect(powerEffectDescriptor('FIRE_TORCH').accessibilityLabel).toMatch(
      /one, two, or three/i,
    );
    expect(powerEffectDescriptor('PORTAL_PASS').beats[2].label).toBe(
      'RECEIVER SHIELDED',
    );
    expect(powerEffectDescriptor('RALLY_CRY').beats[2].label).toBe(
      'ENCORE TICKET',
    );
    expect(powerEffectDescriptor('ICE_RINK').beats[2].label).toBe(
      'ATTACK RESET',
    );
  });

  it('shows the complete causal sequence for the revised powers', () => {
    expect(
      powerEffectDescriptor('DECOY_DOUBLE').beats.map((beat) => beat.id),
    ).toEqual(['project', 'fork', 'swap']);
    expect(
      powerEffectDescriptor('FUTURE_SIGHT').beats.map((beat) => beat.id),
    ).toEqual(['anticipate', 'intercept', 'outlet']);
    expect(
      powerEffectDescriptor('SHADOW_MARK').beats.map((beat) => beat.id),
    ).toEqual(['burrow', 'hunt', 'pop-steal']);
    expect(powerEffectDescriptor('GUST').beats.map((beat) => beat.id)).toEqual([
      'bend',
      'keeper',
      'punt',
    ]);
  });

  it('advances deterministically and holds a readable reduced-motion frame', () => {
    const effect = powerEffectDescriptor('FUTURE_SIGHT');
    expect(powerEffectFrame('FUTURE_SIGHT', 0)).toMatchObject({
      beatIndex: 0,
      progress: 0,
    });
    expect(
      powerEffectFrame('FUTURE_SIGHT', effect.beats[1].startMs),
    ).toMatchObject({ beatIndex: 1 });
    expect(
      powerEffectFrame('FUTURE_SIGHT', effect.durationMs + 100),
    ).toMatchObject({
      beatIndex: 2,
      progress: 1,
      complete: true,
    });
    expect(powerEffectFrame('FUTURE_SIGHT', 0, true).beatIndex).toBe(2);
  });
});
