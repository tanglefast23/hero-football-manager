import { createMatch, queueInput, tick } from '../../sim/match';
import { HALF_TICKS } from '../../sim/geometry';
import { DEFAULT_CREATION_RATINGS } from '../../game';
import { useM1Store } from '../store';
import { withRivalHeroIntrosSeen } from './rival-hero-intro-test-helper';

/**
 * One speech is spent from the settled match's recorded input log, not from a
 * live callback during play. These two tests are the reason that matters: the
 * same finished match settles differently depending only on what the log says,
 * so the bank and the saved replay can never drift apart.
 *
 * The bank stacks, so this also pins the second half of the rule — a match that
 * used a speech takes ONE, and leaves the rest of the stock alone.
 */
describe('the banked speech and the settled match', () => {
  beforeEach(() => {
    useM1Store.setState(useM1Store.getInitialState(), true);
  });

  it('spends one banked speech when the match recorded one, and only then', () => {
    for (const withSpeech of [true, false]) {
      useM1Store.setState(useM1Store.getInitialState(), true);
      useM1Store.getState().startNewCareer(2468);
      useM1Store.getState().completePlayerCreation({
        name: 'Jo Rook',
        ratings: DEFAULT_CREATION_RATINGS,
      });
      useM1Store.setState({
        career: withRivalHeroIntrosSeen(useM1Store.getState().career!),
      });
      advanceToMatchday();
      // Bank TWO directly: how they were bought is the game ring's test, and
      // this one is about what the settled match does with the stock. Two
      // rather than one so a match that spends can be told from one that wipes.
      useM1Store.setState({
        career: { ...useM1Store.getState().career!, coachSpeechesBanked: 2 },
      });
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
      while (match.half === 1) tick(match);
      if (withSpeech) {
        queueInput(match, {
          tick: match.tick + 1,
          kind: 'MOTIVATIONAL_SPEECH',
          boost: 6,
        });
      }
      while (match.phase !== 'fulltime') tick(match);
      expect(match.tick).toBeGreaterThan(HALF_TICKS);

      useM1Store.getState().finishWatchedMatch(match);

      expect(useM1Store.getState().career?.coachSpeechesBanked).toBe(
        withSpeech ? 1 : 2,
      );
    }
  });
});

/**
 * Copied from `watched-match-contributions.test.ts` rather than shared: the
 * opening weeks hold Advance Week until each desk job is done, and lifting the
 * loop into a helper module would touch a passing suite for no gain here.
 */
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
    // The opening weeks hold Advance Week until the real desk jobs are done.
    // This test is about match stat lines, so it performs each requested action
    // and carries on to the fixture it came for.
    const refused = useM1Store.getState().inboxDutyReminder;
    if (refused !== null) {
      useM1Store.getState().dismissInboxDutyReminder();
      for (const duty of refused) {
        const current = useM1Store.getState();
        const career = current.career!;
        if (duty === 'facility-placement') {
          current.buildClubFacility('training-pitch', { x: 0, y: 0 });
        } else if (duty === 'head-coach-market') {
          const coachId = career.market?.coachCandidates[0]?.id;
          if (coachId === undefined)
            throw new Error('the opening coach candidate disappeared');
          current.hireCoach(coachId, 'HEAD');
        } else if (duty === 'youth-intake') {
          const youthId = career.youthIntake?.offers[0]?.player.id;
          if (youthId === undefined)
            throw new Error('the opening youth offer disappeared');
          current.signYouth(youthId);
        } else {
          current.buildClubFacility('coaching-office', { x: 2, y: 0 });
        }
      }
    }
  }
  throw new Error('the career never reached a matchday');
}
