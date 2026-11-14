import { usePaginatedQuery, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useState, type JSX } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { calendarDaysBetween, shortDay } from "@convex/lib/dates";

import { ActivityRow } from "@/components/activity/activity-row";
import { entryTarget, type ActivityItem } from "@/components/activity/describe";
import { Avatar, pastelFor } from "@/components/people/avatar";
import { DetailPage, useGoBack, usePageSize } from "@/components/ui/detail-page";
import { PageHeader } from "@/components/ui/page-header";
import { SectionTitle } from "@/components/ui/panel";
import { PillButton } from "@/components/ui/pill-button";
import { fonts, usePageColors } from "@/components/ui/theme";
import { useNow } from "@/lib/use-now";

const PAGE = 30;

/** "Today", "Yesterday", or "Tue 10 Nov", by GMT calendar day. */
function dayLabel(ms: number, now: number): string {
  const days = calendarDaysBetween(ms, now);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return shortDay(ms, now);
}

/**
 * The team's activity: every change, who made it and when, newest first, grouped by day, from
 * the Board's red "team activity" tile. Everyone sees it (invite entries only reach
 * admins: the server leaves them out for members). Pick someone at the top to see only what they
 * did; tap an entry about a task or a feature to open it. Loads 30 at a time.
 */
export default function ActivityScreen(): JSX.Element {
  const router = useRouter();
  const goBack = useGoBack();
  const { s, content } = usePageSize();
  const c = usePageColors();
  const now = useNow();
  const people = useQuery(api.users.list);
  const [actorId, setActorId] = useState<Id<"users"> | undefined>(undefined);
  const { results, status, loadMore } = usePaginatedQuery(
    api.activity.feed,
    actorId !== undefined ? { actorId } : {},
    { initialNumItems: PAGE }
  );

  const open = (item: ActivityItem) => {
    const target = entryTarget(item);
    if (target?.kind === "task") {
      router.push({ pathname: "/tasks/[taskId]", params: { taskId: target.id } });
    } else if (target?.kind === "feature") {
      router.push({ pathname: "/features/[featureId]", params: { featureId: target.id } });
    }
  };

  // Day groups, in order.
  const days: { label: string; items: ActivityItem[] }[] = [];
  for (const item of results) {
    const label = dayLabel(item.timestamp, now);
    const last = days.at(-1);
    if (last !== undefined && last.label === label) last.items.push(item);
    else days.push({ label, items: [item] });
  }

  const chip = (
    key: string,
    label: string,
    isChosen: boolean,
    onPress: () => void,
    avatar?: JSX.Element
  ) => (
    <Pressable
      key={key}
      accessibilityRole="radio"
      accessibilityState={{ checked: isChosen }}
      aria-checked={isChosen}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        height: 40,
        paddingLeft: avatar !== undefined ? 4 : 16,
        paddingRight: 16,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: isChosen ? c.accent : c.hairline,
        backgroundColor: isChosen ? c.accent : c.panel,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {avatar}
      <Text
        style={{ fontFamily: fonts.bold, fontSize: 14, color: isChosen ? c.accentText : c.text }}
      >
        {label}
      </Text>
    </Pressable>
  );

  return (
    <DetailPage title="Activity" content={content}>
      <View style={{ gap: 22 * s }}>
        <PageHeader
          s={s}
          title="Activity"
          subtitle="Every task, one owner: every change, who made it and when."
          onBack={goBack}
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          accessibilityRole="radiogroup"
          accessibilityLabel="Whose activity"
          contentContainerStyle={{ gap: 8, paddingRight: 8 }}
        >
          {chip("everyone", "Everyone", actorId === undefined, () => setActorId(undefined))}
          {(people ?? [])
            .filter((p) => p.isActive)
            .map((p) =>
              chip(
                p._id,
                p.name.split(" ")[0] ?? p.name,
                actorId === p._id,
                () => setActorId(p._id),
                <Avatar size={32} fill={pastelFor(p._id)} name={p.name} />
              )
            )}
        </ScrollView>

        {status === "LoadingFirstPage" ? (
          <ActivityIndicator color={c.text} style={{ paddingTop: 40 }} />
        ) : results.length === 0 ? (
          <Text
            style={{ fontFamily: fonts.medium, fontSize: 15, color: c.muted, paddingHorizontal: 4 }}
          >
            Nothing yet.
          </Text>
        ) : (
          days.map((day) => (
            <View key={day.label} style={{ gap: 4 * s }}>
              <SectionTitle s={s} title={day.label} />
              <View
                style={{
                  borderRadius: 26 * s,
                  backgroundColor: c.panel,
                  borderWidth: 1,
                  borderColor: c.hairline,
                  paddingHorizontal: 16 * s,
                  paddingVertical: 6 * s,
                }}
              >
                {day.items.map((item) => (
                  <ActivityRow
                    key={item._id}
                    item={item}
                    inTask={false}
                    now={now}
                    onPress={entryTarget(item) !== null ? () => open(item) : undefined}
                  />
                ))}
              </View>
            </View>
          ))
        )}

        {status === "CanLoadMore" ? (
          <PillButton label="Show older" variant="secondary" onPress={() => loadMore(PAGE)} />
        ) : status === "LoadingMore" ? (
          <ActivityIndicator color={c.text} />
        ) : results.length > 0 ? (
          <Text
            style={{ fontFamily: fonts.medium, fontSize: 13, color: c.muted, textAlign: "center" }}
          >
            That&apos;s everything.
          </Text>
        ) : null}
      </View>
    </DetailPage>
  );
}
