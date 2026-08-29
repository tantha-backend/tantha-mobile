import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { PasswordField, Screen, SpinningIcon } from "../../components/ui";
import { colors, radius, spacing, type } from "../../lib/theme";
import { errorMessage } from "../../lib/api";
import { useAuth } from "../../lib/auth";

const MIN_PASSWORD = 8;

/**
 * Sets a new password from a reset code.
 *
 * The code arrives either in the link (`?token=…`, which expo-router hands
 * over as a param) or typed in by hand — artists are given theirs directly by
 * an admin while there is no mail provider, so the field has to be editable.
 */
const ResetPassword = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { resetPassword } = useAuth();

  const [token, setToken] = useState(String(params.token || ""));
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!token.trim()) {
      setError("Paste the code from your reset link");
      return;
    }
    if (password.length < MIN_PASSWORD) {
      setError(`Password must be at least ${MIN_PASSWORD} characters`);
      return;
    }
    if (password !== confirm) {
      setError("Those passwords don't match");
      return;
    }

    setBusy(true);
    setError("");

    try {
      await resetPassword(token.trim(), password);
      // The reset returns a session, so the auth gate takes it from here.
    } catch (err) {
      setError(errorMessage(err, "Could not reset your password"));
    } finally {
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
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.back}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>

          <Text style={styles.heading}>Set a new{"\n"}password</Text>
          <Text style={styles.body}>
            Reset codes work once and expire an hour after they are sent.
          </Text>

          <View style={styles.form}>
            <View style={styles.field}>
              <Ionicons name="key-outline" size={18} color={colors.textFaint} />
              <TextInput
                value={token}
                onChangeText={setToken}
                placeholder="Reset code"
                placeholderTextColor={colors.textFaint}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.fieldInput}
              />
            </View>

            <PasswordField
              value={password}
              onChangeText={setPassword}
              placeholder="New password"
              style={{ marginTop: spacing.lg }}
            />

            <PasswordField
              value={confirm}
              onChangeText={setConfirm}
              placeholder="Confirm new password"
              onSubmitEditing={submit}
              returnKeyType="go"
              style={{ marginTop: spacing.lg }}
            />

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
                  <Text style={styles.submitLabel}>Saving...</Text>
                </View>
              ) : (
                <Text style={styles.submitLabel}>Save password</Text>
              )}
            </Pressable>

            <View style={styles.footer}>
              <Text style={type.muted}>Need a new code? </Text>
              <Pressable onPress={() => router.replace("/(auth)/forgot-password")} hitSlop={8}>
                <Text style={styles.link}>Request one</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    padding: spacing.xl,
  },
  back: {
    position: "absolute",
    top: spacing.xl,
    left: spacing.xl,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  heading: {
    fontSize: 30,
    fontWeight: "700",
    color: colors.text,
    lineHeight: 36,
  },
  body: {
    marginTop: spacing.md,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
  },
  form: { marginTop: spacing.xxl },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    height: 52,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
  },
  fieldInput: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    padding: 0,
  },
  error: {
    marginTop: spacing.md,
    color: colors.danger,
    fontSize: 13,
  },
  submit: {
    marginTop: spacing.xl,
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
  footer: {
    marginTop: spacing.xl,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  link: {
    color: colors.accent,
    // Same size as the muted text it sits beside, so they share a baseline.
    fontSize: 13,
    fontWeight: "600",
  },
});

export default ResetPassword;
