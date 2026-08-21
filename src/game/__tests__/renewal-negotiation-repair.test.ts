import { describe, expect, it } from '@jest/globals';
import { createLaunchCareerSetup } from '../../application/launch';
import { seasonEndViewModel } from '../../application/view-models';
import { marketNegotiationViewModel } from '../../application/market-view-model';
import { loadLaunchContent } from '../../content';
import { createCareer, startNextSeason } from '../career';
import {
  applyCareerNegotiationConsequence,
  beginCareerRenewalTalks,
  beginCareerTransferTalks,
  completeCareerTransfer,
  submitCareerTransferOffer,
  careerRenewalBlockedReasonCopy,
  careerRenewalWeeklyAsk,
  closeCareerRenewalTalks,
  completeCareerRenewal,
  signCareerRenewalAtAsk,
  submitCareerRenewalOffer,
} from '../market-career';
import {
  LOYALTY_NO_RENEWAL_THRESHOLD,
  playerLoyalty,
  willRenegotiate,
} from '../loyalty';
import {
  contractPerkPercent,
  generatedPlayerWeeklyWage,
  renewalContractAsk,
  renewalOpeningOfferWage,
  startContractNegotiation,
  submitContractOffer,
  type PlayerPersonality,
} from '../market';
import { loyaltyRenewalPercent } from '../loyalty';
import { hasActiveCareerContractPromise } from '../contract-promises';
import { currentUserDivision } from '../m2-career';
import { PROMOTION_WAGE_CLAUSE_PERCENT } from '../contract-wages';
import type { CareerPlayer, GameState } from '../types';

/** A season-end career whose named player has an expired contract. */
function seasonEndWithExpired(seed: number): {
  state: GameState;
  player: CareerPlayer;
} {
  const initial = createCareer(createLaunchCareerSetup(seed));
  const lineupIds = new Set(
    initial.lineups.find((lineup) => lineup.clubId === initial.userClubId)!
      .playerIds,
  );
  const target = initial.players.find(
    (candidate) =>
      candidate.clubId === initial.userClubId &&
      !lineupIds.has(candidate.id) &&
      willRenegotiate(playerLoyalty(candidate, initial.careerSeed)),
  )!;
  const state: GameState = {
    ...initial,
    phase: 'season-end',
    players: initial.players.map((candidate) =>
      candidate.id === target.id
        ? { ...candidate, contractSeasonsRemaining: 0 }
        : candidate,
    ),
  };
  return { state, player: state.players.find((c) => c.id === target.id)! };
}

function completedSeasonForUser(state: GameState): GameState {
  return {
    ...state,
    phase: 'season-end',
    fixtures: state.fixtures.map((fixture) =>
      fixture.season === state.season
        ? {
            ...fixture,
            status: 'played' as const,
            score:
              fixture.homeClubId === state.userClubId
                ? { homeGoals: 3, awayGoals: 0 }
                : fixture.awayClubId === state.userClubId
                  ? { homeGoals: 0, awayGoals: 3 }
                  : { homeGoals: 0, awayGoals: 0 },
          }
        : fixture,
    ),
  };
}

/** A D4 promotion review with two licenses full and an expired third hero. */
function d4PromotionWithExpiredHero(seed: number): {
  state: GameState;
  player: CareerPlayer;
} {
  const initial = createCareer(createLaunchCareerSetup(seed));
  const contractsReady: GameState = {
    ...initial,
    players: initial.players.map((player) =>
      player.clubId === initial.userClubId
        ? {
            ...player,
            contractSeasonsRemaining: Math.max(
              2,
              player.contractSeasonsRemaining,
            ),
          }
        : player,
    ),
  };
  const d4 = startNextSeason(completedSeasonForUser(contractsReady));
  expect(currentUserDivision(d4.m2!)).toBe(4);
  const userPlayers = d4.players.filter(
    (player) => player.clubId === d4.userClubId,
  );
  const licensedIds = new Set(
    userPlayers.slice(0, 2).map((player) => player.id),
  );
  const target = userPlayers[2]!;
  const state = completedSeasonForUser({
    ...d4,
    market: { ...d4.market!, renewalTalks: undefined },
    players: d4.players.map((player) => {
      if (player.id === target.id) {
        return {
          ...player,
          age: 22,
          contractSeasonsRemaining: 0,
          power: 'FIRE_TORCH' as never,
          licensed: false,
          loyalty: 100,
          retirementAnnounced: false,
          retirementAnnouncementSeason: undefined,
        };
      }
      if (licensedIds.has(player.id)) {
        return {
          ...player,
          contractSeasonsRemaining: Math.max(
            1,
            player.contractSeasonsRemaining,
          ),
          power: 'FIRE_TORCH' as never,
          licensed: true,
        };
      }
      return player.clubId === d4.userClubId
        ? {
            ...player,
            licensed: false,
            contractSeasonsRemaining: Math.max(
              1,
              player.contractSeasonsRemaining,
            ),
          }
        : player;
    }),
  });
  return {
    state,
    player: state.players.find((player) => player.id === target.id)!,
  };
}

