import { useEffect, useState } from "react";
import { FlatList, Pressable, Share, StyleSheet, Text, View } from "react-native";

import BottomSheet from "./BottomSheet";
import { colors, spacing } from "../lib/theme";
import {
  clearPlayerLog,
  getPlayerLog,
  subscribeToPlayerLog,
} from "../lib/playerLog";

/**
 * Shows what the player has been doing, newest first.
 *
 * A diagnostic for one specific problem: the queue stops advancing while the
 * phone is locked, which cannot be watched happening. Lock the phone, let a
 * track end, unlock, open this — the last lines say which step ran and which
 * never returned.
 *
 * Reached by long-pressing "NOW PLAYING", deliberately out of the way. It is
 * not a feature and nobody should find it by accident.
 */
const PlayerLogSheet = ({ visible, onClose }) => {
  const [rows, setRows] = useState(getPlayerLog);

  useEffect(() => {
    if (!visible) return undefined;

    setRows(getPlayerLog());
    return subscribeToPlayerLog(() => setRows(getPlayerLog()));
  }, [visible]);

  if (!visible) return null;

  const asText = () =>
    rows
      .slice()
      .reverse()
      .map((r) => `${r.at}  ${r.message}${r.detail ? `  ${r.detail}` : ""}`)
      .join("\n");

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.header}>
        <Text style={styles.title}>Player log</Text>

        <Pressable onPress={() => Share.share({ message: asText() })} hitSlop={10}>
          <Text style={styles.action}>Share</Text>
        </Pressable>

        <Pressable onPress={clearPlayerLog} hitSlop={10}>
          <Text style={styles.action}>Clear</Text>
        </Pressable>
      </View>

      <View style={styles.divider} />

      {rows.length === 0 ? (
        <Text style={styles.empty}>Nothing recorded yet.</Text>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item, i) => `${item.at}-${i}`}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.time}>{item.at}</Text>
              <Text style={styles.message}>
                {item.message}
                {item.detail ? <Text style={styles.detail}>{`  ${item.detail}`}</Text> : null}
              </Text>
            </View>
          )}
        />
      )}
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  action: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.accent,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  list: {
    paddingVertical: spacing.sm,
  },
  row: {
    flexDirection: "row",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 3,
  },
  time: {
    fontSize: 11,
    color: colors.textFaint,
    fontVariant: ["tabular-nums"],
  },
  message: {
    flex: 1,
    fontSize: 12,
    color: colors.text,
  },
  detail: {
    color: colors.textMuted,
  },
  empty: {
    padding: spacing.xl,
    textAlign: "center",
    color: colors.textMuted,
  },
});

export default PlayerLogSheet;
