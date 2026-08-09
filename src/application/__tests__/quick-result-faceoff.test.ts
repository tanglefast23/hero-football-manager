import { roleOverall } from '../../game/archetype-caps';
import type { Attrs, PlayerDef, Role, TeamDef } from '../../sim/types';
import {
  bestOutfieldPlayer,
  faceOffStrike,
  quickResultFaceOffViewModel,
} from '../quick-result-faceoff';

function attrs(overrides: Partial<Attrs> = {}): Attrs {
  return {
    pac: 40,
    sho: 40,
    pas: 40,
    def: 40,
    tec: 40,
    sta: 40,
    ref: 40,
    ...overrides,
  };
}

function player(
  id: string,
  role: Role,
  overrides: Partial<Attrs> = {},
): PlayerDef {
  return { id, name: `Player ${id}`, role, attrs: attrs(overrides) };
}

function team(id: string, players: PlayerDef[]): TeamDef {
  return { id, name: `${id} FC`, players };
}

describe('faceOffStrike', () => {
  it('maps the manager-facing verdict, not the scoreline', () => {
    expect(faceOffStrike('WIN')).toBe('club');
    expect(faceOffStrike('LOSS')).toBe('opponent');
    expect(faceOffStrike('DRAW')).toBe('bounce');
  });
});

describe('bestOutfieldPlayer', () => {
  it('takes the highest roleOverall outfielder', () => {
    const squad = team('a', [
      player('p1', 'DEF'),
      player('p2', 'FWD', { sho: 90, pac: 90, tec: 90 }),
      player('p3', 'MID'),
    ]);
    expect(bestOutfieldPlayer(squad)?.id).toBe('p2');
  });

  it('never picks the keeper, even when the keeper is the best player in the eleven', () => {
    const keeper = player('gk', 'GK', {
      ref: 99,
      pac: 99,
      def: 99,
      sta: 99,
      tec: 99,
      pas: 99,
    });
    const striker = player('fw', 'FWD', {
      sho: 30,
      pac: 30,
      tec: 30,
      pas: 30,
      sta: 30,
      def: 30,
    });
    const squad = team('a', [keeper, striker]);
    // Guard the premise: the keeper really is rated higher.
    expect(roleOverall('GK', keeper.attrs)).toBeGreaterThan(
      roleOverall('FWD', striker.attrs),
    );
    expect(bestOutfieldPlayer(squad)?.id).toBe('fw');
  });

  it('breaks ties on ascending id, and is stable across calls', () => {
    const squad = team('a', [
      player('zeta', 'MID'),
      player('alpha', 'MID'),
      player('mike', 'MID'),
    ]);
    expect(bestOutfieldPlayer(squad)?.id).toBe('alpha');
    expect(bestOutfieldPlayer(squad)?.id).toBe('alpha');
    // Declaration order must not decide it either.
    const reversed = team('a', [...squad.players].reverse());
    expect(bestOutfieldPlayer(reversed)?.id).toBe('alpha');
  });

  it('falls back to the best of any role when the eleven is all keepers', () => {
    const squad = team('a', [
      player('gk1', 'GK', { ref: 50 }),
      player('gk2', 'GK', {
        ref: 90,
        pac: 90,
        def: 90,
        sta: 90,
        tec: 90,
        pas: 90,
      }),
    ]);
    expect(bestOutfieldPlayer(squad)?.id).toBe('gk2');
  });

  it('returns null for an empty eleven rather than throwing', () => {
    expect(bestOutfieldPlayer(team('a', []))).toBeNull();
  });
});

describe('quickResultFaceOffViewModel', () => {
  const club = team('rovers', [
    player('ours', 'FWD', { sho: 80 }),
    player('gk', 'GK'),
  ]);
  const opponent = team('town', [
    player('theirs', 'MID', { pas: 80 }),
    player('gk2', 'GK'),
  ]);

  it('puts the club on the left whatever the venue', () => {
    const model = quickResultFaceOffViewModel({
      clubTeam: club,
      opponentTeam: opponent,
      outcomeLabel: 'WIN',
    });
    expect(model?.sides[0].clubName).toBe('rovers FC');
    expect(model?.sides[0].playerId).toBe('ours');
    expect(model?.sides[1].playerId).toBe('theirs');
  });

  it('carries the strike through from the outcome label', () => {
    const drawn = quickResultFaceOffViewModel({
      clubTeam: club,
      opponentTeam: opponent,
      outcomeLabel: 'DRAW',
    });
    expect(drawn?.strike).toBe('bounce');
  });

  it('names both players and both clubs in the spoken sentence', () => {
    const model = quickResultFaceOffViewModel({
      clubTeam: club,
      opponentTeam: opponent,
      outcomeLabel: 'LOSS',
    });
    expect(model?.accessibilityLabel).toContain('Player ours');
    expect(model?.accessibilityLabel).toContain('rovers FC');
    expect(model?.accessibilityLabel).toContain('Player theirs');
    expect(model?.accessibilityLabel).toContain('town FC');
  });

  it('carries the look id when the player has one, and omits it when not', () => {
    const withLook = team('rovers', [
      { ...player('ours', 'FWD'), lookId: 'look-7' },
    ]);
    const model = quickResultFaceOffViewModel({
      clubTeam: withLook,
      opponentTeam: opponent,
      outcomeLabel: 'WIN',
    });
    expect(model?.sides[0].lookId).toBe('look-7');
    expect(model?.sides[1].lookId).toBeUndefined();
  });

  it('returns null when either side cannot field anyone, so the caller can skip the scene', () => {
    expect(
      quickResultFaceOffViewModel({
        clubTeam: team('rovers', []),
        opponentTeam: opponent,
        outcomeLabel: 'WIN',
      }),
    ).toBeNull();
    expect(
      quickResultFaceOffViewModel({
        clubTeam: club,
        opponentTeam: team('town', []),
        outcomeLabel: 'WIN',
      }),
    ).toBeNull();
  });
});