describe('insulting renewal offers (P1-1)', () => {
  it('applies the morale and club-fame penalty instead of throwing', () => {
    const { state, player } = seasonEndWithExpired(8802);
    const opened = beginCareerRenewalTalks(state, state.market!, player.id);
    const ask = opened.renewalTalks!.negotiation.weeklyAsk;
    // Strictly below half the raw ask is the engine's insult line.
    const negotiated = submitCareerRenewalOffer(state, opened, {
      weeklyWage: Math.max(1, Math.ceil(ask / 2) - 1),
      termSeasons: 2,
      perk: 'GUARANTEED_STARTER',
    });

    expect(negotiated.renewalTalks!.negotiation.history[0].outcome).toBe(
      'INSULTED',
    );
    expect(negotiated.renewalTalks!.negotiation.status).toBe('REJECTED');

    // Before the fix this threw `unknown negotiation player <id>`, which the
    // store surfaced verbatim and which rolled the whole round back.
    const applied = applyCareerNegotiationConsequence(
      state,
      negotiated,
      'renewal',
    );

    expect(applied.state.players.find((c) => c.id === player.id)!.morale).toBe(
      Math.max(0, player.morale - 10),
    );
    expect(applied.market.clubFameAdjustment).toBe(-2);
  });

  it('applies the penalty exactly once however often it is re-run', () => {
    const { state, player } = seasonEndWithExpired(8802);
    const opened = beginCareerRenewalTalks(state, state.market!, player.id);
    const ask = opened.renewalTalks!.negotiation.weeklyAsk;
    const negotiated = submitCareerRenewalOffer(state, opened, {
      weeklyWage: Math.max(1, Math.ceil(ask / 2) - 1),
      termSeasons: 2,
      perk: 'GUARANTEED_STARTER',
    });

    const once = applyCareerNegotiationConsequence(
      state,
      negotiated,
      'renewal',
    );
    const twice = applyCareerNegotiationConsequence(
      once.state,
      once.market,
      'renewal',
    );

    expect(twice.state.players.find((c) => c.id === player.id)!.morale).toBe(
      once.state.players.find((c) => c.id === player.id)!.morale,
    );
    expect(twice.market.clubFameAdjustment).toBe(-2);
  });
});

