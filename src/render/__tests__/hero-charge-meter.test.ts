import { readFileSync } from 'fs';
import { join } from 'path';
import { createMatch, tick } from '../../sim/match';
import { ZONE_HEAT_THRESHOLD } from '../../sim/powers';
import { ROVERS, UNITED } from '../../sim/teams';
import {
  CHARGE_BAND_WIDTH,
  CHARGE_FILL_COLOR,
  CHARGE_RAINBOW_BANDS,
  CHARGE_RAINBOW_CYCLE_WIDTH,
  chargeMeter,
  chargeMeterAccessibilityLabel,
  rainbowStripBands,
  rainbowStripWidth,
} from '../hero-charge-meter';
import {
  AWAY_KIT_COLOR,
  HOME_KIT_COLOR,
  HOME_KIT_COLOR_SAFE,
} from '../team-kit-ui';

const matchSource = () =>
  readFileSync(join(process.cwd(), 'src/render/MatchScreen.tsx'), 'utf8');
const meterSource = () =>
  readFileSync(join(process.cwd(), 'src/render/HeroChargeMeter.tsx'), 'utf8');

describe('possession-card hero charge meter', () => {
  it('fills from banked Heat while the hero is building', () => {
    expect(chargeMeter(0, { kind: 'idle' }, 'MID')).toEqual({
      state: 'building',
      fill: 0,
    });
    expect(chargeMeter(30, { kind: 'idle' }, 'MID')).toEqual({
      state: 'building',
      fill: 0.5,
    });
    expect(chargeMeter(ZONE_HEAT_THRESHOLD, { kind: 'idle' }, 'MID')).toEqual({
      state: 'building',
      fill: 1,
    });
  });

  it('reads full and ready for the whole Zone window even though the engine zeroed the gauge', () => {
    // The engine sets gauge = 0 at Zone entry, so this is the case a raw
    // heatFraction bar would get exactly backwards.
    expect(chargeMeter(0, { kind: 'zone', remainingTicks: 70 }, 'MID')).toEqual(
      {
        state: 'ready',
        fill: 1,
      },
    );
    expect(chargeMeter(0, { kind: 'zone', remainingTicks: 1 }, 'MID')).toEqual({
      state: 'ready',
      fill: 1,
    });
  });

  it('stays full through a keeper save window', () => {
    expect(
      chargeMeter(
        0,
        {
          kind: 'armed',
          remainingTicks: 20,
          windowTicks: 20,
          strength: 0.9,
          sawShotOnTarget: false,
        },
        'MID',
      ),
    ).toEqual({ state: 'ready', fill: 1 });
    expect(
      chargeMeter(0, { kind: 'winding', untilTick: 40, strength: 1 }, 'MID'),
    ).toEqual({
      state: 'spent',
      fill: 0,
    });
    expect(
      chargeMeter(0, { kind: 'active', untilTick: 90, strength: 1 }, 'MID'),
    ).toEqual({
      state: 'spent',
      fill: 0,
    });
  });

  it('tracks a real hero through build → ready → reset in a live match', () => {
    // Rex Bould (United SUPER_STRENGTH) defaults to FIRE_WHEN_READY, so one
    // match actually walks every state instead of stalling in a banked Zone.
    const RIVAL = 14;
    const match = createMatch(42, ROVERS, UNITED);

    const states = new Set<string>();
    let sawReadyAtFull = false;
    let sawResetAfterReady = false;
    let wasReady = false;
    for (let i = 0; i < 3000; i++) {
      tick(match);
      const hero = match.players[RIVAL];
      const meter = chargeMeter(hero.gauge, hero.powerState, 'MID');
      states.add(meter.state);
      if (meter.state === 'ready') {
        expect(meter.fill).toBe(1);
        sawReadyAtFull = true;
        wasReady = true;
      } else if (wasReady) {
        // Whatever follows a Zone must not leave a stale full bar behind.
        expect(meter.fill).toBeLessThan(1);
        sawResetAfterReady = true;
        wasReady = false;
      }
    }

    expect(states.has('building')).toBe(true);
    expect(sawReadyAtFull).toBe(true);
    expect(sawResetAfterReady).toBe(true);
  });

  it('never leaves the strip narrow enough to expose the track mid-slide', () => {
    for (const trackWidth of [4, 48, 100, 134, 200, 400]) {
      const width = rainbowStripWidth(trackWidth);
      // Covers the track at both ends of the one-cycle travel.
      expect(width).toBeGreaterThanOrEqual(
        trackWidth + CHARGE_RAINBOW_CYCLE_WIDTH,
      );
    }
  });

  it('repeats whole palette cycles so the loop has no visible seam', () => {
    const bands = rainbowStripBands(134);
    expect(bands.length % CHARGE_RAINBOW_BANDS.length).toBe(0);
    expect(bands.slice(0, CHARGE_RAINBOW_BANDS.length)).toEqual([
      ...CHARGE_RAINBOW_BANDS,
    ]);
    expect(CHARGE_RAINBOW_CYCLE_WIDTH).toBe(
      CHARGE_RAINBOW_BANDS.length * CHARGE_BAND_WIDTH,
    );
  });

  it('keeps the on-device band width that reads as travelling colour, not shimmer', () => {
    // Measured on the real possession card: under ~1.5 palette cycles across
    // the bar, each colour stays individually legible while it moves.
    const CARD_CONTENT_WIDTH = 150 - (7 + 2) * 2;
    expect(CHARGE_BAND_WIDTH).toBe(16);
    expect(CARD_CONTENT_WIDTH / CHARGE_RAINBOW_CYCLE_WIDTH).toBeLessThan(1.5);
  });

  it('never wears a kit colour, so no band dissolves into the card behind it', () => {
    // The possession card is painted in the carrier's kit, and the ready strip
    // spans the full track height — a band matching the panel would lose its
    // edges. Verified visually on the amber card before this was locked down.
    const kits = [HOME_KIT_COLOR, HOME_KIT_COLOR_SAFE, AWAY_KIT_COLOR];
    for (const band of CHARGE_RAINBOW_BANDS) {
      expect(kits).not.toContain(band);
    }

    // The filling bar is a different case and is knowingly left alone: it does
    // share the away kit's blue, but it only reaches the card's edge in the
    // last moments before the Zone opens, where the rainbow takes over. Below
    // that it is framed by the dark track on the unfilled side.
    expect(CHARGE_FILL_COLOR).toBe(AWAY_KIT_COLOR);
  });

  it('speaks the three states', () => {
    expect(
      chargeMeterAccessibilityLabel(chargeMeter(30, { kind: 'idle' }, 'MID')),
    ).toBe('Power charge 50%');
    expect(
      chargeMeterAccessibilityLabel(
        chargeMeter(0, { kind: 'zone', remainingTicks: 70 }, 'MID'),
      ),
    ).toBe('Power charged and ready');
    expect(
      chargeMeterAccessibilityLabel(
        chargeMeter(0, { kind: 'active', untilTick: 9, strength: 1 }, 'MID'),
      ),
    ).toBe('Power in use, charge reset');
  });

  it('shows the meter only for a hero carrier, and changes no engine state', () => {
    const source = matchSource();

    expect(source).toContain('{carrier.def.power ? (');
    // The ROLE argument is the load-bearing part. Without it a goalkeeper on
    // the ball reads about 8% while holding a full charge, because their Zone
    // threshold is 5 and every bar used to divide by the outfield 60.
    expect(source).toContain('meter={chargeMeter(');
    expect(source).toContain('carrier.def.role,');
    expect(source).not.toContain('ENGINE_VERSION');
  });

  it('stops the rainbow loop for reduced motion', () => {
    const source = meterSource();

    expect(source).toContain('if (!ready || reduceMotion || stepOnRender)');
    expect(source).toContain('animation.stop()');
    // A pixel strip slides at a constant rate; easing would read as a pulse.
    expect(source).toContain('Easing.linear');
  });

  it('never runs the Animated loop on web, where the native driver is JS', () => {
    const source = meterSource();

    // The web strip advances at render time (per sim tick) instead of via a
    // continuous Animated.loop that would tick the JS thread every frame.
    expect(source).toContain("Platform.OS === 'web'");
    expect(source).toContain('stepOnRender && ready && !reduceMotion');
  });
});
