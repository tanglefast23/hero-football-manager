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

/**
 * Tone-correct copy for the awakening event. Cozy comic register (docs/01):
 * a beat of panic that turns to wonder — never grimdark, never at the player's
 * expense. `{name}` is the created player's chosen name. Plain data — the M1
 * agent slots these into whatever event/dialogue system M1 builds; re-home
 * freely. `reveal` is written per-origin because M1 ships one power per origin;
 * move it per-power when the pairs expand.
 */
export interface OriginChoiceCopy {
  origin: OnboardingOrigin;
  label: string; // the "first aid" button the player sees
  hint: string; // the tell that it is secretly an origin trigger
  reveal: string; // shown as the power awakens
}

export const ONBOARDING_COPY: {
  collapse: string;
  prompt: string;
  choices: readonly OriginChoiceCopy[];
} = {
  collapse:
    'The final whistle blows — and {name} drops. Face-down on the turf, not moving. The physio sprints on.',
  prompt: 'Quick — what do you do?',
  choices: [
    {
      origin: 'CHEMICAL',
      label: 'Splash water on his face',
      hint: '…though something is definitely floating in that bottle.',
      reveal: '{name} coughs, sits bolt upright, and is suddenly moving faster than the eye can follow. FWOOSH!',
    },
    {
      origin: 'CREATURE',
      label: 'Get him onto the stretcher',
      hint: '…is that a beetle the size of a plum sitting on the canvas?',
      reveal: 'The bug sinks its fangs in — and {name} leaps up wreathed in flame. The ref reaches for the extinguisher.',
    },
    {
      origin: 'SERUM',
      label: 'Let the pitch-side doctor handle it',
      hint: "…the doctor is already uncapping a very unlabelled bottle of pills.",
      reveal: "One gulp, and {name}'s shirt tears clean off the shoulders. He is, quite suddenly, enormous.",
    },
  ],
};
