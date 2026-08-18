import { Path, Skia, type SkPath } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { snapDevicePixels } from './pixel-grid';
import {
  MATCH_VFX_PHASE_COUNT,
  activeMatchVfxEmitters,
  matchVfxAgeMs,
  matchVfxFadeOpacity,
  sampleMatchVfxGeometry,
  type MatchVfxColorRole,
  type PreparedMatchVfxEmitter,
} from './match-vfx';

/**
 * Five colours × four age steps. Fixed: a burst fades as it ages, and a path
 * carries one colour at one opacity, so each colour needs a path per step. The
 * count does not grow with the number of live emitters, which is the property
 * that matters — every mark of one colour at one age still batches into one
 * path.
 */
export const PROCEDURAL_MATCH_VFX_RENDER_NODE_COUNT = 20 as const;

interface ProceduralMatchEffectsProps {
  emitters: readonly PreparedMatchVfxEmitter[];
  visualTick: number;
  scale: number;
  playerDrawScale: number;
  devicePixelRatio: number;
  reduceMotion: boolean;
  reducedEffects: boolean;
}

const ROLE_ORDER: readonly MatchVfxColorRole[] = [
  'ink',
  'cream',
  'grass',
  'blue',
  'gold',
];

const AGE_STEPS: readonly number[] = Array.from(
  { length: MATCH_VFX_PHASE_COUNT },
  (_unused, step) => step,
);

type BucketedPaths = readonly Readonly<Record<MatchVfxColorRole, SkPath>>[];

// Shared empty buckets for the (most common) ticks with no live emitter.
// Built lazily on first use, never at import time — module load must stay
// Skia-free for headless imports. Nothing ever mutates a detached path, so
// one frozen set can back every empty tick, and the stable identities also
// keep the 20 <Path> props unchanged across those ticks.
let emptyBucketedPaths: BucketedPaths | null = null;

function buildPaths(props: ProceduralMatchEffectsProps): BucketedPaths {
  const active = activeMatchVfxEmitters(props.emitters, props.visualTick);
  if (active.length === 0) {
    emptyBucketedPaths ??= Object.freeze(
      AGE_STEPS.map(() =>
        Object.freeze({
          ink: Skia.PathBuilder.Make().detach(),
          cream: Skia.PathBuilder.Make().detach(),
          grass: Skia.PathBuilder.Make().detach(),
          blue: Skia.PathBuilder.Make().detach(),
          gold: Skia.PathBuilder.Make().detach(),
        }),
      ),
    );
    return emptyBucketedPaths;
  }
  // One builder set per age step: same batching as before within a step, and a
  // step is the unit the fade moves on.
  const buckets = AGE_STEPS.map(() => ({
    ink: Skia.PathBuilder.Make(),
    cream: Skia.PathBuilder.Make(),
    grass: Skia.PathBuilder.Make(),
    blue: Skia.PathBuilder.Make(),
    gold: Skia.PathBuilder.Make(),
  }));
  const pixel = props.scale * props.playerDrawScale;
  for (const emitter of active) {
    const geometry = sampleMatchVfxGeometry(
      emitter,
      matchVfxAgeMs(props.visualTick, emitter),
      props.reduceMotion,
      props.reducedEffects,
    );
    const sideX = -emitter.direction.y;
    const sideY = emitter.direction.x;
    const centerX = emitter.anchor.x * props.scale;
    const centerY = emitter.anchor.y * props.scale;
    const builders =
      buckets[Math.min(geometry.ageStep, MATCH_VFX_PHASE_COUNT - 1)]!;
    for (const item of geometry.marks) {
      const width = item.width * pixel;
      const height = item.height * pixel;
      const rawLeft =
        centerX +
        (emitter.direction.x * item.along + sideX * item.side) * pixel -
        width / 2;
      const rawTop =
        centerY +
        (emitter.direction.y * item.along + sideY * item.side) * pixel -
        height / 2;
      const left = snapDevicePixels(rawLeft, props.devicePixelRatio);
      const top = snapDevicePixels(rawTop, props.devicePixelRatio);
      const right = snapDevicePixels(rawLeft + width, props.devicePixelRatio);
      const bottom = snapDevicePixels(rawTop + height, props.devicePixelRatio);
      const builder = builders[item.role];
      builder.moveTo(left, top);
      builder.lineTo(right, top);
      builder.lineTo(right, bottom);
      builder.lineTo(left, bottom);
      builder.close();
    }
  }
  return Object.freeze(
    buckets.map((builder) =>
      Object.freeze({
        ink: builder.ink.detach(),
        cream: builder.cream.detach(),
        grass: builder.grass.detach(),
        blue: builder.blue.detach(),
        gold: builder.gold.detach(),
      }),
    ),
  );
}

export function ProceduralMatchEffects(props: ProceduralMatchEffectsProps) {
  const paths = useMemo(
    () => buildPaths(props),
    [
      props.devicePixelRatio,
      props.emitters,
      props.playerDrawScale,
      props.reduceMotion,
      props.reducedEffects,
      props.scale,
      props.visualTick,
    ],
  );
  const colors: Readonly<Record<MatchVfxColorRole, string>> = {
    ink: '#241f2ebf',
    cream: '#f4f1eaea',
    grass: '#5cb85ccc',
    blue: '#a3c8f0e6',
    gold: '#edb54ae6',
  };
  return (
    <>
      {AGE_STEPS.map((step) =>
        ROLE_ORDER.map((role) => (
          <Path
            antiAlias={false}
            color={colors[role]}
            key={`${step}:${role}`}
            opacity={matchVfxFadeOpacity(step)}
            path={paths[step]![role]}
          />
        )),
      )}
    </>
  );
}
