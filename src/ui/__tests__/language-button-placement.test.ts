import { readFileSync } from 'fs';
import { join } from 'path';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('where the language control lives', () => {
  test('the title screen carries it, because every launch lands there', () => {
    const title = source('src/ui/screens/TitleLandingScreen.tsx');
    expect(title).toContain('<LanguageButton');
    expect(title).toContain('onLanguageChange');
  });

  test('the signing screen does not — it was moved off, not duplicated', () => {
    const creation = source('src/ui/screens/CharacterCreationScreen.tsx');
    expect(creation).not.toContain('Language');
    expect(creation).not.toContain('locale');
  });

  test('Settings still has it, so the choice is changeable mid-career', () => {
    expect(source('src/ui/SettingsOverlay.tsx')).toContain('onCycleLanguage');
  });

  test('the button draws each language in its own face, never the active one', () => {
    const button = source('src/ui/components/LanguageButton.tsx');
    // Silkscreen cannot draw "Tiếng Việt". Rendering the endonyms in whatever
    // face is currently active would show the exact mid-word substitution this
    // feature exists to prevent — on the button that offers the fix.
    expect(button).toContain('fontFamily: current.faces.display');
    expect(button).toContain('fontFamily: row.face');
  });
});
