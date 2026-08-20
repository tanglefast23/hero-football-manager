import { createMatch, ENGINE_VERSION, queueInput, tick } from '../match';
import {
  armWindowTicks,
  GK_ARM_WINDOW_TICKS,
  heatRefund,
  inUsefulContext,
  isShotSavePower,
  powerTick,
  zoneHeatThreshold,
} from '../powers';
import { ROVERS, UNITED } from '../teams';
import type { PowerId, TeamDef } from '../types';

/**
 * Engine m2.8 — a full Heat bar arms the hero, full stop.
 *
 * The defect this replaces: Zone entry consulted `zoneEntryContext`, the
 * power's own authored setup, on top of the Heat threshold. A manager could
 * therefore watch a hero's bar sit at 100% for minutes with no fire button and
 * no explanation, because a gate they could not see, could not influence and
 * were never told about had not opened. The bar was the promise; the promise
 * was not kept.
 */

/** ROVERS with a chosen power in a chosen slot. Slot 0 is always the keeper. */
function teamWith(power: PowerId, slot: number): TeamDef {
  return {
    ...ROVERS,
    players: ROVERS.players.map((player, index) => ({
      ...player,
      attrs: { ...player.attrs },
      power: index === slot ? power : undefined,
    })),
  };
}

function manualMatch(power: PowerId, slot: number) {
  return createMatch(4242, teamWith(power, slot), UNITED, {
    homePolicy: 'SAVE_FOR_TAP',
    awayPolicy: 'FIRE_WHEN_READY',
    controlledTeam: 0,
  });
}

describe('m2.8 — a full bar arms the hero', () => {
  it('bumped the engine version, because every hero in the league changed', () => {
    expect(ENGINE_VERSION).toBe('m2.8');
  });

  it('arms with nothing at all happening on the pitch', () => {
    const match = manualMatch('GRAVITY_WELL', 9);
    // Gravity Well's setup is the strictest in the game: a teammate carrying in
    // another lane, blockers to pull, a runner to free. None of it is true here.
    match.players[9].gauge = zoneHeatThreshold('MID');

    powerTick(match, []);

    expect(match.players[9].powerState.kind).toBe('zone');
    // Armed is not fired. The authored moment still gates the power itself,
    // which is the half of the old design that was always right.
    expect(inUsefulContext(match, 9)).toBe(false);
  });

  it('arms in the SAME tick the bar fills, not the tick after', () => {
    const match = manualMatch('SUPER_SPEED', 9);
    // One trickle short. The increment inside this very tick is what crosses
    // the line, and a hero whose bar is visibly full with no button — even for
    // a tenth of a second — is the whole defect in miniature.
    match.players[9].gauge = zoneHeatThreshold('FWD') - 0.001;

    powerTick(match, []);

    expect(match.players[9].powerState.kind).toBe('zone');
  });

  it('arms a hero who is flattened, because a bar does not stop filling', () => {
    const match = manualMatch('SUPER_SPEED', 9);
    match.players[9].gauge = zoneHeatThreshold('FWD');
    match.players[9].outUntilTick = match.tick + 30;

    powerTick(match, []);

    // Ready, but the dock still refuses the press until they are up — that
    // refusal lives in the button, not in the engine.
    expect(match.players[9].powerState.kind).toBe('zone');
  });

  it('never arms a hero who has been sent off', () => {
    const match = manualMatch('SUPER_SPEED', 9);
    match.players[9].gauge = zoneHeatThreshold('FWD');
    match.players[9].outUntilTick = match.tick + 9999;
    match.players[9].outReason = 'redcard';

    powerTick(match, []);

    // A red card is also `outUntilTick > tick`, so moving conversion above the
    // availability guard would have put a fire button under a man in the tunnel.
    expect(match.players[9].powerState.kind).toBe('idle');
  });

  it('still earns no Heat while unavailable and below the line', () => {
    const match = manualMatch('SUPER_SPEED', 9);
    match.players[9].gauge = 10;
    match.players[9].outUntilTick = match.tick + 30;

    powerTick(match, []);

    // Only the CONVERSION moved above the availability guard. The trickle did
    // not: being face down still earns nothing.
    expect(match.players[9].gauge).toBe(10);
  });
});

