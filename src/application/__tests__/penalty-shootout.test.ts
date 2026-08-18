import type { Attrs, PlayerDef, Role, TeamDef } from '../../sim/types';
import {
  orderedShooters,
  penaltyShootoutViewModel,
  startingGoalkeeper,
  type PenaltyShootoutArgs,
} from '../penalty-shootout';

function attrs(value = 40, overrides: Partial<Attrs> = {}): Attrs {
  return {
    pac: value,
    sho: value,
    pas: value,
    def: value,
    tec: value,
    sta: value,
    ref: value,
    ...overrides,
  };
}

function player(
  id: string,
  role: Role,
  overrides: Partial<Attrs> = {},
): PlayerDef {
  return { id, name: `Player ${id}`, role, attrs: attrs(40, overrides) };
}

function team(id: string, players: PlayerDef[]): TeamDef {
  return { id, name: `${id} FC`, players };
}

const club = team('club', [
  player('club-gk', 'GK', { ref: 90 }),
  player('club-1', 'FWD', { sho: 90, tec: 80 }),
  player('club-2', 'MID', { sho: 80, tec: 90 }),
  player('club-3', 'DEF', { sho: 70, tec: 70 }),
  player('club-4', 'MID', { sho: 60, tec: 60 }),
  player('club-5', 'FWD', { sho: 50, tec: 50 }),
  player('club-6', 'FWD', { sho: 1, tec: 1 }),
]);
const opponent = team('opponent', [
  player('opponent-gk', 'GK', { ref: 90 }),
  player('opponent-1', 'FWD', { sho: 90, tec: 80 }),
  player('opponent-2', 'MID', { sho: 80, tec: 90 }),
  player('opponent-3', 'DEF', { sho: 70, tec: 70 }),
  player('opponent-4', 'MID', { sho: 60, tec: 60 }),
  player('opponent-5', 'FWD', { sho: 50, tec: 50 }),
]);

function args(
  overrides: Partial<PenaltyShootoutArgs> = {},
): PenaltyShootoutArgs {
  return {
    fixtureId: 'cup-1',
    careerSeed: 101,
    matchSeed: 202,
    round: 1,
    clubIsHome: true,
    clubTeam: club,
    opponentTeam: opponent,
    winner: 'club',
    ...overrides,
  };
}

describe('penaltyShootoutViewModel', () => {
  it('is byte-stable, alternates sides, and keeps each running score honest', () => {
    const first = penaltyShootoutViewModel(args())!;
    const second = penaltyShootoutViewModel(args())!;
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));

    let clubScore = 0;
    let opponentScore = 0;
    first.kicks.forEach((kick, index) => {
      expect(kick.shootingSide).toBe(index % 2 === 0 ? 'club' : 'opponent');
      if (kick.outcome === 'score') {
        if (kick.shootingSide === 'club') clubScore += 1;
        else opponentScore += 1;
      }
      expect([kick.clubScore, kick.opponentScore]).toEqual([
        clubScore,
        opponentScore,
      ]);
    });
  });

  it.each(['club', 'opponent'] as const)(
    'always finishes with the recorded %s winner and a legal sequence',
    (winner) => {
      for (let fixture = 0; fixture < 64; fixture += 1) {
        const model = penaltyShootoutViewModel(
          args({ fixtureId: `cup-${fixture}`, winner }),
        )!;
        const winnerScore =
          winner === 'club' ? model.finalClubScore : model.finalOpponentScore;
        const loserScore =
          winner === 'club' ? model.finalOpponentScore : model.finalClubScore;
        expect(winnerScore).toBeGreaterThan(loserScore);
        expect(model.kicks.length % 2).toBe(0);
        expect(model.kicks.length).toBeGreaterThanOrEqual(10);

        // No regulation kick may follow a mathematical clinch.
        for (
          let index = 0;
          index < Math.min(9, model.kicks.length);
          index += 1
        ) {
          const kick = model.kicks[index]!;
          const clubTaken = Math.ceil((index + 1) / 2);
          const opponentTaken = Math.floor((index + 1) / 2);
          expect(
            kick.clubScore > kick.opponentScore + (5 - opponentTaken) ||
              kick.opponentScore > kick.clubScore + (5 - clubTaken),
          ).toBe(false);
        }

        // Sudden death can only end after both sides take the paired kick.
        if (model.kicks.length > 10) {
          expect(model.kicks[9]!.clubScore).toBe(model.kicks[9]!.opponentScore);
        }
      }
    },
  );

  it('orders five outfield shooters and rotates them in sudden death', () => {
    expect(orderedShooters(club).map((candidate) => candidate.id)).toEqual([
      'club-1',
      'club-2',
      'club-3',
      'club-4',
      'club-5',
    ]);
    const suddenDeath = Array.from({ length: 64 }, (_, fixture) =>
      penaltyShootoutViewModel(args({ fixtureId: `cup-${fixture}` }))!,
    ).find((model) => model.kicks.length > 10)!;
    expect(suddenDeath.kicks[10]!.shooter.playerId).toBe('club-1');
    expect(suddenDeath.kicks[11]!.shooter.playerId).toBe('opponent-1');
  });

  it('uses the starting keeper, then the strongest fallback starter', () => {
    expect(startingGoalkeeper(club)?.id).toBe('club-gk');
    const malformed = team('malformed', [
      player('weak', 'DEF'),
      player('strong', 'FWD', { sho: 90, tec: 90, pac: 90 }),
    ]);
    expect(startingGoalkeeper(malformed)?.id).toBe('strong');
  });

  it('returns null for empty or outfielder-free teams', () => {
    expect(
      penaltyShootoutViewModel(args({ clubTeam: team('empty', []) })),
    ).toBeNull();
    expect(
      penaltyShootoutViewModel(
        args({ opponentTeam: team('keepers', [player('gk', 'GK')]) }),
      ),
    ).toBeNull();
  });
});