describe('the opening offer is never an insult (P1-2)', () => {
  /**
   * The panel used to seed its wage stepper with the player's CURRENT wage. For
   * anyone whose ask has outgrown their wage by more than 2x that value sits
   * below the insult line, so the default offer ended talks on the first tap.
   * The seed is now derived from the ask, and this asserts the invariant rather
   * than the constant: strictly above half the ask, strictly below what round
   * one would accept even with a loved pitch card.
   */
  it('sits above the insult line and below round-one acceptance, for every shape of player', () => {
    const cases = [
      // An unlicensed hero on the wage cliff: the x4 case.
      {
        wage: 180,
        personality: 'LOYAL' as const,
        power: true,
        growth: 0,
        fame: 0,
        loyalty: 100,
      },
      {
        wage: 180,
        personality: 'GREEDY' as const,
        power: true,
        growth: 40,
        fame: 400,
        loyalty: 30,
      },
      // An extreme-growth, famous, GREEDY NON-hero. Reviewers caught that the
      // trap is not hero-only: this ask reaches ~9.6x the wage.
      {
        wage: 200,
        personality: 'GREEDY' as const,
        power: false,
        growth: 300,
        fame: 400,
        loyalty: 30,
      },
      // An ordinary player, where the old seed was harmless.
      {
        wage: 300,
        personality: 'PROFESSIONAL' as const,
        power: false,
        growth: 10,
        fame: 0,
        loyalty: 70,
      },
    ];

    for (const shape of cases) {
      const ask = renewalContractAsk(
        {
          weeklyWage: shape.wage,
          personality: shape.personality,
          ...(shape.power ? { power: 'FIRE_TORCH' as never } : {}),
          onHeroWage: false,
        },
        {
          growthSinceSigningPercent: shape.growth,
          famePercent: Math.min(100, Math.round(shape.fame / 4)),
          heroMultiplier: 4,
          loyaltyPercent: loyaltyRenewalPercent(shape.loyalty),
        },
      );
      const seed = renewalOpeningOfferWage(ask, 50);

      // Above the insult line.
      expect(seed).toBeGreaterThanOrEqual(ask / 2);

      // And it does not silently auto-accept: the strongest round-one offer
      // built on this seed still falls short, so "Make the offer" means
      // negotiate rather than sign.
      const negotiation = startContractNegotiation({
        careerSeed: 1,
        negotiationId: 'n',
        playerId: 'p',
        personality: shape.personality,
        weeklyAsk: ask,
      });
      const lovedCard =
        shape.personality === 'GREEDY' ? ('MONEY_TALKS' as const) : undefined;
      const strongest = submitContractOffer(
        negotiation,
        { weeklyWage: seed, termSeasons: 3, perk: 'GUARANTEED_STARTER' },
        lovedCard !== undefined && negotiation.pitchCards.includes(lovedCard)
          ? lovedCard
          : undefined,
      );
      expect(strongest.history[0].outcome).toBe('COUNTER');
    }
  });

  it('rejects the old current-wage seed for a hero, proving the case is real', () => {
    const { state, player } = seasonEndWithExpired(8802);
    const hero: CareerPlayer = {
      ...player,
      power: 'FIRE_TORCH' as never,
      onHeroWage: false,
    };
    const heroState: GameState = {
      ...state,
      players: state.players.map((c) => (c.id === hero.id ? hero : c)),
    };

    const ask = careerRenewalWeeklyAsk(heroState, hero);

    expect(hero.weeklyWage).toBeLessThan(ask / 2);
    expect(renewalOpeningOfferWage(ask, 50)).toBeGreaterThanOrEqual(ask / 2);
  });
});

describe('careerRenewalWeeklyAsk (P1-5)', () => {
  it('is the same number the agent opens talks with', () => {
    const { state, player } = seasonEndWithExpired(9101);

    const quoted = careerRenewalWeeklyAsk(state, player);
    const opened = beginCareerRenewalTalks(state, state.market!, player.id);

    expect(quoted).toBe(opened.renewalTalks!.negotiation.weeklyAsk);
  });

  it('brings an inflated late-career hero back to a market-anchored ask', () => {
    const { state, player } = seasonEndWithExpired(9101);
    const inflated: CareerPlayer = {
      ...player,
      weeklyWage: 176_472,
      power: 'FIRE_TORCH' as never,
      onHeroWage: true,
    };
    const ask = careerRenewalWeeklyAsk(state, inflated);
    const marketWage = generatedPlayerWeeklyWage(
      inflated.attrs,
      currentUserDivision(state.m2!),
    );

    expect(ask).toBeLessThanOrEqual(marketWage * 6);
    expect(ask).toBeLessThan(inflated.weeklyWage);
  });

  it('caps an inflated ordinary player at three times market wage', () => {
    const { state, player } = seasonEndWithExpired(9101);
    const inflated: CareerPlayer = {
      ...player,
      weeklyWage: 176_472,
      power: undefined,
      onHeroWage: false,
    };
    const marketWage = generatedPlayerWeeklyWage(
      inflated.attrs,
      currentUserDivision(state.m2!),
    );

    expect(careerRenewalWeeklyAsk(state, inflated)).toBeLessThanOrEqual(
      marketWage * 3,
    );
  });
});

