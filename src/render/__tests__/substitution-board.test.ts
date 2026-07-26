import { MAX_SUBSTITUTIONS } from '../../sim/substitutions';
import {
  EMPTY_SUBSTITUTION_PLAN,
  applySwap,
  atSubstitutionLimit,
  benchEntries,
  budgetNote,
  canSave,
  canSwap,
  fieldByTiredness,
  filledShirtLabel,
  incomingFor,
  ineligibleTag,
  isSlotStaged,
  isSubStaged,
  planInputs,
  slotForSub,
  stagedCount,
  undoSwap,
  type SubstitutionBenchPlayer,
  type SubstitutionFieldPlayer,
} from '../substitution-board';

function starter(
  index: number,
  condition: number,
  role: SubstitutionFieldPlayer['role'] = 'MID',
  sentOff = false,
): SubstitutionFieldPlayer {
  return { index, name: `Player ${index}`, role, condition, sentOff };
}

function substitute(id: string, role: SubstitutionBenchPlayer['role'] = 'MID'): SubstitutionBenchPlayer {
  return { id, name: `Sub ${id}`, role };
}

const KEEPER = starter(0, 96, 'GK');
const FLINT = starter(1, 24, 'FWD');
const CHAN = starter(2, 27);
const MARSH = starter(3, 30);
const FIELD = [KEEPER, FLINT, CHAN, MARSH];
const VELA = substitute('vela', 'FWD');
const VALE = substitute('vale');
const KEEPER_SUB = substitute('gk-sub', 'GK');

