/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ['"Plus Jakarta Sans"', "Inter", "system-ui", "sans-serif"],
        head: ["Manrope", "Inter", "system-ui", "sans-serif"],
      },
      colors: {
        canvas: "#F7F6F3",
        ink: {
          950: "#0A0F24",
          900: "#10173A",
          800: "#1A2350",
          700: "#2A3466",
          600: "#4A5285",
          500: "#6B7194",
          400: "#9A9EB8",
          300: "#C6C9D8",
          200: "#E3E4EC",
          100: "#F0F1F6",
        },
        brand: {
          50: "#EEF0FF",
          100: "#E0E3FF",
          200: "#C5CAFE",
          300: "#A3A9FB",
          400: "#7F83F5",
          500: "#6366F1",
          600: "#4F46E5",
          700: "#4338CA",
          800: "#3730A3",
          900: "#312E81",
        },
      },
      borderRadius: { xl: "14px", "2xl": "20px" },
      boxShadow: {
        card: "0 1px 2px rgba(16, 23, 58, 0.04), 0 4px 16px -4px rgba(16, 23, 58, 0.08)",
        lift: "0 10px 30px -10px rgba(16, 23, 58, 0.25)",
      },
      keyframes: {
        "fade-up": { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "none" } },
        "pulse-ring": { "0%": { boxShadow: "0 0 0 0 rgba(16,185,129,.5)" }, "100%": { boxShadow: "0 0 0 10px rgba(16,185,129,0)" } },
      },
      animation: {
        "fade-up": "fade-up .35s ease-out both",
        "pulse-ring": "pulse-ring 1.6s ease-out infinite",
      },
    },
  },
  plugins: [],
};
