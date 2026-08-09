import { Fragment } from 'react';
import {
  Circle,
  DashPathEffect,
  Group,
  Line,
  Path,
  Rect,
  RoundedRect,
  Skia,
} from '@shopify/react-native-skia';
import type { PowerId } from '../sim/types';
import { powerEffectFrame } from './power-effect-descriptors';
import { POWER_EFFECT_RENDER_STYLE } from './power-effect-render-style';

export interface PowerEffectPoint {
  x: number;
  y: number;
}

export interface PowerEffectSceneProps {
  power: PowerId;
  elapsedMs: number;
  width: number;
  height: number;
  origin?: PowerEffectPoint;
  targets?: readonly PowerEffectPoint[];
  anchor?: PowerEffectPoint;
  tier?: 1 | 2 | 3;
  direction?: -1 | 1;
  reduceMotion?: boolean;
  /** The showcase adds simple actors; MatchScreen already has Atlas sprites. */
  showDemoActors?: boolean;
  /** Demo-only block figures. Watched matches use real batched player sprites. */
  showPlaceholderActors?: boolean;
}

const INK = '#16121f';
const RIVAL = '#d94f52';
const HOME = '#5a8fd6';

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function mix(from: number, to: number, progress: number): number {
  return from + (to - from) * clamp01(progress);
}

function easeOut(progress: number): number {
  const p = clamp01(progress);
  return 1 - (1 - p) * (1 - p);
}

function easeInOut(progress: number): number {
  const p = clamp01(progress);
  return p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
}

function segment(progress: number, start: number, end: number): number {
  return clamp01((progress - start) / Math.max(0.001, end - start));
}

function pointAlong(
  from: PowerEffectPoint,
  to: PowerEffectPoint,
  progress: number,
): PowerEffectPoint {
  return { x: mix(from.x, to.x, progress), y: mix(from.y, to.y, progress) };
}

function makePolyline(points: readonly PowerEffectPoint[], close = false) {
  const builder = Skia.PathBuilder.Make();
  if (points.length === 0) return builder.detach();
  builder.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    builder.lineTo(points[index].x, points[index].y);
  }
  if (close) builder.close();
  return builder.detach();
}

function makeCurve(
  from: PowerEffectPoint,
  control: PowerEffectPoint,
  to: PowerEffectPoint,
) {
  const builder = Skia.PathBuilder.Make();
  builder.moveTo(from.x, from.y);
  builder.quadTo(control.x, control.y, to.x, to.y);
  return builder.detach();
}

function makeBolt(from: PowerEffectPoint, to: PowerEffectPoint, jag: number) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const side = { x: -dy / length, y: dx / length };
  return makePolyline([
    from,
    {
      x: from.x + dx * 0.24 + side.x * jag,
      y: from.y + dy * 0.24 + side.y * jag,
    },
    {
      x: from.x + dx * 0.47 - side.x * jag * 0.7,
      y: from.y + dy * 0.47 - side.y * jag * 0.7,
    },
    {
      x: from.x + dx * 0.7 + side.x * jag * 0.45,
      y: from.y + dy * 0.7 + side.y * jag * 0.45,
    },
    to,
  ]);
}

function makeStar(
  center: PowerEffectPoint,
  outer: number,
  inner: number,
  points = 6,
) {
  const vertices: PowerEffectPoint[] = [];
  for (let index = 0; index < points * 2; index += 1) {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (index * Math.PI) / points;
    vertices.push({
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
    });
  }
  return makePolyline(vertices, true);
}

function makeArrowHead(
  to: PowerEffectPoint,
  from: PowerEffectPoint,
  size: number,
) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  return makePolyline(
    [
      to,
      {
        x: to.x - Math.cos(angle - 0.55) * size,
        y: to.y - Math.sin(angle - 0.55) * size,
      },
      {
        x: to.x - Math.cos(angle + 0.55) * size,
        y: to.y - Math.sin(angle + 0.55) * size,
      },
    ],
    true,
  );
}

function PixelActor({
  at,
  color,
  unit,
  opacity = 1,
  scale = 1,
  outline = INK,
}: {
  at: PowerEffectPoint;
  color: string;
  unit: number;
  opacity?: number;
  scale?: number;
  outline?: string;
}) {
  const pixel = unit * 0.24 * scale;
  return (
    <Group opacity={opacity}>
      <Rect
        x={at.x - pixel * 1.5}
        y={at.y - pixel * 4.7}
        width={pixel * 3}
        height={pixel * 2.5}
        color={outline}
        antiAlias={false}
      />
      <Rect
        x={at.x - pixel}
        y={at.y - pixel * 4.4}
        width={pixel * 2}
        height={pixel * 1.8}
        color="#eab48c"
        antiAlias={false}
      />
      <Rect
        x={at.x - pixel * 2}
        y={at.y - pixel * 2.2}
        width={pixel * 4}
        height={pixel * 3}
        color={outline}
        antiAlias={false}
      />
      <Rect
        x={at.x - pixel * 1.5}
        y={at.y - pixel * 1.9}
        width={pixel * 3}
        height={pixel * 2.2}
        color={color}
        antiAlias={false}
      />
      <Rect
        x={at.x - pixel * 1.65}
        y={at.y + pixel * 0.4}
        width={pixel * 1.3}
        height={pixel * 2.3}
        color={outline}
        antiAlias={false}
      />
      <Rect
        x={at.x + pixel * 0.35}
        y={at.y + pixel * 0.4}
        width={pixel * 1.3}
        height={pixel * 2.3}
        color={outline}
        antiAlias={false}
      />
    </Group>
  );
}

