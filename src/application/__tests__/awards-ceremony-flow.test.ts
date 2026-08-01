import { DEFAULT_CREATION_RATINGS, leagueStandings, type GameState } from '../../game';
import { divisionAwardPrizeTotal } from '../../game/division-award-prize';
import { currentUserDivision } from '../../game/m2-career';
import type {
  AwardCategoryId,
  DivisionAwardPlacement,
  SeasonRecap,
} from '../../game/types';
import {
  awardCeremonyStages,
  nextStageIndex,
  prizeStageIndex,
} from '../../ui/awards-ceremony-stage';
import { awardsCeremonyFlag, careerAwardCeremonyViewModel } from '../awards-ceremony';
import { useM1Store } from '../store';

const CATEGORIES: readonly AwardCategoryId[] = [
  'goals', 'passesCompleted', 'tacklesWon', 'saves',
];

describe('the awards ceremony in the season transition', () => {
  beforeEach(() => {
    useM1Store.setState(useM1Store.getInitialState(), true);
  });

  it('stands between the final whistle and the recap when the club did not win the league', () => {
    startAtSeasonEnd({ champions: false });

    useM1Store.getState().advanceCareer();
    expect(useM1Store.getState().screen).toBe('awards-ceremony');

    useM1Store.getState().completeAwardsCeremony();
    expect(useM1Store.getState().screen).toBe('season-end');
  });

  it('follows the championship celebration when the club did win it', () => {
    startAtSeasonEnd({ champions: true });

    useM1Store.getState().advanceCareer();
    expect(useM1Store.getState().screen).toBe('championship-celebration');

    useM1Store.getState().completeChampionshipCelebration();
    expect(useM1Store.getState().screen).toBe('awards-ceremony');

    useM1Store.getState().completeAwardsCeremony();
    expect(useM1Store.getState().screen).toBe('season-end');
  });

  /**
   * The ceremony is the one fixture of the boundary: the celebration only fires
   * for a title, so a season with nothing else to say still stops here.
   */
  it('is entered exactly once, from whichever direction the boundary is reached', () => {
    const career = startAtSeasonEnd({ champions: false });

    useM1Store.getState().advanceCareer();
    useM1Store.getState().completeAwardsCeremony();
    const flagged = useM1Store.getState().career!;
    expect(flagged.eventFlags).toContain(awardsCeremonyFlag(career.season));

    // Every other route into the boundary — a finished match, a week review,
    // and the recap's own advance — has to agree that it has been seen.
    useM1Store.getState().continueAfterMatch();
    expect(useM1Store.getState().screen).toBe('season-end');
    useM1Store.getState().continueWeekReview();
    expect(useM1Store.getState().screen).toBe('season-end');
  });

  it('cannot be re-entered by backing into it', () => {
    startAtSeasonEnd({ champions: false });
    useM1Store.getState().advanceCareer();
    useM1Store.getState().completeAwardsCeremony();

    // A stale route that still points at the ceremony: completing it again has
    // to land on the recap rather than trap the career on a watched cutscene.
    useM1Store.setState({ screen: 'awards-ceremony' });
    useM1Store.getState().completeAwardsCeremony();

    expect(useM1Store.getState().screen).toBe('season-end');
    expect(useM1Store.getState().error).toBeNull();
  });

  it('always has a way out, even entered with no recap to present', () => {
    const career = startAtSeasonEnd({ champions: false });
    useM1Store.setState({
      career: { ...career, seasonRecaps: [] },
      screen: 'awards-ceremony',
    });

    // A ceremony with nothing to show still renders four boards and a zero,
    // because a thrown view model here would strand the career: this screen is
    // inside the transition and its own completion is the only exit.
    const viewModel = careerAwardCeremonyViewModel(useM1Store.getState().career!);
    expect(viewModel.beats).toHaveLength(4);
    expect(viewModel.prize.totalTrainingPoints).toBe(0);

    useM1Store.getState().completeAwardsCeremony();
    expect(useM1Store.getState().screen).toBe('season-end');
  });

  describe('the Training Point grant', () => {
    it('lands once, at the transition, and never at the ceremony', () => {
      const career = startAtSeasonEnd({ champions: false, won: ['goals', 'saves'] });
      const before = career.trainingPoints;

      useM1Store.getState().advanceCareer();
      expect(useM1Store.getState().screen).toBe('awards-ceremony');
      // Watching the ceremony moves nothing. The screen is a presentation of a
      // grant the transition has not made yet.
      useM1Store.getState().completeAwardsCeremony();
      expect(useM1Store.getState().career!.trainingPoints).toBe(before);

      useM1Store.getState().advanceCareer();
      const after = useM1Store.getState().career!;
      const expected = divisionAwardPrizeTotal(currentUserDivision(after.m2!), 2);
      expect(after.trainingPoints).toBe(before + expected);
      expect(expected).toBeGreaterThan(0);
    });

    it('does not pay again on a second pass through the ceremony', () => {
      startAtSeasonEnd({ champions: false, won: ['goals', 'saves'] });
      useM1Store.getState().advanceCareer();
      useM1Store.getState().completeAwardsCeremony();
      useM1Store.getState().advanceCareer();
      const paid = useM1Store.getState().career!.trainingPoints;
      const nextSeason = useM1Store.getState().career!.season;

      useM1Store.setState({ screen: 'awards-ceremony' });
      useM1Store.getState().completeAwardsCeremony();

      expect(useM1Store.getState().career!.trainingPoints).toBe(paid);
      // And the new season's own ceremony is still owed: a completion dispatched
      // outside a boundary must not flag the season being played.
      expect(useM1Store.getState().career!.eventFlags)
        .not.toContain(awardsCeremonyFlag(nextSeason));
    });

    /**
     * Skipping is presentational and nothing else. Both of the screen's routes
     * to the prize — every tap, or one skip — are index moves over the same
     * stage list, and both leave through the same action, so both bank the same
     * figure.
     */
    it('pays the same whether the ceremony is watched or skipped', () => {
      const watched = runSeasonTransition('watch');
      useM1Store.setState(useM1Store.getInitialState(), true);
      const skipped = runSeasonTransition('skip');

      expect(skipped).toBe(watched);
      expect(skipped).toBeGreaterThan(0);
    });

    /**
     * The ceremony shows a projection computed before the transition runs, and
     * the transition then grants from the same pure function. If the projected
     * division ever drifted from the one the club is actually promoted into,
     * the manager would watch a figure the club never receives.
     */
    it.each([
      ['a club staying where it is', false],
      ['a promoted champion', true],
    ])('shows %s exactly what the transition then banks', (_label, champions) => {
      const career = startAtSeasonEnd({ champions, won: ['goals', 'saves'] });
      useM1Store.getState().advanceCareer();
      if (champions) useM1Store.getState().completeChampionshipCelebration();
      const projected = careerAwardCeremonyViewModel(useM1Store.getState().career!)
        .prize.totalTrainingPoints;

      useM1Store.getState().completeAwardsCeremony();
      useM1Store.getState().advanceCareer();

      const banked = useM1Store.getState().career!.trainingPoints - career.trainingPoints;
      expect(banked).toBe(projected);
      // Pinned so the two rows cannot quietly become the same case: a champion
      // is priced against D4, the division he is about to enter.
      expect(projected).toBe(divisionAwardPrizeTotal(champions ? 4 : 5, 2));
    });
  });
});

