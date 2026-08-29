import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";

import { useNetworkState } from "expo-network";
import { colors, radius, spacing } from "../lib/theme";

/** How long "Back online" stays up before sliding away. */
const RESTORED_MS = 2200;

/**
 * Tells the listener when the connection has gone, and when it returns.
 *
 * ─── Why it stays up ─────────────────────────────────────────────────────
 *
 * "No internet" is not a passing event, it is a state — and while it lasts
 * it explains everything else the app is doing wrong: covers that will not
 * load, a track that will not start, a search that returns nothing. A toast
 * that vanishes after three seconds leaves the next five minutes looking
 * like the app is simply broken. So this stays for as long as the
 * connection is gone, and only "Back online" behaves like a toast.
 *
 * ─── Why `isInternetReachable` rather than `isConnected` ─────────────────
 *
 * Being attached to Wi-Fi is not the same as having the internet. A hotel
 * portal, a router with no upstream, a phone on the edge of coverage — all
 * report a connection while nothing gets through. Reachability is the thing
 * people mean when they say the internet is down.
 *
 * It reports undefined while first working that out, which is treated as
 * fine: better a moment's silence than accusing a healthy connection.
 */
const OfflineNotice = () => {
  const insets = useSafeAreaInsets();
  const network = useNetworkState();

  const [visible, setVisible] = useState(false);
  const [restored, setRestored] = useState(false);

  const slide = useRef(new Animated.Value(0)).current;

  // So the banner does not announce a recovery on launch, having never been
  // offline in the first place.
  const wasOffline = useRef(false);

  const offline =
    network?.isInternetReachable === false ||
    (network?.isConnected === false && network?.isInternetReachable !== true);

  useEffect(() => {
    if (offline) {
      wasOffline.current = true;
      setRestored(false);
      setVisible(true);
      return undefined;
    }

    if (!wasOffline.current) return undefined;

    wasOffline.current = false;
    setRestored(true);
    setVisible(true);

    const timer = setTimeout(() => setVisible(false), RESTORED_MS);
    return () => clearTimeout(timer);
  }, [offline]);

  useEffect(() => {
    Animated.timing(slide, {
      toValue: visible ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [visible, slide]);

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrap,
        { top: insets.top + spacing.sm },
        {
          opacity: slide,
          transform: [
            {
              translateY: slide.interpolate({
                inputRange: [0, 1],
                outputRange: [-20, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View style={[styles.pill, restored && styles.pillOnline]}>
        <Ionicons
          name={restored ? "wifi" : "cloud-offline-outline"}
          size={15}
          color={restored ? colors.bg : colors.text}
        />
        <Text style={[styles.label, restored && styles.labelOnline]}>
          {restored ? "Back online" : "No internet connection"}
        </Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 300,
    elevation: 24,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillOnline: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
  },
  labelOnline: {
    color: colors.bg,
  },
});

export default OfflineNotice;
