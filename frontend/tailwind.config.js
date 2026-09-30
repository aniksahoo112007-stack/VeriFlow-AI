/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0d1a16",
        forest: "#123e32",
        mint: "#72e0b7",
        cream: "#f4f7f3",
        line: "#dce6e1",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui"],
        display: ["Manrope", "Inter", "sans-serif"],
      },
      boxShadow: { soft: "0 18px 50px rgba(14, 45, 36, .08)" },
    },
  },
  plugins: [],
};
