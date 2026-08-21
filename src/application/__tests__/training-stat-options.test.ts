import { loadLaunchContent } from '../../content';
import { createCareer } from '../../game';
import { SUPER_TRAINING_PITY_DRILLS } from '../../game/training';
import { createLaunchCareerSetup } from '../launch';
import { squadTrainingViewModel } from '../view-models';

describe('training stat options', () => {
  const content = loadLaunchContent();
  const state = createCareer(
    createLaunchCareerSetup(20260724, undefined, content),
  );
  const roster = state.players.filter(
    (player) => player.clubId === state.userClubId,
  );

  it('reports current value and short code for each option, with no visible cap', () => {
    const outfielder = roster.find((player) => player.role !== 'GK')!;
    const options = squadTrainingViewModel(
      state,
      content,
      outfielder.id,
    ).selectedPlayerStatOptions!;
    const duels = options.find((option) => option.pathId === 'duels')!;

    expect(duels).toMatchObject({
      shortCode: 'DEF',
      currentValue: outfielder.attrs.def,
      atSafetyCeiling: false,
    });
    expect(duels).not.toHaveProperty('cap');
    expect(duels).not.toHaveProperty('room');
  });

  it('offers only the drills the match engine reads for that role', () => {
    const outfielder = roster.find((player) => player.role !== 'GK')!;
    const keeper = roster.find((player) => player.role === 'GK')!;
    const outfieldOptions = squadTrainingViewModel(
      state,
      content,
      outfielder.id,
    ).selectedPlayerStatOptions!;
    const keeperOptions = squadTrainingViewModel(
      state,
      content,
      keeper.id,
    ).selectedPlayerStatOptions!;

    // Outfielders never face a shot, so REF is the only drill they lose.
    expect(outfieldOptions.map((option) => option.pathId)).toEqual([
      'sprints',
      'finishing',
      'rondo',
      'duels',
      'first-touch',
      'circuit',
    ]);
    // A keeper never shoots, never tackles and is never tackled, so Finishing,
    // Duels and First Touch all buy them literally nothing.
    expect(keeperOptions.map((option) => option.pathId)).toEqual([
      'sprints',
      'rondo',
      'circuit',
      'keeper-drills',
    ]);
  });

  it('separates the authored drill gain from Jojo-style player bonuses', () => {
    const outfielder = roster.find((player) => player.role !== 'GK')!;
    const playerState = {
      ...state,
      players: state.players.map((player) =>
        player.id === outfielder.id
          ? {
              ...player,
              age: 18,
              role: 'FWD' as const,
              archetype: 'All-Rounder' as const,
              attrs: { ...player.attrs, sho: 73 },
              trainingBonusRemainders: { sho: 75 },
            }
          : player,
      ),
    };
    const finishing = squadTrainingViewModel(
      playerState,
      content,
      outfielder.id,
    ).selectedPlayerStatOptions!.find(
      (option) => option.pathId === 'finishing',
    )!;

    expect(finishing).toMatchObject({
      currentValue: 73,
      gain: 3,
      baseValueAfter: 76,
      trainingAdjustment: 1,
      trainingModifiers: [
        { label: 'Youth', helps: true },
        { label: 'FWD', helps: true },
        { label: 'All-Rounder', helps: true },
      ],
      fractionalBonusBanks: [{ label: 'Training bonus bank', hundredths: 8 }],
    });
  });

  it('shows active drill effects and the SUPER pity countdown', () => {
    const outfielder = roster.find((player) => player.role !== 'GK')!;
    const affected = {
      ...state,
      players: state.players.map((player) =>
        player.id === outfielder.id
          ? {
              ...player,
              drillsSinceSuper: SUPER_TRAINING_PITY_DRILLS - 1,
            }
          : player,
      ),
      playerRequests: {
        ...state.playerRequests!,
        effects: [
          {
            kind: 'DRILL_PLAYER' as const,
            playerId: outfielder.id,
            weeksRemaining: 2,
            multiplierPercent: 80,
          },
        ],
      },
    };
    const viewModel = squadTrainingViewModel(affected, content, outfielder.id);
    const player = viewModel.players.find(
      (candidate) => candidate.id === outfielder.id,
    )!;
    const sprints = viewModel.selectedPlayerStatOptions!.find(
      (option) => option.pathId === 'sprints',
    )!;

    expect(player.drillsUntilGuaranteedSuper).toBe(1);
    expect(sprints.trainingModifiers).toContainEqual({
      label: 'Active effect',
      helps: false,
    });
  });
});
