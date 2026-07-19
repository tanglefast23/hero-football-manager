import { createLaunchCareerSetup } from '../../application/launch';
import { advanceWeek, createCareer } from '../career';
import { buildCareerFacility } from '../management';
import type { GameState } from '../types';

function userCash(state: ReturnType<typeof createCareer>): number {
  const club = state.clubs.find(candidate => candidate.id === state.userClubId);
  if (club === undefined) throw new Error('missing user club');
  return club.cash;
}

describe('facility weekly integration', () => {
  test('itemizes grid upkeep and awards ambient TP for a Training Pitch', () => {
    const initial = createCareer(createLaunchCareerSetup(20260719, undefined, undefined, 'full'));
    const built = buildCareerFacility(initial, 'training-pitch', { x: 0, y: 0 }).state;
    const cashBeforeSettlement = userCash(built);

    const settled = advanceWeek(built);

    expect(settled.trainingPoints).toBe(built.trainingPoints + 5);
    expect(settled.ledgers[0].lines).toContainEqual({
      kind: 'facilities',
      label: 'Facility upkeep',
      amount: -100,
    });
    const net = settled.ledgers[0].lines.reduce((total, line) => total + line.amount, 0);
    expect(userCash(settled)).toBe(cashBeforeSettlement + net);
  });

  test('carries the Gym + Dorm ten-percent bonus until small real gains earn +1 STA', () => {
    const initial = createCareer(createLaunchCareerSetup(77, undefined, undefined, 'full'));
    const gym = buildCareerFacility(initial, 'gym', { x: 0, y: 0 }).state;
    const withAdjacency = buildCareerFacility(gym, 'dorm', { x: 1, y: 0 }).state;
    const playerId = withAdjacency.lineups
      .find(lineup => lineup.clubId === withAdjacency.userClubId)?.playerIds[0];
    if (playerId === undefined) throw new Error('missing user player');
    const withoutMatches: GameState = {
      ...withAdjacency,
      fixtures: [],
      m2: withAdjacency.m2 === undefined
        ? undefined
        : { ...withAdjacency.m2, nationalCups: [] },
      // Neutralize the other M2 growth multipliers so this assertion isolates
      // the adjacency's exact percentage carry.
      players: withAdjacency.players.map(player => player.id === playerId
        ? { ...player, age: 25, archetype: 'Sniper' }
        : player),
    };
    const startingSta = withoutMatches.players.find(player => player.id === playerId)?.attrs.sta;
    if (startingSta === undefined) throw new Error('missing user player STA');

    let state = withoutMatches;
    for (let week = 0; week < 9; week += 1) state = advanceWeek(state);
    const afterNine = state.players.find(player => player.id === playerId);
    expect(afterNine?.attrs.sta).toBe(startingSta + 9);
    expect(afterNine?.facilityStaBonusRemainder).toBe(90);

    state = advanceWeek(state);
    const afterTen = state.players.find(player => player.id === playerId);
    expect(afterTen?.attrs.sta).toBe(startingSta + 11);
    expect(afterTen?.facilityStaBonusRemainder).toBe(0);
  });

  test('keeps M1 ambient TP behavior and charges no upkeep when the grid is absent', () => {
    const initial = createCareer(createLaunchCareerSetup(88));
    const legacy = {
      ...initial,
      facilities: { trainingGroundBuilt: true },
    };

    const settled = advanceWeek(legacy);

    expect(settled.trainingPoints).toBe(legacy.trainingPoints + 5);
    expect(settled.ledgers[0].lines.some(line => line.kind === 'facilities')).toBe(false);
  });
});