/**
 * The TP a full transition banks, driven through the screen's own stage machine
 * so "watched" and "skipped" are the two real routes and not two labels.
 */
function runSeasonTransition(style: 'watch' | 'skip'): number {
  const career = startAtSeasonEnd({ champions: false, won: ['goals', 'saves'] });
  useM1Store.getState().advanceCareer();

  const stages = awardCeremonyStages(
    careerAwardCeremonyViewModel(useM1Store.getState().career!),
  );
  let index = style === 'skip' ? prizeStageIndex(stages) : 0;
  while (stages[index]!.kind !== 'prize') index = nextStageIndex(stages, index);
  expect(stages[index]!.kind).toBe('prize');

  useM1Store.getState().completeAwardsCeremony();
  useM1Store.getState().advanceCareer();
  return useM1Store.getState().career!.trainingPoints - career.trainingPoints;
}

/**
 * A career parked on the last day of season one, with every fixture played.
 *
 * `champions` decides the user's results, and therefore whether the title
 * celebration stands in front of the ceremony. `won` names the boards the
 * user's club topped, which is what the transition pays for.
 */
function startAtSeasonEnd({
  champions,
  won = [],
}: {
  champions: boolean;
  won?: readonly AwardCategoryId[];
}): GameState {
  useM1Store.getState().startNewCareer(73_531);
  useM1Store.getState().completePlayerCreation({
    name: 'Jo Rook',
    ratings: DEFAULT_CREATION_RATINGS,
  });
  const current = useM1Store.getState().career!;
  const seasonEnd: GameState = {
    ...current,
    phase: 'season-end',
    fixtures: current.fixtures.map(fixture => {
      const userIsHome = fixture.homeClubId === current.userClubId;
      const userIsAway = fixture.awayClubId === current.userClubId;
      const userWins = champions;
      return {
        ...fixture,
        status: 'played' as const,
        score: userIsHome
          ? { homeGoals: userWins ? 3 : 0, awayGoals: userWins ? 0 : 1 }
          : userIsAway
            ? { homeGoals: userWins ? 0 : 1, awayGoals: userWins ? 3 : 0 }
            : { homeGoals: 0, awayGoals: 0 },
      };
    }),
  };
  const finished: GameState = {
    ...seasonEnd,
    seasonRecaps: [recapWonBy(seasonEnd, won)],
  };
  useM1Store.setState({ career: finished, screen: 'management' });
  return finished;
}

function recapWonBy(career: GameState, won: readonly AwardCategoryId[]): SeasonRecap {
  const divisionAwards = Object.fromEntries(CATEGORIES.map(category => [
    category,
    podium(won.includes(category) ? career.userClubId : 'rival-club'),
  ])) as Record<AwardCategoryId, DivisionAwardPlacement[]>;
  return {
    season: career.season,
    division: currentUserDivision(career.m2!),
    // Read off the finished table rather than invented: the recap's finish is
    // what the ceremony prices the prize against, and the transition promotes
    // from the same table. A hardcoded position would let the two disagree
    // without any test noticing.
    finalPosition: leagueStandings(career).find(row => row.clubId === career.userClubId)!.position,
    played: 18,
    won: 9,
    drawn: 4,
    lost: 5,
    goalsFor: 31,
    goalsAgainst: 24,
    cashChange: 4_200,
    closingCash: 21_500,
    trainingCapsReached: 0,
    cupResult: 'Round of 16',
    divisionAwards,
  };
}

function podium(winnerClubId: string): DivisionAwardPlacement[] {
  return [
    { playerId: 'p_first', playerName: 'First Place', clubId: winnerClubId, value: 21 },
    { playerId: 'p_second', playerName: 'Second Place', clubId: 'rival-club', value: 14 },
    { playerId: 'p_third', playerName: 'Third Place', clubId: 'other-club', value: 9 },
  ];
}
