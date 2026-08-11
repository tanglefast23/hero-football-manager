import { Path, Skia, type SkPath } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { snapDevicePixels } from './pixel-grid';
import {
  activeMatchVfxEmitters,
  matchVfxAgeMs,
  sampleMatchVfxGeometry,
  type MatchVfxColorRole,
  type PreparedMatchVfxEmitter,
} from './match-vfx';

export const PROCEDURAL_MATCH_VFX_RENDER_NODE_COUNT = 5 as const;

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

function buildPaths(
  props: ProceduralMatchEffectsProps,
): Readonly<Record<MatchVfxColorRole, SkPath>> {
  const builders = {
    ink: Skia.PathBuilder.Make(),
    cream: Skia.PathBuilder.Make(),
    grass: Skia.PathBuilder.Make(),
    blue: Skia.PathBuilder.Make(),
    gold: Skia.PathBuilder.Make(),
  };
  const pixel = props.scale * props.playerDrawScale;
  for (const emitter of activeMatchVfxEmitters(
    props.emitters,
    props.visualTick,
  )) {
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
  return Object.freeze({
    ink: builders.ink.detach(),
    cream: builders.cream.detach(),
    grass: builders.grass.detach(),
    blue: builders.blue.detach(),
    gold: builders.gold.detach(),
  });
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
      {ROLE_ORDER.map((role) => (
        <Path
          antiAlias={false}
          color={colors[role]}
          key={role}
          path={paths[role]}
        />
      ))}
    </>
  );
}
