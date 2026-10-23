import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import type { ComponentProps, JSX } from "react";
import type { ColorValue } from "react-native";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

function TabIcon({ name, color }: { name: IoniconName; color: ColorValue }): JSX.Element {
  // RN 0.88's `ColorValue` also admits `null` and processed numbers, which Ionicons rejects.
  const iconColor = color === null || typeof color === "number" ? undefined : color;
  return <Ionicons name={name} size={24} color={iconColor} />;
}

export default function TabsLayout(): JSX.Element {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <TabIcon name="home-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: "Explore",
          tabBarIcon: ({ color }) => <TabIcon name="compass-outline" color={color} />,
        }}
      />
    </Tabs>
  );
}