describe('careerRenewalBlockedReasonCopy (P1-6)', () => {
  it('is absent for a player who will still talk', () => {
    const { state, player } = seasonEndWithExpired(9101);

    expect(
      careerRenewalBlockedReasonCopy(state, state.market!, player.id),
    ).toBeUndefined();
  });

  it('reports an agent who has already ended talks this season', () => {
    const { state, player } = seasonEndWithExpired(9101);
    const opened = beginCareerRenewalTalks(state, state.market!, player.id);
    const closed = closeCareerRenewalTalks(state, opened);

    const reason = careerRenewalBlockedReasonCopy(
      state,
      closed,
      player.id,
    )?.text;

    expect(reason).toContain('ended talks for this season');
    expect(() => beginCareerRenewalTalks(state, closed, player.id)).toThrow();
  });

  it('reports a player whose loyalty has fallen through the floor', () => {
    const { state, player } = seasonEndWithExpired(9101);
    const disloyal: GameState = {
      ...state,
      players: state.players.map((candidate) =>
        candidate.id === player.id
          ? { ...candidate, loyalty: LOYALTY_NO_RENEWAL_THRESHOLD - 1 }
          : candidate,
      ),
    };

    const reason = careerRenewalBlockedReasonCopy(
      disloyal,
      disloyal.market!,
      player.id,
    )?.text;

    expect(reason).toContain('will not re-sign');
    expect(() =>
      beginCareerRenewalTalks(disloyal, disloyal.market!, player.id),
    ).toThrow();
  });
});

describe('season-end view model wiring', () => {
  it("quotes the agent's real ask before talks open, not wage-times-four", () => {
    const { state, player } = seasonEndWithExpired(8802);
    const hero: GameState = {
      ...state,
      players: state.players.map((candidate) =>
        candidate.id === player.id
          ? {
              ...candidate,
              power: 'FIRE_TORCH' as never,
              onHeroWage: false,
              fame: 80,
            }
          : candidate,
      ),
    };
    const heroPlayer = hero.players.find((c) => c.id === player.id)!;

    const view = seasonEndViewModel(hero, loadLaunchContent(), 1);

    expect(view.expiredContract?.playerId).toBe(player.id);
    expect(view.expiredContract?.quotedWeeklyWage).toBe(
      careerRenewalWeeklyAsk(hero, heroPlayer),
    );
    // The old `renewalQuote(player, 4)` ignored fame, so the honest ask is higher.
    expect(view.expiredContract!.quotedWeeklyWage).toBeGreaterThan(
      heroPlayer.weeklyWage * 4,
    );
  });

  it('opens the negotiation panel above the insult line rather than at the current wage', () => {
    const { state, player } = seasonEndWithExpired(8802);
    const hero: GameState = {
      ...state,
      players: state.players.map((candidate) =>
        candidate.id === player.id
          ? { ...candidate, power: 'FIRE_TORCH' as never, onHeroWage: false }
          : candidate,
      ),
    };
    const negotiating: GameState = {
      ...hero,
      market: beginCareerRenewalTalks(hero, hero.market!, player.id),
    };

    const view = seasonEndViewModel(negotiating, loadLaunchContent(), 1);
    const ask = negotiating.market!.renewalTalks!.negotiation.weeklyAsk;

    expect(view.renewalNegotiation!.initialWeeklyWage).toBeGreaterThanOrEqual(
      ask / 2,
    );
    expect(view.renewalNegotiation!.initialWeeklyWage).not.toBe(
      hero.players.find((c) => c.id === player.id)!.weeklyWage,
    );
  });

  it('uses the Hero License this promotion announces when presenting renewal promises', () => {
    const { state, player } = d4PromotionWithExpiredHero(20260808);
    const negotiating: GameState = {
      ...state,
      market: beginCareerRenewalTalks(state, state.market!, player.id),
    };

    const view = seasonEndViewModel(negotiating, loadLaunchContent(), 1);
    const starter = view.renewalNegotiation?.perks.find(
      (perk) => perk.id === 'GUARANTEED_STARTER',
    );

    expect(view.outcomeLabel).toBe('PROMOTED');
    expect(view.promotionRewards?.items.map((item) => item.title)).toContain(
      'Third Hero License',
    );
    expect(starter).toMatchObject({ available: true });
  });

  it('carries the last offer so a counter cannot silently rewrite term and promise', () => {
    const { state, player } = seasonEndWithExpired(9101);
    const opened = beginCareerRenewalTalks(state, state.market!, player.id);
    const ask = opened.renewalTalks!.negotiation.weeklyAsk;
    // A deliberate, non-default choice: 3 years and the cheapest promise.
    const countered = submitCareerRenewalOffer(state, opened, {
      weeklyWage: Math.max(50, Math.floor(ask * 0.6)),
      termSeasons: 3,
      perk: 'JERSEY_10',
    });

    const view = seasonEndViewModel(
      { ...state, market: countered },
      loadLaunchContent(),
      1,
    );

    expect(countered.renewalTalks!.negotiation.status).toBe('OPEN');
    expect(view.renewalNegotiation?.lastOffer).toEqual({
      weeklyWage: Math.max(50, Math.floor(ask * 0.6)),
      termSeasons: 3,
      perk: 'JERSEY_10',
    });
  });
});

