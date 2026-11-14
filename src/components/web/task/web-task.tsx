import { Ionicons } from "@expo/vector-icons";
import { useMutation } from "convex/react";
import { useIsFocused, useRouter } from "expo-router";
import { useEffect, useRef, useState, type ComponentRef, type JSX, type ReactNode } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import { calendarDaysBetween, formatDeadline, longDay, relativeDay } from "@convex/lib/dates";
import { isPlanLocked } from "@convex/lib/validators";
import type { TaskView, UserSummary } from "@convex/lib/views";

import { Avatar, pastelFor } from "@/components/people/avatar";
import { CriteriaList } from "@/components/task/criteria-list";
import { decidedBy } from "@/components/task/deciders";
import { ExtensionPanel } from "@/components/task/extension-panel";
import { ExtensionSheet } from "@/components/task/extension-sheet";
import { TaskBanner } from "@/components/task/task-panels";
import { TaskHistory } from "@/components/task/task-history";
import { UpdateSheet } from "@/components/task/update-sheet";
import { ReviewPanel } from "@/components/task/review-panel";
import { ReviewSheet } from "@/components/task/review-sheet";
import {
  nextReviewStep,
  taskFacts,
  useTaskData,
  type TaskExtensions,
  type TaskReviews,
} from "@/components/task/use-task-state";
import { verifiedBy } from "@/components/task/verifiers";
import { clampPercent } from "@/components/ui/progress-bar";
import { StatusPill } from "@/components/ui/task-row";
import { colors, fonts, usePageColors } from "@/components/ui/theme";
import { TASK_KIND_LABELS, TASK_PRIORITY_LABELS } from "@/constants/labels";
import { getErrorMessage } from "@/lib/errors";
import { useToast } from "@/components/ui/toast";
import { useSignedInUser } from "@/lib/use-current-user";
import { useNow } from "@/lib/use-now";

import { playOut, useEnterFrom, useGrowIn, useTweenTo } from "../motion";
import { ActionButton } from "../page";
import { useHover } from "../use-hover";
import { webType } from "../web-theme";

/** The panel's width beside the page; expanded, it takes the whole page area. */
const PANEL_WIDTH = 760;

/** The cards the panel opens: an update, more time, a peer review request, a submission. */
type Sheet = "update" | "extend" | "peer" | "submit";

/** Closing: back to the page underneath (or the Board when the task was opened from a link). */
function useClose(): () => void {
  const router = useRouter();
  return () => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };
}

/**
 * A task on the website layout: a panel that slides in from the right over the page it was opened
 * from (which stays put, dimmed), as planned with the team. Esc, the ✕ or a click outside slides
 * it away; the expand button grows it to the whole page area and back. Inside, in the Board's
 * style: the title and its status, the buttons for what you can do, the time and progress card in
 * the feature's pastel, the people on it, the description, the acceptance criteria, and the
 * history with comments. The phone keeps its own page (tasks/[taskId]/index.tsx).
 */
