import { Fragment } from 'react';
import { DashPathEffect, Path, usePathValue } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import {
  WORKLET_ACTION_SLIDE,
  WORKLET_ACTION_STAGGER,
  WORKLET_ACTION_STRIDE,
} from './worklet-atlas-frame';
import { AWAY_DECOY_INDEX, HOME_DECOY_INDEX, RENDER_PLAYER_COUNT } from '../sim/entities';
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
  TACKLE_TRAIL_SAMPLES,
} from './slide-tackle-effects';
import {
  DUEL_SCUFF_COLOR,
  DUEL_SCUFF_OPACITY,
  DUEL_SCUFF_PIXELS,
  DUEL_SCUFF_TICKS,
  duelScuffFleckOffset,
  duelScuffFleckSize,
} from './duel-scuff';
import { snapDevicePixels } from './pixel-grid';

const STATUS_ACTIVE = 2;
const STATUS_IGNITED = 4;
const STATUS_ZONE = 5;

// A reserved Decoy slot is "visible" exactly while its live clone exists, so its
// visibility flag doubles as the "draw the hologram ring" signal.
const DECOY_SLOTS = [HOME_DECOY_INDEX, AWAY_DECOY_INDEX] as const;
// Matches the decoy sprite's own translucent blue tint, distinct from the gold
// "in the Zone" rings so the visual language stays unambiguous.
const DECOY_RING_COLOR = '#a3c8f0';

// Rally Cry hangs a gold lightning bolt over the teammate it just granted an
// encore. It holds bright, then fades over this window (~2s at 100ms/tick).
export const ENCORE_MARKER_TICKS = 20;
const ENCORE_BOLT_COLOR = '#edb54a';

export interface EncoreMarker {
  slot: number;
  grantTick: number;
}

