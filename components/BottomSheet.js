import { Modal, Pressable, StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "../lib/theme";

/**
 * The panel that slides up from the bottom edge, dimming whatever is behind.
 *
 * Shared rather than rebuilt per screen because the layout has one trap in
 * it: the scrim has to be a flex sibling that claims the space the sheet
 * leaves. Positioned absolutely instead it collapses to nothing — it paints
 * no dimming and catches no taps, so the sheet appears to float over a live
 * page that still responds to touches. That looked fine and was wrong, and
 * is not a mistake worth making twice.
 *
 * A Modal rather than an in-page overlay so it covers tab bars and the mini
 * player, and so Android's back gesture closes it.
 */
const BottomSheet = ({ visible, onClose, children }) => (
  <Modal
    visible={visible}
    transparent
    animationType="fade"
    onRequestClose={onClose}
    statusBarTranslucent
  >
    <View style={styles.root}>
      {/* Tapping away closes it — expected of a sheet, and on Android the
          only way out other than the back gesture. */}
      <Pressable style={styles.scrim} onPress={onClose} />

      <View style={styles.sheet}>
        <View style={styles.grabber} />
        {children}
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrim: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  sheet: {
    maxHeight: "72%",
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingBottom: spacing.xl,
  },
  grabber: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textFaint,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
});

export default BottomSheet;
