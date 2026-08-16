import { createMatch, tick } from '../../sim/match';
import { ROVERS, UNITED } from '../../sim/teams';
import { RENDER_PLAYER_COUNT, playerAt } from '../../sim/entities';
import type { SimPlayer } from '../../sim/types';
import {
  COUNTDOWN_DIGIT_HEIGHT,
  COUNTDOWN_DIGIT_WIDTH,
  countdownGlyph,
  incapacityCountdowns,
  incapacitySecondsLeft,
} from '../incapacity-countdown';

function player(overrides: Partial<SimPlayer>): SimPlayer {
  return { outUntilTick: 0, ...overrides } as SimPlayer;
}

describe('incapacitySecondsLeft', () => {
  it('rounds a part-second hold up, so the last moment reads 1 and not 0', () => {
    // 10 ticks = 1000ms exactly; 11 ticks is 1.1s and must still read 2.
    expect(incapacitySecondsLeft(player({ outUntilTick: 10 }), 0)).toBe(1);
    expect(incapacitySecondsLeft(player({ outUntilTick: 11 }), 0)).toBe(2);
    expect(incapacitySecondsLeft(player({ outUntilTick: 11 }), 10)).toBe(1);
  });

  it('shows nothing once the hold has expired', () => {
    expect(incapacitySecondsLeft(player({ outUntilTick: 10 }), 10)).toBe(0);
    expect(incapacitySecondsLeft(player({ outUntilTick: 0 }), 40)).toBe(0);
  });

  it('takes the longest of the two holds it recognises', () => {
    const held = player({ outUntilTick: 10, webbedUntilTick: 40 });
    expect(incapacitySecondsLeft(held, 0)).toBe(4);
  });

  it('never counts down a red card — that player is not coming back', () => {
    const sentOff = player({ outUntilTick: 9999, outReason: 'redcard' });
    expect(incapacitySecondsLeft(sentOff, 0)).toBe(0);
  });

  // Every case below is a player who is still MOVING, or held for under a
  // second. Counting them down flashes "1" over a running body and then jumps.
  it('ignores the four-tick tackle get-up', () => {
    expect(incapacitySecondsLeft(player({ tackleRecoveryUntil: 40 }), 0)).toBe(
      0,
    );
  });

  it('ignores the Super Strength wind-up lock — the carrier still dribbles', () => {
    expect(
      incapacitySecondsLeft(player({ actionLockedUntilTick: 40 }), 0),
    ).toBe(0);
  });

  it('ignores an Ice Rink slide — the victim is sliding, not stood still', () => {
    const sliding = player({
      forcedMovement: {
        kind: 'ICE_SLIDE',
        untilTick: 40,
        step: { x: 0, y: 110 },
      },
    });
    expect(incapacitySecondsLeft(sliding, 0)).toBe(0);
  });
});

describe('incapacityCountdowns', () => {
  it('reports exactly the players a live match is holding out', () => {
    const state = createMatch(9, ROVERS, UNITED, { controlledTeam: 0 });
    for (let step = 0; step < 400; step += 1) tick(state);
    state.players[3].outUntilTick = state.tick + 30;
    state.players[3].outReason = 'ignited';

    const expected = new Set<number>();
    for (let slot = 0; slot < RENDER_PLAYER_COUNT; slot += 1) {
      const found = playerAt(state, slot);
      if (found === undefined) continue;
      if (incapacitySecondsLeft(found, state.tick) > 0) expected.add(slot);
    }

    const reported = incapacityCountdowns(state);
    expect(new Set(reported.map((entry) => entry.slot))).toEqual(expected);
    expect(reported.every((entry) => entry.seconds > 0)).toBe(true);
    expect(reported.find((entry) => entry.slot === 3)?.seconds).toBe(3);
  });
});

describe('countdownGlyph', () => {
  it('draws nothing for a finished hold', () => {
    expect(countdownGlyph(0)).toEqual({ pixels: [], width: 0, height: 0 });
  });

  it('sizes one digit to the 3x5 cell', () => {
    const glyph = countdownGlyph(8);
    expect(glyph.width).toBe(COUNTDOWN_DIGIT_WIDTH);
    expect(glyph.height).toBe(COUNTDOWN_DIGIT_HEIGHT);
    // "8" lights every cell of its 3x5 box except the two middle-row sides.
    expect(glyph.pixels).toHaveLength(13);
    expect(glyph.pixels.every((cell) => cell.x < 3 && cell.y < 5)).toBe(true);
  });

  it('lays a two-digit number out with a one-cell gap between digits', () => {
    const glyph = countdownGlyph(15);
    expect(glyph.width).toBe(COUNTDOWN_DIGIT_WIDTH * 2 + 1);
    const left = countdownGlyph(1).pixels;
    const right = countdownGlyph(5).pixels;
    expect(glyph.pixels).toHaveLength(left.length + right.length);
    // Nothing lands in the gap column, so the digits stay legibly separate.
    expect(glyph.pixels.some((cell) => cell.x === 3)).toBe(false);
  });
});
