import { readFileSync } from 'fs';
import { join } from 'path';
import {
  HARD_SHOT_POWER_MIN,
  MATCH_VFX_DURATION_MS,
  MATCH_VFX_EMITTER_CAP,
  MATCH_VFX_PHASE_COUNT,
  MATCH_VFX_STEP_MS,
  activeMatchVfxEmitters,
  appendMatchVfxEmitter,
  isHardShotPower,
  matchVfxFadeOpacity,
  prepareMatchVfxEmitter,
  sampleMatchVfxGeometry,
  type MatchVfxKind,
} from '../match-vfx';

const kinds: readonly MatchVfxKind[] = [
  'slide-tackle',
  'standing-tackle',
  'hard-shot',
  'save-impact',
  'power-interruption',
];

function emitter(kind: MatchVfxKind, eventTick = 10) {
  return prepareMatchVfxEmitter({
    matchSeed: 20260811,
    kind,
    eventTick,
    actor: 4,
    target: 15,
    anchor: { x: 3_401.4, y: 5_002.6 },
    direction: { x: 3, y: 4 },
    intensity: 0.75,
  });
}

describe('procedural match VFX recipes', () => {
  it('uses four 167ms phases for one exact 668ms lifetime', () => {
    // Halved from 334ms. All four phases still play; they play twice as fast,
    // so the burst leaves with the moment instead of sitting on the pitch.
    expect(MATCH_VFX_STEP_MS).toBe(167);
    expect(MATCH_VFX_PHASE_COUNT).toBe(4);
    expect(MATCH_VFX_DURATION_MS).toBe(668);
  });

  it('fades a burst out over its life instead of cutting it', () => {
    expect(matchVfxFadeOpacity(0)).toBe(1);
    expect(matchVfxFadeOpacity(1)).toBeCloseTo(0.75);
    expect(matchVfxFadeOpacity(2)).toBeCloseTo(0.5);
    expect(matchVfxFadeOpacity(3)).toBeCloseTo(0.25);
    // Never negative, however far past its life it is sampled.
    expect(matchVfxFadeOpacity(MATCH_VFX_PHASE_COUNT)).toBe(0);
    expect(matchVfxFadeOpacity(99)).toBe(0);
  });

  it('prepares stable semantic seeds and normalizes direction', () => {
    const first = emitter('standing-tackle');
    const second = emitter('standing-tackle');
    expect(first).toEqual(second);
    expect(first.anchor).toEqual({ x: 3_401, y: 5_003 });
    expect(first.direction.x).toBeCloseTo(0.6);
    expect(first.direction.y).toBeCloseTo(0.8);
    expect(emitter('hard-shot').seed).not.toBe(first.seed);
  });

  it.each(kinds)(
    '%s geometry is deterministic and changes at phase boundaries',
    (kind) => {
      const prepared = emitter(kind);
      const before = sampleMatchVfxGeometry(
        prepared,
        MATCH_VFX_STEP_MS - 1,
        false,
      );
      const after = sampleMatchVfxGeometry(prepared, MATCH_VFX_STEP_MS, false);
      expect(sampleMatchVfxGeometry(prepared, 0, false)).toEqual(
        sampleMatchVfxGeometry(prepared, 0, false),
      );
      expect(after).not.toEqual(before);
    },
  );

  it.each(kinds)(
    '%s freezes its causal mark and removes traveling particles',
    (kind) => {
      const prepared = emitter(kind);
      const first = sampleMatchVfxGeometry(prepared, 0, true);
      expect(sampleMatchVfxGeometry(prepared, 8_000, true).marks).toEqual(
        first.marks,
      );
      expect(first.marks.length).toBeLessThan(
        sampleMatchVfxGeometry(prepared, 0, false).marks.length,
      );
      expect(sampleMatchVfxGeometry(prepared, 0, false, true).marks).toEqual(
        first.marks,
      );
    },
  );

  it('keeps only the newest sixteen emitters', () => {
    let current = [] as ReturnType<typeof emitter>[];
    for (let tick = 0; tick < MATCH_VFX_EMITTER_CAP + 3; tick += 1) {
      current = appendMatchVfxEmitter(
        current,
        prepareMatchVfxEmitter({
          matchSeed: 1,
          kind: 'standing-tackle',
          eventTick: tick,
          actor: tick,
          anchor: { x: tick, y: tick },
          direction: { x: 1, y: 0 },
        }),
      );
    }
    expect(current).toHaveLength(MATCH_VFX_EMITTER_CAP);
    expect(current[0]?.startTick).toBe(3);
    expect(current.at(-1)?.startTick).toBe(MATCH_VFX_EMITTER_CAP + 2);
  });

  it('expires emitters at the exact duration', () => {
    const prepared = emitter('hard-shot', 0);
    expect(activeMatchVfxEmitters([prepared], 6.67)).toEqual([prepared]);
    expect(activeMatchVfxEmitters([prepared], 6.68)).toEqual([]);
  });

  it('classifies 55 as hard and excludes 54', () => {
    expect(HARD_SHOT_POWER_MIN).toBe(55);
    expect(isHardShotPower(54)).toBe(false);
    expect(isHardShotPower(55)).toBe(true);
    expect(isHardShotPower(999)).toBe(true);
  });

  it('contains no runtime randomness or wall-clock authority', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/render/match-vfx.ts'),
      'utf8',
    );
    expect(source).not.toMatch(/Math\.random|Date\b|performance\.now/u);
  });
});