interface WorkletMatchOverlaysProps {
  visualPositions: SharedValue<Float32Array>;
  visibility: SharedValue<Float32Array>;
  statuses: SharedValue<Float32Array>;
  zoneFractions: SharedValue<Float32Array>;
  carrier: SharedValue<number>;
  visualTick: SharedValue<number>;
  controlledTeam: 0 | 1;
  heroPlayers: readonly number[];
  /**
   * Bit `i` set = render slot `i` owns Fire Torch. A bitmask rather than an array
   * because the flame worklet reads it: Reanimated builds that worklet's
   * dependency list out of its captured closure values, so an array rebuilt each
   * render restarted three UI-thread mappers every sim tick.
   */
  fireTorchMask: number;
  encoreMarkers: readonly EncoreMarker[];
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

// Radial speed lines for the speed powers. Sixteen fixed spokes, precomputed at
// module load so the worklet only ever reads them; the whole burst is batched
// into ONE hard-edged Path (antiAlias off) rather than sixteen nodes.
const SPEED_LINE_COUNT = 16;
const SPEED_LINE_SPOKES: readonly { x: number; y: number }[] = Array.from(
  { length: SPEED_LINE_COUNT },
  (_, index) => {
    // The half-step offset keeps every wedge off the exact axes, so none of
    // them can degenerate into a 1px axis-aligned sliver at low zoom.
    const angle = ((index + 0.5) / SPEED_LINE_COUNT) * Math.PI * 2;
    return { x: Math.cos(angle), y: Math.sin(angle) };
  },
);
const SPEED_LINE_COLOR = '#ffffff';

/**
 * Pixel-clustered tackle debris. The body spray follows the player while a
 * ground-locked trail spans the real launch-to-current path. Dust is batched
 * into one hard-edged path at exactly 65% opacity; grass is a second opaque
 * path. No blur/filter nodes.
 *
 * Every rect corner goes through `snapDevicePixels`, the same single rounding
 * rule the camera, the sprite atlas and the duel scuff use. The inputs are all
 * continuous — a `progress` lerp along the travel path, a fractional `drift`/
 * `rise` off the debris age, and a 1.5x blade width that is half a device pixel
 * on a 2.625x screen — so without it these clusters sat on a different sub-pixel
 * phase from the sprites throwing them up, and from themselves frame to frame.
 * Both edges are snapped, not just the near one, so a fractional span cannot put
 * the far edge back on a fraction.
 */
export function WorkletSlideTackleEffects({
  layer,
  visualPositions,
  actionData,
  visualTick,
  scale,
  playerDrawScale,
  devicePixelRatio,
}: {
  layer: 'dust' | 'grass';
  visualPositions: SharedValue<Float32Array>;
  actionData: SharedValue<Float32Array>;
  visualTick: SharedValue<number>;
  scale: number;
  playerDrawScale: number;
  devicePixelRatio: number;
}) {
  const debris = usePathValue((builder) => {
    'worklet';
    const presentationTick = Math.max(0, visualTick.value);
    const pixel = scale * playerDrawScale;
    for (let player = 0; player < RENDER_PLAYER_COUNT; player += 1) {
      const offset = player * WORKLET_ACTION_STRIDE;
      if (actionData.value[offset] !== WORKLET_ACTION_SLIDE) continue;
      const startTick = actionData.value[offset + 1];
      const untilTick = actionData.value[offset + 5];
      const elapsed = presentationTick - startTick;
      const duration = untilTick - startTick;
      if (elapsed < 1.5 || elapsed >= duration - 1) continue;

      const rawX = actionData.value[offset + 3];
      const rawY = actionData.value[offset + 4];
      const magnitude = Math.sqrt(rawX * rawX + rawY * rawY);
      const ux = magnitude > 0 ? rawX / magnitude : 1;
      const uy = magnitude > 0 ? rawY / magnitude : 0;
      const sideX = -uy;
      const sideY = ux;
      const cx = visualPositions.value[player * 2] * scale;
      const cy = visualPositions.value[player * 2 + 1] * scale;
      const originX = actionData.value[offset + 6] * scale;
      const originY = actionData.value[offset + 7] * scale;
      const travelX = cx - originX;
      const travelY = cy - originY;
      const age = Math.max(0, elapsed - 1.5);

      if (layer === 'dust') {
        for (let index = 0; index < TACKLE_TRAIL_SAMPLES.length; index += 1) {
          const sample = TACKLE_TRAIL_SAMPLES[index];
          const size = sample.dustSize * pixel;
          const rawLeft = originX + travelX * sample.progress + sideX * sample.side * pixel - size * 0.5;
          const rawTop = originY + travelY * sample.progress + sideY * sample.side * pixel - size * 0.5;
          const left = snapDevicePixels(rawLeft, devicePixelRatio);
          const top = snapDevicePixels(rawTop, devicePixelRatio);
          const right = snapDevicePixels(rawLeft + size, devicePixelRatio);
          const bottom = snapDevicePixels(rawTop + size, devicePixelRatio);
          builder.moveTo(left, top);
          builder.lineTo(right, top);
          builder.lineTo(right, bottom);
          builder.lineTo(left, bottom);
          builder.close();
        }

        const count = Math.min(TACKLE_DUST_PIXELS.length, Math.max(2, Math.floor(age * 2) + 2));
        for (let index = 0; index < count; index += 1) {
          const puff = TACKLE_DUST_PIXELS[index];
          const drift = Math.min(5, age * 0.8 + index * 0.35);
          const along = puff.along - drift;
          const size = puff.size * pixel;
          const rawLeft = cx + (ux * along + sideX * puff.side) * pixel;
          const rawTop = cy + (uy * along + sideY * puff.side) * pixel - size * 0.5;
          const left = snapDevicePixels(rawLeft, devicePixelRatio);
          const top = snapDevicePixels(rawTop, devicePixelRatio);
          const right = snapDevicePixels(rawLeft + size, devicePixelRatio);
          const bottom = snapDevicePixels(rawTop + size, devicePixelRatio);
          builder.moveTo(left, top);
          builder.lineTo(right, top);
          builder.lineTo(right, bottom);
          builder.lineTo(left, bottom);
          builder.close();
        }
      } else {
        for (let index = 0; index < TACKLE_TRAIL_SAMPLES.length; index += 1) {
          const sample = TACKLE_TRAIL_SAMPLES[index];
          const rawBaseX = originX + travelX * sample.progress + sideX * sample.side * pixel;
          const rawBaseY = originY + travelY * sample.progress + sideY * sample.side * pixel;
          const width = Math.max(1, pixel);
          const height = sample.grassHeight * pixel;
          const baseX = snapDevicePixels(rawBaseX, devicePixelRatio);
          const baseY = snapDevicePixels(rawBaseY, devicePixelRatio);
          const rightX = snapDevicePixels(rawBaseX + width, devicePixelRatio);
          const tipY = snapDevicePixels(rawBaseY - height, devicePixelRatio);
          builder.moveTo(baseX, baseY);
          builder.lineTo(rightX, baseY);
          builder.lineTo(rightX, tipY);
          builder.lineTo(baseX, tipY);
          builder.close();
        }

        const count = Math.min(TACKLE_GRASS_PIXELS.length, Math.max(1, Math.floor(age * 1.5)));
        for (let index = 0; index < count; index += 1) {
          const blade = TACKLE_GRASS_PIXELS[index];
          const rise = Math.min(7, age + index * 0.7);
          const along = blade.along - age * 0.35;
          const rawBaseX = cx + (ux * along + sideX * blade.side) * pixel;
          const rawBaseY = cy + (uy * along + sideY * blade.side) * pixel;
          const width = Math.max(1, pixel * 1.5);
          const height = (blade.height + rise) * pixel;
          const baseX = snapDevicePixels(rawBaseX, devicePixelRatio);
          const baseY = snapDevicePixels(rawBaseY, devicePixelRatio);
          const rightX = snapDevicePixels(rawBaseX + width, devicePixelRatio);
          const tipY = snapDevicePixels(rawBaseY - height, devicePixelRatio);
          builder.moveTo(baseX, baseY);
          builder.lineTo(rightX, baseY);
          builder.lineTo(rightX, tipY);
          builder.lineTo(baseX, tipY);
          builder.close();
        }
      }
    }
  });

  return layer === 'dust'
    ? <Path path={debris} color={TACKLE_DUST_COLOR} opacity={TACKLE_DUST_OPACITY} antiAlias={false} />
    : <Path path={debris} color={TACKLE_GRASS_COLOR} opacity={TACKLE_GRASS_OPACITY} antiAlias={false} />;
}

/**
 * Activation speed lines: a radial burst of tapered wedges off the hero, for the
 * speed powers. `slot` is the firing player's render index, or -1 for idle;
 * `life` runs 0 -> 1 across the burst window and the wedges travel outward,
 * shorten and fade as it climbs.
 *
 * Batched into one Path like WorkletSlideTackleEffects, and hard-edged for the
 * same reason: sixteen anti-aliased vector nodes would neither batch nor match
 * the sprites.
 */
export function WorkletSpeedLines({
  slot,
  life,
  visualPositions,
  scale,
  ringRadius,
}: {
  slot: SharedValue<number>;
  life: SharedValue<number>;
  visualPositions: SharedValue<Float32Array>;
  scale: number;
  ringRadius: number;
}) {
  const lines = usePathValue((builder) => {
    'worklet';
    const player = slot.value;
    if (player < 0 || player >= RENDER_PLAYER_COUNT) return;
    const progress = life.value;
    if (progress <= 0 || progress >= 1) return;
    const cx = visualPositions.value[player * 2] * scale;
    const cy = visualPositions.value[player * 2 + 1] * scale;
    const inner = ringRadius * (0.9 + progress * 3.4);
    const length = ringRadius * (2.4 - progress * 1.7);
    const halfWidth = ringRadius * 0.2 * (1 - progress);
    for (let index = 0; index < SPEED_LINE_SPOKES.length; index += 1) {
      const spoke = SPEED_LINE_SPOKES[index];
      // Perpendicular, so the wedge widens across the spoke as it runs outward.
      const sideX = -spoke.y * halfWidth;
      const sideY = spoke.x * halfWidth;
      const nearX = cx + spoke.x * inner;
      const nearY = cy + spoke.y * inner;
      const farX = cx + spoke.x * (inner + length);
      const farY = cy + spoke.y * (inner + length);
      builder.moveTo(nearX, nearY);
      builder.lineTo(farX + sideX, farY + sideY);
      builder.lineTo(farX - sideX, farY - sideY);
      builder.close();
    }
  });
  const opacity = useDerivedValue(() => {
    if (slot.value < 0) return 0;
    const progress = life.value;
    if (progress <= 0 || progress >= 1) return 0;
    return 0.85 * (1 - progress);
  });

  return <Path path={lines} color={SPEED_LINE_COLOR} opacity={opacity} antiAlias={false} />;
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
    visibility,
    statuses,
    zoneFractions,
    carrier,
    visualTick,
    controlledTeam,
    heroPlayers,
    fireTorchMask,
    encoreMarkers,
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
          visualTick={visualTick}
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
          visualTick={visualTick}
          fireTorchMask={fireTorchMask}
          scale={scale}
          ringRadius={ringRadius}
          reduceMotion={reduceMotion}
        />
      ))}
      <Path path={possession} color="#ffffff" style="stroke" strokeWidth={2} />
      {DECOY_SLOTS.map((slot) => (
        <WorkletDecoyRing
          key={slot}
          slot={slot}
          visualPositions={visualPositions}
          visibility={visibility}
          visualTick={visualTick}
          scale={scale}
          ringRadius={ringRadius}
          reduceMotion={reduceMotion}
        />
      ))}
      {encoreMarkers.map((marker) => (
        <WorkletEncoreBolt
          key={marker.slot}
          slot={marker.slot}
          grantTick={marker.grantTick}
          visualPositions={visualPositions}
          visualTick={visualTick}
          scale={scale}
          ringRadius={ringRadius}
        />
      ))}
    </Fragment>
  );
}

