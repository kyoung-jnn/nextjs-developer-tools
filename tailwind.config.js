/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{ts,tsx,js,jsx,html}"],
  theme: {
    extend: {
      fontFamily: {
        mono: ["Menlo", "Monaco", "Consolas", "monospace"],
        sans: ["Segoe UI", "Roboto", "Helvetica Neue", "sans-serif"],
      },
      colors: {
        // DevTools dark theme colors
        devtools: {
          bg: {
            primary: "#202124",
            secondary: "#292a2d",
            tertiary: "#35363a",
            hover: "#3c4043",
            selected: "#394457",
          },
          text: {
            primary: "#e8eaed",
            secondary: "#9aa0a6",
            muted: "#5f6368",
          },
          border: "#3c4043",
          accent: {
            blue: "#8ab4f8",
            purple: "#c58af9",
            green: "#81c995",
            orange: "#fcad70",
            red: "#f28b82",
          },
        },
      },
      fontSize: {
        "2xs": "10px",
        xs: "11px",
        sm: "12px",
      },
      animation: {
        spin: "spin 1s linear infinite",
      },
    },
  },
  plugins: [],
};
