import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * MatchScreen imports react-native and Skia, so Jest cannot load it. These are
 * source guards in the shape of `ball-flame.test.ts`: each one pins a wiring
 * decision that is invisible to a unit test and expensive to rediscover.
 */
function source(file: string): string {
  return readFileSync(join(process.cwd(), file), 'utf8');
}

describe('substitution walk wiring', () => {
  const screen = source('src/render/MatchScreen.tsx');

  it('starts the walk for every team, not just the managed one', () => {
    // Tying the walk to the managed team would leave every opponent and every
    // automatic substitution teleporting. This branch used to hold a
    // manager-only event line behind a `controlledTeam` filter, and the guard
    // was that the walk sat outside it; the substitution line is gone, so the
    // branch must now carry no team filter at all.
    const branch = screen.slice(
      screen.indexOf("if (e.kind === 'SUBSTITUTION')"),
      screen.indexOf('startSubstitutionWalk(s, e);'),
    );
    expect(branch).not.toContain('controlledTeam');
    expect(screen).toContain('startSubstitutionWalk(s, e);');
  });

  it('skips the whole effect under Reduce Motion', () => {
    const starter = screen.slice(screen.indexOf('const startSubstitutionWalk'));
    expect(starter.slice(0, 200)).toContain('suppressCosmeticEffects');
  });

  it('draws the walkers inside the camera Group', () => {
    const camera = screen.indexOf('<Group transform={cameraTransform}>');
    const walkers = screen.indexOf('<SubstitutionWalkers');
    const cameraCloses = screen.indexOf('</Group>', camera);
    expect(camera).toBeGreaterThan(-1);
    expect(walkers).toBeGreaterThan(camera);
    expect(walkers).toBeLessThan(cameraCloses);
  });

  it('starts the walk from the published tick, never the stale event tick', () => {
    const starter = screen.slice(
      screen.indexOf('const startSubstitutionWalk'),
      screen.indexOf('// ---- Activation juice'),
    );
    expect(starter).toContain('const startTick = s.tick;');
    expect(starter).not.toMatch(/startTick[^;]*e\.t\b/u);
  });

  it('hides only the incoming walker, and only for as long as he walks', () => {
    const publish = screen.slice(
      screen.indexOf('if (substitutionWalksRef.current.length > 0)'),
      screen.indexOf('publishAtlasFrame('),
    );
    expect(publish).toContain('hiddenSlots(live, s.tick)');
    expect(publish).toContain('visible[slot] = false');
    expect(publish).toContain(
      "walk.direction === 'on' && walk.slot === carrier",
    );
  });
});

describe('substitution nameplate sizing', () => {
  const walkers = source('src/render/SubstitutionWalkers.tsx');

  it('sizes the plate in screen pixels, never through the pitch scale', () => {
    // `scale` converts pitch units to dp and runs about 0.06. Multiplying a
    // size by it is what once shipped a half-pixel ball flame that read as "the
    // feature does not work". The component hands `nameplateBox` one dp-per-
    // source-pixel figure; the box may never reach for `scale` itself.
    expect(walkers).toContain('const pixel = scale * playerDrawScale;');
    expect(source('src/render/pixel-glyphs.ts')).toContain(
      'const cell = CELL_SOURCE_PX * pixel;',
    );
    const glyphCode = source('src/render/pixel-glyphs.ts')
      .replace(/\/\*[\s\S]*?\*\//gu, '')
      .replace(/\/\/.*$/gmu, '');
    expect(glyphCode).not.toMatch(/\bscale\b/u);
  });

  it('puts positions through the scale, and snaps them to the pixel grid', () => {
    expect(walkers).toContain('sample.value.x * scale');
    expect(walkers).toContain('snapDevicePixels(');
  });

  it('builds the name path once and translates it, never per frame', () => {
    const nameplate = walkers.slice(
      walkers.indexOf('function WalkerNameplate'),
    );
    const build = nameplate.indexOf('useMemo(');
    const derived = nameplate.indexOf('useDerivedValue(');
    expect(build).toBeGreaterThan(-1);
    expect(build).toBeLessThan(derived);
    const transform = nameplate.slice(
      nameplate.indexOf('const transform = useDerivedValue'),
    );
    expect(transform.slice(0, 300)).not.toContain('buildNameplate');
  });

  it('batches every walker into one Atlas draw', () => {
    expect(walkers.match(/<Atlas/gu)).toHaveLength(1);
  });
});
