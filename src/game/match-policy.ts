import {
  AUTO_SUBSTITUTION_TICKS,
  automaticEmergencySubstitutionChoice,
  automaticSubstitutionChoice,
} from '../sim/auto-coaching';
import { queueInput } from '../sim/match';
import type { FormationId } from '../sim/tactics';
import type { MatchOpts, MatchState } from '../sim/types';

/**
 * The shared opening contract for a manager-controlled match.
 *
 * Both watched play and Quick Result use it. Keeping the options here prevents
 * one path from silently returning to the engine's fully automatic defaults.
 */
export function controlledMatchOptions(
  controlledTeam: 0 | 1,
  initialFormation: FormationId = '4-4-2',
): MatchOpts {
  return {
    homePolicy: 'FIRE_WHEN_READY',
    awayPolicy: 'FIRE_WHEN_READY',
    controlledTeam,
    ...(controlledTeam === 0
      ? { homeFormation: initialFormation }
      : { awayFormation: initialFormation }),
  };
}

/**
 * Records the watched-side Auto Subs decision for the next simulation tick.
 *
 * This deliberately preserves the shipped watched timing: a planned checkpoint
 * asks for the ordinary substitution first; every other tick is emergency-only.
 * The choice becomes a normal replay input rather than hidden engine behavior.
 */
export function queueControlledAutoSubstitution(
  state: MatchState,
  enabled: boolean,
): boolean {
  if (!enabled || state.phase === 'fulltime') return false;
  const controlledTeam = state.opts.controlledTeam;
  if (controlledTeam !== 0 && controlledTeam !== 1) {
    throw new Error('controlled Auto Subs requires a controlled team');
  }

  const choice = AUTO_SUBSTITUTION_TICKS.includes(state.tick)
    ? automaticSubstitutionChoice(state, controlledTeam)
    : automaticEmergencySubstitutionChoice(state, controlledTeam);
  if (choice === null) return false;

  queueInput(state, {
    tick: state.tick + 1,
    kind: 'SUBSTITUTE',
    player: choice.playerIndex,
    replacementId: choice.replacementId,
  });
  return true;
}
