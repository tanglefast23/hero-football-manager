import { readFileSync } from 'fs';
import { join } from 'path';
import { ENABLED_LOCALES, loadCatalog } from '../../i18n';
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

  it('lets a tap skip the beat that is playing before it advances the story', () => {
    const source = sceneSource();

    // Two stages on one tap: finish what is playing, then move on. Without the
    // first, a manager on their third awakening sits through the whole hobble.
    expect(source).toContain('skipBeatRef.current?.();');
    expect(source).toContain('let settle: () => void;');
    expect(source).toContain('skipBeatRef.current = () => {');
    // The picture is a tap target too, not just the text panel underneath it.
    expect(source).toContain('style={StyleSheet.absoluteFill}');
    // The hint the skip tap is offered by. It was the literal 'TAP TO SKIP'
    // until the cut-scene was keyed; what this pins is that the hint still
    // exists, not which language it is in.
    expect(source).toContain("t('awakening.tapToSkip')");
    // Nothing may be disabled while a beat plays, or the skip tap goes nowhere.
    expect(source).not.toContain('disabled={!advanceReady}');
  });

  /**
   * The four labels on the tap chip. They were typed English in the component
   * — the last strings on this screen that were — and a component literal is
   * invisible to every i18n gate: nothing fails, the cut-scene just plays in
   * English inside a German career.
   */
  it('takes its tap hints from the catalog, in every language', () => {
    const source = sceneSource();

    for (const literal of ['TAP TO SKIP', 'TAP TO CONTINUE', 'HERO #1', 'NEW HERO']) {
      expect({ literal, hardcoded: source.includes(`'${literal}'`) })
        .toEqual({ literal, hardcoded: false });
    }
    const keys = ['tapToSkip', 'tapToContinue', 'firstHero', 'newHero'];
    for (const key of keys) expect(source).toContain(`t('awakening.${key}')`);
    for (const locale of ENABLED_LOCALES) {
      const strings = loadCatalog(locale).strings;
      expect({ locale, missing: keys.filter(key => strings[`awakening.${key}`] === undefined) })
        .toEqual({ locale, missing: [] });
    }
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
