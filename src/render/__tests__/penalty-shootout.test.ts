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
    expect(constant('PENALTY_KICK_MS')).toBeGreaterThanOrEqual(650);
    expect(constant('PENALTY_KICK_MS')).toBeLessThanOrEqual(800);
    expect(constant('PENALTY_OUTCOME_MS')).toBeLessThan(
      constant('PENALTY_KICK_MS'),
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
    expect(screen).toContainSource('buildSpriteAtlas(Skia, visualIds)');
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
