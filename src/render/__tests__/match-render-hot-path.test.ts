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
const overlays = readFileSync(join(renderDir, 'WorkletMatchOverlays.tsx'), 'utf8');

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
    expect(colorTable).not.toContain('Skia.Color(');
    expect(colorTable.match(/skColor\(/g)!.length).toBeGreaterThanOrEqual(14);
    expect(screen).toContain('const SK_COLOR_CACHE = new Map<string, SkColor>();');
    // Bounded, so a colour built from a continuous value can never grow it.
    expect(screen).toContain('SK_COLOR_CACHE.size < SK_COLOR_CACHE_LIMIT');
  });

  it('resolves all 25 sprite rects through the per-atlas rect cache', () => {
    const spriteTable = screen.slice(
      screen.indexOf('const sprites: SkRect[] = useMemo('),
      screen.indexOf('const colors: SkColor[] = useMemo('),
    );
    expect(spriteTable).not.toBe('');
    expect(spriteTable).not.toContain('Skia.XYWHRect(');
    expect(spriteTable).not.toContain('atlas.rectFor(');
    expect(spriteTable).toContain('spriteRects');
    // Keyed by atlas, because rectFor's layout comes from the sheet it was
    // built from — a colour-safe toggle must not serve stale rects.
    expect(screen).toContain('const spriteRects = useMemo(');
    expect(screen).toMatch(/const spriteRects = useMemo\([\s\S]*?\}, \[atlas\]\);/);
  });

  it('keeps the three source cells stable for the life of an atlas', () => {
    // They are handed to the UI-thread worklets; fresh literals per render put
    // them in the worklet closure and churn its dependency list.
    expect(screen).toMatch(/const \{ playerCell, actionCell, ballCell \} = useMemo\(/);
    expect(screen).not.toContain('playerCell: { width: playerCell.w');
  });
});

describe('the canvas is sized by layout, not by the match clock', () => {
  it('hands the Skia host view a memoised style object', () => {
    expect(screen).not.toMatch(/<Canvas style=\{\{/);
    expect(screen).toContain('<Canvas style={canvasStyle}>');
    expect(screen).toMatch(/const canvasStyle = useMemo\(.*\[pitchWidth, pitchH\]\)/s);
    expect(screen).toMatch(/const pitchFrameStyle = useMemo\(/);
  });
});

describe('overlay worklets close over stable values', () => {
  it('reads the Fire Torch cast as a bitmask, never a fresh array', () => {
    // Reanimated derives a worklet's mapper dependencies from its captured
    // closure values (useDerivedValue: `inputs = Object.values(updater.__closure)`).
    // A new array identity each tick therefore stopped and restarted one
    // UI-thread mapper per flame layer, every tick, for an unchanged cast.
    expect(overlays).not.toContain('fireTorchPlayers');
    expect(overlays).toContain('const fireCaster = (fireTorchMask & (1 << player)) !== 0;');
    expect(screen).toContain('fireTorchMask |= 1 << index;');
    expect(screen).toContain('fireTorchMask={fireTorchMask}');
  });

  it('passes the encore marker as two numbers, not the rebuilt object', () => {
    const bolt = overlays.slice(
      overlays.indexOf('function WorkletEncoreBolt('),
      overlays.indexOf('function WorkletDecoyRing('),
    );
    expect(bolt).not.toBe('');
    expect(bolt).not.toContain('marker.');
    expect(bolt).toContain('slot: number;');
    expect(bolt).toContain('grantTick: number;');
  });
});
