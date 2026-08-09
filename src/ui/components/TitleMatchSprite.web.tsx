import { memo, useMemo } from 'react';
import {
  titleMatchSpriteRuns,
  titleMatchSpriteSheet,
} from '../title-match-sprite-model';
import type { TitleMatchSpriteProps } from './TitleMatchSprite';

/** SVG keeps the title cast crisp on web without opening a WebGL context per player. */
export const TitleMatchSprite = memo(function TitleMatchSprite({
  spriteKey,
  scale = 2.5,
}: TitleMatchSpriteProps) {
  const colorPaths = useMemo(() => {
    const commandsByColor = new Map<string, string[]>();
    for (const run of titleMatchSpriteRuns(spriteKey)) {
      const commands = commandsByColor.get(run.color) ?? [];
      commands.push(`M${run.x} ${run.y}h${run.width}v1h-${run.width}z`);
      commandsByColor.set(run.color, commands);
    }
    return Array.from(commandsByColor, ([color, commands]) => ({
      color,
      path: commands.join(''),
    }));
  }, [spriteKey]);

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={titleMatchSpriteSheet.cell.w * scale}
      height={titleMatchSpriteSheet.cell.h * scale}
      viewBox={`0 0 ${titleMatchSpriteSheet.cell.w} ${titleMatchSpriteSheet.cell.h}`}
      shapeRendering="crispEdges"
      style={{ display: 'block' }}
    >
      {colorPaths.map(({ color, path }) => (
        <path key={color} d={path} fill={color} />
      ))}
    </svg>
  );
});
