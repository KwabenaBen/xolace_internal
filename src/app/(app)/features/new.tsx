import { useMutation } from "convex/react";
import { useRouter } from "expo-router";
import type { JSX } from "react";

import { api } from "@convex/_generated/api";

import { AdminOnly } from "@/components/planning/admin-only";
import { EMPTY_FEATURE, FeatureForm } from "@/components/planning/feature-form";

export default function NewFeatureScreen(): JSX.Element {
  const createFeature = useMutation(api.features.create);
  const router = useRouter();

  return (
    <AdminOnly>
      <FeatureForm
        initial={EMPTY_FEATURE}
        submitLabel="Create feature"
        onSubmit={async (values) => {
          const featureId = await createFeature(values);
          router.replace({ pathname: "/features/[featureId]", params: { featureId } });
        }}
      />
    </AdminOnly>
  );
}
