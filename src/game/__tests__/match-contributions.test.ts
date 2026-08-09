import { contributionsFrom } from '../match-contributions';
import { HOME_DECOY_INDEX } from '../../sim/entities';
import type { DecoyCloneState, MatchEvent, MatchState } from '../../sim/types';
import type { PlayerMatchContribution } from '../types';

/** Minimal MatchState carrying only what contributionsFrom reads. */
function matchWith(
  events: MatchEvent[],
  slotIds: string[],
  homeClone: DecoyCloneState | null = null,
): MatchState {
  return {
    players: slotIds.map((id) => ({ def: { id } })),
    decoyClones: [homeClone, null],
    events,
  } as unknown as MatchState;
}

/** Only `sourceIdx` is read; the rest of a clone is the sim's business. */
function cloneOf(sourceIdx: number): DecoyCloneState {
  return { sourceIdx } as unknown as DecoyCloneState;
}

const SLOTS = Array.from({ length: 22 }, (_, slot) => `p${slot}`);

/** One row, spelled out, so a test names only the counters it is about. */
function row(
  playerId: string,
  counts: Partial<Omit<PlayerMatchContribution, 'playerId'>>,
): PlayerMatchContribution {
  return {
    playerId,
    goals: 0,
    assists: 0,
    tacklesWon: 0,
    saves: 0,
    passesCompleted: 0,
    ...counts,
  };
}

describe('contributionsFrom', () => {
  it('credits a goal to the slot occupant', () => {
    const rows = contributionsFrom(
      matchWith([{ t: 10, kind: 'GOAL', by: 9, team: 0 }], SLOTS),
    );
    expect(rows).toEqual([row('p9', { goals: 1 })]);
  });

  it('credits an assist to the stamped id, not a slot', () => {
    const rows = contributionsFrom(
      matchWith(
        [{ t: 10, kind: 'GOAL', by: 9, team: 0, assistedById: 'p7' }],
        SLOTS,
      ),
    );
    expect(rows).toContainEqual(row('p7', { assists: 1 }));
  });

  it('counts saves for the keeper slot', () => {
    const rows = contributionsFrom(
      matchWith([{ t: 5, kind: 'SAVE', by: 0, resolveLeft: 90 }], SLOTS),
    );
    expect(rows).toEqual([row('p0', { saves: 1 })]);
  });

  it('counts won standing and slide tackles but not power tackles', () => {
    const rows = contributionsFrom(
      matchWith(
        [
          {
            t: 1,
            kind: 'TACKLE',
            by: 3,
            on: 15,
            won: true,
            style: 'standing',
            contact: true,
          },
          {
            t: 2,
            kind: 'TACKLE',
            by: 3,
            on: 15,
            won: true,
            style: 'slide',
            contact: true,
          },
          {
            t: 3,
            kind: 'TACKLE',
            by: 3,
            on: 15,
            won: true,
            style: 'power',
            contact: true,
          },
          {
            t: 4,
            kind: 'TACKLE',
            by: 3,
            on: 15,
            won: false,
            style: 'standing',
            contact: true,
          },
        ],
        SLOTS,
      ),
    );
    expect(rows).toEqual([row('p3', { tacklesWon: 2 })]);
  });

  /** The Midfielders board ranks completed passes, so a stray one must not count. */
  it('counts only completed passes, credited to the passer', () => {
    const rows = contributionsFrom(
      matchWith(
        [
          { t: 1, kind: 'PASS', from: 6, to: 9, ok: true },
          { t: 2, kind: 'PASS', from: 6, to: 9, ok: false },
          { t: 3, kind: 'PASS', from: 9, to: 6, ok: true },
        ],
        SLOTS,
      ),
    );
    expect(rows).toContainEqual(row('p6', { passesCompleted: 1 }));
    expect(rows).toContainEqual(row('p9', { passesCompleted: 1 }));
  });

  it('credits a first-half goal to the starter, not the player who replaced him', () => {
    const rows = contributionsFrom(
      matchWith(
        [
          { t: 10, kind: 'GOAL', by: 9, team: 0 },
          {
            t: 50,
            kind: 'SUBSTITUTION',
            player: 9,
            outPlayerId: 'p9',
            inPlayerId: 'sub1',
            team: 0,
          },
          { t: 80, kind: 'GOAL', by: 9, team: 0 },
        ],
        SLOTS.map((id, slot) => (slot === 9 ? 'sub1' : id)),
      ),
    );
    expect(rows).toContainEqual(row('p9', { goals: 1 }));
    expect(rows).toContainEqual(row('sub1', { goals: 1 }));
  });

  /**
   * A Decoy clone is entity 22 or 23 and owns no lineup slot, so its tackles
   * and passes used to be looked up under an index nobody holds and dropped.
   */
  it('credits a live clone to the player it was copied from', () => {
    const rows = contributionsFrom(
      matchWith(
        [
          {
            t: 20,
            kind: 'TACKLE',
            by: HOME_DECOY_INDEX,
            on: 15,
            won: true,
            style: 'standing',
            contact: true,
          },
          { t: 21, kind: 'PASS', from: HOME_DECOY_INDEX, to: 9, ok: true },
        ],
        SLOTS,
        cloneOf(10),
      ),
    );
    expect(rows).toEqual([row('p10', { tacklesWon: 1, passesCompleted: 1 })]);
  });

  /**
   * Clones expire long before full time, so the final state's clone cannot
   * answer for an earlier one. `DECOY_POP` names the source it is leaving, and
   * the backwards walk restores it exactly as it restores a substituted slot.
   */
  it('credits a popped clone to its own source, not the one standing at full time', () => {
    const rows = contributionsFrom(
      matchWith(
        [
          { t: 10, kind: 'PASS', from: HOME_DECOY_INDEX, to: 9, ok: true },
          {
            t: 30,
            kind: 'DECOY_POP',
            player: 6,
            clone: HOME_DECOY_INDEX,
            source: 10,
            pos: { x: 0, y: 0 },
            reason: 'expired',
          },
          { t: 60, kind: 'PASS', from: HOME_DECOY_INDEX, to: 9, ok: true },
        ],
        SLOTS,
        cloneOf(8),
      ),
    );
    expect(rows).toContainEqual(row('p10', { passesCompleted: 1 }));
    expect(rows).toContainEqual(row('p8', { passesCompleted: 1 }));
  });

  it('returns nothing for a match with no countable events', () => {
    expect(
      contributionsFrom(matchWith([{ t: 0, kind: 'KICKOFF', half: 1 }], SLOTS)),
    ).toEqual([]);
  });
});
