import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Screen, SpinningIcon } from "../../components/ui";
import { colors, radius, spacing, type } from "../../lib/theme";
import { errorMessage } from "../../lib/api";
import { playlistService } from "../../lib/services";

const MAX_TITLE = 80;

/**
 * Creates a playlist, then opens it so songs can be added straight away —
 * landing back on a list with nothing in it reads as a failure.
 *
 * Reached two ways. From the library it is a blank playlist. From a song's
 * "Add to playlist" it carries `songId`, and that song goes in as part of
 * creating it: someone who picked "New playlist" from a track was always
 * asking for a playlist *with that track in it*, and making them find the
 * song again afterwards was a step that existed for no reason.
 */
const NewPlaylist = () => {
  const router = useRouter();
  const { songId } = useLocalSearchParams();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    const name = title.trim();

    if (!name) {
      setError("Give your playlist a name");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const playlist = await playlistService.create({
        title: name,
        description: description.trim(),
        isPublic,
      });

      if (songId) {
        try {
          await playlistService.addSong(playlist._id, String(songId));
        } catch {
          // The playlist exists either way; opening it shows what is in it,
          // and failing the whole creation over one song would be worse.
        }
      }

      router.replace(`/playlist/${playlist._id}`);
    } catch (err) {
      setError(errorMessage(err, "Could not create the playlist"));
      setBusy(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <Ionicons name="close" size={26} color={colors.text} />
            </Pressable>
            <Text style={styles.headerTitle}>New playlist</Text>
            <View style={{ width: 26 }} />
          </View>

          <View style={styles.cover}>
            <Ionicons name="musical-notes" size={44} color={colors.textFaint} />
          </View>

          <View style={styles.field}>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Playlist name"
              placeholderTextColor={colors.textFaint}
              maxLength={MAX_TITLE}
              autoFocus
              style={styles.titleInput}
            />
          </View>

          <Text style={styles.counter}>
            {title.length}/{MAX_TITLE}
          </Text>

          <View style={[styles.field, styles.descField]}>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Description (optional)"
              placeholderTextColor={colors.textFaint}
              multiline
              style={styles.descInput}
            />
          </View>

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>Public</Text>
              <Text style={type.muted}>
                {isPublic
                  ? "Anyone can find and play this playlist."
                  : "Only you can see this playlist."}
              </Text>
            </View>

            <Switch
              value={isPublic}
              onValueChange={setIsPublic}
              trackColor={{ false: colors.surfaceRaised, true: colors.accentDim }}
              thumbColor={isPublic ? colors.accent : colors.textFaint}
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            onPress={submit}
            disabled={busy}
            style={({ pressed }) => [
              styles.submit,
              busy && styles.submitDisabled,
              pressed && styles.submitPressed,
            ]}
          >
            {busy ? (
              <View style={styles.submitBusy}>
                <SpinningIcon name="musical-notes" size={16} color={colors.bg} />
                <Text style={styles.submitLabel}>Creating...</Text>
              </View>
            ) : (
              <Text style={styles.submitLabel}>
                {songId ? "Create and add song" : "Create playlist"}
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    padding: spacing.xl,
    paddingTop: spacing.xxl,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  cover: {
    alignSelf: "center",
    width: 140,
    height: 140,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: spacing.xxl,
  },
  field: {
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: spacing.lg,
  },
  titleInput: {
    height: 52,
    color: colors.text,
    fontSize: 17,
    fontWeight: "600",
    padding: 0,
  },
  counter: {
    alignSelf: "flex-end",
    marginTop: spacing.xs,
    fontSize: 11,
    color: colors.textFaint,
  },
  descField: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
  },
  descInput: {
    minHeight: 70,
    color: colors.text,
    fontSize: 14,
    padding: 0,
    textAlignVertical: "top",
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    marginTop: spacing.xl,
  },
  switchLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 2,
  },
  error: {
    marginTop: spacing.lg,
    color: colors.danger,
    fontSize: 13,
  },
  submit: {
    marginTop: spacing.xxl,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  submitDisabled: { opacity: 0.7 },
  submitPressed: { opacity: 0.85 },
  submitBusy: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  submitLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.bg,
  },
});

export default NewPlaylist;
