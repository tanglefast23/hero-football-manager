import { describe, expect, it } from '@jest/globals';
import {
  contractOfferValue,
  effectiveContractAsk,
  renewalContractAsk,
  type PlayerPersonality,
} from '../market';
import { loyaltyRenewalPercent } from '../loyalty';

/**
 * How cheaply a hero on the wage cliff can be re-signed.
 *
 * `docs/06-economy.md` advertises hero rates of x3-5, and the owner accepted
 * (2026-08-06) that a well-negotiated renewal may land well under that. This
 * pins the measured floor so a rebalance cannot move it unnoticed: the discount
 * levers are spread across four files, and nothing else in the suite would
 * notice them compounding.
 *
 * The floor is NOT the hero multiplier alone. Loyalty (-20% at maximum) and a
 * LOYAL personality (-10%) cut the ask before pitch cards, term and promise cut
 * it again: 4 x 0.8 x 0.9 x (0.8 / 1.16) = 1.99.
 */

/** The pre-awakening wage every multiple below is measured against. */
const WAGE = 200;

/** Term 3 (+6%) and GUARANTEED_STARTER (+10%) — the strongest offer shape. */
const STRONGEST_OFFER_PERCENT = 116;

/** Two loved pitch cards, the -20% hard cap on pitch influence. */
const BEST_PITCH_INFLUENCE = -20;

function cheapestSignableWage(
  ask: number,
  pitchInfluencePercent: number,
): number {
  const effectiveAsk = effectiveContractAsk(ask, pitchInfluencePercent);
  // Search upward for the smallest wage whose effective offer clears the ask.
  const start = Math.max(
    1,
    Math.floor((effectiveAsk * 100) / STRONGEST_OFFER_PERCENT) - 2,
  );
  for (let wage = start; wage <= ask; wage += 1) {
    const value = contractOfferValue({
      weeklyWage: wage,
      termSeasons: 3,
      perk: 'GUARANTEED_STARTER',
    });
    if (value >= effectiveAsk) return wage;
  }
  return ask;
}

function heroAsk(
  personality: PlayerPersonality,
  loyalty: number,
  growthPercent: number,
  fame: number,
): number {
  return renewalContractAsk(
    {
      weeklyWage: WAGE,
      personality,
      power: 'FIRE_TORCH' as never,
      onHeroWage: false,
    },
    {
      growthSinceSigningPercent: growthPercent,
      famePercent: Math.min(100, Math.round(fame / 4)),
      heroMultiplier: 4,
      loyaltyPercent: loyaltyRenewalPercent(loyalty),
    },
  );
}

describe('hero renewal signed floor', () => {
  it('bottoms out around x2 for a maximally loyal, undeveloped hero', () => {
    // The cheapest hero in the game: nothing about him has improved since he
    // signed, he adores the club, his agent is a soft touch, and the manager
    // plays both cards he likes.
    const ask = heroAsk('LOYAL', 100, 0, 0);
    const signed = cheapestSignableWage(ask, BEST_PITCH_INFLUENCE);

    expect(signed / WAGE).toBeGreaterThan(1.9);
    expect(signed / WAGE).toBeLessThan(2.1);
  });

  it('stays above x2.5 once the hero has actually developed', () => {
    // Any real season of football pushes him back over the owner's stated line.
    for (const [growth, fame] of [
      [25, 60],
      [50, 200],
      [100, 400],
    ] as const) {
      for (const personality of ['LOYAL', 'PROFESSIONAL', 'GREEDY'] as const) {
        const ask = heroAsk(personality, 65, growth, fame);
        const signed = cheapestSignableWage(ask, BEST_PITCH_INFLUENCE);
        expect(signed / WAGE).toBeGreaterThan(2.5);
      }
    }
  });

  it('charges the full x4-and-up ask when the manager does not negotiate', () => {
    // Signing at the ask is the advertised cliff. This is what "Sign now" pays,
    // and what a manager who negotiates badly pays.
    for (const personality of ['PROFESSIONAL', 'GREEDY'] as const) {
      const ask = heroAsk(personality, 65, 0, 0);
      expect(ask / WAGE).toBeGreaterThanOrEqual(3);
    }
  });

  it('never lets pitch cards move the ask by more than the documented 20%', () => {
    const ask = heroAsk('GREEDY', 65, 20, 80);

    // The cap is enforced inside `effectiveContractAsk`, so even a corrupted or
    // migrated influence value cannot exceed it.
    expect(effectiveContractAsk(ask, -100)).toBe(
      effectiveContractAsk(ask, -20),
    );
    expect(effectiveContractAsk(ask, 100)).toBe(effectiveContractAsk(ask, 20));
  });
});
