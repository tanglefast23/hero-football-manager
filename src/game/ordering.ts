/**
 * The game ring's tiebreaks, in one place.
 *
 * Everything here is a total order over data the ring already holds, so a sort
 * never depends on the order rows happened to arrive in.
 */

/**
 * Orders two internal identifiers — club, player, or fixture.
 *
 * DELIBERATELY NOT `String.prototype.localeCompare`. That method is
 * host-defined: its collation table comes from the JavaScript engine's own
 * locale data, so Hermes on device need not order the same two strings the way
 * V8 does under Jest. `src/game/` and `src/sim/` must produce byte-identical
 * results from the same seed on every platform (see CLAUDE.md), and these
 * comparisons decide real outcomes — which club is promoted, which player takes
 * a podium, which bid is accepted. A comparator that can disagree across engines
 * is a cross-platform determinism hazard even while every shipped ID is a
 * lowercase ASCII slug and the two orderings happen to agree.
 *
 * Plain `<`/`>` compares UTF-16 code units, which the language pins.
 *
 * Please do not "improve" this back to `localeCompare`. These are internal
 * slugs, never text a player reads, so there is no human-facing ordering for a
 * locale to get right. Display lists that a person reads alphabetically are a
 * different problem and belong in the UI ring.
 */
export function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/** The fields the league table's order is decided by, and only those. */
export interface StandingsOrder {
  readonly clubId: string;
  readonly points: number;
  readonly goalDifference: number;
  readonly goalsFor: number;
}

/**
 * The league table's order, and the only definition of it.
 *
 * Points, then goal difference, then goals for, then the club ID so the table
 * is total. Shared rather than reimplemented because two functions decide the
 * same thing from it: `leagueStandings` drives promotion, relegation and prize
 * money, and `finalPosition` writes the finish into the season recap that the
 * awards ceremony prices its prize against. They disagreed once — the recap
 * tiebroke with `localeCompare` — which is a ceremony framing a promotion the
 * transition never grants.
 */
export function compareStandings(left: StandingsOrder, right: StandingsOrder): number {
  if (left.points !== right.points) return left.points > right.points ? -1 : 1;
  if (left.goalDifference !== right.goalDifference) {
    return left.goalDifference > right.goalDifference ? -1 : 1;
  }
  if (left.goalsFor !== right.goalsFor) return left.goalsFor > right.goalsFor ? -1 : 1;
  return compareIds(left.clubId, right.clubId);
}
