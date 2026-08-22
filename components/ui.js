import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";

import { colors, radius, spacing, type } from "../lib/theme";

export const Screen = ({ children, style }) => (
  <View style={[styles.screen, style]}>{children}</View>
);

export const Loading = ({ label = "Loading..." }) => (
  <View style={styles.centered}>
    <ActivityIndicator color={colors.accent} />
    <Text style={[type.muted, { marginTop: spacing.md }]}>{label}</Text>
  </View>
);

export const Empty = ({ title, subtitle }) => (
  <View style={styles.centered}>
    <Text style={type.subheading}>{title}</Text>
    {subtitle ? (
      <Text style={[type.muted, styles.emptySubtitle]}>{subtitle}</Text>
    ) : null}
  </View>
);

export const Button = ({
  label,
  onPress,
  disabled,
  loading,
  variant = "primary",
  style,
}) => (
  <Pressable
    onPress={onPress}
    disabled={disabled || loading}
    style={({ pressed }) => [
      styles.button,
      variant === "primary" ? styles.buttonPrimary : styles.buttonSecondary,
      (disabled || loading) && styles.buttonDisabled,
      pressed && styles.buttonPressed,
      style,
    ]}
  >
    {loading ? (
      <ActivityIndicator color={colors.text} size="small" />
    ) : (
      <Text style={styles.buttonLabel}>{label}</Text>
    )}
  </Pressable>
);

/**
 * A continuously rotating icon, used as a branded stand-in for the default
 * spinner on buttons mid-submit.
 */
export const SpinningIcon = ({ name = "sync", size = 16, color = colors.text }) => {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 800,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <Ionicons name={name} size={size} color={color} />
    </Animated.View>
  );
};

/**
 * A boxed password input with an eye toggle that pops on tap instead of just
 * swapping the icon flatly.
 */
export const PasswordField = ({
  value,
  onChangeText,
  placeholder = "Password",
  onSubmitEditing,
  returnKeyType,
  style,
}) => {
  const [visible, setVisible] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;

  const toggle = () => {
    setVisible((v) => !v);
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.6, duration: 80, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 4 }),
    ]).start();
  };

  return (
    <View style={[styles.field, style]}>
      <Ionicons name="lock-closed-outline" size={18} color={colors.textFaint} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        secureTextEntry={!visible}
        style={styles.fieldInput}
        onSubmitEditing={onSubmitEditing}
        returnKeyType={returnKeyType}
      />
      <Pressable onPress={toggle} hitSlop={8}>
        <Animated.View style={{ transform: [{ scale }] }}>
          <Ionicons
            name={visible ? "eye-off-outline" : "eye-outline"}
            size={18}
            color={colors.textFaint}
          />
        </Animated.View>
      </Pressable>
    </View>
  );
};

/**
 * A small round play/pause control. Pops on tap, and breathes with a slow
 * pulse while its track is the one actively playing.
 */
export const PlayButton = ({ playing, active, onPress, size = 34 }) => {
  const press = useRef(new Animated.Value(1)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!(active && playing)) {
      pulse.setValue(1);
      return undefined;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.12,
          duration: 550,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 550,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, playing, pulse]);

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(press, { toValue: 0.8, duration: 80, useNativeDriver: true }),
      Animated.spring(press, { toValue: 1, useNativeDriver: true, friction: 4 }),
    ]).start();
    onPress?.();
  };

  const showPause = active && playing;

  return (
    <Pressable onPress={handlePress} hitSlop={8}>
      <Animated.View
        style={[
          styles.playButton,
          { width: size, height: size, borderRadius: size / 2 },
          active && styles.playButtonActive,
          { transform: [{ scale: Animated.multiply(press, pulse) }] },
        ]}
      >
        {showPause ? (
          <View
            style={{
              width: size * 0.48 + 1,
              height: size * 0.48,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons
              name="pause"
              size={size * 0.48}
              color={colors.text}
              style={{ position: "absolute", left: 0 }}
            />
            <Ionicons
              name="pause"
              size={size * 0.48}
              color={colors.text}
              style={{ position: "absolute", left: 1 }}
            />
          </View>
        ) : (
          <Ionicons
            name="play"
            size={size * 0.48}
            color={colors.text}
            style={{ marginLeft: 2 }}
          />
        )}
      </Animated.View>
    </Pressable>
  );
};

/**
 * Square artwork with an initial-letter fallback, since many records have no
 * cover image yet.
 */
export const Artwork = ({ uri, size = 56, rounded = radius.sm, label = "" }) => {
  const dimension = { width: size, height: size, borderRadius: rounded };

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[styles.artwork, dimension]}
        contentFit="cover"
        transition={150}
      />
    );
  }

  return (
    <View style={[styles.artwork, styles.artworkFallback, dimension]}>
      <Text style={{ fontSize: size * 0.36, fontWeight: "700", color: colors.text }}>
        {(label || "?").charAt(0).toUpperCase()}
      </Text>
    </View>
  );
};

