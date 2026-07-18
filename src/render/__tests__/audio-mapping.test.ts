import { filesForEvent } from '../audio';
import type { MatchEvent } from '../../sim/types';

// Guards the event → SFX wiring in audio.ts (audit finding 1: several events
// with matching assets were silently unmapped). Asset requires are stubbed via
// jest.config.js moduleNameMapper, so this is a pure mapping test.

describe('filesForEvent: event → SFX wiring', () => {
  it('maps the previously-silent feedback events to their assets', () => {
    expect(filesForEvent({ t: 0, kind: 'SAVE', by: 0, resolveLeft: 100 })).toEqual(['save-slap']);
    expect(filesForEvent({ t: 0, kind: 'MISS', by: 0 })).toEqual(['crowd-ooh']);
    expect(filesForEvent({ t: 0, kind: 'POWER_INTERRUPTED', player: 3 })).toEqual(['power-interrupt']);
    expect(filesForEvent({ t: 0, kind: 'POWER_EXPIRED', player: 3 })).toEqual(['zone-expire']);
  });

  it('keeps the opening whistle and core action sounds wired', () => {
    expect(filesForEvent({ t: 0, kind: 'KICKOFF', half: 1 })).toEqual(['kickoff-whistle']);
    expect(filesForEvent({ t: 0, kind: 'GOAL', by: 9, team: 0 })).toEqual(['goal-fanfare', 'crowd-cheer']);
    expect(filesForEvent({ t: 0, kind: 'TACKLE', by: 3, on: 14, won: true, style: 'slide', contact: true })).toEqual(['tackle-thud', 'grunt']);
    expect(filesForEvent({ t: 0, kind: 'TACKLE', by: 3, on: 14, won: false, style: 'slide', contact: false })).toEqual([]);
  });

  it('layers tap-fire only on a manual (strength 1.0) power fire', () => {
    expect(filesForEvent({ t: 0, kind: 'POWER_FIRED', player: 10, power: 'SUPER_SPEED', strength: 1 })).toEqual(['tap-fire', 'super-speed-whoosh']);
    expect(filesForEvent({ t: 0, kind: 'POWER_FIRED', player: 10, power: 'SUPER_SPEED', strength: 0.85 })).toEqual(['super-speed-whoosh']);
  });

  it('plays the flame-hit sting when a defender catches fire (IGNITED)', () => {
    expect(filesForEvent({ t: 0, kind: 'IGNITED', player: 5 })).toEqual(['flame-hit']);
  });

  it('uses the flame-up sound when Fire Torch activates', () => {
    expect(filesForEvent({ t: 0, kind: 'POWER_FIRED', player: 9, power: 'FIRE_TORCH', strength: 0.85 })).toEqual(['flame-up']);
    // A manual tap-confirm still layers the tap click on top.
    expect(filesForEvent({ t: 0, kind: 'POWER_FIRED', player: 9, power: 'FIRE_TORCH', strength: 1 })).toEqual(['tap-fire', 'flame-up']);
  });

  it('leaves RECOVERED intentionally silent (no matching asset)', () => {
    expect(filesForEvent({ t: 0, kind: 'RECOVERED', player: 5 })).toEqual([]);
  });

  it('every MatchEvent kind is handled (exhaustive — no throw)', () => {
    const samples: MatchEvent[] = [
      { t: 0, kind: 'KICKOFF', half: 1 },
      { t: 0, kind: 'PASS', from: 1, to: 2, ok: true },
      { t: 0, kind: 'SLIDE_STARTED', by: 1, on: 2, direction: { x: 1, y: 0 }, untilTick: 4 },
      { t: 0, kind: 'TACKLE', by: 1, on: 2, won: false, style: 'slide', contact: true },
      { t: 0, kind: 'SHOT', by: 9, power: 50 },
      { t: 0, kind: 'SAVE', by: 0, resolveLeft: 80 },
      { t: 0, kind: 'MISS', by: 9 },
      { t: 0, kind: 'GOAL', by: 9, team: 0 },
      { t: 0, kind: 'POWER_READY', player: 10 },
      { t: 0, kind: 'POWER_FIRED', player: 10, power: 'FIRE_TORCH', strength: 0.85 },
      { t: 0, kind: 'POWER_INTERRUPTED', player: 10 },
      { t: 0, kind: 'POWER_EXPIRED', player: 10 },
      { t: 0, kind: 'CARD', player: 5, color: 'yellow' },
      { t: 0, kind: 'IGNITED', player: 5 },
      { t: 0, kind: 'EXTINGUISHED', player: 5 },
      { t: 0, kind: 'RECOVERED', player: 5 },
      { t: 0, kind: 'HALF_TIME' },
      { t: 0, kind: 'FULL_TIME' },
    ];
    for (const e of samples) expect(() => filesForEvent(e)).not.toThrow();
  });
});
