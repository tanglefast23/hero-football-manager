import { useMemo } from 'react';
import {
  Atlas,
  Group,
  Path,
  Skia,
  useRSXformBuffer,
  type SkImage,
  type SkRSXform,
  type SkRect,
} from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { PIXEL_ART_SAMPLING } from './pixel-art-sampling';
import { snapDevicePixels } from './pixel-grid';
import {
  PLATE_PADDING_PX,
  nameGlyph,
  nameplateBox,
  type PixelGlyph,
} from './pixel-glyphs';
import {
  WALKER_SLOTS,
  WALKER_STRIDE,
  WALK_SLOT,
  sampleWalk,
  walkerSpriteKeys,
  type SubstitutionWalk,
} from './substitution-walk';

/**
 * The two bodies of a substitution, drawn over the pitch while the swap the sim
 * already made is walked out in front of the manager.
 *
 * Batched like every other match sprite: ONE extra Atlas draw for up to ten
 * walkers, positioned by a worklet, never a component per body. It renders
 * inside the match canvas's camera Group, so zoom, shake and the pixel grid all
 * come for free, and the walkers' cells are already in the match atlas — a
 * substitute's sprite is built with the bench.
 */

const PLATE_COLOR = '#241f2ee0';
const NAME_COLOR = '#f4f1ea';

export interface SubstitutionWalkersProps {
  /** Every active walk, both directions, newest last. */
  walkers: readonly SubstitutionWalk[];
  /** `packWalks(walkers)`, written on start and end only. */
  packed: SharedValue<Float32Array>;
  /** The Atlas mapper's drawn positions, so an arrival lands on its own sprite. */
  visualPositions: SharedValue<Float32Array>;
  /** The fractional, pause-aware sim clock. */
  visualTick: SharedValue<number>;
  atlasImage: SkImage;
  /** Source rect for one atlas key. */
  rectFor: (key: string) => SkRect;
  /** The run frame every walker is on this tick: 0 or 1. */
  runFrame: 0 | 1;
  playerCell: { width: number; height: number };
  /** Pitch units -> dp. */
  scale: number;
  playerDrawScale: number;
  devicePixelRatio: number;
}

export function SubstitutionWalkers(props: SubstitutionWalkersProps) {
  const {
    walkers,
    packed,
    visualPositions,
    visualTick,
    atlasImage,
    rectFor,
    runFrame,
    playerCell,
    scale,
    playerDrawScale,
    devicePixelRatio,
  } = props;

  const sprites: SkRect[] = useMemo(
    () => walkerSpriteKeys(walkers, runFrame).map(rectFor),
    [rectFor, runFrame, walkers],
  );

  const transforms = useRSXformBuffer(
    WALKER_SLOTS,
    (xf: SkRSXform, index: number) => {
      'worklet';
      const row = packed.value;
      const slot = row[index * WALKER_STRIDE + WALK_SLOT];
      const sample = sampleWalk(
        row,
        index,
        visualTick.value,
        visualPositions.value[slot * 2],
        visualPositions.value[slot * 2 + 1],
      );
      // A parked row draws at scale 0 rather than being removed: the buffer
      // length is fixed, the same way the pitch's own 25 slots are.
      const bodyScale = sample.active ? scale * playerDrawScale : 0;
      xf.set(
        bodyScale,
        0,
        snapDevicePixels(
          sample.x * scale - (bodyScale * playerCell.width) / 2,
          devicePixelRatio,
        ),
        snapDevicePixels(
          sample.y * scale - (bodyScale * playerCell.height) / 2,
          devicePixelRatio,
        ),
      );
    },
  );

  if (walkers.length === 0) return null;
  return (
    <>
      <Atlas
        image={atlasImage}
        sprites={sprites}
        transforms={transforms}
        sampling={PIXEL_ART_SAMPLING}
      />
      {walkers.slice(0, WALKER_SLOTS).map((walker, index) => (
        <WalkerNameplate
          key={walker.id}
          index={index}
          walker={walker}
          packed={packed}
          visualPositions={visualPositions}
          visualTick={visualTick}
          scale={scale}
          playerDrawScale={playerDrawScale}
          devicePixelRatio={devicePixelRatio}
        />
      ))}
    </>
  );
}

/**
 * One last name, floating over one walking head.
 *
 * The two paths are built once, at the origin, and then TRANSLATED every frame.
 * Rebuilding a per-letter path at display rate is the shape of thing that costs
 * a batched renderer its frame budget, and the plate never changes shape.
 */
function WalkerNameplate({
  index,
  walker,
  packed,
  visualPositions,
  visualTick,
  scale,
  playerDrawScale,
  devicePixelRatio,
}: {
  index: number;
  walker: SubstitutionWalk;
  packed: SharedValue<Float32Array>;
  visualPositions: SharedValue<Float32Array>;
  visualTick: SharedValue<number>;
  scale: number;
  playerDrawScale: number;
  devicePixelRatio: number;
}) {
  // `scale` converts pitch units to dp and runs about 0.06. Sizes here are
  // already in screen dp, so only positions may go through it — the trap that
  // once shipped a half-pixel ball flame.
  const pixel = scale * playerDrawScale;
  const paths = useMemo(
    () => buildNameplate(nameGlyph(walker.name), pixel),
    [pixel, walker.name],
  );

  const sample = useDerivedValue(() => {
    const row = packed.value;
    const slot = row[index * WALKER_STRIDE + WALK_SLOT];
    return sampleWalk(
      row,
      index,
      visualTick.value,
      visualPositions.value[slot * 2],
      visualPositions.value[slot * 2 + 1],
    );
  });
  const transform = useDerivedValue(() => [
    { translateX: snapDevicePixels(sample.value.x * scale, devicePixelRatio) },
    { translateY: snapDevicePixels(sample.value.y * scale, devicePixelRatio) },
  ]);
  const opacity = useDerivedValue(() =>
    sample.value.active ? sample.value.nameOpacity : 0,
  );

  if (paths === null) return null;
  return (
    <Group transform={transform} opacity={opacity}>
      <Path antiAlias={false} color={PLATE_COLOR} path={paths.plate} />
      <Path antiAlias={false} color={NAME_COLOR} path={paths.name} />
    </Group>
  );
}

/**
 * Plate and letters as two batched paths, relative to the player's drawn
 * centre. A name with no drawable letters in it returns null and no plate is
 * drawn at all — an empty box over a head is worse than no label.
 */
function buildNameplate(glyph: PixelGlyph, pixel: number) {
  if (glyph.pixels.length === 0) return null;
  const plate = Skia.PathBuilder.Make();
  const name = Skia.PathBuilder.Make();
  const { cell, left, top, right, bottom } = nameplateBox(glyph, pixel);
  const padding = PLATE_PADDING_PX * pixel;
  addRect(
    plate,
    left - padding,
    top - padding,
    right + padding,
    bottom + padding,
  );
  for (const cellPosition of glyph.pixels) {
    addRect(
      name,
      left + cellPosition.x * cell,
      top + cellPosition.y * cell,
      left + (cellPosition.x + 1) * cell,
      top + (cellPosition.y + 1) * cell,
    );
  }
  return { plate: plate.detach(), name: name.detach() };
}

function addRect(
  builder: ReturnType<typeof Skia.PathBuilder.Make>,
  leftEdge: number,
  topEdge: number,
  rightEdge: number,
  bottomEdge: number,
): void {
  builder.moveTo(leftEdge, topEdge);
  builder.lineTo(rightEdge, topEdge);
  builder.lineTo(rightEdge, bottomEdge);
  builder.lineTo(leftEdge, bottomEdge);
  builder.close();
}
