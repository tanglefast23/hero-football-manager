import { readFileSync } from 'fs';
import { join } from 'path';
import { PITCH_H, PITCH_W } from '../../sim/geometry';
import { layoutModeForWidth, TWO_COLUMN_MIN_WIDTH } from '../../ui/layout/layout-mode';
import {
  heatFraction,
  MATCH_RAIL_GUTTER,
  MATCH_RAIL_TOP_INSET,
  MATCH_RAIL_WIDTH,
  MENTALITY_CHIP_LABELS,
  mostTiredFirst,
  RAIL_HERO_TILE_CAP,
  RAIL_TIRED_ROWS,
  railHeroStatus,
  zoneSecondsRemaining,
} from '../match-rail';

const railSource = () => readFileSync(join(process.cwd(), 'src/render/MatchControlRail.tsx'), 'utf8');
const matchSource = () => readFileSync(join(process.cwd(), 'src/render/MatchScreen.tsx'), 'utf8');
const styleSource = () => readFileSync(join(process.cwd(), 'src/render/match-screen-styles.ts'), 'utf8');

/** Where the pitch's left edge lands once rail + pitch are centred as one group. */
function pitchLeftEdge(width: number, pitchWidth: number): number {
  return MATCH_RAIL_GUTTER * 2 + MATCH_RAIL_WIDTH + Math.max(
    0,
    (width - MATCH_RAIL_GUTTER * 3 - MATCH_RAIL_WIDTH - pitchWidth) / 2,
  );
}

