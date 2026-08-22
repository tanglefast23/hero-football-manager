import { loadLaunchContent } from '../../content';
import type {
  SponsorContractSnapshot,
  SponsorObjectiveSnapshot,
  SponsorshipState,
} from '../club-business-types';
import {
  acceptSponsorOffer,
  acceptSponsorWeeklyChallenge,
  actualSponsorPortfolioIncome,
  allocateSponsorPortfolioPayment,
  createProvisionalSponsorPortfolio,
  createSeasonSponsorship,
  divisionSponsorAnchor,
  expireSponsorOfferWindow,
  generateSponsorOffers,
  managedSponsorCapacity,
  nominalSponsorPortfolioIncome,
  settleSponsorObjectivesAtWeek30,
  settleSponsorWeeklyChallenge,
  sponsorBaselineShares,
  sponsorObjectiveProgressFromFixtures,
  sponsorWeeklyChallengeOptions,
} from '../sponsors';
import type { LeagueFixture } from '../types';

const RULES = loadLaunchContent().sponsors;

function seasonContext(
  overrides: Partial<Parameters<typeof createSeasonSponsorship>[0]> = {},
) {
  return {
    rules: RULES,
    careerSeed: 0x12345678,
    season: 3,
    division: 4 as const,
    highestDivisionReached: 4 as const,
    difficulty: 'COZY' as const,
    nominalAnchor: 4_000,
    ...overrides,
  };
}

function fixture(
  id: string,
  homeClubId: string,
  awayClubId: string,
  homeGoals: number,
  awayGoals: number,
  overrides: Partial<LeagueFixture> = {},
): LeagueFixture {
  return {
    id,
    season: 3,
    round: 1,
    week: 5,
    homeClubId,
    awayClubId,
    matchSeed: 1,
    status: 'played',
    score: { homeGoals, awayGoals },
    ...overrides,
  };
}

const FINAL_FIXTURES: LeagueFixture[] = [
  fixture('user-b', 'user', 'b', 2, 0),
  fixture('c-d', 'c', 'd', 1, 0),
  fixture('user-c', 'user', 'c', 1, 1, { round: 2, week: 7 }),
  fixture('b-d', 'b', 'd', 3, 0, { round: 2, week: 7 }),
];

describe('managed sponsor capacity and continuity', () => {
  it('permanently maps best division D4/D3/D2-or-D1 to one/two/three slots', () => {
    expect(
      [5, 4, 3, 2, 1].map((division) =>
        managedSponsorCapacity(division as 1 | 2 | 3 | 4 | 5),
      ),
    ).toEqual([0, 1, 2, 3, 3]);
  });

  it('uses the exact division anchors and puts all split remainder in slot zero', () => {
    expect(
      [5, 4, 3, 2, 1].map((division) =>
        divisionSponsorAnchor(division as 1 | 2 | 3 | 4 | 5),
      ),
    ).toEqual([3_000, 4_000, 6_000, 8_000, 10_000]);
    expect(sponsorBaselineShares(8_000, 3)).toEqual([2_668, 2_666, 2_666]);
    expect(sponsorBaselineShares(10_000, 3)).toEqual([3_334, 3_333, 3_333]);
    expect(sponsorBaselineShares(10, 3)).toEqual([4, 3, 3]);
  });

  it('creates provisional no-objective continuity whose sum preserves any exact scalar', () => {
    const contracts = createProvisionalSponsorPortfolio(8_003, 3, 7);

    expect(contracts.map((contract) => contract.nominalMonthlyFee)).toEqual([
      2_669, 2_667, 2_667,
    ]);
    expect(nominalSponsorPortfolioIncome(contracts)).toBe(8_003);
    expect(contracts.every((contract) => contract.provisional)).toBe(true);
    expect(
      contracts.every((contract) => contract.objective === undefined),
    ).toBe(true);
  });

  it('keeps one managed slot after a previously promoted club is relegated to D5', () => {
    const sponsorship = createSeasonSponsorship(
      seasonContext({
        division: 5,
        highestDivisionReached: 4,
        nominalAnchor: 2_000,
      }),
    );

    expect(sponsorship.activeContracts).toHaveLength(1);
    expect(sponsorship.activeContracts[0].nominalMonthlyFee).toBe(2_000);
    expect(sponsorship.offers).toHaveLength(3);
  });

  it('leaves a never-promoted D5 club on the basic scalar path', () => {
    const sponsorship = createSeasonSponsorship(
      seasonContext({
        division: 5,
        highestDivisionReached: 5,
        nominalAnchor: 2_000,
      }),
    );

    expect(sponsorship).toEqual({
      activeContracts: [],
      offers: [],
      portfolioSeason: 3,
    });
  });
});