export function WebTaskPanel({ taskId }: { taskId: string }): JSX.Element {
  const c = usePageColors();
  const close = useClose();
  const isFocused = useIsFocused();
  const [expanded, setExpanded] = useState(false);
  // Two columns only once the panel has mostly grown (expanding), and one again at once
  // (shrinking), so the words never squeeze into a still-narrow panel.
  const [twoColumns, setTwoColumns] = useState(false);
  const columnsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toggleExpand = () => {
    if (columnsTimer.current !== null) clearTimeout(columnsTimer.current);
    if (expanded) {
      setTwoColumns(false);
      setExpanded(false);
    } else {
      setExpanded(true);
      columnsTimer.current = setTimeout(() => setTwoColumns(true), 280);
    }
  };
  useEffect(
    () => () => {
      if (columnsTimer.current !== null) clearTimeout(columnsTimer.current);
    },
    []
  );
  // A sheet (post an update, ask for more time) is open over the panel: Esc is the sheet's.
  const [sheetOpen, setSheetOpen] = useState(false);
  const panel = useRef<ComponentRef<typeof View>>(null);
  const dim = useRef<ComponentRef<typeof View>>(null);
  const closing = useRef(false);

  useEnterFrom(panel, { xPercent: 100 }, 0.5);
  useEnterFrom(dim, { opacity: 0 }, 0.4);
  useTweenTo(panel, { width: expanded ? "100%" : `${PANEL_WIDTH}px` }, 0.45);

  const slideAway = () => {
    if (closing.current) return;
    closing.current = true;
    void Promise.all([
      playOut([panel], { xPercent: 100 }, 0.32),
      playOut([dim], { opacity: 0 }, 0.32),
    ]).then(close);
  };

  useEffect(() => {
    if (Platform.OS !== "web" || !isFocused || sheetOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") slideAway();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <View style={styles.stage}>
      <View ref={dim} style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.32)" }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close the task"
          onPress={slideAway}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <View
        ref={panel}
        role="dialog"
        aria-modal
        aria-label="Task"
        style={{
          width: PANEL_WIDTH,
          maxWidth: "100%",
          height: "100%",
          backgroundColor: c.page,
          borderLeftWidth: 1,
          borderLeftColor: c.hairline,
          boxShadow: "-24px 0 60px rgba(0,0,0,0.22)",
        }}
      >
        <TaskPanelBody
          taskId={taskId}
          expanded={expanded}
          twoColumns={twoColumns}
          onToggleExpand={toggleExpand}
          onClose={slideAway}
          onSheet={setSheetOpen}
        />
      </View>
    </View>
  );
}

function TaskPanelBody({
  taskId,
  expanded,
  twoColumns,
  onToggleExpand,
  onClose,
  onSheet,
}: {
  taskId: string;
  expanded: boolean;
  twoColumns: boolean;
  onToggleExpand: () => void;
  onClose: () => void;
  onSheet: (open: boolean) => void;
}): JSX.Element {
  const c = usePageColors();
  const { data, extensions, reviews, windowHours } = useTaskData(taskId);
  const [open, setOpenState] = useState<Sheet | null>(null);
  const setOpen = (next: Sheet | null) => {
    setOpenState(next);
    onSheet(next !== null);
  };

  const top = (
    <TopBar
      feature={data?.feature ?? null}
      expanded={expanded}
      onToggleExpand={onToggleExpand}
      onClose={onClose}
    />
  );

  if (data === undefined) {
    return (
      <View style={{ flex: 1 }}>
        {top}
        <ActivityIndicator color={c.text} style={{ paddingVertical: 120 }} />
      </View>
    );
  }
  if (data === null) {
    return (
      <View style={{ flex: 1 }}>
        {top}
        <View style={{ padding: 32, gap: 16, alignItems: "flex-start" }}>
          <Text style={{ fontFamily: fonts.black, fontSize: 28, color: c.text }}>
            This task doesn&apos;t exist.
          </Text>
          <ActionButton label="Close" icon="close" onPress={onClose} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {top}
      <TaskContent
        task={data.task}
        feature={data.feature}
        extensions={extensions}
        reviews={reviews}
        windowHours={windowHours}
        twoColumns={twoColumns}
        onOpenSheet={setOpen}
      />
      {open === "update" ? <UpdateSheet task={data.task} onClose={() => setOpen(null)} /> : null}
      {open === "peer" || open === "submit" ? (
        <ReviewSheet
          mode={open}
          taskId={data.task._id}
          reviewerName={data.task.peerReviewer?.name}
          verifierWords={reviews !== undefined ? verifiedBy(reviews.verifier) : undefined}
          onClose={() => setOpen(null)}
        />
      ) : null}
      {open === "extend" && data.task.deadline !== undefined ? (
        <ExtensionSheet
          taskId={data.task._id}
          deadline={data.task.deadline}
          featureDeadline={data.feature.deadline}
          windowHours={windowHours}
          decidedBy={extensions !== undefined ? decidedBy(extensions.decider) : "An admin decides."}
          alreadyLate={data.task.countsAsLate}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </View>
  );
}

/** The panel's top: the feature it belongs to (opens it), then expand and close. */
function TopBar({
  feature,
  expanded,
  onToggleExpand,
  onClose,
}: {
  feature: Doc<"features"> | null;
  expanded: boolean;
  onToggleExpand: () => void;
  onClose: () => void;
}): JSX.Element {
  const c = usePageColors();
  const router = useRouter();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: c.hairline,
      }}
    >
      <View style={{ flex: 1, minWidth: 0, flexDirection: "row" }}>
        {feature !== null ? (
          <FeatureLink
            title={feature.title}
            fill={pastelFor(feature._id)}
            onPress={() =>
              router.dismissTo({
                pathname: "/features/[featureId]",
                params: { featureId: feature._id },
              })
            }
          />
        ) : null}
      </View>
      <IconButton
        icon={expanded ? "contract-outline" : "expand-outline"}
        label={expanded ? "Back to a side panel" : "Expand to the whole page"}
        onPress={onToggleExpand}
      />
      <IconButton icon="close" label="Close the task" onPress={onClose} />
    </View>
  );
}

/** The feature a task belongs to, as a pastel chip with its sticker colour; opens the feature. */
function FeatureLink({
  title,
  fill,
  onPress,
}: {
  title: string;
  fill: string;
  onPress: () => void;
}): JSX.Element {
  const [hovered, hover] = useHover();
  const chip = useRef<ComponentRef<typeof Pressable>>(null);
  useTweenTo(chip, { y: hovered ? -2 : 0 }, 0.22);
  return (
    <Pressable
      ref={chip}
      accessibilityRole="link"
      accessibilityLabel={`Part of ${title}. Opens the feature`}
      onPress={onPress}
      {...hover}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        maxWidth: "100%",
        borderRadius: 999,
        borderWidth: 1.5,
        borderColor: colors.ink,
        backgroundColor: fill,
        paddingHorizontal: 12,
        paddingVertical: 6,
      }}
    >
      <Ionicons name="albums-outline" size={14} color={colors.ink} />
      <Text numberOfLines={1} style={{ ...webType.small, fontWeight: "700", color: colors.ink }}>
        {title}
      </Text>
      <Ionicons name="arrow-forward" size={13} color={colors.ink} />
    </Pressable>
  );
}

