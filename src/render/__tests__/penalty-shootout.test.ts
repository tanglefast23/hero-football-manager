import { readFileSync } from 'fs';
import { join } from 'path';

const source = (path: string) =>
  readFileSync(join(process.cwd(), path), 'utf8');

describe('penalty shootout screen contract', () => {
  const screen = source('src/render/PenaltyShootout.tsx');
  const constant = (name: string) =>
    Number(
      screen
        .match(new RegExp(`export const ${name} = ([0-9_]+);`))?.[1]
        .replaceAll('_', ''),
    );

  it('keeps each kick readable without turning the sequence into a long cutscene', () => {
    // Halved from 720 in 2026-08: every kick reuses the same three sprites at
    // the same three points, so the old pace read as one blur of penalties.
    expect(constant('PENALTY_KICK_MS')).toBeGreaterThanOrEqual(1300);
    expect(constant('PENALTY_KICK_MS')).toBeLessThanOrEqual(1600);
    expect(constant('PENALTY_OUTCOME_MS')).toBeLessThan(
      constant('PENALTY_KICK_MS'),
    );
  });

  it('dresses each side in its own kit and shoots from its own end', () => {
    // Both prefixes were a hardcoded `r`, so the shooter and the keeper facing
    // him wore the same red shirt through the whole shootout.
    expect(screen).toContainSource(
      "`${isHomeSide ? 'r' : 'u'}:${playerLookId(",
    );
    // The keeper takes the opposite kit, so he can never share the shooter's
    // shirt, and the club wears whatever it wore on the pitch.
    expect(screen).toContainSource(
      'visualId(item.goalkeeper, !isHome(item.shootingSide))',
    );
    expect(screen).toContainSource(
      "side === 'club' ? shootout.clubIsHome : !shootout.clubIsHome",
    );
    expect(screen).toContainSource(
      "shootingEnd.value = kick.shootingSide === 'club' ? 1 : -1;",
    );
    expect(screen).toContainSource(
      'const shooterX = end === 1 ? g.clubShooterX : g.opponentShooterX;',
    );
  });

  it('shows the score, club names, outcome words, and persistent kick markers', () => {
    expect(screen).toContainSource("t('penaltyShootout.title')");
    expect(screen).toContainSource("'penaltyShootout.score'");
    expect(screen).toContainSource("'penaltyShootout.miss'");
    expect(screen).toContainSource('shownClubScore');
    expect(screen).toContainSource('shownOpponentScore');
    expect(screen).toContainSource('markerScore');
    expect(screen).toContainSource('markerMiss');
  });

  it('uses one full-screen skip target and completes only once', () => {
    expect(screen.match(/<Pressable/g)).toHaveLength(1);
    expect(screen).toContainSource('if (finished.current) return;');
    expect(screen).toContainSource('onPress={finishOnce}');
  });

  it('renders final values under Reduce Motion and stops every timer and sound', () => {
    expect(constant('PENALTY_REDUCED_MOTION_MS')).toBeGreaterThan(0);
    expect(screen).toContainSource('setRevealedCount(shootout.kicks.length)');
    expect(screen).toContainSource('useFrameCallback(onFrame, !reduceMotion)');
    expect(screen).toContainSource('timers.forEach(clearTimeout)');
    expect(screen).toContainSource('teardownAudio()');
  });

  it('batches the two players and ball through the pixel-sampled Atlas', () => {
    // The palette override carries the pitch's kit setting onto this screen:
    // color-safe kits default to ON, so a match played in amber used to finish
    // in red here.
    expect(screen).toContainSource('matchKitPaletteOverride(colorSafeKits)');
    expect(screen).toContainSource('buildFallbackAtlas(Skia, FALLBACK_SPRITE)');
    expect(screen).toContainSource('<Atlas');
    expect(screen).toContainSource('sampling={PIXEL_ART_SAMPLING}');
  });

  it('is deferred with the other Skia surfaces on web', () => {
    const deferred = source('src/ui/DeferredSkiaSurfaces.web.tsx');
    expect(deferred).toContainSource('const DeferredPenaltyShootout = lazy');
    expect(deferred).toContainSource('await loadSkia()');
    expect(deferred).toContainSource('<DeferredPenaltyShootout {...props} />');
  });
});
