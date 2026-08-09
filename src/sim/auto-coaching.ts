import { HALF_TICKS } from './geometry';
import { emit } from './events';
import { conditionD64, ratingD64 } from './contest';
import { MAX_SUBSTITUTIONS, performSubstitution } from './substitutions';
import type { BeforeSubstitution } from './substitutions';
import type { EnergyUse } from './tactics';
import type { MatchState, PlayerDef, Role } from './types';

const TOTAL_TICKS = HALF_TICKS * 2;
const SUBSTITUTION_MINUTES = [50, 60, 70, 80, 85] as const;
const ENERGY_USE_MINUTES = [65, 75, 85] as const;
const AUTO_SUB_CONDITION = 60;
const AUTO_SUB_EMERGENCY_CONDITION = 30;
// A replacement must arrive fresher than the scheduled threshold: a reserve
// entering at or below it would immediately be a substitution candidate
// himself, and an exhausted bench would cascade through all five substitutions
// in the opening ticks (m2.1).
const AUTO_SUB_MIN_ENTRY_CONDITION = AUTO_SUB_CONDITION;
// Preserve the old D5 boundary exactly: at the scheduled threshold, a fresh
// 48-rated reserve clears the three-point effective improvement over a tired
// 50-rated starter, while a 47-rated reserve does not.
const ROLE_VALUE_MARGIN_D64 =
  ratingD64(48) - ratingD64(50) - conditionD64(AUTO_SUB_CONDITION);

function tickForMinute(minute: number): number {
  return Math.round((TOTAL_TICKS * minute) / 90);
}

export const AUTO_SUBSTITUTION_TICKS = SUBSTITUTION_MINUTES.map(tickForMinute);
export const AUTO_ENERGY_USE_TICKS = ENERGY_USE_MINUTES.map(tickForMinute);

const ROLE_WEIGHTS: Readonly<
  Record<
    Exclude<Role, 'GK'>,
    ReadonlyArray<readonly [keyof PlayerDef['attrs'], number]>
  >
> = {
  DEF: [
    ['def', 50],
    ['pac', 20],
    ['pas', 15],
    ['tec', 15],
  ],
  MID: [
    ['pas', 35],
    ['tec', 30],
    ['pac', 20],
    ['def', 15],
  ],
  FWD: [
    ['sho', 40],
    ['tec', 25],
    ['pac', 20],
    ['pas', 15],
  ],
};

function stableIdCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Weighted log-ratio role score, shared by outgoing and incoming rankings. */
export function automaticRoleValue(
  player: PlayerDef,
  condition: number,
): number {
  if (player.role === 'GK') return 0;
  const weightedRatingD64 = Math.round(
    ROLE_WEIGHTS[player.role].reduce(
      (sum, [attribute, weight]) =>
        sum + ratingD64(player.attrs[attribute]) * weight,
      0,
    ) / 100,
  );
  return weightedRatingD64 + conditionD64(condition);
}

/** The condition a reserve actually carries onto the pitch (substitutions.ts). */
function replacementEntryCondition(replacement: PlayerDef): number {
  return replacement.startingCondition ?? 100;
}

/** Scale-free version of the shipping D5 three-point substitution margin. */
export function automaticSubstitutionClearsMargin(
  outgoing: PlayerDef,
  outgoingCondition: number,
  replacement: PlayerDef,
): boolean {
  return (
    automaticRoleValue(replacement, replacementEntryCondition(replacement)) >=
    automaticRoleValue(outgoing, outgoingCondition) + ROLE_VALUE_MARGIN_D64
  );
}

export function automaticTeams(state: MatchState): readonly (0 | 1)[] {
  if (state.opts.controlledTeam === 0) return [1];
  if (state.opts.controlledTeam === 1) return [0];
  return [0, 1];
}

function performAutomaticSubstitution(
  state: MatchState,
  team: 0 | 1,
  choice: { playerIndex: number; replacementId: string },
  beforeSubstitution?: BeforeSubstitution,
): boolean {
  return performSubstitution(
    state,
    team,
    choice.playerIndex,
    choice.replacementId,
    beforeSubstitution,
  );
}

/** Exported so a watched match can offer the same bench call to the team the
 * manager controls. Pure selection: it reads state and never mutates it. */
export function automaticSubstitutionChoice(
  state: MatchState,
  team: 0 | 1,
): { playerIndex: number; replacementId: string } | null {
  return automaticSubstitutionChoiceAtCondition(
    state,
    team,
    AUTO_SUB_CONDITION,
    true,
  );
}

