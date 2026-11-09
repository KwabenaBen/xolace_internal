import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router/js-tabs";
import { useThemeColor } from "heroui-native";
import type { ComponentProps, JSX } from "react";
import type { ColorValue } from "react-native";

import { colors as boardColors } from "@/components/board/board-theme";
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
  const [accent, muted, surface, border, background] = useThemeColor([
    "accent",
    "muted",
    "surface",
    "border",
    "background",
  ]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: accent,
        tabBarInactiveTintColor: muted,
        tabBarStyle: { backgroundColor: surface, borderTopColor: border },
        sceneStyle: { backgroundColor: background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Board",
          tabBarIcon: ({ color }) => <TabIcon name="albums-outline" color={color} />,
          // The Board is always black, so the bar goes dark while it's showing.
          tabBarActiveTintColor: boardColors.white,
          tabBarInactiveTintColor: boardColors.secondary,
          tabBarStyle: { backgroundColor: boardColors.black, borderTopColor: boardColors.hairline },
          sceneStyle: { backgroundColor: boardColors.background },
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
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => <TabIcon name="person-circle-outline" color={color} />,
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
