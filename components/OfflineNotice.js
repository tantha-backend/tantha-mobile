import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";

import { useNetworkState } from "expo-network";
import { API_BASE_URL } from "../lib/api";
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
 *
 * ─── Why the flag is not trusted on its own ──────────────────────────────
 *
 * On some devices `isInternetReachable` reports false while the connection
 * is working perfectly — the banner then sat on screen permanently, over an
 * app that was loading and playing fine, which is worse than saying nothing.
 * So the flag only starts the question: the answer comes from actually
 * asking the API whether it is there. A captive portal still gets caught,
 * because the request fails.
 */

/** How long to give the check before calling it a failure. */
const PROBE_TIMEOUT_MS = 4000;

/** How often to re-check while the banner is up, so it clears itself. */
const RECHECK_MS = 8000;

/**
 * Asks the API whether it can be reached. Any answer at all counts, including
 * an error status — a 404 still proves the request left the phone and came
 * back, which is the only thing being tested here.
 */
const canReachApi = async () => {
  const control = new AbortController();
  const timer = setTimeout(() => control.abort(), PROBE_TIMEOUT_MS);

  try {
    await fetch(API_BASE_URL, { method: "HEAD", signal: control.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
};
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
    let cancelled = false;
    let recheck;

    const goOnline = () => {
      if (!wasOffline.current) {
        setVisible(false);
        return;
      }

      wasOffline.current = false;
      setRestored(true);
      setVisible(true);
    };

    const check = async () => {
      // The flag says fine, so it is fine — no need to spend a request.
      if (!offline) {
        goOnline();
        return;
      }

      // The flag says offline. Confirm it before accusing the connection.
      const reachable = await canReachApi();
      if (cancelled) return;

      if (reachable) {
        goOnline();
        return;
      }

      wasOffline.current = true;
      setRestored(false);
      setVisible(true);

      recheck = setTimeout(check, RECHECK_MS);
    };

    check();

    return () => {
      cancelled = true;
      clearTimeout(recheck);
    };
  }, [offline]);

  // "Back online" is a toast; the offline state is not.
  useEffect(() => {
    if (!restored || !visible) return undefined;

    const timer = setTimeout(() => setVisible(false), RESTORED_MS);
    return () => clearTimeout(timer);
  }, [restored, visible]);

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
