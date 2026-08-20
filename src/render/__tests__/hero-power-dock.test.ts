import { readFileSync } from 'fs';
import { join } from 'path';
import { createMatch, queueInput } from '../../sim/match';
import { ARM_WINDOW_TICKS, GK_ARM_WINDOW_TICKS } from '../../sim/powers';
import { ROVERS, UNITED } from '../../sim/teams';
import type { TeamDef } from '../../sim/types';
import {
  HERO_POWER_BUTTON_MIN,
  heroPowerDockCells,
  heroPowerDockIsEmpty,
  heroPowerDockLayout,
  heroPowerPressable,
  heroPowerRingMasks,
  heroPowerTapBlocked,
} from '../hero-power-dock';

/** ROVERS with a hero goalkeeper, which the shipped fixture does not have. */
function roversWithHeroKeeper(): TeamDef {
  const players = ROVERS.players.map((player) => ({ ...player }));
  players[0] = { ...players[0], power: 'ELASTIC_KEEPER', powerTier: 1 };
  return { ...ROVERS, players };
}

const manual = () =>
  createMatch(42, roversWithHeroKeeper(), UNITED, {
    homePolicy: 'SAVE_FOR_TAP',
    awayPolicy: 'FIRE_WHEN_READY',
    controlledTeam: 0,
  });

describe('hero power dock cells', () => {
  it('includes the goalkeeper, whose m2.7 exemption is retired', () => {
    const match = manual();

    expect(match.players[0].def.power).toBe('ELASTIC_KEEPER');
    expect(match.players[0].firePolicy).toBe('SAVE_FOR_TAP');
    expect(heroPowerDockCells(match, 0).map((cell) => cell.slot)).toEqual([
      0, 9, 10,
    ]);
  });

  it('gives every eligible hero a cell, empty until a Zone opens', () => {
    const cells = heroPowerDockCells(manual(), 0);

    expect(cells).toHaveLength(3);
    // A cell exists before the hero is ready. Filtering to live buttons would
    // reflow the row the moment one fired, moving the rest under the thumb.
    expect(cells.every((cell) => cell.state === null)).toBe(true);
    expect(heroPowerDockIsEmpty(cells)).toBe(true);
  });

  it('reads FIRE or ARM off the authored context once a Zone is banked', () => {
    const match = manual();
    match.players[9].powerState = { kind: 'zone', remainingTicks: 70 };

    const cell = heroPowerDockCells(match, 0).find((c) => c.slot === 9);
    expect(cell?.state === 'fire' || cell?.state === 'arm').toBe(true);
    expect(heroPowerPressable(cell?.state ?? null)).toBe(true);
  });

  it('refuses the press on a hero who is down, whose tap would waste the Zone', () => {
    const match = manual();
    match.players[9].powerState = { kind: 'zone', remainingTicks: 70 };
    match.players[9].outUntilTick = match.tick + 30;

    const cell = heroPowerDockCells(match, 0).find((c) => c.slot === 9);
    expect(cell?.state).toBe('down');
    expect(heroPowerPressable('down')).toBe(false);
  });

  it('shows the armed window as status, never as another press', () => {
    const match = manual();
    match.players[9].powerState = {
      kind: 'armed',
      remainingTicks: 14,
      windowTicks: ARM_WINDOW_TICKS,
      strength: 0.9,
      sawShotOnTarget: false,
    };

    const cell = heroPowerDockCells(match, 0).find((c) => c.slot === 9);
    expect(cell?.state).toBe('armed');
    expect(cell?.armedTicksRemaining).toBe(14);
    // A second press here would queue an input the sim skips but the replay
    // still records, and MAX_REPLAY_INPUTS would then refuse real coaching.
    expect(heroPowerPressable('armed')).toBe(false);
  });

  it('drops a sent-off hero rather than leaving a dead button', () => {
    const match = manual();
    match.players[9].outReason = 'redcard';

    expect(heroPowerDockCells(match, 0).map((cell) => cell.slot)).toEqual([
      0, 10,
    ]);
  });

  it('blocks a press while the engine still owes that slot an answer', () => {
    const match = manual();
    match.players[9].powerState = { kind: 'zone', remainingTicks: 70 };

    expect(heroPowerTapBlocked(match, 9)).toBe(false);
    queueInput(match, { tick: match.tick + 1, kind: 'POWER_TAP', player: 9 });
    expect(heroPowerTapBlocked(match, 9)).toBe(true);
    expect(heroPowerTapBlocked(match, 10)).toBe(false);
  });

  it('reads the away side when the manager is the away team', () => {
    const match = createMatch(42, UNITED, roversWithHeroKeeper(), {
      homePolicy: 'FIRE_WHEN_READY',
      awayPolicy: 'SAVE_FOR_TAP',
      controlledTeam: 1,
    });

    expect(heroPowerDockCells(match, 1).map((cell) => cell.slot)).toEqual([
      11, 20, 21,
    ]);
  });
});

