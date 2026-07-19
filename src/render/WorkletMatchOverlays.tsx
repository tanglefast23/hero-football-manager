import { Fragment } from 'react';
import { Path, usePathValue } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

const STATUS_ACTIVE = 2;
const STATUS_IGNITED = 4;
const STATUS_ZONE = 5;

interface WorkletMatchOverlaysProps {
  visualPositions: SharedValue<Float32Array>;
  statuses: SharedValue<Float32Array>;
  zoneFractions: SharedValue<Float32Array>;
  carrier: SharedValue<number>;
  simTick: SharedValue<number>;
  progress: SharedValue<number>;
  controlledTeam: 0 | 1;
  heroPlayers: readonly number[];
  fireTorchPlayers: readonly number[];
  scale: number;
  ringRadius: number;
  markerYOffset: number;
  markerHalfWidth: number;
  markerHeight: number;
  reduceMotion: boolean;
}

interface FlameLayer {
  color: string;
  heightScale: number;
  widthScale: number;
  opacity: number;
}

const FLAME_LAYERS: readonly FlameLayer[] = [
  { color: '#c0261e', heightScale: 1, widthScale: 1, opacity: 0.9 },
  { color: '#ff6a00', heightScale: 0.72, widthScale: 0.78, opacity: 0.95 },
  { color: '#ffc23a', heightScale: 0.45, widthScale: 0.55, opacity: 0.9 },
];

/** Gameplay overlays share the Atlas worklet's interpolated player centers. */
export function WorkletMatchOverlays(props: WorkletMatchOverlaysProps) {
  const {
    visualPositions,
    statuses,
    zoneFractions,
    carrier,
    simTick,
    progress,
    controlledTeam,
    heroPlayers,
    fireTorchPlayers,
    scale,
    ringRadius,
    markerYOffset,
    markerHalfWidth,
    markerHeight,
    reduceMotion,
  } = props;

  const possession = usePathValue((builder) => {
    'worklet';
    const index = carrier.value;
    if (index < 0) return;
    builder.addCircle(
      visualPositions.value[index * 2] * scale,
      visualPositions.value[index * 2 + 1] * scale,
      ringRadius + 2,
    );
  });

  return (
    <Fragment>
      {heroPlayers.map((playerIndex) => (
        <WorkletZoneIndicator
          key={playerIndex}
          playerIndex={playerIndex}
          visualPositions={visualPositions}
          statuses={statuses}
          zoneFractions={zoneFractions}
          simTick={simTick}
          progress={progress}
          controlledTeam={controlledTeam}
          scale={scale}
          ringRadius={ringRadius}
          markerYOffset={markerYOffset}
          markerHalfWidth={markerHalfWidth}
          markerHeight={markerHeight}
          reduceMotion={reduceMotion}
        />
      ))}
      {FLAME_LAYERS.map((layer) => (
        <WorkletFlameLayer
          key={layer.color}
          layer={layer}
          visualPositions={visualPositions}
          statuses={statuses}
          simTick={simTick}
          progress={progress}
          fireTorchPlayers={fireTorchPlayers}
          scale={scale}
          ringRadius={ringRadius}
          reduceMotion={reduceMotion}
        />
      ))}
      <Path path={possession} color="#ffffff" style="stroke" strokeWidth={2} />
    </Fragment>
  );
}

