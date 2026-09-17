/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        linkedin: {
          blue: '#0a66c2',
          blueHover: '#004182',
          blueLight: '#e8f3fc',
          canvas: '#1b1f23',
          card: '#242b35',
          cardLight: '#2c3440',
          border: '#38434f',
          subtext: '#94a3b8',
          text: '#f1f5f9',
          gold: '#e7a33e',
          goldBg: '#473b1e',
          green: '#057642',
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Courier New', 'monospace'],
      }
    },
  },
  plugins: [],
}
