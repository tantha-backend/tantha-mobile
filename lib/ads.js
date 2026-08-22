/**
 * AdMob identifiers.
 *
 * ─── Do not upgrade react-native-google-mobile-ads past 16.0.0 ───────────
 *
 * Later versions pin play-services-ads 25.x, which Google compiled with
 * Kotlin 2.3. React Native 0.86 builds with Kotlin 2.1, and the compiler
 * refuses to read 2.3 metadata — the Android build dies in
 * :react-native-google-mobile-ads:compileReleaseKotlin with a wall of
 * "Module was compiled with an incompatible version of Kotlin".
 *
 * 16.0.0 pins play-services-ads 24.6.0, which builds cleanly. The package
 * and its native SDK stay matched at a pairing the maintainers shipped
 * together, rather than forcing an old SDK under a newer wrapper.
 *
 * Revisit when React Native's Kotlin catches up.
 *
 * ─── The two kinds of ID ─────────────────────────────────────────────────
 *
 * They are easy to mix up, and the difference is a single character:
 *
 *   App ID       ca-app-pub-8201695435912533~7861602703   (tilde)
 *   Ad unit ID   ca-app-pub-8201695435912533/2578476116   (slash)
 *
 * The App ID lives in app.json under the react-native-google-mobile-ads
 * plugin — it is written into the Android manifest at build time, and the
 * Google SDK refuses to start without it. The ad unit IDs live here.
 *
 * Both are compiled into the binary, so changing either needs a rebuild.
 * Neither can be changed over the air.
 *
 * ─── Why development still shows test ads ────────────────────────────────
 *
 * The unit below is real and earns money, which is exactly why AdBanner
 * ignores it in development. Loading your own live ads — even accidentally,
 * even once — is what gets AdMob accounts suspended, and a debug build in
 * front of a developer is where that happens. Test ads look and behave
 * identically and earn nothing, so nothing is lost by using them.
 *
 * A release build serves the real unit. Before installing one on your own
 * phone, register that phone under Settings → Test devices in AdMob, so it
 * keeps receiving test ads no matter which build it is running.
 *
 * ─── iOS ─────────────────────────────────────────────────────────────────
 *
 * app.json still carries Google's sample iOS App ID. Nothing ships for iOS
 * yet, and the value is only read when building for it. Registering a second
 * app in AdMob is the first step whenever iOS happens — an Android App ID
 * will not work there.
 */

/** The banner under the About card, on the player and on artist pages. */
export const BANNER_UNIT_ID = "ca-app-pub-8201695435912533/2578476116";

/** Whether a real, earning ad unit is configured. */
export const HAS_REAL_ADS = Boolean(BANNER_UNIT_ID);
