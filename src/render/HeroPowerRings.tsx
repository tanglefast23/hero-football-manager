import { useMemo } from 'react';
import {
  Path,
  usePathValue,
  type SkPathBuilder,
} from '@shopify/react-native-skia';
import type { SharedValue } from 'react-native-reanimated';
import { foldToDrawable, pixelGlyph, stackedGlyph } from './pixel-glyphs';
import { snapDevicePixels } from './pixel-grid';
import {
  POSSESSION_RING_DROP_PX,
  POSSESSION_RING_RX_PX,
  POSSESSION_RING_RY_PX,
  POSSESSION_RING_WIDTH,
} from './WorkletMatchOverlays';

const LABEL_GAP_SOURCE_PX = 2;
const LABEL_CELL_SOURCE_PX = 1;
const LABEL_PLATE_PADDING_PX = 2;
const LABEL_PLATE_COLOR = '#241f2ee0';
const LABEL_COLOR = '#f4f1ea';
const ONE_LINE_CHARACTER_LIMIT = 10;
const SAVE_BAR_WIDTH_SOURCE_PX = 20;
const SAVE_BAR_HEIGHT_SOURCE_PX = 2;
const SAVE_BAR_TOP_SOURCE_PX = -16;

export interface HeroPowerRingHero {
  slot: number;
  color: string;
  firstName: string;
  powerName: string;
  saveWindow: boolean;
  incapacitated: boolean;
  saveWindowEndTick: number;
  saveWindowTicks: number;
}

export interface HeroPowerRingsProps {
  heroes: readonly HeroPowerRingHero[];
  dashedMask: number;
  solidMask: number;
  visualPositions: SharedValue<Float32Array>;
  visibility: SharedValue<Float32Array>;
  visualTick: SharedValue<number>;
  scale: number;
  playerDrawScale: number;
  devicePixelRatio: number;
}

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
  visualPositions,
  visibility,
  visualTick,
  scale,
  playerDrawScale,
  devicePixelRatio,
}: HeroPowerRingsProps) {
  const visibleMask = dashedMask | solidMask;
  return (
    <>
      {heroes.map((hero) => (
        <HeroPowerMarker
          key={hero.slot}
          hero={hero}
          visible={(visibleMask & (1 << hero.slot)) !== 0}
          visualPositions={visualPositions}
          visibility={visibility}
          visualTick={visualTick}
          scale={scale}
          playerDrawScale={playerDrawScale}
          devicePixelRatio={devicePixelRatio}
        />
      ))}
    </>
  );
}

function HeroPowerMarker({
  hero,
  visible,
  visualPositions,
  visibility,
  visualTick,
  scale,
  playerDrawScale,
  devicePixelRatio,
}: {
  hero: HeroPowerRingHero;
  visible: boolean;
  visualPositions: SharedValue<Float32Array>;
  visibility: SharedValue<Float32Array>;
  visualTick: SharedValue<number>;
  scale: number;
  playerDrawScale: number;
  devicePixelRatio: number;
}) {
  const pixel = scale * playerDrawScale;
  const rawLabel = `${hero.firstName} (${hero.powerName})`;
  const folded = foldToDrawable(rawLabel);
  const glyph = useMemo(
    () =>
      folded.length <= ONE_LINE_CHARACTER_LIMIT
        ? pixelGlyph(folded)
        : stackedGlyph([
            foldToDrawable(hero.firstName),
            `(${foldToDrawable(hero.powerName)})`,
          ]),
    [folded, hero.firstName, hero.powerName],
  );
  const cell = LABEL_CELL_SOURCE_PX * pixel;
  const padding = LABEL_PLATE_PADDING_PX * pixel;
  const labelWidth = glyph.width * cell;
  const labelHeight = glyph.height * cell;
  const labelTop =
    (POSSESSION_RING_DROP_PX + POSSESSION_RING_RY_PX + LABEL_GAP_SOURCE_PX) *
    pixel;
  const cells = useMemo(
    () => glyph.pixels.flatMap((lit) => [lit.x, lit.y]),
    [glyph],
  );

  const oval = usePathValue((builder) => {
    'worklet';
    if (!visible || visibility.value[hero.slot] === 0) return;
    const rx = POSSESSION_RING_RX_PX * pixel;
    const ry = POSSESSION_RING_RY_PX * pixel;
    const cx = visualPositions.value[hero.slot * 2] * scale;
    const cy =
      visualPositions.value[hero.slot * 2 + 1] * scale +
      POSSESSION_RING_DROP_PX * pixel;
    builder.addOval({ x: cx - rx, y: cy - ry, width: rx * 2, height: ry * 2 });
  });
  const plate = usePathValue((builder) => {
    'worklet';
    if (!visible || visibility.value[hero.slot] === 0) return;
    const centerX = visualPositions.value[hero.slot * 2] * scale;
    const top = visualPositions.value[hero.slot * 2 + 1] * scale + labelTop;
    addSnappedRect(
      builder,
      centerX - labelWidth / 2 - padding,
      top - padding,
      labelWidth + padding * 2,
      labelHeight + padding * 2,
      devicePixelRatio,
    );
  });
  const glyphPath = usePathValue((builder) => {
    'worklet';
    if (!visible || visibility.value[hero.slot] === 0) return;
    const left = visualPositions.value[hero.slot * 2] * scale - labelWidth / 2;
    const top = visualPositions.value[hero.slot * 2 + 1] * scale + labelTop;
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
  });
  const saveTrack = usePathValue((builder) => {
    'worklet';
    if (
      !visible ||
      !hero.saveWindow ||
      hero.incapacitated ||
      visibility.value[hero.slot] === 0
    )
      return;
    const width = SAVE_BAR_WIDTH_SOURCE_PX * pixel;
    addSnappedRect(
      builder,
      visualPositions.value[hero.slot * 2] * scale - width / 2,
      visualPositions.value[hero.slot * 2 + 1] * scale +
        SAVE_BAR_TOP_SOURCE_PX * pixel,
      width,
      SAVE_BAR_HEIGHT_SOURCE_PX * pixel,
      devicePixelRatio,
    );
  });
  const saveFill = usePathValue((builder) => {
    'worklet';
    if (
      !visible ||
      !hero.saveWindow ||
      hero.incapacitated ||
      visibility.value[hero.slot] === 0
    )
      return;
    const fullWidth = SAVE_BAR_WIDTH_SOURCE_PX * pixel;
    const width =
      fullWidth *
      Math.max(
        0,
        Math.min(
          1,
          (hero.saveWindowEndTick - visualTick.value) / hero.saveWindowTicks,
        ),
      );
    addSnappedRect(
      builder,
      visualPositions.value[hero.slot * 2] * scale - fullWidth / 2,
      visualPositions.value[hero.slot * 2 + 1] * scale +
        SAVE_BAR_TOP_SOURCE_PX * pixel,
      width,
      SAVE_BAR_HEIGHT_SOURCE_PX * pixel,
      devicePixelRatio,
    );
  });

  return (
    <>
      <Path
        path={oval}
        color={hero.color}
        style="stroke"
        strokeWidth={POSSESSION_RING_WIDTH}
      />
      <Path antiAlias={false} color={LABEL_PLATE_COLOR} path={plate} />
      <Path antiAlias={false} color={LABEL_COLOR} path={glyphPath} />
      <Path antiAlias={false} color="#241f2e" path={saveTrack} />
      <Path antiAlias={false} color={hero.color} path={saveFill} />
    </>
  );
}
