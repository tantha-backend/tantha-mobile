import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Artwork, Empty, Loading, Screen, Toast } from "../../components/ui";
import AboutArtist from "../../components/AboutArtist";
import AdBanner from "../../components/AdBanner";
import SongSheet from "../../components/SongSheet";
import { colors, radius, spacing, MINI_PLAYER_HEIGHT } from "../../lib/theme";
import { artistService } from "../../lib/services";
import { formatCount, formatDuration, songArtwork } from "../../lib/song";
import { usePlayer } from "../../lib/player";
import { errorMessage } from "../../lib/api";

const { width: SCREEN_W } = Dimensions.get("window");

// Taller than it is wide, so the name overlaps the lower third of the photo
// rather than sitting on black underneath it.
const HERO_H = Math.round(SCREEN_W * 1.18);

/**
 * The big round play button. It lifts slightly under the finger and carries a
 * coloured glow, so it reads as the primary action on a screen where every
 * other control is an outline.
 */
const PlayFab = ({ playing, onPress }) => {
  const scale = useRef(new Animated.Value(1)).current;

  const spring = (to) =>
    Animated.spring(scale, {
      toValue: to,
      useNativeDriver: true,
      friction: 6,
      tension: 220,
    }).start();

  return (
    <Pressable
      onPressIn={() => spring(0.9)}
      onPressOut={() => spring(1)}
      onPress={onPress}
      hitSlop={8}
    >
      <Animated.View style={[styles.fab, { transform: [{ scale }] }]}>
        <Ionicons
          name={playing ? "pause" : "play"}
          size={30}
          color="#ffffff"
          // The play triangle is optically left-heavy; nudge it back to centre.
          style={{ marginLeft: playing ? 0 : 3 }}
        />
      </Animated.View>
    </Pressable>
  );
};

/** One row of the Popular list: rank, artwork, title, plays, duration. */
const PopularRow = ({ song, rank, isCurrent, onPress, onMore }) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [
      styles.row,
      pressed && { backgroundColor: colors.surfaceRaised },
    ]}
  >
    <Text style={[styles.rank, isCurrent && { color: colors.accent }]}>{rank}</Text>

    <Artwork
      uri={songArtwork(song)}
      size={56}
      rounded={radius.sm}
      label={song.title}
    />

    <View style={styles.rowText}>
      <Text
        numberOfLines={1}
        style={[styles.rowTitle, isCurrent && { color: colors.accent }]}
      >
        {song.title}
      </Text>
      {/* The count alone — the column is unambiguous without the word. */}
      <Text style={styles.rowMeta}>{song.playCount || 0}</Text>
    </View>

    <Text style={styles.rowDuration}>{formatDuration(song.duration)}</Text>

    <Pressable
      onPress={onMore}
      hitSlop={10}
      style={styles.rowMore}
      accessibilityLabel={`More options for ${song.title}`}
    >
      <Ionicons name="ellipsis-horizontal" size={18} color={colors.textMuted} />
    </Pressable>
  </Pressable>
);

