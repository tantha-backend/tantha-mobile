const { withAppBuildGradle } = require("expo/config-plugins");

/**
 * Signs release builds with the real upload key instead of the debug one.
 *
 * ─── Why this is a plugin and not an edit ────────────────────────────────
 *
 * `expo prebuild` regenerates android/ from scratch, so anything typed into
 * build.gradle by hand survives until the next time a config change needs a
 * prebuild — and then vanishes silently, and the next release goes out
 * debug-signed. A plugin is applied every time the project is generated, so
 * the signing config cannot quietly disappear.
 *
 * ─── Where the passwords live ────────────────────────────────────────────
 *
 * Nowhere in this repository. Gradle reads them from properties defined in
 * ~/.gradle/gradle.properties, which is outside every project and is never
 * committed by anyone:
 *
 *   TANTHA_UPLOAD_STORE_FILE=C:\\Users\\you\\keystores\\tantha-upload.keystore
 *   TANTHA_UPLOAD_KEY_ALIAS=tantha-upload
 *   TANTHA_UPLOAD_STORE_PASSWORD=...
 *   TANTHA_UPLOAD_KEY_PASSWORD=...
 *
 * ─── What happens without them ───────────────────────────────────────────
 *
 * The build falls back to debug signing rather than failing. A machine that
 * has never been given the key — a colleague's laptop, a CI runner — can
 * still build and run the app; it simply cannot produce something
 * publishable. Failing outright would make the project impossible to work on
 * without handing the signing key to everyone who touches it.
 *
 * Gradle prints which one it used, so a release is never debug-signed
 * without saying so.
 */

const SIGNING_CONFIG = `
        release {
            // Supplied through ~/.gradle/gradle.properties, never the repo.
            if (project.hasProperty('TANTHA_UPLOAD_STORE_FILE')) {
                storeFile file(TANTHA_UPLOAD_STORE_FILE)
                storePassword TANTHA_UPLOAD_STORE_PASSWORD
                keyAlias TANTHA_UPLOAD_KEY_ALIAS
                keyPassword TANTHA_UPLOAD_KEY_PASSWORD
            }
        }`;

const RELEASE_SELECTION = `
            // The upload key when this machine has it, the debug key when it
            // does not — so anyone can build, but only a machine holding the
            // key can build something publishable.
            if (project.hasProperty('TANTHA_UPLOAD_STORE_FILE')) {
                println '> Tantha: signing release with the upload key'
                signingConfig signingConfigs.release
            } else {
                println '> Tantha: NO upload key found — this build is debug-signed and cannot be published'
                signingConfig signingConfigs.debug
            }`;

const withUploadSigning = (config) =>
  withAppBuildGradle(config, (gradleConfig) => {
    let contents = gradleConfig.modResults.contents;

    // Applied twice would nest the config inside itself.
    if (contents.includes("TANTHA_UPLOAD_STORE_FILE")) return gradleConfig;

    const debugConfig = `        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }`;

    if (!contents.includes(debugConfig)) {
      throw new Error(
        "withUploadSigning: the debug signingConfig block was not where it was " +
          "expected in app/build.gradle. React Native's template has changed, " +
          "and the release signing config would silently not be applied.",
      );
    }

    contents = contents.replace(debugConfig, `${debugConfig}\n${SIGNING_CONFIG}`);

    const releaseDefault = `            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug`;

    if (!contents.includes(releaseDefault)) {
      throw new Error(
        "withUploadSigning: the release buildType still points at the debug " +
          "signing config in an unexpected shape; refusing to leave a release " +
          "build debug-signed.",
      );
    }

    contents = contents.replace(releaseDefault, RELEASE_SELECTION);

    gradleConfig.modResults.contents = contents;
    return gradleConfig;
  });

module.exports = withUploadSigning;
