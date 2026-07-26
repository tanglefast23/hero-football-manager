import { createLaunchCareerSetup } from '../../application/launch';
import { createCareer } from '../career';
import {
  CAREER_MILESTONES,
  CAREER_MILESTONE_CROWD,
  CAREER_MILESTONE_PUSH_SEASON_WINS,
  CAREER_MILESTONE_UNBEATEN_RUN,
  applyCareerEventOutcome,
  dismissCareerEvent,
  earnedCareerMilestoneFlags,
  isCareerMilestoneEventId,
  offerCareerEvent,
  pendingCareerMilestoneEventId,
  recordCareerMilestones,
} from '../career-events';
import type { GameState } from '../types';

/** Marks the user club's first `count` fixtures played with the given results. */
function withUserResults(
  state: GameState,
  results: ReadonlyArray<{ goalsFor: number; goalsAgainst: number }>,
): GameState {
  const userFixtures = state.fixtures
    .filter(fixture => fixture.season === state.season
      && (fixture.homeClubId === state.userClubId || fixture.awayClubId === state.userClubId))
    .slice()
    .sort((left, right) => left.week - right.week || left.id.localeCompare(right.id))
    .slice(0, results.length);
  const resultByFixtureId = new Map(userFixtures.map((fixture, index) => [fixture.id, results[index]]));

  return {
    ...state,
    fixtures: state.fixtures.map(fixture => {
      const result = resultByFixtureId.get(fixture.id);
      if (result === undefined) return fixture;
      const atHome = fixture.homeClubId === state.userClubId;
      return {
        ...fixture,
        status: 'played' as const,
        score: {
          homeGoals: atHome ? result.goalsFor : result.goalsAgainst,
          awayGoals: atHome ? result.goalsAgainst : result.goalsFor,
        },
      };
    }),
  };
}

function resolve(state: GameState, eventId: string): GameState {
  return applyCareerEventOutcome(
    offerCareerEvent(state, eventId),
    'a-choice',
    'Something happened and the week moved on.',
    {},
    { outcomeIndex: 0, risky: false, success: false },
  );
}

describe('career milestones derived from what the club did', () => {
  const fresh = createCareer(createLaunchCareerSetup(41));

  it('earns nothing before a ball is kicked', () => {
    expect(earnedCareerMilestoneFlags(fresh)).toEqual([]);
    expect(pendingCareerMilestoneEventId(fresh)).toBeUndefined();
    expect(recordCareerMilestones(fresh)).toBe(fresh);
  });

  it('reads a first win, a three-goal margin, and an unbeaten run off the results', () => {
    const oneNarrowWin = withUserResults(fresh, [{ goalsFor: 1, goalsAgainst: 0 }]);
    expect(earnedCareerMilestoneFlags(oneNarrowWin)).toEqual(['milestone:first-win']);

    const thumping = withUserResults(fresh, [{ goalsFor: 4, goalsAgainst: 1 }]);
    expect(earnedCareerMilestoneFlags(thumping)).toEqual([
      'milestone:first-win',
      'milestone:statement-win',
    ]);

    const unbeaten = withUserResults(fresh, Array.from(
      { length: CAREER_MILESTONE_UNBEATEN_RUN },
      () => ({ goalsFor: 1, goalsAgainst: 1 }),
    ));
    expect(earnedCareerMilestoneFlags(unbeaten)).toEqual(['milestone:unbeaten-four']);
  });

  it('resets an unbeaten run on a defeat and needs the full run again', () => {
    const brokenRun = withUserResults(fresh, [
      { goalsFor: 1, goalsAgainst: 1 },
      { goalsFor: 1, goalsAgainst: 1 },
      { goalsFor: 1, goalsAgainst: 1 },
      { goalsFor: 0, goalsAgainst: 2 },
      { goalsFor: 1, goalsAgainst: 1 },
    ]);
    expect(earnedCareerMilestoneFlags(brokenRun)).toEqual([]);
  });

  it('earns the promotion push only once the season wins pile up', () => {
    const nearly = withUserResults(fresh, Array.from(
      { length: CAREER_MILESTONE_PUSH_SEASON_WINS - 1 },
      () => ({ goalsFor: 1, goalsAgainst: 0 }),
    ));
    expect(earnedCareerMilestoneFlags(nearly)).not.toContain('milestone:promotion-push');

    const push = withUserResults(fresh, Array.from(
      { length: CAREER_MILESTONE_PUSH_SEASON_WINS },
      () => ({ goalsFor: 1, goalsAgainst: 0 }),
    ));
    expect(earnedCareerMilestoneFlags(push)).toContain('milestone:promotion-push');
  });

  it('earns a hero goal only for a user-club player who owns a power', () => {
    const hero = fresh.players.find(player => player.clubId === fresh.userClubId)!;
    const scoredWithoutPower: GameState = {
      ...fresh,
      seasonGoalTallies: [{ season: 1, playerId: hero.id, goals: 3 }],
    };
    expect(earnedCareerMilestoneFlags(scoredWithoutPower)).toEqual([]);

    const awakened: GameState = {
      ...scoredWithoutPower,
      players: scoredWithoutPower.players.map(player => player.id === hero.id
        ? { ...player, power: 'SUPER_SPEED' as const, licensed: true }
        : player),
    };
    expect(earnedCareerMilestoneFlags(awakened)).toEqual(['milestone:first-hero-goal']);
  });

  it('earns the crowd milestone from the club the player actually runs', () => {
    const packed: GameState = {
      ...fresh,
      clubs: fresh.clubs.map(club => ({ ...club, fans: CAREER_MILESTONE_CROWD })),
    };
    expect(earnedCareerMilestoneFlags(packed)).toEqual(['milestone:crowd-thousand']);

    const rivalsOnly: GameState = {
      ...fresh,
      clubs: fresh.clubs.map(club => club.id === fresh.userClubId
        ? club
        : { ...club, fans: CAREER_MILESTONE_CROWD * 10 }),
    };
    expect(earnedCareerMilestoneFlags(rivalsOnly)).toEqual([]);
  });

  it('earns a cup milestone from a won National Cup tie', () => {
    const cupWinner: GameState = {
      ...fresh,
      m2: {
        ...(fresh.m2 as NonNullable<GameState['m2']>),
        nationalCups: [{
          careerSeed: fresh.careerSeed,
          season: 1,
          rounds: [{
            number: 1,
            label: 'Play-in',
            entrantClubIds: [fresh.userClubId, 'ferrous-united'],
            byeClubIds: [],
            fixtures: [{
              id: 's1-cup-r1-m01',
              season: 1,
              round: 1,
              homeClubId: fresh.userClubId,
              awayClubId: 'ferrous-united',
              matchSeed: 12,
              status: 'played',
              score: { homeGoals: 2, awayGoals: 1 },
              winnerClubId: fresh.userClubId,
            }],
          }],
        }],
      },
    };
    expect(earnedCareerMilestoneFlags(cupWinner)).toEqual(['milestone:first-cup-win']);
  });

  it('is deterministic: the same career state always earns the same flags', () => {
    const played = withUserResults(fresh, [
      { goalsFor: 3, goalsAgainst: 0 },
      { goalsFor: 1, goalsAgainst: 1 },
    ]);
    const first = earnedCareerMilestoneFlags(played);

    for (let repeat = 0; repeat < 5; repeat += 1) {
      expect(earnedCareerMilestoneFlags(played)).toEqual(first);
      expect(earnedCareerMilestoneFlags(createCareer(createLaunchCareerSetup(41)))).toEqual([]);
    }
    expect(first).toEqual(['milestone:first-win', 'milestone:statement-win']);
  });
});

