import { LAUNCH_POWER_IDS } from '../../game/power-catalog';
import { createMatch, queueInput, tick } from '../../sim/match';
import { inUsefulContext } from '../../sim/powers';
import {
  advancePowerMatchShowcaseReady,
  initializePowerMatchShowcase,
  POWER_MATCH_SHOWCASE_READY_TICKS,
  powerMatchShowcaseAway,
  powerMatchShowcaseHome,
} from '../power-match-showcase';

describe('live power match showcase', () => {
  it.each(LAUNCH_POWER_IDS)('%s uses a real, useful match context with a 13-second tap window', power => {
    const match = createMatch(42, powerMatchShowcaseHome(power), powerMatchShowcaseAway());
    const hero = initializePowerMatchShowcase(match, power);

    expect(match.players[hero]).toMatchObject({
      def: { power },
      firePolicy: 'SAVE_FOR_TAP',
      powerState: { kind: 'zone', remainingTicks: POWER_MATCH_SHOWCASE_READY_TICKS },
    });
    expect(inUsefulContext(match, hero)).toBe(true);

    const arrangedPositions = match.players.map(player => ({ ...player.pos }));
    const arrangedBall = JSON.parse(JSON.stringify(match.ball));
    for (let heldTick = 1; heldTick < POWER_MATCH_SHOWCASE_READY_TICKS; heldTick += 1) {
      expect(advancePowerMatchShowcaseReady(match, power)).toBe(true);
    }
    expect(match.players.map(player => player.pos)).toEqual(arrangedPositions);
    expect(match.ball).toEqual(arrangedBall);
    expect(inUsefulContext(match, hero)).toBe(true);

    queueInput(match, { tick: match.tick + 1, kind: 'POWER_TAP', player: hero });
    expect(advancePowerMatchShowcaseReady(match, power)).toBe(true);
    while (match.players[hero].powerState.kind === 'winding') {
      expect(advancePowerMatchShowcaseReady(match, power)).toBe(true);
    }
    expect(match.events).toContainEqual(expect.objectContaining({
      kind: 'POWER_FIRED', player: hero, power, strength: 1,
    }));
  });

  it('keeps the rival team unpowered so only the selected effect is under review', () => {
    expect(powerMatchShowcaseAway().players.every(player => player.power === undefined)).toBe(true);
  });

  it('shows Web Trap on a clearly separated victim who stays fixed frame by frame', () => {
    const power = 'WEB_TRAP' as const;
    const match = createMatch(42, powerMatchShowcaseHome(power), powerMatchShowcaseAway());
    const hero = initializePowerMatchShowcase(match, power);
    const victim = 11;
    expect(Math.abs(match.players[hero].pos.x - match.players[victim].pos.x)).toBeGreaterThanOrEqual(1_000);

    queueInput(match, { tick: match.tick + 1, kind: 'POWER_TAP', player: hero });
    advancePowerMatchShowcaseReady(match, power);
    while (match.players[hero].powerState.kind === 'winding') {
      advancePowerMatchShowcaseReady(match, power);
    }

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

    queueInput(match, { tick: match.tick + 1, kind: 'POWER_TAP', player: hero });
    advancePowerMatchShowcaseReady(match, power);
    while (match.players[hero].powerState.kind === 'winding') {
      advancePowerMatchShowcaseReady(match, power);
    }
    for (let frame = 0; frame < 30 && !match.events.some(event => event.kind === 'SAVE'); frame += 1) {
      tick(match);
    }

    expect(match.events).toContainEqual(expect.objectContaining({ kind: 'SAVE', by: hero }));
    expect(match.ball).toMatchObject({ kind: 'held', by: hero, caught: true });
  });
});
