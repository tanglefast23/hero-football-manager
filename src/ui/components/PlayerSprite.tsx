import { View } from 'react-native';

/**
 * A generic squad member, at badge size.
 *
 * Nobody in particular: the wage row stands for the whole roster, so a real
 * portrait would name one player for a bill every player is on. Big head, kit,
 * no features beyond eyes — the same chibi read as the crowd sprites in
 * `finance-pixel-art.ts`, drawn on the 8x8 grid `FacilitySprite` uses so the
 * two sit level in a statement row.
 *
 * Its own small renderer rather than a shared one: `FacilitySprite` is keyed to
 * `FacilityTypeViewModel` and carries level pips this icon has no use for, and
 * a shared abstraction over two eight-line loops would be the longer file.
 */

const INK = '#241f2e';
const SKIN = '#cf9268';
const KIT = '#5a8fd6';
const NUMBER = '#f4f1ea';
const SHORTS = '#3f6fb5';

const PIXELS: readonly string[] = [
  '.oooooo.',
  'oSSSSSSo',
  'oSoSSoSo',
  'oSSSSSSo',
  '.oSSSSo.',
  'obbwwbbo',
  'obbbbbbo',
  '.oddddo.',
];

const PALETTE: Readonly<Record<string, string>> = {
  o: INK,
  S: SKIN,
  b: KIT,
  w: NUMBER,
  d: SHORTS,
};

export function PlayerSprite({ size = 16 }: { size?: number }) {
  const pixel = size / 8;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, position: 'relative' }}
    >
      {PIXELS.flatMap((row, y) => [...row].map((tone, x) => {
        if (tone === '.') return null;
        return (
          <View
            key={`${x}-${y}`}
            style={{
              position: 'absolute',
              left: x * pixel,
              top: y * pixel,
              width: pixel,
              height: pixel,
              backgroundColor: PALETTE[tone],
            }}
          />
        );
      }))}
    </View>
  );
}
