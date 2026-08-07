import {
  ASK_WOBBLE_PERCENT,
  askWobblePercent,
  contractOfferValue,
  contractPerkPercent,
  FINAL_NEGOTIATION_ROUND,
  insultingOfferFloor,
  requiredWeeklyWage,
  startContractNegotiation,
  submitContractOffer,
  type ContractNegotiation,
  type ContractPerk,
  type PlayerPersonality,
} from '../market';

const PERSONALITIES: readonly PlayerPersonality[] = [
  'FIERY', 'LOYAL', 'GREEDY', 'JOKER', 'PROFESSIONAL', 'TIMID',
];
const PERKS: readonly ContractPerk[] = [
  'GUARANTEED_STARTER', 'CAPTAINCY', 'TRAINING_PRIORITY', 'JERSEY_10',
];

const talks = (overrides: { seed?: number; id?: string; personality?: PlayerPersonality } = {}) =>
  startContractNegotiation({
    careerSeed: overrides.seed ?? 20260807,
    negotiationId: overrides.id ?? 'renewal-s1-jobo',
    playerId: 'jobo',
    personality: overrides.personality ?? 'PROFESSIONAL',
    weeklyAsk: 856,
  });

describe('the agent has a mood, and it cannot be rerolled', () => {
  it('gives the same round the same swing every time it is asked', () => {
    for (let round = 1; round <= 3; round += 1) {
      const first = askWobblePercent(20260807, 'renewal-s1-jobo', round);
      expect(askWobblePercent(20260807, 'renewal-s1-jobo', round)).toBe(first);
    }
  });

  it('varies by player, by season and by round', () => {
    const byRound = [1, 2].map(round => askWobblePercent(7, 'renewal-s1-a', round));
    const byPlayer = ['renewal-s1-a', 'renewal-s1-b', 'renewal-s2-a']
      .map(id => askWobblePercent(7, id, 1));
    // Not an equality claim on any one value — the point is that the three
    // inputs actually reach the hash. A wobble keyed on the seed alone would
    // give one number to every player in the career.
    expect(new Set([...byRound, ...byPlayer]).size).toBeGreaterThan(1);
  });

  it('stays inside its documented band', () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const swing = askWobblePercent(seed, `renewal-s1-p${seed}`, 1);
      expect(swing).toBeGreaterThanOrEqual(-ASK_WOBBLE_PERCENT);
      expect(swing).toBeLessThanOrEqual(ASK_WOBBLE_PERCENT);
    }
  });

  it('reaches both a discount and a premium across a career of players', () => {
    // A band that only ever rolled one way would be a flat adjustment wearing a
    // random number's clothes, and the whole reason it exists is the chance of
    // a steal.
    const swings = Array.from({ length: 200 }, (_, index) =>
      askWobblePercent(9, `renewal-s1-p${index}`, 1));
    expect(swings.some(swing => swing < 0)).toBe(true);
    expect(swings.some(swing => swing > 0)).toBe(true);
  });

  it('is silent in the final round, where the agent has named his price', () => {
    for (let seed = 1; seed <= 50; seed += 1) {
      expect(askWobblePercent(seed, `renewal-s1-p${seed}`, FINAL_NEGOTIATION_ROUND)).toBe(0);
    }
  });
});