describe('desktop match control rail', () => {
  it('lists the three most tired players, condition ascending', () => {
    const field = [
      { id: 'gk', condition: 88 },
      { id: 'lb', condition: 34 },
      { id: 'cm', condition: 61 },
      { id: 'st', condition: 12 },
      { id: 'rb', condition: 40 },
    ];

    expect(mostTiredFirst(field).map((player) => player.id)).toEqual(['st', 'lb', 'rb']);
    expect(RAIL_TIRED_ROWS).toBe(3);
  });

  it('keeps equally tired players in their field order', () => {
    const field = [
      { id: 'a', condition: 50 },
      { id: 'b', condition: 50 },
      { id: 'c', condition: 50 },
      { id: 'd', condition: 50 },
    ];

    expect(mostTiredFirst(field).map((player) => player.id)).toEqual(['a', 'b', 'c']);
  });

  it('reads heat as a clamped share of the Zone threshold', () => {
    expect(heatFraction(0)).toBe(0);
    expect(heatFraction(30)).toBe(0.5);
    expect(heatFraction(60)).toBe(1);
    expect(heatFraction(120)).toBe(1);
    expect(heatFraction(-5)).toBe(0);
  });

  it('separates banking heat, the tappable Zone, and a power playing out', () => {
    expect(railHeroStatus({ kind: 'idle' })).toBe('building');
    expect(railHeroStatus({ kind: 'zone', remainingTicks: 70 })).toBe('zone');
    expect(railHeroStatus({ kind: 'armed', remainingTicks: 20 })).toBe('firing');
    expect(railHeroStatus({ kind: 'winding', untilTick: 40, strength: 1 })).toBe('firing');
    expect(railHeroStatus({ kind: 'active', untilTick: 90, strength: 1 })).toBe('firing');
  });

  it('counts the Zone window down in whole seconds and only inside the Zone', () => {
    expect(zoneSecondsRemaining({ kind: 'zone', remainingTicks: 70 })).toBe(7);
    expect(zoneSecondsRemaining({ kind: 'zone', remainingTicks: 41 })).toBe(5);
    expect(zoneSecondsRemaining({ kind: 'zone', remainingTicks: 0 })).toBe(0);
    expect(zoneSecondsRemaining({ kind: 'idle' })).toBeNull();
    expect(zoneSecondsRemaining({ kind: 'active', untilTick: 90, strength: 1 })).toBeNull();
  });

  it('names the playstyle chips without renaming the engine mentalities', () => {
    expect(MENTALITY_CHIP_LABELS).toEqual({
      BALANCED: 'BALANCED',
      ATTACK: 'PRESS',
      PROTECT: 'PARK BUS',
    });
  });

  it('caps the rail at the Hero License field cap of four tiles', () => {
    expect(RAIL_HERO_TILE_CAP).toBe(4);
  });

  it('leaves the pitch aspect-correct and full-height beside a 440pt rail', () => {
    const width = 1280;
    const height = 800;
    expect(layoutModeForWidth(width)).toBe('twoColumn');

    const availableHeight = height - MATCH_RAIL_TOP_INSET - MATCH_RAIL_GUTTER;
    const availableWidth = width - MATCH_RAIL_WIDTH - MATCH_RAIL_GUTTER * 3;
    const pitchWidth = Math.min(availableWidth, (availableHeight * PITCH_W) / PITCH_H);
    const pitchHeight = PITCH_H * (pitchWidth / PITCH_W);

    expect(MATCH_RAIL_WIDTH).toBe(440);
    // Height-limited, so the pitch fills the pane vertically...
    expect(Math.round(pitchHeight)).toBe(availableHeight);
    // ...and stays wider than the phone pitch it replaces.
    expect(pitchWidth).toBeGreaterThan(430);
    expect(pitchWidth).toBeLessThanOrEqual(availableWidth);
  });

  it('keeps the rail one gutter from the touchline instead of stranding it left', () => {
    // A wide, short window is the worst case: the pitch is height-limited, so a
    // flexed pane used to centre it in ~1,000pt of leftover width.
    const width = 1920;
    const pitchWidth = 800;

    expect(styleSource()).toContain("justifyContent: 'center'");
    expect(styleSource()).not.toContain('desktopPitchPane: { flex: 1');
    expect(matchSource()).toContain('{ left: desktopPitchLeft }');

    const railRight = pitchLeftEdge(width, pitchWidth) - MATCH_RAIL_GUTTER;
    const railLeft = railRight - MATCH_RAIL_WIDTH;
    // The gap between controls and pitch is the gutter, nothing more...
    expect(pitchLeftEdge(width, pitchWidth) - railRight).toBe(MATCH_RAIL_GUTTER);
    // ...and the leftover width is split evenly either side of the pair.
    expect(Math.round(railLeft)).toBe(
      Math.round(width - (pitchLeftEdge(width, pitchWidth) + pitchWidth)),
    );
  });

  it('reserves no bottom-dock height on desktop and none of the rail on phones', () => {
    const source = matchSource();

    expect(layoutModeForWidth(TWO_COLUMN_MIN_WIDTH - 1)).toBe('single');
    expect(source).toContain("const railLayout = layoutModeForWidth(width) === 'twoColumn';");
    expect(source).toContain('? MATCH_RAIL_TOP_INSET + MATCH_RAIL_GUTTER');
    expect(source).toContain('const availablePitchWidth = railLayout');
    expect(source).toContain('width - MATCH_RAIL_WIDTH - MATCH_RAIL_GUTTER * 3');
    // `scale` now comes from matchPitchLayout, which also snaps sprite
    // magnification to whole device pixels. What this test guards is that the
    // rail's reserved width is what gets measured, not the raw viewport.
    expect(source).toContain('matchPitchLayout(availablePitchWidth');
    // The phone scorebar and coaching dock render only in single mode.
    expect(source).toContain('{railLayout ? null : (');
    expect(source).toContain('{railLayout ? (');
  });

  it('drives every rail control from an already-recorded coaching input', () => {
    const source = matchSource();

    expect(source).toContain("kind: 'SET_FORMATION', formation }");
    expect(source).toContain("kind: 'SET_MENTALITY', mentality }");
    expect(source).toContain("kind: 'SET_ENERGY_USE', energyUse: mode }");
    // The hero tile's A/M badge is read-only until on-pitch tap-to-fire exists,
    // so the rail must NOT queue the team-wide auto-powers policy flip.
    expect(source).not.toContain("kind: 'SET_AUTO_POWERS',");
    // No new input kinds, and no engine-version-affecting sim edit.
    expect(source).not.toContain('ENGINE_VERSION');
  });

  it('never hands a Pressable a function style', () => {
    expect(railSource()).not.toMatch(/style=\{\(\{\s*pressed/);
  });

  it('keeps the signed-off rail copy', () => {
    const source = railSource();

    expect(source).toContain('SUBSTITUTIONS · {substitutionsRemaining} LEFT');
    expect(source).toContain('MOST TIRED ON THE PITCH');
    expect(source).toContain('SWAP OPENS THE BENCH · FRESH LEGS ENTER AT 100%');
    expect(source).toContain('TEAM ENERGY ({ENERGY_USE_LABELS[energyUse]})');
    expect(source).toContain('{teamEnergy}% AVERAGE · {tiredCount} TIRED (≤ 40%)');
    expect(source).toContain(
      'ONE POWER TILE PER FIELDED HERO — THE RAIL GROWS TO 4 TILES WITH THE HERO LICENSE CAP.',
    );
    // Status tiles only: firing is a tap on the glowing hero, not a rail button.
    expect(source).not.toContain('>FIRE<');
  });
});
