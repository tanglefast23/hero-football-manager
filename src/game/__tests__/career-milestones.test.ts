import { createLaunchCareerSetup } from '../../application/launch';
import { createCareer } from '../career';
import { compareIds } from '../ordering';
import {
  CAREER_MILESTONES,
  CAREER_MILESTONE_CROWD,
  CAREER_MILESTONE_HEAVY_DEFEAT_MARGIN,
  CAREER_MILESTONE_UNBEATEN_RUN,
  applyCareerEventOutcome,
  drainPendingMilestone,
  earnedCareerMilestoneFlags,
  isCareerMilestoneEventId,
  offerCareerEvent,
  recordCareerMilestones,
  seedPendingMilestones,
} from '../career-events';
import type { GameState } from '../types';

/** Marks the user club's first `count` fixtures played with the given results. */
function withUserResults(
  state: GameState,
  results: ReadonlyArray<{ goalsFor: number; goalsAgainst: number }>,
): GameState {
  const userFixtures = state.fixtures
    .filter(
      (fixture) =>
        fixture.season === state.season &&
        (fixture.homeClubId === state.userClubId ||
          fixture.awayClubId === state.userClubId),
    )
    .slice()
    .sort(
      (left, right) => left.week - right.week || compareIds(left.id, right.id),
    )
    .slice(0, results.length);
  const resultByFixtureId = new Map(
    userFixtures.map((fixture, index) => [fixture.id, results[index]]),
  );

  return {
    ...state,
    fixtures: state.fixtures.map((fixture) => {
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

function career(): GameState {
  return createCareer(createLaunchCareerSetup());
}

describe('the milestone set', () => {
  /**
   * Four of the original seven were cut. Winning a game is Saturday, not an
   * achievement, and "first hero goal", "three goals clear" and "eight wins in
   * a season" were the same congratulation three more times.
   */
  it('recognises six beats a manager would actually retell', () => {
    expect(CAREER_MILESTONES.map((milestone) => milestone.id)).toEqual([
      'hat-trick',
      'unbeaten-four',
      'first-cup-win',
      'crowd-thousand',
      'heavy-defeat',
      'merch-surge',
    ]);
  });

  it('no longer knows the four that were cut', () => {
    for (const retired of [
      'milestone-first-win',
      'milestone-first-hero-goal',
      'milestone-statement-win',
      'milestone-promotion-push',
    ]) {
      expect(isCareerMilestoneEventId(retired)).toBe(false);
    }
  });

  it('earns nothing before a ball is kicked', () => {
    expect(earnedCareerMilestoneFlags(career())).toEqual([]);
  });

  it('does not congratulate a club merely for winning', () => {
    const won = withUserResults(career(), [{ goalsFor: 3, goalsAgainst: 0 }]);
    expect(earnedCareerMilestoneFlags(won)).toEqual([]);
  });

  it('reads an unbeaten run off the results and resets it on a defeat', () => {
    const draws = Array.from({ length: CAREER_MILESTONE_UNBEATEN_RUN }, () => ({
      goalsFor: 1,
      goalsAgainst: 1,
    }));
    expect(
      earnedCareerMilestoneFlags(withUserResults(career(), draws)),
    ).toContain('milestone:unbeaten-four');

    const broken = [
      { goalsFor: 1, goalsAgainst: 1 },
      { goalsFor: 0, goalsAgainst: 1 },
      { goalsFor: 1, goalsAgainst: 1 },
      { goalsFor: 1, goalsAgainst: 1 },
    ];
    expect(
      earnedCareerMilestoneFlags(withUserResults(career(), broken)),
    ).not.toContain('milestone:unbeaten-four');
  });

  /** The first milestone that is not a celebration. */
  it('remembers a hammering, and only at six', () => {
    const five = withUserResults(career(), [{ goalsFor: 0, goalsAgainst: 5 }]);
    expect(earnedCareerMilestoneFlags(five)).not.toContain(
      'milestone:heavy-defeat',
    );

    const six = withUserResults(career(), [
      { goalsFor: 0, goalsAgainst: CAREER_MILESTONE_HEAVY_DEFEAT_MARGIN },
    ]);
    expect(earnedCareerMilestoneFlags(six)).toContain('milestone:heavy-defeat');
  });

  it('earns the crowd milestone from the club the manager actually runs', () => {
    const base = career();
    const big: GameState = {
      ...base,
      clubs: base.clubs.map((club) =>
        club.id === base.userClubId
          ? { ...club, fans: CAREER_MILESTONE_CROWD }
          : club,
      ),
    };
    expect(earnedCareerMilestoneFlags(big)).toContain(
      'milestone:crowd-thousand',
    );

    const rivalsOnly: GameState = {
      ...base,
      clubs: base.clubs.map((club) =>
        club.id === base.userClubId ? club : { ...club, fans: 99_999 },
      ),
    };
    expect(earnedCareerMilestoneFlags(rivalsOnly)).not.toContain(
      'milestone:crowd-thousand',
    );
  });

  it('earns the merchandise beat from a surge the report actually showed', () => {
    const base = career();
    const quiet: GameState = {
      ...base,
      ledgers: [
        {
          season: 1,
          week: 1,
          lines: [
            {
              source: 'merch',
              amount: 100,
              reveal: {
                source: 'merch',
                base: 100,
                variancePercent: 4,
                surge: false,
                multiplierTimes: 1,
                facilityCount: 1,
              },
            },
          ],
        },
      ],
    } as unknown as GameState;
    expect(earnedCareerMilestoneFlags(quiet)).not.toContain(
      'milestone:merch-surge',
    );

    const surged: GameState = {
      ...base,
      ledgers: [
        {
          season: 1,
          week: 1,
          lines: [
            {
              source: 'merch',
              amount: 100,
              reveal: {
                source: 'merch',
                base: 100,
                variancePercent: 15,
                surge: true,
                multiplierTimes: 1,
                facilityCount: 1,
              },
            },
          ],
        },
      ],
    } as unknown as GameState;
    expect(earnedCareerMilestoneFlags(surged)).toContain(
      'milestone:merch-surge',
    );
  });

  /**
   * A fixture keeps only its score once the week is settled — the scorer list
   * lives on the settlement result and is gone afterwards. So the hat-trick is
   * banked when it happens and read back from the flag, never recomputed.
   */
  it('reads the hat-trick from its banked flag, because it cannot be recomputed', () => {
    const banked: GameState = {
      ...career(),
      eventFlags: ['milestone:hat-trick'],
    };
    expect(earnedCareerMilestoneFlags(banked)).toContain('milestone:hat-trick');
  });

  it('is deterministic: the same career state always earns the same flags', () => {
    const state = withUserResults(career(), [
      { goalsFor: 1, goalsAgainst: 1 },
      { goalsFor: 0, goalsAgainst: 6 },
    ]);
    expect(earnedCareerMilestoneFlags(state)).toEqual(
      earnedCareerMilestoneFlags(state),
    );
  });
});

describe('the recognition queue', () => {
  const heavyDefeat = () =>
    withUserResults(career(), [{ goalsFor: 0, goalsAgainst: 7 }]);

  it('queues a beat when its flag is banked', () => {
    const recorded = recordCareerMilestones(heavyDefeat());
    expect(recorded.eventFlags).toContain('milestone:heavy-defeat');
    expect(recorded.pendingMilestones).toEqual([
      { eventId: 'milestone-heavy-defeat' },
    ]);
  });

  it('queues each beat once, however often the week is settled', () => {
    const once = recordCareerMilestones(heavyDefeat());
    const twice = recordCareerMilestones(once);
    expect(twice.pendingMilestones).toEqual([
      { eventId: 'milestone-heavy-defeat' },
    ]);
  });

  it('drains a beat once its card has been offered', () => {
    const recorded = recordCareerMilestones(heavyDefeat());
    expect(
      drainPendingMilestone(recorded, 'milestone-heavy-defeat')
        .pendingMilestones,
    ).toEqual([]);
  });

  /**
   * The hat-trick card has no picker, so a beat pointing at a player who has
   * left would be unanswerable. It is dropped rather than offered.
   */
  it('drops a queued beat whose player has left the club', () => {
    const base = career();
    const queued: GameState = {
      ...base,
      pendingMilestones: [
        {
          eventId: 'milestone-hat-trick',
          selectedPlayerId: 'someone-who-left',
        },
        { eventId: 'milestone-crowd-thousand' },
      ],
    };
    expect(
      drainPendingMilestone(queued, 'milestone-crowd-thousand')
        .pendingMilestones,
    ).toEqual([]);
  });

  it('seeds a save that banked a flag before the queue existed', () => {
    const banked: GameState = {
      ...career(),
      eventFlags: ['milestone:crowd-thousand'],
    };
    expect(seedPendingMilestones(banked).pendingMilestones).toEqual([
      { eventId: 'milestone-crowd-thousand' },
    ]);
  });

  it('never seeds a beat the manager has already seen', () => {
    const seen: GameState = {
      ...career(),
      eventFlags: ['milestone:crowd-thousand'],
      resolvedEventIds: ['milestone-crowd-thousand'],
    };
    expect(seedPendingMilestones(seen).pendingMilestones).toEqual([]);
  });

  it('leaves an already-seeded queue alone', () => {
    const queued: GameState = {
      ...career(),
      eventFlags: ['milestone:crowd-thousand'],
      pendingMilestones: [],
    };
    expect(seedPendingMilestones(queued).pendingMilestones).toEqual([]);
  });
});

describe('a story no longer drags a milestone along behind it', () => {
  /**
   * The defect this replaces: any resolved event with an earned-but-unseen
   * milestone had that milestone written into its `resolvedNextEventId`, so the
   * button said "Continue the story" and delivered an unrelated one — often
   * straight off a failure screen.
   */
  it('never invents a follow-up the author did not write', () => {
    const earned = recordCareerMilestones(
      withUserResults(career(), [{ goalsFor: 0, goalsAgainst: 8 }]),
    );
    const resolved = applyCareerEventOutcome(
      offerCareerEvent(earned, 'player-slump'),
      'a-choice',
      'Something happened and the week moved on.',
      {},
      { outcomeIndex: 0, risky: false, success: false },
    );

    expect(resolved.pendingEvent?.resolvedNextEventId).toBeUndefined();
    // The beat is not lost — it is waiting in its own lane instead.
    expect(resolved.pendingMilestones).toEqual([
      { eventId: 'milestone-heavy-defeat' },
    ]);
  });

  it('still carries an authored chain', () => {
    const resolved = applyCareerEventOutcome(
      offerCareerEvent(career(), 'rival-bid-arrives'),
      'a-choice',
      'The bid lands.',
      {},
      {
        outcomeIndex: 0,
        risky: false,
        success: false,
        nextEventId: 'rival-bid-deadline-day',
      },
    );
    expect(resolved.pendingEvent?.resolvedNextEventId).toBe(
      'rival-bid-deadline-day',
    );
  });
});
