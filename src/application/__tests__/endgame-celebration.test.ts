import { createCareer, type DivisionLevel, type GameState } from '../../game';
import { createLaunchCareerSetup } from '../launch';
import {
  championshipCelebrationFlag,
  hasPendingChampionshipCelebration,
} from '../championship-celebration';
import {
  GLOBAL_LEAGUE_WON_FLAG,
  NATIONAL_CUP_WON_FLAG,
  TRUE_ENDING_SEEN_FLAG,
  endgameCelebrationViewModel,
  highestFamePlayer,
  markEndgameCelebrationComplete,
  pendingEndgameCelebration,
} from '../endgame-celebration';
import { useM1Store } from '../store';

describe('the endgame celebrations', () => {
  describe('each trigger on its own', () => {
    it('fires the Global League screen on a first D1 title with the Cup unwon', () => {
      const state = careerAt({ division: 1, champions: true });

      expect(pendingEndgameCelebration(state)).toBe('global-league');
    });

    it('fires the Cup screen on a first Cup win with D1 unwon', () => {
      const state = careerAt({ division: 4, champions: true, cupWon: true });

      expect(pendingEndgameCelebration(state)).toBe('cup-winners');
    });

    it('fires nothing for a division title anywhere below the top', () => {
      const state = careerAt({ division: 5, champions: true });

      expect(pendingEndgameCelebration(state)).toBeUndefined();
      // And the ordinary per-season celebration is untouched by any of this.
      expect(hasPendingChampionshipCelebration(state)).toBe(true);
    });

    it('fires nothing for a D1 club that did not finish top', () => {
      const state = careerAt({ division: 1, champions: false });

      expect(pendingEndgameCelebration(state)).toBeUndefined();
    });

    /**
     * The three screens live inside the season transition, exactly as the
     * championship celebration and the awards ceremony do. A career still
     * playing its season has no boundary to present anything at.
     */
    it('fires nothing away from a season boundary', () => {
      const midSeason = {
        ...careerAt({ division: 1, champions: true }),
        phase: 'manage' as const,
      };

      expect(pendingEndgameCelebration(midSeason)).toBeUndefined();
    });
  });

  describe('completing the pair', () => {
    it('plays the true ending when the Cup arrives last', () => {
      const state = withFlags(
        careerAt({ division: 4, champions: false, cupWon: true }),
        [GLOBAL_LEAGUE_WON_FLAG],
      );

      expect(pendingEndgameCelebration(state)).toBe('true-ending');
    });

    it('plays the true ending when the D1 title arrives last', () => {
      const state = withFlags(careerAt({ division: 1, champions: true }), [
        NATIONAL_CUP_WON_FLAG,
      ]);

      expect(pendingEndgameCelebration(state)).toBe('true-ending');
    });

    it('plays the true ending when both land in the same season', () => {
      const state = careerAt({ division: 1, champions: true, cupWon: true });

      expect(pendingEndgameCelebration(state)).toBe('true-ending');
    });

    /**
     * The pair completing SUPERSEDES the individual moment. Without this the
     * manager would be told to go and win the Cup by one screen and thanked for
     * having won it by the next.
     */
    it('never shows the individual moment as well', () => {
      const cupLast = withFlags(
        careerAt({ division: 4, champions: false, cupWon: true }),
        [GLOBAL_LEAGUE_WON_FLAG],
      );
      const leagueLast = withFlags(careerAt({ division: 1, champions: true }), [
        NATIONAL_CUP_WON_FLAG,
      ]);

      [cupLast, leagueLast].forEach((state) => {
        const after = markEndgameCelebrationComplete(state);
        expect(pendingEndgameCelebration(after)).toBeUndefined();
        expect(after.eventFlags).toEqual(
          expect.arrayContaining([
            GLOBAL_LEAGUE_WON_FLAG,
            NATIONAL_CUP_WON_FLAG,
            TRUE_ENDING_SEEN_FLAG,
          ]),
        );
      });
    });
  });

  describe('a flag, once set, never fires again', () => {
    it.each([
      [
        'the Global League screen',
        { division: 1 as DivisionLevel, cupWon: false },
      ],
      ['the Cup screen', { division: 4 as DivisionLevel, cupWon: true }],
    ])('retires %s after it has been watched', (_label, setup) => {
      const state = careerAt({ ...setup, champions: true });
      const watched = markEndgameCelebrationComplete(state);

      expect(pendingEndgameCelebration(watched)).toBeUndefined();
      // Idempotent: a second completion dispatched at the same boundary must
      // not append the flag twice or invent a new state object.
      expect(markEndgameCelebrationComplete(watched)).toBe(watched);
    });

    it('never replays the true ending, whatever is won afterwards', () => {
      const seen = markEndgameCelebrationComplete(
        careerAt({ division: 1, champions: true, cupWon: true }),
      );
      const anotherTitle = { ...seen, season: seen.season + 1 };

      expect(pendingEndgameCelebration(anotherTitle)).toBeUndefined();
    });
  });

  describe('standing aside for the ordinary league celebration', () => {
    it('suppresses the ordinary screen for the first D1 title', () => {
      const state = careerAt({ division: 1, champions: true });

      expect(hasPendingChampionshipCelebration(state)).toBe(false);
      expect(pendingEndgameCelebration(state)).toBe('global-league');
    });

    it('gives the ordinary screen back for every D1 title after it', () => {
      const state = withFlags(careerAt({ division: 1, champions: true }), [
        GLOBAL_LEAGUE_WON_FLAG,
        NATIONAL_CUP_WON_FLAG,
        TRUE_ENDING_SEEN_FLAG,
      ]);

      expect(pendingEndgameCelebration(state)).toBeUndefined();
      expect(hasPendingChampionshipCelebration(state)).toBe(true);
    });

    /**
     * A lesser division's title in the season the Cup completed the pair. Both
     * screens are owed, because they are announcing two different results.
     */
    it('keeps the ordinary screen when the endgame is not about this title', () => {
      const state = withFlags(
        careerAt({ division: 3, champions: true, cupWon: true }),
        [GLOBAL_LEAGUE_WON_FLAG],
      );

      expect(hasPendingChampionshipCelebration(state)).toBe(true);
      expect(pendingEndgameCelebration(state)).toBe('true-ending');
    });
  });

  describe('the star', () => {
    it('is the highest-fame player, not the leading scorer', () => {
      const state = withFame(careerAt({ division: 1, champions: true }), {
        'bramble-rovers-p03': 88,
        'bramble-rovers-p10': 12,
      });

      expect(
        endgameCelebrationViewModel(state, 'Bert Rudge').star,
      ).toMatchObject({ id: 'bramble-rovers-p03', fame: 88 });
    });

    /**
     * Fame starts at zero for a whole squad, so the tiebreak is the case a real
     * first season actually hits. It is the deterministic ID order the rest of
     * the presentation uses — never the roster's order, which moves.
     */
    it('breaks ties on player ID, not on roster order', () => {
      const state = careerAt({ division: 1, champions: true });
      const squad = state.players.filter(
        (player) => player.clubId === state.userClubId,
      );
      const shuffled = { ...state, players: [...state.players].reverse() };

      expect(squad.every((player) => (player.fame ?? 0) === 0)).toBe(true);
      expect(highestFamePlayer(squad)?.id).toBe('bramble-rovers-p01');
      expect(endgameCelebrationViewModel(shuffled, 'Bert Rudge').star?.id).toBe(
        'bramble-rovers-p01',
      );
    });

    it('keeps a tied-on-fame man behind the leader whichever way the list came in', () => {
      const state = withFame(careerAt({ division: 1, champions: true }), {
        'bramble-rovers-p07': 40,
        'bramble-rovers-p02': 40,
      });

      expect(endgameCelebrationViewModel(state, 'Bert Rudge').star?.id).toBe(
        'bramble-rovers-p02',
      );
    });
  });

  describe('what each moment says', () => {
    it('points the D1 winner at the Cup and the Cup winner at the division', () => {
      const league = endgameCelebrationViewModel(
        careerAt({ division: 1, champions: true }),
        'Bert Rudge',
      );
      const cup = endgameCelebrationViewModel(
        careerAt({ division: 4, champions: true, cupWon: true }),
        'Bert Rudge',
      );

      expect(league.headline).toBe('GLOBAL LEAGUE CHAMPIONS');
      expect(league.lines.join(' ')).toContain('Hero Cup');
      expect(cup.headline).toBe('HERO CUP WINNERS');
      expect(cup.lines.join(' ')).toContain('D1');
    });

    it('gives the true ending several bubbles and no way to skip them', () => {
      const ending = endgameCelebrationViewModel(
        careerAt({ division: 1, champions: true, cupWon: true }),
        'Bert Rudge',
      );

      expect(ending.kind).toBe('true-ending');
      expect(ending.lines.length).toBeGreaterThan(3);
      expect(ending.skippable).toBe(false);
      // He is talking to the manager, and the whole speech is in the label so
      // nothing he says lives only in the animation.
      expect(ending.lines[0]).toContain('thank you');
      expect(ending.accessibilityLabel).toContain(ending.lines.at(-1));
    });

    it('lets the two trophy moments be skipped', () => {
      const league = endgameCelebrationViewModel(
        careerAt({ division: 1, champions: true }),
        'Bert Rudge',
      );

      expect(league.skippable).toBe(true);
      expect(league.squad.length).toBeGreaterThan(0);
    });

    /**
     * The true ending opens on one man and ends on the whole club: he speaks,
     * walks off, and everybody comes out for the curtain call. Handing that
     * screen an empty squad would leave nobody to bring on for it.
     */
    it('gives the true ending a squad to bring out behind the star', () => {
      const ending = endgameCelebrationViewModel(
        careerAt({ division: 1, champions: true, cupWon: true }),
        'Bert Rudge',
      );

      expect(ending.kind).toBe('true-ending');
      expect(ending.squad.length).toBeGreaterThan(0);
      expect(ending.squad.some((player) => player.id === ending.star?.id)).toBe(
        false,
      );
    });

    /**
     * TOTAL BY CONSTRUCTION. This screen sits inside the season transition and
     * its own completion is the only way off it, so a throw would strand a save
     * with no route to the recap.
     */
    it('still has copy for a club with nobody left to walk out', () => {
      const state = careerAt({ division: 1, champions: true, cupWon: true });
      const empty = {
        ...state,
        players: state.players.filter(
          (player) => player.clubId !== state.userClubId,
        ),
      };

      const viewModel = endgameCelebrationViewModel(empty, 'Bert Rudge');
      expect(viewModel.star).toBeUndefined();
      expect(viewModel.lines.length).toBeGreaterThan(3);
      expect(viewModel.squad).toEqual([]);
    });
  });

  describe('in the season transition', () => {
    beforeEach(() => {
      useM1Store.setState(useM1Store.getInitialState(), true);
    });

    it('stands between the final whistle and the awards, and only once', () => {
      const career = careerAt({ division: 1, champions: true });
      useM1Store.setState({ career, screen: 'management' });

      useM1Store.getState().advanceCareer();
      expect(useM1Store.getState().screen).toBe('endgame-celebration');

      useM1Store.getState().completeEndgameCelebration();
      expect(useM1Store.getState().screen).toBe('awards-ceremony');
      expect(useM1Store.getState().error).toBeNull();
    });

    /**
     * The bug this guards: marking the endgame complete un-suppresses the
     * ordinary league celebration, which would then announce the same title
     * seconds after the summit screen did.
     */
    it('does not hand the D1 title back to the ordinary celebration', () => {
      const career = careerAt({ division: 1, champions: true });
      useM1Store.setState({ career, screen: 'management' });

      useM1Store.getState().advanceCareer();
      useM1Store.getState().completeEndgameCelebration();

      const after = useM1Store.getState().career!;
      expect(useM1Store.getState().screen).not.toBe('championship-celebration');
      expect(after.eventFlags).toContain(
        championshipCelebrationFlag(after.season),
      );
      expect(hasPendingChampionshipCelebration(after)).toBe(false);
    });

    it('shows a lesser title first and the summit last', () => {
      const career = withFlags(
        careerAt({ division: 3, champions: true, cupWon: true }),
        [GLOBAL_LEAGUE_WON_FLAG],
      );
      useM1Store.setState({ career, screen: 'management' });

      useM1Store.getState().advanceCareer();
      expect(useM1Store.getState().screen).toBe('championship-celebration');

      useM1Store.getState().completeChampionshipCelebration();
      expect(useM1Store.getState().screen).toBe('endgame-celebration');

      useM1Store.getState().completeEndgameCelebration();
      expect(useM1Store.getState().screen).toBe('awards-ceremony');
    });

    it('cannot be re-entered by backing into it', () => {
      const career = careerAt({ division: 1, champions: true });
      useM1Store.setState({ career, screen: 'management' });
      useM1Store.getState().advanceCareer();
      useM1Store.getState().completeEndgameCelebration();

      // A stale route that still points at the celebration: completing it again
      // has to move on rather than trap the career on a watched cutscene.
      useM1Store.setState({ screen: 'endgame-celebration' });
      useM1Store.getState().completeEndgameCelebration();

      expect(useM1Store.getState().screen).toBe('awards-ceremony');
      expect(useM1Store.getState().error).toBeNull();
    });

    it('leaves the true ending for the title instead of contract renewals', () => {
      const career = careerAt({
        division: 1,
        champions: true,
        cupWon: true,
      });
      useM1Store.setState({ career, screen: 'management' });

      useM1Store.getState().advanceCareer();
      expect(useM1Store.getState().screen).toBe('endgame-celebration');

      useM1Store.getState().returnToTitleFromEnding();

      expect(useM1Store.getState().screen).toBe('welcome');
      expect(useM1Store.getState().career?.eventFlags).toContain(
        TRUE_ENDING_SEEN_FLAG,
      );
    });

    it('can start a fresh career directly after the true ending', () => {
      const career = careerAt({
        division: 1,
        champions: true,
        cupWon: true,
      });
      useM1Store.setState({ career, screen: 'management' });

      useM1Store.getState().advanceCareer();
      useM1Store.getState().completeEndgameCelebration();
      useM1Store.getState().startNewCareer(123, career.assistantMode);

      expect(useM1Store.getState().screen).toBe('create-player');
      expect(useM1Store.getState().career?.season).toBe(1);
      expect(useM1Store.getState().career?.careerSeed).toBe(123);
    });

    /**
     * Both orders, driven through the real screens. Neither is privileged: the
     * second trophy plays the true ending whichever one it is, and afterwards
     * the boundary carries on to the awards exactly as any other season does —
     * nothing is locked and nothing ends.
     */
    it('reaches the true ending with the Cup last', () => {
      const afterLeague = watchEndgame(
        careerAt({ division: 1, champions: true }),
      );
      expect(afterLeague.eventFlags).toContain(GLOBAL_LEAGUE_WON_FLAG);
      expect(afterLeague.eventFlags).not.toContain(TRUE_ENDING_SEEN_FLAG);

      const ended = watchEndgame(withCupWinner(afterLeague));

      expect(ended.eventFlags).toContain(TRUE_ENDING_SEEN_FLAG);
      expect(useM1Store.getState().screen).toBe('awards-ceremony');
    });

    it('reaches the true ending with the D1 title last', () => {
      const afterCup = watchEndgame(
        careerAt({ division: 4, champions: false, cupWon: true }),
      );
      expect(afterCup.eventFlags).toContain(NATIONAL_CUP_WON_FLAG);
      expect(afterCup.eventFlags).not.toContain(TRUE_ENDING_SEEN_FLAG);

      const ended = watchEndgame(inDivision(withLeagueTitle(afterCup), 1));

      expect(ended.eventFlags).toContain(TRUE_ENDING_SEEN_FLAG);
      expect(useM1Store.getState().screen).toBe('awards-ceremony');
    });
  });
});