describe('promise grades (D1)', () => {
  /**
   * The grade must stay tied to `contractPerkPercent`. A hand-written ladder is
   * the failure mode this repo has already shipped once, when a scouting label
   * kept promising "+8% training" for two releases after the bonus was deleted.
   */
  const gradesFor = (personality: PlayerPersonality) =>
    new Map(
      marketNegotiationViewModel({
        state: startContractNegotiation({
          careerSeed: 7,
          negotiationId: 'g',
          playerId: 'p',
          personality,
          weeklyAsk: 1000,
        }),
        playerName: 'Test',
        openingWeeklyWage: 700,
      }).perks.map((perk) => [perk.id, perk.gradeLabel]),
    );

  it('grades every promise from the percentage the agent actually values', () => {
    // A TIMID player wants the shirt and the starting place and does not want
    // the armband, so his ladder is not the flat one. Asserting the flat ladder
    // here is what this test did before promises became personal, and it would
    // now be asserting a grade the agent disagrees with.
    const timid = gradesFor('TIMID');
    expect(timid.get('GUARANTEED_STARTER')).toBe('A · Huge');
    expect(timid.get('CAPTAINCY')).toBe('D · Small');
    // 6 base + 2 for a man who likes being worked on = 8, which is a B.
    expect(timid.get('TRAINING_PRIORITY')).toBe('B · Big');
    expect(timid.get('JERSEY_10')).toBe('D · Small');
  });

  it('grades the same promise differently for different men', () => {
    // The whole point of reading your player. If these ever agree, the panel is
    // back to quoting one ladder at everybody.
    expect(gradesFor('FIERY').get('CAPTAINCY')).not.toBe(
      gradesFor('TIMID').get('CAPTAINCY'),
    );
  });

  it('never grades a promise as worthless, even for the mercenary', () => {
    // GREEDY discounts every promise. The badge still has to name a grade — a
    // blank or an F would read as "this button does nothing", and it does.
    const greedy = gradesFor('GREEDY');
    const perks = [
      'GUARANTEED_STARTER',
      'CAPTAINCY',
      'TRAINING_PRIORITY',
      'JERSEY_10',
    ] as const;
    for (const perk of perks) {
      expect({ perk, grade: greedy.get(perk) }).toMatchObject({ perk });
      expect(greedy.get(perk)).toBeTruthy();
    }
  });

  it('ranks the grades in the same order the engine prices them', () => {
    const ranked = (
      [
        'GUARANTEED_STARTER',
        'CAPTAINCY',
        'TRAINING_PRIORITY',
        'JERSEY_10',
      ] as const
    ).map((perk) => ({ perk, percent: contractPerkPercent(perk) }));

    for (let index = 1; index < ranked.length; index += 1) {
      expect(ranked[index - 1].percent).toBeGreaterThan(ranked[index].percent);
    }
    // And the grade boundaries are the ones the labels claim.
    expect(contractPerkPercent('GUARANTEED_STARTER')).toBeGreaterThanOrEqual(
      10,
    );
    expect(contractPerkPercent('JERSEY_10')).toBeLessThan(6);
  });

  it('states a mechanical consequence for every promise, never flavour', () => {
    const perks = marketNegotiationViewModel({
      state: startContractNegotiation({
        careerSeed: 7,
        negotiationId: 'g',
        playerId: 'p',
        personality: 'PROFESSIONAL',
        weeklyAsk: 1000,
      }),
      playerName: 'Test',
      openingWeeklyWage: 700,
    }).perks;

    // The grade is only honest while the cost is stated beside it, so this
    // pins the copy that carries it rather than leaving it to drift back.
    expect(perks.find((p) => p.id === 'CAPTAINCY')!.detail).toContain(
      'current captain',
    );
    expect(perks.find((p) => p.id === 'TRAINING_PRIORITY')!.detail).toContain(
      '5 drills',
    );
    expect(perks.find((p) => p.id === 'JERSEY_10')!.detail).toContain(
      'number 10',
    );
    expect(perks.find((p) => p.id === 'GUARANTEED_STARTER')!.detail).toContain(
      'refused',
    );
    for (const perk of perks) expect(perk.detail.length).toBeGreaterThan(20);
  });
});

