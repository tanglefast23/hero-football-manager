import { mulberry32 } from '../../../sim/rng';
import type { PowerId } from '../../../sim/types';
import {
  ONBOARDING_COPY,
  ONBOARDING_ORIGINS,
  resolveFirstAwakening,
  STARTER_POWER_PAIRS,
  type OnboardingOrigin,
} from '../first-awakening';

describe('first awakening (tutorial exception)', () => {
  it('always awakens a power in the chosen origin pair — never empty', () => {
    for (const origin of ONBOARDING_ORIGINS) {
      const pair = STARTER_POWER_PAIRS[origin];
      for (let seed = 1; seed <= 200; seed++) {
        expect(pair).toContain(resolveFirstAwakening(origin, mulberry32(seed)));
      }
    }
  });

  it('is deterministic: same origin + same seed ⇒ same power', () => {
    for (const origin of ONBOARDING_ORIGINS) {
      for (let seed = 1; seed <= 50; seed++) {
        expect(resolveFirstAwakening(origin, mulberry32(seed))).toBe(
          resolveFirstAwakening(origin, mulberry32(seed)),
        );
      }
    }
  });

  it('M1-minimum: each origin maps to exactly its one built power', () => {
    // Guards the scope lever. While a pair holds a single built PowerId the coin
    // flip collapses to it. When the second-of-pair ships, this test fails loudly
    // and must be updated deliberately — same forcing-function discipline the sim
    // uses for golden regeneration.
    const built: Record<OnboardingOrigin, PowerId> = {
      CHEMICAL: 'SUPER_SPEED',
      CREATURE: 'FIRE_TORCH',
      SERUM: 'SUPER_STRENGTH',
    };
    for (const origin of ONBOARDING_ORIGINS) {
      expect(STARTER_POWER_PAIRS[origin]).toEqual([built[origin]]);
      expect(resolveFirstAwakening(origin, mulberry32(12345))).toBe(built[origin]);
    }
  });

  it('every origin has exactly one matching choice in the event copy', () => {
    for (const origin of ONBOARDING_ORIGINS) {
      const matches = ONBOARDING_COPY.choices.filter((c) => c.origin === origin);
      expect(matches).toHaveLength(1);
    }
    expect(ONBOARDING_COPY.choices).toHaveLength(ONBOARDING_ORIGINS.length);
  });
});
