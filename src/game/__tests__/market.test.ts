import type { Attrs, Role } from '../../sim/types';
import {
  buyingTransferQuote,
  coachLevelAfterSeasons,
  contractOfferValue,
  dealPitchCards,
  effectiveContractAsk,
  generateCoachMarket,
  isCoachCandidateEligible,
  isTransferWindowOpen,
  maxCoachLevelForClub,
  pitchCardAffinity,
  playerValuation,
  renewalContractAsk,
  resolveScoutMission,
  scoutAttributeRanges,
  sellingTransferQuote,
  startContractNegotiation,
  startScoutMission,
  submitContractOffer,
  type PitchCard,
  type PlayerPersonality,
  type ScoutablePlayer,
  type ValuationPlayer,
} from '../market';

const BASE_ATTRS: Attrs = {
  pac: 50,
  sho: 50,
  pas: 50,
  def: 50,
  tec: 50,
  sta: 50,
  ref: 50,
};

function marketPlayer(
  id: string,
  options: Partial<Omit<ScoutablePlayer, 'id' | 'attrs'>> & { attrs?: Attrs } = {},
): ScoutablePlayer {
  return {
    id,
    region: options.region ?? 'EUROPE',
    role: options.role ?? 'MID',
    age: options.age ?? 25,
    attrs: options.attrs ?? { ...BASE_ATTRS },
    potential: options.potential ?? 3,
    personality: options.personality ?? 'PROFESSIONAL',
    power: options.power,
    powerTier: options.powerTier,
    contractSeasonsRemaining: options.contractSeasonsRemaining ?? 2,
  };
}

function valuationPlayer(
  id: string,
  options: {
    role?: Role;
    attrs?: Attrs;
    age?: number;
    potential?: number;
    power?: 'SUPER_SPEED';
    powerTier?: number;
    contractSeasonsRemaining?: number;
  } = {},
): ValuationPlayer {
  return {
    id,
    role: options.role ?? 'MID',
    attrs: options.attrs ?? { ...BASE_ATTRS },
    age: options.age ?? 25,
    potential: options.potential ?? 3,
    power: options.power,
    powerTier: options.powerTier,
    contractSeasonsRemaining: options.contractSeasonsRemaining ?? 2,
  };
}

