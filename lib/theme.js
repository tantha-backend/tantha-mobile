/**
 * Visual language shared with the admin dashboard: near-black surfaces with a
 * pink accent, so both halves of Tantha feel like one product.
 */

import { Platform } from "react-native";

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

/**
 * Height of the mini player, so scroll views can pad past it.
 *
 * Android gets a taller bar. The same 64 that sits comfortably under an iOS
 * home indicator reads as cramped above Android's navigation bar, which is
 * itself taller and sits closer to the card — and on the gesture-nav phones
 * this is mostly running on, the bar has to survive being brushed past rather
 * than tapped precisely. Every scroll view pads by this constant, so raising
 * it moves the whole layout with it.
 */
export const MINI_PLAYER_HEIGHT = Platform.OS === "android" ? 74 : 64;

/** Cover art inside the mini player, kept in step with the height above. */
export const MINI_PLAYER_ART = Platform.OS === "android" ? 54 : 44;

/**
 * Height of the tab bar, excluding the safe area beneath it.
 *
 * Lives here rather than in the tabs layout because the mini player is
 * mounted at the root — it has to clear the tab bar on a tab screen and sit
 * on the bottom edge everywhere else, so both layouts need the number.
 */
export const TAB_BAR_HEIGHT = 62;
