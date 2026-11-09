import { useMutation } from "convex/react";
import { useRouter } from "expo-router";
import type { JSX } from "react";

import { api } from "@convex/_generated/api";

import { InviteForm } from "@/components/people/invite-form";
import { AdminOnly } from "@/components/planning/admin-only";

/**
 * Settings → People → Invite someone (admins). A native modal sheet (swipe down to close; it asks
 * first if something's been typed). After Create it shows the code to send, then Done goes back.
 */
export default function InviteScreen(): JSX.Element {
  const createInvite = useMutation(api.invites.create);
  const router = useRouter();

  return (
    <AdminOnly>
      <InviteForm
        onCreate={(values) => createInvite(values)}
        onDone={() => (router.canGoBack() ? router.back() : router.replace("/settings/people"))}
      />
    </AdminOnly>
  );
}
