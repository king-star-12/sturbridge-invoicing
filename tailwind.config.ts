import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        teal: { 50: "#e8f4f1", 100: "#cfe8e1", 600: "#1f8a76", 700: "#1a7a6b", 800: "#155f54", 900: "#0f453d" },
        gold: { 400: "#e0b487", 500: "#d29e68", 600: "#b9834f" },
        ink: { 900: "#2f3237", 700: "#4a4e55", 500: "#6b7078", 300: "#c9ccd1", 100: "#eef0f2", 50: "#f7f8f9" },
      },
      fontFamily: { sans: ["Poppins", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"] },
      boxShadow: { card: "0 1px 2px rgba(20,30,40,.06), 0 4px 16px rgba(20,30,40,.06)" },
    },
  },
  plugins: [],
};
export default config;
