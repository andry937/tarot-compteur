/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      keyframes: {
        // Entrée en fondu depuis le bas ; `both` garde l'état de départ pendant le délai.
        apparition: {
          from: { opacity: "0", transform: "translateY(16px) scale(0.96)" },
          to: { opacity: "1", transform: "none" },
        },
      },
      animation: { apparition: "apparition 0.6s ease-out both" },
    },
  },
  plugins: [],
};