/**
 * A finished season with the user's club parked in a chosen division.
 *
 * The pyramid is edited rather than played up to D1, because the trigger only
 * reads two things — the division the club is in, and who topped its table —
 * and simulating nine promotions to assert on those would test the ladder
 * instead of the celebration.
 */
function careerAt({
  division,
  champions,
  cupWon = false,
}: {
  division: DivisionLevel;
  champions: boolean;
  cupWon?: boolean;
}): GameState {
  const created = createCareer(createLaunchCareerSetup(777));
  const played: GameState = {
    ...withLeagueResults(created, champions),
    week: 30,
    phase: 'season-end',
  };
  const placed = inDivision(played, division);
  return cupWon ? withCupWinner(placed) : placed;
}

/** Every fixture played, with the user's club winning or losing all of them. */
function withLeagueResults(state: GameState, champions: boolean): GameState {
  return {
    ...state,
    fixtures: state.fixtures.map((fixture) => {
      const userIsHome = fixture.homeClubId === state.userClubId;
      const userIsAway = fixture.awayClubId === state.userClubId;
      return {
        ...fixture,
        status: 'played' as const,
        score: userIsHome
          ? { homeGoals: champions ? 3 : 0, awayGoals: champions ? 0 : 1 }
          : userIsAway
            ? { homeGoals: champions ? 0 : 1, awayGoals: champions ? 3 : 0 }
            : { homeGoals: 0, awayGoals: 0 },
      };
    }),
  };
}

