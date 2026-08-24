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

  it('cuts only the approved high-cost decorations', () => {
    expect(screen).toContain(
      'if (suppressCosmeticEffectsRef.current || threeXLiteRef.current) return;',
    );
    expect(screen).toContain('...(threeXLite\n      ? []');
    expect(screen).toContain('{threeXLite\n                    ? null');
    expect(screen.match(/hideDebris=\{threeXLite\}/gu)).toHaveLength(2);
    expect(
      screen.match(/reducedEffects=\{reducedEffects \|\| threeXLite\}/gu),
    ).toHaveLength(2);
    expect(screen).toContain('? GOAL_CONFETTI_SPARSE_PIECE_COUNT');
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