/**
 * Rally Cry's grant signal: a gold lightning bolt over the teammate that just
 * received an encore, held bright then fading across ENCORE_MARKER_TICKS (~2s).
 * The encore itself lives in the engine; this is purely the "you got it" cue.
 *
 * Takes the marker's two fields as primitives rather than the object: the parent
 * rebuilds that object every sim tick, and an object in a worklet's closure
 * restarts its UI-thread mapper each time it changes identity.
 */
function WorkletEncoreBolt({
  slot,
  grantTick,
  visualPositions,
  visualTick,
  scale,
  ringRadius,
}: {
  slot: number;
  grantTick: number;
  visualPositions: SharedValue<Float32Array>;
  visualTick: SharedValue<number>;
  scale: number;
  ringRadius: number;
}) {
  const bolt = usePathValue((builder) => {
    'worklet';
    const cx = visualPositions.value[slot * 2] * scale;
    const cy = visualPositions.value[slot * 2 + 1] * scale;
    const top = cy - ringRadius * 3.6;
    const w = ringRadius * 0.85;
    const seg = ringRadius * 1.05;
    builder.moveTo(cx + w * 0.35, top);
    builder.lineTo(cx - w * 0.55, top + seg);
    builder.lineTo(cx + w * 0.05, top + seg);
    builder.lineTo(cx - w * 0.5, top + seg * 2.1);
  });
  const opacity = useDerivedValue(() => {
    const presentationTick = Math.max(0, visualTick.value);
    const age = presentationTick - grantTick;
    if (age < 0) return 0;
    // Hold bright for the first few ticks, then fade out by the window's end.
    return Math.max(0, Math.min(1, 1 - (age - 6) / (ENCORE_MARKER_TICKS - 6)));
  });

  return (
    <Path
      path={bolt}
      color={ENCORE_BOLT_COLOR}
      style="stroke"
      strokeWidth={3}
      strokeJoin="round"
      strokeCap="round"
      opacity={opacity}
    />
  );
}

