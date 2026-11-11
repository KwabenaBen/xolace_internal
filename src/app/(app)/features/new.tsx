import { useMutation } from "convex/react";
import { useRouter } from "expo-router";
import type { JSX } from "react";

import { api } from "@convex/_generated/api";

import { AdminOnly } from "@/components/planning/admin-only";
import { useToast } from "@/components/ui/toast";
import { EMPTY_FEATURE, FeatureForm } from "@/components/planning/feature-form";

export default function NewFeatureScreen(): JSX.Element {
  const createFeature = useMutation(api.features.create);
  const router = useRouter();
  const toast = useToast();

  return (
    <AdminOnly>
      <FeatureForm
        initial={EMPTY_FEATURE}
        submitLabel="Create feature"
        dialogTitle="New feature"
        onSubmit={async (values) => {
          const featureId = await createFeature(values);
          toast("Feature created");
          router.replace({ pathname: "/features/[featureId]", params: { featureId } });
        }}
      />
    </AdminOnly>
  );
}
