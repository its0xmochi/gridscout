import type { Config } from "tailwindcss";

export default {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        dark: {
          900: "#0b0e14",
          850: "#0f131a",
          800: "#151b26",
          750: "#1a2230",
          700: "#222d40",
          600: "#32415c",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
