import type { PowerId } from '../../sim/types';
import type { Rng } from '../../sim/rng';

/**
 * Story-mode onboarding — the created player's FIRST awakening.
 * Design: docs/superpowers/specs/2026-07-18-onboarding-create-hero-design.md
 *
 * This is the ONLY genuinely-new, foundation-independent logic the onboarding
 * needs — everything else (creation screen, save wiring, the scripted sequence)
 * sits on the M1 season layer being built separately. Kept pure (no React
 * Native / Expo / Skia, no Math.random / Date.now) so it lives in `src/game`
 * and is Jest-testable headless, per the project's ring rules.
 */

/**
 * The three superhero-origin choices offered when the created player collapses
 * at the final whistle of match 1. Each is disguised as a "first aid" choice
 * (see ONBOARDING_COPY) — picking one secretly writes the player's origin story.
 */
export type OnboardingOrigin = 'CHEMICAL' | 'CREATURE' | 'SERUM';

export const ONBOARDING_ORIGINS: readonly OnboardingOrigin[] = ['CHEMICAL', 'CREATURE', 'SERUM'];

/**
 * Each origin awakens one of a themed PAIR of "starter-tier" powers (good, not
 * legendary), picked 50/50.
 *
 * M1-MINIMUM SCOPE: only the three powers already built in the match engine are
 * valid `PowerId`s, so each pair currently holds its single built power and the
 * coin flip collapses to it. The commented second-of-pair is the later expansion
 * (spec's scope lever) — add it here once ICE_RINK / WEB_TRAP / THUNDER_STRIKE
 * exist as real PowerIds AND are implemented + balance-tested like any power.
 * The insect → FIRE_TORCH line is vision canon ("bitten … bursts into flame").
 */
export const STARTER_POWER_PAIRS: Record<OnboardingOrigin, readonly PowerId[]> = {
  CHEMICAL: ['SUPER_SPEED'], //     + 'ICE_RINK'       when built
  CREATURE: ['FIRE_TORCH'], //      + 'WEB_TRAP'       when built
  SERUM: ['SUPER_STRENGTH'], //     + 'THUNDER_STRIKE' when built
};

/**
 * Resolve the created player's first awakening — the scripted tutorial event.
 *
 * TUTORIAL EXCEPTION (owner decision): the power is decided by the player's
 * CHOICE + a seeded coin flip, NOT by stats/body-type. Every LATER awakening
 * uses the normal stat-weighted "fitting" rule elsewhere in the game layer — do
 * not route those through here.
 *
 * Guaranteed to return a power (never null): the randomness is *which* power in
 * the chosen origin's pair, never *whether* one awakens. Consumes exactly one
 * draw from the injected seeded PRNG, so the outcome is a deterministic function
 * of (origin, rng state).
 */
export function resolveFirstAwakening(origin: OnboardingOrigin, rng: Rng): PowerId {
  const pair = STARTER_POWER_PAIRS[origin];
  return pair[Math.floor(rng() * pair.length)];
}
