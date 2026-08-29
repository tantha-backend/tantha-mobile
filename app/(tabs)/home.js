import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import SongRow from "../../components/SongRow";
import { Artwork, Empty, Loading, Screen, SectionHeader } from "../../components/ui";
import { colors, radius, spacing, type, MINI_PLAYER_HEIGHT } from "../../lib/theme";
import {
  historyService,
  homeService,
  notificationService,
} from "../../lib/services";
import { formatCount, songArtwork, songCredit } from "../../lib/song";
import { usePlayer } from "../../lib/player";
import { useAuth } from "../../lib/auth";
import { errorMessage } from "../../lib/api";
import SongSheet from "../../components/SongSheet";

/**
 * A large tappable card used for the trending carousel.
 */
const SongCard = ({ song, onPress }) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
  >
    <Artwork
      uri={songArtwork(song)}
      size={148}
      rounded={radius.md}
      label={song.title}
    />
    <Text numberOfLines={1} style={styles.cardTitle}>
      {song.title || "Untitled"}
    </Text>
    <Text numberOfLines={1} style={styles.cardArtist}>
      {songCredit(song)}
    </Text>
  </Pressable>
);

/**
 * Like the artist carousel card, but with a rank badge and a streams count
 * instead of just the name, since this is a ranked chart.
 */
const BillboardCard = ({ artist, onPress }) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [styles.artistCard, pressed && { opacity: 0.85 }]}
  >
    <View style={styles.billboardAvatarWrap}>
      <Artwork
        uri={artist.profileImage}
        size={96}
        rounded={radius.pill}
        label={artist.stageName}
      />
      <View style={styles.rankBadge}>
        <Text style={styles.rankBadgeText}>{artist.rank}</Text>
      </View>
    </View>
    <Text numberOfLines={1} style={styles.artistName}>
      {artist.stageName || "Artist"}
    </Text>
    <Text numberOfLines={1} style={styles.billboardStreams}>
      {formatCount(artist.totalStreams)} streams
    </Text>
  </Pressable>
);

