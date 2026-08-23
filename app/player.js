import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  PanResponder,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import AboutArtist from "../components/AboutArtist";
import AdBanner from "../components/AdBanner";
import ArtistPicker from "../components/ArtistPicker";
import { Artwork, QueueIcon, Screen, Toast } from "../components/ui";
import { colors, radius, spacing } from "../lib/theme";
import {
  formatDuration,
  songArtists,
  songArtwork,
  songCredit,
} from "../lib/song";
import { usePlayer } from "../lib/player";
import { playlistService } from "../lib/services";
import { errorMessage } from "../lib/api";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const INNER_W = SCREEN_W - spacing.xl * 2;
/**
 * Capped a little under the full width so the screen can afford the gaps
 * around the artwork. This layout does not scroll, so every point given to
 * spacing has to come from somewhere — at 360 the controls ran off the
 * bottom of a 914pt screen once the gaps were widened.
 */
const ART_SIZE = Math.min(INNER_W, 330);

// The ambient glow is the cover itself, enlarged and blurred until no detail
// survives — only its colour. Reading a dominant colour would need a native
// module that Expo Go does not carry, and this tracks the artwork exactly,
// including covers that are several colours at once.
const GLOW_SIZE = Math.round(ART_SIZE * 1.7);
const GLOW_LEFT = Math.round((INNER_W - GLOW_SIZE) / 2);
// Pushed down so most of the light spills below the art, as in the reference.
const GLOW_TOP = Math.round(-(GLOW_SIZE - ART_SIZE) / 2 + ART_SIZE * 0.2);

/**
 * Colour cast thrown by the cover art. Sits behind the artwork and fades out
 * on every side so it reads as light in the room rather than a second image.
 */
