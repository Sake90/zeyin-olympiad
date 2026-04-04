import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        zeyin: {
          bg:     '#06100f',
          card:   '#0c1a19',
          border: '#0f2422',
          teal:   '#1ec8c8',
          teal2:  '#0fa8a8',
          pink:   '#d4145a',
          pink2:  '#e8206e',
          orange: '#f47920',
        },
      },
    },
  },
  plugins: [],
};
export default config;