const Home = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { playSong, current } = usePlayer();

  const [feed, setFeed] = useState(null);
  const [sheetSong, setSheetSong] = useState(null);
  const [recentlyPlayed, setRecentlyPlayed] = useState([]);

  /**
   * Unread badge count. Re-read whenever the tab regains focus rather than
   * only on mount, so returning from the notifications screen clears it.
   */
  const [unread, setUnread] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      notificationService
        .unreadCount()
        .then((n) => {
          if (!cancelled) setUnread(n);
        })
        .catch(() => {
          // A missing count should never keep the home feed from rendering.
        });

      return () => {
        cancelled = true;
      };
    }, []),
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");

      // Recently played is per-user and lives on a separate endpoint, so a
      // hiccup there shouldn't blank out the rest of the home feed.
      const [feedRes, historyRes] = await Promise.allSettled([
        homeService.feed(),
        historyService.recent(),
      ]);

      if (feedRes.status === "fulfilled") setFeed(feedRes.value);
      else setError(errorMessage(feedRes.reason, "Could not load your feed"));

      if (historyRes.status === "fulfilled") setRecentlyPlayed(historyRes.value);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <Loading label="Loading your feed..." />;

  const trending = feed?.trendingSongs || [];
  const newReleases = feed?.newReleases || [];
  const mostLiked = feed?.mostLiked || [];
  const popular = feed?.popularSongs || [];
  const artists = feed?.trendingArtists || [];
  const billboard = feed?.billboardArtists || [];
  const playlists = feed?.playlists || [];

  // Recently played can repeat the same song across plays — the shelf shows
  // each track once, most-recent first (the API already sorts by playedAt).
  const recent = [];
  const seenRecent = new Set();
  for (const entry of recentlyPlayed) {
    const song = entry?.songId || entry;
    if (song?._id && !seenRecent.has(song._id)) {
      seenRecent.add(song._id);
      recent.push(song);
    }
  }

  const nothing =
    !trending.length &&
    !newReleases.length &&
    !mostLiked.length &&
    !popular.length &&
    !artists.length &&
    !billboard.length &&
    !recent.length;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + spacing.lg,
          paddingBottom: MINI_PLAYER_HEIGHT + spacing.xxl + (current ? spacing.lg : 0),
        }}
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
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={type.muted}>Welcome back</Text>
            <Text style={type.title}>{user?.name || "Listener"}</Text>
          </View>

          <Pressable
            onPress={() => router.push("/notifications")}
            hitSlop={10}
            style={({ pressed }) => [styles.bell, pressed && { opacity: 0.7 }]}
            accessibilityLabel={
              unread ? `Notifications, ${unread} unread` : "Notifications"
            }
          >
            <Ionicons name="notifications-outline" size={22} color={colors.text} />

            {/* Count rather than a plain dot, so it says how much is waiting. */}
            {unread > 0 ? (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>
                  {unread > 9 ? "9+" : unread}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {nothing && !error ? (
          <Empty
            title="Nothing here yet"
            subtitle="Once songs are published they'll show up on your home feed."
          />
        ) : null}

        {trending.length > 0 && (
          <>
            <SectionHeader title="Trending now" />
            <FlatList
              horizontal
              data={trending}
              keyExtractor={(item) => item._id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carousel}
              renderItem={({ item }) => (
                <SongCard
                  song={item}
                  onPress={() => playSong(item, trending)}
                />
              )}
            />
          </>
        )}
        {playlists.length > 0 && (
          <>
            <SectionHeader title="Playlists" />
            <FlatList
              horizontal
              data={playlists}
              keyExtractor={(item) => item._id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carousel}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => router.push(`/playlist/${item._id}`)}
                  style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
                >
                  <Artwork
                    uri={item.coverImage}
                    size={148}
                    rounded={radius.md}
                    label={item.title}
                  />
                  <Text numberOfLines={1} style={styles.cardTitle}>
                    {item.title}
                  </Text>
                  <Text numberOfLines={1} style={styles.cardArtist}>
                    {(item.songs?.length ?? 0)} songs
                  </Text>
                </Pressable>
              )}
            />
          </>
        )}


        {billboard.length > 0 && (
          <>
            <SectionHeader
              title="Billboard"
              action="See all"
              onAction={() => router.push("/billboard")}
            />
            <FlatList
              horizontal
              data={billboard}
              keyExtractor={(item) => item.artistId}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carousel}
              renderItem={({ item }) => (
                <BillboardCard
                  artist={item}
                  onPress={() => router.push(`/artist/${item.artistId}`)}
                />
              )}
            />
          </>
        )}

        {recent.length > 0 && (
          <>
            <SectionHeader title="Recently played" />
            <FlatList
              horizontal
              data={recent}
              keyExtractor={(item) => item._id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carousel}
              renderItem={({ item }) => (
                <SongCard
                  song={item}
                  onPress={() => playSong(item, recent)}
                />
              )}
            />
          </>
        )}

        {popular.length > 0 && (
          <>
            <SectionHeader
              title="Popular tracks"
              action="See all"
              onAction={() => router.push("/popular")}
            />
            <FlatList
              horizontal
              data={popular}
              keyExtractor={(item) => item._id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carousel}
              renderItem={({ item }) => (
                <SongCard
                  song={item}
                  onPress={() => playSong(item, popular)}
                />
              )}
            />
          </>
        )}

        {newReleases.length > 0 && (
          <>
            <SectionHeader title="New releases" />
            {newReleases.slice(0, 5).map((song) => (
              <SongRow
                key={song._id}
                song={song}
                onPress={() => playSong(song, newReleases)}
                onMore={() => setSheetSong(song)}
              />
            ))}
          </>
        )}

        {mostLiked.length > 0 && (
          <>
            <SectionHeader title="People's Choice" />
            <FlatList
              horizontal
              data={mostLiked}
              keyExtractor={(item) => item._id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carousel}
              renderItem={({ item }) => (
                <SongCard
                  song={item}
                  onPress={() => playSong(item, mostLiked)}
                />
              )}
            />
          </>
        )}

        {artists.length > 0 && (
          <>
            <SectionHeader title="Artists to follow" />
            <FlatList
              horizontal
              data={artists}
              keyExtractor={(item) => item._id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carousel}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => router.push(`/artist/${item._id}`)}
                  style={({ pressed }) => [
                    styles.artistCard,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Artwork
                    uri={item.profileImage}
                    size={96}
                    rounded={radius.pill}
                    label={item.stageName}
                  />
                  <Text numberOfLines={1} style={styles.artistName}>
                    {item.stageName || "Artist"}
                  </Text>
                </Pressable>
              )}
            />
          </>
        )}
      </ScrollView>
      <SongSheet
        song={sheetSong}
        onClose={() => setSheetSong(null)}
      />

    </Screen>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  bell: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  bellBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    // Keeps the badge legible where it overlaps the bell outline.
    borderWidth: 2,
    borderColor: colors.bg,
  },
  bellBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: colors.bg,
  },
  error: {
    marginTop: spacing.lg,
    marginHorizontal: spacing.lg,
    color: colors.danger,
    fontSize: 13,
  },
  carousel: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  card: {
    width: 148,
    gap: spacing.sm,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  cardArtist: {
    fontSize: 12,
    color: colors.textMuted,
  },
  artistCard: {
    width: 96,
    alignItems: "center",
    gap: spacing.sm,
  },
  artistName: {
    fontSize: 13,
    color: colors.text,
    textAlign: "center",
  },
  billboardAvatarWrap: {
    position: "relative",
  },
  rankBadge: {
    position: "absolute",
    // Kept inside the parent's bounds: Android clips anything that overflows,
    // which sliced the top off the badge. The artwork is a circle, so its
    // square corner is empty and the badge sits there without hiding a face.
    top: 0,
    left: 0,
    minWidth: 22,
    height: 22,
    borderRadius: radius.pill,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.bg,
  },
  rankBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.text,
  },
  billboardStreams: {
    fontSize: 11,
    color: colors.textFaint,
    textAlign: "center",
  },
});

export default Home;
