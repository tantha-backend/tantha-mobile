import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import SongRow from "../../components/SongRow";
import { Artwork, Button, Empty, Loading, Screen } from "../../components/ui";
import { colors, radius, spacing, type, MINI_PLAYER_HEIGHT } from "../../lib/theme";
import { albumService } from "../../lib/services";
import { artistName } from "../../lib/song";
import { usePlayer } from "../../lib/player";
import { errorMessage } from "../../lib/api";

const AlbumScreen = () => {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { playSong } = usePlayer();

  const [album, setAlbum] = useState(null);
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        // Tracks come from a separate endpoint, so fetch both together.
        const [albumData, songData] = await Promise.all([
          albumService.byId(id),
          albumService.songs(id).catch(() => []),
        ]);

        setAlbum(albumData);
        setSongs(songData);
      } catch (err) {
        setError(errorMessage(err, "Could not load this album"));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id]);

  if (loading) return <Loading label="Loading album..." />;

  if (error || !album) {
    return (
      <Screen>
        <View style={styles.centered}>
          <Empty title="Album unavailable" subtitle={error} />
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text style={styles.link}>Go back</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

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
            uri={album.coverImage}
            size={170}
            rounded={radius.md}
            label={album.title}
          />

          <Text style={styles.title}>{album.title || "Untitled album"}</Text>

          <Text style={type.muted}>
            {artistName(album.artistId) || "Unknown artist"}
            {album.releaseDate
              ? ` · ${new Date(album.releaseDate).getFullYear()}`
              : ""}
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
            />
          ))
        ) : (
          <Empty title="No tracks" subtitle="This album has no published songs." />
        )}
      </ScrollView>
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

export default AlbumScreen;
