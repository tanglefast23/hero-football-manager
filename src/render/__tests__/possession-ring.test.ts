import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * The ball-carrier marker used to be a circle around the whole sprite. It is
 * now a flat ellipse on the grass at his feet, and it only reads that way if
 * the player sprite draws OVER it. Source assertions: MatchScreen and the
 * overlays are unimportable under the test runner (Skia, Reanimated, Expo).
 */
const renderDir = join(process.cwd(), 'src/render');
const screen = readFileSync(join(renderDir, 'MatchScreen.tsx'), 'utf8');
const overlays = readFileSync(
  join(renderDir, 'WorkletMatchOverlays.tsx'),
  'utf8',
);
const heroMarkers = readFileSync(join(renderDir, 'HeroPowerRings.tsx'), 'utf8');

const constant = (name: string) => {
  const match = overlays.match(
    new RegExp(`(?:export )?const ${name} = ([\\d.]+);`, 'u'),
  );
  expect(match).not.toBeNull();
  return Number(match![1]);
};

describe('ball-carrier ring', () => {
  it('draws under the player Atlas, so the sprite stands in it', () => {
    const ring = screen.indexOf('<WorkletPossessionRing');
    const atlas = screen.indexOf('sprites={sprites}');
    expect(ring).toBeGreaterThan(-1);
    expect(atlas).toBeGreaterThan(-1);
    expect(ring).toBeLessThan(atlas);
    // And not in the overlay Fragment, which paints on top of everything.
    const fragment = overlays.slice(
      overlays.indexOf('export function WorkletMatchOverlays'),
    );
    expect(fragment).not.toMatch(/POSSESSION_RING/u);
  });

  it('rings the boots without covering the body', () => {
    // Player cell is 24x30 source px: centre row 15, boots rows 26-29.
    const drop = constant('POSSESSION_RING_DROP_PX');
    const rx = constant('POSSESSION_RING_RX_PX');
    const ry = constant('POSSESSION_RING_RY_PX');
    expect(ry).toBeLessThan(rx); // flat on the grass, not a halo
    expect(rx).toBeLessThanOrEqual(12); // never wider than the cell
    // Top edge stays below the shirt (rows 16-23), so the ring frames legs and
    // boots rather than cutting across the body.
    expect(15 + drop - ry).toBeGreaterThan(23);
    // Bottom edge reaches the sole (row 30) so the feet sit inside it.
    expect(15 + drop + ry).toBeGreaterThanOrEqual(29);
  });

  it('is an oval built from plain numbers, allocating nothing on the UI thread', () => {
    const body = overlays.slice(
      overlays.indexOf('export function WorkletPossessionRing'),
    );
    const worklet = body.slice(0, body.indexOf('return ('));
    expect(worklet).toMatch(/builder\.addOval\(\{/u);
    // Sized off the sprite's own scale, so desktop and camera zoom track it.
    expect(worklet).toMatch(/spriteScale/u);
    expect(worklet).not.toMatch(/Skia\./u);
  });
});

describe('hero power marker', () => {
  it('reuses the solid possession oval and hides the yellow oval underneath', () => {
    expect(heroMarkers).toContain('POSSESSION_RING_RX_PX');
    expect(heroMarkers).toContain('POSSESSION_RING_RY_PX');
    expect(heroMarkers).toContain('builder.addOval');
    expect(heroMarkers).not.toContain('DashPathEffect');
    expect(screen).toContain('hiddenMask={');
  });

  it('draws before the player Atlas so the oval wraps the feet', () => {
    const marker = screen.indexOf('<HeroPowerRings');
    const atlas = screen.indexOf('sprites={sprites}');
    expect(marker).toBeGreaterThan(-1);
    expect(marker).toBeLessThan(atlas);
  });
});
