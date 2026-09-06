import { useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { SpinningIcon } from "./ui";
import { colors, radius, spacing } from "../lib/theme";
import { errorMessage } from "../lib/api";
import { isAppleSignInAvailable } from "../lib/appleAuth";
import { useAuth } from "../lib/auth";

/**
 * The Sign in with Apple button, on the two screens that offer a way in.
 *
 * ─── Why it is drawn here rather than Apple's own component ──────────────
 *
 * `AppleAuthenticationButton` renders itself natively: its own typeface,
 * weight and fill, none of which can be changed. Beside the Google button it
 * read as a control borrowed from another app, which is exactly what it was.
 * Apple permit a custom button provided it carries their mark and one of
 * their three approved titles — "Sign in with", "Sign up with" or "Continue
 * with Apple" — so the wording below is theirs and only the dressing is ours.
 *
 * The cost of drawing it is the label no longer translates itself. Every
 * other word on these screens is English, so nothing is lost today; it is
 * worth remembering on the day the app is not.
 *
 * `signUp` picks which of the two titles to use. A sign-up page offering to
 * sign you in reads as the wrong page.
 *
 * ─── Why it renders nothing off iOS ──────────────────────────────────────
 *
 * There is nothing behind it on Android, and offering a button that cannot
 * work is worse than offering none.
 */
const AppleSignInButton = ({ onError, signUp = false }) => {
  const { signInWithApple } = useAuth();
  const [busy, setBusy] = useState(false);

  if (!isAppleSignInAvailable) return null;

  const handlePress = async () => {
    setBusy(true);
    onError?.("");

    try {
      const user = await signInWithApple();

      /**
       * On success the auth gate replaces this screen, so the spinner is
       * left running rather than flashing an idle button on the way out.
       * Dismissing Apple's sheet returns nothing and is not an error — but
       * nothing replaces the screen either, so the button must reset itself.
       */
      if (!user) setBusy(false);
    } catch (err) {
      onError?.(errorMessage(err, "Could not sign in with Apple"));
      setBusy(false);
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={busy}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.pressed,
        busy && styles.busy,
      ]}
      accessibilityRole="button"
      accessibilityLabel={signUp ? "Sign up with Apple" : "Sign in with Apple"}
    >
      {busy ? (
        <>
          <SpinningIcon name="musical-notes" size={16} color={colors.text} />
          <Text style={styles.label}>
            {signUp ? "Signing up..." : "Signing in..."}
          </Text>
        </>
      ) : (
        <>
          {/* Nudged up a point: the mark sits optically low against text. */}
          <Ionicons
            name="logo-apple"
            size={18}
            color={colors.text}
            style={styles.mark}
          />
          <Text style={styles.label}>
            {signUp ? "Sign up with Apple" : "Sign in with Apple"}
          </Text>
        </>
      )}
    </Pressable>
  );
};

/** Deliberately the same shape as the Google button it sits above. */
const styles = StyleSheet.create({
  button: {
    height: 54,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  pressed: {
    backgroundColor: colors.surfaceRaised,
  },
  busy: {
    opacity: 0.6,
  },
  mark: {
    marginTop: -2,
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
});

export default AppleSignInButton;