function DemoActors({
  origin,
  targets,
  unit,
  power,
}: {
  origin: PowerEffectPoint;
  targets: readonly PowerEffectPoint[];
  unit: number;
  power: PowerId;
}) {
  const keeperPower =
    power === 'ELASTIC_KEEPER' || power === 'GIANT_GK' || power === 'GUST';
  const isFriendlyTarget = (index: number) =>
    (power === 'PORTAL_PASS' && index === 0) ||
    (power === 'DECOY_DOUBLE' && index === 1) ||
    (power === 'FUTURE_SIGHT' && index === 2) ||
    (power === 'RALLY_CRY' && index < 2) ||
    (power === 'GRAVITY_WELL' && index === 2) ||
    (power === 'GUST' && index === 1);
  return (
    <Fragment>
      <PixelActor
        at={origin}
        color={keeperPower ? '#63c56b' : HOME}
        unit={unit}
      />
      {targets.map((target, index) => (
        <PixelActor
          key={index}
          at={target}
          color={isFriendlyTarget(index) ? HOME : RIVAL}
          unit={unit}
          opacity={0.96}
        />
      ))}
    </Fragment>
  );
}

/**
 * Shared Skia geometry used by the live match and the one-power showcase.
 * Watched matches supply real player copies in one separate batched Atlas;
 * the lightweight mock showcase can still opt into simple block figures.
 */