describe('m2.8 — the Heat bar is read against the role', () => {
  it('gives a keeper a far lower threshold than an outfield hero', () => {
    expect(zoneHeatThreshold('GK')).toBe(5);
    expect(zoneHeatThreshold('DEF')).toBe(60);
    expect(zoneHeatThreshold('MID')).toBe(60);
    expect(zoneHeatThreshold('FWD')).toBe(60);
  });

  it('refunds a lost charge below the loser own line, not a flat 50', () => {
    // A flat 50 was ten times a keeper's threshold of 5, so a keeper who lost a
    // charge re-armed on the very next tick and could burn all three Zones in
    // about thirty seconds of nothing happening.
    expect(heatRefund('MID')).toBe(50);
    expect(heatRefund('GK')).toBeLessThan(zoneHeatThreshold('GK'));
  });
});

describe('m2.8 — keepers are hand-fireable, by power not by role', () => {
  it('hands the goalkeeper their team policy like anyone else', () => {
    const match = manualMatch('ELASTIC_KEEPER', 0);
    expect(match.players[0].firePolicy).toBe('SAVE_FOR_TAP');
  });

  it('gives a save keeper ten seconds and an outfield hero two', () => {
    expect(armWindowTicks('ELASTIC_KEEPER')).toBe(GK_ARM_WINDOW_TICKS);
    expect(armWindowTicks('GIANT_GK')).toBe(GK_ARM_WINDOW_TICKS);
    expect(armWindowTicks('SUPER_SPEED')).toBe(20);
    // GUST sits in ROLE_POOL.GK but is not a save power. Keying these rules on
    // the ROLE would leave a GUST keeper's button dead through exactly the
    // build-up their power exists for.
    expect(isShotSavePower('GUST')).toBe(false);
    expect(armWindowTicks('GUST')).toBe(20);
  });

  it('opens a window on a keeper press rather than firing into nothing', () => {
    const match = manualMatch('ELASTIC_KEEPER', 0);
    match.players[0].gauge = zoneHeatThreshold('GK');
    powerTick(match, []);
    expect(match.players[0].powerState.kind).toBe('zone');

    queueInput(match, { tick: match.tick + 1, kind: 'POWER_TAP', player: 0 });
    tick(match);

    // A shot in flight is far too brief to press on, so the press is a
    // commitment, not a reflex.
    expect(match.players[0].powerState.kind).toBe('armed');
    if (match.players[0].powerState.kind === 'armed') {
      expect(match.players[0].powerState.windowTicks).toBe(GK_ARM_WINDOW_TICKS);
      // Full strength, not the armed grade: 0.9-with-risk-of-nothing against a
      // guaranteed 0.85 is a trade no manager would ever take, and the whole
      // control would be dead on arrival.
      expect(match.players[0].powerState.strength).toBe(1);
      expect(match.players[0].powerState.sawShotOnTarget).toBe(false);
    }
  });

  it('lets a lapsed keeper window say NO SHOT ON NET only when it is true', () => {
    const match = manualMatch('ELASTIC_KEEPER', 0);
    match.players[0].gauge = zoneHeatThreshold('GK');
    powerTick(match, []);
    queueInput(match, { tick: match.tick + 1, kind: 'POWER_TAP', player: 0 });

    // Nothing comes. Run the window out.
    for (let step = 0; step < GK_ARM_WINDOW_TICKS + 5; step += 1) tick(match);

    const expired = match.events.filter((e) => e.kind === 'POWER_EXPIRED');
    expect(expired).toHaveLength(1);
    expect(expired[0]).toMatchObject({
      player: 0,
      power: 'ELASTIC_KEEPER',
      reason: 'no-shot',
    });
    // The Zone is spent, and the refund leaves them under their own line rather
    // than instantly re-armed.
    expect(match.players[0].zonesOpened).toBe(1);
    expect(match.players[0].gauge).toBeLessThan(zoneHeatThreshold('GK'));
  });
});

/**
 * The same-tick rescue. These are the tests the first implementation did NOT
 * have, and their absence let a completely dead keeper rescue pass a green
 * suite: the lapse was covered, the thing the lapse exists to protect was not.
 *
 * `powerTick` runs before shots are created (`possessionTick`) and flown
 * (`shotFlightTick`), so a keeper offered their context only in `powerTick` is
 * bypassed by any shot that is born and arrives inside one tick.
 */
