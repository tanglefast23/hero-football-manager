import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PASS_COMBO_FLOOR,
  PASS_COMBO_IDLE,
  PASS_COMBO_POP_MS,
  passComboAfter,
  passComboCellPx,
  passComboGlyph,
  passComboOpacity,
  passComboRise,
  passComboScale,
  type PassComboChain,
} from '../pass-combo';

const pass = (team: 0 | 1) => ({ kind: 'completed-pass' as const, team });
const BREAK = { kind: 'break' as const };

function chainOf(...teams: (0 | 1)[]): PassComboChain {
  return teams.reduce(
    (chain, team) => passComboAfter(chain, pass(team)),
    PASS_COMBO_IDLE,
  );
}

describe('pass combo chain', () => {
  it('counts consecutive completed passes by one team', () => {
    expect(chainOf(0).count).toBe(1);
    expect(chainOf(0, 0, 0).count).toBe(3);
  });

  it('starts a new run when the other team completes a pass', () => {
    expect(chainOf(0, 0, 1)).toEqual({ team: 1, count: 1 });
  });

  it('clears on any break, and a break while idle stays idle', () => {
    expect(passComboAfter(chainOf(0, 0, 0), BREAK)).toEqual(PASS_COMBO_IDLE);
    expect(passComboAfter(PASS_COMBO_IDLE, BREAK)).toEqual(PASS_COMBO_IDLE);
  });

  it('shows nothing until the floor, so ordinary passing is not wallpaper', () => {
    expect(chainOf(0).count).toBeLessThan(PASS_COMBO_FLOOR);
    expect(chainOf(0, 0).count).toBe(PASS_COMBO_FLOOR);
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

  it('counts a pass at the catch, never at the kick', () => {
    // PASS is emitted the moment the ball leaves the boot and the flight runs
    // several ticks. Counting on the event put the number on empty grass, and
    // it often expired before the ball arrived. The ball state is the only
    // honest signal that a pass was actually received.
    const screen = source();
    expect(screen).toContainSource("if (s.ball.kind === 'pass') {");
    expect(screen).toContainSource(
      "const holder = s.ball.kind === 'held' ? s.ball.by : -1;",
    );
    // The old launch-time read must not come back.
    expect(screen).not.toContainSource('eventAfter.players[e.to]');
  });

  it('applies breaks in tick order, inside the catch-up loop', () => {
    // One frame can catch several ticks up. A break drained afterwards would
    // undo a chain that legitimately continued after it.
    const screen = source();
    const tickLoop = screen.slice(
      screen.indexOf('while (acc >= TICK_MS'),
      screen.indexOf('const newEvents = s.events.slice(eventsBefore);'),
    );
    expect(tickLoop.length).toBeGreaterThan(0);
    expect(tickLoop).toContain('passComboAfter');
  });
});
