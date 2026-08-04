import { postMatchViewModel } from '../../application/view-models';
import { loadLaunchContent } from '../../content';
import { cupGiantKillingCelebration } from '../../game/cup-giant-killing';
import type { GameState } from '../../game/types';
import { devHarnessCareerAtWeek } from '../dev-harness/career';

const content = loadLaunchContent();

/** A career with a head coach in the chair, so there is somebody to react. */
function staffedCareer2(season: number, week: number): GameState {
  const career = devHarnessCareerAtWeek(season, week);
  const candidates = career.market?.coachCandidates ?? [];
  if (career.market === undefined || candidates.length === 0) {
    throw new Error('the harness career has no coach candidates');
  }
  return {
    ...career,
    market: { ...career.market, headCoach: career.market.headCoach ?? candidates[0] },
  };
}

const staffedCareer = (week: number) => staffedCareer2(1, week);

function userCupTies(career: GameState) {
  return (career.m2?.nationalCups ?? [])
    .flatMap(cup => cup.rounds)
    .flatMap(round => round.fixtures)
    .filter(fixture => (
      fixture.homeClubId === career.userClubId || fixture.awayClubId === career.userClubId
    ));
}

/** How many divisions above the club its opponent was, as the draw froze it. */
function tiersAbove(career: GameState, fixtureId: string): number {
  const tie = userCupTies(career).find(fixture => fixture.id === fixtureId);
  if (tie === undefined) throw new Error(`no user cup tie ${fixtureId}`);
  const opponentClubId = tie.homeClubId === career.userClubId ? tie.awayClubId : tie.homeClubId;
  const seeds = career.m2?.nationalCups
    .find(cup => cup.rounds.some(round => round.fixtures.some(f => f.id === fixtureId)))
    ?.seedDivisionByClubId;
  const mine = seeds?.[career.userClubId];
  const theirs = seeds?.[opponentClubId];
  if (mine === undefined || theirs === undefined) throw new Error('cup tie has no seeded divisions');
  return mine - theirs;
}

/** The only tie in this career at this week sitting the given divisions apart. */
function tieByGap(career: GameState, gap: number): string {
  const found = userCupTies(career).find(fixture => tiersAbove(career, fixture.id) === gap);
  if (found === undefined) throw new Error(`no cup tie ${gap} divisions apart in this career`);
  return found.id;
}

function lineFor(career: GameState, fixtureId: string, mine: number, theirs: number): string {
  const tie = userCupTies(career).find(fixture => fixture.id === fixtureId)!;
  const score = tie.homeClubId === career.userClubId
    ? { homeGoals: mine, awayGoals: theirs }
    : { homeGoals: theirs, awayGoals: mine };
  const reaction = postMatchViewModel(career, career, fixtureId, score).reaction;
  if (reaction === undefined) throw new Error('the gaffer said nothing about a cup tie');
  return reaction.line;
}

