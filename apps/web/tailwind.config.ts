import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "answer-triangle": "#e21b3c",
        "answer-diamond": "#1368ce",
        "answer-circle": "#d89e00",
        "answer-square": "#26890c",
        "game-bg": "#2d1b69",
        "game-surface": "#46178f",
      },
    },
  },
  plugins: [],
} satisfies Config;
