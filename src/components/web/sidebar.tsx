import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import { usePathname, useRouter, type Href } from "expo-router";
import { useState, type ComponentProps, type JSX, type ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Animated, { cubicBezier, useReducedMotion } from "react-native-reanimated";

import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";

import { Avatar, pastelFor } from "@/components/people/avatar";
import { FEATURE_COLORS } from "@/components/ui/task-row";
import { fonts, usePageColors } from "@/components/ui/theme";
import { ROLE_LABELS } from "@/constants/labels";
import { useSignedInUser, type CurrentUser } from "@/lib/use-current-user";
import { useDeviceFlag } from "@/lib/use-device-flag";

import { useHover } from "./use-hover";
import { SIDEBAR_COLLAPSED_WIDTH, SIDEBAR_WIDTH, webType } from "./web-theme";

type IconName = ComponentProps<typeof Ionicons>["name"];

/**
 * The collapse and open motion: the width glides (a CSS transition, so the browser runs it
 * without re-rendering React each frame) and the words fade, quicker than the width so they're
 * gone before they'd be clipped. Reduce Motion: instant.
 */
const SLIDE_MS = 280;
const FADE_MS = 140;
const EASE = cubicBezier(0.2, 0, 0, 1);

/** Every row's icon (or dot, or avatar) sits in a slot this wide... */
const SLOT = 22;
/** ...padded so the slot stays centred in the collapsed sidebar: the icons never move. */
const ROW_PAD = (SIDEBAR_COLLAPSED_WIDTH - 2 * 8 - SLOT) / 2;

/** One sidebar row: highlights on hover, and when it's the page you're on. */
function Row({
  icon,
  label,
  active,
  collapsed,
  fade,
  fadeDelay = 0,
  onPress,
  leading,
  muted = false,
  focusable = true,
}: {
  icon?: IconName;
  label: string;
  active: boolean;
  collapsed: boolean;
  /** The label's fade (none until the first toggle, so a remembered state doesn't animate). */
  fade: number;
  fadeDelay?: number;
  onPress: () => void;
  /** Instead of an icon (e.g. a feature's status dot, a person's avatar). */
  leading?: ReactNode;
  muted?: boolean;
  /** False while hidden (the collapsed sidebar's features), so Tab skips it. */
  focusable?: boolean;
}): JSX.Element {
  const c = usePageColors();
  const [hovered, hover] = useHover();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      aria-current={active ? "page" : undefined}
      onPress={onPress}
      focusable={focusable}
      {...hover}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        height: 32,
        paddingHorizontal: ROW_PAD,
        borderRadius: 8,
        overflow: "hidden",
        backgroundColor: active ? c.panelHigh : hovered ? c.panelRaised : "transparent",
      }}
    >
      <View style={{ width: SLOT, alignItems: "center", justifyContent: "center" }}>
        {leading ??
          (icon !== undefined ? (
            <Ionicons name={icon} size={17} color={active ? c.text : c.muted} />
          ) : null)}
      </View>
      <Animated.Text
        numberOfLines={1}
        ellipsizeMode="clip"
        importantForAccessibility="no"
        style={{
          ...webType.body,
          flex: 1,
          color: active || !muted ? c.text : c.muted,
          fontWeight: active ? "600" : "400",
          opacity: collapsed ? 0 : 1,
          transitionProperty: "opacity",
          transitionDuration: fade,
          transitionDelay: fadeDelay,
          transitionTimingFunction: EASE,
        }}
      >
        {label}
      </Animated.Text>
    </Pressable>
  );
}

/**
 * The website layout's left sidebar, after Notion: Cadence, the main pages (Board, My Tasks, Logs,
 * Activity, Admin for admins), the features (each opens its page; admins can start a new one),
 * then Settings and who's signed in. It collapses to icons (gliding, the icons staying where they
 * are), remembered on this browser.
 */
export function Sidebar(): JSX.Element {
  const user = useSignedInUser();
  const features = useQuery(api.features.list);
  return <SidebarView user={user} features={features} />;
}

