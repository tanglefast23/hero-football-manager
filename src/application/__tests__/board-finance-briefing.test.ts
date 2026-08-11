import { loadLaunchContent } from '../../content';
import {
  buildCareerFacility,
  createCareer,
  createBoardUltimatum,
  dismissAssistantInboxProductForCurrentWeek,
  dismissAssistantInboxProductPermanently,
  type GameState,
} from '../../game';
import { createLaunchCareerSetup } from '../launch';
import {
  boardFacilityConversionBriefing,
  boardFinanceBriefing,
  homeViewModel,
} from '../view-models';

/**
 * The desk row is clipped to two lines, so the board's warning has never been
 * readable in full anywhere in the game. These pin the briefing that now says
 * the whole thing on the finances screen: the numbers it quotes, the escalation
 * it promises, and the closing instruction the manager is meant to act on.
 */
describe('the board finance briefing', () => {
  const content = loadLaunchContent();

  function career(
    seed: number,
    cash: number,
    safety: GameState['financialSafety'],
  ): GameState {
    const started = createCareer(
      createLaunchCareerSetup(seed, undefined, content),
    );
    return {
      ...started,
      clubs: started.clubs.map((club) =>
        club.id === started.userClubId ? { ...club, cash } : club,
      ),
      financialSafety: safety,
    };
  }

  describe('the financial warning', () => {
    it('opens with the weeks in the red and the balance behind them', () => {
      const briefing = boardFinanceBriefing(
        career(20260901, -2540, {
          consecutiveNegativeWeeks: 1,
          emergencyLoanUsed: false,
        }),
        'financial-warning',
      );

      expect(briefing?.title).toBe('Board financial warning');
      expect(briefing?.body[0]).toBe(
        'The club has been in the red for 1 week. The balance is -$2,540.',
      );
    });

    it('says the board will act next week once the first warning appears', () => {
      const briefing = boardFinanceBriefing(
        career(20260902, -2540, {
          consecutiveNegativeWeeks: 1,
          emergencyLoanUsed: false,
        }),
        'financial-warning',
      );

      expect(briefing?.body[1]).toBe(
        'Nothing can be bought while the balance is negative. No signings, no new building. The board will provide its emergency loan next week.',
      );
    });

    /** A club that has spent its one rescue is warned about the first ultimatum. */
    it('promises a building conversion before the board threatens players', () => {
      const briefing = boardFinanceBriefing(
        career(20260903, -8000, {
          consecutiveNegativeWeeks: 3,
          emergencyLoanUsed: true,
        }),
        'financial-warning',
      );

      expect(briefing?.body[1]).toContain('1 more week in the red');
      expect(briefing?.body[1]).toContain('replaces a non-essential building');
      expect(briefing?.body[1]).not.toContain('emergency loan');
    });

    it('promises player sales after the one facility conversion was used', () => {
      const briefing = boardFinanceBriefing(
        career(20260917, -8000, {
          consecutiveNegativeWeeks: 3,
          emergencyLoanUsed: true,
          facilityConversionUsed: true,
        }),
        'financial-warning',
      );

      expect(briefing?.body[1]).toContain('selling players');
      expect(briefing?.body[1]).not.toContain('replaces a non-essential');
    });

    it('stops counting down once the grace weeks are gone', () => {
      const briefing = boardFinanceBriefing(
        career(20260904, -20000, {
          consecutiveNegativeWeeks: 6,
          emergencyLoanUsed: true,
        }),
        'financial-warning',
      );

      expect(briefing?.body[1]).not.toContain('more week');
      expect(briefing?.body[1]).toContain('run out of patience');
    });

    it('tells the manager to wait while the board meets', () => {
      const briefing = boardFinanceBriefing(
        career(20260905, -2540, {
          consecutiveNegativeWeeks: 1,
          emergencyLoanUsed: false,
        }),
        'financial-warning',
      );

      expect(briefing?.body[2]).toBe(
        "Just sit tight, the board is discussing. There's not much you can do right now.",
      );
    });

    it('ends after the new wait message', () => {
      const briefing = boardFinanceBriefing(
        career(20260916, -2540, {
          consecutiveNegativeWeeks: 1,
          emergencyLoanUsed: false,
        }),
        'financial-warning',
      );

      expect(briefing?.body).toHaveLength(3);
    });

    it('quotes the same week count as the desk row it came from', () => {
      // The row's two clipped lines and the briefing are the same message. A
      // week count that disagreed between them would read as a second problem.
      const state = career(20260906, -2540, {
        consecutiveNegativeWeeks: 2,
        emergencyLoanUsed: false,
      });
      const row = homeViewModel(state).alerts.find(
        (alert) => alert.id === 'financial-warning',
      );

      expect(row?.detail).toContain('negative for 2 weeks');
      expect(
        boardFinanceBriefing(state, 'financial-warning')?.body[0],
      ).toContain('in the red for 2 weeks');
    });

    it('removes the warning after Bert finishes, but allows a new one next week', () => {
      const state = career(20260917, -2540, {
        consecutiveNegativeWeeks: 1,
        emergencyLoanUsed: false,
      });
      const dismissed = dismissAssistantInboxProductForCurrentWeek(
        state,
        'financial-warning',
      );

      expect(
        homeViewModel(dismissed).alerts.map((alert) => alert.id),
      ).not.toContain('financial-warning');
      expect(
        homeViewModel({ ...dismissed, week: dismissed.week + 1 }).alerts.map(
          (alert) => alert.id,
        ),
      ).toContain('financial-warning');
    });

    it('does not bring Bert back during the four red weeks after the one loan', () => {
      for (const consecutiveNegativeWeeks of [1, 2, 3]) {
        const state = career(20261010 + consecutiveNegativeWeeks, -2540, {
          consecutiveNegativeWeeks,
          emergencyLoanUsed: true,
        });

        expect(
          homeViewModel(state).alerts.map((alert) => alert.id),
        ).not.toContain('financial-warning');
      }
    });

    it('says nothing when the club is not in the red', () => {
      const state = career(20260907, 12000, {
        consecutiveNegativeWeeks: 0,
        emergencyLoanUsed: false,
      });

      expect(boardFinanceBriefing(state, 'financial-warning')).toBeUndefined();
    });
  });

  describe('the facility-to-sale handoff', () => {
    it.each([
      ['COMMERCIAL_LIMITS_REACHED', 'already has three Stadium Stands'],
      [
        'NO_REPLACEABLE_BUILDING',
        'Training Pitch and Coaching Office were protected',
      ],
      ['NO_SPACE', 'no legal space'],
    ] as const)(
      'explains %s before it threatens a player sale',
      (reason, copy) => {
        const base = career(20260920, -8000, undefined);
        const saleUltimatum = createBoardUltimatum(base);
        if (saleUltimatum === undefined) {
          throw new Error(
            'the briefing test career has too few sale candidates',
          );
        }
        const state: GameState = {
          ...base,
          financialSafety: {
            consecutiveNegativeWeeks: 0,
            emergencyLoanUsed: true,
            facilityConversionUsed: true,
            latestBoardResolution: {
              id: 'board-facility-ultimatum-test',
              kind: 'FACILITY_CONVERSION',
              resolvedSeason: base.season,
              resolvedWeek: base.week,
              targetCash: 0,
              addedFacilities: [],
              failureReason: reason,
            },
            boardUltimatum: saleUltimatum,
          },
        };

        const briefing = boardFacilityConversionBriefing(state);
        expect(briefing?.title).toBe('Facility plan blocked');
        expect(briefing?.body[0]).toContain(copy);
        expect(briefing?.body[1]).toContain('4 weeks remain');
        expect(briefing?.body[1]).toContain(
          'the board will sell one visible player',
        );
      },
    );
  });

  describe('the emergency loan', () => {
    const loan = {
      originalAmount: 20000,
      remainingBalance: 22229,
      repaymentStartsSeason: 2,
      remainingWeeks: 30,
    };

    it('leads with what is still owed', () => {
      const briefing = boardFinanceBriefing(
        career(20260908, 15000, {
          consecutiveNegativeWeeks: 0,
          emergencyLoanUsed: true,
          loan,
        }),
        'emergency-loan',
      );

      expect(briefing?.title).toBe('Emergency loan active');
      expect(briefing?.body[0]).toBe(
        'The board’s emergency loan landed. $22,229 of it still has to go back.',
      );
    });

    it('names the season the repayments start and rules out a second rescue', () => {
      const briefing = boardFinanceBriefing(
        career(20260909, 15000, {
          consecutiveNegativeWeeks: 0,
          emergencyLoanUsed: true,
          loan,
        }),
        'emergency-loan',
      );

      expect(briefing?.body[1]).toContain('Repayments begin in Season 2');
      expect(briefing?.body[1]).toContain('There is no second');
    });

    it('counts the repayment weeks down once they have started', () => {
      const started = career(20260910, 15000, {
        consecutiveNegativeWeeks: 0,
        emergencyLoanUsed: true,
        loan: { ...loan, remainingWeeks: 12 },
      });

      const briefing = boardFinanceBriefing(
        { ...started, season: 2 },
        'emergency-loan',
      );

      expect(briefing?.body[1]).toContain('12 weeks of repayments left');
    });

    it('explains the commercial build limits and points at more income', () => {
      const briefing = boardFinanceBriefing(
        career(20260911, 15000, {
          consecutiveNegativeWeeks: 0,
          emergencyLoanUsed: true,
          loan,
        }),
        'emergency-loan',
      );

      expect(briefing?.body.at(-1)).toBe(
        'Fan Shops earn money every week, while Stadium Stands improve home-match income.' +
          ' You can build up to three of each; every other facility is limited to one.' +
          ' Build another one now to create more income.',
      );
    });

    it('uses the same simple commercial rule once repayments are running', () => {
      const started = career(20260912, 15000, {
        consecutiveNegativeWeeks: 0,
        emergencyLoanUsed: true,
        loan: { ...loan, remainingWeeks: 12 },
      });

      const briefing = boardFinanceBriefing(
        { ...started, season: 2 },
        'emergency-loan',
      );

      expect(briefing?.body.at(-1)).toContain('up to three of each');
      expect(briefing?.body.at(-1)).toContain('Build another one now');
    });

    it('says to wait only when another construction project is active', () => {
      const borrowed = career(20260919, 15000, {
        consecutiveNegativeWeeks: 0,
        emergencyLoanUsed: true,
        loan,
      });
      const busy = buildCareerFacility(borrowed, 'training-pitch', {
        x: 0,
        y: 0,
      }).state;

      const briefing = boardFinanceBriefing(busy, 'emergency-loan');

      expect(briefing?.body.at(-1)).toContain(
        'works crew is busy with the Training Pitch',
      );
      expect(briefing?.body.at(-1)).toContain(
        'Wait until that construction finishes',
      );
      expect(
        boardFinanceBriefing(borrowed, 'emergency-loan')?.body.at(-1),
      ).not.toContain('Wait until');
    });

    it('retires the inbox card permanently after showing the highlighted income facilities', () => {
      const state = career(20260918, 15000, {
        consecutiveNegativeWeeks: 0,
        emergencyLoanUsed: true,
        loan,
      });
      const dismissed = dismissAssistantInboxProductPermanently(
        state,
        'emergency-loan',
      );

      expect(
        homeViewModel(dismissed).alerts.map((alert) => alert.id),
      ).not.toContain('emergency-loan');
      expect(
        homeViewModel({ ...dismissed, week: dismissed.week + 1 }).alerts.map(
          (alert) => alert.id,
        ),
      ).not.toContain('emergency-loan');
    });

    it('says nothing when there is no loan to repay', () => {
      const state = career(20260913, 15000, {
        consecutiveNegativeWeeks: 0,
        emergencyLoanUsed: false,
      });

      expect(boardFinanceBriefing(state, 'emergency-loan')).toBeUndefined();
    });
  });

  it('has nothing to say about any other desk row', () => {
    const state = career(20260914, -2540, {
      consecutiveNegativeWeeks: 1,
      emergencyLoanUsed: false,
    });

    expect(boardFinanceBriefing(state, 'renewals')).toBeUndefined();
  });

  /** Every bubble is one tap. An empty one would be a tap that showed nothing. */
  it('says every line it promises', () => {
    const warning = boardFinanceBriefing(
      career(20260915, -2540, {
        consecutiveNegativeWeeks: 1,
        emergencyLoanUsed: false,
      }),
      'financial-warning',
    );

    expect(warning?.body).toHaveLength(3);
    expect(warning?.body.every((line) => line.trim().length > 0)).toBe(true);
  });
});