describe('procedural match VFX renderer contract', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/render/ProceduralMatchEffects.tsx'),
    'utf8',
  );

  it('uses a fixed grid of hard-edged paths and the shared pixel snapper', () => {
    // Five colours x four age steps. Fixed, and independent of how many
    // emitters are live — that independence is the batching guarantee, not the
    // number itself. A colour needs one path per age step because the burst
    // fades and a path carries one opacity.
    expect(source).toContain('PROCEDURAL_MATCH_VFX_RENDER_NODE_COUNT = 20');
    expect(source).toContain('opacity={matchVfxFadeOpacity(step)}');
    expect(source).toContain(
      "'ink',\n  'cream',\n  'grass',\n  'blue',\n  'gold'",
    );
    expect(source).toContain('antiAlias={false}');
    expect(source).toContain("from './pixel-grid'");
    expect(source.match(/snapDevicePixels\(/g)).toHaveLength(4);
    expect(source).not.toContain('Math.random');
  });

  it('joins the two tackle paths into a seven-node production layer', () => {
    const screen = readFileSync(
      join(process.cwd(), 'src/render/MatchScreen.tsx'),
      'utf8',
    );
    expect(screen.match(/<WorkletSlideTackleEffects\b/g)).toHaveLength(2);
    expect(screen.match(/<ProceduralMatchEffects\b/g)).toHaveLength(1);
    expect(screen.indexOf('layer="dust"')).toBeGreaterThan(
      screen.indexOf('<Atlas'),
    );
    expect(screen.indexOf('layer="dust"')).toBeLessThan(
      screen.indexOf('layer="grass"'),
    );
    expect(screen.indexOf('layer="grass"')).toBeGreaterThan(
      screen.indexOf('<Atlas'),
    );
  });

  it('captures each event frame inside its own tick during catch-up', () => {
    const screen = readFileSync(
      join(process.cwd(), 'src/render/MatchScreen.tsx'),
      'utf8',
    );
    const tickStart = screen.indexOf(
      'const tickEventsBefore = s.events.length;',
    );
    const snapshot = screen.indexOf(
      'nextRef.current = snapshotFrame(s, before);',
      tickStart,
    );
    const capture = screen.indexOf(
      'for (const event of s.events.slice(tickEventsBefore))',
      snapshot,
    );
    const batchEnd = screen.indexOf(
      'const newEvents = s.events.slice(eventsBefore);',
    );
    expect(tickStart).toBeGreaterThan(-1);
    expect(snapshot).toBeGreaterThan(tickStart);
    expect(capture).toBeGreaterThan(snapshot);
    expect(capture).toBeLessThan(batchEnd);
    expect(screen).toContain('const eventBefore = captured?.before');
    expect(screen).toContain('const eventAfter = captured?.after');
  });

  it('keeps ordinary-shot and Decoy Pop puff ownership separate', () => {
    const screen = readFileSync(
      join(process.cwd(), 'src/render/MatchScreen.tsx'),
      'utf8',
    );
    expect(screen).toContain("owner: 'ordinary-shot'");
    expect(screen).toContain("owner: 'decoy-pop'");
    expect(screen).toContain("if (puffRef.current?.owner === 'ordinary-shot')");
    expect(screen).toContain(
      'interruptedPlayers.has(e.on)\n              ? null',
    );
  });
});
