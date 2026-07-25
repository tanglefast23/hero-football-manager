/** SCRATCH: traces one career week-by-week to verify focus training actually applies. */
import { createLaunchCareerSetup } from '../../application/launch';
import { loadLaunchContent } from '../../content';
import {
  activeCareerMatchday,
  addCreatedPlayer,
  advanceWeek,
  beginStoryOnboarding,
  createCareer,
  createdPlayer,
  trainPlayerInstantly,
  type GameState,
} from '../../game';

const content = loadLaunchContent();

describe('training trace', () => {
  it('traces weeks 1-5', () => {
    let state: GameState = addCreatedPlayer(
      beginStoryOnboarding(createCareer(createLaunchCareerSetup(
        4_000_000, undefined, content, 'COZY',
      ))),
      { name: 'Probe Rookie', ratings: { pac: 55, sho: 60, pas: 50, def: 50, tec: 50, sta: 50 } },
    );
    const drill = content.training.focusDrills.find(d => d.id === 'sprints')!;
    const lines: string[] = [];

    for (let step = 0; step < 12; step += 1) {
      if (state.phase !== 'manage') {
        const md = activeCareerMatchday(state);
        lines.push(`wk${state.week} phase=${state.phase} matchday=${md?.kind ?? 'none'} -> stop`);
        break;
      }
      const hero = createdPlayer(state)!;
      const lineup = state.lineups.find(l => l.clubId === state.userClubId)!;
      const others = state.players
        .filter(p => p.clubId === state.userClubId && p.id !== hero.id
          && p.role !== 'GK' && lineup.playerIds.includes(p.id))
        .slice(0, 2);
      const assigned = [hero.id, ...others.map(p => p.id)];
      // Drills resolve at tap time now: tap each cohort member once per manage
      // week while the bank affords the drill, the tap-cadence equivalent of
      // the old repeating weekly plan.
      let next = state;
      let tapped = 0;
      for (const playerId of assigned) {
        const player = next.players.find(p => p.id === playerId);
        if (player === undefined || player.injuryWeeks > 0) continue;
        if (drill.tpCost > next.trainingPoints) continue;
        next = trainPlayerInstantly(next, playerId, drill.id).state;
        tapped += 1;
      }
      const club = state.clubs.find(c => c.id === state.userClubId)!;
      lines.push(
        `wk${state.week} tp=${state.trainingPoints} cash=${club.cash} `
        + `heroPac=${hero.attrs.pac} tapped=${tapped}`,
      );
      state = advanceWeek(next);
    }
    // eslint-disable-next-line no-console
    console.log(`\n${lines.join('\n')}`);
    expect(lines.length).toBeGreaterThan(0);
  }, 120_000);
});
