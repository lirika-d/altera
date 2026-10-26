/** @type {import('tailwindcss').Config} */

function withOpacity(variableName) {
  return ({ opacityValue }) => {
    if (opacityValue !== undefined) {
      return `color-mix(in srgb, var(${variableName}) calc(${opacityValue} * 100%), transparent)`
    }
    return `var(${variableName})`
  }
}

export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'bg-base': withOpacity('--bg-base'),
        'bg-surface': withOpacity('--bg-surface'),
        'bg-elevated': withOpacity('--bg-elevated'),
        'bg-hover': withOpacity('--bg-hover'),
        border: withOpacity('--border'),
        'border-subtle': withOpacity('--border-subtle'),
        'text-primary': withOpacity('--text-primary'),
        'text-secondary': withOpacity('--text-secondary'),
        'text-muted': withOpacity('--text-muted'),

        // Stitch Olive / Sage Editorial palette
        'accent-olive': withOpacity('--accent-olive'),
        'accent-sage': withOpacity('--accent-sage'),
        'accent-sage-dim': withOpacity('--accent-sage-dim'),

        // Compatibility aliases with new warm tones
        'accent-blue': withOpacity('--accent-blue'),
        'accent-purple': withOpacity('--accent-purple'),
        'accent-green': withOpacity('--accent-green'),
        'accent-amber': withOpacity('--accent-amber'),
        'accent-red': withOpacity('--accent-red'),
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        serif: ['Lora', 'Playfair Display', 'Georgia', 'serif'],
        display: ['Playfair Display', 'Lora', 'Georgia', 'serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      letterSpacing: {
        section: '0.12em',
      },
    },
  },
  plugins: [],
}
