const { withMainActivity } = require("expo/config-plugins");

/**
 * Keeps the music playing when someone backs out of the app.
 *
 * ─── What went wrong ─────────────────────────────────────────────────────
 *
 * Pressing back until the app closes *finishes* the activity, which is not
 * the same as pressing Home. Finishing tears down the React Native context,
 * and expo-audio stops every player when that happens:
 *
 *   AudioModule.OnDestroy { players.values.forEach { it.ref.stop() } }
 *
 * The audio lives in JavaScript, so when JavaScript goes, so does the music.
 * Reported on Samsung, where finished tasks are reclaimed sooner.
 *
 * ─── Why the template did not cover it ───────────────────────────────────
 *
 * Expo's MainActivity already backgrounds the app instead of finishing it,
 * but only on Android 11 and below. Above that it defers to the system,
 * on the basis that Android 12 moves a root activity to the background
 * rather than finishing it. That is not reliable in practice — One UI is one
 * place it does not hold — and the cost of being wrong is the music stopping.
 *
 * So: background the task on every version, and only fall back to finishing
 * when there is no task to background (a non-root activity), which is what
 * the ≤11 branch already did.
 *
 * ─── Why a plugin ────────────────────────────────────────────────────────
 *
 * `expo prebuild` regenerates android/, so this cannot be typed into
 * MainActivity.kt by hand — it would survive until the next prebuild and
 * then vanish, and the music would start stopping again with nothing in the
 * diff to explain it.
 */

const ORIGINAL = `  override fun invokeDefaultOnBackPressed() {
      if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
          if (!moveTaskToBack(false)) {
              // For non-root activities, use the default implementation to finish them.
              super.invokeDefaultOnBackPressed()
          }
          return
      }

      // Use the default back button implementation on Android S
      // because it's doing more than [Activity.moveTaskToBack] in fact.
      super.invokeDefaultOnBackPressed()
  }`;

const REPLACEMENT = `  override fun invokeDefaultOnBackPressed() {
      // Background the app rather than finish it, on every version.
      //
      // Finishing destroys the React Native context, and expo-audio stops
      // every player when that happens — so backing out of the app used to
      // stop the music. See plugins/withBackgroundPlayback.js.
      if (!moveTaskToBack(false)) {
          // Nothing to background: a non-root activity, so finish it.
          super.invokeDefaultOnBackPressed()
      }
  }`;

const withBackgroundPlayback = (config) =>
  withMainActivity(config, (mainActivity) => {
    const contents = mainActivity.modResults.contents;

    // Already applied — prebuild can run more than once.
    if (contents.includes("plugins/withBackgroundPlayback.js")) {
      return mainActivity;
    }

    if (!contents.includes(ORIGINAL)) {
      throw new Error(
        "withBackgroundPlayback: MainActivity's invokeDefaultOnBackPressed is not " +
          "in the shape this plugin expects. The Expo template changed — read the " +
          "new version and update this plugin rather than editing MainActivity by " +
          "hand, which prebuild would discard.",
      );
    }

    mainActivity.modResults.contents = contents.replace(ORIGINAL, REPLACEMENT);

    return mainActivity;
  });

module.exports = withBackgroundPlayback;
