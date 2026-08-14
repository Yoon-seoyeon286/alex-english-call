/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#08090C',
          900: '#0E1015',
          800: '#161922',
          700: '#212533',
          600: '#2E3345',
        },
        accent: {
          DEFAULT: '#5B8CFF',
          soft: '#8FB0FF',
          dim: '#2B4488',
        },
        danger: '#FF5A5F',
        ok: '#3FD08A',
        muted: '#8A90A3',
      },
    },
  },
  plugins: [],
};