const ArtistScreen = () => {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { playSong, current, isPlaying, toggle, shuffle, setShuffle } = usePlayer();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [followBusy, setFollowBusy] = useState(false);
  const [showAll, setShowAll] = useState(false);

  // Which song's "..." menu is open, and the message it leaves behind. The
  // toast lives here rather than in the sheet so it survives the sheet closing.
  const [sheetSong, setSheetSong] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        setData(await artistService.profile(id));
      } catch (err) {
        setError(errorMessage(err, "Could not load this artist"));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id]);

  if (loading) return <Loading label="Loading artist..." />;

  if (error || !data?.artist) {
    return (
      <Screen>
        <View style={styles.centered}>
          <Empty title="Artist unavailable" subtitle={error} />
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text style={styles.link}>Go back</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const {
    artist,
    songs = [],
    albums = [],
    collaborators = [],
    isFollowing,
    stats = {},
  } = data;

  // `popular` is ranked by plays server-side; fall back for older responses.
  const popular =
    data.popular?.length
      ? data.popular
      : [...songs].sort((a, b) => (b.playCount || 0) - (a.playCount || 0));

  const shown = showAll ? popular : popular.slice(0, 3);
  const latest = songs[0];
  const playingHere = current && songs.some((s) => s._id === current._id);

  // Before anyone has listened, a "0 monthly listeners" line reads as failure
  // rather than as a new artist, so fall back to the follower count.
  const audience = stats.monthlyListeners
    ? `${formatCount(stats.monthlyListeners)} monthly listeners`
    : `${formatCount(stats.followers ?? artist.followersCount)} followers`;

  const toggleFollow = async () => {
    setFollowBusy(true);

    try {
      const res = await artistService.follow(id);

      setData((prev) => ({
        ...prev,
        isFollowing: res?.following ?? !prev.isFollowing,
        stats: {
          ...prev.stats,
          followers: res?.followersCount ?? prev.stats?.followers,
        },
      }));
    } catch {
      // Leave the button as-is; the next load will show the true state.
    } finally {
      setFollowBusy(false);
    }
  };

  const playAll = () => {
    if (playingHere) return toggle();
    if (popular.length) playSong(popular[0], popular);
  };

  /**
   * A real toggle, not a one-way "shuffle play".
   *
   * It always turned shuffle on and restarted from a random track, so the
   * icon never changed and there was no way to turn it back off from here —
   * pressing it a second time just jumped somewhere else in the catalogue.
   *
   * Turning it on mid-listen only changes what plays next; interrupting the
   * track someone is already hearing to prove the setting took effect would
   * be its own kind of rude. From a standing start it begins a shuffled run,
   * which is what the button is for.
   */
  const toggleShuffle = () => {
    const next = !shuffle;

    setShuffle?.(next);

    if (next && !playingHere && songs.length) {
      playSong(songs[Math.floor(Math.random() * songs.length)], songs);
    }
  };

  const share = () =>
    Share.share({
      message: `${artist.stageName} on Tantha Music`,
    }).catch(() => {});

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ paddingBottom: MINI_PLAYER_HEIGHT + spacing.xxl }}
        showsVerticalScrollIndicator={false}
      >
        {/* ---- hero ------------------------------------------------------ */}
        <View style={styles.hero}>
          {artist.profileImage ? (
            <Image
              source={{ uri: artist.profileImage }}
              style={styles.heroImage}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <View style={[styles.heroImage, styles.heroFallback]}>
              <Text style={styles.heroInitial}>
                {(artist.stageName || "?").charAt(0).toUpperCase()}
              </Text>
            </View>
          )}

          {/*
            Fades the photo into the page. Four stops rather than two: a hard
            two-stop ramp reaches solid black well above the bottom and leaves
            a visible seam, which puts the name on flat black instead of on
            the picture. The last stop is the only opaque one.
          */}
          <LinearGradient
            colors={[
              "transparent",
              "rgba(0,0,0,0.25)",
              "rgba(0,0,0,0.72)",
              colors.bg,
            ]}
            locations={[0.3, 0.6, 0.85, 1]}
            style={styles.heroFade}
            pointerEvents="none"
          />

          {/* Keeps the top controls legible against a bright photo. */}
          <LinearGradient
            colors={["rgba(0,0,0,0.5)", "transparent"]}
            locations={[0, 1]}
            style={styles.heroTopScrim}
            pointerEvents="none"
          />

          <View style={[styles.heroBar, { top: insets.top + spacing.sm }]}>
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <Ionicons name="chevron-back" size={28} color={colors.text} />
            </Pressable>

            {/* The mockup had an overflow menu beside this, but everything it
                could hold is already on the screen — share is this button,
                follow is its own, play and shuffle sit below. A menu whose
                every item duplicates a visible control is worse than none, so
                the share icon stands alone. */}
            <View style={styles.heroBarRight}>
              <Pressable onPress={share} hitSlop={12} accessibilityLabel="Share artist">
                <Ionicons name="share-outline" size={24} color={colors.text} />
              </Pressable>
            </View>
          </View>

          <View style={styles.heroText}>
            {artist.isVerified ? (
              <View style={styles.verifiedRow}>
                <View style={styles.verified}>
                  <Ionicons name="checkmark" size={11} color="#ffffff" />
                </View>

                <Text style={styles.verifiedLabel}>Verified artist</Text>
              </View>
            ) : null}

            <Text numberOfLines={2} style={styles.name}>
              {artist.stageName || "Artist"}
            </Text>

            <Text style={styles.audience}>{audience}</Text>
          </View>
        </View>

        {/* ---- actions --------------------------------------------------- */}
        <View style={styles.actions}>
          <Pressable
            onPress={toggleFollow}
            disabled={followBusy}
            style={({ pressed }) => [
              styles.follow,
              isFollowing && styles.following,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={styles.followLabel}>
              {isFollowing ? "FOLLOWING" : "FOLLOW"}
            </Text>
          </Pressable>

          <Pressable
            onPress={toggleShuffle}
            hitSlop={12}
            style={styles.shuffle}
            accessibilityRole="switch"
            accessibilityState={{ checked: shuffle }}
            accessibilityLabel="Shuffle"
          >
            <Ionicons
              name="shuffle"
              size={26}
              color={shuffle ? colors.accent : colors.text}
            />
          </Pressable>

          <View style={styles.actionsSpacer} />

          <PlayFab playing={playingHere && isPlaying} onPress={playAll} />
        </View>

        {/* ---- popular --------------------------------------------------- */}
        {popular.length > 0 ? (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Popular</Text>

              {popular.length > 3 ? (
                <Pressable onPress={() => setShowAll((v) => !v)} hitSlop={8}>
                  <Text style={styles.seeAll}>
                    {showAll ? "SHOW LESS" : "SEE ALL"}
                  </Text>
                </Pressable>
              ) : null}
            </View>

            {shown.map((song, i) => (
              <PopularRow
                key={song._id}
                song={song}
                rank={i + 1}
                isCurrent={current?._id === song._id}
                onPress={() => playSong(song, popular)}
                onMore={() => setSheetSong(song)}
              />
            ))}
          </>
        ) : (
          <Empty
            title="No songs yet"
            subtitle="This artist hasn't published anything."
          />
        )}

        {/* ---- latest release -------------------------------------------- */}
        {latest ? (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Latest release</Text>
            </View>

            <Pressable
              onPress={() => playSong(latest, songs)}
              style={({ pressed }) => [
                styles.latest,
                pressed && { backgroundColor: colors.surfaceRaised },
              ]}
            >
              <Artwork
                uri={songArtwork(latest)}
                size={72}
                rounded={radius.md}
                label={latest.title}
              />

              <View style={styles.rowText}>
                <Text numberOfLines={1} style={styles.latestTitle}>
                  {latest.title}
                </Text>
                <Text style={styles.rowMeta}>
                  Single · {new Date(latest.createdAt).getFullYear()}
                </Text>
              </View>

              <Ionicons name="chevron-forward" size={22} color={colors.textMuted} />
            </Pressable>
          </>
        ) : null}

        {/* ---- albums ---------------------------------------------------- */}
        {albums.length > 0 ? (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Albums</Text>
            </View>

            {albums.map((album) => (
              <Pressable
                key={album._id}
                onPress={() => router.push(`/album/${album._id}`)}
                style={({ pressed }) => [
                  styles.latest,
                  pressed && { backgroundColor: colors.surfaceRaised },
                ]}
              >
                <Artwork
                  uri={album.coverImage}
                  size={56}
                  rounded={radius.md}
                  label={album.title}
                />

                <View style={styles.rowText}>
                  <Text numberOfLines={1} style={styles.latestTitle}>
                    {album.title || "Untitled album"}
                  </Text>
                  <Text style={styles.rowMeta}>Album</Text>
                </View>

                <Ionicons name="chevron-forward" size={22} color={colors.textMuted} />
              </Pressable>
            ))}
          </>
        ) : null}

        {/* ---- appears with ------------------------------------------------ */}
        {/*
          Only shown when there is something real to show. These are artists
          credited on the same tracks, not a genre guess — see collaboratorsFor
          on the server for why this is not "similar artists".
        */}
        {collaborators.length > 0 ? (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Appears with</Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.collabRow}
            >
              {collaborators.map((person) => (
                <Pressable
                  key={person._id}
                  onPress={() => router.push(`/artist/${person._id}`)}
                  style={({ pressed }) => [
                    styles.collabCard,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Artwork
                    uri={person.profileImage}
                    size={96}
                    rounded={48}
                    label={person.stageName}
                  />

                  <Text numberOfLines={1} style={styles.collabName}>
                    {person.stageName || person.artistName || "Artist"}
                  </Text>

                  <Text numberOfLines={1} style={styles.collabMeta}>
                    {person.sharedSongs === 1
                      ? "1 song together"
                      : `${person.sharedSongs} songs together`}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        ) : null}

        {/*
          The same card the player shows, rather than the bare paragraph that
          used to sit here — one artist described two different ways in one
          app was the odd part.

          Fed from the record this screen already loaded, and told about the
          follow state it owns, so the card's Follow button and the one in the
          header cannot end up disagreeing.
        */}
        <AboutArtist
          profile={data}
          isFollowing={isFollowing}
          onToggleFollow={toggleFollow}
        />

        {/* Below everything about the artist, so nothing you came here for
            sits under an ad. */}
        <AdBanner />
      </ScrollView>

      <Toast
        message={toast?.text}
        tone={toast?.tone}
        onHide={() => setToast(null)}
        offset={MINI_PLAYER_HEIGHT + spacing.lg}
      />

      {/* Rendered last so it sits above the scroll view and the mini player. */}
      <SongSheet
        song={sheetSong}
        onClose={() => setSheetSong(null)}
        onToast={setToast}
        // Already on this artist's page — offering to go there is a dead end.
        showArtistLink={false}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  hero: {
    width: SCREEN_W,
    height: HERO_H,
  },
  /**
   * Sized in pixels rather than with "100%". A percentage height against an
   * absolutely-positioned box resolved to the image's own aspect ratio here,
   * which clipped the photo short of the hero and left a hard edge above the
   * name instead of a fade.
   */
  heroImage: {
    width: SCREEN_W,
    height: HERO_H,
  },
  heroFallback: {
    backgroundColor: colors.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  heroFade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: HERO_H,
  },
  heroInitial: {
    fontSize: 96,
    fontWeight: "800",
    color: colors.textFaint,
  },
  heroTopScrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 140,
  },
  heroBar: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroBarRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
  },
  heroText: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  /**
   * The tick sits above the name rather than beside it.
   *
   * Beside it, it drifted to the far edge of the screen. A name long enough to
   * wrap fills the whole width — the text box is as wide as the space it was
   * given, whatever the second line happens to contain — so a badge placed
   * after it lands against the right margin, floating in the middle of the
   * two lines and attached to nothing.
   *
   * Above it, the badge is always next to the name whether the name takes one
   * line or two, and saying what the tick means is worth more than the tick
   * alone was.
   */
  verifiedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 2,
    marginBottom: spacing.xs,
  },
  verifiedLabel: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.3,
    color: colors.text,
  },
  name: {
    flexShrink: 1,
    fontSize: 42,
    lineHeight: 48,
    fontWeight: "800",
    letterSpacing: -0.5,
    color: colors.text,
  },
  verified: {
    width: 18,
    height: 18,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  audience: {
    marginTop: spacing.xs,
    fontSize: 15,
    color: colors.textMuted,
  },

  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  follow: {
    height: 44,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  following: {
    borderColor: colors.accent,
  },
  followLabel: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.2,
    color: colors.text,
  },
  shuffle: {
    padding: spacing.xs,
  },
  actionsSpacer: {
    flex: 1,
  },
  fab: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.accent,
    shadowOpacity: 0.55,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  collabRow: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.sm,
  },
  collabCard: {
    width: 96,
    alignItems: "center",
    gap: spacing.xs,
  },
  collabName: {
    marginTop: spacing.xs,
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
    textAlign: "center",
  },
  collabMeta: {
    fontSize: 11,
    color: colors.textFaint,
    textAlign: "center",
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.3,
    color: colors.text,
  },
  seeAll: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.1,
    color: colors.textMuted,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  rank: {
    width: 18,
    fontSize: 15,
    fontWeight: "600",
    color: colors.textMuted,
  },
  rowText: {
    flex: 1,
    gap: 3,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  rowMeta: {
    fontSize: 13,
    color: colors.textMuted,
  },
  rowDuration: {
    fontSize: 13,
    color: colors.textMuted,
  },
  rowMore: {
    paddingLeft: spacing.xs,
  },

  latest: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  latestTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
  },
  bio: {
    paddingHorizontal: spacing.lg,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
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

export default ArtistScreen;
