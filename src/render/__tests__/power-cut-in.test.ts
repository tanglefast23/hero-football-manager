import { appendNewestFour, powerCutInAccessibilityLabel, powerCutInDurationMs, powerCutInGroupPolicy, powerCutInPresentation, powerCutInTileWidth, powerOverlayPath, shouldShowFullPowerCutIn } from '../power-cut-in';
import { LAUNCH_POWER_IDS } from '../../game/power-catalog';

describe('M4 power cut-in policy', () => {
  it('has readable comic presentation for every shipped power', () => {
    for (const power of LAUNCH_POWER_IDS) {
      expect(powerCutInPresentation(power)).toMatchObject({
        name: expect.any(String),
        glyph: expect.any(String),
        color: expect.stringMatching(/^#[0-9a-f]{6}$/i),
      });
    }
  });

  it('uses only colors from the locked master art palette', () => {
    const allowed = new Set([
      '#5b3a91', '#9a63d6', '#c9a6ec',
      '#a83440', '#d94f52', '#f2938c',
      '#3f6fb5', '#5a8fd6', '#a3c8f0',
      '#c8862a', '#edb54a', '#f7d894',
      '#3f8a4a', '#5cb85c', '#8fd98f',
      '#6b6675', '#9a95a4', '#c9c5d0',
      '#241f2e', '#f4f1ea', '#ffffff',
    ]);

    for (const power of LAUNCH_POWER_IDS) {
      expect(allowed.has(powerCutInPresentation(power).color)).toBe(true);
    }
  });

  it('uses the compact player card for full mode without motion gating', () => {
    expect(shouldShowFullPowerCutIn('full', false)).toBe(true);
    expect(shouldShowFullPowerCutIn('banner', false)).toBe(false);
    expect(shouldShowFullPowerCutIn('full', true)).toBe(true);
    expect(powerCutInDurationMs(false)).toBeGreaterThan(powerCutInDurationMs(true));
  });

  it('lays out one full tile, two halves, two-up-one-down, and a 2x2 grid', () => {
    expect([powerCutInTileWidth(1, 0)]).toEqual(['100%']);
    expect([0, 1].map(index => powerCutInTileWidth(2, index))).toEqual(['50%', '50%']);
    expect([0, 1, 2].map(index => powerCutInTileWidth(3, index))).toEqual(['50%', '50%', '100%']);
    expect([0, 1, 2, 3].map(index => powerCutInTileWidth(4, index))).toEqual(['50%', '50%', '50%', '50%']);
  });

  it('selects own-team compact cards and routes rivals or banner mode to text banners', () => {
    expect(powerOverlayPath('full', false, 0, 0)).toBe('tile');
    expect(powerOverlayPath('full', false, 1, 0)).toBe('banner');
    expect(powerOverlayPath('banner', false, 0, 0)).toBe('banner');
    expect(powerOverlayPath('full', true, 0, 0)).toBe('tile');
  });

  it('keeps the newest four overlays', () => {
    const result = [1, 2, 3, 4, 5].reduce<number[]>(appendNewestFour, []);
    expect(result).toEqual([2, 3, 4, 5]);
  });

  it('announces every tile in a held four-power group', () => {
    const label = powerCutInAccessibilityLabel([
      { power: 'FIRE_TORCH', playerName: 'Dario Flint', skippable: false },
      { power: 'SUPER_SPEED', playerName: 'Zip Vela', skippable: false },
      { power: 'GRAVITY_WELL', playerName: 'Leo Quick', skippable: false },
      { power: 'ELASTIC_KEEPER', playerName: 'Sam Mitts', skippable: false },
    ]);
    expect(label).toContain('Fire Torch, Dario Flint. A flaming run ignites one, two, or three');
    expect(label).toContain('Super Speed, Zip Vela. A runner explodes into space');
    expect(label).toContain('Gravity Well, Leo Quick. Gravity lines pull defenders inward');
    expect(label).toContain('Elastic Keeper, Sam Mitts. The goalkeeper stretches across the goal');
  });

  it('never pauses a mixed first-reveal group', () => {
    expect(powerCutInGroupPolicy([])).toEqual({
      shouldPause: false,
      skippable: false,
      durationMs: powerCutInDurationMs(false),
    });
    expect(powerCutInGroupPolicy([{ skippable: true }, { skippable: false }])).toEqual({
      shouldPause: false,
      skippable: false,
      durationMs: powerCutInDurationMs(false),
    });
    expect(powerCutInGroupPolicy([{ skippable: true }, { skippable: true }])).toEqual({
      shouldPause: false,
      skippable: true,
      durationMs: powerCutInDurationMs(true),
    });
  });
});
