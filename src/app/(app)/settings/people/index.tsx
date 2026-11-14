import { useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useRef, useState, type JSX } from "react";
import { Text, View } from "react-native";

import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import { formatDeadline } from "@convex/lib/dates";
import { formatInviteCode } from "@convex/lib/inviteCodes";

import { Avatar, pastelFor } from "@/components/people/avatar";
import { hasLiveCode, inviteActions } from "@/components/people/invite-actions";
import { ListRow } from "@/components/people/list-row";
import { PersonCard } from "@/components/people/person-card";
import { personActions } from "@/components/people/person-actions";
import { TeamGrid } from "@/components/people/team-grid";
import { ActionSheet } from "@/components/ui/action-sheet";
import { useToast } from "@/components/ui/toast";
import { DetailPage, PageLoading, useGoBack, usePageSize } from "@/components/ui/detail-page";
import { PageHeader, RoundButton } from "@/components/ui/page-header";
import { SectionTitle } from "@/components/ui/panel";
import { symbols } from "@/components/ui/sym";
import { colors, fonts, usePageColors } from "@/components/ui/theme";
import { ROLE_LABELS } from "@/constants/labels";
import { useSignedInUser } from "@/lib/use-current-user";
import { useNow } from "@/lib/use-now";

type Open =
  | { kind: "person"; id: Id<"users"> }
  // The invite as opened, so its sheet can play its exit after it's revoked.
  | { kind: "invite"; id: Id<"invites">; invite: Doc<"invites"> }
  | null;

/**
 * Settings → People, after the "Select experts" reference: the team as a grid of round avatars,
 * then the invites waiting to be used and anyone deactivated, as rows. Everyone sees the team.
 * Admins also invite people (the round + button; each invite comes with a one-time code to send),
 * and tap a person or an invite for its actions. The server checks every one of those itself
 * (convex/users.ts, convex/invites.ts).
 */
