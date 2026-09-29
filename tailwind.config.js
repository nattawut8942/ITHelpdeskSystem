/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      keyframes: {
        'modal-pop': {
          '0%': { opacity: '0', transform: 'scale(0.95) translateY(15px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        'fade': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        'modal-pop': 'modal-pop 0.4s ease-out forwards',
        'fade': 'fade 0.4s ease-out forwards',
      }
    },
  },
  plugins: [],
}
