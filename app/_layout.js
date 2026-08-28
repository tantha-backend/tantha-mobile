import { useEffect } from "react";
import { LogBox, StyleSheet, View } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider, useAuth } from "../lib/auth";
import { PlayerProvider } from "../lib/player";
import OfflineNotice from "../components/OfflineNotice";
import RouteLoader from "../components/RouteLoader";
import { initAds } from "../lib/adsRuntime";
import { Loading } from "../components/ui";
import { colors } from "../lib/theme";

/**
 * expo-audio logs these with console.error whenever it cannot bind its
 * playback service, which puts a red box over the player on every track.
 *
 * Nothing is misconfigured — app.json already sets the expo-audio plugin's
 * `enableBackgroundPlayback: true`. Expo Go is a prebuilt binary, so config
 * plugins never reach it, and its bundled expo-audio has no background
 * service to bind to. Lock screen controls and background playback therefore
 * cannot work under Expo Go no matter what the config says; they work in a
 * dev or production build, where the plugin is actually applied.
 *
 * Matched on the exact wording so a genuine audio failure still shows.
 */
LogBox.ignoreLogs([
  "Failed to activate lock screen controls",
  "Failed to start the expo-audio playback service",
]);

/**
 * Starts the Google Mobile Ads SDK as early as possible.
 *
 * The work of loading and guarding it lives in lib/adsRuntime, which every
 * banner also waits on — so starting it here only means it begins sooner,
 * and no longer means a banner can render before it is ready.
 */
const startAds = () => {
  initAds();
};

/**
 * Sends the user to the right half of the app whenever the session changes:
 * signed out into (auth), signed in into (tabs).
 */
const AuthGate = ({ children }) => {
  const { isSignedIn, restoring } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (restoring) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!isSignedIn && !inAuthGroup) router.replace("/(auth)/login");
    else if (isSignedIn && inAuthGroup) router.replace("/(tabs)/home");
  }, [isSignedIn, restoring, segments, router]);

  if (restoring) return <Loading label="Starting Tantha..." />;

  return children;
};

const RootLayout = () => {
  useEffect(startAds, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />

      <AuthProvider>
        <PlayerProvider>
          <AuthGate>
            {/*
              A sized box for the navigator and anything laid over it. Without
              it the overlay below has no parent with a height to fill, so it
              collapsed to a sliver at the bottom of the screen rather than
              covering it — absolute positioning only fills a box that has a
              size to begin with.
            */}
            <View style={styles.root}>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.bg },
                animation: "fade",
              }}
            >
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen
                name="player"
                options={{ presentation: "modal", animation: "slide_from_bottom" }}
              />
            </Stack>

              {/* Above the navigator, so it covers whichever screen arrives. */}
              <RouteLoader />

              {/* Outside the auth gate's screens but inside the app shell, so
                  it is shown on the login screen too — where a dead
                  connection is otherwise reported as a failed password. */}
              <OfflineNotice />
            </View>
          </AuthGate>
        </PlayerProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});

export default RootLayout;
