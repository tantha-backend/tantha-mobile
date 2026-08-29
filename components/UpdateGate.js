import { useCallback, useEffect, useState } from "react";
import { Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Constants from "expo-constants";
import Ionicons from "@expo/vector-icons/Ionicons";

import { Button } from "./ui";
import { colors, radius, spacing, type } from "../lib/theme";
import { API_BASE_URL } from "../lib/api";

/**
 * Asks the server whether this build may keep running.
 *
 * ─── Why it fails open ───────────────────────────────────────────────────
 *
 * Every unknown answer means "carry on". A version gate exists to stop a
 * broken build; it must never become the reason a working one will not
 * start. No network, a bad reply, a server that is down — all leave the app
 * exactly as it was.
 *
 * ─── The two answers that do something ───────────────────────────────────
 *
 * `optional` offers an update and can be dismissed, and stays dismissed for
 * the rest of the session so it cannot nag.
 *
 * `required` covers the screen and does not close. That is the whole point:
 * it is only ever set when an old build is genuinely broken, and the admin
 * dashboard asks for confirmation before anyone can turn it on.
 */

/** Long enough for a slow connection, short enough not to delay the app. */
const TIMEOUT_MS = 5000;

const APP_VERSION = Constants.expoConfig?.version || "";

const UpdateGate = () => {
  const [state, setState] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const control = new AbortController();
    const timer = setTimeout(() => control.abort(), TIMEOUT_MS);

    (async () => {
      try {
        const url =
          `${API_BASE_URL}/app-version` +
          `?platform=${Platform.OS}&version=${encodeURIComponent(APP_VERSION)}`;

        const res = await fetch(url, { signal: control.signal });
        const data = await res.json();

        if (cancelled) return;
        if (data?.status === "optional" || data?.status === "required") {
          setState(data);
        }
      } catch {
        // Fails open. See the note above.
      } finally {
        clearTimeout(timer);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      control.abort();
    };
  }, []);

  const openStore = useCallback(() => {
    if (state?.storeUrl) Linking.openURL(state.storeUrl).catch(() => {});
  }, [state]);

  if (!state) return null;

  const required = state.status === "required";

  if (!required && dismissed) return null;

  if (required) {
    return (
      <View style={styles.block}>
        <View style={styles.icon}>
          <Ionicons name="arrow-up-circle" size={34} color={colors.accent} />
        </View>

        <Text style={styles.title}>Time to update</Text>

        <Text style={[type.muted, styles.body]}>{state.message}</Text>

        {state.latest ? (
          <Text style={styles.version}>
            You have {APP_VERSION} · latest is {state.latest}
          </Text>
        ) : null}

        {state.storeUrl ? (
          <Button label="Update now" onPress={openStore} style={styles.cta} />
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.banner} pointerEvents="box-none">
      <View style={styles.card}>
        <Ionicons name="sparkles" size={18} color={colors.accent} />

        <Text numberOfLines={2} style={styles.bannerText}>
          {state.message}
        </Text>

        {state.storeUrl ? (
          <Pressable onPress={openStore} hitSlop={8}>
            <Text style={styles.update}>UPDATE</Text>
          </Pressable>
        ) : null}

        <Pressable onPress={() => setDismissed(true)} hitSlop={8}>
          <Ionicons name="close" size={18} color={colors.textMuted} />
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  block: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 500,
    elevation: 40,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xxl,
    gap: spacing.md,
  },
  icon: {
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
  body: {
    textAlign: "center",
    lineHeight: 21,
  },
  version: {
    fontSize: 12,
    color: colors.textFaint,
    marginTop: spacing.xs,
  },
  cta: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xxl,
  },
  banner: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 400,
    elevation: 30,
    padding: spacing.md,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bannerText: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
  },
  update: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    color: colors.accent,
  },
});

export default UpdateGate;
