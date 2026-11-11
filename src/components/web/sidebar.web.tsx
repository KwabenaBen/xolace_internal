import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import { usePathname, useRouter, type Href } from "expo-router";
import { gsap } from "gsap";
import {
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type ComponentRef,
  type JSX,
  type ReactNode,
  type RefObject,
} from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";

import { Avatar, pastelFor } from "@/components/people/avatar";
import { FEATURE_COLORS } from "@/components/ui/task-row";
import { fonts, usePageColors } from "@/components/ui/theme";
import { ROLE_LABELS } from "@/constants/labels";
import { useSignedInUser, type CurrentUser } from "@/lib/use-current-user";

import { useWebReducedMotion } from "./motion";
import { SIDEBAR_COLLAPSED_WIDTH, SIDEBAR_WIDTH, webType } from "./web-theme";

type IconName = ComponentProps<typeof Ionicons>["name"];

/**
 * The slide, after the "hoverable sidebar" reference the team picked, choreographed with GSAP:
 *
 * - Opening: the width eases out (the page beside it stretching along), the chevron turns, then
 *   the words slide in from the left one after another and the features rise in.
 * - Closing: the words slip out first (last one first), then the width eases in.
 * - Collapsed: hovering (or tabbing to) an icon slides its name out beside it in a small tooltip.
 *
 * It starts on the click itself (GSAP first, React's re-render after), and the width moves at
 * once and settles softly (an ease-out: an ease-in-out's slow start reads as lag).
 *
 * GSAP owns these styles once the sidebar is on screen (width, the words' opacity and offset, the
 * chevron's turn, the tooltip), so React only gives their starting values and never re-sets them.
 * Reduce Motion: every change is instant, no slides.
 */
const SLIDE: gsap.TweenVars = { duration: 0.45, ease: "power3.out" };
const WORDS_IN: gsap.TweenVars = { duration: 0.3, ease: "power2.out", stagger: 0.025 };
const WORDS_OUT_DURATION = 0.14;
const WORDS_OUT: gsap.TweenVars = {
  duration: WORDS_OUT_DURATION,
  ease: "power1.in",
  stagger: { each: 0.01, from: "end" },
};
/** Words wait for the width to make room before sliding in; the width barely waits for them. */
const WORDS_IN_AT = 0.12;
const SLIDE_OUT_AT = 0.04;
/** The words' resting offset while hidden (they slide in from here). */
const WORD_SHIFT = -10;

/** Every row's icon (or dot, or avatar) sits in a slot this wide... */
const SLOT = 22;
/** ...padded so the slot stays centred in the collapsed sidebar: the icons never move. */
const ROW_PAD = (SIDEBAR_COLLAPSED_WIDTH - 2 * 8 - SLOT) / 2;

/** The words that slide in and out (the rows' labels and the wordmark), found by this tag. */
const WORD = "sidebar-word";

const STORAGE_KEY = "cadence.sidebar.collapsed";

/** Read at once (not after a render), so the remembered state is there on the first frame. */
function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function saveCollapsed(collapsed: boolean): void {
  try {
    if (collapsed) window.localStorage.setItem(STORAGE_KEY, "1");
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable (e.g. private browsing): the choice just won't stick.
  }
}

/** On the web a React Native view's ref is its DOM element, which GSAP animates. */
function dom(ref: RefObject<unknown>): HTMLElement | null {
  return (ref.current as HTMLElement | null) ?? null;
}

type RowHandlers = {
  /** Show this row's name beside it (only does anything while collapsed). */
  onPoint: (label: string, row: HTMLElement | null) => void;
  onLeave: () => void;
};

