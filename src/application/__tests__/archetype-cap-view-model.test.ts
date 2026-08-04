import { loadLaunchContent } from '../../content';
import {
  PLAYER_ARCHETYPES,
  createCareer,
  playerAttributeCaps,
  playerGrowthGrade,
  playerPotentialGrade,
  superTrainingChancePercent,
  roleOverall,
} from '../../game';
import { createLaunchCareerSetup } from '../launch';
import { squadTrainingViewModel } from '../view-models';

describe('open-ended potential in the Squad desk', () => {
  test('shows role-aware current ratings and exact training-speed grades', () => {
    const content = loadLaunchContent();
    const initial = createCareer(createLaunchCareerSetup(73101, undefined, content));
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

    const viewModel = squadTrainingViewModel(state, content, undefined);

    for (const [playerId, archetype] of archetypeByPlayerId) {
      const player = viewModel.players.find(candidate => candidate.id === playerId)!;
      const careerPlayer = state.players.find(candidate => candidate.id === playerId)!;
      expect(player.archetype).toBe(archetype);
      expect(Object.fromEntries(player.attributes.map(attribute => [
        attribute.label.toLowerCase(),
        attribute.cap,
      ]))).toEqual(playerAttributeCaps(careerPlayer));
      expect(player.overall).toBe(roleOverall(careerPlayer.role, careerPlayer.attrs));
      // The column is the training-speed grade this test was always named for:
      // age band, position and archetype at three quarters, the SUPER lottery at
      // one. It used to print raw talent, which flattered a thirty-year-old with
      // a ceiling they could no longer reach.
      expect(player.potentialGrade).toBe(playerGrowthGrade(careerPlayer));
      // The odds beside it stay on the *raw* grade, because that is what
      // `trainPlayerInstantly` rolls against. Deriving them from the growth
      // grade would print a number the drill does not use.
      expect(player.superChancePercent)
        .toBe(superTrainingChancePercent(playerPotentialGrade(careerPlayer)));
    }
  });
});