/**
 * Brief confirmation that slides up from the bottom and leaves on its own.
 *
 * Used instead of Alert for things that merely happened — adding a track to a
 * playlist is not a question, and a modal that has to be dismissed interrupts
 * playback for no reason. `ToastAndroid` would be simpler but exists only on
 * Android and cannot be styled to match.
 *
 * Rendering is driven by `message`: set it to show, and `onHide` fires once
 * the toast has faded so the caller can clear it.
 */
export const Toast = ({
  message,
  onHide,
  duration = 2400,
  offset = 0,
  tone = "success",
}) => {
  const anim = useRef(new Animated.Value(0)).current;

  /**
   * Held in a ref so it never re-triggers the animation.
   *
   * Callers naturally write `onHide={() => setToast("")}`, which is a new
   * function every render. With it in the dependency list the effect re-ran
   * on each render, reset the animation and started again — and since the
   * player re-renders several times a second to move the progress bar, the
   * toast restarted forever instead of fading out once.
   */
  const onHideRef = useRef(onHide);
  onHideRef.current = onHide;

  useEffect(() => {
    if (!message) return undefined;

    anim.setValue(0);

    const run = Animated.sequence([
      Animated.timing(anim, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.delay(duration),
      Animated.timing(anim, {
        toValue: 0,
        duration: 220,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]);

    run.start(({ finished }) => {
      if (finished) onHideRef.current?.();
    });

    // A second toast arriving mid-animation must not leave the first stuck.
    return () => run.stop();
  }, [message, duration, anim]);

  if (!message) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.toast,
        {
          bottom: spacing.xxl + offset,
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [24, 0],
              }),
            },
          ],
        },
      ]}
    >
      {/* A failure showed a tick before this — "Song already exists in
          playlist" read as though it had worked. */}
      <Ionicons
        name={tone === "error" ? "alert-circle" : "checkmark-circle"}
        size={18}
        color={tone === "error" ? colors.warning : colors.accent}
      />
      <Text numberOfLines={2} style={styles.toastText}>
        {message}
      </Text>
    </Animated.View>
  );
};

/**
 * Queue glyph: an outlined pill over three solid rules.
 *
 * Drawn from plain Views rather than an icon font — Ionicons has nothing
 * close, and four straight bars do not justify pulling in a vector library
 * that would then have to be added to the native build.
 *
 * Proportions follow the reference at a 512 grid, scaled by `size`.
 */
export const QueueIcon = ({ size = 26, color = colors.text }) => {
  const unit = size / 26;
  const stroke = Math.max(1.6, 2 * unit);
  const rule = Math.max(1.8, 2.2 * unit);
  const gap = 3 * unit;

  return (
    <View style={{ width: size, height: size, justifyContent: "center" }}>
      <View
        style={{
          height: 9 * unit,
          borderWidth: stroke,
          borderColor: color,
          borderRadius: 5 * unit,
        }}
      />

      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={{
            height: rule,
            marginTop: gap,
            borderRadius: rule / 2,
            backgroundColor: color,
          }}
        />
      ))}
    </View>
  );
};

export const SectionHeader = ({ title, action, onAction }) => (
  <View style={styles.sectionHeader}>
    <Text style={type.heading}>{title}</Text>

    {action ? (
      <Pressable onPress={onAction} hitSlop={8}>
        <Text style={styles.sectionAction}>{action}</Text>
      </Pressable>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  emptySubtitle: {
    marginTop: spacing.sm,
    textAlign: "center",
  },
  button: {
    height: 50,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  buttonPrimary: {
    backgroundColor: colors.accent,
  },
  buttonSecondary: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
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
  playButton: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  playButtonActive: {
    backgroundColor: "#e9175c",
    borderColor: "#e9175c",
  },
  artwork: {
    backgroundColor: colors.surfaceRaised,
  },
  artworkFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  sectionAction: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "600",
  },
  toast: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    // Sits above the panels and the mini player.
    zIndex: 100,
    elevation: 12,
  },
  toastText: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
  },
});