/** One sidebar row: a hover wash that fades in and out, and the page you're on highlighted. */
function Row({
  icon,
  label,
  active,
  initiallyCollapsed,
  word = true,
  onPress,
  leading,
  muted = false,
  focusable = true,
  tips,
}: {
  icon?: IconName;
  label: string;
  active: boolean;
  /** The words' starting look (GSAP takes over from there). */
  initiallyCollapsed: boolean;
  /** Whether its label slides with the sidebar (the features' rows fade as a block instead). */
  word?: boolean;
  onPress: () => void;
  /** Instead of an icon (e.g. a feature's status dot, a person's avatar). */
  leading?: ReactNode;
  muted?: boolean;
  /** False while hidden (the collapsed sidebar's features), so Tab skips it. */
  focusable?: boolean;
  tips?: RowHandlers;
}): JSX.Element {
  const c = usePageColors();
  const rowRef = useRef<ComponentRef<typeof View>>(null);
  const washRef = useRef<ComponentRef<typeof View>>(null);
  const hidden = word && initiallyCollapsed;

  const wash = (on: boolean) => {
    const el = dom(washRef);
    if (el === null || active) return;
    gsap.to(el, { opacity: on ? 1 : 0, duration: on ? 0.18 : 0.28, ease: "power2.out" });
  };
  const point = () => {
    wash(true);
    tips?.onPoint(label, dom(rowRef));
  };
  const leave = () => {
    wash(false);
    tips?.onLeave();
  };

  return (
    <Pressable
      ref={rowRef}
      accessibilityRole="link"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      aria-current={active ? "page" : undefined}
      onPress={onPress}
      // React Native Web's Pressable sets its own tabIndex (ignoring `focusable`), so pass it.
      tabIndex={focusable ? 0 : -1}
      onHoverIn={point}
      onHoverOut={leave}
      onFocus={point}
      onBlur={leave}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        height: 34,
        paddingHorizontal: ROW_PAD,
        borderRadius: 9,
        overflow: "hidden",
        backgroundColor: active ? c.panelHigh : "transparent",
      }}
    >
      <View
        ref={washRef}
        style={[StyleSheet.absoluteFill, { backgroundColor: c.panelRaised, opacity: 0 }]}
      />
      <View style={{ width: SLOT, alignItems: "center", justifyContent: "center" }}>
        {leading ??
          (icon !== undefined ? (
            <Ionicons name={icon} size={17} color={active ? c.text : c.muted} />
          ) : null)}
      </View>
      <Text
        testID={word ? WORD : undefined}
        numberOfLines={1}
        ellipsizeMode="clip"
        importantForAccessibility="no"
        style={{
          ...webType.body,
          flex: 1,
          color: active || !muted ? c.text : c.muted,
          fontWeight: active ? "600" : "400",
          opacity: hidden ? 0 : 1,
          transform: [{ translateX: hidden ? WORD_SHIFT : 0 }],
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * The website layout's left sidebar, after Notion: Cadence, the main pages (Board, My Tasks, Logs,
 * Activity, Admin for admins), the features (each opens its page; admins can start a new one),
 * then Settings and who's signed in. It collapses to icons and back with the slide above,
 * remembered on this browser.
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
  const reduceMotion = useWebReducedMotion();
  // `initial` never changes: it's only the starting look, before GSAP owns the styles.
  const [initial] = useState(readCollapsed);
  const [collapsed, setCollapsed] = useState(initial);
  const [tip, setTip] = useState("");

  const sideRef = useRef<ComponentRef<typeof View>>(null);
  const chevronRef = useRef<ComponentRef<typeof View>>(null);
  const featuresRef = useRef<ComponentRef<typeof View>>(null);
  const tipRef = useRef<ComponentRef<typeof View>>(null);
  const ctx = useRef<gsap.Context | null>(null);
  const slide = useRef<gsap.core.Timeline | null>(null);
  // The state last put on screen; null until the sidebar is set up (so that first one is instant).
  const applied = useRef<boolean | null>(null);

  // One GSAP context for everything this sidebar animates, reverted when it goes away.
  useLayoutEffect(() => {
    const side = dom(sideRef);
    if (side === null) return;
    ctx.current = gsap.context(() => {
      // The tooltip is centred on the row it points at.
      const tooltip = dom(tipRef);
      if (tooltip !== null) gsap.set(tooltip, { yPercent: -50, opacity: 0 });
    }, side);
    return () => {
      ctx.current?.revert();
      ctx.current = null;
      applied.current = null;
    };
  }, []);

  // Put a state on screen: instantly (the first time, and with Reduce Motion), or by playing the
  // slide from wherever things are (a click mid-slide turns it around smoothly).
  const show = (next: boolean, instant: boolean) => {
    const side = dom(sideRef);
    const chevron = dom(chevronRef);
    const list = dom(featuresRef);
    const tooltip = dom(tipRef);
    const context = ctx.current;
    if (side === null || chevron === null || list === null || context === null) return;
    applied.current = next;

    context.add(() => {
      const words = side.querySelectorAll(`[data-testid="${WORD}"]`);
      slide.current?.kill();
      if (tooltip !== null) gsap.set(tooltip, { opacity: 0 });
      const end = next
        ? {
            width: SIDEBAR_COLLAPSED_WIDTH,
            words: { opacity: 0, x: WORD_SHIFT },
            list: 0,
            turn: 180,
          }
        : { width: SIDEBAR_WIDTH, words: { opacity: 1, x: 0 }, list: 1, turn: 0 };

      if (instant) {
        gsap.set(side, { width: end.width, overflow: next ? "visible" : "hidden" });
        gsap.set(words, end.words);
        gsap.set(list, { opacity: end.list, y: 0 });
        gsap.set(chevron, { rotation: end.turn });
        return;
      }

      const tl = gsap.timeline({ defaults: { overwrite: "auto" } });
      // Clip the words while the width moves; the tooltips need to spill out once it's closed.
      tl.set(side, { overflow: "hidden" });
      if (next) {
        tl.to(words, { ...end.words, ...WORDS_OUT }, 0)
          .to(list, { opacity: 0, y: 4, duration: WORDS_OUT_DURATION, ease: "power1.in" }, 0)
          .to(side, { width: end.width, ...SLIDE }, SLIDE_OUT_AT)
          .to(chevron, { rotation: end.turn, ...SLIDE }, SLIDE_OUT_AT)
          .set(side, { overflow: "visible" });
      } else {
        tl.to(side, { width: end.width, ...SLIDE }, 0)
          .to(chevron, { rotation: end.turn, ...SLIDE }, 0)
          .to(words, { ...end.words, ...WORDS_IN }, WORDS_IN_AT)
          .fromTo(
            list,
            { opacity: 0, y: 8 },
            { opacity: 1, y: 0, duration: 0.35, ease: "power2.out" },
            WORDS_IN_AT + 0.06
          );
      }
      slide.current = tl;
    });
  };

  // The first state (instant), and any state the click didn't already put on screen.
  useLayoutEffect(() => {
    if (applied.current === collapsed) return;
    show(collapsed, applied.current === null || reduceMotion);
  });

  const toggle = () => {
    const next = !collapsed;
    saveCollapsed(next);
    show(next, reduceMotion); // the slide starts now, on the click...
    setCollapsed(next); // ...and React re-renders the rest (labels, Tab stops) behind it
  };

  // The collapsed sidebar's tooltip: slides out beside the row you point at, glides between rows.
  const tips: RowHandlers = {
    onPoint: (label, row) => {
      const side = dom(sideRef);
      const tooltip = dom(tipRef);
      if (!collapsed || row === null || side === null || tooltip === null) return;
      if (slide.current?.isActive()) return;
      setTip(label);
      // The row's middle, measured on screen (React Native Web's views are each positioned, so
      // offsetTop would only be relative to the row's own group).
      const rowBox = row.getBoundingClientRect();
      const top = rowBox.top - side.getBoundingClientRect().top + rowBox.height / 2;
      ctx.current?.add(() => {
        const showing = Number(gsap.getProperty(tooltip, "opacity")) > 0.05;
        if (!showing || reduceMotion) gsap.set(tooltip, { top, x: reduceMotion ? 0 : -6 });
        gsap.to(tooltip, {
          top,
          opacity: 1,
          x: 0,
          duration: reduceMotion ? 0 : 0.22,
          ease: "power2.out",
          overwrite: true,
        });
      });
    },
    onLeave: () => {
      const tooltip = dom(tipRef);
      if (tooltip === null) return;
      ctx.current?.add(() => {
        gsap.to(tooltip, {
          opacity: 0,
          x: reduceMotion ? 0 : -4,
          duration: reduceMotion ? 0 : 0.16,
          ease: "power1.in",
          overwrite: true,
        });
      });
    },
  };

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

  return (
    <View
      ref={sideRef}
      accessibilityRole="navigation"
      style={{
        // Starting values only (see the note at the top): GSAP animates them from here.
        width: initial ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH,
        overflow: initial ? "visible" : "hidden",
        // Above the page, so the collapsed sidebar's tooltips sit over it.
        zIndex: 10,
        borderRightWidth: 1,
        borderRightColor: c.hairline,
        backgroundColor: c.panel,
        paddingVertical: 14,
        paddingHorizontal: 8,
        gap: 6,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", height: 36, marginBottom: 6 }}>
        <Text
          testID={WORD}
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
            opacity: initial ? 0 : 1,
            transform: [{ translateX: initial ? WORD_SHIFT : 0 }],
          }}
        >
          cadence
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={collapsed ? "Open the sidebar" : "Collapse the sidebar"}
          accessibilityState={{ expanded: !collapsed }}
          onPress={toggle}
          hitSlop={8}
          style={{
            width: SIDEBAR_COLLAPSED_WIDTH - 16,
            height: 32,
            alignItems: "center",
            justifyContent: "center",
          }}
          className="active:opacity-60"
        >
          <View ref={chevronRef} style={{ transform: [{ rotate: initial ? "180deg" : "0deg" }] }}>
            <Ionicons name="chevron-back" size={16} color={c.muted} />
          </View>
        </Pressable>
      </View>

      {pages.map((p) => (
        <Row
          key={p.label}
          icon={p.icon}
          label={p.label}
          active={p.active}
          initiallyCollapsed={initial}
          tips={tips}
          onPress={() => go(p.href)}
        />
      ))}

      {/* The features fade away when collapsed (no clicks, no Tab stops, hidden from screen
          readers), keeping their space. */}
      <View
        ref={featuresRef}
        style={{
          flex: 1,
          marginTop: 14,
          opacity: initial ? 0 : 1,
          pointerEvents: collapsed ? "none" : "auto",
        }}
        aria-hidden={collapsed}
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
                initiallyCollapsed={initial}
                word={false}
                focusable={!collapsed}
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
              initiallyCollapsed={initial}
              word={false}
              focusable={!collapsed}
              onPress={() => router.push("/features/new")}
            />
          ) : null}
        </ScrollView>
      </View>

      <View style={{ gap: 2, borderTopWidth: 1, borderTopColor: c.hairline, paddingTop: 8 }}>
        <Row
          icon="settings-outline"
          label="Settings"
          active={at("/settings") && !at("/settings/account")}
          initiallyCollapsed={initial}
          tips={tips}
          onPress={() => go("/settings")}
        />
        <Row
          label={`${user.name} · ${ROLE_LABELS[user.role]}`}
          active={at("/settings/account")}
          initiallyCollapsed={initial}
          tips={tips}
          leading={<Avatar size={SLOT} fill={pastelFor(user._id)} name={user.name} />}
          onPress={() => go("/settings/account")}
        />
      </View>

      {/* The collapsed sidebar's tooltip (decorative: each row already has its name). */}
      <View
        ref={tipRef}
        aria-hidden
        style={{
          position: "absolute",
          left: SIDEBAR_COLLAPSED_WIDTH + 6,
          top: 0,
          opacity: 0,
          pointerEvents: "none",
          borderRadius: 8,
          paddingHorizontal: 10,
          paddingVertical: 6,
          backgroundColor: c.accent,
          boxShadow: "0 6px 18px rgba(0,0,0,0.22)",
        }}
      >
        <Text
          numberOfLines={1}
          style={{ ...webType.small, fontWeight: "600", color: c.accentText }}
        >
          {tip}
        </Text>
      </View>
    </View>
  );
}