describe('promise invariants are enforced before acceptance (P1-4, P2-13)', () => {
  /**
   * Every one of these used to be discovered only after the agent had accepted:
   * `applyCareerContractPromise` threw inside `completeCareerRenewal`, the store's
   * `guarded()` discarded the agreed deal, and the panel silently reset to
   * "Round 1 of 3" with the handshake gone.
   */
  function withPromise(
    state: GameState,
    playerId: string,
    perk:
      'CAPTAINCY' | 'JERSEY_10' | 'TRAINING_PRIORITY' | 'GUARANTEED_STARTER',
  ): GameState {
    return {
      ...state,
      players: state.players.map((candidate) =>
        candidate.id === playerId
          ? {
              ...candidate,
              contractSeasonsRemaining: 2,
              contractPromise: { perk, agreedSeason: state.season },
              ...(perk === 'TRAINING_PRIORITY'
                ? { priorityDrillsRemaining: 5 }
                : {}),
            }
          : candidate,
      ),
    };
  }

  const otherSquadPlayer = (state: GameState, exclude: string): CareerPlayer =>
    state.players.find(
      (c) => c.clubId === state.userClubId && c.id !== exclude,
    )!;

  it('refuses a second captaincy promise instead of stripping the first holder', () => {
    const { state, player } = seasonEndWithExpired(9101);
    const incumbent = otherSquadPlayer(state, player.id);
    const held = withPromise(state, incumbent.id, 'CAPTAINCY');
    const opened = beginCareerRenewalTalks(held, held.market!, player.id);

    expect(() =>
      submitCareerRenewalOffer(held, opened, {
        weeklyWage: opened.renewalTalks!.negotiation.weeklyAsk,
        termSeasons: 1,
        perk: 'CAPTAINCY',
      }),
    ).toThrow(new RegExp(`${incumbent.name}.*captaincy`));
  });

  it('refuses a second number 10 promise', () => {
    const { state, player } = seasonEndWithExpired(9101);
    const incumbent = otherSquadPlayer(state, player.id);
    const held = withPromise(state, incumbent.id, 'JERSEY_10');
    const opened = beginCareerRenewalTalks(held, held.market!, player.id);

    expect(() =>
      submitCareerRenewalOffer(held, opened, {
        weeklyWage: opened.renewalTalks!.negotiation.weeklyAsk,
        termSeasons: 1,
        perk: 'JERSEY_10',
      }),
    ).toThrow(/number 10 shirt/);
  });

  it('refuses a second training debt while one is still owed', () => {
    const { state, player } = seasonEndWithExpired(9101);
    const incumbent = otherSquadPlayer(state, player.id);
    const held = withPromise(state, incumbent.id, 'TRAINING_PRIORITY');
    const opened = beginCareerRenewalTalks(held, held.market!, player.id);

    expect(() =>
      submitCareerRenewalOffer(held, opened, {
        weeklyWage: opened.renewalTalks!.negotiation.weeklyAsk,
        termSeasons: 1,
        perk: 'TRAINING_PRIORITY',
      }),
    ).toThrow(/still owed 5 drills/);
  });

  it('refuses a starting promise the Hero License cap cannot cover', () => {
    const { state, player } = seasonEndWithExpired(9101);
    // A D5 club is capped at two licences; fill both, and make the target an
    // unlicensed hero who would need a third.
    const others = state.players
      .filter((c) => c.clubId === state.userClubId && c.id !== player.id)
      .slice(0, 2);
    const capped: GameState = {
      ...state,
      players: state.players.map((candidate) => {
        if (candidate.id === player.id) {
          return {
            ...candidate,
            power: 'FIRE_TORCH' as never,
            licensed: false,
          };
        }
        return others.some((o) => o.id === candidate.id)
          ? { ...candidate, licensed: true }
          : candidate;
      }),
    };
    const opened = beginCareerRenewalTalks(capped, capped.market!, player.id);

    expect(() =>
      submitCareerRenewalOffer(capped, opened, {
        weeklyWage: opened.renewalTalks!.negotiation.weeklyAsk,
        termSeasons: 1,
        perk: 'GUARANTEED_STARTER',
      }),
    ).toThrow(/No Hero License is free/);
  });

  it('still allows a legal promise, so the guard is not simply refusing everything', () => {
    const { state, player } = seasonEndWithExpired(9101);
    const opened = beginCareerRenewalTalks(state, state.market!, player.id);

    const accepted = submitCareerRenewalOffer(state, opened, {
      weeklyWage: opened.renewalTalks!.negotiation.weeklyAsk,
      termSeasons: 1,
      perk: 'CAPTAINCY',
    });

    expect(accepted.renewalTalks!.negotiation.status).toBe('ACCEPTED');
    // And the accepted deal completes rather than throwing at the last step.
    expect(() => completeCareerRenewal(state, accepted)).not.toThrow();
  });
});

