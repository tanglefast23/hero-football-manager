import { readFileSync } from 'fs';
import { join } from 'path';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

type MatchMedia = (query: string) => { matches: boolean };

/**
 * Loads the module fresh against one browser. It keeps its media query list, so
 * every case needs its own registry to answer for a different device.
 */
function loadForWeb(matchMedia?: MatchMedia): () => boolean {
  jest.resetModules();
  jest.doMock('react-native', () => ({ Platform: { OS: 'web' } }));
  (globalThis as { window?: unknown }).window =
    matchMedia === undefined ? {} : { matchMedia };
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (
    require('../pointer-capability') as typeof import('../pointer-capability')
  ).hasHoverPointer;
}

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
  jest.resetModules();
});

describe('hover capability', () => {
  it('asks the browser whether its pointer can hover, not whether it is a browser', () => {
    const queries: string[] = [];
    const hasHoverPointer = loadForWeb((query) => {
      queries.push(query);
      return { matches: true };
    });

    expect(hasHoverPointer()).toBe(true);
    expect(queries).toEqual(['(hover: hover)']);
  });

  it('reports no hover on a touch-only tablet, where the game runs as a web app', () => {
    // The bug this exists for: an iPad PWA is Platform.OS 'web', answers a tap
    // with a synthetic hover, and never sends the matching leave — so every
    // hover-only tip latched on and stacked up with nothing held down.
    const hasHoverPointer = loadForWeb(() => ({ matches: false }));

    expect(hasHoverPointer()).toBe(false);
  });

  it('re-reads the query so attaching a pointer restores hover without a reload', () => {
    const list = { matches: false };
    const hasHoverPointer = loadForWeb(() => list);

    expect(hasHoverPointer()).toBe(false);
    list.matches = true;
    expect(hasHoverPointer()).toBe(true);
  });

  it('keeps desktop behaviour where nothing can answer the question', () => {
    const hasHoverPointer = loadForWeb();

    expect(hasHoverPointer()).toBe(true);
  });

  it('never claims hover on native, and reads Platform lazily', () => {
    jest.resetModules();
    // No Platform at all: several UI tests mock react-native this way, so a
    // module-scope read would break them at import.
    jest.doMock('react-native', () => ({}));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const bare =
      require('../pointer-capability') as typeof import('../pointer-capability');
    expect(bare.hasHoverPointer()).toBe(false);

    jest.resetModules();
    jest.doMock('react-native', () => ({ Platform: { OS: 'ios' } }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const native =
      require('../pointer-capability') as typeof import('../pointer-capability');
    expect(native.hasHoverPointer()).toBe(false);
  });
});

describe('hover-only surfaces', () => {
  it('gates every hover affordance on that capability', () => {
    const pressable = read('src/ui/components/SfxPressable.tsx');
    const infoTip = read('src/ui/components/InfoTip.tsx');
    const board = read('src/render/SubstitutionBoard.tsx');

    for (const source of [pressable, infoTip, board]) {
      expect(source).toContainSource('hasHoverPointer');
      expect(source).not.toContainSource("Platform?.OS === 'web'");
    }
    expect(pressable).toContainSource('const pointer = hasHoverPointer();');
    expect(infoTip).toContainSource(
      'onPointerEnter={pointer ? () => setShown(true) : undefined}',
    );
    // The hold stays: a touch screen keeps its way into the same sentence.
    expect(infoTip).toContainSource('onLongPress={showForTouch}');
  });

  it('ends the hover when a press ends, so a stray hover cannot outlive a tap', () => {
    const pressable = read('src/ui/components/SfxPressable.tsx');

    // Second line of defence for a touch screen that claims a hovering pointer:
    // the synthetic hover arrives with the touch, and the release clears it.
    expect(pressable).toContainSource(
      'setPressed(false);\n        setHovered(false);',
    );
    expect(pressable).toContainSource(
      'onPointerUp={pointer ? () => setHovered(false) : undefined}',
    );
  });

  it("leaves a caller's own hover work unwired without a pointer", () => {
    const pressable = read('src/ui/components/SfxPressable.tsx');
    const finances = read('src/ui/screens/ClubFinancesScreen.tsx');

    // The facilities grid previews a footprint from hover. On a tablet that
    // preview stuck to the last tapped square.
    expect(finances).toContainSource(
      'onHoverIn={() => setPreviewCell({ x, y })}',
    );
    expect(pressable).toContainSource(
      'onHoverIn={!pointer ? undefined : event => {',
    );
    expect(pressable).toContainSource(
      'onHoverOut={!pointer ? undefined : event => {',
    );
  });
});
