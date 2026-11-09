import type { Id } from "@convex/_generated/dataModel";
import type { Role } from "@convex/lib/validators";

import type { SheetAction } from "@/components/ui/action-sheet";

/**
 * What an admin can do to `person` from the People page, each asking first. It mirrors the
 * server's rules (convex/users.ts) so the sheet never offers what would be refused: nobody
 * deactivates themselves, and the last active admin stays an admin. Empty when there's nothing.
 */
export function personActions({
  person,
  myId,
  activeAdmins,
  isReviewer,
  setRole,
  setActive,
}: {
  person: { _id: Id<"users">; name: string; role: Role; isActive: boolean };
  myId: Id<"users">;
  activeAdmins: number;
  /** They're the admin task reviewer (Team rules). */
  isReviewer: boolean;
  setRole: (role: Role) => Promise<void>;
  setActive: (isActive: boolean) => Promise<void>;
}): SheetAction[] {
  const first = person.name.trim().split(/\s+/)[0] ?? person.name;
  const isMe = person._id === myId;

  if (!person.isActive) {
    return [
      {
        key: "reactivate",
        label: "Reactivate",
        description: "They can sign in again and be given work.",
        confirm: {
          title: `Reactivate ${first}?`,
          message: "They can sign in again with their email and password, and be given work.",
          label: "Reactivate",
        },
        run: () => setActive(true),
      },
    ];
  }

  if (person.role === "admin" && activeAdmins <= 1) return [];

  const actions: SheetAction[] = [];
  if (person.role === "member") {
    actions.push({
      key: "make-admin",
      label: "Make admin",
      description: "Plans features, assigns and approves work, and manages the team.",
      confirm: {
        title: `Make ${first} an admin?`,
        message:
          "Admins plan features, assign and approve work, and manage the team and its rules.",
        label: "Make admin",
      },
      run: () => setRole("admin"),
    });
  } else {
    actions.push({
      key: "make-member",
      label: isMe ? "Make me a member" : "Make member",
      description: "Works on their tasks and proposes new ones.",
      destructive: isMe,
      confirm: isMe
        ? {
            title: "Give up admin?",
            message:
              "You'll become a member straight away and lose the admin tools, this page's included. Another admin can make you an admin again.",
            label: "Make me a member",
          }
        : {
            title: `Make ${first} a member?`,
            message:
              "They keep their tasks, but can no longer plan, assign or approve work, or manage the team.",
            label: "Make member",
          },
      run: () => setRole("member"),
    });
  }

  if (!isMe) {
    actions.push({
      key: "deactivate",
      label: "Deactivate",
      description: "Signs them out everywhere until an admin reactivates them.",
      destructive: true,
      confirm: {
        title: `Deactivate ${first}?`,
        message: `They're signed out on every device and can't sign back in until an admin reactivates them. Their tasks stay as they are.${
          isReviewer
            ? " They're also the admin task reviewer, so choose someone else in Team rules."
            : ""
        }`,
        label: "Deactivate",
      },
      run: () => setActive(false),
    });
  }
  return actions;
}
