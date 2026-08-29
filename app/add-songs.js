import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";

import { Artwork, Empty, Screen, Toast } from "../components/ui";
import { colors, radius, spacing, type } from "../lib/theme";
import { playlistService, songService } from "../lib/services";
import { songArtwork, songCredit } from "../lib/song";
import { errorMessage } from "../lib/api";

/** Long enough that a fast typist is not searching on every keystroke. */
const DEBOUNCE_MS = 300;

/**
 * Search for songs and add them to a playlist without leaving it.
 *
 * The only way to fill a playlist used to be from a song's own menu, which
 * meant finding the song somewhere else first — fine for adding one track you
 * are already looking at, useless for filling a playlist you have just made.
 *
 * Added rows stay where they are and turn into a tick rather than
 * disappearing, so adding several in a row does not shuffle the list under
 * your finger. What the playlist already holds is loaded up front, so songs
 * in it are shown as added rather than being offered again.
 */
const AddSongs = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { playlistId, title } = useLocalSearchParams();

  const [query, setQuery] = useState("");
  const [songs, setSongs] = useState([]);
  const [searching, setSearching] = useState(false);

  const [added, setAdded] = useState(() => new Set());
  const [busyId, setBusyId] = useState(null);
  const [toast, setToast] = useState(null);

  const inputRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await playlistService.byId(String(playlistId));
        const ids = (res?.playlist?.songs || res?.songs || [])
          .filter(Boolean)
          .map((s) => s._id);

        if (!cancelled) setAdded(new Set(ids));
      } catch {
        // Not worth blocking the search over. The worst case is that a song
        // already in the playlist is offered again, and adding it twice is
        // something the server already refuses.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [playlistId]);

  useEffect(() => {
    const term = query.trim();

    if (!term) {
      setSongs([]);
      setSearching(false);
      return undefined;
    }

    setSearching(true);

    const timer = setTimeout(async () => {
      try {
        setSongs(await songService.search(term));
      } catch {
        setSongs([]);
      } finally {
        setSearching(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  const add = useCallback(
    async (song) => {
      if (added.has(song._id) || busyId) return;

      setBusyId(song._id);

      try {
        await playlistService.addSong(String(playlistId), song._id);

        setAdded((prev) => new Set(prev).add(song._id));
        setToast({ text: "Added " + song.title, tone: "success" });
      } catch (err) {
        setToast({
          text: errorMessage(err, "Couldn't add that song"),
          tone: "error",
        });
      } finally {
        setBusyId(null);
      }
    },
    [added, busyId, playlistId],
  );

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>‹</Text>
        </Pressable>

        <View style={styles.headerText}>
          <Text style={styles.title}>Add songs</Text>
          {title ? (
            <Text numberOfLines={1} style={type.muted}>
              to {title}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={colors.textFaint} />

        <TextInput
          ref={inputRef}
          value={query}
          onChangeText={setQuery}
          placeholder="Search for a song..."
          placeholderTextColor={colors.textFaint}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          returnKeyType="search"
          style={styles.input}
        />

        {query ? (
          <Pressable onPress={() => setQuery("")} hitSlop={10}>
            <Ionicons name="close-circle" size={18} color={colors.textFaint} />
          </Pressable>
        ) : null}
      </View>

      <FlatList
        data={songs}
        keyExtractor={(item) => item._id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}
        renderItem={({ item }) => {
          const isAdded = added.has(item._id);
          const busy = busyId === item._id;

          return (
            <Pressable
              onPress={() => add(item)}
              disabled={isAdded || busy}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              accessibilityLabel={
                isAdded
                  ? item.title + " is already in this playlist"
                  : "Add " + item.title
              }
            >
              <Artwork
                uri={songArtwork(item)}
                size={48}
                rounded={radius.sm}
                label={item.title}
              />

              <View style={styles.meta}>
                <Text numberOfLines={1} style={styles.songTitle}>
                  {item.title || "Untitled"}
                </Text>
                <Text numberOfLines={1} style={styles.artist}>
                  {songCredit(item)}
                </Text>
              </View>

              {busy ? (
                <ActivityIndicator color={colors.accent} />
              ) : (
                <Ionicons
                  name={isAdded ? "checkmark-circle" : "add-circle-outline"}
                  size={26}
                  color={isAdded ? colors.accent : colors.text}
                />
              )}
            </Pressable>
          );
        }}
        ListEmptyComponent={
          searching ? (
            <View style={styles.centered}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : query.trim() ? (
            <Empty
              title="Nothing found"
              subtitle="Try a different spelling, or search for the artist."
            />
          ) : (
            <Empty
              title="Find songs to add"
              subtitle="Search by song or artist name."
            />
          )
        }
      />

      <Toast
        message={toast?.text}
        tone={toast?.tone}
        onHide={() => setToast(null)}
        offset={spacing.xl}
      />
    </Screen>
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
  headerText: {
    flex: 1,
  },
  back: {
    fontSize: 34,
    lineHeight: 36,
    color: colors.text,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.text,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    padding: 0,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  pressed: {
    backgroundColor: colors.surfaceRaised,
  },
  meta: {
    flex: 1,
    gap: 2,
  },
  songTitle: {
    fontSize: 15,
    fontWeight: "500",
    color: colors.text,
  },
  artist: {
    fontSize: 13,
    color: colors.textMuted,
  },
  centered: {
    paddingTop: spacing.xxl,
    alignItems: "center",
  },
});

export default AddSongs;
