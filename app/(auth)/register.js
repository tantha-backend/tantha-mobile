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
import { Link, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { PasswordField, Screen, SpinningIcon } from "../../components/ui";
import AppleSignInButton from "../../components/AppleSignInButton";
import { colors, radius, spacing, type } from "../../lib/theme";
import { errorMessage } from "../../lib/api";
import { useAuth } from "../../lib/auth";

const Register = () => {
  const router = useRouter();
  const { register, login, signInWithGoogle } = useAuth();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [googleBusy, setGoogleBusy] = useState(false);

  const set = (key) => (value) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.password) {
      setError("Fill in every field");
      return;
    }

    if (form.password.length < 6) {
      setError("Use at least 6 characters for your password");
      return;
    }

    if (form.password !== form.confirm) {
      setError("Passwords don't match");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const user = await register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      });

      // Register does not always return a session; sign in when it doesn't.
      if (!user) await login(form.email.trim(), form.password);
    } catch (err) {
      setError(errorMessage(err, "Could not create your account"));

      /**
       * Cleared here rather than in a finally, because success does not end
       * here — the auth gate replaces this screen once the session exists.
       * Clearing it on the way out put the idle button back on screen for the
       * moment in between, which reads as the tap having done nothing and
       * invites a second one.
       */
      setBusy(false);
    }
  };

  /**
   * Google sign-in.
   *
   * Dismissing the account chooser returns nothing, and that is not an error
   * — changing your mind should leave the screen exactly as it was, with no
   * red text blaming you for it.
   */
  const handleGoogle = async () => {
    setGoogleBusy(true);
    setError("");

    try {
      const user = await signInWithGoogle();

      /**
       * The auth gate replaces this screen once the session exists, so the
       * spinner is left running on success.
       *
       * Dismissing the account chooser is the exception: it returns nothing
       * rather than throwing, because changing your mind is not an error. But
       * nothing is going to replace this screen either, so the button has to
       * put itself back — otherwise it spins for ever over a screen that has
       * finished doing anything.
       */
      if (!user) setGoogleBusy(false);
    } catch (err) {
      setError(errorMessage(err, "Could not sign in with Google"));

      /**
       * Cleared here rather than in a finally, because success does not end
       * here — the auth gate replaces this screen once the session exists.
       * Clearing it on the way out put the idle button back on screen for the
       * moment in between, which reads as the tap having done nothing and
       * invites a second one.
       */
      setGoogleBusy(false);
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
          <Pressable
            onPress={() =>
              router.canGoBack()
                ? router.back()
                : router.replace("/(auth)/login")
            }
            hitSlop={8}
            style={styles.back}
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>

          <Text style={styles.heading}>Let&apos;s get{"\n"}started</Text>

          <View style={styles.form}>
            <View style={styles.field}>
              <Ionicons
                name="person-outline"
                size={18}
                color={colors.textFaint}
              />
              <TextInput
                value={form.name}
                onChangeText={set("name")}
                placeholder="Your name"
                placeholderTextColor={colors.textFaint}
                style={styles.fieldInput}
              />
            </View>

            <View style={[styles.field, { marginTop: spacing.lg }]}>
              <Ionicons
                name="mail-outline"
                size={18}
                color={colors.textFaint}
              />
              <TextInput
                value={form.email}
                onChangeText={set("email")}
                placeholder="Email id"
                placeholderTextColor={colors.textFaint}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                style={styles.fieldInput}
              />
            </View>

            <PasswordField
              value={form.password}
              onChangeText={set("password")}
              placeholder="Password"
              style={{ marginTop: spacing.lg }}
            />

            <PasswordField
              value={form.confirm}
              onChangeText={set("confirm")}
              placeholder="Confirm Password"
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
                  <SpinningIcon
                    name="musical-notes"
                    size={16}
                    color={colors.bg}
                  />
                  <Text style={styles.submitLabel}>Signing up...</Text>
                </View>
              ) : (
                <Text style={styles.submitLabel}>Sign up</Text>
              )}
            </Pressable>

            <Text style={styles.continueLabel}>or continue with</Text>

            {/*
              Apple first, and not by accident: Apple ask that their sign-in
              be no less prominent than the others it sits beside. On Android
              the button renders nothing and the gap closes with it.
            */}
            <View style={styles.socialStack}>
              <AppleSignInButton onError={setError} />

              <Pressable
                onPress={handleGoogle}
                disabled={googleBusy}
                style={({ pressed }) => [
                  styles.socialButton,
                  pressed && styles.socialPressed,
                  googleBusy && { opacity: 0.6 },
                ]}
              >
                {googleBusy ? (
                  <>
                    <SpinningIcon
                      name="musical-notes"
                      size={16}
                      color={colors.text}
                    />
                    <Text style={styles.socialLabel}>Signing up...</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="logo-google" size={16} color="#EA4335" />
                    <Text style={styles.socialLabel}>Google</Text>
                  </>
                )}
              </Pressable>
            </View>

            <View style={styles.footer}>
              <Text style={type.muted}>Already have an account? </Text>
              <Link href="/(auth)/login" style={styles.link}>
                Login
              </Link>
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
    marginTop: spacing.xxl,
    fontSize: 30,
    fontWeight: "700",
    color: colors.text,
    lineHeight: 36,
  },
  form: {
    marginTop: spacing.xxl,
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    height: 54,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: spacing.lg,
  },
  fieldInput: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
  },
  error: {
    marginTop: spacing.lg,
    color: colors.danger,
    fontSize: 13,
  },
  submit: {
    height: 54,
    borderRadius: radius.pill,
    backgroundColor: colors.text,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.xl,
  },
  submitDisabled: {
    opacity: 0.6,
  },
  submitPressed: {
    opacity: 0.85,
  },
  submitLabel: {
    color: colors.bg,
    fontSize: 15,
    fontWeight: "700",
  },
  submitBusy: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  continueLabel: {
    textAlign: "center",
    fontSize: 13,
    color: colors.textFaint,
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  socialStack: {
    gap: spacing.md,
  },
  socialButton: {
    height: 54,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  socialPressed: {
    opacity: 0.7,
  },
  socialLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: spacing.xl,
  },
  link: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "600",
  },
});

export default Register;
