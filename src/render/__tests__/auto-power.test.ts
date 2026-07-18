import { createMatch, queueInput, tick } from '../../sim/match';
import { ZONE_WINDOW_TICKS } from '../../sim/powers';
import { ROVERS, UNITED } from '../../sim/teams';
import { queueAutoPowerTap } from '../autoPower';

const TORCH = 9;
const SPEEDSTER = 10;
const RIVAL = 14;

describe('watch-match AUTO power control', () => {
  it('queues the first available home power as a replay-recorded tap for the next tick', () => {
    const match = createMatch(42, ROVERS, UNITED);
    match.players[TORCH].powerState = { kind: 'zone', remainingTicks: ZONE_WINDOW_TICKS };

    expect(queueAutoPowerTap(match)).toBe(TORCH);
    expect(match.pendingInputs).toEqual([{ tick: 1, kind: 'POWER_TAP', player: TORCH }]);
    expect(match.inputLog).toEqual([{ tick: 1, kind: 'POWER_TAP', player: TORCH }]);

    tick(match);
    expect(match.players[TORCH].powerState).toMatchObject({ kind: 'winding', strength: 1 });
  });

  it('queues a replay-recorded tap for a manually controlled away hero', () => {
    const match = createMatch(42, ROVERS, UNITED, {
      homePolicy: 'FIRE_WHEN_READY',
      awayPolicy: 'SAVE_FOR_TAP',
    });
    match.players[RIVAL].powerState = { kind: 'zone', remainingTicks: ZONE_WINDOW_TICKS };

    expect(queueAutoPowerTap(match, 1)).toBe(RIVAL);
    expect(match.inputLog).toEqual([{ tick: 1, kind: 'POWER_TAP', player: RIVAL }]);
  });

  it('does nothing when no power is available', () => {
    const match = createMatch(42, ROVERS, UNITED);

    expect(queueAutoPowerTap(match)).toBeNull();
    expect(match.inputLog).toHaveLength(0);
  });

  it('gives an already queued manual tap priority and does not add a duplicate input', () => {
    const match = createMatch(42, ROVERS, UNITED);
    match.players[TORCH].powerState = { kind: 'zone', remainingTicks: ZONE_WINDOW_TICKS };
    match.players[SPEEDSTER].powerState = { kind: 'zone', remainingTicks: ZONE_WINDOW_TICKS };
    queueInput(match, { tick: 1, kind: 'POWER_TAP', player: SPEEDSTER });

    expect(queueAutoPowerTap(match)).toBeNull();
    expect(match.inputLog).toEqual([{ tick: 1, kind: 'POWER_TAP', player: SPEEDSTER }]);
  });

  it('waits behind a busy teammate, then queues the frozen Zone as soon as the team is free', () => {
    const match = createMatch(42, ROVERS, UNITED);
    match.players[TORCH].powerState = { kind: 'active', untilTick: 1, strength: 1 };
    match.players[SPEEDSTER].powerState = { kind: 'zone', remainingTicks: ZONE_WINDOW_TICKS };

    expect(queueAutoPowerTap(match)).toBeNull();
    tick(match);
    expect(match.players[TORCH].powerState.kind).toBe('idle');
    expect(queueAutoPowerTap(match)).toBe(SPEEDSTER);
    expect(match.inputLog.at(-1)).toEqual({ tick: 2, kind: 'POWER_TAP', player: SPEEDSTER });
  });

  it('skips a knocked-down zoned hero and activates the next available teammate', () => {
    const match = createMatch(42, ROVERS, UNITED);
    match.players[TORCH].powerState = { kind: 'zone', remainingTicks: ZONE_WINDOW_TICKS };
    match.players[TORCH].outUntilTick = 20;
    match.players[SPEEDSTER].powerState = { kind: 'zone', remainingTicks: ZONE_WINDOW_TICKS };

    expect(queueAutoPowerTap(match)).toBe(SPEEDSTER);
  });
});
