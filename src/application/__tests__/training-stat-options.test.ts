import { loadLaunchContent } from '../../content';
import { createCareer, playerAttributeCaps } from '../../game';
import { createLaunchCareerSetup } from '../launch';
import { squadTrainingViewModel } from '../view-models';

describe('training stat options', () => {
  const content = loadLaunchContent();
  const state = createCareer(createLaunchCareerSetup(20260724, undefined, content, 'full'));
  const roster = state.players.filter(player => player.clubId === state.userClubId);

  it('reports current value, personal cap, and short code for each option', () => {
    const outfielder = roster.find(player => player.role !== 'GK')!;
    const options = squadTrainingViewModel(state, content, outfielder.id, []).selectedPlayerStatOptions!;
    const duels = options.find(option => option.pathId === 'duels')!;

    expect(duels).toMatchObject({
      shortCode: 'DEF',
      current: outfielder.attrs.def,
      cap: playerAttributeCaps(outfielder).def,
      room: playerAttributeCaps(outfielder).def - outfielder.attrs.def,
    });
  });

  it('hides keeper drills from outfield players and finishing from goalkeepers', () => {
    const outfielder = roster.find(player => player.role !== 'GK')!;
    const keeper = roster.find(player => player.role === 'GK')!;
    const outfieldOptions = squadTrainingViewModel(state, content, outfielder.id, []).selectedPlayerStatOptions!;
    const keeperOptions = squadTrainingViewModel(state, content, keeper.id, []).selectedPlayerStatOptions!;

    expect(outfieldOptions).toHaveLength(6);
    expect(outfieldOptions.some(option => option.pathId === 'keeper-drills')).toBe(false);
    expect(keeperOptions).toHaveLength(6);
    expect(keeperOptions.some(option => option.pathId === 'finishing')).toBe(false);
  });
});
