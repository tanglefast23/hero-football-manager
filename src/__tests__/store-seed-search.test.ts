/**
 * Searches career seeds for a first fixture in which the flame power actually
 * fires, so the capture run is aimed rather than blind.
 *
 * Quick Result runs the same engine and resolves identically to an unattended
 * watch, so a POWER_FIRED here is the same event the watched match will show
 * at the same tick — provided no live input is given during the capture.
 */
import fs from 'node:fs';
import { createLaunchCareerSetup } from '../application/launch';
import {
  advanceWeek,
  createCareer,
  activeCareerMatchday,
} from '../game/career';
import { quickMatchForFixture } from '../game/matchday';
import { buildCareerTeams } from '../game/squad';
import type { GameState } from '../game/types';
import type { PowerId } from '../sim/types';

const TARGET: PowerId = 'FIRE_TORCH';

/** Gives every user forward the flame power, and licenses them. */
function armForwards(state: GameState, power: PowerId, max: number): GameState {
  let granted = 0;
  const players = state.players.map((p) => {
    if (p.clubId !== state.userClubId || p.role !== 'FWD' || granted >= max) {
      return p;
    }
    granted += 1;
    return { ...p, power, licensed: true };
  });
  return { ...state, players };
}

function armKeeper(state: GameState, power: PowerId): GameState {
  let granted = false;
  const players = state.players.map((p) => {
    if (granted || p.clubId !== state.userClubId || p.role !== 'GK') return p;
    granted = true;
    return { ...p, power, licensed: true };
  });
  return { ...state, players };
}

function toMatchday(state: GameState): GameState {
  let s = state;
  let guard = 0;
  while (s.phase !== 'matchday') {
    if ((guard += 1) > 40) throw new Error('no matchday');
    s = advanceWeek(s);
  }
  return s;
}

test('search career seeds for a firing flame power', () => {
  const hits: Record<string, unknown>[] = [];

  for (let seed = 20260801; seed <= 20260900; seed += 1) {
    let state = createCareer(createLaunchCareerSetup(seed));
    // Mirror the shipped capture seed: a flame forward plus the giant keeper.
    // Two licensed heroes is inside the launch Hero License cap, and the
    // keeper's power keeps the scoreline from collapsing before the flame
    // fires.
    state = armForwards(state, TARGET, 1);
    state = armKeeper(state, 'GIANT_GK');
    state = toMatchday(state);

    const matchday = activeCareerMatchday(state);
    if (matchday === undefined) continue;

    const { match } = quickMatchForFixture(
      matchday.fixture,
      buildCareerTeams(state),
      {
        userClubId: state.userClubId,
        initialFormation: '4-4-2',
        autoSubs: true,
      },
    );

    const fired = match.events.filter(
      (e) => e.kind === 'POWER_FIRED' && e.power === TARGET,
    ) as { t: number; player: number; power: PowerId }[];
    const impacts = match.events.filter(
      (e) => e.kind === 'POWER_IMPACT' && e.power === TARGET,
    ) as { t: number; player: number }[];

    if (fired.length === 0) continue;

    // The capture shows the score AT the firing tick, not at fulltime — the
    // opener is deliberately rigged, so a grim final score says nothing about
    // what the frame will look like.
    const goals = match.events.filter((e) => e.kind === 'GOAL') as {
      t: number;
      team: 0 | 1;
    }[];
    const userIsHome = matchday.fixture.homeClubId === state.userClubId;
    const scoreAt = (t: number) => {
      const home = goals.filter((g) => g.t <= t && g.team === 0).length;
      const away = goals.filter((g) => g.t <= t && g.team === 1).length;
      return userIsHome ? { us: home, them: away } : { us: away, them: home };
    };

    for (const f of fired) {
      const at = scoreAt(f.t);
      hits.push({
        seed,
        matchSeed: matchday.fixture.matchSeed,
        userIsHome,
        firedTick: f.t,
        minute: Math.round((f.t / match.tick) * 90),
        scoreAtFire: `${at.us}-${at.them}`,
        deficitAtFire: at.them - at.us,
        finalScore: match.score,
        impactTicks: impacts.map((i) => i.t),
        totalTicks: match.tick,
      });
    }
  }

  fs.writeFileSync('/tmp/hfm-flame-search.json', JSON.stringify(hits, null, 2));

  expect(hits.length).toBeGreaterThan(0);
});
