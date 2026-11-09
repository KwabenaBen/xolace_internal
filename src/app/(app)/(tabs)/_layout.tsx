import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router/js-tabs";
import { useThemeColor } from "heroui-native";
import type { ComponentProps, JSX } from "react";
import type { ColorValue } from "react-native";
import { useReducedMotion } from "react-native-reanimated";

import { layout } from "@/constants/theme";
import { useSignedInUser } from "@/lib/use-current-user";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

function TabIcon({ name, color }: { name: IoniconName; color: ColorValue }): JSX.Element {
  // RN 0.88's `ColorValue` also admits `null` and processed numbers, which Ionicons rejects.
  const iconColor = color === null || typeof color === "number" ? undefined : color;
  return <Ionicons name={name} size={layout.tabIconSize} color={iconColor} />;
}

/** The tab bar. The parent (app) layout has already loaded the signed-in user. */
export default function TabsLayout(): JSX.Element {
  const user = useSignedInUser();
  const reduceMotion = useReducedMotion();
  const [foreground, muted, border, background] = useThemeColor([
    "foreground",
    "muted",
    "border",
    "background",
  ]);

  return (
    <Tabs
      screenOptions={{
        // Switching tabs: the new one slides in a little and fades up (none with Reduce Motion).
        animation: reduceMotion ? "none" : "shift",
        headerShown: false,
        tabBarActiveTintColor: foreground,
        tabBarInactiveTintColor: muted,
        // The bar is the page's colour (black or off-white) on every tab, with a hairline above.
        tabBarStyle: { backgroundColor: background, borderTopColor: border },
        sceneStyle: { backgroundColor: background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Board",
          tabBarIcon: ({ color }) => <TabIcon name="albums-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="my-tasks"
        options={{
          title: "My Tasks",
          tabBarIcon: ({ color }) => <TabIcon name="checkbox-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="logs"
        options={{
          title: "Logs",
          tabBarIcon: ({ color }) => <TabIcon name="journal-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => <TabIcon name="settings-outline" color={color} />,
        }}
      />
      {/* UI-only: the admin tab is hidden from members, but every admin function also checks on the server. */}
      <Tabs.Protected guard={user.role === "admin"}>
        <Tabs.Screen
          name="admin"
          options={{
            title: "Admin",
            tabBarIcon: ({ color }) => <TabIcon name="shield-checkmark-outline" color={color} />,
          }}
        />
      </Tabs.Protected>
    </Tabs>
  );
}
