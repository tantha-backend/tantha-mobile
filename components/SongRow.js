import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Artwork, PlayButton } from "./ui";
import { colors, radius, spacing } from "../lib/theme";
import { songArtwork, songCredit } from "../lib/song";
import { usePlayer } from "../lib/player";

/**
 * One track in a list. Highlights itself while it is the playing track so the
 * listener can see where they are without opening the player.
 *
 * `onRemove` adds a remove button, and is given only by the lists someone owns
 * — liked songs, a playlist, listening history. Browsing lists leave it out,
 * since there is nothing there to remove from.
 *
 * `removeLabel` names the action for screen readers, because "remove" means
 * something different in each of those three places.
 */
const SongRow = ({ song, onPress, index, onRemove, removeLabel = "Remove" }) => {
  const { current, isPlaying, toggle } = usePlayer();

  const active = current?._id === song._id;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {typeof index === "number" ? (
        <Text style={[styles.index, active && styles.activeText]}>
          {index + 1}
        </Text>
      ) : null}

      <Artwork
        uri={songArtwork(song)}
        size={48}
        rounded={radius.sm}
        label={song.title}
      />

      <View style={styles.meta}>
        <Text
          numberOfLines={1}
          style={[styles.title, active && styles.activeText]}
        >
          {song.title || "Untitled"}
        </Text>

        <Text numberOfLines={1} style={styles.artist}>
          {songCredit(song)}
        </Text>
      </View>

      <PlayButton
        playing={isPlaying}
        active={active}
        onPress={active ? toggle : onPress}
      />

      {onRemove ? (
        <Pressable
          onPress={onRemove}
          hitSlop={10}
          style={({ pressed }) => [styles.remove, pressed && { opacity: 0.6 }]}
          accessibilityLabel={`${removeLabel}: ${song.title || "this song"}`}
        >
          <Ionicons name="close" size={20} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  pressed: {
    backgroundColor: colors.surfaceRaised,
  },
  index: {
    width: 22,
    fontSize: 13,
    color: colors.textFaint,
    textAlign: "center",
  },
  meta: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: "500",
    color: colors.text,
  },
  activeText: {
    color: "#e9175c",
  },
  artist: {
    fontSize: 13,
    color: colors.textMuted,
  },
  remove: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default SongRow;
