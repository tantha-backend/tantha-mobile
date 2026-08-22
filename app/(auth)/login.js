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
import { Link, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { PasswordField, Screen, SpinningIcon } from "../../components/ui";
import { colors, radius, spacing, type } from "../../lib/theme";
import { errorMessage, API_BASE_URL } from "../../lib/api";
import { useAuth } from "../../lib/auth";

const notReady = (provider) =>
  Alert.alert(`${provider} sign-in`, "Not wired up yet — use email and password for now.");

const Login = () => {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!email.trim() || !password) {
      setError("Enter your email and password");
      return;
    }

    setBusy(true);
    setError("");

    try {
      await login(email.trim(), password);
      // The auth gate handles navigation once the session exists.
    } catch (err) {
      setError(errorMessage(err, "Could not sign in"));
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
          {router.canGoBack() ? (
            <Pressable onPress={() => router.back()} hitSlop={8} style={styles.back}>
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </Pressable>
          ) : null}

          <Text style={styles.heading}>Hey,{"\n"}Welcome Back</Text>

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
                style={styles.fieldInput}
              />
            </View>

            <PasswordField
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              onSubmitEditing={submit}
              returnKeyType="go"
              style={{ marginTop: spacing.lg }}
            />

            <Pressable
              onPress={() => router.push("/(auth)/forgot-password")}
              hitSlop={8}
              style={styles.forgot}
            >
              <Text style={styles.forgotText}>Forgot password?</Text>
            </Pressable>

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
                  <Text style={styles.submitLabel}>Logging in...</Text>
                </View>
              ) : (
                <Text style={styles.submitLabel}>Login</Text>
              )}
            </Pressable>

            <Text style={styles.continueLabel}>or continue with</Text>

            <Pressable
              onPress={() => notReady("Google")}
              style={({ pressed }) => [styles.socialButton, pressed && styles.socialPressed]}
            >
              <Ionicons name="logo-google" size={16} color="#EA4335" />
              <Text style={styles.socialLabel}>Google</Text>
            </Pressable>

            <View style={styles.footer}>
              <Text style={type.muted}>Don&apos;t have an account? </Text>
              <Link href="/(auth)/register" style={styles.link}>
                Sign up
              </Link>
            </View>
          </View>

          {/* Makes a wrong dev host obvious instead of a silent timeout. */}
          {__DEV__ ? (
            <Text style={styles.devHint}>API: {API_BASE_URL}</Text>
          ) : null}
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
  forgot: {
    alignSelf: "flex-end",
    marginTop: spacing.md,
  },
  forgotText: {
    fontSize: 12,
    color: colors.textMuted,
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
  devHint: {
    marginTop: spacing.xxl,
    textAlign: "center",
    fontSize: 11,
    color: colors.textFaint,
  },
});

export default Login;
