import { readFileSync } from 'fs';
import { join } from 'path';
import { filesForEvent } from '../audio';
import type { MatchEvent } from '../../sim/types';
import { LAUNCH_POWER_IDS } from '../../game/power-catalog';

// Guards the event → SFX wiring in audio.ts (audit finding 1: several events
// with matching assets were silently unmapped). Asset requires are stubbed via
// jest.config.js moduleNameMapper, so this is a pure mapping test.

describe('filesForEvent: event → SFX wiring', () => {
  it('maps the previously-silent feedback events to their assets', () => {
    expect(
      filesForEvent({ t: 0, kind: 'SAVE', by: 0, resolveLeft: 100 }),
    ).toEqual(['save-slap']);
    expect(filesForEvent({ t: 0, kind: 'MISS', by: 0 })).toEqual(['crowd-ooh']);
    expect(
      filesForEvent({ t: 0, kind: 'POWER_INTERRUPTED', player: 3 }),
    ).toEqual(['power-interrupt']);
  });

  it('keeps the opening whistle and core action sounds wired', () => {
    expect(filesForEvent({ t: 0, kind: 'KICKOFF', half: 1 })).toEqual([
      'kickoff-whistle',
    ]);
    expect(
      filesForEvent({ t: 0, kind: 'GOAL', by: 9, team: 0, scoredById: 'p9' }),
    ).toEqual([
      'goal-net-hit',
      'goal-fanfare',
      'goal-celebration',
      'goal-crowd',
      'goal-confetti',
    ]);
    expect(
      filesForEvent({
        t: 0,
        kind: 'TACKLE',
        by: 3,
        on: 14,
        won: true,
        style: 'slide',
        contact: true,
      }),
    ).toEqual(['tackle-thud', 'grunt']);
    expect(
      filesForEvent({
        t: 0,
        kind: 'TACKLE',
        by: 3,
        on: 14,
        won: false,
        style: 'slide',
        contact: false,
      }),
    ).toEqual([]);
  });

  it("separates Gust's wind redirect from its huge keeper punt", () => {
    expect(
      filesForEvent({
        t: 8,
        kind: 'GUST_REDIRECT',
        player: 2,
        from: 12,
        to: 0,
      }),
    ).toEqual(['super-speed-whoosh']);
    expect(
      filesForEvent({ t: 10, kind: 'GUST_PUNT', player: 2, from: 0, to: 9 }),
    ).toEqual(['kick-shot']);
  });

  it('plays the Decoy disappearance pop exactly from its explicit event', () => {
    expect(
      filesForEvent({
        t: 80,
        kind: 'DECOY_POP',
        player: 5,
        clone: 22,
        source: 9,
        pos: { x: 3100, y: 2700 },
        reason: 'expired',
      }),
    ).toEqual(['decoy-pop']);
  });

  it('plays only the power sound at every firing strength, since all fires are automatic', () => {
    // The manual tap was removed on 2026-07-25, so there is no tap-confirm layer
    // at any strength — a full-strength fire is only reachable from test probes.
    expect(
      filesForEvent({
        t: 0,
        kind: 'POWER_FIRED',
        player: 10,
        power: 'SUPER_SPEED',
        strength: 1,
      }),
    ).toEqual(['super-speed-whoosh']);
    expect(
      filesForEvent({
        t: 0,
        kind: 'POWER_FIRED',
        player: 10,
        power: 'SUPER_SPEED',
        strength: 0.85,
      }),
    ).toEqual(['super-speed-whoosh']);
    expect(
      filesForEvent({
        t: 0,
        kind: 'POWER_FIRED',
        player: 10,
        power: 'SUPER_SPEED',
        strength: 0.75,
      }),
    ).toEqual(['super-speed-whoosh']);
  });

  it('times spatial powers on their real on-pitch impact instead of activation', () => {
    for (const [power, sound] of [
      ['BLINK_RUN', 'blink-teleport'],
      ['PHASE_RUN', 'phase-shift'],
      ['PORTAL_PASS', 'portal-warp'],
    ] as const) {
      expect(
        filesForEvent({
          t: 0,
          kind: 'POWER_FIRED',
          player: 10,
          power,
          strength: 0.85,
        }),
      ).toEqual([]);
      expect(
        filesForEvent({
          t: 1,
          kind: 'POWER_IMPACT',
          player: 10,
          power,
          target: 11,
        }),
      ).toEqual([sound]);
    }
  });

  it('gives delayed defensive powers distinct setup and landing cues', () => {
    for (const [power, setup, impact] of [
      ['FUTURE_SIGHT', 'future-sight-read', 'future-sight-intercept'],
      ['WEB_TRAP', 'web-cast', 'web-spring'],
      ['ICE_RINK', 'ice-freeze', 'ice-slide'],
      ['SHADOW_MARK', 'shadow-burrow', 'shadow-emerge'],
    ] as const) {
      expect(
        filesForEvent({
          t: 0,
          kind: 'POWER_FIRED',
          player: 2,
          power,
          strength: 0.85,
        }),
      ).toEqual([setup]);
      expect(
        filesForEvent({
          t: 10,
          kind: 'POWER_IMPACT',
          player: 2,
          power,
          target: 11,
        }),
      ).toEqual([impact]);
    }
  });

  it('keeps keeper and Thunder charge sounds distinct from the real ball impact', () => {
    expect(
      filesForEvent({
        t: 0,
        kind: 'POWER_FIRED',
        player: 9,
        power: 'THUNDER_STRIKE',
        strength: 0.85,
      }),
    ).toEqual(['thunder-charge']);
    expect(
      filesForEvent({
        t: 1,
        kind: 'SHOT',
        by: 9,
        power: 80,
        trajectory: 'driven',
      }),
    ).toEqual(['kick-shot']);
    expect(
      filesForEvent({
        t: 0,
        kind: 'POWER_FIRED',
        player: 0,
        power: 'ELASTIC_KEEPER',
        strength: 0.85,
      }),
    ).toEqual(['keeper-stretch']);
    expect(
      filesForEvent({
        t: 0,
        kind: 'POWER_FIRED',
        player: 0,
        power: 'GIANT_GK',
        strength: 0.85,
      }),
    ).toEqual(['giant-grow']);
    expect(
      filesForEvent({ t: 1, kind: 'SAVE', by: 0, resolveLeft: 80 }),
    ).toEqual(['save-slap']);
  });

  it('plays the flame-hit sting when a defender catches fire (IGNITED)', () => {
    expect(filesForEvent({ t: 0, kind: 'IGNITED', player: 5 })).toEqual([
      'flame-hit',
    ]);
  });

  it('uses the flame-up sound when Fire Torch activates', () => {
    expect(
      filesForEvent({
        t: 0,
        kind: 'POWER_FIRED',
        player: 9,
        power: 'FIRE_TORCH',
        strength: 0.85,
      }),
    ).toEqual(['flame-up']);
    expect(
      filesForEvent({
        t: 0,
        kind: 'POWER_FIRED',
        player: 9,
        power: 'FIRE_TORCH',
        strength: 1,
      }),
    ).toEqual(['flame-up']);
  });

  it('rallies on the drums, and never on the cut crowd wash', () => {
    expect(
      filesForEvent({
        t: 0,
        kind: 'POWER_FIRED',
        player: 9,
        power: 'RALLY_CRY',
        strength: 0.85,
      }),
    ).toEqual(['rally-drums']);
  });

  it('gives every launch power a sound somewhere in its deterministic lifecycle', () => {
    for (const power of LAUNCH_POWER_IDS) {
      const lifecycleSounds = [
        ...filesForEvent({
          t: 0,
          kind: 'POWER_FIRED',
          player: 10,
          power,
          strength: 0.85,
        }),
        ...filesForEvent({
          t: 1,
          kind: 'POWER_IMPACT',
          player: 10,
          power,
          target: 11,
        }),
      ];
      expect(lifecycleSounds).not.toEqual([]);
    }
  });

  it('leaves RECOVERED intentionally silent (no matching asset)', () => {
    expect(filesForEvent({ t: 0, kind: 'RECOVERED', player: 5 })).toEqual([]);
  });

  it('sounds POWER_EXPIRED again, now a manual tap can lose a Zone', () => {
    // Unreachable and deliberately unwired from m1.27 (the Zone stopped
    // counting down) until the manual tap returned on 2026-08-20. A press
    // outside the authored context arms a window; when it lapses the hero
    // loses one of only three Zones for the match. A charge the manager earned
    // must never vanish in silence — and since m2.8 it is not merely audible
    // but audibly BAD, the shipped negative cue layered under the expiry.
    expect(
      filesForEvent({
        t: 0,
        kind: 'POWER_EXPIRED',
        player: 5,
        power: 'SUPER_SPEED',
        reason: 'other',
      }),
    ).toEqual(['zone-expire', 'negative']);
  });

  /**
   * A standing challenge fired every 1.7s of match time and every one of them
   * played the full body-impact pair, 96 of ~121 changing nothing. Only the
   * standing style is tiered; slide and power contact are real collisions and
   * keep the thud they always had.
   */
  describe('standing-challenge tiers', () => {
    const standing = (
      won: boolean,
      contact: boolean,
      dropped?: true,
    ): MatchEvent => ({
      t: 0,
      kind: 'TACKLE',
      by: 3,
      on: 14,
      won,
      style: 'standing',
      contact,
      ...(dropped ? { dropped } : {}),
    });

    it('keeps the full body impact for a won challenge', () => {
      expect(filesForEvent(standing(true, true))).toEqual([
        'tackle-thud',
        'grunt',
      ]);
    });

    it('plays the soft wet landing when the beaten defender goes down', () => {
      expect(filesForEvent(standing(false, true, true))).toEqual(['body-fall']);
    });

    it('drops a beaten-but-standing challenge to the light scuff', () => {
      expect(filesForEvent(standing(false, true))).toEqual(['duel-scuff']);
    });

    it('stays silent when the challenge never made contact', () => {
      expect(filesForEvent(standing(false, false))).toEqual([]);
    });

    it('leaves slide and power contact exactly as they were', () => {
      for (const style of ['slide', 'power'] as const) {
        for (const won of [true, false]) {
          expect(
            filesForEvent({
              t: 0,
              kind: 'TACKLE',
              by: 3,
              on: 14,
              won,
              style,
              contact: true,
            }),
          ).toEqual(['tackle-thud', 'grunt']);
        }
      }
    });
  });

  it('every MatchEvent kind is handled (exhaustive — no throw)', () => {
    const samples: MatchEvent[] = [
      { t: 0, kind: 'KICKOFF', half: 1 },
      { t: 0, kind: 'PASS', from: 1, to: 2, ok: true },
      {
        t: 0,
        kind: 'SLIDE_STARTED',
        by: 1,
        on: 2,
        direction: { x: 1, y: 0 },
        untilTick: 4,
      },
      {
        t: 0,
        kind: 'TACKLE',
        by: 1,
        on: 2,
        won: false,
        style: 'slide',
        contact: true,
      },
      { t: 0, kind: 'SHOT', by: 9, power: 50, trajectory: 'driven' },
      { t: 0, kind: 'SAVE', by: 0, resolveLeft: 80 },
      { t: 0, kind: 'MISS', by: 9 },
      { t: 0, kind: 'GOAL', by: 9, team: 0, scoredById: 'p9' },
      { t: 0, kind: 'POWER_READY', player: 10, power: 'FIRE_TORCH' },
      {
        t: 0,
        kind: 'POWER_FIRED',
        player: 10,
        power: 'FIRE_TORCH',
        strength: 0.85,
      },
      {
        t: 0,
        kind: 'POWER_IMPACT',
        player: 10,
        power: 'BLINK_RUN',
        target: 10,
      },
      { t: 0, kind: 'POWER_INTERRUPTED', player: 10 },
      {
        t: 0,
        kind: 'POWER_EXPIRED',
        player: 10,
        power: 'FIRE_TORCH',
        reason: 'other',
      },
      {
        t: 0,
        kind: 'DECOY_POP',
        player: 5,
        clone: 22,
        source: 9,
        pos: { x: 1, y: 2 },
        reason: 'expired',
      },
      { t: 0, kind: 'GUST_REDIRECT', player: 2, from: 12, to: 0 },
      { t: 0, kind: 'GUST_PUNT', player: 2, from: 0, to: 9 },
      { t: 0, kind: 'CARD', player: 5, color: 'yellow' },
      { t: 0, kind: 'IGNITED', player: 5 },
      { t: 0, kind: 'EXTINGUISHED', player: 5 },
      { t: 0, kind: 'RECOVERED', player: 5 },
      { t: 0, kind: 'FORMATION_CHANGED', team: 0, formation: '4-4-2' },
      { t: 0, kind: 'MENTALITY_CHANGED', team: 0, mentality: 'BALANCED' },
      { t: 0, kind: 'ENERGY_USE_CHANGED', team: 0, energyUse: 'BALANCED' },
      {
        t: 0,
        kind: 'SUBSTITUTION',
        team: 0,
        player: 4,
        outPlayerId: 'out',
        inPlayerId: 'in',
      },
      { t: 0, kind: 'HALF_TIME' },
      { t: 0, kind: 'FULL_TIME' },
    ];
    for (const e of samples) expect(() => filesForEvent(e)).not.toThrow();
  });
});