function withLeagueTitle(state: GameState): GameState {
  return withLeagueResults(state, true);
}

/**
 * Runs a career through the celebration the way the app does: the boundary
 * router picks the screen, and the screen's own completion is the only exit.
 */
function watchEndgame(career: GameState): GameState {
  useM1Store.setState({ career, screen: 'management' });
  useM1Store.getState().advanceCareer();
  expect(useM1Store.getState().screen).toBe('endgame-celebration');
  useM1Store.getState().completeEndgameCelebration();
  return useM1Store.getState().career!;
}

/** Swaps the user's club into `level`, keeping every division ten clubs deep. */
function inDivision(state: GameState, level: DivisionLevel): GameState {
  const m2 = state.m2!;
  const from = m2.pyramid.divisions.find((division) =>
    division.clubs.some((club) => club.id === state.userClubId),
  )!;
  if (from.level === level) return state;
  const userClub = from.clubs.find((club) => club.id === state.userClubId)!;
  const displaced = m2.pyramid.divisions.find(
    (division) => division.level === level,
  )!.clubs[0];
  const divisions = m2.pyramid.divisions.map((division) => {
    if (division.level === from.level) {
      return {
        ...division,
        clubs: division.clubs.map((club) =>
          club.id === state.userClubId
            ? { ...displaced, division: from.level }
            : club,
        ),
      };
    }
    if (division.level === level) {
      return {
        ...division,
        clubs: division.clubs.map((club) =>
          club.id === displaced.id ? { ...userClub, division: level } : club,
        ),
      };
    }
    return division;
  });
  return { ...state, m2: { ...m2, pyramid: { ...m2.pyramid, divisions } } };
}

/** Hands the club the Hero Cup it entered. */
function withCupWinner(state: GameState): GameState {
  const m2 = state.m2!;
  return {
    ...state,
    m2: {
      ...m2,
      nationalCups: m2.nationalCups.map((cup, index) =>
        index === 0 ? { ...cup, championClubId: state.userClubId } : cup,
      ),
    },
  };
}

function withFlags(state: GameState, flags: readonly string[]): GameState {
  return { ...state, eventFlags: [...state.eventFlags, ...flags] };
}

function withFame(
  state: GameState,
  fameByPlayerId: Record<string, number>,
): GameState {
  return {
    ...state,
    players: state.players.map((player) =>
      fameByPlayerId[player.id] === undefined
        ? player
        : { ...player, fame: fameByPlayerId[player.id] },
    ),
  };
}
