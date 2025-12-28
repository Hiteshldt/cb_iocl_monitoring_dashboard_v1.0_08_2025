/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // IOCL Brand Colors
        'iocl-orange': '#F37022',
        'iocl-orange-dark': '#d65f1a',
        'iocl-blue': '#02164F',
        'iocl-blue-light': '#0a2a7a',
        'iocl-white': '#FEFEFE',
      },
    },
  },
  plugins: [],
}
