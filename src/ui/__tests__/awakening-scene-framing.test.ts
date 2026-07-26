import { readFileSync } from 'fs';
import { join } from 'path';
import { PITCH_H, PITCH_W } from '../../sim/geometry';
import { awakeningViewportHeight } from '../screens/awakening-progression';

const sceneSource = () => readFileSync(
  join(process.cwd(), 'src/ui/screens/AwakeningCutsceneScreen.tsx'),
  'utf8',
);

/** The furthest the cast is placed above and below the composition anchor. */
const HIGHEST_SPRITE_OFFSET = -176;
const LOWEST_SPRITE_OFFSET = 138;

describe('awakening cutscene framing', () => {
  const viewports = [
    { label: 'phone', width: 390, height: 844 },
    { label: 'large phone', width: 430, height: 932 },
    { label: 'tablet portrait', width: 768, height: 1024 },
    { label: 'desktop', width: 1920, height: 1080 },
    { label: 'wide desktop', width: 2560, height: 1246 },
  ];

  it.each(viewports)('keeps the cast inside the visible strip on $label', ({ width, height }) => {
    const viewport = awakeningViewportHeight(width, height);
    const anchor = viewport * 0.8;

    // The huddle and the players above it have to be on screen, or the scene
    // plays out on an empty green field — which is exactly what a canvas sized
    // to the full pitch drawing produced off-phone.
    expect(anchor + HIGHEST_SPRITE_OFFSET).toBeGreaterThan(0);
    expect(anchor).toBeLessThan(viewport);
    // Sprites drawn below the anchor may clip at the touchline, as on a phone.
    expect(anchor + LOWEST_SPRITE_OFFSET).toBeGreaterThan(anchor);
  });

  it('anchors on the viewport, never on the full-pitch canvas height', () => {
    const source = sceneSource();

    expect(source).toContain('const centerY = viewportHeight * SCENE_ANCHOR_RATIO;');
    expect(source).toContain('const SCENE_ANCHOR_RATIO = 0.8;');
    expect(source).not.toContain('const centerY = pitchHeight / 2;');
    // The canvas is the strip itself, so nothing is drawn where nothing is shown.
    expect(source).toContain('<Canvas style={{ width, height: viewportHeight }}>');
  });

  it('would have put the old anchor off screen on a desktop window', () => {
    const width = 1920;
    const viewport = awakeningViewportHeight(width, 1080);
    const oldAnchor = (PITCH_H * (width / PITCH_W)) / 2;

    // Documents the bug this framing replaced: ~1,000pt below the visible band.
    expect(oldAnchor).toBeGreaterThan(viewport * 2);
    expect(viewport * 0.8).toBeLessThan(viewport);
  });
});
