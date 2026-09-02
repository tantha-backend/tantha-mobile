import { useEffect, useRef, useState } from "react";
import {
  Animated,
  AppState,
  Easing,
  StyleSheet,
  Text,
  View,
} from "react-native";
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
 * ─── Why the flag is not trusted on its own ──────────────────────────────
 *
 * `isInternetReachable` reports false on plenty of healthy connections, so
 * the flag only starts the question. The answer comes from asking the API
 * whether it is actually there — which also catches a captive portal, since
 * the request fails.
 *
 * ─── Why one failed request is not enough ────────────────────────────────
 *
 * It used to be, and the banner flapped: "No internet" then "Back online"
 * then "No internet", over and over, on a phone whose connection was fine.
 *
 * The two signals are not independent. The flag drops during exactly the
 * moments a request is most likely to fail anyway — the radio switching
 * between wifi and mobile, a handover between masts, the phone waking up. So
 * a single failure, sampled at the worst possible instant, was being treated
 * as proof. It is not proof, it is a blip.
 *
 * A real outage answers the same way every time, so the banner now waits for
 * several failures in a row. This costs nothing when the connection is
 * genuinely down: with no network at all a request fails immediately rather
 * than waiting for the timeout, so three of them still resolve in about a
 * second. The delay only falls on the flaky case, which is the case that
 * should not be shouting.
 *
 * ─── Why it stops when the app is not on screen ──────────────────────────
 *
 * Backgrounded apps get their network cut by Doze, and this one keeps
 * running in the background now that music plays there. So it sat in a
 * sleeping phone, failing requests that were never going to succeed, and
 * announcing a connection problem that did not exist to a screen nobody was
 * looking at. Whether the connection is up is only worth asking while
 * someone is there to be told.
 */

/** How long to give one request before calling it a failure. */
const PROBE_TIMEOUT_MS = 4000;

/** Consecutive failures before the banner is allowed to appear. */
const FAILURES_BEFORE_BANNER = 3;

/** Gap between those attempts, so they sample different moments. */
const RETRY_GAP_MS = 1500;

/** How often to re-check while the banner is up, so it clears itself. */
const RECHECK_MS = 8000;

/**
 * Long enough for the banner to have been read. Recovering faster than this
 * means nobody saw the problem, and announcing the fix would be the first
 * they hear of it — which is how a silent blip turns into two popups.
 */
const MIN_VISIBLE_MS = 1200;

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

/** Whether the app is the thing on screen right now. */
const useIsForeground = () => {
  const [active, setActive] = useState(
    () => AppState.currentState === "active",
  );

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) =>
      setActive(next === "active"),
    );

    return () => sub.remove();
  }, []);

  return active;
};

const OfflineNotice = () => {
  const insets = useSafeAreaInsets();
  const network = useNetworkState();
  const foreground = useIsForeground();

  const [visible, setVisible] = useState(false);
  const [restored, setRestored] = useState(false);

  const slide = useRef(new Animated.Value(0)).current;

  // So the banner does not announce a recovery on launch, having never been
  // offline in the first place.
  const wasOffline = useRef(false);

  // When the offline banner went up, so a blip nobody saw stays silent.
  const shownAt = useRef(0);

  const offline =
    network?.isInternetReachable === false ||
    (network?.isConnected === false && network?.isInternetReachable !== true);

  useEffect(() => {
    // Nobody is looking, and a sleeping phone fails requests for reasons that
    // have nothing to do with the connection.
    if (!foreground) return undefined;

    let cancelled = false;
    let timer;

    const wait = (ms) =>
      new Promise((resolve) => {
        timer = setTimeout(resolve, ms);
      });

    const goOnline = () => {
      if (!wasOffline.current) {
        setVisible(false);
        return;
      }

      wasOffline.current = false;

      // Recovered before anyone could read it, so say nothing.
      if (Date.now() - shownAt.current < MIN_VISIBLE_MS) {
        setVisible(false);
        return;
      }

      setRestored(true);
      setVisible(true);
    };

    const run = async () => {
      // The flag says fine, so it is fine — no need to spend a request.
      if (!offline) {
        goOnline();
        return;
      }

      // The flag says offline. Ask several times before believing it.
      for (let attempt = 0; attempt < FAILURES_BEFORE_BANNER; attempt += 1) {
        const reachable = await canReachApi();
        if (cancelled) return;

        if (reachable) {
          goOnline();
          return;
        }

        if (attempt < FAILURES_BEFORE_BANNER - 1) {
          await wait(RETRY_GAP_MS);
          if (cancelled) return;
        }
      }

      if (!wasOffline.current) shownAt.current = Date.now();

      wasOffline.current = true;
      setRestored(false);
      setVisible(true);

      // Keep asking so the banner clears itself when the connection returns,
      // even if the flag never changes.
      await wait(RECHECK_MS);
      if (cancelled) return;

      run();
    };

    run();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [offline, foreground]);

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
  /**
   * Green, not the brand pink.
   *
   * The two banners say opposite things and were telling them apart by their
   * words alone — the same accent that marks everything else in the app is no
   * signal at all. Green is the one colour that reads as "fixed" before the
   * sentence has been read, which is the whole job of a message that is gone
   * again in two seconds.
   */
  pillOnline: {
    backgroundColor: colors.success,
    borderColor: colors.success,
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