describe('substitution board trades', () => {
  it('puts the most tired starter on top, breaking ties by slot', () => {
    expect(fieldByTiredness(FIELD).map(player => player.index)).toEqual([1, 2, 3, 0]);
  });

  it('trades a starter for a substitute and emits one engine payload', () => {
    const plan = applySwap(EMPTY_SUBSTITUTION_PLAN, FLINT, VELA);

    expect(incomingFor(plan, FLINT.index)).toBe('vela');
    expect(slotForSub(plan, 'vela')).toBe(FLINT.index);
    expect(isSlotStaged(plan, FLINT.index)).toBe(true);
    expect(isSubStaged(plan, 'vela')).toBe(true);
    expect(planInputs(plan)).toEqual([{ player: 1, replacementId: 'vela' }]);
    expect(canSave(plan)).toBe(true);
  });

  it('treats outfielders as interchangeable and keepers as not, exactly as the engine does', () => {
    const empty = EMPTY_SUBSTITUTION_PLAN;

    // A midfielder may take a forward's place: the sim has no finer rule.
    expect(canSwap(empty, FLINT, VALE, MAX_SUBSTITUTIONS)).toBe(true);
    expect(canSwap(empty, CHAN, VELA, MAX_SUBSTITUTIONS)).toBe(true);
    // Keepers only ever trade with keepers, in both directions.
    expect(canSwap(empty, KEEPER, VALE, MAX_SUBSTITUTIONS)).toBe(false);
    expect(canSwap(empty, FLINT, KEEPER_SUB, MAX_SUBSTITUTIONS)).toBe(false);
    expect(canSwap(empty, KEEPER, KEEPER_SUB, MAX_SUBSTITUTIONS)).toBe(true);
  });

  it('never trades a sent-off player, who cannot be replaced', () => {
    const sentOff = starter(4, 40, 'FWD', true);

    expect(canSwap(EMPTY_SUBSTITUTION_PLAN, sentOff, VELA, MAX_SUBSTITUTIONS)).toBe(false);
  });

  it('spends one substitution per new trade and none for changing your mind', () => {
    let plan = applySwap(EMPTY_SUBSTITUTION_PLAN, FLINT, VELA);
    plan = applySwap(plan, CHAN, VALE);
    expect(stagedCount(plan)).toBe(2);

    // Two staged with two left: a third starter cannot come off...
    expect(canSwap(plan, MARSH, substitute('spare'), 2)).toBe(false);
    // ...but swapping a different substitute into an already-staged shirt is free.
    expect(canSwap(plan, FLINT, substitute('spare'), 2)).toBe(true);
    const repointed = applySwap(plan, FLINT, substitute('spare'));
    expect(stagedCount(repointed)).toBe(2);
    expect(incomingFor(repointed, FLINT.index)).toBe('spare');
  });

  it('refuses to use one substitute for two shirts', () => {
    const plan = applySwap(EMPTY_SUBSTITUTION_PLAN, FLINT, VELA);

    expect(canSwap(plan, CHAN, VELA, MAX_SUBSTITUTIONS)).toBe(false);
  });

  it('undoes a trade, putting the starter back and freeing the substitute', () => {
    const plan = applySwap(EMPTY_SUBSTITUTION_PLAN, FLINT, VELA);
    const undone = undoSwap(plan, FLINT.index);

    expect(undone.swaps).toHaveLength(0);
    expect(isSubStaged(undone, 'vela')).toBe(false);
    expect(canSave(undone)).toBe(false);
    expect(planInputs(undone)).toEqual([]);
  });

  it('lists available substitutes first and sinks the leavers to the bottom', () => {
    const bench = [VELA, VALE, KEEPER_SUB];
    const plan = applySwap(EMPTY_SUBSTITUTION_PLAN, FLINT, VELA);
    const rows = benchEntries(bench, FIELD, plan);

    // Vela is on the field now, so she is gone from the bench...
    expect(rows.filter(row => row.kind === 'available').map(row => (
      row.kind === 'available' ? row.sub.id : ''
    ))).toEqual(['vale', 'gk-sub']);
    // ...and Flint sits dimmed at the bottom, naming who took his shirt.
    const last = rows[rows.length - 1];
    expect(last.kind).toBe('outgoing');
    expect(last.kind === 'outgoing' ? last.starter.index : null).toBe(FLINT.index);
    expect(last.kind === 'outgoing' ? last.incomingId : null).toBe('vela');
  });

  it('knows when the match has no substitutions left to spend', () => {
    let plan = EMPTY_SUBSTITUTION_PLAN;
    expect(atSubstitutionLimit(plan, 2)).toBe(false);
    plan = applySwap(plan, FLINT, VELA);
    expect(atSubstitutionLimit(plan, 2)).toBe(false);
    plan = applySwap(plan, CHAN, VALE);
    // Two staged against two left: nothing more may light up.
    expect(atSubstitutionLimit(plan, 2)).toBe(true);
    expect(atSubstitutionLimit(EMPTY_SUBSTITUTION_PLAN, 0)).toBe(true);
  });

  it('names who took the shirt', () => {
    expect(filledShirtLabel('Dario Flint')).toBe('ON FOR DARIO FLINT');
  });

  it('states what is left to spend rather than leaving a dead drag unexplained', () => {
    const one = applySwap(EMPTY_SUBSTITUTION_PLAN, FLINT, VELA);

    expect(budgetNote(EMPTY_SUBSTITUTION_PLAN, 5)).toBe('Five substitutions left.');
    expect(budgetNote(one, 5)).toBe('Four substitutions left.');
    expect(budgetNote(one, 2)).toBe('One substitution left.');
    expect(budgetNote(one, 1)).toBe('No substitutions left this match.');
    expect(budgetNote(EMPTY_SUBSTITUTION_PLAN, 0)).toBe('No substitutions left this match.');
  });

  it('tells a card why it cannot take the player being dragged', () => {
    // Keeper rule, named from whichever side is wrong.
    expect(ineligibleTag(true, false, false)).toBe('KEEPERS ONLY');
    expect(ineligibleTag(false, true, false)).toBe('NEEDS A KEEPER');
    // Same side, but the match has no substitutions left.
    expect(ineligibleTag(false, false, true)).toBe('NO SUBS LEFT');
    // Same side and budget to spend: nothing to explain.
    expect(ineligibleTag(false, false, false)).toBeNull();
    expect(ineligibleTag(true, true, false)).toBeNull();
  });
});
