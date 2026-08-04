import { loadLaunchContent } from '../../content';
import { createCareer } from '../../game';
import type { GameState } from '../../game/types';
import type { CoachCandidate } from '../../game/market';
import { createLaunchCareerSetup } from '../launch';
import { postMatchViewModel } from '../view-models';

const content = loadLaunchContent();

function careerWithStaff(seed: number, staff: { assistant: boolean }): {
  before: GameState;
  after: GameState;
  fixtureId: string;
  isHome: boolean;
} {
  const initial = createCareer(createLaunchCareerSetup(seed, undefined, content));
  const fixture = initial.fixtures.find(candidate => (
    candidate.homeClubId === initial.userClubId || candidate.awayClubId === initial.userClubId
  ))!;
  const candidates = initial.market?.coachCandidates ?? [];
  const headCoach = candidates[0] as CoachCandidate | undefined;
  if (headCoach === undefined) throw new Error('the launch career has no coach candidates');
  const assistantCoach = candidates[1] as CoachCandidate | undefined;
  if (staff.assistant && assistantCoach === undefined) {
    throw new Error('the launch career has only one coach candidate');
  }
  const withStaff: GameState = {
    ...initial,
    week: fixture.week,
    market: {
      ...initial.market!,
      headCoach,
      ...(staff.assistant ? { assistantCoach: assistantCoach! } : {}),
    },
  };
  return {
    before: { ...withStaff, phase: 'matchday' },
    after: { ...withStaff, phase: 'manage' },
    fixtureId: fixture.id,
    isHome: fixture.homeClubId === initial.userClubId,
  };
}

function reactionFor(
  seed: number,
  outcome: 'win' | 'draw' | 'loss',
  staff: { assistant: boolean },
) {
  const { before, after, fixtureId, isHome } = careerWithStaff(seed, staff);
  const goalsFor = outcome === 'win' ? 2 : outcome === 'draw' ? 1 : 0;
  const goalsAgainst = outcome === 'loss' ? 2 : 1;
  const score = isHome
    ? { homeGoals: goalsFor, awayGoals: goalsAgainst }
    : { homeGoals: goalsAgainst, awayGoals: goalsFor };
  return postMatchViewModel(before, after, fixtureId, score);
}

describe('full-time touchline reaction', () => {
  it('boxes the club that actually scored more, whoever the manager is', () => {
    const won = reactionFor(20260801, 'win', { assistant: false }).result;
    expect(won.winner).toBe(won.homeScore > won.awayScore ? 'home' : 'away');

    const drawn = reactionFor(20260801, 'draw', { assistant: false }).result;
    expect(drawn.winner).toBeNull();
  });

  it('celebrates a win and cries at a loss', () => {
    expect(reactionFor(20260802, 'win', { assistant: false }).reaction)
      .toMatchObject({ pose: 'joy' });
    expect(reactionFor(20260802, 'loss', { assistant: false }).reaction)
      .toMatchObject({ pose: 'cry' });
  });

  it('stands at rest for a draw and still says something', () => {
    // A draw used to return no reaction at all, which left the report with a
    // score and nothing under it. He has an opinion about a point too.
    const drawn = reactionFor(20260803, 'draw', { assistant: false }).reaction!;
    expect(drawn.pose).toBe('rest');
    expect(content.fulltimeCoachLines.leagueDraw).toContain(drawn.line);
  });

  it('says nothing at all without a coach in the building', () => {
    const { before, after, fixtureId } = careerWithStaff(20260803, { assistant: false });
    const coachless: GameState = { ...after, market: { ...after.market!, headCoach: undefined } };
    expect(postMatchViewModel(before, coachless, fixtureId, { homeGoals: 0, awayGoals: 2 }).reaction)
      .toBeUndefined();
  });

  it('reads a league result by how heavily it went', () => {
    const { before, after, fixtureId, isHome } = careerWithStaff(20260804, { assistant: false });
    const score = (goalsFor: number, goalsAgainst: number) => (isHome
      ? { homeGoals: goalsFor, awayGoals: goalsAgainst }
      : { homeGoals: goalsAgainst, awayGoals: goalsFor });
    const lineFor = (goalsFor: number, goalsAgainst: number) =>
      postMatchViewModel(before, after, fixtureId, score(goalsFor, goalsAgainst)).reaction!.line;

    // Three clear is a hiding either way; two is a Saturday.
    expect(content.fulltimeCoachLines.leagueWinBig).toContain(lineFor(4, 1));
    expect(content.fulltimeCoachLines.leagueWinClose).toContain(lineFor(3, 1));
    expect(content.fulltimeCoachLines.leagueLossClose).toContain(lineFor(1, 3));
    expect(content.fulltimeCoachLines.leagueLossBig).toContain(lineFor(1, 4));
  });

  it('never points at an assistant who is not there', () => {
    // Every seed, no assistant hired: the roll may come up, the blaming may not.
    for (let seed = 0; seed < 40; seed += 1) {
      const reaction = reactionFor(20260900 + seed, 'loss', { assistant: false }).reaction;
      expect(reaction?.pose).toBe('cry');
    }
  });

  it('blames the assistant about a third of the time, and says something real', () => {
    const poses: string[] = [];
    const lines = new Set<string>();
    for (let seed = 0; seed < 60; seed += 1) {
      const reaction = reactionFor(20261000 + seed, 'loss', { assistant: true }).reaction!;
      poses.push(reaction.pose);
      if (reaction.pose === 'point') {
        expect(reaction.assistantPortraitId).toBeDefined();
        expect(content.fulltimeBlameLines.lines).toContain(reaction.line);
        lines.add(reaction.line);
      } else {
        expect(reaction.pose).toBe('cry');
        // He is grieving the result rather than blaming a man for it, so the
        // line has to come from the defeat pool and not the blame pool.
        expect(content.fulltimeCoachLines.leagueLossClose).toContain(reaction.line);
        expect(content.fulltimeBlameLines.lines).not.toContain(reaction.line);
      }
    }
    const blamed = poses.filter(pose => pose === 'point').length;
    // One in three, loosely: a hash is not a coin, so this pins the shape of the
    // roll rather than a rate. A blame that fired every time, or never, fails.
    expect(blamed).toBeGreaterThan(6);
    expect(blamed).toBeLessThan(36);
    // And it is not the same outburst every time.
    expect(lines.size).toBeGreaterThan(3);
  });

  it('gives the same match the same reaction every time it is read', () => {
    const first = reactionFor(20261100, 'loss', { assistant: true }).reaction;
    const second = reactionFor(20261100, 'loss', { assistant: true }).reaction;
    expect(second).toEqual(first);
  });
});
