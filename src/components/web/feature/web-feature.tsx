import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useRef, useState, type ComponentRef, type JSX, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";
import { calendarDaysBetween, formatDeadline, longDay, relativeDay } from "@convex/lib/dates";
import type { TaskView, UserSummary } from "@convex/lib/views";

import { featureProgress, plural } from "@/components/board/board-stats";
import { featureTeam, teamRole, type TeamMember } from "@/components/feature/feature-team";
import { ShipSheet } from "@/components/feature/ship-sheet";
import { Avatar, pastelFor } from "@/components/people/avatar";
import { colors, fonts, PAPER, STATUS_COLORS, usePageColors } from "@/components/ui/theme";
import { FEATURE_STATUS_LABELS, LIVE_STATUS_ORDER, TASK_STATUS_LABELS } from "@/constants/labels";
import { useSignedInUser } from "@/lib/use-current-user";
import { useNow } from "@/lib/use-now";

import { useGrowIn, useTweenTo } from "../motion";
import { ActionButton, Breadcrumb, SlidingTabs, WebPage } from "../page";
import { TaskTable } from "../task-table";
import { useHover } from "../use-hover";
import { webType } from "../web-theme";

/** From this window width the side column sits beside the tasks (as on the Board). */
const SIDE_BY_SIDE = 1400;
const SIDE_WIDTH = 360;
const GAP = 20;

type FeatureData = {
  feature: Doc<"features">;
  createdBy: UserSummary | null;
  tasks: TaskView[];
  proposals: TaskView[];
};

/**
 * A feature on the website layout, in the Board's style: the feature's pastel (the same as its
 * Board card) as a wide hero with its stage, title, description and progress; the tasks split by
 * status; the tasks as a table with tabs; and beside them what done looks like, the team and the
 * proposals waiting. The phone keeps its own page (features/[featureId]/index.tsx).
 */
export function WebFeature({ featureId }: { featureId: string }): JSX.Element {
  const data = useQuery(api.features.get, { featureId });
  const router = useRouter();
  const c = usePageColors();
  const back = () => router.navigate("/");

  if (data === undefined) {
    return (
      <WebPage>
        <Breadcrumb trail={[{ label: "Board", onPress: back }]} current="Feature" />
        <ActivityIndicator color={c.text} style={{ paddingVertical: 120 }} />
      </WebPage>
    );
  }
  if (data === null) {
    return (
      <WebPage>
        <Breadcrumb trail={[{ label: "Board", onPress: back }]} current="Not found" />
        <View style={{ paddingVertical: 80, alignItems: "flex-start", gap: 16 }}>
          <Text style={{ fontFamily: fonts.black, fontSize: 32, color: c.text }}>
            This feature doesn&apos;t exist.
          </Text>
          <ActionButton label="Back to the Board" icon="arrow-back" onPress={back} />
        </View>
      </WebPage>
    );
  }
  return <WebFeatureView data={data} />;
}

type TaskTab = "all" | "open" | "verified";

