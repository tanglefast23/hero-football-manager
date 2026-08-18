/**
 * The DEF/MID/FWD labels that sit under the controlled team's outfield players
 * for three and a half seconds after a formation change. A brief "yes, that
 * landed", not a progress meter for the reshape — a player who is pressing or
 * carrying the ball never runs to his formation spot at all, so there is no
 * arrival to detect.
 *
 * Pure TS on purpose (no react-native/Skia imports), same reason as
 * `pass-combo.ts`: Jest can exercise it headless while MatchScreen cannot be
 * imported under the test runner.
 *
 * Render ring only. It reads events the sim already emits and writes nothing
 * back, so no replay and no ENGINE_VERSION is involved.
 */
import { formationRoleForSlot, type FormationId } from '../sim/tactics';
import type { MatchEvent } from '../sim/types';
import { pixelGlyph } from './pixel-glyphs';

/** How long the labels stay up. Owner-locked at 3.5s; TICK_MS is 100. */
export const ROLE_LABEL_TICKS = 35;

/** The three drawn codes, in packing order. The keeper is never labelled. */
export const ROLE_LABELS = ['DEF', 'MID', 'FWD'] as const;
export type RoleLabel = (typeof ROLE_LABELS)[number];

/** Engine slots that carry a label: 1..10, i.e. everyone but the keeper. */
export const LABELLED_SLOT_COUNT = 10;

export interface RoleLabelWindow {
  /** Tick the change landed. -1 when no window is open. */
  openTick: number;
  /**
   * Ten 2-bit role codes for engine slots 1..10, slot 1 in the low bits.
   *
   * One number rather than an array so the drawing worklet closes over a
   * primitive, as `fireTorchMask` does. Being honest about what that buys:
   * `usePathValue` hands Reanimated a fresh callback every render, so its
   * mapper restarts each sim tick whatever we close over — the same as the
   * shipped possession ring. The packing is what would let this component be
   * memoised later; it is not, today, saving a mapper restart.
   */
  packedRoles: number;
  /** Render slot of engine slot 1, i.e. `controlledTeam * 11 + 1`. */
  firstSlot: number;
}

export const CLOSED_ROLE_LABEL_WINDOW: RoleLabelWindow = {
  openTick: -1,
  packedRoles: 0,
  firstSlot: 0,
};

/** Packs engine slots 1..10 of `formation` into one number. */
export function packRoles(formation: FormationId): number {
  let packed = 0;
  for (let index = 0; index < LABELLED_SLOT_COUNT; index += 1) {
    const role = formationRoleForSlot(formation, index + 1);
    // Slots 1..10 are never GK in any shipped formation; indexOf would give -1
    // and corrupt every higher slot, so fall back to MID rather than shift a
    // negative.
    const code = ROLE_LABELS.indexOf(role as RoleLabel);
    packed |= (code < 0 ? 1 : code) << (index * 2);
  }
  return packed;
}

/** The role at `index` (0-based over engine slots 1..10). */
export function roleAt(packedRoles: number, index: number): RoleLabel {
  return ROLE_LABELS[(packedRoles >> (index * 2)) & 3] ?? 'MID';
}

/**
 * Folds one sim event into the window.
 *
 * Opens on the controlled team's FORMATION_CHANGED, and a second change
 * restarts rather than extends — a double tap must show the new roles.
 *
 * Closes on GOAL, MISS, HALF_TIME and FULL_TIME. GOAL and MISS both call
 * `restartKickoff`, which teleports everyone onto the new shape, so the labels
 * have nothing left to acknowledge; half time teleports on the same tick it
 * fires. FULL_TIME is mandatory rather than tidy: sim ticks freeze there, so
 * `expired()` below can never become true again.
 *
 * There is no mid-half KICKOFF event to close on — KICKOFF is emitted at t=0
 * and for the second half only, and `restartKickoff` itself emits nothing.
 */
export function applyRoleLabelEvent(
  window: RoleLabelWindow,
  event: MatchEvent,
  controlledTeam: 0 | 1,
): RoleLabelWindow {
  if (event.kind === 'FORMATION_CHANGED') {
    if (event.team !== controlledTeam) return window;
    return {
      openTick: event.t,
      packedRoles: packRoles(event.formation),
      firstSlot: controlledTeam * 11 + 1,
    };
  }
  if (
    event.kind === 'GOAL' ||
    event.kind === 'MISS' ||
    event.kind === 'HALF_TIME' ||
    event.kind === 'FULL_TIME'
  )
    return CLOSED_ROLE_LABEL_WINDOW;
  return window;
}

/**
 * Whether the labels draw at `tick`.
 *
 * No event fires when the window simply runs out, and a quiet stretch of play
 * delivers no events at all, so the expiry is a tick comparison made every
 * render — the same shape as the banner filter beside `setHud`.
 */
export function roleLabelsVisible(
  window: RoleLabelWindow,
  tick: number,
): boolean {
  if (window.openTick < 0) return false;
  return tick >= window.openTick && tick < window.openTick + ROLE_LABEL_TICKS;
}

/** Lit cells of one label, flattened to x,y pairs for the drawing worklet. */
function flatCells(label: RoleLabel): readonly number[] {
  const glyph = pixelGlyph(label);
  const flat: number[] = [];
  for (const cell of glyph.pixels) flat.push(cell.x, cell.y);
  return Object.freeze(flat);
}

/** Indexed by the packed role code, so the worklet indexes rather than branches. */
export const ROLE_LABEL_CELLS: readonly (readonly number[])[] = Object.freeze(
  ROLE_LABELS.map(flatCells),
);

/** All three codes are three characters wide, so one width serves every label. */
export const ROLE_LABEL_CELL_WIDTH = pixelGlyph(ROLE_LABELS[0]).width;
export const ROLE_LABEL_CELL_HEIGHT = pixelGlyph(ROLE_LABELS[0]).height;
