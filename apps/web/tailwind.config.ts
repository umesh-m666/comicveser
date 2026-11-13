import type { Config } from "tailwindcss";
const v = (n: string) => `var(--${n})`;
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: v("bg"),
        surface: v("surface"),
        card: v("card"),
        panel: v("panel"),
        primary: v("primary"),
        secondary: v("secondary"),
        fg: v("fg"),
        muted: v("muted"),
        line: v("line"),
        success: v("success"),
        danger: v("danger"),
      },
      fontFamily: {
        sans: ["Poppins", "Inter", "system-ui", "sans-serif"],
        ui: ["Inter", "system-ui", "sans-serif"],
        serif: ["Georgia", "serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
