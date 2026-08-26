import { createLaunchCareerSetup } from '../../application/launch';
import { createCareer } from '../career';
import { applyCareerEventOutcome, offerCareerEvent } from '../career-events';
import { playerLoyalty } from '../loyalty';
import {
  sessionAttributeDelta,
  trainingSessionPoints,
} from '../training-paths';
import type { GameState } from '../types';

/**
 * An attribute reward is worth what N training sessions would give *this* club.
 *
 * A flat number cannot hold its meaning: one drill session runs +3 at tier 1
 * and +18 at tier 5, so a fixed +2 is a different share of training by tier and
 * 0.1% late — it decays into noise exactly as the club grows into the content.
 */

function careerAtTier(tiers: Record<string, number>): GameState {
  const base = createCareer(createLaunchCareerSetup());
  return { ...base, ownedTrainingTiers: tiers };
}

describe('training-session attribute effects', () => {
  it('pays a session at the tier the club has actually bought', () => {
    const tier1 = careerAtTier({});
    const tier5 = careerAtTier({ sprints: 5 });

    expect(trainingSessionPoints(tier1, 'pac', 1)).toBe(3);
    expect(trainingSessionPoints(tier5, 'pac', 1)).toBe(18);
    expect(trainingSessionPoints(tier1, 'pac', 3)).toBe(9);
    expect(trainingSessionPoints(tier5, 'pac', 3)).toBe(54);
  });

  /**
   * The test that catches a hardcoded ladder.
   *
   * `keeper-drills` is deliberately below the outfield ladder — 1/2/4/7/10
   * against 3/5/8/13/18 — because REF is contested on every opposing shot and
   * a uniform ladder priced it at roughly fourteen times the value per TP of
   * any other drill. A resolver that reached for the outfield numbers would
   * double every keeper reward and reopen exactly that hole.
   */
  it('pays the lower keeper ladder instead of the outfield ladder', () => {
    const tier1 = careerAtTier({});
    const tier5 = careerAtTier({ 'keeper-drills': 5 });

    expect(trainingSessionPoints(tier1, 'ref', 3)).toBe(3);
    expect(trainingSessionPoints(tier5, 'ref', 3)).toBe(30);
    // Less than what the same authored sessions pay an outfielder.
    expect(trainingSessionPoints(careerAtTier({ sprints: 5 }), 'pac', 3)).toBe(
      54,
    );
  });

  it('treats an unbought path as tier 1 rather than as nothing', () => {
    const state = careerAtTier({ finishing: 4 });
    expect(state.ownedTrainingTiers?.sprints).toBeUndefined();
    expect(trainingSessionPoints(state, 'pac', 1)).toBe(3);
    expect(trainingSessionPoints(state, 'sho', 1)).toBe(13);
  });

  it('resolves each attribute against its own path, not its facility group', () => {
    // The gym multiplies PAC and STA together, but they are separate drill
    // paths — resolving through the facility grouping would pay STA at the
    // sprint tier.
    const state = careerAtTier({ sprints: 5 });
    expect(trainingSessionPoints(state, 'pac', 1)).toBe(18);
    expect(trainingSessionPoints(state, 'sta', 1)).toBe(3);
  });
});

describe('the losing branch cannot gut a young player', () => {
  const withPac = (value: number) => ({
    attrs: { pac: value, sho: 50, pas: 50, def: 50, tec: 50, sta: 50, ref: 50 },
  });

  it('takes the whole session from a player who can afford it', () => {
    // Tier 5: the session is 18 and a quarter of 88 is 22, so the floor is moot.
    expect(
      sessionAttributeDelta(
        careerAtTier({ sprints: 5 }),
        withPac(88),
        'pac',
        -1,
      ),
    ).toBe(-18);
  });

  it('takes only a quarter from a youth who cannot', () => {
    // Same authored loss, same club: 18 points against a quarter of 20, which is 5.
    expect(
      sessionAttributeDelta(
        careerAtTier({ sprints: 5 }),
        withPac(20),
        'pac',
        -1,
      ),
    ).toBe(-5);
  });

  it('never binds at tier 1, where a session is small anyway', () => {
    expect(
      sessionAttributeDelta(careerAtTier({}), withPac(88), 'pac', -1),
    ).toBe(-3);
  });

  it('leaves a gain untouched — the floor is for losses only', () => {
    expect(
      sessionAttributeDelta(
        careerAtTier({ sprints: 5 }),
        withPac(35),
        'pac',
        3,
      ),
    ).toBe(54);
  });
});

describe('loyalty, condition and fame effects', () => {
  function resolveOn(effect: Record<string, number>) {
    const base = createCareer(createLaunchCareerSetup());
    const player = base.players.find(
      (candidate) => candidate.clubId === base.userClubId,
    )!;
    const resolved = applyCareerEventOutcome(
      offerCareerEvent(base, 'test-event'),
      'a-choice',
      'It happens.',
      { playerEffect: { playerId: player.id, ...effect } },
    );
    return {
      before: player,
      after: resolved.players.find((candidate) => candidate.id === player.id)!,
      careerSeed: base.careerSeed,
    };
  }

  it('moves loyalty from its derived start, never from zero', () => {
    const { before, after, careerSeed } = resolveOn({ loyaltyDelta: 10 });
    // The field is absent until something moves it, and absent means "the value
    // the career seed derived" — reading it as 0 would demote every player the
    // first time a story touched him.
    expect(before.loyalty).toBeUndefined();
    expect(after.loyalty).toBe(playerLoyalty(before, careerSeed) + 10);
  });

  it('clamps loyalty, condition and fame at both ends', () => {
    expect(
      resolveOn({ loyaltyDelta: -25 }).after.loyalty,
    ).toBeGreaterThanOrEqual(0);
    expect(resolveOn({ conditionDelta: 25 }).after.condition).toBe(100);
    expect(resolveOn({ conditionDelta: -30 }).after.condition).toBe(70);
    expect(resolveOn({ fameDelta: -50 }).after.fame).toBeGreaterThanOrEqual(0);
  });

  it('leaves a field alone when its effect is absent', () => {
    const { before, after } = resolveOn({ moraleDelta: 3 });
    expect(after.loyalty).toBe(before.loyalty);
    expect(after.condition).toBe(before.condition);
    expect(after.fame).toBe(before.fame);
  });
});
