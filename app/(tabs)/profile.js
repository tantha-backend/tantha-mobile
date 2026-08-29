import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Artwork, Button, Screen, SectionHeader } from "../../components/ui";
import { colors, radius, spacing, type, MINI_PLAYER_HEIGHT } from "../../lib/theme";
import { artistService, fanClubService, premiumService } from "../../lib/services";
import { MONETISATION_ENABLED } from "../../lib/features";
import { useAuth } from "../../lib/auth";
import { usePlayer } from "../../lib/player";

const Profile = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const { stop } = usePlayer();

  const [premium, setPremium] = useState(null);
  const [following, setFollowing] = useState([]);
  const [fanClubs, setFanClubs] = useState([]);

  useFocusEffect(
    useCallback(() => {
      // Each of these is optional context; a failure just hides that block.
      premiumService.status().then(setPremium).catch(() => {});
      artistService.following().then(setFollowing).catch(() => {});
      fanClubService.mine().then(setFanClubs).catch(() => {});
    }, []),
  );

  const isPremium = Boolean(premium?.isPremium ?? user?.isPremium);

  const handleSignOut = async () => {
    stop();
    await signOut();
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + spacing.lg,
          paddingBottom: MINI_PLAYER_HEIGHT + spacing.xxl,
        }}
      >
        <View style={styles.header}>
          <Artwork
            uri={user?.profileImage}
            size={72}
            rounded={radius.pill}
            label={user?.name}
          />

          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={type.heading}>
              {user?.name || "Listener"}
            </Text>
            <Text numberOfLines={1} style={type.muted}>
              {user?.email}
            </Text>
          </View>

          <Pressable
            onPress={() => router.push("/edit-profile")}
            hitSlop={10}
            style={({ pressed }) => [styles.editButton, pressed && { opacity: 0.7 }]}
            accessibilityLabel="Edit profile"
          >
            <Ionicons name="pencil" size={17} color={colors.text} />
          </Pressable>
        </View>

        {/*
          Hidden while the app is free. Someone who already has premium still
          sees their standing, so an existing subscriber is never told their
          membership vanished — they simply are not offered an upgrade.
        */}
        {MONETISATION_ENABLED || isPremium ? (
          <View style={styles.planCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.planLabel}>
                {isPremium ? "Tantha Premium" : "Free plan"}
              </Text>
              <Text style={styles.planHint}>
                {isPremium
                  ? premium?.premiumExpiresAt
                    ? `Renews ${new Date(premium.premiumExpiresAt).toLocaleDateString()}`
                    : "Active"
                  : "Unlock premium-only releases."}
              </Text>
            </View>

            {MONETISATION_ENABLED && !isPremium && (
              <Button
                label="Upgrade"
                onPress={() => router.push("/premium")}
                style={styles.upgradeButton}
              />
            )}
          </View>
        ) : null}

        {following.length > 0 && (
          <>
            <SectionHeader title="Following" />
            {following.map((artist) => (
              <Pressable
                key={artist._id}
                onPress={() => router.push(`/artist/${artist._id}`)}
                style={({ pressed }) => [
                  styles.row,
                  pressed && { backgroundColor: colors.surfaceRaised },
                ]}
              >
                <Artwork
                  uri={artist.profileImage}
                  size={44}
                  rounded={radius.pill}
                  label={artist.stageName}
                />
                <Text numberOfLines={1} style={styles.rowTitle}>
                  {artist.stageName || "Artist"}
                </Text>
              </Pressable>
            ))}
          </>
        )}

        {fanClubs.length > 0 && (
          <>
            <SectionHeader title="Fan clubs" />
            {fanClubs.map((sub) => (
              <View key={sub._id} style={styles.row}>
                <Artwork
                  uri={sub.artistId?.profileImage}
                  size={44}
                  rounded={radius.pill}
                  label={sub.artistId?.stageName}
                />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={styles.rowTitle}>
                    {sub.artistId?.stageName || "Artist"}
                  </Text>
                  <Text style={styles.rowMeta}>{sub.status || "active"}</Text>
                </View>
              </View>
            ))}
          </>
        )}

        <View style={styles.signOutWrap}>
          <Button label="Sign out" variant="secondary" onPress={handleSignOut} />
        </View>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  editButton: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  planCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    margin: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  planLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  planHint: {
    marginTop: spacing.xs,
    fontSize: 12,
    color: colors.textMuted,
  },
  upgradeButton: {
    height: 40,
    paddingHorizontal: spacing.lg,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  rowTitle: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
  },
  rowMeta: {
    fontSize: 12,
    color: colors.textMuted,
  },
  signOutWrap: {
    padding: spacing.lg,
    marginTop: spacing.xl,
  },
});

export default Profile;
