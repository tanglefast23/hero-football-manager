import { createLaunchCareerSetup } from '../../application/launch';
import { createCareer } from '../../game/career';
import { buildCareerFacility } from '../../game/management';
import { listCareerPlayer } from '../../game/market-career';
import { createBoardUltimatum, protectBoardUltimatumPlayer } from '../../game/board-ultimatum';
import { InvalidGameStateError, CorruptCareerSaveError } from '../errors';
import { parseStoredGameState, serializeGameState } from '../game-state-codec';

describe('M2 game-state codec', () => {
  test('round-trips the full pyramid, cup, market, youth intake, facilities, and lifecycle metadata', () => {
    const initial = createCareer(createLaunchCareerSetup(20260719));
    const built = buildCareerFacility(initial, 'gym', { x: 2, y: 0 }).state;
    // Not the reserve keeper: listing the only spare goalkeeper is now blocked.
    const listedPlayer = built.players.find(player => (
      player.clubId === built.userClubId
      && player.role !== 'GK'
      && !built.lineups.find(lineup => lineup.clubId === built.userClubId)?.playerIds.includes(player.id)
    ))!;
    const transferListings = listCareerPlayer(
      built,
      built.market!,
      listedPlayer.id,
    ).transferListings;
    const assistantCoach = built.market!.coachCandidates[0];
    const state = {
      ...built,
      players: built.players.map((player, index) => index === 0
        ? {
            ...player,
            motivatorMoraleRemainderHalfPoints: 125,
            coachTrainingBonusRemainders: { sho: 30, sta: 75 },
          }
        : player),
      market: {
        ...built.market!,
        assistantCoach,
        assistantCoachSeasonsEmployed: 0,
        transferListings,
      },
      cashTransactions: [
        ...built.cashTransactions!,
        {
          id: 'tx-event-1',
          season: built.season,
          week: built.week,
          kind: 'event' as const,
          label: 'Giant spider adopted',
          amount: -1200,
          balanceAfter: built.clubs[0].cash - 1200,
          referenceId: 'giant-spider-arrives',
        },
      ],
    };

    const restored = parseStoredGameState(serializeGameState(state));

    expect(restored).toEqual(state);
    expect(restored.m2?.pyramid.divisions).toHaveLength(5);
    expect(restored.m2?.nationalCups).toHaveLength(1);
    expect(restored.market?.coachCandidates.length).toBeGreaterThan(0);
    expect(restored.youthIntake).toEqual(state.youthIntake);
    expect(restored.youthIntake?.offers.length).toBeGreaterThanOrEqual(1);
    expect(restored.cashTransactions).toEqual(state.cashTransactions);
    expect(restored.cashTransactions).toHaveLength(2);
    expect(restored.cashTransactions![1].kind).toBe('event');
    expect(restored.players[0]).toMatchObject({
      motivatorMoraleRemainderHalfPoints: 125,
      coachTrainingBonusRemainders: { sho: 30, sta: 75 },
    });
  });

  test('rejects a full career whose required M2 market sidecar is missing', () => {
    const state = createCareer(createLaunchCareerSetup(44));
    const { market: _market, ...withoutMarket } = state;

    expect(() => serializeGameState(withoutMarket as typeof state)).toThrow(InvalidGameStateError);
    expect(() => parseStoredGameState(JSON.stringify(withoutMarket))).toThrow(CorruptCareerSaveError);
  });

  test('round-trips a protected board ultimatum and rejects hidden protection', () => {
    const initial = createCareer(createLaunchCareerSetup(445));
    const ultimatum = createBoardUltimatum(initial)!;
    const active = {
      ...initial,
      financialSafety: {
        consecutiveNegativeWeeks: 4,
        emergencyLoanUsed: true,
        boardUltimatum: ultimatum,
      },
    };
    const protectedState = protectBoardUltimatumPlayer(active, ultimatum.candidates[1].playerId);

    expect(parseStoredGameState(serializeGameState(protectedState))).toEqual(protectedState);

    const invalid = {
      ...protectedState,
      financialSafety: {
        ...protectedState.financialSafety!,
        boardUltimatum: {
          ...protectedState.financialSafety!.boardUltimatum!,
          protectedPlayerId: 'hidden-player',
        },
      },
    };
    expect(() => serializeGameState(invalid)).toThrow(InvalidGameStateError);
    expect(() => parseStoredGameState(JSON.stringify(invalid))).toThrow(CorruptCareerSaveError);
  });

  test('rejects stale youth intake data from another season', () => {
    const state = createCareer(createLaunchCareerSetup(45));
    const stale = {
      ...state,
      youthIntake: { ...state.youthIntake!, season: state.season + 1 },
    };

    expect(() => serializeGameState(stale)).toThrow(InvalidGameStateError);
    expect(() => parseStoredGameState(JSON.stringify(stale))).toThrow(CorruptCareerSaveError);
  });

  test('rejects a saved appearance from the wrong role pool', () => {
    const state = createCareer(createLaunchCareerSetup(451));
    const invalid = {
      ...state,
      players: state.players.map((player, index) => index === 0
        ? { ...player, lookId: player.role === 'GK' ? 'f00' : 'g00' }
        : player),
    };

    expect(() => serializeGameState(invalid)).toThrow(InvalidGameStateError);
    expect(() => parseStoredGameState(JSON.stringify(invalid))).toThrow(CorruptCareerSaveError);
  });

  test('rejects duplicate or zero-value immediate cash transactions', () => {
    const initial = createCareer(createLaunchCareerSetup(46));
    const state = buildCareerFacility(initial, 'gym', { x: 2, y: 0 }).state;
    const transaction = state.cashTransactions![0];
    const duplicate = { ...state, cashTransactions: [transaction, transaction] };
    const zero = {
      ...state,
      cashTransactions: [{ ...transaction, amount: 0 }],
    };

    expect(() => serializeGameState(duplicate)).toThrow(InvalidGameStateError);
    expect(() => serializeGameState(zero)).toThrow(InvalidGameStateError);
    expect(() => parseStoredGameState(JSON.stringify(duplicate))).toThrow(CorruptCareerSaveError);
  });

  test.each([
    {
      label: 'career seed mismatch',
      mutate: (state: ReturnType<typeof createCareer>) => ({
        ...state,
        m2: { ...state.m2!, careerSeed: state.careerSeed + 1 },
      }),
    },
    {
      label: 'duplicate pyramid division level',
      mutate: (state: ReturnType<typeof createCareer>) => ({
        ...state,
        m2: {
          ...state.m2!,
          pyramid: {
            ...state.m2!.pyramid,
            divisions: state.m2!.pyramid.divisions.map((division, index) => index === 1
              ? { ...division, level: 1 as const }
              : division),
          },
        },
      }),
    },
    {
      label: 'pyramid player in the wrong club',
      mutate: (state: ReturnType<typeof createCareer>) => {
        const firstDivision = state.m2!.pyramid.divisions[0];
        const sourceClub = firstDivision.clubs.find(club => club.squad.length > 0)!;
        return {
          ...state,
          m2: {
            ...state.m2!,
            pyramid: {
              ...state.m2!.pyramid,
              divisions: state.m2!.pyramid.divisions.map(division => division.level === firstDivision.level
                ? {
                    ...division,
                    clubs: division.clubs.map(club => club.id === sourceClub.id
                      ? {
                          ...club,
                          squad: club.squad.map((player, index) => index === 0
                            ? { ...player, clubId: 'not-the-containing-club' }
                            : player),
                        }
                      : club),
                  }
                : division),
            },
          },
        };
      },
    },
    {
      label: 'future retirement announcement',
      mutate: (state: ReturnType<typeof createCareer>) => ({
        ...state,
        retirementAnnouncements: [{
          playerId: state.players[0].id,
          playerName: state.players[0].name,
          announcedInSeason: state.season + 1,
          retirementAge: 36,
        }],
      }),
    },
    {
      label: 'retired player still active',
      mutate: (state: ReturnType<typeof createCareer>) => ({
        ...state,
        retiredPlayers: [state.players[0]],
      }),
    },
  ])('rejects inconsistent M2 relationships: $label', ({ mutate }) => {
    const state = createCareer(createLaunchCareerSetup(47));
    const invalid = mutate(state);

    expect(() => serializeGameState(invalid)).toThrow(InvalidGameStateError);
    expect(() => parseStoredGameState(JSON.stringify(invalid))).toThrow(CorruptCareerSaveError);
  });
});
