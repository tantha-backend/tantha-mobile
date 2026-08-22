/**
 * Visual language shared with the admin dashboard: near-black surfaces with a
 * pink accent, so both halves of Tantha feel like one product.
 */
export const colors = {
  bg: "#000000",
  surface: "#0a0a0a",
  surfaceRaised: "#141414",
  border: "rgba(255,255,255,0.08)",
  borderStrong: "rgba(255,255,255,0.16)",

  accent: "#E41C43",
  accentDim: "rgba(228,28,67,0.15)",

  text: "#ffffff",
  textMuted: "rgba(255,255,255,0.6)",
  textFaint: "rgba(255,255,255,0.38)",

  success: "#22c55e",
  danger: "#ef4444",
  warning: "#f59e0b",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
};

export const type = {
  title: { fontSize: 28, fontWeight: "700", color: colors.text },
  heading: { fontSize: 20, fontWeight: "700", color: colors.text },
  subheading: { fontSize: 16, fontWeight: "600", color: colors.text },
  body: { fontSize: 14, color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
  caption: { fontSize: 12, color: colors.textFaint },
};

// Height of the mini player, so scroll views can pad past it.
export const MINI_PLAYER_HEIGHT = 64;