/**
 * Marks a live Decoy Double clone with a dashed light-blue hologram ring. The
 * greyed-out decoy body is a real Atlas player; this ring is the only overlay it
 * needs so the player can pick the fake forward out of the run of play.
 */
function WorkletDecoyRing({
  slot,
  visualPositions,
  visibility,
  visualTick,
  scale,
  ringRadius,
  reduceMotion,
}: {
  slot: number;
  visualPositions: SharedValue<Float32Array>;
  visibility: SharedValue<Float32Array>;
  visualTick: SharedValue<number>;
  scale: number;
  ringRadius: number;
  reduceMotion: boolean;
}) {
  const ring = usePathValue((builder) => {
    'worklet';
    if (visibility.value[slot] !== 1) return;
    builder.addCircle(
      visualPositions.value[slot * 2] * scale,
      visualPositions.value[slot * 2 + 1] * scale,
      ringRadius + 2,
    );
  });
  const opacity = useDerivedValue(() => {
    if (visibility.value[slot] !== 1) return 0;
    const presentationTick = Math.max(0, visualTick.value);
    const pulse = reduceMotion || Math.floor(presentationTick) % 20 < 10 ? 0.9 : 0.55;
    return pulse;
  });

  return (
    <Path path={ring} color={DECOY_RING_COLOR} style="stroke" strokeWidth={2} opacity={opacity}>
      <DashPathEffect intervals={[5, 4]} phase={0} />
    </Path>
  );
}

