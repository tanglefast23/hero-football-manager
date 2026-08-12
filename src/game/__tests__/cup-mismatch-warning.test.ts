import { createLaunchCareerSetup } from '../../application/launch';
import {
  completeCupMismatchWarning,
  cupMismatchWarning,
  cupMismatchWarningFlag,
} from '../cup-mismatch-warning';
import { CUP_SETTLEMENT_WEEKS, createCareer } from '../career';
import type { DivisionLevel, PyramidPlayer } from '../pyramid';
import type { GameState } from '../types';

describe('Bert Cup mismatch warning', () => {
  test.each([
    {
      gap: 2,
      title: 'Two divisions above us',
      lossCopy: 'expected to lose by a couple',
    },
    {
      gap: 3,
      title: 'Three divisions. Oh dear.',
      lossCopy: 'three or four-goal defeat',
    },
    {
      gap: 4,
      title: 'Four divisions. I checked twice.',
      lossCopy: 'counted with both hands',
    },
  ])(
    'uses the escalating $gap-division warning tier',
    ({ gap, title, lossCopy }) => {
      const warning = cupMismatchWarning(cupCareer(gap, 1));

      expect(warning).toMatchObject({ divisionGap: gap, title });
      expect(warning?.body).toHaveLength(1);
      expect(warning?.body[0]).toContain(lossCopy);
    },
  );

  it('appears only for a current Cup opponent at least two divisions above', () => {
    expect(cupMismatchWarning(cupCareer(1, 1))).toBeUndefined();

    const leagueWeek = cupCareer(2, 1);
    const firstLeagueFixture = leagueWeek.fixtures.find(
      (fixture) =>
        fixture.homeClubId === leagueWeek.userClubId ||
        fixture.awayClubId === leagueWeek.userClubId,
    )!;
    expect(
      cupMismatchWarning({
        ...leagueWeek,
        week: firstLeagueFixture.week,
        phase: 'matchday',
      }),
    ).toBeUndefined();
  });

  it('uses a deterministic exact 50/50 star callout without reading assistant mode', () => {
    const callouts = Array.from(
      { length: 100 },
      (_, matchSeed) =>
        cupMismatchWarning(cupCareer(2, matchSeed))?.starPlayer !== undefined,
    );

    expect(callouts.filter(Boolean)).toHaveLength(50);
    const teacher = cupMismatchWarning({
      ...cupCareer(2, 2),
      assistantMode: 'teacher',
    });
    const advisor = cupMismatchWarning({
      ...cupCareer(2, 2),
      assistantMode: 'advisor',
    });
    expect(advisor).toEqual(teacher);
    expect(advisor?.body).toHaveLength(2);
  });

  it('warns about an opponent that exists only in the pyramid', () => {
    const state = cupCareer(3, 1);
    const opponentClubId = warningFixtureOpponent(state);

    // The regression this whole feature died of: the club is real, plays three
    // tiers up, and is nowhere in the user's own ten-club division.
    expect(state.clubs.map((club) => club.id)).not.toContain(opponentClubId);
    expect(cupMismatchWarning(state)).toMatchObject({
      divisionGap: 3,
      body: [
        expect.stringContaining(
          pyramidOpponent(state, opponentClubId).name,
        ),
      ],
    });
  });

  it('names the strongest shooting threat in the opponent starting XI', () => {
    const state = cupCareer(3, 2);
    const opponentClubId = warningFixtureOpponent(state);
    const opponent = pyramidOpponent(state, opponentClubId);
    const targetId = opponent.squad.find(
      (player) => player.role === 'FWD',
    )!.id;
    const tuned = withPyramidSquad(state, opponentClubId, (player) => {
      if (player.role === 'GK') return player;
      return player.id === targetId
        ? {
            ...player,
            name: 'Comet Boots',
            attrs: { ...player.attrs, sho: 999, tec: 999, pac: 999 },
          }
        : { ...player, attrs: { ...player.attrs, sho: 1, tec: 1, pac: 1 } };
    });

    expect(cupMismatchWarning(tuned)).toMatchObject({
      starPlayer: { playerId: targetId, playerName: 'Comet Boots' },
      body: [expect.any(String), expect.stringContaining('Comet Boots')],
    });
  });

  it('persists one dismissal per fixture and cannot complete an absent warning', () => {
    const state = cupCareer(2, 1);
    const fixtureId = cupMismatchWarning(state)!.fixtureId;
    const completed = completeCupMismatchWarning(state);

    expect(completed.eventFlags).toContain(cupMismatchWarningFlag(fixtureId));
    expect(cupMismatchWarning(completed)).toBeUndefined();
    expect(() => completeCupMismatchWarning(completed)).toThrow(
      'there is no Cup mismatch warning to complete',
    );
  });
});

