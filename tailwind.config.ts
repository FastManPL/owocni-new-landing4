import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  
  // === FUTURE FLAGS ===
  future: {
    // Hover tylko na urządzeniach z prawdziwym kursorem
    // Eliminuje "sticky hover" na iOS/Android po tap
    hoverOnlyWhenSupported: true,
  },

  theme: {
    extend: {
      colors: {
        canvas: '#f7f6f4',
      },
      fontFamily: {
        brand: [
          'var(--font-brand)',
          'Arial',
          'ui-sans-serif',
          'system-ui',
          'sans-serif',
        ],
        sans: [
          'Arial',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'sans-serif',
        ],
        serif: [
          'var(--font-serif)',
          'Georgia',
          'Cambria',
          'ui-serif',
          'serif',
        ],
        mono: [
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'Liberation Mono',
          'Courier New',
          'monospace',
        ],
      },
    },
  },
  plugins: [],
};

export default config;
