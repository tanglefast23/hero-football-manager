import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The title scene's elapsed-time clock used to be `useState` on
 * `TitlePlayerPopScene`, ticking every 90ms and handed down as a prop, which
 * re-rendered the whole of `PopSlot` eleven times a second — power-label
 * bubble, target sprite, and the WEB_TRAP / FIRE_TORCH overlays, twenty-odd
 * `View`s each — to advance a number only the Skia FX and the hero sprite read.
 * It ran from app open, on the JS thread that react-native-web also runs every
 * `Animated` driver on.
 *
 * These pin the boundary that fixed it, and the layout facts that let the two
 * clock-driven elements move next to each other without disturbing the scene.
 */
describe('title pop scene clock', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/ui/components/TitlePlayerPopScene.tsx'),
    'utf8',
  );

  // Bounded at the stylesheet: `makeStyles` defines `webbedOverlay` and friends,
  // so a slice running to end-of-file would match those names as if they were
  // rendered in the leaf.
  const leaf = source.slice(
    source.indexOf('function PopHeroFx'),
    source.indexOf('const makeStyles'),
  );
  const popSlot = source.slice(
    source.indexOf('function PopSlot'),
    source.indexOf('function PopHeroFx'),
  );

  it('ticks the clock below the static parts of the slot', () => {
    // The interval belongs to the leaf, and only the leaf.
    expect(leaf).toContain('setInterval');
    expect(popSlot).not.toContain('setInterval');
    expect(source.slice(0, source.indexOf('function PopSlot'))).not.toContain('setInterval');

    // No elapsed-time prop threading: that was the mechanism of the old cost.
    expect(source).not.toMatch(/elapsedMs=\{elapsedMs\}/);
    expect(popSlot).not.toContain('elapsedMs');
  });

  it('keeps the expensive static overlays above the boundary', () => {
    // If these ever move into the leaf they start repainting at 11Hz again,
    // which is precisely what the boundary exists to stop.
    expect(popSlot).toContain('webbedOverlay');
    expect(popSlot).toContain('ignitedOverlay');
    expect(popSlot).toContain('powerBubble');
    expect(leaf).not.toContain('webbedOverlay');
    expect(leaf).not.toContain('ignitedOverlay');
    expect(leaf).not.toContain('powerBubble');
  });

  it('draws the moved FX layer by zIndex, not by sibling order', () => {
    // The leaf renders `powerFx` and the hero sprite together, so `powerFx` now
    // sits AFTER the target sprite in the JSX rather than before it. That is
    // only safe because both are positioned with an explicit zIndex — order in
    // the tree does not decide what paints on top. Lose either and the FX layer
    // silently jumps in front of the hero.
    expect(source).toMatch(/powerFx: \{[\s\S]*?position: 'absolute'[\s\S]*?zIndex: -1/);
    expect(source).toMatch(/targetSprite: \{[\s\S]*?position: 'absolute'[\s\S]*?zIndex: -2/);
  });

  it('renders the leaf as a fragment so the scene keeps its layout', () => {
    // `powerFx` is out of flow and the hero sprite is `popSlot`'s only in-flow
    // child, so it is the sprite that gives the slot its size. Wrapping the
    // pair in a View would hand that job to the wrapper and move the scene.
    expect(leaf).toMatch(/return \(\s*<>/);
    expect(leaf).toContain('<TitleMatchSprite spriteKey={hero.spriteKey}');
  });

  it('runs no clock at all under reduced motion', () => {
    expect(leaf).toMatch(/if \(reduceMotion\) return undefined;/);
  });
});
