import { contributionsFrom } from '../match-contributions';
import type { MatchEvent, MatchState } from '../../sim/types';

/** Minimal MatchState carrying only what contributionsFrom reads. */
function matchWith(events: MatchEvent[], slotIds: string[]): MatchState {
  return {
    players: slotIds.map(id => ({ def: { id } })),
    events,
  } as unknown as MatchState;
}

const SLOTS = Array.from({ length: 22 }, (_, slot) => `p${slot}`);

describe('contributionsFrom', () => {
  it('credits a goal to the slot occupant', () => {
    const rows = contributionsFrom(matchWith(
      [{ t: 10, kind: 'GOAL', by: 9, team: 0 }],
      SLOTS,
    ));
    expect(rows).toEqual([{ playerId: 'p9', goals: 1, assists: 0, tacklesWon: 0, saves: 0 }]);
  });

  it('credits an assist to the stamped id, not a slot', () => {
    const rows = contributionsFrom(matchWith(
      [{ t: 10, kind: 'GOAL', by: 9, team: 0, assistedById: 'p7' }],
      SLOTS,
    ));
    expect(rows).toContainEqual({ playerId: 'p7', goals: 0, assists: 1, tacklesWon: 0, saves: 0 });
  });

  it('counts saves for the keeper slot', () => {
    const rows = contributionsFrom(matchWith(
      [{ t: 5, kind: 'SAVE', by: 0, resolveLeft: 90 }],
      SLOTS,
    ));
    expect(rows).toEqual([{ playerId: 'p0', goals: 0, assists: 0, tacklesWon: 0, saves: 1 }]);
  });

  it('counts won standing and slide tackles but not power tackles', () => {
    const rows = contributionsFrom(matchWith([
      { t: 1, kind: 'TACKLE', by: 3, on: 15, won: true, style: 'standing', contact: true },
      { t: 2, kind: 'TACKLE', by: 3, on: 15, won: true, style: 'slide', contact: true },
      { t: 3, kind: 'TACKLE', by: 3, on: 15, won: true, style: 'power', contact: true },
      { t: 4, kind: 'TACKLE', by: 3, on: 15, won: false, style: 'standing', contact: true },
    ], SLOTS));
    expect(rows).toEqual([{ playerId: 'p3', goals: 0, assists: 0, tacklesWon: 2, saves: 0 }]);
  });

  it('credits a first-half goal to the starter, not the player who replaced him', () => {
    const rows = contributionsFrom(matchWith([
      { t: 10, kind: 'GOAL', by: 9, team: 0 },
      { t: 50, kind: 'SUBSTITUTION', player: 9, outPlayerId: 'p9', inPlayerId: 'sub1', team: 0 },
      { t: 80, kind: 'GOAL', by: 9, team: 0 },
    ], SLOTS.map((id, slot) => (slot === 9 ? 'sub1' : id))));
    expect(rows).toContainEqual({ playerId: 'p9', goals: 1, assists: 0, tacklesWon: 0, saves: 0 });
    expect(rows).toContainEqual({ playerId: 'sub1', goals: 1, assists: 0, tacklesWon: 0, saves: 0 });
  });

  it('returns nothing for a match with no countable events', () => {
    expect(contributionsFrom(matchWith([{ t: 0, kind: 'KICKOFF', half: 1 }], SLOTS))).toEqual([]);
  });
});
