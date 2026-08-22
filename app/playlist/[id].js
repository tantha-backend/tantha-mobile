import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import SongRow from "../../components/SongRow";
import { Artwork, Button, Empty, Loading, Screen, Toast } from "../../components/ui";
import { colors, radius, spacing, type, MINI_PLAYER_HEIGHT } from "../../lib/theme";
import { playlistService } from "../../lib/services";
import { formatDuration } from "../../lib/song";
import { usePlayer } from "../../lib/player";
import { errorMessage } from "../../lib/api";

const PlaylistScreen = () => {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { playSong } = usePlayer();

  const [playlist, setPlaylist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        setPlaylist(await playlistService.byId(id));
      } catch (err) {
        setError(errorMessage(err, "Could not load this playlist"));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id]);

  /**
   * Optimistic, like the library lists: the row goes at once and comes back
   * if the server refuses. Waiting on a round trip to make a row disappear
   * makes a list feel broken.
   */
  const removeFromPlaylist = async (song) => {
    const before = playlist;

    setPlaylist((p) => ({
      ...p,
      songs: (p.songs || []).filter((s) => s._id !== song._id),
    }));

    try {
      await playlistService.removeSong(id, song._id);
      setToast({ text: `Removed ${song.title}`, tone: "success" });
    } catch (err) {
      setPlaylist(before);
      setToast({ text: errorMessage(err, "Couldn't remove that"), tone: "error" });
    }
  };

  if (loading) return <Loading label="Loading playlist..." />;

  if (error || !playlist) {
    return (
      <Screen>
        <View style={styles.centered}>
          <Empty title="Playlist unavailable" subtitle={error} />
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text style={styles.link}>Go back</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const songs = (playlist.songs || []).filter((s) => s && s._id);

  const totalSeconds = songs.reduce((sum, s) => sum + (s.duration || 0), 0);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ paddingBottom: MINI_PLAYER_HEIGHT + spacing.xxl }}
      >
        <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.back}>‹</Text>
          </Pressable>
        </View>

        <View style={styles.hero}>
          <Artwork
            uri={playlist.coverImage}
            size={160}
            rounded={radius.md}
            label={playlist.title}
          />

          <Text style={styles.title}>{playlist.title || "Untitled playlist"}</Text>

          {playlist.description ? (
            <Text numberOfLines={3} style={styles.description}>
              {playlist.description}
            </Text>
          ) : null}

          <Text style={type.muted}>
            {songs.length} songs · {formatDuration(totalSeconds)}
          </Text>

          {songs.length > 0 && (
            <Button
              label="Play"
              onPress={() => playSong(songs[0], songs)}
              style={styles.playButton}
            />
          )}
        </View>

        {songs.length ? (
          songs.map((song, i) => (
            <SongRow
              key={song._id}
              song={song}
              index={i}
              onPress={() => playSong(song, songs)}
              onRemove={() => removeFromPlaylist(song)}
              removeLabel="Remove from this playlist"
            />
          ))
        ) : (
          <Empty
            title="This playlist is empty"
            subtitle="Add songs to it from any track."
          />
        )}
      </ScrollView>

      <Toast
        message={toast?.text}
        tone={toast?.tone}
        onHide={() => setToast(null)}
        offset={MINI_PLAYER_HEIGHT + spacing.lg}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg },
  back: {
    fontSize: 34,
    lineHeight: 36,
    color: colors.text,
  },
  hero: {
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
    marginTop: spacing.md,
  },
  description: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
  },
  playButton: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xxl,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  link: {
    color: colors.accent,
    fontWeight: "600",
  },
});

export default PlaylistScreen;
