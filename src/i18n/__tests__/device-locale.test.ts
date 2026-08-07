import { AUTO_LOCALES, matchDeviceLocale } from '../device-locale';
import { ENABLED_LOCALES } from '../locales';

describe('matchDeviceLocale', () => {
  test('takes the language subtag, so a region never costs a player their language', () => {
    // A device reports where it is as well as what it speaks. Everyone who
    // speaks Spanish gets the one Spanish catalog this game ships.
    expect(matchDeviceLocale(['es-MX'])).toBe('es');
    expect(matchDeviceLocale(['es-419'])).toBe('es');
    expect(matchDeviceLocale(['fr-CA'])).toBe('fr');
    expect(matchDeviceLocale(['de-AT'])).toBe('de');
    expect(matchDeviceLocale(['en-GB'])).toBe('en');
  });

  test('European Portuguese gets the Brazilian catalog', () => {
    // Not ideal, and deliberate: the game has one Portuguese. A Lisbon player
    // reading Brazilian phrasing is closer to right than reading English.
    expect(matchDeviceLocale(['pt-PT'])).toBe('pt-BR');
    expect(matchDeviceLocale(['pt-BR'])).toBe('pt-BR');
    expect(matchDeviceLocale(['pt'])).toBe('pt-BR');
  });

  test('accepts Indonesian under its retired code', () => {
    // iOS says `id`; Java and older Android still emit `in`.
    expect(matchDeviceLocale(['id-ID'])).toBe('id');
    expect(matchDeviceLocale(['in'])).toBe('id');
  });

  test('honours the device order, so a second choice is still a choice', () => {
    // A phone set to Catalan first and Spanish second should open in Spanish,
    // not English — the player named Spanish themselves.
    expect(matchDeviceLocale(['ca-ES', 'es-ES', 'en-GB'])).toBe('es');
  });

  test('returns undefined when nothing matches, rather than guessing', () => {
    expect(matchDeviceLocale(['ja-JP', 'ko-KR'])).toBeUndefined();
    expect(matchDeviceLocale([])).toBeUndefined();
    expect(matchDeviceLocale([''])).toBeUndefined();
  });

  test('auto-selects Vietnamese, now that its face is proven on a device', () => {
    // Held back until the owner — who reads Vietnamese — ran the built font on
    // real hardware and confirmed it. Before that, auto-selecting a face that
    // had only been seen through a rasteriser would have been a guess.
    expect(matchDeviceLocale(['vi-VN'])).toBe('vi');
    expect(AUTO_LOCALES).toContain('vi');
  });

  test('the allow-list is a parameter, so a language can be held back again', () => {
    // The mechanism that held Vietnamese is still here for the next language
    // that ships before it is proven.
    expect(matchDeviceLocale(['vi-VN'], ['en'])).toBeUndefined();
  });

  test('every auto locale is one the game actually ships', () => {
    for (const locale of AUTO_LOCALES) {
      expect({ locale, enabled: ENABLED_LOCALES.includes(locale) })
        .toEqual({ locale, enabled: true });
    }
  });
});