describe('the pressable cue', () => {
  const dock = readFileSync(
    join(process.cwd(), 'src/render/HeroPowerDock.tsx'),
    'utf8',
  );

  it('runs on FIRE alone — the one press that cannot cost a Zone', () => {
    // Not on ARM: that press is a gamble that can burn a Zone, and a flashing
    // button reads as "press me now". Not on armed or downed either, where a
    // press does nothing at all.
    expect(dock).toContain(
      "{cell.state === 'fire' && !reduceMotion ? (\n          <>\n            <FireFlash",
    );
  });

  it('beats rather than strobes, and never washes out the power colour', () => {
    expect(dock).toContain('const FLASH_HALF_MS = 700;');
    expect(dock).toContain('const FLASH_PEAK_OPACITY = 0.42;');
  });

  it('laps every three seconds rather than strobing', () => {
    expect(dock).toContain('const STREAK_CYCLE_MS = 3000;');
    expect(dock).toContain('const STREAK_RUN_MS = 720;');
    expect(dock).toContain('Animated.delay(STREAK_CYCLE_MS - STREAK_RUN_MS)');
  });

  it('travels counter-clockwise, one bar per edge', () => {
    // Screen coordinates, y downward: top right-to-left, left top-to-bottom,
    // bottom left-to-right, right bottom-to-top.
    expect(dock).toContain('const top = leg(0, travel, 0);');
    expect(dock).toContain('const left = leg(1, 0, travel);');
    expect(dock).toContain('const bottom = leg(2, 0, travel);');
    expect(dock).toContain('const right = leg(3, travel, 0);');
  });

  it('stops dead under reduce motion, and never eats presses', () => {
    expect(dock).toContain('reduceMotion: boolean;');
    // Four streak legs plus the flash wash. Every cue is inert to touch, so
    // none of them can swallow the press they are advertising.
    expect(dock.match(/pointerEvents="none"/g) ?? []).toHaveLength(5);
  });
});

describe('hero power dock layout', () => {
  // A Global League club is not capped at four heroes: heroLicensePurchaseCost
  // prices permits 5, 6, 7 and up, so eleven has to stay usable.
  const phone = 390;
  const desktop = 900;

  it('gives a lone hero the full-size button', () => {
    expect(heroPowerDockLayout(1, phone, false).size).toBe(56);
    expect(heroPowerDockLayout(1, desktop, true).size).toBe(68);
  });

  it('never drops a cell, and never goes under the touch floor', () => {
    for (const count of [1, 4, 5, 11]) {
      for (const [width, isDesktop] of [
        [phone, false],
        [desktop, true],
      ] as const) {
        const layout = heroPowerDockLayout(count, width, isDesktop);
        expect(layout.size).toBeGreaterThanOrEqual(HERO_POWER_BUTTON_MIN);
        expect(layout.perRow * layout.rows).toBeGreaterThanOrEqual(count);
      }
    }
  });

  it('wraps upward rather than shrinking a button below 44pt', () => {
    const layout = heroPowerDockLayout(11, phone, false);

    expect(layout.size).toBe(HERO_POWER_BUTTON_MIN);
    expect(layout.rows).toBeGreaterThan(1);
  });

  it('stays inside its 45% share, so it cannot meet the possession card', () => {
    for (const count of [1, 4, 5, 11]) {
      const layout = heroPowerDockLayout(count, phone, false);
      const width =
        layout.size * layout.perRow + layout.gap * (layout.perRow - 1);
      expect(width).toBeLessThanOrEqual(phone * 0.45);
    }
  });

  it('draws nothing when the manager has no eligible heroes', () => {
    expect(heroPowerDockLayout(0, phone, false).rows).toBe(0);
  });
});

describe('hero power rings', () => {
  const bit = (slot: number) => 1 << slot;

  it('draws nothing in AUTO, where no hero has a button to point at', () => {
    const match = createMatch(42, roversWithHeroKeeper(), UNITED, {
      homePolicy: 'FIRE_WHEN_READY',
      awayPolicy: 'FIRE_WHEN_READY',
      controlledTeam: 0,
    });
    match.players[9].powerState = { kind: 'zone', remainingTicks: 70 };

    expect(heroPowerRingMasks(match, 0)).toEqual({ dashed: 0, solid: 0 });
  });

  it('dashes a hero whose button is live, in both FIRE and ARM', () => {
    const match = manual();
    match.players[9].powerState = { kind: 'zone', remainingTicks: 70 };

    const cell = heroPowerDockCells(match, 0).find((c) => c.slot === 9);
    expect(heroPowerPressable(cell?.state ?? null)).toBe(true);
    expect(heroPowerRingMasks(match, 0)).toEqual({
      dashed: bit(9),
      solid: 0,
    });
  });

  it('goes solid once the press lands, and for the power playing out', () => {
    const match = manual();
    match.players[9].powerState = {
      kind: 'armed',
      remainingTicks: 20,
      windowTicks: ARM_WINDOW_TICKS,
      strength: 0.9,
      sawShotOnTarget: false,
    };
    expect(heroPowerRingMasks(match, 0)).toEqual({ dashed: 0, solid: bit(9) });

    match.players[9].powerState = {
      kind: 'winding',
      untilTick: 99,
      strength: 1,
    };
    expect(heroPowerRingMasks(match, 0)).toEqual({ dashed: 0, solid: bit(9) });

    match.players[9].powerState = {
      kind: 'active',
      untilTick: 99,
      strength: 1,
    };
    expect(heroPowerRingMasks(match, 0)).toEqual({ dashed: 0, solid: bit(9) });
  });

  it('drops the ring when the power ends, and never rings a hero who is down', () => {
    const match = manual();
    match.players[9].powerState = { kind: 'idle' };
    expect(heroPowerRingMasks(match, 0)).toEqual({ dashed: 0, solid: 0 });

    match.players[9].powerState = { kind: 'zone', remainingTicks: 70 };
    match.players[9].outUntilTick = match.tick + 30;
    expect(heroPowerRingMasks(match, 0)).toEqual({ dashed: 0, solid: 0 });
  });

  it('never rings the goalkeeper, who fires automatically whatever is set', () => {
    const match = manual();
    match.players[0].powerState = { kind: 'zone', remainingTicks: 70 };

    expect(heroPowerRingMasks(match, 0)).toEqual({ dashed: 0, solid: 0 });
  });
});