function IconButton({
  icon,
  label,
  onPress,
}: {
  icon: "expand-outline" | "contract-outline" | "close";
  label: string;
  onPress: () => void;
}): JSX.Element {
  const c = usePageColors();
  const [hovered, hover] = useHover();
  const wash = useRef<ComponentRef<typeof View>>(null);
  useTweenTo(wash, { opacity: hovered ? 1 : 0 }, 0.18);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      {...hover}
      style={{
        width: 36,
        height: 36,
        borderRadius: 999,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <View
        ref={wash}
        style={[StyleSheet.absoluteFill, { opacity: 0, backgroundColor: c.panelRaised }]}
      />
      <Ionicons name={icon} size={18} color={c.text} />
    </Pressable>
  );
}

/** The task itself. Expanded and wide, it's two columns: the reading on the left, the facts right. */
function TaskContent({
  task,
  feature,
  extensions,
  reviews,
  windowHours,
  twoColumns,
  onOpenSheet,
}: {
  task: TaskView;
  feature: Doc<"features">;
  extensions: TaskExtensions | undefined;
  reviews: TaskReviews | undefined;
  windowHours: number;
  /** Expanded and grown: the reading on the left, the facts on the right. */
  twoColumns: boolean;
  onOpenSheet: (sheet: Sheet) => void;
}): JSX.Element {
  const c = usePageColors();
  const user = useSignedInUser();
  const router = useRouter();
  const now = useNow();
  const isAdmin = user.role === "admin";
  const facts = taskFacts(task, feature, extensions, user._id);
  const { isProposal, isDeclined, isLive, canUpdate, pending, hasPending, cantAsk } = facts;
  const step = nextReviewStep(reviews);
  // Ready to submit, but nobody could verify it: say why instead of offering the button.
  const cantSubmit =
    canUpdate && reviews !== undefined && !reviews.needsPeerReview && !reviews.hasVerifier
      ? verifiedBy(reviews.verifier)
      : null;

  const edit = () =>
    router.push({ pathname: "/tasks/[taskId]/edit", params: { taskId: task._id } });
  const openPerson = (person: UserSummary) =>
    router.push({
      pathname: "/features/[featureId]/people/[userId]",
      params: { featureId: feature._id, userId: person._id },
    });

  const people: { role: string; person: UserSummary | null; fallback: string }[] = [];
  if (isLive) {
    people.push({ role: "Owner", person: task.owner, fallback: "Unassigned" });
    if (task.kind === "code") {
      people.push({ role: "Peer reviewer", person: task.peerReviewer, fallback: "Not set" });
    }
  }
  if (task.proposer !== null) {
    people.push({ role: "Proposed by", person: task.proposer, fallback: "Someone" });
  }

  const canExtend = !hasPending && cantAsk === null && task.deadline !== undefined;
  const reading = (
    <>
      {task.description !== "" ? (
        <Section title="About this task">
          <Text style={{ ...webType.body, fontSize: 15, lineHeight: 23, color: c.text }}>
            {task.description}
          </Text>
        </Section>
      ) : null}
      <Section
        title={isLive ? "Acceptance criteria" : "Suggested acceptance criteria"}
        count={task.acceptanceCriteria.length}
      >
        {task.acceptanceCriteria.length === 0 ? (
          <Text style={{ ...webType.body, color: c.muted }}>None yet.</Text>
        ) : (
          <CriteriaList
            criteria={task.acceptanceCriteria}
            verified={task.status === "verified"}
            size="large"
          />
        )}
      </Section>
      <TaskHistory s={1} taskId={task._id} canComment={!isDeclined} />
    </>
  );
  const side = (
    <>
      {!isDeclined ? <TimeCard task={task} feature={feature} now={now} /> : null}
      {people.length > 0 ? (
        <Section title="People">
          <View style={{ marginHorizontal: -12 }}>
            {people.map(({ role, person, fallback }) => (
              <PersonRow
                key={role}
                role={role}
                person={person}
                fallback={fallback}
                // Owner and reviewer open their work on this feature (as on the phone).
                onOpen={
                  person !== null && role !== "Proposed by" ? () => openPerson(person) : undefined
                }
              />
            ))}
          </View>
        </Section>
      ) : null}
    </>
  );

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 28, paddingBottom: 48, gap: 20 }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ gap: 12, maxWidth: twoColumns ? 1200 : undefined }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <StatusPill status={task.status} />
          <Chip text={TASK_KIND_LABELS[task.kind]} />
          <Chip
            text={`${TASK_PRIORITY_LABELS[task.priority]} priority`}
            strong={task.priority === "urgent"}
          />
        </View>
        <Text
          accessibilityRole="header"
          style={{
            fontFamily: fonts.black,
            fontSize: 32,
            lineHeight: 38,
            letterSpacing: -0.9,
            color: c.text,
          }}
        >
          {task.title}
        </Text>
      </View>

      {/* What you can do. */}
      {canUpdate || (isAdmin && !isDeclined) ? (
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {canUpdate && step !== null ? (
              <ActionButton
                label={step === "peer" ? "Ask for a peer review" : "Submit for verification"}
                icon={step === "peer" ? "git-pull-request-outline" : "checkmark-done-outline"}
                onPress={() => onOpenSheet(step)}
              />
            ) : null}
            {canUpdate ? (
              <ActionButton
                label="Post an update"
                icon="pulse-outline"
                variant={step !== null ? "secondary" : "primary"}
                onPress={() => onOpenSheet("update")}
              />
            ) : null}
            {canUpdate && canExtend ? (
              <ActionButton
                label="Ask for more time"
                icon="time-outline"
                variant="secondary"
                onPress={() => onOpenSheet("extend")}
              />
            ) : null}
            {isAdmin ? (
              <AdminActions
                taskId={task._id}
                isProposal={isProposal}
                isLocked={isPlanLocked(task.status)}
                onEdit={edit}
              />
            ) : null}
          </View>
          {canUpdate && !hasPending && cantAsk !== null ? (
            <Text style={{ ...webType.small, color: c.muted }}>{cantAsk}</Text>
          ) : null}
          {cantSubmit !== null ? (
            <Text style={{ ...webType.small, color: c.muted }}>{cantSubmit}</Text>
          ) : null}
        </View>
      ) : null}

      {isDeclined ? (
        <TaskBanner
          s={1}
          tone="declined"
          title="Proposal declined"
          body={task.declineReason ?? "No reason given."}
        />
      ) : null}
      {isProposal ? (
        <TaskBanner
          s={1}
          tone="waiting"
          title={isAdmin ? "Waiting for your review" : "Waiting for an admin"}
          body={
            isAdmin
              ? "Approve it to set the owner, deadline and final acceptance criteria, or decline it with a reason."
              : "The owner, deadline and final acceptance criteria are set when an admin approves it."
          }
        />
      ) : null}
      {isLive && task.countsAsLate ? (
        <TaskBanner
          s={1}
          tone="late"
          title="Counts as late"
          body="An extension was asked for close to its deadline, or wasn't a scope change. It stays on the record."
        />
      ) : null}
      {isLive && extensions !== undefined && pending !== undefined ? (
        <ExtensionPanel
          key={pending._id}
          s={1}
          data={extensions}
          pending={pending}
          featureDeadline={feature.deadline}
          windowHours={windowHours}
          now={now}
          myId={user._id}
          alreadyLate={task.countsAsLate}
          approveBlock={facts.approveBlock}
        />
      ) : null}
      {isLive && reviews !== undefined ? (
        <ReviewPanel
          key={reviews.pending?._id ?? "none"}
          s={1}
          task={task}
          reviews={reviews}
          now={now}
        />
      ) : null}

      {twoColumns ? (
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 24 }}>
          <View style={{ flex: 1, minWidth: 0, gap: 20 }}>{reading}</View>
          <View style={{ width: 360, gap: 20 }}>{side}</View>
        </View>
      ) : (
        <>
          {side}
          {reading}
        </>
      )}
    </ScrollView>
  );
}

