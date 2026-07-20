import { memo, useMemo } from 'react';
import { View } from 'react-native';
import spriteData from '../../render/sprites/management-sprites.json';

interface ManagementSpriteSheet {
  palette: Record<string, string | null>;
  sprites: Record<string, string[]>;
}

const sheet = spriteData as ManagementSpriteSheet;
const coachPortraitIds = Array.from(new Set(
  Object.keys(sheet.sprites)
    .filter(key => key.startsWith('coach:') && key.endsWith(':rest'))
    .map(key => key.split(':')[1]),
));

export interface ManagementSpriteProps {
  spriteKey: string;
  width: number;
  accessibilityLabel?: string;
}

export const ManagementSprite = memo(function ManagementSprite({
  spriteKey,
  width,
  accessibilityLabel,
}: ManagementSpriteProps) {
  const resolvedKey = sheet.sprites[spriteKey] === undefined
    ? fallbackSpriteKey(spriteKey)
    : spriteKey;
  const rows = sheet.sprites[resolvedKey] ?? sheet.sprites['facility:worksite'];
  const sourceWidth = rows[0]?.length ?? 1;
  const sourceHeight = rows.length;
  const runs = useMemo(() => pixelRuns(rows, resolvedKey), [rows, resolvedKey]);
  const scale = width / sourceWidth;
  return (
    <View
      accessible={accessibilityLabel !== undefined}
      accessibilityRole={accessibilityLabel === undefined ? undefined : 'image'}
      accessibilityLabel={accessibilityLabel}
      style={{ width, height: sourceHeight * scale, position: 'relative' }}
    >
      {runs.map(run => (
        <View
          key={run.id}
          style={{
            position: 'absolute',
            left: run.x * scale,
            top: run.y * scale,
            width: run.length * scale,
            height: scale,
            backgroundColor: run.color,
          }}
        />
      ))}
    </View>
  );
});

function fallbackSpriteKey(spriteKey: string): string {
  if (!spriteKey.startsWith('coach:') || coachPortraitIds.length === 0) {
    return 'facility:worksite';
  }
  let hash = 0;
  for (let index = 0; index < spriteKey.length; index += 1) {
    hash = ((hash * 31) + spriteKey.charCodeAt(index)) >>> 0;
  }
  const portraitId = coachPortraitIds[hash % coachPortraitIds.length];
  const expression = spriteKey.endsWith(':joy') ? 'joy' : 'rest';
  return `coach:${portraitId}:${expression}`;
}

function pixelRuns(rows: string[], spriteKey: string) {
  const result: Array<{ id: string; x: number; y: number; length: number; color: string }> = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const key = row[x];
      const color = sheet.palette[key];
      let end = x + 1;
      while (end < row.length && row[end] === key) end += 1;
      if (color !== null && color !== undefined) {
        result.push({ id: `${spriteKey}-${y}-${x}`, x, y, length: end - x, color });
      }
      x = end;
    }
  });
  return result;
}
