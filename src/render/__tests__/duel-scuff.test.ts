import { readFileSync } from 'fs';
import { join } from 'path';
import {
  DUEL_SCUFF_OPACITY,
  DUEL_SCUFF_PIXELS,
  DUEL_SCUFF_SPREAD_PER_TICK,
  DUEL_SCUFF_TICKS,
  duelScuffFleckOffset,
  duelScuffFleckSize,
  duelScuffSpread,
} from '../duel-scuff';
import { STAGGER_TICKS } from '../animation';

describe('lost-duel scuff geometry', () => {
  it('is built from whole source pixels, so nothing lands off the pixel grid', () => {
    for (const fleck of DUEL_SCUFF_PIXELS) {
      expect(Number.isInteger(fleck.along)).toBe(true);
      expect(Number.isInteger(fleck.side)).toBe(true);
      expect(Number.isInteger(fleck.size)).toBe(true);
      expect(fleck.size).toBeGreaterThan(0);
    }
    // Sizes and offsets stay integral for every frame of the beat, not just at
    // rest: a smoothly shrinking float would blur every fleck as it faded.
    for (const age of [0, 0.37, 1, 1.5, 2.8]) {
      expect(Number.isInteger(duelScuffFleckSize(3, age))).toBe(true);
      expect(Number.isInteger(duelScuffFleckOffset(-4, age))).toBe(true);
    }
  });

  it('leans the spray to one side instead of ringing the contact point', () => {
    // A symmetric ring could have come from either player; an asymmetric spray
    // biased down the recoil direction says which one lost.
    const along = DUEL_SCUFF_PIXELS.map(fleck => fleck.along);
    const side = DUEL_SCUFF_PIXELS.map(fleck => fleck.side);
    expect(new Set(along).size).toBe(along.length);
    expect(new Set(side).size).toBeGreaterThan(1);
    expect(along.some(value => value < 0)).toBe(true);
    expect(along.some(value => value > 0)).toBe(true);
  });

  it('expands and shrinks over exactly the stagger it belongs to', () => {
    expect(DUEL_SCUFF_TICKS).toBe(STAGGER_TICKS);
    expect(duelScuffSpread(0)).toBe(1);
    expect(duelScuffSpread(2)).toBeCloseTo(1 + 2 * DUEL_SCUFF_SPREAD_PER_TICK, 10);
    // Shrinking is the only fade a single shared Path can express.
    expect(duelScuffFleckSize(3, 0)).toBe(3);
    expect(duelScuffFleckSize(3, DUEL_SCUFF_TICKS * 0.5)).toBeLessThan(3);
    expect(duelScuffFleckSize(3, DUEL_SCUFF_TICKS)).toBe(1);
    // ...and it never degenerates into a sub-pixel sliver.
    expect(duelScuffFleckSize(1, DUEL_SCUFF_TICKS)).toBe(1);
  });

  it('stays a small, quiet mark — six flecks under a handful of source pixels', () => {
    expect(DUEL_SCUFF_PIXELS.length).toBeLessThanOrEqual(6);
    expect(DUEL_SCUFF_OPACITY).toBeLessThan(1);
    for (const fleck of DUEL_SCUFF_PIXELS) {
      expect(Math.abs(fleck.along)).toBeLessThanOrEqual(6);
      expect(Math.abs(fleck.side)).toBeLessThanOrEqual(6);
      expect(fleck.size).toBeLessThanOrEqual(3);
    }
  });

  it('negative offsets round away from the contact point, never collapse onto it', () => {
    expect(duelScuffFleckOffset(-4, 1)).toBe(Math.round(-4 * duelScuffSpread(1)));
    expect(duelScuffFleckOffset(-4, 1)).toBeLessThan(-4);
    expect(duelScuffFleckOffset(4, 1)).toBeGreaterThan(4);
  });
});

describe('WorkletDuelScuff batching', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/render/WorkletMatchOverlays.tsx'),
    'utf8',
  );
  // Deliberately the last component in the file: several sibling tests slice
  // this source between named components, so appending rather than inserting
  // keeps their windows intact.
  const component = source.slice(source.indexOf('export function WorkletDuelScuff('));

  it('draws every concurrent scuff in one hard-edged Path', () => {
    expect(component).not.toBe('');
    expect(component.match(/usePathValue\(/g)).toHaveLength(1);
    expect(component.match(/<Path /g)).toHaveLength(1);
    expect(component.match(/antiAlias=\{false\}/g)).toHaveLength(1);
    // One loop over the render slots, not one Skia node per sprite.
    expect(component).toContain('for (let player = 0; player < RENDER_PLAYER_COUNT; player += 1)');
  });

  it('reads the contact point from the packed action buffer, on the UI thread', () => {
    expect(component).toContain("'worklet'");
    expect(component).toContain('actionData.value[offset] !== WORKLET_ACTION_STAGGER');
    expect(component).toContain('actionData.value[offset + 6] * scale');
    expect(component).toContain('actionData.value[offset + 7] * scale');
    // ...and snaps it through the one shared device-pixel rule.
    expect(component).toContain('snapDevicePixels(');
  });

  it('expires with the pose that spawned it', () => {
    expect(component).toContain('age >= DUEL_SCUFF_TICKS');
  });

  it('is drawn over the atlas, where two overlapping duellists cannot hide it', () => {
    const screen = readFileSync(join(process.cwd(), 'src/render/MatchScreen.tsx'), 'utf8');
    const atlasAt = screen.indexOf('<Atlas');
    const scuffAt = screen.indexOf('<WorkletDuelScuff');
    expect(atlasAt).toBeGreaterThan(-1);
    expect(scuffAt).toBeGreaterThan(atlasAt);
  });
});
