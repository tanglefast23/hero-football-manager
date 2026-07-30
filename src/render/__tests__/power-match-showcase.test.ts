import { LAUNCH_POWER_IDS } from '../../game/power-catalog';
import { createMatch, tick } from '../../sim/match';
import {
  CONTEXT_AUTO_STRENGTH,
  inUsefulContext,
  ZONE_WINDOW_TICKS,
} from '../../sim/powers';
import type { MatchState, PowerId } from '../../sim/types';
import {
  advancePowerMatchShowcaseReady,
  initializePowerMatchShowcase,
  POWER_MATCH_SHOWCASE_AUTO_FIRE_DELAY_TICKS,
  powerMatchShowcaseAway,
  powerMatchShowcaseHeroIndex,
  powerMatchShowcaseHome,
} from '../power-match-showcase';

function advanceThroughAutoFire(match: MatchState, power: PowerId, hero: number): void {
  for (let guard = 0; guard < 40; guard += 1) {
    const state = match.players[hero].powerState;
    if (state.kind !== 'zone' && state.kind !== 'winding') return;
    expect(advancePowerMatchShowcaseReady(match, power)).toBe(true);
  }
  throw new Error(`${power} did not auto-fire in its authored showcase context`);
}

describe('live power match showcase', () => {
  it.each(LAUNCH_POWER_IDS)('%s auto-fires through the real best-context policy', power => {
    const match = createMatch(42, powerMatchShowcaseHome(power), powerMatchShowcaseAway());
    const hero = initializePowerMatchShowcase(match, power);

    expect(match.players[hero]).toMatchObject({
      def: { power },
      firePolicy: 'SAVE_FOR_TAP',
      powerState: { kind: 'zone' },
    });
    expect(inUsefulContext(match, hero)).toBe(true);

    const arrangedPositions = match.players.map(player => ({ ...player.pos }));
    for (let heldTick = 0; heldTick < POWER_MATCH_SHOWCASE_AUTO_FIRE_DELAY_TICKS; heldTick += 1) {
      expect(advancePowerMatchShowcaseReady(match, power)).toBe(true);
    }
    expect(match.players.some((player, index) => (
      player.pos.x !== arrangedPositions[index].x
      || player.pos.y !== arrangedPositions[index].y
    ))).toBe(true);
    expect(match.tick).toBe(POWER_MATCH_SHOWCASE_AUTO_FIRE_DELAY_TICKS);
    expect(inUsefulContext(match, hero)).toBe(true);
    expect(match.events).not.toContainEqual(expect.objectContaining({ kind: 'POWER_FIRED' }));

    advanceThroughAutoFire(match, power, hero);
    expect(match.events).toContainEqual(expect.objectContaining({
      kind: 'POWER_FIRED', player: hero, power, strength: CONTEXT_AUTO_STRENGTH,
    }));
    expect(match.inputLog).toEqual([]);
  });

  it('keeps an available power banked through the live lead-in', () => {
    const power = 'SUPER_STRENGTH' as const;
    const match = createMatch(42, powerMatchShowcaseHome(power), powerMatchShowcaseAway());
    const hero = initializePowerMatchShowcase(match, power);

    for (let heldTick = 0; heldTick < POWER_MATCH_SHOWCASE_AUTO_FIRE_DELAY_TICKS; heldTick += 1) {
      expect(advancePowerMatchShowcaseReady(match, power)).toBe(true);
    }
    expect(match.players[hero].powerState).toEqual({
      kind: 'zone',
      remainingTicks: ZONE_WINDOW_TICKS,
    });
    expect(match.events).not.toContainEqual(expect.objectContaining({
      kind: 'POWER_EXPIRED',
      player: hero,
    }));
    expect(inUsefulContext(match, hero)).toBe(true);
    advanceThroughAutoFire(match, power, hero);
    expect(match.events).toContainEqual(expect.objectContaining({
      kind: 'POWER_FIRED',
      player: hero,
      power,
      strength: CONTEXT_AUTO_STRENGTH,
    }));
  });

  it('keeps the rival team unpowered so only the selected effect is under review', () => {
    expect(powerMatchShowcaseAway().players.every(player => player.power === undefined)).toBe(true);
  });

  it('puts the newly awakened player into the live match clip', () => {
    const power = 'SUPER_STRENGTH' as const;
    const team = powerMatchShowcaseHome(power, 'Zip Vela');
    expect(team.players[powerMatchShowcaseHeroIndex(power)].name).toBe('Zip Vela');
  });

  it('shows Web Trap on a clearly separated victim who stays fixed frame by frame', () => {
    const power = 'WEB_TRAP' as const;
    const match = createMatch(42, powerMatchShowcaseHome(power), powerMatchShowcaseAway());
    const hero = initializePowerMatchShowcase(match, power);
    const victim = 11;
    expect(Math.abs(match.players[hero].pos.x - match.players[victim].pos.x)).toBeGreaterThanOrEqual(1_000);

    advanceThroughAutoFire(match, power, hero);

    for (let attempt = 0; attempt < 5 && match.players[victim].webbedUntilTick === undefined; attempt += 1) {
      tick(match);
    }
    expect(match.players[victim].webbedUntilTick).toBeGreaterThan(match.tick);
    const rooted = { ...match.players[victim].pos };
    for (let frame = 0; frame < 8; frame += 1) {
      tick(match);
      expect(match.players[victim].pos).toEqual(rooted);
    }
  });

  it('gives Elastic Keeper one off-centre real shot and completes the save', () => {
    const power = 'ELASTIC_KEEPER' as const;
    const match = createMatch(42, powerMatchShowcaseHome(power), powerMatchShowcaseAway());
    const hero = initializePowerMatchShowcase(match, power);
    expect(match.ball).toMatchObject({ kind: 'shot', targetX: 3_920 });

    advanceThroughAutoFire(match, power, hero);
    for (let frame = 0; frame < 30 && !match.events.some(event => event.kind === 'SAVE'); frame += 1) {
      tick(match);
    }

    expect(match.events).toContainEqual(expect.objectContaining({ kind: 'SAVE', by: hero }));
    expect(match.ball).toMatchObject({ kind: 'held', by: hero, caught: true });
  });
});
