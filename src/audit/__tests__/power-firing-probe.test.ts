/**
 * SCRATCH PROBE (not a gate): the Magnet Touch diagnostic, run across the whole
 * catalog. For every power it reports Zones entered, powers actually fired, and
 * windows that expired unused — the measurement that decides whether powers are
 * weak because they rarely fire, or because firing does little.
 *
 * The tapped mode is context-gated: a skilled player taps when the power is in
 * a useful situation, not the instant the Zone opens. Blind immediate tapping
 * fires at TAP_STRENGTH but in a useless context, which measures worse than
 * auto-fire and is not what a real player does.
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
import { shouldQueueWellTappedPower } from '../hero-value-tap-policy';

const content = loadLaunchContent();
const POWERS = content.powers.powers.map(power => power.id) as PowerId[];
const SEEDS = positiveIntegerEnv('POWER_FIRING_SEEDS', 200);

/**
 * Each power's designed carrier slot, matching src/sim/__tests__/power-cadence.
 * Lineup order is 0 GK, 1-4 DEF, 5-8 MID, 9-10 FWD. Measuring a striker power on
 * a defender reports a dead power that is merely mis-assigned.
 */
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
  GUST: 2,
};
/** The baseline opponent is 2 points stronger, so -2 is a genuinely even match. */
const EVEN_DELTA = -2;
const LADDER = [-6, -5, -4, -3, -2, -1, 0, 1, 2];

interface Sample {
  ppm: number;
  zones: number;
  fires: number;
  expired: number;
}

describe('power firing diagnostic', () => {
  it('assigns every power to its intended compatible carrier', () => {
    const { user } = openingTeams();
    expect(Object.keys(CARRIER_SLOT).sort()).toEqual([...POWERS].sort());
    for (const power of POWERS) {
      expect(grantPower(user, power).players[CARRIER_SLOT[power]].power).toBe(power);
    }
  });

  it('reports zones, fires and value for every power', () => {
    const { user, opponent } = openingTeams();
    const evenOpponent = scale(opponent, EVEN_DELTA);

    const ladder = LADDER.map(delta => ({
      delta,
      ppm: run(user, scale(opponent, delta), false).ppm,
    }));
    const baseline = run(user, evenOpponent, false);

    const lines: string[] = [
      '',
      `=== NO-HERO BASELINE at even strength: ppm ${baseline.ppm.toFixed(3)} ===`,
      '',
      '=== AUTO-FIRE (Quick Result) ===',
      'power              zones/match  fires/match  expired  fire%   ppm     worth',
    ];
    const autoRows = POWERS.map(power => {
      const sample = run(grantPower(user, power), evenOpponent, false);
      lines.push(formatRow(power, sample, ladder));
      return { power, sample };
    });

    lines.push('', '=== CONTEXT-GATED TAP (skilled watched play) ===');
    lines.push('power              zones/match  fires/match  expired  fire%   ppm     worth');
    const tapRows = POWERS.map(power => {
      const sample = run(grantPower(user, power), evenOpponent, true);
      lines.push(formatRow(power, sample, ladder));
      return { power, sample };
    });

    lines.push('', '=== SKILL DELTA (tapped minus auto) ===');
    for (let index = 0; index < POWERS.length; index += 1) {
      const auto = autoRows[index].sample;
      const tapped = tapRows[index].sample;
      lines.push(
        `${POWERS[index].padEnd(19)}`
        + `fires ${auto.fires.toFixed(2)} -> ${tapped.fires.toFixed(2)}   `
        + `ppm ${auto.ppm.toFixed(3)} -> ${tapped.ppm.toFixed(3)}   `
        + `(${(tapped.ppm - auto.ppm >= 0 ? '+' : '')}${(tapped.ppm - auto.ppm).toFixed(3)})`,
      );
    }

    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));
    expect(POWERS.length).toBeGreaterThan(0);
  }, 1_800_000);
});

function run(home: TeamDef, away: TeamDef, contextTaps: boolean): Sample {
  let points = 0;
  let zones = 0;
  let fires = 0;
  let expired = 0;

  for (let index = 0; index < SEEDS; index += 1) {
    // controlledTeam is deliberately NOT set: it would disable automatic
    // substitutions and energy management for that side (auto-coaching.ts
    // automaticTeams), which depresses its results independently of tapping.
    const match = createMatch(1_000_003 + index * 104_729, home, away, {
      homePolicy: contextTaps ? 'SAVE_FOR_TAP' : 'FIRE_WHEN_READY',
      awayPolicy: 'FIRE_WHEN_READY',
    });
    // One queued tap per Zone window, so a long window cannot spam the input log.
    const tappedThisWindow = new Array<boolean>(11).fill(false);

    while (match.phase !== 'fulltime') {
      if (contextTaps) {
        for (let slot = 0; slot < 11; slot += 1) {
          const player = match.players[slot];
          if (player?.def.power === undefined) continue;
          if (player.powerState.kind !== 'zone') {
            tappedThisWindow[slot] = false;
            continue;
          }
          if (!tappedThisWindow[slot] && shouldQueueWellTappedPower(match, slot)) {
            queueInput(match, { tick: match.tick + 1, kind: 'POWER_TAP', player: slot });
            tappedThisWindow[slot] = true;
          }
        }
      }
      tick(match);
    }

    for (const event of match.events) {
      const slot = 'player' in event ? event.player : -1;
      if (slot < 0 || slot > 10) continue;
      if (event.kind === 'POWER_READY') zones += 1;
      else if (event.kind === 'POWER_FIRED') fires += 1;
      else if (event.kind === 'POWER_EXPIRED') expired += 1;
    }

    const [forGoals, againstGoals] = match.score;
    points += forGoals > againstGoals ? 3 : forGoals === againstGoals ? 1 : 0;
  }

  return {
    ppm: points / SEEDS,
    zones: zones / SEEDS,
    fires: fires / SEEDS,
    expired: expired / SEEDS,
  };
}

function formatRow(
  power: string,
  sample: Sample,
  ladder: readonly { delta: number; ppm: number }[],
): string {
  const firePercent = sample.zones === 0 ? 0 : (sample.fires / sample.zones) * 100;
  return `${power.padEnd(19)}${sample.zones.toFixed(2).padEnd(13)}`
    + `${sample.fires.toFixed(2).padEnd(13)}${sample.expired.toFixed(2).padEnd(9)}`
    + `${`${firePercent.toFixed(0)}%`.padEnd(8)}${sample.ppm.toFixed(3).padEnd(8)}`
    + worthLabel(ladder, sample.ppm);
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
      const worth = EVEN_DELTA - delta;
      return `${worth >= 0 ? '+' : ''}${worth.toFixed(1)}`;
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

function positiveIntegerEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  if (!/^[1-9]\d*$/.test(raw)) throw new Error(`${name} must be a positive integer`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) throw new Error(`${name} must be a safe positive integer`);
  return value;
}
