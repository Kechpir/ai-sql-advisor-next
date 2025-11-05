/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./styles/**/*.{css,scss}"
  ],
  theme: {
    extend: {
      colors: {
        neon: "#00ffff",
        darkblue: "#0B1221",
        steelblue: "#233861"
      },
    },
  },
  plugins: [],
};
