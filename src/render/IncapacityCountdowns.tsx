import { Path, Skia, type SkPath } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { snapDevicePixels } from './pixel-grid';
import {
  countdownGlyph,
  type IncapacityCountdown,
} from './incapacity-countdown';

/**
 * Seconds-until-back numbers floating over downed, webbed or held players.
 *
 * Drawn as two batched Paths (plate + digits) rather than a node per lit cell:
 * a two-digit number is 26 cells, and four stricken players at once would be a
 * hundred Skia nodes rebuilt every sim tick.
 */
interface IncapacityCountdownsProps {
  countdowns: readonly IncapacityCountdown[];
  /** Drawn position per render slot, in pitch units. */
  positions: readonly { x: number; y: number }[];
  /** Pitch units -> dp. */
  scale: number;
  playerDrawScale: number;
  devicePixelRatio: number;
}

// The player sprite cell is 24x30 source px, so its top edge sits 15 px above
// the drawn centre. The number floats a further 3 px clear of the head.
const SPRITE_HALF_HEIGHT_PX = 15;
const HEAD_CLEARANCE_PX = 3;
// Each digit cell is two source pixels square: a 3x5 digit then stands 10 px
// tall against a 30 px body — legible at a glance, still clearly an overlay.
const CELL_SOURCE_PX = 2;
const PLATE_PADDING_PX = 2;

const PLATE_COLOR = '#241f2ee0';
const DIGIT_COLOR = '#f4f1ea';

function addRect(
  builder: ReturnType<typeof Skia.PathBuilder.Make>,
  left: number,
  top: number,
  right: number,
  bottom: number,
): void {
  builder.moveTo(left, top);
  builder.lineTo(right, top);
  builder.lineTo(right, bottom);
  builder.lineTo(left, bottom);
  builder.close();
}

function buildPaths(props: IncapacityCountdownsProps): {
  plate: SkPath;
  digits: SkPath;
} {
  const plate = Skia.PathBuilder.Make();
  const digits = Skia.PathBuilder.Make();
  const pixel = props.scale * props.playerDrawScale;
  const cell = CELL_SOURCE_PX * pixel;
  const snap = (value: number) =>
    snapDevicePixels(value, props.devicePixelRatio);
  for (const countdown of props.countdowns) {
    const position = props.positions[countdown.slot];
    if (position === undefined) continue;
    const glyph = countdownGlyph(countdown.seconds);
    if (glyph.pixels.length === 0) continue;
    const centerX = position.x * props.scale;
    const bottom =
      position.y * props.scale -
      (SPRITE_HALF_HEIGHT_PX + HEAD_CLEARANCE_PX) * pixel;
    const left = centerX - (glyph.width * cell) / 2;
    const top = bottom - glyph.height * cell;
    const padding = PLATE_PADDING_PX * pixel;
    addRect(
      plate,
      snap(left - padding),
      snap(top - padding),
      snap(left + glyph.width * cell + padding),
      snap(bottom + padding),
    );
    for (const cellPosition of glyph.pixels) {
      addRect(
        digits,
        snap(left + cellPosition.x * cell),
        snap(top + cellPosition.y * cell),
        snap(left + (cellPosition.x + 1) * cell),
        snap(top + (cellPosition.y + 1) * cell),
      );
    }
  }
  return { plate: plate.detach(), digits: digits.detach() };
}

export function IncapacityCountdowns(props: IncapacityCountdownsProps) {
  const paths = useMemo(
    () => buildPaths(props),
    [
      props.countdowns,
      props.devicePixelRatio,
      props.playerDrawScale,
      props.positions,
      props.scale,
    ],
  );
  if (props.countdowns.length === 0) return null;
  return (
    <>
      <Path antiAlias={false} color={PLATE_COLOR} path={paths.plate} />
      <Path antiAlias={false} color={DIGIT_COLOR} path={paths.digits} />
    </>
  );
}
