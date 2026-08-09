import { contributionsFrom } from '../../game/match-contributions';
import { goalsFrom } from '../../game/matchday';
import { createMatch, tick } from '../../sim/match';
import { ROVERS, UNITED } from '../../sim/teams';
import { DEFAULT_CREATION_RATINGS } from '../../game';
import { useM1Store } from '../store';
import { withRivalHeroIntrosSeen } from './rival-hero-intro-test-helper';

/**
 * The store builds its own FixtureResult from a watched MatchState instead of
 * going through fixtureResultFrom. This asserts the two agree, which is the
 * property that keeps watched and Quick Result leaderboards identical.
 */
describe('watched match contributions', () => {
  it('produces contributions consistent with the scorer list', () => {
    const match = createMatch(4242, ROVERS, UNITED, {
      homePolicy: 'FIRE_WHEN_READY',
      awayPolicy: 'FIRE_WHEN_READY',
    });
    while (match.phase !== 'fulltime') tick(match);

    const scorers = goalsFrom(match).map((goal) => goal.playerId);
    const contributions = contributionsFrom(match);
    const goalsByPlayer = new Map<string, number>();
    for (const row of contributions) {
      if (row.goals > 0) goalsByPlayer.set(row.playerId, row.goals);
    }
    const expected = new Map<string, number>();
    for (const id of scorers) expected.set(id, (expected.get(id) ?? 0) + 1);

    expect(scorers.length).toBeGreaterThan(0);
    expect(goalsByPlayer).toEqual(expected);
    expect(
      contributions.reduce((sum, row) => sum + row.saves, 0),
    ).toBeGreaterThan(0);
  });
});

/**
 * A watched result is handed to `resolveMatchday` already finished, and a
 * supplied result passes through verbatim: whatever the store leaves off it is
 * never recorded. Drop the contributions there and the season's stat lines fill
 * with the three simulated rivals while the player's own squad — the only match
 * they actually watched — is the one club missing from every leaderboard.
 */
describe('watched match stat lines', () => {
  beforeEach(() => {
    useM1Store.setState(useM1Store.getInitialState(), true);
  });

  it('records the watching club own squad alongside the simulated rivals', () => {
    useM1Store.getState().startNewCareer(2468);
    useM1Store.getState().completePlayerCreation({
      name: 'Jo Rook',
      ratings: DEFAULT_CREATION_RATINGS,
    });
    useM1Store.setState({
      career: withRivalHeroIntrosSeen(useM1Store.getState().career!),
    });
    advanceToMatchday();
    useM1Store.getState().watchMatch();
    const watched = useM1Store.getState().watchedMatch;
    if (watched === null)
      throw new Error('watched match context was not created');
    const match = createMatch(
      watched.fixture.matchSeed,
      watched.home,
      watched.away,
      {
        controlledTeam: watched.controlledTeam,
        homePolicy: 'FIRE_WHEN_READY',
        awayPolicy: 'FIRE_WHEN_READY',
      },
    );
    while (match.phase !== 'fulltime') tick(match);

    useM1Store.getState().finishWatchedMatch(match);

    const career = useM1Store.getState().career;
    if (career === null)
      throw new Error('the career went missing over the matchday');
    const lines = career.seasonStatLines ?? [];
    const ownLines = lines.filter((line) => line.clubId === career.userClubId);
    const ownPlayerIds = new Set(
      career.players
        .filter((player) => player.clubId === career.userClubId)
        .map((player) => player.id),
    );

    expect(ownLines.length).toBeGreaterThan(0);
    expect(ownLines.every((line) => ownPlayerIds.has(line.playerId))).toBe(
      true,
    );
    expect(ownLines.every((line) => line.competition === 'league')).toBe(true);
    expect(ownLines.reduce((sum, line) => sum + line.saves, 0)).toBeGreaterThan(
      0,
    );
    expect(
      ownLines.reduce((sum, line) => sum + line.tacklesWon, 0),
    ).toBeGreaterThan(0);
    // The rivals were simulated on the same matchday; both paths must record.
    expect(lines.some((line) => line.clubId !== career.userClubId)).toBe(true);
  });
});

function advanceToMatchday(): void {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const state = useM1Store.getState();
    if (state.screen === 'matchday') return;
    if (state.screen === 'week-review') {
      state.continueWeekReview();
      continue;
    }
    if (state.screen !== 'management') {
      throw new Error(
        `the career stopped on the ${state.screen} screen before a matchday`,
      );
    }
    state.advanceCareer();
    // The opening weeks hold Advance Week until the desk is clear. This test is
    // about match stat lines, so it answers the duty the cheapest way there is
    // — declining the youth intake is free and closes the window — and carries
    // on to the fixture it came for.
    const refused = useM1Store.getState().inboxDutyReminder;
    if (refused !== null) {
      useM1Store.getState().dismissInboxDutyReminder();
      if (!refused.includes('youth-intake')) {
        throw new Error(
          `the desk refused with ${refused.join(', ')} before a matchday`,
        );
      }
      useM1Store.getState().declineYouth();
    }
  }
  throw new Error('the career never reached a matchday');
}
