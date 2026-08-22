import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";

import { Artwork, Toast } from "./ui";
import { colors, radius, spacing, MINI_PLAYER_HEIGHT } from "../lib/theme";
import { songArtwork, songCredit } from "../lib/song";
import { usePlayer } from "../lib/player";

/**
 * Floating bar above the tab bar. Tapping it opens the full player; the
 * controls are separate touch targets so a mis-tap does not navigate.
 *
 * The card is tinted by the cover art itself — the same enlarged, heavily
 * blurred image used behind the artwork on the player screen. Reading a
 * dominant colour would need a native module Expo Go does not carry, and this
 * follows the artwork exactly, including covers that are several colours.
 */
const MiniPlayer = () => {
  const router = useRouter();
  const {
    current,
    isPlaying,
    isBuffering,
    loading,
    toggle,
    position,
    duration,
    isLiked,
    toggleLike,
  } = usePlayer();

  const [toast, setToast] = useState(null);
  const [likeBusy, setLikeBusy] = useState(false);

  if (!current) return null;

  const progress = duration > 0 ? Math.min(position / duration, 1) : 0;
  const busy = loading || isBuffering;
  const art = songArtwork(current);
  const liked = isLiked(current._id);

  const onLike = async () => {
    setLikeBusy(true);

    try {
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

  return (
    <>
      <Toast
        message={toast?.text}
        tone={toast?.tone}
        onHide={() => setToast(null)}
        offset={MINI_PLAYER_HEIGHT + spacing.lg}
      />

      <View style={styles.wrapper} pointerEvents="box-none">
        <Pressable
          onPress={() => router.push("/player")}
          style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        >
          {/* Purely decorative — must never take a touch away from the
              controls sitting on top of them. */}
          {art ? (
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <Image
                source={{ uri: art }}
                style={styles.tint}
                contentFit="cover"
                blurRadius={40}
              />
              {/* Holds the text readable whatever the cover happens to be. */}
              <View style={styles.scrim} />
            </View>
          ) : null}

          <View style={styles.row}>
            <Artwork
              uri={art}
              size={44}
              rounded={radius.sm}
              label={current.title}
            />

            <View style={styles.meta}>
              <Text numberOfLines={1} style={styles.title}>
                {current.title || "Untitled"}
              </Text>
              <Text numberOfLines={1} style={styles.artist}>
                {songCredit(current)}
              </Text>
            </View>

            <Pressable
              onPress={onLike}
              disabled={likeBusy}
              hitSlop={10}
              style={styles.control}
              accessibilityLabel={liked ? "Remove from liked songs" : "Add to liked songs"}
            >
              {/*
                A white tick on an accent disc, rather than Ionicons'
                checkmark-circle. That glyph knocks the tick out of the
                circle, so the tick is whatever happens to be behind it —
                which on a cover-tinted card is a different colour every
                track. Drawing the two separately keeps it white always, and
                matches the verified badge elsewhere in the app.
              */}
              {liked ? (
                <View style={styles.likedBadge}>
                  <Ionicons name="checkmark" size={16} color="#ffffff" />
                </View>
              ) : (
                <Ionicons name="add-circle-outline" size={26} color={colors.text} />
              )}
            </Pressable>

            <Pressable
              onPress={toggle}
              hitSlop={10}
              style={styles.control}
              accessibilityLabel={isPlaying ? "Pause" : "Play"}
            >
              {busy ? (
                <ActivityIndicator color={colors.text} size="small" />
              ) : (
                <Ionicons
                  name={isPlaying ? "pause" : "play"}
                  size={24}
                  color={colors.text}
                  style={!isPlaying && { marginLeft: 2 }}
                />
              )}
            </Pressable>
          </View>

          {/* Inside the card, along its bottom edge. */}
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
        </Pressable>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.xs,
    backgroundColor: "transparent",
  },
  card: {
    height: MINI_PLAYER_HEIGHT,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.surfaceRaised,
    justifyContent: "center",
  },
  /**
   * `absoluteFill`, not the `absoluteFillObject` that used to be here: React
   * Native removed that export, and spreading a missing name gives an empty
   * object instead of an error. Both of these silently lost their positioning
   * — the blurred cover behind the card was not filling it, and neither was
   * the scrim that keeps the text readable over it.
   */
  tint: {
    ...StyleSheet.absoluteFill,
  },
  /**
   * Dark enough to keep white text legible on a pale cover, light enough to
   * let the colour through — at 0.55 the card read as plain grey whatever
   * was playing, which defeats the point of tinting it.
   */
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.38)",
  },
  pressed: {
    opacity: 0.9,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  meta: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  artist: {
    fontSize: 12,
    color: "rgba(255,255,255,0.75)",
  },
  control: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  likedBadge: {
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  progressTrack: {
    position: "absolute",
    left: spacing.sm,
    right: spacing.sm,
    bottom: 4,
    height: 2,
    borderRadius: 1,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  progressFill: {
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.text,
  },
});

export default MiniPlayer;