describe('m2.8 — a shot wakes the keeper it is aimed at', () => {
  /** Puts an on-target shot one tick from the keeper's plane. */
  function shotAtKeeper(match: ReturnType<typeof manualMatch>) {
    const keeper = match.players[0];
    match.ball = {
      kind: 'shot',
      pos: { x: 3400, y: keeper.pos.y - 40 },
      vel: { x: 0, y: 300 },
      by: 20,
      shooterId: match.players[20].def.id,
      shotStrengthD64: 0,
      power: 40,
      targetX: 3400,
      z: 0,
      vz: 0,
      trajectory: 'driven',
      keeperChecked: false,
    };
  }

  it('fires a pressed keeper on a shot that arrives in the same tick', () => {
    const match = manualMatch('ELASTIC_KEEPER', 0);
    match.players[0].gauge = zoneHeatThreshold('GK');
    powerTick(match, []);
    queueInput(match, { tick: match.tick + 1, kind: 'POWER_TAP', player: 0 });
    tick(match);
    expect(match.players[0].powerState.kind).toBe('armed');

    shotAtKeeper(match);
    tick(match);

    // The power must actually have RUN. Before the fix it never did: the shot
    // site set `keeperChecked` before releasing the power, and the keeper
    // powers re-check `enemyOnTargetShot`, which requires that flag to be
    // false. The rescue was dead code and every test still passed.
    expect(
      match.events.some((e) => e.kind === 'POWER_FIRED' && e.player === 0),
    ).toBe(true);
  });

  it('fires on the window LAST tick, when the shot appears after powerTick', () => {
    const match = manualMatch('ELASTIC_KEEPER', 0);
    match.players[0].gauge = zoneHeatThreshold('GK');
    powerTick(match, []);
    queueInput(match, { tick: match.tick + 1, kind: 'POWER_TAP', player: 0 });
    tick(match);

    // Burn the window down to its final tick.
    while (
      match.players[0].powerState.kind === 'armed' &&
      match.players[0].powerState.remainingTicks > 1
    ) {
      tick(match);
    }
    expect(match.players[0].powerState.kind).toBe('armed');

    shotAtKeeper(match);
    tick(match);

    // Expiry runs AFTER shot flight for exactly this tick. Expiring after
    // movement — where the first fix put it — still closed the window before
    // the shot existed, because shots are created later in the tick.
    expect(
      match.events.some((e) => e.kind === 'POWER_FIRED' && e.player === 0),
    ).toBe(true);
    expect(
      match.events.some((e) => e.kind === 'POWER_EXPIRED' && e.player === 0),
    ).toBe(false);
  });

  it('rescues an AUTO keeper on the same tick too', () => {
    const match = createMatch(4242, teamWith('GIANT_GK', 0), UNITED, {
      homePolicy: 'FIRE_WHEN_READY',
      awayPolicy: 'FIRE_WHEN_READY',
      controlledTeam: 0,
    });
    match.players[0].gauge = zoneHeatThreshold('GK');
    powerTick(match, []);
    expect(match.players[0].powerState.kind).toBe('zone');

    shotAtKeeper(match);
    tick(match);

    // Both policies go through one call site, or they drift apart again.
    expect(
      match.events.some((e) => e.kind === 'POWER_FIRED' && e.player === 0),
    ).toBe(true);
  });

  it('never claims NO SHOT ON NET when a shot passed while the keeper was down', () => {
    const match = manualMatch('ELASTIC_KEEPER', 0);
    match.players[0].gauge = zoneHeatThreshold('GK');
    powerTick(match, []);
    queueInput(match, { tick: match.tick + 1, kind: 'POWER_TAP', player: 0 });
    tick(match);

    // Flattened for the whole window, so they cannot act on the shot at all.
    match.players[0].outUntilTick = match.tick + GK_ARM_WINDOW_TICKS + 50;
    shotAtKeeper(match);
    tick(match);

    while (
      match.players[0].powerState.kind === 'armed' &&
      match.players[0].powerState.remainingTicks > 0
    ) {
      tick(match);
    }
    tick(match);

    const expired = match.events.filter((e) => e.kind === 'POWER_EXPIRED');
    expect(expired).toHaveLength(1);
    // A shot DID come. The Zone was still wasted, but the message must say so
    // honestly rather than blaming an attack that never happened.
    expect(expired[0]).toMatchObject({ player: 0, reason: 'other' });
  });
});
