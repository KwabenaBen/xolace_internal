import { Share } from "react-native";

import type { Doc } from "@convex/_generated/dataModel";
import { INVITE_DAYS } from "@convex/lib/constants";
import { formatDeadline } from "@convex/lib/dates";
import { formatInviteCode } from "@convex/lib/inviteCodes";

import type { SheetAction } from "@/components/ui/action-sheet";

/** Whether a pending invite has a code that still works at `now`. */
export function hasLiveCode(invite: Doc<"invites">, now: number): boolean {
  return invite.code !== undefined && (invite.expiresAt === undefined || invite.expiresAt >= now);
}

/** The invite as a message to send: who it's for, the code, and until when it works. */
export function inviteMessage(invite: Doc<"invites">, now: number): string {
  const code = invite.code === undefined ? "" : formatInviteCode(invite.code);
  const until =
    invite.expiresAt === undefined
      ? ""
      : ` It works until ${formatDeadline(invite.expiresAt, now)}.`;
  return `You're invited to Cadence as ${invite.title}. Sign up with ${invite.email} and the code ${code}.${until}`;
}

/**
 * What an admin can do with a pending invite: share its code (phone only: the share sheet), make
 * a new code (the sheet stays open so the new one can be shared straight away), or revoke it.
 */
export function inviteActions({
  invite,
  now,
  canShare,
  renew,
  revoke,
}: {
  invite: Doc<"invites">;
  now: number;
  canShare: boolean;
  renew: () => Promise<void>;
  revoke: () => Promise<void>;
}): SheetAction[] {
  const live = hasLiveCode(invite, now);
  const actions: SheetAction[] = [];
  if (live && canShare) {
    actions.push({
      key: "share",
      label: "Share code",
      description: "Send it by message, mail or WhatsApp.",
      run: async () => {
        await Share.share({ message: inviteMessage(invite, now) });
      },
      stayOpen: true,
    });
  }
  actions.push({
    key: "new-code",
    label: live ? "New code" : "Make a code",
    description: live
      ? "Replaces the code: the old one stops working."
      : `It works for ${INVITE_DAYS} days.`,
    confirm: live
      ? {
          title: "Make a new code?",
          message: `The code you sent ${invite.email} stops working. Send them the new one.`,
          label: "New code",
        }
      : undefined,
    run: renew,
    stayOpen: true,
  });
  actions.push({
    key: "revoke",
    label: "Revoke invite",
    description: "They can't sign up. You can invite them again later.",
    destructive: true,
    confirm: {
      title: "Revoke this invite?",
      message: `${invite.email} won't be able to sign up. You can invite them again later.`,
      label: "Revoke",
    },
    run: revoke,
  });
  return actions;
}