describe('what the gaffer says about a cup tie', () => {
  // The draw is deterministic, so these are the two ties this career gets: a
  // club out of its own division, then one from the top of the pyramid. Week 6
  // and week 10 are chosen because each leaves its tie unresolved, which is
  // what lets a score decide the outcome rather than a recorded winner.
  const levelWeek = staffedCareer(6);
  const giantWeek = staffedCareer(10);
  const level = tieByGap(levelWeek, 0);
  const giant = tieByGap(giantWeek, 4);

  it('reads a tie by who it was against, whatever the margin', () => {
    // Same opponent, wildly different scorelines, one pool: a knockout is
    // remembered for who it was against, not for how heavy it got.
    expect(content.fulltimeCoachLines.cupWinSlight).toContain(lineFor(levelWeek, level, 1, 0));
    expect(content.fulltimeCoachLines.cupWinSlight).toContain(lineFor(levelWeek, level, 5, 0));
    expect(content.fulltimeCoachLines.cupLossEven).toContain(lineFor(levelWeek, level, 0, 1));
    expect(content.fulltimeCoachLines.cupLossEven).toContain(lineFor(levelWeek, level, 0, 5));
  });

  it('knows a giant when it beats one, and when it loses to one', () => {
    expect(content.fulltimeCoachLines.cupWinGiant).toContain(lineFor(giantWeek, giant, 2, 1));
    expect(content.fulltimeCoachLines.cupLossStrong).toContain(lineFor(giantWeek, giant, 1, 2));
  });

  it('takes a settled tie from the recorded winner, not from the score', () => {
    // By week 14 the cup has already had its say. A tie that is on the books as
    // a defeat stays a defeat even if the report is handed a winning scoreline.
    const settled = staffedCareer(14);
    expect(content.fulltimeCoachLines.cupLossStrong)
      .toContain(lineFor(settled, tieByGap(settled, 4), 4, 0));
  });

  it('never hands a cup tie one of the league lines', () => {
    const leagueLines = [
      ...content.fulltimeCoachLines.leagueWinBig,
      ...content.fulltimeCoachLines.leagueWinClose,
      ...content.fulltimeCoachLines.leagueLossBig,
      ...content.fulltimeCoachLines.leagueLossClose,
      ...content.fulltimeCoachLines.leagueDraw,
    ];
    expect(leagueLines).not.toContain(lineFor(levelWeek, level, 2, 1));
    expect(leagueLines).not.toContain(lineFor(levelWeek, level, 1, 2));
    expect(leagueLines).not.toContain(lineFor(giantWeek, giant, 2, 1));
  });

  it('gives the same tie the same line every time it is read', () => {
    expect(lineFor(giantWeek, giant, 2, 1)).toBe(lineFor(giantWeek, giant, 2, 1));
  });

  describe('when an earlier cup is still on the state', () => {
    /**
     * A season-2 career whose season-1 cup also seeded this season's opponent,
     * at the top of the pyramid instead of alongside us.
     *
     * Completed cups keep their seeding map for ten seasons
     * (`RETAINED_CUP_BRACKET_SEASONS`), so from season two there is always more
     * than one map on the state, and a club that was promoted or relegated
     * appears in them at different tiers. The club's own division moves too, so
     * reading the wrong map dates both sides of the subtraction at once.
     */
    function careerWithStaleSeeding(): { career: GameState; tie: string } {
      const base = staffedCareer2(2, 10);
      // An unresolved tie, so the scoreline still decides the outcome and both
      // the win and the defeat pools can be reached on the same fixture.
      const giant = userCupTies(base).find(fixture => (
        fixture.season === 2
        && fixture.winnerClubId === undefined
        && tiersAbove(base, fixture.id) >= 2
      ));
      if (giant === undefined) throw new Error('season 2 has no unplayed tie against a bigger club');
      const opponentClubId = giant.homeClubId === base.userClubId
        ? giant.awayClubId
        : giant.homeClubId;
      const cups = base.m2!.nationalCups.map(cup => (cup.season !== 1 ? cup : {
        ...cup,
        seedDivisionByClubId: {
          ...cup.seedDivisionByClubId!,
          // Level with us in last season's cup, well above us in this one.
          [opponentClubId]: base.m2!.nationalCups
            .find(candidate => candidate.season === 1)!
            .seedDivisionByClubId![base.userClubId]!,
        },
      }));
      return { career: { ...base, m2: { ...base.m2!, nationalCups: cups } }, tie: giant.id };
    }

    it('dates the tie by its own cup rather than the first map that mentions the club', () => {
      const { career, tie } = careerWithStaleSeeding();
      // Last season's cup would read this as a tie between equals. This season's
      // draw, the one actually being played, has them well above us.
      expect(content.fulltimeCoachLines.cupWinGiant).toContain(lineFor(career, tie, 2, 1));
      expect(content.fulltimeCoachLines.cupWinSlight).not.toContain(lineFor(career, tie, 2, 1));
      expect(content.fulltimeCoachLines.cupLossStrong).toContain(lineFor(career, tie, 1, 2));
      expect(content.fulltimeCoachLines.cupLossEven).not.toContain(lineFor(career, tie, 1, 2));
    });

    it('does not contradict Bert about the same win', () => {
      // Two surfaces read the same draw: the gaffer's bubble on the report, and
      // Bert's giant-killing overlay on top of it. Keyed off different cups they
      // can disagree about the size of the upset in front of the manager.
      const { career, tie } = careerWithStaleSeeding();
      const fixture = userCupTies(career).find(candidate => candidate.id === tie)!;
      expect(cupGiantKillingCelebration(career, fixture, career.userClubId)).toBeDefined();
      const line = lineFor(career, tie, 2, 1);
      const gafferSeesAnUpset = content.fulltimeCoachLines.cupWinGiant.includes(line)
        || content.fulltimeCoachLines.cupWinBetter.includes(line);
      expect(gafferSeesAnUpset).toBe(true);
    });
  });
});
