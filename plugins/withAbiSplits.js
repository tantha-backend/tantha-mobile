const { withAppBuildGradle } = require("expo/config-plugins");

/**
 * Builds one APK per CPU architecture instead of one carrying them all.
 *
 * ─── Why ─────────────────────────────────────────────────────────────────
 *
 * A universal APK ships the native libraries for every architecture, so a
 * phone downloads three sets it can never run. Measured on this app that was
 * 38 MB of x86 and x86_64 libraries — emulator-only architectures — inside a
 * 98 MB download. Splitting brought the ARM build to 36 MB.
 *
 * x86_64 is kept because that is what an emulator runs on, and a build nobody
 * can test is worse than a slightly longer build.
 *
 * ─── Why a plugin ────────────────────────────────────────────────────────
 *
 * `expo prebuild` regenerates android/, so this cannot be typed into
 * build.gradle by hand — it would survive until the next prebuild and then
 * disappear, quietly, and the next release would be three times the size.
 *
 * expo-build-properties covers minification and resource shrinking but not
 * splits, which is why this exists alongside it rather than instead of it.
 *
 * ─── Note for the Play Store ─────────────────────────────────────────────
 *
 * Play requires an app bundle (`./gradlew bundleRelease`), which does this
 * splitting itself and per-device — which is why the block above turns itself
 * off for bundle builds. These split APKs are for sideloading and direct
 * distribution.
 */

const SPLITS_CONFIG = `
    splits {
        abi {
            // Off for bundleRelease. An app bundle already splits per device,
            // and Gradle refuses to do both: "Please disable building multiple
            // APKs when building an Android app bundle." Leaving this on broke
            // every .aab build with a multiple-shrunk-resources error, while
            // assembleRelease was fine — so it went unnoticed until the first
            // Play upload was needed.
            enable !gradle.startParameter.taskNames.any {
                it.toLowerCase().contains("bundle")
            }
            reset()
            // ARM covers real devices; x86_64 keeps the emulator usable.
            include "armeabi-v7a", "arm64-v8a", "x86_64"
            // Still emit the combined APK, for when one file has to run anywhere.
            universalApk true
        }
    }
`;

const withAbiSplits = (config) =>
  withAppBuildGradle(config, (gradleConfig) => {
    const contents = gradleConfig.modResults.contents;

    // Applying twice would declare the block inside itself.
    if (contents.includes("splits {")) return gradleConfig;

    const anchor = "\n    buildTypes {";

    if (!contents.includes(anchor)) {
      throw new Error(
        "withAbiSplits: could not find the buildTypes block in app/build.gradle. " +
          "The template changed; update this plugin rather than editing the file.",
      );
    }

    gradleConfig.modResults.contents = contents.replace(
      anchor,
      `${SPLITS_CONFIG}${anchor}`,
    );

    return gradleConfig;
  });

module.exports = withAbiSplits;
