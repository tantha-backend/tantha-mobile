import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";

import { colors, radius, spacing } from "../lib/theme";
import { formatCount } from "../lib/song";
import { artistService } from "../lib/services";

/**
 * The "About" card: the artist's photo, who they are, and their biography.
 *
 * Shared by the player and the artist page so the two cannot drift apart —
 * they showed the same artist in two different shapes before this.
 *
 * Two ways to feed it. The player knows only an id and lets the card fetch;
 * the artist page has already loaded the same record and passes it in as
 * `profile`, which saves a second request for data sitting in memory.
 *
 * Follow works the same way. Left alone the card owns the button, but a
 * screen with its own Follow control passes `isFollowing` and
 * `onToggleFollow` down, so the two buttons cannot disagree about whether
 * you follow someone.
 *
 * The image is the artist's own photo — `profileImage` is the only one the
 * catalogue has, since no cover images were ever uploaded — shown wide
 * rather than as a small round avatar so it carries the section.
 */
const AboutArtist = ({
  artistId,
  profile,
  onOpen,
  isFollowing: followingProp,
  onToggleFollow,
}) => {
  const [fetched, setFetched] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);

  const managesFollow = typeof onToggleFollow !== "function";

  useEffect(() => {
    // Nothing to do when the screen already handed the record over.
    if (profile || !artistId) return undefined;

    let cancelled = false;
    setFetched(null);
    setExpanded(false);

    artistService
      .profile(artistId)
      .then((res) => {
        if (!cancelled) setFetched(res);
      })
      .catch(() => {
        // The screen still works without it; just show nothing.
      });

    return () => {
      cancelled = true;
    };
  }, [artistId, profile]);

  const data = profile || fetched;

  if (!data?.artist) return null;

  const { artist, stats = {} } = data;
  const following = managesFollow ? data.isFollowing : followingProp;

  // Before anyone has listened, "0 monthly listeners" reads as failure rather
  // than as a new artist, so fall back to the follower count.
  const audience = stats.monthlyListeners
    ? `${formatCount(stats.monthlyListeners)} monthly listeners`
    : `${formatCount(stats.followers ?? artist.followersCount)} followers`;

  const toggleFollow = async () => {
    if (!managesFollow) return onToggleFollow();

    setFollowBusy(true);

    try {
      const res = await artistService.follow(artistId);
      setFetched((prev) => ({
        ...prev,
        isFollowing: res?.following ?? !prev.isFollowing,
      }));
    } catch {
      // Leave the button as it was; the next open will show the truth.
    } finally {
      setFollowBusy(false);
    }
  };

  const body = (
    <>
      {artist.profileImage ? (
        <Image
          source={{ uri: artist.profileImage }}
          style={styles.image}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <View style={[styles.image, styles.imageFallback]}>
          <Text style={styles.initial}>
            {(artist.stageName || "?").charAt(0).toUpperCase()}
          </Text>
        </View>
      )}

      <View style={styles.body}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <View style={styles.nameRow}>
              <Text numberOfLines={1} style={styles.name}>
                {artist.stageName || "Artist"}
              </Text>

              {artist.isVerified ? (
                <View style={styles.verified}>
                  <Ionicons name="checkmark" size={11} color="#ffffff" />
                </View>
              ) : null}
            </View>

            <Text style={styles.meta}>{audience}</Text>
          </View>

          <Pressable
            onPress={toggleFollow}
            disabled={followBusy}
            hitSlop={8}
            style={({ pressed }) => [
              styles.followButton,
              following && styles.followingButton,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={styles.followLabel}>
              {following ? "Following" : "Follow"}
            </Text>
          </Pressable>
        </View>

        {artist.bio ? (
          <>
            <Text numberOfLines={expanded ? undefined : 3} style={styles.bio}>
              {artist.bio}
            </Text>

            <Pressable onPress={() => setExpanded((v) => !v)} hitSlop={8}>
              <Text style={styles.seeMore}>
                {expanded ? "see less" : "see more"}
              </Text>
            </Pressable>
          </>
        ) : null}
      </View>
    </>
  );

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>About</Text>

      {/* Only pressable where it leads somewhere. On the artist's own page it
          would be a link back to the page you are already reading. */}
      {onOpen ? (
        <Pressable
          onPress={onOpen}
          style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
        >
          {body}
        </Pressable>
      ) : (
        <View style={styles.card}>{body}</View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  heading: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text,
    marginBottom: spacing.md,
  },
  card: {
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.surfaceRaised,
  },
  image: {
    width: "100%",
    // Close to the 4:3 of the reference. Wider than this and the photo reads
    // as a banner strip; square and it pushes the name off the first screen.
    aspectRatio: 4 / 3,
    backgroundColor: colors.surface,
  },
  imageFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  initial: {
    fontSize: 56,
    fontWeight: "800",
    color: colors.textFaint,
  },
  body: {
    padding: spacing.lg,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  name: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
  },
  verified: {
    width: 16,
    height: 16,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  meta: {
    marginTop: 2,
    fontSize: 13,
    color: colors.textMuted,
  },
  followButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  followingButton: {
    borderColor: colors.accent,
  },
  followLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },
  bio: {
    marginTop: spacing.md,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
  },
  seeMore: {
    marginTop: spacing.sm,
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },
});

export default AboutArtist;
