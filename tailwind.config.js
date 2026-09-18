/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // LalitLifts iron palette
        iron: "#111318",
        steel: "#1B1F26",
        steel2: "#242932",
        chalk: "#EDEAE2",
        knurl: "#9BA1AC",
        dim: "#6B7280",
        brass: "#C9A24B",
        // brand red (also override Tailwind's `red-600` used by the app)
        red: {
          500: "#C8102E",
          600: "#C8102E",
          700: "#8E1024",
        },
        line: "#313742",
      },
      fontFamily: {
        display: ["'Archivo Black'", "sans-serif"],
        sans: ["'Barlow'", "system-ui", "sans-serif"],
        cond: ["'Barlow Semi Condensed'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography')
  ],
}