describe('the goalkeeper button', () => {
  /** ROVERS with a save keeper and the ball parked in one half or the other. */
  function keeperMatch(power: 'ELASTIC_KEEPER' | 'GIANT_GK' | 'GUST') {
    const players = ROVERS.players.map((player) => ({ ...player }));
    players[0] = { ...players[0], power, powerTier: 1 };
    const match = createMatch(42, { ...ROVERS, players }, UNITED, {
      homePolicy: 'SAVE_FOR_TAP',
      awayPolicy: 'FIRE_WHEN_READY',
      controlledTeam: 0,
    });
    match.players[0].powerState = { kind: 'zone', remainingTicks: 70 };
    return match;
  }

  const cellFor = (match: ReturnType<typeof keeperMatch>) =>
    heroPowerDockCells(match, 0).find((cell) => cell.slot === 0);

  it('sleeps as HOLD while the ball is up the other end', () => {
    const match = keeperMatch('ELASTIC_KEEPER');
    // Team 0 defends the high-y goal, so a low y is the opponent's half.
    match.ball = {
      kind: 'loose',
      pos: { x: 3400, y: 1000 },
      vel: { x: 0, y: 0 },
      z: 0,
      vz: 0,
    };

    const cell = cellFor(match);
    expect(cell?.state).toBe('hold');
    // HOLD is its own state precisely so it is NOT `down`, whose screen-reader
    // line announces "{player} is down". A keeper waiting out a goal kick is
    // perfectly healthy.
    expect(heroPowerPressable(cell?.state ?? null)).toBe(false);
  });

  it('wakes once the ball is in their own half', () => {
    const match = keeperMatch('ELASTIC_KEEPER');
    match.ball = {
      kind: 'loose',
      pos: { x: 3400, y: 9000 },
      vel: { x: 0, y: 0 },
      z: 0,
      vz: 0,
    };

    const cell = cellFor(match);
    expect(cell?.state).toBe('arm');
    expect(heroPowerPressable(cell?.state ?? null)).toBe(true);
  });

  it('never reads FIRE, because a shot is too brief to react to', () => {
    const match = keeperMatch('GIANT_GK');
    match.ball = {
      kind: 'loose',
      pos: { x: 3400, y: 9000 },
      vel: { x: 0, y: 0 },
      z: 0,
      vz: 0,
    };

    expect(cellFor(match)?.state).not.toBe('fire');
  });

  it('carries the ten-second window, not the outfield two', () => {
    const match = keeperMatch('ELASTIC_KEEPER');
    match.ball = {
      kind: 'loose',
      pos: { x: 3400, y: 9000 },
      vel: { x: 0, y: 0 },
      z: 0,
      vz: 0,
    };

    // The drain bar and the on-pitch ring both divide by this. A hardcoded 20
    // pinned a keeper's bar full for eight seconds and then dumped it.
    expect(cellFor(match)?.armWindowTicks).toBe(GK_ARM_WINDOW_TICKS);
    expect(
      heroPowerDockCells(match, 0).find((cell) => cell.slot === 9)
        ?.armWindowTicks,
    ).toBe(ARM_WINDOW_TICKS);
  });

  it('gives a GUST keeper the ordinary outfield contract', () => {
    // GUST is in ROLE_POOL.GK but bends the opponent's next pass, so its moment
    // is enemy possession anywhere. Keying the keeper rules on the ROLE would
    // leave this button dead through exactly the build-up it exists for.
    const match = keeperMatch('GUST');
    match.ball = {
      kind: 'loose',
      pos: { x: 3400, y: 1000 },
      vel: { x: 0, y: 0 },
      z: 0,
      vz: 0,
    };

    const cell = cellFor(match);
    expect(cell?.state).not.toBe('hold');
    expect(cell?.armWindowTicks).toBe(ARM_WINDOW_TICKS);
  });
});