describe('the wage the screen tells you to offer is the wage that is accepted', () => {
  it('is accepted exactly, in every round and for every temperament', () => {
    for (const personality of PERSONALITIES) {
      for (const perk of PERKS) {
        const negotiation = talks({ personality, id: `renewal-s1-${personality}-${perk}` });
        const needed = requiredWeeklyWage(negotiation, 3, perk);
        const result = submitContractOffer(negotiation, {
          weeklyWage: needed,
          termSeasons: 3,
          perk,
        });
        expect({ personality, perk, status: result.status })
          .toEqual({ personality, perk, status: 'ACCEPTED' });
      }
    }
  });

  it('is the LOWEST accepted wage — a dollar less is refused', () => {
    const negotiation = talks();
    const needed = requiredWeeklyWage(negotiation, 3, 'GUARANTEED_STARTER');
    // Guard the premise: this case must not be sitting on the insult floor,
    // where "one dollar less" ends talks for an unrelated reason.
    expect(needed).toBeGreaterThan(insultingOfferFloor(negotiation.weeklyAsk) + 1);
    expect(submitContractOffer(negotiation, {
      weeklyWage: needed - 1,
      termSeasons: 3,
      perk: 'GUARANTEED_STARTER',
    }).status).toBe('OPEN');
  });

  it('never names a wage that would end talks as an insult', () => {
    const negotiation = talks();
    expect(requiredWeeklyWage(negotiation, 1, 'JERSEY_10'))
      .toBeGreaterThanOrEqual(insultingOfferFloor(negotiation.weeklyAsk));
  });

  it('falls when the manager improves the term or the promise', () => {
    const negotiation = talks();
    const oneSeasonShirt = requiredWeeklyWage(negotiation, 1, 'JERSEY_10');
    const threeSeasonStarter = requiredWeeklyWage(negotiation, 3, 'GUARANTEED_STARTER');
    // The whole legibility argument: pulling a lever visibly moves this number
    // down. If it did not, showing it would teach the manager nothing.
    expect(threeSeasonStarter).toBeLessThan(oneSeasonShirt);
  });

  it('falls further when a loved card is on the table', () => {
    const negotiation = talks({ personality: 'PROFESSIONAL' });
    const withoutCard = requiredWeeklyWage(negotiation, 2, 'CAPTAINCY');
    // STRAIGHT_TALK is loved by a PROFESSIONAL, per LOVED_PITCHES.
    const withCard = requiredWeeklyWage(negotiation, 2, 'CAPTAINCY', 'STRAIGHT_TALK');
    expect(withCard).toBeLessThan(withoutCard);
  });
});

describe('a promise is worth what the player thinks of it', () => {
  it('is worth least to the mercenary and most to the man who wants it', () => {
    // GREEDY discounts every promise: he is the one player you cannot talk
    // round, which is what makes him expensive.
    expect(contractPerkPercent('CAPTAINCY', 'GREEDY'))
      .toBeLessThan(contractPerkPercent('CAPTAINCY'));
    expect(contractPerkPercent('CAPTAINCY', 'FIERY'))
      .toBeGreaterThan(contractPerkPercent('CAPTAINCY'));
    // The armband is a burden to a TIMID player and a prize to a FIERY one.
    expect(contractPerkPercent('CAPTAINCY', 'TIMID'))
      .toBeLessThan(contractPerkPercent('CAPTAINCY', 'FIERY'));
    expect(contractPerkPercent('GUARANTEED_STARTER', 'TIMID'))
      .toBeGreaterThan(contractPerkPercent('GUARANTEED_STARTER', 'FIERY'));
  });

  it('is never worthless, so no promise button provably does nothing', () => {
    for (const personality of PERSONALITIES) {
      for (const perk of PERKS) {
        expect({ personality, perk, worth: contractPerkPercent(perk, personality) })
          .toMatchObject({ personality, perk });
        expect(contractPerkPercent(perk, personality)).toBeGreaterThan(0);
      }
    }
  });

  it('keeps the flat ladder when no player is named', () => {
    // The grading call sites that have no personality in hand must still get a
    // sensible number rather than a throw.
    expect(contractPerkPercent('GUARANTEED_STARTER')).toBe(10);
    expect(contractPerkPercent('CAPTAINCY')).toBe(8);
    expect(contractPerkPercent('TRAINING_PRIORITY')).toBe(6);
    expect(contractPerkPercent('JERSEY_10')).toBe(4);
  });

  it('is what the offer is actually scored on', () => {
    const offer = { weeklyWage: 600, termSeasons: 3, perk: 'CAPTAINCY' } as const;
    expect(contractOfferValue(offer, 'FIERY'))
      .toBeGreaterThan(contractOfferValue(offer, 'GREEDY'));
  });
});

describe('talks saved before the agent had a mood', () => {
  it('negotiate flat instead of crashing on the next offer', () => {
    // A save captured mid-negotiation before `careerSeed` was carried. The
    // codec passes it through with the field absent, and this is the first
    // thing that touches it.
    const { careerSeed: _dropped, ...legacy } = talks();
    const restored = legacy as ContractNegotiation;

    expect(() => requiredWeeklyWage(restored, 3, 'GUARANTEED_STARTER')).not.toThrow();
    expect(askWobblePercent(undefined, 'renewal-s1-jobo', 1)).toBe(0);

    const needed = requiredWeeklyWage(restored, 3, 'GUARANTEED_STARTER');
    expect(submitContractOffer(restored, {
      weeklyWage: needed,
      termSeasons: 3,
      perk: 'GUARANTEED_STARTER',
    }).status).toBe('ACCEPTED');
  });
});
