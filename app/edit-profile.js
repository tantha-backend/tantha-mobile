import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PasswordField, Screen, SpinningIcon, Toast } from "../components/ui";
import { colors, radius, spacing } from "../lib/theme";
import { errorMessage } from "../lib/api";
import { useAuth } from "../lib/auth";
import { authService } from "../lib/services";

const MAX_NAME = 60;
const MIN_PASSWORD = 8;

/**
 * Lets someone change their own name, photo and password.
 *
 * Email is shown but not editable: it is the login identity, and changing it
 * without confirming the new address would let one typo lock a person out of
 * their account.
 */
const EditProfile = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, refresh, signOut } = useAuth();

  const [name, setName] = useState(user?.name || "");
  const [photo, setPhoto] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const [showPassword, setShowPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwBusy, setPwBusy] = useState(false);

  const [showDelete, setShowDelete] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [delBusy, setDelBusy] = useState(false);

  // Google and Apple accounts have no password, so they confirm by typing
  // the word instead. Anything that is not our own email login is one of
  // those, which stays true as more ways in are added.
  const isPasswordless = user?.authProvider !== "local";

  const shownPhoto = photo?.uri || user?.profileImage || null;
  const dirty = name.trim() !== (user?.name || "") || Boolean(photo);

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        "Photos permission needed",
        "Allow photo access to choose a profile picture.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      // Uploaded straight to storage, so keep it small before it leaves.
      quality: 0.7,
    });

    if (!result.canceled) setPhoto(result.assets[0]);
  };

  /**
   * Back to the profile, once the toast has had its moment. The new name and
   * photo are only visible there, so staying on a form with nothing left to
   * change reads as though the save did not take.
   */
  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/profile");
  };

  const save = async () => {
    if (!name.trim()) {
      setToast({ text: "Please enter your name", tone: "error" });
      return;
    }

    setSaving(true);

    try {
      await authService.updateMe({ name: name.trim(), photo });
      await refresh();

      setPhoto(null);
      setToast({ text: "Profile updated", tone: "success", then: leave });
    } catch (err) {
      setToast({ text: errorMessage(err, "Could not save"), tone: "error" });
    } finally {
      setSaving(false);
    }
  };

  const savePassword = async () => {
    if (!currentPassword || !newPassword) {
      setToast({ text: "Fill in both passwords", tone: "error" });
      return;
    }
    if (newPassword.length < MIN_PASSWORD) {
      setToast({
        text: `New password must be at least ${MIN_PASSWORD} characters`,
        tone: "error",
      });
      return;
    }
    if (newPassword !== confirm) {
      setToast({ text: "Those passwords don't match", tone: "error" });
      return;
    }

    setPwBusy(true);

    try {
      await authService.changePassword(currentPassword, newPassword);

      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
      setShowPassword(false);
      setToast({ text: "Password changed", tone: "success" });
    } catch (err) {
      setToast({
        text: errorMessage(err, "Could not change password"),
        tone: "error",
      });
    } finally {
      setPwBusy(false);
    }
  };

  /**
   * Deletes the account, after asking twice.
   *
   * The typed confirmation and the alert are doing different jobs. Typing
   * proves the person meant to open this section at all; the alert is the
   * last chance to notice what is about to happen, because nothing after it
   * can be undone — there is no grace period and no restore.
   */
  const removeAccount = () => {
    if (!deleteInput.trim()) {
      setToast({
        text: isPasswordless ? "Type DELETE to confirm" : "Enter your password",
        tone: "error",
      });
      return;
    }

    Alert.alert(
      "Delete your account?",
      "Your playlists, listening history, likes and comments will be " +
        "permanently deleted. This cannot be undone.",
      [
        { text: "Keep my account", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDelBusy(true);

            try {
              await authService.deleteAccount(
                isPasswordless
                  ? { confirm: deleteInput.trim() }
                  : { password: deleteInput },
              );

              // The account is gone, so the token in memory is worthless.
              // Signing out is what sends them back to the login screen.
              await signOut();
            } catch (err) {
              setToast({
                text: errorMessage(err, "Could not delete your account"),
                tone: "error",
              });
              setDelBusy(false);
            }
          },
        },
      ],
    );
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + spacing.lg },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <Ionicons name="chevron-back" size={26} color={colors.text} />
            </Pressable>
            <Text style={styles.headerTitle}>Edit profile</Text>
            <View style={{ width: 26 }} />
          </View>

          <Pressable onPress={pickPhoto} style={styles.avatarWrap}>
            {shownPhoto ? (
              <Image
                source={{ uri: shownPhoto }}
                style={styles.avatar}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarInitial}>
                  {(user?.name || "?").charAt(0).toUpperCase()}
                </Text>
              </View>
            )}

            <View style={styles.avatarBadge}>
              <Ionicons name="camera" size={16} color={colors.bg} />
            </View>
          </Pressable>

          <Text style={styles.avatarHint}>Tap to change your photo</Text>

          <Text style={styles.label}>Name</Text>
          <View style={styles.field}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={colors.textFaint}
              maxLength={MAX_NAME}
              style={styles.input}
            />
          </View>

          <Text style={styles.label}>Email</Text>
          <View style={[styles.field, styles.fieldLocked]}>
            <Text numberOfLines={1} style={styles.lockedText}>
              {user?.email}
            </Text>
            <Ionicons name="lock-closed" size={15} color={colors.textFaint} />
          </View>
          <Text style={styles.hint}>
            Your email is how you sign in, so it can&apos;t be changed here.
          </Text>

          <Pressable
            onPress={save}
            disabled={saving || !dirty}
            style={({ pressed }) => [
              styles.submit,
              (!dirty || saving) && styles.submitDisabled,
              pressed && { opacity: 0.85 },
            ]}
          >
            {saving ? (
              <View style={styles.submitBusy}>
                <SpinningIcon
                  name="musical-notes"
                  size={16}
                  color={colors.bg}
                />
                <Text style={styles.submitLabel}>Saving...</Text>
              </View>
            ) : (
              <Text style={styles.submitLabel}>Save changes</Text>
            )}
          </Pressable>

          {/* ---- password ------------------------------------------------ */}
          <Pressable
            onPress={() => setShowPassword((v) => !v)}
            style={styles.passwordToggle}
          >
            <Ionicons name="key-outline" size={18} color={colors.text} />
            <Text style={styles.passwordToggleLabel}>Change password</Text>
            <Ionicons
              name={showPassword ? "chevron-up" : "chevron-down"}
              size={18}
              color={colors.textMuted}
            />
          </Pressable>

          {showPassword ? (
            <View style={styles.passwordBlock}>
              <PasswordField
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Current password"
              />
              <PasswordField
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="New password"
                style={{ marginTop: spacing.md }}
              />
              <PasswordField
                value={confirm}
                onChangeText={setConfirm}
                placeholder="Confirm new password"
                style={{ marginTop: spacing.md }}
              />

              <Pressable
                onPress={savePassword}
                disabled={pwBusy}
                style={({ pressed }) => [
                  styles.submit,
                  styles.passwordSubmit,
                  pwBusy && styles.submitDisabled,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={styles.submitLabel}>
                  {pwBusy ? "Saving..." : "Update password"}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {/* ---- delete account ------------------------------------------ */}
          <Pressable
            onPress={() => setShowDelete((v) => !v)}
            style={styles.passwordToggle}
          >
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
            <Text
              style={[styles.passwordToggleLabel, { color: colors.danger }]}
            >
              Delete account
            </Text>
            <Ionicons
              name={showDelete ? "chevron-up" : "chevron-down"}
              size={18}
              color={colors.textMuted}
            />
          </Pressable>

          {showDelete ? (
            <View style={styles.passwordBlock}>
              <Text style={styles.deleteWarning}>
                This permanently deletes your account, playlists, listening
                history, likes and comments. It cannot be undone.
              </Text>

              {isPasswordless ? (
                <TextInput
                  value={deleteInput}
                  onChangeText={setDeleteInput}
                  placeholder="Type DELETE"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  style={styles.deleteInput}
                />
              ) : (
                <PasswordField
                  value={deleteInput}
                  onChangeText={setDeleteInput}
                  placeholder="Your password"
                />
              )}

              <Pressable
                onPress={removeAccount}
                disabled={delBusy}
                style={({ pressed }) => [
                  styles.submit,
                  styles.passwordSubmit,
                  styles.deleteSubmit,
                  delBusy && styles.submitDisabled,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={styles.submitLabel}>
                  {delBusy ? "Deleting..." : "Delete my account"}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <Toast
        message={toast?.text}
        tone={toast?.tone}
        onHide={() => {
          toast?.then?.();
          setToast(null);
        }}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    padding: spacing.xl,
    paddingBottom: spacing.xxl * 2,
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
  avatarWrap: {
    alignSelf: "center",
    marginTop: spacing.xxl,
  },
  avatar: {
    width: 116,
    height: 116,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontSize: 44,
    fontWeight: "800",
    color: colors.textFaint,
  },
  avatarBadge: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: colors.bg,
  },
  avatarHint: {
    alignSelf: "center",
    marginTop: spacing.md,
    fontSize: 13,
    color: colors.textMuted,
  },
  label: {
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    fontSize: 13,
    fontWeight: "600",
    color: colors.textMuted,
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    height: 52,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
  },
  fieldLocked: {
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    padding: 0,
  },
  lockedText: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 15,
  },
  hint: {
    marginTop: spacing.sm,
    fontSize: 12,
    color: colors.textFaint,
  },
  deleteWarning: {
    marginBottom: spacing.lg,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
  },
  deleteInput: {
    height: 52,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    color: colors.text,
    fontSize: 15,
  },
  deleteSubmit: {
    backgroundColor: colors.danger,
  },
  submit: {
    marginTop: spacing.xxl,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  submitDisabled: { opacity: 0.45 },
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
  passwordToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.xxl,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  passwordToggleLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  passwordBlock: {
    marginTop: spacing.sm,
  },
  passwordSubmit: {
    marginTop: spacing.xl,
  },
});

export default EditProfile;
