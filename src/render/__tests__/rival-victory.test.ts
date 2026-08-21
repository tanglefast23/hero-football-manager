import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('full-time rival presentation', () => {
  const match = () =>
    readFileSync(join(process.cwd(), 'src/render/MatchScreen.tsx'), 'utf8');

  it('does not show, animate, sound, or hold for a giant rival hero', () => {
    const source = match();
    expect(source).not.toContain('RivalHeroVictorySprite');
    expect(source).not.toContain('victoryHero');
    expect(source).not.toContain('FULLTIME_RIVAL_VICTORY');
    expect(source).not.toContain('playRivalHeroLaugh');
    expect(source).toContain(
      'reduceMotion && !wastedPowerPending ? 0 : FULLTIME_HOLD_MS',
    );
  });

  it('cannot leave the result handoff frozen by a full-time pause', () => {
    const source = match();
    expect(source).toContain(
      "if (pausedRef.current && s.phase !== 'fulltime') {",
    );
  });
});
