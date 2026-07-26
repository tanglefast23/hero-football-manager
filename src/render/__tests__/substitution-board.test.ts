import { MAX_SUBSTITUTIONS } from '../../sim/substitutions';
import {
  EMPTY_SUBSTITUTION_PLAN,
  bringOn,
  canSave,
  fieldByTiredness,
  isBenched,
  isComingOn,
  openSlotCount,
  planInputs,
  planProblem,
  recallToField,
  returnToBench,
  sendToBench,
  slotForReplacement,
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

const FIELD = [
  starter(0, 96, 'GK'),
  starter(1, 24),
  starter(2, 51),
  starter(3, 24, 'DEF'),
  starter(4, 88, 'FWD'),
];

describe('substitution board rules', () => {
  it('puts the most tired starter on top, breaking ties by slot', () => {
    expect(fieldByTiredness(FIELD).map(player => player.index)).toEqual([1, 3, 2, 4, 0]);
  });

  it('stages as many swaps as the manager likes, in any order', () => {
    let plan = EMPTY_SUBSTITUTION_PLAN;
    plan = sendToBench(plan, starter(1, 24), MAX_SUBSTITUTIONS).plan;
    plan = sendToBench(plan, starter(3, 24, 'DEF'), MAX_SUBSTITUTIONS).plan;
    // Bringing on happens independently of the order they went off.
    plan = bringOn(plan, substitute('zed'), FIELD).plan;
    plan = bringOn(plan, substitute('yan', 'DEF'), FIELD).plan;

    expect(planProblem(plan, MAX_SUBSTITUTIONS)).toBeNull();
    expect(planInputs(plan)).toEqual([
      { player: 1, replacementId: 'zed' },
      { player: 3, replacementId: 'yan' },
    ]);
  });

  it('counts the missing players in words, the way Bert would say it', () => {
    let plan = sendToBench(EMPTY_SUBSTITUTION_PLAN, starter(1, 24), MAX_SUBSTITUTIONS).plan;
    expect(planProblem(plan, MAX_SUBSTITUTIONS)).toBe("You're missing one player on the field.");

    plan = sendToBench(plan, starter(2, 51), MAX_SUBSTITUTIONS).plan;
    expect(planProblem(plan, MAX_SUBSTITUTIONS)).toBe("You're missing two players on the field.");

    plan = bringOn(plan, substitute('zed'), FIELD).plan;
    expect(planProblem(plan, MAX_SUBSTITUTIONS)).toBe("You're missing one player on the field.");
    expect(canSave(plan, MAX_SUBSTITUTIONS)).toBe(false);

    plan = bringOn(plan, substitute('yan'), FIELD).plan;
    expect(planProblem(plan, MAX_SUBSTITUTIONS)).toBeNull();
    expect(canSave(plan, MAX_SUBSTITUTIONS)).toBe(true);
  });

  it('says what to do first when nothing is staged', () => {
    expect(planProblem(EMPTY_SUBSTITUTION_PLAN, MAX_SUBSTITUTIONS))
      .toBe('Drag a tired player down to the bench to start a substitution.');
  });

  it('refuses to bring anyone on to a full field', () => {
    const move = bringOn(EMPTY_SUBSTITUTION_PLAN, substitute('zed'), FIELD);

    expect(move.rejection).toBe('field-full');
    expect(move.plan).toEqual(EMPTY_SUBSTITUTION_PLAN);
  });

  it('keeps goalkeepers and outfielders out of each other shirts', () => {
    const outfieldOff = sendToBench(EMPTY_SUBSTITUTION_PLAN, starter(1, 24), MAX_SUBSTITUTIONS).plan;
    const keeperOntoOutfield = bringOn(outfieldOff, substitute('gk-sub', 'GK'), FIELD);
    expect(keeperOntoOutfield.rejection).toBe('keeper-only-for-keeper');

    const keeperOff = sendToBench(EMPTY_SUBSTITUTION_PLAN, starter(0, 96, 'GK'), MAX_SUBSTITUTIONS).plan;
    const outfielderIntoGoal = bringOn(keeperOff, substitute('zed'), FIELD);
    expect(outfielderIntoGoal.rejection).toBe('keeper-needs-keeper');

    // The legal pairing goes through.
    const keeperForKeeper = bringOn(keeperOff, substitute('gk-sub', 'GK'), FIELD);
    expect(keeperForKeeper.rejection).toBeUndefined();
    expect(planInputs(keeperForKeeper.plan)).toEqual([{ player: 0, replacementId: 'gk-sub' }]);
  });

  it('never stages a sent-off player, who cannot be replaced', () => {
    const move = sendToBench(EMPTY_SUBSTITUTION_PLAN, starter(4, 40, 'FWD', true), MAX_SUBSTITUTIONS);

    expect(move.rejection).toBe('sent-off');
    expect(move.plan.slots).toHaveLength(0);
  });

  it('stops staging at the substitutions actually left', () => {
    let plan = EMPTY_SUBSTITUTION_PLAN;
    plan = sendToBench(plan, starter(1, 24), 2).plan;
    plan = sendToBench(plan, starter(2, 51), 2).plan;
    const overBudget = sendToBench(plan, starter(3, 24, 'DEF'), 2);

    expect(overBudget.rejection).toBe('no-substitutions-left');
    expect(overBudget.plan.slots).toHaveLength(2);
  });

  it('undoes a bench drop and a substitute in either order', () => {
    let plan = sendToBench(EMPTY_SUBSTITUTION_PLAN, starter(1, 24), MAX_SUBSTITUTIONS).plan;
    plan = bringOn(plan, substitute('zed'), FIELD).plan;
    expect(isBenched(plan, 1)).toBe(true);
    expect(isComingOn(plan, 'zed')).toBe(true);
    expect(slotForReplacement(plan, 'zed')).toBe(1);

    // Sending the substitute back leaves the hole open, not the plan broken.
    const withoutSub = returnToBench(plan, 'zed');
    expect(openSlotCount(withoutSub)).toBe(1);
    expect(isBenched(withoutSub, 1)).toBe(true);

    // Recalling the starter drops the whole staged swap.
    const recalled = recallToField(plan, 1);
    expect(recalled.slots).toHaveLength(0);
    expect(isComingOn(recalled, 'zed')).toBe(false);
  });

  it('ignores a substitute dropped in twice', () => {
    let plan = sendToBench(EMPTY_SUBSTITUTION_PLAN, starter(1, 24), MAX_SUBSTITUTIONS).plan;
    plan = sendToBench(plan, starter(2, 51), MAX_SUBSTITUTIONS).plan;
    plan = bringOn(plan, substitute('zed'), FIELD).plan;
    const again = bringOn(plan, substitute('zed'), FIELD);

    // One bench player cannot fill two holes — the engine rejects the duplicate.
    expect(again.plan).toEqual(plan);
    expect(planInputs(again.plan)).toEqual([{ player: 1, replacementId: 'zed' }]);
  });

  it('emits one engine payload per staged pair and nothing for open holes', () => {
    let plan = sendToBench(EMPTY_SUBSTITUTION_PLAN, starter(1, 24), MAX_SUBSTITUTIONS).plan;
    plan = sendToBench(plan, starter(2, 51), MAX_SUBSTITUTIONS).plan;
    plan = bringOn(plan, substitute('zed'), FIELD).plan;

    expect(planInputs(plan)).toEqual([{ player: 1, replacementId: 'zed' }]);
  });
});
