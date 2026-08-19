import { Group, Path, Skia, type SkPath } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import {
  PASS_COMBO_POP_MS,
  passComboOpacity,
  passComboRise,
  passComboScale,
} from './pass-combo';
import {
  CELL_SOURCE_PX,
  HEAD_CLEARANCE_PX,
  MAX_NAME_CHARACTERS,
  PLATE_PADDING_PX,
  SPRITE_HALF_HEIGHT_PX,
  foldToDrawable,
  lastName,
  stackedGlyph,
} from './pixel-glyphs';
import { snapDevicePixels } from './pixel-grid';

/**
 * The two-line card that pops under the boots of whoever just won the ball:
 * the tackler's last name over the word "Tackle!".
 *
 * Deliberately the pass counter's twin — same batched two-Path drawing, same
 * local coordinates around the origin, same 620ms curves — with three things
 * flipped so the two never read as the same overlay: it sits BELOW the player
 * instead of above, it is pastel red instead of cold blue, and it drifts down
 * rather than up. Reusing the curves is what keeps the pitch feeling like one
 * presentation rather than a pile of separate effects.
 */
export interface TacklePopSubject {
  /** The tackler's full name; only its last word is drawn. */
  name: string;
  /** The already-localised word under the name, e.g. "TACKLE!". */
  word: string;
  /** Where the tackler stood when he won it, in pitch units. */
  x: number;
  y: number;
}

interface TacklePopProps {
  subject: TacklePopSubject | null;
  /** Milliseconds since the tackle. Parked at TACKLE_POP_MS when idle. */
  life: SharedValue<number>;
  /** Pitch units -> dp. */
  scale: number;
  playerDrawScale: number;
  devicePixelRatio: number;
  reduceMotion: boolean;
}

/** Same life as the pass counter, and the same curves drive it. */
export const TACKLE_POP_MS = PASS_COMBO_POP_MS;

const PLATE_COLOR = '#241f2ee0';
/** Pastel red. Warm and soft, so it cannot be mistaken for the shot number's
 * hot orange above nor the pass counter's cold blue. */
const WORD_COLOR = '#ffaeae';

/** The sprite is 24x30 source px, so its feet are 15 below the drawn centre. */
const FOOT_CLEARANCE_PX = SPRITE_HALF_HEIGHT_PX + HEAD_CLEARANCE_PX;

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
  subject: TacklePopSubject,
  pixel: number,
): { plate: SkPath; text: SkPath } {
  const plate = Skia.PathBuilder.Make();
  const text = Skia.PathBuilder.Make();
  const glyph = stackedGlyph([
    lastName(subject.name).slice(0, MAX_NAME_CHARACTERS),
    foldToDrawable(subject.word),
  ]);
  if (glyph.pixels.length === 0)
    return { plate: plate.detach(), text: text.detach() };
  const cell = CELL_SOURCE_PX * pixel;
  const left = -(glyph.width * cell) / 2;
  const padding = PLATE_PADDING_PX * pixel;
  addRect(
    plate,
    left - padding,
    -padding,
    left + glyph.width * cell + padding,
    glyph.height * cell + padding,
  );
  for (const position of glyph.pixels) {
    addRect(
      text,
      left + position.x * cell,
      position.y * cell,
      left + (position.x + 1) * cell,
      (position.y + 1) * cell,
    );
  }
  return { plate: plate.detach(), text: text.detach() };
}

export function TacklePop({
  subject,
  life,
  scale,
  playerDrawScale,
  devicePixelRatio,
  reduceMotion,
}: TacklePopProps) {
  const pixel = scale * playerDrawScale;
  const paths = useMemo(
    () => (subject === null ? null : buildLocalPaths(subject, pixel)),
    [subject, pixel],
  );
  // Read out here rather than inside the worklets: the hooks below must not
  // close over a prop that the early return can make null.
  const anchorX = subject === null ? 0 : subject.x;
  const anchorY = subject === null ? 0 : subject.y;

  const transform = useDerivedValue(() => {
    const elapsed = life.value;
    // Down, not up: the card hangs below the boots, so the pass counter's rise
    // would walk it back into the player it belongs to.
    const drift = reduceMotion ? 0 : passComboRise(elapsed);
    return [
      { translateX: snapDevicePixels(anchorX * scale, devicePixelRatio) },
      {
        translateY: snapDevicePixels(
          anchorY * scale + (FOOT_CLEARANCE_PX + drift) * pixel,
          devicePixelRatio,
        ),
      },
      { scale: reduceMotion ? 1 : passComboScale(elapsed) },
    ];
  });
  const opacity = useDerivedValue(() => {
    const elapsed = life.value;
    if (elapsed >= TACKLE_POP_MS) return 0;
    return reduceMotion ? 1 : passComboOpacity(elapsed);
  });

  if (subject === null || paths === null) return null;
  return (
    <Group transform={transform} opacity={opacity}>
      <Path antiAlias={false} color={PLATE_COLOR} path={paths.plate} />
      <Path antiAlias={false} color={WORD_COLOR} path={paths.text} />
    </Group>
  );
}