function WorkletZoneIndicator({
  playerIndex,
  visualPositions,
  statuses,
  zoneFractions,
  visualTick,
  controlledTeam,
  scale,
  ringRadius,
  reduceMotion,
}: {
  playerIndex: number;
  visualPositions: SharedValue<Float32Array>;
  statuses: SharedValue<Float32Array>;
  zoneFractions: SharedValue<Float32Array>;
  visualTick: SharedValue<number>;
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
    const presentationTick = Math.max(0, visualTick.value);
    const pulse = reduceMotion || Math.floor(presentationTick) % 20 < 10 ? 1 : 0.55;
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
  visualTick,
  fireTorchMask,
  scale,
  ringRadius,
  reduceMotion,
}: {
  layer: FlameLayer;
  visualPositions: SharedValue<Float32Array>;
  statuses: SharedValue<Float32Array>;
  visualTick: SharedValue<number>;
  fireTorchMask: number;
  scale: number;
  ringRadius: number;
  reduceMotion: boolean;
}) {
  const path = usePathValue((builder) => {
    'worklet';
    const presentationTick = Math.max(0, visualTick.value);
    const width = ringRadius * 1.7;
    const height = ringRadius * 2.6;
    const count = 5;
    // RENDER_PLAYER_COUNT (not 22) so the decoy slots are covered like every
    // sibling worklet: a decoy clone that inherits ignited/active status must
    // draw its flames, not just its status tint.
    for (let player = 0; player < RENDER_PLAYER_COUNT; player += 1) {
      const status = statuses.value[player];
      const fireCaster = (fireTorchMask & (1 << player)) !== 0;
      if (status !== STATUS_IGNITED && !(status === STATUS_ACTIVE && fireCaster)) continue;
      const cx = visualPositions.value[player * 2] * scale;
      const baseY = visualPositions.value[player * 2 + 1] * scale + ringRadius * 0.35;
      for (let tongue = 0; tongue < count; tongue += 1) {
        const bx = cx - width / 2 + (width / (count - 1)) * tongue;
        const flick = reduceMotion ? 0 : 0.5 * (
          Math.sin((presentationTick + player * 2) * 1.1 + tongue * 1.7)
          + Math.sin((presentationTick + player * 2) * 0.7 + tongue * 2.3)
        );
        const flameHeight = height * layer.heightScale * (0.7 + 0.3 * flick);
        const flameWidth = (width / count) * layer.widthScale;
        const tipX = reduceMotion
          ? bx
          : bx + Math.sin((presentationTick + player * 2) * 0.9 + tongue) * flameWidth * 0.5;
        builder.moveTo(bx - flameWidth / 2, baseY);
        builder.quadTo(bx - flameWidth * 0.3, baseY - flameHeight * 0.6, tipX, baseY - flameHeight);
        builder.quadTo(bx + flameWidth * 0.3, baseY - flameHeight * 0.6, bx + flameWidth / 2, baseY);
        builder.close();
      }
    }
  });
  return <Path path={path} color={layer.color} opacity={layer.opacity} />;
}

