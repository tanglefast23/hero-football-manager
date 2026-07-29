import { loadLaunchContent } from '../../content';
import { createCareer } from '../../game';
import { createLaunchCareerSetup } from '../launch';
import { squadTrainingViewModel } from '../view-models';

describe('training stat options', () => {
  const content = loadLaunchContent();
  const state = createCareer(createLaunchCareerSetup(20260724, undefined, content));
  const roster = state.players.filter(player => player.clubId === state.userClubId);

  it('reports current value and short code for each option, with no visible cap', () => {
    const outfielder = roster.find(player => player.role !== 'GK')!;
    const options = squadTrainingViewModel(state, content, outfielder.id).selectedPlayerStatOptions!;
    const duels = options.find(option => option.pathId === 'duels')!;

    expect(duels).toMatchObject({
      shortCode: 'DEF',
      currentValue: outfielder.attrs.def,
      atSafetyCeiling: false,
    });
    expect(duels).not.toHaveProperty('cap');
    expect(duels).not.toHaveProperty('room');
  });

  it('hides keeper drills from outfield players and finishing from goalkeepers', () => {
    const outfielder = roster.find(player => player.role !== 'GK')!;
    const keeper = roster.find(player => player.role === 'GK')!;
    const outfieldOptions = squadTrainingViewModel(state, content, outfielder.id).selectedPlayerStatOptions!;
    const keeperOptions = squadTrainingViewModel(state, content, keeper.id).selectedPlayerStatOptions!;

    expect(outfieldOptions).toHaveLength(6);
    expect(outfieldOptions.some(option => option.pathId === 'keeper-drills')).toBe(false);
    expect(keeperOptions).toHaveLength(6);
    expect(keeperOptions.some(option => option.pathId === 'finishing')).toBe(false);
  });

  it('separates the authored drill gain from Jojo-style player bonuses', () => {
    const outfielder = roster.find(player => player.role !== 'GK')!;
    const playerState = {
      ...state,
      players: state.players.map(player => player.id === outfielder.id
        ? {
            ...player,
            age: 18,
            role: 'FWD' as const,
            archetype: 'All-Rounder' as const,
            attrs: { ...player.attrs, sho: 73 },
            trainingBonusRemainders: { sho: 75 },
          }
        : player),
    };
    const finishing = squadTrainingViewModel(
      playerState,
      content,
      outfielder.id,
    ).selectedPlayerStatOptions!.find(option => option.pathId === 'finishing')!;

    expect(finishing).toMatchObject({
      currentValue: 73,
      gain: 5,
      baseValueAfter: 78,
      trainingAdjustment: 3,
      trainingModifierLabels: ['Youth', 'FWD', 'All-Rounder'],
    });
  });
});
