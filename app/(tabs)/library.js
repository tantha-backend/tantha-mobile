import { useCallback, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import SongRow from "../../components/SongRow";
import {
  Artwork,
  Empty,
  Loading,
  Screen,
  SectionHeader,
  Toast,
} from "../../components/ui";
import { colors, radius, spacing, type, MINI_PLAYER_HEIGHT } from "../../lib/theme";
import { historyService, playlistService, songService } from "../../lib/services";
import { usePlayer } from "../../lib/player";
import { errorMessage } from "../../lib/api";
import SongSheet from "../../components/SongSheet";

const TABS = ["Liked", "Playlists", "History"];

const Library = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { playSong } = usePlayer();

  const [tab, setTab] = useState("Liked");
  const [sheetSong, setSheetSong] = useState(null);
  const [liked, setLiked] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);

  const load = useCallback(async () => {
    try {
      setError("");

      // One failure should not blank the whole screen.
      const [likedRes, playlistRes, historyRes] = await Promise.allSettled([
        songService.liked(),
        playlistService.mine(),
        historyService.recent(),
      ]);

      if (likedRes.status === "fulfilled") setLiked(likedRes.value);
      if (playlistRes.status === "fulfilled") setPlaylists(playlistRes.value);
      if (historyRes.status === "fulfilled") setHistory(historyRes.value);

      const failed = [likedRes, playlistRes, historyRes].find(
        (r) => r.status === "rejected",
      );

      if (failed) setError(errorMessage(failed.reason, "Some items failed to load"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Refreshes on every visit so a like made elsewhere shows immediately.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  /**
   * Removing is done optimistically: the row goes at once and is put back if
   * the server refuses. Waiting on a round trip to make a row disappear makes
   * a list feel broken, and the failure is rare enough to be worth undoing.
   */
  const unlike = async (song) => {
    const before = liked;
    setLiked((rows) => rows.filter((s) => s._id !== song._id));

    try {
      await songService.like(song._id);
    } catch (err) {
      setLiked(before);
      setToast({
        text: errorMessage(err, "Couldn't remove that"),
        tone: "error",
      });
    }
  };

  /**
   * Deleting a playlist asks first.
   *
   * Unlike removing one song, this throws away a list someone built, and
   * nothing in the app can put it back — so it is the one removal here that
   * is worth a question. The others are cheap enough to just do.
   */
  const deletePlaylist = (playlist) => {
    Alert.alert(
      `Delete "${playlist.title || "this playlist"}"?`,
      "The songs stay in the app — only the playlist goes.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const before = playlists;
            setPlaylists((rows) => rows.filter((p) => p._id !== playlist._id));

            try {
              await playlistService.remove(playlist._id);
              setToast({ text: `Deleted ${playlist.title}`, tone: "success" });
            } catch (err) {
              setPlaylists(before);
              setToast({
                text: errorMessage(err, "Couldn't delete that playlist"),
                tone: "error",
              });
            }
          },
        },
      ],
    );
  };

  const forget = async (song) => {
    const before = history;
    setHistory((rows) =>
      rows.filter((entry) => (entry?.songId?._id || entry?._id) !== song._id),
    );

    try {
      await historyService.remove(song._id);
    } catch (err) {
      setHistory(before);
      setToast({
        text: errorMessage(err, "Couldn't remove that"),
        tone: "error",
      });
    }
  };

  if (loading) return <Loading label="Loading your library..." />;

  /**
   * History entries may be the play record ({ songId: {...} }) or the song
   * itself, depending on the endpoint.
   */
  const historySongs = history
    .map((entry) => entry?.songId || entry)
    .filter((song) => song && song._id);

  return (
    <Screen>
      <View style={{ paddingTop: insets.top + spacing.lg }}>
        <View style={styles.headingRow}>
          <Text style={[type.title, styles.heading]}>Your Library</Text>

          {/* Only offered on the tab it acts on, so it never looks like it
              would create a playlist out of the liked or history list. */}
          {tab === "Playlists" ? (
            <Pressable
              onPress={() => router.push("/playlist/new")}
              hitSlop={10}
              style={({ pressed }) => [styles.newButton, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="add" size={18} color={colors.bg} />
              <Text style={styles.newLabel}>New</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.tabs}>
          {TABS.map((name) => (
            <Pressable
              key={name}
              onPress={() => setTab(name)}
              style={[styles.tab, tab === name && styles.tabActive]}
            >
              <Text style={[styles.tabLabel, tab === name && styles.tabLabelActive]}>
                {name}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: MINI_PLAYER_HEIGHT + spacing.xxl }}
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
      >
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {tab === "Liked" &&
          (liked.length ? (
            liked.map((song) => (
              <SongRow
                key={song._id}
                song={song}
                onPress={() => playSong(song, liked)}
                onMore={() => setSheetSong(song)}
                onRemove={() => unlike(song)}
                removeLabel="Remove from liked songs"
              />
            ))
          ) : (
            <Empty
              title="No liked songs"
              subtitle="Tap the heart on a track to save it here."
            />
          ))}

        {tab === "Playlists" &&
          (playlists.length ? (
            <>
              <SectionHeader title={`${playlists.length} playlist${playlists.length === 1 ? "" : "s"}`} />
              {playlists.map((playlist) => (
                <Pressable
                  key={playlist._id}
                  onPress={() => router.push(`/playlist/${playlist._id}`)}
                  style={({ pressed }) => [
                    styles.playlistRow,
                    pressed && { backgroundColor: colors.surfaceRaised },
                  ]}
                >
                  <Artwork
                    uri={playlist.coverImage}
                    size={52}
                    rounded={radius.sm}
                    label={playlist.title}
                  />
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={styles.playlistTitle}>
                      {playlist.title || "Untitled playlist"}
                    </Text>
                    <Text style={styles.playlistMeta}>
                      {(playlist.songs?.length ?? 0)} songs
                    </Text>
                  </View>

                  <Pressable
                    onPress={() => deletePlaylist(playlist)}
                    hitSlop={10}
                    style={({ pressed }) => [
                      styles.deletePlaylist,
                      pressed && { opacity: 0.6 },
                    ]}
                    accessibilityLabel={`Delete playlist ${playlist.title || ""}`}
                  >
                    <Ionicons name="trash-outline" size={19} color={colors.textMuted} />
                  </Pressable>
                </Pressable>
              ))}
            </>
          ) : (
            <View>
              <Empty
                title="No playlists yet"
                subtitle="Make one and add the songs you keep coming back to."
              />

              {/* The empty state is where someone with no playlists is
                  standing, so the way out belongs here too. */}
              <Pressable
                onPress={() => router.push("/playlist/new")}
                style={({ pressed }) => [
                  styles.emptyAction,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Ionicons name="add" size={18} color={colors.bg} />
                <Text style={styles.newLabel}>Create a playlist</Text>
              </Pressable>
            </View>
          ))}

        {tab === "History" &&
          (historySongs.length ? (
            historySongs.map((song, i) => (
              <SongRow
                key={`${song._id}-${i}`}
                song={song}
                onPress={() => playSong(song, historySongs)}
                onMore={() => setSheetSong(song)}
                onRemove={() => forget(song)}
                removeLabel="Remove from history"
              />
            ))
          ) : (
            <Empty
              title="Nothing played yet"
              subtitle="Tracks you listen to will show up here."
            />
          ))}
      </ScrollView>

      <Toast
        message={toast?.text}
        tone={toast?.tone}
        onHide={() => setToast(null)}
        offset={MINI_PLAYER_HEIGHT + spacing.lg}
      />
      <SongSheet
        song={sheetSong}
        onClose={() => setSheetSong(null)}
        onToast={setToast}
      />

    </Screen>
  );
};

const styles = StyleSheet.create({
  headingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingRight: spacing.lg,
  },
  heading: {
    paddingHorizontal: spacing.lg,
  },
  newButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    height: 34,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  newLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.bg,
  },
  emptyAction: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    height: 44,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  tabs: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  tab: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: {
    backgroundColor: colors.accentDim,
    borderColor: colors.accent,
  },
  tabLabel: {
    fontSize: 13,
    color: colors.textMuted,
  },
  tabLabelActive: {
    color: colors.accent,
    fontWeight: "600",
  },
  error: {
    padding: spacing.lg,
    color: colors.danger,
    fontSize: 13,
  },
  deletePlaylist: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  playlistRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  playlistTitle: {
    fontSize: 15,
    fontWeight: "500",
    color: colors.text,
  },
  playlistMeta: {
    fontSize: 12,
    color: colors.textMuted,
  },
});

export default Library;
