import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import SongRow from "../components/SongRow";
import { Empty, Loading, Screen } from "../components/ui";
import { colors, spacing, type, MINI_PLAYER_HEIGHT } from "../lib/theme";
import { songService } from "../lib/services";
import { usePlayer } from "../lib/player";
import { errorMessage } from "../lib/api";

const PopularScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { playSong } = usePlayer();

  const [songs, setSongs] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setError("");

        const res = await songService.popular(1, 20);

        setSongs(res.songs);
        setPage(res.page);
        setTotalPages(res.totalPages);
      } catch (err) {
        setError(errorMessage(err, "Could not load popular tracks"));
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
      const res = await songService.popular(page + 1, 20);

      // Same guard as the billboard: never let a repeated row reuse a key.
      setSongs((prev) => {
        const seen = new Set(prev.map((s) => String(s._id)));
        return [...prev, ...res.songs.filter((s) => !seen.has(String(s._id)))];
      });
      setPage(res.page);
      setTotalPages(res.totalPages);
    } catch {
      // A failed page-2+ fetch just stops pagination; the list so far stays usable.
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, page, totalPages]);

  if (loading) return <Loading label="Loading popular tracks..." />;

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Text style={type.title}>Popular tracks</Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={songs}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{
          paddingTop: spacing.lg,
          paddingBottom: MINI_PLAYER_HEIGHT + spacing.xxl,
        }}
        renderItem={({ item, index }) => (
          <SongRow
            song={item}
            index={index}
            onPress={() => playSong(item, songs)}
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
            subtitle="Once songs are played they'll rank here."
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
});

export default PopularScreen;