describe('deterministic scouting', () => {
  const candidates: ScoutablePlayer[] = [
    marketPlayer('mid-a'),
    marketPlayer('mid-b', { age: 20, potential: 5 }),
    marketPlayer('mid-c', { power: 'SUPER_SPEED', powerTier: 1 }),
    marketPlayer('forward', { role: 'FWD' }),
    marketPlayer('local-mid', { region: 'LOCAL' }),
  ];

  it('schedules a 2-3 week mission and resolves the same filtered shortlist from the same seed', () => {
    const mission = startScoutMission({
      careerSeed: 8128,
      missionId: 'mission-1',
      startWeek: 31,
      region: 'EUROPE',
      focus: { kind: 'POSITION', role: 'MID' },
      scoutOfficeLevel: 2,
      division: 4,
    });

    expect(mission.dueWeek - mission.startWeek).toBeGreaterThanOrEqual(2);
    expect(mission.dueWeek - mission.startWeek).toBeLessThanOrEqual(3);
    expect(mission.cost).toBeGreaterThanOrEqual(1000);
    expect(mission.cost).toBeLessThanOrEqual(5000);
    expect(() => resolveScoutMission(mission, mission.dueWeek - 1, candidates)).toThrow(
      'not complete yet',
    );

    const first = resolveScoutMission(mission, mission.dueWeek, candidates);
    const reordered = resolveScoutMission(mission, mission.dueWeek, candidates.slice().reverse());

    expect(JSON.stringify(first)).toBe(JSON.stringify(reordered));
    expect(first.reports).toHaveLength(3);
    expect(first.reports.every(report => report.playerId.startsWith('mid-'))).toBe(true);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
  });

  it('narrows every fuzzy range as the Scout Office improves and never excludes the truth', () => {
    const levelOne = scoutAttributeRanges(BASE_ATTRS, 1, 99);
    const levelTwo = scoutAttributeRanges(BASE_ATTRS, 2, 99);
    const levelThree = scoutAttributeRanges(BASE_ATTRS, 3, 99);

    for (const attribute of Object.keys(BASE_ATTRS) as Array<keyof Attrs>) {
      expect(levelOne[attribute].maximum - levelOne[attribute].minimum).toBe(30);
      expect(levelTwo[attribute].maximum - levelTwo[attribute].minimum).toBe(18);
      expect(levelThree[attribute].maximum - levelThree[attribute].minimum).toBe(8);
      expect(levelThree[attribute].minimum).toBeLessThanOrEqual(BASE_ATTRS[attribute]);
      expect(levelThree[attribute].maximum).toBeGreaterThanOrEqual(BASE_ATTRS[attribute]);
    }
  });

  it('makes rumored heroes a rare real lead, confirms exact powers only at level 3, and gates the focus to Div 3+', () => {
    expect(() => startScoutMission({
      careerSeed: 5,
      missionId: 'too-early',
      startWeek: 1,
      region: 'SOUTH_AMERICA',
      focus: { kind: 'RUMORED_HERO' },
      scoutOfficeLevel: 1,
      division: 4,
    })).toThrow('Division 3');

    let hits = 0;
    for (let seed = 1; seed <= 100; seed += 1) {
      const mission = startScoutMission({
        careerSeed: seed,
        missionId: 'hero-search',
        startWeek: 1,
        region: 'EUROPE',
        focus: { kind: 'RUMORED_HERO' },
        scoutOfficeLevel: 1,
        division: 3,
      });
      const result = resolveScoutMission(mission, mission.dueWeek, candidates, 5);
      const hero = result.reports.find(report => report.playerId === 'mid-c');
      if (hero !== undefined) {
        hits += 1;
        expect(hero).toMatchObject({ rumoredHeroLead: true });
        expect(hero.power).toBeUndefined();
      }
      expect(resolveScoutMission(mission, mission.dueWeek, candidates, 5)).toEqual(result);
    }
    expect(hits).toBeGreaterThanOrEqual(15);
    expect(hits).toBeLessThanOrEqual(35);

    const confirmingMission = startScoutMission({
      careerSeed: Array.from({ length: 100 }, (_, index) => index + 1).find(seed => {
        const mission = startScoutMission({
          careerSeed: seed,
          missionId: 'hero-search',
          startWeek: 1,
          region: 'EUROPE',
          focus: { kind: 'RUMORED_HERO' },
          scoutOfficeLevel: 3,
          division: 3,
        });
        return resolveScoutMission(mission, mission.dueWeek, candidates, 5)
          .reports.some(report => report.playerId === 'mid-c');
      })!,
      missionId: 'hero-search',
      startWeek: 1,
      region: 'EUROPE',
      focus: { kind: 'RUMORED_HERO' },
      scoutOfficeLevel: 3,
      division: 3,
    });
    const confirmed = resolveScoutMission(
      confirmingMission,
      confirmingMission.dueWeek,
      candidates,
      5,
    ).reports.find(report => report.playerId === 'mid-c');
    expect(confirmed?.power).toBe('SUPER_SPEED');
  });
});

describe('transfer rules and valuations', () => {
  it('opens only in pre-season and the two mid-season weeks', () => {
    expect([1, 2, 3, 4, 17, 18].filter(isTransferWindowOpen)).toEqual([1, 2, 3, 4, 17, 18]);
    expect([0, 5, 16, 19, 30, 31].some(isTransferWindowOpen)).toBe(false);
  });

  it('incorporates role stats, age, potential, power tier, contract control, and division', () => {
    const ordinary = valuationPlayer('ordinary');
    const stronger = valuationPlayer('stronger', {
      attrs: { ...BASE_ATTRS, pac: 70, pas: 70, tec: 70 },
    });

    expect(playerValuation(ordinary, 5)).toBeGreaterThanOrEqual(5000);
    expect(playerValuation(ordinary, 5)).toBeLessThanOrEqual(15000);
    expect(playerValuation(stronger, 5)).toBeGreaterThan(playerValuation(ordinary, 5));
    expect(playerValuation(valuationPlayer('prime', { age: 27 }), 5)).toBeGreaterThan(
      playerValuation(valuationPlayer('old', { age: 36 }), 5),
    );
    expect(playerValuation(valuationPlayer('potential', { potential: 5 }), 5)).toBeGreaterThan(
      playerValuation(valuationPlayer('low-potential', { potential: 1 }), 5),
    );
    expect(playerValuation(
      valuationPlayer('hero', { power: 'SUPER_SPEED', powerTier: 3 }),
      5,
    )).toBeGreaterThan(playerValuation(ordinary, 5) * 6);
    expect(playerValuation(
      valuationPlayer('long-contract', { contractSeasonsRemaining: 3 }),
      5,
    )).toBeGreaterThan(playerValuation(
      valuationPlayer('expiring', { contractSeasonsRemaining: 0 }),
      5,
    ));
    expect(playerValuation(ordinary, 1)).toBeGreaterThan(playerValuation(ordinary, 5));
  });

  it('creates repeatable buying asks and selling bids inside their valuation bands', () => {
    const player = valuationPlayer('quoted');
    const context = {
      careerSeed: 101,
      season: 2,
      week: 17,
      sellingClubDivision: 4,
    };
    const buy = buyingTransferQuote(player, context);
    const sell = sellingTransferQuote(player, context);

    expect(buy).toEqual(buyingTransferQuote({ ...player, attrs: { ...player.attrs } }, context));
    expect(buy.bandPercent).toBeGreaterThanOrEqual(105);
    expect(buy.bandPercent).toBeLessThanOrEqual(125);
    expect(sell.bandPercent).toBeGreaterThanOrEqual(80);
    expect(sell.bandPercent).toBeLessThanOrEqual(110);
    expect(buy.fee).toBeGreaterThan(buy.valuation);
  });
});

