import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import BottomSheet from "./BottomSheet";
import { Artwork } from "./ui";
import { colors, radius, spacing } from "../lib/theme";
import { songArtwork, songCredit } from "../lib/song";
import { playlistService } from "../lib/services";
import { usePlayer } from "../lib/player";
import { errorMessage } from "../lib/api";

/**
 * The menu behind a song's "..." button.
 *
 * The panel chrome lives in BottomSheet; this is only what goes inside it.
 *
 * The toast reporting the result belongs to the parent, not here: "Added to
 * X" is useless if it vanishes with the panel that triggered it, so feedback
 * leaves through onToast.
 */
const SongSheet = ({
  song,
  onClose,
  // Defaults to a no-op so a screen with nowhere to put a toast can still
  // offer the sheet, rather than crashing the first time someone likes a
  // track from it.
  onToast = () => {},
  showArtistLink = true,
}) => {
  const router = useRouter();
  const { isLiked, toggleLike } = usePlayer();

  // null until the playlist step is opened, so nothing is fetched for someone
  // who only wanted to share.
  const [playlists, setPlaylists] = useState(undefined);
  const [addingTo, setAddingTo] = useState(null);
  const [likeBusy, setLikeBusy] = useState(false);

  if (!song) return null;

  const liked = isLiked(song._id);
  /**
   * Only a verified artist has a page, so only a verified artist gets the
   * row. An unverified credit is a name on a track, not a place to go.
   */
  const artistId =
    typeof song.artistId === "string"
      ? null
      : song.artistId?.isVerified
        ? song.artistId?._id
        : null;

  const close = () => {
    setPlaylists(undefined);
    setAddingTo(null);
    onClose();
  };

  const onLike = async () => {
    setLikeBusy(true);

    try {
      const nowLiked = await toggleLike(song._id);
      close();
      onToast({
        text: nowLiked ? "Added to Liked songs" : "Removed from Liked songs",
        tone: "success",
      });
    } catch {
      onToast({ text: "Couldn't save that", tone: "error" });
    } finally {
      setLikeBusy(false);
    }
  };

  const openPlaylists = async () => {
    setPlaylists(null);

    try {
      setPlaylists(await playlistService.mine());
    } catch {
      setPlaylists([]);
    }
  };

  const addToPlaylist = async (playlist) => {
    setAddingTo(playlist._id);

    try {
      await playlistService.addSong(playlist._id, song._id);
      close();
      onToast({ text: `Added to ${playlist.title}`, tone: "success" });
    } catch (err) {
      onToast({
        text: errorMessage(err, "Couldn't add to that playlist"),
        tone: "error",
      });
    } finally {
      setAddingTo(null);
    }
  };

  const share = () => {
    close();
    Share.share({
      message: `${song.title} — ${songCredit(song)} on Tantha Music`,
    }).catch(() => {});
  };

  const openArtist = () => {
    close();
    router.push(`/artist/${artistId}`);
  };

  // Carries the song, so creating the playlist puts it in rather than
  // leaving the listener to come back and add it by hand.
  const newPlaylist = () => {
    close();
    router.push(`/playlist/new?songId=${song._id}`);
  };

  const picking = playlists !== undefined;

  return (
    <BottomSheet visible onClose={close}>
      <View style={styles.header}>
        <Artwork
          uri={songArtwork(song)}
          size={48}
          rounded={radius.sm}
          label={song.title}
        />

        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={styles.title}>
            {song.title || "Untitled"}
          </Text>
          <Text numberOfLines={1} style={styles.credit}>
            {songCredit(song)}
          </Text>
        </View>

        {picking ? (
          <Pressable onPress={() => setPlaylists(undefined)} hitSlop={12}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
        ) : (
          <Pressable onPress={close} hitSlop={12}>
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>
        )}
      </View>

      <View style={styles.divider} />

      {picking ? (
        <PlaylistPicker
          playlists={playlists}
          addingTo={addingTo}
          onPick={addToPlaylist}
          onNew={newPlaylist}
        />
      ) : (
        <View style={styles.actions}>
          <Action
            icon={liked ? "heart" : "heart-outline"}
            tint={liked ? colors.accent : colors.text}
            label={liked ? "Remove from Liked songs" : "Add to Liked songs"}
            busy={likeBusy}
            onPress={onLike}
          />
          <Action
            icon="add-circle-outline"
            label="Add to playlist"
            onPress={openPlaylists}
          />
          <Action icon="share-outline" label="Share" onPress={share} />
          {showArtistLink && artistId ? (
            <Action
              icon="person-outline"
              label="Go to artist"
              onPress={openArtist}
            />
          ) : null}
        </View>
      )}
    </BottomSheet>
  );
};

const Action = ({ icon, label, onPress, busy, tint = colors.text }) => (
  <Pressable
    onPress={onPress}
    disabled={busy}
    style={({ pressed }) => [
      styles.action,
      pressed && { backgroundColor: colors.surfaceRaised },
    ]}
  >
    {busy ? (
      <ActivityIndicator color={colors.text} size="small" style={styles.icon} />
    ) : (
      <Ionicons name={icon} size={22} color={tint} style={styles.icon} />
    )}
    <Text style={[styles.actionLabel, { color: tint }]}>{label}</Text>
  </Pressable>
);

/** The second step: which playlist to add it to. */
const PlaylistPicker = ({ playlists, addingTo, onPick, onNew }) => {
  if (playlists === null) {
    return (
      <View style={styles.empty}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (playlists.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="list-outline" size={30} color={colors.textFaint} />
        <Text style={styles.emptyText}>
          You haven&apos;t made a playlist yet.
        </Text>

        <Pressable
          onPress={onNew}
          style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
        >
          <Ionicons name="add" size={18} color={colors.bg} />
          <Text style={styles.ctaLabel}>New playlist</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <FlatList
      data={playlists}
      keyExtractor={(item) => item._id}
      style={styles.list}
      contentContainerStyle={{ paddingBottom: spacing.lg }}
      ListHeaderComponent={
        <Pressable
          onPress={onNew}
          style={({ pressed }) => [
            styles.action,
            pressed && { backgroundColor: colors.surfaceRaised },
          ]}
        >
          <Ionicons
            name="add-circle-outline"
            size={22}
            color={colors.accent}
            style={styles.icon}
          />
          <Text style={[styles.actionLabel, { color: colors.accent }]}>
            New playlist
          </Text>
        </Pressable>
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={() => onPick(item)}
          disabled={Boolean(addingTo)}
          style={({ pressed }) => [
            styles.action,
            pressed && { backgroundColor: colors.surfaceRaised },
          ]}
        >
          <Artwork
            uri={item.coverImage}
            size={40}
            rounded={radius.sm}
            label={item.title}
          />

          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text numberOfLines={1} style={styles.actionLabel}>
              {item.title}
            </Text>
            <Text style={styles.credit}>{item.songs?.length || 0} songs</Text>
          </View>

          {addingTo === item._id ? (
            <ActivityIndicator color={colors.accent} size="small" />
          ) : null}
        </Pressable>
      )}
    />
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  credit: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  actions: {
    paddingTop: spacing.xs,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  icon: {
    width: 22,
    marginRight: spacing.md,
    textAlign: "center",
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  list: {
    paddingTop: spacing.xs,
  },
  empty: {
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  ctaLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.bg,
  },
});

export default SongSheet;
