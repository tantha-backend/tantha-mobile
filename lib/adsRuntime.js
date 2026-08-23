import Constants from "expo-constants";

/**
 * Owns the Google Mobile Ads SDK: loading it, starting it, and saying when it
 * is safe to put a banner on screen.
 *
 * ─── Why this exists ─────────────────────────────────────────────────────
 *
 * Rendering a <BannerAd> before initialize() has finished crashed the app —
 * natively, closing it outright, with Android's "this app has a bug" dialog.
 * It never happened on the emulator, because an emulator is automatically an
 * AdMob test device: test ads are served locally and fill instantly, so
 * initialisation always won the race. On a real phone fetching a real ad over
 * mobile data, it did not.
 *
 * So nothing renders an ad until initialisation has actually completed, and
 * the app treats that as an ordinary wait rather than an assumption.
 *
 * ─── Why the module is loaded lazily ─────────────────────────────────────
 *
 * Expo Go carries no native module we did not compile, and importing this one
 * there throws before anything renders. The require stays conditional and
 * guarded so development keeps working.
 */

const isExpoGo = Constants.executionEnvironment === "storeClient";

let ads = null;

if (!isExpoGo) {
  try {
    ads = require("react-native-google-mobile-ads");
  } catch {
    // No native module in this binary; the app runs without ads.
  }
}

let readyPromise = null;

/**
 * Starts the SDK once and resolves when it is ready to serve.
 *
 * Resolves false rather than rejecting when ads are unavailable, so every
 * caller can treat "no ads" as a normal outcome instead of an error to
 * handle. An ad is the least important thing on any screen it appears on.
 */
export const initAds = () => {
  if (!ads) return Promise.resolve(false);

  if (!readyPromise) {
    readyPromise = ads
      .default()
      .initialize()
      .then(() => true)
      .catch(() => false);
  }

  return readyPromise;
};

export const adsModule = ads;
export const adsAvailable = Boolean(ads);
export const runningInExpoGo = isExpoGo;