describe('contract negotiation', () => {
  const PERSONALITY_THAT_LOVES: Readonly<Record<PitchCard, PlayerPersonality>> = {
    FLATTERY: 'JOKER',
    TROPHY_PROMISE: 'FIERY',
    HOMETOWN_TIES: 'LOYAL',
    MONEY_TALKS: 'GREEDY',
    STRAIGHT_TALK: 'PROFESSIONAL',
  };

  it('deals 3 deterministic unique cards and caps their effective-ask influence at +/-20%', () => {
    const hand = dealPitchCards(777, 'talks-1');

    expect(hand).toEqual(dealPitchCards(777, 'talks-1'));
    expect(hand).toHaveLength(3);
    expect(new Set(hand).size).toBe(3);
    expect(effectiveContractAsk(1000, -100)).toBe(800);
    expect(effectiveContractAsk(1000, 100)).toBe(1200);
  });

  it('lets a matching pitch, term, and perk close a fair deal without permitting a miracle', () => {
    const firstCard = dealPitchCards(88, 'fair-deal')[0];
    const personality = PERSONALITY_THAT_LOVES[firstCard];
    const initial = startContractNegotiation({
      careerSeed: 88,
      negotiationId: 'fair-deal',
      playerId: 'player-1',
      personality,
      weeklyAsk: 1000,
    });
    const offer = { weeklyWage: 800, termSeasons: 3, perk: 'GUARANTEED_STARTER' as const };
    const accepted = submitContractOffer(initial, offer, firstCard);

    expect(pitchCardAffinity(personality, firstCard)).toBe(1);
    expect(contractOfferValue(offer)).toBe(928);
    expect(accepted.pitchInfluencePercent).toBe(-10);
    expect(accepted.status).toBe('ACCEPTED');
    expect(accepted.acceptedOffer).toEqual(offer);
    expect(accepted.mood).toBe('THRILLED');
    expect(JSON.parse(JSON.stringify(accepted))).toEqual(accepted);

    const miracle = submitContractOffer(
      startContractNegotiation({
        careerSeed: 88,
        negotiationId: 'no-miracle',
        playerId: 'player-1',
        personality,
        weeklyAsk: 1000,
      }),
      { weeklyWage: 100, termSeasons: 3, perk: 'GUARANTEED_STARTER' },
    );
    expect(miracle.status).toBe('REJECTED');
    expect(miracle.history[0].outcome).toBe('INSULTED');
  });

  it('ends after three counters and immediately rejects an insulting sub-50% wage', () => {
    let talks = startContractNegotiation({
      careerSeed: 9,
      negotiationId: 'three-rounds',
      playerId: 'player-2',
      personality: 'PROFESSIONAL',
      weeklyAsk: 1000,
    });
    const lowOffer = { weeklyWage: 600, termSeasons: 1, perk: 'JERSEY_10' as const };
    talks = submitContractOffer(talks, lowOffer);
    talks = submitContractOffer(talks, lowOffer);
    talks = submitContractOffer(talks, lowOffer);

    expect(talks.round).toBe(3);
    expect(talks.status).toBe('REJECTED');
    expect(talks.history.map(record => record.outcome)).toEqual([
      'COUNTER',
      'COUNTER',
      'WALKED_AWAY',
    ]);
    expect(() => submitContractOffer(talks, lowOffer)).toThrow('already ended');

    const insulted = submitContractOffer(
      startContractNegotiation({
        careerSeed: 10,
        negotiationId: 'insult',
        playerId: 'player-3',
        personality: 'LOYAL',
        weeklyAsk: 1000,
      }),
      { weeklyWage: 499, termSeasons: 3, perk: 'CAPTAINCY' },
    );
    expect(insulted).toMatchObject({
      status: 'REJECTED',
      mood: 'ANGRY',
      consequence: { moraleDelta: -10, clubFameDelta: -2 },
    });
  });

  it('builds renewal asks from growth, fame, personality, and the delayed hero wage cliff', () => {
    const ordinary = renewalContractAsk(
      { weeklyWage: 200, personality: 'GREEDY', onHeroWage: false },
      { growthSinceSigningPercent: 25, famePercent: 10, heroMultiplier: 4 },
    );
    const hero = renewalContractAsk(
      {
        weeklyWage: 200,
        personality: 'GREEDY',
        power: 'SUPER_SPEED',
        onHeroWage: false,
      },
      { growthSinceSigningPercent: 25, famePercent: 10, heroMultiplier: 4 },
    );
    const alreadyOnHeroRate = renewalContractAsk(
      {
        weeklyWage: hero,
        personality: 'GREEDY',
        power: 'SUPER_SPEED',
        onHeroWage: true,
      },
      { growthSinceSigningPercent: 0, famePercent: 0, heroMultiplier: 5 },
    );

    expect(hero).toBe(ordinary * 4);
    expect(alreadyOnHeroRate).toBe(Math.round(hero * 1.2));
  });
});

  describe('coach market', () => {
  it('generates 3-5 byte-identical eligible candidates with two distinct specialties', () => {
    const setup = { careerSeed: 444, season: 3, division: 3, fame: 300 };
    const first = generateCoachMarket(setup);
    const second = generateCoachMarket({ ...setup });

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first.length).toBeGreaterThanOrEqual(3);
    expect(first.length).toBeLessThanOrEqual(5);
    expect(first.every(candidate => candidate.specialties[0] !== candidate.specialties[1])).toBe(true);
    expect(first.every(candidate => isCoachCandidateEligible(candidate, 3, 300))).toBe(true);
    expect(first.every(candidate => candidate.level <= maxCoachLevelForClub(3, 300))).toBe(true);
    expect(new Set(first.map(candidate => candidate.name)).size).toBe(first.length);
    expect(new Set(first.map(candidate => candidate.portraitId)).size).toBe(first.length);
    expect(first.every(candidate => !candidate.name.startsWith('Coach Prospect'))).toBe(true);
    expect(first.every(candidate => candidate.age !== undefined && candidate.age >= 30 && candidate.age <= 60)).toBe(true);
  });

  it('gates coach quality by both division and fame and progresses one level per two seasons', () => {
    expect(maxCoachLevelForClub(5, 9999)).toBe(1);
    expect(maxCoachLevelForClub(1, 0)).toBe(1);
    expect(maxCoachLevelForClub(1, 900)).toBe(5);
    expect(Math.max(...generateCoachMarket({
      careerSeed: 1,
      season: 1,
      division: 5,
      fame: 9999,
    }).map(candidate => candidate.level))).toBe(1);
    expect(Math.max(...generateCoachMarket({
      careerSeed: 1,
      season: 1,
      division: 1,
      fame: 900,
    }).map(candidate => candidate.level))).toBe(5);
    expect(coachLevelAfterSeasons(2, 1)).toBe(2);
    expect(coachLevelAfterSeasons(2, 2)).toBe(3);
    expect(coachLevelAfterSeasons(4, 10)).toBe(5);
  });

  it('includes eligible retired club legends with a loyalty discount', () => {
    const market = generateCoachMarket({
      careerSeed: 2026,
      season: 5,
      division: 2,
      fame: 800,
      unlockIds: ['formation-343', 'drill-hero-fitness'],
      retiredLegends: [{
        playerId: 'legend-7',
        name: 'Ari Flint',
        personality: 'LOYAL',
        fame: 750,
        seasonsAtClub: 7,
        specialties: ['ATTACK', 'MOTIVATOR'],
      }],
    });
    const legend = market.find(candidate => candidate.retiredLegendPlayerId === 'legend-7');

    expect(legend).toMatchObject({
      name: 'Ari Flint',
      level: 4,
      weeklyWage: 1500,
      specialties: ['ATTACK', 'MOTIVATOR'],
      loyaltyDiscountPercent: 25,
    });
    expect(legend?.unlockId).toBeDefined();
  });

  it('offers distinct content unlocks across one coach market when enough IDs exist', () => {
    const market = generateCoachMarket({
      careerSeed: 2027,
      season: 2,
      division: 1,
      fame: 900,
      unlockIds: ['formation:a', 'formation:b', 'formation:c', 'formation:d', 'formation:e'],
    });
    const unlocks = market.map(candidate => candidate.unlockId);

    expect(unlocks.every(id => id !== undefined)).toBe(true);
    expect(new Set(unlocks).size).toBe(unlocks.length);
  });

  it('assigns a scarce content unlock to only one coach candidate', () => {
    const market = generateCoachMarket({
      careerSeed: 2028,
      season: 2,
      division: 1,
      fame: 900,
      unlockIds: ['formation:4-3-3'],
    });

    expect(market.filter(candidate => candidate.unlockId === 'formation:4-3-3')).toHaveLength(1);
    expect(market.filter(candidate => candidate.unlockId !== undefined)).toHaveLength(1);
  });
});
