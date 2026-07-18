import type { MatchOpts } from '../sim/types';

/** Keep the watched side manual without changing scheduled home/away order. */
export function matchPoliciesForControlledTeam(controlledTeam: 0 | 1): MatchOpts {
  return {
    homePolicy: controlledTeam === 0 ? 'SAVE_FOR_TAP' : 'FIRE_WHEN_READY',
    awayPolicy: controlledTeam === 1 ? 'SAVE_FOR_TAP' : 'FIRE_WHEN_READY',
  };
}
