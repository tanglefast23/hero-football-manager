import { createMatch, tick } from '../match';
import { LAUNCH_POWER_IDS } from '../../game/power-catalog';
import { ROVERS, UNITED } from '../teams';
import type { PowerId, TeamDef } from '../types';

/**
 * Activation cadence per power, measured the way the game ships it: one hero on
 * a role-appropriate carrier, auto-fire, a full match, many seeds.
 *
 * The pre-existing zone test proves the *mechanism* by force-setting
 * `gauge = 199` on one synthetic striker. That is why the M4 gate could find
 * seven of twelve powers firing in 0-17% of matches while every test was green:
 * nothing measured whether a real carrier ever charges up. This does.
 *
 * Powers are deliberately NOT held to one uniform rate — some are meant to be
 * rarer and bigger than others. The bar here is only that no shipped power is
 * effectively dead, and that the reliable attacking powers stay reliable.
 */
const MATCHES = 20;

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

/** Powers that carry the match and must never quietly stop firing. */
const RELIABLE: readonly PowerId[] = [
  'SUPER_SPEED', 'BLINK_RUN', 'THUNDER_STRIKE', 'FIRE_TORCH', 'PHASE_RUN',
];

function soloHeroTeam(base: TeamDef, power: PowerId): TeamDef {
  const slot = CARRIER_SLOT[power];
  return {
    ...base,
    players: base.players.map((player, index) => (
      index === slot ? { ...player, power } : { ...player, power: undefined }
    )),
  };
}

function measure(power: PowerId): { firesPerMatch: number; matchShare: number } {
  const home = soloHeroTeam(ROVERS, power);
  let fires = 0;
  let matchesWithAFire = 0;
  for (let seed = 0; seed < MATCHES; seed += 1) {
    const match = createMatch(1000 + seed, home, UNITED, {
      homePolicy: 'FIRE_WHEN_READY',
      awayPolicy: 'FIRE_WHEN_READY',
    });
    let guard = 0;
    while (match.phase !== 'fulltime' && guard < 40000) {
      tick(match);
      guard += 1;
    }
    const fired = match.events.filter(event => (
      event.kind === 'POWER_FIRED' && (event as { power?: string }).power === power
    )).length;
    fires += fired;
    if (fired > 0) matchesWithAFire += 1;
  }
  return { firesPerMatch: fires / MATCHES, matchShare: matchesWithAFire / MATCHES };
}

describe('power activation cadence', () => {
  it('covers every shipped launch power', () => {
    expect(Object.keys(CARRIER_SLOT).sort()).toEqual([...LAUNCH_POWER_IDS].sort());
  });

  it.each(LAUNCH_POWER_IDS)('%s is not a dead power on auto-fire', power => {
    const { firesPerMatch, matchShare } = measure(power);

    // Floor only. A power firing far more than another is a design choice.
    expect(firesPerMatch).toBeGreaterThanOrEqual(0.35);
    expect(matchShare).toBeGreaterThanOrEqual(0.4);
  }, 30000);

  it.each(RELIABLE)('%s stays a reliable every-match power', power => {
    const { firesPerMatch, matchShare } = measure(power);

    expect(firesPerMatch).toBeGreaterThanOrEqual(1.0);
    expect(matchShare).toBe(1);
  }, 30000);
});
