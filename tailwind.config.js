/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./App.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // --- pixel-art bible palette (docs/11-art-style.md) ---
        // shared neutrals
        ink: '#241f2e',
        'ink-soft': '#3a3350',
        paper: '#f4f1ea',
        'paper-dark': '#d9d3e0',
        cream: '#f4f1ea',
        // core families — each has -dark (shadow/lip), base, -light (highlight)
        red: '#d94f52',
        'red-dark': '#a83440',
        'red-light': '#f2938c',
        blue: '#5a8fd6',
        'blue-dark': '#3f6fb5',
        'blue-light': '#a3c8f0',
        gold: '#edb54a',
        'gold-dark': '#c8862a',
        'gold-light': '#f7d894',
        grey: '#9a95a4',
        'grey-dark': '#6b6675',
        'grey-light': '#c9c5d0',
        'story-dark': '#7a5a8d',
        'story-light': '#dfcfee',
        pitch: '#5cb85c',
        'pitch-dark': '#3f8a4a',
        'pitch-light': '#8fd98f',
        // AA-safe semantic green for text and dark UI stages. Keep pitch-dark
        // as the authored turf shadow; it is not dark enough for small copy.
        'pitch-ink': '#265b30',
        // --- legacy semantic aliases (kept so existing screens keep working,
        //     now pointing at the bible hues) ---
        signal: '#edb54a', // gold — hero/reward + primary CTA
        stamp: '#d94f52', // red — cancel / danger / negative
        sky: '#a3c8f0', // light blue — eyebrows / accents on dark
      },
      fontFamily: {
        // Resolved at runtime from the `vars()` call at the app root, so the
        // language picker swaps the face live without touching the hundreds of
        // `font-pixel` / `font-mono` call sites. Faces are loaded in App.tsx.
        //
        // One family for all seven languages: `HFMSilkscreen` is stock
        // Silkscreen with 102 Vietnamese letters appended (see
        // docs/superpowers/specs/2026-08-06-vietnamese-pixel-diacritics.md).
        // Verified against react-native-css-interop 0.2.6:
        // `font-family` is in `validProperties`
        // (css-to-rn/parseDeclaration.ts:174), so a `var()` value arrives as an
        // unparsed declaration, routes through `parseUnparsed` to a runtime var
        // descriptor, and is resolved by runtime/native/resolve-value.ts
        // against the variables `vars()` injected. This works on native, not
        // only on web.
        //
        // The fallbacks are what the variables resolve to before the provider
        // mounts, and what a non-NativeWind consumer would see.
        mono: ['var(--font-data, HFMSilkscreen_400Regular)'],
        pixel: ['var(--font-display, HFMSilkscreen_700Bold)'],
      },
    },
  },
  plugins: [],
};
