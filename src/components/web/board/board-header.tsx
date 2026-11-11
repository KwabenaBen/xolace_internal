import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "expo-router";
import { useEffect, useRef, useState, type ComponentRef, type JSX } from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Avatar, pastelFor } from "@/components/people/avatar";
import { colors, fonts, usePageColors } from "@/components/ui/theme";
import type { CurrentUser } from "@/lib/use-current-user";

import { useHover } from "../use-hover";
import { webFont, webType } from "../web-theme";

/** The search box: rounded, with the reference's orange button at its end. "/" jumps to it. */
function SearchBox({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}): JSX.Element {
  const c = usePageColors();
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const [focused, setFocused] = useState(false);
  // Only while the Board is the page in front (not under a form dialog or another page).
  const isFocused = useIsFocused();

  useEffect(() => {
    if (Platform.OS !== "web" || !isFocused) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target !== null &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isFocused]);

  const hasText = value !== "";
  return (
    <View
      style={{
        flex: 1,
        maxWidth: 460,
        minWidth: 220,
        height: 48,
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 999,
        borderWidth: 1,
        borderColor: focused ? c.text : c.hairline,
        backgroundColor: c.panel,
        paddingLeft: 18,
        paddingRight: 5,
        gap: 8,
      }}
    >
      <TextInput
        ref={input}
        value={value}
        onChangeText={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyPress={(e) => {
          if (e.nativeEvent.key === "Escape") onChange("");
        }}
        placeholder="Search tasks, features, people"
        placeholderTextColor={c.placeholder}
        accessibilityLabel="Search the Board"
        style={[styles.input, { color: c.text }]}
      />
      {focused || hasText ? null : (
        <Text style={{ ...webType.tiny, color: c.muted, marginRight: 4 }}>Press /</Text>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={hasText ? "Clear the search" : "Search"}
        onPress={() => (hasText ? onChange("") : input.current?.focus())}
        style={{
          width: 38,
          height: 38,
          borderRadius: 999,
          backgroundColor: colors.orange,
          alignItems: "center",
          justifyContent: "center",
        }}
        className="active:opacity-70"
      >
        <Ionicons name={hasText ? "close" : "search"} size={18} color={colors.black} />
      </Pressable>
    </View>
  );
}

function RoundIconButton({
  icon,
  label,
  onPress,
}: {
  icon: "notifications-outline";
  label: string;
  onPress: () => void;
}): JSX.Element {
  const c = usePageColors();
  const [hovered, hover] = useHover();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={onPress}
      {...hover}
      style={{
        width: 48,
        height: 48,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: c.hairline,
        backgroundColor: hovered ? c.panelRaised : c.panel,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons name={icon} size={20} color={c.text} />
    </Pressable>
  );
}

/**
 * The top of the web Board, after the reference: the date and a welcome, the search box, the
 * bell (the team's activity), and who's signed in (their account page).
 */
export function BoardHeader({
  user,
  now,
  query,
  onQueryChange,
  onOpenActivity,
  onOpenAccount,
}: {
  user: CurrentUser;
  now: number;
  query: string;
  onQueryChange: (value: string) => void;
  onOpenActivity: () => void;
  onOpenAccount: () => void;
}): JSX.Element {
  const c = usePageColors();
  const [accountHovered, accountHover] = useHover();
  const firstName = user.name.trim().split(/\s+/)[0] ?? user.name;

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 20 }}>
      <View style={{ flexShrink: 0, gap: 2, minWidth: 180 }}>
        <Text style={{ ...webType.small, color: c.muted }}>
          {new Date(now).toLocaleDateString(undefined, {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </Text>
        <Text
          numberOfLines={1}
          style={{ fontFamily: fonts.extraBold, fontSize: 20, letterSpacing: -0.4, color: c.text }}
        >
          Welcome back, {firstName}
        </Text>
      </View>

      <View style={{ flex: 1, alignItems: "center" }}>
        <SearchBox value={query} onChange={onQueryChange} />
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <RoundIconButton icon="notifications-outline" label="Activity" onPress={onOpenActivity} />
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`Your account: ${user.name}`}
          onPress={onOpenAccount}
          {...accountHover}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            paddingLeft: 4,
            paddingRight: 14,
            paddingVertical: 4,
            borderRadius: 999,
            backgroundColor: accountHovered ? c.panelRaised : "transparent",
          }}
        >
          <Avatar size={40} fill={pastelFor(user._id)} name={user.name} />
          <View style={{ maxWidth: 160 }}>
            <Text numberOfLines={1} style={{ ...webType.small, fontWeight: "600", color: c.text }}>
              {user.name}
            </Text>
            <Text numberOfLines={1} style={{ ...webType.tiny, color: c.muted }}>
              {user.title}
            </Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    flex: 1,
    height: 46,
    fontFamily: webFont,
    fontSize: 14,
    // The box draws the focus ring (its border), so the browser's own outline is off.
    outlineWidth: 0,
  },
});