const AmbientGlow = ({ uri }) => {
  if (!uri) return null;

  return (
    <View style={styles.glow} pointerEvents="none">
      <Image
        source={{ uri }}
        style={styles.glowImage}
        contentFit="cover"
        blurRadius={64}
        transition={300}
      />

      {/* Vertical falloff into the page. */}
      <LinearGradient
        colors={[colors.bg, "transparent", "transparent", colors.bg]}
        locations={[0, 0.3, 0.62, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Horizontal falloff, so the glow has no straight edges. */}
      <LinearGradient
        colors={[colors.bg, "transparent", "transparent", colors.bg]}
        locations={[0, 0.22, 0.78, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
};

/**
 * Scrub bar, draggable.
 *
 * Built from Views rather than a slider dependency, but a tap-to-seek
 * Pressable was not enough: dragging did nothing, and the two things that
 * make a scrubber feel right are both missing from that approach.
 *
 * The first is that the thumb has to follow your finger continuously. The
 * second, less obvious, is that while you are dragging it must ignore the
 * playing position entirely — the player reports where it is several times a
 * second, and letting that through means the thumb is fighting the finger,
 * snapping back between updates. So a drag takes over the displayed value
 * until it ends, and only then is a seek issued.
 *
 * Positions come from the gesture's screen coordinates measured against the
 * bar's own position on screen, rather than locationX, which is not reliable
 * across a continuous move.
 */
const ProgressBar = ({ position, duration, onSeek }) => {
  const [width, setWidth] = useState(0);
  const [dragAt, setDragAt] = useState(null);

  const bar = useRef(null);

  // Read inside gesture handlers, which capture their scope once and would
  // otherwise keep seeing whatever these were when the responder was made.
  const geometry = useRef({ left: 0, width: 0, duration: 0 });
  geometry.current.width = width;
  geometry.current.duration = duration;

  const dragRef = useRef(null);

  const secondsAt = (pageX) => {
    const { left, width: w, duration: d } = geometry.current;

    if (!w || !d) return 0;

    const ratio = Math.max(0, Math.min((pageX - left) / w, 1));
    return ratio * d;
  };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      // Claim the gesture so the surrounding scroll view cannot steal a drag
      // that started on the bar.
      onPanResponderTerminationRequest: () => false,

      onPanResponderGrant: (event) => {
        const at = secondsAt(event.nativeEvent.pageX);
        dragRef.current = at;
        setDragAt(at);
      },

      onPanResponderMove: (_event, gesture) => {
        const at = secondsAt(gesture.moveX);
        dragRef.current = at;
        setDragAt(at);
      },

      onPanResponderRelease: () => {
        if (dragRef.current !== null) onSeek(dragRef.current);
        dragRef.current = null;
        setDragAt(null);
      },

      onPanResponderTerminate: () => {
        dragRef.current = null;
        setDragAt(null);
      },
    }),
  ).current;

  const shown = dragAt ?? position;
  const progress = duration > 0 ? Math.min(Math.max(shown / duration, 0), 1) : 0;

  return (
    <View
      ref={bar}
      // Measured in window coordinates so a drag can be placed against it.
      onLayout={(e) => {
        setWidth(e.nativeEvent.layout.width);
        bar.current?.measureInWindow?.((x) => {
          geometry.current.left = x;
        });
      }}
      style={styles.progressHit}
      {...responder.panHandlers}
    >
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        <View
          style={[
            styles.progressKnob,
            { left: `${progress * 100}%` },
            // Grows under the finger, so it is clear what you have hold of.
            dragAt !== null && styles.progressKnobHeld,
          ]}
        />
      </View>
    </View>
  );
};

/** Slides up over the player for the lyrics text or the upcoming tracks. */
const Panel = ({ title, onClose, children }) => (
  <View style={styles.panel}>
    <View style={styles.panelBar}>
      <Text style={styles.panelTitle}>{title}</Text>
      <Pressable onPress={onClose} hitSlop={12}>
        <Ionicons name="close" size={22} color={colors.text} />
      </Pressable>
    </View>
    {children}
  </View>
);

const Player = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const {
    current,
    isPlaying,
    isBuffering,
    loading,
    position,
    duration,
    error,
    toggle,
    next,
    previous,
    seekTo,
    repeat,
    setRepeat,
    shuffle,
    setShuffle,
    queue,
    index,
    playQueue,
    isLiked,
    toggleLike,
    refreshLiked,
  } = usePlayer();

  const [likeBusy, setLikeBusy] = useState(false);

  // Re-read on open so the heart reflects anything loved elsewhere since.
  useEffect(() => {
    refreshLiked();
  }, [refreshLiked]);
  const [panel, setPanel] = useState(null); // "lyrics" | "queue" | "playlists" | null

  // Loaded when the add-to-playlist panel opens, not before.
  const [playlists, setPlaylists] = useState(null);
  const [addingTo, setAddingTo] = useState(null);
  const [toast, setToast] = useState(null); // { text, tone }

  /**
   * Every song id that sits in one of this listener's playlists, so the ⊕ can
   * say whether this track is already in one.
   *
   * Held as one set for the whole library rather than a check per track: the
   * answer arrives before the button is first drawn, and skipping through the
   * queue does not fire a request per song.
   */
  const [inPlaylists, setInPlaylists] = useState(() => new Set());

  // Which artists to choose between; empty unless a collaboration was tapped.
  const [artistChoices, setArtistChoices] = useState([]);

  const readPlaylistMembership = useCallback(async () => {
    try {
      const mine = await playlistService.mine();

      setInPlaylists(
        new Set(
          mine.flatMap((list) =>
            (list.songs || []).map((entry) =>
              // Unpopulated on this endpoint, but populated elsewhere — accept
              // either rather than depend on which one answered.
              String(typeof entry === "string" ? entry : entry?._id),
            ),
          ),
        ),
      );
    } catch {
      // Leave the button in its neutral state; it still opens the panel.
    }
  }, []);

  useEffect(() => {
    readPlaylistMembership();
  }, [readPlaylistMembership]);

  const share = () =>
    Share.share({
      message: `${current.title} — ${songCredit(current)} on Tantha Music`,
    }).catch(() => {});

  const openPlaylists = async () => {
    setPanel("playlists");
    setPlaylists(null);

    try {
      setPlaylists(await playlistService.mine());
    } catch {
      setPlaylists([]);
    }
  };

  const addToPlaylist = async (playlist) => {
    setAddingTo(playlist._id);

    try {
      await playlistService.addSong(playlist._id, current._id);

      // Flip the ⊕ straight away rather than re-reading every playlist for a
      // change we already know about.
      setInPlaylists((prev) => new Set(prev).add(String(current._id)));

      setPanel(null);
      setToast({ text: `Added to ${playlist.title}`, tone: "success" });
    } catch (err) {
      setToast({
        text: errorMessage(err, "Couldn't add to that playlist"),
        tone: "error",
      });
    } finally {
      setAddingTo(null);
    }
  };

  if (!current) {
    return (
      <Screen>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>Nothing is playing.</Text>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text style={styles.link}>Go back</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const liked = isLiked(current._id);
  const inPlaylist = inPlaylists.has(String(current._id));

  /**
   * The artist line. One credit opens that artist; a collaboration has to ask
   * which one, since the line names several people and the tap cannot know
   * who was meant.
   */
  const openArtist = () => {
    const artists = songArtists(current);

    if (!artists.length) return;
    if (artists.length === 1) return router.push(`/artist/${artists[0].id}`);

    setArtistChoices(artists);
  };

  const onToggleLike = async () => {
    setLikeBusy(true);

    try {
      // Same confirmation the mini player gives, so the heart and the + on
      // the bar behave alike rather than one of them seeming to do nothing.
      const nowLiked = await toggleLike(current._id);

      setToast({
        text: nowLiked ? "Added to Liked songs" : "Removed from Liked songs",
        tone: "success",
      });
    } catch {
      setToast({ text: "Couldn't save that", tone: "error" });
    } finally {
      setLikeBusy(false);
    }
  };

  const busy = loading || isBuffering;

  return (
    <Screen>
      {/* Scrolls now that the artist card sits below the controls. The player
          itself still fills the first screenful, so nothing looks like it is
          waiting to be scrolled to. */}
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
      <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </Pressable>

          <Text style={styles.topLabel}>NOW PLAYING</Text>

          <Pressable
            onPress={openPlaylists}
            hitSlop={12}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Ionicons name="ellipsis-horizontal" size={22} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.artWrap}>
          <AmbientGlow uri={songArtwork(current)} />

          <Artwork
            uri={songArtwork(current)}
            size={ART_SIZE}
            rounded={radius.lg}
            label={current.title}
          />
        </View>

        <View style={styles.metaRow}>
          <View style={styles.meta}>
            <Text numberOfLines={1} style={styles.title}>
              {current.title || "Untitled"}
            </Text>
            {/* Left looking exactly like the caption it replaced. Pressing the
                credit to reach the artist is the convention every music app
                shares, so it is found without being marked, and a screen this
                sparse does not want a decorated line running through it. The
                press state is the only feedback it needs. */}
            <Pressable
              onPress={openArtist}
              hitSlop={8}
              style={({ pressed }) => pressed && styles.pressed}
              accessibilityRole="link"
              accessibilityLabel={`Go to ${songCredit(current)}`}
            >
              <Text numberOfLines={1} style={styles.artist}>
                {songCredit(current)}
              </Text>
            </Pressable>
          </View>

          {/* Add to a playlist. It was only reachable through the ⋯ in the
              corner, which reads as an overflow menu rather than an action —
              and the mini player already offers it directly.
              Filled once the track is in a playlist, so the button answers
              "is this saved?" as well as offering to save it. */}
          <Pressable
            onPress={openPlaylists}
            hitSlop={12}
            style={({ pressed }) => pressed && styles.pressed}
            accessibilityLabel={
              inPlaylist ? "In a playlist. Add to another" : "Add to playlist"
            }
          >
            {/*
              A white tick on an accent disc rather than Ionicons'
              checkmark-circle, which knocks the tick out of the circle and so
              paints it with whatever sits behind — here the cover's own glow,
              a different colour every track.
            */}
            {inPlaylist ? (
              <View style={styles.savedBadge}>
                <Ionicons name="checkmark" size={17} color="#ffffff" />
              </View>
            ) : (
              <Ionicons name="add-circle-outline" size={27} color={colors.text} />
            )}
          </Pressable>

          <Pressable
            onPress={onToggleLike}
            hitSlop={12}
            disabled={likeBusy}
            style={({ pressed }) => pressed && styles.pressed}
            accessibilityLabel={liked ? "Remove from liked songs" : "Add to liked songs"}
          >
            <Ionicons
              name={liked ? "heart" : "heart-outline"}
              size={26}
              color={liked ? colors.accent : colors.text}
            />
          </Pressable>
        </View>

        {error ? <Text style={styles.error}>{String(error)}</Text> : null}

        <ProgressBar position={position} duration={duration} onSeek={seekTo} />

        <View style={styles.times}>
          <Text style={styles.time}>{formatDuration(position)}</Text>
          <Text style={styles.time}>{formatDuration(duration)}</Text>
        </View>

        <View style={styles.controls}>
          <Pressable
            onPress={() => setShuffle(!shuffle)}
            hitSlop={12}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Ionicons
              name="shuffle"
              size={24}
              color={shuffle ? colors.accent : colors.text}
            />
          </Pressable>

          <Pressable
            onPress={previous}
            hitSlop={12}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Ionicons name="play-skip-back" size={32} color={colors.text} />
          </Pressable>

          <Pressable
            onPress={toggle}
            hitSlop={8}
            style={({ pressed }) => [styles.playButton, pressed && styles.pressed]}
          >
            {busy ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <Ionicons
                name={isPlaying ? "pause" : "play"}
                size={30}
                color={colors.text}
                // Nudges the triangle so it looks centred in the circle.
                style={!isPlaying && { marginLeft: 3 }}
              />
            )}
          </Pressable>

          <Pressable
            onPress={next}
            hitSlop={12}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Ionicons name="play-skip-forward" size={32} color={colors.text} />
          </Pressable>

          <Pressable
            onPress={() => setRepeat(!repeat)}
            hitSlop={12}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Ionicons
              name="repeat"
              size={24}
              color={repeat ? colors.accent : colors.text}
            />
          </Pressable>
        </View>

        {/* Lyrics on the left, share and queue on the right. Icons alone —
            the labels and divider took a row's worth of height that the
            artwork and its gaps now use. */}
        <View style={styles.tabs}>
          <Pressable
            onPress={() => setPanel("lyrics")}
            hitSlop={12}
            style={({ pressed }) => [styles.tabIcon, pressed && styles.pressed]}
            accessibilityLabel="Lyrics"
          >
            <Ionicons name="chatbox-ellipses-outline" size={26} color={colors.text} />
          </Pressable>

          <View style={styles.tabsRight}>
            <Pressable
              onPress={share}
              hitSlop={12}
              style={({ pressed }) => [styles.tabIcon, pressed && styles.pressed]}
              accessibilityLabel="Share"
            >
              <Ionicons name="share-outline" size={26} color={colors.text} />
            </Pressable>

            <Pressable
              onPress={() => setPanel("queue")}
              hitSlop={12}
              style={({ pressed }) => [styles.tabIcon, pressed && styles.pressed]}
              accessibilityLabel="Queue"
            >
              <QueueIcon size={26} color={colors.text} />
            </Pressable>
          </View>
        </View>
      </View>

        <AboutArtist
          artistId={current.artistId?._id || current.artistId}
          onOpen={() => {
            const id = current.artistId?._id || current.artistId;
            if (id) router.push(`/artist/${id}`);
          }}
        />

        {/* Below the fold and below the artist, so nothing about playing a
            track has to be scrolled past an ad to reach. */}
        <AdBanner />
      </ScrollView>

      <ArtistPicker
        artists={artistChoices}
        onClose={() => setArtistChoices([])}
        onPick={(artist) => {
          setArtistChoices([]);
          router.push(`/artist/${artist.id}`);
        }}
      />

      {panel === "lyrics" && (
        <Panel title="Lyrics" onClose={() => setPanel(null)}>
          {current.lyrics ? (
            <ScrollView contentContainerStyle={styles.lyricsBody}>
              <Text style={styles.lyricsText}>{current.lyrics}</Text>
            </ScrollView>
          ) : (
            <View style={styles.panelEmpty}>
              <Ionicons name="musical-notes-outline" size={30} color={colors.textFaint} />
              <Text style={styles.panelEmptyText}>
                No lyrics saved for this track yet.
              </Text>
            </View>
          )}
        </Panel>
      )}

      {panel === "playlists" && (
        <Panel title="Add to playlist" onClose={() => setPanel(null)}>
          {playlists === null ? (
            <View style={styles.panelEmpty}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : playlists.length === 0 ? (
            <View style={styles.panelEmpty}>
              <Ionicons name="list-outline" size={30} color={colors.textFaint} />
              <Text style={styles.panelEmptyText}>
                You haven&apos;t made a playlist yet.
              </Text>

              <Pressable
                onPress={() => {
                  setPanel(null);
                  router.push(`/playlist/new?songId=${current._id}`);
                }}
                style={({ pressed }) => [
                  styles.panelAction,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Ionicons name="add" size={18} color={colors.bg} />
                <Text style={styles.panelActionLabel}>New playlist</Text>
              </Pressable>
            </View>
          ) : (
            <FlatList
              data={playlists}
              keyExtractor={(item) => item._id}
              contentContainerStyle={{ paddingBottom: spacing.xl }}
              ListHeaderComponent={
                <Pressable
                  onPress={() => {
                    setPanel(null);
                    router.push(`/playlist/new?songId=${current._id}`);
                  }}
                  style={({ pressed }) => [
                    styles.queueRow,
                    pressed && { backgroundColor: colors.surfaceRaised },
                  ]}
                >
                  <Ionicons name="add-circle-outline" size={22} color={colors.accent} />
                  <Text style={[styles.queueTitle, { color: colors.accent }]}>
                    New playlist
                  </Text>
                </Pressable>
              }
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => addToPlaylist(item)}
                  disabled={Boolean(addingTo)}
                  style={({ pressed }) => [
                    styles.queueRow,
                    pressed && { backgroundColor: colors.surfaceRaised },
                  ]}
                >
                  <Artwork
                    uri={item.coverImage}
                    size={40}
                    rounded={radius.sm}
                    label={item.title}
                  />

                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={styles.queueTitle}>
                      {item.title || "Untitled playlist"}
                    </Text>
                    <Text style={styles.queueArtist}>
                      {item.songs?.length ?? 0} songs
                    </Text>
                  </View>

                  {addingTo === item._id ? (
                    <ActivityIndicator size="small" color={colors.accent} />
                  ) : null}
                </Pressable>
              )}
            />
          )}
        </Panel>
      )}

      {panel === "queue" && (
        <Panel title={`Queue · ${queue.length}`} onClose={() => setPanel(null)}>
          <FlatList
            data={queue}
            keyExtractor={(item, i) => `${item._id}-${i}`}
            contentContainerStyle={{ paddingBottom: spacing.xl }}
            renderItem={({ item, index: pos }) => {
              const active = pos === index;
              return (
                <Pressable
                  onPress={() => {
                    playQueue(queue, pos);
                    setPanel(null);
                  }}
                  style={({ pressed }) => [
                    styles.queueRow,
                    pressed && { backgroundColor: colors.surfaceRaised },
                  ]}
                >
                  <Text style={[styles.queueNum, active && styles.queueActive]}>
                    {active ? "▶" : pos + 1}
                  </Text>

                  <Artwork
                    uri={songArtwork(item)}
                    size={44}
                    rounded={radius.sm}
                    label={item.title}
                  />

                  <View style={{ flex: 1 }}>
                    <Text
                      numberOfLines={1}
                      style={[styles.queueTitle, active && styles.queueActive]}
                    >
                      {item.title || "Untitled"}
                    </Text>
                    <Text numberOfLines={1} style={styles.queueArtist}>
                      {songCredit(item)}
                    </Text>
                  </View>
                </Pressable>
              );
            }}
          />
        </Panel>
      )}

      <Toast
        message={toast?.text}
        tone={toast?.tone}
        onHide={() => setToast(null)}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.xxl,
  },
  /**
   * Sized to a screenful rather than flex:1, which would collapse inside a
   * ScrollView. Keeping the height means `marginTop: auto` on the icon row
   * still pushes it to the bottom of the first screen.
   */
  container: {
    minHeight: SCREEN_H * 0.9,
    paddingHorizontal: spacing.xl,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    /**
     * Above the artwork block. The ambient glow starts above its own
     * container so the light reaches around the top of the cover, and since
     * that block is the later sibling it was painting over these controls and
     * washing them out.
     */
    zIndex: 2,
  },
  topLabel: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 2,
    color: colors.text,
  },
  pressed: {
    opacity: 0.6,
  },
  /**
   * Deliberately has no zIndex. Giving it one lifts it above every sibling
   * that has none — which put the glow over the title, artist and scrubber
   * below it. Left at the default, document order keeps those on top, and
   * only the top bar above needs raising.
   */
  artWrap: {
    alignItems: "center",
    // Sits lower, clear of the top bar.
    marginTop: spacing.xxl + spacing.md,
  },
  glow: {
    position: "absolute",
    left: GLOW_LEFT,
    top: GLOW_TOP,
    width: GLOW_SIZE,
    height: GLOW_SIZE,
  },
  /**
   * Dimmed here rather than on the container. Fading the whole layer would
   * take the masking gradients with it, leaving them too transparent to
   * reach the page colour — which left a hard edge where the glow stopped.
   */
  glowImage: {
    width: GLOW_SIZE,
    height: GLOW_SIZE,
    opacity: 0.65,
  },
  savedBadge: {
    width: 27,
    height: 27,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    // Clear of the artwork above it.
    marginTop: spacing.xxl,
  },
  meta: {
    flex: 1,
    gap: spacing.sm,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.text,
  },
  artist: {
    fontSize: 15,
    color: colors.textMuted,
  },
  error: {
    marginTop: spacing.md,
    color: colors.danger,
    fontSize: 12,
  },
  progressHit: {
    // Separated from the title and artist above it. The vertical padding is
    // also the grab area — a 4pt line is far too thin to catch a thumb.
    marginTop: spacing.xl,
    paddingVertical: spacing.lg,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    justifyContent: "center",
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
  progressKnob: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 6,
    marginLeft: -6,
    backgroundColor: colors.accent,
  },
  progressKnobHeld: {
    width: 18,
    height: 18,
    borderRadius: 9,
    marginLeft: -9,
  },
  times: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  time: {
    fontSize: 12,
    color: colors.textMuted,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.xxl,
  },
  playButton: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 1.5,
    borderColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  tabs: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: "auto",
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
  },
  tabsRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xl,
  },
  tabIcon: {
    padding: spacing.xs,
  },
  panel: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: "70%",
    backgroundColor: colors.surfaceRaised,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingBottom: spacing.xl,
  },
  panelBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  panelTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  panelEmpty: {
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.xxl,
  },
  panelEmptyText: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: "center",
  },
  panelAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    height: 44,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    marginTop: spacing.sm,
  },
  panelActionLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.bg,
  },
  lyricsBody: {
    padding: spacing.xl,
  },
  lyricsText: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 26,
  },
  queueRow: {
    flexDirection: "row",
    alignItems: "center",
    // Tighter than before now that artwork sits between the number and text.
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  queueNum: {
    width: 22,
    fontSize: 13,
    color: colors.textFaint,
    textAlign: "center",
  },
  queueTitle: {
    fontSize: 15,
    fontWeight: "500",
    color: colors.text,
  },
  queueArtist: {
    fontSize: 12,
    color: colors.textMuted,
  },
  queueActive: {
    color: colors.accent,
  },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  emptyText: {
    color: colors.textMuted,
  },
  link: {
    color: colors.accent,
    fontWeight: "600",
  },
});

export default Player;
