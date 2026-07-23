import { readFileSync } from 'fs';
import { join } from 'path';
import { loadLaunchContent } from '../../content';
import { applyCareerTraining, createCareer, setCareerTrainingPlan } from '../../game';
import { createLaunchCareerSetup } from '../launch';
import { squadTrainingViewModel } from '../view-models';

describe('saved weekly-plan summary', () => {
  const content = loadLaunchContent();
  const drills = content.training.focusDrills.filter(drill => (
    drill.id === 'sprints' || drill.id === 'finishing'
  ));

  function plannedCareer() {
    const initial = createCareer(createLaunchCareerSetup(20260720, undefined, content));
    const players = initial.players
      .filter(player => player.clubId === initial.userClubId)
      .slice(0, 2);
    const prepared = {
      ...initial,
      players: initial.players.map(player => players.some(trainee => trainee.id === player.id)
        ? {
            ...player,
            potential: 5 as const,
            potentialCeiling: 99,
            attrs: { ...player.attrs, pac: 20, sho: 20 },
          }
        : player),
    };
    return {
      players,
      state: applyCareerTraining(prepared, players.map(player => player.id), drills),
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
      players: players.map(player => ({
        id: player.id,
        name: player.name,
        role: player.role,
        ...(player.lookId === undefined ? {} : { lookId: player.lookId }),
        trainingProgress: [
          { label: 'PAC', value: 20, cap: 99, weeklyGain: 3, atCap: false },
          { label: 'SHO', value: 20, cap: 99, weeklyGain: 3, atCap: false },
        ],
      })),
      drills: drills.map(drill => ({
        id: drill.id,
        name: drill.name,
        gainLabel: Object.entries(drill.gains)
          .map(([attribute, gain]) => `+${gain} ${attribute.toUpperCase()}`)
          .join(' · '),
      })),
      moneyCost: drills.reduce((sum, drill) => sum + drill.moneyCost, 0) * players.length,
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
    expect(source).toContain('viewModel.lockedPlan.players');
    expect(source).toContain('viewModel.lockedPlan.drills');
    expect(source).toContain('<PixelPortrait');
    expect(source).toContain('<DrillIcon drillId={drill.id}');
    expect(source).not.toContain('>✓ {playerName}</Text>');
    expect(source).not.toContain('>✓ {drillName}</Text>');
    expect(source).toContain("? 'Save changes' : 'Save weekly plan'");
  });

  it('puts drill icons on the left and the add/remove control on the far right', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/ui/screens/SquadTrainingScreen.tsx'),
      'utf8',
    );
    const pickerStart = source.indexOf('{viewModel.drills.map');
    const pickerEnd = source.indexOf('{viewModel.lockedPlan === undefined');
    const picker = source.slice(pickerStart, pickerEnd);

    expect(picker.indexOf('<DrillIcon drillId={drill.id}')).toBeGreaterThanOrEqual(0);
    expect(picker.indexOf('<DrillIcon drillId={drill.id}')).toBeLessThan(picker.indexOf('{drill.name}'));
    expect(picker.indexOf('{drill.name}')).toBeLessThan(picker.indexOf('{formatCurrency(drill.moneyCost)}'));
    expect(picker.indexOf('{formatCurrency(drill.moneyCost)}')).toBeLessThan(
      picker.indexOf('accessibilityLabel={drill.selected ? `Remove ${drill.name}` : `Add ${drill.name}`}'),
    );
    expect(picker).not.toContain("drill.selected ? '✓' : '+'");
  });

  it('carries each locked drill gain label into the saved plan panel', () => {
    let state = createCareer(createLaunchCareerSetup(413, undefined, content, 'full'));
    const roster = state.players.filter(player => player.clubId === state.userClubId);
    const trainee = roster[0];
    const drill = content.training.focusDrills[0];
    state = setCareerTrainingPlan(state, [trainee.id], [drill]);

    const model = squadTrainingViewModel(state, content, undefined, [trainee.id], [drill.id]);

    // guard first: a bare `lockedPlan?.` chain would hide a missing panel
    expect(model.lockedPlan).toBeDefined();
    expect(model.lockedPlan?.drills[0]?.gainLabel).toMatch(/^\+\d+ [A-Z]{3}/);
  });
});
