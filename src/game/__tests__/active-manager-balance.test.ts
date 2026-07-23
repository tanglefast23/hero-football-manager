import { createLaunchCareerSetup } from '../../application/launch';
import {
  activeCareerMatchday, advanceWeek, completeMatchday, createCareer, startNextSeason,
} from '../career';
import { renewCareerPlayer } from '../squad';
import { setCareerTrainingPlan, slotTrainingPointCost } from '../training';
import { playerAttributeCaps } from '../archetype-caps';
import { TRAINING_PATHS } from '../training-paths';
import type { GameState, LeagueFixture } from '../types';

const SEEDS = [0, 77, 20_260_719];
const SEASONS = 6;

function winnerScore(f: LeagueFixture, user: string) {
  if (f.homeClubId === user) return { fixtureId: f.id, homeGoals: 3, awayGoals: 0 };
  if (f.awayClubId === user) return { fixtureId: f.id, homeGoals: 0, awayGoals: 3 };
  return { fixtureId: f.id, homeGoals: 1, awayGoals: 1 };
}

// Up to 3 non-injured players with the most headroom, each on their most-open
// path, trimmed so the total TP cost fits the current bank (so advanceWeek's
// interrupt guard never fires).
function affordableSlots(state: GameState) {
  const roster = state.players.filter(p => p.clubId === state.userClubId && (p.injuryWeeks ?? 0) === 0);
  const ranked = roster.map(p => {
    const caps = playerAttributeCaps(p);
    const best = TRAINING_PATHS
      .map(path => ({ pathId: path.pathId, room: caps[path.attribute] - p.attrs[path.attribute] }))
      .sort((a, b) => b.room - a.room)[0];
    return { playerId: p.id, pathId: best.pathId, room: best.room };
  }).filter(s => s.room > 0).sort((a, b) => b.room - a.room);

  const slots: { playerId: string; pathId: string }[] = [];
  for (const cand of ranked) {
    if (slots.length >= 3) break;
    const next = [...slots, { playerId: cand.playerId, pathId: cand.pathId }];
    if (slotTrainingPointCost(state, next) <= state.trainingPoints) slots.push({ playerId: cand.playerId, pathId: cand.pathId });
  }
  return slots;
}

describe('active-manager economy rail', () => {
  test.each(SEEDS)('a winning, actively-training manager stays bounded (seed %i)', seed => {
    let state = createCareer({ ...createLaunchCareerSetup(seed, undefined, undefined, 'full'), careerMode: 'full' });
    let guard = 0;
    while (!(state.phase === 'season-end' && state.season === SEASONS)) {
      if (guard++ > SEASONS * 64 + 1) throw new Error('overran');
      if (state.phase === 'manage') {
        // The training plan is a repeating weekly template (it keeps re-applying
        // until changed), so it must be refreshed every week -- including to
        // empty -- or a prior week's plan (set when the bank was bigger) can
        // outrun a shrunk bank and trip advanceWeek's interrupt guard.
        const slots = affordableSlots(state);
        state = setCareerTrainingPlan(state, slots);
        state = advanceWeek(state);
      } else if (state.phase === 'matchday') {
        const md = activeCareerMatchday(state)!;
        state = completeMatchday(state, md.fixtures.map(f => winnerScore(f, state.userClubId)));
      } else if (state.phase === 'season-end') {
        for (const p of state.players.filter(p => p.clubId === state.userClubId && p.contractSeasonsRemaining === 0)) {
          state = renewCareerPlayer(state, p.id, 4, 1);
        }
        state = startNextSeason(state);
      }
    }
    const balances = state.ledgers.map(l => l.balanceAfter);
    // No runaway build-up: even a flawless winner who trains for free every week
    // must not accumulate cash beyond a sane ceiling. Observed max across seeds
    // [0, 77, 20_260_719] is ~125,600 -- ceiling is that rounded up to the next
    // 25k (150k) plus one 25k of margin.
    expect(Math.max(...balances)).toBeLessThanOrEqual(/* CEILING */ 175_000);
    expect(balances.every(b => Number.isSafeInteger(b))).toBe(true);
    expect(state.trainingPoints).toBeGreaterThanOrEqual(0);
  });
});