/** A small outlined label (the task's type, its priority; urgent in the late red). */
function Chip({ text, strong = false }: { text: string; strong?: boolean }): JSX.Element {
  const c = usePageColors();
  return (
    <View
      style={{
        borderRadius: 999,
        borderWidth: 1,
        borderColor: strong ? colors.lateCard : c.hairline,
        backgroundColor: strong ? colors.lateCard : "transparent",
        paddingHorizontal: 10,
        paddingVertical: 3,
      }}
    >
      <Text style={{ ...webType.tiny, fontWeight: "600", color: strong ? colors.white : c.text }}>
        {text}
      </Text>
    </View>
  );
}

/** A titled panel in the theme. */
function Section({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: ReactNode;
}): JSX.Element {
  const c = usePageColors();
  return (
    <View
      style={{
        borderRadius: 22,
        borderWidth: 1,
        borderColor: c.hairline,
        backgroundColor: c.panel,
        padding: 20,
        gap: 14,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
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
      {children}
    </View>
  );
}

/**
 * When it's due and how far along, on the feature's pastel (the task's link to its feature): the
 * progress (the bar grows in), the deadline (red when late, the original if it moved), the
 * feature's deadline; once verified, when.
 */
function TimeCard({
  task,
  feature,
  now,
}: {
  task: TaskView;
  feature: Doc<"features">;
  now: number;
}): JSX.Element {
  const bar = useRef<ComponentRef<typeof View>>(null);
  useGrowIn(bar, 0.35);
  const verified = task.status === "verified";
  const percent = verified ? 100 : clampPercent(task.progress);
  const late =
    !verified && task.deadline !== undefined && calendarDaysBetween(now, task.deadline) < 0;
  const moved =
    task.originalDeadline !== undefined &&
    task.deadline !== undefined &&
    task.originalDeadline !== task.deadline;

  return (
    <View
      style={{
        borderRadius: 22,
        borderWidth: 1.5,
        borderColor: colors.ink,
        backgroundColor: pastelFor(feature._id),
        padding: 20,
        gap: 14,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
        <Text style={{ fontFamily: fonts.black, fontSize: 44, lineHeight: 48, color: colors.ink }}>
          {percent}%
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
            width: `${percent}%`,
            height: "100%",
            borderRadius: 999,
            backgroundColor: colors.ink,
          }}
        />
      </View>
      <View style={{ gap: 6 }}>
        {verified ? (
          <Fact
            icon="checkmark-circle"
            text={
              task.verifiedAt !== undefined
                ? `Verified ${formatDeadline(task.verifiedAt, now)}`
                : "Verified"
            }
          />
        ) : task.deadline === undefined ? (
          <Fact icon="calendar-clear-outline" text="Deadline set when an admin approves it" />
        ) : (
          <View
            accessible
            accessibilityLabel={`Due ${longDay(task.deadline)}, ${relativeDay(task.deadline, now)}`}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              alignSelf: "flex-start",
              borderRadius: 999,
              paddingHorizontal: 12,
              paddingVertical: 6,
              backgroundColor: late ? colors.lateCard : colors.ink,
            }}
          >
            <Ionicons
              name={late ? "alert-circle" : "calendar-clear-outline"}
              size={14}
              color={colors.white}
            />
            <Text style={{ ...webType.small, fontWeight: "700", color: colors.white }}>
              Due {formatDeadline(task.deadline, now)} · {relativeDay(task.deadline, now)}
            </Text>
          </View>
        )}
        {moved && task.originalDeadline !== undefined ? (
          <Fact
            icon="swap-horizontal"
            text={`Moved from ${formatDeadline(task.originalDeadline, now)}`}
          />
        ) : null}
        <Fact icon="albums-outline" text={`Feature due ${formatDeadline(feature.deadline, now)}`} />
      </View>
    </View>
  );
}

