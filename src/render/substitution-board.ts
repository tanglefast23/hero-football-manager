// The substitution board's rules, kept out of the component so they can be
// tested headlessly. The board lets the manager stage as many swaps as they like
// and commit them together, so every rule the engine enforces on a SUBSTITUTE
// input has to be enforced here FIRST: `queueInput` throws on a bad swap, and a
// throw inside a press handler would take the match screen down mid-play.
//
// Engine rules mirrored (src/sim/match.ts validateSubstitutionInput):
//   - one queued swap per field slot and per bench player
//   - goalkeepers only ever replace goalkeepers
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

/** One staged swap. A null replacement is a hole in the eleven. */
export interface SubstitutionSlot {
  readonly player: number;
  readonly replacementId: string | null;
}

export interface SubstitutionPlan {
  readonly slots: readonly SubstitutionSlot[];
}

export const EMPTY_SUBSTITUTION_PLAN: SubstitutionPlan = { slots: [] };

export type SubstitutionRejection =
  | 'sent-off'
  | 'already-off'
  | 'no-substitutions-left'
  | 'field-full'
  | 'keeper-needs-keeper'
  | 'keeper-only-for-keeper';

/** Bert's voice: every refusal says what to do instead. */
export const SUBSTITUTION_REJECTION_MESSAGES: Readonly<Record<SubstitutionRejection, string>> = {
  'sent-off': 'That one is sent off — the eleven plays a man short, and no substitute can fix it.',
  'already-off': 'They are already on their way to the bench.',
  'no-substitutions-left': 'That is your last substitution spent. Save what you have or put someone back.',
  'field-full': 'The field is full. Drag a tired player to the bench before bringing anyone on.',
  'keeper-needs-keeper': 'Only a goalkeeper can take that shirt. Send an outfielder off first.',
  'keeper-only-for-keeper': 'Keepers go in goal only. Take your goalkeeper off if you want them on.',
};

export interface SubstitutionMove {
  readonly plan: SubstitutionPlan;
  readonly rejection?: SubstitutionRejection;
}

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

export function isBenched(plan: SubstitutionPlan, index: number): boolean {
  return plan.slots.some(slot => slot.player === index);
}

export function replacementFor(plan: SubstitutionPlan, index: number): string | null {
  return plan.slots.find(slot => slot.player === index)?.replacementId ?? null;
}

export function isComingOn(plan: SubstitutionPlan, benchId: string): boolean {
  return plan.slots.some(slot => slot.replacementId === benchId);
}

/** Field slot a bench player is currently pencilled into, if any. */
export function slotForReplacement(plan: SubstitutionPlan, benchId: string): number | null {
  return plan.slots.find(slot => slot.replacementId === benchId)?.player ?? null;
}

export function stagedCount(plan: SubstitutionPlan): number {
  return plan.slots.length;
}

export function openSlotCount(plan: SubstitutionPlan): number {
  return plan.slots.filter(slot => slot.replacementId === null).length;
}

/** Sends a starter to the bench, opening a hole for a replacement. */
export function sendToBench(
  plan: SubstitutionPlan,
  player: SubstitutionFieldPlayer,
  substitutionsRemaining: number,
): SubstitutionMove {
  if (player.sentOff) return { plan, rejection: 'sent-off' };
  if (isBenched(plan, player.index)) return { plan, rejection: 'already-off' };
  if (plan.slots.length >= substitutionsRemaining) {
    return { plan, rejection: 'no-substitutions-left' };
  }
  return { plan: { slots: [...plan.slots, { player: player.index, replacementId: null }] } };
}

/**
 * Fills the first hole this player is allowed to fill. Keepers and outfielders
 * are not interchangeable, so the refusal names which way round the problem is.
 */
export function bringOn(
  plan: SubstitutionPlan,
  bench: SubstitutionBenchPlayer,
  field: readonly SubstitutionFieldPlayer[],
): SubstitutionMove {
  if (isComingOn(plan, bench.id)) return { plan };
  const open = plan.slots.filter(slot => slot.replacementId === null);
  if (open.length === 0) return { plan, rejection: 'field-full' };

  const benchIsKeeper = bench.role === 'GK';
  const target = open.find(slot => {
    const outgoing = field.find(player => player.index === slot.player);
    return outgoing !== undefined && (outgoing.role === 'GK') === benchIsKeeper;
  });
  if (target === undefined) {
    return { plan, rejection: benchIsKeeper ? 'keeper-only-for-keeper' : 'keeper-needs-keeper' };
  }
  return {
    plan: {
      slots: plan.slots.map(slot => (
        slot.player === target.player ? { ...slot, replacementId: bench.id } : slot
      )),
    },
  };
}

/** Puts a starter back on the pitch, releasing whoever was pencilled in. */
export function recallToField(plan: SubstitutionPlan, index: number): SubstitutionPlan {
  return { slots: plan.slots.filter(slot => slot.player !== index) };
}

/** Sends a substitute back to the bench, leaving the hole open. */
export function returnToBench(plan: SubstitutionPlan, benchId: string): SubstitutionPlan {
  return {
    slots: plan.slots.map(slot => (
      slot.replacementId === benchId ? { ...slot, replacementId: null } : slot
    )),
  };
}

function countWord(count: number): string {
  const words = ['no', 'one', 'two', 'three', 'four', 'five'];
  return words[count] ?? String(count);
}

/**
 * What still stands between this plan and a saveable one, in Bert's words.
 * Null means the plan is legal and ready to commit.
 */
export function planProblem(
  plan: SubstitutionPlan,
  substitutionsRemaining: number,
): string | null {
  if (plan.slots.length === 0) {
    return 'Drag a tired player down to the bench to start a substitution.';
  }
  if (plan.slots.length > substitutionsRemaining) {
    return substitutionsRemaining === 0
      ? 'You have no substitutions left this match.'
      : `You only have ${countWord(substitutionsRemaining)} substitution${substitutionsRemaining === 1 ? '' : 's'} left.`;
  }
  const open = openSlotCount(plan);
  if (open > 0) {
    return `You're missing ${countWord(open)} player${open === 1 ? '' : 's'} on the field.`;
  }
  return null;
}

export function canSave(plan: SubstitutionPlan, substitutionsRemaining: number): boolean {
  return planProblem(plan, substitutionsRemaining) === null;
}

/**
 * The engine payloads, in staging order. Only ever called for a plan that
 * `canSave` accepts, so every entry is a swap `queueInput` will take.
 */
export function planInputs(
  plan: SubstitutionPlan,
): readonly { readonly player: number; readonly replacementId: string }[] {
  return plan.slots.flatMap(slot => (
    slot.replacementId === null ? [] : [{ player: slot.player, replacementId: slot.replacementId }]
  ));
}
