import { readFileSync } from 'fs';
import { join } from 'path';
import {
  RIVAL_HERO_POWER_EXIT_MS,
  RIVAL_HERO_POWER_HOLD_MS,
  RIVAL_HERO_POWER_INTRO_MS,
  advanceRivalHeroIntroPhase,
  rivalHeroPowerAutoExitMs,
} from '../rival-hero-intro-sequence';
import {
  RIVAL_HERO_LANDSCAPE_COMPOSITION,
  RIVAL_HERO_PORTRAIT_COMPOSITION,
  rivalHeroSceneComposition,
} from '../rival-hero-intro-layout';

describe('rival hero intro sequence', () => {
  it('keeps the power readable before speech and consumes rapid exit taps', () => {
    expect(RIVAL_HERO_POWER_INTRO_MS).toBe(240);
    expect(RIVAL_HERO_POWER_HOLD_MS).toBe(1400);
    expect(RIVAL_HERO_POWER_EXIT_MS).toBe(300);
    expect(advanceRivalHeroIntroPhase('power')).toBe('power-exit');
    expect(advanceRivalHeroIntroPhase('power-exit')).toBe('power-exit');
    expect(advanceRivalHeroIntroPhase('speech')).toBe('done');
  });

  it('never times out before screen-reader state is known or while suspended', () => {
    expect(rivalHeroPowerAutoExitMs(null, true)).toBeUndefined();
    expect(rivalHeroPowerAutoExitMs(true, true)).toBeUndefined();
    expect(rivalHeroPowerAutoExitMs(false, false)).toBeUndefined();
    expect(rivalHeroPowerAutoExitMs(false, true)).toBe(
      RIVAL_HERO_POWER_INTRO_MS + RIVAL_HERO_POWER_HOLD_MS,
    );
  });

  it('uses the five production backdrops, canonical sprite/card/bubble, and persistent banner', () => {
    const screen = readFileSync(
      join(process.cwd(), 'src/ui/RivalHeroIntroScreen.tsx'),
      'utf8',
    );
    for (const asset of [
      'barry-allan.png',
      'scott-somers.png',
      'steve-rodgers.png',
      'bruno-bannor.png',
      'bruce-wain.png',
    ])
      expect(screen).toContain(asset);
    expect(screen).toContain('<PlayerRunSprite');
    expect(screen).toContain('<PowerTitleTakeover');
    expect(screen).toContain('<CharacterSpeechOverlay');
    expect(screen).toContain('{viewModel.title}');
    expect(screen).toContain("backgroundColor: '#000000'");
    expect(screen).toContain("imageRendering: 'pixelated'");
    expect(screen).toContain('screenReaderEnabled');
    expect(screen).toContain("phaseRef.current = 'power'");
  });

  it('uses shared zoomed-out portrait and landscape stage marks for every rival', () => {
    expect(RIVAL_HERO_PORTRAIT_COMPOSITION).toEqual({
      backdropZoom: 1.08,
      backdropAnchorX: 0.5,
      backdropAnchorY: 1,
      heroX: 0.5,
      heroY: 0.88,
    });
    expect(RIVAL_HERO_LANDSCAPE_COMPOSITION).toEqual({
      backdropZoom: 1.35,
      backdropAnchorX: 0.5,
      backdropAnchorY: 1,
      heroX: 0.5,
      heroY: 0.88,
    });
    expect(rivalHeroSceneComposition(320, 568)).toBe(
      RIVAL_HERO_PORTRAIT_COMPOSITION,
    );
    expect(rivalHeroSceneComposition(844, 390)).toBe(
      RIVAL_HERO_LANDSCAPE_COMPOSITION,
    );
  });
});
