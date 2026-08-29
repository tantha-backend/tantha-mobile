import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";

import BottomSheet from "./BottomSheet";
import { colors, radius, spacing } from "../lib/theme";

/**
 * Asks which of a track's artists to open.
 *
 * Only shown for a collaboration. With a single credit the name goes straight
 * to that artist's page — putting a one-item chooser in the way would be a
 * question with one answer.
 */
const ArtistPicker = ({ artists, onPick, onClose }) => (
  <BottomSheet visible={Boolean(artists?.length)} onClose={onClose}>
    <Text style={styles.title}>Go to artist</Text>

    <View style={styles.divider} />

    {(artists || []).map((artist) => (
      <Pressable
        key={artist.id}
        onPress={() => onPick(artist)}
        style={({ pressed }) => [
          styles.row,
          pressed && { backgroundColor: colors.surfaceRaised },
        ]}
      >
        {/* Their own photo, round like every other artist avatar in the app.
            Two names beside two identical silhouettes told you nothing about
            who you were choosing between. */}
        {artist.image ? (
          <Image
            source={{ uri: artist.image }}
            style={styles.avatar}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.initial}>
              {(artist.name || "?").charAt(0).toUpperCase()}
            </Text>
          </View>
        )}

        <Text numberOfLines={1} style={styles.name}>
          {artist.name}
        </Text>

        {artist.isVerified ? (
          <View style={styles.verified}>
            <Ionicons name="checkmark" size={10} color="#ffffff" />
          </View>
        ) : null}

        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </Pressable>
    ))}
  </BottomSheet>
);

const styles = StyleSheet.create({
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    marginRight: spacing.md,
    backgroundColor: colors.surfaceRaised,
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  initial: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textFaint,
  },
  name: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  verified: {
    width: 15,
    height: 15,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
  },
});

export default ArtistPicker;
