import { readFileSync } from 'fs';
import { join } from 'path';
import { LONG_MESSAGE_MS } from '../../render/bert-voice';
import {
  RIVAL_HERO_LAUGH_DELAY_MS,
  RIVAL_HERO_POWER_EXIT_MS,
  RIVAL_HERO_POWER_HOLD_MS,
  RIVAL_HERO_POWER_INTRO_MS,
  RIVAL_HERO_SPEECH_HOLD_MS,
  advanceRivalHeroIntroPhase,
  rivalHeroLaughStartMs,
  rivalHeroPowerAutoExitMs,
  rivalHeroScreenReaderTimingState,
  rivalHeroSpeechAutoExitMs,
} from '../rival-hero-intro-sequence';
import {
  RIVAL_HERO_LANDSCAPE_COMPOSITION,
  RIVAL_HERO_PORTRAIT_COMPOSITION,
  rivalHeroSceneComposition,
} from '../rival-hero-intro-layout';

const RIVAL_BACKDROP_FILES = [
  'barry-allan.png',
  'scott-somers.png',
  'steve-rodgers.png',
  'bruno-bannor.png',
  'bruce-wain.png',
] as const;

describe('rival hero intro sequence', () => {
  it('keeps the power readable before speech and consumes rapid exit taps', () => {
    expect(RIVAL_HERO_POWER_INTRO_MS).toBe(240);
    expect(RIVAL_HERO_POWER_HOLD_MS).toBe(2760);
    expect(RIVAL_HERO_POWER_EXIT_MS).toBe(300);
    expect(RIVAL_HERO_SPEECH_HOLD_MS).toBe(3000);
    expect(RIVAL_HERO_LAUGH_DELAY_MS).toBe(1000);
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
    expect(rivalHeroSpeechAutoExitMs(null, true)).toBeUndefined();
    expect(rivalHeroSpeechAutoExitMs(true, true)).toBeUndefined();
    expect(rivalHeroSpeechAutoExitMs(false, false)).toBeUndefined();
    expect(rivalHeroSpeechAutoExitMs(false, true)).toBe(
      RIVAL_HERO_SPEECH_HOLD_MS,
    );
  });

  it('keeps the signed-off automatic timing on web', () => {
    // React Native Web reports `true` unconditionally, so it is not a real
    // screen-reader signal and must not strand every browser on the power card.
    expect(rivalHeroScreenReaderTimingState('web', true, false)).toBe(false);
    expect(rivalHeroScreenReaderTimingState('ios', true, false)).toBe(true);
    expect(rivalHeroScreenReaderTimingState('android', false, false)).toBe(
      false,
    );
    expect(rivalHeroScreenReaderTimingState('ios', null, false)).toBeNull();
  });

  it('uses Reduce Motion as the web non-timed accessibility route', () => {
    expect(rivalHeroScreenReaderTimingState('web', true, true)).toBe(true);
    expect(rivalHeroPowerAutoExitMs(true, true)).toBeUndefined();
    expect(rivalHeroSpeechAutoExitMs(true, true)).toBeUndefined();
  });

  it('starts every possible Bert-length laugh before the fixed speech cut', () => {
    expect(rivalHeroLaughStartMs(LONG_MESSAGE_MS)).toBe(2900);
    expect(rivalHeroLaughStartMs(LONG_MESSAGE_MS)).toBeLessThan(
      RIVAL_HERO_SPEECH_HOLD_MS,
    );
  });

  it('uses the five production backdrops, canonical sprite/card/bubble, and persistent banner', () => {
    const screen = readFileSync(
      join(process.cwd(), 'src/ui/RivalHeroIntroScreen.tsx'),
      'utf8',
    );
    for (const asset of RIVAL_BACKDROP_FILES) expect(screen).toContain(asset);
    expect(screen).toContain('<RivalHeroPowerShowcase');
    expect(screen).toContain('<PowerTitleTakeover');
    expect(screen).toContain('<CharacterSpeechOverlay');
    expect(screen).toContain('showPlayerName={false}');
    expect(screen).toContain('testID="rival-hero-power-tap-target"');
    expect(screen).toContain('autoAdvanceMs={speechAutoExitMs}');
    expect(screen).toContain('{viewModel.title}');
    expect(screen).toContain("backgroundColor: '#000000'");
    expect(screen).toContain('<SkiaImage');
    expect(screen).toContain('sampling={PIXEL_ART_SAMPLING}');
    expect(screen).toContain('screenReaderEnabled');
    expect(screen).toContain("phaseRef.current = 'power'");
  });

  it('ships every rival backdrop as a budgeted indexed PNG', () => {
    for (const asset of RIVAL_BACKDROP_FILES) {
      const png = readFileSync(
        join(process.cwd(), 'assets/images/rival-hero-intros', asset),
      );
      expect(png.subarray(1, 4).toString('ascii')).toBe('PNG');
      expect(png[24]).toBe(8);
      expect(png[25]).toBe(3);
      const paletteChunk = png.indexOf(Buffer.from('PLTE'));
      expect(paletteChunk).toBeGreaterThan(3);
      const paletteBytes = png.readUInt32BE(paletteChunk - 4);
      expect(paletteBytes % 3).toBe(0);
      expect(paletteBytes / 3).toBeLessThanOrEqual(16);
    }
  });

  it('stages all five authored power actions before the speech beat', () => {
    const showcase = readFileSync(
      join(process.cwd(), 'src/ui/RivalHeroPowerShowcase.tsx'),
      'utf8',
    );
    for (const target of ['console', 'coach', 'impact-block', 'teddy']) {
      expect(showcase).toContain(target);
    }
    for (const heroId of [
      'special-f171',
      'special-f178',
      'special-f174',
      'special-f176',
      'special-f168',
    ]) {
      expect(showcase).toContain(heroId);
    }
    expect(showcase).toContain('<PowerEffectScene');
    expect(showcase).toContain('walking={heroWalking}');
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
