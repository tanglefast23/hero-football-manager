import { loadLaunchContent } from '../../content';
import { createCareer, type GameState } from '../../game';
import { createLaunchCareerSetup } from '../launch';
import { boardFinanceBriefing, homeViewModel } from '../view-models';

/**
 * The desk row is clipped to two lines, so the board's warning has never been
 * readable in full anywhere in the game. These pin the briefing that now says
 * the whole thing on the finances screen: the numbers it quotes, the escalation
 * it promises, and the closing instruction the manager is meant to act on.
 */
describe('the board finance briefing', () => {
  const content = loadLaunchContent();

  function career(seed: number, cash: number, safety: GameState['financialSafety']): GameState {
    const started = createCareer(createLaunchCareerSetup(seed, undefined, content));
    return {
      ...started,
      clubs: started.clubs.map(club => (
        club.id === started.userClubId ? { ...club, cash } : club
      )),
      financialSafety: safety,
    };
  }

  describe('the financial warning', () => {
    it('opens with the weeks in the red and the balance behind them', () => {
      const briefing = boardFinanceBriefing(
        career(20260901, -2540, { consecutiveNegativeWeeks: 1, emergencyLoanUsed: false }),
        'financial-warning',
      );

      expect(briefing?.title).toBe('Board financial warning');
      expect(briefing?.body[0]).toBe('The club has been in the red for 1 week. The balance is -$2,540.');
    });

    it('counts the grace weeks left before the board steps in', () => {
      // Cozy allows four negative weeks before the rescue fires, and the count
      // has already reached one, so three more are left.
      const briefing = boardFinanceBriefing(
        career(20260902, -2540, { consecutiveNegativeWeeks: 1, emergencyLoanUsed: false }),
        'financial-warning',
      );

      expect(briefing?.body[1]).toContain('3 more weeks in the red');
      expect(briefing?.body[1]).toContain('emergency loan');
    });

    /** A club that has spent its one rescue is warned about the real next step. */
    it('promises sales rather than a loan once the rescue is spent', () => {
      const briefing = boardFinanceBriefing(
        career(20260903, -8000, { consecutiveNegativeWeeks: 3, emergencyLoanUsed: true }),
        'financial-warning',
      );

      expect(briefing?.body[1]).toContain('1 more week in the red');
      expect(briefing?.body[1]).toContain('selling players');
      expect(briefing?.body[1]).not.toContain('emergency loan');
    });

    it('stops counting down once the grace weeks are gone', () => {
      const briefing = boardFinanceBriefing(
        career(20260904, -20000, { consecutiveNegativeWeeks: 6, emergencyLoanUsed: true }),
        'financial-warning',
      );

      expect(briefing?.body[1]).not.toContain('more week');
      expect(briefing?.body[1]).toContain('run out of patience');
    });

    it('closes on the instruction the manager can act on', () => {
      const briefing = boardFinanceBriefing(
        career(20260905, -2540, { consecutiveNegativeWeeks: 1, emergencyLoanUsed: false }),
        'financial-warning',
      );

      expect(briefing?.body.at(-1)).toBe(
        'If you have the funds to do so, create a facility to help earn more income.'
        + ' If not, the board is having an emergency meeting right now.',
      );
    });

    it('quotes the same week count as the desk row it came from', () => {
      // The row's two clipped lines and the briefing are the same message. A
      // week count that disagreed between them would read as a second problem.
      const state = career(20260906, -2540, { consecutiveNegativeWeeks: 2, emergencyLoanUsed: false });
      const row = homeViewModel(state).alerts.find(alert => alert.id === 'financial-warning');

      expect(row?.detail).toContain('negative for 2 weeks');
      expect(boardFinanceBriefing(state, 'financial-warning')?.body[0])
        .toContain('in the red for 2 weeks');
    });

    it('says nothing when the club is not in the red', () => {
      const state = career(20260907, 12000, { consecutiveNegativeWeeks: 0, emergencyLoanUsed: false });

      expect(boardFinanceBriefing(state, 'financial-warning')).toBeUndefined();
    });
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
        career(20260908, 15000, { consecutiveNegativeWeeks: 0, emergencyLoanUsed: true, loan }),
        'emergency-loan',
      );

      expect(briefing?.title).toBe('Emergency loan active');
      expect(briefing?.body[0]).toBe('The board’s emergency loan landed. $22,229 of it still has to go back.');
    });

    it('names the season the repayments start and rules out a second rescue', () => {
      const briefing = boardFinanceBriefing(
        career(20260909, 15000, { consecutiveNegativeWeeks: 0, emergencyLoanUsed: true, loan }),
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

      const briefing = boardFinanceBriefing({ ...started, season: 2 }, 'emergency-loan');

      expect(briefing?.body[1]).toContain('12 weeks of repayments left');
    });

    it('closes by pointing at income rather than at the deficit', () => {
      const briefing = boardFinanceBriefing(
        career(20260911, 15000, { consecutiveNegativeWeeks: 0, emergencyLoanUsed: true, loan }),
        'emergency-loan',
      );

      expect(briefing?.body.at(-1)).toBe(
        'Build something that earns while you sleep, like a shop or a stand,'
        + ' or the repayments will find you next season.',
      );
    });

    it('drops the next-season warning once the repayments are already running', () => {
      const started = career(20260912, 15000, {
        consecutiveNegativeWeeks: 0,
        emergencyLoanUsed: true,
        loan: { ...loan, remainingWeeks: 12 },
      });

      const briefing = boardFinanceBriefing({ ...started, season: 2 }, 'emergency-loan');

      expect(briefing?.body.at(-1)).toContain('Build something that earns while you sleep');
      expect(briefing?.body.at(-1)).not.toContain('next season');
    });

    it('says nothing when there is no loan to repay', () => {
      const state = career(20260913, 15000, { consecutiveNegativeWeeks: 0, emergencyLoanUsed: false });

      expect(boardFinanceBriefing(state, 'emergency-loan')).toBeUndefined();
    });
  });

  it('has nothing to say about any other desk row', () => {
    const state = career(20260914, -2540, { consecutiveNegativeWeeks: 1, emergencyLoanUsed: false });

    expect(boardFinanceBriefing(state, 'renewals')).toBeUndefined();
  });

  /** Every bubble is one tap. An empty one would be a tap that showed nothing. */
  it('says every line it promises', () => {
    const warning = boardFinanceBriefing(
      career(20260915, -2540, { consecutiveNegativeWeeks: 1, emergencyLoanUsed: false }),
      'financial-warning',
    );

    expect(warning?.body).toHaveLength(3);
    expect(warning?.body.every(line => line.trim().length > 0)).toBe(true);
  });
});
