import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = readFileSync(
  join(process.cwd(), 'src/ui/PlayerGiftCelebration.tsx'),
  'utf8',
);
const squadSource = readFileSync(
  join(process.cwd(), 'src/ui/screens/SquadTrainingScreen.tsx'),
  'utf8',
);
const lazySource = readFileSync(
  join(process.cwd(), 'src/ui/LazyPlayerGiftCelebration.tsx'),
  'utf8',
);

test('the gift flow shows the requested art, values, and live player sprite', () => {
  expect(source).toContain('<GiftIcon />');
  expect(source).toContain("t('playerGift.costResult'");
  expect(source).toContain("t('playerGift.moraleResult'");
  expect(source).toContain('<PlayerRunSprite');
  expect(source).not.toContain('<PixelPortrait');
  expect(source).toContain('playPositiveSfx();');
  expect(squadSource).toContain(
    'LazyPlayerGiftCelebration as PlayerGiftCelebration',
  );
  expect(lazySource).toContain("await import('./SkiaSurfaceImplementations')");
  expect(lazySource).toContain('LoadSkiaWeb');
});

test('rapid taps advance the ref before React renders the next beat', () => {
  expect(source).toContain('beatRef.current += 1;');
  expect(source).toContain('setBeatState(beatRef.current);');
  expect(source.indexOf('beatRef.current += 1;')).toBeLessThan(
    source.indexOf('setBeatState(beatRef.current);'),
  );
  expect(squadSource).toContain('const guardGiftTap = useTapGuard();');
});

test('reduced motion and screen readers get the final static result', () => {
  expect(source).toContain(
    'const waitingForScreenReader = screenReader === null;',
  );
  expect(source).toContain(
    'const staticMode = reduce || screenReader === true;',
  );
  expect(source).toContain('accessibilityViewIsModal');
  expect(source).toContain('AccessibilityInfo.announceForAccessibility');
});

test('the unknown screen-reader state never flashes or dismisses the final beat', () => {
  expect(source).toContain('const beat = staticMode ? LAST_BEAT : beatState;');
  expect(source).toContain(
    'if (staticMode || waitingForScreenReader) return undefined;',
  );
  expect(source).not.toContain(
    'staticMode || waitingForScreenReader ? LAST_BEAT',
  );
});

test('the modal takes accessibility focus while keeping tap-anywhere skipping', () => {
  expect(source).toContain('ref={pressableRef}');
  expect(source).toContain('AccessibilityInfo.setAccessibilityFocus(handle)');
  expect(source).toContain('accessibilityViewIsModal');
});
