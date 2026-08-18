import { Group, Path, Skia, type SkPath } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { countdownGlyph } from './incapacity-countdown';
import { snapDevicePixels } from './pixel-grid';
import {
  SHOT_POWER_BAND_COLORS,
  SHOT_POWER_POP_MS,
  shotPowerPopOpacity,
  shotPowerPopRise,
  shotPowerPopScale,
  type ShotPowerBand,
} from './shot-power-pop';

/**
 * The power number that pops over a shooter's head when his shot is on target.
 *
 * Anchored to a position STAMPED at the strike, never followed live: a goal and
 * a miss both restart the kickoff on the tick they resolve, so a number still
 * reading its shooter's slot would teleport onto the halfway line mid-pop.
 *
 * Drawn as two batched Paths in LOCAL coordinates around the origin — bottom
 * centre at (0,0) — so the animated Group can scale the number about its own
 * middle. Baking the world position into the path instead would make it orbit
 * the camera origin, because the match camera composes as `zoom * p + translate`.
 */
export interface ShotPowerPopSubject {
  /** Whole display power, as emitted on the shot. */
  power: number;
  band: ShotPowerBand;
  /** Where the shooter stood at the strike, in pitch units. */
  x: number;
  y: number;
}

interface ShotPowerPopProps {
  subject: ShotPowerPopSubject | null;
  /** Milliseconds since the strike. Parked at SHOT_POWER_POP_MS when idle. */
  life: SharedValue<number>;
  /** Pitch units -> dp. */
  scale: number;
  playerDrawScale: number;
  devicePixelRatio: number;
  reduceMotion: boolean;
}

// Matches IncapacityCountdowns: the sprite cell is 24x30 source px, so its top
// edge sits 15 px above the drawn centre, and the number clears the head by 3.
const SPRITE_HALF_HEIGHT_PX = 15;
const HEAD_CLEARANCE_PX = 3;
// Three source px a cell, half again the countdown's two: this number is the
// point of the moment, not a status readout, so it reads bigger.
const CELL_SOURCE_PX = 3;
const PLATE_PADDING_PX = 2;

/** The plate never takes the band colour — a gold plate under gold digits is
 * an unreadable blob. Only the digits carry the grade. */
const PLATE_COLOR = '#241f2ee0';

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
  power: number,
  pixel: number,
): { plate: SkPath; digits: SkPath } {
  const plate = Skia.PathBuilder.Make();
  const digits = Skia.PathBuilder.Make();
  const glyph = countdownGlyph(Math.round(power));
  if (glyph.pixels.length === 0)
    return { plate: plate.detach(), digits: digits.detach() };
  const cell = CELL_SOURCE_PX * pixel;
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

export function ShotPowerPop({
  subject,
  life,
  scale,
  playerDrawScale,
  devicePixelRatio,
  reduceMotion,
}: ShotPowerPopProps) {
  const pixel = scale * playerDrawScale;
  const paths = useMemo(
    () => (subject === null ? null : buildLocalPaths(subject.power, pixel)),
    [subject, pixel],
  );
  // Read out here rather than inside the worklets: a null subject returns
  // before the hooks below would ever run, so they must not close over it.
  const anchorX = subject === null ? 0 : subject.x;
  const anchorY = subject === null ? 0 : subject.y;

  const transform = useDerivedValue(() => {
    const elapsed = life.value;
    const rise = reduceMotion ? 0 : shotPowerPopRise(elapsed);
    return [
      {
        translateX: snapDevicePixels(anchorX * scale, devicePixelRatio),
      },
      {
        translateY: snapDevicePixels(
          anchorY * scale -
            (SPRITE_HALF_HEIGHT_PX + HEAD_CLEARANCE_PX + rise) * pixel,
          devicePixelRatio,
        ),
      },
      { scale: reduceMotion ? 1 : shotPowerPopScale(elapsed) },
    ];
  });
  const opacity = useDerivedValue(() => {
    const elapsed = life.value;
    if (elapsed >= SHOT_POWER_POP_MS) return 0;
    return reduceMotion ? 1 : shotPowerPopOpacity(elapsed);
  });

  if (subject === null || paths === null) return null;
  return (
    <Group transform={transform} opacity={opacity}>
      <Path antiAlias={false} color={PLATE_COLOR} path={paths.plate} />
      <Path
        antiAlias={false}
        color={SHOT_POWER_BAND_COLORS[subject.band]}
        path={paths.digits}
      />
    </Group>
  );
}
