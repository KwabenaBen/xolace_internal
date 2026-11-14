import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import { usePathname, useRouter, type Href } from "expo-router";
import { gsap } from "gsap";
import {
  useEffect,
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
 * The sidebar rests as a strip of icons and slides open while the cursor is over it (the user's
 * choice, 14 Nov, after the "hoverable sidebar" reference), choreographed with GSAP:
 *
 * - Opening (the cursor comes in, or Tab reaches a row): the panel's width eases out over the
 *   page with a shadow, then the words slide in from the left one after another and the features
 *   rise in.
 * - Closing (the cursor leaves, or focus moves out): the words slip out first (last one first),
 *   then the width eases back in and the shadow fades.
 * - It opens over the page rather than beside it: the strip keeps its place in the layout, so the
 *   page never reflows. A short wait before opening keeps a cursor just passing by from opening it,
 *   and one before closing keeps a brief slip off the edge from shutting it. On a touch screen
 *   (no hover), tapping the Cadence mark opens and closes it.
 *
 * GSAP owns these styles once the sidebar is on screen (the width, the shadow, the words' opacity
 * and offset), so React only gives their starting values and never re-sets them. Reduce Motion:
 * every change is instant, no slides.
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
/** The open panel's shadow over the page, and the closed one's (the same shape, so it blends). */
const SHADOW_OPEN = "0 18px 48px rgba(0,0,0,0.28)";
const SHADOW_CLOSED = "0 18px 48px rgba(0,0,0,0)";
/** How long the cursor rests before it opens, and how long it may wander off before it closes. */
const OPEN_DELAY_MS = 90;
const CLOSE_DELAY_MS = 200;

/** Every row's icon (or dot, or avatar) sits in a slot this wide... */
const SLOT = 22;
/** ...padded so the slot stays centred in the closed strip: the icons never move. */
const ROW_PAD = (SIDEBAR_COLLAPSED_WIDTH - 2 * 8 - SLOT) / 2;

/** The words that slide in and out (the rows' labels and the wordmark), found by this tag. */
const WORD = "sidebar-word";

/** On the web a React Native view's ref is its DOM element, which GSAP animates. */
function dom(ref: RefObject<unknown>): HTMLElement | null {
  return (ref.current as HTMLElement | null) ?? null;
}

/** One sidebar row: a hover wash that fades in and out, and the page you're on highlighted. */
function Row({
  icon,
  label,
  active,
  word = true,
  onPress,
  leading,
  muted = false,
  focusable = true,
}: {
  icon?: IconName;
  label: string;
  active: boolean;
  /** Whether its label slides with the sidebar (the features' rows fade as a block instead). */
  word?: boolean;
  onPress: () => void;
  /** Instead of an icon (e.g. a feature's status dot, a person's avatar). */
  leading?: ReactNode;
  muted?: boolean;
  /** False while hidden (the closed sidebar's features), so Tab skips it. */
  focusable?: boolean;
}): JSX.Element {
  const c = usePageColors();
  const washRef = useRef<ComponentRef<typeof View>>(null);

  const wash = (on: boolean) => {
    const el = dom(washRef);
    if (el === null || active) return;
    gsap.to(el, { opacity: on ? 1 : 0, duration: on ? 0.18 : 0.28, ease: "power2.out" });
  };

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      aria-current={active ? "page" : undefined}
      onPress={onPress}
      // React Native Web's Pressable sets its own tabIndex (ignoring `focusable`), so pass it.
      tabIndex={focusable ? 0 : -1}
      onHoverIn={() => wash(true)}
      onHoverOut={() => wash(false)}
      onFocus={() => wash(true)}
      onBlur={() => wash(false)}
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
          // Starting look (closed); GSAP takes over from here.
          opacity: word ? 0 : 1,
          transform: [{ translateX: word ? WORD_SHIFT : 0 }],
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
 * then Settings and who's signed in. A strip of icons that slides open over the page while it's
 * hovered or focused (the note above).
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
  const [open, setOpen] = useState(false);

  const panelRef = useRef<ComponentRef<typeof View>>(null);
  const featuresRef = useRef<ComponentRef<typeof View>>(null);
  const ctx = useRef<gsap.Context | null>(null);
  const slide = useRef<gsap.core.Timeline | null>(null);
  // The state last put on screen.
  const shown = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // One GSAP context for everything this sidebar animates, reverted when it goes away.
  useLayoutEffect(() => {
    const panel = dom(panelRef);
    if (panel === null) return;
    ctx.current = gsap.context(() => {}, panel);
    return () => {
      ctx.current?.revert();
      ctx.current = null;
      if (timer.current !== null) clearTimeout(timer.current);
    };
  }, []);

  // Open or close it now, playing the slide from wherever things are (a change of mind mid-slide
  // turns it around smoothly). The slide starts here, in the event; React re-renders the rest
  // (Tab stops, the features' clicks) behind it.
  const show = (next: boolean) => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    if (shown.current === next) return;
    const panel = dom(panelRef);
    const list = dom(featuresRef);
    const context = ctx.current;
    if (panel === null || list === null || context === null) return;
    shown.current = next;
    setOpen(next);

    context.add(() => {
      const words = panel.querySelectorAll(`[data-testid="${WORD}"]`);
      slide.current?.kill();
      if (reduceMotion) {
        gsap.set(panel, {
          width: next ? SIDEBAR_WIDTH : SIDEBAR_COLLAPSED_WIDTH,
          boxShadow: next ? SHADOW_OPEN : SHADOW_CLOSED,
        });
        gsap.set(words, { opacity: next ? 1 : 0, x: next ? 0 : WORD_SHIFT });
        gsap.set(list, { opacity: next ? 1 : 0, y: 0 });
        return;
      }
      const tl = gsap.timeline({ defaults: { overwrite: "auto" } });
      if (next) {
        tl.to(panel, { width: SIDEBAR_WIDTH, boxShadow: SHADOW_OPEN, ...SLIDE }, 0)
          .to(words, { opacity: 1, x: 0, ...WORDS_IN }, WORDS_IN_AT)
          .fromTo(
            list,
            { opacity: 0, y: 8 },
            { opacity: 1, y: 0, duration: 0.35, ease: "power2.out" },
            WORDS_IN_AT + 0.06
          );
      } else {
        tl.to(words, { opacity: 0, x: WORD_SHIFT, ...WORDS_OUT }, 0)
          .to(list, { opacity: 0, y: 4, duration: WORDS_OUT_DURATION, ease: "power1.in" }, 0)
          .to(
            panel,
            { width: SIDEBAR_COLLAPSED_WIDTH, boxShadow: SHADOW_CLOSED, ...SLIDE },
            SLIDE_OUT_AT
          );
      }
      slide.current = tl;
    });
  };

  /** Open or close it after a moment (a cursor passing by, or slipping off the edge, does nothing). */
  const showSoon = (next: boolean) => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => show(next), next ? OPEN_DELAY_MS : CLOSE_DELAY_MS);
  };

  // Keyboard: Tab into the sidebar opens it, Tab out of it closes it, Esc closes it.
  useEffect(() => {
    const panel = dom(panelRef);
    if (panel === null) return;
    const onFocusIn = () => show(true);
    const onFocusOut = (e: FocusEvent) => {
      if (!panel.contains(e.relatedTarget as Node | null)) showSoon(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !shown.current) return;
      show(false);
      (document.activeElement as HTMLElement | null)?.blur();
    };
    panel.addEventListener("focusin", onFocusIn);
    panel.addEventListener("focusout", onFocusOut);
    panel.addEventListener("keydown", onKey);
    return () => {
      panel.removeEventListener("focusin", onFocusIn);
      panel.removeEventListener("focusout", onFocusOut);
      panel.removeEventListener("keydown", onKey);
    };
  });

  const go = (href: Href) => router.navigate(href);
  const at = (path: string) => pathname === path || pathname.startsWith(`${path}/`);
  const openFeatures = (features ?? [])
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
    // The strip's place in the layout: always the closed width, so the page never moves.
    <View style={{ width: SIDEBAR_COLLAPSED_WIDTH, zIndex: 10 }}>
      <View
        ref={panelRef}
        accessibilityRole="navigation"
        onPointerEnter={(e) => {
          if (e.nativeEvent.pointerType !== "touch") showSoon(true);
        }}
        onPointerLeave={(e) => {
          if (e.nativeEvent.pointerType !== "touch") showSoon(false);
        }}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          // Starting values only (see the note at the top): GSAP animates them from here.
          width: SIDEBAR_COLLAPSED_WIDTH,
          boxShadow: SHADOW_CLOSED,
          overflow: "hidden",
          borderRightWidth: 1,
          borderRightColor: c.hairline,
          backgroundColor: c.panel,
          paddingVertical: 14,
          paddingHorizontal: 8,
          gap: 6,
        }}
      >
        {/* The Cadence mark (tap it to open or close the sidebar on a touch screen), and the
            wordmark that slides in beside it. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={open ? "Close the sidebar" : "Open the sidebar"}
          accessibilityState={{ expanded: open }}
          onPress={() => show(!shown.current)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            height: 36,
            marginBottom: 6,
            paddingHorizontal: ROW_PAD,
          }}
        >
          <View
            style={{
              width: SLOT,
              height: SLOT,
              borderRadius: 7,
              backgroundColor: c.accent,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                fontFamily: fonts.black,
                fontSize: 14,
                lineHeight: 16,
                color: c.accentText,
              }}
            >
              c
            </Text>
          </View>
          <Text
            testID={WORD}
            numberOfLines={1}
            ellipsizeMode="clip"
            style={{
              flex: 1,
              minWidth: 0,
              fontFamily: fonts.black,
              fontSize: 18,
              letterSpacing: -0.4,
              color: c.text,
              opacity: 0,
              transform: [{ translateX: WORD_SHIFT }],
            }}
          >
            cadence
          </Text>
        </Pressable>

        {pages.map((p) => (
          <Row
            key={p.label}
            icon={p.icon}
            label={p.label}
            active={p.active}
            onPress={() => go(p.href)}
          />
        ))}

        {/* The features fade away when closed (no clicks, no Tab stops, hidden from screen
            readers), keeping their space. */}
        <View
          ref={featuresRef}
          style={{
            flex: 1,
            marginTop: 14,
            opacity: 0,
            pointerEvents: open ? "auto" : "none",
          }}
          aria-hidden={!open}
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
            {features === undefined ? null : openFeatures.length === 0 ? (
              <Text style={{ ...webType.small, color: c.muted, paddingHorizontal: ROW_PAD }}>
                None in progress.
              </Text>
            ) : (
              openFeatures.map((f) => (
                <Row
                  key={f._id}
                  label={f.title}
                  active={at(`/features/${f._id}`)}
                  word={false}
                  focusable={open}
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
                word={false}
                focusable={open}
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
            onPress={() => go("/settings")}
          />
          <Row
            label={`${user.name} · ${ROLE_LABELS[user.role]}`}
            active={at("/settings/account")}
            leading={<Avatar size={SLOT} fill={pastelFor(user._id)} name={user.name} />}
            onPress={() => go("/settings/account")}
          />
        </View>
      </View>
    </View>
  );
}