function Fact({
  icon,
  text,
}: {
  icon: "checkmark-circle" | "calendar-clear-outline" | "swap-horizontal" | "albums-outline";
  text: string;
}): JSX.Element {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Ionicons name={icon} size={15} color={colors.ink} />
      <Text style={{ ...webType.small, color: colors.ink }}>{text}</Text>
    </View>
  );
}

/** Someone on the task: avatar, name and role; owner and reviewer open their work on the feature. */
function PersonRow({
  role,
  person,
  fallback,
  onOpen,
}: {
  role: string;
  person: UserSummary | null;
  fallback: string;
  onOpen?: () => void;
}): JSX.Element {
  const c = usePageColors();
  const [hovered, hover] = useHover();
  const [focused, setFocused] = useState(false);
  const active = (hovered || focused) && onOpen !== undefined;
  const wash = useRef<ComponentRef<typeof View>>(null);
  const arrow = useRef<ComponentRef<typeof View>>(null);
  useTweenTo(wash, { opacity: active ? 1 : 0 }, 0.2);
  useTweenTo(arrow, { opacity: active ? 1 : 0, x: active ? 0 : -6 }, 0.22);
  const name = person?.name ?? fallback;
  return (
    <Pressable
      accessibilityRole={onOpen !== undefined ? "link" : undefined}
      accessibilityLabel={`${role}: ${name}${onOpen !== undefined ? ". Shows their work on this feature" : ""}`}
      disabled={onOpen === undefined}
      onPress={onOpen}
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
      {person !== null ? (
        <Avatar size={36} fill={pastelFor(person._id)} name={person.name} />
      ) : (
        <View style={{ width: 36, height: 36, borderRadius: 999, backgroundColor: c.panelHigh }} />
      )}
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text numberOfLines={1} style={{ ...webType.body, fontWeight: "600", color: c.text }}>
          {name}
        </Text>
        <Text style={{ ...webType.tiny, color: c.muted }}>{role}</Text>
      </View>
      <View ref={arrow} style={{ opacity: 0 }}>
        <Ionicons name="arrow-forward" size={15} color={c.text} />
      </View>
    </Pressable>
  );
}