/**
 * Lost-duel contact mark: a short cream fleck spray where a challenge was
 * beaten. A TACKLE with `won: false, contact: true` fires ~100 times a match and
 * used to be audio-only — the thud played, both sprites carried on, and the beat
 * read as "nothing happened". This is its visual half; the other half is the
 * loser's own recoil (the 'stagger' pose in animation.ts), which is what makes
 * WHO lost legible. The presser standoff keeps duelling sprites only ~90-150
 * pitch units apart, so this is drawn OVER the atlas — under it the mark would
 * disappear beneath two overlapping bodies.
 *
 * Batched exactly like WorkletSlideTackleEffects: geometry precomputed at module
 * load, every concurrent scuff in ONE hard-edged Path (antiAlias off), and no
 * per-fleck opacity, because a shared Path has only one. The spray fades by
 * drifting outward and shrinking instead. Reduce Motion never records a stagger
 * pose, so this draws nothing at all in that mode.
 */
export function WorkletDuelScuff({
  actionData,
  visualTick,
  scale,
  playerDrawScale,
  devicePixelRatio,
}: {
  actionData: SharedValue<Float32Array>;
  visualTick: SharedValue<number>;
  scale: number;
  playerDrawScale: number;
  devicePixelRatio: number;
}) {
  const scuff = usePathValue((builder) => {
    'worklet';
    const presentationTick = Math.max(0, visualTick.value);
    const pixel = scale * playerDrawScale;
    for (let player = 0; player < RENDER_PLAYER_COUNT; player += 1) {
      const offset = player * WORKLET_ACTION_STRIDE;
      if (actionData.value[offset] !== WORKLET_ACTION_STAGGER) continue;
      const age = presentationTick - actionData.value[offset + 1];
      if (age < 0 || age >= DUEL_SCUFF_TICKS) continue;

      // Recoil direction, already a unit vector, plus its perpendicular: the
      // spray leans the way the duel was lost rather than ringing the point.
      const ux = actionData.value[offset + 3];
      const uy = actionData.value[offset + 4];
      const sideX = -uy;
      const sideY = ux;
      // The contact point is a fixed pitch coordinate, so the mark stays put
      // while the loser is shoved off it.
      const cx = snapDevicePixels(actionData.value[offset + 6] * scale, devicePixelRatio);
      const cy = snapDevicePixels(actionData.value[offset + 7] * scale, devicePixelRatio);

      for (let index = 0; index < DUEL_SCUFF_PIXELS.length; index += 1) {
        const fleck = DUEL_SCUFF_PIXELS[index];
        const size = duelScuffFleckSize(fleck.size, age) * pixel;
        const along = duelScuffFleckOffset(fleck.along, age);
        const side = duelScuffFleckOffset(fleck.side, age);
        // Centring on an odd source size halves a whole device-pixel span, so
        // snap the corner back onto the grid. `size` is already a whole number of
        // device pixels (integer source pixels x snapped magnification), which
        // makes the far edge land on it too.
        const left = snapDevicePixels(
          cx + (ux * along + sideX * side) * pixel - size * 0.5,
          devicePixelRatio,
        );
        const top = snapDevicePixels(
          cy + (uy * along + sideY * side) * pixel - size * 0.5,
          devicePixelRatio,
        );
        builder.moveTo(left, top);
        builder.lineTo(left + size, top);
        builder.lineTo(left + size, top + size);
        builder.lineTo(left, top + size);
        builder.close();
      }
    }
  });

  return (
    <Path path={scuff} color={DUEL_SCUFF_COLOR} opacity={DUEL_SCUFF_OPACITY} antiAlias={false} />
  );
}
