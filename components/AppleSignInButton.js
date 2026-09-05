import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { SpinningIcon } from "./ui";
import { colors, radius } from "../lib/theme";
import { errorMessage } from "../lib/api";
import { appleModule, isAppleSignInAvailable } from "../lib/appleAuth";
import { useAuth } from "../lib/auth";

/**
 * The Sign in with Apple button, on the two screens that offer a way in.
 *
 * ─── Why it is Apple's own button and not one of ours ────────────────────
 *
 * Apple's guidelines set out how this button may look, and a review is not
 * the moment to find out how strictly that is read. Theirs also translates
 * its own label, which a hand-built one would not.
 *
 * The white style is deliberate against a near-black app: Apple ask for this
 * option to be no less prominent than the others, and a black button on a
 * black screen is the opposite of that.
 *
 * ─── Why it renders nothing off iOS ──────────────────────────────────────
 *
 * There is nothing behind it on Android, and offering a button that cannot
 * work is worse than offering none.
 */
const HEIGHT = 54;

const AppleSignInButton = ({ onError }) => {
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

  if (busy) {
    return (
      <View style={styles.busy}>
        <SpinningIcon name="musical-notes" size={16} color={colors.bg} />
      </View>
    );
  }

  return (
    <appleModule.AppleAuthenticationButton
      buttonType={appleModule.AppleAuthenticationButtonType.SIGN_IN}
      buttonStyle={appleModule.AppleAuthenticationButtonStyle.WHITE}
      cornerRadius={HEIGHT / 2}
      style={styles.button}
      onPress={handlePress}
    />
  );
};

const styles = StyleSheet.create({
  button: {
    width: "100%",
    height: HEIGHT,
  },
  /**
   * Apple's button cannot show a spinner, so it is swapped for one at the
   * same size — otherwise the row collapses and everything below it jumps.
   */
  busy: {
    width: "100%",
    height: HEIGHT,
    borderRadius: radius.pill,
    backgroundColor: colors.text,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default AppleSignInButton;