/**
 * A GENUINE cross-division tie: the user is redrawn against a club that really
 * plays `divisionGap` tiers up and therefore exists only in the pyramid.
 *
 * This used to relabel the same-division play-in opponent in
 * `seedDivisionByClubId`, which left the club in `state.clubs` — so the club
 * lookup succeeded in the test and failed in every real career, and 27 of 27
 * driven cross-division ties shipped with no warning at all. The seed map is
 * now read exactly as the draw wrote it.
 */
function cupCareer(divisionGap: number, matchSeed: number): GameState {
  const state = createCareer(createLaunchCareerSetup(20260805));
  const cup = state.m2!.nationalCups.find(
    (candidate) => candidate.season === state.season,
  )!;
  const fixture = cup.rounds[0].fixtures.find(
    (candidate) =>
      candidate.homeClubId === state.userClubId ||
      candidate.awayClubId === state.userClubId,
  )!;
  const seedDivisions = cup.seedDivisionByClubId!;
  const userDivision = seedDivisions[state.userClubId];
  expect(userDivision).toBe(5);
  const opponentDivision = (userDivision - divisionGap) as DivisionLevel;
  const opponent =
    opponentDivision === userDivision
      ? // A same-division tie is the one case the club is already in the draw.
        state.clubs.find((club) => club.id !== state.userClubId)!
      : state.m2!.pyramid.divisions.find(
          (division) => division.level === opponentDivision,
        )!.clubs[0];
  expect(seedDivisions[opponent.id]).toBe(opponentDivision);

  return {
    ...state,
    week: CUP_SETTLEMENT_WEEKS[0],
    phase: 'matchday',
    m2: {
      ...state.m2!,
      nationalCups: state.m2!.nationalCups.map((candidate) =>
        candidate.season !== cup.season
          ? candidate
          : {
              ...candidate,
              rounds: candidate.rounds.map((round, roundIndex) =>
                roundIndex !== 0
                  ? round
                  : {
                      ...round,
                      fixtures: round.fixtures.map((candidateFixture) =>
                        candidateFixture.id === fixture.id
                          ? {
                              ...candidateFixture,
                              matchSeed,
                              homeClubId:
                                candidateFixture.homeClubId ===
                                state.userClubId
                                  ? state.userClubId
                                  : opponent.id,
                              awayClubId:
                                candidateFixture.awayClubId ===
                                state.userClubId
                                  ? state.userClubId
                                  : opponent.id,
                            }
                          : candidateFixture,
                      ),
                    },
              ),
            },
      ),
    },
  };
}

function pyramidOpponent(state: GameState, clubId: string) {
  return state.m2!.pyramid.divisions
    .flatMap((division) => division.clubs)
    .find((club) => club.id === clubId)!;
}

function withPyramidSquad(
  state: GameState,
  clubId: string,
  tune: (player: PyramidPlayer) => PyramidPlayer,
): GameState {
  return {
    ...state,
    m2: {
      ...state.m2!,
      pyramid: {
        ...state.m2!.pyramid,
        divisions: state.m2!.pyramid.divisions.map((division) => ({
          ...division,
          clubs: division.clubs.map((club) =>
            club.id === clubId ? { ...club, squad: club.squad.map(tune) } : club,
          ),
        })),
      },
    },
  };
}

function warningFixtureOpponent(state: GameState): string {
  const warning = cupMismatchWarning(state)!;
  const cup = state.m2!.nationalCups.find(
    (candidate) => candidate.season === state.season,
  )!;
  const fixture = cup.rounds
    .flatMap((round) => round.fixtures)
    .find((candidate) => candidate.id === warning.fixtureId)!;
  return fixture.homeClubId === state.userClubId
    ? fixture.awayClubId
    : fixture.homeClubId;
}