describe('deterministic offers', () => {
  it('generates Steady, Balanced, and Bold per slot with unique brands where catalog permits', () => {
    const sponsorship = createSeasonSponsorship(
      seasonContext({
        division: 2,
        highestDivisionReached: 2,
        nominalAnchor: 8_000,
      }),
    );

    expect(sponsorship.offers).toHaveLength(9);
    expect(
      new Set(sponsorship.offers.map((offer) => offer.sponsorContentId)).size,
    ).toBe(9);
    for (const slot of [0, 1, 2]) {
      const slotOffers = sponsorship.offers.filter(
        (offer) => offer.slot === slot,
      );
      expect(slotOffers.map((offer) => offer.profile)).toEqual([
        'STEADY',
        'BALANCED',
        'BOLD',
      ]);
      expect(
        new Set(slotOffers.map((offer) => offer.objective.kind)).size,
      ).toBe(3);
    }
  });

  it('is byte-identical and does not call ambient random or time', () => {
    const random = jest.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('ambient random was called');
    });
    const now = jest.spyOn(Date, 'now').mockImplementation(() => {
      throw new Error('ambient time was called');
    });
    try {
      const first = createSeasonSponsorship(
        seasonContext({
          division: 2,
          highestDivisionReached: 2,
          nominalAnchor: 8_000,
        }),
      );
      const second = createSeasonSponsorship(
        seasonContext({
          division: 2,
          highestDivisionReached: 2,
          nominalAnchor: 8_000,
        }),
      );
      expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    } finally {
      random.mockRestore();
      now.mockRestore();
    }
  });

  it('applies the exact profile money and objective level to a slot share', () => {
    const offers = createSeasonSponsorship(seasonContext()).offers;
    const byProfile = Object.fromEntries(
      offers.map((offer) => [offer.profile, offer]),
    );

    expect(byProfile.STEADY.nominalMonthlyFee).toBe(4_200);
    expect(byProfile.BALANCED.nominalMonthlyFee).toBe(4_000);
    expect(byProfile.BOLD.nominalMonthlyFee).toBe(3_960);

    const levelByProfile = {
      STEADY: 'EASY',
      BALANCED: 'NORMAL',
      BOLD: 'HARD',
    } as const;
    for (const offer of offers) {
      const definition = RULES.objectives.find(
        (candidate) => candidate.kind === offer.objective.kind,
      )!;
      const profile = RULES.profiles[offer.profile];
      const bonusPercent =
        profile.bonusPercentByObjective?.[offer.objective.kind] ??
        profile.bonusPercent;
      expect(offer.objective.target).toBe(
        offer.objective.kind === 'LEAGUE_CLEAN_SHEETS'
          ? Math.max(
              1,
              Math.ceil(
                (definition.targets[levelByProfile[offer.profile]] - 1) / 2,
              ),
            )
          : definition.targets[levelByProfile[offer.profile]],
      );
      expect(offer.objective.label).toContain(String(offer.objective.target));
      expect(offer.objective.nominalBonus).toBe(
        Math.round((4_000 * bonusPercent) / 100),
      );
    }
  });

  it('keeps every D4 clean-sheet offer near half on Cozy and Chairman', () => {
    const targets = (difficulty: 'COZY' | 'CHAIRMAN') => {
      const byProfile = new Map(
        Array.from(
          { length: 50 },
          (_, careerSeed) =>
            createSeasonSponsorship(seasonContext({ careerSeed, difficulty }))
              .offers,
        )
          .flat()
          .filter((offer) => offer.objective.kind === 'LEAGUE_CLEAN_SHEETS')
          .map((offer) => [offer.profile, offer.objective.target] as const),
      );
      return [...byProfile.entries()].sort(([left], [right]) =>
        left.localeCompare(right),
      );
    };

    expect(targets('COZY')).toEqual([
      ['BALANCED', 2],
      ['BOLD', 3],
      ['STEADY', 1],
    ]);
    expect(targets('CHAIRMAN')).toEqual([
      ['BALANCED', 3],
      ['BOLD', 4],
      ['STEADY', 2],
    ]);
  });

  it('tightens every Chairman target without changing the deterministic candidate identity', () => {
    const cozy = createSeasonSponsorship(seasonContext()).offers;
    const chairman = createSeasonSponsorship(
      seasonContext({ difficulty: 'CHAIRMAN' }),
    ).offers;

    expect(
      chairman.map((offer) => [
        offer.offerId,
        offer.profile,
        offer.objective.kind,
      ]),
    ).toEqual(
      cozy.map((offer) => [offer.offerId, offer.profile, offer.objective.kind]),
    );
    for (let index = 0; index < cozy.length; index += 1) {
      const base = cozy[index].objective;
      const hard = chairman[index].objective;
      const definition = RULES.objectives.find(
        (objective) => objective.kind === base.kind,
      )!;
      expect(hard.target).toBe(base.target + definition.chairmanDelta);
    }
  });

  it('does not reuse an already-signed catalog brand while enough alternatives exist', () => {
    const initial = createSeasonSponsorship(
      seasonContext({
        division: 3,
        highestDivisionReached: 3,
        nominalAnchor: 6_000,
      }),
    );
    const signed = acceptSponsorOffer(initial, {
      offerId: initial.offers[0].offerId,
      season: 3,
      week: 1,
    });
    const regenerated = generateSponsorOffers({
      rules: RULES,
      careerSeed: 0x12345678,
      season: 3,
      division: 3,
      difficulty: 'COZY',
      activeContracts: signed.activeContracts,
    });

    expect(regenerated).toHaveLength(3);
    expect(regenerated.map((offer) => offer.slot)).toEqual([1, 1, 1]);
    expect(
      regenerated.some(
        (offer) =>
          offer.sponsorContentId === signed.activeContracts[0].sponsorContentId,
      ),
    ).toBe(false);
  });
});