/** The feature page from its data. */
export function WebFeatureView({ data }: { data: FeatureData }): JSX.Element {
  const user = useSignedInUser();
  const router = useRouter();
  const c = usePageColors();
  const now = useNow();
  const { width } = useWindowDimensions();
  const [tab, setTab] = useState<TaskTab>("all");
  const [shipping, setShipping] = useState(false);

  const { feature, createdBy, tasks, proposals } = data;
  const isAdmin = user.role === "admin";
  const canAddWork = feature.status !== "shipped";
  const team = featureTeam(tasks);
  const open = tasks.filter((t) => t.status !== "verified");
  const verified = tasks.filter((t) => t.status === "verified");
  const shown = tab === "open" ? open : tab === "verified" ? verified : tasks;
  const wide = width >= SIDE_BY_SIDE;

  const openTask = (taskId: string) =>
    router.push({ pathname: "/tasks/[taskId]", params: { taskId } });
  const newTask = () => router.push({ pathname: "/tasks/new", params: { featureId: feature._id } });
  const edit = () =>
    router.push({ pathname: "/features/[featureId]/edit", params: { featureId: feature._id } });
  const openPerson = (userId: string) =>
    router.push({
      pathname: "/features/[featureId]/people/[userId]",
      params: { featureId: feature._id, userId },
    });

  // Beside the tasks in a wide window; under them, side by side, in a narrower one.
  const side = [
    feature.expectedResult !== "" ? <DoneCard key="done" text={feature.expectedResult} /> : null,
    <TeamCard key="team" team={team} onOpenPerson={openPerson} />,
    proposals.length > 0 ? (
      <ProposalsCard key="proposals" proposals={proposals} now={now} onOpenTask={openTask} />
    ) : null,
  ].filter((card) => card !== null);

  return (
    <WebPage>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <Breadcrumb
          trail={[{ label: "Board", onPress: () => router.navigate("/") }]}
          current={feature.title}
        />
        <View style={{ flexDirection: "row", gap: 10 }}>
          {isAdmin && feature.status === "internal_testing" ? (
            <ActionButton
              label="Mark as live"
              icon="rocket-outline"
              onPress={() => setShipping(true)}
            />
          ) : null}
          {isAdmin ? (
            <ActionButton
              label="Edit feature"
              icon="create-outline"
              variant="secondary"
              onPress={edit}
            />
          ) : null}
          {canAddWork ? (
            <ActionButton
              label={isAdmin ? "Add task" : "Propose a task"}
              icon="add"
              onPress={newTask}
            />
          ) : null}
        </View>
      </View>

      <Hero data={data} createdBy={createdBy} now={now} />
      {shipping ? (
        <ShipSheet
          featureId={feature._id}
          title={feature.title}
          onClose={() => setShipping(false)}
        />
      ) : null}

      <StatusStrip tasks={tasks} />

      <View style={{ flexDirection: wide ? "row" : "column", alignItems: "flex-start", gap: GAP }}>
        <View style={wide ? { flex: 1, minWidth: 0 } : { width: "100%" }}>
          <Card>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                paddingHorizontal: 12,
                paddingBottom: 8,
              }}
            >
              <Text
                accessibilityRole="header"
                style={{
                  fontFamily: fonts.extraBold,
                  fontSize: 20,
                  letterSpacing: -0.4,
                  color: c.text,
                }}
              >
                Tasks
              </Text>
              <SlidingTabs<TaskTab>
                label="Which tasks"
                value={tab}
                onChange={setTab}
                tabs={[
                  { value: "all", label: "All", count: tasks.length },
                  { value: "open", label: "Open", count: open.length },
                  { value: "verified", label: "Verified", count: verified.length },
                ]}
              />
            </View>
            <TaskTable
              tasks={shown}
              now={now}
              onOpenTask={openTask}
              empty={
                tasks.length === 0
                  ? canAddWork
                    ? isAdmin
                      ? "No tasks yet. Add the first with “Add task”."
                      : "No tasks yet. Suggest one with “Propose a task”."
                    : "No tasks."
                  : tab === "open"
                    ? "Every task is verified."
                    : "Nothing verified yet."
              }
            />
          </Card>
        </View>
        <View
          style={
            wide
              ? { width: SIDE_WIDTH, gap: GAP }
              : { width: "100%", flexDirection: "row", flexWrap: "wrap", gap: GAP }
          }
        >
          {wide
            ? side
            : side.map((card) => (
                <View key={card.key} style={{ flexGrow: 1, flexBasis: 320, minWidth: 0 }}>
                  {card}
                </View>
              ))}
        </View>
      </View>
    </WebPage>
  );
}

