import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { usePathname } from "expo-router";

import { colors } from "../lib/theme";

/** How long the bar takes to sweep across before disappearing. */
const SWEEP_MS = 500;

/**
 * A thin progress bar across the top on every navigation.
 *
 * It was a spinner in the middle of the screen, which meant two spinners at
 * once on any page that loads something of its own: the route loader in the
 * centre and the screen's own "Loading artist…" right behind it. Two
 * different indicators for one wait reads as something being stuck.
 *
 * A bar at the top edge cannot be mistaken for a screen's own loading state.
 * It says "your tap registered, the page is coming" and then gets out of the
 * way, leaving each screen to speak for itself about its own content.
 *
 * Never takes touches — it sits over the top of the page without standing in
 * front of it.
 */
const RouteLoader = () => {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  const progress = useRef(new Animated.Value(0)).current;

  // The first render is the app opening, which has its own loading screen.
  const started = useRef(false);

  useEffect(() => {
    if (!started.current) {
      started.current = true;
      return undefined;
    }

    setVisible(true);
    progress.setValue(0);

    const sweep = Animated.timing(progress, {
      toValue: 1,
      duration: SWEEP_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });

    sweep.start(({ finished }) => {
      if (finished) setVisible(false);
    });

    return () => sweep.stop();
  }, [pathname, progress]);

  if (!visible) return null;

  return (
    <View style={styles.track} pointerEvents="none">
      <Animated.View
        style={[
          styles.bar,
          {
            width: progress.interpolate({
              inputRange: [0, 1],
              outputRange: ["0%", "100%"],
            }),
            opacity: progress.interpolate({
              // Fades out as it completes, so it leaves rather than vanishes.
              inputRange: [0, 0.8, 1],
              outputRange: [1, 1, 0],
            }),
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  track: {
    ...StyleSheet.absoluteFill,
    // Only the top edge; the rest of the screen is left alone.
    bottom: undefined,
    height: 2,
    zIndex: 200,
    elevation: 20,
  },
  bar: {
    height: 2,
    backgroundColor: colors.accent,
  },
});

export default RouteLoader;
