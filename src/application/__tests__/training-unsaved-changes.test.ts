import { loadLaunchContent } from '../../content';
import { DEFAULT_CREATION_RATINGS } from '../../game';
import { useM1Store } from '../store';
import { squadTrainingViewModel } from '../view-models';

describe('squadTrainingViewModel hasUnsavedChanges', () => {
  const content = loadLaunchContent();

  beforeEach(() => {
    useM1Store.setState(useM1Store.getInitialState(), true);
    useM1Store.getState().startNewCareer(20260721, 'full');
    useM1Store.getState().completePlayerCreation({
      name: 'Jo Rook',
      ratings: DEFAULT_CREATION_RATINGS,
    });
  });

  function createdPlayerId(): string {
    const career = useM1Store.getState().career!;
    return career.onboarding!.createdPlayerId!;
  }

  it('is false on a fresh career with no saved plan (nothing to un-save)', () => {
    const career = useM1Store.getState().career!;
    expect(career.trainingPlan).toBeUndefined();
    const vm = squadTrainingViewModel(career, content, undefined, [createdPlayerId()], ['sprints']);
    expect(vm.hasUnsavedChanges).toBe(false);
  });

  it('is false when the editor selection still matches the locked plan', () => {
    const playerId = createdPlayerId();
    useM1Store.setState({ assignedPlayerIds: [playerId], selectedDrillIds: ['sprints'] });
    useM1Store.getState().applyTraining();
    const saved = useM1Store.getState().career!;
    expect(saved.trainingPlan).toBeDefined();

    const vm = squadTrainingViewModel(saved, content, playerId, [playerId], ['sprints']);
    expect(vm.hasUnsavedChanges).toBe(false);
    expect(vm.lockedPlan).toBeDefined();
  });

  it('is true when the selection differs from the locked plan', () => {
    const playerId = createdPlayerId();
    useM1Store.setState({ assignedPlayerIds: [playerId], selectedDrillIds: ['sprints'] });
    useM1Store.getState().applyTraining();
    const saved = useM1Store.getState().career!;

    const vm = squadTrainingViewModel(saved, content, playerId, [playerId], ['rondo']);
    expect(vm.hasUnsavedChanges).toBe(true);
    expect(vm.lockedPlan).toBeUndefined();
  });
});
