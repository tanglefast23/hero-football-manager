import {
  marketNegotiationViewModel,
  offerQuoteKey,
} from '../market-view-model';
import {
  startContractNegotiation,
  submitContractOffer,
  type ContractNegotiation,
} from '../../game/market';

const opened = () => startContractNegotiation({
  careerSeed: 20260807,
  negotiationId: 'renewal-s1-jobo',
  playerId: 'jobo',
  personality: 'PROFESSIONAL',
  weeklyAsk: 856,
});

const view = (negotiation: ContractNegotiation) => marketNegotiationViewModel({
  state: negotiation,
  playerName: 'Jobo',
  openingWeeklyWage: 600,
  wageStep: 50,
});

/** Counters twice, which is what puts the agent in his closing round. */
function toFinalRound(): ContractNegotiation {
  const lowball = { weeklyWage: 500, termSeasons: 1 as const, perk: 'JERSEY_10' as const };
  const first = submitContractOffer(opened(), lowball);
  return submitContractOffer(first, lowball);
}

describe('the wage the panel quotes', () => {
  it('is offered for every term and promise the manager can dial in', () => {
    const quotes = view(opened()).requiredWeeklyWageByOffer;
    for (const term of [1, 2, 3]) {
      for (const perk of ['GUARANTEED_STARTER', 'CAPTAINCY', 'TRAINING_PRIORITY', 'JERSEY_10'] as const) {
        expect({ term, perk, quoted: quotes[offerQuoteKey(term, perk)] !== undefined })
          .toEqual({ term, perk, quoted: true });
      }
    }
  });

  it('quotes each unused pitch card too, so the readout moves when one is picked', () => {
    const negotiation = opened();
    const quotes = view(negotiation).requiredWeeklyWageByOffer;
    for (const card of negotiation.pitchCards) {
      expect(quotes[offerQuoteKey(3, 'CAPTAINCY', card)]).toBeDefined();
    }
  });

  it('goes down as the manager gives more away', () => {
    const quotes = view(opened()).requiredWeeklyWageByOffer;
    expect(quotes[offerQuoteKey(3, 'GUARANTEED_STARTER')]!)
      .toBeLessThan(quotes[offerQuoteKey(1, 'JERSEY_10')]!);
  });

  it('renders a table rather than a closure, so the view model stays plain data', () => {
    // View models here are snapshotted and compared in tests. A function on one
    // would survive typechecking and break all of that silently.
    const quotes = view(opened()).requiredWeeklyWageByOffer;
    expect(JSON.parse(JSON.stringify(quotes))).toEqual(quotes);
  });
});

describe('the agent s closing ultimatum', () => {
  it('is absent until the final round', () => {
    expect(view(opened()).finalDemand).toBeUndefined();
    const afterOne = submitContractOffer(opened(), {
      weeklyWage: 500, termSeasons: 1, perk: 'JERSEY_10',
    });
    expect(view(afterOne).finalDemand).toBeUndefined();
  });

  it('arrives in the last round, naming a figure', () => {
    const demand = view(toFinalRound()).finalDemand;
    expect(demand).toBeDefined();
    expect(demand!.weeklyWage).toBeGreaterThan(0);
    // The line is the whole beat. One with no number in it would be an agent
    // refusing to say what he wants.
    expect(demand!.line).toContain('$');
    expect(demand!.line).not.toContain('{wage}');
  });

  it('names the figure that is actually accepted', () => {
    const negotiation = toFinalRound();
    const demand = view(negotiation).finalDemand!;
    const signed = submitContractOffer(negotiation, {
      weeklyWage: demand.weeklyWage,
      termSeasons: demand.termSeasons,
      perk: demand.perk,
    });
    // The one promise this screen cannot break: he said this number, so this
    // number has to sign him.
    expect(signed.status).toBe('ACCEPTED');
  });

  it('holds the term and promise the manager last offered', () => {
    const demand = view(toFinalRound()).finalDemand!;
    expect(demand.termSeasons).toBe(1);
    expect(demand.perk).toBe('JERSEY_10');
  });

  it('says the same thing every time the panel re-renders', () => {
    const negotiation = toFinalRound();
    expect(view(negotiation).finalDemand!.line).toBe(view(negotiation).finalDemand!.line);
  });

  it('is gone once talks have ended', () => {
    const negotiation = toFinalRound();
    const walked = submitContractOffer(negotiation, {
      weeklyWage: 500, termSeasons: 1, perk: 'JERSEY_10',
    });
    expect(walked.status).toBe('REJECTED');
    expect(view(walked).finalDemand).toBeUndefined();
  });
});

describe('a drifted negotiation degrades instead of crashing the screen', () => {
  it('renders an empty quote table rather than throwing', () => {
    // A hand-built or migrated negotiation missing its dealt cards. The engine
    // is right to reject it; the panel must still open so the manager can close
    // the talks.
    const drifted = { ...opened(), pitchCards: [], usedPitchCards: [] } as ContractNegotiation;
    expect(() => view(drifted)).not.toThrow();
    expect(view(drifted).requiredWeeklyWageByOffer).toEqual({});
    expect(view(drifted).finalDemand).toBeUndefined();
  });
});
