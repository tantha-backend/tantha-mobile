import { useCallback, useState } from "react";
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";

import SongRow from "../../components/SongRow";
import { Artwork, Empty, Loading, Screen, Toast } from "../../components/ui";
import { colors, radius, spacing, MINI_PLAYER_HEIGHT } from "../../lib/theme";
import { playlistService } from "../../lib/services";
import { formatDuration } from "../../lib/song";
import { usePlayer } from "../../lib/player";
import { useAuth } from "../../lib/auth";
import { errorMessage } from "../../lib/api";
import SongSheet from "../../components/SongSheet";

/**
 * The cover is sized from the screen rather than fixed. At a hard 160 it sat
 * small and lost in the middle of a modern phone's width; at the full width it
 * would crowd the edges on a small one.
 */
const COVER_SIZE = Math.min(
  Math.round(Dimensions.get("window").width * 0.62),
  260,
);

const PlaylistScreen = () => {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { playSong, shuffle, setShuffle } = usePlayer();
  const { user } = useAuth();

  const [playlist, setPlaylist] = useState(null);
  const [sheetSong, setSheetSong] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async () => {
    try {
      setPlaylist(await playlistService.byId(id));
    } catch (err) {
      setError(errorMessage(err, "Could not load this playlist"));
    } finally {
      setLoading(false);
    }
  }, [id]);

  /**
   * Reloads whenever the screen comes back into view, so songs added on the
   * Add songs screen are here on return rather than after a manual refresh.
   */
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

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

  /**
   * Only the owner may edit a playlist, so only the owner is offered the
   * remove button — SongRow's contract is that `onRemove` is passed by lists
   * someone owns.
   *
   * Editorial playlists belong to an admin account, so every listener opening
   * one saw a remove button that could not work. The server already refuses
   * (removeSongFromPlaylist returns 403 to anyone but the owner), so nothing
   * was ever deleted, but the optimistic update meant the row vanished and
   * then sprang back with an error toast — which reads as a broken app rather
   * than an action that was never theirs to take.
   *
   * `userId` comes back populated as an object, so compare the id inside it;
   * the fallback covers any caller that returns it unpopulated.
   */
  const ownerId = playlist.userId?._id || playlist.userId;
  const isOwner =
    Boolean(user?.id) && String(ownerId || "") === String(user.id);

  const totalSeconds = songs.reduce((sum, s) => sum + (s.duration || 0), 0);

  // Populated as an object by the API; the string fallback covers a caller
  // that returns it unpopulated.
  const ownerName =
    typeof playlist.userId === "object" ? playlist.userId?.name : null;

  const longDescription = String(playlist.description || "").length > 90;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ paddingBottom: MINI_PLAYER_HEIGHT + spacing.xxl }}
      >
        {/*
          A wash of the cover behind the header, fading into the page.

          The old header was a small centred cover on flat black, which gave
          every playlist the same face whatever was in it. Spotify's trick is
          that the artwork colours the top of the screen, so a playlist looks
          like itself before you have read a word of it — this is the same
          idea done with a blur of the cover rather than an extracted colour,
          which needs no work on the server and cannot pick an ugly one.
        */}
        <View style={styles.backdrop} pointerEvents="none">
          {playlist.coverImage ? (
            <Image
              source={{ uri: playlist.coverImage }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              blurRadius={60}
            />
          ) : null}

          <LinearGradient
            colors={["rgba(0,0,0,0.35)", "rgba(0,0,0,0.75)", colors.bg]}
            locations={[0, 0.55, 1]}
            style={StyleSheet.absoluteFill}
          />
        </View>

        <View style={[styles.topBar, { paddingTop: insets.top + spacing.md }]}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={28} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.cover}>
          <View style={styles.coverShadow}>
            <Artwork
            uri={playlist.coverImage}
              size={COVER_SIZE}
              rounded={radius.md}
              label={playlist.title}
            />
          </View>
        </View>

        <View style={styles.meta}>
          <Text style={styles.title}>{playlist.title || "Untitled playlist"}</Text>

          {playlist.description ? (
            <Pressable
              onPress={() => longDescription && setExpanded((open) => !open)}
            >
              <Text
                numberOfLines={expanded ? undefined : 2}
                style={styles.description}
              >
                {playlist.description}
              </Text>

              {/*
                Only offered when there is something behind it.

                React Native cannot say whether a clamped Text actually
                overflowed — with numberOfLines set, the layout it reports is
                the clamped one — so this is measured by length instead. Two
                lines at this size hold roughly ninety characters, and being a
                little wrong at the boundary costs nothing. Always showing it
                cost more: a one-line description got a "see more" that did
                nothing when tapped, which reads as a broken control.
              */}
              {longDescription ? (
                <Text style={styles.more}>
                  {expanded ? "see less" : "see more"}
                </Text>
              ) : null}
            </Pressable>
          ) : null}

          <View style={styles.byline}>
            <View style={styles.avatar}>
              <Text style={styles.avatarLetter}>
                {(ownerName || "T").charAt(0).toUpperCase()}
              </Text>
            </View>

            <Text style={styles.bylineText}>{ownerName || "Tantha Music"}</Text>
          </View>

          <Text style={styles.counts}>
            {songs.length} {songs.length === 1 ? "song" : "songs"} ·{" "}
            {formatDuration(totalSeconds)}
          </Text>
        </View>

        <View style={styles.actions}>
          <View style={styles.actionsLeft}>
            {/* Only the owner may change what a playlist holds. */}
            {isOwner ? (
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/add-songs",
                    params: { playlistId: id, title: playlist.title || "" },
                  })
                }
                hitSlop={10}
                accessibilityLabel="Add songs to this playlist"
              >
                <Ionicons name="add-circle-outline" size={30} color={colors.text} />
              </Pressable>
            ) : null}
          </View>

          <View style={styles.actionsRight}>
            <Pressable
              onPress={() => setShuffle(!shuffle)}
              hitSlop={10}
              accessibilityLabel={shuffle ? "Turn shuffle off" : "Turn shuffle on"}
            >
              <Ionicons
                name="shuffle"
                size={26}
                color={shuffle ? colors.accent : colors.textMuted}
              />
            </Pressable>

            {songs.length > 0 ? (
              <Pressable
                onPress={() => playSong(songs[0], songs)}
                style={({ pressed }) => [styles.play, pressed && styles.playPressed]}
                accessibilityLabel="Play this playlist"
              >
                <Ionicons name="play" size={28} color={colors.text} />
              </Pressable>
            ) : null}
          </View>
        </View>

        {songs.length ? (
          songs.map((song, i) => (
            <SongRow
              key={song._id}
              song={song}
              index={i}
              onPress={() => playSong(song, songs)}
              onMore={() => setSheetSong(song)}
              onRemove={isOwner ? () => removeFromPlaylist(song) : undefined}
              removeLabel="Remove from this playlist"
            />
          ))
        ) : (
          <Empty
            title="This playlist is empty"
            subtitle={
              isOwner
                ? "Use Add songs to find tracks, or add one from any song's menu."
                : "Nothing here yet."
            }
          />
        )}
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
  /**
   * Tall enough to sit behind the cover and the title, so the wash reaches
   * past the artwork rather than stopping at its edge and drawing a seam.
   */
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: COVER_SIZE + 260,
    backgroundColor: colors.surface,
  },
  topBar: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  cover: {
    alignItems: "center",
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  /**
   * Lifts the cover off the wash behind it. Without this the artwork and its
   * own blurred copy are the same colours at the same depth, and the edges of
   * the square disappear into it.
   */
  coverShadow: {
    shadowColor: "#000000",
    shadowOpacity: 0.55,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
  },
  /**
   * Left aligned, not centred.
   *
   * A centred block looks tidy with three short words in it and falls apart
   * with a real playlist title, a description and a byline — three centred
   * lines of different lengths with nothing to line up against. Down the left
   * they share an edge, and a long title wraps without unbalancing anything.
   */
  meta: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
    letterSpacing: -0.5,
    color: colors.text,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  more: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },
  byline: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.text,
  },
  bylineText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  counts: {
    fontSize: 13,
    color: colors.textMuted,
  },
  /**
   * Owner controls on the left, playback on the right — the same split as the
   * reference, and the reason it works is that the play button lands under
   * the thumb rather than in the middle of the screen where nothing reaches.
   */
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  actionsLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
  },
  actionsRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
  },
  play: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    // Nudged right: the glyph's own padding makes a centred triangle read left.
    paddingLeft: 3,
  },
  playPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.96 }],
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
