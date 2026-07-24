import { View } from 'react-native';
import type { FacilityTypeViewModel } from '../models';

interface FacilitySpriteProps {
  type: FacilityTypeViewModel;
  level?: 1 | 2 | 3;
  size?: number;
  width?: number;
  height?: number;
  showLevel?: boolean;
}

type PixelTone = 'o' | 'd' | 'b' | 'l' | 'a' | 'w';

interface SpriteDefinition {
  pixels: readonly string[];
  palette: Readonly<Record<PixelTone, string>>;
}

const INK = '#241f2e';
const PAPER = '#f4f1ea';

/**
 * Tiny code-authored grounds sprites. The fixed 8x8 source grid keeps every
 * facility crisp at any integer multiple and avoids shipping placeholder
 * initials while the eventual atlas art is still being produced.
 */
const FACILITY_SPRITES: Readonly<Record<FacilityTypeViewModel, SpriteDefinition>> = {
  'training-pitch': sprite([
    'oooooooo',
    'obbbbbbo',
    'obwbbwbo',
    'obwbbwbo',
    'obwwwwbo',
    'obwbbwbo',
    'obbbbbbo',
    'oooooooo',
  ], '#3f8a4a', '#5cb85c', '#8fd98f', '#edb54a'),
  gym: sprite([
    '..oooo..',
    '.obbbbo.',
    'oblaalbo',
    'oboaaobo',
    'oboaaobo',
    'oblaalbo',
    '.obbbbo.',
    '..oooo..',
  ], '#5b3a91', '#9a63d6', '#c9a6ec', '#edb54a'),
  'tech-center': sprite([
    '..oooo..',
    '.ollllo.',
    'obbbbbbo',
    'oblaalbo',
    'oblwwlbo',
    'obbbbbbo',
    '.ooddoo.',
    '..oooo..',
  ], '#3f6fb5', '#5a8fd6', '#a3c8f0', '#9a63d6'),
  'shooting-range': sprite([
    'oooooooo',
    'obbbbbbo',
    'obwoowbo',
    'obwoawbo',
    'obwoowbo',
    'obbbbbbo',
    'obddddbo',
    'oooooooo',
  ], '#a83440', '#d94f52', '#f2938c', '#edb54a'),
  'keeper-court': sprite([
    'oooooooo',
    'obwwwwbo',
    'obwbbwbo',
    'obwbbwbo',
    'oblallbo',
    'obbbbbbo',
    'obddddbo',
    'oooooooo',
  ], '#3f6fb5', '#5a8fd6', '#a3c8f0', '#edb54a'),
  'medical-bay': sprite([
    '..oooo..',
    '.ollllo.',
    'olaaaalo',
    'olawwalo',
    'olwwwwlo',
    'olawwalo',
    '.ollllo.',
    '..oooo..',
  ], '#a83440', '#d94f52', '#f2938c', PAPER),
  dorm: sprite([
    '...oo...',
    '..obbo..',
    '.obbbbo.',
    'obbbbbbo',
    'oblaalbo',
    'oblddlbo',
    'oblddlbo',
    'oooooooo',
  ], '#c8862a', '#edb54a', '#f7d894', '#5a8fd6'),
  'scout-office': sprite([
    '..oooo..',
    '.oddddo.',
    'obbbbbbo',
    'oblaalbo',
    'obowwobo',
    'oblaalbo',
    'obbbbbbo',
    'oooooooo',
  ], '#3a3350', '#6b6675', '#c9c5d0', '#edb54a'),
  'coaching-office': sprite([
    '.oooooo.',
    'obbbbbbo',
    'obllllbo',
    'oblaalbo',
    'oblawlbo',
    'obllllbo',
    'obddddbo',
    'oooooooo',
  ], '#5b3a91', '#9a63d6', '#c9a6ec', '#edb54a'),
  'youth-field': sprite([
    'a......a',
    'o......o',
    'oooooooo',
    'obbbbbbo',
    'obwwwwbo',
    'obbbbbbo',
    'obbbbbbo',
    'oooooooo',
  ], '#3f8a4a', '#5cb85c', '#8fd98f', '#edb54a'),
  'fan-shop': sprite([
    '..oooo..',
    '.obbbbo.',
    'oooooooo',
    'oawawawo',
    'obbbbbbo',
    'oblaalbo',
    'oblddlbo',
    'oooooooo',
  ], '#a83440', '#d94f52', '#f2938c', '#edb54a'),
  'stadium-stand': sprite([
    'oooooooo',
    'ollllllo',
    'obababbo',
    'obllllbo',
    'obababbo',
    'obddddbo',
    'oddddddo',
    'oooooooo',
  ], '#3f6fb5', '#5a8fd6', '#a3c8f0', '#edb54a'),
};

export function FacilitySprite({
  type,
  level = 1,
  size = 32,
  width = size,
  height = size,
  showLevel = true,
}: FacilitySpriteProps) {
  const definition = FACILITY_SPRITES[type];
  const pixelWidth = width / 8;
  const pixelHeight = height / 8;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width, height, position: 'relative' }}
    >
      {definition.pixels.flatMap((row, y) => [...row].map((tone, x) => {
        if (tone === '.') return null;
        return (
          <View
            key={`${x}-${y}`}
            style={{
              position: 'absolute',
              left: x * pixelWidth,
              top: y * pixelHeight,
              width: pixelWidth,
              height: pixelHeight,
              backgroundColor: definition.palette[tone as PixelTone],
            }}
          />
        );
      }))}
      {showLevel ? (
        <View
          style={{
            position: 'absolute',
            right: 0,
            bottom: 0,
            flexDirection: 'row',
            gap: 1,
            padding: 1,
            backgroundColor: INK,
          }}
        >
          {([1, 2, 3] as const).map(pip => (
            <View
              key={pip}
              style={{
                width: Math.max(2, Math.min(pixelWidth, pixelHeight) - 1),
                height: Math.max(2, Math.min(pixelWidth, pixelHeight) - 1),
                backgroundColor: pip <= level ? '#5a8fd6' : '#6b6675',
              }}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function sprite(
  pixels: readonly string[],
  dark: string,
  base: string,
  light: string,
  accent: string,
): SpriteDefinition {
  if (pixels.length !== 8 || pixels.some(row => row.length !== 8)) {
    throw new Error('facility sprites must use an 8x8 source grid');
  }
  return {
    pixels,
    palette: { o: INK, d: dark, b: base, l: light, a: accent, w: PAPER },
  };
}
