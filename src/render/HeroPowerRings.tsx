import { useMemo } from 'react';
import {
  DashPathEffect,
  Path,
  usePathValue,
  type SkPathBuilder,
} from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { foldToDrawable, pixelGlyph } from './pixel-glyphs';
import { snapDevicePixels } from './pixel-grid';

/**
 * A ring on the grass around every hero whose fire button is live, plus the
 * word POWER under their boots.
 *
 * The dock names a hero and paints their power's colour, but a manager
 * watching twenty-two sprites still has to find the body before the moment
 * passes — and for an attacking power, watch them carry into range. The ring
 * is that answer: same colour as the button, so the pair reads as one control.
 *
 * MANUAL only. `heroPowerRingMasks` filters on SAVE_FOR_TAP, so in AUTO both
 * masks are zero and nothing here draws at all. Goalkeepers are always
 * FIRE_WHEN_READY (m2.7), so a keeper never wears one.
 *
 * Presentation only — nothing here queues an input or touches engine state, so
 * no ENGINE_VERSION bump is involved.
 */

/** Render slots the masks can cover: the 22 players plus the two decoy clones. */
const SLOT_COUNT = 24;

/** Sits outside the sprite's own silhouette without touching the next player. */
const RING_RADIUS_MARGIN = 3;
const RING_STROKE = 2;

/**
 * Dash geometry as a share of the ring radius, so the dash count holds steady
 * from a phone pitch to a punched-in desktop camera. A fixed pixel interval
 * reads as four fat blocks when zoomed in and a solid line when zoomed out.
 */
const DASH_ON_SHARE = 0.34;
const DASH_OFF_SHARE = 0.26;

/**
 * Dash travel per sim tick, in dp. The tick is interpolated between frames, so
 * the march is smooth rather than one hop every 100ms. Negative phase runs the
 * dashes clockwise, the direction the eye reads as "live".
 */
const DASH_MARCH_PER_TICK = 1.6;

/** Gap between the bottom of the ring and the top of the POWER plate. */
const LABEL_GAP = 2;
/** Label pixel size follows the sprite, exactly as the SPEED+ plate does. */
const LABEL_CELL_SOURCE_PX = 1;
const LABEL_PLATE_PADDING_PX = 2;
const LABEL_PLATE_COLOR = '#241f2ee0';
const LABEL_COLOR = '#f4f1ea';

export interface HeroPowerRingHero {
  slot: number;
  /** The power's authored colour — the same one its fire button is painted. */
  color: string;
}

export interface HeroPowerRingsProps {
  heroes: readonly HeroPowerRingHero[];
  /** Button live: marching dashes. One bit per render slot. */
  dashedMask: number;
  /** Press landed, power playing out: an unbroken line. One bit per slot. */
  solidMask: number;
  /** The translated word under the ring. */
  label: string;
  visualPositions: SharedValue<Float32Array>;
  visibility: SharedValue<Float32Array>;
  visualTick: SharedValue<number>;
  /** Pitch units -> dp. */
  scale: number;
  /** Radius the sibling overlays use for a player-sized circle. */
  ringRadius: number;
  playerDrawScale: number;
  devicePixelRatio: number;
  reduceMotion: boolean;
}

/** Both edges snapped, so a fractional span cannot land on a half pixel. */
function addSnappedRect(
  builder: SkPathBuilder,
  rawLeft: number,
  rawTop: number,
  width: number,
  height: number,
  devicePixelRatio: number,
): void {
  'worklet';
  const left = snapDevicePixels(rawLeft, devicePixelRatio);
  const top = snapDevicePixels(rawTop, devicePixelRatio);
  const right = snapDevicePixels(rawLeft + width, devicePixelRatio);
  const bottom = snapDevicePixels(rawTop + height, devicePixelRatio);
  builder.moveTo(left, top);
  builder.lineTo(right, top);
  builder.lineTo(right, bottom);
  builder.lineTo(left, bottom);
  builder.close();
}

