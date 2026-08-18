import { Group, Path, Skia, type SkPath } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { countdownGlyph } from './incapacity-countdown';
import { foldToDrawable, pixelGlyph, type PixelGlyph } from './pixel-glyphs';
import { snapDevicePixels } from './pixel-grid';
import {
  SHOT_POWER_BAND_COLORS,
  SHOT_POWER_NUMBER_LEAD_MS,
  SHOT_POWER_POP_MS,
  shotPowerCellPx,
  shotPowerPopOpacity,
  shotPowerPopRise,
  shotPowerPopScale,
  type ShotPowerBand,
} from './shot-power-pop';

/**
 * The power number that pops over a shooter's head when his shot is on target,
 * with the word "SHOT!" calling it a beat earlier, to its left.
 *
 * Two texts, not one line: they enter separately and scale about their own
 * middles, so the small word lands first and the big figure snaps in beside it.
 * They share one baseline and one fade, so the pair still reads as one moment.
 *
 * Anchored to a position STAMPED at the strike, never followed live: a goal and
 * a miss both restart the kickoff on the tick they resolve, so a number still
 * reading its shooter's slot would teleport onto the halfway line mid-pop.
 *
 * Drawn as batched Paths in LOCAL coordinates around each text's own origin —
 * bottom centre at (0,0) — so the animated Groups scale about their middles.
 * Baking the world position into the path instead would make it orbit the
 * camera origin, because the match camera composes as `zoom * p + translate`.
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
  /** Already-localised call word, e.g. "SHOT!". */
  word: string;
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
// The word is deliberately the smaller of the two — same cell as the
// substitution nameplate, which is the proven floor for reading 3x5 on grass.
const WORD_CELL_SOURCE_PX = 2;
const PLATE_PADDING_PX = 2;
/** Blank source px between the word's plate and the number's. */
const SIDE_GAP_PX = 3;

/** The plate never takes the band colour — a gold plate under gold digits is
 * an unreadable blob. Only the text carries the grade. */
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

/** One text, bottom centre at its own origin, as a plate and its lit cells. */
function buildLocalPaths(
  glyph: PixelGlyph,
  cell: number,
  pixel: number,
): { plate: SkPath; text: SkPath } {
  const plate = Skia.PathBuilder.Make();
  const text = Skia.PathBuilder.Make();
  if (glyph.pixels.length === 0)
    return { plate: plate.detach(), text: text.detach() };
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
      text,
      left + position.x * cell,
      top + position.y * cell,
      left + (position.x + 1) * cell,
      top + (position.y + 1) * cell,
    );
  }
  return { plate: plate.detach(), text: text.detach() };
}

export function ShotPowerPop({
  subject,
  word,
  life,
  scale,
  playerDrawScale,
  devicePixelRatio,
  reduceMotion,
}: ShotPowerPopProps) {
  const pixel = scale * playerDrawScale;
  const built = useMemo(() => {
    if (subject === null) return null;
    const numberGlyph = countdownGlyph(Math.round(subject.power));
    const numberCell = shotPowerCellPx(subject.power) * pixel;
    const wordGlyph = pixelGlyph(foldToDrawable(word));
    const wordCell = WORD_CELL_SOURCE_PX * pixel;
    // Both texts draw around their own bottom centre, so laying them side by
    // side is a pair of x offsets. The PAIR is centred over the head, not the
    // number alone: a word hanging off one side would drag the whole pop off
    // the shooter, and near a touchline off the pitch.
    const padding = PLATE_PADDING_PX * pixel;
    const wordHalf = (wordGlyph.width * wordCell) / 2 + padding;
    const numberHalf = (numberGlyph.width * numberCell) / 2 + padding;
    const gap = SIDE_GAP_PX * pixel;
    const pairHalf = wordHalf + gap / 2 + numberHalf;
    return {
      number: buildLocalPaths(numberGlyph, numberCell, pixel),
      wordPaths: buildLocalPaths(wordGlyph, wordCell, pixel),
      wordOffsetX: -pairHalf + wordHalf,
      numberOffsetX: pairHalf - numberHalf,
    };
  }, [subject, word, pixel]);
  // Read out here rather than inside the worklets: a null subject returns
  // before the hooks below would ever run, so they must not close over it.
  const anchorX = subject === null ? 0 : subject.x;
  const anchorY = subject === null ? 0 : subject.y;
  const wordOffsetX = built === null ? 0 : built.wordOffsetX;
  const numberOffsetX = built === null ? 0 : built.numberOffsetX;

  // Where the pair sits this frame, before either text's own entrance.
  const baseY = useDerivedValue(() => {
    const rise = reduceMotion ? 0 : shotPowerPopRise(life.value);
    return snapDevicePixels(
      anchorY * scale -
        (SPRITE_HALF_HEIGHT_PX + HEAD_CLEARANCE_PX + rise) * pixel,
      devicePixelRatio,
    );
  });
  const numberTransform = useDerivedValue(() => [
    {
      translateX: snapDevicePixels(
        anchorX * scale + numberOffsetX,
        devicePixelRatio,
      ),
    },
    { translateY: baseY.value },
    {
      scale: reduceMotion
        ? 1
        : shotPowerPopScale(life.value - SHOT_POWER_NUMBER_LEAD_MS),
    },
  ]);
  const wordTransform = useDerivedValue(() => [
    {
      translateX: snapDevicePixels(
        anchorX * scale + wordOffsetX,
        devicePixelRatio,
      ),
    },
    { translateY: baseY.value },
    { scale: reduceMotion ? 1 : shotPowerPopScale(life.value) },
  ]);
  const wordOpacity = useDerivedValue(() => {
    const elapsed = life.value;
    if (elapsed >= SHOT_POWER_POP_MS) return 0;
    return reduceMotion ? 1 : shotPowerPopOpacity(elapsed);
  });
  // Same fade as the word — only the entrance is held back, so the two leave
  // together instead of the number surviving a beat alone.
  const numberOpacity = useDerivedValue(() => {
    const elapsed = life.value;
    if (elapsed >= SHOT_POWER_POP_MS) return 0;
    if (elapsed < SHOT_POWER_NUMBER_LEAD_MS) return 0;
    return reduceMotion ? 1 : shotPowerPopOpacity(elapsed);
  });

  if (subject === null || built === null) return null;
  const color = SHOT_POWER_BAND_COLORS[subject.band];
  return (
    <Group>
      <Group transform={wordTransform} opacity={wordOpacity}>
        <Path
          antiAlias={false}
          color={PLATE_COLOR}
          path={built.wordPaths.plate}
        />
        <Path antiAlias={false} color={color} path={built.wordPaths.text} />
      </Group>
      <Group transform={numberTransform} opacity={numberOpacity}>
        <Path antiAlias={false} color={PLATE_COLOR} path={built.number.plate} />
        <Path antiAlias={false} color={color} path={built.number.text} />
      </Group>
    </Group>
  );
}
