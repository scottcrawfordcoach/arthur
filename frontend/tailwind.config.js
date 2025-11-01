/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        mint: {
          50: '#f0fdf9',
          100: '#ccfbef',
          200: '#99f6e0',
          300: '#5fe9d0',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        },
        pastel: {
          blue: '#E0F4FF',
          mint: '#E8FAF6',
          cream: '#FFF9F0',
          lavender: '#F3F0FF',
          peach: '#FFE8E0',
        }
      }
    },
  },
  plugins: [],
}
