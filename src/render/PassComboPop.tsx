import { Group, Path, Skia, type SkPath } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import {
  PASS_COMBO_POP_MS,
  passComboCellPx,
  passComboGlyph,
  passComboOpacity,
  passComboRise,
  passComboScale,
} from './pass-combo';
import { snapDevicePixels } from './pixel-grid';

/**
 * The pass-chain counter over the head of the player who just received the
 * ball. Same drawing contract as ShotPowerPop — two batched Paths in LOCAL
 * coordinates around the origin, so the animated Group scales the number about
 * its own middle instead of orbiting the camera origin.
 *
 * Unlike a shot, a completed pass does not restart play, so this anchor CAN be
 * a live slot read. It still is not: a chain of quick passes replaces the
 * subject every time anyway, and a stamped point keeps the two overlays doing
 * the same thing.
 */
export interface PassComboPopSubject {
  /** Chain length, already at or above PASS_COMBO_FLOOR. */
  count: number;
  /** Where the receiver stood when the pass landed, in pitch units. */
  x: number;
  y: number;
}

interface PassComboPopProps {
  subject: PassComboPopSubject | null;
  /** Milliseconds since the pass landed. Parked at PASS_COMBO_POP_MS when idle. */
  life: SharedValue<number>;
  /** Pitch units -> dp. */
  scale: number;
  playerDrawScale: number;
  devicePixelRatio: number;
  reduceMotion: boolean;
}

// Matches IncapacityCountdowns and ShotPowerPop: the sprite cell is 24x30
// source px, so its top edge sits 15 px above the drawn centre.
const SPRITE_HALF_HEIGHT_PX = 15;
const HEAD_CLEARANCE_PX = 3;
const PLATE_PADDING_PX = 2;

const PLATE_COLOR = '#241f2ee0';
/** Cold on purpose. The shot power number is cream/orange/gold, so a warm
 * counter here would read as the same overlay saying a different thing. */
const COUNT_COLOR = '#9fe8ff';

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

function buildLocalPaths(
  count: number,
  pixel: number,
): { plate: SkPath; digits: SkPath } {
  const plate = Skia.PathBuilder.Make();
  const digits = Skia.PathBuilder.Make();
  const glyph = passComboGlyph(count);
  if (glyph.pixels.length === 0)
    return { plate: plate.detach(), digits: digits.detach() };
  const cell = passComboCellPx(count) * pixel;
  const left = -(glyph.width * cell) / 2;
  const top = -glyph.height * cell;
  const padding = PLATE_PADDING_PX * pixel;
  addRect(
    plate,
    left - padding,
    top - padding,
    left + glyph.width * cell + padding,
    padding,
  );
  for (const position of glyph.pixels) {
    addRect(
      digits,
      left + position.x * cell,
      top + position.y * cell,
      left + (position.x + 1) * cell,
      top + (position.y + 1) * cell,
    );
  }
  return { plate: plate.detach(), digits: digits.detach() };
}

export function PassComboPop({
  subject,
  life,
  scale,
  playerDrawScale,
  devicePixelRatio,
  reduceMotion,
}: PassComboPopProps) {
  const pixel = scale * playerDrawScale;
  const paths = useMemo(
    () => (subject === null ? null : buildLocalPaths(subject.count, pixel)),
    [subject, pixel],
  );
  // Read out here rather than inside the worklets: the hooks below must not
  // close over a prop that the early return can make null.
  const anchorX = subject === null ? 0 : subject.x;
  const anchorY = subject === null ? 0 : subject.y;

  const transform = useDerivedValue(() => {
    const elapsed = life.value;
    const rise = reduceMotion ? 0 : passComboRise(elapsed);
    return [
      { translateX: snapDevicePixels(anchorX * scale, devicePixelRatio) },
      {
        translateY: snapDevicePixels(
          anchorY * scale -
            (SPRITE_HALF_HEIGHT_PX + HEAD_CLEARANCE_PX + rise) * pixel,
          devicePixelRatio,
        ),
      },
      { scale: reduceMotion ? 1 : passComboScale(elapsed) },
    ];
  });
  const opacity = useDerivedValue(() => {
    const elapsed = life.value;
    if (elapsed >= PASS_COMBO_POP_MS) return 0;
    return reduceMotion ? 1 : passComboOpacity(elapsed);
  });

  if (subject === null || paths === null) return null;
  return (
    <Group transform={transform} opacity={opacity}>
      <Path antiAlias={false} color={PLATE_COLOR} path={paths.plate} />
      <Path antiAlias={false} color={COUNT_COLOR} path={paths.digits} />
    </Group>
  );
}
