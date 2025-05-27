module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          light: '#4da6ff',
          DEFAULT: '#0d6efd',
          dark: '#0047b3'
        },
        secondary: {
          light: '#f39e58',
          DEFAULT: '#ed7d2b',
          dark: '#b35c00'
        },
        success: {
          light: '#6fbf73',
          DEFAULT: '#4caf50',
          dark: '#357a38'
        },
        danger: {
          light: '#f6685e',
          DEFAULT: '#f44336',
          dark: '#aa2e25'
        },
        warning: {
          light: '#ffd54f',
          DEFAULT: '#ffc107',
          dark: '#ff8f00'
        },
        info: {
          light: '#64b5f6',
          DEFAULT: '#2196f3',
          dark: '#0d47a1'
        }
      }
    },
  },
  plugins: [],
}