import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const screen = readFileSync(
  join(process.cwd(), 'src/render/MatchScreen.tsx'),
  'utf8',
);

describe('3x Lite wiring', () => {
  it('follows only the selected 3x speed without restarting the RAF loop', () => {
    expect(screen).toContain('const threeXLite = speed === 3;');
    expect(screen).toContain('threeXLiteRef.current = allowed === 3;');
    const loopEffect = screen.slice(
      screen.indexOf('useEffect(() => {\n    let raf = 0;'),
      screen.indexOf('// Distance, not wall-clock ticks'),
    );
    expect(loopEffect).not.toContain('\n    threeXLite,');
  });

  it('keeps only pass-combo trails and dense confetti reduced', () => {
    expect(screen).toContain('trailGhostsFor(entity, !threeXLiteRef.current)');
    expect(
      screen.match(/trailGhostsFor\(player, !threeXLite\)/gu),
    ).toHaveLength(2);
    expect(screen).not.toContain('hideDebris');
    expect(screen).not.toContain('...(threeXLite');
    expect(screen).not.toContain('{threeXLite\n');
    expect(screen).toContain('? GOAL_CONFETTI_SPARSE_PIECE_COUNT');
  });

  it('restores activation, camera, impact, and ticker effects at 3x', () => {
    const activation = screen.slice(
      screen.indexOf('const startJuice ='),
      screen.indexOf('const loop ='),
    );
    expect(activation).toContain(
      'if (suppressCosmeticEffectsRef.current) return;',
    );
    expect(activation).not.toContain('threeXLite');
    expect(screen).toContain('      advanceJuice(now);');
    expect(screen).not.toContain(
      'if (threeXLiteRef.current && juiceRef.current',
    );
    for (const component of ['ProceduralMatchEffects', 'MatchTickerLine']) {
      const start = screen.indexOf(`<${component}`);
      const props = screen.slice(start, screen.indexOf('/>', start));
      expect(props).toContain('reducedEffects={reducedEffects}');
      expect(props).not.toContain('threeXLite');
    }
  });

  it('keeps the approved 3x match information and lower-cost effects', () => {
    const substitution = screen.slice(
      screen.indexOf('const startSubstitutionWalk'),
      screen.indexOf('// ---- Activation juice'),
    );
    expect(substitution).not.toContain('threeXLite');

    const ordinaryShot = screen.slice(
      screen.indexOf("recordMatchVfx(\n              'dangerous-shot'"),
      screen.indexOf("if (e.kind === 'TACKLE' && e.won)"),
    );
    expect(ordinaryShot).not.toContain('threeXLite');
    expect(screen).toContain('scorching={scorchingShot}');
    expect(screen).toContain('visible={ballOccluded}');
  });
});
