/**
 * SCRATCH PROBE (not a gate): isolates how much a squad-strength gap actually
 * moves match outcomes, so opening-match targets can be set against the sim's
 * real variance rather than intuition.
 */
import { createLaunchCareerSetup } from '../../application/launch';
import { loadLaunchContent } from '../../content';
import {
  addCreatedPlayer,
  beginStoryOnboarding,
  buildCareerMatchTeams,
  createCareer,
  withoutPowers,
} from '../../game';
import { runMatch } from '../../sim/match';
import type { PowerId, TeamDef } from '../../sim/types';

const content = loadLaunchContent();
const SEEDS = 400;
const DELTAS = [-10, -6, -4, -2, 0, 2, 4, 6, 8, 12, 16, 20, 25];

describe('strength-gap probe', () => {
  it('maps opponent strength delta to win/draw/loss', () => {
    const { user, opponent } = openingTeams();

    const lines = ['', '=== OPPONENT STRENGTH DELTA -> USER RESULT (user always home) ==='];
    lines.push('delta   W      D      L      avg score');
    for (const delta of DELTAS) {
      lines.push(formatRow(`${delta >= 0 ? '+' : ''}${delta}`, sweep(user, scale(opponent, delta))));
    }

    lines.push('', '=== SAME, BUT USER HAS ONE TIER-1 HERO ===');
    const withHero = grantPower(user, 'SUPER_SPEED');
    lines.push('delta   W      D      L      avg score');
    for (const delta of DELTAS) {
      lines.push(formatRow(`${delta >= 0 ? '+' : ''}${delta}`, sweep(withHero, scale(opponent, delta))));
    }

    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));
    expect(DELTAS.length).toBeGreaterThan(0);
  }, 900_000);
});

interface Outcome { wins: number; draws: number; losses: number; goalsFor: number; goalsAgainst: number }

function sweep(home: TeamDef, away: TeamDef): Outcome {
  const outcome: Outcome = { wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 };
  for (let index = 0; index < SEEDS; index += 1) {
    const result = runMatch(1_000_003 + index * 104_729, home, away, [], {
      homePolicy: 'FIRE_WHEN_READY',
      awayPolicy: 'FIRE_WHEN_READY',
    });
    const [forGoals, againstGoals] = result.score;
    outcome.goalsFor += forGoals;
    outcome.goalsAgainst += againstGoals;
    if (forGoals > againstGoals) outcome.wins += 1;
    else if (forGoals === againstGoals) outcome.draws += 1;
    else outcome.losses += 1;
  }
  return outcome;
}

function openingTeams(): { user: TeamDef; opponent: TeamDef } {
  const state = addCreatedPlayer(
    beginStoryOnboarding(createCareer(createLaunchCareerSetup(
      4_000_000, undefined, content, 'full', 'COZY',
    ))),
    { name: 'Probe Rookie', ratings: { pac: 55, sho: 60, pas: 50, def: 50, tec: 50, sta: 50 } },
  );
  const opponentId = content.clubs.clubs
    .map(club => club.id)
    .find(id => id !== state.userClubId)!;
  const teams = buildCareerMatchTeams(state, [state.userClubId, opponentId]);
  return {
    user: withoutPowers(teams[state.userClubId]),
    opponent: withoutPowers(teams[opponentId]),
  };
}

/** Shifts every outfield attribute by `delta`, clamped to the engine's 1-99 band. */
function scale(team: TeamDef, delta: number): TeamDef {
  return {
    ...team,
    players: team.players.map(player => ({
      ...player,
      attrs: Object.fromEntries(
        Object.entries(player.attrs).map(([key, value]) => [
          key,
          Math.max(1, Math.min(99, value + delta)),
        ]),
      ) as unknown as typeof player.attrs,
    })),
  };
}

function grantPower(team: TeamDef, power: PowerId): TeamDef {
  let granted = false;
  return {
    ...team,
    players: team.players.map(player => {
      if (granted || player.role !== 'FWD') return player;
      granted = true;
      return { ...player, power };
    }),
  };
}

function formatRow(label: string, outcome: Outcome): string {
  const pct = (value: number) => `${(Math.round((value / SEEDS) * 1000) / 10).toFixed(1)}%`.padEnd(7);
  const mean = (value: number) => (Math.round((value / SEEDS) * 100) / 100).toFixed(2);
  return `${label.padEnd(8)}${pct(outcome.wins)}${pct(outcome.draws)}${pct(outcome.losses)}`
    + `${mean(outcome.goalsFor)}-${mean(outcome.goalsAgainst)}`;
}
