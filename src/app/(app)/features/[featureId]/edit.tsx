import { useMutation, useQuery } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { JSX } from "react";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { toDateOnly } from "@convex/lib/dates";

import { LoadingScreen } from "@/components/loading-screen";
import { AdminOnly } from "@/components/planning/admin-only";
import { useToast } from "@/components/ui/toast";
import { FeatureForm } from "@/components/planning/feature-form";
import { NotFound } from "@/components/planning/not-found";

export default function EditFeatureScreen(): JSX.Element {
  const { featureId } = useLocalSearchParams<{ featureId: Id<"features"> }>();
  const data = useQuery(api.features.get, { featureId });
  const updateFeature = useMutation(api.features.update);
  const router = useRouter();
  const toast = useToast();

  if (data === undefined) return <LoadingScreen />;
  if (data === null) return <NotFound what="feature" />;
  const { feature } = data;

  return (
    <AdminOnly>
      <FeatureForm
        dialogTitle="Edit feature"
        initial={{
          title: feature.title,
          description: feature.description,
          expectedResult: feature.expectedResult,
          sourceNote: feature.sourceNote,
          deadline: toDateOnly(feature.deadline),
        }}
        submitLabel="Save changes"
        onSubmit={async (values) => {
          await updateFeature({ featureId, ...values });
          toast("Feature saved");
          // Opened straight from a link or a web refresh, there may be nothing to go back to.
          if (router.canGoBack()) router.back();
          else router.replace({ pathname: "/features/[featureId]", params: { featureId } });
        }}
      />
    </AdminOnly>
  );
}