describe('offer acceptance and expiry', () => {
  const openPortfolio = () =>
    createSeasonSponsorship(
      seasonContext({
        division: 3,
        highestDivisionReached: 3,
        nominalAnchor: 6_000,
      }),
    );

  it('atomically replaces one provisional slot and removes only its sibling offers', () => {
    const initial = openPortfolio();
    const chosen = initial.offers.find(
      (offer) => offer.slot === 0 && offer.profile === 'BALANCED',
    )!;
    const accepted = acceptSponsorOffer(initial, {
      offerId: chosen.offerId,
      season: 3,
      week: 4,
    });

    const first = accepted.activeContracts.find(
      (contract) => contract.slot === 0,
    )!;
    const second = accepted.activeContracts.find(
      (contract) => contract.slot === 1,
    )!;
    expect(first).toMatchObject({
      sponsorContentId: chosen.sponsorContentId,
      nominalMonthlyFee: chosen.nominalMonthlyFee,
      profile: 'BALANCED',
      provisional: false,
      signedSeason: 3,
      signedWeek: 4,
      replacedContinuity: true,
    });
    expect(first.objective).toEqual(chosen.objective);
    expect(second.provisional).toBe(true);
    expect(accepted.offers).toHaveLength(3);
    expect(accepted.offers.every((offer) => offer.slot === 1)).toBe(true);
    expect(
      initial.activeContracts.every((contract) => contract.provisional),
    ).toBe(true);
    expect(initial.offers).toHaveLength(6);
  });

  it('rejects stale, replayed, wrong-season, late, and already-locked actions with no mutation', () => {
    const initial = openPortfolio();
    const chosen = initial.offers[0];
    const accepted = acceptSponsorOffer(initial, {
      offerId: chosen.offerId,
      season: 3,
      week: 2,
    });
    const acceptedBefore = JSON.stringify(accepted);
    expect(() =>
      acceptSponsorOffer(accepted, {
        offerId: chosen.offerId,
        season: 3,
        week: 2,
      }),
    ).toThrow('no longer available');
    expect(JSON.stringify(accepted)).toBe(acceptedBefore);

    const initialBefore = JSON.stringify(initial);
    expect(() =>
      acceptSponsorOffer(initial, {
        offerId: chosen.offerId,
        season: 2,
        week: 2,
      }),
    ).toThrow('season');
    expect(() =>
      acceptSponsorOffer(initial, {
        offerId: chosen.offerId,
        season: 3,
        week: 5,
      }),
    ).toThrow('Weeks 1-4');
    const lockedButOfferPresent: SponsorshipState = {
      ...initial,
      activeContracts: initial.activeContracts.map((contract, index) =>
        index === 0 ? { ...contract, provisional: false } : contract,
      ),
    };
    expect(() =>
      acceptSponsorOffer(lockedButOfferPresent, {
        offerId: chosen.offerId,
        season: 3,
        week: 2,
      }),
    ).toThrow('already locked');
    expect(JSON.stringify(initial)).toBe(initialBefore);
  });

  it('keeps Week 4 open, then expires all offers and locks untouched continuity in Week 5', () => {
    const initial = openPortfolio();

    expect(expireSponsorOfferWindow(initial, 3, 4)).toBe(initial);
    const expired = expireSponsorOfferWindow(initial, 3, 5);
    expect(expired.offers).toEqual([]);
    expect(
      expired.activeContracts.every((contract) => !contract.provisional),
    ).toBe(true);
    expect(expireSponsorOfferWindow(expired, 3, 30)).toBe(expired);
  });
});

