import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
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
import SongSheet from "../../components/SongSheet";

const { width: SCREEN_W } = Dimensions.get("window");

/**
 * Three artists across. Sized from the screen rather than fixed, so the row
 * fills the width on a small phone and a large one alike.
 */
const GRID_COLUMNS = 3;
const GRID_AVATAR = Math.floor(
  (SCREEN_W - spacing.lg * 2 - spacing.md * (GRID_COLUMNS - 1)) / GRID_COLUMNS,
);

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
  const [sheetSong, setSheetSong] = useState(null);
  const [songs, setSongs] = useState([]);
  const [artists, setArtists] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [recents, setRecents] = useState([]);

  /**
   * Artists to browse while the search box is empty.
   *
   * Verified only. The catalogue holds an account for everyone who has ever
   * been credited on a track, including one-off features and names imported
   * from filenames — a grid of all of them would be mostly strangers with no
   * photo. Verification is the mark of an artist with a real presence here,
   * which is exactly what belongs on a page for discovering people.
   *
   * Loaded once when the tab first opens rather than on every visit: the
   * roster changes when someone is verified, not between taps.
   */
  const [browseArtists, setBrowseArtists] = useState([]);

  useEffect(() => {
    let cancelled = false;

    artistService
      .all()
      .then((list) => {
        if (cancelled) return;

        const shown = list
          .filter((a) => a?._id && a.isVerified)
          // Most followed first, so the names people recognise lead.
          .sort((a, b) => (b.followersCount || 0) - (a.followersCount || 0));

        setBrowseArtists(shown.slice(0, 24));
      })
      .catch(() => {
        // The search box still works; there is simply nothing to browse.
      });

    return () => {
      cancelled = true;
    };
  }, []);

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
        <SongRow
          song={item}
          onPress={() => playSong(item, songs)}
          onMore={() => setSheetSong(item)}
        />
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
              ) : null}

              {/*
                Something to browse when there is nothing to show.

                An empty screen with a prompt on it asks people to already
                know what they want. Artists are the right thing to offer
                here: in this catalogue people look for the singer far more
                than the song title, and every artist has a face to
                recognise. Genre would have been the obvious alternative and
                would have been useless — nearly the whole catalogue is
                tagged "Pop", so every tile would lead to the same place.
              */}
              {browseArtists.length ? (
                <>
                  <Text style={[styles.sectionTitle, styles.browseHead]}>
                    Browse artists
                  </Text>

                  <View style={styles.grid}>
                    {browseArtists.map((artist) => (
                      <Pressable
                        key={artist._id}
                        onPress={() => router.push(`/artist/${artist._id}`)}
                        style={({ pressed }) => [
                          styles.gridItem,
                          pressed && { opacity: 0.7 },
                        ]}
                      >
                        <Artwork
                          uri={artist.profileImage}
                          size={GRID_AVATAR}
                          rounded={GRID_AVATAR / 2}
                          label={artist.stageName}
                        />
                        <Text numberOfLines={1} style={styles.gridName}>
                          {artist.stageName || "Artist"}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              ) : !recents.length ? (
                <View style={styles.hint}>
                  <Ionicons name="search" size={28} color={colors.textFaint} />
                  <Text style={styles.hintText}>
                    Find songs and artists by name.
                  </Text>
                </View>
              ) : null}
            </View>
          )
        }
      />
      <SongSheet
        song={sheetSong}
        onClose={() => setSheetSong(null)}
      />

    </Screen>
  );
};

const styles = StyleSheet.create({
  browseHead: {
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  gridItem: {
    width: GRID_AVATAR,
    alignItems: "center",
  },
  gridName: {
    marginTop: spacing.sm,
    fontSize: 12,
    fontWeight: "600",
    color: colors.text,
    textAlign: "center",
  },
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
