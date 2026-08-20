import {
  Path,
  usePathValue,
  type SkPathBuilder,
} from '@shopify/react-native-skia';
import type { SharedValue } from 'react-native-reanimated';
import {
  SPEED_BOOST_CELLS,
  SPEED_BOOST_CELL_HEIGHT,
  SPEED_BOOST_CELL_WIDTH,
} from './speed-boost-labels';
import { snapDevicePixels } from './pixel-grid';

/**
 * SPEED+ under every player a long pass chain has made faster, for as long as
 * their bonus lasts.
 *
 * Two batched Paths (plate + glyphs) built on the UI thread from the same
 * interpolated centres the Atlas uses, exactly as FormationRoleLabels does. The
 * mask is a number so the mapper restarts when the cast changes rather than
 * every sim tick, and both paths build nothing while it is zero — which is most
 * of a match.
 */
interface SpeedBoostLabelsProps {
  /** Render slots wearing the plate, one bit per slot. 0 draws nothing. */
  mask: number;
  /** Interpolated player centres, pitch units, two floats per render slot. */
  visualPositions: SharedValue<Float32Array>;
  /** Per-slot draw flag. A substitute walking on is hidden through this. */
  visibility: SharedValue<Float32Array>;
  /** Pitch units -> dp. */
  scale: number;
  playerDrawScale: number;
  devicePixelRatio: number;
}

/** Render slots the mask can cover: the 22 players plus the two decoy clones. */
const SLOT_COUNT = 24;
// Below the feet, clearing the carrier's possession ring — the same 20px the
// formation role plate uses, so the two never sit at different heights.
const LABEL_TOP_PX = 20;
// One source pixel a cell, not the role plate's two: SPEED+ is six characters
// against their three, and at two it would stand twice as wide as the body it
// belongs to and collide with the next player in the chain.
const CELL_SOURCE_PX = 1;
const PLATE_PADDING_PX = 2;

const PLATE_COLOR = '#241f2ee0';
/** The pass combo's blue, because this is the same chain the ×N pop counts. */
const LABEL_COLOR = '#9fe8ff';

/** Both edges snapped, so a fractional span cannot put the far edge on a fraction. */
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

export function SpeedBoostLabels({
  mask,
  visualPositions,
  visibility,
  scale,
  playerDrawScale,
  devicePixelRatio,
}: SpeedBoostLabelsProps) {
  const pixel = scale * playerDrawScale;
  const cell = CELL_SOURCE_PX * pixel;
  const padding = PLATE_PADDING_PX * pixel;
  const labelWidth = SPEED_BOOST_CELL_WIDTH * cell;
  const labelHeight = SPEED_BOOST_CELL_HEIGHT * cell;
  const topOffset = LABEL_TOP_PX * pixel;

  const plate = usePathValue((builder) => {
    'worklet';
    if (mask === 0) return;
    for (let slot = 0; slot < SLOT_COUNT; slot += 1) {
      if ((mask & (1 << slot)) === 0) continue;
      if (visibility.value[slot] === 0) continue;
      const centerX = visualPositions.value[slot * 2] * scale;
      const top = visualPositions.value[slot * 2 + 1] * scale + topOffset;
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
    if (mask === 0) return;
    for (let slot = 0; slot < SLOT_COUNT; slot += 1) {
      if ((mask & (1 << slot)) === 0) continue;
      if (visibility.value[slot] === 0) continue;
      const left = visualPositions.value[slot * 2] * scale - labelWidth / 2;
      const top = visualPositions.value[slot * 2 + 1] * scale + topOffset;
      for (let at = 0; at < SPEED_BOOST_CELLS.length; at += 2) {
        addSnappedRect(
          builder,
          left + SPEED_BOOST_CELLS[at] * cell,
          top + SPEED_BOOST_CELLS[at + 1] * cell,
          cell,
          cell,
          devicePixelRatio,
        );
      }
    }
  });

  return (
    <>
      <Path antiAlias={false} color={PLATE_COLOR} path={plate} />
      <Path antiAlias={false} color={LABEL_COLOR} path={glyphs} />
    </>
  );
}
