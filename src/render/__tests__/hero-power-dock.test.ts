import { readFileSync } from 'fs';
import { join } from 'path';
import { createMatch, queueInput } from '../../sim/match';
import { ROVERS, UNITED } from '../../sim/teams';
import type { TeamDef } from '../../sim/types';
import {
  HERO_POWER_BUTTON_MIN,
  heroPowerDockCells,
  heroPowerDockIsEmpty,
  heroPowerDockLayout,
  heroPowerPressable,
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
  it('leaves the goalkeeper out, because m2.7 keeps them firing automatically', () => {
    const match = manual();

    expect(match.players[0].def.power).toBe('ELASTIC_KEEPER');
    expect(match.players[0].firePolicy).toBe('FIRE_WHEN_READY');
    expect(heroPowerDockCells(match, 0).map((cell) => cell.slot)).toEqual([
      9, 10,
    ]);
  });

  it('gives every eligible outfield hero a cell, empty until a Zone opens', () => {
    const cells = heroPowerDockCells(manual(), 0);

    expect(cells).toHaveLength(2);
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
    match.players[9].powerState = { kind: 'armed', remainingTicks: 14 };

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

    expect(heroPowerDockCells(match, 0).map((cell) => cell.slot)).toEqual([10]);
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
      20, 21,
    ]);
  });
});

describe('the pressable cue', () => {
  const dock = readFileSync(
    join(process.cwd(), 'src/render/HeroPowerDock.tsx'),
    'utf8',
  );

  it('runs only on a button that actually accepts a press', () => {
    // A streak on an armed or downed button would invite a press that does
    // nothing — the opposite of what the cue is for.
    expect(dock).toContain(
      '{pressable && !reduceMotion ? (\n          <PressableStreak',
    );
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
    expect(dock.match(/pointerEvents="none"/g) ?? []).toHaveLength(4);
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