export function HeroPowerRings({
  heroes,
  dashedMask,
  solidMask,
  label,
  visualPositions,
  visibility,
  visualTick,
  scale,
  ringRadius,
  playerDrawScale,
  devicePixelRatio,
  reduceMotion,
}: HeroPowerRingsProps) {
  const radius = ringRadius + RING_RADIUS_MARGIN;
  // Stable identity: a fresh array each render would restart the dash effect.
  const intervals = useMemo(
    () => [
      Math.max(2, Math.round(radius * DASH_ON_SHARE)),
      Math.max(2, Math.round(radius * DASH_OFF_SHARE)),
    ],
    [radius],
  );
  const phase = useDerivedValue(() => {
    if (reduceMotion) return 0;
    return -visualTick.value * DASH_MARCH_PER_TICK;
  });

  // Folded first: `pixelGlyph` DROPS any character it has no cell for, so the
  // raw Vietnamese "SỨC MẠNH" would draw as "SC MNH". Same pairing the shot and
  // tackle pops use.
  const glyph = useMemo(() => pixelGlyph(foldToDrawable(label)), [label]);
  const labelledMask = dashedMask | solidMask;
  const pixel = scale * playerDrawScale;
  const cell = LABEL_CELL_SOURCE_PX * pixel;
  const padding = LABEL_PLATE_PADDING_PX * pixel;
  const labelWidth = glyph.width * cell;
  const labelHeight = glyph.height * cell;
  const labelTop = radius + LABEL_GAP;
  // Flattened to x,y pairs: a worklet reading an array of objects would have to
  // cross the bridge boundary per cell, and this rebuilds every frame.
  const cells = useMemo(
    () => glyph.pixels.flatMap((lit) => [lit.x, lit.y]),
    [glyph],
  );

  const plate = usePathValue((builder) => {
    'worklet';
    if (labelledMask === 0) return;
    for (let slot = 0; slot < SLOT_COUNT; slot += 1) {
      if ((labelledMask & (1 << slot)) === 0) continue;
      if (visibility.value[slot] === 0) continue;
      const centerX = visualPositions.value[slot * 2] * scale;
      const top = visualPositions.value[slot * 2 + 1] * scale + labelTop;
      addSnappedRect(
        builder,
        centerX - labelWidth / 2 - padding,
        top - padding,
        labelWidth + padding * 2,
        labelHeight + padding * 2,
        devicePixelRatio,
      );
    }
  });

  const glyphs = usePathValue((builder) => {
    'worklet';
    if (labelledMask === 0) return;
    for (let slot = 0; slot < SLOT_COUNT; slot += 1) {
      if ((labelledMask & (1 << slot)) === 0) continue;
      if (visibility.value[slot] === 0) continue;
      const left = visualPositions.value[slot * 2] * scale - labelWidth / 2;
      const top = visualPositions.value[slot * 2 + 1] * scale + labelTop;
      for (let at = 0; at < cells.length; at += 2) {
        addSnappedRect(
          builder,
          left + cells[at] * cell,
          top + cells[at + 1] * cell,
          cell,
          cell,
          devicePixelRatio,
        );
      }
    }
  });

  return (
    <>
      {heroes.map((hero) => (
        <HeroPowerRing
          key={hero.slot}
          slot={hero.slot}
          color={hero.color}
          dashed={(dashedMask & (1 << hero.slot)) !== 0}
          solid={(solidMask & (1 << hero.slot)) !== 0}
          visualPositions={visualPositions}
          visibility={visibility}
          scale={scale}
          radius={radius}
          intervals={intervals}
          phase={phase}
        />
      ))}
      <Path antiAlias={false} color={LABEL_PLATE_COLOR} path={plate} />
      <Path antiAlias={false} color={LABEL_COLOR} path={glyphs} />
    </>
  );
}

/**
 * One hero's ring. Two Paths rather than one with a swapped effect: a
 * DashPathEffect mounts and unmounts with its parent, and toggling it would
 * rebuild the path node at the exact moment the manager pressed the button.
 * Each Path is empty while its state is not the live one, which costs nothing.
 *
 * Takes `dashed`/`solid` as booleans, not the masks: the worklets then capture
 * a value that changes only when THIS hero changes state, instead of restarting
 * every hero's mapper whenever any hero's button lights up.
 */
function HeroPowerRing({
  slot,
  color,
  dashed,
  solid,
  visualPositions,
  visibility,
  scale,
  radius,
  intervals,
  phase,
}: {
  slot: number;
  color: string;
  dashed: boolean;
  solid: boolean;
  visualPositions: SharedValue<Float32Array>;
  visibility: SharedValue<Float32Array>;
  scale: number;
  radius: number;
  intervals: readonly number[];
  phase: SharedValue<number>;
}) {
  const dashedPath = usePathValue((builder) => {
    'worklet';
    if (!dashed || visibility.value[slot] === 0) return;
    builder.addCircle(
      visualPositions.value[slot * 2] * scale,
      visualPositions.value[slot * 2 + 1] * scale,
      radius,
    );
  });
  const solidPath = usePathValue((builder) => {
    'worklet';
    if (!solid || visibility.value[slot] === 0) return;
    builder.addCircle(
      visualPositions.value[slot * 2] * scale,
      visualPositions.value[slot * 2 + 1] * scale,
      radius,
    );
  });

  return (
    <>
      <Path
        path={dashedPath}
        color={color}
        style="stroke"
        strokeWidth={RING_STROKE}
      >
        <DashPathEffect intervals={intervals as number[]} phase={phase} />
      </Path>
      <Path
        path={solidPath}
        color={color}
        style="stroke"
        strokeWidth={RING_STROKE}
      />
    </>
  );
}