export function PowerEffectScene({
  power,
  elapsedMs,
  width,
  height,
  origin: originProp,
  targets: targetProps,
  anchor: anchorProp,
  tier = 1,
  direction = -1,
  reduceMotion = false,
  showDemoActors = false,
  showPlaceholderActors = showDemoActors,
}: PowerEffectSceneProps) {
  const frame = powerEffectFrame(power, elapsedMs, reduceMotion);
  const palette = frame.descriptor;
  const p = frame.progress;
  const pulse = reduceMotion ? 1 : 0.76 + 0.24 * Math.sin(elapsedMs / 105);
  // Match FX support the actors; they do not become a second full-screen
  // layer. Keep production geometry close to the 24x30 player footprint.
  const unit = Math.max(4, Math.min(width, height) / 28);
  const demoUnit = Math.max(5, Math.min(width, height) / 18);
  const origin = originProp ?? { x: width * 0.33, y: height * 0.61 };
  const defaults = [
    { x: width * 0.67, y: height * 0.43 },
    { x: width * 0.75, y: height * 0.62 },
    { x: width * 0.56, y: height * 0.29 },
  ];
  const targets =
    targetProps && targetProps.length > 0 ? targetProps : defaults;
  const target = targets[0] ?? defaults[0];
  const secondary = targets[1] ?? defaults[1];
  const third = targets[2] ?? defaults[2];
  const anchor = anchorProp ?? { x: width * 0.5, y: height * 0.48 };
  const forward = {
    x: origin.x + width * 0.08,
    y: origin.y + direction * height * 0.38,
  };
  const demoTargetCount: Record<PowerId, number> = {
    SUPER_SPEED: 0,
    BLINK_RUN: 1,
    THUNDER_STRIKE: 1,
    FIRE_TORCH: 3,
    PHASE_RUN: 1,
    PORTAL_PASS: 1,
    DECOY_DOUBLE: 2,
    FUTURE_SIGHT: 3,
    SUPER_STRENGTH: 1,
    WEB_TRAP: 1,
    ELASTIC_KEEPER: 1,
    RALLY_CRY: 2,
    ICE_RINK: 1,
    SHADOW_MARK: 1,
    GRAVITY_WELL: 3,
    GIANT_GK: 1,
    GUST: 2,
  };

  let art: React.ReactNode;

  switch (power) {
    case 'SUPER_SPEED': {
      // The live speed read is the afterimage sprite trail (a separate actor
      // layer). This scene keeps only the preview placeholder afterimages; the
      // drawn streak and parallel path lines are intentionally gone.
      const burst = easeOut(segment(p, 0.16, 0.73));
      const runner = pointAlong(origin, forward, burst);
      art = (
        <Fragment>
          {showPlaceholderActors
            ? [0.12, 0.24, 0.38].map((lag, index) => (
                <PixelActor
                  key={index}
                  at={pointAlong(origin, runner, Math.max(0, burst - lag))}
                  color={palette.primary}
                  unit={unit}
                  opacity={(0.18 + index * 0.12) * pulse}
                />
              ))
            : null}
          {showPlaceholderActors ? (
            <PixelActor
              at={runner}
              color={palette.highlight}
              unit={unit}
              opacity={0.9}
            />
          ) : null}
        </Fragment>
      );
      break;
    }
    case 'BLINK_RUN': {
      const vanish = segment(p, 0.22, 0.53);
      const arrive = segment(p, 0.53, 0.82);
      const destination = forward;
      const sparkAt = vanish < 1 ? origin : destination;
      const pixelSpread = vanish < 1 ? 1 - vanish : arrive;
      art = (
        <Fragment>
          {[1, 1.55, 2.15].map((radius, index) => (
            <Circle
              key={`o-${index}`}
              cx={origin.x}
              cy={origin.y}
              r={unit * radius * (0.7 + vanish * 0.35)}
              color={index % 2 ? palette.secondary : palette.primary}
              style="stroke"
              strokeWidth={unit * 0.17}
              opacity={0.75 - index * 0.16}
            />
          ))}
          {[1, 1.55, 2.15].map((radius, index) => (
            <Circle
              key={`d-${index}`}
              cx={destination.x}
              cy={destination.y}
              r={unit * radius * (1.05 - arrive * 0.25)}
              color={index % 2 ? palette.secondary : palette.primary}
              style="stroke"
              strokeWidth={unit * 0.17}
              opacity={0.3 + arrive * (0.55 - index * 0.12)}
            />
          ))}
          <Path
            path={makeBolt(origin, destination, unit * 1.1)}
            color={palette.secondary}
            style="stroke"
            strokeWidth={unit * 0.15}
            opacity={0.25 + arrive * 0.65}
          />
          <Path
            path={makeStar(sparkAt, unit * (1.2 + pulse * 0.45), unit * 0.38)}
            color={palette.highlight}
            opacity={0.75}
          />
          {[
            [-1.8, -1.2],
            [1.4, -1.5],
            [-1.2, 1.3],
            [1.8, 1],
            [0, -2.1],
            [0.3, 2],
          ].map(([dx, dy], index) => (
            <Rect
              key={`blink-pixel-${index}`}
              x={sparkAt.x + dx * unit * pixelSpread - unit * 0.18}
              y={sparkAt.y + dy * unit * pixelSpread - unit * 0.18}
              width={unit * 0.36}
              height={unit * 0.36}
              color={index % 2 ? palette.secondary : palette.highlight}
              opacity={0.85}
              antiAlias={false}
            />
          ))}
          {showPlaceholderActors && arrive > 0 ? (
            <PixelActor
              at={destination}
              color={palette.primary}
              unit={unit}
              opacity={arrive}
            />
          ) : null}
        </Fragment>
      );
      break;
    }
    case 'THUNDER_STRIKE': {
      const strike = segment(p, 0.33, 0.65);
      const bolt = makeBolt(origin, target, unit * 1.1);
      art = (
        <Fragment>
          {[1, 1.65, 2.35].map((radius, index) => (
            <Circle
              key={index}
              cx={origin.x}
              cy={origin.y}
              r={unit * radius * (0.65 + segment(p, 0, 0.33) * 0.5)}
              color={index === 2 ? palette.primary : palette.secondary}
              style="stroke"
              strokeWidth={unit * 0.18}
              opacity={(0.78 - index * 0.18) * pulse}
            />
          ))}
          {strike > 0 ? (
            <Path
              path={bolt}
              color={palette.highlight}
              style="stroke"
              strokeWidth={unit * (0.22 + strike * 0.18)}
              opacity={1 - segment(p, 0.67, 1)}
            />
          ) : null}
          <Circle
            cx={target.x}
            cy={target.y}
            r={unit * (0.5 + segment(p, 0.56, 1) * 3.2)}
            color={palette.primary}
            style="stroke"
            strokeWidth={unit * 0.28}
            opacity={1 - segment(p, 0.65, 1)}
          />
          <Path
            path={makeStar(target, unit * (1 + strike * 2), unit * 0.35)}
            color={palette.secondary}
            opacity={strike * (1 - segment(p, 0.7, 1))}
          />
        </Fragment>
      );
      break;
    }
    case 'FIRE_TORCH': {
      const blaze = segment(p, 0.17, 0.72);
      const runner = pointAlong(origin, forward, easeOut(blaze));
      const ignite = segment(p, 0.55, 0.82);
      const ignitionTargets = [target, secondary, third].slice(0, tier);
      art = (
        <Fragment>
          <Path
            path={makeCurve(origin, anchor, runner)}
            color={palette.primary}
            style="stroke"
            strokeWidth={unit * 0.55}
            opacity={0.36}
          />
          {[0, 1, 2, 3].map((index) => {
            const flameAt = pointAlong(
              origin,
              runner,
              Math.max(0, 1 - index * 0.2),
            );
            return (
              <Path
                key={index}
                path={makeStar(
                  { x: flameAt.x, y: flameAt.y + unit * 0.6 },
                  unit * (1.15 - index * 0.12),
                  unit * 0.34,
                  5,
                )}
                color={index % 2 ? palette.secondary : palette.primary}
                opacity={(0.85 - index * 0.14) * pulse}
              />
            );
          })}
          {ignitionTargets.map((opponent, index) => (
            <Group key={index} opacity={ignite}>
              <Path
                path={makeStar(
                  { x: opponent.x, y: opponent.y - unit },
                  unit * (1.2 + ignite),
                  unit * 0.38,
                  5,
                )}
                color={index % 2 ? palette.secondary : palette.primary}
              />
              <Circle
                cx={opponent.x}
                cy={opponent.y}
                r={unit * (1.35 + ignite * 0.5)}
                color={palette.secondary}
                style="stroke"
                strokeWidth={unit * 0.2}
              />
            </Group>
          ))}
        </Fragment>
      );
      break;
    }
    case 'PHASE_RUN': {
      const phase = segment(p, 0.18, 0.78);
      const phased = pointAlong(origin, target, easeInOut(phase));
      art = (
        <Fragment>
          {showPlaceholderActors
            ? [0, 1, 2].map((index) => (
                <PixelActor
                  key={index}
                  at={{
                    x: phased.x - unit * (index + 1) * 0.7,
                    y: phased.y + unit * index * 0.25,
                  }}
                  color={palette.secondary}
                  unit={unit}
                  opacity={(0.16 + index * 0.12) * pulse}
                  outline={palette.primary}
                />
              ))
            : null}
          {showPlaceholderActors ? (
            <PixelActor
              at={phased}
              color={palette.primary}
              unit={unit}
              opacity={0.45 + segment(p, 0.7, 1) * 0.55}
              outline={palette.highlight}
            />
          ) : null}
          {[0, 1, 2, 3].map((index) => (
            <Line
              key={index}
              p1={{
                x: phased.x - unit * 1.8,
                y: phased.y - unit * 1.7 + index * unit,
              }}
              p2={{
                x: phased.x + unit * 1.8,
                y: phased.y - unit * 1.7 + index * unit,
              }}
              color={palette.highlight}
              strokeWidth={unit * 0.12}
              opacity={0.7 - index * 0.1}
            />
          ))}
          <Circle
            cx={target.x}
            cy={target.y}
            r={unit * (2.1 - segment(p, 0.65, 1))}
            color={palette.primary}
            style="stroke"
            strokeWidth={unit * 0.2}
            opacity={0.8}
          />
        </Fragment>
      );
      break;
    }
    case 'PORTAL_PASS': {
      const transfer = segment(p, 0.22, 0.6);
      const shield = segment(p, 0.58, 0.82);
      art = (
        <Fragment>
          {[1, 1.45, 1.9].map((radius, index) => (
            <Fragment key={index}>
              <Circle
                cx={origin.x}
                cy={origin.y}
                r={unit * radius}
                color={index % 2 ? palette.secondary : palette.primary}
                style="stroke"
                strokeWidth={unit * 0.18}
                opacity={0.88 - index * 0.18}
              />
              <Circle
                cx={target.x}
                cy={target.y}
                r={unit * radius}
                color={index % 2 ? palette.primary : palette.secondary}
                style="stroke"
                strokeWidth={unit * 0.18}
                opacity={0.88 - index * 0.18}
              />
            </Fragment>
          ))}
          <Path
            path={makeBolt(origin, target, unit * 0.42)}
            color={palette.highlight}
            style="stroke"
            strokeWidth={unit * 0.16}
            opacity={transfer * (1 - shield)}
            antiAlias={false}
          />
          <Circle
            cx={target.x}
            cy={target.y}
            r={unit * (2.25 + shield * 0.45)}
            color={palette.secondary}
            style="stroke"
            strokeWidth={unit * 0.32}
            opacity={shield * (1 - segment(p, 0.84, 1))}
          />
          <Path
            path={makeStar(target, unit * (0.9 + shield * 0.7), unit * 0.35, 8)}
            color={palette.highlight}
            opacity={shield * 0.4}
          />
        </Fragment>
      );
      break;
    }
    case 'DECOY_DOUBLE': {
      // The live match marks the real decoy body with a dashed hologram ring in
      // the match overlay. The preview has no decoy sprite, so it shows the same
      // ring on its own as the representative effect.
      const reveal = segment(p, 0.08, 0.3);
      art = (
        <Circle
          cx={origin.x}
          cy={origin.y}
          r={unit * 2.4}
          color={palette.secondary}
          style="stroke"
          strokeWidth={unit * 0.16}
          opacity={reveal * (0.6 + 0.3 * pulse)}
        >
          <DashPathEffect intervals={[unit * 0.7, unit * 0.55]} phase={0} />
        </Circle>
      );
      break;
    }
    case 'FUTURE_SIGHT': {
      const predict = segment(p, 0.05, 0.34);
      const intercept = easeOut(segment(p, 0.34, 0.68));
      const outlet = segment(p, 0.66, 1);
      const eyeBuilder = Skia.PathBuilder.Make();
      eyeBuilder.moveTo(origin.x - unit * 2, origin.y - unit * 2.4);
      eyeBuilder.quadTo(
        origin.x,
        origin.y - unit * 4,
        origin.x + unit * 2,
        origin.y - unit * 2.4,
      );
      eyeBuilder.quadTo(
        origin.x,
        origin.y - unit * 0.8,
        origin.x - unit * 2,
        origin.y - unit * 2.4,
      );
      eyeBuilder.close();
      const eye = eyeBuilder.detach();
      art = (
        <Fragment>
          <Path
            path={eye}
            color={palette.primary}
            opacity={0.35 + predict * 0.55}
          />
          <Circle
            cx={origin.x}
            cy={origin.y - unit * 2.4}
            r={unit * (0.35 + predict * 0.3)}
            color={palette.secondary}
          />
          <Path
            path={makeCurve(secondary, anchor, target)}
            color={palette.primary}
            style="stroke"
            strokeWidth={unit * 0.18}
            opacity={predict * 0.75}
          />
          <Path
            path={makeBolt(origin, target, unit * 0.65)}
            color={palette.highlight}
            style="stroke"
            strokeWidth={unit * 0.2}
            opacity={intercept * (1 - outlet * 0.5)}
          />
          {showPlaceholderActors ? (
            <PixelActor
              at={pointAlong(origin, target, intercept)}
              color={palette.primary}
              unit={unit}
              opacity={Math.max(0.35, intercept)}
            />
          ) : null}
          <Path
            path={makeCurve(
              target,
              { x: width * 0.56, y: target.y + direction * unit * 3 },
              third,
            )}
            color={palette.primary}
            style="stroke"
            strokeWidth={unit * 0.42}
            opacity={outlet * 0.34}
          />
          <Path
            path={makeCurve(
              target,
              { x: width * 0.56, y: target.y + direction * unit * 3 },
              third,
            )}
            color={palette.highlight}
            style="stroke"
            strokeWidth={unit * 0.17}
            opacity={outlet}
          />
          <Path
            path={makeArrowHead(third, target, unit * 1.1)}
            color={palette.highlight}
            opacity={outlet}
          />
        </Fragment>
      );
      break;
    }
    case 'SUPER_STRENGTH': {
      const lock = segment(p, 0, 0.28);
      const charge = segment(p, 0.28, 0.42);
      const impact = easeOut(segment(p, 0.42, 0.8));
      const charger = pointAlong(origin, target, impact);
      const bracket = unit * (2.3 - lock * 0.45);
      art = (
        <Fragment>
          <Path
            path={makePolyline([
              { x: target.x - bracket, y: target.y - bracket * 0.55 },
              { x: target.x - bracket, y: target.y - bracket },
              { x: target.x - bracket * 0.55, y: target.y - bracket },
            ])}
            color={palette.secondary}
            style="stroke"
            strokeWidth={unit * 0.24}
            opacity={0.8}
          />
          <Path
            path={makePolyline([
              { x: target.x + bracket, y: target.y - bracket * 0.55 },
              { x: target.x + bracket, y: target.y - bracket },
              { x: target.x + bracket * 0.55, y: target.y - bracket },
            ])}
            color={palette.secondary}
            style="stroke"
            strokeWidth={unit * 0.24}
            opacity={0.8}
          />
          {[1, 1.55, 2.15].map((radius, index) => (
            <Circle
              key={index}
              cx={origin.x}
              cy={origin.y}
              r={unit * radius * (1 - charge * 0.25)}
              color={index === 0 ? palette.highlight : palette.primary}
              style="stroke"
              strokeWidth={unit * 0.22}
              opacity={charge * (0.9 - index * 0.2) * pulse}
            />
          ))}
          {[0, 1, 2, 3, 4].map((index) => {
            const angle = index * Math.PI * 0.4 + 0.2;
            const crackStart = {
              x: origin.x + Math.cos(angle) * unit * 0.55,
              y: origin.y + Math.sin(angle) * unit * 0.35 + unit * 1.4,
            };
            const crackEnd = {
              x: origin.x + Math.cos(angle) * unit * (1.5 + charge),
              y:
                origin.y + Math.sin(angle) * unit * (0.8 + charge) + unit * 1.4,
            };
            return (
              <Path
                key={`crack-${index}`}
                path={makeBolt(crackStart, crackEnd, unit * 0.2)}
                color={palette.secondary}
                style="stroke"
                strokeWidth={unit * 0.15}
                opacity={charge * pulse}
              />
            );
          })}
          {showPlaceholderActors ? (
            <PixelActor
              at={charger}
              color={palette.primary}
              unit={unit}
              opacity={0.95}
              scale={1 + charge * 0.18}
            />
          ) : null}
          <Circle
            cx={target.x}
            cy={target.y}
            r={unit * (0.5 + impact * 3.6)}
            color={palette.primary}
            style="stroke"
            strokeWidth={unit * 0.34}
            opacity={impact * (1 - segment(p, 0.7, 1))}
          />
          <Path
            path={makeStar(target, unit * (0.8 + impact * 2.5), unit * 0.45, 7)}
            color={palette.highlight}
            opacity={impact * (1 - segment(p, 0.72, 1))}
          />
        </Fragment>
      );
      break;
    }
    case 'WEB_TRAP': {
      // The body itself turns fully grey through the sprite atlas. Keep the FX
      // deliberately small: one snapped cast line and four hard pixel bands
      // hugging the actual victim. No giant radial web, smooth rings or timer
      // dots competing with the cause-and-effect read.
      const bind = easeOut(segment(p, 0.12, 0.36));
      const rooted = segment(p, 0.3, 0.46);
      const pixel = Math.max(2, Math.round(unit * 0.14));
      const halfWidth = unit * 0.8;
      const halfHeight = unit * 1.1;
      art = (
        <Fragment>
          <Path
            path={makeBolt(origin, target, pixel * 1.5)}
            color={palette.secondary}
            style="stroke"
            strokeWidth={pixel}
            opacity={bind * (1 - rooted)}
            antiAlias={false}
          />
          {[0, 1, 2].map((index) => (
            <Line
              key={index}
              p1={{
                x: target.x - halfWidth,
                y: target.y - halfHeight + index * halfHeight,
              }}
              p2={{
                x: target.x + halfWidth,
                y: target.y - halfHeight * 0.55 + index * halfHeight,
              }}
              color={index % 2 === 0 ? palette.highlight : palette.secondary}
              strokeWidth={pixel}
              opacity={rooted}
              antiAlias={false}
            >
              <DashPathEffect intervals={[pixel * 2, pixel * 1.5]} phase={0} />
            </Line>
          ))}
          <Rect
            x={target.x - pixel}
            y={target.y - pixel}
            width={pixel * 2}
            height={pixel * 2}
            color={palette.highlight}
            opacity={rooted}
            antiAlias={false}
          />
        </Fragment>
      );
      break;
    }
    case 'ELASTIC_KEEPER': {
      // A single real match ball already flies into the save. This layer only
      // draws the elastic arm and glove: reach, catch flash, then retract.
      // Stepped hard-edged bands match the pixel bible and cannot be mistaken
      // for a second ball or a keeper distribution.
      const reach = easeOut(segment(p, 0.18, 0.58));
      const retract = easeInOut(segment(p, 0.68, 1));
      const extension = reach * (1 - retract);
      const catchFlash = segment(p, 0.5, 0.62) * (1 - segment(p, 0.68, 0.82));
      const pixel = Math.max(2, Math.round(unit * 0.14));
      const quantize = (value: number) => Math.round(value / pixel) * pixel;
      const hand = {
        x: quantize(mix(origin.x, target.x, extension)),
        y: quantize(mix(origin.y, target.y, extension)),
      };
      const arm = makePolyline([
        { x: quantize(origin.x), y: quantize(origin.y - pixel) },
        {
          x: quantize(mix(origin.x, hand.x, 0.42)),
          y: quantize(mix(origin.y, hand.y, 0.42) - pixel * 2),
        },
        {
          x: quantize(mix(origin.x, hand.x, 0.72)),
          y: quantize(mix(origin.y, hand.y, 0.72) + pixel),
        },
        hand,
      ]);
      art = (
        <Fragment>
          <Path
            path={arm}
            color="#6b6675"
            style="stroke"
            strokeWidth={pixel * 3}
            opacity={0.95}
            antiAlias={false}
          />
          <Path
            path={arm}
            color={palette.primary}
            style="stroke"
            strokeWidth={pixel * 2}
            opacity={0.98}
            antiAlias={false}
          />
          <Rect
            x={hand.x - pixel * 1.5}
            y={hand.y - pixel * 1.5}
            width={pixel * 3}
            height={pixel * 3}
            color="#6b6675"
            opacity={reach}
            antiAlias={false}
          />
          <Rect
            x={hand.x - pixel}
            y={hand.y - pixel}
            width={pixel * 2}
            height={pixel * 2}
            color={palette.highlight}
            opacity={reach}
            antiAlias={false}
          />
          <Rect
            x={target.x - pixel * 3}
            y={target.y - pixel / 2}
            width={pixel * 6}
            height={pixel}
            color={palette.secondary}
            opacity={catchFlash}
            antiAlias={false}
          />
          <Rect
            x={target.x - pixel / 2}
            y={target.y - pixel * 3}
            width={pixel}
            height={pixel * 6}
            color={palette.secondary}
            opacity={catchFlash}
            antiAlias={false}
          />
        </Fragment>
      );
      break;
    }
    case 'RALLY_CRY': {
      const roar = easeOut(segment(p, 0.04, 0.36));
      const encore = segment(p, 0.58, 0.8);
      const ticket = {
        x: target.x - unit * 1.8,
        y: target.y - unit * 3.7,
        w: unit * 3.6,
        h: unit * 2.4,
      };
      art = (
        <Fragment>
          {[1.3, 2.2, 3.15].map((radius, index) => (
            <Circle
              key={index}
              cx={origin.x}
              cy={origin.y}
              r={unit * radius * (0.7 + roar * 0.55)}
              color={index === 1 ? palette.secondary : palette.primary}
              style="stroke"
              strokeWidth={unit * 0.25}
              opacity={(0.8 - index * 0.15) * (1 - segment(p, 0.38, 0.66))}
            />
          ))}
          {[target, secondary].map((mate, index) => (
            <Path
              key={index}
              path={makeBolt(origin, mate, unit * 0.45)}
              color={palette.highlight}
              style="stroke"
              strokeWidth={unit * 0.18}
              opacity={segment(p, 0.28, 0.62)}
            />
          ))}
          <RoundedRect
            x={ticket.x}
            y={ticket.y}
            width={ticket.w}
            height={ticket.h}
            r={unit * 0.3}
            color={palette.primary}
            opacity={encore * 0.95}
          />
          <Rect
            x={ticket.x + unit * 0.35}
            y={ticket.y + unit * 0.32}
            width={ticket.w - unit * 0.7}
            height={ticket.h - unit * 0.64}
            color={INK}
            opacity={encore * 0.85}
            antiAlias={false}
          />
          <Path
            path={makeBolt(
              { x: ticket.x + ticket.w * 0.42, y: ticket.y + unit * 0.5 },
              {
                x: ticket.x + ticket.w * 0.58,
                y: ticket.y + ticket.h - unit * 0.5,
              },
              unit * 0.3,
            )}
            color={palette.highlight}
            style="stroke"
            strokeWidth={unit * 0.28}
            opacity={encore}
          />
          <Circle
            cx={target.x}
            cy={target.y}
            r={unit * (2 + encore * 0.35)}
            color={palette.secondary}
            style="stroke"
            strokeWidth={unit * 0.24}
            opacity={encore * pulse}
          />
        </Fragment>
      );
      break;
    }
    case 'ICE_RINK': {
      const freeze = segment(p, 0.05, 0.3);
      const skid = easeInOut(segment(p, 0.28, 0.74));
      const back = {
        x: target.x - unit * 0.8,
        y: target.y - direction * height * 0.3,
      };
      const sliding = pointAlong(target, back, skid);
      const ice = makePolyline(
        [
          { x: target.x - unit * 3.4, y: target.y - unit * 1.5 },
          { x: target.x + unit * 2.8, y: target.y - unit * 2.1 },
          { x: back.x + unit * 3.2, y: back.y + unit * 1.7 },
          { x: back.x - unit * 2.7, y: back.y + unit * 2.2 },
        ],
        true,
      );
      art = (
        <Fragment>
          <Path path={ice} color={palette.primary} opacity={freeze * 0.35} />
          <Path
            path={makeCurve(target, anchor, back)}
            color={palette.highlight}
            style="stroke"
            strokeWidth={unit * 0.25}
            opacity={freeze * 0.85}
          />
          {[0, 1, 2, 3].map((index) => (
            <Path
              key={index}
              path={makeStar(
                {
                  x: mix(target.x, back.x, index / 3),
                  y:
                    mix(target.y, back.y, index / 3) +
                    (index % 2 ? unit : -unit),
                },
                unit * 0.55,
                unit * 0.16,
                6,
              )}
              color={index % 2 ? palette.secondary : palette.highlight}
              opacity={freeze * pulse}
            />
          ))}
          {showPlaceholderActors ? (
            <PixelActor at={sliding} color={RIVAL} unit={unit} opacity={0.92} />
          ) : null}
          <Line
            p1={{ x: target.x - unit * 1.1, y: target.y + unit * 1.5 }}
            p2={{ x: sliding.x - unit * 1.1, y: sliding.y + unit * 1.5 }}
            color={palette.secondary}
            strokeWidth={unit * 0.22}
            opacity={skid}
          />
          {/* The real Atlas ball stays visibly tethered to the carrier. */}
        </Fragment>
      );
      break;
    }
    case 'SHADOW_MARK': {
      const burrow = segment(p, 0.05, 0.28);
      const hunt = easeInOut(segment(p, 0.27, 0.7));
      const pop = easeOut(segment(p, 0.7, 0.88));
      const below = pointAlong(origin, target, hunt);
      const trail = makeCurve(origin, anchor, below);
      art = (
        <Fragment>
          <Circle
            cx={origin.x}
            cy={origin.y + unit * 1.4}
            r={unit * (0.8 + burrow * 1.1)}
            color={INK}
            opacity={0.85}
          />
          {[0, 1, 2, 3].map((index) => (
            <Rect
              key={`mound-${index}`}
              x={origin.x + (index - 1.5) * unit * 0.7}
              y={origin.y + unit * (1.15 - (index % 2) * 0.28)}
              width={unit * 0.62}
              height={unit * 0.42}
              color={index % 2 ? '#c8862a' : '#6b6675'}
              opacity={burrow * 0.92}
              antiAlias={false}
            />
          ))}
          <Path
            path={trail}
            color={palette.primary}
            style="stroke"
            strokeWidth={unit * 0.65}
            opacity={hunt * 0.5}
          />
          {[0.2, 0.4, 0.6, 0.8].map((at, index) => {
            const crumb = pointAlong(origin, below, at);
            return (
              <Rect
                key={index}
                x={crumb.x - unit * 0.18}
                y={crumb.y - unit * 0.18}
                width={unit * 0.36}
                height={unit * 0.36}
                color={palette.secondary}
                opacity={hunt * (0.35 + index * 0.12)}
                antiAlias={false}
              />
            );
          })}
          <Circle
            cx={below.x}
            cy={below.y + unit * 1.4}
            r={unit * (0.85 + pop * 1.15)}
            color={INK}
            opacity={hunt}
          />
          {showPlaceholderActors ? (
            <PixelActor
              at={{ x: target.x, y: target.y + unit * (2.2 - pop * 2.2) }}
              color={palette.primary}
              unit={unit}
              opacity={pop}
              outline={palette.highlight}
            />
          ) : null}
          <Path
            path={makeStar(target, unit * (0.7 + pop * 2.3), unit * 0.35, 7)}
            color={palette.secondary}
            opacity={pop * (1 - segment(p, 0.9, 1))}
          />
        </Fragment>
      );
      break;
    }
    case 'GRAVITY_WELL': {
      const well = segment(p, 0.03, 0.28);
      const pull = easeInOut(segment(p, 0.25, 0.66));
      const lane = segment(p, 0.62, 0.86);
      const singularity = anchor;
      art = (
        <Fragment>
          {[0.85, 1.45, 2.15].map((radius, index) => (
            <Circle
              key={index}
              cx={singularity.x}
              cy={singularity.y}
              r={unit * radius * (0.65 + well * 0.45)}
              color={index === 0 ? INK : palette.primary}
              style={index === 0 ? 'fill' : 'stroke'}
              strokeWidth={unit * 0.22}
              opacity={0.95 - index * 0.18}
            />
          ))}
          {[target, secondary].map((defender, index) => {
            const pulled = pointAlong(defender, singularity, pull * 0.62);
            return (
              <Fragment key={index}>
                <Path
                  path={makeCurve(
                    defender,
                    {
                      x:
                        mix(defender.x, singularity.x, 0.5) +
                        (index ? unit : -unit),
                      y: mix(defender.y, singularity.y, 0.5),
                    },
                    singularity,
                  )}
                  color={palette.primary}
                  style="stroke"
                  strokeWidth={unit * 0.2}
                  opacity={pull * pulse}
                />
                {showPlaceholderActors ? (
                  <PixelActor
                    at={pulled}
                    color={RIVAL}
                    unit={unit}
                    opacity={0.9}
                  />
                ) : null}
              </Fragment>
            );
          })}
          <Path
            path={makeCurve(
              origin,
              { x: third.x, y: mix(origin.y, third.y, 0.5) },
              third,
            )}
            color={palette.secondary}
            style="stroke"
            strokeWidth={unit * 0.5}
            opacity={lane * 0.35}
          />
          <Path
            path={makeCurve(
              origin,
              { x: third.x, y: mix(origin.y, third.y, 0.5) },
              third,
            )}
            color={palette.highlight}
            style="stroke"
            strokeWidth={unit * 0.15}
            opacity={lane}
          />
          <Path
            path={makeArrowHead(third, origin, unit * 1.2)}
            color={palette.highlight}
            opacity={lane}
          />
        </Fragment>
      );
      break;
    }
    case 'GIANT_GK': {
      const grow = easeOut(segment(p, 0.05, 0.5));
      const deny = segment(p, 0.58, 0.84);
      art = (
        <Fragment>
          <RoundedRect
            x={origin.x - unit * (2.2 + grow * 1.3)}
            y={origin.y - unit * (3.2 + grow * 1.8)}
            width={unit * (4.4 + grow * 2.6)}
            height={unit * (5.5 + grow * 3.6)}
            r={unit * 0.7}
            color={palette.primary}
            opacity={0.18 + grow * 0.26}
          />
          {showPlaceholderActors ? (
            <PixelActor
              at={origin}
              color={palette.primary}
              unit={unit}
              scale={1 + grow * 1.05}
              opacity={0.95}
              outline={palette.highlight}
            />
          ) : null}
          <Circle
            cx={origin.x - unit * (2 + grow * 2.2)}
            cy={origin.y - unit * (0.8 + grow)}
            r={unit * (0.7 + grow * 0.65)}
            color={palette.highlight}
            style="stroke"
            strokeWidth={unit * 0.32}
            opacity={grow}
          />
          <Circle
            cx={origin.x + unit * (2 + grow * 2.2)}
            cy={origin.y - unit * (0.8 + grow)}
            r={unit * (0.7 + grow * 0.65)}
            color={palette.highlight}
            style="stroke"
            strokeWidth={unit * 0.32}
            opacity={grow}
          />
          {[1, 1.55, 2.2].map((radius, index) => (
            <Circle
              key={index}
              cx={origin.x}
              cy={origin.y}
              r={unit * radius * (1 + grow * 1.1)}
              color={palette.secondary}
              style="stroke"
              strokeWidth={unit * 0.2}
              opacity={(0.72 - index * 0.16) * pulse}
            />
          ))}
          <Path
            path={makeStar(target, unit * (0.8 + deny * 2), unit * 0.4, 8)}
            color={palette.highlight}
            opacity={deny * (1 - segment(p, 0.86, 1))}
          />
          <Path
            path={makeArrowHead(origin, target, unit * 1.4)}
            color={palette.primary}
            opacity={deny}
          />
        </Fragment>
      );
      break;
    }
    case 'GUST': {
      const bend = easeInOut(segment(p, 0.06, 0.42));
      const receive = segment(p, 0.4, 0.64);
      const punt = easeOut(segment(p, 0.64, 1));
      const incoming = target;
      const keeper = origin;
      const control = { x: width * 0.55, y: height * 0.14 };
      const puntTarget =
        targetProps && targetProps.length > 1 ? secondary : third;
      art = (
        <Fragment>
          {[0, 1, 2].map((index) => (
            <Path
              key={index}
              path={makeCurve(
                { x: incoming.x, y: incoming.y + (index - 1) * unit * 0.8 },
                {
                  x: control.x + index * unit,
                  y: control.y + index * unit * 0.4,
                },
                { x: keeper.x, y: keeper.y + (index - 1) * unit * 0.5 },
              )}
              color={index === 1 ? palette.highlight : palette.primary}
              style="stroke"
              strokeWidth={unit * (0.12 + index * 0.06)}
              opacity={(0.75 - index * 0.12) * bend * pulse}
            />
          ))}
          <Circle
            cx={keeper.x}
            cy={keeper.y}
            r={unit * (1.4 + receive * 0.75)}
            color={palette.secondary}
            style="stroke"
            strokeWidth={unit * 0.24}
            opacity={receive * (1 - punt)}
          />
          <Path
            path={makeCurve(
              keeper,
              { x: width * 0.75, y: height * 0.46 },
              puntTarget,
            )}
            color={palette.highlight}
            style="stroke"
            strokeWidth={unit * 0.3}
            opacity={punt}
          />
          <Path
            path={makeCurve(
              keeper,
              { x: width * 0.75, y: height * 0.46 },
              puntTarget,
            )}
            color={palette.primary}
            style="stroke"
            strokeWidth={unit * 0.75}
            opacity={punt * 0.28}
          />
          <Path
            path={makeArrowHead(puntTarget, keeper, unit * 1.45)}
            color={palette.highlight}
            opacity={punt}
          />
        </Fragment>
      );
      break;
    }
    default: {
      const exhaustive: never = power;
      art = exhaustive;
    }
  }

  return (
    <Fragment>
      {showDemoActors ? (
        <DemoActors
          origin={origin}
          targets={targets.slice(0, demoTargetCount[power])}
          unit={demoUnit}
          power={power}
        />
      ) : null}
      <Group {...POWER_EFFECT_RENDER_STYLE}>{art}</Group>
    </Fragment>
  );
}
