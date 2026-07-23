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
  setCareerTrainingPlan,
  slotIsAtCap,
  slotTrainingPointCost,
  weeklyAmbientTrainingPoints,
  type GameState,
} from '../../game';

const content = loadLaunchContent();

describe('training trace', () => {
  it('traces weeks 1-5', () => {
    let state: GameState = addCreatedPlayer(
      beginStoryOnboarding(createCareer(createLaunchCareerSetup(
        4_000_000, undefined, content, 'full', 'COZY',
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
      // advanceWeek now refuses to run while a slot is capped or the plan is
      // short on TP, so drop capped trainees and, if the remainder still
      // can't be funded this week, clear the plan entirely before saving it.
      let slots = assigned
        .filter(playerId => !slotIsAtCap(state, { playerId, pathId: drill.id }))
        .map(playerId => ({ playerId, pathId: drill.id }));
      const projectedTrainingPoints = state.trainingPoints + weeklyAmbientTrainingPoints(state);
      if (slotTrainingPointCost(state, slots) > projectedTrainingPoints) {
        slots = [];
      }

      // Probe failures must surface: swallowing a rejected plan can make two
      // supposedly different cohorts byte-identical and invalidate the result.
      const next = setCareerTrainingPlan(state, slots);
      const club = state.clubs.find(c => c.id === state.userClubId)!;
      lines.push(
        `wk${state.week} tp=${state.trainingPoints} cash=${club.cash} `
        + `heroPac=${hero.attrs.pac} plan=set `
        + `stored=${JSON.stringify(next.trainingPlan?.slots.length ?? null)}`,
      );
      state = advanceWeek(next);
    }
    // eslint-disable-next-line no-console
    console.log(`\n${lines.join('\n')}`);
    expect(lines.length).toBeGreaterThan(0);
  }, 120_000);
});
