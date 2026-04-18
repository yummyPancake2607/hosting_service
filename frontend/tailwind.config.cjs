/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        base: "#000000",
        panel: "#071108",
        neon: "#00ff88",
        neonSoft: "#12b76a",
        danger: "#ff3864",
        warning: "#ffb020",
      },
      boxShadow: {
        neon: "0 0 0 1px rgba(0,255,136,0.35), 0 0 25px rgba(0,255,136,0.2)",
      },
      keyframes: {
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(0,255,136,0.3)" },
          "50%": { boxShadow: "0 0 0 12px rgba(0,255,136,0)" },
        },
      },
      animation: {
        pulseGlow: "pulseGlow 2s infinite",
      },
    },
  },
  plugins: [],
};
