import { StyleSheet, Text, View } from "react-native";
import Constants from "expo-constants";
import { Ionicons } from "@expo/vector-icons";

import { colors, radius, spacing } from "../lib/theme";
import { ADS_ENABLED } from "../lib/features";
import { BANNER_UNIT_ID } from "../lib/ads";

/**
 * Expo Go is a prebuilt binary, so it carries no native module we did not
 * compile — importing the ads SDK there throws before anything renders. The
 * require is therefore both conditional and guarded, and development falls
 * back to a labelled empty slot that reserves the same space.
 */
const isExpoGo = Constants.executionEnvironment === "storeClient";

let ads = null;

if (!isExpoGo) {
  try {
    ads = require("react-native-google-mobile-ads");
  } catch {
    // No native module in this binary; the placeholder stands in.
  }
}

/**
 * A banner ad.
 *
 * Labelled, because an unmarked ad inside a music app reads as part of the
 * app — and the stores require the distinction.
 *
 * Until a real ad unit is configured this serves Google's test banner, which
 * fills reliably and earns nothing. See lib/ads.js for the swap.
 */
const AdBanner = ({ style }) => {
  if (!ADS_ENABLED) return null;

  return (
    <View style={[styles.wrap, style]}>
      <Text style={styles.label}>ADVERTISEMENT</Text>

      {ads ? (
        <ads.BannerAd
          /**
           * Test inventory in development, the real unit in a release build.
           *
           * The live unit earns money, and loading your own live ads is what
           * gets AdMob accounts suspended — a debug build sitting in front of
           * whoever is writing the screen is exactly where that happens. Test
           * ads render identically, so nothing about the layout is unverified.
           */
          unitId={
            __DEV__ ? ads.TestIds.BANNER : BANNER_UNIT_ID || ads.TestIds.BANNER
          }
          size={ads.BannerAdSize.LARGE_ANCHORED_ADAPTIVE_BANNER}
          requestOptions={{
            // The catalogue is general-audience music, not a children's app,
            // but nothing here warrants adult inventory either.
            requestNonPersonalizedAdsOnly: false,
          }}
        />
      ) : (
        <View style={styles.slot}>
          <Ionicons name="megaphone-outline" size={20} color={colors.textFaint} />
          <Text style={styles.placeholder}>
            {isExpoGo ? "Ad space — needs a real build" : "Ad space"}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    // Centred because an adaptive banner sizes itself and is rarely exactly
    // as wide as the column it sits in.
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
