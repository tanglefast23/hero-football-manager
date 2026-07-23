import { Fragment } from 'react';
import { Path, usePathValue } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { WORKLET_ACTION_SLIDE, WORKLET_ACTION_STRIDE } from './worklet-atlas-frame';
import { RENDER_PLAYER_COUNT } from '../sim/entities';
import {
  BALL_AIRBORNE_THRESHOLD_CM,
  ballShadowOpacity,
  ballShadowRadius,
} from './ball-flight-visuals';
import {
  TACKLE_DUST_COLOR,
  TACKLE_DUST_OPACITY,
  TACKLE_DUST_PIXELS,
  TACKLE_GRASS_COLOR,
  TACKLE_GRASS_OPACITY,
  TACKLE_GRASS_PIXELS,
} from './slide-tackle-effects';

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

/**
 * Pixel-clustered tackle debris. Dust is batched into one hard-edged path at
 * exactly 65% opacity; grass is a second opaque path. No blur/filter nodes.
 */
export function WorkletSlideTackleEffects({
  layer,
  visualPositions,
  actionData,
  simTick,
  progress,
  scale,
  playerDrawScale,
}: {
  layer: 'dust' | 'grass';
  visualPositions: SharedValue<Float32Array>;
  actionData: SharedValue<Float32Array>;
  simTick: SharedValue<number>;
  progress: SharedValue<number>;
  scale: number;
  playerDrawScale: number;
}) {
  const debris = usePathValue((builder) => {
    'worklet';
    const visualTick = Math.max(0, simTick.value - 1 + progress.value);
    const pixel = scale * playerDrawScale;
    for (let player = 0; player < RENDER_PLAYER_COUNT; player += 1) {
      const offset = player * WORKLET_ACTION_STRIDE;
      if (actionData.value[offset] !== WORKLET_ACTION_SLIDE) continue;
      const startTick = actionData.value[offset + 1];
      const untilTick = actionData.value[offset + 5];
      const elapsed = visualTick - startTick;
      const duration = untilTick - startTick;
      if (elapsed < 1.5 || elapsed >= duration - 1.5) continue;

      const rawX = actionData.value[offset + 3];
      const rawY = actionData.value[offset + 4];
      const magnitude = Math.sqrt(rawX * rawX + rawY * rawY);
      const ux = magnitude > 0 ? rawX / magnitude : 1;
      const uy = magnitude > 0 ? rawY / magnitude : 0;
      const sideX = -uy;
      const sideY = ux;
      const cx = visualPositions.value[player * 2] * scale;
      const cy = visualPositions.value[player * 2 + 1] * scale;
      const age = Math.max(0, elapsed - 1.5);

      if (layer === 'dust') {
        const count = Math.min(TACKLE_DUST_PIXELS.length, Math.max(2, Math.floor(age * 2) + 2));
        for (let index = 0; index < count; index += 1) {
          const puff = TACKLE_DUST_PIXELS[index];
          const drift = Math.min(5, age * 0.8 + index * 0.35);
          const along = puff.along - drift;
          const left = cx + (ux * along + sideX * puff.side) * pixel;
          const top = cy + (uy * along + sideY * puff.side) * pixel - puff.size * pixel * 0.5;
          const size = puff.size * pixel;
          builder.moveTo(left, top);
          builder.lineTo(left + size, top);
          builder.lineTo(left + size, top + size);
          builder.lineTo(left, top + size);
          builder.close();
        }
      } else {
        const count = Math.min(TACKLE_GRASS_PIXELS.length, Math.max(1, Math.floor(age * 1.5)));
        for (let index = 0; index < count; index += 1) {
          const blade = TACKLE_GRASS_PIXELS[index];
          const rise = Math.min(7, age + index * 0.7);
          const along = blade.along - age * 0.35;
          const baseX = cx + (ux * along + sideX * blade.side) * pixel;
          const baseY = cy + (uy * along + sideY * blade.side) * pixel;
          const width = Math.max(1, pixel * 1.5);
          const height = (blade.height + rise) * pixel;
          builder.moveTo(baseX, baseY);
          builder.lineTo(baseX + width, baseY);
          builder.lineTo(baseX + width, baseY - height);
          builder.lineTo(baseX, baseY - height);
          builder.close();
        }
      }
    }
  });

  return layer === 'dust'
    ? <Path path={debris} color={TACKLE_DUST_COLOR} opacity={TACKLE_DUST_OPACITY} antiAlias={false} />
    : <Path path={debris} color={TACKLE_GRASS_COLOR} opacity={TACKLE_GRASS_OPACITY} antiAlias={false} />;
}

/** Ground-locked cue that makes the ball sprite's vertical offset read as height. */
export function WorkletBallShadow({
  ballGroundPosition,
  ballHeight,
  scale,
}: {
  ballGroundPosition: SharedValue<Float32Array>;
  ballHeight: SharedValue<number>;
  scale: number;
}) {
  const shadow = usePathValue((builder) => {
    'worklet';
    if (ballHeight.value < BALL_AIRBORNE_THRESHOLD_CM) return;
    const radius = ballShadowRadius(ballHeight.value);
    const cx = ballGroundPosition.value[0] * scale;
    const cy = ballGroundPosition.value[1] * scale;
    builder.addOval({
      x: cx - radius,
      y: cy - radius * 0.42,
      width: radius * 2,
      height: radius * 0.84,
    });
  });
  const opacity = useDerivedValue(() => ballShadowOpacity(ballHeight.value));

  return <Path path={shadow} color="#17371d" opacity={opacity} />;
}

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
