import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#1d6b57',
        warning: '#aa5a22',
        danger: '#9a2f2f',
        panel: '#f5efe6',
        ink: '#17212a',
        muted: '#6b7780',
      },
    },
  },
  plugins: [],
};

export default config;