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
 *
 * `heroPowers` is the manager's HERO POWER setting, and it defaults to 'auto'
 * on purpose. **Quick Result must never pass 'manual'.** Nobody is watching a
 * Quick Result, so SAVE_FOR_TAP heroes would hold their Zones to the whistle
 * and the club would field its heroes for no effect at all — silently. The
 * parameter lives here rather than in a second options builder because this
 * function is shared precisely to stop the watched and quick paths drifting.
 */
export function controlledMatchOptions(
  controlledTeam: 0 | 1,
  initialFormation: FormationId = '4-4-2',
  heroPowers: 'auto' | 'manual' = 'auto',
): MatchOpts {
  // Only the manager's own side may be manual. The opposition always fires
  // automatically — there is nobody to tap for them.
  const controlledPolicy =
    heroPowers === 'manual' ? 'SAVE_FOR_TAP' : 'FIRE_WHEN_READY';
  return {
    homePolicy: controlledTeam === 0 ? controlledPolicy : 'FIRE_WHEN_READY',
    awayPolicy: controlledTeam === 1 ? controlledPolicy : 'FIRE_WHEN_READY',
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
