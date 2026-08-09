import { readFileSync } from 'fs';
import { join } from 'path';

const source = (path: string) =>
  readFileSync(join(process.cwd(), path), 'utf8');

describe('AUD-020 and AUD-021 regression contracts', () => {
  it('clips the shared walk-on visual layer without shrinking its screen input', () => {
    const overlay = source('src/ui/CharacterSpeechOverlay.tsx');

    expect(overlay).toContain(
      'style={[StyleSheet.absoluteFill, styles.visualViewport]}',
    );
    expect(overlay).toContain('testID="character-speech-visual-viewport"');
    expect(overlay).toContain("visualViewport: { overflow: 'hidden' }");
    expect(overlay).toContain('style={StyleSheet.absoluteFill}');
    expect(overlay.indexOf('style={StyleSheet.absoluteFill}')).toBeLessThan(
      overlay.indexOf('styles.visualViewport'),
    );
  });

  it('gives podium Skip an explicit 44-by-44-point action', () => {
    const podium = source('src/ui/screens/SeasonPodiumScreen.tsx');
    const skipStyle = podium.slice(
      podium.indexOf('skipButton: {'),
      podium.indexOf('content: {'),
    );

    expect(skipStyle).toContain('minWidth: 44');
    expect(skipStyle).toContain('minHeight: 44');
    expect(skipStyle).toContain("alignItems: 'center'");
    expect(skipStyle).toContain("justifyContent: 'center'");
  });
});
