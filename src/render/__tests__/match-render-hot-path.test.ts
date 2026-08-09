import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * MatchScreen re-renders once per simulated tick — 10 Hz at ×1, 40 Hz at ×4 —
 * because the HUD (score, clock, banners) is React state. That is by design.
 * What is NOT by design is redoing, on every one of those renders, work whose
 * answer cannot have changed. These tests pin the four cases that were.
 *
 * Source assertions rather than behavioural ones: MatchScreen is unimportable
 * under the test runner (it pulls in Skia, Reanimated and Expo audio), which is
 * exactly why this file existed as an unmeasured hot path in the first place.
 */
const renderDir = join(process.cwd(), 'src/render');
const screen = readFileSync(join(renderDir, 'MatchScreen.tsx'), 'utf8');
const overlays = readFileSync(
  join(renderDir, 'WorkletMatchOverlays.tsx'),
  'utf8',
);

/** The Atlas tint table, which resolves one colour per render slot per tick. */
const colorTable = screen.slice(
  screen.indexOf('const colors: SkColor[] = useMemo('),
  screen.indexOf('const minute = Math.min('),
);

describe('per-tick Atlas inputs are interned, not rebuilt', () => {
  it('resolves all 25 status tints through the colour cache', () => {
    expect(colorTable).not.toBe('');
    // Skia.Color is a CSS parser, not a lookup, and the table draws from a fixed
    // set of literals — so every raw call here was a parse per slot per tick.
    expect(colorTable).not.toContainSource('Skia.Color(');
    expect(colorTable.match(/skColor\(/g)!.length).toBeGreaterThanOrEqual(14);
    expect(screen).toContainSource(
      'const SK_COLOR_CACHE = new Map<string, SkColor>();',
    );
    // Bounded, so a colour built from a continuous value can never grow it.
    expect(screen).toContainSource(
      'SK_COLOR_CACHE.size < SK_COLOR_CACHE_LIMIT',
    );
  });

  it('resolves all 25 sprite rects through the per-atlas rect cache', () => {
    const spriteTable = screen.slice(
      screen.indexOf('const sprites: SkRect[] = useMemo('),
      screen.indexOf('const colors: SkColor[] = useMemo('),
    );
    expect(spriteTable).not.toBe('');
    expect(spriteTable).not.toContainSource('Skia.XYWHRect(');
    expect(spriteTable).not.toContainSource('atlas.rectFor(');
    expect(spriteTable).toContainSource('spriteRects');
    // Keyed by atlas, because rectFor's layout comes from the sheet it was
    // built from — a colour-safe toggle must not serve stale rects.
    expect(screen).toContainSource('const spriteRects = useMemo(');
    expect(screen).toMatchSource(
      /const spriteRects = useMemo\([\s\S]*?\}, \[atlas\]\);/,
    );
  });

  it('keeps the three source cells stable for the life of an atlas', () => {
    // They are handed to the UI-thread worklets; fresh literals per render put
    // them in the worklet closure and churn its dependency list.
    expect(screen).toMatchSource(
      /const \{ playerCell, actionCell, ballCell \} = useMemo\(/,
    );
    expect(screen).not.toContainSource('playerCell: { width: playerCell.w');
  });
});

describe('the canvas is sized by layout, not by the match clock', () => {
  it('hands the Skia host view a memoised style object', () => {
    expect(screen).not.toMatchSource(
      /<RecoverableSkiaCanvas[\s\S]*?style=\{\{/,
    );
    expect(screen).toContainSource('<RecoverableSkiaCanvas');
    expect(screen).toContainSource('style={canvasStyle}');
    expect(screen).toMatchSource(
      /const canvasStyle = useMemo\(.*\[pitchWidth, pitchH\],?\s*\)/s,
    );
    expect(screen).toMatchSource(/const pitchFrameStyle = useMemo\(/);
  });
});

describe('overlay worklets close over stable values', () => {
  it('reads the Fire Torch cast as a bitmask, never a fresh array', () => {
    // Reanimated derives a worklet's mapper dependencies from its captured
    // closure values (useDerivedValue: `inputs = Object.values(updater.__closure)`).
    // A new array identity each tick therefore stopped and restarted one
    // UI-thread mapper per flame layer, every tick, for an unchanged cast.
    expect(overlays).not.toContainSource('fireTorchPlayers');
    expect(overlays).toContainSource(
      'const fireCaster = (fireTorchMask & (1 << player)) !== 0;',
    );
    expect(screen).toContainSource('fireTorchMask |= 1 << index;');
    expect(screen).toContainSource('fireTorchMask={fireTorchMask}');
  });

  it('passes the encore marker as two numbers, not the rebuilt object', () => {
    const bolt = overlays.slice(
      overlays.indexOf('function WorkletEncoreBolt('),
      overlays.indexOf('function WorkletDecoyRing('),
    );
    expect(bolt).not.toBe('');
    expect(bolt).not.toContainSource('marker.');
    expect(bolt).toContainSource('slot: number;');
    expect(bolt).toContainSource('grantTick: number;');
  });
});