/** A plain panel in the theme (the tasks table, the team, the proposals). */
function Card({ children }: { children: ReactNode }): JSX.Element {
  const c = usePageColors();
  return (
    <View
      style={{
        borderRadius: 22,
        borderWidth: 1,
        borderColor: c.hairline,
        backgroundColor: c.panel,
        paddingHorizontal: 12,
        paddingVertical: 16,
        gap: 4,
      }}
    >
      {children}
    </View>
  );
}

function CardTitle({ title, count }: { title: string; count?: number }): JSX.Element {
  const c = usePageColors();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "baseline",
        gap: 8,
        paddingHorizontal: 12,
        paddingBottom: 6,
      }}
    >
      <Text
        accessibilityRole="header"
        style={{ fontFamily: fonts.extraBold, fontSize: 16, letterSpacing: -0.3, color: c.text }}
      >
        {title}
      </Text>
      {count !== undefined ? (
        <Text style={{ ...webType.small, color: c.muted }}>{count}</Text>
      ) : null}
    </View>
  );
}

/**
 * The feature's pastel (the same as its Board card), wide: its stage and where it was agreed, the
 * title and description on the left; on the right how far along it is (the bar grows in), how
 * many tasks are verified and when it's due.
 */
function Hero({
  data,
  createdBy,
  now,
}: {
  data: FeatureData;
  createdBy: UserSummary | null;
  now: number;
}): JSX.Element {
  const { feature, tasks } = data;
  const progress = featureProgress(tasks);
  const bar = useRef<ComponentRef<typeof View>>(null);
  useGrowIn(bar, 0.15);
  const shipped = feature.status === "shipped";
  const late = !shipped && calendarDaysBetween(now, feature.deadline) < 0;
  const planner = createdBy?.name ?? "an admin";

  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 28,
        borderRadius: 28,
        borderWidth: 1.5,
        borderColor: colors.ink,
        backgroundColor: pastelFor(feature._id),
        padding: 28,
      }}
    >
      <View style={{ flexGrow: 1, flexBasis: 420, minWidth: 0, gap: 12 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
          <View
            style={{
              borderRadius: 999,
              paddingHorizontal: 12,
              paddingVertical: 5,
              backgroundColor: colors.tagFill,
              borderWidth: 1,
              borderColor: colors.ink,
            }}
          >
            <Text style={{ ...webType.tiny, fontWeight: "700", color: colors.ink }}>
              {FEATURE_STATUS_LABELS[feature.status]}
            </Text>
          </View>
          <Text style={{ ...webType.small, color: colors.ink }}>
            {feature.sourceNote !== ""
              ? `Agreed at ${feature.sourceNote} · planned by ${planner}`
              : `Planned by ${planner}`}
          </Text>
        </View>
        <Text
          accessibilityRole="header"
          style={{
            fontFamily: fonts.black,
            fontSize: 40,
            lineHeight: 46,
            letterSpacing: -1.2,
            color: colors.ink,
          }}
        >
          {feature.title}
        </Text>
        {feature.description !== "" ? (
          <Text
            style={{
              ...webType.body,
              fontSize: 15,
              lineHeight: 23,
              color: colors.ink,
              maxWidth: 680,
            }}
          >
            {feature.description}
          </Text>
        ) : null}
      </View>

      <View
        style={{
          flexBasis: 280,
          flexGrow: 0,
          gap: 12,
          justifyContent: "flex-end",
          borderRadius: 20,
          borderWidth: 1.5,
          borderColor: colors.ink,
          backgroundColor: colors.tagFill,
          padding: 20,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
          <Text
            style={{ fontFamily: fonts.black, fontSize: 52, lineHeight: 56, color: colors.ink }}
          >
            {progress.percent}%
          </Text>
          <Text style={{ ...webType.small, color: colors.ink }}>done</Text>
        </View>
        <View
          style={{
            height: 10,
            borderRadius: 999,
            backgroundColor: "rgba(17,17,17,0.14)",
            overflow: "hidden",
          }}
        >
          <View
            ref={bar}
            style={{
              width: `${progress.percent}%`,
              height: "100%",
              borderRadius: 999,
              backgroundColor: colors.ink,
            }}
          />
        </View>
        <Text style={{ ...webType.small, color: colors.ink }}>
          <Text style={{ fontWeight: "700" }}>
            {progress.verified}/{progress.total}
          </Text>{" "}
          tasks verified
        </Text>
        <View
          accessible
          accessibilityLabel={
            shipped
              ? "Shipped"
              : `Due ${longDay(feature.deadline)}, ${relativeDay(feature.deadline, now)}`
          }
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            alignSelf: "flex-start",
            borderRadius: 999,
            paddingHorizontal: 12,
            paddingVertical: 6,
            backgroundColor: shipped ? colors.green : late ? colors.lateCard : colors.ink,
          }}
        >
          <Ionicons
            name={shipped ? "checkmark-circle" : late ? "alert-circle" : "calendar-clear-outline"}
            size={14}
            color={shipped ? colors.ink : colors.white}
          />
          <Text
            style={{
              ...webType.small,
              fontWeight: "700",
              color: shipped ? colors.ink : colors.white,
            }}
          >
            {shipped
              ? "Shipped"
              : `Due ${formatDeadline(feature.deadline, now)} · ${relativeDay(feature.deadline, now)}`}
          </Text>
        </View>
      </View>
    </View>
  );
}

