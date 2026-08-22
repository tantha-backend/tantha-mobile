import { Tabs } from "expo-router";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import MiniPlayer from "../../components/MiniPlayer";
import { colors, spacing } from "../../lib/theme";

const TAB_BAR_HEIGHT = 62;

const TabIcon = ({ name, color }) => (
  <Ionicons name={name} size={22} color={color} />
);

const TabsLayout = () => {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <Tabs
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: colors.bg },
          tabBarStyle: [
            styles.tabBar,
            { height: TAB_BAR_HEIGHT + insets.bottom, paddingBottom: insets.bottom + spacing.sm },
          ],
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textFaint,
          tabBarLabelStyle: styles.tabLabel,
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            title: "Home",
            tabBarIcon: ({ color, focused }) => (
              <TabIcon name={focused ? "home" : "home-outline"} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="search"
          options={{
            title: "Search",
            tabBarIcon: ({ color, focused }) => (
              <TabIcon name={focused ? "search" : "search-outline"} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="library"
          options={{
            title: "Library",
            tabBarIcon: ({ color, focused }) => (
              <TabIcon name={focused ? "albums" : "albums-outline"} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarIcon: ({ color, focused }) => (
              <TabIcon name={focused ? "person" : "person-outline"} color={color} />
            ),
          }}
        />
      </Tabs>

      {/*
        Floated just above the tab bar rather than rendered inside it, so it
        survives tab switches and never scrolls away with a screen.
      */}
      <View
        style={[styles.miniPlayerSlot, { bottom: TAB_BAR_HEIGHT + insets.bottom }]}
        pointerEvents="box-none"
      >
        <MiniPlayer />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  tabBar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingTop: spacing.sm,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
  miniPlayerSlot: {
    position: "absolute",
    left: 0,
    right: 0,
  },
});

export default TabsLayout;
