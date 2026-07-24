import { loadLaunchContent } from '../../content';
import {
  PLAYER_ARCHETYPES,
  createCareer,
  playerAttributeCaps,
  playerPotentialGrade,
  playerPotentialTrainingBonusPercent,
  roleOverall,
} from '../../game';
import { createLaunchCareerSetup } from '../launch';
import { squadTrainingViewModel } from '../view-models';

describe('open-ended potential in the Squad desk', () => {
  test('shows role-aware current ratings and exact training-speed grades', () => {
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

    const viewModel = squadTrainingViewModel(state, content, undefined, []);

    for (const [playerId, archetype] of archetypeByPlayerId) {
      const player = viewModel.players.find(candidate => candidate.id === playerId)!;
      const careerPlayer = state.players.find(candidate => candidate.id === playerId)!;
      expect(player.archetype).toBe(archetype);
      expect(Object.fromEntries(player.attributes.map(attribute => [
        attribute.label.toLowerCase(),
        attribute.cap,
      ]))).toEqual(playerAttributeCaps(careerPlayer));
      expect(player.overall).toBe(roleOverall(careerPlayer.role, careerPlayer.attrs));
      expect(player.potentialGrade).toBe(playerPotentialGrade(careerPlayer));
      expect(player.potentialBonusPercent)
        .toBe(playerPotentialTrainingBonusPercent(careerPlayer));
    }
  });
});
