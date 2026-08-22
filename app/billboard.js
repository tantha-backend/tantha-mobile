import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Artwork, Empty, Loading, Screen } from "../components/ui";
import { colors, radius, spacing, type, MINI_PLAYER_HEIGHT } from "../lib/theme";
import { artistService } from "../lib/services";
import { formatCount } from "../lib/song";
import { errorMessage } from "../lib/api";

const BillboardRow = ({ artist, onPress }) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
  >
    <Text style={styles.rank}>{artist.rank}</Text>

    <Artwork
      uri={artist.profileImage}
      size={48}
      rounded={radius.pill}
      label={artist.stageName}
    />

    <View style={styles.meta}>
      <Text numberOfLines={1} style={styles.name}>
        {artist.stageName || "Artist"}
        {artist.isVerified ? <Text style={styles.verified}>  ✓</Text> : null}
      </Text>
      <Text numberOfLines={1} style={styles.sub}>
        {formatCount(artist.followersCount)} followers
      </Text>
    </View>

    <View style={styles.streamsWrap}>
      <Text style={styles.streams}>{formatCount(artist.totalStreams)}</Text>
      <Text style={styles.streamsLabel}>streams</Text>
    </View>
  </Pressable>
);

const BillboardScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [artists, setArtists] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setError("");

        const res = await artistService.billboard(1, 20);

        setArtists(res.artists);
        setPage(res.page);
        setTotalPages(res.totalPages);
      } catch (err) {
        setError(errorMessage(err, "Could not load the billboard"));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || page >= totalPages) return;

    setLoadingMore(true);

    try {
      const res = await artistService.billboard(page + 1, 20);

      /**
       * Dropped if already shown. The server now sorts on a unique tiebreak
       * so pages should not overlap, but ranking is computed from live play
       * counts — a repeat would give two rows the same React key, and React
       * may then drop or duplicate rows rather than just look untidy.
       */
      setArtists((prev) => {
        const seen = new Set(prev.map((a) => String(a.artistId)));
        return [...prev, ...res.artists.filter((a) => !seen.has(String(a.artistId)))];
      });
      setPage(res.page);
      setTotalPages(res.totalPages);
    } catch {
      // A failed page-2+ fetch just stops pagination; the list so far stays usable.
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, page, totalPages]);

  if (loading) return <Loading label="Loading the billboard..." />;

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Text style={type.title}>Billboard</Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={artists}
        keyExtractor={(item) => item.artistId}
        contentContainerStyle={{
          paddingTop: spacing.lg,
          paddingBottom: MINI_PLAYER_HEIGHT + spacing.xxl,
        }}
        renderItem={({ item }) => (
          <BillboardRow
            artist={item}
            onPress={() => router.push(`/artist/${item.artistId}`)}
          />
        )}
        onEndReachedThreshold={0.4}
        onEndReached={loadMore}
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator
              color={colors.accent}
              style={{ marginVertical: spacing.lg }}
            />
          ) : null
        }
        ListEmptyComponent={
          <Empty
            title="Nothing here yet"
            subtitle="Once songs are played, artists will rank here."
          />
        }
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
    paddingBottom: spacing.sm,
  },
  back: {
    fontSize: 34,
    lineHeight: 36,
    color: colors.text,
  },
  error: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    color: colors.danger,
    fontSize: 13,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  rowPressed: {
    backgroundColor: colors.surfaceRaised,
  },
  rank: {
    width: 26,
    fontSize: 15,
    fontWeight: "700",
    color: colors.textFaint,
    textAlign: "center",
  },
  meta: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 15,
    fontWeight: "500",
    color: colors.text,
  },
  verified: {
    color: colors.success,
    fontSize: 13,
  },
  sub: {
    fontSize: 12,
    color: colors.textMuted,
  },
  streamsWrap: {
    alignItems: "flex-end",
  },
  streams: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.accent,
  },
  streamsLabel: {
    fontSize: 11,
    color: colors.textFaint,
  },
});

export default BillboardScreen;
