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
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { Screen, SpinningIcon } from "../../components/ui";
import { colors, radius, spacing, type } from "../../lib/theme";
import { errorMessage } from "../../lib/api";
import { authService } from "../../lib/services";

/**
 * Asks for the account's email and starts a reset.
 *
 * The server answers identically whether or not the address is registered, so
 * this screen cannot say "no such account" — and shouldn't, since that would
 * turn the form into a way of checking who has signed up.
 */
const ForgotPassword = () => {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!email.trim()) {
      setError("Enter your email");
      return;
    }

    setBusy(true);
    setError("");

    try {
      await authService.forgotPassword(email.trim());
      setSent(true);
    } catch (err) {
      setError(errorMessage(err, "Could not start the reset"));
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

          {sent ? (
            <View style={styles.done}>
              <View style={styles.doneIcon}>
                <Ionicons name="mail-outline" size={30} color={colors.accent} />
              </View>

              <Text style={styles.heading}>Check your email</Text>

              <Text style={styles.body}>
                If {email.trim()} has an account, a reset link is on its way.
                The link works once and expires in an hour.
              </Text>

              <Pressable
                onPress={() => router.push("/(auth)/reset-password")}
                style={({ pressed }) => [
                    styles.submit,
                    styles.submitWide,
                    pressed && styles.submitPressed,
                  ]}
              >
                <Text style={styles.submitLabel}>I have a code</Text>
              </Pressable>

              <Pressable onPress={() => setSent(false)} hitSlop={8}>
                <Text style={[styles.link, styles.linkSpaced]}>
                    Use a different email
                  </Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={styles.heading}>Forgot{"\n"}your password?</Text>
              <Text style={styles.body}>
                Enter the email on your account and we&apos;ll send you a link
                to set a new password.
              </Text>

              <View style={styles.form}>
                <View style={styles.field}>
                  <Ionicons name="mail-outline" size={18} color={colors.textFaint} />
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Email id"
                    placeholderTextColor={colors.textFaint}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    returnKeyType="go"
                    onSubmitEditing={submit}
                    style={styles.fieldInput}
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
                      <Text style={styles.submitLabel}>Sending...</Text>
                    </View>
                  ) : (
                    <Text style={styles.submitLabel}>Send reset link</Text>
                  )}
                </Pressable>

                <View style={styles.footer}>
                  <Text style={type.muted}>Remembered it? </Text>
                  <Pressable onPress={() => router.back()} hitSlop={8}>
                    <Text style={styles.link}>Sign in</Text>
                  </Pressable>
                </View>
              </View>
            </>
          )}
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
  form: {
    marginTop: spacing.xxl,
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
    // The pill radius curves inward at both ends; without padding a
    // shrink-to-fit parent lets that curve cut into the first and last letter.
    paddingHorizontal: spacing.xl,
  },
  submitDisabled: { opacity: 0.7 },
  submitPressed: { opacity: 0.85 },
  submitBusy: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  submitWide: {
    alignSelf: "stretch",
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
    // Matches type.muted so the two halves of "Remembered it? Sign in"
    // share a baseline.
    fontSize: 13,
    fontWeight: "600",
  },

  // The standalone link under the button still needs its own spacing.
  linkSpaced: {
    marginTop: spacing.lg,
  },
  done: {
    alignItems: "center",
    gap: spacing.sm,
  },
  doneIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.accentDim,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
});

export default ForgotPassword;
