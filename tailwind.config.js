/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        ink: '#101924',
        'ink-soft': '#1b2a38',
        paper: '#f4edda',
        'paper-dark': '#d9cfb6',
        signal: '#f6cd3c',
        stamp: '#d94b42',
        pitch: '#49a56f',
        sky: '#9ed3df',
      },
    },
  },
  plugins: [],
};
