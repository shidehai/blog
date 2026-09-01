import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

export default {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "var(--font-sans)",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "PingFang SC",
          "Hiragino Sans GB",
          "Microsoft YaHei",
          "sans-serif",
        ],
        mono: [
          "var(--font-mono)",
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      colors: {
        beige: {
          50: "#fdfbf7",
          100: "#fbf8f2",
          200: "#f5eee1",
          300: "#ebe1ce",
          400: "#dfcfb6",
          500: "#cfb997",
        },
        ink: {
          900: "#1c1917",
          800: "#292524",
          700: "#44403c",
          600: "#57534e",
          500: "#78716c",
          400: "#a8a29e",
          300: "#d6d3d1",
          200: "#e7e5e4",
          100: "#f5f5f4",
          50: "#fafaf9",
        },
        accent: {
          DEFAULT: "#c2410c",
          hover: "#ea580c",
          muted: "#9a3412",
        },
      },
    },
  },
  plugins: [typography],
} satisfies Config;