describe('milestone recognition rides the resolved-story chain', () => {
  const won = withUserResults(createCareer(createLaunchCareerSetup(41)), [
    { goalsFor: 3, goalsAgainst: 0 },
  ]);

  it('records the earned flags and follows the story with its recognition beat', () => {
    const resolved = resolve(won, 'team-bbq');

    expect(resolved.eventFlags).toEqual(['milestone:first-win', 'milestone:statement-win']);
    expect(resolved.pendingEvent?.resolvedNextEventId).toBe('milestone-first-win');
  });

  it('never overwrites a chain the content author already wrote', () => {
    const authored = applyCareerEventOutcome(
      offerCareerEvent(won, 'hundredth-fan'),
      'hundredth-fan-parade',
      'The parade blocks one roundabout.',
      { flags: ['hundredth-parade'] },
      { outcomeIndex: 0, risky: true, success: true, nextEventId: 'community-mural' },
    );

    expect(authored.pendingEvent?.resolvedNextEventId).toBe('community-mural');
  });

  it('hands out one recognition per story instead of a stack of cards', () => {
    const first = dismissCareerEvent(resolve(won, 'team-bbq'));
    expect(first.resolvedEventIds).toContain('team-bbq');

    // Resolving the recognition story itself must not chain into the next one.
    const recognized = resolve(first, 'milestone-first-win');
    expect(isCareerMilestoneEventId('milestone-first-win')).toBe(true);
    expect(recognized.pendingEvent?.resolvedNextEventId).toBeUndefined();

    // The remaining milestone is still queued for the next ordinary story.
    const afterRecognition = dismissCareerEvent(recognized);
    expect(pendingCareerMilestoneEventId(afterRecognition)).toBe('milestone-statement-win');
  });

  it('keeps a banked milestone claimable after its evidence leaves the state', () => {
    const banked = recordCareerMilestones(won);
    expect(banked.eventFlags).toContain('milestone:first-win');

    // Season rollover replaces `fixtures` with the new season's slate, so the
    // live recompute forgets the win. Recognition must survive on the banked
    // flag alone — recomputing from live state silently dropped any milestone
    // whose story had not resolved before the season turned.
    const rolledOver: GameState = {
      ...banked,
      fixtures: banked.fixtures.map(fixture => ({
        ...fixture,
        status: 'scheduled' as const,
        score: undefined,
      })),
    };
    expect(earnedCareerMilestoneFlags(rolledOver)).not.toContain('milestone:first-win');
    expect(pendingCareerMilestoneEventId(rolledOver)).toBe('milestone-first-win');
  });

  it('stops offering a recognition story once it has been seen', () => {
    const seen: GameState = {
      ...won,
      resolvedEventIds: CAREER_MILESTONES.map(milestone => milestone.eventId),
    };
    expect(pendingCareerMilestoneEventId(seen)).toBeUndefined();
    expect(resolve(seen, 'team-bbq').pendingEvent?.resolvedNextEventId).toBeUndefined();
  });

  it('leaves a plain test resolution without presentation data untouched', () => {
    const resolved = applyCareerEventOutcome(
      offerCareerEvent(won, 'team-bbq'),
      'captain-cooks-bbq',
      'The feast is magnificent.',
      {},
    );

    expect(resolved.pendingEvent?.resolvedNextEventId).toBeUndefined();
    expect(resolved.eventFlags).toContain('milestone:first-win');
  });
});
