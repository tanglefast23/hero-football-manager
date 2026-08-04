import { LAUNCH_POWER_IDS } from '../../game/power-catalog';
import { createMatch, tick } from '../../sim/match';
import {
  CONTEXT_AUTO_STRENGTH,
  inUsefulContext,
  ZONE_WINDOW_TICKS,
} from '../../sim/powers';
import type { MatchState, PowerId } from '../../sim/types';
import { powerCutInOutroDue } from '../power-cut-in';
import {
  advancePowerMatchShowcaseReady,
  initializePowerMatchShowcase,
  POWER_MATCH_SHOWCASE_AUTO_FIRE_DELAY_TICKS,
  POWER_MATCH_SHOWCASE_CARD_DELAY_MS,
  powerMatchShowcaseCardDueAt,
  powerMatchShowcaseAway,
  powerMatchShowcaseHeroIndex,
  powerMatchShowcaseHome,
  powerMatchShowcaseSeed,
  powerMatchShowcaseSucceeded,
  powerMatchShowcaseSuccessRestartsPlay,
} from '../power-match-showcase';

/** Twelve seconds of clip — longer than any of them, well short of the modal's backstop. */
const CLIP_TICK_BUDGET = 120;
/** The promise has to land in the same move the power fired in. */
const MAX_FOLLOW_THROUGH_TICKS = 35;

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

  /**
   * The clip a manager is shown when they awaken a hero has to be that power
   * working. The showcase is a real deterministic match, so on the one seed
   * every power used to share, Thunder Strike's demonstration of "enough force
   * to batter keeper Resolve" ended in a miss, Blink Run's and Phase Run's
   * shots were saved, and Portal Pass's went wide.
   *
   * The fix is a seed per power, chosen because its clip ends in that power's
   * own promise landing. This is the test that keeps them honest: it is the
   * only thing standing between a tuning change and a hero's first impression
   * being a demonstration of failure. If it fails, re-run the search rather
   * than relaxing the condition.
   */
  it.each(LAUNCH_POWER_IDS)('%s lands its promise inside the clip on its pinned seed', power => {
    const match = createMatch(
      powerMatchShowcaseSeed(power),
      powerMatchShowcaseHome(power),
      powerMatchShowcaseAway(),
    );
    const hero = initializePowerMatchShowcase(match, power);

    expect(powerMatchShowcaseSucceeded(match, power)).toBe(false);

    let firedAt: number | undefined;
    let successAt: number | undefined;
    for (let frame = 0; frame < CLIP_TICK_BUDGET && successAt === undefined; frame += 1) {
      if (!advancePowerMatchShowcaseReady(match, power)) tick(match);
      if (firedAt === undefined && match.events.some(
        event => event.kind === 'POWER_FIRED' && event.player === hero,
      )) firedAt = match.tick;
      if (powerMatchShowcaseSucceeded(match, power)) successAt = match.tick;
    }

    expect(firedAt).toBeDefined();
    expect(successAt).toBeDefined();
    // Nothing may be read as success before the power that is supposed to have
    // caused it has fired.
    expect(successAt!).toBeGreaterThanOrEqual(firedAt!);
    // And the manager should not be made to wait for it: the promise lands
    // inside the same move, not two attacks later.
    expect(successAt! - firedAt!).toBeLessThanOrEqual(MAX_FOLLOW_THROUGH_TICKS);
  });

  /**
   * What the manager is handed once the pitch stops.
   *
   * The clip freezes the sim, so every question the screen still has to answer
   * has to be answerable from the frozen frame — nothing is going to tick
   * again. The screen's cut-in bookkeeping runs on the tick, and Portal Pass
   * and Gravity Well both freeze with the hero's power still `active`: read
   * live, their cut-in has not ended and never will, and a result card that
   * waits for that ending waits for the life of the modal. That is a frozen
   * pitch with no REPLAY and no CONTINUE, which is the one thing the demo must
   * never do.
   */
  describe('the result card after the clip freezes', () => {
    const FROZEN_AT = 10_000;

    /** The hero's power state on the frame the clip freezes on. */
    function heroPowerStateAtFreeze(power: PowerId): string {
      const match = createMatch(
        powerMatchShowcaseSeed(power),
        powerMatchShowcaseHome(power),
        powerMatchShowcaseAway(),
      );
      const hero = initializePowerMatchShowcase(match, power);
      for (let frame = 0; frame < CLIP_TICK_BUDGET; frame += 1) {
        if (!advancePowerMatchShowcaseReady(match, power)) tick(match);
        if (powerMatchShowcaseSucceeded(match, power)) {
          return match.players[hero].powerState.kind;
        }
      }
      throw new Error(`${power} never froze inside the clip budget`);
    }

    /** The screen's chain, end to end, on a clip frozen at FROZEN_AT. */
    function cardDueAt(power: PowerId): number | 'never' {
      const stillActive = heroPowerStateAtFreeze(power) === 'active';
      const outroStartedAt = powerCutInOutroDue(stillActive, true) ? FROZEN_AT : undefined;
      if (outroStartedAt === undefined) return 'never';
      return powerMatchShowcaseCardDueAt(FROZEN_AT, outroStartedAt);
    }

    it.each(LAUNCH_POWER_IDS)('%s hands over a card a beat after it freezes', power => {
      expect(cardDueAt(power)).toBe(FROZEN_AT + POWER_MATCH_SHOWCASE_CARD_DELAY_MS);
    });

    it('still freezes clips with the power mid-effect, so that branch is real', () => {
      // The assertion above is only worth anything while some shipped seed
      // actually reaches the freeze with its power still running. If tuning
      // ever takes that to none, this fails rather than letting the guard
      // quietly become decoration.
      const midEffect = LAUNCH_POWER_IDS.filter(
        power => heroPowerStateAtFreeze(power) === 'active',
      );
      expect(midEffect.length).toBeGreaterThan(0);
    });

    it('is due off the freeze alone when no cut-in ending was ever recorded', () => {
      expect(powerMatchShowcaseCardDueAt(FROZEN_AT, undefined))
        .toBe(FROZEN_AT + POWER_MATCH_SHOWCASE_CARD_DELAY_MS);
    });

    it('waits out a cut-in that is still ending after the freeze', () => {
      expect(powerMatchShowcaseCardDueAt(FROZEN_AT, FROZEN_AT + 400))
        .toBe(FROZEN_AT + 400 + POWER_MATCH_SHOWCASE_CARD_DELAY_MS);
    });
  });

  it('holds the frame before the success only where the success restarts play', () => {
    // A goal restarts the kickoff inside the tick it is scored, so those clips
    // have to freeze one frame earlier. Nothing else does.
    expect(powerMatchShowcaseSuccessRestartsPlay('THUNDER_STRIKE')).toBe(true);
    expect(powerMatchShowcaseSuccessRestartsPlay('ELASTIC_KEEPER')).toBe(false);
    expect(powerMatchShowcaseSuccessRestartsPlay('WEB_TRAP')).toBe(false);
  });
});
