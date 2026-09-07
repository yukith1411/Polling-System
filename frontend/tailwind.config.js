/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#dbe6fe",
          500: "#4f6ef7",
          600: "#3b56e0",
          700: "#2f43b3",
        },
      },
    },
  },
  plugins: [],
};
