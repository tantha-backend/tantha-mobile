import { Platform } from "react-native";
import Constants from "expo-constants";

/**
 * Sign in with Apple.
 *
 * ─── Why the app has this as well as Google ──────────────────────────────
 *
 * Apple's review guidelines require it: an app that offers a social login
 * must also offer one that lets people keep their email address private, and
 * Apple's is the only one that does. Our own email and password login does
 * not count, because it asks for the real address.
 *
 * ─── What comes back, and what does not ──────────────────────────────────
 *
 * The identity token every time. The person's name and, if they chose to
 * hide it, their relay address — only on the *first* authorisation, and null
 * on every one after. So the name is passed on to the server the one time it
 * exists, and the server keeps it. There is no second chance to ask.
 *
 * ─── Availability ────────────────────────────────────────────────────────
 *
 * iOS only, and the native module is absent under Expo Go, so the button
 * takes itself away rather than offering something that cannot work.
 */

const isExpoGo = Constants.executionEnvironment === "storeClient";

let apple = null;

if (Platform.OS === "ios" && !isExpoGo) {
  try {
    apple = require("expo-apple-authentication");
  } catch {
    // Not in this binary; the other ways in still work.
  }
}

export const isAppleSignInAvailable = Boolean(apple);

/**
 * The native module itself, for the one thing that needs it directly: Apple's
 * own button, which we are required to render rather than draw ourselves.
 *
 * Exported from here rather than imported where it is used, so the decision
 * about whether this module exists at all is made in exactly one place.
 */
export const appleModule = apple;

/**
 * Runs Apple's sheet.
 *
 * Returns null when it is dismissed, which is not a failure — closing a
 * sheet is an answer, and reporting it as an error sends people looking for
 * a fault that is not there.
 */
export const getAppleCredential = async () => {
  if (!apple) throw new Error("Apple sign-in isn't available in this build");

  // The hardware can still say no — an iPad on an old iOS, for instance.
  if (!(await apple.isAvailableAsync())) {
    throw new Error("Apple sign-in isn't available on this device");
  }

  try {
    const credential = await apple.signInAsync({
      requestedScopes: [
        apple.AppleAuthenticationScope.FULL_NAME,
        apple.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential?.identityToken) {
      throw new Error("Apple did not return a sign-in token");
    }

    // Given once, in parts. Joined here so the server stores a name rather
    // than a structure it would have to know how to read.
    const fullName = [
      credential.fullName?.givenName,
      credential.fullName?.familyName,
    ]
      .filter(Boolean)
      .join(" ")
      .trim();

    return { identityToken: credential.identityToken, fullName };
  } catch (error) {
    if (error?.code === "ERR_REQUEST_CANCELED") return null;
    throw error;
  }
};