/**
 * The admin's buttons: edit a live task (not while its plan is locked: in review, submitted or
 * verified), or for a proposal, review and approve it (the plan form) or decline it with a reason.
 */
function AdminActions({
  taskId,
  isProposal,
  isLocked,
  onEdit,
}: {
  taskId: Id<"tasks">;
  isProposal: boolean;
  isLocked: boolean;
  onEdit: () => void;
}): JSX.Element | null {
  const c = usePageColors();
  const declineProposal = useMutation(api.tasks.declineProposal);
  const toast = useToast();
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function decline() {
    if (reason.trim() === "") {
      setError("Give a reason so the proposer knows why.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await declineProposal({ taskId, reason });
      setDeclining(false);
      toast("Proposal declined");
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (!isProposal) {
    if (isLocked) {
      return (
        <Text style={{ ...webType.small, color: c.muted, alignSelf: "center" }}>
          The plan is locked while it&apos;s in review, submitted or verified.
        </Text>
      );
    }
    return (
      <ActionButton label="Edit task" icon="create-outline" variant="secondary" onPress={onEdit} />
    );
  }
  if (!declining) {
    return (
      <>
        <ActionButton label="Review & approve" icon="checkmark" onPress={onEdit} />
        <ActionButton
          label="Decline"
          icon="close"
          variant="secondary"
          onPress={() => setDeclining(true)}
        />
      </>
    );
  }
  return (
    <View
      style={{
        width: "100%",
        gap: 12,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: c.hairline,
        backgroundColor: c.panel,
        padding: 16,
      }}
    >
      <Text style={{ fontFamily: fonts.extraBold, fontSize: 16, color: c.text }}>
        Why are you declining it?
      </Text>
      {error !== null ? (
        <Text
          accessibilityRole="alert"
          style={{ ...webType.small, fontWeight: "600", color: c.danger }}
        >
          {error}
        </Text>
      ) : null}
      <TextInput
        accessibilityLabel="Why are you declining it?"
        value={reason}
        onChangeText={setReason}
        placeholder="Out of scope for this feature"
        placeholderTextColor={c.placeholder}
        multiline
        numberOfLines={3}
        autoFocus
        style={{
          ...webType.body,
          minHeight: 84,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: c.hairline,
          backgroundColor: c.field,
          color: c.fieldText,
          padding: 12,
          textAlignVertical: "top",
        }}
      />
      <View style={{ flexDirection: "row", gap: 10 }}>
        <ActionButton label={busy ? "Declining…" : "Decline"} onPress={() => void decline()} />
        <ActionButton label="Cancel" variant="secondary" onPress={() => setDeclining(false)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // The panel sits at the right of the page area; taps on the dim around it close it.
  stage: { flex: 1, flexDirection: "row", justifyContent: "flex-end", pointerEvents: "box-none" },
});
