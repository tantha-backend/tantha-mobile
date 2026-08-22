import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { usePathname } from "expo-router";

import { colors, radius } from "../lib/theme";

/**
 * How long the spinner stays up after a route change.
 *
 * Long enough to register as a response to the tap, short enough that it is
 * never the reason you are waiting. Most screens in this app render instantly
 * — Search has nothing to fetch until you type — so a spinner tied to real
 * loading would simply never appear on those transitions, and a longer one
 * would make a fast app feel slow.
 */
const VISIBLE_MS = 300;

/**
 * A brief spinner on every navigation.
 *
 * Screens that genuinely fetch still show their own full-screen loader with
 * its own label; this is the acknowledgement for the moment in between, so
 * moving around the app never looks like nothing happened.
 *
 * Never takes touches — it sits over the screen without standing in the way
 * of it, so it can only ever cost you a glance, not a tap.
 */
const RouteLoader = () => {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  // The first render is the app opening, which has its own loading screen.
  const started = useRef(false);

  useEffect(() => {
    if (!started.current) {
      started.current = true;
      return undefined;
    }

    setVisible(true);
    const timer = setTimeout(() => setVisible(false), VISIBLE_MS);

    return () => clearTimeout(timer);
  }, [pathname]);

  if (!visible) return null;

  return (
    <View style={styles.overlay} pointerEvents="none">
      <View style={styles.pill}>
        <ActivityIndicator color={colors.accent} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  /**
   * `...StyleSheet.absoluteFill`, not `absoluteFillObject` — React Native
   * removed the latter, and spreading a name that no longer exists yields an
   * empty object rather than an error. The overlay simply lost its
   * positioning and collapsed to a sliver at the bottom of the screen.
   */
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 200,
    elevation: 20,
  },
  pill: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
});

export default RouteLoader;