/** Red energy is an emergency: use any same-role fresh reserve, even when that
 * reserve would not clear the ordinary condition-adjusted quality margin. */
export function automaticEmergencySubstitutionChoice(
  state: MatchState,
  team: 0 | 1,
): { playerIndex: number; replacementId: string } | null {
  return automaticSubstitutionChoiceAtCondition(
    state,
    team,
    AUTO_SUB_EMERGENCY_CONDITION,
    false,
  );
}

function automaticSubstitutionChoiceAtCondition(
  state: MatchState,
  team: 0 | 1,
  conditionThreshold: number,
  requireValueMargin: boolean,
): { playerIndex: number; replacementId: string } | null {
  if (
    state.substitutionsUsed[team] >= MAX_SUBSTITUTIONS ||
    state.bench[team].length === 0
  )
    return null;
  const first = team * 11;
  const candidates = state.players
    .map((player, index) => ({ player, index }))
    .filter(
      ({ player, index }) =>
        index >= first &&
        index < first + 11 &&
        player.def.role !== 'GK' &&
        player.outReason !== 'redcard' &&
        player.condition <= conditionThreshold,
    )
    .sort(
      (a, b) =>
        a.player.condition - b.player.condition ||
        stableIdCompare(a.player.def.id, b.player.def.id),
    );

  for (const outgoing of candidates) {
    const replacements = state.bench[team]
      .filter(
        (player) =>
          player.role === outgoing.player.def.role &&
          replacementEntryCondition(player) > AUTO_SUB_MIN_ENTRY_CONDITION,
      )
      .sort(
        (a, b) =>
          automaticRoleValue(b, replacementEntryCondition(b)) -
            automaticRoleValue(a, replacementEntryCondition(a)) ||
          stableIdCompare(a.id, b.id),
      );
    const replacement = replacements[0];
    if (replacement === undefined) continue;
    if (
      requireValueMargin &&
      !automaticSubstitutionClearsMargin(
        outgoing.player.def,
        outgoing.player.condition,
        replacement,
      )
    ) {
      continue;
    }
    return { playerIndex: outgoing.index, replacementId: replacement.id };
  }
  return null;
}

function meanCondition(state: MatchState, team: 0 | 1): number {
  const first = team * 11;
  let total = 0;
  let available = 0;
  for (let index = first; index < first + 11; index += 1) {
    if (state.players[index].outReason === 'redcard') continue;
    total += state.players[index].condition;
    available += 1;
  }
  return available === 0 ? 0 : total / available;
}

export function automaticEnergyUse(state: MatchState, team: 0 | 1): EnergyUse {
  if (state.tick < tickForMinute(65)) return 'BALANCED';
  const opponent = team === 0 ? 1 : 0;
  const substitutionsAvailable =
    automaticSubstitutionChoice(state, team) !== null;
  if (!substitutionsAvailable && meanCondition(state, team) <= 35) {
    return 'SAVE_ENERGY';
  }
  if (state.score[team] < state.score[opponent]) return 'ALL_OUT';
  if (
    state.tick >= tickForMinute(75) &&
    state.score[team] > state.score[opponent]
  ) {
    return 'SAVE_ENERGY';
  }
  return 'BALANCED';
}

/** Derived coaching never consumes RNG or enters inputLog. Planned decisions
 * run at fixed ticks; red-energy emergency substitutions react every tick. */
export function applyAutomaticCoaching(
  state: MatchState,
  beforeSubstitution?: BeforeSubstitution,
): void {
  const substitutionCheckpoint = AUTO_SUBSTITUTION_TICKS.includes(state.tick);
  const energyCheckpoint = AUTO_ENERGY_USE_TICKS.includes(state.tick);

  for (const team of automaticTeams(state)) {
    const emergencyChoice = automaticEmergencySubstitutionChoice(state, team);
    const emergencySubstitutionMade =
      emergencyChoice !== null &&
      performAutomaticSubstitution(
        state,
        team,
        emergencyChoice,
        beforeSubstitution,
      );
    if (!emergencySubstitutionMade && substitutionCheckpoint) {
      const scheduledChoice = automaticSubstitutionChoice(state, team);
      if (scheduledChoice !== null) {
        performAutomaticSubstitution(
          state,
          team,
          scheduledChoice,
          beforeSubstitution,
        );
      }
    }
    if (!energyCheckpoint) continue;
    const energyUse = automaticEnergyUse(state, team);
    if (state.tactics[team].energyUse === energyUse) continue;
    state.tactics[team].energyUse = energyUse;
    emit(state, { t: state.tick, kind: 'ENERGY_USE_CHANGED', team, energyUse });
  }
}
