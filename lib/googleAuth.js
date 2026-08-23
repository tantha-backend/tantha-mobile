import Constants from "expo-constants";

/**
 * Google sign-in for the phone.
 *
 * ─── What it does and does not decide ────────────────────────────────────
 *
 * This gets an ID token from Google and hands it to our own backend, which
 * verifies Google's signature on it and issues the session. Nothing here
 * decides who anyone is: a token is a claim until the server has checked it,
 * and the app is in no position to check anything.
 *
 * ─── Why the web client ID ───────────────────────────────────────────────
 *
 * `webClientId` is what tells Google to mint an ID token our server can
 * verify, rather than one that only makes sense to this app. It is the web
 * credential rather than the Android one, which reads like a mistake and is
 * not — the Android client identifies the app, the web client identifies the
 * audience the token is for.
 *
 * ─── Expo Go ─────────────────────────────────────────────────────────────
 *
 * This is a native module, so it does not exist under Expo Go. Loading it is
 * guarded, and `isAvailable` lets the sign-in button take itself away rather
 * than offering something that cannot work.
 */

const WEB_CLIENT_ID =
  "1075084736343-4elhluqntdbkiisrlrdrj6gu94i9uu6i.apps.googleusercontent.com";

const isExpoGo = Constants.executionEnvironment === "storeClient";

let google = null;

if (!isExpoGo) {
  try {
    google = require("@react-native-google-signin/google-signin");
  } catch {
    // No native module in this binary; email and password still work.
  }
}

let configured = false;

const configure = () => {
  if (configured || !google) return;

  google.GoogleSignin.configure({
    webClientId: WEB_CLIENT_ID,
    // We want the identity, not access to anyone's Google data.
    scopes: ["email", "profile"],
    offlineAccess: false,
  });

  configured = true;
};

export const isGoogleSignInAvailable = Boolean(google);

/**
 * Runs the native account chooser and returns Google's ID token.
 *
 * Returns null when the person backs out, which is not a failure and should
 * not be reported as one — closing a sheet is an answer.
 */
export const getGoogleIdToken = async () => {
  if (!google) throw new Error("Google sign-in isn't available in this build");

  configure();

  // Google Play services can be missing or out of date, especially on older
  // or non-Google Android builds. Better to say so than to fail obscurely.
  await google.GoogleSignin.hasPlayServices({
    showPlayServicesUpdateDialog: true,
  });

  try {
    const result = await google.GoogleSignin.signIn();

    // The shape changed across versions: newer releases wrap it in `data`.
    const idToken = result?.data?.idToken ?? result?.idToken ?? null;

    if (!idToken) throw new Error("Google did not return a sign-in token");

    return idToken;
  } catch (error) {
    if (error?.code === google.statusCodes?.SIGN_IN_CANCELLED) return null;
    throw error;
  }
};

/**
 * Forgets the Google session on the device.
 *
 * Without this, signing out of Tantha and back in would silently reuse the
 * same Google account without ever asking — which looks like the app
 * ignoring you when you meant to switch accounts.
 */
export const forgetGoogleSession = async () => {
  if (!google || !configured) return;

  try {
    await google.GoogleSignin.signOut();
  } catch {
    // Already signed out, or never signed in.
  }
};
