/**
 * Pass-chain state: who is in the current chain, how fast it makes them, and
 * how that fades. Pure TS, zero rng draws — the sim ring's rules apply.
 *
 * The chain used to live in the render ring as decoration (`src/render/
 * pass-combo.ts`, which counted ball-state transitions and wrote nothing back).
 * It moved here the moment it started changing movement: anything that changes
 * movement changes results, and results must be replayable.
 */
import { activeTeamPlayerIndices, requirePlayerAt } from './entities';
import type { MatchState, SimPlayer } from './types';

/** A bonus falls to zero over 3 seconds at TICK_MS = 100. */
export const PASS_COMBO_DECAY_TICKS = 30;

/**
 * Speed bonus by chain length, in ten-thousandths (2000 = +20%). Index 0 and 1
 * are zero on purpose: a single completed pass is not a combo, and the pop
 * already starts at x2. Chain lengths above 6 clamp to the last entry.
 */
export const PASS_COMBO_TIER_D: readonly number[] = [
  0, 0, 200, 400, 1000, 1500, 2000,
];

/** The tier a chain of this length grants. 0 below x2. */
export function tierForCount(count: number): number {
  if (count < 2) return 0;
  return PASS_COMBO_TIER_D[Math.min(count, PASS_COMBO_TIER_D.length - 1)];
}

/**
 * The live bonus, derived rather than stored. Storing it and shedding a fixed
 * amount per tick cannot land on exactly zero for every tier — a small tier
 * expires a tick early. A countdown can.
 */
export function comboBonusD(p: SimPlayer): number {
  return Math.floor((p.comboTierD * p.comboTicks) / PASS_COMBO_DECAY_TICKS);
}

/**
 * Raise a member to a tier. Never lowers: a player still decaying from a big
 * broken chain, caught by a fresh small one, keeps both the larger bonus and
 * its original countdown. Overwriting the tier downward would either snap the
 * speed down visibly or stretch a big bonus across a slow decay rate.
 */
export function snapUp(p: SimPlayer, tierD: number): void {
  if (tierD <= comboBonusD(p)) return;
  p.comboTierD = tierD;
  p.comboTicks = PASS_COMBO_DECAY_TICKS;
}

/**
 * End one team's chain. The increment is the load-bearing half: it drops every
 * member at once without touching them, so their countdowns keep running.
 *
 * Ids are monotonic and never recycled. `restartKickoff` reuses the same
 * SimPlayer objects, so a chain id handed back out would silently re-enrol
 * players who touched the ball in a previous chain — the exact bug the chain
 * id exists to prevent.
 */
export function endChain(state: MatchState, team: 0 | 1): void {
  state.passCombo[team].count = 0;
  state.passCombo[team].chainId += 1;
}

/** End both chains. The in-play break: bonuses keep decaying on their own. */
export function breakPassCombo(state: MatchState): void {
  endChain(state, 0);
  endChain(state, 1);
}

/**
 * A dead-ball restart. Play has stopped, so the surge stops with it — carrying
 * a bonus across a teleport would read as a kickoff bug.
 */
export function resetPassComboForRestart(state: MatchState): void {
  breakPassCombo(state);
  for (const p of state.players) clearBonus(p);
  for (const clone of state.decoyClones) {
    if (clone !== null) clearBonus(clone);
  }
}

function clearBonus(p: SimPlayer): void {
  p.comboTierD = 0;
  p.comboTicks = 0;
}

/** One tick of fade, for every entity that has one. Clones included. */
export function decayPassCombo(state: MatchState): void {
  for (const p of state.players) decayOne(p);
  for (const clone of state.decoyClones) {
    if (clone !== null) decayOne(clone);
  }
}

function decayOne(p: SimPlayer): void {
  if (p.comboTicks === 0) return;
  p.comboTicks -= 1;
  if (p.comboTicks === 0) p.comboTierD = 0;
}

/**
 * Members of a team's live chain, clone included when one is on the pitch.
 * `activeTeamPlayerIndices` already appends entity 22/23, which is why
 * membership is a chain id rather than a bitmask over the eleven slots.
 */
export function chainMembers(state: MatchState, team: 0 | 1): number[] {
  const { chainId } = state.passCombo[team];
  return activeTeamPlayerIndices(state, team).filter(
    (idx) => requirePlayerAt(state, idx).comboChainId === chainId,
  );
}

/**
 * A completed pass between two players on the same side. Both ends join: the
 * player who made the pass is as much a part of the move as the one who
 * received it.
 */
export function extendPassCombo(
  state: MatchState,
  team: 0 | 1,
  fromIdx: number,
  toIdx: number,
): void {
  endChain(state, team === 0 ? 1 : 0); // one ball, so only one live chain
  const chain = state.passCombo[team];
  chain.count += 1;
  requirePlayerAt(state, fromIdx).comboChainId = chain.chainId;
  requirePlayerAt(state, toIdx).comboChainId = chain.chainId;
  const tierD = tierForCount(chain.count);
  if (tierD === 0) return; // x1 records membership and grants nothing
  for (const idx of chainMembers(state, team)) {
    snapUp(requirePlayerAt(state, idx), tierD);
  }
}
