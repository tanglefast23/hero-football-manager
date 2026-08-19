import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PASS_COMBO_FLOOR,
  PASS_COMBO_POP_MS,
  passComboCellPx,
  passComboGlyph,
  passComboOpacity,
  passComboRise,
  passComboScale,
} from '../pass-combo';

describe('pass combo pop floor', () => {
  it('shows nothing until the floor, so ordinary passing is not wallpaper', () => {
    // The chain itself now lives in the sim (src/sim/pass-combo.ts) because it
    // feeds a speed bonus and has to be replayable. What stayed here is the
    // drawing, and the floor that decides when there is anything to draw.
    expect(PASS_COMBO_FLOOR).toBe(2);
    expect(passComboCellPx(PASS_COMBO_FLOOR)).toBeGreaterThan(0);
  });
});

describe('pass combo presentation', () => {
  it('grows with the run, then stops growing so it cannot cover the players', () => {
    expect(passComboCellPx(3)).toBeGreaterThan(passComboCellPx(2));
    expect(passComboCellPx(6)).toBeGreaterThan(passComboCellPx(3));
    expect(passComboCellPx(40)).toBe(passComboCellPx(99));
    expect(passComboCellPx(Number.NaN)).toBeGreaterThan(0);
  });

  it('draws an x in front of the count', () => {
    const two = passComboGlyph(2);
    const twelve = passComboGlyph(12);
    expect(two.height).toBe(5);
    expect(two.pixels.length).toBeGreaterThan(0);
    // The cross occupies the leftmost 3 columns; the digits start after it.
    expect(Math.min(...two.pixels.map((cell) => cell.x))).toBe(0);
    expect(twelve.width).toBeGreaterThan(two.width);
    expect(passComboGlyph(0).pixels).toHaveLength(0);
  });

  it('grows past full size, shrinks back, then fades away', () => {
    expect(passComboScale(0)).toBeLessThan(1);
    expect(passComboScale(100)).toBeGreaterThan(1.3);
    expect(passComboScale(220)).toBe(1);
    expect(passComboOpacity(0)).toBe(1);
    expect(passComboOpacity(PASS_COMBO_POP_MS)).toBe(0);
    expect(passComboRise(0)).toBe(0);
    expect(passComboRise(PASS_COMBO_POP_MS)).toBeGreaterThan(0);
  });

  it('never returns a value out of range, for any age it can be handed', () => {
    for (const age of [-10, 0, 99, 380, 619, 620, 9999, Number.NaN]) {
      expect(passComboScale(age)).toBeGreaterThan(0);
      expect(passComboOpacity(age)).toBeGreaterThanOrEqual(0);
      expect(passComboOpacity(age)).toBeLessThanOrEqual(1);
      expect(passComboRise(age)).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('pass combo wiring', () => {
  const source = () =>
    readFileSync(
      join(process.cwd(), 'src', 'render', 'MatchScreen.tsx'),
      'utf8',
    );

  it('reads the chain from sim state, never from the events', () => {
    // The sim publishes state.passCombo[team].count. Counting PASS events here
    // put the number on empty grass at launch time; counting ball-state
    // transitions duplicated logic the sim now owns outright.
    const screen = source();
    expect(screen).toContainSource('s.passCombo[0].count');
    expect(screen).not.toContainSource('passComboAfter');
    expect(screen).not.toContainSource('eventAfter.players[e.to]');
  });

  it('reads the count inside the catch-up loop, in tick order', () => {
    // One frame can catch several ticks up. A read drained afterwards would
    // miss a chain that rose and broke inside the same frame.
    const screen = source();
    const tickLoop = screen.slice(
      screen.indexOf('while (acc >= TICK_MS'),
      screen.indexOf('const newEvents = s.events.slice(eventsBefore);'),
    );
    expect(tickLoop.length).toBeGreaterThan(0);
    expect(tickLoop).toContain('s.passCombo[0].count');
    expect(tickLoop).toContain('passComboCountsRef');
    expect(tickLoop).not.toContain('passComboAfter');
  });
});
