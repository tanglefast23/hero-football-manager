/**
 * How far each club moved in the table since the player last looked at it.
 *
 * The table is only ever mounted after the week it describes has already been
 * played, so a club that climbed three places is simply drawn in its new row —
 * the movement that the whole league is about never appears on screen. Keeping
 * the last-seen order lets the rows slide in from where they used to be, which
 * is the only moment the standings read as a race rather than a list.
 *
 * The snapshot is view state, not career state: it lives for the session, is
 * keyed per division, and losing it (a reload, a fresh boot) costs one
 * un-animated table and nothing else. Nothing here reaches the save.
 */

/** Division key -> clubId -> position, as the player last saw it. */
const lastSeenPositions = new Map<string, Map<string, number>>();

export interface LeagueRowPosition {
  readonly clubId: string;
  readonly position: number;
}

/**
 * Rows moved per club, positive when the club dropped DOWN the table.
 *
 * A club with no previous position (promoted in, first view of the season)
 * reports 0: it has not moved, it has arrived, and sliding it from an imagined
 * row would be a lie about a match that was never played.
 */
export function leagueRowShifts(
  previous: ReadonlyMap<string, number> | undefined,
  rows: readonly LeagueRowPosition[],
): Map<string, number> {
  const shifts = new Map<string, number>();
  if (previous === undefined) return shifts;
  for (const row of rows) {
    const before = previous.get(row.clubId);
    if (before === undefined || before === row.position) continue;
    shifts.set(row.clubId, row.position - before);
  }
  return shifts;
}

/**
 * Reads the shifts for this division and records the order being rendered.
 *
 * Call once per distinct table state — calling it twice for the same standings
 * correctly returns no movement the second time, because by then the player
 * has seen them.
 */
export function takeLeagueRowShifts(
  divisionKey: string,
  rows: readonly LeagueRowPosition[],
): Map<string, number> {
  const shifts = leagueRowShifts(lastSeenPositions.get(divisionKey), rows);
  const snapshot = new Map<string, number>();
  for (const row of rows) snapshot.set(row.clubId, row.position);
  lastSeenPositions.set(divisionKey, snapshot);
  return shifts;
}

/**
 * Drops every remembered order.
 *
 * Called when a new career begins (App.tsx's `beginNewCareer`) — a fresh club
 * shares division labels with the one it replaced, so without this its first
 * table would slide rows against the old career's standings.
 */
export function forgetLeagueRowPositions(): void {
  lastSeenPositions.clear();
}

/**
 * Settle time for a row sliding into its new place.
 *
 * Long enough to be followed by eye (a table can reshuffle by several places
 * at once), short enough that the standings are readable before the player has
 * finished reaching for the next control.
 */
export const LEAGUE_ROW_SETTLE_MS = 420;
