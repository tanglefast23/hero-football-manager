// The substitution board's rules, kept out of the component so they can be
// tested headlessly.
//
// Every swap is atomic: a starter is dropped onto a bench player and the two
// trade places. There is no intermediate state where the eleven is short, which
// is why the board needs no validation copy — an illegal drop simply is not a
// drop, and the card springs home.
//
// Engine rules mirrored (src/sim/match.ts validateSubstitutionInput), because
// `queueInput` THROWS on an illegal swap and a throw inside a press handler would
// take the match screen down mid-play:
//   - one queued swap per field slot and per bench player
//   - goalkeepers only ever trade with goalkeepers; outfielders are
//     interchangeable, exactly as the engine has it
//   - a sent-off player cannot be substituted
//   - used + queued may never reach MAX_SUBSTITUTIONS

export interface SubstitutionFieldPlayer {
  /** Engine slot index — what a SUBSTITUTE input carries as `player`. */
  readonly index: number;
  readonly name: string;
  readonly role: 'GK' | 'DEF' | 'MID' | 'FWD';
  readonly condition: number;
  readonly sentOff: boolean;
  readonly lookId?: string;
}

export interface SubstitutionBenchPlayer {
  readonly id: string;
  readonly name: string;
  readonly role: 'GK' | 'DEF' | 'MID' | 'FWD';
  readonly lookId?: string;
}

/** One staged swap: this slot's starter comes off, this substitute goes on. */
export interface SubstitutionSwap {
  readonly player: number;
  readonly replacementId: string;
}

export interface SubstitutionPlan {
  readonly swaps: readonly SubstitutionSwap[];
}

export const EMPTY_SUBSTITUTION_PLAN: SubstitutionPlan = { swaps: [] };

/**
 * A row in the bench column: substitutes still available, then the starters
 * staged to come off, dimmed. A dimmed row is not a substitute — it only accepts
 * the drop that undoes its own swap.
 */
export type BenchEntry =
  | { readonly kind: 'available'; readonly sub: SubstitutionBenchPlayer }
  | {
    readonly kind: 'outgoing';
    readonly starter: SubstitutionFieldPlayer;
    readonly incomingId: string;
  };

/** Most tired first — the column exists to put the next decision on top. */
export function fieldByTiredness(
  players: readonly SubstitutionFieldPlayer[],
): SubstitutionFieldPlayer[] {
  return [...players].sort((left, right) => (
    left.condition === right.condition
      ? left.index - right.index
      : left.condition - right.condition
  ));
}

/** Who is staged to come on for this slot, if anyone. */
export function incomingFor(plan: SubstitutionPlan, index: number): string | null {
  return plan.swaps.find(swap => swap.player === index)?.replacementId ?? null;
}

/** Which slot this substitute is staged to fill, if any. */
export function slotForSub(plan: SubstitutionPlan, benchId: string): number | null {
  return plan.swaps.find(swap => swap.replacementId === benchId)?.player ?? null;
}

export function isSubStaged(plan: SubstitutionPlan, benchId: string): boolean {
  return plan.swaps.some(swap => swap.replacementId === benchId);
}

export function isSlotStaged(plan: SubstitutionPlan, index: number): boolean {
  return plan.swaps.some(swap => swap.player === index);
}

export function stagedCount(plan: SubstitutionPlan): number {
  return plan.swaps.length;
}

/** Bench rows in display order: available substitutes, then dimmed leavers. */
export function benchEntries(
  bench: readonly SubstitutionBenchPlayer[],
  field: readonly SubstitutionFieldPlayer[],
  plan: SubstitutionPlan,
): BenchEntry[] {
  const available: BenchEntry[] = bench
    .filter(sub => !isSubStaged(plan, sub.id))
    .map(sub => ({ kind: 'available', sub }));
  // Dimmed rows sink to the bottom, and keep the order they were staged in.
  const outgoing: BenchEntry[] = plan.swaps.flatMap(swap => {
    const starter = field.find(player => player.index === swap.player);
    return starter === undefined
      ? []
      : [{ kind: 'outgoing' as const, starter, incomingId: swap.replacementId }];
  });
  return [...available, ...outgoing];
}

function sameSide(left: { role: string }, right: { role: string }): boolean {
  // The engine's only positional rule: keepers with keepers, everyone else free.
  return (left.role === 'GK') === (right.role === 'GK');
}

/**
 * Whether dropping this starter onto this substitute would trade them. Used for
 * both the drop itself and for deciding which cards light up mid-drag, so what
 * glows and what works can never disagree.
 */
export function canSwap(
  plan: SubstitutionPlan,
  starter: SubstitutionFieldPlayer,
  sub: SubstitutionBenchPlayer,
  substitutionsRemaining: number,
): boolean {
  if (starter.sentOff) return false;
  if (!sameSide(starter, sub)) return false;
  if (isSubStaged(plan, sub.id)) return false;
  // Re-pointing a slot that is already staged spends no new substitution.
  const spendsOne = !isSlotStaged(plan, starter.index);
  return !spendsOne || plan.swaps.length < substitutionsRemaining;
}

/**
 * Trades the starter for the substitute. A slot that already had someone staged
 * is re-pointed rather than doubled up, so the manager can change their mind
 * without undoing first.
 */
export function applySwap(
  plan: SubstitutionPlan,
  starter: SubstitutionFieldPlayer,
  sub: SubstitutionBenchPlayer,
): SubstitutionPlan {
  const existing = plan.swaps.some(swap => swap.player === starter.index);
  return {
    swaps: existing
      ? plan.swaps.map(swap => (
        swap.player === starter.index ? { ...swap, replacementId: sub.id } : swap
      ))
      : [...plan.swaps, { player: starter.index, replacementId: sub.id }],
  };
}

/** Undoes a slot's swap: the starter stays on, the substitute goes back. */
export function undoSwap(plan: SubstitutionPlan, index: number): SubstitutionPlan {
  return { swaps: plan.swaps.filter(swap => swap.player !== index) };
}

/** Copy for a swapped field card: who is on, and whose shirt they took. */
export function filledShirtLabel(outgoingName: string): string {
  return `ON FOR ${outgoingName.toUpperCase()}`;
}

/** Nothing to save until something is staged; there is no invalid plan. */
export function canSave(plan: SubstitutionPlan): boolean {
  return plan.swaps.length > 0;
}

/** True once the board has spent every substitution the match has left. */
export function atSubstitutionLimit(
  plan: SubstitutionPlan,
  substitutionsRemaining: number,
): boolean {
  return plan.swaps.length >= substitutionsRemaining;
}

/**
 * The engine payloads, in staging order. Every staged swap is a complete pair,
 * so this is a straight mapping.
 */
export function planInputs(
  plan: SubstitutionPlan,
): readonly { readonly player: number; readonly replacementId: string }[] {
  return plan.swaps.map(swap => ({ player: swap.player, replacementId: swap.replacementId }));
}
