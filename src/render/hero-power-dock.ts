/**
 * Hero power dock — which of the manager's heroes can be fired by hand right
 * now, and how the buttons are laid out along the bottom of the pitch.
 *
 * Pure and separate from MatchScreen so it can be tested headlessly: the
 * stylesheet imports react-native, which Jest does not transform here. Same
 * split as `match-carrier-card.ts`.
 *
 * Presentation only — nothing here queues an input or touches engine state, so
 * no ENGINE_VERSION bump is involved.
 */
import { inUsefulContext } from '../sim/powers';
import type { MatchState, PowerId } from '../sim/types';

/**
 * How a cell reads to the manager.
 *
 * - `fire`   the authored moment is live; pressing fires at full strength.
 * - `arm`    the hero is charged but the moment is not there. Pressing commits
 *            a 2-second armed window that may expire and cost the Zone.
 * - `armed`  a press already happened. Status only — see `heroPowerPressable`.
 * - `down`   flattened, sliding or recovering. Pressing now would almost
 *            certainly waste the Zone, so the cell refuses the press.
 */
export type HeroPowerCellState = 'fire' | 'arm' | 'armed' | 'down';

export interface HeroPowerCell {
  /** Player index. Stable for the life of the slot, so cells never reorder. */
  slot: number;
  name: string;
  power: PowerId;
  /** Null while this hero has no Zone banked — the cell stays, empty. */
  state: HeroPowerCellState | null;
  /** Ticks left in the armed window; only meaningful in the `armed` state. */
  armedTicksRemaining: number;
}

/** Only a `fire` or `arm` cell accepts a press. */
export function heroPowerPressable(state: HeroPowerCellState | null): boolean {
  return state === 'fire' || state === 'arm';
}

function cellState(
  match: MatchState,
  slot: number,
): { state: HeroPowerCellState | null; armedTicksRemaining: number } {
  const player = match.players[slot];
  const power = player.powerState;
  if (power.kind === 'armed') {
    return { state: 'armed', armedTicksRemaining: power.remainingTicks };
  }
  if (power.kind !== 'zone') return { state: null, armedTicksRemaining: 0 };
  // The tap falls through to the armed branch when the hero is unavailable
  // (sim/powers.ts), and that window counts down while he is still on the
  // floor — so a press here is very likely a dead Zone. Refuse it instead.
  const down =
    player.outUntilTick > match.tick ||
    player.slideTackle !== undefined ||
    player.tackleRecoveryUntil > match.tick;
  if (down) return { state: 'down', armedTicksRemaining: 0 };
  return {
    state: inUsefulContext(match, slot) ? 'fire' : 'arm',
    armedTicksRemaining: 0,
  };
}

/**
 * One cell per hero the manager could fire by hand this match, in slot order.
 *
 * The CELL SET is deliberately wider than the set of live buttons: it holds
 * every eligible hero on the pitch, whether or not they have a Zone banked
 * right now. A cell whose hero is still building Heat renders empty and holds
 * its place. Filtering to live buttons instead would reflow the row every time
 * a power fired, sliding the remaining buttons under the manager's thumb
 * mid-match — the one thing a control on a live pitch must never do.
 *
 * Goalkeepers need no special case: since m2.7 a GK slot is always
 * FIRE_WHEN_READY, so the policy check below excludes them on its own.
 */
export function heroPowerDockCells(
  match: MatchState,
  controlledTeam: 0 | 1,
): HeroPowerCell[] {
  const first = controlledTeam * 11;
  const cells: HeroPowerCell[] = [];
  for (let slot = first; slot < first + 11; slot += 1) {
    const player = match.players[slot];
    const power = player.def.power;
    if (power === undefined) continue;
    if (player.firePolicy !== 'SAVE_FOR_TAP') continue;
    if (player.outReason === 'redcard') continue;
    const { state, armedTicksRemaining } = cellState(match, slot);
    cells.push({
      slot,
      name: player.def.name,
      power,
      state,
      armedTicksRemaining,
    });
  }
  return cells;
}

/** Nothing to draw at all — every cell is empty, so the dock stays off. */
export function heroPowerDockIsEmpty(cells: readonly HeroPowerCell[]): boolean {
  return cells.every((cell) => cell.state === null);
}

/**
 * A press is refused while the engine still owes this slot an answer.
 *
 * Read off the engine's own queue rather than a second piece of React state,
 * which could drift from it. This is only half the guard — the caller must also
 * refuse a press on a cell that is not `fire` or `arm`, because `pendingInputs`
 * clears one tick after the tap while the armed window runs for twenty.
 */
export function heroPowerTapBlocked(match: MatchState, slot: number): boolean {
  return match.pendingInputs.some(
    (input) =>
      (input.kind === 'POWER_TAP' && input.player === slot) ||
      (input.kind === 'SUBSTITUTE' && input.player === slot),
  );
}

/** Phone floor. Below this a square button stops being a reliable target. */
export const HERO_POWER_BUTTON_MIN = 44;
const HERO_POWER_BUTTON_MAX = 56;
const HERO_POWER_BUTTON_DESKTOP_MAX = 68;
const HERO_POWER_GAP = 6;
/**
 * The possession card takes 32% of the pitch in the opposite corner. Holding
 * the dock to 45% leaves a clear channel down the middle at every window size,
 * so the two can never meet over the goal.
 */
const HERO_POWER_PITCH_SHARE = 0.45;

export interface HeroPowerDockLayout {
  size: number;
  gap: number;
  /** Cells per row; the dock wraps upward, away from the touchline. */
  perRow: number;
  rows: number;
}

function rowWidth(size: number, count: number): number {
  return size * count + HERO_POWER_GAP * Math.max(0, count - 1);
}

/**
 * Square cells, shrunk to the 44pt floor before wrapping, then wrapped.
 *
 * A Global League club is not capped at four heroes — `heroLicensePurchaseCost`
 * prices permits 5, 6, 7 and up indefinitely — so this has to stay readable at
 * eleven. It never drops a cell to make room: a hidden button is an unusable
 * hero, which is worse than a smaller one.
 */
export function heroPowerDockLayout(
  cellCount: number,
  pitchWidth: number,
  desktop: boolean,
): HeroPowerDockLayout {
  const max = desktop ? HERO_POWER_BUTTON_DESKTOP_MAX : HERO_POWER_BUTTON_MAX;
  if (cellCount <= 0) {
    return { size: max, gap: HERO_POWER_GAP, perRow: 0, rows: 0 };
  }
  const budget = Number.isFinite(pitchWidth)
    ? pitchWidth * HERO_POWER_PITCH_SHARE
    : max * cellCount;
  if (rowWidth(max, cellCount) <= budget) {
    return { size: max, gap: HERO_POWER_GAP, perRow: cellCount, rows: 1 };
  }
  // Shrink first, down to the floor.
  const shrunk = Math.floor(
    (budget - HERO_POWER_GAP * (cellCount - 1)) / cellCount,
  );
  if (shrunk >= HERO_POWER_BUTTON_MIN) {
    return {
      size: Math.min(max, shrunk),
      gap: HERO_POWER_GAP,
      perRow: cellCount,
      rows: 1,
    };
  }
  // Still too wide at the floor: wrap instead of shrinking below it.
  const perRow = Math.max(
    1,
    Math.floor(
      (budget + HERO_POWER_GAP) / (HERO_POWER_BUTTON_MIN + HERO_POWER_GAP),
    ),
  );
  return {
    size: HERO_POWER_BUTTON_MIN,
    gap: HERO_POWER_GAP,
    perRow,
    rows: Math.ceil(cellCount / perRow),
  };
}
