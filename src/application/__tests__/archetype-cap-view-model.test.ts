import { loadLaunchContent } from '../../content';
import {
  ARCHETYPE_ATTRIBUTE_CAPS,
  PLAYER_ARCHETYPES,
  createCareer,
} from '../../game';
import { createLaunchCareerSetup } from '../launch';
import { squadTrainingViewModel } from '../view-models';

describe('archetype caps in the Squad desk', () => {
  test('shows the real cap for every stat on every archetype', () => {
    const content = loadLaunchContent();
    const initial = createCareer(createLaunchCareerSetup(73101, undefined, content, 'full'));
    const roster = initial.players.filter(player => player.clubId === initial.userClubId);
    const archetypeByPlayerId = new Map(
      PLAYER_ARCHETYPES.map((archetype, index) => [roster[index].id, archetype] as const),
    );
    const state = {
      ...initial,
      players: initial.players.map(player => ({
        ...player,
        archetype: archetypeByPlayerId.get(player.id) ?? player.archetype,
      })),
    };

    const viewModel = squadTrainingViewModel(state, content, undefined, [], []);

    for (const [playerId, archetype] of archetypeByPlayerId) {
      const player = viewModel.players.find(candidate => candidate.id === playerId)!;
      expect(player.archetype).toBe(archetype);
      expect(Object.fromEntries(player.attributes.map(attribute => [
        attribute.label.toLowerCase(),
        attribute.cap,
      ]))).toEqual(ARCHETYPE_ATTRIBUTE_CAPS[archetype]);
    }
  });
});
