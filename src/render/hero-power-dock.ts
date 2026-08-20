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
import { ballPos } from '../sim/engine';
import { requirePlayerAt } from '../sim/entities';
import { PITCH_H } from '../sim/geometry';
import {
  armWindowTicks,
  inUsefulContext,
  isShotSavePower,
} from '../sim/powers';
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
 * - `hold`   a save keeper with the ball up the other end. Nothing is wrong
 *            with them; there is simply no shot to save yet. Its own state and
 *            its own words, because `down` announces "{player} is down" and a
 *            healthy keeper waiting out a goal kick is not down.
 */
export type HeroPowerCellState = 'fire' | 'arm' | 'armed' | 'down' | 'hold';

export interface HeroPowerCell {
  /** Player index. Stable for the life of the slot, so cells never reorder. */
  slot: number;
  name: string;
  power: PowerId;
  /** Null while this hero has no Zone banked — the cell stays, empty. */
  state: HeroPowerCellState | null;
  /** Ticks left in the armed window; only meaningful in the `armed` state. */
  armedTicksRemaining: number;
  /**
   * The full window this power's press opens, so the drain bar divides by the
   * right number. A save keeper's is five times an outfield hero's; the old
   * hardcoded 20 pinned their bar full for eight seconds then dumped it.
   */
  armWindowTicks: number;
}

/** Only a `fire` or `arm` cell accepts a press — never `hold`, never `down`. */
export function heroPowerPressable(state: HeroPowerCellState | null): boolean {
  return state === 'fire' || state === 'arm';
}

/**
 * Is the ball in this keeper's own half — the only place their power matters?
 *
 * Reads the BALL, through `ballPos`, which already covers held, loose, pass and
 * shot. Following the carrier instead would leave the button flickering through
 * every long ball, and hand-listing the kinds would silently omit passes.
 *
 * Never greys during an on-target shot already in flight: a strike from just
 * beyond halfway would otherwise find the button dead for the only ticks it
 * could ever have mattered.
 *
 * Presentation only, and deliberately so. This decides what the BUTTON offers,
 * never what the engine accepts — a replayed tap from any client must still
 * simulate, or old replays stop being replays.
 */
export function ballInKeepersHalf(match: MatchState, slot: number): boolean {
  const keeper = match.players[slot];
  // An enemy shot already in flight always wakes the button, wherever it was
  // struck from — a strike from just beyond halfway would otherwise find the
  // control dead for the only ticks it could ever have mattered. Gated on the
  // SHOOTER being an opponent: the keeper's own side shooting up the other end
  // is the moment the ball is furthest away, not a reason to offer a press.
  if (match.ball.kind === 'shot') {
    return requirePlayerAt(match, match.ball.by).team !== keeper.team;
  }
  const ball = ballPos(match);
  // Team 0 defends the high-y goal, matching the engine's progress convention.
  return keeper.team === 0 ? ball.y > PITCH_H / 2 : ball.y < PITCH_H / 2;
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
  // A save keeper's power is only ever about a shot at their own goal, so the
  // button sleeps while the ball is up the other end rather than inviting a
  // press that starts a ten-second window nothing can fill.
  const savePower = isShotSavePower(player.def.power);
  if (savePower && !ballInKeepersHalf(match, slot)) {
    return { state: 'hold', armedTicksRemaining: 0 };
  }
  // A save keeper never reads FIRE: a shot in flight is far too brief to press
  // on, and their committed window is worth full strength anyway.
  if (savePower) return { state: 'arm', armedTicksRemaining: 0 };
  return {
    state: inUsefulContext(match, slot) ? 'fire' : 'arm',
    armedTicksRemaining: 0,
  };
}

/**
 * Whether this slot is a hero the manager may fire by hand at all this match.
 *
 * The dock cells and the on-pitch rings both ask this, so the two can never
 * disagree about who the manager controls. Goalkeepers need no special case:
 * Since m2.8 a goalkeeper is included on the same terms as anyone else; what
 * differs for a SAVE keeper is the button's rules, not their eligibility. In
 * AUTO every slot is FIRE_WHEN_READY, so this is false for the whole side and
 * no button and no ring is drawn.
 */
export function handFireable(match: MatchState, slot: number): boolean {
  const player = match.players[slot];
  if (player === undefined) return false;
  if (player.def.power === undefined) return false;
  if (player.firePolicy !== 'SAVE_FOR_TAP') return false;
  return player.outReason !== 'redcard';
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
 * Goalkeepers are included since m2.8. `cellState` gives the two SAVE powers
 * their own HOLD rule; a keeper carrying GUST is treated as any outfield hero.
 */
export function heroPowerDockCells(
  match: MatchState,
  controlledTeam: 0 | 1,
): HeroPowerCell[] {
  const first = controlledTeam * 11;
  const cells: HeroPowerCell[] = [];
  for (let slot = first; slot < first + 11; slot += 1) {
    if (!handFireable(match, slot)) continue;
    const player = match.players[slot];
    const power = player.def.power;
    if (power === undefined) continue;
    const { state, armedTicksRemaining } = cellState(match, slot);
    cells.push({
      slot,
      name: player.def.name,
      power,
      state,
      armedTicksRemaining,
      armWindowTicks: armWindowTicks(power),
    });
  }
  return cells;
}

/**
 * Which of the manager's heroes wear a ring on the pitch, as two bitmasks.
 *
 * The ring answers "which body does that corner button belong to?" — a fire
 * button names a hero, but the manager has to find them among twenty-two
 * sprites before the moment passes.
 *
 * - `dashed` the button is live (FIRE or ARM). Marching dashes: a decision.
 * - `solid`  the press has landed and the power is playing out (armed window,
 *            wind-up, or the moment itself). Nothing left to decide.
 *
 * A hero who is down, or holds no Zone, is in neither: their button refuses a
 * press, so a ring would point at a control that does nothing.
 *
 * BITMASKS, not arrays, for the same reason as `fireTorchMask` — the drawing
 * worklets capture them, and Reanimated restarts a mapper whose captured value
 * changed identity. A fresh array every sim tick restarts it every sim tick.
 */
export interface HeroPowerRingMasks {
  dashed: number;
  solid: number;
}

export function heroPowerRingMasks(
  match: MatchState,
  controlledTeam: 0 | 1,
): HeroPowerRingMasks {
  const first = controlledTeam * 11;
  let dashed = 0;
  let solid = 0;
  for (let slot = first; slot < first + 11; slot += 1) {
    if (!handFireable(match, slot)) continue;
    const kind = match.players[slot].powerState.kind;
    if (kind === 'armed' || kind === 'winding' || kind === 'active') {
      solid |= 1 << slot;
      continue;
    }
    const { state } = cellState(match, slot);
    if (state === 'fire' || state === 'arm') dashed |= 1 << slot;
  }
  return { dashed, solid };
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
