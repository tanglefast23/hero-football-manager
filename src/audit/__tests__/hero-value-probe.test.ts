/**
 * SCRATCH PROBE (not a gate): measures what one hero power is worth, expressed
 * in points of squad strength, for both auto-fire (Quick Result) and a
 * perfectly-tapped watched match.
 *
 * Method: points-per-match is measured for a no-hero baseline across a fine
 * strength ladder, then each power is run at even strength. The power's value
 * is the strength delta that would produce the same points-per-match.
 */
import { createLaunchCareerSetup } from '../../application/launch';
import { loadLaunchContent } from '../../content';
import {
  addCreatedPlayer,
  beginStoryOnboarding,
  buildCareerMatchTeams,
  createCareer,
  powerIsCompatibleWithRole,
  withoutPowers,
} from '../../game';
import { createMatch, queueInput, tick } from '../../sim/match';
import type { PowerId, TeamDef } from '../../sim/types';

const content = loadLaunchContent();
const POWERS = content.powers.powers.map(power => power.id) as PowerId[];
const SEEDS = 250;
/** Engine slot for each power's designed carrier: 0 GK, 2 DEF, 6 MID, 9 FWD. */
const CARRIER_SLOT: Record<PowerId, number> = {
  SUPER_SPEED: 9,
  BLINK_RUN: 9,
  THUNDER_STRIKE: 9,
  FIRE_TORCH: 9,
  PHASE_RUN: 9,
  PORTAL_PASS: 6,
  DECOY_DOUBLE: 6,
  FUTURE_SIGHT: 2,
  SUPER_STRENGTH: 2,
  WEB_TRAP: 2,
  ELASTIC_KEEPER: 0,
  RALLY_CRY: 6,
  ICE_RINK: 2,
  SHADOW_MARK: 2,
  GRAVITY_WELL: 6,
  GIANT_GK: 0,
};
/** The baseline opponent is 2 points stronger, so -2 is a genuinely even match. */
const EVEN_DELTA = -2;
const LADDER = [-6, -5, -4, -3, -2, -1, 0, 1, 2];

describe('hero value', () => {
  it('assigns every power to its intended compatible carrier', () => {
    const { user } = openingTeams();
    expect(Object.keys(CARRIER_SLOT).sort()).toEqual([...POWERS].sort());
    for (const power of POWERS) {
      expect(grantPower(user, power).players[CARRIER_SLOT[power]].power).toBe(power);
    }
  });

  it('prices every power in points of squad strength', () => {
    const { user, opponent } = openingTeams();

    const ladder = LADDER.map(delta => ({
      delta,
      ppm: pointsPerMatch(user, scale(opponent, delta), false),
    }));
    const basePpm = ladder.find(row => row.delta === EVEN_DELTA)!.ppm;

    const lines: string[] = ['', '=== NO-HERO BASELINE LADDER ==='];
    for (const row of ladder) {
      lines.push(`  delta ${String(row.delta).padStart(3)}  ppm ${row.ppm.toFixed(3)}`);
    }
    lines.push(`  (even match = delta ${EVEN_DELTA}, ppm ${basePpm.toFixed(3)})`);

    lines.push('', '=== POWER VALUE AT EVEN STRENGTH ===');
    lines.push('power              auto ppm  auto worth   tapped ppm  tapped worth');
    const evenOpponent = scale(opponent, EVEN_DELTA);
    for (const power of POWERS) {
      const team = grantPower(user, power);
      const auto = pointsPerMatch(team, evenOpponent, false);
      const tapped = pointsPerMatch(team, evenOpponent, true);
      lines.push(
        `${power.padEnd(19)}${auto.toFixed(3).padEnd(10)}`
        + `${worthLabel(ladder, auto).padEnd(13)}`
        + `${tapped.toFixed(3).padEnd(12)}${worthLabel(ladder, tapped)}`,
      );
    }

    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));
    expect(POWERS.length).toBeGreaterThan(0);
  }, 1_800_000);
});

/** Points per match: 3 for a win, 1 for a draw, from the user's perspective. */
function pointsPerMatch(home: TeamDef, away: TeamDef, perfectTaps: boolean): number {
  let points = 0;
  for (let index = 0; index < SEEDS; index += 1) {
    const match = createMatch(1_000_003 + index * 104_729, home, away, {
      homePolicy: perfectTaps ? 'SAVE_FOR_TAP' : 'FIRE_WHEN_READY',
      awayPolicy: 'FIRE_WHEN_READY',
      // controlledTeam is deliberately NOT set. POWER_TAP inputs do not need
      // it, and setting it disables automatic coaching for the tapped side.
    });
    while (match.phase !== 'fulltime') {
      if (perfectTaps) {
        // Fire the instant a home hero enters the zone: the ceiling a player
        // reaches by watching and tapping every window.
        for (let slot = 0; slot < 11; slot += 1) {
          const player = match.players[slot];
          if (player?.powerState.kind === 'zone' && player.def.power !== undefined) {
            queueInput(match, { tick: match.tick + 1, kind: 'POWER_TAP', player: slot });
          }
        }
      }
      tick(match);
    }
    const [forGoals, againstGoals] = match.score;
    points += forGoals > againstGoals ? 3 : forGoals === againstGoals ? 1 : 0;
  }
  return points / SEEDS;
}

/** Reads the strength delta that would produce this points-per-match. */
function worthLabel(ladder: readonly { delta: number; ppm: number }[], ppm: number): string {
  const sorted = [...ladder].sort((left, right) => right.delta - left.delta);
  for (let index = 0; index < sorted.length - 1; index += 1) {
    const high = sorted[index];
    const low = sorted[index + 1];
    if (ppm >= high.ppm && ppm <= low.ppm) {
      const span = low.ppm - high.ppm;
      const ratio = span === 0 ? 0 : (ppm - high.ppm) / span;
      const delta = high.delta + (low.delta - high.delta) * ratio;
      return `${(EVEN_DELTA - delta >= 0 ? '+' : '')}${(EVEN_DELTA - delta).toFixed(1)}`;
    }
  }
  return ppm > sorted[sorted.length - 1].ppm ? '>+4' : '<-4';
}

function openingTeams(): { user: TeamDef; opponent: TeamDef } {
  const state = addCreatedPlayer(
    beginStoryOnboarding(createCareer(createLaunchCareerSetup(
      4_000_000, undefined, content, 'full', 'COZY',
    ))),
    { name: 'Probe Rookie', ratings: { pac: 55, sho: 60, pas: 50, def: 50, tec: 50, sta: 50 } },
  );
  const opponentId = content.clubs.clubs.map(club => club.id).find(id => id !== state.userClubId)!;
  const teams = buildCareerMatchTeams(state, [state.userClubId, opponentId]);
  return {
    user: withoutPowers(teams[state.userClubId]),
    opponent: withoutPowers(teams[opponentId]),
  };
}

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

/** Gives the power to its designed carrier slot, and to nobody else. */
function grantPower(team: TeamDef, power: PowerId): TeamDef {
  const slot = CARRIER_SLOT[power];
  const carrier = team.players[slot];
  if (carrier === undefined || !powerIsCompatibleWithRole(power, carrier.role)) {
    throw new Error(`slot ${slot} cannot carry ${power} (role ${carrier?.role})`);
  }
  return {
    ...team,
    players: team.players.map((player, index) => (
      index === slot ? { ...player, power } : { ...player, power: undefined }
    )),
  };
}