/** The sidebar from its data (`features` is `undefined` while loading). */
export function SidebarView({
  user,
  features,
}: {
  user: CurrentUser;
  features: Doc<"features">[] | undefined;
}): JSX.Element {
  const c = usePageColors();
  const router = useRouter();
  const pathname = usePathname();
  const isAdmin = user.role === "admin";
  const reduceMotion = useReducedMotion();
  const [collapsedFlag, setCollapsed] = useDeviceFlag("cadence.sidebar.collapsed");
  const collapsed = collapsedFlag === true;
  // Animate only once someone toggles it: the remembered state on loading appears as it is.
  const [toggled, setToggled] = useState(false);
  const animate = toggled && !reduceMotion;
  const slide = animate ? SLIDE_MS : 0;
  // Words fade out fast when collapsing, and back in once there's room when opening.
  const fade = animate ? FADE_MS : 0;
  const fadeDelay = animate && !collapsed ? SLIDE_MS - FADE_MS : 0;

  const go = (href: Href) => router.navigate(href);
  const at = (path: string) => pathname === path || pathname.startsWith(`${path}/`);
  const open = (features ?? [])
    .filter((f) => f.status !== "shipped")
    .sort((a, b) => a.deadline - b.deadline);

  const pages: { icon: IconName; label: string; href: Href; active: boolean }[] = [
    { icon: "albums-outline", label: "Board", href: "/", active: pathname === "/" || at("/board") },
    { icon: "checkbox-outline", label: "My Tasks", href: "/my-tasks", active: at("/my-tasks") },
    { icon: "book-outline", label: "Logs", href: "/logs", active: at("/logs") },
    { icon: "pulse-outline", label: "Activity", href: "/activity", active: at("/activity") },
  ];
  if (isAdmin) {
    pages.push({
      icon: "shield-checkmark-outline",
      label: "Admin",
      href: "/admin",
      active: at("/admin"),
    });
  }

  const fadeStyle = {
    opacity: collapsed ? 0 : 1,
    transitionProperty: "opacity" as const,
    transitionDuration: fade,
    transitionDelay: fadeDelay,
    transitionTimingFunction: EASE,
  };

  return (
    <Animated.View
      accessibilityRole="navigation"
      style={{
        width: collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH,
        transitionProperty: "width",
        transitionDuration: slide,
        transitionTimingFunction: EASE,
        overflow: "hidden",
        borderRightWidth: 1,
        borderRightColor: c.hairline,
        backgroundColor: c.panel,
        paddingVertical: 14,
        paddingHorizontal: 8,
        gap: 6,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", height: 36, marginBottom: 6 }}>
        <Animated.Text
          numberOfLines={1}
          ellipsizeMode="clip"
          style={{
            flex: 1,
            minWidth: 0,
            paddingLeft: ROW_PAD,
            fontFamily: fonts.black,
            fontSize: 18,
            letterSpacing: -0.4,
            color: c.text,
            ...fadeStyle,
          }}
        >
          cadence
        </Animated.Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={collapsed ? "Open the sidebar" : "Collapse the sidebar"}
          accessibilityState={{ expanded: !collapsed }}
          onPress={() => {
            setToggled(true);
            setCollapsed(!collapsed);
          }}
          hitSlop={8}
          style={{
            width: SIDEBAR_COLLAPSED_WIDTH - 16,
            height: 32,
            alignItems: "center",
            justifyContent: "center",
          }}
          className="active:opacity-60"
        >
          <Animated.View
            style={{
              transform: [{ rotate: collapsed ? "180deg" : "0deg" }],
              transitionProperty: "transform",
              transitionDuration: slide,
              transitionTimingFunction: EASE,
            }}
          >
            <Ionicons name="chevron-back" size={16} color={c.muted} />
          </Animated.View>
        </Pressable>
      </View>

      {pages.map((p) => (
        <Row
          key={p.label}
          icon={p.icon}
          label={p.label}
          active={p.active}
          collapsed={collapsed}
          fade={fade}
          fadeDelay={fadeDelay}
          onPress={() => go(p.href)}
        />
      ))}

      {/* The features fade away when collapsed (no clicks, no Tab stops, hidden from screen
          readers), keeping their space. */}
      <Animated.View
        style={{ flex: 1, marginTop: 14, pointerEvents: collapsed ? "none" : "auto", ...fadeStyle }}
        importantForAccessibility={collapsed ? "no-hide-descendants" : "auto"}
        accessibilityElementsHidden={collapsed}
      >
        <ScrollView
          style={{ flex: 1, width: SIDEBAR_WIDTH - 16 }}
          contentContainerStyle={{ gap: 2 }}
        >
          <Text
            style={{
              ...webType.tiny,
              color: c.muted,
              fontWeight: "600",
              paddingHorizontal: ROW_PAD,
              marginBottom: 4,
            }}
          >
            Features
          </Text>
          {features === undefined ? null : open.length === 0 ? (
            <Text style={{ ...webType.small, color: c.muted, paddingHorizontal: ROW_PAD }}>
              None in progress.
            </Text>
          ) : (
            open.map((f) => (
              <Row
                key={f._id}
                label={f.title}
                active={at(`/features/${f._id}`)}
                collapsed={false}
                focusable={!collapsed}
                fade={0}
                leading={
                  <View
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: 999,
                      backgroundColor: FEATURE_COLORS[f.status].fill,
                      // The outline keeps the pale "Planned" cream visible on the light sidebar.
                      borderWidth: 1,
                      borderColor: c.muted,
                    }}
                  />
                }
                onPress={() =>
                  go({ pathname: "/features/[featureId]", params: { featureId: f._id } })
                }
              />
            ))
          )}
          {isAdmin ? (
            <Row
              icon="add"
              label="New feature"
              muted
              active={false}
              collapsed={false}
              focusable={!collapsed}
              fade={0}
              onPress={() => router.push("/features/new")}
            />
          ) : null}
        </ScrollView>
      </Animated.View>

      <View style={{ gap: 2, borderTopWidth: 1, borderTopColor: c.hairline, paddingTop: 8 }}>
        <Row
          icon="settings-outline"
          label="Settings"
          active={at("/settings") && !at("/settings/account")}
          collapsed={collapsed}
          fade={fade}
          fadeDelay={fadeDelay}
          onPress={() => go("/settings")}
        />
        <Row
          label={`${user.name} · ${ROLE_LABELS[user.role]}`}
          active={at("/settings/account")}
          collapsed={collapsed}
          fade={fade}
          fadeDelay={fadeDelay}
          leading={<Avatar size={SLOT} fill={pastelFor(user._id)} name={user.name} />}
          onPress={() => go("/settings/account")}
        />
      </View>
    </Animated.View>
  );
}