describe('portfolio difficulty allocation', () => {
  it('computes Chairman once on the D2 total, then allocates largest remainders by slot', () => {
    const contracts = createProvisionalSponsorPortfolio(8_000, 3, 3);
    const allocation = allocateSponsorPortfolioPayment(contracts, 80);

    expect(allocation.map((line) => line.actualAmount)).toEqual([
      2_134, 2_133, 2_133,
    ]);
    expect(allocation.reduce((sum, line) => sum + line.actualAmount, 0)).toBe(
      6_400,
    );
    expect(actualSponsorPortfolioIncome(contracts, 80)).toBe(6_400);
  });

  it('uses stable slot order to break equal D1 remainders', () => {
    const contracts = createProvisionalSponsorPortfolio(10_000, 3, 3).reverse();
    const allocation = allocateSponsorPortfolioPayment(contracts, 80);

    expect(allocation.map((line) => line.slot)).toEqual([0, 1, 2]);
    expect(allocation.map((line) => line.actualAmount)).toEqual([
      2_667, 2_667, 2_666,
    ]);
    expect(allocation.reduce((sum, line) => sum + line.actualAmount, 0)).toBe(
      8_000,
    );
  });
});

describe('one-match sponsor challenge', () => {
  it('offers two midseason targets and settles the chosen next fixture once', () => {
    const sponsorship = createSeasonSponsorship(seasonContext());
    const prior = fixture('prior', 'c', 'b', 1, 0, { week: 14 });
    const scheduled = fixture('sprint', 'user', 'b', 0, 0, {
      week: 16,
      status: 'scheduled',
      score: undefined,
    });

    expect(
      sponsorWeeklyChallengeOptions(
        sponsorship,
        [prior, scheduled],
        'user',
        3,
        14,
      ),
    ).toEqual([]);
    const options = sponsorWeeklyChallengeOptions(
      sponsorship,
      [prior, scheduled],
      'user',
      3,
      15,
    );
    expect(options.map((option) => option.kind)).toEqual([
      'SCORE_THREE',
      'CLEAN_SHEET',
    ]);
    expect(options[0]).toMatchObject({ fixtureWeek: 16, nominalBonus: 8_000 });

    const accepted = acceptSponsorWeeklyChallenge(
      sponsorship,
      [prior, scheduled],
      'user',
      3,
      15,
      'SCORE_THREE',
    );
    expect(
      settleSponsorWeeklyChallenge(
        accepted,
        [prior, scheduled],
        'user',
        3,
        80,
      ),
    ).toEqual({ sponsorship: accepted });

    const played = {
      ...scheduled,
      status: 'played' as const,
      score: { homeGoals: 3, awayGoals: 1 },
    };
    const settled = settleSponsorWeeklyChallenge(
      accepted,
      [prior, played],
      'user',
      3,
      80,
    );
    expect(settled.sponsorship.weeklyChallenge?.outcome).toEqual({
      met: true,
      actualBonus: 6_400,
    });
    expect(settled.payment).toMatchObject({ actualAmount: 6_400 });
    expect(
      settleSponsorWeeklyChallenge(
        settled.sponsorship,
        [prior, played],
        'user',
        3,
        80,
      ),
    ).toEqual({ sponsorship: settled.sponsorship });
  });

  it('offers no challenge against the current league leader', () => {
    const sponsorship = createSeasonSponsorship(seasonContext());
    const prior = fixture('leader-win', 'b', 'c', 2, 0, { week: 14 });
    const scheduled = fixture('visit-leader', 'user', 'b', 0, 0, {
      week: 16,
      status: 'scheduled',
      score: undefined,
    });

    expect(
      sponsorWeeklyChallengeOptions(
        sponsorship,
        [prior, scheduled],
        'user',
        3,
        15,
      ),
    ).toEqual([]);
  });
});

