/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Markenrot mit Schweizer Anklang — warm, nicht knallig.
        brand: {
          50: '#fef3f2',
          100: '#fee4e2',
          200: '#fecdca',
          300: '#fca9a3',
          400: '#f7776e',
          500: '#ee4d42',
          600: '#db2f24',
          700: '#b8231a',
          800: '#98211a',
          900: '#7e221c',
          950: '#450d09',
        },
        // Warmer Neutralton fürs Papier/Chrome.
        ink: {
          50: '#f7f7f6',
          100: '#eeeeec',
          200: '#d9d9d5',
          300: '#b8b8b1',
          400: '#91918a',
          500: '#74746d',
          600: '#5c5c56',
          700: '#4b4b47',
          800: '#3f3f3c',
          900: '#373735',
          950: '#242422',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      boxShadow: {
        page: '0 1px 2px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.10)',
        'page-active':
          '0 0 0 2px rgb(238 77 66), 0 6px 20px rgba(238,77,66,0.28)',
        panel: '0 1px 0 rgba(0,0,0,0.04), 0 10px 30px rgba(0,0,0,0.08)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'pop-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out both',
        'pop-in': 'pop-in 0.16s cubic-bezier(0.2, 0.8, 0.2, 1) both',
      },
    },
  },
  plugins: [],
}
