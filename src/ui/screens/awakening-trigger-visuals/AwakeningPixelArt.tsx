import { Rect } from '@shopify/react-native-skia';

export const AWAKENING_PIXEL_PALETTE = {
  ink: '#241f2e',
  cream: '#f4f1ea',
  white: '#ffffff',
  blueShadow: '#3f6fb5',
  blueBase: '#5a8fd6',
  blueLight: '#a3c8f0',
  redShadow: '#a83440',
  redBase: '#d94f52',
  redLight: '#f2938c',
  goldShadow: '#c8862a',
  goldBase: '#edb54a',
  goldLight: '#f7d894',
  greyShadow: '#6b6675',
  greyBase: '#9a95a4',
  greyLight: '#c9c5d0',
  skinShadow: '#cf9268',
  skinBase: '#eab48c',
  skinLight: '#f7d7ba',
  woodShadow: '#6a4326',
  woodBase: '#8a5a30',
  woodLight: '#a9743d',
  turfShadow: '#3f8a4a',
  turfBase: '#5cb85c',
  turfLight: '#8fd98f',
} as const;

export type AwakeningPixelColor =
  (typeof AWAKENING_PIXEL_PALETTE)[keyof typeof AWAKENING_PIXEL_PALETTE];

export type AwakeningPixelBlock = readonly [
  x: number,
  y: number,
  width: number,
  height: number,
  color: AwakeningPixelColor,
  opacity?: number,
];

interface AwakeningPixelSpriteProps {
  x: number;
  y: number;
  width: number;
  height: number;
  blocks: readonly AwakeningPixelBlock[];
  scale?: 1 | 2 | 3 | 4;
}

/**
 * Renders deliberately low-resolution Track B art from the pixel bible.
 * Every block lands on an integer pixel after integer scaling, so props keep
 * hard edges and never drift into smooth vector illustration.
 */
export function AwakeningPixelSprite({
  x,
  y,
  width,
  height,
  blocks,
  scale = 3,
}: AwakeningPixelSpriteProps) {
  const left = Math.round(x - (width * scale) / 2);
  const top = Math.round(y - (height * scale) / 2);

  return (
    <>
      {blocks.map(
        ([blockX, blockY, blockWidth, blockHeight, color, opacity], index) => (
          <Rect
            key={`${blockX}:${blockY}:${blockWidth}:${blockHeight}:${index}`}
            x={left + blockX * scale}
            y={top + blockY * scale}
            width={blockWidth * scale}
            height={blockHeight * scale}
            color={color}
            opacity={opacity}
            antiAlias={false}
          />
        ),
      )}
    </>
  );
}