describe('fixture-derived sponsor objectives', () => {
  const objective = (
    kind: SponsorObjectiveSnapshot['kind'],
    target: number,
    nominalBonus = 1_000,
  ): SponsorObjectiveSnapshot => ({
    kind,
    target,
    nominalBonus,
    label: `${kind} ${target}`,
  });

  it('derives wins, goals, and exact table place from persisted league fixtures only', () => {
    const withNoise = [
      ...FINAL_FIXTURES,
      fixture('other-season', 'user', 'b', 20, 0, { season: 2 }),
      fixture('scheduled', 'user', 'd', 20, 0, {
        status: 'scheduled',
        score: undefined,
      }),
    ];

    expect(
      sponsorObjectiveProgressFromFixtures(
        objective('LEAGUE_WINS', 1),
        withNoise,
        'user',
        3,
      ),
    ).toEqual({ kind: 'LEAGUE_WINS', target: 1, value: 1, met: true });
    expect(
      sponsorObjectiveProgressFromFixtures(
        objective('LEAGUE_GOALS', 4),
        withNoise,
        'user',
        3,
      ),
    ).toEqual({ kind: 'LEAGUE_GOALS', target: 4, value: 3, met: false });
    expect(
      sponsorObjectiveProgressFromFixtures(
        objective('LEAGUE_FINISH', 1),
        withNoise,
        'user',
        3,
      ),
    ).toEqual({ kind: 'LEAGUE_FINISH', target: 1, value: 1, met: true });
  });

  it('derives tactical goals from clean sheets, three-goal games, and away points', () => {
    const tacticalFixtures = [
      ...FINAL_FIXTURES,
      fixture('b-user', 'b', 'user', 1, 3, { round: 3, week: 9 }),
      fixture('d-user', 'd', 'user', 0, 0, { round: 4, week: 11 }),
    ];

    expect(
      sponsorObjectiveProgressFromFixtures(
        objective('LEAGUE_CLEAN_SHEETS', 2),
        tacticalFixtures,
        'user',
        3,
      ),
    ).toEqual({
      kind: 'LEAGUE_CLEAN_SHEETS',
      target: 2,
      value: 2,
      met: true,
    });
    expect(
      sponsorObjectiveProgressFromFixtures(
        objective('LEAGUE_THREE_GOAL_GAMES', 2),
        tacticalFixtures,
        'user',
        3,
      ),
    ).toEqual({
      kind: 'LEAGUE_THREE_GOAL_GAMES',
      target: 2,
      value: 1,
      met: false,
    });
    expect(
      sponsorObjectiveProgressFromFixtures(
        objective('LEAGUE_AWAY_POINTS', 4),
        tacticalFixtures,
        'user',
        3,
      ),
    ).toEqual({
      kind: 'LEAGUE_AWAY_POINTS',
      target: 4,
      value: 4,
      met: true,
    });
  });

  it('settles Week 30 outcomes once and pays only met bonuses after portfolio difficulty', () => {
    const contracts: SponsorContractSnapshot[] = [
      {
        contractId: 'wins',
        sponsorContentId: 'wins',
        sponsorName: 'Wins Co',
        offerLine: 'Win',
        season: 3,
        slot: 0,
        nominalMonthlyFee: 1_000,
        provisional: false,
        objective: objective('LEAGUE_WINS', 1, 1_001),
      },
      {
        contractId: 'goals',
        sponsorContentId: 'goals',
        sponsorName: 'Goals Co',
        offerLine: 'Score',
        season: 3,
        slot: 1,
        nominalMonthlyFee: 1_000,
        provisional: false,
        objective: objective('LEAGUE_GOALS', 4, 8_000),
      },
      {
        contractId: 'finish',
        sponsorContentId: 'finish',
        sponsorName: 'Finish Co',
        offerLine: 'Place',
        season: 3,
        slot: 2,
        nominalMonthlyFee: 1_000,
        provisional: false,
        objective: objective('LEAGUE_FINISH', 1, 999),
      },
    ];
    const sponsorship: SponsorshipState = {
      activeContracts: contracts,
      offers: [],
      portfolioSeason: 3,
      offerSeason: 3,
    };

    expect(() =>
      settleSponsorObjectivesAtWeek30(
        sponsorship,
        FINAL_FIXTURES,
        'user',
        3,
        29,
        80,
      ),
    ).toThrow('Week 30');
    const settled = settleSponsorObjectivesAtWeek30(
      sponsorship,
      FINAL_FIXTURES,
      'user',
      3,
      30,
      80,
    );

    expect(
      settled.payments.map((payment) => [
        payment.contractId,
        payment.actualAmount,
      ]),
    ).toEqual([
      ['wins', 801],
      ['finish', 799],
    ]);
    expect(
      settled.sponsorship.activeContracts.map(
        (contract) => contract.objectiveOutcome,
      ),
    ).toEqual([
      { met: true, settledSeason: 3, actualBonus: 801 },
      { met: false, settledSeason: 3, actualBonus: 0 },
      { met: true, settledSeason: 3, actualBonus: 799 },
    ]);

    const repeated = settleSponsorObjectivesAtWeek30(
      settled.sponsorship,
      FINAL_FIXTURES,
      'user',
      3,
      30,
      80,
    );
    expect(repeated.sponsorship).toBe(settled.sponsorship);
    expect(repeated.payments).toEqual([]);
  });
});
