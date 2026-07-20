import { readFileSync } from 'fs';
import { join } from 'path';
import { loadLaunchContent } from '../../content';
import { applyCareerTraining, createCareer } from '../../game';
import { createLaunchCareerSetup } from '../launch';
import { squadTrainingViewModel } from '../view-models';

describe('saved weekly-plan summary', () => {
  const content = loadLaunchContent();
  const drills = content.training.focusDrills.slice(0, 2);

  function plannedCareer() {
    const initial = createCareer(createLaunchCareerSetup(20260720, undefined, content));
    const players = initial.players
      .filter(player => player.clubId === initial.userClubId)
      .slice(0, 2);
    return {
      players,
      state: applyCareerTraining(initial, players.map(player => player.id), drills),
    };
  }

  it('exposes the locked players, exercises, and weekly costs when the editor matches the saved plan', () => {
    const { players, state } = plannedCareer();
    const viewModel = squadTrainingViewModel(
      state,
      content,
      undefined,
      players.map(player => player.id),
      drills.map(drill => drill.id),
    );

    expect(viewModel.lockedPlan).toEqual({
      playerNames: players.map(player => player.name),
      drillNames: drills.map(drill => drill.name),
      moneyCost: drills.reduce((sum, drill) => sum + drill.moneyCost, 0),
      trainingPointCost: drills.reduce((sum, drill) => sum + drill.tpCost, 0),
    });
  });

  it('returns to an editable plan total as soon as players or drills differ from the saved plan', () => {
    const { players, state } = plannedCareer();

    expect(squadTrainingViewModel(
      state,
      content,
      undefined,
      players.slice(0, 1).map(player => player.id),
      drills.map(drill => drill.id),
    ).lockedPlan).toBeUndefined();

    expect(squadTrainingViewModel(
      state,
      content,
      undefined,
      players.map(player => player.id),
      drills.slice(0, 1).map(drill => drill.id),
    ).lockedPlan).toBeUndefined();
  });

  it('renders the locked weekly plan instead of the save controls until the selection changes', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/ui/screens/SquadTrainingScreen.tsx'),
      'utf8',
    );

    expect(source).toContain('viewModel.lockedPlan === undefined');
    expect(source).toContain('kicker="The weekly plan"');
    expect(source).toContain('title="Locked in"');
    expect(source).toContain('viewModel.lockedPlan.playerNames');
    expect(source).toContain('viewModel.lockedPlan.drillNames');
    expect(source).toContain('label="Save weekly plan"');
  });
});
