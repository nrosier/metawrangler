/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["IBM Plex Sans", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },
      colors: {
        surface: "#f4f6f8",
        border: "#d1d5db",
        muted: "#6b7280",
        accent: "#1d4ed8",
        danger: "#dc2626",
        success: "#16a34a",
        warning: "#d97706",
      },
    },
  },
  plugins: [],
};
