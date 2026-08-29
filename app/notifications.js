import { useCallback, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Empty, Loading, Screen } from "../components/ui";
import { colors, radius, spacing } from "../lib/theme";
import { notificationService } from "../lib/services";
import { errorMessage } from "../lib/api";

/** Rough, friendly age of a notification. */
const timeAgo = (date) => {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

  return new Date(date).toLocaleDateString();
};

/** A rough icon per notification kind, falling back to a bell. */
const iconFor = (type = "") => {
  if (/song|track|release/i.test(type)) return "musical-notes";
  if (/artist|follow/i.test(type)) return "person";
  if (/premium|payment|coffee/i.test(type)) return "card";
  if (/comment/i.test(type)) return "chatbubble";
  return "notifications";
};

const Notifications = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setItems(await notificationService.list());
      setError("");
    } catch (err) {
      setError(errorMessage(err, "Could not load notifications"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  /**
   * Marks everything read on open, then reloads.
   *
   * Opening the screen is the act of reading them, so making someone press a
   * separate button to clear the badge would be busywork.
   */
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      (async () => {
        await load();
        if (cancelled) return;

        try {
          await notificationService.markAllRead();
        } catch {
          // The badge will simply clear on the next successful visit.
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [load]),
  );

  if (loading) return <Loading label="Loading notifications..." />;

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>

        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 26 }} />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={items}
        keyExtractor={(item, i) => `${item._id}-${i}`}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.accent}
          />
        }
        ListEmptyComponent={
          <Empty
            title="Nothing yet"
            subtitle="New releases and updates will show up here."
          />
        }
        renderItem={({ item }) => (
          <View style={[styles.row, !item.isRead && styles.rowUnread]}>
            <View style={styles.icon}>
              <Ionicons
                name={iconFor(item.type)}
                size={17}
                color={item.isRead ? colors.textMuted : colors.accent}
              />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{item.title || "Update"}</Text>

              {item.message ? (
                <Text style={styles.message}>{item.message}</Text>
              ) : null}

              <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
            </View>
          </View>
        )}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  list: {
    paddingBottom: spacing.xxl,
  },
  row: {
    flexDirection: "row",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  // A tint rather than a dot, so unread is legible without hunting for a mark.
  rowUnread: {
    backgroundColor: colors.surface,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  message: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
  },
  time: {
    marginTop: spacing.xs,
    fontSize: 11,
    color: colors.textFaint,
  },
  error: {
    paddingHorizontal: spacing.lg,
    color: colors.danger,
    fontSize: 13,
  },
});

export default Notifications;