describe('signing at the asking price (D2)', () => {
  it("signs at the agent's ask, attaches no promise, and updates payroll", () => {
    const { state, player } = seasonEndWithExpired(9101);
    const ask = careerRenewalWeeklyAsk(state, player);
    const club = state.clubs.find((c) => c.id === state.userClubId)!;

    const signed = signCareerRenewalAtAsk(state, state.market!, player.id, 2);
    const renewed = signed.state.players.find((c) => c.id === player.id)!;

    expect(renewed.weeklyWage).toBe(ask);
    expect(renewed.promotionWagePercent).toBe(PROMOTION_WAGE_CLAUSE_PERCENT);
    expect(renewed.promotionWageStartsAfterSeason).toBe(state.season);
    expect(renewed.contractSeasonsRemaining).toBe(2);
    expect(renewed.contractPromise).toBeUndefined();
    expect(renewed.transferRequested).toBe(false);
    expect(
      signed.state.clubs.find((c) => c.id === state.userClubId)!.weeklyWages,
    ).toBe(club.weeklyWages + (ask - player.weeklyWage));
  });

  it('does not revive the promise from the contract that just expired', () => {
    // Season end only decrements the term; `contractPromise` survives, inert
    // only because it needs a positive term. Restoring the term without
    // dropping it would silently re-arm the old promise.
    const { state, player } = seasonEndWithExpired(9101);
    const haunted: GameState = {
      ...state,
      players: state.players.map((candidate) =>
        candidate.id === player.id
          ? {
              ...candidate,
              contractPromise: {
                perk: 'TRAINING_PRIORITY' as const,
                agreedSeason: state.season - 1,
              },
              priorityDrillsRemaining: 3,
              isCaptain: true,
              shirtNumber: 7,
              licensed: true,
            }
          : candidate,
      ),
    };

    const signed = signCareerRenewalAtAsk(
      haunted,
      haunted.market!,
      player.id,
      2,
    );
    const renewed = signed.state.players.find((c) => c.id === player.id)!;

    expect(renewed.contractPromise).toBeUndefined();
    expect(renewed.priorityDrillsRemaining).toBe(0);
    expect(hasActiveCareerContractPromise(renewed)).toBe(false);
    // But the club-owned presentation roles are NOT a promise and must survive:
    // re-signing your captain cannot quietly demote him.
    expect(renewed.isCaptain).toBe(true);
    expect(renewed.shirtNumber).toBe(7);
    expect(renewed.licensed).toBe(true);
  });

  it('refuses a player whose loyalty has fallen through the floor', () => {
    const { state, player } = seasonEndWithExpired(9101);
    const disloyal: GameState = {
      ...state,
      players: state.players.map((candidate) =>
        candidate.id === player.id
          ? { ...candidate, loyalty: LOYALTY_NO_RENEWAL_THRESHOLD - 1 }
          : candidate,
      ),
    };

    // The gate belongs to the domain, not to a disabled button.
    expect(() =>
      signCareerRenewalAtAsk(disloyal, disloyal.market!, player.id, 1),
    ).toThrow(/will not re-sign/);
  });

  it('refuses a player whose agent already ended talks this season', () => {
    const { state, player } = seasonEndWithExpired(9101);
    const opened = beginCareerRenewalTalks(state, state.market!, player.id);
    const closed = closeCareerRenewalTalks(state, opened);

    expect(() => signCareerRenewalAtAsk(state, closed, player.id, 1)).toThrow(
      /ended talks for this season/,
    );
  });

  it('never undercuts a negotiated deal', () => {
    const { state, player } = seasonEndWithExpired(9101);
    const opened = beginCareerRenewalTalks(state, state.market!, player.id);
    const ask = opened.renewalTalks!.negotiation.weeklyAsk;

    const signed = signCareerRenewalAtAsk(state, state.market!, player.id, 1);

    // Sign now pays the full ask; negotiating is the only way below it.
    expect(
      signed.state.players.find((c) => c.id === player.id)!.weeklyWage,
    ).toBe(ask);
  });

  it("supersedes that player's own open talks but not somebody else's", () => {
    const { state, player } = seasonEndWithExpired(9101);
    const opened = beginCareerRenewalTalks(state, state.market!, player.id);

    const signed = signCareerRenewalAtAsk(state, opened, player.id, 1);
    expect(signed.market.renewalTalks).toBeUndefined();

    const other = state.players.find(
      (c) => c.clubId === state.userClubId && c.id !== player.id,
    )!;
    expect(() => signCareerRenewalAtAsk(state, opened, other.id, 1)).toThrow();
  });
});

