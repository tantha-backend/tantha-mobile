import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../lib/theme";
import { ADS_ENABLED } from "../lib/features";
import { BANNER_UNIT_ID } from "../lib/ads";
import { adsModule, initAds, runningInExpoGo } from "../lib/adsRuntime";

/**
 * A banner ad.
 *
 * Labelled, because an unmarked ad inside a music app reads as part of the
 * app — and the stores require the distinction.
 *
 * ─── Two rules learned the hard way ──────────────────────────────────────
 *
 * Nothing renders until the SDK reports itself ready. Mounting a banner
 * before initialize() had finished closed the app outright on a real phone,
 * while never once doing so on the emulator — an emulator is automatically an
 * AdMob test device, and test ads fill instantly, so initialisation always
 * won that race in testing and lost it in someone's hand.
 *
 * And the size is the plain 320x50 banner rather than an adaptive one.
 * Adaptive banners size themselves from the width of their parent, which is a
 * promise this layout cannot always keep — the slot sits inside a scroll view
 * that has not finished measuring when the ad arrives.
 *
 * A failed ad hides the whole slot, label included. An empty box captioned
 * ADVERTISEMENT is worse than no box.
 */
const AdBanner = ({ style }) => {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    initAds().then((ok) => {
      if (!cancelled) setReady(ok);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!ADS_ENABLED || failed) return null;

  // Expo Go has no ads module at all; show the slot so the layout around it
  // can still be judged during development.
  if (runningInExpoGo || !adsModule) {
    return (
      <View style={[styles.wrap, style]}>
        <Text style={styles.label}>ADVERTISEMENT</Text>
        <View style={styles.slot}>
          <Ionicons name="megaphone-outline" size={20} color={colors.textFaint} />
          <Text style={styles.placeholder}>Ad space — needs a real build</Text>
        </View>
      </View>
    );
  }

  // Nothing at all until the SDK is up. Reserving space for an ad that may
  // never arrive would leave a hole in the page.
  if (!ready) return null;

  const { BannerAd, BannerAdSize, TestIds } = adsModule;

  return (
    <View style={[styles.wrap, style]}>
      <Text style={styles.label}>ADVERTISEMENT</Text>

      <BannerAd
        /**
         * Test inventory in development, the real unit in a release build.
         * Loading your own live ads is what gets AdMob accounts suspended,
         * and a debug build in front of whoever is writing the screen is
         * exactly where that accident happens.
         */
        unitId={__DEV__ ? TestIds.BANNER : BANNER_UNIT_ID || TestIds.BANNER}
        size={BannerAdSize.BANNER}
        onAdFailedToLoad={() => setFailed(true)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    alignItems: "center",
  },
  label: {
    alignSelf: "flex-start",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    color: colors.textFaint,
    marginBottom: spacing.xs,
  },
  slot: {
    alignSelf: "stretch",
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  placeholder: {
    fontSize: 13,
    color: colors.textFaint,
  },
});

export default AdBanner;
