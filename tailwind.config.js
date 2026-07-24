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
        pitch: '#5cb85c',
        'pitch-dark': '#3f8a4a',
        'pitch-light': '#8fd98f',
        // --- legacy semantic aliases (kept so existing screens keep working,
        //     now pointing at the bible hues) ---
        signal: '#edb54a', // gold — hero/reward + primary CTA
        stamp: '#d94f52', // red — cancel / danger / negative
        sky: '#a3c8f0', // light blue — eyebrows / accents on dark
      },
      fontFamily: {
        // Silkscreen bitmap pixel font — the game's display/label voice.
        // Loaded at runtime in App.tsx via @expo-google-fonts/silkscreen.
        mono: ['Silkscreen_400Regular'],
        pixel: ['Silkscreen_700Bold'],
      },
    },
  },
  plugins: [],
};
