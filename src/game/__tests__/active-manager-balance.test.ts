import { createLaunchCareerSetup } from '../../application/launch';
import {
  activeCareerMatchday, advanceWeek, completeMatchday, createCareer, startNextSeason,
} from '../career';
import { renewCareerPlayer } from '../squad';
import { trainPlayerInstantly } from '../training';
import { resolveTrainingDrillForPath, TRAINING_PATHS } from '../training-paths';
import { playerAttributeCaps } from '../archetype-caps';
import type { GameState, LeagueFixture } from '../types';

const SEEDS = [0, 77, 20_260_719];
const SEASONS = 6;

// INSTRUMENT LIMITATION (2026-07-26): this harness FEEDS a 3-0 win for every
// user fixture instead of playing real matches, so it measures the economy
// UNDERNEATH guaranteed weekly success — never win rates, never the climb.
// Its 3-drills/week cadence is also gentler than the TP starvation the real
// ramp probe measured. Use DIVISION_RAMP_PROBE=1 for anything outcome-shaped.
function winnerScore(f: LeagueFixture, user: string) {
  if (f.homeClubId === user) return { fixtureId: f.id, homeGoals: 3, awayGoals: 0 };
  if (f.awayClubId === user) return { fixtureId: f.id, homeGoals: 0, awayGoals: 3 };
  return { fixtureId: f.id, homeGoals: 1, awayGoals: 1 };
}

// Taps a drill for up to 3 non-injured, non-exhausted players with the most
// headroom, each on their most-open path, while the TP bank affords it — the
// weekly cadence an active manager would sustain under instant training.
function tapWeeklyDrills(state: GameState): GameState {
  const roster = state.players.filter(p => (
    p.clubId === state.userClubId && (p.injuryWeeks ?? 0) === 0 && (p.condition ?? 100) >= 30
  ));
  const ranked = roster.map(p => {
    const caps = playerAttributeCaps(p);
    const best = TRAINING_PATHS
      .map(path => ({ pathId: path.pathId, room: caps[path.attribute] - p.attrs[path.attribute] }))
      .sort((a, b) => b.room - a.room)[0];
    return { playerId: p.id, pathId: best.pathId, room: best.room };
  }).filter(s => s.room > 0).sort((a, b) => b.room - a.room);

  let next = state;
  for (const cand of ranked.slice(0, 3)) {
    const cost = resolveTrainingDrillForPath(next, cand.pathId).tpCost;
    if (cost > next.trainingPoints) continue;
    next = trainPlayerInstantly(next, cand.playerId, cand.pathId).state;
  }
  return next;
}

describe('active-manager economy rail', () => {
  test.each(SEEDS)('a winning, actively-training manager stays bounded (seed %i)', seed => {
    let state = createCareer({ ...createLaunchCareerSetup(seed) });
    let guard = 0;
    while (!(state.phase === 'season-end' && state.season === SEASONS)) {
      if (guard++ > SEASONS * 64 + 1) throw new Error('overran');
      if (state.phase === 'manage') {
        state = tapWeeklyDrills(state);
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
    // must not accumulate cash without bound. Re-centred once the user club's
    // gate/sponsor income began scaling with division (previously it was frozen
    // at D5 values for the whole climb, which is why the old 175k ceiling held).
    // Observed max across seeds [0, 77, 20_260_719] is ~734,400 -- ceiling is
    // that rounded up to the next 100k plus one 100k of margin.
    expect(Math.max(...balances)).toBeLessThanOrEqual(/* CEILING */ 900_000);
    expect(balances.every(b => Number.isSafeInteger(b))).toBe(true);
    expect(state.trainingPoints).toBeGreaterThanOrEqual(0);
  });
});
