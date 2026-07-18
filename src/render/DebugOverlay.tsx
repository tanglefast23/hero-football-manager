import { Circle, Group, Line } from '@shopify/react-native-skia';
import { movementTargets } from '../sim/engine';
import { GRID_COLS, GRID_ROWS, CELL_W, CELL_H } from '../sim/movement-table';
import { PITCH_W, PITCH_H } from '../sim/geometry';
import type { MatchState } from '../sim/types';

const GRID_COLOR = 'rgba(255,255,255,0.30)';
const HOME_COLOR = '#40c4ff'; // dev-only palette: high contrast over the pitch, not the game's team colors
const AWAY_COLOR = '#ff4081';
const LINK_OPACITY = 0.35;
const MARKER_R = 4; // pt — Skia sizes are screen-space, same convention as Pitch.tsx

/**
 * Dev-only movement-tuning overlay (positional-table rework, m0.5): draws the
 * 5x7 sampling grid and each player's current movement target from the pure
 * movementTargets() query, with a faint player->target link so a marker can be
 * attributed at a glance. `scale` converts pitch-units to screen points — the
 * same factor MatchScreen uses for players and the ball. Render it above the
 * Pitch inside the same scaled canvas; it is NOT mounted anywhere yet (the
 * toggle lands with the MatchScreen work).
 */
export function DebugOverlay({ state, scale }: { state: MatchState; scale: number }) {
  const targets = movementTargets(state);
  const w = PITCH_W * scale;
  const h = PITCH_H * scale;
  const cols: number[] = [];
  for (let c = 1; c < GRID_COLS; c++) cols.push(c * CELL_W * scale);
  const rows: number[] = [];
  for (let r = 1; r < GRID_ROWS; r++) rows.push(r * CELL_H * scale);

  return (
    <Group>
      {cols.map((x) => (
        <Line key={`c${x}`} p1={{ x, y: 0 }} p2={{ x, y: h }} color={GRID_COLOR} strokeWidth={1} />
      ))}
      {rows.map((y) => (
        <Line key={`r${y}`} p1={{ x: 0, y }} p2={{ x: w, y }} color={GRID_COLOR} strokeWidth={1} />
      ))}
      {targets.map((t, i) => {
        const color = i < 11 ? HOME_COLOR : AWAY_COLOR;
        const p = state.players[i].pos;
        return (
          <Group key={`t${i}`}>
            <Line
              p1={{ x: p.x * scale, y: p.y * scale }}
              p2={{ x: t.x * scale, y: t.y * scale }}
              color={color}
              opacity={LINK_OPACITY}
              strokeWidth={1}
            />
            <Circle cx={t.x * scale} cy={t.y * scale} r={MARKER_R} color={color} style="stroke" strokeWidth={1.5} />
          </Group>
        );
      })}
    </Group>
  );
}
