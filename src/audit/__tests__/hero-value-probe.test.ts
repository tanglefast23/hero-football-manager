/**
 * SCRATCH PROBE (not a gate): measures what one hero power is worth, expressed
 * in points of squad strength at Tier 1 and Tier 3, for both auto-fire (Quick
 * Result) and a well-tapped watched match.
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
  roleOverall,
  withoutPowers,
} from '../../game';
import { createMatch, queueInput, tick } from '../../sim/match';
import { inUsefulContext, LATE_WINDOW_TICKS } from '../../sim/powers';
import type { PowerId, TeamDef } from '../../sim/types';

const content = loadLaunchContent();
const POWERS = content.powers.powers.map(power => power.id) as PowerId[];
const SEEDS = positiveIntegerEnv('HERO_VALUE_SEEDS', 1000);
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
  GUST: 2,
};
const SHARD = parseShard(process.env.HERO_VALUE_SHARD, POWERS.length);
const SELECTED_POWERS = POWERS.filter((_, index) => index % SHARD.count === SHARD.index);

interface LadderRow {
  readonly delta: number;
  readonly ppm: number;
}

describe('hero value', () => {
  it('fits noisy ladder reversals without mutation', () => {
    const raw: LadderRow[] = [
      { delta: -2, ppm: 1.8 },
      { delta: -1, ppm: 1.2 },
      { delta: 0, ppm: 1.4 },
      { delta: 1, ppm: 0.9 },
    ];
    const before = raw.map(row => ({ ...row }));

    const fitted = fitNonIncreasingPpm(raw);

    expect(fitted).toHaveLength(raw.length);
    expect(fitted[0]).toEqual(raw[0]);
    expect(fitted.at(-1)).toEqual(raw.at(-1));
    const expectedPpm = [1.8, 1.3, 1.3, 0.9];
    for (let index = 0; index < fitted.length; index += 1) {
      expect(fitted[index].ppm).toBeCloseTo(expectedPpm[index], 12);
    }
    for (let index = 1; index < fitted.length; index += 1) {
      expect(fitted[index].ppm).toBeLessThanOrEqual(fitted[index - 1].ppm);
      expect(fitted[index].delta).toBe(raw[index].delta);
    }
    expect(raw).toEqual(before);
    expect(fitted).not.toBe(raw);
  });

  it('assigns every power to its intended compatible carrier', () => {
    const { user } = openingTeams();
    expect(Object.keys(CARRIER_SLOT).sort()).toEqual([...POWERS].sort());
    for (const power of POWERS) {
      expect(grantPower(user, power, 1).players[CARRIER_SLOT[power]]).toMatchObject({
        power,
        powerTier: 1,
      });
    }
  });

  it('prices every power in points of squad strength', () => {
    const { user, opponent } = openingTeams();
    const userStrength = teamStrength(user);
    const opponentStrength = teamStrength(opponent);
    const evenDelta = userStrength - opponentStrength;
    // Worth = evenDelta - measured opponent delta. These 11 points cover a
    // power worth +6 through -4 relative to the calibrated even matchup.
    const ladderDeltas = Array.from({ length: 11 }, (_, index) => evenDelta - 6 + index);

    const rawLadder = ladderDeltas.map(delta => ({
      delta,
      ppm: pointsPerMatch(user, scale(opponent, delta), false),
    }));
    const fittedLadder = fitNonIncreasingPpm(rawLadder);
    const rawBasePpm = rawLadder.find(row => row.delta === evenDelta)!.ppm;
    const fittedBasePpm = fittedLadder.find(row => row.delta === evenDelta)!.ppm;

    const lines: string[] = [
      '',
      `=== HERO VALUE SHARD ${SHARD.index}/${SHARD.count} (${SEEDS} seeds per sample) ===`,
      `selected powers (${SELECTED_POWERS.length}/${POWERS.length}): ${SELECTED_POWERS.join(', ')}`,
      `starting-XI strength: user ${userStrength}, opponent ${opponentStrength}, calibrated even delta ${evenDelta}`,
      '',
      '=== SHARED NO-HERO BASELINE LADDER ===',
      '  delta   raw ppm   fitted ppm',
    ];
    for (let index = 0; index < rawLadder.length; index += 1) {
      const raw = rawLadder[index];
      const fitted = fittedLadder[index];
      lines.push(
        `  ${String(raw.delta).padStart(5)}   ${raw.ppm.toFixed(3).padStart(7)}`
        + `   ${fitted.ppm.toFixed(3).padStart(10)}`,
      );
    }
    lines.push(
      `  (calibrated even match = delta ${evenDelta}, raw ${rawBasePpm.toFixed(3)},`
      + ` fitted ${fittedBasePpm.toFixed(3)})`,
    );

    lines.push('', '=== POWER VALUE AT EVEN STRENGTH ===');
    lines.push(
      'power              T1 auto ppm/worth   T1 well-tapped ppm/worth   T3 well-tapped ppm/worth',
    );
    const evenOpponent = scale(opponent, evenDelta);
    for (const power of SELECTED_POWERS) {
      const tier1 = grantPower(user, power, 1);
      const tier3 = grantPower(user, power, 3);
      const tier1Auto = pointsPerMatch(tier1, evenOpponent, false);
      const tier1Tapped = pointsPerMatch(tier1, evenOpponent, true);
      const tier3Tapped = pointsPerMatch(tier3, evenOpponent, true);
      lines.push(
        `${power.padEnd(19)}`
        + `${sampleLabel(fittedLadder, tier1Auto, evenDelta).padEnd(20)}`
        + `${sampleLabel(fittedLadder, tier1Tapped, evenDelta).padEnd(27)}`
        + sampleLabel(fittedLadder, tier3Tapped, evenDelta),
      );
    }

    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));
    expect(SELECTED_POWERS.length).toBeGreaterThan(0);
  }, 7_200_000);
});

/** Points per match: 3 for a win, 1 for a draw, from the user's perspective. */
function pointsPerMatch(home: TeamDef, away: TeamDef, wellTapped: boolean): number {
  let points = 0;
  for (let index = 0; index < SEEDS; index += 1) {
    const match = createMatch(1_000_003 + index * 104_729, home, away, {
      homePolicy: wellTapped ? 'SAVE_FOR_TAP' : 'FIRE_WHEN_READY',
      awayPolicy: 'FIRE_WHEN_READY',
      // controlledTeam is deliberately NOT set. POWER_TAP inputs do not need
      // it, and setting it disables automatic coaching for the tapped side.
    });
    // One queued tap per Zone window, so a long window cannot spam the input log.
    const tappedThisWindow = new Array<boolean>(11).fill(false);
    while (match.phase !== 'fulltime') {
      if (wellTapped) {
        for (let slot = 0; slot < 11; slot += 1) {
          const player = match.players[slot];
          if (player?.def.power === undefined) continue;
          if (player.powerState.kind !== 'zone') {
            tappedThisWindow[slot] = false;
            continue;
          }
          // Tap at full strength in a useful context. If none arrives, commit
          // the closing Zone to the fixed two-second armed window rather than
          // silently letting it expire.
          const windowClosing = player.powerState.remainingTicks <= LATE_WINDOW_TICKS;
          if (!tappedThisWindow[slot] && (inUsefulContext(match, slot) || windowClosing)) {
            queueInput(match, { tick: match.tick + 1, kind: 'POWER_TAP', player: slot });
            tappedThisWindow[slot] = true;
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

/**
 * Equal-weight pool-adjacent-violators fit. Ladder rows arrive in increasing
 * opponent delta, so expected home PPM is non-increasing. The returned rows are
 * fresh objects and preserve every input delta and position.
 */
function fitNonIncreasingPpm(rows: readonly LadderRow[]): LadderRow[] {
  interface Block {
    readonly start: number;
    readonly end: number;
    readonly weight: number;
    readonly mean: number;
  }

  const blocks: Block[] = [];
  for (let index = 0; index < rows.length; index += 1) {
    blocks.push({ start: index, end: index, weight: 1, mean: rows[index].ppm });
    while (blocks.length >= 2) {
      const right = blocks[blocks.length - 1];
      const left = blocks[blocks.length - 2];
      if (left.mean >= right.mean) break;
      const weight = left.weight + right.weight;
      blocks.splice(blocks.length - 2, 2, {
        start: left.start,
        end: right.end,
        weight,
        mean: (left.mean * left.weight + right.mean * right.weight) / weight,
      });
    }
  }

  const fitted = new Array<LadderRow>(rows.length);
  for (const block of blocks) {
    for (let index = block.start; index <= block.end; index += 1) {
      fitted[index] = { delta: rows[index].delta, ppm: block.mean };
    }
  }
  return fitted;
}

function sampleLabel(
  ladder: readonly LadderRow[],
  ppm: number,
  evenDelta: number,
): string {
  return `${ppm.toFixed(3)} / ${worthLabel(ladder, ppm, evenDelta)}`;
}

/** Reads the strength delta that would produce this points-per-match. */
function worthLabel(
  ladder: readonly LadderRow[],
  ppm: number,
  evenDelta: number,
): string {
  const sorted = [...ladder].sort((left, right) => right.delta - left.delta);
  for (let index = 0; index < sorted.length - 1; index += 1) {
    const high = sorted[index];
    const low = sorted[index + 1];
    if (ppm >= high.ppm && ppm <= low.ppm) {
      const span = low.ppm - high.ppm;
      const ratio = span === 0 ? 0 : (ppm - high.ppm) / span;
      const delta = high.delta + (low.delta - high.delta) * ratio;
      const worth = evenDelta - delta;
      return `${worth >= 0 ? '+' : ''}${worth.toFixed(1)}`;
    }
  }
  const deltas = ladder.map(row => row.delta);
  const maximumWorth = evenDelta - Math.min(...deltas);
  const minimumWorth = evenDelta - Math.max(...deltas);
  return ppm > sorted[sorted.length - 1].ppm ? `>+${maximumWorth}` : `<${minimumWorth}`;
}

/** Average role-weighted overall of the exact 11 players the engine will start. */
function teamStrength(team: TeamDef): number {
  if (team.players.length === 0) throw new Error('hero-value team must contain starters');
  const total = team.players.reduce(
    (sum, player) => sum + roleOverall(player.role, player.attrs),
    0,
  );
  return Math.round(total / team.players.length);
}

function positiveIntegerEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  if (!/^[1-9]\d*$/.test(raw)) {
    throw new Error(`${name} must be a positive integer, got ${JSON.stringify(raw)}`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${name} must be a safe positive integer, got ${JSON.stringify(raw)}`);
  }
  return value;
}

function parseShard(raw: string | undefined, powerCount: number): { index: number; count: number } {
  if (raw === undefined) return { index: 0, count: 1 };
  const match = /^(0|[1-9]\d*)\/([1-9]\d*)$/.exec(raw);
  if (match === null) {
    throw new Error(`HERO_VALUE_SHARD must use index/count, got ${JSON.stringify(raw)}`);
  }
  const index = Number(match[1]);
  const count = Number(match[2]);
  if (!Number.isSafeInteger(index) || !Number.isSafeInteger(count)) {
    throw new Error(`HERO_VALUE_SHARD must use safe integers, got ${JSON.stringify(raw)}`);
  }
  if (index >= count) {
    throw new Error(`HERO_VALUE_SHARD index must be less than count, got ${raw}`);
  }
  if (count > powerCount) {
    throw new Error(`HERO_VALUE_SHARD count must not exceed ${powerCount}, got ${count}`);
  }
  return { index, count };
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
function grantPower(team: TeamDef, power: PowerId, powerTier: 1 | 2 | 3): TeamDef {
  const slot = CARRIER_SLOT[power];
  const carrier = team.players[slot];
  if (carrier === undefined || !powerIsCompatibleWithRole(power, carrier.role)) {
    throw new Error(`slot ${slot} cannot carry ${power} (role ${carrier?.role})`);
  }
  return {
    ...team,
    players: team.players.map((player, index) => (
      index === slot
        ? { ...player, power, powerTier }
        : { ...player, power: undefined, powerTier: undefined }
    )),
  };
}