function WorkletZoneIndicator({
  playerIndex,
  visualPositions,
  statuses,
  zoneFractions,
  simTick,
  progress,
  controlledTeam,
  scale,
  ringRadius,
  markerYOffset,
  markerHalfWidth,
  markerHeight,
  reduceMotion,
}: {
  playerIndex: number;
  visualPositions: SharedValue<Float32Array>;
  statuses: SharedValue<Float32Array>;
  zoneFractions: SharedValue<Float32Array>;
  simTick: SharedValue<number>;
  progress: SharedValue<number>;
  controlledTeam: 0 | 1;
  scale: number;
  ringRadius: number;
  markerYOffset: number;
  markerHalfWidth: number;
  markerHeight: number;
  reduceMotion: boolean;
}) {
  const playerTeam = playerIndex < 11 ? 0 : 1;
  const isControlled = playerTeam === controlledTeam;
  const ring = usePathValue((builder) => {
    'worklet';
    if (statuses.value[playerIndex] !== STATUS_ZONE) return;
    builder.addCircle(
      visualPositions.value[playerIndex * 2] * scale,
      visualPositions.value[playerIndex * 2 + 1] * scale,
      ringRadius,
    );
  });
  const marker = usePathValue((builder) => {
    'worklet';
    if (!isControlled || statuses.value[playerIndex] !== STATUS_ZONE) return;
    const start = controlledTeam === 0 ? 0 : 11;
    for (let index = start; index < start + 11; index += 1) {
      const status = statuses.value[index];
      if (status === 1 || status === STATUS_ACTIVE) return;
    }
    const cx = visualPositions.value[playerIndex * 2] * scale;
    const baseY = visualPositions.value[playerIndex * 2 + 1] * scale - markerYOffset;
    builder.moveTo(cx - markerHalfWidth, baseY);
    builder.lineTo(cx + markerHalfWidth, baseY);
    builder.lineTo(cx, baseY - markerHeight);
    builder.close();
  });
  const opacity = useDerivedValue(() => {
    if (statuses.value[playerIndex] !== STATUS_ZONE) return 0;
    const visualTick = Math.max(0, simTick.value - 1 + progress.value);
    const pulse = reduceMotion || Math.floor(visualTick) % 20 < 10 ? 1 : 0.55;
    return zoneFractions.value[playerIndex] * pulse;
  });

  return (
    <Fragment>
      <Path
        path={ring}
        color={isControlled ? '#edb54a' : '#d94f52'}
        style="stroke"
        strokeWidth={2}
        opacity={opacity}
      />
      {isControlled ? <Path path={marker} color="#edb54a" /> : null}
    </Fragment>
  );
}

function WorkletFlameLayer({
  layer,
  visualPositions,
  statuses,
  simTick,
  progress,
  fireTorchPlayers,
  scale,
  ringRadius,
  reduceMotion,
}: {
  layer: FlameLayer;
  visualPositions: SharedValue<Float32Array>;
  statuses: SharedValue<Float32Array>;
  simTick: SharedValue<number>;
  progress: SharedValue<number>;
  fireTorchPlayers: readonly number[];
  scale: number;
  ringRadius: number;
  reduceMotion: boolean;
}) {
  const path = usePathValue((builder) => {
    'worklet';
    const visualTick = Math.max(0, simTick.value - 1 + progress.value);
    const width = ringRadius * 1.7;
    const height = ringRadius * 2.6;
    const count = 5;
    for (let player = 0; player < 22; player += 1) {
      const status = statuses.value[player];
      const fireCaster = fireTorchPlayers.includes(player);
      if (status !== STATUS_IGNITED && !(status === STATUS_ACTIVE && fireCaster)) continue;
      const cx = visualPositions.value[player * 2] * scale;
      const baseY = visualPositions.value[player * 2 + 1] * scale + ringRadius * 0.35;
      for (let tongue = 0; tongue < count; tongue += 1) {
        const bx = cx - width / 2 + (width / (count - 1)) * tongue;
        const flick = reduceMotion ? 0 : 0.5 * (
          Math.sin((visualTick + player * 2) * 1.1 + tongue * 1.7)
          + Math.sin((visualTick + player * 2) * 0.7 + tongue * 2.3)
        );
        const flameHeight = height * layer.heightScale * (0.7 + 0.3 * flick);
        const flameWidth = (width / count) * layer.widthScale;
        const tipX = reduceMotion
          ? bx
          : bx + Math.sin((visualTick + player * 2) * 0.9 + tongue) * flameWidth * 0.5;
        builder.moveTo(bx - flameWidth / 2, baseY);
        builder.quadTo(bx - flameWidth * 0.3, baseY - flameHeight * 0.6, tipX, baseY - flameHeight);
        builder.quadTo(bx + flameWidth * 0.3, baseY - flameHeight * 0.6, bx + flameWidth / 2, baseY);
        builder.close();
      }
    }
  });
  return <Path path={path} color={layer.color} opacity={layer.opacity} />;
}
