import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import SongRow from "../../components/SongRow";
import { Artwork, Empty, Screen } from "../../components/ui";
import { colors, radius, spacing, type, MINI_PLAYER_HEIGHT } from "../../lib/theme";
import { artistService, songService } from "../../lib/services";
import { usePlayer } from "../../lib/player";

const MIN_CHARS = 2;
const DEBOUNCE_MS = 300;
const RECENTS_MAX = 8;

const ArtistRow = ({ artist, onPress }) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [
      styles.artistRow,
      pressed && { backgroundColor: colors.surfaceRaised },
    ]}
  >
    <Artwork
      uri={artist.profileImage}
      size={48}
      rounded={radius.pill}
      label={artist.stageName}
    />

    <View style={{ flex: 1 }}>
      <Text numberOfLines={1} style={styles.artistName}>
        {artist.stageName || "Artist"}
      </Text>
      <Text style={styles.artistMeta}>Artist</Text>
    </View>

    <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
  </Pressable>
);

const Search = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { playSong } = usePlayer();

  const [query, setQuery] = useState("");
  const [songs, setSongs] = useState([]);
  const [artists, setArtists] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [recents, setRecents] = useState([]);

  const inputRef = useRef(null);

  /**
   * Only the newest search may write results. Without this a slow request for
   * "th" can land after a fast one for "thamoi" and replace the right results
   * with stale ones.
   */
  const runId = useRef(0);

  const remember = useCallback((term) => {
    setRecents((prev) =>
      [term, ...prev.filter((t) => t.toLowerCase() !== term.toLowerCase())].slice(
        0,
        RECENTS_MAX,
      ),
    );
  }, []);

  useEffect(() => {
    const term = query.trim();

    if (term.length < MIN_CHARS) {
      runId.current += 1;          // cancel anything in flight
      setSongs([]);
      setArtists([]);
      setSearching(false);
      setSearched(false);
      return;
    }

    const id = ++runId.current;
    setSearching(true);

    const timer = setTimeout(async () => {
      const [songResults, artistResults] = await Promise.all([
        songService.search(term).catch(() => []),
        artistService.search(term).catch(() => []),
      ]);

      if (id !== runId.current) return;

      setSongs(songResults);
      setArtists(artistResults);
      setSearching(false);
      setSearched(true);

      if (songResults.length || artistResults.length) remember(term);
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, remember]);

  // Built once per result set rather than on every render, so scrolling a
  // long list does not rebuild the section arrays each frame.
  const sections = useMemo(() => {
    const out = [];
    if (artists.length) out.push({ title: "Artists", data: artists, kind: "artist" });
    if (songs.length) out.push({ title: "Songs", data: songs, kind: "song" });
    return out;
  }, [artists, songs]);

  const clear = () => {
    setQuery("");
    inputRef.current?.focus();
  };

  const nothingFound =
    searched && !searching && !songs.length && !artists.length;

  const renderItem = useCallback(
    ({ item, section }) =>
      section.kind === "artist" ? (
        <ArtistRow
          artist={item}
          onPress={() => {
            Keyboard.dismiss();
            router.push(`/artist/${item._id}`);
          }}
        />
      ) : (
        <SongRow song={item} onPress={() => playSong(item, songs)} />
      ),
    [router, playSong, songs],
  );

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
        <Text style={type.title}>Search</Text>

        <View style={styles.inputWrap}>
          <Ionicons name="search" size={18} color={colors.textFaint} />

          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            placeholder="Songs, artists, albums..."
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            style={styles.input}
          />

          {searching ? (
            <ActivityIndicator size="small" color={colors.textFaint} />
          ) : query.length ? (
            <Pressable onPress={clear} hitSlop={10}>
              <Ionicons name="close-circle" size={18} color={colors.textFaint} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionCount}>{section.data.length}</Text>
          </View>
        )}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{
          paddingBottom: MINI_PLAYER_HEIGHT + spacing.xxl,
        }}
        // Keeps memory flat on long result sets instead of mounting every row.
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={7}
        removeClippedSubviews
        ListEmptyComponent={
          nothingFound ? (
            <Empty
              title="No matches"
              subtitle={`Nothing found for "${query.trim()}".`}
            />
          ) : query.trim().length >= MIN_CHARS ? null : (
            <View style={styles.idle}>
              {recents.length ? (
                <>
                  <View style={styles.recentHead}>
                    <Text style={styles.sectionTitle}>Recent searches</Text>
                    <Pressable onPress={() => setRecents([])} hitSlop={8}>
                      <Text style={styles.clearAll}>CLEAR</Text>
                    </Pressable>
                  </View>

                  {recents.map((term) => (
                    <Pressable
                      key={term}
                      onPress={() => setQuery(term)}
                      style={({ pressed }) => [
                        styles.recentRow,
                        pressed && { backgroundColor: colors.surfaceRaised },
                      ]}
                    >
                      <Ionicons name="time-outline" size={18} color={colors.textFaint} />
                      <Text style={styles.recentText}>{term}</Text>
                      <Ionicons name="arrow-up-outline" size={16} color={colors.textFaint} />
                    </Pressable>
                  ))}
                </>
              ) : (
                <View style={styles.hint}>
                  <Ionicons name="search" size={28} color={colors.textFaint} />
                  <Text style={styles.hintText}>
                    Find songs and artists by name.
                  </Text>
                </View>
              )}
            </View>
          )
        }
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.md,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    height: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    padding: 0,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
  },
  sectionCount: {
    fontSize: 13,
    color: colors.textFaint,
  },
  artistRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  artistName: {
    fontSize: 15,
    fontWeight: "500",
    color: colors.text,
  },
  artistMeta: {
    fontSize: 12,
    color: colors.textMuted,
  },
  idle: {
    paddingTop: spacing.md,
  },
  recentHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  clearAll: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    color: colors.textMuted,
  },
  recentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  recentText: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
  },
  hint: {
    paddingTop: spacing.xxl * 2,
    alignItems: "center",
    gap: spacing.md,
  },
  hintText: {
    color: colors.textMuted,
    fontSize: 14,
  },
});

export default Search;
