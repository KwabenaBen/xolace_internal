import { Ionicons } from "@expo/vector-icons";
import {
  useRef,
  useState,
  type ComponentProps,
  type ComponentRef,
  type JSX,
  type ReactNode,
} from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { usePageColors } from "@/components/ui/theme";

import { usePressScale, useTweenTo } from "./motion";
import { useHover } from "./use-hover";
import { webType } from "./web-theme";

/** The website's pages: as wide as the Board, centred past that. */
export const WEB_PAGE_MAX_WIDTH = 1280;

/** A website page: scrolls, centres its content up to the Board's width, the Board's margins. */
export function WebPage({ children }: { children: ReactNode }): JSX.Element {
  const c = usePageColors();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.page }}
      contentContainerStyle={{ paddingHorizontal: 36, paddingTop: 22, paddingBottom: 56 }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ width: "100%", maxWidth: WEB_PAGE_MAX_WIDTH, alignSelf: "center", gap: 24 }}>
        {children}
      </View>
    </ScrollView>
  );
}

/** "Board › Feature": where you are, the earlier steps as links (underlined on hover). */
export function Breadcrumb({
  trail,
  current,
}: {
  trail: { label: string; onPress: () => void }[];
  current: string;
}): JSX.Element {
  const c = usePageColors();
  return (
    <View
      accessibilityRole="navigation"
      aria-label="Breadcrumb"
      style={{ flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 }}
    >
      {trail.map((step) => (
        <View key={step.label} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <CrumbLink label={step.label} onPress={step.onPress} />
          <Ionicons name="chevron-forward" size={13} color={c.muted} />
        </View>
      ))}
      <Text
        numberOfLines={1}
        aria-current="page"
        style={{ ...webType.small, fontWeight: "600", color: c.text, flexShrink: 1 }}
      >
        {current}
      </Text>
    </View>
  );
}

function CrumbLink({ label, onPress }: { label: string; onPress: () => void }): JSX.Element {
  const c = usePageColors();
  const [hovered, hover] = useHover();
  return (
    <Pressable accessibilityRole="link" onPress={onPress} {...hover} hitSlop={6}>
      <Text
        style={{
          ...webType.small,
          color: hovered ? c.text : c.muted,
          textDecorationLine: hovered ? "underline" : "none",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

type IconName = ComponentProps<typeof Ionicons>["name"];

/**
 * A page's action: "primary" is the theme's solid pill (black, or off-white in dark mode),
 * "secondary" an outline. A wash fades in on hover; it sinks a little when pressed.
 */
export function ActionButton({
  label,
  icon,
  variant = "primary",
  onPress,
}: {
  label: string;
  icon?: IconName;
  variant?: "primary" | "secondary";
  onPress: () => void;
}): JSX.Element {
  const c = usePageColors();
  const [hovered, hover] = useHover();
  const button = useRef<ComponentRef<typeof Pressable>>(null);
  const wash = useRef<ComponentRef<typeof View>>(null);
  const press = usePressScale(button);
  useTweenTo(wash, { opacity: hovered ? 1 : 0 }, 0.2);
  const primary = variant === "primary";
  const ink = primary ? c.accentText : c.text;

  return (
    <Pressable
      ref={button}
      accessibilityRole="button"
      onPress={onPress}
      {...press}
      {...hover}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        borderRadius: 999,
        paddingHorizontal: 18,
        paddingVertical: 10,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: primary ? c.accent : c.hairline,
        backgroundColor: primary ? c.accent : "transparent",
      }}
    >
      <View
        ref={wash}
        style={[
          StyleSheet.absoluteFill,
          { opacity: 0, backgroundColor: primary ? "rgba(127,127,127,0.22)" : c.panelRaised },
        ]}
      />
      {icon !== undefined ? <Ionicons name={icon} size={17} color={ink} /> : null}
      <Text style={{ ...webType.body, fontWeight: "700", color: ink }}>{label}</Text>
    </Pressable>
  );
}

/**
 * Tabs whose highlight slides under the chosen one (GSAP, from wherever it is). Each tab shows a
 * count. Arrow keys aren't needed: each tab is its own button in the Tab order.
 */
export function SlidingTabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (value: T) => void;
  /** What the tabs choose, for screen readers. */
  label: string;
}): JSX.Element {
  const c = usePageColors();
  const [boxes, setBoxes] = useState<Record<string, { x: number; width: number }>>({});
  const pill = useRef<ComponentRef<typeof View>>(null);
  const box = boxes[value];
  useTweenTo(pill, box !== undefined ? { x: box.x, width: box.width, opacity: 1 } : { opacity: 0 });

  return (
    <View
      accessibilityRole="tablist"
      aria-label={label}
      style={{
        flexDirection: "row",
        alignSelf: "flex-start",
        padding: 4,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: c.hairline,
        backgroundColor: c.panel,
      }}
    >
      <View
        ref={pill}
        style={{
          position: "absolute",
          top: 4,
          bottom: 4,
          left: 0,
          width: 0,
          opacity: 0,
          borderRadius: 999,
          backgroundColor: c.accent,
        }}
      />
      {tabs.map((tab) => (
        <Tab
          key={tab.value}
          label={tab.label}
          count={tab.count}
          selected={tab.value === value}
          onPress={() => onChange(tab.value)}
          onMeasure={(x, width) =>
            setBoxes((prev) =>
              prev[tab.value]?.x === x && prev[tab.value]?.width === width
                ? prev
                : { ...prev, [tab.value]: { x, width } }
            )
          }
        />
      ))}
    </View>
  );
}

/** One tab: its words ease to the highlight's colour as the highlight slides under them. */
function Tab({
  label,
  count,
  selected,
  onPress,
  onMeasure,
}: {
  label: string;
  count?: number;
  selected: boolean;
  onPress: () => void;
  onMeasure: (x: number, width: number) => void;
}): JSX.Element {
  const c = usePageColors();
  const [hovered, hover] = useHover();
  // The words' colour is GSAP's once on screen; React only gives the first one.
  const [initiallySelected] = useState(selected);
  const words = useRef<ComponentRef<typeof Text>>(null);
  const number = useRef<ComponentRef<typeof Text>>(null);
  useTweenTo(words, { color: selected ? c.accentText : hovered ? c.text : c.muted }, 0.28);
  useTweenTo(number, { color: selected ? c.accentText : c.muted }, 0.28);

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      // React Native Web doesn't turn accessibilityState into aria-selected for tabs.
      aria-selected={selected}
      onPress={onPress}
      {...hover}
      onLayout={(e) => onMeasure(e.nativeEvent.layout.x, e.nativeEvent.layout.width)}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 7,
      }}
    >
      <Text
        ref={words}
        style={{
          ...webType.small,
          fontWeight: "600",
          color: initiallySelected ? c.accentText : c.muted,
        }}
      >
        {label}
      </Text>
      {count !== undefined ? (
        <Text
          ref={number}
          style={{ ...webType.tiny, color: initiallySelected ? c.accentText : c.muted }}
        >
          {count}
        </Text>
      ) : null}
    </Pressable>
  );
}
