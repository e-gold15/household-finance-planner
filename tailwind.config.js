import animate from 'tailwindcss-animate'
import defaultTheme from 'tailwindcss/defaultTheme'

/** Build a { DEFAULT, foreground, strong, subtle } colour triad from CSS vars. */
const triad = (name) => ({
  DEFAULT: `hsl(var(--${name}))`,
  foreground: `hsl(var(--${name}-foreground))`,
  strong: `hsl(var(--${name}-strong))`,
  subtle: `hsl(var(--${name}-subtle))`,
})

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Heebo Variable"', 'Heebo', ...defaultTheme.fontFamily.sans],
      },
      // Type scale (audit §6) maps onto stock Tailwind sizes on purpose —
      // custom `text-*` size names would be dropped by tailwind-merge (`cn`)
      // when combined with a text colour.
      //   display  → text-4xl font-bold tracking-tight   (36/40)
      //   title-1  → text-2xl font-bold                  (24/32)
      //   title-2  → text-lg font-semibold               (18/28)
      //   body     → text-base sm:text-sm                (16 → 14; inputs too)
      //   label    → text-sm font-medium                 (14/20)
      //   caption  → text-xs                             (12/16 — the floor)
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        overlay: 'hsl(var(--overlay))',
        surface: {
          1: 'hsl(var(--card))',
          2: 'hsl(var(--surface-2))',
        },
        primary: triad('primary'),
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        success: triad('success'),
        warning: triad('warning'),
        danger: triad('danger'),
        info: triad('info'),
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        chart: {
          1: 'hsl(var(--chart-1))',
          2: 'hsl(var(--chart-2))',
          3: 'hsl(var(--chart-3))',
          4: 'hsl(var(--chart-4))',
          5: 'hsl(var(--chart-5))',
          6: 'hsl(var(--chart-6))',
          7: 'hsl(var(--chart-7))',
          8: 'hsl(var(--chart-8))',
          9: 'hsl(var(--chart-9))',
          10: 'hsl(var(--chart-10))',
          11: 'hsl(var(--chart-11))',
          neutral: 'hsl(var(--chart-neutral))',
        },
      },
      borderRadius: {
        // Scale: sm 8 (inputs, chips) · md/lg 12 (controls, cards) ·
        // 2xl 16 (hero, banners) · 3xl 24 (bottom-sheet top corners).
        // `lg` stays 12px so the ~54 existing rounded-lg call sites don't shift.
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius)',
        '2xl': 'var(--radius-lg)',
        '3xl': 'var(--radius-xl)',
      },
      transitionDuration: {
        // Also drives tailwindcss-animate `duration-*` (animationDuration).
        fast: '120ms',
        base: '200ms',
        slow: '280ms',
      },
      transitionTimingFunction: {
        standard: 'cubic-bezier(0.32, 0.72, 0, 1)',
      },
      spacing: {
        // Safe-area insets: pb-safe-bottom, pt-safe-top, bottom-safe-bottom …
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
      },
    },
  },
  plugins: [animate],
}
