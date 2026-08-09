import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TeamDef } from '../../sim/types';
import { winningHeadlineHero } from '../rival-victory';

function team(id: string, heroId?: string): TeamDef {
  return {
    id,
    name: id,
    players: Array.from({ length: 11 }, (_, index) => ({
      id: index === 9 && heroId ? heroId : `${id}-${index}`,
      name: index === 9 && heroId ? 'Headline Hero' : `${id} ${index}`,
      role: index === 0 ? 'GK' : index < 5 ? 'DEF' : index < 9 ? 'MID' : 'FWD',
      attrs: { pac: 50, sho: 50, pas: 50, def: 50, tec: 50, sta: 50, ref: 0 },
      ...(index === 9 && heroId ? { lookId: 'f171' } : {}),
    })),
  };
}

describe('winning headline hero', () => {
  const ordinary = team('ordinary');
  const larry = team('larry-club', 'special-f171');

  it('returns the headline hero only when their team won', () => {
    expect(winningHeadlineHero(ordinary, larry, [0, 2])).toMatchObject({
      heroId: 'special-f171',
      team: 1,
      lookId: 'f171',
    });
    expect(winningHeadlineHero(ordinary, larry, [2, 0])).toBeUndefined();
  });

  it('uses the named penalty winner for a level Cup score', () => {
    expect(winningHeadlineHero(ordinary, larry, [1, 1], 1)).toMatchObject({
      heroId: 'special-f171',
      team: 1,
    });
    expect(winningHeadlineHero(ordinary, larry, [1, 1], 0)).toBeUndefined();
  });

  it('does not turn an ordinary league draw into a celebration', () => {
    expect(winningHeadlineHero(ordinary, larry, [1, 1])).toBeUndefined();
  });

  it('cannot leave the result handoff frozen by a full-time pause', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/render/MatchScreen.tsx'),
      'utf8',
    );
    expect(source).toContain(
      "if (pausedRef.current && s.phase !== 'fulltime') {",
    );
  });

  it('hides the centred winner from old pitch overlays', () => {
    const match = readFileSync(
      join(process.cwd(), 'src/render/MatchScreen.tsx'),
      'utf8',
    );
    const overlays = readFileSync(
      join(process.cwd(), 'src/render/WorkletMatchOverlays.tsx'),
      'utf8',
    );
    expect(match).toContain('hiddenPlayer={victoryHeroMatchIndex}');
    expect(match).toContain('effect.sourcePlayer !== victoryHeroMatchIndex');
    expect(overlays).toContain('index === hiddenPlayer');
    expect(overlays).toContain('player === hiddenPlayer');
  });
});