export default function PeopleScreen(): JSX.Element {
  const me = useSignedInUser();
  const isAdmin = me.role === "admin";
  const router = useRouter();
  const goBack = useGoBack();
  const { s, content } = usePageSize();
  const c = usePageColors();
  const now = useNow();
  const users = useQuery(api.users.list);
  const settings = useQuery(api.settings.list);
  // Members can't read invites (the query refuses them), so they don't ask.
  const invites = useQuery(api.invites.list, isAdmin ? {} : "skip");
  const setRole = useMutation(api.users.setRole);
  const setActive = useMutation(api.users.setActive);
  const renew = useMutation(api.invites.renew);
  const revoke = useMutation(api.invites.revoke);
  const toast = useToast();
  const [open, setOpen] = useState<Open>(null);
  // Whose logs to open once their card has closed ("Daily logs" on the card).
  const logsAfterClose = useRef<Id<"users"> | null>(null);

  const invite = isAdmin ? (
    <RoundButton
      symbol={symbols.add}
      label="Invite someone"
      onPress={() => router.push("/settings/people/invite")}
      s={s}
    />
  ) : undefined;

  if (users === undefined) {
    return (
      <DetailPage title="People" content={content}>
        <View style={{ gap: 22 * s }}>
          <PageHeader s={s} title="People" onBack={goBack} action={invite} />
          <PageLoading />
        </View>
      </DetailPage>
    );
  }

  const active = users.filter((u) => u.isActive);
  const deactivated = users.filter((u) => !u.isActive);
  const activeAdmins = active.filter((u) => u.role === "admin").length;
  const pending = (invites ?? []).filter((i) => i.usedAt === undefined);
  const reviewerRef = settings?.find((x) => x.key === "adminTaskReviewer")?.value;
  const reviewerId =
    typeof reviewerRef === "object" && reviewerRef !== null ? reviewerRef.userId : undefined;

  const actionsFor = (person: (typeof users)[number]) =>
    isAdmin
      ? personActions({
          person,
          myId: me._id,
          activeAdmins,
          isReviewer: person._id === reviewerId,
          setRole: async (role) => {
            await setRole({ userId: person._id, role });
            toast(`${person.name} is now ${role === "admin" ? "an admin" : "a member"}`);
          },
          setActive: async (isActive) => {
            await setActive({ userId: person._id, isActive });
            toast(`${person.name} ${isActive ? "reactivated" : "deactivated and signed out"}`);
          },
        })
      : [];

  /** "CMO, Admin, admin task reviewer": the person's facts, read out and shown in the sheet. */
  const factsOf = (person: (typeof users)[number]) =>
    [
      person.title,
      ROLE_LABELS[person.role],
      person._id === reviewerId ? "admin task reviewer" : undefined,
      person.isActive ? undefined : "deactivated",
    ]
      .filter(Boolean)
      .join(", ");

  const openPerson = open?.kind === "person" ? users.find((u) => u._id === open.id) : undefined;
  const openInvite =
    open?.kind === "invite" ? (pending.find((i) => i._id === open.id) ?? open.invite) : undefined;
  const muted = { fontFamily: fonts.medium, fontSize: 14 * s, lineHeight: 20 * s, color: c.muted };

  return (
    <DetailPage title="People" content={content}>
      <View style={{ gap: 22 * s }}>
        <PageHeader
          s={s}
          title="People"
          subtitle={`${active.length} on the team · ${activeAdmins} ${activeAdmins === 1 ? "admin" : "admins"}`}
          onBack={goBack}
          action={invite}
        />

        <TeamGrid
          s={s}
          width={content}
          title="The team"
          people={active.map((person) => {
            const isYou = person._id === me._id;
            return {
              id: person._id,
              name: person.name,
              title: person.title,
              isAdmin: person.role === "admin",
              isYou,
              label: `${person.name}${isYou ? " (you)" : ""}, ${factsOf(person)}`,
              onPress: () => setOpen({ kind: "person", id: person._id }),
            };
          })}
        />

        {isAdmin ? (
          <View style={{ gap: 12 * s }}>
            <SectionTitle s={s} title="Waiting to join" count={pending.length} />
            {invites === undefined ? (
              <PageLoading />
            ) : pending.length === 0 ? (
              <Text style={{ ...muted, paddingHorizontal: 4 }}>
                Nobody yet. Tap + to invite someone; they join with the code you send them.
              </Text>
            ) : (
              pending.map((inv) => {
                const live = hasLiveCode(inv, now);
                const line =
                  live && inv.code !== undefined
                    ? `Code ${formatInviteCode(inv.code)}`
                    : inv.code === undefined
                      ? "No code yet"
                      : "Code expired";
                const aside =
                  live && inv.expiresAt !== undefined
                    ? `Until ${formatDeadline(inv.expiresAt, now)}`
                    : "Needs a code";
                return (
                  <ListRow
                    key={inv._id}
                    s={s}
                    avatar={
                      <Avatar size={46 * s} fill={pastelFor(inv._id)} symbol={symbols.invite} />
                    }
                    title={inv.email}
                    line={line}
                    aside={aside}
                    dot={live ? undefined : colors.yellow}
                    label={`${inv.email}, invited as ${inv.title}, ${ROLE_LABELS[inv.role]}. ${
                      live && inv.code !== undefined
                        ? `Code ${inv.code.split("").join(" ")}, ${aside.toLowerCase()}`
                        : `${line}.`
                    }`}
                    hint="Share the code, make a new one, or revoke the invite"
                    onPress={() => setOpen({ kind: "invite", id: inv._id, invite: inv })}
                  />
                );
              })
            )}
          </View>
        ) : null}

        {deactivated.length > 0 ? (
          <View style={{ gap: 12 * s }}>
            <SectionTitle s={s} title="Deactivated" count={deactivated.length} />
            {deactivated.map((person) => {
              return (
                <ListRow
                  key={person._id}
                  s={s}
                  avatar={
                    <Avatar size={46 * s} fill={pastelFor(person._id)} name={person.name} dim />
                  }
                  title={person.name}
                  line={person.title}
                  aside="Signed out"
                  label={`${person.name}, ${factsOf(person)}`}
                  hint="Opens their card"
                  onPress={() => setOpen({ kind: "person", id: person._id })}
                />
              );
            })}
          </View>
        ) : null}

        <Text style={{ ...muted, paddingHorizontal: 4 }}>
          {isAdmin
            ? "Tap someone for their card, and to change their role or deactivate them. Admins plan and approve work; members work on tasks and propose new ones."
            : "Tap someone for their card. Only admins can invite people or change roles."}
        </Text>
      </View>

      {openPerson !== undefined ? (
        <PersonCard
          person={openPerson}
          isYou={openPerson._id === me._id}
          isReviewer={openPerson._id === reviewerId}
          actions={actionsFor(openPerson)}
          onOpenLogs={() => {
            logsAfterClose.current = openPerson._id;
          }}
          onClose={() => {
            setOpen(null);
            // "Daily logs": the card has played its exit; now open their logs.
            const userId = logsAfterClose.current;
            logsAfterClose.current = null;
            if (userId !== null) {
              router.push({ pathname: "/logs/[userId]", params: { userId, from: "people" } });
            }
          }}
        />
      ) : null}

      {openInvite !== undefined ? (
        <ActionSheet
          title={openInvite.email}
          subtitle={`Invited as ${openInvite.title}, ${ROLE_LABELS[openInvite.role]}`}
          detail={
            hasLiveCode(openInvite, now) && openInvite.code !== undefined ? (
              <View style={{ gap: 2 }}>
                <Text
                  selectable
                  accessibilityLabel={`Invite code ${openInvite.code.split("").join(" ")}`}
                  style={{ fontFamily: fonts.black, fontSize: 28, letterSpacing: 2, color: c.text }}
                >
                  {formatInviteCode(openInvite.code)}
                </Text>
                {openInvite.expiresAt !== undefined ? (
                  <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: c.muted }}>
                    Works until {formatDeadline(openInvite.expiresAt, now)}. They sign up with this
                    email and the code.
                  </Text>
                ) : null}
              </View>
            ) : (
              <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: c.muted }}>
                No working code. Make one, then send it to them.
              </Text>
            )
          }
          actions={inviteActions({
            invite: openInvite,
            now,
            canShare: process.env.EXPO_OS !== "web",
            canCopy: process.env.EXPO_OS === "web",
            renew: async () => {
              await renew({ inviteId: openInvite._id });
              toast("New code made. The old one stopped working");
            },
            revoke: async () => {
              await revoke({ inviteId: openInvite._id });
              toast("Invite revoked");
            },
          })}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </DetailPage>
  );
}