/** The tasks split by status, one coloured segment each (growing in), with counts underneath. */
function StatusStrip({ tasks }: { tasks: TaskView[] }): JSX.Element | null {
  const c = usePageColors();
  const strip = useRef<ComponentRef<typeof View>>(null);
  useGrowIn(strip, 0.25);
  const counts = LIVE_STATUS_ORDER.map((status) => ({
    status,
    count: tasks.filter((t) => t.status === status).length,
  })).filter((s) => s.count > 0);
  if (counts.length === 0) return null;

  return (
    <View style={{ gap: 10 }}>
      <View
        ref={strip}
        accessible
        accessibilityLabel={`Tasks by status: ${counts.map((s) => `${s.count} ${TASK_STATUS_LABELS[s.status]}`).join(", ")}`}
        style={{
          flexDirection: "row",
          height: 14,
          borderRadius: 999,
          overflow: "hidden",
          borderWidth: 1.5,
          borderColor: c.text,
        }}
      >
        {counts.map((s, i) => (
          <View
            key={s.status}
            style={{
              flex: s.count,
              backgroundColor: STATUS_COLORS[s.status].fill,
              borderLeftWidth: i === 0 ? 0 : 1.5,
              borderLeftColor: c.text,
            }}
          />
        ))}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
        {counts.map((s) => (
          <View key={s.status} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                backgroundColor: STATUS_COLORS[s.status].fill,
                borderWidth: 1,
                borderColor: c.text,
              }}
            />
            <Text style={{ ...webType.small, color: c.text }}>
              {TASK_STATUS_LABELS[s.status]} <Text style={{ fontWeight: "700" }}>{s.count}</Text>
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** The expected result, on the near-black card (the Board's "Next up" look). */
function DoneCard({ text }: { text: string }): JSX.Element {
  const c = usePageColors();
  return (
    <View
      style={{
        borderRadius: 22,
        borderWidth: 1,
        borderColor: c.hairline,
        backgroundColor: colors.holoCard,
        padding: 22,
        gap: 10,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Ionicons name="flag-outline" size={16} color={colors.yellow} />
        <Text style={{ ...webType.small, fontWeight: "700", color: colors.yellow }}>
          What done looks like
        </Text>
      </View>
      <Text style={{ ...webType.body, fontSize: 15, lineHeight: 23, color: PAPER }}>{text}</Text>
    </View>
  );
}

/** A row in a side card: a wash fades in on hover or focus, an arrow slides in; it opens. */
function HoverRow({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: ReactNode;
}): JSX.Element {
  const c = usePageColors();
  const [hovered, hover] = useHover();
  const [focused, setFocused] = useState(false);
  const active = hovered || focused;
  const wash = useRef<ComponentRef<typeof View>>(null);
  const arrow = useRef<ComponentRef<typeof View>>(null);
  useTweenTo(wash, { opacity: active ? 1 : 0 }, 0.2);
  useTweenTo(arrow, { opacity: active ? 1 : 0, x: active ? 0 : -6 }, 0.22);
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      {...hover}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <View
        ref={wash}
        style={[StyleSheet.absoluteFill, { opacity: 0, backgroundColor: c.panelRaised }]}
      />
      {children}
      <View ref={arrow} style={{ opacity: 0 }}>
        <Ionicons name="arrow-forward" size={15} color={c.text} />
      </View>
    </Pressable>
  );
}

/** Who's on the feature: each person, their role, their tasks and how far along; opens their work. */
function TeamCard({
  team,
  onOpenPerson,
}: {
  team: TeamMember[];
  onOpenPerson: (userId: string) => void;
}): JSX.Element {
  const c = usePageColors();
  return (
    <Card>
      <CardTitle title="Team" count={team.length} />
      {team.length === 0 ? (
        <Text style={{ ...webType.small, color: c.muted, paddingHorizontal: 12, paddingBottom: 6 }}>
          Nobody yet. People join when they get a task.
        </Text>
      ) : (
        team.map((member) => {
          const owns = member.owns.length;
          const detail =
            owns > 0
              ? `${plural(owns, "task")} · ${member.progress.percent}%`
              : `Reviews ${member.reviews.length}`;
          return (
            <HoverRow
              key={member.user._id}
              label={`${member.user.name}, ${teamRole(member)}, ${detail}. Shows their work on this feature`}
              onPress={() => onOpenPerson(member.user._id)}
            >
              <Avatar size={36} fill={pastelFor(member.user._id)} name={member.user.name} />
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Text
                  numberOfLines={1}
                  style={{ ...webType.body, fontWeight: "600", color: c.text }}
                >
                  {member.user.name}
                </Text>
                <Text numberOfLines={1} style={{ ...webType.tiny, color: c.muted }}>
                  {teamRole(member)} · {detail}
                </Text>
              </View>
              {owns > 0 ? (
                <View
                  style={{
                    width: 56,
                    height: 6,
                    borderRadius: 999,
                    backgroundColor: c.panelHigh,
                    overflow: "hidden",
                  }}
                >
                  <View
                    style={{
                      width: `${member.progress.percent}%`,
                      height: "100%",
                      borderRadius: 999,
                      backgroundColor: c.text,
                    }}
                  />
                </View>
              ) : null}
            </HoverRow>
          );
        })
      )}
    </Card>
  );
}

/** Proposals waiting for an admin: each opens its task, where it's approved or declined. */
function ProposalsCard({
  proposals,
  now,
  onOpenTask,
}: {
  proposals: TaskView[];
  now: number;
  onOpenTask: (taskId: string) => void;
}): JSX.Element {
  const c = usePageColors();
  return (
    <Card>
      <CardTitle title="Waiting for approval" count={proposals.length} />
      {proposals.map((task) => {
        const by = task.proposer?.name ?? "Someone";
        const when = formatDeadline(task._creationTime, now);
        return (
          <HoverRow
            key={task._id}
            label={`${task.title}, proposed by ${by} on ${when}`}
            onPress={() => onOpenTask(task._id)}
          >
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                backgroundColor: STATUS_COLORS.proposed.fill,
                borderWidth: 1,
                borderColor: c.text,
              }}
            />
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text numberOfLines={1} style={{ ...webType.body, fontWeight: "600", color: c.text }}>
                {task.title}
              </Text>
              <Text numberOfLines={1} style={{ ...webType.tiny, color: c.muted }}>
                Proposed by {by} · {when}
              </Text>
            </View>
          </HoverRow>
        );
      })}
    </Card>
  );
}
