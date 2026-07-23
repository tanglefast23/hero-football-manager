import { readFileSync } from 'fs';
import { join } from 'path';
import { loadLaunchContent } from '../../content';
import { applyCareerTraining, createCareer, resolveTrainingDrillForPath, setCareerTrainingPlan } from '../../game';
import { createLaunchCareerSetup } from '../launch';
import { squadTrainingViewModel } from '../view-models';

describe('saved weekly-plan summary', () => {
  const content = loadLaunchContent();
  const drillNameFor = (drillId: string) =>
    content.training.focusDrills.find(candidate => candidate.id === drillId)?.name ?? drillId;

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
    const slots = [
      { playerId: players[0].id, pathId: 'sprints' },
      { playerId: players[1].id, pathId: 'finishing' },
    ];
    return {
      players,
      slots,
      state: applyCareerTraining(prepared, slots),
    };
  }

  it('exposes each slot\'s drill name, gain label, and the weekly TP total', () => {
    const { players, slots, state } = plannedCareer();
    const sprints = resolveTrainingDrillForPath(state, 'sprints');
    const finishing = resolveTrainingDrillForPath(state, 'finishing');
    const viewModel = squadTrainingViewModel(state, content, undefined, slots);

    expect(viewModel.slots).toEqual([
      {
        playerId: players[0].id,
        playerName: players[0].name,
        pathId: 'sprints',
        drillName: drillNameFor(sprints.id),
        gainLabel: `+${sprints.gains.pac} PAC`,
      },
      {
        playerId: players[1].id,
        playerName: players[1].name,
        pathId: 'finishing',
        drillName: drillNameFor(finishing.id),
        gainLabel: `+${finishing.gains.sho} SHO`,
      },
    ]);
    expect(viewModel.weeklyTrainingPointCost).toBe(sprints.tpCost + finishing.tpCost);
  });

  it('drops a slot from the weekly total as soon as its stat is cleared', () => {
    const { players, slots, state } = plannedCareer();
    const finishing = resolveTrainingDrillForPath(state, 'finishing');
    const draftSlots = [
      { playerId: players[0].id, pathId: null },
      slots[1],
    ];

    const viewModel = squadTrainingViewModel(state, content, undefined, draftSlots);

    expect(viewModel.slots).toEqual([{
      playerId: players[1].id,
      playerName: players[1].name,
      pathId: 'finishing',
      drillName: drillNameFor(finishing.id),
      gainLabel: `+${finishing.gains.sho} SHO`,
    }]);
    expect(viewModel.weeklyTrainingPointCost).toBe(finishing.tpCost);
    // The player still occupies a slot even without a stat picked yet.
    expect(viewModel.players.find(player => player.id === players[0].id)?.slotNumber).toBe(1);
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

  it('carries each slot\'s gain label from the real drill catalog', () => {
    let state = createCareer(createLaunchCareerSetup(413, undefined, content, 'full'));
    const roster = state.players.filter(player => player.clubId === state.userClubId);
    const trainee = roster[0];
    state = setCareerTrainingPlan(state, [{ playerId: trainee.id, pathId: 'sprints' }]);

    const model = squadTrainingViewModel(
      state,
      content,
      undefined,
      [{ playerId: trainee.id, pathId: 'sprints' }],
    );

    expect(model.slots).toHaveLength(1);
    expect(model.slots[0]?.gainLabel).toMatch(/^\+\d+ [A-Z]{3}/);
  });
});
