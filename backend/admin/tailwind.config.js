import preset from '@medusajs/ui-preset';

/** @type {import('tailwindcss').Config} */
export default {
  presets: [preset],
  content: ['./index.html', './src/**/*.{ts,tsx}', './node_modules/@medusajs/ui/dist/**/*.js'],
  darkMode: 'class',
};
