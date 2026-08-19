import {
  Path,
  usePathValue,
  type SkPathBuilder,
} from '@shopify/react-native-skia';
import type { SharedValue } from 'react-native-reanimated';
import {
  LABELLED_SLOT_COUNT,
  ROLE_LABEL_CELLS,
  ROLE_LABEL_CELL_HEIGHT,
  ROLE_LABEL_CELL_WIDTH,
} from './formation-role-labels';
import { snapDevicePixels } from './pixel-grid';

/**
 * DEF/MID/FWD under the controlled team's outfield players for the 3.5s after a
 * formation change.
 *
 * Two batched Paths (plate + glyphs) built on the UI thread from the same
 * interpolated centres the Atlas uses, following WorkletPossessionRing. A node
 * per lit cell would be ~300 nodes; a JS-side rebuild would run on every RAF
 * frame in the React tree. This is the heaviest per-frame path build in the
 * app, which is affordable only because it lasts 35 ticks — do not move it onto
 * the tick path or extend its life without measuring.
 */
interface FormationRoleLabelsProps {
  /** Render slot of engine slot 1. Labels cover firstSlot..firstSlot+9. */
  firstSlot: number;
  /** Ten 2-bit role codes, engine slot 1 in the low bits. */
  packedRoles: number;
  /** False outside the window; the paths then build nothing. */
  visible: boolean;
  /** Interpolated player centres, pitch units, two floats per render slot. */
  visualPositions: SharedValue<Float32Array>;
  /** Per-slot draw flag. A substitute walking on is hidden through this. */
  visibility: SharedValue<Float32Array>;
  /** Pitch units -> dp. */
  scale: number;
  playerDrawScale: number;
  devicePixelRatio: number;
}

// The sprite cell is 24x30 source px, so the body's bottom edge sits 15 px below
// the drawn centre. The carrier's possession ring is centred 13 px down with a
// 4.5 px vertical radius, so its lowest point is 17.5 px down: the plate has to
// clear that, or the most-watched sprite on the pitch wears its label across
// the ring for the whole window.
const LABEL_TOP_PX = 20;
// Two source pixels a cell, matching the incapacity countdown: a 3x5 glyph then
// stands 10 px against a 30 px body.
const CELL_SOURCE_PX = 2;
const PLATE_PADDING_PX = 2;

const PLATE_COLOR = '#241f2ee0';
/** Cream, as the countdown. Not the pass combo's blue, which means "chain". */
const LABEL_COLOR = '#f4f1ea';

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

export function FormationRoleLabels({
  firstSlot,
  packedRoles,
  visible,
  visualPositions,
  visibility,
  scale,
  playerDrawScale,
  devicePixelRatio,
}: FormationRoleLabelsProps) {
  const pixel = scale * playerDrawScale;
  const cell = CELL_SOURCE_PX * pixel;
  const padding = PLATE_PADDING_PX * pixel;
  const labelWidth = ROLE_LABEL_CELL_WIDTH * cell;
  const labelHeight = ROLE_LABEL_CELL_HEIGHT * cell;
  const topOffset = LABEL_TOP_PX * pixel;

  const plate = usePathValue((builder) => {
    'worklet';
    if (!visible) return;
    for (let index = 0; index < LABELLED_SLOT_COUNT; index += 1) {
      const slot = firstSlot + index;
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
    if (!visible) return;
    for (let index = 0; index < LABELLED_SLOT_COUNT; index += 1) {
      const slot = firstSlot + index;
      if (visibility.value[slot] === 0) continue;
      const cells = ROLE_LABEL_CELLS[(packedRoles >> (index * 2)) & 3];
      if (cells === undefined) continue;
      const left = visualPositions.value[slot * 2] * scale - labelWidth / 2;
      const top = visualPositions.value[slot * 2 + 1] * scale + topOffset;
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
      <Path antiAlias={false} color={PLATE_COLOR} path={plate} />
      <Path antiAlias={false} color={LABEL_COLOR} path={glyphs} />
    </>
  );
}