describe('the same promise guard covers buying, not just renewing (P1-4)', () => {
  /**
   * `completeCareerTransfer` calls `applyCareerContractPromise` exactly as the
   * renewal path does, so a signing was equally capable of being agreed and then
   * discarded. Guarding only renewals fixed half the bug: the negotiation panel
   * is shared, and its draft defaults to GUARANTEED_STARTER, so buying any hero
   * with the Hero Licence cap full took the broken path every time.
   */
  it('refuses a starting promise on a signing the Hero License cannot cover', () => {
    const initial = createCareer(createLaunchCareerSetup(4242));
    const lineupIds = new Set(
      initial.lineups.find((l) => l.clubId === initial.userClubId)!.playerIds,
    );
    const licensed = initial.players
      .filter((p) => p.clubId === initial.userClubId)
      .slice(0, 2)
      .map((p) => p.id);
    // Room on the roster, so the squad-size check cannot mask the licence one.
    const spare = initial.players
      .filter(
        (p) =>
          p.clubId === initial.userClubId &&
          !lineupIds.has(p.id) &&
          !licensed.includes(p.id),
      )
      .slice(0, 3)
      .map((p) => p.id);
    const rival = initial.players.find((p) => p.clubId !== initial.userClubId)!;

    const state: GameState = {
      ...initial,
      phase: 'manage',
      week: 1,
      players: initial.players
        .filter((p) => !spare.includes(p.id))
        .map((p) => {
          if (licensed.includes(p.id)) return { ...p, licensed: true };
          if (p.id === rival.id) {
            return {
              ...p,
              power: 'FIRE_TORCH' as never,
              powerTier: 1,
              licensed: false,
            };
          }
          return p;
        }),
    };

    const range = { minimum: 40, maximum: 60 };
    const scouted = {
      ...state.market!,
      scoutReports: [
        {
          playerId: rival.id,
          role: rival.role,
          age: rival.age ?? 24,
          statRanges: {
            pac: range,
            sho: range,
            pas: range,
            def: range,
            tec: range,
            sta: range,
            ref: range,
          },
          potentialRange: { minimum: 3, maximum: 4 },
          power: 'FIRE_TORCH' as never,
          powerTier: 1,
        },
      ],
    } as never;

    const talks = beginCareerTransferTalks(state, scouted, rival.id);
    const ask = talks.transferTalks!.negotiation.weeklyAsk;

    // Before the fix this returned ACCEPTED, and `completeCareerTransfer` then
    // threw "<name>'s starting promise requires an available Hero License",
    // discarding a deal the agent had already agreed.
    expect(() =>
      submitCareerTransferOffer(state, talks, {
        weeklyWage: ask * 3,
        termSeasons: 3,
        perk: 'GUARANTEED_STARTER',
      }),
    ).toThrow(/No Hero License is free/);

    // A promise that needs no licence still goes through and completes.
    const accepted = submitCareerTransferOffer(state, talks, {
      weeklyWage: ask * 3,
      termSeasons: 3,
      perk: 'JERSEY_10',
    });
    expect(accepted.transferTalks!.negotiation.status).toBe('ACCEPTED');
    expect(() => completeCareerTransfer(state, accepted)).not.toThrow();
  });
});
